// src/routes/templates.ts - Template Management API

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { templateService, type TemplateCategory } from '../services/templateService'
import { success, error } from '../utils/response'

const app = new Hono()

// ============================================================================
// Template CRUD
// ============================================================================

app.get('/templates', (c) => {
  const user = requireAuth(c)

  const filters = {
    category: c.req.query('category') as TemplateCategory | undefined,
    search: c.req.query('search'),
    page: parseInt(c.req.query('page') || '1'),
    limit: parseInt(c.req.query('limit') || '50'),
  }

  const { templates, total } = templateService.list(user.id, filters)

  return c.json({
    success: true,
    data: templates,
    meta: {
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
        hasMore: filters.page * filters.limit < total,
      },
    },
  })
})

app.post('/templates', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.name?.trim() || !body.html_content?.trim()) {
    return error(c, 'Name and HTML content are required', 400)
  }

  const template = templateService.create(user.id, body)
  return success(c, template, 'Template created', 201)
})

app.get('/templates/starters', (c) => {
  const starters = templateService.getStarterTemplates()
  return success(c, { templates: starters })
})

app.get('/templates/:id', (c) => {
  const user = requireAuth(c)
  const templateId = c.req.param('id')

  if (templateId === 'starters') return c.notFound()

  const template = templateService.get(user.id, templateId)
  if (!template) return error(c, 'Template not found', 404)

  return success(c, template)
})

app.put('/templates/:id', async (c) => {
  const user = requireAuth(c)
  const templateId = c.req.param('id')
  const body = await c.req.json()

  const updated = templateService.update(user.id, templateId, body)
  if (!updated) return error(c, 'Template not found or is a starter template', 404)

  return success(c, undefined, 'Template updated')
})

app.delete('/templates/:id', (c) => {
  const user = requireAuth(c)
  const templateId = c.req.param('id')

  const deleted = templateService.delete(user.id, templateId)
  if (!deleted) return error(c, 'Template not found or cannot be deleted', 404)

  return success(c, undefined, 'Template deleted')
})

// ============================================================================
// Template Operations
// ============================================================================

app.post('/templates/:id/duplicate', async (c) => {
  const user = requireAuth(c)
  const templateId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const newName = body.name || 'Copy'

  const duplicate = templateService.duplicate(user.id, templateId, newName)
  if (!duplicate) return error(c, 'Template not found', 404)

  return success(c, duplicate, 'Template duplicated', 201)
})

app.post('/templates/:id/preview', async (c) => {
  const user = requireAuth(c)
  const templateId = c.req.param('id')
  const body = await c.req.json()

  const template = templateService.get(user.id, templateId)
  if (!template) return error(c, 'Template not found', 404)

  const rendered = templateService.renderPreview(template.html_content, body.data || {})
  return success(c, { html: rendered, variables: JSON.parse(template.variables) })
})

app.post('/templates/preview', async (c) => {
  const body = await c.req.json()
  if (!body.html) return error(c, 'HTML content is required', 400)

  const rendered = templateService.renderPreview(body.html, body.data || {})
  const variables = templateService.extractVariables(body.html)
  return success(c, { html: rendered, variables })
})

export default app
