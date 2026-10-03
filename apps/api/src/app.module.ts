import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { CoreModule } from './shared/core.module.js';
import type { CoreModuleOptions } from './shared/core.module.js';

@Module({})
export class AppModule {
  static forRoot(options: CoreModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.forRoot(options), HealthModule, AuthModule, ApiKeysModule],
    };
  }
}
