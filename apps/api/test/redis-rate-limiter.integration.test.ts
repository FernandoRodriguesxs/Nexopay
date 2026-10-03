import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { RedisRateLimiter } from '../src/shared/rate-limit/redis-rate-limiter.js';
import { RedisConnection } from '../src/shared/redis/redis-connection.js';
import { testEnv } from './support/test-app.js';

describe('RedisRateLimiter', () => {
  const connection = new RedisConnection(testEnv());
  // Namespace único por execução: o Redis é compartilhado com o desenvolvimento local.
  const namespace = `test-ratelimit:${randomBytes(6).toString('hex')}`;
  const limiter = new RedisRateLimiter(connection, namespace);
  const rule = { name: 'login:email', limit: 3, windowSeconds: 60 };
  const now = new Date('2026-10-03T12:00:10.000Z');

  afterAll(() => {
    connection.onModuleDestroy();
  });

  it('allows up to the limit within a window and then blocks', async () => {
    const results = [];
    for (let index = 0; index < 4; index += 1) {
      results.push(await limiter.consume(rule, 'subject-a', now));
    }

    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    expect(results[3]?.retryAfterSeconds).toBe(50);
  });

  it('counts subjects independently', async () => {
    await limiter.consume(rule, 'subject-b', now);

    await expect(limiter.consume(rule, 'subject-c', now)).resolves.toMatchObject({ allowed: true });
  });

  it('starts a fresh count in the next window', async () => {
    for (let index = 0; index < 4; index += 1) await limiter.consume(rule, 'subject-d', now);

    const nextWindow = new Date('2026-10-03T12:01:00.000Z');
    await expect(limiter.consume(rule, 'subject-d', nextWindow)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it('sets a TTL so counters do not live forever', async () => {
    await limiter.consume(rule, 'subject-e', now);

    const keys = await connection.client.keys(`nexopay:${namespace}:*subject-e*`);
    expect(keys).toHaveLength(1);
    const ttl = await connection.client.ttl((keys[0] ?? '').replace(/^nexopay:/, ''));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });
});
