import dotenv from 'dotenv';
import { getEnv } from '../config/env.js';
import { createDb, createPool } from '../db/client.js';
import { migrateToLatest } from '../db/migrate.js';

dotenv.config();

async function main() {
  const env = getEnv();
  console.log(`Running migrations against ${env.DATABASE_URL}...`);
  const pool = createPool({
    connectionString: env.DATABASE_URL,
    max: 2,
  });
  const db = createDb(pool);

  try {
    await migrateToLatest(db);
    console.log('Migrations completed successfully.');
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
