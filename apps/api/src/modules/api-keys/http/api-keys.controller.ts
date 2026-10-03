import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { createApiKeyRequestSchema, listQuerySchema, publicIdSchema } from '@nexopay/contracts';
import type {
  ApiKeyResource,
  CreateApiKeyRequest,
  CreatedApiKeyResource,
  ListQuery,
  ListResponse,
} from '@nexopay/contracts';
import { CurrentRequestMeta, CurrentTenant, SessionAuth } from '../../../shared/auth/route-auth.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { RequestMeta, TenantContext } from '../../../shared/http/request-context.js';
import { parseInput, ZodValidationPipe } from '../../../shared/http/zod-validation.js';
import { CreateApiKeyUseCase } from '../application/create-api-key.use-case.js';
import { ListApiKeysUseCase } from '../application/list-api-keys.use-case.js';
import { RevokeApiKeyUseCase } from '../application/revoke-api-key.use-case.js';
import { presentApiKey, presentCreatedApiKey } from './api-key.presenter.js';

const apiKeyIdSchema = publicIdSchema('key');

function userIdOf(tenant: TenantContext): string {
  // A política de sessão garante ator `user`; API Keys nunca chegam aqui.
  if (tenant.actor.type !== 'user') {
    throw new AppError('FORBIDDEN', 'A dashboard session is required.');
  }
  return tenant.actor.userId;
}

/** Administração de API Keys: exclusivamente via sessão do dashboard (nunca por API Key). */
@Controller('api-keys')
@SessionAuth({ merchant: true })
export class ApiKeysController {
  constructor(
    private readonly createApiKey: CreateApiKeyUseCase,
    private readonly listApiKeys: ListApiKeysUseCase,
    private readonly revokeApiKey: RevokeApiKeyUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentRequestMeta() request: RequestMeta,
    @Body(new ZodValidationPipe(createApiKeyRequestSchema)) body: CreateApiKeyRequest,
  ): Promise<CreatedApiKeyResource> {
    const created = await this.createApiKey.execute({
      scope: tenant,
      userId: userIdOf(tenant),
      name: body.name,
      request,
    });
    return presentCreatedApiKey(created);
  }

  @Get()
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ): Promise<ListResponse<ApiKeyResource>> {
    const startingAfter =
      query.startingAfter === undefined
        ? undefined
        : parseInput(apiKeyIdSchema, query.startingAfter, 'startingAfter');
    const page = await this.listApiKeys.execute({
      scope: tenant,
      limit: query.limit,
      startingAfter,
    });
    return { object: 'list', data: page.data.map(presentApiKey), hasMore: page.hasMore };
  }

  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(
    @CurrentTenant() tenant: TenantContext,
    @CurrentRequestMeta() request: RequestMeta,
    @Param('id', new ZodValidationPipe(apiKeyIdSchema, 'id')) apiKeyId: string,
  ): Promise<ApiKeyResource> {
    const apiKey = await this.revokeApiKey.execute({
      scope: tenant,
      userId: userIdOf(tenant),
      apiKeyId,
      request,
    });
    return presentApiKey(apiKey);
  }
}
