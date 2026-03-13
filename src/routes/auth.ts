/**
 * Authentication Routes
 * Login, Register, Logout, Session Management
 */
import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { authLocalService } from '../services/authLocalService'
import { orgService } from '../services/orgService'
import { rbacService } from '../services/rbacService'
import { COOKIE, isHttps } from '../config'
import { error, success, ErrorMessages } from '../utils/response'
import { logger } from '../utils/logger'
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

    if (!email || !name || !password) {
      return error(c, 'Email, name, and password are required', 400)
    }

    if (!isValidEmail(email)) {
      return error(c, 'Invalid email format', 400)
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return error(c, passwordValidation.message, 400)
    }

    const session = await authLocalService.register(email, password, name)
    if (!session) {
      return error(c, 'Registration failed. Email may already exist.', 400)
    }

    const secure = isHttps(c.req.raw.headers, c.req.url)
    setCookie(c, COOKIE.SESSION_NAME, session.token, {
      ...COOKIE.OPTIONS,
      secure,
    })

    return success(c, { user: session.user }, 'Account created successfully')
  } catch (err) {
    logger.error('Registration error:', err)
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

    if (!email || !password) {
      return error(c, 'Email and password are required', 400)
    }

    const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
    const userAgent = c.req.header('user-agent')
    const session = await authLocalService.login(email, password, ipAddress, userAgent)
    if (!session) {
      return error(c, 'Invalid email or password', 401)
    }

    const secure = isHttps(c.req.raw.headers, c.req.url)
    setCookie(c, COOKIE.SESSION_NAME, session.token, {
      ...COOKIE.OPTIONS,
      secure,
    })

    return success(c, { user: session.user }, 'Login successful')
  } catch (err) {
    logger.error('Login error:', err)
    return error(c, 'Login failed', 500)
  }
})

/**
 * Logout user
 * POST /auth/logout
 */
app.post('/auth/logout', (c) => {
  try {
    const token = getCookie(c, COOKIE.SESSION_NAME)
    if (token) {
      authLocalService.logout(token)
    }
    deleteCookie(c, COOKIE.SESSION_NAME)
    return success(c, undefined, 'Logged out successfully')
  } catch (err) {
    logger.error('Logout error:', err)
    return error(c, 'Logout failed', 500)
  }
})

/**
 * Get current user
 * GET /auth/me
 */
app.get('/auth/me', (c) => {
  try {
    const token = getCookie(c, COOKIE.SESSION_NAME)
    if (!token) {
      return error(c, ErrorMessages.UNAUTHORIZED, 401)
    }

    const session = authLocalService.validateSession(token)
    if (!session) {
      deleteCookie(c, COOKIE.SESSION_NAME)
      return error(c, ErrorMessages.SESSION_EXPIRED, 401)
    }

    const { user, orgId } = session
    const orgs = orgService.listForUser(user.id)
    const role = orgId ? rbacService.getUserRole(user.id, orgId) : null

    return success(c, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_platform_admin: !!user.is_platform_admin,
      },
      orgId,
      role,
      orgs: orgs.map(o => ({ id: o.id, name: o.name, slug: o.slug, role: o.role })),
    })
  } catch (err) {
    logger.error('Auth check error:', err)
    return error(c, 'Auth check failed', 500)
  }
})

/**
 * Switch active organization
 * POST /auth/switch-org
 */
app.post('/auth/switch-org', async (c) => {
  try {
    const token = getCookie(c, COOKIE.SESSION_NAME)
    if (!token) return error(c, ErrorMessages.UNAUTHORIZED, 401)

    const body = await c.req.json()
    const { orgId } = body
    if (!orgId) return error(c, 'orgId is required', 400)

    const session = authLocalService.validateSession(token)
    if (!session) return error(c, ErrorMessages.SESSION_EXPIRED, 401)

    // Verify user is member of target org
    if (!rbacService.isMember(session.user.id, orgId) && !rbacService.isPlatformAdmin(session.user.id)) {
      return error(c, 'You are not a member of this organization', 403)
    }

    authLocalService.switchOrg(token, orgId)
    return success(c, { orgId }, 'Organization switched')
  } catch (err) {
    logger.error('Switch org error:', err)
    return error(c, 'Failed to switch organization', 500)
  }
})

export default app
