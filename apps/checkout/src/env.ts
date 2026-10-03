import { checkoutPublicEnvSchema, parseEnv } from '@nexopay/config';

export const env = parseEnv(checkoutPublicEnvSchema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
