import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppModule.forRoot({
          NODE_ENV: 'test',
          LOG_LEVEL: 'silent',
          API_PORT: 4000,
          API_PUBLIC_URL: 'http://localhost:4000',
          DATABASE_URL: 'postgresql://localhost:5432/test',
          REDIS_URL: 'redis://localhost:6379',
        }),
      ],
    }).compile();

    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok outside the /v1 prefix', async () => {
    const response = await request(app.getHttpServer() as Server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns 404 for unknown routes', async () => {
    const response = await request(app.getHttpServer() as Server).get('/v1/unknown');

    expect(response.status).toBe(404);
  });
});
