import { EmbeddedPostgres } from 'embedded-postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../.pgdata-dev');
const PORT = 5433;
const USER = 'ledger';
const PASSWORD = 'ledger_dev_password';
const DB = 'ledger';

async function run() {
  console.log(`Starting embedded PostgreSQL on port ${PORT}...`);
  console.log(`Data directory: ${DATA_DIR}`);

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (err: any) {
    // Already initialised is fine
    console.log('Database already initialized or notice:', err.message);
  }

  await pg.start();
  console.log(`PostgreSQL running on localhost:${PORT}`);

  try {
    await pg.createDatabase(DB);
    console.log(`Created database "${DB}"`);
  } catch (err: any) {
    console.log(`Database "${DB}" ready.`);
  }

  console.log(`Connection URL: postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`);
  console.log('Press Ctrl+C to stop.');

  process.on('SIGINT', async () => {
    console.log('\nStopping embedded PostgreSQL...');
    await pg.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await pg.stop();
    process.exit(0);
  });
}

run().catch((err) => {
  console.error('Failed to start embedded PostgreSQL:', err);
  process.exit(1);
});
