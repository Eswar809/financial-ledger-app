import type {
  Account,
  ApiResponse,
  CreateAccountInput,
  CreateTransactionInput,
  CreateTransferInput,
  Transaction,
} from './types.ts';

const BASE_URL = '/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const json: ApiResponse<T> = await res.json();

  if (!res.ok || json.success === false) {
    const errorMsg = json.error?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).code = json.error?.code || 'REQUEST_FAILED';
    (err as any).details = json.error?.details || [];
    (err as any).status = res.status;
    throw err;
  }

  return json;
}

export const api = {
  // Accounts
  getAccounts: async (): Promise<Account[]> => {
    const res = await request<Account[]>('/accounts');
    return res.data;
  },

  getAccount: async (id: string): Promise<Account> => {
    const res = await request<Account>(`/accounts/${id}`);
    return res.data;
  },

  createAccount: async (data: CreateAccountInput): Promise<Account> => {
    const res = await request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  // Transactions
  getTransactions: async (
    params: { page?: number; limit?: number; type?: 'credit' | 'debit'; account_id?: string } = {},
  ) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.type) searchParams.set('type', params.type);
    if (params.account_id) searchParams.set('account_id', params.account_id);

    const qs = searchParams.toString();
    return await request<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`);
  },

  getAccountTransactions: async (
    accountId: string,
    params: { page?: number; limit?: number; type?: 'credit' | 'debit' } = {},
  ) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.type) searchParams.set('type', params.type);

    const qs = searchParams.toString();
    const endpoint = `/accounts/${accountId}/transactions${qs ? `?${qs}` : ''}`;
    return await request<Transaction[]>(endpoint);
  },

  createTransaction: async (data: CreateTransactionInput) => {
    return await request<{ transaction: Transaction; account: Account }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Transfers
  createTransfer: async (data: CreateTransferInput) => {
    return await request<{
      transfer: any;
      from_account: Account;
      to_account: Account;
      transactions: [Transaction, Transaction];
    }>('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
