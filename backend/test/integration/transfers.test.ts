import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestApp, type TestContext } from '../helpers/test-app.js';

describe('Transfers API', () => {
  let ctx: TestContext;
  let accAId: string;
  let accBId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.pool.end();
  });

  beforeEach(async () => {
    await clearDatabase(ctx.pool);

    const resA = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Alice', initial_balance: '500.00' },
    });
    accAId = resA.json().data.id;

    const resB = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Bob', initial_balance: '200.00' },
    });
    accBId = resB.json().data.id;
  });

  it('transfers money atomically between two accounts with dual ledger entries', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transfers',
      payload: {
        from_account_id: accAId,
        to_account_id: accBId,
        amount: '150.00',
        reference_id: 'transfer-test-1',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.from_account.balance).toBe('350.0000');
    expect(body.data.to_account.balance).toBe('350.0000');
    expect(body.data.transactions.length).toBe(2);

    const [debitTx, creditTx] = body.data.transactions;
    expect(debitTx.account_id).toBe(accAId);
    expect(debitTx.type).toBe('debit');
    expect(debitTx.amount).toBe('150.0000');
    expect(debitTx.balance_after).toBe('350.0000');
    expect(debitTx.reference_id).toBe('transfer-test-1:debit');

    expect(creditTx.account_id).toBe(accBId);
    expect(creditTx.type).toBe('credit');
    expect(creditTx.amount).toBe('150.0000');
    expect(creditTx.balance_after).toBe('350.0000');
    expect(creditTx.reference_id).toBe('transfer-test-1:credit');
  });

  it('rejects self-transfer with 422 SELF_TRANSFER_NOT_ALLOWED before any locks', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transfers',
      payload: {
        from_account_id: accAId,
        to_account_id: accAId,
        amount: '50.00',
        reference_id: 'self-transfer-1',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('SELF_TRANSFER_NOT_ALLOWED');
  });

  it('rejects transfer with insufficient funds and rolls back completely', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transfers',
      payload: {
        from_account_id: accAId,
        to_account_id: accBId,
        amount: '9999.00',
        reference_id: 'transfer-insufficient-1',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('INSUFFICIENT_BALANCE');

    // Both balances unchanged
    const accA = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${accAId}` });
    const accB = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${accBId}` });
    expect(accA.json().data.balance).toBe('500.0000');
    expect(accB.json().data.balance).toBe('200.0000');

    // Zero transfer records created
    const transfersCount = await ctx.pool.query('SELECT count(*) FROM transfers');
    expect(Number(transfersCount.rows[0].count)).toBe(0);
  });

  it('enforces idempotency on duplicate reference_id with 409 DUPLICATE_REFERENCE', async () => {
    // First transfer succeeds
    const res1 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transfers',
      payload: {
        from_account_id: accAId,
        to_account_id: accBId,
        amount: '100.00',
        reference_id: 'dup-transfer-ref',
      },
    });
    expect(res1.statusCode).toBe(201);

    // Duplicate transfer fails with 409
    const res2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/transfers',
      payload: {
        from_account_id: accAId,
        to_account_id: accBId,
        amount: '100.00',
        reference_id: 'dup-transfer-ref',
      },
    });
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error.code).toBe('DUPLICATE_REFERENCE');

    // Balance deducted only once
    const accA = await ctx.app.inject({ method: 'GET', url: `/api/v1/accounts/${accAId}` });
    expect(accA.json().data.balance).toBe('400.0000');
  });
});
