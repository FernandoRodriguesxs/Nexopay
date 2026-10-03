import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiKey, dashboardHeaders, PASSWORD, signUp } from './support/fixtures.js';
import { createTestApp, DASHBOARD_ORIGIN } from './support/test-app.js';
import type { TestApp } from './support/test-app.js';

/**
 * Percorre os fluxos sensíveis da fundação e verifica que nenhum secret ou dado
 * pessoal aparece nos logs, inclusive em caminhos de erro.
 */
describe('logs never contain secrets or personal data', () => {
  let testApp: TestApp;
  let secrets: string[];

  beforeAll(async () => {
    testApp = await createTestApp();

    const user = await signUp(testApp);
    const key = await createApiKey(testApp, user);
    const revokedKey = await createApiKey(testApp, user);

    await testApp.http.get('/v1/whoami').set('Authorization', `Bearer ${key.secret}`);
    await testApp.http.post(`/v1/api-keys/${revokedKey.id}/revoke`).set(dashboardHeaders(user));
    await testApp.http.get('/v1/whoami').set('Authorization', `Bearer ${revokedKey.secret}`);
    await testApp.http.get('/v1/whoami').set('Authorization', `Bearer sk_test_${'Z'.repeat(43)}`);
    await testApp.http
      .post('/v1/auth/login')
      .set('Origin', DASHBOARD_ORIGIN)
      .send({ email: user.email, password: 'wrong password!!' });
    await testApp.http
      .post('/v1/auth/login')
      .set('Origin', DASHBOARD_ORIGIN)
      .send({ email: user.email, password: PASSWORD });
    await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie);
    // Credenciais em headers de rotas que falham também não podem vazar.
    await testApp.http
      .get('/v1/does-not-exist')
      .set({ Authorization: `Bearer ${key.secret}`, Cookie: user.cookie });

    secrets = [
      key.secret,
      key.secret.slice('sk_test_'.length),
      revokedKey.secret,
      user.sessionToken,
      PASSWORD,
      user.email,
      'test-only-pepper-with-at-least-32-characters',
    ];
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('produced log lines for the exercised flows', () => {
    expect(testApp.logs.length).toBeGreaterThan(8);
  });

  it('contains no API key, session token, password, pepper or email', () => {
    const output = testApp.logs.join('\n');

    for (const secret of secrets) {
      expect(output).not.toContain(secret);
    }
  });

  it('never logs credential headers', () => {
    const output = testApp.logs.join('\n').toLowerCase();

    expect(output).not.toContain('"authorization":"bearer');
    expect(output).not.toContain('np_session=');
  });
});
