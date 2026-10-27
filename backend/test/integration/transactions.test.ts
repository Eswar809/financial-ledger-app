import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestApp, type TestContext } from '../helpers/test-app.js';

describe('Transactions API', () => {
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

    // Seed test account with 100.0000 balance
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Test Account', initial_balance: '100.00' },
    });
    accountId = res.json().data.id;
  });

  it('credits an account successfully and updates balance', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: {
        account_id: accountId,
        type: 'credit',
        amount: '50.25',
        reference_id: 'tx-credit-1',
        description: 'Deposit bonus',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.transaction.amount).toBe('50.2500');
    expect(body.data.transaction.balance_after).toBe('150.2500');
    expect(body.data.account.balance).toBe('150.2500');
  });

  it('debits an account successfully when funds are sufficient', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: {
        account_id: accountId,
        type: 'debit',
        amount: '40.00',
        reference_id: 'tx-debit-1',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.transaction.balance_after).toBe('60.0000');
    expect(body.data.account.balance).toBe('60.0000');
  });

  it('rejects debit when balance is insufficient (422 INSUFFICIENT_BALANCE)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: {
        account_id: accountId,
        type: 'debit',
        amount: '999.00',
        reference_id: 'tx-insufficient-1',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('INSUFFICIENT_BALANCE');

    // Balance remains intact
    const acc = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${accountId}` });
    expect(acc.json().data.balance).toBe('100.0000');
  });

  it('rejects duplicate reference ID on the same account (409 DUPLICATE_REFERENCE)', async () => {
    // First debit succeeds
    const res1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: {
        account_id: accountId,
        type: 'debit',
        amount: '10.00',
        reference_id: 'ref-dup-test',
      },
    });
    expect(res1.statusCode).toBe(201);

    // Duplicate debit fails with 409
    const res2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: {
        account_id: accountId,
        type: 'debit',
        amount: '10.00',
        reference_id: 'ref-dup-test',
      },
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error.code).toBe('DUPLICATE_REFERENCE');

    // Balance deducted exactly once
    const acc = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${accountId}` });
    expect(acc.json().data.balance).toBe('90.0000');
  });

  it('allows same reference ID on a different account (account-scoped idempotency per spec)', async () => {
    const acc2Res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Second Account', initial_balance: '50.00' },
    });
    const acc2Id = acc2Res.json().data.id;

    // First account
    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: {
        account_id: accountId,
        type: 'credit',
        amount: '10.00',
        reference_id: 'shared-ref-1',
      },
    });

    // Second account with same ref succeeds
    const res2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      payload: {
        account_id: acc2Id,
        type: 'credit',
        amount: '10.00',
        reference_id: 'shared-ref-1',
      },
    });
    expect(res2.statusCode).toBe(201);
  });
});
