import type {
  ApiKeyResource,
  CreatedApiKeyResource,
  ErrorResponse,
  ListResponse,
  WhoamiResponse,
} from '@nexopay/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiKeySecrets } from '../src/modules/api-keys/infrastructure/api-key-secrets.js';
import { createApiKey, dashboardHeaders, signUp } from './support/fixtures.js';
import type { SignedUpUser } from './support/fixtures.js';
import { createTestApp, DASHBOARD_ORIGIN, testEnv } from './support/test-app.js';
import type { TestApp } from './support/test-app.js';

function errorCode(body: unknown): string {
  return (body as ErrorResponse).error.code;
}

describe('API keys', () => {
  let testApp: TestApp;
  let owner: SignedUpUser;

  beforeAll(async () => {
    testApp = await createTestApp();
    owner = await signUp(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const whoami = (secret: string) =>
    testApp.http.get('/v1/whoami').set('Authorization', `Bearer ${secret}`);

  describe('creation', () => {
    it('returns the full secret exactly once, with a non-secret hint', async () => {
      const created = await createApiKey(testApp, owner, 'Production backend');

      expect(created).toMatchObject({
        object: 'api_key',
        name: 'Production backend',
        environment: 'SANDBOX',
        lastUsedAt: null,
        revokedAt: null,
      });
      expect(created.id).toMatch(/^key_[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(created.secret).toMatch(/^sk_test_[0-9A-Za-z]{43}$/);
      expect(created.hint).toBe(`sk_test_…${created.secret.slice(-4)}`);
    });

    it('never stores the full key (nor its random part) in the database', async () => {
      const created = await createApiKey(testApp, owner);
      const randomPart = created.secret.slice('sk_test_'.length);

      const row = await testApp.db.apiKey.findUniqueOrThrow({ where: { id: created.id } });
      const serializedRow = JSON.stringify(row);
      expect(serializedRow).not.toContain(created.secret);
      expect(serializedRow).not.toContain(randomPart);
      expect(serializedRow).not.toContain(randomPart.slice(0, 16));
      expect(row.hash).toBe(new ApiKeySecrets(testEnv()).hash(created.secret));

      const audit = await testApp.db.auditLog.findMany({ where: { resourceId: created.id } });
      expect(audit.map((entry) => entry.action)).toEqual(['api_key.created']);
      expect(JSON.stringify(audit)).not.toContain(randomPart);
    });

    it('never returns the secret when listing', async () => {
      const created = await createApiKey(testApp, owner);

      const response = await testApp.http.get('/v1/api-keys').set(dashboardHeaders(owner));

      expect(response.status).toBe(200);
      const list = response.body as ListResponse<ApiKeyResource>;
      expect(list.object).toBe('list');
      expect(list.data.map((key) => key.id)).toContain(created.id);
      expect(JSON.stringify(list)).not.toContain(created.secret);
      expect(list.data.every((key) => !('secret' in key))).toBe(true);
    });

    it('validates the name', async () => {
      const response = await testApp.http
        .post('/v1/api-keys')
        .set(dashboardHeaders(owner))
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(errorCode(response.body)).toBe('VALIDATION_ERROR');
    });
  });

  describe('listing', () => {
    it('paginates newest first with startingAfter', async () => {
      const user = await signUp(testApp);
      const first = await createApiKey(testApp, user, 'first');
      const second = await createApiKey(testApp, user, 'second');
      const third = await createApiKey(testApp, user, 'third');

      const page1 = await testApp.http.get('/v1/api-keys?limit=2').set(dashboardHeaders(user));
      const body1 = page1.body as ListResponse<ApiKeyResource>;
      expect(body1.data.map((key) => key.id)).toEqual([third.id, second.id]);
      expect(body1.hasMore).toBe(true);

      const page2 = await testApp.http
        .get(`/v1/api-keys?limit=2&startingAfter=${second.id}`)
        .set(dashboardHeaders(user));
      const body2 = page2.body as ListResponse<ApiKeyResource>;
      expect(body2.data.map((key) => key.id)).toEqual([first.id]);
      expect(body2.hasMore).toBe(false);
    });

    it('rejects an invalid cursor or limit', async () => {
      const badCursor = await testApp.http
        .get('/v1/api-keys?startingAfter=pay_123')
        .set(dashboardHeaders(owner));
      const badLimit = await testApp.http
        .get('/v1/api-keys?limit=1000')
        .set(dashboardHeaders(owner));

      expect(badCursor.status).toBe(400);
      expect(badLimit.status).toBe(400);
    });
  });

  describe('authentication with an API key', () => {
    it('identifies merchant, environment and key', async () => {
      const created = await createApiKey(testApp, owner, 'whoami');

      const response = await whoami(created.secret);

      expect(response.status).toBe(200);
      expect(response.body as WhoamiResponse).toEqual({
        object: 'whoami',
        environment: 'SANDBOX',
        merchant: { id: owner.merchantId, object: 'merchant', name: 'Acme' },
        apiKey: { id: created.id, object: 'api_key', name: 'whoami' },
      });
    });

    it('records lastUsedAt', async () => {
      const created = await createApiKey(testApp, owner);

      await whoami(created.secret).expect(200);

      const row = await testApp.db.apiKey.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.lastUsedAt).not.toBeNull();
    });

    it.each([
      ['an unknown key', `sk_test_${'a'.repeat(43)}`],
      ['a malformed key', 'sk_test_short'],
      ['a non-NexoPay token', 'eyJhbGciOiJIUzI1NiJ9.e30.x'],
    ])('rejects %s with INVALID_API_KEY', async (_label, secret) => {
      const response = await whoami(secret);

      expect(response.status).toBe(401);
      expect(errorCode(response.body)).toBe('INVALID_API_KEY');
    });

    it('rejects a key with a tampered prefix', async () => {
      const created = await createApiKey(testApp, owner);

      const response = await whoami(created.secret.replace('sk_test_', 'sk_live_'));

      expect(response.status).toBe(401);
      expect(errorCode(response.body)).toBe('INVALID_API_KEY');
    });

    it('requires the Authorization header and ignores session cookies', async () => {
      const response = await testApp.http.get('/v1/whoami').set('Cookie', owner.cookie);

      expect(response.status).toBe(401);
      expect(errorCode(response.body)).toBe('UNAUTHENTICATED');
    });

    it('rejects non-Bearer schemes', async () => {
      const created = await createApiKey(testApp, owner);

      const response = await testApp.http
        .get('/v1/whoami')
        .set('Authorization', `Basic ${created.secret}`);

      expect(response.status).toBe(401);
      expect(errorCode(response.body)).toBe('INVALID_API_KEY');
    });
  });

  describe('revocation', () => {
    it('stops the key from working immediately', async () => {
      const created = await createApiKey(testApp, owner);
      await whoami(created.secret).expect(200);

      const revoke = await testApp.http
        .post(`/v1/api-keys/${created.id}/revoke`)
        .set(dashboardHeaders(owner));
      expect(revoke.status).toBe(200);
      expect((revoke.body as ApiKeyResource).revokedAt).not.toBeNull();

      const afterRevoke = await whoami(created.secret);
      expect(afterRevoke.status).toBe(401);
      expect(errorCode(afterRevoke.body)).toBe('API_KEY_REVOKED');
    });

    it('is idempotent and audited once, even under concurrency', async () => {
      const created = await createApiKey(testApp, owner);
      const revoke = () =>
        testApp.http.post(`/v1/api-keys/${created.id}/revoke`).set(dashboardHeaders(owner));

      const responses = await Promise.all([revoke(), revoke(), revoke()]);
      const again = await revoke();

      expect([...responses, again].map((response) => response.status)).toEqual([
        200, 200, 200, 200,
      ]);
      const revokedAt = new Set(
        [...responses, again].map((response) => (response.body as ApiKeyResource).revokedAt),
      );
      expect(revokedAt.size).toBe(1);
      const audit = await testApp.db.auditLog.count({
        where: { resourceId: created.id, action: 'api_key.revoked' },
      });
      expect(audit).toBe(1);
    });

    it('returns 404 for an unknown key id', async () => {
      const response = await testApp.http
        .post('/v1/api-keys/key_01JABCDEFGHJKMNPQRSTVWXYZ0/revoke')
        .set(dashboardHeaders(owner));

      expect(response.status).toBe(404);
      expect(errorCode(response.body)).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('an API key cannot administer API keys', () => {
    let secret: string;
    let target: CreatedApiKeyResource;

    beforeAll(async () => {
      secret = (await createApiKey(testApp, owner)).secret;
      target = await createApiKey(testApp, owner);
    });

    it.each([
      ['create', 'post', '/v1/api-keys'],
      ['list', 'get', '/v1/api-keys'],
    ] as const)('cannot %s keys', async (_label, method, path) => {
      const response = await testApp.http[method](path)
        .set({
          Authorization: `Bearer ${secret}`,
          Origin: DASHBOARD_ORIGIN,
          'X-NexoPay-Merchant': owner.merchantId,
        })
        .send({ name: 'escalation' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body)).toBe('FORBIDDEN');
    });

    it('cannot revoke keys', async () => {
      const response = await testApp.http.post(`/v1/api-keys/${target.id}/revoke`).set({
        Authorization: `Bearer ${secret}`,
        Origin: DASHBOARD_ORIGIN,
        'X-NexoPay-Merchant': owner.merchantId,
      });

      expect(response.status).toBe(403);
      const row = await testApp.db.apiKey.findUniqueOrThrow({ where: { id: target.id } });
      expect(row.revokedAt).toBeNull();
    });

    it('creates no keys through an API key', async () => {
      const count = await testApp.db.apiKey.count({
        where: { merchantId: owner.merchantId, name: 'escalation' },
      });

      expect(count).toBe(0);
    });
  });

  describe('a session that is not valid cannot administer API keys', () => {
    async function expireSession(user: SignedUpUser): Promise<void> {
      await testApp.db.session.updateMany({
        where: { userId: user.userId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
    }

    async function revokeSession(user: SignedUpUser): Promise<void> {
      await testApp.http
        .post('/v1/auth/logout')
        .set({ Cookie: user.cookie, Origin: DASHBOARD_ORIGIN })
        .expect(204);
    }

    it.each([
      ['expired', expireSession],
      ['revoked (logout)', revokeSession],
    ])('rejects an %s session', async (_label, invalidate) => {
      const user = await signUp(testApp);
      const target = await createApiKey(testApp, user);
      await invalidate(user);

      const create = await testApp.http
        .post('/v1/api-keys')
        .set(dashboardHeaders(user))
        .send({ name: 'x' });
      const list = await testApp.http.get('/v1/api-keys').set(dashboardHeaders(user));
      const revoke = await testApp.http
        .post(`/v1/api-keys/${target.id}/revoke`)
        .set(dashboardHeaders(user));

      expect([create.status, list.status, revoke.status]).toEqual([401, 401, 401]);
      expect(await testApp.db.apiKey.count({ where: { merchantId: user.merchantId } })).toBe(1);
      await whoami(target.secret).expect(200);
    });

    it('rejects a forged session cookie', async () => {
      const headers = { ...dashboardHeaders(owner), Cookie: `np_session=${'B'.repeat(43)}` };

      const response = await testApp.http.post('/v1/api-keys').set(headers).send({ name: 'x' });

      expect(response.status).toBe(401);
      expect(errorCode(response.body)).toBe('UNAUTHENTICATED');
    });

    it('rejects requests without the active merchant header', async () => {
      const response = await testApp.http
        .post('/v1/api-keys')
        .set({ Cookie: owner.cookie, Origin: DASHBOARD_ORIGIN })
        .send({ name: 'x' });

      expect(response.status).toBe(400);
      expect(errorCode(response.body)).toBe('VALIDATION_ERROR');
    });
  });
});
