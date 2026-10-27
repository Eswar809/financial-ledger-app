import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Enable gen_random_uuid
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

  // 2. accounts table
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      balance NUMERIC(19,4) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT accounts_name_not_blank CHECK (btrim(name) <> ''),
      CONSTRAINT accounts_name_length CHECK (char_length(btrim(name)) <= 120),
      CONSTRAINT accounts_balance_non_negative CHECK (balance >= 0)
    )
  `.execute(db);

  // 3. transfers table
  await sql`
    CREATE TABLE IF NOT EXISTS transfers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_id TEXT NOT NULL,
      from_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      to_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      amount NUMERIC(19,4) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT transfers_reference_unique UNIQUE (reference_id),
      CONSTRAINT transfers_reference_length CHECK (char_length(reference_id) BETWEEN 1 AND 128),
      CONSTRAINT transfers_amount_positive CHECK (amount > 0),
      CONSTRAINT transfers_distinct_accounts CHECK (from_account_id <> to_account_id)
    )
  `.execute(db);

  // 4. transactions table (append-only ledger)
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      transfer_id UUID REFERENCES transfers(id) ON DELETE RESTRICT,
      type TEXT NOT NULL,
      amount NUMERIC(19,4) NOT NULL,
      balance_after NUMERIC(19,4) NOT NULL,
      reference_id TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT transactions_type_valid CHECK (type IN ('credit', 'debit')),
      CONSTRAINT transactions_amount_positive CHECK (amount > 0),
      CONSTRAINT transactions_balance_after_non_negative CHECK (balance_after >= 0),
      CONSTRAINT transactions_account_reference_unique UNIQUE (account_id, reference_id),
      CONSTRAINT transactions_reference_length CHECK (char_length(reference_id) BETWEEN 1 AND 128),
      CONSTRAINT transactions_description_length CHECK (description IS NULL OR char_length(description) <= 500)
    )
  `.execute(db);

  // 5. Indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounts_created_at
      ON accounts (created_at DESC, id DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_account_created_at
      ON transactions (account_id, created_at DESC, id DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at
      ON transactions (created_at DESC, id DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_transfers_created_at
      ON transfers (created_at DESC, id DESC)
  `.execute(db);

  // 6. Triggers: accounts.updated_at
  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
    CREATE TRIGGER trg_accounts_updated_at
      BEFORE UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  `.execute(db);

  // 7. Append-only ledger protection trigger on transactions & transfers
  await sql`
    CREATE OR REPLACE FUNCTION forbid_ledger_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Table % is an append-only ledger; UPDATE and DELETE are prohibited', TG_TABLE_NAME
        USING ERRCODE = 'P0001';
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS trg_transactions_append_only ON transactions;
    CREATE TRIGGER trg_transactions_append_only
      BEFORE UPDATE OR DELETE ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION forbid_ledger_mutation();
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS trg_transfers_append_only ON transfers;
    CREATE TRIGGER trg_transfers_append_only
      BEFORE UPDATE OR DELETE ON transfers
      FOR EACH ROW
      EXECUTE FUNCTION forbid_ledger_mutation();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_transfers_append_only ON transfers`.execute(db);
  await sql`DROP TRIGGER IF EXISTS trg_transactions_append_only ON transactions`.execute(db);
  await sql`DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts`.execute(db);
  await sql`DROP FUNCTION IF EXISTS forbid_ledger_mutation()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS set_updated_at()`.execute(db);
  await sql`DROP TABLE IF EXISTS transactions`.execute(db);
  await sql`DROP TABLE IF EXISTS transfers`.execute(db);
  await sql`DROP TABLE IF EXISTS accounts`.execute(db);
}
