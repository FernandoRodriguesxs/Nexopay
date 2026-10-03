import { z } from 'zod';
import { environmentSchema } from './environment.js';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

const emailSchema = z.email().max(254);
const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const signupRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  merchantName: z.string().trim().min(1).max(100),
});

export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  // No login não aplicamos a política de tamanho mínimo: a resposta é sempre genérica.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const MERCHANT_ROLES = ['OWNER', 'ADMIN', 'DEVELOPER'] as const;

export const merchantRoleSchema = z.enum(MERCHANT_ROLES);

export type MerchantRole = z.infer<typeof merchantRoleSchema>;

export const userSchema = z.object({
  id: z.string(),
  object: z.literal('user'),
  email: z.string(),
  createdAt: z.string(),
});

export type UserResource = z.infer<typeof userSchema>;

export const membershipSchema = z.object({
  object: z.literal('membership'),
  role: merchantRoleSchema,
  merchant: z.object({
    id: z.string(),
    object: z.literal('merchant'),
    name: z.string(),
  }),
});

export type MembershipResource = z.infer<typeof membershipSchema>;

/** Resposta de signup, login e `GET /v1/auth/me`. */
export const currentUserResponseSchema = z.object({
  user: userSchema,
  memberships: z.array(membershipSchema),
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;

/** Resposta de `GET /v1/whoami` (autenticado por API Key). */
export const whoamiResponseSchema = z.object({
  object: z.literal('whoami'),
  environment: environmentSchema,
  merchant: z.object({ id: z.string(), object: z.literal('merchant'), name: z.string() }),
  apiKey: z.object({ id: z.string(), object: z.literal('api_key'), name: z.string() }),
});

export type WhoamiResponse = z.infer<typeof whoamiResponseSchema>;
