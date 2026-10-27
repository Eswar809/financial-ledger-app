import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.ts';
import type { CreateAccountInput, CreateTransactionInput, CreateTransferInput } from './types.ts';

export const QUERY_KEYS = {
  accounts: ['accounts'] as const,
  account: (id: string) => ['accounts', id] as const,
  transactions: (accountId: string, params: object) => ['transactions', accountId, params] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: QUERY_KEYS.accounts,
    queryFn: () => api.getAccounts(),
    refetchInterval: 3000, // Live poll every 3 seconds
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.account(id),
    queryFn: () => api.getAccount(id),
    enabled: Boolean(id),
    refetchInterval: 3000,
  });
}

export function useAccountTransactions(
  accountId: string,
  params: { page?: number; limit?: number; type?: 'credit' | 'debit' } = {},
) {
  return useQuery({
    queryKey: QUERY_KEYS.transactions(accountId, params),
    queryFn: () => api.getAccountTransactions(accountId, params),
    enabled: Boolean(accountId),
    refetchInterval: 3000,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAccountInput) => api.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionInput) => api.createTransaction(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.account(vars.account_id) });
      queryClient.invalidateQueries({ queryKey: ['transactions', vars.account_id] });
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransferInput) => api.createTransfer(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.account(vars.from_account_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.account(vars.to_account_id) });
      queryClient.invalidateQueries({ queryKey: ['transactions', vars.from_account_id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', vars.to_account_id] });
    },
  });
}
