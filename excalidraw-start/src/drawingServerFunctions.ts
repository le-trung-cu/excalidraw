import { createServerFn } from '@tanstack/react-start'
import { prisma } from './db'
import { getCurrentUser } from './auth'

// Helper to check auth and get user
async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export const getDrawingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireAuth()
    return await prisma.drawing.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }
)

export const getDrawingByIdFn = createServerFn({ method: 'GET' })
  .validator((id: unknown) => {
    if (typeof id !== 'string' || !id) {
      throw new Error('Drawing ID is required')
    }
    return id
  })
  .handler(async ({ data: id }) => {
    const user = await requireAuth()
    const drawing = await prisma.drawing.findFirst({
      where: {
        id,
        userId: user.id
      }
    })
    if (!drawing) {
      throw new Error('Drawing not found or access denied')
    }
    return drawing
  })

export const createDrawingFn = createServerFn({ method: 'POST' })
  .validator((title: unknown) => {
    if (title !== undefined && typeof title !== 'string') {
      throw new Error('Title must be a string')
    }
    return title ? title.trim() : 'Untitled Note'
  })
  .handler(async ({ data: title }) => {
    const user = await requireAuth()
    const newDrawing = await prisma.drawing.create({
      data: {
        title,
        elements: '[]',
        appState: '{}',
        files: '{}',
        userId: user.id
      }
    })
    return newDrawing
  })

export const renameDrawingFn = createServerFn({ method: 'POST' })
  .validator((data: { id: unknown; title: unknown }) => {
    if (typeof data.id !== 'string' || !data.id) {
      throw new Error('Drawing ID is required')
    }
    if (typeof data.title !== 'string' || !data.title.trim()) {
      throw new Error('Title cannot be empty')
    }
    return {
      id: data.id,
      title: data.title.trim()
    }
  })
  .handler(async ({ data }) => {
    const user = await requireAuth()

    // Verify ownership
    const drawing = await prisma.drawing.findFirst({
      where: { id: data.id, userId: user.id }
    })
    if (!drawing) {
      throw new Error('Drawing not found or access denied')
    }

    return await prisma.drawing.update({
      where: { id: data.id },
      data: { title: data.title }
    })
  })

export const deleteDrawingFn = createServerFn({ method: 'POST' })
  .validator((id: unknown) => {
    if (typeof id !== 'string' || !id) {
      throw new Error('Drawing ID is required')
    }
    return id
  })
  .handler(async ({ data: id }) => {
    const user = await requireAuth()

    // Verify ownership
    const drawing = await prisma.drawing.findFirst({
      where: { id, userId: user.id }
    })
    if (!drawing) {
      throw new Error('Drawing not found or access denied')
    }

    await prisma.drawing.delete({
      where: { id }
    })
    return { success: true }
  })

export const saveDrawingFn = createServerFn({ method: 'POST' })
  .validator((data: { id: unknown; elements: unknown; appState: unknown; files?: unknown; sheets?: unknown }) => {
    if (typeof data.id !== 'string' || !data.id) {
      throw new Error('Drawing ID is required')
    }
    if (typeof data.elements !== 'string') {
      throw new Error('Elements must be a serialized JSON string')
    }
    if (typeof data.appState !== 'string') {
      throw new Error('AppState must be a serialized JSON string')
    }
    if (data.files !== undefined && typeof data.files !== 'string') {
      throw new Error('Files must be a serialized JSON string')
    }
    if (data.sheets !== undefined && typeof data.sheets !== 'string') {
      throw new Error('Sheets must be a serialized JSON string')
    }
    return {
      id: data.id,
      elements: data.elements,
      appState: data.appState,
      files: data.files || '{}',
      sheets: data.sheets || '[]'
    }
  })
  .handler(async ({ data }) => {
    const user = await requireAuth()

    // Verify ownership
    const drawing = await prisma.drawing.findFirst({
      where: { id: data.id, userId: user.id }
    })
    if (!drawing) {
      throw new Error('Drawing not found or access denied')
    }

    return await prisma.drawing.update({
      where: { id: data.id },
      data: {
        elements: data.elements,
        appState: data.appState,
        files: data.files,
        sheets: data.sheets,
        updatedAt: new Date()
      }
    })
  })
