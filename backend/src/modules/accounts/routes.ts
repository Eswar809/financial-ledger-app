import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { NotFoundError } from '../../lib/errors.js';
import { isValidUuid } from '../../lib/uuid.js';
import { transactionResponseSchema } from '../transactions/schemas.js';
import { TransactionsService } from '../transactions/service.js';
import {
  accountParamsSchema,
  accountResponseSchema,
  createAccountBodySchema,
  listAccountsQuerySchema,
} from './schemas.js';
import { AccountsService } from './service.js';

export async function accountsRoutes(fastify: FastifyInstance) {
  const service = new AccountsService(fastify.db);
  const txService = new TransactionsService(fastify.db);
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /api/v1/accounts
  app.post(
    '/',
    {
      schema: {
        tags: ['Accounts'],
        summary: 'Create a new account',
        body: createAccountBodySchema,
        response: {
          201: z.object({
            success: z.literal(true),
            data: accountResponseSchema,
          }),
        },
      },
    },
    async (request, reply) => {
      const account = await service.createAccount(request.body);
      return reply.status(201).header('Location', `/api/v1/accounts/${account.id}`).send({
        success: true,
        data: account,
      });
    },
  );

  // GET /api/v1/accounts
  app.get(
    '/',
    {
      schema: {
        tags: ['Accounts'],
        summary: 'List accounts with pagination',
        querystring: listAccountsQuerySchema,
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.array(accountResponseSchema),
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
      const result = await service.listAccounts(request.query);
      return {
        success: true as const,
        data: result.items,
        meta: result.meta,
      };
    },
  );

  // GET /api/v1/accounts/:id
  app.get(
    '/:id',
    {
      schema: {
        tags: ['Accounts'],
        summary: 'Get an account by ID',
        params: accountParamsSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            data: accountResponseSchema,
          }),
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      if (!isValidUuid(id)) {
        throw new NotFoundError(`Account ${id} not found`);
      }
      const account = await service.getAccountById(id);
      return {
        success: true as const,
        data: account,
      };
    },
  );

  // GET /api/v1/accounts/:id/transactions
  app.get(
    '/:id/transactions',
    {
      schema: {
        tags: ['Accounts'],
        summary: 'List transactions for a specific account',
        params: accountParamsSchema,
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

      const result = await txService.listTransactions({
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
