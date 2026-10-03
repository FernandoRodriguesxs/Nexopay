import { createHash, randomBytes } from 'node:crypto';

/**
 * Token de sessão: 32 bytes aleatórios em base64url (43 caracteres), entregue só no cookie.
 * No banco fica apenas o SHA-256 (hex). Com 256 bits de entropia, um hash lento não
 * agrega segurança e impediria o lookup direto por índice único.
 */
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function isWellFormedSessionToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
