// src/routes/analytics.ts - Advanced Analytics Endpoints

import { Hono } from 'hono'
import { requireAuth, getOrgId } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { PERMISSIONS } from '../services/rbacService'
import { success, error } from '../utils/response'
import { analyticsService } from '../services/analyticsService'

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
  const body = await c.req.json()

  if (!body.eventType || !['open', 'click', 'bounce', 'unsubscribe'].includes(body.eventType)) {
    return error(c, 'Valid eventType required: open, click, bounce, unsubscribe')
  }

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
  const { campaignId, campaignName, stats } = await c.req.json()

  if (!campaignId || !stats) {
    return error(c, 'campaignId and stats required')
  }

  analyticsService.seedFromCampaign(orgId, campaignId, campaignName || '', stats)
  return success(c, null, 'Campaign analytics seeded')
})

export default app
