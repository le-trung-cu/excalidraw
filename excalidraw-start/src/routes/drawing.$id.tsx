import { createFileRoute } from '@tanstack/react-router'
import { getCurrentUserFn } from '../authServerFunctions'
import { getDrawingByIdFn } from '../drawingServerFunctions'
import React, { Suspense } from 'react'

// Lazily load the client-only drawing canvas component
const DrawingCanvas = React.lazy(() => import('../components/DrawingCanvas'))

export const Route = createFileRoute('/drawing/$id')({
  component: DrawingPage,
  loader: async ({ params }) => {
    try {
      const user = await getCurrentUserFn()
      if (!user) {
        throw navigate({ to: '/login' })
      }
      const drawing = await getDrawingByIdFn({ data: params.id })
      return { user, drawing }
    } catch (err) {
      throw navigate({ to: '/login' })
    }
  }
})

import { redirect } from '@tanstack/react-router'
const navigate = (opts: { to: string }) => redirect(opts)

function DrawingPage() {
  const { drawing } = Route.useLoaderData()

  return (
    <main className="w-full h-[calc(100vh-64px)] relative bg-slate-50 dark:bg-zinc-900 overflow-hidden flex flex-col">
      <Suspense
        fallback={
          <div className="flex-grow flex items-center justify-center text-sm font-semibold text-[var(--sea-ink-soft)]">
            Loading Excalidraw Editor...
          </div>
        }
      >
        <DrawingCanvas drawing={drawing} />
      </Suspense>
    </main>
  )
}
