import { z } from 'zod';
import { parseMoney } from '../../lib/money.js';

export const createAccountBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name must not be empty')
    .max(120, 'Name must be at most 120 characters'),
  initial_balance: z
    .union([z.string(), z.number()])
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined || val === null || val === '') return;
      try {
        parseMoney(val);
      } catch (err: any) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message || 'Invalid initial_balance format',
        });
      }
    })
    .transform((val) => {
      if (val === undefined || val === null || val === '') return '0.0000';
      return parseMoney(val);
    }),
});

export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;

export const accountParamsSchema = z.object({
  id: z.string(),
});

export const accountResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  balance: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AccountDto = z.infer<typeof accountResponseSchema>;
