import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysModule } from '../api-keys/api-keys.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { AuthenticateSessionUseCase } from './application/authenticate-session.use-case.js';
import { GetCurrentUserUseCase } from './application/get-current-user.use-case.js';
import { LogInUseCase } from './application/log-in.use-case.js';
import { LogOutUseCase } from './application/log-out.use-case.js';
import { SessionIssuer } from './application/session-issuer.js';
import { SignUpUseCase } from './application/sign-up.use-case.js';
import { AuthController } from './http/auth.controller.js';
import { AuthGuard } from './http/auth.guard.js';
import { PasswordHasher } from './infrastructure/password-hasher.js';
import { SessionRepository } from './infrastructure/session.repository.js';
import { UserRepository } from './infrastructure/user.repository.js';

/** Usuários, sessões e o AuthGuard global (API Key ou sessão, conforme a rota). */
@Module({
  imports: [ApiKeysModule, AuditModule, MerchantsModule],
  controllers: [AuthController],
  providers: [
    PasswordHasher,
    SessionRepository,
    UserRepository,
    SessionIssuer,
    AuthenticateSessionUseCase,
    GetCurrentUserUseCase,
    LogInUseCase,
    LogOutUseCase,
    SignUpUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
