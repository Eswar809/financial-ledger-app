# Assumptions & Design Decisions

Choices made where the brief left details open. Everything below is implemented in code and covered by tests.

## Money & Precision
- Amounts are stored as PostgreSQL `NUMERIC(19,4)` and handled end-to-end as **strings / `decimal.js` Decimals** — never IEEE-754 floats.
- `decimal.js` is configured with `ROUND_HALF_UP`; the API accepts strings or finite numbers and canonicalizes to 4-decimal strings (`"100.5000"`).
- Maximum supported magnitude is `999999999999999.9999` (15 whole digits + 4 decimals, matching the column). Out-of-range amounts return `422 AMOUNT_OUT_OF_RANGE`.

## Accounts
- An account is created with a required `name` (1–120 chars) and an **optional `initial_balance` ≥ 0** (defaults to 0).
- When an account is created with `initial_balance > 0`, an opening `credit` transaction is written **in the same database transaction**, so the replay invariant (balance = Σcredits − Σdebits) holds from the first row.
- Account deletion is intentionally not exposed: the schema uses `ON DELETE RESTRICT` foreign keys and the ledger is append-only.

## Transactions
- A transaction requires `account_id`, `type` (`credit` | `debit`), `amount > 0`, and a `reference_id`.
- `reference_id` is unique **per account** via `UNIQUE (account_id, reference_id)`. A replayed reference returns `409 DUPLICATE_REFERENCE` and does not double-apply. The same reference string on a *different* account is valid.
- Debits beyond the available balance return `422 INSUFFICIENT_BALANCE`. The guard is implemented twice, by design: an atomic conditional `UPDATE ... WHERE balance >= amount`, and a `CHECK (balance >= 0)` constraint as the last line of defense.
- Each transaction row stores `balance_after` (running balance) for audit readability.

## Transfers (bonus)
- A transfer debits the source and credits the destination **in one database transaction** — the ledger rows, the `transfers` row, and both balance updates commit or roll back together. A partial transfer is not possible.
- Transfer `reference_id` is **globally unique** (on the `transfers` table); a retried transfer with the same reference returns `409` without moving money twice.
- Transferring to the same account is rejected with `422 SELF_TRANSFER_NOT_ALLOWED`.

## Concurrency
- Account rows involved in a write are locked `FOR NO KEY UPDATE` in **deterministic lexicographic ID order**, which eliminates deadlocks between concurrent bidirectional transfers.
- Serialization failures (`40001`) and deadlock aborts (`40P01`) are retried up to 3 times with exponential backoff + jitter; if retries are exhausted the API returns `503 CONCURRENCY_CONFLICT` with no partial state.
- Covered by `test/integration/concurrency.test.ts` (parallel conflicting writes).

## Ledger Immutability
- PostgreSQL triggers reject any `UPDATE`/`DELETE` on `transactions` and `transfers` (`P0001`), making the audit trail append-only at the database level, not just by convention.
- `CHECK` constraints back every domain rule: `balance >= 0`, `amount > 0`, `balance_after >= 0`, `from_account_id <> to_account_id`.

## API Shape
- REST resources under `/api/v1`: `accounts`, `transactions`, `transfers`; response envelope is `{ success, data }` on success and `{ success: false, error: { code, message, details } }` on failure.
- Pagination uses `page` (default 1, min 1) and `limit` (default 20, min 1, max 100). Invalid values return `400` with field-level details. List responses include `meta: { total, page, limit, total_pages }`.
- HTTP status mapping: `400` validation / malformed JSON, `404` not found, `409` duplicate reference, `422` domain-rule violations, `503` concurrency retries exhausted.
- Interactive documentation is generated from the Zod schemas (OpenAPI 3.1) and served at `/docs`; the raw spec is at `/openapi.json`.

## Out of Scope
- Authentication/authorization (the brief did not ask for it).
- Email/notification side effects; the API stays a pure ledger.

## Testing
- 35 backend tests (integration + concurrency + integrity + unit) run against a real PostgreSQL instance via `npm run test:local`; frontend has its own Vitest/React Testing Library suite (`npm test` in `frontend/`).
