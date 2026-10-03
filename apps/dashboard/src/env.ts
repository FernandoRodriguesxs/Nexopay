import { dashboardPublicEnvSchema, parseEnv } from '@nexopay/config';

// Variáveis NEXT_PUBLIC_* precisam ser referenciadas estaticamente para o bundler.
export const env = parseEnv(dashboardPublicEnvSchema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_CHECKOUT_URL: process.env.NEXT_PUBLIC_CHECKOUT_URL,
});
