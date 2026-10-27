import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import pg from 'pg';
import type { Env } from './config/env.js';
import { createDb } from './db/client.js';
import type { Database } from './db/schema.js';
import { globalErrorHandler, notFoundHandler } from './lib/error-handler.js';
import { accountsRoutes } from './modules/accounts/routes.js';
import { transactionsRoutes } from './modules/transactions/routes.js';
import { transfersRoutes } from './modules/transfers/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Kysely<Database>;
    pool: pg.Pool;
  }
}

export interface BuildAppOptions {
  pool: pg.Pool;
  env: Env;
  logger?: boolean | object;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { pool, env, logger = true } = opts;
  const db = createDb(pool);

  const app = Fastify({
    logger,
    ajv: {
      customOptions: {
        coerceTypes: false,
      },
    },
  });

  // Attach database clients
  app.decorate('db', db);
  app.decorate('pool', pool);

  // Zod type provider compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Global error & 404 handlers
  app.setErrorHandler(globalErrorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // CORS
  const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim());
  await app.register(fastifyCors, {
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Swagger / OpenAPI documentation
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Financial Ledger & Money Transfer API',
        description:
          'Production-grade double-entry financial ledger and money transfer service with strict ACID guarantees, deadlock prevention, and append-only audit trail.',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}`,
          description: 'Current environment',
        },
      ],
      components: {
        schemas: {
          StandardErrorResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean', const: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  details: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        path: { type: 'string' },
                        message: { type: 'string' },
                      },
                      required: ['message'],
                    },
                  },
                },
                required: ['code', 'message', 'details'],
              },
            },
            required: ['success', 'error'],
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Expose raw OpenAPI JSON
  app.get('/openapi.json', { schema: { hide: true } }, async () => {
    return app.swagger();
  });

  // Health checks
  app.get('/health', { schema: { hide: true } }, async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  app.get('/health/ready', { schema: { hide: true } }, async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready', database: 'connected' };
    } catch (err: any) {
      return reply.status(503).send({
        status: 'not_ready',
        database: 'unreachable',
        error: err.message,
      });
    }
  });

  // Register domain route modules under /api/v1
  await app.register(
    async (v1) => {
      await v1.register(accountsRoutes, { prefix: '/accounts' });
      await v1.register(transactionsRoutes, { prefix: '/transactions' });
      await v1.register(transfersRoutes, { prefix: '/transfers' });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
