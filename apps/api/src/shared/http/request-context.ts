import { AsyncLocalStorage } from 'node:async_hooks';
import type { Environment, MerchantRole } from '@nexopay/contracts';
import type { Request } from 'express';

/** Usuário autenticado por sessão do dashboard. */
export interface SessionPrincipal {
  readonly userId: string;
  readonly sessionId: string;
}

export type TenantActor =
  | { readonly type: 'user'; readonly userId: string; readonly role: MerchantRole }
  | { readonly type: 'api_key'; readonly apiKeyId: string };

/** Escopo obrigatório de toda consulta a recurso de tenant. */
export interface TenantScope {
  readonly merchantId: string;
  readonly environment: Environment;
}

/** Tenant + ambiente + quem está agindo, resolvidos pela autenticação. */
export interface TenantContext extends TenantScope {
  readonly actor: TenantActor;
}

/** Estado de um request. Mutável apenas pela borda HTTP (middlewares e AuthGuard). */
export interface RequestContext {
  readonly requestId: string;
  /** `X-Request-Id` enviado pelo cliente, já validado. Só para correlação em logs. */
  readonly clientRequestId: string | undefined;
  readonly startedAt: number;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
  session?: SessionPrincipal;
  tenant?: TenantContext;
}

/** Dados de origem do request repassados a use cases (audit log). */
export interface RequestMeta {
  readonly requestId: string;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
}

const contexts = new WeakMap<Request, RequestContext>();
const storage = new AsyncLocalStorage<RequestContext>();

export function attachRequestContext(request: Request, context: RequestContext): void {
  contexts.set(request, context);
}

export function findRequestContext(request: Request): RequestContext | undefined {
  return contexts.get(request);
}

export function getRequestContext(request: Request): RequestContext {
  const context = contexts.get(request);
  if (!context) throw new Error('Request context is missing: request id middleware not applied');
  return context;
}

export function runWithRequestContext(context: RequestContext, callback: () => void): void {
  storage.run(context, callback);
}

export function toRequestMeta(context: RequestContext): RequestMeta {
  return {
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

/** Campos de correlação adicionados a toda linha de log emitida durante um request. */
export function currentLogContext(): Record<string, unknown> {
  const context = storage.getStore();
  if (!context) return {};

  return {
    requestId: context.requestId,
    ...(context.tenant
      ? { merchantId: context.tenant.merchantId, environment: context.tenant.environment }
      : {}),
  };
}
