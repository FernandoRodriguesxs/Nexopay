import { Controller, Get, Post } from '@nestjs/common';
import { errorResponseSchema } from '@nexopay/contracts';
import type { ErrorResponse } from '@nexopay/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public } from '../src/shared/auth/route-auth.js';
import { DatabaseService } from '../src/shared/database/database.service.js';
import { createApiKey, signUp } from './support/fixtures.js';
import { createTestApp, DASHBOARD_ORIGIN } from './support/test-app.js';
import type { TestApp } from './support/test-app.js';

const REQUEST_ID = /^req_[0-9A-HJKMNP-TV-Z]{26}$/;
const LEAKY_MESSAGE =
  'connect ECONNREFUSED 10.0.0.12:5432 SELECT password_hash FROM "user" at /srv/app/dist/x.js:1:1';

/** Rotas que falham de propósito, montadas só nos testes. */
@Controller('test-failures')
@Public()
class FailingController {
  constructor(private readonly database: DatabaseService) {}

  @Get('plain')
  plain(): never {
    throw new Error(LEAKY_MESSAGE);
  }

  @Get('database')
  async database_(): Promise<unknown> {
    return this.database.client.$queryRawUnsafe(
      'SELECT secret_column FROM table_that_does_not_exist',
    );
  }

  @Post('echo')
  echo(): { ok: true } {
    return { ok: true };
  }
}

/** Rota sem política de autenticação: deve ser negada (seguro por padrão). */
@Controller('test-no-policy')
class NoPolicyController {
  @Get()
  open(): { leaked: true } {
    return { leaked: true };
  }
}

function errorOf(body: unknown): ErrorResponse['error'] {
  return errorResponseSchema.parse(body).error;
}

describe('HTTP contract', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: [FailingController, NoPolicyController] });
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('request id', () => {
    it('is returned on success', async () => {
      const response = await testApp.http.get('/health');

      expect(response.headers['x-request-id']).toMatch(REQUEST_ID);
    });

    it('is returned on errors, in the header and in the body (same value)', async () => {
      const response = await testApp.http.get('/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.headers['x-request-id']).toMatch(REQUEST_ID);
      expect(errorOf(response.body).requestId).toBe(response.headers['x-request-id']);
    });

    it('is unique per request', async () => {
      const [first, second] = await Promise.all([
        testApp.http.get('/health'),
        testApp.http.get('/health'),
      ]);

      expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
    });

    it('never adopts a client X-Request-Id, but logs a valid one for correlation', async () => {
      const response = await testApp.http.get('/health').set('X-Request-Id', 'client-trace-123');

      expect(response.headers['x-request-id']).toMatch(REQUEST_ID);
      const line = testApp.logs.find((log) =>
        log.includes(String(response.headers['x-request-id'])),
      );
      expect(line).toContain('"clientRequestId":"client-trace-123"');
    });

    it('ignores an invalid client X-Request-Id', async () => {
      const response = await testApp.http.get('/health').set('X-Request-Id', 'x'.repeat(200));

      const line = testApp.logs.find((log) =>
        log.includes(String(response.headers['x-request-id'])),
      );
      expect(line).toBeDefined();
      expect(line).not.toContain('clientRequestId');
    });

    it('is present in the request log line with method, path, status and duration', async () => {
      const response = await testApp.http.get('/health?token=should-not-be-logged');

      const line = JSON.parse(
        testApp.logs.find((log) => log.includes(String(response.headers['x-request-id']))) ?? '{}',
      ) as Record<string, unknown>;
      expect(line).toMatchObject({
        method: 'GET',
        path: '/health',
        status: 200,
        message: 'request completed',
      });
      expect(typeof line.durationMs).toBe('number');
      expect(JSON.stringify(line)).not.toContain('should-not-be-logged');
    });

    it('tags log lines with merchant and environment once authenticated', async () => {
      const user = await signUp(testApp);
      const key = await createApiKey(testApp, user);

      const response = await testApp.http
        .get('/v1/whoami')
        .set('Authorization', `Bearer ${key.secret}`);

      const line = testApp.logs.find((log) =>
        log.includes(String(response.headers['x-request-id'])),
      );
      expect(line).toContain(`"merchantId":"${user.merchantId}"`);
      expect(line).toContain('"environment":"SANDBOX"');
      expect(line).toContain('"actorType":"api_key"');
    });
  });

  describe('error contract', () => {
    it('unknown routes → 404 ROUTE_NOT_FOUND', async () => {
      const response = await testApp.http.get('/v1/does-not-exist');

      expect(response.status).toBe(404);
      expect(errorOf(response.body).code).toBe('ROUTE_NOT_FOUND');
    });

    it('malformed JSON → 400 VALIDATION_ERROR with request id', async () => {
      const response = await testApp.http
        .post('/v1/auth/login')
        .set({ 'Content-Type': 'application/json', Origin: DASHBOARD_ORIGIN })
        .send('{"email": ');

      expect(response.status).toBe(400);
      expect(errorOf(response.body)).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(errorOf(response.body).requestId).toBe(response.headers['x-request-id']);
    });

    it('bodies over 100 KB → 413 PAYLOAD_TOO_LARGE', async () => {
      const response = await testApp.http
        .post('/v1/test-failures/echo')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ data: 'x'.repeat(110 * 1024) }));

      expect(response.status).toBe(413);
      expect(errorOf(response.body).code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('validation errors list the invalid fields', async () => {
      const response = await testApp.http
        .post('/v1/auth/signup')
        .set('Origin', DASHBOARD_ORIGIN)
        .send({ email: 'not-an-email', password: 'x' });

      const error = errorOf(response.body);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.map((detail) => detail.path)).toEqual(
        expect.arrayContaining(['email', 'password', 'merchantName']),
      );
    });

    it('routes without an auth policy are denied', async () => {
      const response = await testApp.http.get('/v1/test-no-policy');

      expect(response.status).toBe(500);
      expect(response.body).not.toHaveProperty('leaked');
      expect(errorOf(response.body).code).toBe('INTERNAL_ERROR');
    });
  });

  describe('internal errors do not leak details', () => {
    it.each([
      ['an unexpected exception', '/v1/test-failures/plain'],
      ['a database error', '/v1/test-failures/database'],
    ])('%s → generic 500 INTERNAL_ERROR', async (_label, path) => {
      const response = await testApp.http.get(path);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
          requestId: response.headers['x-request-id'],
        },
      });
      const raw = response.text;
      for (const fragment of [
        'SELECT',
        'ECONNREFUSED',
        '10.0.0.12',
        '/srv/app',
        'stack',
        'Prisma',
        'table_that_does_not_exist',
        'at ',
      ]) {
        expect(raw).not.toContain(fragment);
      }
    });

    it('logs the real cause with the same request id', async () => {
      const response = await testApp.http.get('/v1/test-failures/database');

      const errorLine = testApp.logs.find(
        (log) =>
          log.includes('"unhandled error"') &&
          log.includes(String(response.headers['x-request-id'])),
      );
      expect(errorLine).toContain('table_that_does_not_exist');
    });
  });
});
