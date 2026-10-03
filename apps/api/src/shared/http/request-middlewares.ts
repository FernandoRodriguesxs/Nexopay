import { performance } from 'node:perf_hooks';
import { HEADERS } from '@nexopay/contracts';
import type { Logger } from '@nexopay/logger';
import type { NextFunction, Request, Response } from 'express';
import { generateId } from '../ids/generate-id.js';
import {
  attachRequestContext,
  getRequestContext,
  runWithRequestContext,
} from './request-context.js';
import type { RequestContext } from './request-context.js';

/**
 * `X-Request-Id` externo só é aceito se for curto e de charset restrito
 * (evita log injection e cabeçalhos gigantes). Ele nunca substitui o `req_`
 * gerado pela NexoPay: fica registrado como `clientRequestId` para correlação.
 */
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_USER_AGENT_LENGTH = 256;

export function parseClientRequestId(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  return CLIENT_REQUEST_ID_PATTERN.test(value) ? value : undefined;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  return value === undefined ? undefined : value.slice(0, maxLength);
}

function buildRequestContext(request: Request): RequestContext {
  return {
    requestId: generateId('req'),
    clientRequestId: parseClientRequestId(request.headers[HEADERS.requestId]),
    startedAt: performance.now(),
    ipAddress: request.ip,
    userAgent: truncate(request.get('user-agent'), MAX_USER_AGENT_LENGTH),
  };
}

function pathWithoutQuery(request: Request): string {
  return request.originalUrl.split('?')[0] ?? request.originalUrl;
}

function logCompletedRequest(logger: Logger, request: Request, response: Response): void {
  const context = getRequestContext(request);
  const fields = {
    requestId: context.requestId,
    clientRequestId: context.clientRequestId,
    method: request.method,
    path: pathWithoutQuery(request),
    status: response.statusCode,
    durationMs: Math.round(performance.now() - context.startedAt),
    merchantId: context.tenant?.merchantId,
    environment: context.tenant?.environment,
    actorType: context.tenant?.actor.type ?? (context.session ? 'user' : undefined),
  };

  if (response.statusCode >= 500) {
    logger.error(fields, 'request failed');
    return;
  }
  logger.info(fields, 'request completed');
}

/** Primeiro middleware: gera o request ID, devolve o header e agenda o log de conclusão. */
export function requestIdMiddleware(logger: Logger) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const context = buildRequestContext(request);
    attachRequestContext(request, context);
    response.setHeader('X-Request-Id', context.requestId);
    response.on('finish', () => {
      logCompletedRequest(logger, request, response);
    });
    next();
  };
}

/**
 * Propaga o contexto via AsyncLocalStorage para os logs. Registrado depois do
 * body parser, que perderia o contexto ao retomar a partir de eventos do stream.
 */
export function requestContextStorageMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  runWithRequestContext(getRequestContext(request), next);
}
