import { z } from 'zod';

/**
 * Prefixos de IDs públicos. IDs públicos são opacos e identificáveis
 * (ex.: `pay_01J...`). IDs internos do banco não são expostos.
 */
export const ID_PREFIXES = {
  merchant: 'mer',
  user: 'usr',
  customer: 'cus',
  payment: 'pay',
  transaction: 'txn',
  event: 'evt',
  webhookEndpoint: 'whk',
  webhookDelivery: 'dlv',
  apiKey: 'key',
  request: 'req',
} as const;

export type IdResource = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdResource];
export type PublicId<P extends IdPrefix = IdPrefix> = `${P}_${string}`;

/** ULID em Crockford base32 (26 caracteres, sem I, L, O, U). */
export const ULID_PATTERN = '[0-9A-HJKMNP-TV-Z]{26}';

export function hasIdPrefix<P extends IdPrefix>(value: string, prefix: P): value is PublicId<P> {
  return value.startsWith(`${prefix}_`) && value.length > prefix.length + 1;
}

/** Valida o formato completo `<prefixo>_<ULID>`. */
export function isPublicId<P extends IdPrefix>(value: string, prefix: P): value is PublicId<P> {
  return new RegExp(`^${prefix}_${ULID_PATTERN}$`).test(value);
}

export function publicIdSchema<P extends IdPrefix>(prefix: P) {
  return z.string().refine((value): value is PublicId<P> => isPublicId(value, prefix), {
    message: `Expected an id in the format ${prefix}_<ULID>`,
  });
}
