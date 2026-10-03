import { Controller, Get, HttpCode, Inject, Res } from '@nestjs/common';
import type { Logger } from '@nexopay/logger';
import type { Response } from 'express';
import { Public } from '../../shared/auth/route-auth.js';
import { DatabaseService } from '../../shared/database/database.service.js';
import { LOGGER } from '../../shared/logging/logger.tokens.js';
import { RedisConnection } from '../../shared/redis/redis-connection.js';

export interface HealthResponse {
  readonly status: 'ok';
}

type CheckStatus = 'ok' | 'unavailable';

export interface ReadinessResponse {
  readonly status: 'ok' | 'unavailable';
  readonly checks: { readonly database: CheckStatus; readonly redis: CheckStatus };
}

@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisConnection,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** Liveness: o processo responde. Não depende de infraestrutura. */
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }

  /** Readiness: PostgreSQL e Redis acessíveis. Detalhes de falha só nos logs. */
  @Get('ready')
  @HttpCode(200)
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([
      this.probe('database', () => this.database.client.$queryRaw`SELECT 1`),
      this.probe('redis', () => this.redis.client.ping()),
    ]);
    const healthy = database === 'ok' && redis === 'ok';
    if (!healthy) response.status(503);

    return { status: healthy ? 'ok' : 'unavailable', checks: { database, redis } };
  }

  private async probe(name: string, check: () => Promise<unknown>): Promise<CheckStatus> {
    try {
      await check();
      return 'ok';
    } catch (error) {
      this.logger.error({ err: error, check: name }, 'readiness check failed');
      return 'unavailable';
    }
  }
}
