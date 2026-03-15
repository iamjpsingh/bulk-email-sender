// src/routes/webhooks.ts - Webhook Management API

import { Hono } from 'hono'
import { requireAuth, getOrgId } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { PERMISSIONS } from '../services/rbacService'
import { webhookService } from '../services/webhookService'
import { parseSES, parseMailgun, parseSendGrid, processBounce } from '../services/bounceProcessor'
import { success, error } from '../utils/response'
import { logger } from '../utils/logger'

const app = new Hono()

// ============================================================================
// Webhook CRUD
// ============================================================================

app.get('/webhooks', requirePermission(PERMISSIONS.WEBHOOKS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const webhooks = webhookService.list(orgId)

  // Hide secrets in list view
  const safe = webhooks.map(w => ({ ...w, secret: w.secret.substring(0, 8) + '...' }))
  return success(c, { webhooks: safe })
})

app.post('/webhooks', requirePermission(PERMISSIONS.WEBHOOKS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
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

  const webhook = webhookService.create(orgId, user.id, body)
  return success(c, webhook, 'Webhook created', 201)
})

app.get('/webhooks/:id', requirePermission(PERMISSIONS.WEBHOOKS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const webhookId = c.req.param('id')

  const webhook = webhookService.get(orgId, webhookId)
  if (!webhook) return error(c, 'Webhook not found', 404)

  return success(c, webhook)
})

app.put('/webhooks/:id', requirePermission(PERMISSIONS.WEBHOOKS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const webhookId = c.req.param('id')
  const body = await c.req.json()

  const updated = webhookService.update(orgId, webhookId, body)
  if (!updated) return error(c, 'Webhook not found', 404)

  return success(c, undefined, 'Webhook updated')
})

app.delete('/webhooks/:id', requirePermission(PERMISSIONS.WEBHOOKS_MANAGE), (c) => {
  const orgId = getOrgId(c)
  const webhookId = c.req.param('id')

  const deleted = webhookService.delete(orgId, webhookId)
  if (!deleted) return error(c, 'Webhook not found', 404)

  return success(c, undefined, 'Webhook deleted')
})

// ============================================================================
// Webhook Actions
// ============================================================================

app.post('/webhooks/:id/toggle', requirePermission(PERMISSIONS.WEBHOOKS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const webhookId = c.req.param('id')
  const body = await c.req.json()

  const toggled = webhookService.toggleEnabled(orgId, webhookId, !!body.enabled)
  if (!toggled) return error(c, 'Webhook not found', 404)

  return success(c, undefined, body.enabled ? 'Webhook enabled' : 'Webhook disabled')
})

app.post('/webhooks/:id/test', requirePermission(PERMISSIONS.WEBHOOKS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const webhookId = c.req.param('id')

  const result = await webhookService.testWebhook(orgId, webhookId)
  return success(c, result, result.success ? 'Test successful' : 'Test failed')
})

// ============================================================================
// Webhook Logs
// ============================================================================

app.get('/webhooks/:id/logs', requirePermission(PERMISSIONS.WEBHOOKS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const webhookId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  const webhook = webhookService.get(orgId, webhookId)
  if (!webhook) return error(c, 'Webhook not found', 404)

  const logs = webhookService.getLogs(webhookId, limit, offset)
  return success(c, { logs })
})

app.delete('/webhooks/:id/logs', requirePermission(PERMISSIONS.WEBHOOKS_MANAGE), (c) => {
  const orgId = getOrgId(c)
  const webhookId = c.req.param('id')

  const webhook = webhookService.get(orgId, webhookId)
  if (!webhook) return error(c, 'Webhook not found', 404)

  const cleared = webhookService.clearLogs(webhookId)
  return success(c, { cleared }, `${cleared} log(s) cleared`)
})

// ============================================================================
// Inbound Bounce/Complaint Webhooks (public — no auth)
// Providers call these endpoints to notify us of bounces, complaints, unsubs.
// ============================================================================

app.post('/webhooks/bounce/ses', async (c) => {
  try {
    const payload = await c.req.json()
    const event = parseSES(payload)

    if (!event) {
      return c.json({ ok: true, message: 'Ignored (not a bounce/complaint)' })
    }

    // SES doesn't tell us the userId — we look up by email in suppression context
    // For now, use a system-level userId. In production, map via campaign tracking.
    const userId = payload.userId || 'system'
    processBounce(userId, event)

    return c.json({ ok: true, processed: event.type })
  } catch (err) {
    logger.error('SES webhook error:', err)
    return c.json({ ok: false }, 400)
  }
})

app.post('/webhooks/bounce/mailgun', async (c) => {
  try {
    const payload = await c.req.json()
    const event = parseMailgun(payload)

    if (!event) {
      return c.json({ ok: true, message: 'Ignored' })
    }

    const userId = payload.userId || 'system'
    processBounce(userId, event)

    return c.json({ ok: true, processed: event.type })
  } catch (err) {
    logger.error('Mailgun webhook error:', err)
    return c.json({ ok: false }, 400)
  }
})

app.post('/webhooks/bounce/sendgrid', async (c) => {
  try {
    const payload = await c.req.json()
    const events = Array.isArray(payload) ? payload : [payload]
    const bounceEvents = parseSendGrid(events)

    for (const event of bounceEvents) {
      const userId = 'system'
      processBounce(userId, event)
    }

    return c.json({ ok: true, processed: bounceEvents.length })
  } catch (err) {
    logger.error('SendGrid webhook error:', err)
    return c.json({ ok: false }, 400)
  }
})

export default app
