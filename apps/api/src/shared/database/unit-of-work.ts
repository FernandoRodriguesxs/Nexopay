import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

/**
 * Fronteira transacional usada pelos use cases (que não conhecem o Prisma).
 * Regra: nenhuma chamada de rede externa (provider, webhook) dentro de `run`.
 */
@Injectable()
export class UnitOfWork {
  constructor(private readonly database: DatabaseService) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.database.runInTransaction(work);
  }
}
