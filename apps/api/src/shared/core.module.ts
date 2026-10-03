import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { ApiEnv } from '@nexopay/config';
import type { Logger } from '@nexopay/logger';
import { API_ENV } from '../config/env.js';
import { Clock } from './clock/clock.js';
import { DatabaseService } from './database/database.service.js';
import { UnitOfWork } from './database/unit-of-work.js';
import { AllExceptionsFilter } from './errors/all-exceptions.filter.js';
import { LOGGER } from './logging/logger.tokens.js';
import { RateLimiter } from './rate-limit/rate-limiter.js';
import { RedisRateLimiter } from './rate-limit/redis-rate-limiter.js';
import { RedisConnection } from './redis/redis-connection.js';

export interface CoreModuleOptions {
  readonly env: ApiEnv;
  readonly logger: Logger;
}

/** Infraestrutura transversal compartilhada por todos os módulos. */
@Global()
@Module({})
export class CoreModule {
  static forRoot({ env, logger }: CoreModuleOptions): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: API_ENV, useValue: env },
        { provide: LOGGER, useValue: logger },
        Clock,
        DatabaseService,
        UnitOfWork,
        RedisConnection,
        {
          provide: RateLimiter,
          useFactory: (redis: RedisConnection) => new RedisRateLimiter(redis),
          inject: [RedisConnection],
        },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
      exports: [API_ENV, LOGGER, Clock, DatabaseService, UnitOfWork, RedisConnection, RateLimiter],
    };
  }
}
