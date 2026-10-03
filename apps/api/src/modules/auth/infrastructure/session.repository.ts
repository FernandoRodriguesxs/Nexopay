import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/database/database.service.js';
import type { SessionLifetime } from '../domain/session-policy.js';

export interface SessionRecord extends SessionLifetime {
  readonly id: string;
  readonly userId: string;
}

const SESSION_FIELDS = {
  id: true,
  userId: true,
  lastSeenAt: true,
  expiresAt: true,
  absoluteExpiresAt: true,
  revokedAt: true,
} as const;

/** Sessões do dashboard. O token nunca é persistido — apenas seu SHA-256. */
@Injectable()
export class SessionRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    lifetime: SessionLifetime;
  }): Promise<void> {
    await this.database.client.session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        lastSeenAt: input.lifetime.lastSeenAt,
        expiresAt: input.lifetime.expiresAt,
        absoluteExpiresAt: input.lifetime.absoluteExpiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.database.client.session.findUnique({
      where: { tokenHash },
      select: SESSION_FIELDS,
    });
  }

  /** Renovação condicional: não ressuscita sessão revogada em paralelo. */
  async renew(id: string, lifetime: SessionLifetime): Promise<void> {
    await this.database.client.session.updateMany({
      where: { id, revokedAt: null },
      data: { lastSeenAt: lifetime.lastSeenAt, expiresAt: lifetime.expiresAt },
    });
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.database.client.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt },
    });
  }
}
