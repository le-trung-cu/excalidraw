import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { getCurrentUserFn } from '../authServerFunctions'
import { getDrawingsFn, createDrawingFn, deleteDrawingFn, renameDrawingFn } from '../drawingServerFunctions'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: async () => {
    try {
      const user = await getCurrentUserFn()
      if (!user) {
        throw navigate({ to: '/login' })
      }
      const drawings = await getDrawingsFn()
      return { user, drawings }
    } catch (err) {
      throw navigate({ to: '/login' })
    }
  }
})

// Quick polyfill for throw navigate in beforeLoad/loader
import { redirect } from '@tanstack/react-router'
const navigate = (opts: { to: string }) => redirect(opts)

function Dashboard() {
  const { user, drawings: initialDrawings } = Route.useLoaderData()
  const [drawings, setDrawings] = useState(initialDrawings)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const routerNavigate = useNavigate()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)
    try {
      const newDrawing = await createDrawingFn({ data: newTitle || 'Untitled Note' })
      routerNavigate({ to: '/drawing/$id', params: { id: newDrawing.id } })
    } catch (err: any) {
      setError(err?.message || 'Failed to create note')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this drawing?')) return
    try {
      await deleteDrawingFn({ data: id })
      setDrawings(drawings.filter(d => d.id !== id))
    } catch (err: any) {
      alert(err?.message || 'Failed to delete drawing')
    }
  }

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const handleSaveRename = async (id: string) => {
    if (!editTitle.trim()) return
    try {
      await renameDrawingFn({ data: { id, title: editTitle } })
      setDrawings(drawings.map(d => d.id === id ? { ...d, title: editTitle } : d))
      setEditingId(null)
    } catch (err: any) {
      alert(err?.message || 'Failed to rename drawing')
    }
  }

  const formatDate = (dateStr: string | Date) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <main className="page-wrap px-4 py-10">
      {/* Header section with Create Form */}
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12 mb-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.24),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(126,211,191,0.14),transparent_66%)]" />
        
        <p className="island-kicker mb-3">My Hand-Drawn Notebook</p>
        <h1 className="display-title mb-6 text-3xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          Welcome back, {user.username}!
        </h1>
        <p className="mb-8 max-w-xl text-sm text-[var(--sea-ink-soft)] sm:text-base">
          Create notebooks and draw sketches using the interactive canvas. Your handwritings and drawings are stored safely in your SQLite database.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 max-w-md">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Notebook name (e.g. Math Notes)"
            className="flex-grow rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)] focus:outline-none dark:bg-black/20"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-xl bg-[linear-gradient(90deg,#4fb8b2,#7ed3bf)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isCreating ? 'Creating...' : 'New Notebook'}
          </button>
        </form>
      </section>

      {/* Grid of notes */}
      <h2 className="text-xl font-bold tracking-tight text-[var(--sea-ink)] mb-4">
        Your Notebooks ({drawings.length})
      </h2>
      
      {drawings.length === 0 ? (
        <div className="island-shell flex flex-col items-center justify-center rounded-2xl py-16 text-center">
          <div className="mb-4 text-4xl">✏️</div>
          <p className="text-base font-semibold text-[var(--sea-ink)]">No notebooks yet</p>
          <p className="text-sm text-[var(--sea-ink-soft)] mt-1">Create one using the form above to start writing.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {drawings.map((drawing) => (
            <article
              key={drawing.id}
              className="island-shell hover-rise rounded-2xl p-6 border border-[var(--line)] bg-[var(--header-bg)] shadow-[0_4px_20px_rgba(30,90,72,0.02)] flex flex-col justify-between"
            >
              <div>
                {editingId === drawing.id ? (
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm text-[var(--sea-ink)] focus:outline-none dark:bg-black/20"
                    />
                    <button
                      onClick={() => handleSaveRename(drawing.id)}
                      className="rounded-lg bg-green-500 text-white px-2.5 py-1 text-xs font-semibold hover:bg-green-600 cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 px-2.5 py-1 text-xs font-semibold hover:brightness-95 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-lg font-bold text-[var(--sea-ink)] leading-snug truncate">
                      {drawing.title}
                    </h3>
                    <button
                      onClick={() => handleStartRename(drawing.id, drawing.title)}
                      className="text-xs text-[var(--lagoon-deep)] hover:underline cursor-pointer flex-shrink-0"
                    >
                      Rename
                    </button>
                  </div>
                )}
                
                <p className="text-xs text-[var(--sea-ink-soft)] mb-6">
                  Updated: {formatDate(drawing.updatedAt)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 mt-auto">
                <Link
                  to="/drawing/$id"
                  params={{ id: drawing.id }}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--lagoon-deep)] hover:underline"
                >
                  Open Canvas
                  <span>→</span>
                </Link>
                
                <button
                  onClick={() => handleDelete(drawing.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 cursor-pointer dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
