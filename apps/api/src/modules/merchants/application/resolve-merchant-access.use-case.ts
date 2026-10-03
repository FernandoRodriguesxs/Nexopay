import { Injectable } from '@nestjs/common';
import type { MerchantRole } from '@nexopay/contracts';
import { resourceNotFound } from '../../../shared/errors/app-error.js';
import { MerchantRepository } from '../infrastructure/merchant.repository.js';

export interface ResolveMerchantAccessInput {
  readonly userId: string;
  readonly merchantId: string;
}

/**
 * Autoriza o acesso de um usuário a um Merchant. Sem vínculo → 404 (não 403),
 * para não revelar a existência de merchants de terceiros.
 */
@Injectable()
export class ResolveMerchantAccessUseCase {
  constructor(private readonly merchants: MerchantRepository) {}

  async execute(input: ResolveMerchantAccessInput): Promise<MerchantRole> {
    const role = await this.merchants.findMembershipRole(input.userId, input.merchantId);
    if (!role) throw resourceNotFound('Merchant');

    return role;
  }
}
