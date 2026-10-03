import { Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/clock/clock.js';
import { UnitOfWork } from '../../../shared/database/unit-of-work.js';
import { resourceNotFound } from '../../../shared/errors/app-error.js';
import type { RequestMeta, TenantScope } from '../../../shared/http/request-context.js';
import { AuditTrail } from '../../audit/audit-trail.js';
import { isRevoked } from '../domain/api-key.js';
import type { ApiKey } from '../domain/api-key.js';
import { ApiKeyRepository } from '../infrastructure/api-key.repository.js';

export interface RevokeApiKeyInput {
  readonly scope: TenantScope;
  readonly userId: string;
  readonly apiKeyId: string;
  readonly request: RequestMeta;
}

/**
 * Revogação imediata e irreversível. Idempotente: revogar de novo (inclusive em
 * paralelo) devolve a key já revogada, sem novo audit log.
 * Key de outro merchant ou de outro ambiente → 404.
 */
@Injectable()
export class RevokeApiKeyUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly apiKeys: ApiKeyRepository,
    private readonly auditTrail: AuditTrail,
  ) {}

  execute(input: RevokeApiKeyInput): Promise<ApiKey> {
    return this.unitOfWork.run(async () => {
      const apiKey = await this.findInScope(input.scope, input.apiKeyId);
      if (isRevoked(apiKey)) return apiKey;

      const revoked = await this.apiKeys.revoke(input.scope, apiKey.id, {
        revokedAt: this.clock.now(),
        revokedByUserId: input.userId,
      });
      if (revoked) await this.recordRevocation(input, apiKey);

      return this.findInScope(input.scope, input.apiKeyId);
    });
  }

  private async findInScope(scope: TenantScope, apiKeyId: string): Promise<ApiKey> {
    const apiKey = await this.apiKeys.findById(scope, apiKeyId);
    if (!apiKey) throw resourceNotFound('API key');
    return apiKey;
  }

  private async recordRevocation(input: RevokeApiKeyInput, apiKey: ApiKey): Promise<void> {
    await this.auditTrail.record({
      action: 'api_key.revoked',
      actor: { type: 'USER', id: input.userId },
      merchantId: input.scope.merchantId,
      environment: input.scope.environment,
      resource: { type: 'api_key', id: apiKey.id },
      metadata: { name: apiKey.name, hint: apiKey.hint },
      request: input.request,
    });
  }
}
