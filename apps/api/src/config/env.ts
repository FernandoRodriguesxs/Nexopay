import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { apiEnvSchema, parseEnv } from '@nexopay/config';
import type { ApiEnv } from '@nexopay/config';

export const API_ENV = Symbol('API_ENV');

/**
 * Carrega o .env da raiz do monorepo apenas fora de produção.
 * Em produção, as variáveis vêm exclusivamente do ambiente.
 */
function loadLocalEnvFile(): void {
  if (process.env.NODE_ENV === 'production') return;

  const rootEnvFile = resolve(import.meta.dirname, '../../../../.env');
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
}

export function loadApiEnv(): ApiEnv {
  loadLocalEnvFile();
  return parseEnv(apiEnvSchema, process.env);
}
