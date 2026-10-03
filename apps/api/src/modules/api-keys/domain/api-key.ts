import type { Environment } from '@nexopay/contracts';
import { AppError } from '../../../shared/errors/app-error.js';

/** API Key como o domínio a enxerga — sem hash nem secret. */
export interface ApiKey {
  readonly id: string;
  readonly merchantId: string;
  readonly environment: Environment;
  readonly name: string;
  readonly hint: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

/** `lastUsedAt` é atualizado no máximo uma vez por minuto por key. */
export const LAST_USED_THROTTLE_MS = 60_000;

export function isRevoked(apiKey: Pick<ApiKey, 'revokedAt'>): boolean {
  return apiKey.revokedAt !== null;
}

export function shouldTouchLastUsed(apiKey: Pick<ApiKey, 'lastUsedAt'>, now: Date): boolean {
  if (!apiKey.lastUsedAt) return true;
  return now.getTime() - apiKey.lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS;
}

/**
 * Regras de uso de uma key encontrada pelo hash:
 * - o ambiente do prefixo deve coincidir com o armazenado (defesa em profundidade);
 * - revogada → `API_KEY_REVOKED` (revogação é imediata e irreversível).
 */
export function assertApiKeyUsable(
  apiKey: Pick<ApiKey, 'environment' | 'revokedAt'>,
  declaredEnvironment: Environment,
): void {
  if (apiKey.environment !== declaredEnvironment) {
    throw new AppError('INVALID_API_KEY', 'Invalid API key.');
  }
  if (isRevoked(apiKey)) {
    throw new AppError('API_KEY_REVOKED', 'This API key has been revoked.');
  }
}
