import type { Environment } from '@nexopay/contracts';
import { AppError } from '../errors/app-error.js';

/**
 * Ambientes habilitados. PRODUCTION existe no modelo, mas só será habilitado
 * após as decisões de negócio/regulatórias (PRD §11).
 */
const ENABLED_ENVIRONMENTS: ReadonlySet<Environment> = new Set(['SANDBOX']);

export function assertEnvironmentEnabled(environment: Environment): void {
  if (ENABLED_ENVIRONMENTS.has(environment)) return;

  throw new AppError('ENVIRONMENT_NOT_ENABLED', `The ${environment} environment is not enabled.`);
}
