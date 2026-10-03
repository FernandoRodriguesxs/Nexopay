import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type { ApiEnv } from '@nexopay/config';
import { Redis } from 'ioredis';
import { API_ENV } from '../../config/env.js';

/** Conexão Redis do processo. Redis nunca é fonte de verdade de dados financeiros. */
@Injectable()
export class RedisConnection implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      keyPrefix: 'nexopay:',
    });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
