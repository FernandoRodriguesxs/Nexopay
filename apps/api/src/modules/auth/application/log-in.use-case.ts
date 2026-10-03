import { Inject, Injectable } from '@nestjs/common';
import type { Logger } from '@nexopay/logger';
import { Clock } from '../../../shared/clock/clock.js';
import { UnitOfWork } from '../../../shared/database/unit-of-work.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { RequestMeta } from '../../../shared/http/request-context.js';
import { LOGGER } from '../../../shared/logging/logger.tokens.js';
import { RateLimiter } from '../../../shared/rate-limit/rate-limiter.js';
import { AuditTrail } from '../../audit/audit-trail.js';
import { normalizeEmail } from '../domain/email.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { UserRepository } from '../infrastructure/user.repository.js';
import type { UserCredentials } from '../infrastructure/user.repository.js';
import { enforceRateLimit, LOGIN_PER_EMAIL, LOGIN_PER_IP } from './auth-rate-limits.js';
import { GetCurrentUserUseCase } from './get-current-user.use-case.js';
import { SessionIssuer } from './session-issuer.js';
import type { AuthenticatedUser } from './sign-up.use-case.js';

export interface LogInInput {
  readonly email: string;
  readonly password: string;
  readonly request: RequestMeta;
}

/** Mesma resposta para email inexistente e senha errada (sem enumeração de contas). */
const INVALID_CREDENTIALS = new AppError('INVALID_CREDENTIALS', 'Invalid email or password.');

@Injectable()
export class LogInUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly rateLimiter: RateLimiter,
    private readonly passwordHasher: PasswordHasher,
    private readonly users: UserRepository,
    private readonly sessionIssuer: SessionIssuer,
    private readonly auditTrail: AuditTrail,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async execute(input: LogInInput): Promise<AuthenticatedUser> {
    const now = this.clock.now();
    const email = normalizeEmail(input.email);
    await enforceRateLimit(this.rateLimiter, LOGIN_PER_IP, input.request.ipAddress, now);
    await enforceRateLimit(this.rateLimiter, LOGIN_PER_EMAIL, email, now);

    const credentials = await this.verifyCredentials(email, input.password);
    await this.upgradePasswordHashIfNeeded(credentials, input.password);

    const session = await this.unitOfWork.run(async () => {
      const issued = await this.sessionIssuer.issue(credentials.id, now);
      await this.auditTrail.record({
        action: 'user.logged_in',
        actor: { type: 'USER', id: credentials.id },
        resource: { type: 'user', id: credentials.id },
        request: input.request,
      });
      return issued;
    });

    return { session, currentUser: await this.getCurrentUser.execute(credentials.id) };
  }

  private async verifyCredentials(email: string, password: string): Promise<UserCredentials> {
    const credentials = await this.users.findCredentialsByEmail(email);
    if (!credentials) {
      await this.passwordHasher.verifyAgainstDummy(password);
      throw INVALID_CREDENTIALS;
    }

    const valid = await this.passwordHasher.verify(password, credentials.passwordHash);
    if (!valid) {
      this.logger.warn({ userId: credentials.id }, 'login failed: invalid password');
      throw INVALID_CREDENTIALS;
    }

    return credentials;
  }

  private async upgradePasswordHashIfNeeded(
    credentials: UserCredentials,
    password: string,
  ): Promise<void> {
    if (!this.passwordHasher.needsRehash(credentials.passwordHash)) return;

    await this.users.updatePasswordHash(credentials.id, await this.passwordHasher.hash(password));
  }
}
