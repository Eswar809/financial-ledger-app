import { z } from 'zod';
import { parseMoney } from '../../lib/money.js';

export const TRANSFER_REF_REGEX = /^[A-Za-z0-9._-]{1,120}$/;

export const createTransferBodySchema = z.object({
  from_account_id: z.string().uuid('from_account_id must be a valid UUID'),
  to_account_id: z.string().uuid('to_account_id must be a valid UUID'),
  amount: z
    .union([z.string(), z.number()])
    .superRefine((val, ctx) => {
      try {
        const parsed = parseMoney(val);
        if (parsed === '0.0000') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Transfer amount must be strictly positive',
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
      TRANSFER_REF_REGEX,
      'Reference ID must contain only alphanumeric characters, underscores, hyphens, and dots (no colons)',
    ),
});

export type CreateTransferBody = z.infer<typeof createTransferBodySchema>;

export const transferResponseSchema = z.object({
  id: z.string(),
  reference_id: z.string(),
  from_account_id: z.string(),
  to_account_id: z.string(),
  amount: z.string(),
  created_at: z.string(),
});

export type TransferDto = z.infer<typeof transferResponseSchema>;
