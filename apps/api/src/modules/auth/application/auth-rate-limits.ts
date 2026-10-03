import { createHash } from 'node:crypto';
import { RateLimitedError } from '../../../shared/errors/app-error.js';
import type { RateLimiter, RateLimitRule } from '../../../shared/rate-limit/rate-limiter.js';

/**
 * Limites técnicos contra força bruta e abuso de CPU (Argon2 é caro de propósito).
 * Não são limites de negócio.
 */
export const LOGIN_PER_IP: RateLimitRule = { name: 'login:ip', limit: 30, windowSeconds: 900 };
export const LOGIN_PER_EMAIL: RateLimitRule = {
  name: 'login:email',
  limit: 10,
  windowSeconds: 900,
};
export const SIGNUP_PER_IP: RateLimitRule = { name: 'signup:ip', limit: 10, windowSeconds: 3600 };

/** Chaves de rate limit nunca carregam IP ou email em claro. */
export function rateLimitSubject(value: string | undefined): string {
  return createHash('sha256')
    .update(value ?? 'unknown')
    .digest('hex')
    .slice(0, 32);
}

export async function enforceRateLimit(
  limiter: RateLimiter,
  rule: RateLimitRule,
  subject: string | undefined,
  now: Date,
): Promise<void> {
  const result = await limiter.consume(rule, rateLimitSubject(subject), now);
  if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds);
}
