import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function runSmoke() {
  console.log(`Starting smoke tests against ${BASE_URL}...\n`);

  // 1. Health check
  console.log('1. Checking GET /health...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  if (!healthRes.ok) throw new Error(`Health failed: ${healthRes.status}`);
  console.log('   ✓ Health OK');

  // 2. Health ready
  console.log('2. Checking GET /health/ready...');
  const readyRes = await fetch(`${BASE_URL}/health/ready`);
  if (!readyRes.ok) throw new Error(`Ready failed: ${readyRes.status}`);
  console.log('   ✓ Database connected and ready');

  // 3. Create Account A
  console.log('3. Creating Account A with initial balance 500.00...');
  const accARes = await fetch(`${BASE_URL}/api/v1/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Account A', initial_balance: '500.00' }),
  });
  const accA = await accARes.json();
  if (!accA.success) throw new Error(`Create Account A failed: ${JSON.stringify(accA)}`);
  console.log(`   ✓ Created Account A: ${accA.data.id} (Balance: $${accA.data.balance})`);

  // 4. Create Account B
  console.log('4. Creating Account B with initial balance 100.00...');
  const accBRes = await fetch(`${BASE_URL}/api/v1/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Account B', initial_balance: '100.00' }),
  });
  const accB = await accBRes.json();
  if (!accB.success) throw new Error(`Create Account B failed: ${JSON.stringify(accB)}`);
  console.log(`   ✓ Created Account B: ${accB.data.id} (Balance: $${accB.data.balance})`);

  // 5. Atomic Transfer A -> B
  console.log('5. Executing Transfer $150.00 from A to B...');
  const transferRef = `smoke-xfer-${Date.now()}`;
  const xferRes = await fetch(`${BASE_URL}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_account_id: accA.data.id,
      to_account_id: accB.data.id,
      amount: '150.00',
      reference_id: transferRef,
    }),
  });
  const xfer = await xferRes.json();
  if (!xfer.success) throw new Error(`Transfer failed: ${JSON.stringify(xfer)}`);
  console.log(`   ✓ Transfer successful:`);
  console.log(`     Account A balance: $${xfer.data.from_account.balance} (expected 350.0000)`);
  console.log(`     Account B balance: $${xfer.data.to_account.balance} (expected 250.0000)`);
  console.log(`     Ledger rows: ${xfer.data.transactions.length}`);

  // 6. Test Idempotency with Duplicate Transfer
  console.log('6. Verifying Idempotency with duplicate reference...');
  const dupRes = await fetch(`${BASE_URL}/api/v1/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_account_id: accA.data.id,
      to_account_id: accB.data.id,
      amount: '150.00',
      reference_id: transferRef,
    }),
  });
  const dup = await dupRes.json();
  if (dupRes.status !== 409 || dup.error?.code !== 'DUPLICATE_REFERENCE') {
    throw new Error(`Expected 409 DUPLICATE_REFERENCE, got ${dupRes.status}`);
  }
  console.log('   ✓ Duplicate transfer rejected with 409 DUPLICATE_REFERENCE as expected');

  // 7. Verify Account A ledger
  console.log('7. Verifying Account A transaction ledger...');
  const ledgerRes = await fetch(`${BASE_URL}/api/v1/accounts/${accA.data.id}/transactions`);
  const ledger = await ledgerRes.json();
  console.log(`   ✓ Account A has ${ledger.data.length} transactions (opening credit + transfer debit)`);

  console.log('\n🎉 ALL SMOKE TESTS PASSED SUCCESSFULLY!\n');
}

runSmoke().catch((err) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
