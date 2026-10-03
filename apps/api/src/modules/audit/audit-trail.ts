import { Injectable } from '@nestjs/common';
import type { Environment } from '@nexopay/contracts';
import type { Prisma } from '@nexopay/database';
import { DatabaseService } from '../../shared/database/database.service.js';
import type { RequestMeta } from '../../shared/http/request-context.js';

export type AuditAction =
  'user.signed_up' | 'user.logged_in' | 'api_key.created' | 'api_key.revoked';

export type AuditActor =
  | { readonly type: 'USER'; readonly id: string }
  | { readonly type: 'API_KEY'; readonly id: string }
  | { readonly type: 'SYSTEM' };

export interface AuditEntry {
  readonly action: AuditAction;
  readonly actor: AuditActor;
  readonly merchantId?: string;
  readonly environment?: Environment;
  readonly resource?: { readonly type: string; readonly id: string };
  /** Nunca inclua secrets ou dados pessoais aqui. */
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly request: RequestMeta;
}

/**
 * Trilha de auditoria append-only (o banco bloqueia UPDATE/DELETE).
 * Deve ser chamada dentro da mesma unit of work da ação auditada.
 */
@Injectable()
export class AuditTrail {
  constructor(private readonly database: DatabaseService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.database.client.auditLog.create({ data: toAuditLogData(entry) });
  }
}

function toAuditLogData(entry: AuditEntry): Prisma.AuditLogUncheckedCreateInput {
  return {
    action: entry.action,
    actorType: entry.actor.type,
    actorId: entry.actor.type === 'SYSTEM' ? null : entry.actor.id,
    merchantId: entry.merchantId ?? null,
    environment: entry.environment ?? null,
    resourceType: entry.resource?.type ?? null,
    resourceId: entry.resource?.id ?? null,
    ...(entry.metadata ? { metadata: { ...entry.metadata } } : {}),
    ipAddress: entry.request.ipAddress ?? null,
    userAgent: entry.request.userAgent ?? null,
    requestId: entry.request.requestId,
  };
}
