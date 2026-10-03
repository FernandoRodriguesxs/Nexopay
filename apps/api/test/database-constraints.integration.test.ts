import { randomBytes } from 'node:crypto';
import { createPrismaClient } from '@nexopay/database';
import type { PrismaClient } from '@nexopay/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateId } from '../src/shared/ids/generate-id.js';
import { requireTestDatabaseUrl } from './support/load-test-env.js';

/** Hashes únicos por execução: o banco de testes não é truncado entre execuções. */
const randomHex = () => randomBytes(32).toString('hex');

/** Invariantes protegidas pelo próprio PostgreSQL (defesa em profundidade). */
describe('database constraints', () => {
  let db: PrismaClient;
  let userId: string;
  let merchantId: string;

  beforeAll(async () => {
    db = createPrismaClient({ databaseUrl: requireTestDatabaseUrl() });
    userId = generateId('usr');
    merchantId = generateId('mer');
    await db.user.create({
      data: { id: userId, email: `${userId.toLowerCase()}@example.com`, passwordHash: 'x' },
    });
    await db.merchant.create({ data: { id: merchantId, name: 'Constraints' } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const apiKeyData = (overrides: Record<string, unknown> = {}) => ({
    id: generateId('key'),
    merchantId,
    environment: 'SANDBOX' as const,
    name: 'k',
    hash: randomHex(),
    hint: 'sk_test_…abcd',
    createdByUserId: userId,
    ...overrides,
  });

  it('rejects emails that are not lowercase', async () => {
    await expect(
      db.user.create({
        data: { id: generateId('usr'), email: 'Upper@Example.com', passwordHash: 'x' },
      }),
    ).rejects.toThrow();
  });

  it('rejects ids without the entity prefix', async () => {
    await expect(
      db.merchant.create({ data: { id: generateId('usr'), name: 'x' } }),
    ).rejects.toThrow();
    await expect(db.merchant.create({ data: { id: 'mer_123', name: 'x' } })).rejects.toThrow();
  });

  it('rejects an API key whose hint does not match its environment', async () => {
    await expect(
      db.apiKey.create({ data: apiKeyData({ environment: 'PRODUCTION', hash: randomHex() }) }),
    ).rejects.toThrow();
  });

  it('rejects an API key whose hash is not a 64-char hex HMAC (e.g. a plaintext key)', async () => {
    await expect(
      db.apiKey.create({ data: apiKeyData({ hash: `sk_test_${'a'.repeat(43)}` }) }),
    ).rejects.toThrow();
  });

  it('rejects two API keys with the same hash', async () => {
    const hash = randomHex();
    await db.apiKey.create({ data: apiKeyData({ hash }) });

    await expect(db.apiKey.create({ data: apiKeyData({ hash }) })).rejects.toThrow();
  });

  it('rejects a second membership of the same user in the same merchant', async () => {
    await db.merchantMember.create({ data: { merchantId, userId, role: 'OWNER' } });

    await expect(
      db.merchantMember.create({ data: { merchantId, userId, role: 'ADMIN' } }),
    ).rejects.toThrow();
  });

  it('rejects a session whose idle expiration exceeds the absolute one', async () => {
    const now = new Date();
    await expect(
      db.session.create({
        data: {
          userId,
          tokenHash: randomHex(),
          lastSeenAt: now,
          expiresAt: new Date(now.getTime() + 2000),
          absoluteExpiresAt: new Date(now.getTime() + 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicated idempotency keys per merchant + environment', async () => {
    const data = {
      merchantId,
      environment: 'SANDBOX' as const,
      key: 'order-123',
      requestHash: randomHex(),
      status: 'IN_PROGRESS' as const,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    await db.idempotencyKey.create({ data });

    await expect(db.idempotencyKey.create({ data })).rejects.toThrow();
    await expect(
      db.idempotencyKey.create({ data: { ...data, environment: 'PRODUCTION' } }),
    ).resolves.toBeDefined();
  });

  it('keeps the audit log append-only', async () => {
    const entry = await db.auditLog.create({
      data: { actorType: 'SYSTEM', action: 'test.append_only', merchantId },
    });

    await expect(
      db.auditLog.update({ where: { id: entry.id }, data: { action: 'tampered' } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
  });
});
