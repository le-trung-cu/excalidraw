import { getRequest, setResponseHeaders } from '@tanstack/react-start/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'notebook-secret-fallback-987654321'

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=')
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim()
    }
  })
  return cookies
}

export interface UserSessionPayload {
  userId: string
  username: string
}

export async function getCurrentUser() {
  const req = getRequest()
  if (!req) return null

  const cookieHeader = req.headers.get('cookie')
  const cookies = parseCookies(cookieHeader)
  const sessionToken = cookies['session_token']
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
  
  // Set cookie for 7 days
  const cookieValue = `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  setResponseHeaders({
    'Set-Cookie': cookieValue
  })
}

export async function clearSession() {
  const cookieValue = `session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  setResponseHeaders({
    'Set-Cookie': cookieValue
  })
}
