import { z } from 'zod';

export const ENVIRONMENTS = ['SANDBOX', 'PRODUCTION'] as const;

export const environmentSchema = z.enum(ENVIRONMENTS);

export type Environment = z.infer<typeof environmentSchema>;
