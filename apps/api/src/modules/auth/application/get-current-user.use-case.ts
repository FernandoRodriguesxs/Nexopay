import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/errors/app-error.js';
import { ListMembershipsUseCase } from '../../merchants/application/list-memberships.use-case.js';
import type { MembershipRecord } from '../../merchants/infrastructure/merchant.repository.js';
import { UserRepository } from '../infrastructure/user.repository.js';
import type { UserRecord } from '../infrastructure/user.repository.js';

export interface CurrentUser {
  readonly user: UserRecord;
  readonly memberships: readonly MembershipRecord[];
}

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly listMemberships: ListMembershipsUseCase,
  ) {}

  async execute(userId: string): Promise<CurrentUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');

    return { user, memberships: await this.listMemberships.execute(userId) };
  }
}
