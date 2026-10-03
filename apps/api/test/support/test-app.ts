import { Writable } from 'node:stream';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { ApiEnv } from '@nexopay/config';
import { createPrismaClient } from '@nexopay/database';
import type { PrismaClient } from '@nexopay/database';
import { createLogger } from '@nexopay/logger';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { currentLogContext } from '../../src/shared/http/request-context.js';
import { RateLimiter } from '../../src/shared/rate-limit/rate-limiter.js';
import { AllowAllRateLimiter } from './in-memory-rate-limiter.js';
import { requireRedisUrl, requireTestDatabaseUrl } from './load-test-env.js';

export const DASHBOARD_ORIGIN = 'http://localhost:3000';

export interface TestApp {
  readonly app: NestExpressApplication;
  readonly http: TestAgent;
  /** Client direto do banco de testes, para asserções e para montar cenários. */
  readonly db: PrismaClient;
  /** Todas as linhas de log emitidas pela app (JSON já serializado). */
  readonly logs: string[];
  close(): Promise<void>;
}

export interface CreateTestAppOptions {
  readonly env?: Partial<ApiEnv>;
  readonly controllers?: Type[];
  readonly rateLimiter?: RateLimiter;
}

export function testEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    API_PORT: 4000,
    API_PUBLIC_URL: 'http://localhost:4000',
    DATABASE_URL: requireTestDatabaseUrl(),
    REDIS_URL: requireRedisUrl(),
    API_KEY_PEPPER: 'test-only-pepper-with-at-least-32-characters',
    DASHBOARD_ORIGIN,
    ...overrides,
  };
}

function captureStream(lines: string[]): Writable {
  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  const env = testEnv(options.env);
  const logs: string[] = [];
  const logger = createLogger({
    service: 'api-test',
    level: 'debug',
    destination: captureStream(logs),
    context: currentLogContext,
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot({ env, logger })],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(RateLimiter)
    .useValue(options.rateLimiter ?? new AllowAllRateLimiter())
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
    bodyParser: false,
  });
  configureApp(app, { env, logger });
  await app.init();

  const db = createPrismaClient({ databaseUrl: env.DATABASE_URL });
  return {
    app,
    http: request(app.getHttpServer()),
    db,
    logs,
    async close() {
      await db.$disconnect();
      await app.close();
    },
  };
}
