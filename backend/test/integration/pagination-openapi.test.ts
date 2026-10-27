import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createTestApp, type TestContext } from '../helpers/test-app.js';

describe('Pagination & OpenAPI Smoke', () => {
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
      payload: { name: 'Pagination Test Acc', initial_balance: '1000.00' },
    });
    accountId = res.json().data.id;

    // Seed 15 transactions
    for (let i = 1; i <= 15; i++) {
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/transactions',
        payload: {
          account_id: accountId,
          type: i % 2 === 0 ? 'credit' : 'debit',
          amount: '1.00',
          reference_id: `page-ref-${i}`,
        },
      });
    }
  });

  it('paginates transactions with accurate meta headers (page 1, limit 5)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/accounts/${accountId}/transactions?page=1&limit=5`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(5);
    // 15 transactions + 1 opening credit = 16 total
    expect(body.meta.total).toBe(16);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(5);
    expect(body.meta.total_pages).toBe(4);
  });

  it('serves OpenAPI 3.1 specification at /openapi.json', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/openapi.json',
    });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\.1/);
    const paths = Object.keys(spec.paths || {});
    expect(paths.some((p) => p.includes('/api/v1/accounts'))).toBe(true);
    expect(paths.some((p) => p.includes('/api/v1/transactions'))).toBe(true);
    expect(paths.some((p) => p.includes('/api/v1/transfers'))).toBe(true);
  });

  it('serves health readiness endpoint', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/health/ready',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().database).toBe('connected');
  });
});
