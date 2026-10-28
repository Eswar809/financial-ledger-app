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

  it('returns transactions latest-first by created_at', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/accounts/${accountId}/transactions?limit=100`,
    });

    expect(res.statusCode).toBe(200);
    const timestamps = res.json().data.map((tx: any) => new Date(tx.created_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it('paginates the accounts list with accurate meta', async () => {
    for (let i = 0; i < 4; i++) {
      await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        payload: { name: `Paged Account ${i}` },
      });
    }

    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/accounts?page=2&limit=2' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(2);
    expect(body.meta).toEqual({ total: 5, page: 2, limit: 2, total_pages: 3 });
  });

  it('rejects invalid pagination parameters with 400 VALIDATION_ERROR', async () => {
    const urls = [
      `/api/v1/accounts/${accountId}/transactions?page=0`,
      `/api/v1/accounts/${accountId}/transactions?page=abc`,
      `/api/v1/accounts/${accountId}/transactions?limit=0`,
      `/api/v1/accounts/${accountId}/transactions?limit=101`,
      '/api/v1/accounts?page=0',
      '/api/v1/accounts?limit=101',
      '/api/v1/transactions?page=0',
      '/api/v1/transactions?limit=101',
    ];

    for (const url of urls) {
      const res = await ctx.app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(400);
      expect(res.json().error.code, url).toBe('VALIDATION_ERROR');
    }
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
