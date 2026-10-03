import { RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ApiEnv } from '@nexopay/config';
import type { Logger } from '@nexopay/logger';
import express from 'express';
import helmet from 'helmet';
import { bodyParserErrorHandler } from './shared/http/body-parser-errors.js';
import {
  requestContextStorageMiddleware,
  requestIdMiddleware,
} from './shared/http/request-middlewares.js';

export const BODY_LIMIT = '100kb';

export interface ConfigureAppOptions {
  readonly env: ApiEnv;
  readonly logger: Logger;
}

/**
 * Pipeline HTTP compartilhado entre o servidor real e os testes e2e.
 * A ordem importa: request ID primeiro (presente até em erros de parse do body).
 * Requer a aplicação criada com `bodyParser: false`.
 */
export function configureApp(
  app: NestExpressApplication,
  { env, logger }: ConfigureAppOptions,
): NestExpressApplication {
  app.disable('x-powered-by');
  app.use(requestIdMiddleware(logger));
  app.use(helmet());
  app.enableCors({
    origin: env.DASHBOARD_ORIGIN,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-Id',
      'X-NexoPay-Merchant',
      'X-NexoPay-Environment',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After', 'Idempotent-Replayed'],
    maxAge: 600,
  });
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(bodyParserErrorHandler);
  app.use(requestContextStorageMiddleware);
  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableShutdownHooks();
  return app;
}
