import { Link, useNavigate } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import { logoutUserFn } from '../authServerFunctions'

export default function Header({ user }: { user: { username: string } | null }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logoutUserFn()
      navigate({ to: '/login', replace: true })
    } catch (err) {
      console.error('Failed to log out:', err)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
            My Notebook
          </Link>
        </h2>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Dashboard
          </Link>
          <Link
            to="/about"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            About
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--sea-ink-soft)]">
                Hi, <strong className="text-[var(--sea-ink)]">{user.username}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.05)] px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-[rgba(220,38,38,0.1)] cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
            >
              Login
            </Link>
          )}

          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
