import { Inject, Injectable } from '@nestjs/common';
import type { Logger } from '@nexopay/logger';
import { Clock } from '../../../shared/clock/clock.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { LOGGER } from '../../../shared/logging/logger.tokens.js';
import { assertEnvironmentEnabled } from '../../../shared/tenancy/environment-policy.js';
import {
  assertApiKeyUsable,
  LAST_USED_THROTTLE_MS,
  shouldTouchLastUsed,
} from '../domain/api-key.js';
import type { ApiKey } from '../domain/api-key.js';
import { ApiKeyRepository } from '../infrastructure/api-key.repository.js';
import { ApiKeySecrets, parseApiKeyEnvironment } from '../infrastructure/api-key-secrets.js';

const INVALID_API_KEY = new AppError('INVALID_API_KEY', 'Invalid API key.');

/**
 * Resolve tenant + ambiente a partir da API Key:
 * formato → HMAC → lookup por índice único → regras (ambiente, revogação) → ambiente habilitado.
 * A comparação acontece no índice do banco sobre o HMAC; sem o pepper, um atacante
 * não consegue derivar hashes válidos, então não há oráculo de timing útil.
 */
@Injectable()
export class AuthenticateApiKeyUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly apiKeys: ApiKeyRepository,
    private readonly secrets: ApiKeySecrets,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async execute(secret: string): Promise<TenantContext> {
    const declaredEnvironment = parseApiKeyEnvironment(secret);
    if (!declaredEnvironment) throw INVALID_API_KEY;

    const apiKey = await this.apiKeys.findByHash(this.secrets.hash(secret));
    if (!apiKey) throw INVALID_API_KEY;

    assertApiKeyUsable(apiKey, declaredEnvironment);
    assertEnvironmentEnabled(apiKey.environment);
    await this.touchLastUsed(apiKey);

    return {
      merchantId: apiKey.merchantId,
      environment: apiKey.environment,
      actor: { type: 'api_key', apiKeyId: apiKey.id },
    };
  }

  /** Atualização de uso é acessória: falha aqui não derruba o request. */
  private async touchLastUsed(apiKey: ApiKey): Promise<void> {
    const now = this.clock.now();
    if (!shouldTouchLastUsed(apiKey, now)) return;

    try {
      await this.apiKeys.touchLastUsed(apiKey.id, now, LAST_USED_THROTTLE_MS);
    } catch (error) {
      this.logger.warn({ err: error, apiKeyId: apiKey.id }, 'failed to update api key lastUsedAt');
    }
  }
}
