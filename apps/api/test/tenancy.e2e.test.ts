import type { ApiKeyResource, ErrorResponse, ListResponse } from '@nexopay/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiKeyRepository } from '../src/modules/api-keys/infrastructure/api-key.repository.js';
import { DatabaseService } from '../src/shared/database/database.service.js';
import { createApiKey, dashboardHeaders, insertApiKey, signUp } from './support/fixtures.js';
import type { SignedUpUser } from './support/fixtures.js';
import { createTestApp } from './support/test-app.js';
import type { TestApp } from './support/test-app.js';

function errorCode(body: unknown): string {
  return (body as ErrorResponse).error.code;
}

describe('multi-tenancy: merchant isolation', () => {
  let testApp: TestApp;
  let merchantA: SignedUpUser;
  let merchantB: SignedUpUser;

  beforeAll(async () => {
    testApp = await createTestApp();
    merchantA = await signUp(testApp);
    merchantB = await signUp(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('merchant A does not see merchant B keys in listings', async () => {
    const keyB = await createApiKey(testApp, merchantB);

    const response = await testApp.http.get('/v1/api-keys').set(dashboardHeaders(merchantA));
    const ids = (response.body as ListResponse<ApiKeyResource>).data.map((key) => key.id);

    expect(response.status).toBe(200);
    expect(ids).not.toContain(keyB.id);
  });

  it('merchant A cannot revoke merchant B keys: 404, and the key keeps working', async () => {
    const keyB = await createApiKey(testApp, merchantB);

    const response = await testApp.http
      .post(`/v1/api-keys/${keyB.id}/revoke`)
      .set(dashboardHeaders(merchantA));

    expect(response.status).toBe(404);
    expect(errorCode(response.body)).toBe('RESOURCE_NOT_FOUND');
    await testApp.http.get('/v1/whoami').set('Authorization', `Bearer ${keyB.secret}`).expect(200);
  });

  it('a user cannot act on a merchant they are not a member of: 404, not 403', async () => {
    const response = await testApp.http
      .get('/v1/api-keys')
      .set(dashboardHeaders(merchantA, merchantB.merchantId));

    expect(response.status).toBe(404);
    expect(errorCode(response.body)).toBe('RESOURCE_NOT_FOUND');
  });

  it('a nonexistent merchant looks exactly like a foreign one (no enumeration)', async () => {
    const foreign = await testApp.http
      .get('/v1/api-keys')
      .set(dashboardHeaders(merchantA, merchantB.merchantId));
    const missing = await testApp.http
      .get('/v1/api-keys')
      .set(dashboardHeaders(merchantA, 'mer_01JABCDEFGHJKMNPQRSTVWXYZ0'));

    const strip = (body: unknown) => ({ ...(body as ErrorResponse).error, requestId: undefined });
    expect(missing.status).toBe(foreign.status);
    expect(strip(missing.body)).toEqual(strip(foreign.body));
  });

  it("merchant B's API key only ever sees merchant B", async () => {
    const keyB = await createApiKey(testApp, merchantB);

    const response = await testApp.http
      .get('/v1/whoami')
      .set('Authorization', `Bearer ${keyB.secret}`);

    expect((response.body as { merchant: { id: string } }).merchant.id).toBe(merchantB.merchantId);
  });

  it('the repository never returns a key outside the given scope', async () => {
    const keyB = await createApiKey(testApp, merchantB);
    const repository = new ApiKeyRepository(testApp.app.get(DatabaseService));

    await expect(
      repository.findById({ merchantId: merchantA.merchantId, environment: 'SANDBOX' }, keyB.id),
    ).resolves.toBeNull();
    await expect(
      repository.revoke({ merchantId: merchantA.merchantId, environment: 'SANDBOX' }, keyB.id, {
        revokedAt: new Date(),
        revokedByUserId: merchantA.userId,
      }),
    ).resolves.toBe(false);
  });
});

describe('multi-tenancy: environment isolation (SANDBOX × PRODUCTION)', () => {
  let testApp: TestApp;
  let owner: SignedUpUser;
  let productionKey: { id: string; secret: string };

  beforeAll(async () => {
    testApp = await createTestApp();
    owner = await signUp(testApp);
    // PRODUCTION ainda não pode ser criado pela API: o cenário é montado direto no banco.
    productionKey = await insertApiKey(testApp.db, {
      merchantId: owner.merchantId,
      userId: owner.userId,
      environment: 'PRODUCTION',
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('sandbox listings never include production keys of the same merchant', async () => {
    await createApiKey(testApp, owner);

    const response = await testApp.http.get('/v1/api-keys').set(dashboardHeaders(owner));
    const keys = (response.body as ListResponse<ApiKeyResource>).data;

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.map((key) => key.id)).not.toContain(productionKey.id);
    expect(keys.every((key) => key.environment === 'SANDBOX')).toBe(true);
  });

  it('a sandbox context cannot revoke a production key of the same merchant', async () => {
    const response = await testApp.http
      .post(`/v1/api-keys/${productionKey.id}/revoke`)
      .set(dashboardHeaders(owner));

    expect(response.status).toBe(404);
    const row = await testApp.db.apiKey.findUniqueOrThrow({ where: { id: productionKey.id } });
    expect(row.revokedAt).toBeNull();
  });

  it('the dashboard cannot switch to PRODUCTION while it is not enabled', async () => {
    const response = await testApp.http
      .get('/v1/api-keys')
      .set({ ...dashboardHeaders(owner), 'X-NexoPay-Environment': 'PRODUCTION' });

    expect(response.status).toBe(403);
    expect(errorCode(response.body)).toBe('ENVIRONMENT_NOT_ENABLED');
  });

  it('a production (sk_live_) key is refused while PRODUCTION is not enabled', async () => {
    const response = await testApp.http
      .get('/v1/whoami')
      .set('Authorization', `Bearer ${productionKey.secret}`);

    expect(response.status).toBe(403);
    expect(errorCode(response.body)).toBe('ENVIRONMENT_NOT_ENABLED');
  });

  it('a sandbox key is scoped to SANDBOX', async () => {
    const created = await createApiKey(testApp, owner);

    const response = await testApp.http
      .get('/v1/whoami')
      .set('Authorization', `Bearer ${created.secret}`);

    expect((response.body as { environment: string }).environment).toBe('SANDBOX');
  });

  it('the repository never crosses environments for the same merchant', async () => {
    const repository = new ApiKeyRepository(testApp.app.get(DatabaseService));
    const sandboxScope = { merchantId: owner.merchantId, environment: 'SANDBOX' } as const;

    await expect(repository.findById(sandboxScope, productionKey.id)).resolves.toBeNull();
    const page = await repository.list(sandboxScope, { limit: 100, startingAfter: undefined });
    expect(page.data.map((key) => key.id)).not.toContain(productionKey.id);
  });

  it('rejects an invalid environment header', async () => {
    const response = await testApp.http
      .get('/v1/api-keys')
      .set({ ...dashboardHeaders(owner), 'X-NexoPay-Environment': 'staging' });

    expect(response.status).toBe(400);
    expect(errorCode(response.body)).toBe('VALIDATION_ERROR');
  });
});
