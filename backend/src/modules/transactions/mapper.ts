import type { TransactionsTable } from '../../db/schema.js';
import { formatMoney } from '../../lib/money.js';
import type { TransactionDto } from './schemas.js';

export function toTransactionDto(row: TransactionsTable | any): TransactionDto {
  return {
    id: row.id,
    account_id: row.account_id,
    transfer_id: row.transfer_id ?? null,
    type: row.type,
    amount: formatMoney(row.amount),
    balance_after: formatMoney(row.balance_after),
    reference_id: row.reference_id,
    description: row.description ?? null,
    created_at: new Date(row.created_at).toISOString(),
  };
}
