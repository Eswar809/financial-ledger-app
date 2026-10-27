import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BookOpen, ExternalLink } from 'lucide-react'
import { BellIcon, CloseIcon, SearchIcon } from './icons'
import { useDashboardNavigation } from './navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useAllTransactions, useAccounts } from '@/api/queries'
import { currentUser, navigationGroups } from '../../data'
import { cn, formatMoneyDisplay } from '@/lib/utils'

function useCurrentNavItem() {
  const { pathname } = useDashboardNavigation()
  return (
    navigationGroups
      .flatMap((group) => group.items)
      .find((item) =>
        item.href === '/'
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? navigationGroups[0]?.items[0]
  )
}

export function DashboardTopbar() {
  const currentNavItem = useCurrentNavItem()
  const PageIcon = currentNavItem?.icon
  const { navigate } = useDashboardNavigation()

  const { data: accounts = [] } = useAccounts()
  const { data: recentLedger } = useAllTransactions({ limit: 6, page: 1 })
  const recentTransactions = recentLedger?.data ?? []

  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  const matchedAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return accounts
      .filter((account) => account.name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [accounts, searchQuery])

  const recentCount = recentTransactions.length
  const hasLiveTx =
    recentTransactions.length > 0 &&
    Date.now() - new Date(recentTransactions[0]!.created_at).getTime() < 5 * 60_000

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const hasUnread = recentCount > 0

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b py-4 px-4 md:h-20 md:pr-8 md:pl-6">
      <>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="size-11 shrink-0 md:hidden [&_svg]:size-5!" />
          <div className="flex items-center gap-3">
            {PageIcon ? <PageIcon className="hidden size-5 shrink-0 md:block" /> : null}
            <p className="truncate text-lg font-medium">{currentNavItem?.name}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Account search (⌘K) */}
          <div className="relative hidden md:block">
            <InputGroup className="h-11 w-70 max-w-full border-none bg-secondary py-1 pr-2 pl-3">
              <InputGroupAddon className="pl-0 text-muted-foreground">
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                ref={searchInputRef}
                className="h-full px-1.5! text-sm tracking-tight placeholder:text-muted-foreground"
                aria-label="Search accounts"
                placeholder="search accounts... (⌘K)"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setShowResults(true)
                }}
                onBlur={() => window.setTimeout(() => setShowResults(false), 150)}
              />
            </InputGroup>

            {showResults && searchQuery.trim() ? (
              <div className="absolute top-full right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md">
                {matchedAccounts.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    No accounts match “{searchQuery.trim()}”
                  </p>
                ) : (
                  <div className="p-1.5">
                    {matchedAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-accent"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSearchQuery('')
                          navigate(`/accounts/${account.id}`)
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {account.name}
                          <span className="ml-2 font-mono text-xxs text-muted-foreground">
                            {account.id.slice(0, 8)}…
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-sm font-medium tabular-nums">
                          {formatMoneyDisplay(account.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Recent ledger activity */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="relative size-11"
                aria-label="Recent transactions"
              >
                <BellIcon className="size-6!" />
                {hasUnread ? (
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute top-2 right-2 size-1.5 rounded-full bg-(--live)',
                      hasLiveTx && 'live-dot-pulse',
                    )}
                  />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="ml-3 w-80 p-0">
              <div className="flex items-center justify-between gap-3 border-b px-3.5 py-3">
                <p className="text-sm font-medium">Recent ledger activity</p>
                <p className="text-xs text-muted-foreground">
                  live · polling every 3s
                </p>
              </div>

              <div className="p-1.5">
                {recentCount === 0 ? (
                  <p className="px-2.5 py-3 text-sm text-muted-foreground">
                    No transactions recorded yet.
                  </p>
                ) : (
                  recentTransactions.map((tx) => {
                    const isCredit = tx.type === 'credit'
                    return (
                      <DropdownMenuItem
                        key={tx.id}
                        className="cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2.5 [&_svg]:!text-inherit"
                        onClick={() => navigate(`/accounts/${tx.account_id}`)}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                            isCredit
                              ? 'bg-(--vital-good)/10 text-(--vital-good)'
                              : 'bg-(--prediction-danger)/10 text-(--prediction-danger)',
                          )}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="size-4" />
                          ) : (
                            <ArrowUpRight className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug">
                              {isCredit ? 'Credit' : 'Debit'} ·{' '}
                              {formatMoneyDisplay(tx.amount)}
                            </p>
                            <p className="shrink-0 font-mono text-xxs text-muted-foreground">
                              {accountNameById.get(tx.account_id)?.slice(0, 14) ?? 'Unknown'}
                            </p>
                          </div>
                          <p className="truncate font-mono text-xs leading-relaxed text-muted-foreground">
                            {tx.reference_id}
                          </p>
                          <p className="text-xs text-muted-foreground/80">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    )
                  })
                )}
              </div>

              <div className="border-t px-3.5 py-2.5 text-center">
                <DashboardLinkHome />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-auto gap-2 px-0 aria-expanded:bg-transparent hover:bg-transparent"
                aria-label="Profile"
              >
                <img
                  src={currentUser.avatar}
                  alt=""
                  className="size-11 rounded-lg bg-muted object-cover"
                />
                <div className="hidden flex-col items-start gap-1 text-left md:flex">
                  <span className="text-base font-medium leading-none">
                    {currentUser.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm leading-none text-muted-foreground">
                    <span className="inline-block size-1.5 shrink-0 rounded-full bg-(--live) live-dot-pulse" />
                    <span className="text-(--live)">{currentUser.planStatus}</span>
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-0">
              <div className="space-y-2 border-b p-3">
                <p className="truncate text-sm font-medium">{currentUser.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {currentUser.email}
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-(--vital-good)/10 px-2 py-0.5 text-xs font-medium text-(--vital-good)">
                  <span className="size-1.5 rounded-full bg-current live-dot-pulse" />
                  Ledger connected
                </span>
              </div>
              <div className="p-1.5">
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      'https://github.com/Eswar809/financial-ledger-app',
                      '_blank',
                    )
                  }
                >
                  <BookOpen className="size-4" />
                  Source repository
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open('/docs', '_blank')}>
                  <ExternalLink className="size-4" />
                  API reference (Swagger)
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <div className="px-3 py-2 text-xxs text-muted-foreground">
                PostgreSQL NUMERIC(19,4) · ACID · deadlock-free
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </>
    </header>
  )
}

function DashboardLinkHome() {
  const { navigate } = useDashboardNavigation()
  return (
    <button
      type="button"
      className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      onClick={() => navigate('/')}
    >
      View dashboard
    </button>
  )
}

// Re-exported for potential external use; keeps the original API surface of
// this module (search icon) importable without importing bionis icons directly.
export { SearchIcon, CloseIcon }
