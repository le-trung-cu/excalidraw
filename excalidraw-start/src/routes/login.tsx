import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { loginUserFn, registerUserFn, getCurrentUserFn } from '../authServerFunctions'

export const Route = createFileRoute('/login')({
  component: Login,
  loader: async () => {
    try {
      const user = await getCurrentUserFn()
      return { user }
    } catch {
      return { user: null }
    }
  },
  beforeLoad: ({ context, loaderData }) => {
    // If user is already logged in, redirect them to index
    if (loaderData?.user) {
      throw navigate({ to: '/' })
    }
  }
})

// Quick polyfill for throw navigate in beforeLoad
import { redirect } from '@tanstack/react-router'
const navigate = (opts: { to: string }) => redirect(opts)

function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const routerNavigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim() || !password) {
      setError('All fields are required')
      return
    }

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      if (isRegister) {
        await registerUserFn({ data: { username, password } })
      } else {
        await loginUserFn({ data: { username, password } })
      }
      
      // Force refresh of the router to refresh session context in root loader
      await routerNavigate({ to: '/', replace: true })
      window.location.reload()
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="page-wrap flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="rise-in w-full max-w-md rounded-[2rem] border border-[var(--line)] bg-[var(--header-bg)] p-8 shadow-[0_24px_64px_rgba(30,90,72,0.06)] backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(79,184,178,0.2),rgba(126,211,191,0.2))] text-[var(--lagoon-deep)]">
            <span className="h-4 w-4 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-3xl">
            {isRegister ? 'Create an account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
            {isRegister
              ? 'Sign up to start saving your notebook drawings'
              : 'Log in to access your saved notes'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)] focus:outline-none dark:bg-black/20"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)] focus:outline-none dark:bg-black/20"
              placeholder="••••••••"
              required
            />
          </div>

          {isRegister && (
            <div className="fade-in">
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)] focus:outline-none dark:bg-black/20"
                placeholder="••••••••"
                required={isRegister}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-[linear-gradient(90deg,#4fb8b2,#7ed3bf)] py-3 text-sm font-semibold text-white shadow-lg transition duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isLoading
              ? 'Processing...'
              : isRegister
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister)
              setError(null)
            }}
            className="text-sm font-medium text-[var(--lagoon-deep)] hover:underline cursor-pointer"
          >
            {isRegister
              ? 'Already have an account? Log in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </main>
  )
}
