import type { ColumnType, Generated } from 'kysely';

export interface AccountsTable {
  id: Generated<string>;
  name: string;
  balance: ColumnType<string, string, string>; // numeric(19,4) represented as string
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TransfersTable {
  id: Generated<string>;
  reference_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: ColumnType<string, string, string>;
  created_at: Generated<Date>;
}

export interface TransactionsTable {
  id: Generated<string>;
  account_id: string;
  transfer_id: string | null;
  type: 'credit' | 'debit';
  amount: ColumnType<string, string, string>;
  balance_after: ColumnType<string, string, string>;
  reference_id: string;
  description: string | null;
  created_at: Generated<Date>;
}

export interface Database {
  accounts: AccountsTable;
  transfers: TransfersTable;
  transactions: TransactionsTable;
}
