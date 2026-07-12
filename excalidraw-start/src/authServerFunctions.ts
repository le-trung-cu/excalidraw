import { createServerFn } from '@tanstack/react-start'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { getCurrentUser, createSession, clearSession } from './auth'

export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    return await getCurrentUser()
  }
)

export const registerUserFn = createServerFn({ method: 'POST' })
  .validator((data: { username: unknown; password: unknown }) => {
    console.log({data})
    if (typeof data.username !== 'string' || data.username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters long')
    }
    if (typeof data.password !== 'string' || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }
    return {
      username: data.username.trim(),
      password: data.password
    }
  })
  .handler(async ({ data }) => {
    console.log("xxxxx")
    try {
      const existing = await prisma.user.findUnique({
      where: { username: data.username }
    })
    if (existing) {
      throw new Error('Username is already taken')
    }
    console.log(existing)

    const passwordHash = await bcrypt.hash(data.password, 10)
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash
      }
    })

    await createSession(user.id, user.username)
    return { success: true, username: user.username }
    } catch (error) {
      console.log({error})
    }
    
  })

export const loginUserFn = createServerFn({ method: 'POST' })
  .validator((data: { username: unknown; password: unknown }) => {
    if (typeof data.username !== 'string' || !data.username) {
      throw new Error('Username is required')
    }
    if (typeof data.password !== 'string' || !data.password) {
      throw new Error('Password is required')
    }
    return {
      username: data.username,
      password: data.password
    }
  })
  .handler(async ({ data }) => {
    const user = await prisma.user.findUnique({
      where: { username: data.username }
    })
    if (!user) {
      throw new Error('Invalid username or password')
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash)
    if (!valid) {
      throw new Error('Invalid username or password')
    }

    await createSession(user.id, user.username)
    return { success: true, username: user.username }
  })

export const logoutUserFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    await clearSession()
    return { success: true }
  }
)
