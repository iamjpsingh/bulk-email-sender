/**
 * Authentication Middleware
 * Handles session validation and user context
 */
import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { d1UserDatabase, type D1User } from '../services/d1UserDatabase'
import { COOKIE } from '../config'

// User type for context
export type User = D1User

// Extend Hono Context with user
declare module 'hono' {
  interface Context {
    user?: User
  }
}

/**
 * Authentication middleware
 * Validates session token and attaches user to context
 */
export async function authMiddleware(c: Context, next: Next) {
  const token = getToken(c)

  if (!token) {
    return c.json({ success: false, message: 'Authentication required' }, 401)
  }

  const user = await d1UserDatabase.validateSession(token)

  if (!user) {
    return c.json({ success: false, message: 'Invalid or expired session' }, 401)
  }

  c.user = user
  return next()
}

/**
 * Require authenticated user
 * Throws if user is not authenticated
 */
export function requireAuth(c: Context): User {
  if (!c.user) {
    throw new Error('User not authenticated')
  }
  return c.user
}

/**
 * Extract token from request
 * Checks Authorization header and cookies
 */
function getToken(c: Context): string | undefined {
  // Check Authorization header first
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Fall back to cookie
  return getCookie(c, COOKIE.SESSION_NAME)
}
