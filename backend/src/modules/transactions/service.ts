import { Kysely, sql } from 'kysely';
import type { Database } from '../../db/schema.js';
import {
  DuplicateReferenceError,
  InsufficientBalanceError,
  NotFoundError,
} from '../../lib/errors.js';
import { addMoney, compareMoney, formatMoney, subMoney } from '../../lib/money.js';
import { buildPaginationMeta, type PaginatedResult } from '../../lib/pagination.js';
import { withRetry } from '../../lib/retry.js';
import { toAccountDto } from '../accounts/mapper.js';
import type { AccountDto } from '../accounts/schemas.js';
import { toTransactionDto } from './mapper.js';
import type {
  CreateTransactionBody,
  ListTransactionsQuery,
  TransactionDto,
} from './schemas.js';

export interface CreateTransactionResult {
  transaction: TransactionDto;
  account: AccountDto;
}

export class TransactionsService {
  constructor(private readonly db: Kysely<Database>) {}

  async createTransaction(data: CreateTransactionBody): Promise<CreateTransactionResult> {
    return await withRetry(async () => {
      return await this.db.transaction().execute(async (trx) => {
        // 1. Lock target account row using FOR NO KEY UPDATE
        const account = await trx
          .selectFrom('accounts')
          .selectAll()
          .where('id', '=', data.account_id)
          .forNoKeyUpdate()
          .executeTakeFirst();

        if (!account) {
          throw new NotFoundError(`Account ${data.account_id} not found`);
        }

        // 2. Pre-check for duplicate reference under account lock
        const existingTx = await trx
          .selectFrom('transactions')
          .select('id')
          .where('account_id', '=', data.account_id)
          .where('reference_id', '=', data.reference_id)
          .executeTakeFirst();

        if (existingTx) {
          throw new DuplicateReferenceError(
            `Transaction reference ${data.reference_id} already exists for this account`,
          );
        }

        let newBalance: string;

        if (data.type === 'debit') {
          // Check balance
          if (compareMoney(account.balance, data.amount) < 0) {
            throw new InsufficientBalanceError(
              `Insufficient balance (${account.balance}) for debit of ${data.amount}`,
            );
          }

          // Conditional update
          const updated = await trx
            .updateTable('accounts')
            .set({
              balance: sql`balance - ${data.amount}::numeric`,
            })
            .where('id', '=', data.account_id)
            .where(sql<boolean>`balance >= ${data.amount}::numeric`)
            .returningAll()
            .executeTakeFirst();

          if (!updated) {
            throw new InsufficientBalanceError(
              `Insufficient balance for debit of ${data.amount}`,
            );
          }
          newBalance = updated.balance;
        } else {
          // Credit
          const updated = await trx
            .updateTable('accounts')
            .set({
              balance: sql`balance + ${data.amount}::numeric`,
            })
            .where('id', '=', data.account_id)
            .returningAll()
            .executeTakeFirstOrThrow();

          newBalance = updated.balance;
        }

        // 3. Insert append-only transaction ledger row
        const txRow = await trx
          .insertInto('transactions')
          .values({
            account_id: data.account_id,
            transfer_id: null,
            type: data.type,
            amount: data.amount,
            balance_after: newBalance,
            reference_id: data.reference_id,
            description: data.description ?? null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // 4. Reload account or use updated
        const updatedAccount = await trx
          .selectFrom('accounts')
          .selectAll()
          .where('id', '=', data.account_id)
          .executeTakeFirstOrThrow();

        return {
          transaction: toTransactionDto(txRow),
          account: toAccountDto(updatedAccount),
        };
      });
    });
  }

  async listTransactions(query: ListTransactionsQuery): Promise<PaginatedResult<TransactionDto>> {
    const { page, limit, account_id, type } = query;
    const offset = (page - 1) * limit;

    let countQuery = this.db
      .selectFrom('transactions')
      .select((eb) => eb.fn.count<string>('id').as('total'));

    let dataQuery = this.db
      .selectFrom('transactions')
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset);

    if (account_id) {
      countQuery = countQuery.where('account_id', '=', account_id);
      dataQuery = dataQuery.where('account_id', '=', account_id);
    }

    if (type) {
      countQuery = countQuery.where('type', '=', type);
      dataQuery = dataQuery.where('type', '=', type);
    }

    const [countResult, rows] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ]);

    const total = countResult ? Number(countResult.total) : 0;
    const meta = buildPaginationMeta(total, page, limit);

    return {
      items: rows.map(toTransactionDto),
      meta,
    };
  }
}
