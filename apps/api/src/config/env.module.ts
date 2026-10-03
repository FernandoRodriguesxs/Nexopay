import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import type { ApiEnv } from '@nexopay/config';
import { API_ENV } from './env.js';

@Global()
@Module({})
export class EnvModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: EnvModule,
      providers: [{ provide: API_ENV, useValue: env }],
      exports: [API_ENV],
    };
  }
}
