import { Injectable } from '@nestjs/common';
import { Clock } from '../../../shared/clock/clock.js';
import { UnitOfWork } from '../../../shared/database/unit-of-work.js';
import type { RequestMeta } from '../../../shared/http/request-context.js';
import { generateId } from '../../../shared/ids/generate-id.js';
import { RateLimiter } from '../../../shared/rate-limit/rate-limiter.js';
import { AuditTrail } from '../../audit/audit-trail.js';
import { CreateMerchantWithOwnerUseCase } from '../../merchants/application/create-merchant-with-owner.use-case.js';
import { normalizeEmail } from '../domain/email.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { UserRepository } from '../infrastructure/user.repository.js';
import { enforceRateLimit, SIGNUP_PER_IP } from './auth-rate-limits.js';
import { GetCurrentUserUseCase } from './get-current-user.use-case.js';
import type { CurrentUser } from './get-current-user.use-case.js';
import { SessionIssuer } from './session-issuer.js';
import type { IssuedSession } from './session-issuer.js';

export interface SignUpInput {
  readonly email: string;
  readonly password: string;
  readonly merchantName: string;
  readonly request: RequestMeta;
}

export interface AuthenticatedUser {
  readonly session: IssuedSession;
  readonly currentUser: CurrentUser;
}

/** Cria User + Merchant + MerchantMember (OWNER) + Session + AuditLog em uma única transação. */
@Injectable()
export class SignUpUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly rateLimiter: RateLimiter,
    private readonly passwordHasher: PasswordHasher,
    private readonly users: UserRepository,
    private readonly createMerchant: CreateMerchantWithOwnerUseCase,
    private readonly sessionIssuer: SessionIssuer,
    private readonly auditTrail: AuditTrail,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  async execute(input: SignUpInput): Promise<AuthenticatedUser> {
    const now = this.clock.now();
    await enforceRateLimit(this.rateLimiter, SIGNUP_PER_IP, input.request.ipAddress, now);

    // Hash fora da transação: é CPU-bound e não deve segurar conexão do banco.
    const passwordHash = await this.passwordHasher.hash(input.password);
    const userId = generateId('usr');
    const merchantId = generateId('mer');

    const session = await this.unitOfWork.run(async () => {
      await this.users.create({ id: userId, email: normalizeEmail(input.email), passwordHash });
      await this.createMerchant.execute({
        merchantId,
        name: input.merchantName,
        ownerUserId: userId,
      });
      const issued = await this.sessionIssuer.issue(userId, now);
      await this.auditTrail.record({
        action: 'user.signed_up',
        actor: { type: 'USER', id: userId },
        merchantId,
        resource: { type: 'user', id: userId },
        request: input.request,
      });
      return issued;
    });

    return { session, currentUser: await this.getCurrentUser.execute(userId) };
  }
}
