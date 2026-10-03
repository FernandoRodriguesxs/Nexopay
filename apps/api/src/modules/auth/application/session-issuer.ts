import { Injectable } from '@nestjs/common';
import { startSession } from '../domain/session-policy.js';
import { SessionRepository } from '../infrastructure/session.repository.js';
import { generateSessionToken, hashSessionToken } from '../infrastructure/session-tokens.js';

/** Sessão recém-criada: o token só existe aqui e no cookie. */
export interface IssuedSession {
  readonly token: string;
  readonly expiresAt: Date;
}

/** Cria sessões para signup e login. Participa da unit of work do chamador. */
@Injectable()
export class SessionIssuer {
  constructor(private readonly sessions: SessionRepository) {}

  async issue(userId: string, now: Date): Promise<IssuedSession> {
    const token = generateSessionToken();
    const lifetime = startSession(now);
    await this.sessions.create({ userId, tokenHash: hashSessionToken(token), lifetime });

    return { token, expiresAt: lifetime.absoluteExpiresAt };
  }
}
