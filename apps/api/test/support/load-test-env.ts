import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Carrega o `.env` da raiz (sem sobrescrever variáveis já definidas, ex.: no CI). */
export function loadRootEnvFile(): void {
  const rootEnvFile = resolve(import.meta.dirname, '../../../../.env');
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
}

export function requireTestDatabaseUrl(): string {
  loadRootEnvFile();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required for API tests. Run `pnpm infra:up` and set it in .env.',
    );
  }
  return url;
}

export function requireRedisUrl(): string {
  loadRootEnvFile();
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}
