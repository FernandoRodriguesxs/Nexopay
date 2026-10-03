import { pino } from 'pino';
import type { DestinationStream, Logger as PinoLogger } from 'pino';
import { buildRedactPaths, REDACTED } from './redaction.js';

export type Logger = PinoLogger;

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface CreateLoggerOptions {
  /** Nome do serviço emissor, ex.: "api", "webhook-worker". */
  readonly service: string;
  readonly level?: LogLevel;
  /** Saída legível para desenvolvimento local. Nunca em produção. */
  readonly pretty?: boolean;
  /** Destino customizado (útil em testes). */
  readonly destination?: DestinationStream;
  /** Chaves sensíveis adicionais a serem redigidas. */
  readonly redactKeys?: readonly string[];
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const { service, level = 'info', pretty = false, destination, redactKeys = [] } = options;

  const config = {
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    redact: {
      paths: [...buildRedactPaths(), ...buildRedactPaths(redactKeys)],
      censor: REDACTED,
    },
  };

  if (destination) return pino(config, destination);
  if (pretty) {
    return pino({
      ...config,
      transport: { target: 'pino-pretty', options: { messageKey: 'message', colorize: true } },
    });
  }

  return pino(config);
}
