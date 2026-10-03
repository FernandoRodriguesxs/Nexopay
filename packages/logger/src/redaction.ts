/**
 * Chaves que NUNCA podem aparecer em logs.
 * Aplicadas no nível raiz e em até dois níveis de profundidade.
 */
export const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwordHash',
  'secret',
  'secretKey',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'refreshToken',
  'signingSecret',
  'webhookSecret',
  'x-nexopay-signature',
] as const;

export const REDACTED = '[REDACTED]';

function quote(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : `["${key}"]`;
}

function join(prefix: string, key: string): string {
  const segment = quote(key);
  return segment.startsWith('[') ? `${prefix}${segment}` : `${prefix}.${segment}`;
}

/** Gera os paths de redaction no formato aceito pelo pino (fast-redact). */
export function buildRedactPaths(keys: readonly string[] = SENSITIVE_KEYS): string[] {
  return keys.flatMap((key) => [quote(key), join('*', key), join('*.*', key)]);
}
