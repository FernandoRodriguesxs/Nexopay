import { Injectable } from '@nestjs/common';
import type { MerchantRole } from '@nexopay/contracts';
import { DatabaseService } from '../../../shared/database/database.service.js';

export interface MerchantRecord {
  readonly id: string;
  readonly name: string;
}

export interface MembershipRecord {
  readonly role: MerchantRole;
  readonly merchant: MerchantRecord;
}

/**
 * Merchant é o próprio tenant: buscá-lo por `id` é permitido, desde que o acesso
 * tenha sido autorizado antes (vínculo do usuário ou API Key do mesmo merchant).
 */
@Injectable()
export class MerchantRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Cria o Merchant já com o OWNER — a invariante "todo Merchant tem um OWNER" nasce atômica. */
  async createWithOwner(input: { id: string; name: string; ownerUserId: string }): Promise<void> {
    await this.database.client.merchant.create({
      data: {
        id: input.id,
        name: input.name,
        members: { create: { userId: input.ownerUserId, role: 'OWNER' } },
      },
    });
  }

  async findById(merchantId: string): Promise<MerchantRecord | null> {
    return this.database.client.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true },
    });
  }

  async findMembershipRole(userId: string, merchantId: string): Promise<MerchantRole | null> {
    const membership = await this.database.client.merchantMember.findUnique({
      where: { merchantId_userId: { merchantId, userId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async listMemberships(userId: string): Promise<MembershipRecord[]> {
    return this.database.client.merchantMember.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, merchant: { select: { id: true, name: true } } },
    });
  }
}
