import { z } from 'zod';
import { parseMoney } from '../../lib/money.js';

export const TRANSACTION_REF_REGEX = /^[A-Za-z0-9._-]{1,120}$/;

export const createTransactionBodySchema = z.object({
  account_id: z.string().uuid('Invalid account_id UUID format'),
  type: z.enum(['credit', 'debit']),
  amount: z
    .union([z.string(), z.number()])
    .superRefine((val, ctx) => {
      try {
        const parsed = parseMoney(val);
        if (parsed === '0.0000') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Transaction amount must be strictly positive',
          });
        }
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message || 'Invalid amount format',
        });
      }
    })
    .transform((val) => parseMoney(val)),
  reference_id: z
    .string()
    .min(1, 'Reference ID must not be empty')
    .max(120, 'Reference ID must not exceed 120 characters')
    .regex(
      TRANSACTION_REF_REGEX,
      'Reference ID must contain only alphanumeric characters, underscores, hyphens, and dots (no colons)',
    ),
  description: z.string().max(500).optional(),
});

export type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;

export const transactionResponseSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  transfer_id: z.string().nullable(),
  type: z.enum(['credit', 'debit']),
  amount: z.string(),
  balance_after: z.string(),
  reference_id: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
});

export type TransactionDto = z.infer<typeof transactionResponseSchema>;

export const listTransactionsQuerySchema = z.object({
  account_id: z.string().optional(),
  type: z.enum(['credit', 'debit']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
