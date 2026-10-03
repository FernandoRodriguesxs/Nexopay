import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiEnv } from '@nexopay/config';
import { environmentSchema, HEADERS, publicIdSchema } from '@nexopay/contracts';
import type { Request } from 'express';
import { API_ENV } from '../../../config/env.js';
import { ROUTE_AUTH_POLICY } from '../../../shared/auth/route-auth.js';
import type { RouteAuthPolicy } from '../../../shared/auth/route-auth.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { assertTrustedOrigin } from '../../../shared/http/origin-check.js';
import { getRequestContext } from '../../../shared/http/request-context.js';
import type { SessionPrincipal, TenantContext } from '../../../shared/http/request-context.js';
import { parseInput } from '../../../shared/http/zod-validation.js';
import { assertEnvironmentEnabled } from '../../../shared/tenancy/environment-policy.js';
import { AuthenticateApiKeyUseCase } from '../../api-keys/application/authenticate-api-key.use-case.js';
import { ResolveMerchantAccessUseCase } from '../../merchants/application/resolve-merchant-access.use-case.js';
import { AuthenticateSessionUseCase } from '../application/authenticate-session.use-case.js';
import { readSessionCookie } from './session-cookie.js';

const merchantHeaderSchema = publicIdSchema('mer');
const environmentHeaderSchema = environmentSchema.default('SANDBOX');
const BEARER_PATTERN = /^Bearer (\S+)$/;

/**
 * Guard global. Cada rota declara sua política (ver `route-auth.ts`); rotas sem
 * política são negadas. API Key e sessão são mecanismos separados: uma rota aceita
 * exatamente um deles, e um nunca é usado como fallback do outro.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly authenticateApiKey: AuthenticateApiKeyUseCase,
    private readonly authenticateSession: AuthenticateSessionUseCase,
    private readonly resolveMerchantAccess: ResolveMerchantAccessUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<RouteAuthPolicy | undefined>(
      ROUTE_AUTH_POLICY,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) throw new Error(`Route ${context.getClass().name} has no auth policy`);

    const request = context.switchToHttp().getRequest<Request>();
    const requestContext = getRequestContext(request);

    if (policy.kind === 'public') {
      if (policy.checkOrigin) this.assertOrigin(request);
      return true;
    }
    if (policy.kind === 'api_key') {
      requestContext.tenant = await this.authenticateWithApiKey(request);
      return true;
    }

    this.assertOrigin(request);
    const session = await this.authenticateWithSession(request);
    requestContext.session = session;
    if (policy.merchant) requestContext.tenant = await this.resolveTenant(request, session);
    return true;
  }

  private assertOrigin(request: Request): void {
    assertTrustedOrigin(request.method, request.get('origin'), this.env.DASHBOARD_ORIGIN);
  }

  private async authenticateWithApiKey(request: Request): Promise<TenantContext> {
    const authorization = request.get('authorization');
    if (!authorization) {
      throw new AppError(
        'UNAUTHENTICATED',
        'Provide an API key: Authorization: Bearer sk_test_...',
      );
    }

    const secret = BEARER_PATTERN.exec(authorization)?.[1];
    if (!secret) throw new AppError('INVALID_API_KEY', 'Invalid API key.');

    return this.authenticateApiKey.execute(secret);
  }

  private async authenticateWithSession(request: Request): Promise<SessionPrincipal> {
    const token = readSessionCookie(request);
    if (token) return this.authenticateSession.execute(token);

    if (request.get('authorization')) {
      throw new AppError(
        'FORBIDDEN',
        'This endpoint requires a dashboard session. API keys are not accepted.',
      );
    }
    throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
  }

  private async resolveTenant(request: Request, session: SessionPrincipal): Promise<TenantContext> {
    const merchantId = parseInput(
      merchantHeaderSchema,
      request.get(HEADERS.merchant),
      HEADERS.merchant,
    );
    const environment = parseInput(
      environmentHeaderSchema,
      request.get(HEADERS.environment),
      HEADERS.environment,
    );
    assertEnvironmentEnabled(environment);

    const role = await this.resolveMerchantAccess.execute({ userId: session.userId, merchantId });
    return { merchantId, environment, actor: { type: 'user', userId: session.userId, role } };
  }
}
