import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
