import type { AccountsTable } from '../../db/schema.js';
import { formatMoney } from '../../lib/money.js';
import type { AccountDto } from './schemas.js';

export function toAccountDto(row: AccountsTable | any): AccountDto {
  return {
    id: row.id,
    name: row.name,
    balance: formatMoney(row.balance),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}
