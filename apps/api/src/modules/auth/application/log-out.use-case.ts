import { Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/clock/clock.js';
import { SessionRepository } from '../infrastructure/session.repository.js';

/** Revoga a sessão no servidor: o cookie deixa de valer imediatamente, mesmo se reenviado. */
@Injectable()
export class LogOutUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, this.clock.now());
  }
}
