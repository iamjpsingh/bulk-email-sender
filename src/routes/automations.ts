// src/routes/automations.ts - Automation Management API

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { automationService } from '../services/automationService'
import { success, error } from '../utils/response'

const app = new Hono()

// ============================================================================
// Automation CRUD
// ============================================================================

app.get('/automations', (c) => {
  const user = requireAuth(c)
  const automations = automationService.list(user.id)
  return success(c, { automations })
})

app.post('/automations', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.name?.trim() || !body.trigger_type) {
    return error(c, 'Name and trigger_type are required', 400)
  }

  const automation = automationService.create(user.id, body)
  return success(c, automation, 'Automation created', 201)
})

app.get('/automations/:id', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')

  const automation = automationService.get(user.id, automationId)
  if (!automation) return error(c, 'Automation not found', 404)

  const steps = automationService.getSteps(automationId)
  return success(c, { ...automation, steps })
})

app.put('/automations/:id', async (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')
  const body = await c.req.json()

  const updated = automationService.update(user.id, automationId, body)
  if (!updated) return error(c, 'Automation not found or cannot be edited while active', 404)

  return success(c, undefined, 'Automation updated')
})

app.delete('/automations/:id', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')

  const deleted = automationService.delete(user.id, automationId)
  if (!deleted) return error(c, 'Automation not found or is currently active', 404)

  return success(c, undefined, 'Automation deleted')
})

// ============================================================================
// Automation Lifecycle
// ============================================================================

app.post('/automations/:id/activate', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')

  const activated = automationService.activate(user.id, automationId)
  if (!activated) return error(c, 'Automation not found or cannot be activated', 404)

  return success(c, undefined, 'Automation activated')
})

app.post('/automations/:id/pause', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')

  const paused = automationService.pause(user.id, automationId)
  if (!paused) return error(c, 'Automation not found or not active', 404)

  return success(c, undefined, 'Automation paused')
})

app.post('/automations/:id/deactivate', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')

  const deactivated = automationService.deactivate(user.id, automationId)
  if (!deactivated) return error(c, 'Automation not found', 404)

  return success(c, undefined, 'Automation deactivated')
})

// ============================================================================
// Enrollments
// ============================================================================

app.get('/automations/:id/enrollments', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  const automation = automationService.get(user.id, automationId)
  if (!automation) return error(c, 'Automation not found', 404)

  const enrollments = automationService.getEnrollments(automationId, limit, offset)
  return success(c, { enrollments })
})

app.post('/automations/:id/enroll', async (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')
  const body = await c.req.json()

  if (!body.contact_id) {
    return error(c, 'contact_id is required', 400)
  }

  const automation = automationService.get(user.id, automationId)
  if (!automation) return error(c, 'Automation not found', 404)

  const enrolled = automationService.enrollContact(automationId, body.contact_id)
  if (!enrolled) return error(c, 'Could not enroll contact (already enrolled or no steps)', 400)

  return success(c, undefined, 'Contact enrolled')
})

app.delete('/automations/:id/enrollments/:contactId', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')
  const contactId = c.req.param('contactId')

  const automation = automationService.get(user.id, automationId)
  if (!automation) return error(c, 'Automation not found', 404)

  const exited = automationService.exitContact(automationId, contactId, 'manual')
  if (!exited) return error(c, 'Enrollment not found or not active', 404)

  return success(c, undefined, 'Contact removed from automation')
})

// ============================================================================
// Automation Stats
// ============================================================================

app.get('/automations/:id/stats', (c) => {
  const user = requireAuth(c)
  const automationId = c.req.param('id')

  const automation = automationService.get(user.id, automationId)
  if (!automation) return error(c, 'Automation not found', 404)

  const stats = automationService.getStats(automationId)
  return success(c, stats)
})

export default app
