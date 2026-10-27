import type { TransfersTable } from '../../db/schema.js';
import { formatMoney } from '../../lib/money.js';
import type { TransferDto } from './schemas.js';

export function toTransferDto(row: TransfersTable | any): TransferDto {
  return {
    id: row.id,
    reference_id: row.reference_id,
    from_account_id: row.from_account_id,
    to_account_id: row.to_account_id,
    amount: formatMoney(row.amount),
    created_at: new Date(row.created_at).toISOString(),
  };
}
