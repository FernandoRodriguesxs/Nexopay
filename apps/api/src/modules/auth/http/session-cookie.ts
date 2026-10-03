import type { ApiEnv } from '@nexopay/config';
import { SESSION_COOKIE_NAME } from '@nexopay/contracts';
import { parseCookie } from 'cookie';
import type { CookieOptions, Request, Response } from 'express';

/**
 * Cookie da sessão: HttpOnly (inacessível a JS), Secure em produção, SameSite=Lax
 * (bloqueia envio em POST cross-site) e host-only (sem Domain). Path `/`.
 */
function baseOptions(env: ApiEnv): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

export function setSessionCookie(
  response: Response,
  env: ApiEnv,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, { ...baseOptions(env), expires: expiresAt });
}

export function clearSessionCookie(response: Response, env: ApiEnv): void {
  response.clearCookie(SESSION_COOKIE_NAME, baseOptions(env));
}

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  return parseCookie(header)[SESSION_COOKIE_NAME];
}
