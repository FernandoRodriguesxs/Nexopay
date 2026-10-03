import { Catch, Inject } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Logger } from '@nexopay/logger';
import type { Request, Response } from 'express';
import { LOGGER } from '../logging/logger.tokens.js';
import { findRequestContext } from '../http/request-context.js';
import { sendErrorResponse, toAppError } from './error-response.js';

/**
 * Converte toda exceção no contrato de erro. Erros inesperados são logados
 * com o requestId e respondidos com uma mensagem genérica — sem stack, SQL ou infra.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = findRequestContext(request)?.requestId ?? 'unknown';
    const error = toAppError(exception);

    if (error.code === 'INTERNAL_ERROR') {
      this.logger.error({ err: exception, requestId }, 'unhandled error');
    }

    sendErrorResponse(response, error, requestId);
  }
}
