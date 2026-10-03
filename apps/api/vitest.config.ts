import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC preserva metadata de decorators (emitDecoratorMetadata), exigida pela DI do Nest.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['reflect-metadata'],
    // Testes e2e usam PostgreSQL (nexopay_test) e Redis reais: `pnpm infra:up`.
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
