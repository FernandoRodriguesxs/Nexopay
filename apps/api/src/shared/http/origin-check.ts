import { AppError } from '../errors/app-error.js';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Proteção CSRF para rotas de browser (sessão por cookie, signup e login).
 * Além de `SameSite=Lax`, métodos mutáveis exigem `Origin` igual à origem do
 * dashboard. `Origin` ausente é rejeitado: browsers sempre o enviam em POST/PUT/PATCH/DELETE.
 */
export function assertTrustedOrigin(
  method: string,
  origin: string | undefined,
  allowedOrigin: string,
): void {
  if (isSafeMethod(method)) return;
  if (origin === allowedOrigin) return;

  throw new AppError('INVALID_ORIGIN', 'The request origin is not allowed.');
}
