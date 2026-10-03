import { randomBytes } from 'node:crypto';
import type { IdPrefix, PublicId } from '@nexopay/contracts';

/** Crockford base32 (sem I, L, O, U), conforme a especificação ULID. */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;
const RANDOM_BYTES = 10; // 80 bits
const MAX_TIME = 2 ** 48 - 1;

function encodeTime(timestamp: number): string {
  if (!Number.isInteger(timestamp) || timestamp < 0 || timestamp > MAX_TIME) {
    throw new RangeError('ULID timestamp out of range');
  }

  let remaining = timestamp;
  let encoded = '';
  for (let index = 0; index < TIME_LENGTH; index += 1) {
    encoded = `${ENCODING.charAt(remaining % 32)}${encoded}`;
    remaining = Math.floor(remaining / 32);
  }
  return encoded;
}

function encodeRandom(bytes: Uint8Array): string {
  let value = BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
  let encoded = '';
  for (let index = 0; index < RANDOM_LENGTH; index += 1) {
    encoded = `${ENCODING.charAt(Number(value & 31n))}${encoded}`;
    value >>= 5n;
  }
  return encoded;
}

/** ULID: 48 bits de timestamp (ms) + 80 bits aleatórios — ordenável no tempo. */
export function ulid(
  timestamp: number = Date.now(),
  random: Uint8Array = randomBytes(RANDOM_BYTES),
): string {
  if (random.length !== RANDOM_BYTES) throw new RangeError('ULID requires 10 random bytes');

  return `${encodeTime(timestamp)}${encodeRandom(random)}`;
}

/** Gera um ID público, ex.: `generateId('key')` → `key_01J9Z...`. */
export function generateId<P extends IdPrefix>(prefix: P): PublicId<P> {
  return `${prefix}_${ulid()}`;
}
