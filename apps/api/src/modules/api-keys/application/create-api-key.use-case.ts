import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../shared/database/unit-of-work.js';
import type { RequestMeta, TenantScope } from '../../../shared/http/request-context.js';
import { generateId } from '../../../shared/ids/generate-id.js';
import { AuditTrail } from '../../audit/audit-trail.js';
import type { ApiKey } from '../domain/api-key.js';
import { ApiKeyRepository } from '../infrastructure/api-key.repository.js';
import { ApiKeySecrets } from '../infrastructure/api-key-secrets.js';

export interface CreateApiKeyInput {
  readonly scope: TenantScope;
  readonly userId: string;
  readonly name: string;
  readonly request: RequestMeta;
}

export interface CreatedApiKey {
  readonly apiKey: ApiKey;
  /** Exibido uma única vez; não existe em nenhum outro lugar após esta resposta. */
  readonly secret: string;
}

/** Cria uma API Key no ambiente do escopo. Só alcançável por sessão do dashboard. */
@Injectable()
export class CreateApiKeyUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly apiKeys: ApiKeyRepository,
    private readonly secrets: ApiKeySecrets,
    private readonly auditTrail: AuditTrail,
  ) {}

  async execute(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const { secret, hash, hint } = this.secrets.generate(input.scope.environment);

    const apiKey = await this.unitOfWork.run(async () => {
      const created = await this.apiKeys.create(input.scope, {
        id: generateId('key'),
        name: input.name,
        hash,
        hint,
        createdByUserId: input.userId,
      });
      await this.auditTrail.record({
        action: 'api_key.created',
        actor: { type: 'USER', id: input.userId },
        merchantId: input.scope.merchantId,
        environment: input.scope.environment,
        resource: { type: 'api_key', id: created.id },
        metadata: { name: created.name, hint: created.hint },
        request: input.request,
      });
      return created;
    });

    return { apiKey, secret };
  }
}
