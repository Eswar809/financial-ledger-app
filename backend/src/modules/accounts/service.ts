import { Kysely, sql } from 'kysely';
import type { Database } from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';
import { buildPaginationMeta, type PaginatedResult } from '../../lib/pagination.js';
import { toAccountDto } from './mapper.js';
import type { AccountDto, CreateAccountBody, ListAccountsQuery } from './schemas.js';

export class AccountsService {
  constructor(private readonly db: Kysely<Database>) {}

  async createAccount(data: CreateAccountBody): Promise<AccountDto> {
    const initialBalance = data.initial_balance ?? '0.0000';

    return await this.db.transaction().execute(async (trx) => {
      // 1. Insert account
      const account = await trx
        .insertInto('accounts')
        .values({
          name: data.name,
          balance: initialBalance,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 2. Invariant preservation: if initial_balance > 0, write opening credit transaction
      if (initialBalance !== '0.0000') {
        await trx
          .insertInto('transactions')
          .values({
            account_id: account.id,
            type: 'credit',
            amount: initialBalance,
            balance_after: initialBalance,
            reference_id: `opening:${account.id}`,
            description: 'Opening balance',
          })
          .execute();
      }

      return toAccountDto(account);
    });
  }

  async getAccountById(id: string): Promise<AccountDto> {
    const account = await this.db
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!account) {
      throw new NotFoundError(`Account with ID ${id} not found`);
    }

    return toAccountDto(account);
  }

  async listAccounts(query: ListAccountsQuery): Promise<PaginatedResult<AccountDto>> {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const [countResult, rows] = await Promise.all([
      this.db
        .selectFrom('accounts')
        .select((eb) => eb.fn.count<string>('id').as('total'))
        .executeTakeFirst(),
      this.db
        .selectFrom('accounts')
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset)
        .execute(),
    ]);

    const total = countResult ? Number(countResult.total) : 0;

    return {
      items: rows.map(toAccountDto),
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
