export interface Account {
  id: string;
  name: string;
  balance: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  transfer_id: string | null;
  type: 'credit' | 'debit';
  amount: string;
  balance_after: string;
  reference_id: string;
  description: string | null;
  created_at: string;
}

export interface Transfer {
  id: string;
  reference_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: string;
  created_at: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details: Array<{ path?: string; message: string }>;
  };
}

export interface CreateAccountInput {
  name: string;
  initial_balance?: string;
}

export interface CreateTransactionInput {
  account_id: string;
  type: 'credit' | 'debit';
  amount: string;
  reference_id: string;
  description?: string;
}

export interface CreateTransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: string;
  reference_id: string;
}
