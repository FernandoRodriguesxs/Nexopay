import type { ErrorCode, ErrorDetail } from '@nexopay/contracts';

/**
 * Erro esperado da aplicação. O `code` é o contrato público; a mensagem é segura
 * para o cliente (nunca inclua secrets, SQL ou detalhes de infraestrutura).
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: readonly ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class RateLimitedError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many requests. Try again later.');
    this.name = 'RateLimitedError';
  }
}

export function resourceNotFound(resource: string): AppError {
  return new AppError('RESOURCE_NOT_FOUND', `${resource} not found.`);
}
