// src/routes/analytics.ts - Advanced Analytics Endpoints

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { success, error } from '../utils/response'
import { analyticsService } from '../services/analyticsService'

const app = new Hono()

// Get analytics summary
app.get('/analytics/summary', async (c) => {
  const user = requireAuth(c)
  const summary = analyticsService.getSummary(user.id)
  return success(c, summary)
})

// Get campaign report
app.get('/analytics/campaigns/:campaignId', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('campaignId')
  const report = analyticsService.getCampaignReport(user.id, campaignId)

  if (!report) return error(c, 'No analytics data for this campaign', 404)
  return success(c, report)
})

// List all campaign reports
app.get('/analytics/campaigns', async (c) => {
  const user = requireAuth(c)
  const limit = parseInt(c.req.query('limit') || '50')
  const reports = analyticsService.listCampaignReports(user.id, limit)
  return success(c, { reports })
})

// Get link click map for campaign
app.get('/analytics/campaigns/:campaignId/links', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('campaignId')
  const links = analyticsService.getLinkClicks(user.id, campaignId)
  return success(c, { links })
})

// Get device breakdown
app.get('/analytics/devices', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.query('campaign_id')
  const clients = analyticsService.getDeviceBreakdown(user.id, campaignId || undefined)
  const devices = analyticsService.getDeviceTypeBreakdown(user.id, campaignId || undefined)
  return success(c, { clients, devices })
})

// Get geographic breakdown
app.get('/analytics/geo', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.query('campaign_id')
  const geo = analyticsService.getGeoBreakdown(user.id, campaignId || undefined)
  return success(c, { geo })
})

// Get time analysis (best send times)
app.get('/analytics/time', async (c) => {
  const user = requireAuth(c)
  const analysis = analyticsService.getTimeAnalysis(user.id)
  const recommendation = analyticsService.getBestSendTime(user.id)
  return success(c, { analysis, recommendation })
})

// Export campaign report
app.get('/analytics/export/campaign/:campaignId', async (c) => {
  const user = requireAuth(c)
  const campaignId = c.req.param('campaignId')
  const format = (c.req.query('format') || 'json') as 'csv' | 'json'
  const exportData = analyticsService.exportCampaignReport(user.id, campaignId, format)

  if (!exportData) return error(c, 'No data to export', 404)

  const contentType = format === 'csv' ? 'text/csv' : 'application/json'
  c.header('Content-Type', contentType)
  c.header('Content-Disposition', `attachment; filename="${exportData.filename}"`)
  return c.body(exportData.data)
})

// Export summary
app.get('/analytics/export/summary', async (c) => {
  const user = requireAuth(c)
  const format = (c.req.query('format') || 'json') as 'csv' | 'json'
  const exportData = analyticsService.exportSummary(user.id, format)

  const contentType = format === 'csv' ? 'text/csv' : 'application/json'
  c.header('Content-Type', contentType)
  c.header('Content-Disposition', `attachment; filename="${exportData.filename}"`)
  return c.body(exportData.data)
})

// Record analytics event (internal/webhook use)
app.post('/analytics/events', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.eventType || !['open', 'click', 'bounce', 'unsubscribe'].includes(body.eventType)) {
    return error(c, 'Valid eventType required: open, click, bounce, unsubscribe')
  }

  analyticsService.recordEvent(user.id, {
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
app.post('/analytics/seed', async (c) => {
  const user = requireAuth(c)
  const { campaignId, campaignName, stats } = await c.req.json()

  if (!campaignId || !stats) {
    return error(c, 'campaignId and stats required')
  }

  analyticsService.seedFromCampaign(user.id, campaignId, campaignName || '', stats)
  return success(c, null, 'Campaign analytics seeded')
})

export default app
