import type { LoggerService } from '@nestjs/common';
import type { Logger } from '@nexopay/logger';

/** Adapta o logger estruturado (pino) para a interface de log do Nest. */
export class NestLoggerAdapter implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message));
  }
}
