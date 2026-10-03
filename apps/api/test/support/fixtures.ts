import { randomBytes } from 'node:crypto';
import type { CreatedApiKeyResource, CurrentUserResponse, Environment } from '@nexopay/contracts';
import type { PrismaClient } from '@nexopay/database';
import { expect } from 'vitest';
import { ApiKeySecrets } from '../../src/modules/api-keys/infrastructure/api-key-secrets.js';
import { generateId } from '../../src/shared/ids/generate-id.js';
import { DASHBOARD_ORIGIN, testEnv } from './test-app.js';
import type { TestApp } from './test-app.js';

export const PASSWORD = 'correct horse battery staple';

export interface SignedUpUser {
  readonly email: string;
  readonly userId: string;
  readonly merchantId: string;
  /** Header `Cookie` pronto para reenviar. */
  readonly cookie: string;
  readonly sessionToken: string;
}

export function uniqueEmail(): string {
  return `dev-${randomBytes(8).toString('hex')}@example.com`;
}

function sessionCookieFrom(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = cookies.find((cookie) => cookie.startsWith('np_session='));
  if (!session) throw new Error('Session cookie was not set');
  return session.split(';')[0] ?? '';
}

export async function signUp(testApp: TestApp, email = uniqueEmail()): Promise<SignedUpUser> {
  const response = await testApp.http
    .post('/v1/auth/signup')
    .set('Origin', DASHBOARD_ORIGIN)
    .send({ email, password: PASSWORD, merchantName: 'Acme' });
  expect(response.status).toBe(201);

  const body = response.body as CurrentUserResponse;
  const cookie = sessionCookieFrom(response.headers['set-cookie']);
  return {
    email,
    userId: body.user.id,
    merchantId: body.memberships[0]?.merchant.id ?? '',
    cookie,
    sessionToken: cookie.slice('np_session='.length),
  };
}

/** Headers de uma chamada do dashboard (sessão + merchant ativo + origem confiável). */
export function dashboardHeaders(
  user: SignedUpUser,
  merchantId = user.merchantId,
): Record<string, string> {
  return { Cookie: user.cookie, Origin: DASHBOARD_ORIGIN, 'X-NexoPay-Merchant': merchantId };
}

export async function createApiKey(
  testApp: TestApp,
  user: SignedUpUser,
  name = 'Backend',
): Promise<CreatedApiKeyResource> {
  const response = await testApp.http
    .post('/v1/api-keys')
    .set(dashboardHeaders(user))
    .send({ name });
  expect(response.status).toBe(201);
  return response.body as CreatedApiKeyResource;
}

/**
 * Insere uma API Key direto no banco — usado para montar cenários que a API
 * não permite criar (ex.: PRODUCTION, ainda desabilitado).
 */
export async function insertApiKey(
  db: PrismaClient,
  input: { merchantId: string; userId: string; environment: Environment },
): Promise<{ id: string; secret: string }> {
  const generated = new ApiKeySecrets(testEnv()).generate(input.environment);
  const id = generateId('key');
  await db.apiKey.create({
    data: {
      id,
      merchantId: input.merchantId,
      environment: input.environment,
      name: `${input.environment} key`,
      hash: generated.hash,
      hint: generated.hint,
      createdByUserId: input.userId,
    },
  });
  return { id, secret: generated.secret };
}
