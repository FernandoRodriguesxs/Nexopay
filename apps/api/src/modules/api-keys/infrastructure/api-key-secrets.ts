import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnv } from '@nexopay/config';
import { API_KEY_PREFIXES } from '@nexopay/contracts';
import type { Environment } from '@nexopay/contracts';
import { API_ENV } from '../../../config/env.js';

/**
 * Formato: `sk_test_` | `sk_live_` + 32 bytes aleatórios em base62 (43 caracteres, 256 bits).
 * Armazenamento: HMAC-SHA256(API_KEY_PEPPER, key) em hex, com índice único → lookup O(1).
 * Com 256 bits de entropia, hash lento (argon2/bcrypt) não agrega segurança e impediria
 * o lookup determinístico. O pepper (fora do banco) impede ataques offline com um dump.
 */
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SECRET_BYTES = 32;
const SECRET_LENGTH = 43;
const API_KEY_PATTERN = /^sk_(test|live)_([0-9A-Za-z]{43})$/;
const HINT_SUFFIX_LENGTH = 4;

export interface GeneratedApiKey {
  /** Valor completo — devolvido ao usuário uma única vez, nunca persistido. */
  readonly secret: string;
  readonly hash: string;
  readonly hint: string;
}

function toBase62(bytes: Buffer): string {
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  while (value > 0n) {
    encoded = `${BASE62.charAt(Number(value % 62n))}${encoded}`;
    value /= 62n;
  }
  return encoded.padStart(SECRET_LENGTH, '0');
}

/** Ambiente declarado pelo prefixo, ou `null` se o formato for inválido. */
export function parseApiKeyEnvironment(secret: string): Environment | null {
  const match = API_KEY_PATTERN.exec(secret);
  if (!match) return null;

  return match[1] === 'live' ? 'PRODUCTION' : 'SANDBOX';
}

export function apiKeyHint(secret: string): string {
  const prefix = secret.slice(0, secret.indexOf('_', 3) + 1);
  return `${prefix}…${secret.slice(-HINT_SUFFIX_LENGTH)}`;
}

@Injectable()
export class ApiKeySecrets {
  private readonly pepper: string;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.pepper = env.API_KEY_PEPPER;
  }

  generate(environment: Environment): GeneratedApiKey {
    const secret = `${API_KEY_PREFIXES[environment]}${toBase62(randomBytes(SECRET_BYTES))}`;
    return { secret, hash: this.hash(secret), hint: apiKeyHint(secret) };
  }

  hash(secret: string): string {
    return createHmac('sha256', this.pepper).update(secret).digest('hex');
  }
}
