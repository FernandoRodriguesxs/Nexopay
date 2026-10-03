import { Injectable } from '@nestjs/common';
import { resourceNotFound } from '../../../shared/errors/app-error.js';
import { MerchantRepository } from '../infrastructure/merchant.repository.js';
import type { MerchantRecord } from '../infrastructure/merchant.repository.js';

/** Carrega o Merchant de um tenant já autenticado. */
@Injectable()
export class GetMerchantUseCase {
  constructor(private readonly merchants: MerchantRepository) {}

  async execute(merchantId: string): Promise<MerchantRecord> {
    const merchant = await this.merchants.findById(merchantId);
    if (!merchant) throw resourceNotFound('Merchant');

    return merchant;
  }
}
