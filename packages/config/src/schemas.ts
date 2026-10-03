import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export const logLevelSchema = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info');

const portSchema = z.coerce.number().int().min(1).max(65_535);

const postgresUrlSchema = z
  .url()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// URL');

const redisUrlSchema = z
  .url()
  .refine((value) => /^rediss?:\/\//.test(value), 'must be a redis:// or rediss:// URL');

/** Origem HTTP(S) sem path, ex.: `https://dashboard.nexopay.com`. */
const originSchema = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), 'must be an http(s) URL')
  .transform((value) => new URL(value).origin);

/** Secret de alta entropia (ex.: `openssl rand -base64 48`). */
const secretSchema = z.string().min(32, 'must have at least 32 characters');

/** Environment da API (apps/api). */
export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  API_PORT: portSchema.default(4000),
  API_PUBLIC_URL: z.url(),
  DATABASE_URL: postgresUrlSchema,
  REDIS_URL: redisUrlSchema,
  /** Pepper do HMAC-SHA256 das API Keys. Trocar invalida todas as keys existentes. */
  API_KEY_PEPPER: secretSchema,
  /** Origem do dashboard: única origem aceita em CORS com credenciais e na checagem CSRF. */
  DASHBOARD_ORIGIN: originSchema,
});

export type ApiEnv = z.output<typeof apiEnvSchema>;

/** Environment do pacote database (CLI do Prisma, scripts). */
export const databaseEnvSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
});

export type DatabaseEnv = z.output<typeof databaseEnvSchema>;

/** Environment público do dashboard (exposto ao browser). */
export const dashboardPublicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_CHECKOUT_URL: z.url(),
});

export type DashboardPublicEnv = z.output<typeof dashboardPublicEnvSchema>;

/** Environment público do checkout hospedado. */
export const checkoutPublicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

export type CheckoutPublicEnv = z.output<typeof checkoutPublicEnvSchema>;
