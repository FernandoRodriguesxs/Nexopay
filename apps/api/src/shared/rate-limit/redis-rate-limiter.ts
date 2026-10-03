import { RedisConnection } from '../redis/redis-connection.js';
import { RateLimiter, retryAfterSeconds, windowBounds } from './rate-limiter.js';
import type { RateLimitResult, RateLimitRule } from './rate-limiter.js';

/** Rate limit de janela fixa com INCR + EXPIRE atômicos (MULTI). Instanciado via factory. */
export class RedisRateLimiter extends RateLimiter {
  constructor(
    private readonly redis: RedisConnection,
    private readonly namespace = 'ratelimit',
  ) {
    super();
  }

  async consume(rule: RateLimitRule, subject: string, now: Date): Promise<RateLimitResult> {
    const { index, endsAt } = windowBounds(rule, now);
    const key = `${this.namespace}:${rule.name}:${subject}:${index}`;
    const results = await this.redis.client
      .multi()
      .incr(key)
      .expire(key, rule.windowSeconds)
      .exec();
    const count = Number(results?.[0]?.[1] ?? Number.POSITIVE_INFINITY);

    return { allowed: count <= rule.limit, retryAfterSeconds: retryAfterSeconds(endsAt, now) };
  }
}
