import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import jwt from 'jsonwebtoken'
import { prisma } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'notebook-secret-fallback-987654321'

export interface UserSessionPayload {
  userId: string
  username: string
}

export async function getCurrentUser() {
  const sessionToken = getCookie('session_token')
  if (!sessionToken) return null

  try {
    const decoded = jwt.verify(sessionToken, JWT_SECRET) as UserSessionPayload
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true }
    })
    return user
  } catch (err) {
    return null
  }
}

export async function createSession(userId: string, username: string) {
  const payload: UserSessionPayload = { userId, username }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
  
  setCookie('session_token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 // 7 days
  })
}

export async function clearSession() {
  deleteCookie('session_token', {
    path: '/'
  })
}
