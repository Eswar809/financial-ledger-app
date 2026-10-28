import { Kysely, sql } from 'kysely';
import type { Database } from '../../db/schema.js';
import {
  DuplicateReferenceError,
  InsufficientBalanceError,
  NotFoundError,
  SelfTransferError,
} from '../../lib/errors.js';
import { compareMoney } from '../../lib/money.js';
import { withRetry } from '../../lib/retry.js';
import { toAccountDto } from '../accounts/mapper.js';
import type { AccountDto } from '../accounts/schemas.js';
import { toTransactionDto } from '../transactions/mapper.js';
import type { TransactionDto } from '../transactions/schemas.js';
import { toTransferDto } from './mapper.js';
import type { CreateTransferBody, TransferDto } from './schemas.js';

export interface CreateTransferResult {
  transfer: TransferDto;
  from_account: AccountDto;
  to_account: AccountDto;
  transactions: [TransactionDto, TransactionDto];
}

export class TransfersService {
  constructor(private readonly db: Kysely<Database>) {}

  async createTransfer(data: CreateTransferBody): Promise<CreateTransferResult> {
    // 1. Domain validation: prevent self-transfer before transaction
    if (data.from_account_id === data.to_account_id) {
      throw new SelfTransferError('Cannot transfer money to the same account');
    }

    return await withRetry(async () => {
      return await this.db.transaction().execute(async (trx) => {
        // 2. Deterministic Deadlock-free locking:
        // Always lock both accounts in lexicographical (ascending) ID order.
        const [firstId, secondId] =
          data.from_account_id < data.to_account_id
            ? [data.from_account_id, data.to_account_id]
            : [data.to_account_id, data.from_account_id];

        const firstAcc = await trx
          .selectFrom('accounts')
          .selectAll()
          .where('id', '=', firstId)
          .forNoKeyUpdate()
          .executeTakeFirst();

        const secondAcc = await trx
          .selectFrom('accounts')
          .selectAll()
          .where('id', '=', secondId)
          .forNoKeyUpdate()
          .executeTakeFirst();

        if (!firstAcc || !secondAcc) {
          const missingId = !firstAcc ? firstId : secondId;
          throw new NotFoundError(`Account ${missingId} not found`);
        }

        const fromAcc = data.from_account_id === firstAcc.id ? firstAcc : secondAcc;

        // 3. Pre-check / insert transfer row as the global idempotency anchor
        // ON CONFLICT (reference_id) DO NOTHING ensures we don't abort the pg transaction immediately
        const transferInsert = await trx
          .insertInto('transfers')
          .values({
            reference_id: data.reference_id,
            from_account_id: data.from_account_id,
            to_account_id: data.to_account_id,
            amount: data.amount,
          })
          .onConflict((oc) => oc.column('reference_id').doNothing())
          .returningAll()
          .executeTakeFirst();

        if (!transferInsert) {
          throw new DuplicateReferenceError(
            `Transfer with reference ${data.reference_id} already exists`,
          );
        }

        // 4. Verify balance on source account
        if (compareMoney(fromAcc.balance, data.amount) < 0) {
          throw new InsufficientBalanceError(
            `Insufficient balance (${fromAcc.balance}) in source account for transfer of ${data.amount}`,
          );
        }

        // 5. Atomic conditional debit from source account
        const updatedFrom = await trx
          .updateTable('accounts')
          .set({
            balance: sql`balance - ${data.amount}::numeric`,
          })
          .where('id', '=', data.from_account_id)
          .where(sql<boolean>`balance >= ${data.amount}::numeric`)
          .returningAll()
          .executeTakeFirst();

        if (!updatedFrom) {
          throw new InsufficientBalanceError(
            `Insufficient balance in source account for transfer of ${data.amount}`,
          );
        }

        // 6. Atomic credit to destination account
        const updatedTo = await trx
          .updateTable('accounts')
          .set({
            balance: sql`balance + ${data.amount}::numeric`,
          })
          .where('id', '=', data.to_account_id)
          .returningAll()
          .executeTakeFirstOrThrow();

        // 7. Write the two linked ledger transaction entries
        const debitTx = await trx
          .insertInto('transactions')
          .values({
            account_id: data.from_account_id,
            transfer_id: transferInsert.id,
            type: 'debit',
            amount: data.amount,
            balance_after: updatedFrom.balance,
            reference_id: `${data.reference_id}:debit`,
            description: `Transfer to account ${data.to_account_id}`,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const creditTx = await trx
          .insertInto('transactions')
          .values({
            account_id: data.to_account_id,
            transfer_id: transferInsert.id,
            type: 'credit',
            amount: data.amount,
            balance_after: updatedTo.balance,
            reference_id: `${data.reference_id}:credit`,
            description: `Transfer from account ${data.from_account_id}`,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return {
          transfer: toTransferDto(transferInsert),
          from_account: toAccountDto(updatedFrom),
          to_account: toAccountDto(updatedTo),
          transactions: [toTransactionDto(debitTx), toTransactionDto(creditTx)],
        };
      });
    });
  }
}
