import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import type { ApiEnv } from '@nexopay/config';
import { EnvModule } from './config/env.module.js';
import { HealthModule } from './health/health.module.js';

@Module({})
export class AppModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [EnvModule.forRoot(env), HealthModule],
    };
  }
}
