import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestApp, type TestContext } from '../helpers/test-app.js';

describe('Database Integrity & Trigger Guarantees', () => {
  let ctx: TestContext;
  let accountId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.pool.end();
  });

  beforeEach(async () => {
    await clearDatabase(ctx.pool);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Audit Account', initial_balance: '100.00' },
    });
    accountId = res.json().data.id;
  });

  it('rejects direct SQL balance updates that would make balance negative (CHECK constraint)', async () => {
    await expect(
      ctx.pool.query('UPDATE accounts SET balance = -10 WHERE id = $1', [accountId]),
    ).rejects.toThrow();
  });

  it('prohibits UPDATE on transactions table via append-only trigger', async () => {
    await expect(
      ctx.pool.query('UPDATE transactions SET amount = 500 WHERE account_id = $1', [accountId]),
    ).rejects.toThrow(/append-only/);
  });

  it('prohibits DELETE on transactions table via append-only trigger', async () => {
    await expect(
      ctx.pool.query('DELETE FROM transactions WHERE account_id = $1', [accountId]),
    ).rejects.toThrow(/append-only/);
  });

  it('reconstructs exact account balance from ledger replay: SUM(credits) - SUM(debits) === balance', async () => {
    // Perform multiple operations
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: { account_id: accountId, type: 'credit', amount: '250.75', reference_id: 'rep-1' },
    });
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: { account_id: accountId, type: 'debit', amount: '45.25', reference_id: 'rep-2' },
    });
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: { account_id: accountId, type: 'credit', amount: '12.00', reference_id: 'rep-3' },
    });

    const accRes = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${accountId}` });
    const currentBalance = accRes.json().data.balance; // 100 + 250.75 - 45.25 + 12 = 317.5000

    const sumRes = await ctx.pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS reconstructed_balance
       FROM transactions
       WHERE account_id = $1`,
      [accountId],
    );

    const reconstructed = Number(sumRes.rows[0].reconstructed_balance).toFixed(4);
    expect(reconstructed).toBe(currentBalance);
    expect(currentBalance).toBe('317.5000');
  });
});
