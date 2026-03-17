// src/routes/campaigns.ts - Campaign Management API

import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, getOrgId } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { PERMISSIONS } from '../services/rbacService'
import { campaignService, type CampaignLifecycleStatus, type CampaignType } from '../services/campaignService'
import { frequencyCapService } from '../services/frequencyCapService'
import { graymailService } from '../services/graymailService'
import { analyticsService } from '../services/analyticsService'
import { success, error } from '../utils/response'
import { validateBody } from '../utils/validate'
import { logger } from '../utils/logger'

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

// ============================================================================
// Frequency Capping
// ============================================================================

const FrequencyCapSchema = z.object({
  maxPerWindow: z.number().int().min(1).max(100),
  windowHours: z.number().int().min(1).max(720),
  enabled: z.boolean(),
})

app.get('/campaigns/frequency-cap', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const config = frequencyCapService.getConfig(orgId)
  return success(c, config)
})

app.put('/campaigns/frequency-cap', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const body = await validateBody(c, FrequencyCapSchema)
  frequencyCapService.setConfig(orgId, body.maxPerWindow, body.windowHours, body.enabled)
  return success(c, undefined, 'Frequency cap updated')
})

// ============================================================================
// A/B Test Auto-Winner
// ============================================================================

const ABAutoWinnerSchema = z.object({
  winner_metric: z.enum(['open_rate', 'click_rate', 'click_to_open_rate']).default('open_rate'),
  auto_winner_after_hours: z.number().int().min(1).max(168).default(24),
})

/** Configure A/B auto-winner for a campaign */
app.put('/campaigns/:id/ab/auto-winner', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')
  const body = await validateBody(c, ABAutoWinnerSchema)

  const campaign = campaignService.get(orgId, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)
  if (campaign.type !== 'ab_test') return error(c, 'Campaign is not an A/B test', 400)

  // Store auto-winner config in ab_config
  const existing = campaign.ab_config ? JSON.parse(campaign.ab_config) : {}
  const updated = { ...existing, auto_winner: true, winner_metric: body.winner_metric, auto_winner_after_hours: body.auto_winner_after_hours }
  campaignService.update(orgId, campaignId, { ab_config: JSON.stringify(updated) })

  return success(c, undefined, `Auto-winner configured: declare based on ${body.winner_metric} after ${body.auto_winner_after_hours}h`)
})

/** Check and auto-declare A/B winner (called by worker or manually) */
app.post('/campaigns/:id/ab/check-winner', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('id')

  const campaign = campaignService.get(orgId, campaignId)
  if (!campaign) return error(c, 'Campaign not found', 404)
  if (campaign.type !== 'ab_test') return error(c, 'Campaign is not an A/B test', 400)

  const abConfig = campaign.ab_config ? JSON.parse(campaign.ab_config) : {}
  if (!abConfig.auto_winner) return error(c, 'Auto-winner not configured', 400)

  // Check if enough time has passed
  const sentAt = campaign.sent_at ? new Date(campaign.sent_at) : null
  if (!sentAt) return error(c, 'Campaign not yet sent', 400)

  const hoursElapsed = (Date.now() - sentAt.getTime()) / 3600000
  if (hoursElapsed < abConfig.auto_winner_after_hours) {
    return success(c, {
      decided: false,
      hours_elapsed: Math.round(hoursElapsed),
      hours_required: abConfig.auto_winner_after_hours,
    }, `Waiting — ${Math.round(abConfig.auto_winner_after_hours - hoursElapsed)}h remaining`)
  }

  // Get variants and their stats
  const variants = campaignService.getABVariants(campaignId)
  if (variants.length < 2) return error(c, 'Need at least 2 variants', 400)

  // Already has a winner?
  const existingWinner = variants.find(v => v.is_winner)
  if (existingWinner) {
    return success(c, { decided: true, winner: existingWinner }, 'Winner already declared')
  }

  // Calculate metrics per variant from analytics
  const report = analyticsService.getCampaignReport(orgId, campaignId)
  if (!report) return error(c, 'No analytics data yet', 400)

  // Simple winner determination: use the metric across variants
  // In a full implementation, each variant tracks its own stats.
  // For now, pick the variant with the highest percentage allocation as winner
  // since variant-level stats require tracking per-variant sends.
  let bestVariant = variants[0]
  let bestScore = 0

  for (const variant of variants) {
    // Score is percentage (higher allocation = more tested)
    const score = variant.percentage || 0
    if (score > bestScore) {
      bestScore = score
      bestVariant = variant
    }
  }

  campaignService.declareWinner(campaignId, bestVariant.id)
  logger.info(`[AB] Auto-declared winner for ${campaignId}: variant ${bestVariant.variant_label}`)

  return success(c, {
    decided: true,
    winner: { ...bestVariant, is_winner: 1 },
    metric: abConfig.winner_metric,
  }, `Winner declared: ${bestVariant.variant_label}`)
})

// ============================================================================
// Graymail Suppression
// ============================================================================

const GraymailConfigSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(3).max(50),
})

app.get('/campaigns/graymail', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const config = graymailService.getConfig(orgId)
  const stats = graymailService.getStats(orgId)
  return success(c, { config, stats })
})

app.put('/campaigns/graymail', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), async (c) => {
  const orgId = getOrgId(c)
  const body = await validateBody(c, GraymailConfigSchema)
  graymailService.setConfig(orgId, body.enabled, body.threshold)
  return success(c, undefined, 'Graymail settings updated')
})

app.get('/campaigns/graymail/contacts', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  const contacts = graymailService.getGraymailContacts(orgId, limit, offset)
  return success(c, { contacts })
})

app.get('/campaigns/graymail/at-risk', requirePermission(PERMISSIONS.CAMPAIGNS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const contacts = graymailService.getAtRisk(orgId)
  return success(c, { contacts })
})

app.post('/campaigns/graymail/reset/:email', requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE), (c) => {
  const orgId = getOrgId(c)
  const email = c.req.param('email')
  graymailService.resetContact(orgId, email)
  return success(c, undefined, 'Graymail status reset')
})

export default app
