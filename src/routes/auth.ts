/**
 * Authentication Routes
 * Login, Register, Logout, Session Management
 */
import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { d1UserDatabase } from '../services/d1UserDatabase'
import { COOKIE, isHttps } from '../config'
import { error, success, ErrorMessages } from '../utils/response'
import { isValidEmail, validatePassword } from '../utils/validation'

const app = new Hono()

/**
 * Register new user
 * POST /auth/register
 */
app.post('/auth/register', async (c) => {
  try {
    const body = await c.req.json()
    const { email, name, password } = body

    // Validate required fields
    if (!email || !name || !password) {
      return error(c, 'Email, name, and password are required', 400)
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return error(c, 'Invalid email format', 400)
    }

    // Validate password
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return error(c, passwordValidation.errors[0], 400)
    }

    // Register user
    const session = await d1UserDatabase.register(email, password, name)
    if (!session) {
      return error(c, 'Registration failed. Email may already exist.', 400)
    }

    // Set session cookie
    const secure = isHttps(c.req.raw.headers, c.req.url)
    setCookie(c, COOKIE.SESSION_NAME, session.token, {
      ...COOKIE.OPTIONS,
      secure,
    })

    return success(c, { user: session.user }, 'Account created successfully')
  } catch (err) {
    console.error('Registration error:', err)
    return error(c, 'Registration failed', 500)
  }
})

/**
 * Login user
 * POST /auth/login
 */
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return error(c, 'Email and password are required', 400)
    }

    // Authenticate
    const session = await d1UserDatabase.login(email, password)
    if (!session) {
      return error(c, 'Invalid email or password', 401)
    }

    // Set session cookie
    const secure = isHttps(c.req.raw.headers, c.req.url)
    setCookie(c, COOKIE.SESSION_NAME, session.token, {
      ...COOKIE.OPTIONS,
      secure,
    })

    return success(c, { user: session.user }, 'Login successful')
  } catch (err) {
    console.error('Login error:', err)
    return error(c, 'Login failed', 500)
  }
})

/**
 * Logout user
 * POST /auth/logout
 */
app.post('/auth/logout', async (c) => {
  try {
    const token = getCookie(c, COOKIE.SESSION_NAME)
    if (token) {
      await d1UserDatabase.logout(token)
    }
    deleteCookie(c, COOKIE.SESSION_NAME)
    return success(c, undefined, 'Logged out successfully')
  } catch (err) {
    console.error('Logout error:', err)
    return error(c, 'Logout failed', 500)
  }
})

/**
 * Get current user
 * GET /auth/me
 */
app.get('/auth/me', async (c) => {
  try {
    const token = getCookie(c, COOKIE.SESSION_NAME)
    if (!token) {
      return error(c, ErrorMessages.UNAUTHORIZED, 401)
    }

    const user = await d1UserDatabase.validateSession(token)
    if (!user) {
      deleteCookie(c, COOKIE.SESSION_NAME)
      return error(c, ErrorMessages.SESSION_EXPIRED, 401)
    }

    return success(c, { user })
  } catch (err) {
    console.error('Auth check error:', err)
    return error(c, 'Auth check failed', 500)
  }
})

export default app
