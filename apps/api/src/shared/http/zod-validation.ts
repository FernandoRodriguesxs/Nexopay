import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

function toDetails(error: z.ZodError, pathPrefix: string) {
  return error.issues.map((issue) => ({
    path: [pathPrefix, ...issue.path.map(String)].filter(Boolean).join('.'),
    message: issue.message,
  }));
}

/** Valida um valor de borda; falha vira `400 VALIDATION_ERROR` com os campos inválidos. */
export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  pathPrefix = '',
): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  throw new AppError(
    'VALIDATION_ERROR',
    'The request is invalid.',
    toDetails(result.error, pathPrefix),
  );
}

/** Pipe do Nest para `@Body()`, `@Query()` e `@Param()` com schemas de @nexopay/contracts. */
@Injectable()
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform {
  constructor(
    private readonly schema: TSchema,
    private readonly pathPrefix = '',
  ) {}

  transform(value: unknown): z.output<TSchema> {
    return parseInput(this.schema, value, this.pathPrefix);
  }
}
