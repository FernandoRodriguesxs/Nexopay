/**
 * Chaves que NUNCA podem aparecer em logs, em qualquer profundidade.
 * A comparação ignora maiúsculas, `-` e `_` (ex.: `Set-Cookie` ≡ `setcookie`).
 * Inclui dados pessoais (email, taxId, phone) — ver CLAUDE.md.
 */
export const SENSITIVE_KEYS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'secret',
  'secretKey',
  'clientSecret',
  'apiKey',
  'x-api-key',
  'pepper',
  'apiKeyPepper',
  'token',
  'tokenHash',
  'sessionToken',
  'accessToken',
  'refreshToken',
  'privateKey',
  'signingSecret',
  'webhookSecret',
  'x-nexopay-signature',
  'databaseUrl',
  'redisUrl',
  'email',
  'taxId',
  'cpf',
  'cnpj',
  'phone',
] as const;

export const REDACTED = '[REDACTED]';

/**
 * Padrões de secrets reconhecíveis mesmo dentro de strings livres
 * (mensagens de erro, stack traces, URLs).
 */
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /\bsk_(?:test|live)_[0-9A-Za-z]+/g,
  /\bwhsec_[0-9A-Za-z]+/g,
  /\bBearer\s+[^\s"',;]+/gi,
  /(\b[a-z][a-z0-9+.-]*:\/\/[^:/@\s]+:)[^@\s]+@/gi,
];

const MAX_DEPTH = 8;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

export function createKeyMatcher(extraKeys: readonly string[] = []): (key: string) => boolean {
  const keys = new Set([...SENSITIVE_KEYS, ...extraKeys].map(normalizeKey));
  return (key) => keys.has(normalizeKey(key));
}

/** Remove secrets reconhecíveis de uma string livre. */
export function scrubString(value: string): string {
  return SECRET_VALUE_PATTERNS.reduce(
    (current, pattern) =>
      current.replace(pattern, (match, credentialsPrefix?: unknown) =>
        typeof credentialsPrefix === 'string' && match.endsWith('@')
          ? `${credentialsPrefix}${REDACTED}@`
          : REDACTED,
      ),
    value,
  );
}

type KeyMatcher = (key: string) => boolean;

interface SanitizeState {
  readonly isSensitive: KeyMatcher;
  readonly seen: WeakSet<object>;
}

function sanitizeError(error: Error, state: SanitizeState, depth: number): Record<string, unknown> {
  const ownFields = sanitizeRecord(error as unknown as Record<string, unknown>, state, depth);
  return {
    ...ownFields,
    type: error.name,
    message: scrubString(error.message),
    ...(error.stack ? { stack: scrubString(error.stack) } : {}),
    ...(error.cause === undefined ? {} : { cause: sanitizeValue(error.cause, state, depth + 1) }),
  };
}

function sanitizeRecord(
  record: Record<string, unknown>,
  state: SanitizeState,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = state.isSensitive(key) ? REDACTED : sanitizeValue(value, state, depth + 1);
  }
  return result;
}

function sanitizeValue(value: unknown, state: SanitizeState, depth: number): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH) return '[Truncated]';
  if (state.seen.has(value)) return '[Circular]';
  state.seen.add(value);

  if (value instanceof Error) return sanitizeError(value, state, depth);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item: unknown) => sanitizeValue(item, state, depth + 1));
  }
  if (ArrayBuffer.isView(value)) return '[Binary]';
  return sanitizeRecord(value as Record<string, unknown>, state, depth);
}

/**
 * Copia profunda do objeto de log com chaves sensíveis redigidas e secrets
 * removidos de strings. Nunca altera o objeto original.
 */
export function sanitizeLogObject(
  object: Record<string, unknown>,
  isSensitive: KeyMatcher = createKeyMatcher(),
): Record<string, unknown> {
  return sanitizeRecord(object, { isSensitive, seen: new WeakSet() }, 0);
}
