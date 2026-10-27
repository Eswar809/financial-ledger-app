import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestApp, type TestContext } from '../helpers/test-app.js';

describe('Accounts API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.pool.end();
  });

  beforeEach(async () => {
    await clearDatabase(ctx.pool);
  });

  it('creates an account with zero balance when initial_balance is omitted', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Alice' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Alice');
    expect(body.data.balance).toBe('0.0000');
    expect(body.data.id).toBeDefined();

    // Verify no ledger transactions were written for 0 balance
    const txCount = await ctx.pool.query('SELECT count(*) FROM transactions WHERE account_id = $1', [
      body.data.id,
    ]);
    expect(Number(txCount.rows[0].count)).toBe(0);
  });

  it('creates an account with opening balance and writes an opening ledger row', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Bob', initial_balance: '100.50' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.balance).toBe('100.5000');

    // Invariant check: exactly one credit transaction with balance_after matching
    const txRes = await ctx.pool.query('SELECT * FROM transactions WHERE account_id = $1', [
      body.data.id,
    ]);
    expect(txRes.rows.length).toBe(1);
    const tx = txRes.rows[0];
    expect(tx.type).toBe('credit');
    expect(tx.amount).toBe('100.5000');
    expect(tx.balance_after).toBe('100.5000');
    expect(tx.reference_id).toBe(`opening:${body.data.id}`);
  });

  it('rejects empty or whitespace-only name', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: '   ' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects negative initial balance', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: { name: 'Charlie', initial_balance: '-50' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('returns 404 for non-existent and malformed UUIDs', async () => {
    const resMalformed = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/accounts/not-a-uuid',
    });
    expect(resMalformed.statusCode).toBe(404);
    expect(resMalformed.json().error.code).toBe('ACCOUNT_NOT_FOUND');

    const resUnknown = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/accounts/00000000-0000-0000-0000-000000000000',
    });
    expect(resUnknown.statusCode).toBe(404);
  });
});
