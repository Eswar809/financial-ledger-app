import {
  createContext,
  useContext,
  useMemo,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type DashboardNavigation = {
  pathname: string
  navigate: (pathname: string) => void
}

const DashboardNavigationContext = createContext<DashboardNavigation | null>(null)

/**
 * Bridges the registry's internal navigation context onto React Router so
 * Bionis links work with the app's real route tree instead of demo state.
 */
export function DashboardNavigationProvider({ children }: { children: ReactNode }) {
  const routerNavigate = useNavigate()
  const { pathname } = useLocation()

  const value = useMemo(
    () => ({ pathname, navigate: routerNavigate }),
    [pathname, routerNavigate],
  )

  return (
    <DashboardNavigationContext.Provider value={value}>
      {children}
    </DashboardNavigationContext.Provider>
  )
}

export function useDashboardNavigation() {
  const context = useContext(DashboardNavigationContext)

  if (!context) {
    throw new Error('useDashboardNavigation must be used within DashboardNavigationProvider')
  }

  return context
}

export function DashboardLink({
  href,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { navigate } = useDashboardNavigation()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    navigate(href)
  }

  return <a href={href} onClick={handleClick} {...props} />
}
