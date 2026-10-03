import type { CurrentUserResponse } from '@nexopay/contracts';
import type { CurrentUser } from '../application/get-current-user.use-case.js';

export function presentCurrentUser(currentUser: CurrentUser): CurrentUserResponse {
  return {
    user: {
      id: currentUser.user.id,
      object: 'user',
      email: currentUser.user.email,
      createdAt: currentUser.user.createdAt.toISOString(),
    },
    memberships: currentUser.memberships.map((membership) => ({
      object: 'membership',
      role: membership.role,
      merchant: { id: membership.merchant.id, object: 'merchant', name: membership.merchant.name },
    })),
  };
}
