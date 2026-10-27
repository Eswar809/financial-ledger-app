import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../../src/app.js';
import { getEnv } from '../../src/config/env.js';
import { createPool } from '../../src/db/client.js';

export interface TestContext {
  app: FastifyInstance;
  pool: pg.Pool;
}

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://ledger:ledger_test_password@localhost:5434/ledger_test';

export async function createTestApp(poolMax = 20): Promise<TestContext> {
  const env = {
    ...getEnv(),
    DATABASE_URL: TEST_DB_URL,
    PG_POOL_MAX: poolMax,
    LOG_LEVEL: 'silent' as const,
  };

  const pool = createPool({
    connectionString: TEST_DB_URL,
    max: poolMax,
    statementTimeoutMs: 15000,
    lockTimeoutMs: 10000,
    idleTimeoutMs: 15000,
  });

  const app = await buildApp({
    pool,
    env,
    logger: false,
  });

  await app.ready();
  return { app, pool };
}

export async function clearDatabase(pool: pg.Pool): Promise<void> {
  // Truncate bypasses row-level triggers
  await pool.query('TRUNCATE transactions, transfers, accounts RESTART IDENTITY CASCADE');
}
