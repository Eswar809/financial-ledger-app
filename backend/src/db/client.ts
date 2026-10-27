import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './schema.js';

const { Pool } = pg;

export interface PoolConfig {
  connectionString: string;
  max?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export function createPool(config: PoolConfig): pg.Pool {
  const statementTimeout = config.statementTimeoutMs ?? 10000;
  const lockTimeout = config.lockTimeoutMs ?? 5000;
  const idleTimeout = config.idleTimeoutMs ?? 15000;

  return new Pool({
    connectionString: config.connectionString,
    max: config.max ?? 20,
    idleTimeoutMillis: idleTimeout,
    connectionTimeoutMillis: 5000,
    // Set per-connection defaults for lock timeout & statement timeout
    options: `-c statement_timeout=${statementTimeout} -c lock_timeout=${lockTimeout} -c idle_in_transaction_session_timeout=${idleTimeout}`,
  });
}

export function createDb(pool: pg.Pool): Kysely<Database> {
  const dialect = new PostgresDialect({
    pool,
  });

  return new Kysely<Database>({
    dialect,
  });
}
