import { Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/clock/clock.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { SessionPrincipal } from '../../../shared/http/request-context.js';
import { isSessionActive, renewSession, shouldRenewSession } from '../domain/session-policy.js';
import { SessionRepository } from '../infrastructure/session.repository.js';
import { hashSessionToken, isWellFormedSessionToken } from '../infrastructure/session-tokens.js';

const UNAUTHENTICATED = new AppError('UNAUTHENTICATED', 'Authentication is required.');

/**
 * Valida o token do cookie: inexistente, expirado (inatividade ou absoluto) ou
 * revogado → 401. Sessões válidas têm a expiração renovada de forma deslizante.
 */
@Injectable()
export class AuthenticateSessionUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(token: string): Promise<SessionPrincipal> {
    if (!isWellFormedSessionToken(token)) throw UNAUTHENTICATED;

    const session = await this.sessions.findByTokenHash(hashSessionToken(token));
    const now = this.clock.now();
    if (!session || !isSessionActive(session, now)) throw UNAUTHENTICATED;

    if (shouldRenewSession(session, now)) {
      await this.sessions.renew(session.id, renewSession(session, now));
    }

    return { userId: session.userId, sessionId: session.id };
  }
}
