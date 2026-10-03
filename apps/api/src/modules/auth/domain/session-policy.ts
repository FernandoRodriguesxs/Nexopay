/**
 * Política de sessão do dashboard (TS puro, sem I/O).
 * - Expiração por inatividade de 12 h, renovada de forma deslizante.
 * - Expiração absoluta de 7 dias, independente de uso.
 * - Renovação gravada no máximo a cada 5 min (evita uma escrita por request).
 */
export const SESSION_IDLE_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionLifetime {
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

function earliest(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

export function startSession(now: Date): SessionLifetime {
  const absoluteExpiresAt = addMs(now, SESSION_ABSOLUTE_TTL_MS);
  return {
    lastSeenAt: now,
    expiresAt: earliest(addMs(now, SESSION_IDLE_TTL_MS), absoluteExpiresAt),
    absoluteExpiresAt,
    revokedAt: null,
  };
}

export function isSessionActive(session: SessionLifetime, now: Date): boolean {
  if (session.revokedAt) return false;
  if (session.absoluteExpiresAt.getTime() <= now.getTime()) return false;

  return session.expiresAt.getTime() > now.getTime();
}

export function shouldRenewSession(session: SessionLifetime, now: Date): boolean {
  return now.getTime() - session.lastSeenAt.getTime() >= SESSION_RENEW_INTERVAL_MS;
}

/** Nova expiração deslizante, nunca além da expiração absoluta. */
export function renewSession(session: SessionLifetime, now: Date): SessionLifetime {
  return {
    ...session,
    lastSeenAt: now,
    expiresAt: earliest(addMs(now, SESSION_IDLE_TTL_MS), session.absoluteExpiresAt),
  };
}
