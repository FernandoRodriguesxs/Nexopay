import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { AuthenticateApiKeyUseCase } from './application/authenticate-api-key.use-case.js';
import { CreateApiKeyUseCase } from './application/create-api-key.use-case.js';
import { GetWhoamiUseCase } from './application/get-whoami.use-case.js';
import { ListApiKeysUseCase } from './application/list-api-keys.use-case.js';
import { RevokeApiKeyUseCase } from './application/revoke-api-key.use-case.js';
import { ApiKeysController } from './http/api-keys.controller.js';
import { WhoamiController } from './http/whoami.controller.js';
import { ApiKeyRepository } from './infrastructure/api-key.repository.js';
import { ApiKeySecrets } from './infrastructure/api-key-secrets.js';

@Module({
  imports: [AuditModule, MerchantsModule],
  controllers: [ApiKeysController, WhoamiController],
  providers: [
    ApiKeyRepository,
    ApiKeySecrets,
    AuthenticateApiKeyUseCase,
    CreateApiKeyUseCase,
    GetWhoamiUseCase,
    ListApiKeysUseCase,
    RevokeApiKeyUseCase,
  ],
  exports: [AuthenticateApiKeyUseCase],
})
export class ApiKeysModule {}
