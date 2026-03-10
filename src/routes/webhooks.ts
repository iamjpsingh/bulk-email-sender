// src/routes/webhooks.ts - Webhook Management API

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { webhookService } from '../services/webhookService'
import { success, error } from '../utils/response'

const app = new Hono()

// ============================================================================
// Webhook CRUD
// ============================================================================

app.get('/webhooks', (c) => {
  const user = requireAuth(c)
  const webhooks = webhookService.list(user.id)

  // Hide secrets in list view
  const safe = webhooks.map(w => ({ ...w, secret: w.secret.substring(0, 8) + '...' }))
  return success(c, { webhooks: safe })
})

app.post('/webhooks', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.name?.trim() || !body.url?.trim()) {
    return error(c, 'Name and URL are required', 400)
  }

  if (!body.events?.length) {
    return error(c, 'At least one event type is required', 400)
  }

  // Validate URL format
  try {
    new URL(body.url)
  } catch {
    return error(c, 'Invalid URL format', 400)
  }

  const webhook = webhookService.create(user.id, body)
  return success(c, webhook, 'Webhook created', 201)
})

app.get('/webhooks/:id', (c) => {
  const user = requireAuth(c)
  const webhookId = c.req.param('id')

  const webhook = webhookService.get(user.id, webhookId)
  if (!webhook) return error(c, 'Webhook not found', 404)

  return success(c, webhook)
})

app.put('/webhooks/:id', async (c) => {
  const user = requireAuth(c)
  const webhookId = c.req.param('id')
  const body = await c.req.json()

  const updated = webhookService.update(user.id, webhookId, body)
  if (!updated) return error(c, 'Webhook not found', 404)

  return success(c, undefined, 'Webhook updated')
})

app.delete('/webhooks/:id', (c) => {
  const user = requireAuth(c)
  const webhookId = c.req.param('id')

  const deleted = webhookService.delete(user.id, webhookId)
  if (!deleted) return error(c, 'Webhook not found', 404)

  return success(c, undefined, 'Webhook deleted')
})

// ============================================================================
// Webhook Actions
// ============================================================================

app.post('/webhooks/:id/toggle', async (c) => {
  const user = requireAuth(c)
  const webhookId = c.req.param('id')
  const body = await c.req.json()

  const toggled = webhookService.toggleEnabled(user.id, webhookId, !!body.enabled)
  if (!toggled) return error(c, 'Webhook not found', 404)

  return success(c, undefined, body.enabled ? 'Webhook enabled' : 'Webhook disabled')
})

app.post('/webhooks/:id/test', async (c) => {
  const user = requireAuth(c)
  const webhookId = c.req.param('id')

  const result = await webhookService.testWebhook(user.id, webhookId)
  return success(c, result, result.success ? 'Test successful' : 'Test failed')
})

// ============================================================================
// Webhook Logs
// ============================================================================

app.get('/webhooks/:id/logs', (c) => {
  const user = requireAuth(c)
  const webhookId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  const webhook = webhookService.get(user.id, webhookId)
  if (!webhook) return error(c, 'Webhook not found', 404)

  const logs = webhookService.getLogs(webhookId, limit, offset)
  return success(c, { logs })
})

app.delete('/webhooks/:id/logs', (c) => {
  const user = requireAuth(c)
  const webhookId = c.req.param('id')

  const webhook = webhookService.get(user.id, webhookId)
  if (!webhook) return error(c, 'Webhook not found', 404)

  const cleared = webhookService.clearLogs(webhookId)
  return success(c, { cleared }, `${cleared} log(s) cleared`)
})

export default app
