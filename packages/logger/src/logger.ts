import { pino } from 'pino';
import type { DestinationStream, Logger as PinoLogger, LoggerOptions } from 'pino';
import { createKeyMatcher, sanitizeLogObject, scrubString } from './redaction.js';

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
  /** Campos de contexto adicionados a toda linha (ex.: requestId do request corrente). */
  readonly context?: () => Record<string, unknown>;
}

function scrubArguments(args: unknown[]): unknown[] {
  return args.map((arg) => (typeof arg === 'string' ? scrubString(arg) : arg));
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const {
    service,
    level = 'info',
    pretty = false,
    destination,
    redactKeys = [],
    context,
  } = options;
  const isSensitive = createKeyMatcher(redactKeys);

  const config: LoggerOptions = {
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
    ...(context ? { mixin: context } : {}),
    // Erros já são serializados (e redigidos) por `sanitizeLogObject`.
    serializers: { err: (value: unknown) => value },
    formatters: {
      level: (label: string) => ({ level: label }),
      // Redaction profunda: roda antes dos serializers, sobre o objeto final da linha.
      log: (object) => sanitizeLogObject(object, isSensitive),
    },
    hooks: {
      // Mensagens livres (e argumentos de interpolação) também passam pelo scrub.
      logMethod(args, method) {
        method.apply(this, scrubArguments(args) as Parameters<typeof method>);
      },
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
