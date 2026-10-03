import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { sendErrorResponse } from '../errors/error-response.js';
import { getRequestContext } from './request-context.js';

const MALFORMED_BODY = new AppError('VALIDATION_ERROR', 'The request body is not valid JSON.');
const PAYLOAD_TOO_LARGE = new AppError('PAYLOAD_TOO_LARGE', 'The request body is too large.');
const UNSUPPORTED_BODY = new AppError('VALIDATION_ERROR', 'The request body could not be read.');

function bodyParserErrorType(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;
  return typeof error.type === 'string' ? error.type : undefined;
}

/**
 * Erros do body parser acontecem antes do pipeline do Nest (e o handler padrão
 * do Express exporia o stack trace). Este handler devolve o contrato de erro.
 */
export function bodyParserErrorHandler(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const type = bodyParserErrorType(error);
  if (type === undefined) {
    next(error);
    return;
  }

  const appError =
    type === 'entity.too.large'
      ? PAYLOAD_TOO_LARGE
      : type === 'entity.parse.failed'
        ? MALFORMED_BODY
        : UNSUPPORTED_BODY;
  sendErrorResponse(response, appError, getRequestContext(request).requestId);
}
