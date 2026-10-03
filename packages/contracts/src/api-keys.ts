import { z } from 'zod';
import { environmentSchema } from './environment.js';

export const API_KEY_PREFIXES = { SANDBOX: 'sk_test_', PRODUCTION: 'sk_live_' } as const;

export const createApiKeyRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;

export const apiKeySchema = z.object({
  id: z.string(),
  object: z.literal('api_key'),
  name: z.string(),
  environment: environmentSchema,
  /** Dica não secreta, ex.: `sk_test_…a1b2`. */
  hint: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});

export type ApiKeyResource = z.infer<typeof apiKeySchema>;

/** Resposta da criação: a única vez em que `secret` é retornado. */
export const createdApiKeySchema = apiKeySchema.extend({
  secret: z.string(),
});

export type CreatedApiKeyResource = z.infer<typeof createdApiKeySchema>;
