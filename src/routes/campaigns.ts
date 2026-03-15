// src/routes/campaigns.ts - Campaign Management API

import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, getOrgId } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { PERMISSIONS } from '../services/rbacService'
import { campaignService, type CampaignLifecycleStatus, type CampaignType } from '../services/campaignService'
import { success, error } from '../utils/response'
import { validateBody } from '../utils/validate'

// ============================================================================
// Schemas
// ============================================================================

const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  subject: z.string().min(1, 'Subject is required').max(500),
  from_email: z.string().email('Valid from_email is required'),
  from_name: z.string().min(1, 'from_name is required').max(200),
  type: z.enum(['regular', 'ab_test', 'automated', 'rss']).optional(),
  template_id: z.string().optional(),
  html_content: z.string().optional(),
  text_content: z.string().optional(),
  list_ids: z.array(z.string()).optional(),
  segment_ids: z.array(z.string()).optional(),
  config_id: z.string().optional(),
  folder: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
})

const UpdateCampaignSchema = CreateCampaignSchema.partial()

const ScheduleSchema = z.object({
  scheduled_at: z.string().min(1, 'scheduled_at is required'),
})

const ABVariantSchema = z.object({
  label: z.string().max(50).optional(),
  percentage: z.number().min(1).max(100).optional(),
  subject: z.string().max(500).optional(),
  template_id: z.string().optional(),
  sender_name: z.string().max(200).optional(),
  sender_email: z.string().email().optional(),
})

const ABWinnerSchema = z.object({
  variant_id: z.string().min(1, 'variant_id is required'),
})

const app = new Hono()

// ============================================================================
// Campaign CRUD
// ============================================================================

app.get('/campaigns', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)

  const filters = {
    status: c.req.query('status') as CampaignLifecycleStatus | undefined,
    type: c.req.query('type') as CampaignType | undefined,
    folder: c.req.query('folder'),
    search: c.req.query('search'),
    page: parseInt(c.req.query('page') || '1'),
    limit: parseInt(c.req.query('limit') || '20'),
  }

  const { campaigns, total } = campaignService.list(orgId, filters)

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

app.post('/campaigns', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const body = await validateBody(c, CreateCampaignSchema)

  const campaign = campaignService.create(orgId, user.id, body)
  return success(c, campaign, 'Campaign created', 201)
})

app.get('/campaigns/dashboard', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const stats = campaignService.getDashboardStats(orgId)
  return success(c, stats)
})

app.get('/campaigns/:id', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  if (campaignId === 'dashboard') return c.notFound()

  const campaign = campaignService.get(orgId, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)

  return success(c, campaign)
})

app.put('/campaigns/:id', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')
  const body = await validateBody(c, UpdateCampaignSchema)

  const updated = campaignService.update(orgId, campaignId, body)
  if (!updated) return error(c, 'Campaign not found or cannot be edited', 404)

  return success(c, undefined, 'Campaign updated')
})

app.delete('/campaigns/:id', requirePermission(PERMISSIONS.CAMPAIGNS_DELETE), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const deleted = campaignService.delete(orgId, campaignId)
  if (!deleted) return error(c, 'Campaign not found or cannot be deleted', 404)

  return success(c, undefined, 'Campaign deleted')
})

// ============================================================================
// Campaign Lifecycle
// ============================================================================

app.post('/campaigns/:id/draft', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')
  const body = await validateBody(c, UpdateCampaignSchema)

  const saved = campaignService.saveDraft(orgId, campaignId, body)
  if (!saved) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Draft saved')
})

app.post('/campaigns/:id/schedule', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')
  const { scheduled_at } = await validateBody(c, ScheduleSchema)

  const scheduled = campaignService.schedule(orgId, campaignId, scheduled_at)
  if (!scheduled) return error(c, 'Campaign not found or not in draft/testing status', 404)

  return success(c, undefined, 'Campaign scheduled')
})

app.post('/campaigns/:id/launch', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const launched = campaignService.setStatus(orgId, campaignId, 'sending')
  if (!launched) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign launched')
})

app.post('/campaigns/:id/pause', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const paused = campaignService.setStatus(orgId, campaignId, 'paused')
  if (!paused) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign paused')
})

app.post('/campaigns/:id/cancel', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const cancelled = campaignService.setStatus(orgId, campaignId, 'cancelled')
  if (!cancelled) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign cancelled')
})

app.post('/campaigns/:id/clone', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const cloned = campaignService.clone(orgId, user.id, campaignId)
  if (!cloned) return error(c, 'Campaign not found', 404)

  return success(c, cloned, 'Campaign cloned', 201)
})

app.post('/campaigns/:id/archive', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const archived = campaignService.setStatus(orgId, campaignId, 'archived')
  if (!archived) return error(c, 'Campaign not found', 404)

  return success(c, undefined, 'Campaign archived')
})

// ============================================================================
// Campaign Stats
// ============================================================================

app.get('/campaigns/:id/stats', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const stats = campaignService.getStats(orgId, campaignId)
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

app.post('/campaigns/:id/ab/variant', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')
  const body = await validateBody(c, ABVariantSchema)

  const campaign = campaignService.get(orgId, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)

  const variant = campaignService.createABVariant(campaignId, body.label || 'A', body.percentage || 50, {
    subject: body.subject,
    templateId: body.template_id,
    senderName: body.sender_name,
    senderEmail: body.sender_email,
  })

  return success(c, variant, 'Variant created', 201)
})

app.get('/campaigns/:id/ab/variants', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const campaign = campaignService.get(orgId, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)

  const variants = campaignService.getABVariants(campaignId)
  return success(c, { variants })
})

app.post('/campaigns/:id/ab/winner', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const campaignId = c.req.param('id')
  const { variant_id } = await validateBody(c, ABWinnerSchema)

  const declared = campaignService.declareWinner(campaignId, variant_id)
  if (!declared) return error(c, 'Variant not found', 404)

  return success(c, undefined, 'Winner declared')
})

export default app
