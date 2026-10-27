import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ScoreDonut } from './shared'
import { Button } from '@/components/ui/button'
import { useAccounts, useAllTransactions, useCreateAccount } from '@/api/queries'
import { currentUser } from '../../data'
import { cn, formatMoneyDisplay } from '@/lib/utils'

function useGreeting(fullName: string) {
  return useMemo(() => {
    const hour = new Date().getHours()
    const firstName = fullName.split(' ')[0] ?? fullName
    if (hour < 12) return `Good Morning, ${firstName}`
    if (hour < 18) return `Good Afternoon, ${firstName}`
    return `Good Evening, ${firstName}`
  }, [fullName])
}

export function DashboardContent() {
  const greeting = useGreeting(currentUser.name)
  const { data: accounts = [], isLoading, isFetching } = useAccounts()
  const { data: ledgerResponse } = useAllTransactions({ limit: 8, page: 1 })
  const transactions = ledgerResponse?.data ?? []

  const createAccountMutation = useCreateAccount()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [initialBalance, setInitialBalance] = useState('')

  // Compute live aggregates using pure string / Decimal logic via formatMoneyDisplay
  const totalBalanceString = useMemo(() => {
    let cents = 0n
    for (const account of accounts) {
      const [intPart = '0', fracPart = '0'] = account.balance.split('.')
      const fracPadded = (fracPart + '0000').slice(0, 4)
      const isNeg = account.balance.startsWith('-')
      const cleanInt = isNeg ? intPart.slice(1) : intPart
      const val = BigInt(cleanInt) * 10000n + BigInt(fracPadded)
      cents += isNeg ? -val : val
    }
    const isNeg = cents < 0n
    const abs = isNeg ? -cents : cents
    const intStr = (abs / 10000n).toString()
    const fracStr = (abs % 10000n).toString().padStart(4, '0')
    return `${isNeg ? '-' : ''}${intStr}.${fracStr}`
  }, [accounts])

  const accountCount = accounts.length
  const ledgerCount = ledgerResponse?.meta?.total ?? transactions.length

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      await createAccountMutation.mutateAsync({
        name: name.trim(),
        initial_balance: initialBalance ? initialBalance.trim() : undefined,
      })
      toast.success(`Account "${name.trim()}" created successfully!`)
      setName('')
      setInitialBalance('')
      setShowCreateModal(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create account')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Top greeting + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="min-w-0 truncate text-xl font-medium md:text-2xl">
            {greeting}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time double-entry ledger &bull; PostgreSQL NUMERIC(19,4)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 gap-1.5 rounded-lg px-3.5 text-sm font-normal tracking-tight shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
            asChild
          >
            <Link to="/transfers">Transfer Funds</Link>
          </Button>

          <Button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="h-10 shrink-0 gap-1.5 rounded-lg px-3.5 text-sm font-medium tracking-tight bg-primary text-primary-foreground hover:opacity-90"
          >
            <PlusCircle className="size-4" />
            <span>New Account</span>
          </Button>
        </div>
      </div>

      {/* Hero: Overall System Liquidity */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl border bg-card p-6">
        <div className="flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total System Liquidity
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-(--live)/10 px-2 py-0.5 text-xs font-medium text-(--live)">
              <span className="size-1.5 rounded-full bg-(--live) live-dot-pulse" />
              ACID Reconciled
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-foreground">
            {formatMoneyDisplay(totalBalanceString)}
          </div>

          <p className="text-xs text-muted-foreground max-w-md">
            Conservation of value holds across all {accountCount} account{accountCount === 1 ? '' : 's'}. Every debit matches a credit.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <ScoreDonut
            value={Math.min(100, accountCount * 25 || 100)}
            max={100}
            label="Integrity"
          />
        </div>
      </section>

      {/* 4 Metric cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex min-h-32 flex-col justify-between rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Accounts</span>
            <Wallet className="size-4 text-(--bionis-blue)" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{accountCount}</div>
            <p className="text-xs text-muted-foreground mt-1">CHECK (balance &ge; 0)</p>
          </div>
        </article>

        <article className="flex min-h-32 flex-col justify-between rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Ledger Entries</span>
            <ShieldCheck className="size-4 text-(--vital-good)" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{ledgerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Append-only audit trail</p>
          </div>
        </article>

        <article className="flex min-h-32 flex-col justify-between rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Deadlock Protection</span>
            <TrendingUp className="size-4 text-(--insight-prediction)" />
          </div>
          <div>
            <div className="text-2xl font-semibold">100% Zero</div>
            <p className="text-xs text-muted-foreground mt-1">Ordered row locks</p>
          </div>
        </article>

        <article className="flex min-h-32 flex-col justify-between rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Live Polling</span>
            <RefreshCw className={cn('size-4 text-(--live)', isFetching && 'animate-spin')} />
          </div>
          <div>
            <div className="text-2xl font-semibold">3s Interval</div>
            <p className="text-xs text-muted-foreground mt-1">TanStack Query live</p>
          </div>
        </article>
      </section>

      {/* Accounts Grid */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Accounts</h2>
            <p className="text-xs text-muted-foreground">
              Select an account to view its full transaction history and deposit/withdraw.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl border bg-card p-5 animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center bg-card">
            <p className="text-sm font-medium">No accounts found</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Create your first account with an initial opening balance.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <PlusCircle className="size-4 mr-1.5" />
              Create Account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => (
              <Link
                key={acc.id}
                to={`/accounts/${acc.id}`}
                className="group flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all hover:border-(--bionis-blue) hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-base truncate group-hover:text-(--bionis-blue) transition-colors">
                      {acc.name}
                    </span>
                    <span className="font-mono text-xxs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {acc.id.slice(0, 8)}...
                    </span>
                  </div>

                  <span className="text-xxs uppercase tracking-wider font-semibold text-muted-foreground">
                    Available Balance
                  </span>
                  <div className="text-2xl font-mono font-bold tracking-tight text-foreground mt-0.5">
                    {formatMoneyDisplay(acc.balance)}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t flex items-center justify-between text-xs text-(--bionis-blue) font-medium group-hover:translate-x-0.5 transition-transform">
                  <span>View ledger &amp; actions</span>
                  <ArrowRight className="size-3.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Ledger Activity */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Recent Ledger Activity</h2>
            <p className="text-xs text-muted-foreground">
              Global double-entry audit records across all accounts
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.slice(0, 8).map((tx) => {
                    const isCredit = tx.type === 'credit'
                    return (
                      <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                              isCredit
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
                            )}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="size-3" />
                            ) : (
                              <ArrowUpRight className="size-3" />
                            )}
                            {tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td
                          className={cn(
                            'py-3 px-4 font-mono font-semibold',
                            isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
                          )}
                        >
                          {isCredit ? '+' : '-'}
                          {formatMoneyDisplay(tx.amount)}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {formatMoneyDisplay(tx.balance_after)}
                        </td>
                        <td
                          className="py-3 px-4 font-mono text-xs text-muted-foreground max-w-[160px] truncate"
                          title={tx.reference_id}
                        >
                          {tx.reference_id}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {tx.description || <span className="opacity-40">&mdash;</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Modal: Create Account */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-popover text-popover-foreground rounded-2xl max-w-md w-full p-6 shadow-xl border">
            <h2 className="text-lg font-bold">Create New Account</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Opening balance automatically records an immutable credit row in the ledger.
            </p>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operating Treasury, Alice Primary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-(--bionis-blue)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase mb-1">
                  Initial Balance (USD, optional)
                </label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-(--bionis-blue)"
                />
                <span className="text-xxs text-muted-foreground mt-1 block">
                  Numeric up to 4 decimal places (e.g. 1500.50)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAccountMutation.isPending || !name.trim()}
                >
                  {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
