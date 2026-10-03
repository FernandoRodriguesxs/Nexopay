import { Controller, Get } from '@nestjs/common';
import type { WhoamiResponse } from '@nexopay/contracts';
import { ApiKeyAuth, CurrentTenant } from '../../../shared/auth/route-auth.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TenantContext } from '../../../shared/http/request-context.js';
import { GetWhoamiUseCase } from '../application/get-whoami.use-case.js';
import { presentWhoami } from './api-key.presenter.js';

/** API pública: identifica a API Key em uso (merchant + ambiente). */
@Controller('whoami')
@ApiKeyAuth()
export class WhoamiController {
  constructor(private readonly getWhoami: GetWhoamiUseCase) {}

  @Get()
  async show(@CurrentTenant() tenant: TenantContext): Promise<WhoamiResponse> {
    if (tenant.actor.type !== 'api_key') throw new AppError('FORBIDDEN', 'An API key is required.');

    return presentWhoami(await this.getWhoami.execute(tenant, tenant.actor.apiKeyId));
  }
}
