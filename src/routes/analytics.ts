// src/routes/analytics.ts - Advanced Analytics Endpoints

import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, getOrgId } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { PERMISSIONS } from '../services/rbacService'
import { success, error } from '../utils/response'
import { analyticsService } from '../services/analyticsService'
import { validateBody } from '../utils/validate'

// ============================================================================
// Schemas
// ============================================================================

const RecordEventSchema = z.object({
  eventType: z.enum(['open', 'click', 'bounce', 'unsubscribe']),
  campaignId: z.string().optional(),
  recipientEmail: z.string().optional(),
  userAgent: z.string().optional(),
  url: z.string().optional(),
  geoCountry: z.string().optional(),
  geoCity: z.string().optional(),
})

const SeedSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  campaignName: z.string().optional(),
  stats: z.record(z.unknown()),
})

const app = new Hono()

// Get analytics summary
app.get('/analytics/summary', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const summary = analyticsService.getSummary(orgId)
  return success(c, summary)
})

// Get campaign report
app.get('/analytics/campaigns/:campaignId', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('campaignId')
  const report = analyticsService.getCampaignReport(orgId, campaignId)

  if (!report) return error(c, 'No analytics data for this campaign', 404)
  return success(c, report)
})

// List all campaign reports
app.get('/analytics/campaigns', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const limit = parseInt(c.req.query('limit') || '50')
  const reports = analyticsService.listCampaignReports(orgId, limit)
  return success(c, { reports })
})

// Get link click map for campaign
app.get('/analytics/campaigns/:campaignId/links', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('campaignId')
  const links = analyticsService.getLinkClicks(orgId, campaignId)
  return success(c, { links })
})

// Get device breakdown
app.get('/analytics/devices', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.query('campaign_id')
  const clients = analyticsService.getDeviceBreakdown(orgId, campaignId || undefined)
  const devices = analyticsService.getDeviceTypeBreakdown(orgId, campaignId || undefined)
  return success(c, { clients, devices })
})

// Get geographic breakdown
app.get('/analytics/geo', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.query('campaign_id')
  const geo = analyticsService.getGeoBreakdown(orgId, campaignId || undefined)
  return success(c, { geo })
})

// Get time analysis (best send times)
app.get('/analytics/time', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const analysis = analyticsService.getTimeAnalysis(orgId)
  const recommendation = analyticsService.getBestSendTime(orgId)
  return success(c, { analysis, recommendation })
})

// Export campaign report
app.get('/analytics/export/campaign/:campaignId', requirePermission(PERMISSIONS.ANALYTICS_EXPORT), async (c) => {
  const orgId = getOrgId(c)
  const campaignId = c.req.param('campaignId')
  const format = (c.req.query('format') || 'json') as 'csv' | 'json'
  const exportData = analyticsService.exportCampaignReport(orgId, campaignId, format)

  if (!exportData) return error(c, 'No data to export', 404)

  const contentType = format === 'csv' ? 'text/csv' : 'application/json'
  c.header('Content-Type', contentType)
  c.header('Content-Disposition', `attachment; filename="${exportData.filename}"`)
  return c.body(exportData.data)
})

// Export summary
app.get('/analytics/export/summary', requirePermission(PERMISSIONS.ANALYTICS_EXPORT), async (c) => {
  const orgId = getOrgId(c)
  const format = (c.req.query('format') || 'json') as 'csv' | 'json'
  const exportData = analyticsService.exportSummary(orgId, format)

  const contentType = format === 'csv' ? 'text/csv' : 'application/json'
  c.header('Content-Type', contentType)
  c.header('Content-Disposition', `attachment; filename="${exportData.filename}"`)
  return c.body(exportData.data)
})

// Record analytics event (internal/webhook use)
app.post('/analytics/events', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const body = await validateBody(c, RecordEventSchema)

  analyticsService.recordEvent(orgId, {
    campaignId: body.campaignId,
    eventType: body.eventType,
    recipientEmail: body.recipientEmail,
    userAgent: body.userAgent,
    url: body.url,
    geoCountry: body.geoCountry,
    geoCity: body.geoCity,
  })

  return success(c, null, 'Event recorded')
})

// Seed campaign analytics from existing data
app.post('/analytics/seed', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const { campaignId, campaignName, stats } = await validateBody(c, SeedSchema)

  analyticsService.seedFromCampaign(orgId, campaignId, campaignName || '', stats)
  return success(c, null, 'Campaign analytics seeded')
})

// ============================================================================
// Email Health Dashboard
// ============================================================================

app.get('/analytics/email-health', requirePermission(PERMISSIONS.ANALYTICS_VIEW), async (c) => {
  const orgId = getOrgId(c)
  const summary = analyticsService.getSummary(orgId)

  // Calculate rates from summary data
  const totalSent = summary.totalSent || 1
  const bounceRate = ((summary.totalBounced || 0) / totalSent) * 100
  const complaintRate = ((summary.totalComplaints || 0) / totalSent) * 100
  const unsubRate = ((summary.totalUnsubscribed || 0) / totalSent) * 100
  const openRate = ((summary.totalOpened || 0) / totalSent) * 100
  const clickRate = ((summary.totalClicked || 0) / totalSent) * 100

  // Score: Excellent (90+), Good (70-89), Needs Improvement (50-69), Poor (<50)
  let score = 100
  const recommendations: string[] = []

  // Bounce rate penalty
  if (bounceRate > 5) { score -= 30; recommendations.push(`Bounce rate is ${bounceRate.toFixed(1)}% (target: <2%). Clean your list and validate emails before sending.`) }
  else if (bounceRate > 2) { score -= 15; recommendations.push(`Bounce rate is ${bounceRate.toFixed(1)}% (target: <2%). Consider validating your contact list.`) }

  // Complaint rate penalty
  if (complaintRate > 0.5) { score -= 30; recommendations.push(`Complaint rate is ${complaintRate.toFixed(2)}% (target: <0.1%). Review your content and sending frequency.`) }
  else if (complaintRate > 0.1) { score -= 15; recommendations.push(`Complaint rate is ${complaintRate.toFixed(2)}% (target: <0.1%). Consider adding an unsubscribe link.`) }

  // Unsubscribe rate penalty
  if (unsubRate > 2) { score -= 15; recommendations.push(`Unsubscribe rate is ${unsubRate.toFixed(1)}% (target: <0.5%). Segment your audience for more relevant content.`) }
  else if (unsubRate > 0.5) { score -= 5; recommendations.push(`Unsubscribe rate is ${unsubRate.toFixed(1)}% — within acceptable range but could improve.`) }

  // Low engagement penalty
  if (openRate < 10) { score -= 20; recommendations.push(`Open rate is ${openRate.toFixed(1)}% (benchmark: >20%). Improve subject lines and send time.`) }
  else if (openRate < 20) { score -= 10; recommendations.push(`Open rate is ${openRate.toFixed(1)}% (benchmark: >20%). Test different subject lines.`) }

  score = Math.max(0, score)

  let rating: string
  if (score >= 90) rating = 'Excellent'
  else if (score >= 70) rating = 'Good'
  else if (score >= 50) rating = 'Needs Improvement'
  else rating = 'Poor'

  return success(c, {
    score,
    rating,
    metrics: {
      bounce_rate: +bounceRate.toFixed(2),
      complaint_rate: +complaintRate.toFixed(3),
      unsubscribe_rate: +unsubRate.toFixed(2),
      open_rate: +openRate.toFixed(2),
      click_rate: +clickRate.toFixed(2),
      total_sent: totalSent,
    },
    recommendations,
  })
})

export default app
