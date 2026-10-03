/**
 * Prefixos de IDs públicos. IDs públicos são opacos e identificáveis
 * (ex.: `pay_01J...`). IDs internos do banco não são expostos.
 */
export const ID_PREFIXES = {
  merchant: 'mer',
  customer: 'cus',
  payment: 'pay',
  event: 'evt',
  webhookEndpoint: 'whk',
  apiKey: 'key',
  request: 'req',
} as const;

export type IdResource = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdResource];
export type PublicId<P extends IdPrefix = IdPrefix> = `${P}_${string}`;

export function hasIdPrefix<P extends IdPrefix>(value: string, prefix: P): value is PublicId<P> {
  return value.startsWith(`${prefix}_`) && value.length > prefix.length + 1;
}
