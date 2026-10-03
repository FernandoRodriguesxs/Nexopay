import type { ApiKeyResource, CreatedApiKeyResource, WhoamiResponse } from '@nexopay/contracts';
import type { ApiKey } from '../domain/api-key.js';
import type { CreatedApiKey } from '../application/create-api-key.use-case.js';
import type { Whoami } from '../application/get-whoami.use-case.js';

export function presentApiKey(apiKey: ApiKey): ApiKeyResource {
  return {
    id: apiKey.id,
    object: 'api_key',
    name: apiKey.name,
    environment: apiKey.environment,
    hint: apiKey.hint,
    createdAt: apiKey.createdAt.toISOString(),
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    revokedAt: apiKey.revokedAt?.toISOString() ?? null,
  };
}

export function presentCreatedApiKey(created: CreatedApiKey): CreatedApiKeyResource {
  return { ...presentApiKey(created.apiKey), secret: created.secret };
}

export function presentWhoami(whoami: Whoami): WhoamiResponse {
  return {
    object: 'whoami',
    environment: whoami.scope.environment,
    merchant: { id: whoami.merchant.id, object: 'merchant', name: whoami.merchant.name },
    apiKey: { id: whoami.apiKey.id, object: 'api_key', name: whoami.apiKey.name },
  };
}
