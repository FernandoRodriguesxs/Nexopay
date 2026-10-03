import { Module } from '@nestjs/common';
import { CreateMerchantWithOwnerUseCase } from './application/create-merchant-with-owner.use-case.js';
import { GetMerchantUseCase } from './application/get-merchant.use-case.js';
import { ListMembershipsUseCase } from './application/list-memberships.use-case.js';
import { ResolveMerchantAccessUseCase } from './application/resolve-merchant-access.use-case.js';
import { MerchantRepository } from './infrastructure/merchant.repository.js';

const USE_CASES = [
  CreateMerchantWithOwnerUseCase,
  GetMerchantUseCase,
  ListMembershipsUseCase,
  ResolveMerchantAccessUseCase,
];

/** Merchants: criação (no signup), vínculos e autorização de acesso. Exporta apenas use cases. */
@Module({
  providers: [MerchantRepository, ...USE_CASES],
  exports: USE_CASES,
})
export class MerchantsModule {}
