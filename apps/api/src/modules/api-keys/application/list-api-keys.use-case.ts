import { Injectable } from '@nestjs/common';
import type { TenantScope } from '../../../shared/http/request-context.js';
import { ApiKeyRepository } from '../infrastructure/api-key.repository.js';
import type { ApiKeyPage } from '../infrastructure/api-key.repository.js';

export interface ListApiKeysInput {
  readonly scope: TenantScope;
  readonly limit: number;
  readonly startingAfter: string | undefined;
}

@Injectable()
export class ListApiKeysUseCase {
  constructor(private readonly apiKeys: ApiKeyRepository) {}

  execute(input: ListApiKeysInput): Promise<ApiKeyPage> {
    return this.apiKeys.list(input.scope, {
      limit: input.limit,
      startingAfter: input.startingAfter,
    });
  }
}
