import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { accountResponseSchema } from '../accounts/schemas.js';
import { transactionResponseSchema } from '../transactions/schemas.js';
import {
  createTransferBodySchema,
  transferResponseSchema,
} from './schemas.js';
import { TransfersService } from './service.js';

export async function transfersRoutes(fastify: FastifyInstance) {
  const service = new TransfersService(fastify.db);
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /api/v1/transfers
  app.post(
    '/',
    {
      schema: {
        tags: ['Transfers'],
        summary: 'Transfer money atomically between two accounts',
        body: createTransferBodySchema,
        response: {
          201: z.object({
            success: z.literal(true),
            data: z.object({
              transfer: transferResponseSchema,
              from_account: accountResponseSchema,
              to_account: accountResponseSchema,
              transactions: z.tuple([transactionResponseSchema, transactionResponseSchema]),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await service.createTransfer(request.body);
      return reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );
}
