import {
  RateLimiter,
  retryAfterSeconds,
  windowBounds,
} from '../../src/shared/rate-limit/rate-limiter.js';
import type { RateLimitResult, RateLimitRule } from '../../src/shared/rate-limit/rate-limiter.js';

/** Rate limiter isolado por app de teste (o Redis é compartilhado entre arquivos de teste). */
export class InMemoryRateLimiter extends RateLimiter {
  private readonly counters = new Map<string, number>();

  consume(rule: RateLimitRule, subject: string, now: Date): Promise<RateLimitResult> {
    const { index, endsAt } = windowBounds(rule, now);
    const key = `${rule.name}:${subject}:${index}`;
    const count = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, count);

    return Promise.resolve({
      allowed: count <= rule.limit,
      retryAfterSeconds: retryAfterSeconds(endsAt, now),
    });
  }
}

/** Padrão dos testes: sem limites, para que cenários com muitos signups não interfiram entre si. */
export class AllowAllRateLimiter extends RateLimiter {
  consume(): Promise<RateLimitResult> {
    return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
  }
}
