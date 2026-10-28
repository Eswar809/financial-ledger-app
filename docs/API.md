# API Documentation

Base URL: `http://localhost:3000/api/v1`

Interactive OpenAPI 3.1 documentation is also available at [`/docs`](http://localhost:3000/docs) (Swagger UI); the raw specification is at [`/openapi.json`](http://localhost:3000/openapi.json).

---

## Conventions

- Request and response bodies are JSON (`Content-Type: application/json`).
- Monetary values are **decimal strings with exactly 4 decimal places** (e.g. `"100.5000"`). Requests may send a string or a finite number; responses always use canonical strings. Maximum magnitude: `999999999999999.9999`.
- Timestamps are ISO-8601 UTC strings.
- List endpoints are paginated with `page` (default `1`, minimum `1`) and `limit` (default `20`, minimum `1`, maximum `100`). Invalid values return `400 VALIDATION_ERROR`.
- Transactions are always returned **latest-first**, ordered by `created_at DESC`, with `id DESC` as a deterministic tie-breaker.

### Success envelope

```json
{ "success": true, "data": { } }
```

Paginated responses additionally include:

```json
{
  "success": true,
  "data": [],
  "meta": { "total": 42, "page": 1, "limit": 20, "total_pages": 3 }
}
```

`total_pages` is `0` when there are no records.

### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "body/amount Transaction amount must be strictly positive",
    "details": [{ "path": "/amount", "message": "Transaction amount must be strictly positive" }]
  }
}
```

### Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid body, query, or path parameters |
| 400 | `INVALID_JSON` | Malformed JSON request body |
| 404 | `ACCOUNT_NOT_FOUND` | Account does not exist (or malformed UUID on lookup) |
| 404 | `ROUTE_NOT_FOUND` | Unknown endpoint |
| 409 | `DUPLICATE_REFERENCE` | `reference_id` already used (per account for transactions, global for transfers) |
| 422 | `INSUFFICIENT_BALANCE` | Debit/transfer exceeds the available balance |
| 422 | `SELF_TRANSFER_NOT_ALLOWED` | Transfer source and destination are the same account |
| 422 | `AMOUNT_OUT_OF_RANGE` | Amount exceeds the supported numeric range |
| 503 | `CONCURRENCY_CONFLICT` | Database serialization/deadlock retries exhausted; safe to retry |
| 503 | `SERVICE_BUSY` | Lock or query timeout; safe to retry |
| 500 | `INTERNAL_ERROR` | Unexpected server error (no partial writes) |

---

## Accounts

### `POST /accounts`

Creates an account. If `initial_balance` is greater than zero, an opening `credit` transaction is written in the same database transaction.

Request:

```json
{ "name": "Alice", "initial_balance": "100.00" }
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | string | yes | Trimmed, 1–120 characters |
| `initial_balance` | string \| number | no | ≥ 0, at most 4 decimal places; defaults to `"0"` |

Response `201 Created`:

```json
{
  "success": true,
  "data": {
    "id": "0f0b6f1e-4a6d-4a0e-9a43-1a2b3c4d5e6f",
    "name": "Alice",
    "balance": "100.0000",
    "created_at": "2026-10-28T10:00:00.000Z",
    "updated_at": "2026-10-28T10:00:00.000Z"
  }
}
```

Errors: `400 VALIDATION_ERROR`.

### `GET /accounts?page=1&limit=20`

Returns a paginated account list, newest first, with `meta: { total, page, limit, total_pages }`.

### `GET /accounts/:id`

Returns one account. A malformed or unknown UUID returns `404 ACCOUNT_NOT_FOUND`.

### `GET /accounts/:id/transactions?type=debit&page=1&limit=20`

Returns the account's ledger entries, latest-first, with pagination meta.

| Query | Type | Required | Rules |
|---|---|---|---|
| `page` | integer | no | ≥ 1, default `1` |
| `limit` | integer | no | 1–100, default `20` |
| `type` | string | no | `credit` or `debit` |

Errors: `400 VALIDATION_ERROR`, `404 ACCOUNT_NOT_FOUND`.

---

## Transactions

Transactions are append-only. There is **no** `PUT`, `PATCH`, or `DELETE` endpoint, and database triggers reject direct `UPDATE`/`DELETE` at the storage layer.

### `POST /transactions`

Creates a credit or debit and updates the account balance atomically. A failed request leaves both the ledger and the balance unchanged.

Request:

```json
{
  "account_id": "0f0b6f1e-4a6d-4a0e-9a43-1a2b3c4d5e6f",
  "type": "debit",
  "amount": "25.50",
  "reference_id": "INV-2026-0001",
  "description": "Invoice payment"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `account_id` | UUID | yes | Must exist |
| `type` | string | yes | `credit` or `debit` |
| `amount` | string \| number | yes | Strictly > 0, at most 4 decimal places |
| `reference_id` | string | yes | 1–120 chars, `[A-Za-z0-9._-]`, unique per account |
| `description` | string | no | Up to 500 chars |

Response `201 Created`:

```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "6a9c1b3e-7c1d-4f9a-8b2e-2f5d6c7b8a90",
      "account_id": "0f0b6f1e-4a6d-4a0e-9a43-1a2b3c4d5e6f",
      "transfer_id": null,
      "type": "debit",
      "amount": "25.5000",
      "balance_after": "74.5000",
      "reference_id": "INV-2026-0001",
      "description": "Invoice payment",
      "created_at": "2026-10-28T10:05:00.000Z"
    },
    "account": {
      "id": "0f0b6f1e-4a6d-4a0e-9a43-1a2b3c4d5e6f",
      "name": "Alice",
      "balance": "74.5000",
      "created_at": "2026-10-28T10:00:00.000Z",
      "updated_at": "2026-10-28T10:05:00.000Z"
    }
  }
}
```

Errors: `400 VALIDATION_ERROR`, `404 ACCOUNT_NOT_FOUND`, `409 DUPLICATE_REFERENCE`, `422 INSUFFICIENT_BALANCE`, `422 AMOUNT_OUT_OF_RANGE`.

### `GET /transactions?account_id=...&type=...&page=1&limit=20`

Returns a paginated, latest-first list of ledger entries across accounts.

| Query | Type | Required | Rules |
|---|---|---|---|
| `account_id` | UUID | no | Filter by account; a malformed UUID returns `404 ACCOUNT_NOT_FOUND` |
| `type` | string | no | `credit` or `debit` |
| `page` | integer | no | ≥ 1, default `1` |
| `limit` | integer | no | 1–100, default `20` |

---

## Transfers (bonus)

### `POST /transfers`

Atomically debits the source account, credits the destination account, records one `transfers` row, and writes the two linked ledger entries. If any step fails, the entire operation rolls back — a partial transfer is never possible.

Request:

```json
{
  "from_account_id": "aaaa1111-1111-4111-8111-111111111111",
  "to_account_id": "bbbb2222-2222-4222-8222-222222222222",
  "amount": "30.00",
  "reference_id": "TRF-2026-0001"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `from_account_id` | UUID | yes | Must exist, sufficient balance |
| `to_account_id` | UUID | yes | Must exist, different from source |
| `amount` | string \| number | yes | Strictly > 0, at most 4 decimal places |
| `reference_id` | string | yes | 1–120 chars, `[A-Za-z0-9._-]`, globally unique |

Response `201 Created`:

```json
{
  "success": true,
  "data": {
    "transfer": {
      "id": "cccc3333-3333-4333-8333-333333333333",
      "reference_id": "TRF-2026-0001",
      "from_account_id": "aaaa1111-1111-4111-8111-111111111111",
      "to_account_id": "bbbb2222-2222-4222-8222-222222222222",
      "amount": "30.0000",
      "created_at": "2026-10-28T10:10:00.000Z"
    },
    "from_account": { "...": "account snapshot after debit" },
    "to_account": { "...": "account snapshot after credit" },
    "transactions": [
      { "...": "debit entry, reference_id TRF-2026-0001:debit" },
      { "...": "credit entry, reference_id TRF-2026-0001:credit" }
    ]
  }
}
```

Errors: `400 VALIDATION_ERROR`, `404 ACCOUNT_NOT_FOUND`, `409 DUPLICATE_REFERENCE`, `422 INSUFFICIENT_BALANCE`, `422 SELF_TRANSFER_NOT_ALLOWED`.

---

## Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Process liveness (`{ status: "ok", uptime }`) |
| `GET` | `/health/ready` | Readiness + database connectivity; `503` when the database is unreachable |

Health endpoints are served at the server root, not under `/api/v1`.

---

## Data Integrity Guarantees

- **Atomic writes** — every balance mutation and its ledger row(s) commit in one PostgreSQL transaction; any failure rolls back everything.
- **Balance consistency** — for every account, `balance = Σ(credits) − Σ(debits)`. Accounts created with `initial_balance > 0` receive an opening credit (`reference_id = opening:<account_id>`) so the invariant holds from the first row.
- **Immutability** — once created, a transaction's `type`, `amount`, `description`, `reference_id`, `account_id`, and `created_at` cannot change: there are no mutating endpoints, and PL/pgSQL triggers reject `UPDATE`/`DELETE` on `transactions` and `transfers`.
- **Idempotency** — transaction references are unique per account (`UNIQUE (account_id, reference_id)`); transfer references are globally unique (`UNIQUE (reference_id)`). Replays return `409` without moving money twice.
- **Debit safety** — debits use a conditional `UPDATE ... WHERE balance >= amount` plus a `CHECK (balance >= 0)` constraint, so concurrent debits can never overdraw an account.
- **Concurrency** — transfer account locks are acquired in deterministic lexicographic ID order to prevent deadlocks; serialization failures are retried with backoff before returning `503`.
