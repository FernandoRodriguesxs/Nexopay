import { z } from 'zod';

/** Headers da API (nomes em minúsculas, como chegam no Node). */
export const HEADERS = {
  requestId: 'x-request-id',
  merchant: 'x-nexopay-merchant',
  environment: 'x-nexopay-environment',
  idempotencyKey: 'idempotency-key',
  idempotentReplayed: 'idempotent-replayed',
} as const;

/** Cookie da sessão do dashboard. */
export const SESSION_COOKIE_NAME = 'np_session';

/**
 * Formato aceito para `Idempotency-Key` (usado a partir da Etapa D):
 * 1–255 caracteres imprimíveis ASCII, sem espaços nas pontas.
 */
export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\x21-\x7E](?:[\x20-\x7E]*[\x21-\x7E])?$/, 'Must be printable ASCII');

export const listQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startingAfter: z.string().min(1).max(64).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export interface ListResponse<T> {
  readonly object: 'list';
  readonly data: readonly T[];
  readonly hasMore: boolean;
}
