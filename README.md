# Financial Ledger & Money Transfer System

A production-grade, double-entry financial ledger and money transfer platform engineered to financial institution standards. Implements strict ACID transaction isolation, deadlock-free deterministic row locking, immutable append-only ledger audit triggers, and real-time frontend updates.

---

## 🏛 Architecture & Engineering Guarantees

### 1. Money & Mathematical Precision
- **Zero Floats**: Never uses IEEE-754 binary floating-point arithmetic.
- **Database Storage**: PostgreSQL `NUMERIC(19,4)` guarantees exact representation of monetary amounts without rounding artifacts up to $\pm 10^{15}$.
- **API Boundary**: Accepts strings or finite numbers, canonicalized via `decimal.js` into standard 4-decimal place strings (`"100.5000"`).
- **Frontend Display**: Pure string manipulation with thousand-grouping commas; zero `parseFloat` or numeric conversion.

### 2. ACID Concurrency & Deadlock Prevention
- **Deterministic Lock Ordering**: When transferring money between Account A and Account B, account row locks are **always acquired in lexicographically ascending ID order** (`firstId < secondId`). This breaks cyclical wait conditions and mathematically eliminates deadlocks between concurrent bidirectional transfers ($A \to B$ and $B \to A$).
- **Lock Type**: Uses `FOR NO KEY UPDATE` rather than `FOR UPDATE`. This provides full balance-mutation serialization without conflicting with foreign key checks (`FOR KEY SHARE`).
- **Conditional Writes**: Balance mutations employ atomic conditional SQL:
  ```sql
  UPDATE accounts
  SET balance = balance - :amount
  WHERE id = :accountId AND balance >= :amount
  RETURNING balance;
  ```
- **Transient Conflict Retry**: Database serialization conflicts (`40001`) and deadlock detections (`40P01`) are automatically retried up to 3 times with exponential backoff and randomized jitter via `withRetry()`.

### 3. Double-Entry Invariants & Append-Only Audit Trail
- **Opening Balances**: When an account is created with `initial_balance > 0`, an initial `credit` transaction (`opening:<accountId>`) is written atomically in the same database transaction.
- **Replay Invariant**: For any account at any point in history:
  $$\text{Current Balance} \equiv \sum(\text{Credits}) - \sum(\text{Debits})$$
- **Append-Only Triggers**: PostgreSQL PL/pgSQL row-level triggers reject any `UPDATE` or `DELETE` statement on `transactions` and `transfers` tables with error code `P0001`.
- **Database CHECK Constraints**:
  - `accounts`: `CONSTRAINT accounts_balance_non_negative CHECK (balance >= 0)`
  - `transactions`: `CONSTRAINT transactions_amount_positive CHECK (amount > 0)` and `balance_after >= 0`
  - `transfers`: `CONSTRAINT transfers_distinct_accounts CHECK (from_account_id <> to_account_id)`

### 4. Idempotency & Duplicate Protection
- **Transfers**: Anchored globally by `UNIQUE (reference_id)` on the `transfers` table. Retried transfer requests with identical references return `409 DUPLICATE_REFERENCE` without double-debiting funds.
- **Transactions**: Unique per account via composite `UNIQUE (account_id, reference_id)`.

---

## 🛠 Tech Stack

- **Backend**: Node.js 22, TypeScript 5.9, Fastify 5, Zod 4, fastify-type-provider-zod 7, Kysely 0.29 (query builder & migrator), PostgreSQL driver (`pg`).
- **Database**: PostgreSQL 17 (embedded for zero-dependency local dev/tests, containerized for production).
- **API Documentation**: Auto-generated Swagger UI / OpenAPI 3.1 specification at `/docs` and `/openapi.json`.
- **Frontend**: React 19, Vite 7, Tailwind CSS 4, TanStack Query 5 (with 3-second live polling and immediate mutation invalidation), React Router 7, Sonner toasts, Lucide icons.
- **Testing**: Vitest 5, Supertest/Fastify inject, React Testing Library, jsdom.

---

## 🚀 Getting Started (No Docker Required)

This repository includes a standalone embedded PostgreSQL engine (`embedded-postgres`) that runs natively on your machine without requiring Docker.

### 1. Prerequisites
- **Node.js** >= 22.12
- **npm** >= 10.0

### 2. Install Dependencies
```bash
# Install root, backend, and frontend dependencies
npm run setup
```

### 3. Start Local Development
Start the embedded database, backend API, and Vite frontend concurrently:
```bash
# Terminal 1: Start local embedded PostgreSQL (port 5433)
npm run db:local

# Terminal 2: Run database migrations
npm run db:migrate

# Terminal 3: Start backend & frontend concurrently
npm run dev
```

- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)
- **Interactive Swagger Docs**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Health Check**: [http://localhost:3000/health/ready](http://localhost:3000/health/ready)

---

## 🧪 Running Automated Tests

The test suite runs against an isolated, automated embedded PostgreSQL instance on port 5434:

```bash
# Run all backend tests (concurrency, transfers, transactions, accounts, integrity, openapi, money)
npm test

# Run frontend tests
npm --prefix frontend run test

# Run type checks
npm run typecheck
```

### Concurrency Test Scenarios Verified:
1. **30 Concurrent Debits**: 30 simultaneous debit requests of \$10 against an account with \$100. Exactly 10 succeed, 20 fail with `422 INSUFFICIENT_BALANCE`, final balance is \$0.0000, and zero accounts ever hold negative balance.
2. **100 Concurrent Bidirectional Transfers**: 100 simultaneous transfers alternating between Accounts A and B. Zero deadlocks (`40P01`), zero 500 errors, exact balance conservation across the system.
3. **20 Concurrent Duplicate Transfers**: 20 requests with the same idempotency key executed simultaneously. Exactly 1 succeeds, 19 return `409 DUPLICATE_REFERENCE`, balance deducted only once.
4. **Append-Only Trigger Enforcement**: Direct SQL `UPDATE` and `DELETE` on ledger tables fail with `P0001: append-only ledger`.

---

## 🐳 Production Deployment (Docker Compose)

For production or cloud environments where Docker is preferred:

```bash
docker compose up --build -d
```

- Web UI: [http://localhost:8080](http://localhost:8080)
- API: [http://localhost:3000](http://localhost:3000)
- Swagger: [http://localhost:8080/docs](http://localhost:8080/docs)

*Note: Per environment instructions, Docker was not executed locally on the development machine; the Dockerfile, Nginx configuration, and compose setup were engineered and statically verified against production standards.*

---

## 📡 API Reference Summary

All endpoints return uniform response envelopes:
- **Success**: `{ "success": true, "data": { ... }, "meta": { ... } }`
- **Error**: `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/accounts` | Create account (`{ name, initial_balance? }`) |
| `GET` | `/api/v1/accounts` | List accounts |
| `GET` | `/api/v1/accounts/:id` | Get account details |
| `GET` | `/api/v1/accounts/:id/transactions` | Paginated transactions (`page`, `limit`, `type`) |
| `POST` | `/api/v1/transactions` | Execute credit or debit (`{ account_id, type, amount, reference_id }`) |
| `POST` | `/api/v1/transfers` | Atomic transfer (`{ from_account_id, to_account_id, amount, reference_id }`) |
| `GET` | `/health/ready` | Readiness probe (database connection verification) |
| `GET` | `/docs` | OpenAPI Swagger UI |
