import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export interface CreatePrismaClientOptions {
  readonly databaseUrl: string;
}

/**
 * Cria um PrismaClient usando o driver adapter `pg`.
 * Instancie uma única vez por processo (a API o expõe via DI).
 */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({ connectionString: options.databaseUrl });
  return new PrismaClient({ adapter });
}
