import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/**
 * Argon2id nativo do Node (`crypto.argon2`, Node ≥ 24.7) — sem dependência nativa.
 * Parâmetros: recomendação mínima da OWASP (m = 19 MiB, t = 2, p = 1).
 * Formato PHC: `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>` (base64 sem padding),
 * o que permite subir os parâmetros no futuro e re-hashear no próximo login.
 */
export interface Argon2Params {
  readonly memory: number;
  readonly passes: number;
  readonly parallelism: number;
}

export const CURRENT_PARAMS: Argon2Params = { memory: 19_456, passes: 2, parallelism: 1 };

const ALGORITHM = 'argon2id';
const VERSION = 19;
const SALT_BYTES = 16;
const TAG_BYTES = 32;
const PHC_PATTERN =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

interface ParsedHash {
  readonly params: Argon2Params;
  readonly salt: Buffer;
  readonly tag: Buffer;
}

function derive(
  password: string,
  salt: Buffer,
  params: Argon2Params,
  tagLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      ALGORITHM,
      { message: password, nonce: salt, tagLength, ...params },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

function toBase64(buffer: Buffer): string {
  return buffer.toString('base64').replace(/=+$/, '');
}

function encode(params: Argon2Params, salt: Buffer, tag: Buffer): string {
  const { memory, passes, parallelism } = params;
  return `$${ALGORITHM}$v=${VERSION}$m=${memory},t=${passes},p=${parallelism}$${toBase64(salt)}$${toBase64(tag)}`;
}

function parse(encoded: string): ParsedHash | null {
  const match = PHC_PATTERN.exec(encoded);
  if (!match) return null;

  const [, memory, passes, parallelism, salt, tag] = match;
  return {
    params: { memory: Number(memory), passes: Number(passes), parallelism: Number(parallelism) },
    salt: Buffer.from(salt ?? '', 'base64'),
    tag: Buffer.from(tag ?? '', 'base64'),
  };
}

@Injectable()
export class PasswordHasher {
  /** Hash usado quando o usuário não existe, para igualar o tempo de resposta do login. */
  private dummyHash: Promise<string> | undefined;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const tag = await derive(password, salt, CURRENT_PARAMS, TAG_BYTES);
    return encode(CURRENT_PARAMS, salt, tag);
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const parsed = parse(encoded);
    if (!parsed) return false;

    const candidate = await derive(password, parsed.salt, parsed.params, parsed.tag.length);
    return candidate.length === parsed.tag.length && timingSafeEqual(candidate, parsed.tag);
  }

  /** Executa o mesmo custo de uma verificação real, sempre retornando `false`. */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('hex'));
    await this.verify(password, await this.dummyHash);
    return false;
  }

  needsRehash(encoded: string): boolean {
    const parsed = parse(encoded);
    if (!parsed) return true;

    const { memory, passes, parallelism } = parsed.params;
    return (
      memory !== CURRENT_PARAMS.memory ||
      passes !== CURRENT_PARAMS.passes ||
      parallelism !== CURRENT_PARAMS.parallelism
    );
  }
}
