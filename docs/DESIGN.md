# Architectural Design Document: Financial Ledger System

## 1. Domain Model & Invariants

```
                      +-------------------+
                      |     ACCOUNTS      |
                      +-------------------+
                      | id (UUID, PK)     |
                      | name (TEXT)       |
                      | balance (NUMERIC) |
                      | created_at        |
                      | updated_at        |
                      +---------+---------+
                                |
         +----------------------+----------------------+
         | 1:N (ON DELETE RESTRICT)                    | 1:N (ON DELETE RESTRICT)
         v                                             v
+-------------------+                         +-------------------+
|   TRANSACTIONS    |                         |     TRANSFERS     |
+-------------------+                         +-------------------+
| id (UUID, PK)     |                         | id (UUID, PK)     |
| account_id (FK)   |                         | reference_id (UQ) |
| transfer_id (FK)  | >-----------------------| from_acc_id (FK)  |
| type (debit/cred) |                         | to_acc_id (FK)    |
| amount (NUMERIC)  |                         | amount (NUMERIC)  |
| balance_after     |                         | created_at        |
| reference_id      |                         +-------------------+
| created_at        |
+-------------------+
```

### Core Invariants:
1. **Conservation of Value**: In every transfer of amount $X$:
   $$\Delta \text{Balance}_{A} = -X, \quad \Delta \text{Balance}_{B} = +X, \quad \Delta \text{Total} = 0$$
2. **Account Balance Integrity**:
   $$\forall \text{account } A, \quad \text{balance}_A \ge 0$$
   Enforced at DB level via `CHECK (balance >= 0)`.
3. **Double-Entry Reconciliation Invariant**:
   $$\text{Current Balance} \equiv \sum_{t \in \text{Credits}} t.\text{amount} - \sum_{t \in \text{Debits}} t.\text{amount}$$
   Preserved from creation by inserting an opening credit record whenever `initial_balance > 0`.
4. **Append-Only Immutability**:
   `UPDATE` or `DELETE` statements on `transactions` or `transfers` are rejected via PL/pgSQL triggers (`forbid_ledger_mutation()`).

---

## 2. Concurrency & Deadlock-Free Transfer Protocol

### The Deadlock Hazard in Bidirectional Transfers
Consider concurrent transfers:
- Tx 1: $A \to B$
- Tx 2: $B \to A$

If Tx 1 locks $A$ and waits for $B$, while Tx 2 locks $B$ and waits for $A$, a classic circular wait deadlock occurs (`40P01`).

### The Mathematical Solution: Deterministic Ascending Lock Ordering
To guarantee a cycle-free wait-for graph:
1. Compare `from_account_id` and `to_account_id` lexicographically.
2. Let $\text{firstId} = \min(\text{from}, \text{to})$ and $\text{secondId} = \max(\text{from}, \text{to})$.
3. Always issue:
   ```ts
   await trx.selectFrom('accounts').where('id', '=', firstId).forNoKeyUpdate().execute();
   await trx.selectFrom('accounts').where('id', '=', secondId).forNoKeyUpdate().execute();
   ```
4. Because all transactions acquire locks in identical global order, circular wait is mathematically impossible.

### Why `FOR NO KEY UPDATE` Instead of `FOR UPDATE`
In PostgreSQL:
- An update to non-primary-key columns (e.g. `balance`) takes `FOR NO KEY UPDATE`.
- Foreign key checks on referenced tables take `FOR KEY SHARE`.
- `FOR NO KEY UPDATE` and `FOR KEY SHARE` are **compatible**.
- Using `FOR NO KEY UPDATE` prevents spurious lock contention with concurrent inserts in referencing tables while maintaining absolute exclusivity on balance mutations.

---

## 3. Money Representation & IEEE-754 Hazards

Binary floating-point numbers cannot accurately represent base-10 decimals (e.g. $0.1 + 0.2 = 0.30000000000000004$).

- **In the database**: PostgreSQL `NUMERIC(19,4)` stores exact BCD representations up to 15 integer digits and 4 decimal places.
- **In application memory**: `decimal.js` handles arbitrary-precision decimal arithmetic.
- **At API boundary**: Amounts are serialized as canonical decimal strings (`"100.5000"`).
- **In frontend UI**: Display formatting uses string splitting and regex insertion of commas; zero numeric casting.

---

## 4. Idempotency Matrix

| Entity | Constraint | Scope | Behavior on Retry |
|---|---|---|---|
| Transfer | `UNIQUE (reference_id)` | Global | Returns `409 DUPLICATE_REFERENCE`. |
| Transaction | `UNIQUE (account_id, reference_id)` | Account-scoped | Returns `409 DUPLICATE_REFERENCE` for the same account; allowed across distinct accounts. |
| Account Creation | Unique UUID PK | Global | Generated server-side; client gets immutable UUID. |
