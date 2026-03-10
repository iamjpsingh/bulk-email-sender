// src/routes/campaigns.ts - Campaign Management API

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { campaignService, type CampaignLifecycleStatus, type CampaignType } from '../services/campaignService'
import { success, error } from '../utils/response'

const app = new Hono()

// ============================================================================
// Campaign CRUD
// ============================================================================

app.get('/campaigns', (c) => {
  const user = requireAuth(c)

  const filters = {
    status: c.req.query('status') as CampaignLifecycleStatus | undefined,
    type: c.req.query('type') as CampaignType | undefined,
    folder: c.req.query('folder'),
    search: c.req.query('search'),
    page: parseInt(c.req.query('page') || '1'),
    limit: parseInt(c.req.query('limit') || '20'),
  }

  const { campaigns, total } = campaignService.list(user.id, filters)

  return c.json({
    success: true,
    data: campaigns,
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

app.post('/campaigns', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.name?.trim() || !body.subject?.trim() || !body.from_email?.trim() || !body.from_name?.trim()) {
    return error(c, 'Name, subject, from_email, and from_name are required', 400)
  }

  const campaign = campaignService.create(user.id, body)
  return success(c, campaign, 'Campaign created', 201)
})

app.get('/campaigns/dashboard', (c) => {
  const user = requireAuth(c)
  const stats = campaignService.getDashboardStats(user.id)
  return success(c, stats)
})

app.get('/campaigns/:id', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  if (campaignId === 'dashboard') return c.notFound()

  const campaign = campaignService.get(user.id, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)

  return success(c, campaign)
})

app.put('/campaigns/:id', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')
  const body = await c.req.json()

  const updated = campaignService.update(user.id, campaignId, body)
  if (!updated) return error(c, 'Campaign not found or cannot be edited', 404)

  return success(c, undefined, 'Campaign updated')
})

app.delete('/campaigns/:id', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const deleted = campaignService.delete(user.id, campaignId)
  if (!deleted) return error(c, 'Campaign not found or cannot be deleted', 404)

  return success(c, undefined, 'Campaign deleted')
})

// ============================================================================
// Campaign Lifecycle
// ============================================================================

app.post('/campaigns/:id/draft', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')
  const body = await c.req.json()

  const saved = campaignService.saveDraft(user.id, campaignId, body)
  if (!saved) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Draft saved')
})

app.post('/campaigns/:id/schedule', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')
  const body = await c.req.json()

  if (!body.scheduled_at) {
    return error(c, 'scheduled_at is required', 400)
  }

  const scheduled = campaignService.schedule(user.id, campaignId, body.scheduled_at)
  if (!scheduled) return error(c, 'Campaign not found or not in draft/testing status', 404)

  return success(c, undefined, 'Campaign scheduled')
})

app.post('/campaigns/:id/launch', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const launched = campaignService.setStatus(user.id, campaignId, 'sending')
  if (!launched) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign launched')
})

app.post('/campaigns/:id/pause', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const paused = campaignService.setStatus(user.id, campaignId, 'paused')
  if (!paused) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign paused')
})

app.post('/campaigns/:id/cancel', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const cancelled = campaignService.setStatus(user.id, campaignId, 'cancelled')
  if (!cancelled) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign cancelled')
})

app.post('/campaigns/:id/clone', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const cloned = campaignService.clone(user.id, campaignId)
  if (!cloned) return error(c, 'Campaign not found', 404)

  return success(c, cloned, 'Campaign cloned', 201)
})

app.post('/campaigns/:id/archive', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const archived = campaignService.setStatus(user.id, campaignId, 'archived')
  if (!archived) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign archived')
})

// ============================================================================
// Campaign Stats
// ============================================================================

app.get('/campaigns/:id/stats', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const stats = campaignService.getStats(user.id, campaignId)
  if (!stats) return error(c, 'Campaign not found', 404)

  return success(c, {
    total_recipients: stats.total_recipients,
    sent: stats.sent_count,
    failed: stats.failed_count,
    opened: stats.open_count,
    clicked: stats.click_count,
    bounced: stats.bounce_count,
    unsubscribed: stats.unsubscribe_count,
    open_rate: stats.sent_count > 0 ? Math.round((stats.open_count / stats.sent_count) * 100) / 100 : 0,
    click_rate: stats.sent_count > 0 ? Math.round((stats.click_count / stats.sent_count) * 100) / 100 : 0,
  })
})

// ============================================================================
// A/B Testing
// ============================================================================

app.post('/campaigns/:id/ab/variant', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')
  const body = await c.req.json()

  const campaign = campaignService.get(user.id, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)

  const variant = campaignService.createABVariant(campaignId, body.label || 'A', body.percentage || 50, {
    subject: body.subject,
    templateId: body.template_id,
    senderName: body.sender_name,
    senderEmail: body.sender_email,
  })

  return success(c, variant, 'Variant created', 201)
})

app.get('/campaigns/:id/ab/variants', (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')

  const campaign = campaignService.get(user.id, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)

  const variants = campaignService.getABVariants(campaignId)
  return success(c, { variants })
})

app.post('/campaigns/:id/ab/winner', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('id')
  const body = await c.req.json()

  if (!body.variant_id) return error(c, 'variant_id is required', 400)

  const declared = campaignService.declareWinner(campaignId, body.variant_id)
  if (!declared) return error(c, 'Variant not found', 404)

  return success(c, undefined, 'Winner declared')
})

export default app
