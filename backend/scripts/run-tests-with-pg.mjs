import { execSync, spawn } from 'child_process';
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5434;
const USER = 'ledger';
const PASSWORD = 'ledger_test_password';
const DB = 'ledger_test';
const DATA_DIR = path.resolve(__dirname, '../.pgdata-test');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * On Windows, a forcefully killed postgres can leave a stale shared-memory
 * block behind, and the next start fails with "pre-existing shared memory
 * block is still in use". Kill any process recorded in postmaster.pid and
 * give the OS a moment to release the segment before starting again.
 */
async function clearStaleServer() {
  const pidFile = path.join(DATA_DIR, 'postmaster.pid');
  if (!fs.existsSync(pidFile)) return;

  const pid = parseInt(fs.readFileSync(pidFile, 'utf8').split('\n')[0], 10);
  if (pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
      console.log(`Removed orphan PostgreSQL process ${pid}.`);
      await sleep(2000);
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

async function canConnect(url) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1000 });
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

async function main() {
  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`;
  let pgInstance = null;

  const running = await canConnect(url);
  if (!running) {
    await clearStaleServer();
    console.log(`Starting embedded PostgreSQL on port ${PORT}...`);
    pgInstance = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      port: PORT,
      user: USER,
      password: PASSWORD,
      persistent: true,
    });

    try {
      await pgInstance.initialise();
    } catch {
      // already initialised
    }

    await pgInstance.start();

    try {
      await pgInstance.createDatabase(DB);
    } catch {
      // already exists
    }
    console.log('Embedded test PostgreSQL is ready.');
  } else {
    console.log(`PostgreSQL already active on port ${PORT}.`);
  }

  // Run migrations using tsx
  console.log('Running test database migrations via tsx...');
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execSync(`${npxCmd} tsx src/scripts/migrate.ts`, {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: url,
    },
    stdio: 'inherit',
  });
  console.log('Migrations complete.');

  // Run vitest
  const args = process.argv.slice(2);
  const vitestArgs = ['vitest', 'run', ...args];

  const env = {
    ...process.env,
    TEST_DATABASE_URL: url,
    DATABASE_URL: url,
  };

  const child = spawn(npxCmd, vitestArgs, {
    stdio: 'inherit',
    env,
    shell: true,
    cwd: path.resolve(__dirname, '..'),
  });

  child.on('exit', async (code) => {
    if (pgInstance) {
      console.log('Stopping test database...');
      try {
        await pgInstance.stop();
      } catch (e) {
        console.error('Error stopping test PG:', e);
      }
      // Windows needs a moment to release the shared-memory segment after a
      // forced shutdown; exiting immediately can make the next run fail.
      await sleep(1500);
    }
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('Failed to run test suite with embedded postgres:', err);
  process.exit(1);
});
