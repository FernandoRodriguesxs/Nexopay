import { Injectable } from '@nestjs/common';
import { resourceNotFound } from '../../../shared/errors/app-error.js';
import type { TenantScope } from '../../../shared/http/request-context.js';
import { GetMerchantUseCase } from '../../merchants/application/get-merchant.use-case.js';
import type { MerchantRecord } from '../../merchants/infrastructure/merchant.repository.js';
import type { ApiKey } from '../domain/api-key.js';
import { ApiKeyRepository } from '../infrastructure/api-key.repository.js';

export interface Whoami {
  readonly scope: TenantScope;
  readonly merchant: MerchantRecord;
  readonly apiKey: ApiKey;
}

/** Identifica a credencial em uso — permite ao desenvolvedor validar a key e o ambiente. */
@Injectable()
export class GetWhoamiUseCase {
  constructor(
    private readonly getMerchant: GetMerchantUseCase,
    private readonly apiKeys: ApiKeyRepository,
  ) {}

  async execute(scope: TenantScope, apiKeyId: string): Promise<Whoami> {
    const apiKey = await this.apiKeys.findById(scope, apiKeyId);
    if (!apiKey) throw resourceNotFound('API key');

    return { scope, merchant: await this.getMerchant.execute(scope.merchantId), apiKey };
  }
}
