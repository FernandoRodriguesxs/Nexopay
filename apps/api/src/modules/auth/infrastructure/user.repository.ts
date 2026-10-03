import { Injectable } from '@nestjs/common';
import { isUniqueConstraintViolation } from '@nexopay/database';
import { DatabaseService } from '../../../shared/database/database.service.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly createdAt: Date;
}

export interface UserCredentials {
  readonly id: string;
  readonly passwordHash: string;
}

const PUBLIC_FIELDS = { id: true, email: true, createdAt: true } as const;

/** Usuários do dashboard. `email` já chega normalizado do use case. */
@Injectable()
export class UserRepository {
  constructor(private readonly database: DatabaseService) {}

  /** A constraint única do banco é o árbitro final em cadastros concorrentes. */
  async create(input: { id: string; email: string; passwordHash: string }): Promise<void> {
    try {
      await this.database.client.user.create({ data: input });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AppError('EMAIL_ALREADY_REGISTERED', 'This email is already registered.');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.database.client.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.database.client.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.database.client.user.update({ where: { id }, data: { passwordHash } });
  }
}
