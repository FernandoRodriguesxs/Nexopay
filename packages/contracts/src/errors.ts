import { z } from 'zod';

/**
 * Códigos de erro da API. O código é estável e é o que integrações devem tratar;
 * a mensagem é apenas informativa e pode mudar.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'INVALID_API_KEY',
  'API_KEY_REVOKED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'INVALID_ORIGIN',
  'ENVIRONMENT_NOT_ENABLED',
  'SANDBOX_ONLY',
  'RESOURCE_NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'EMAIL_ALREADY_REGISTERED',
  'IDEMPOTENCY_CONFLICT',
  'IDEMPOTENCY_IN_PROGRESS',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ErrorDetail = z.infer<typeof errorDetailSchema>;

/** Corpo de toda resposta de erro da API. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.array(errorDetailSchema).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
