import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createLogger } from '@nexopay/logger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadApiEnv } from './config/env.js';
import { currentLogContext } from './shared/http/request-context.js';
import { NestLoggerAdapter } from './shared/logging/nest-logger.js';

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  const logger = createLogger({
    service: 'api',
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV === 'development',
    context: currentLogContext,
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot({ env, logger }), {
    logger: new NestLoggerAdapter(logger),
    bodyParser: false,
  });
  configureApp(app, { env, logger });

  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT }, 'NexoPay API listening');
}

bootstrap().catch((error: unknown) => {
  const logger = createLogger({ service: 'api' });
  logger.fatal({ err: error }, 'Failed to start NexoPay API');
  process.exitCode = 1;
});
