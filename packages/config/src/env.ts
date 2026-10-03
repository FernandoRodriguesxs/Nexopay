import type { z } from 'zod';

export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface EnvIssue {
  readonly variable: string;
  readonly message: string;
}

/**
 * Erro de configuração. Contém apenas NOMES de variáveis e mensagens —
 * nunca valores, para evitar vazamento de secrets em logs.
 */
export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    const details = issues.map((issue) => `  - ${issue.variable}: ${issue.message}`).join('\n');
    super(`Invalid environment variables:\n${details}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function toEnvIssues(error: z.ZodError): EnvIssue[] {
  return error.issues.map((issue) => ({
    variable: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Valida um objeto de environment contra um schema Zod.
 * `source` é obrigatório: em Next.js, variáveis públicas precisam ser
 * referenciadas estaticamente (`process.env.NEXT_PUBLIC_X`).
 */
export function parseEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: EnvSource,
): z.output<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  throw new EnvValidationError(toEnvIssues(result.error));
}
