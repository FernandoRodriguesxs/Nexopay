import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import type { ApiEnv } from '@nexopay/config';
import { loginRequestSchema, signupRequestSchema } from '@nexopay/contracts';
import type { CurrentUserResponse, LoginRequest, SignupRequest } from '@nexopay/contracts';
import type { Response } from 'express';
import { API_ENV } from '../../../config/env.js';
import {
  CurrentRequestMeta,
  CurrentSession,
  Public,
  SessionAuth,
} from '../../../shared/auth/route-auth.js';
import type { RequestMeta, SessionPrincipal } from '../../../shared/http/request-context.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.js';
import { GetCurrentUserUseCase } from '../application/get-current-user.use-case.js';
import { LogInUseCase } from '../application/log-in.use-case.js';
import { LogOutUseCase } from '../application/log-out.use-case.js';
import { SignUpUseCase } from '../application/sign-up.use-case.js';
import type { AuthenticatedUser } from '../application/sign-up.use-case.js';
import { presentCurrentUser } from './auth.presenter.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';

/** Autenticação humana do dashboard (sessão por cookie). Rota interna — fora do SDK. */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly signUp: SignUpUseCase,
    private readonly logIn: LogInUseCase,
    private readonly logOut: LogOutUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Post('signup')
  @Public({ checkOrigin: true })
  @HttpCode(201)
  async signup(
    @CurrentRequestMeta() request: RequestMeta,
    @Body(new ZodValidationPipe(signupRequestSchema)) body: SignupRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const authenticated = await this.signUp.execute({ ...body, request });
    return this.startSession(response, authenticated);
  }

  @Post('login')
  @Public({ checkOrigin: true })
  @HttpCode(200)
  async login(
    @CurrentRequestMeta() request: RequestMeta,
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const authenticated = await this.logIn.execute({ ...body, request });
    return this.startSession(response, authenticated);
  }

  @Post('logout')
  @SessionAuth()
  @HttpCode(204)
  async logout(
    @CurrentSession() session: SessionPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logOut.execute(session.sessionId);
    clearSessionCookie(response, this.env);
  }

  @Get('me')
  @SessionAuth()
  async me(@CurrentSession() session: SessionPrincipal): Promise<CurrentUserResponse> {
    return presentCurrentUser(await this.getCurrentUser.execute(session.userId));
  }

  private startSession(response: Response, authenticated: AuthenticatedUser): CurrentUserResponse {
    setSessionCookie(
      response,
      this.env,
      authenticated.session.token,
      authenticated.session.expiresAt,
    );
    return presentCurrentUser(authenticated.currentUser);
  }
}
