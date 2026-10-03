import { Injectable } from '@nestjs/common';
import { MerchantRepository } from '../infrastructure/merchant.repository.js';

export interface CreateMerchantWithOwnerInput {
  readonly merchantId: string;
  readonly name: string;
  readonly ownerUserId: string;
}

/** Cria um Merchant com o usuário como OWNER. Participa da unit of work do chamador (signup). */
@Injectable()
export class CreateMerchantWithOwnerUseCase {
  constructor(private readonly merchants: MerchantRepository) {}

  async execute(input: CreateMerchantWithOwnerInput): Promise<void> {
    await this.merchants.createWithOwner({
      id: input.merchantId,
      name: input.name,
      ownerUserId: input.ownerUserId,
    });
  }
}
