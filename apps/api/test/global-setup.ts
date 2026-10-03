import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { requireTestDatabaseUrl } from './support/load-test-env.js';

/**
 * Aplica as migrations no banco de testes (`nexopay_test`) antes da suíte.
 * Os testes nunca truncam tabelas: cada teste cria seus próprios merchants,
 * o que também exercita o isolamento multi-tenant com dados de outros testes.
 */
export default function setup(): void {
  const databaseUrl = requireTestDatabaseUrl();

  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(import.meta.dirname, '../../../packages/database'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
