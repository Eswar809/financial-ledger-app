import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { getEnv } from './config/env.js';
import { createPool } from './db/client.js';

dotenv.config();

async function main() {
  const env = getEnv();

  const pool = createPool({
    connectionString: env.DATABASE_URL,
    max: env.PG_POOL_MAX,
    statementTimeoutMs: env.PG_STATEMENT_TIMEOUT_MS,
    lockTimeoutMs: env.PG_LOCK_TIMEOUT_MS,
    idleTimeoutMs: env.PG_IDLE_TIMEOUT_MS,
  });

  const app = await buildApp({
    pool,
    env,
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Graceful shutdown handling
  const closeSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  closeSignals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await app.close();
        await pool.end();
        app.log.info('Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  });

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
    app.log.info(`Swagger UI available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (err) {
    app.log.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
