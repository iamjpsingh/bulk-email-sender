// src/routes/segments.ts - Segmentation API

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { segmentService } from '../services/segmentService'
import { success, error } from '../utils/response'

const app = new Hono()

// ============================================================================
// Segment CRUD
// ============================================================================

app.get('/segments', (c) => {
  const user = requireAuth(c)
  const segments = segmentService.list(user.id)
  return success(c, { segments })
})

app.post('/segments', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.name?.trim()) {
    return error(c, 'Segment name is required', 400)
  }

  const segment = segmentService.create(user.id, body)
  return success(c, segment, 'Segment created', 201)
})

app.get('/segments/:id', (c) => {
  const user = requireAuth(c)
  const segmentId = c.req.param('id')

  const segment = segmentService.get(user.id, segmentId)
  if (!segment) return error(c, 'Segment not found', 404)

  return success(c, segment)
})

app.put('/segments/:id', async (c) => {
  const user = requireAuth(c)
  const segmentId = c.req.param('id')
  const body = await c.req.json()

  const updated = segmentService.update(user.id, segmentId, body)
  if (!updated) return error(c, 'Segment not found', 404)

  return success(c, undefined, 'Segment updated')
})

app.delete('/segments/:id', (c) => {
  const user = requireAuth(c)
  const segmentId = c.req.param('id')

  const deleted = segmentService.delete(user.id, segmentId)
  if (!deleted) return error(c, 'Segment not found', 404)

  return success(c, undefined, 'Segment deleted')
})

// ============================================================================
// Static Segment Members
// ============================================================================

app.post('/segments/:id/contacts', async (c) => {
  const user = requireAuth(c)
  const segmentId = c.req.param('id')
  const body = await c.req.json()

  const segment = segmentService.get(user.id, segmentId)
  if (!segment) return error(c, 'Segment not found', 404)
  if (segment.type !== 'static') return error(c, 'Can only add contacts to static segments', 400)

  if (!body.contact_ids?.length) {
    return error(c, 'contact_ids array is required', 400)
  }

  const added = segmentService.addContacts(segmentId, body.contact_ids)
  return success(c, { added }, `${added} contact(s) added to segment`)
})

app.delete('/segments/:id/contacts', async (c) => {
  const user = requireAuth(c)
  const segmentId = c.req.param('id')
  const body = await c.req.json()

  const segment = segmentService.get(user.id, segmentId)
  if (!segment) return error(c, 'Segment not found', 404)

  if (!body.contact_ids?.length) {
    return error(c, 'contact_ids array is required', 400)
  }

  const removed = segmentService.removeContacts(segmentId, body.contact_ids)
  return success(c, { removed }, `${removed} contact(s) removed from segment`)
})

app.get('/segments/:id/contacts', (c) => {
  const user = requireAuth(c)
  const segmentId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '100')
  const offset = parseInt(c.req.query('offset') || '0')

  const segment = segmentService.get(user.id, segmentId)
  if (!segment) return error(c, 'Segment not found', 404)

  const contactIds = segmentService.getStaticMembers(segmentId, limit, offset)
  return success(c, { contact_ids: contactIds, total: segment.contact_count })
})

// ============================================================================
// Dynamic Segment Query
// ============================================================================

app.post('/segments/:id/preview', async (c) => {
  const user = requireAuth(c)
  const segmentId = c.req.param('id')

  const segment = segmentService.get(user.id, segmentId)
  if (!segment) return error(c, 'Segment not found', 404)

  if (segment.type !== 'dynamic' || !segment.rules_json) {
    return error(c, 'Not a dynamic segment or no rules defined', 400)
  }

  const rules = JSON.parse(segment.rules_json)
  const query = segmentService.buildQuery(rules)

  return success(c, {
    sql_preview: query.sql,
    param_count: query.params.length,
    contact_count: segment.contact_count,
  })
})

export default app
