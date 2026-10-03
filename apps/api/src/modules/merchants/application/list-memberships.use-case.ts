import { Injectable } from '@nestjs/common';
import { MerchantRepository } from '../infrastructure/merchant.repository.js';
import type { MembershipRecord } from '../infrastructure/merchant.repository.js';

/** Merchants dos quais o usuário é membro, com o papel em cada um. */
@Injectable()
export class ListMembershipsUseCase {
  constructor(private readonly merchants: MerchantRepository) {}

  execute(userId: string): Promise<MembershipRecord[]> {
    return this.merchants.listMemberships(userId);
  }
}
