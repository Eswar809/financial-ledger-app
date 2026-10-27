import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestApp, type TestContext } from '../helpers/test-app.js';

describe('Concurrency & Race Condition Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // 40 connection pool to ensure all concurrent requests can acquire connections
    ctx = await createTestApp(40);
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.pool.end();
  });

  beforeEach(async () => {
    await clearDatabase(ctx.pool);
  });

  it('handles 30 concurrent debits from an account with balance 100: exactly 10 succeed, 20 fail with 422, zero negative balance', async () => {
    // 1. Create account with 100.0000 balance
    const accRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Contested Account', initial_balance: '100.00' },
    });
    const accountId = accRes.json().data.id;

    // 2. Fire 30 concurrent debits of 10.0000 each with distinct references
    const promises = Array.from({ length: 30 }, (_, i) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/v1/transactions',
        payload: {
          account_id: accountId,
          type: 'debit',
          amount: '10.00',
          reference_id: `race-debit-${i}`,
        },
      }),
    );

    const results = await Promise.all(promises);

    const succeeded = results.filter((r) => r.statusCode === 201);
    const failedInsufficient = results.filter(
      (r) => r.statusCode === 422 && r.json().error?.code === 'INSUFFICIENT_BALANCE',
    );
    const errors5xx = results.filter((r) => r.statusCode >= 500);

    // Invariants
    expect(succeeded.length).toBe(10);
    expect(failedInsufficient.length).toBe(20);
    expect(errors5xx.length).toBe(0);

    // Final balance must be exactly 0.0000
    const finalAcc = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${accountId}` });
    expect(finalAcc.json().data.balance).toBe('0.0000');

    // DB Check constraint verification: no account with negative balance
    const negCheck = await ctx.pool.query('SELECT count(*) FROM accounts WHERE balance < 0');
    expect(Number(negCheck.rows[0].count)).toBe(0);
  });

  it('prevents deadlocks during 100 concurrent bidirectional transfers between accounts A and B', async () => {
    // 1. Create two accounts with 1000.0000 each
    const resA = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Account A', initial_balance: '1000.00' },
    });
    const resB = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Account B', initial_balance: '1000.00' },
    });
    const idA = resA.json().data.id;
    const idB = resB.json().data.id;

    // 2. Fire 100 concurrent alternating transfers: 50 from A->B, 50 from B->A
    const transfers = Array.from({ length: 100 }, (_, i) => {
      const from = i % 2 === 0 ? idA : idB;
      const to = i % 2 === 0 ? idB : idA;
      return ctx.app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        payload: {
          from_account_id: from,
          to_account_id: to,
          amount: '5.00',
          reference_id: `bidirectional-transfer-${i}`,
        },
      });
    });

    const results = await Promise.all(transfers);

    const succeeded = results.filter((r) => r.statusCode === 201);
    const deadlocks = results.filter((r) => r.statusCode === 500);

    // Zero deadlocks
    expect(deadlocks.length).toBe(0);
    expect(succeeded.length).toBe(100);

    // Total money conservation across the system
    const accA = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${idA}` });
    const accB = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${idB}` });

    expect(accA.json().data.balance).toBe('1000.0000');
    expect(accB.json().data.balance).toBe('1000.0000');

    // 200 total ledger transactions (100 debits, 100 credits) plus 2 opening transactions
    const txTotal = await ctx.pool.query('SELECT count(*) FROM transactions');
    expect(Number(txTotal.rows[0].count)).toBe(202);
  });

  it('handles 20 concurrent identical transfer requests: exactly 1 succeeds, 19 return 409 DUPLICATE_REFERENCE', async () => {
    const resA = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Account A', initial_balance: '1000.00' },
    });
    const resB = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Account B', initial_balance: '500.00' },
    });
    const idA = resA.json().data.id;
    const idB = resB.json().data.id;

    const duplicatePromises = Array.from({ length: 20 }, () =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        payload: {
          from_account_id: idA,
          to_account_id: idB,
          amount: '50.00',
          reference_id: 'same-exact-ref-across-all',
        },
      }),
    );

    const results = await Promise.all(duplicatePromises);

    const succeeded = results.filter((r) => r.statusCode === 201);
    const duplicates = results.filter(
      (r) => r.statusCode === 409 && r.json().error?.code === 'DUPLICATE_REFERENCE',
    );

    expect(succeeded.length).toBe(1);
    expect(duplicates.length).toBe(19);

    // Balance deducted only once
    const accA = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${idA}` });
    const accB = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${idB}` });
    expect(accA.json().data.balance).toBe('950.0000');
    expect(accB.json().data.balance).toBe('550.0000');
  });
});
