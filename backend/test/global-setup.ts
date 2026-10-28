import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { createDb, createPool } from '../src/db/client.js';
import { migrateToLatest } from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5434;
const TEST_USER = 'ledger';
const TEST_PASSWORD = 'ledger_test_password';
const TEST_DB = 'ledger_test';
const TEST_DATA_DIR = path.resolve(__dirname, '../.pgdata-test');

let embeddedPg: EmbeddedPostgres | null = null;

async function canConnect(connectionString: string): Promise<boolean> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 1000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      // connection already closed
    }
    return false;
  }
}

export default async function setup() {
  const connectionUrl =
    process.env.TEST_DATABASE_URL ||
    `postgresql://${TEST_USER}:${TEST_PASSWORD}@localhost:${TEST_PORT}/${TEST_DB}`;

  const alreadyRunning = await canConnect(connectionUrl);

  if (!alreadyRunning && !process.env.TEST_DATABASE_URL) {
    embeddedPg = new EmbeddedPostgres({
      databaseDir: TEST_DATA_DIR,
      port: TEST_PORT,
      user: TEST_USER,
      password: TEST_PASSWORD,
      persistent: true,
    });

    try {
      await embeddedPg.initialise();
    } catch {
      // already initialised is fine
    }

    await embeddedPg.start();

    try {
      await embeddedPg.createDatabase(TEST_DB);
    } catch {
      // already exists
    }
  }

  // Run migrations once on test database
  const pool = createPool({
    connectionString: connectionUrl,
    max: 2,
  });
  const db = createDb(pool);

  try {
    await migrateToLatest(db);
  } finally {
    await db.destroy();
    await pool.end();
  }

  process.env.DATABASE_URL = connectionUrl;

  return async () => {
    if (embeddedPg) {
      try {
        await embeddedPg.stop();
      } catch (err) {
        console.error('Error stopping embedded test postgres:', err);
      }
    }
  };
}
