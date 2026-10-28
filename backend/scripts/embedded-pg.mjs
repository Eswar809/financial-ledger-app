import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import EmbeddedPostgres from 'embedded-postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../.pgdata-dev');
const PORT = 5433;
const USER = 'ledger';
const PASSWORD = 'ledger_dev_password';
const DB = 'ledger';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clearStaleServer() {
  const pidFile = path.join(DATA_DIR, 'postmaster.pid');
  if (!fs.existsSync(pidFile)) return;
  const pid = parseInt(fs.readFileSync(pidFile, 'utf8').split('\n')[0], 10);
  if (pid) {
    try {
      const { execSync } = await import('child_process');
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
      await sleep(1500);
    } catch {
      // process already gone
    }
  }
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // already removed
  }
}

async function run() {
  console.log(`Starting embedded PostgreSQL on port ${PORT}...`);
  console.log(`Data directory: ${DATA_DIR}`);

  await clearStaleServer();

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (err) {
    // Already initialised is fine
    console.log('Database already initialized or notice:', err.message);
  }

  await pg.start();
  console.log(`PostgreSQL running on localhost:${PORT}`);

  try {
    await pg.createDatabase(DB);
    console.log(`Created database "${DB}"`);
  } catch {
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
