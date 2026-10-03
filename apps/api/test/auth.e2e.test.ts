import type { CurrentUserResponse, ErrorResponse } from '@nexopay/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSessionToken } from '../src/modules/auth/infrastructure/session-tokens.js';
import { PASSWORD, signUp, uniqueEmail } from './support/fixtures.js';
import { InMemoryRateLimiter } from './support/in-memory-rate-limiter.js';
import { createTestApp, DASHBOARD_ORIGIN } from './support/test-app.js';
import type { TestApp } from './support/test-app.js';

function errorCode(body: unknown): string {
  return (body as ErrorResponse).error.code;
}

describe('dashboard authentication', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('signup', () => {
    it('creates user, merchant (OWNER), session and audit log', async () => {
      const email = uniqueEmail();
      const user = await signUp(testApp, email);

      const me = await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie);
      const body = me.body as CurrentUserResponse;
      expect(me.status).toBe(200);
      expect(body.user).toMatchObject({ object: 'user', email });
      expect(body.user.id).toMatch(/^usr_[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(body.memberships).toEqual([
        {
          object: 'membership',
          role: 'OWNER',
          merchant: { id: user.merchantId, object: 'merchant', name: 'Acme' },
        },
      ]);

      const audit = await testApp.db.auditLog.findMany({ where: { actorId: user.userId } });
      expect(audit.map((entry) => entry.action)).toEqual(['user.signed_up']);
    });

    it('stores the password only as an Argon2id hash and normalizes the email', async () => {
      const email = uniqueEmail();
      await signUp(testApp, email.toUpperCase());

      const stored = await testApp.db.user.findUniqueOrThrow({ where: { email } });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(stored.passwordHash).not.toContain(PASSWORD);
    });

    it('sets an HttpOnly, SameSite=Lax, host-only session cookie (not Secure outside production)', async () => {
      const response = await testApp.http
        .post('/v1/auth/signup')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: uniqueEmail(), password: PASSWORD, merchantName: 'Acme' });

      const cookie = String(response.headers['set-cookie']);
      expect(cookie).toMatch(/^np_session=[A-Za-z0-9_-]{43};/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain('Domain=');
      expect(cookie).not.toContain('Secure');
    });

    it('stores only the SHA-256 of the session token', async () => {
      const user = await signUp(testApp);

      const sessions = await testApp.db.session.findMany({ where: { userId: user.userId } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.tokenHash).toBe(hashSessionToken(user.sessionToken));
      expect(JSON.stringify(sessions)).not.toContain(user.sessionToken);
    });

    it('rejects a duplicate email (case-insensitive) with EMAIL_ALREADY_REGISTERED', async () => {
      const email = uniqueEmail();
      await signUp(testApp, email);

      const response = await testApp.http
        .post('/v1/auth/signup')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: email.toUpperCase(), password: PASSWORD, merchantName: 'Other' });

      expect(response.status).toBe(409);
      expect(errorCode(response.body)).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('rejects short passwords and unknown fields', async () => {
      const response = await testApp.http
        .post('/v1/auth/signup')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: uniqueEmail(), password: 'short', merchantName: 'Acme', role: 'ADMIN' });

      expect(response.status).toBe(400);
      expect(errorCode(response.body)).toBe('VALIDATION_ERROR');
      const paths = (response.body as ErrorResponse).error.details?.map((detail) => detail.path);
      expect(paths).toEqual(expect.arrayContaining(['password']));
    });
  });

  describe('login', () => {
    it('opens a new session with valid credentials', async () => {
      const user = await signUp(testApp);

      const response = await testApp.http
        .post('/v1/auth/login')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: user.email, password: PASSWORD });

      expect(response.status).toBe(200);
      expect((response.body as CurrentUserResponse).user.id).toBe(user.userId);
      expect(String(response.headers['set-cookie'])).toContain('np_session=');
      expect(await testApp.db.session.count({ where: { userId: user.userId } })).toBe(2);
    });

    it('answers identically for unknown email and wrong password', async () => {
      const user = await signUp(testApp);

      const wrongPassword = await testApp.http
        .post('/v1/auth/login')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: user.email, password: 'wrong password!!' });
      const unknownEmail = await testApp.http
        .post('/v1/auth/login')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: uniqueEmail(), password: 'wrong password!!' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      const strip = (body: unknown) => ({ ...(body as ErrorResponse).error, requestId: undefined });
      expect(strip(wrongPassword.body)).toEqual(strip(unknownEmail.body));
      expect(errorCode(wrongPassword.body)).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('rate limits repeated attempts for the same email', async () => {
      const isolated = await createTestApp({ rateLimiter: new InMemoryRateLimiter() });
      try {
        const user = await signUp(isolated);
        const attempt = () =>
          isolated.http
            .post('/v1/auth/login')
            .set('Origin', DASHBOARD_ORIGIN)
            .send({ email: user.email, password: 'wrong password!!' });

        for (let index = 0; index < 10; index += 1) {
          expect((await attempt()).status).toBe(401);
        }
        const limited = await attempt();

        expect(limited.status).toBe(429);
        expect(errorCode(limited.body)).toBe('RATE_LIMITED');
        expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      } finally {
        await isolated.close();
      }
    });
  });

  describe('logout', () => {
    it('revokes the session server-side and clears the cookie', async () => {
      const user = await signUp(testApp);

      const logout = await testApp.http
        .post('/v1/auth/logout')
        .set({ Cookie: user.cookie, Origin: DASHBOARD_ORIGIN });
      expect(logout.status).toBe(204);
      expect(String(logout.headers['set-cookie'])).toMatch(
        /np_session=;.*Expires=Thu, 01 Jan 1970/,
      );

      const reused = await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie);
      expect(reused.status).toBe(401);
      expect(errorCode(reused.body)).toBe('UNAUTHENTICATED');
    });
  });

  describe('session validation', () => {
    it('rejects requests without a session', async () => {
      const response = await testApp.http.get('/v1/auth/me');

      expect(response.status).toBe(401);
      expect(errorCode(response.body)).toBe('UNAUTHENTICATED');
    });

    it.each([
      ['a malformed token', 'np_session=not-a-token'],
      ['an unknown well-formed token', `np_session=${'A'.repeat(43)}`],
    ])('rejects %s', async (_label, cookie) => {
      const response = await testApp.http.get('/v1/auth/me').set('Cookie', cookie);

      expect(response.status).toBe(401);
      expect(errorCode(response.body)).toBe('UNAUTHENTICATED');
    });

    it('rejects a session past its idle expiration', async () => {
      const user = await signUp(testApp);
      const past = new Date(Date.now() - 1000);
      await testApp.db.session.updateMany({
        where: { userId: user.userId },
        data: { expiresAt: past },
      });

      const response = await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie);
      expect(response.status).toBe(401);
    });

    it('rejects a session past its absolute expiration', async () => {
      const user = await signUp(testApp);
      const past = new Date(Date.now() - 1000);
      await testApp.db.session.updateMany({
        where: { userId: user.userId },
        data: { expiresAt: past, absoluteExpiresAt: past },
      });

      const response = await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie);
      expect(response.status).toBe(401);
    });

    it('slides the idle expiration of an active session', async () => {
      const user = await signUp(testApp);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      await testApp.db.session.updateMany({
        where: { userId: user.userId },
        data: { lastSeenAt: tenMinutesAgo, expiresAt: new Date(Date.now() + 60_000) },
      });

      await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie).expect(200);

      const session = await testApp.db.session.findFirstOrThrow({ where: { userId: user.userId } });
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 11 * 60 * 60 * 1000);
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(session.absoluteExpiresAt.getTime());
    });
  });

  describe('CSRF protection', () => {
    it.each([
      ['a foreign Origin', { Origin: 'https://evil.example' }],
      ['no Origin', {}],
    ])('rejects signup with %s', async (_label, headers) => {
      const response = await testApp.http
        .post('/v1/auth/signup')
        .set(headers)
        .send({ email: uniqueEmail(), password: PASSWORD, merchantName: 'Acme' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body)).toBe('INVALID_ORIGIN');
    });

    it('rejects login from a foreign Origin before checking credentials', async () => {
      const user = await signUp(testApp);

      const response = await testApp.http
        .post('/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: user.email, password: PASSWORD });

      expect(response.status).toBe(403);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects session-authenticated mutations from a foreign Origin, even with a valid cookie', async () => {
      const user = await signUp(testApp);

      const response = await testApp.http
        .post('/v1/auth/logout')
        .set({ Cookie: user.cookie, Origin: 'https://evil.example' });

      expect(response.status).toBe(403);
      expect(errorCode(response.body)).toBe('INVALID_ORIGIN');
      await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie).expect(200);
    });

    it('allows safe methods without Origin', async () => {
      const user = await signUp(testApp);

      await testApp.http.get('/v1/auth/me').set('Cookie', user.cookie).expect(200);
    });

    it('answers CORS preflight only for the dashboard origin, with credentials', async () => {
      const allowed = await testApp.http
        .options('/v1/api-keys')
        .set({ Origin: DASHBOARD_ORIGIN, 'Access-Control-Request-Method': 'POST' });
      const foreign = await testApp.http
        .options('/v1/api-keys')
        .set({ Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' });

      expect(allowed.headers['access-control-allow-origin']).toBe(DASHBOARD_ORIGIN);
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');
      expect(foreign.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    });
  });
});

describe('session cookie in production', () => {
  it('is marked Secure', async () => {
    const productionApp = await createTestApp({ env: { NODE_ENV: 'production' } });
    try {
      const response = await productionApp.http
        .post('/v1/auth/signup')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: uniqueEmail(), password: PASSWORD, merchantName: 'Acme' });

      expect(response.status).toBe(201);
      expect(String(response.headers['set-cookie'])).toContain('Secure');
    } finally {
      await productionApp.close();
    }
  });
});
