import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/database.service.js';
import type { TenantScope } from '../../../shared/http/request-context.js';
import type { ApiKey } from '../domain/api-key.js';

export interface NewApiKey {
  readonly id: string;
  readonly name: string;
  readonly hash: string;
  readonly hint: string;
  readonly createdByUserId: string;
}

export interface ApiKeyPage {
  readonly data: ApiKey[];
  readonly hasMore: boolean;
}

/** Campos públicos: o hash nunca sai do repositório (exceto pelo lookup). */
const API_KEY_FIELDS = {
  id: true,
  merchantId: true,
  environment: true,
  name: true,
  hint: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

/**
 * Todo método recebe `TenantScope` (merchantId + environment) e filtra por ele.
 * Única exceção: `findByHash`, que é justamente o que resolve o tenant de uma API Key.
 */
@Injectable()
export class ApiKeyRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(scope: TenantScope, input: NewApiKey): Promise<ApiKey> {
    return this.database.client.apiKey.create({
      data: { ...input, merchantId: scope.merchantId, environment: scope.environment },
      select: API_KEY_FIELDS,
    });
  }

  async findById(scope: TenantScope, id: string): Promise<ApiKey | null> {
    return this.database.client.apiKey.findFirst({
      where: { id, merchantId: scope.merchantId, environment: scope.environment },
      select: API_KEY_FIELDS,
    });
  }

  /** Mais recentes primeiro (o ULID do id é ordenável no tempo); cursor por `startingAfter`. */
  async list(
    scope: TenantScope,
    page: { limit: number; startingAfter: string | undefined },
  ): Promise<ApiKeyPage> {
    const rows = await this.database.client.apiKey.findMany({
      where: {
        merchantId: scope.merchantId,
        environment: scope.environment,
        ...(page.startingAfter ? { id: { lt: page.startingAfter } } : {}),
      },
      orderBy: { id: 'desc' },
      take: page.limit + 1,
      select: API_KEY_FIELDS,
    });

    return { data: rows.slice(0, page.limit), hasMore: rows.length > page.limit };
  }

  /** Revogação condicional: devolve `false` se outra requisição revogou antes. */
  async revoke(
    scope: TenantScope,
    id: string,
    revocation: { revokedAt: Date; revokedByUserId: string },
  ): Promise<boolean> {
    const result = await this.database.client.apiKey.updateMany({
      where: { id, merchantId: scope.merchantId, environment: scope.environment, revokedAt: null },
      data: revocation,
    });
    return result.count === 1;
  }

  /** Lookup de autenticação pelo HMAC (índice único). Não recebe escopo: é o que o define. */
  async findByHash(hash: string): Promise<ApiKey | null> {
    return this.database.client.apiKey.findUnique({ where: { hash }, select: API_KEY_FIELDS });
  }

  async touchLastUsed(id: string, now: Date, throttleMs: number): Promise<void> {
    await this.database.client.apiKey.updateMany({
      where: {
        id,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: new Date(now.getTime() - throttleMs) } }],
      },
      data: { lastUsedAt: now },
    });
  }
}
