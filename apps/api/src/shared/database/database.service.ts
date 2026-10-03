import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type { ApiEnv } from '@nexopay/config';
import { createPrismaClient } from '@nexopay/database';
import type { Prisma, PrismaClient } from '@nexopay/database';
import { API_ENV } from '../../config/env.js';

export type DatabaseClient = Prisma.TransactionClient;

/**
 * Acesso ao PostgreSQL. Repositórios usam `client`, que é automaticamente o client
 * transacional quando há uma unit of work em andamento (AsyncLocalStorage).
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private readonly transactions = new AsyncLocalStorage<DatabaseClient>();

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.prisma = createPrismaClient({ databaseUrl: env.DATABASE_URL });
  }

  get client(): DatabaseClient {
    return this.transactions.getStore() ?? this.prisma;
  }

  /** Executa `work` em uma transação; chamadas aninhadas participam da transação externa. */
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.transactions.getStore()) return work();

    return this.prisma.$transaction((transaction) => this.transactions.run(transaction, work));
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
