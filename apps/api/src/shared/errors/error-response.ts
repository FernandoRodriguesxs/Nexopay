import { HttpException } from '@nestjs/common';
import type { ErrorCode, ErrorResponse } from '@nexopay/contracts';
import type { Response } from 'express';
import { AppError, RateLimitedError } from './app-error.js';

export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_API_KEY: 401,
  API_KEY_REVOKED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  INVALID_ORIGIN: 403,
  ENVIRONMENT_NOT_ENABLED: 403,
  SANDBOX_ONLY: 403,
  RESOURCE_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  EMAIL_ALREADY_REGISTERED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** Mensagens genéricas para erros que não vieram de um AppError. */
const HTTP_STATUS_ERRORS: Readonly<Record<number, AppError>> = {
  400: new AppError('VALIDATION_ERROR', 'The request is invalid.'),
  401: new AppError('UNAUTHENTICATED', 'Authentication is required.'),
  403: new AppError('FORBIDDEN', 'You are not allowed to perform this action.'),
  404: new AppError('ROUTE_NOT_FOUND', 'Route not found.'),
  405: new AppError('ROUTE_NOT_FOUND', 'Route not found.'),
  413: new AppError('PAYLOAD_TOO_LARGE', 'The request body is too large.'),
  429: new AppError('RATE_LIMITED', 'Too many requests. Try again later.'),
};

export const INTERNAL_ERROR = new AppError('INTERNAL_ERROR', 'An unexpected error occurred.');

/**
 * Converte qualquer exceção em um AppError seguro para o cliente.
 * Erros desconhecidos viram INTERNAL_ERROR — a mensagem original nunca é exposta.
 */
export function toAppError(exception: unknown): AppError {
  if (exception instanceof AppError) return exception;
  if (exception instanceof HttpException) {
    return HTTP_STATUS_ERRORS[exception.getStatus()] ?? INTERNAL_ERROR;
  }

  return INTERNAL_ERROR;
}

export function toErrorResponse(error: AppError, requestId: string): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.details && error.details.length > 0 ? { details: [...error.details] } : {}),
    },
  };
}

export function sendErrorResponse(response: Response, error: AppError, requestId: string): void {
  if (error instanceof RateLimitedError) {
    response.setHeader('Retry-After', String(error.retryAfterSeconds));
  }

  response.status(ERROR_HTTP_STATUS[error.code]).json(toErrorResponse(error, requestId));
}
