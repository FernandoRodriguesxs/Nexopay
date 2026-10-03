import { z } from 'zod';

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'] as const;

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
