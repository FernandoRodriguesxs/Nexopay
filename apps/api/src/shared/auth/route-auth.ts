import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { getRequestContext, toRequestMeta } from '../http/request-context.js';
import type { RequestMeta, SessionPrincipal, TenantContext } from '../http/request-context.js';

/**
 * Política de autenticação de uma rota. Toda rota precisa declarar uma:
 * o AuthGuard global nega (500) rotas sem política — seguro por padrão.
 *
 * - `public`:  sem credencial. `checkOrigin` aplica a checagem CSRF de Origin (signup/login).
 * - `api_key`: somente `Authorization: Bearer sk_...` (API pública). Cookies são ignorados.
 * - `session`: somente o cookie de sessão do dashboard (+ Origin em métodos mutáveis).
 *              `merchant: true` exige `X-NexoPay-Merchant` com vínculo do usuário.
 */
export type RouteAuthPolicy =
  | { readonly kind: 'public'; readonly checkOrigin: boolean }
  | { readonly kind: 'api_key' }
  | { readonly kind: 'session'; readonly merchant: boolean };

export const ROUTE_AUTH_POLICY = Symbol('ROUTE_AUTH_POLICY');

export const Public = (options: { checkOrigin?: boolean } = {}) =>
  SetMetadata(ROUTE_AUTH_POLICY, {
    kind: 'public',
    checkOrigin: options.checkOrigin ?? false,
  } satisfies RouteAuthPolicy);

export const ApiKeyAuth = () =>
  SetMetadata(ROUTE_AUTH_POLICY, { kind: 'api_key' } satisfies RouteAuthPolicy);

export const SessionAuth = (options: { merchant?: boolean } = {}) =>
  SetMetadata(ROUTE_AUTH_POLICY, {
    kind: 'session',
    merchant: options.merchant ?? false,
  } satisfies RouteAuthPolicy);

function requestOf(context: ExecutionContext): Request {
  return context.switchToHttp().getRequest<Request>();
}

/** Tenant + ambiente + ator resolvidos pela autenticação (API Key ou sessão com merchant). */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const tenant = getRequestContext(requestOf(context)).tenant;
    if (!tenant) throw new Error('CurrentTenant used on a route without tenant authentication');
    return tenant;
  },
);

/** Usuário da sessão do dashboard. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionPrincipal => {
    const session = getRequestContext(requestOf(context)).session;
    if (!session) throw new Error('CurrentSession used on a route without session authentication');
    return session;
  },
);

/** requestId, IP e user-agent para audit log. */
export const CurrentRequestMeta = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestMeta =>
    toRequestMeta(getRequestContext(requestOf(context))),
);
