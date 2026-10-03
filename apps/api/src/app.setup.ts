import type { INestApplication } from '@nestjs/common';

/**
 * Configuração HTTP compartilhada entre o servidor real e os testes e2e,
 * garantindo que os testes exercitem o mesmo pipeline do runtime.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableShutdownHooks();
  return app;
}
