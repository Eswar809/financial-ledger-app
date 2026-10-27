import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { isValidUuid } from '../../lib/uuid.js';
import { NotFoundError } from '../../lib/errors.js';
import { accountResponseSchema } from '../accounts/schemas.js';
import {
  createTransactionBodySchema,
  listTransactionsQuerySchema,
  transactionResponseSchema,
} from './schemas.js';
import { TransactionsService } from './service.js';

export async function transactionsRoutes(fastify: FastifyInstance) {
  const service = new TransactionsService(fastify.db);
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /api/v1/transactions
  app.post(
    '/',
    {
      schema: {
        tags: ['Transactions'],
        summary: 'Create a credit or debit transaction on an account',
        body: createTransactionBodySchema,
        response: {
          201: z.object({
            success: z.literal(true),
            data: z.object({
              transaction: transactionResponseSchema,
              account: accountResponseSchema,
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await service.createTransaction(request.body);
      return reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );

  // GET /api/v1/transactions
  app.get(
    '/',
    {
      schema: {
        tags: ['Transactions'],
        summary: 'List transactions with optional filtering and pagination',
        querystring: listTransactionsQuerySchema,
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.array(transactionResponseSchema),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              total_pages: z.number(),
            }),
          }),
        },
      },
    },
    async (request) => {
      if (request.query.account_id && !isValidUuid(request.query.account_id)) {
        throw new NotFoundError(`Account ${request.query.account_id} not found`);
      }
      const result = await service.listTransactions(request.query);
      return {
        success: true as const,
        data: result.items,
        meta: result.meta,
      };
    },
  );

  // GET /api/v1/accounts/:id/transactions
  app.get(
    '/accounts/:id/transactions',
    {
      schema: {
        tags: ['Transactions'],
        summary: 'List transactions for a specific account',
        params: z.object({ id: z.string() }),
        querystring: z.object({
          type: z.enum(['credit', 'debit']).optional(),
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        }),
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.array(transactionResponseSchema),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              total_pages: z.number(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      if (!isValidUuid(id)) {
        throw new NotFoundError(`Account ${id} not found`);
      }

      // Check account exists
      const accountExists = await fastify.db
        .selectFrom('accounts')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst();

      if (!accountExists) {
        throw new NotFoundError(`Account ${id} not found`);
      }

      const result = await service.listTransactions({
        ...request.query,
        account_id: id,
      });

      return {
        success: true as const,
        data: result.items,
        meta: result.meta,
      };
    },
  );
}
