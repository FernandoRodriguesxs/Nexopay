import { Prisma } from './generated/prisma/client.js';

/** Código do Prisma para violação de constraint única. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Indica se o erro é uma violação de constraint única do PostgreSQL.
 * Repositórios usam isto para traduzir corridas (ex.: email já cadastrado)
 * em erros de domínio, deixando o banco como árbitro final.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}
