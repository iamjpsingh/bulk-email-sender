/**
 * Main Application Entry Point
 * Clean, modular architecture following enterprise standards
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import { getCookie } from 'hono/cookie'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// Configuration
import { SERVER, CORS, AUTH, OAUTH, API, DIRECTORIES, ENV, COOKIE } from './config'

// Middleware
import { authMiddleware } from './middleware/auth'

// Services
import { d1Service } from './services/d1Service'
import { d1UserDatabase } from './services/d1UserDatabase'

// Routes
import indexRoutes from './routes/index'
import authRoutes from './routes/auth'
import oauthRoutes from './routes/oauth'
import sendRoutes from './routes/send'
import reportRoutes from './routes/report'
import configRoutes from './routes/config'
import dashboardRoutes from './routes/dashboard'
import trackingRoutes from './routes/tracking'

// ============================================================================
// Application Setup
// ============================================================================

const app = new Hono()

// ============================================================================
// Middleware
// ============================================================================

// CORS
app.use('*', cors({
  origin: (origin) => {
    return CORS.ALLOWED_ORIGINS.includes(origin) ? origin : CORS.ALLOWED_ORIGINS[0]
  },
  credentials: true,
}))

// Request logging
app.use('*', logger())

// Authentication
app.use('*', async (c, next) => {
  const path = c.req.path
  const isPublic = AUTH.PUBLIC_PATHS.some((p) => path.startsWith(p)) || path === '/'

  if (isPublic) {
    return next()
  }

  return authMiddleware(c, next)
})

// ============================================================================
// Static Files
// ============================================================================

app.use('/public/*', serveStatic({ root: './' }))

// ============================================================================
// Routes
// ============================================================================

const routes = [
  indexRoutes,
  authRoutes,
  oauthRoutes,
  sendRoutes,
  reportRoutes,
  configRoutes,
  dashboardRoutes,
  trackingRoutes,
]

routes.forEach((route) => app.route('/', route))

// ============================================================================
// Health & User Endpoints
// ============================================================================

app.get('/health', (c) =>
  c.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: API.VERSION,
  })
)

app.get('/user/info', async (c) => {
  const token = getCookie(c, COOKIE.SESSION_NAME)
  if (!token) {
    return c.json({ success: false, message: 'Not authenticated' }, 401)
  }

  const user = await d1UserDatabase.validateSession(token)
  if (!user) {
    return c.json({ success: false, message: 'Session expired' }, 401)
  }

  return c.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
  })
})

// ============================================================================
// Error Handlers
// ============================================================================

app.notFound((c) => {
  console.log(`❌ 404: ${c.req.method} ${c.req.path}`)
  return c.json({ success: false, message: `Not found: ${c.req.path}` }, 404)
})

app.onError((err, c) => {
  console.error('Error:', err)
  return c.json(
    {
      success: false,
      message: 'Internal Server Error',
      ...(ENV.isDev && { error: err.message }),
    },
    500
  )
})

// ============================================================================
// Initialization
// ============================================================================

async function initialize() {
  // Create required directories
  const dirs = Object.values(DIRECTORIES)
  await Promise.all(dirs.map((dir) => !existsSync(dir) && mkdir(dir, { recursive: true })))

  // Initialize tracking service
  const trackingConfigured = d1Service.initialize()

  // Log startup info
  console.log(`\n🚀 ${API.NAME} v${API.VERSION}\n`)
  console.log('📧 Providers:')
  console.log(`   ${OAUTH.GOOGLE.isConfigured() ? '✅' : '⚠️ '} Google Gmail`)
  console.log(`   ${OAUTH.MICROSOFT.isConfigured() ? '✅' : '⚠️ '} Microsoft Outlook`)
  console.log('\n📊 Tracking:')
  console.log(`   ${trackingConfigured ? '✅' : '⚠️ '} Cloudflare Worker ${trackingConfigured ? '' : '(set TRACKING_WORKER_URL)'}`)
  console.log(`\n🌐 API: http://localhost:${SERVER.PORT}`)
  console.log(`🖥️  Frontend: ${SERVER.FRONTEND_URL}`)
  console.log('\n✅ Ready\n')
}

await initialize()

// ============================================================================
// Export
// ============================================================================

export default {
  port: SERVER.PORT,
  fetch: app.fetch,
}
