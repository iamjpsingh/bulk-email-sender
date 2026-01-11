/**
 * Report Routes
 * Email logs, stats, and exports
 */
import { Hono } from 'hono'
import { d1Service } from '../services/d1Service'
import { logService } from '../services/logService'
import { requireAuth } from '../middleware/auth'
import { success, error } from '../utils/response'
import { parseIntSafe } from '../utils/validation'

const app = new Hono()

// ============================================================================
// Logs & Stats
// ============================================================================

/**
 * Get email logs with filtering
 * GET /report/logs
 */
app.get('/report/logs', async (c) => {
  const user = requireAuth(c)
  const filters = extractFilters(c)

  // Try Worker API first
  if (d1Service.isConfigured()) {
    try {
      const result = await d1Service.getLogs(user.id, filters)
      if (result) {
        return success(c, {
          logs: result.logs,
          stats: result.stats,
          pagination: result.pagination,
        })
      }
    } catch (err) {
      console.error('Worker API error:', err)
    }
  }

  // Fallback to local logs
  return success(c, {
    logs: logService.getLogs(),
    stats: logService.getStats(),
  })
})

/**
 * Get stats
 * GET /report/stats
 */
app.get('/report/stats', async (c) => {
  const user = requireAuth(c)

  if (d1Service.isConfigured()) {
    try {
      const stats = await d1Service.getStats(user.id)
      if (stats) {
        return success(c, stats)
      }
    } catch (err) {
      console.error('Worker API error:', err)
    }
  }

  return success(c, logService.getStats())
})

/**
 * Legacy report endpoint
 * GET /report
 */
app.get('/report', async (c) => {
  const user = requireAuth(c)

  if (d1Service.isConfigured()) {
    try {
      const result = await d1Service.getLogs(user.id, { limit: 100 })
      if (result) {
        return success(c, { logs: result.logs, stats: result.stats })
      }
    } catch (err) {
      console.error('Worker API error:', err)
    }
  }

  return success(c, {
    logs: logService.getLogs(),
    stats: logService.getStats(),
  })
})

// ============================================================================
// Export
// ============================================================================

/**
 * Export logs as CSV
 * GET /report/export/csv
 */
app.get('/report/export/csv', async (c) => {
  const user = requireAuth(c)
  const logs = await fetchLogsForExport(user.id, c)

  const csv = generateCSV(logs)
  const filename = `email-logs-${new Date().toISOString().split('T')[0]}.csv`

  c.header('Content-Type', 'text/csv')
  c.header('Content-Disposition', `attachment; filename="${filename}"`)

  return c.text(csv)
})

/**
 * Export logs as JSON
 * GET /report/export/json
 */
app.get('/report/export/json', async (c) => {
  const user = requireAuth(c)
  const logs = await fetchLogsForExport(user.id, c)

  const filename = `email-logs-${new Date().toISOString().split('T')[0]}.json`

  c.header('Content-Type', 'application/json')
  c.header('Content-Disposition', `attachment; filename="${filename}"`)

  return c.text(JSON.stringify(logs, null, 2))
})

// ============================================================================
// Delete Logs
// ============================================================================

/**
 * Delete single log
 * DELETE /report/logs/:id
 */
app.delete('/report/logs/:id', async (c) => {
  const user = requireAuth(c)
  const logId = c.req.param('id')
  
  console.log(`🗑️ Delete request: logId=${logId}, userId=${user.id}`)

  if (d1Service.isConfigured()) {
    try {
      const result = await d1Service.deleteLog(user.id, logId)
      console.log(`🗑️ Delete result: ${result}`)
      return success(c, undefined, 'Log deleted')
    } catch (err) {
      console.error('Delete log error:', err)
      return error(c, 'Failed to delete log', 500)
    }
  }

  // Local fallback
  logService.deleteLog(logId)
  return success(c, undefined, 'Log deleted')
})

/**
 * Delete multiple logs (bulk)
 * POST /report/logs/delete-bulk
 */
app.post('/report/logs/delete-bulk', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()
  const { ids } = body as { ids: string[] }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return error(c, 'No log IDs provided', 400)
  }

  if (d1Service.isConfigured()) {
    try {
      await d1Service.deleteLogs(user.id, ids)
      return success(c, { deleted: ids.length }, `${ids.length} logs deleted`)
    } catch (err) {
      console.error('Bulk delete error:', err)
      return error(c, 'Failed to delete logs', 500)
    }
  }

  // Local fallback
  ids.forEach(id => logService.deleteLog(id))
  return success(c, { deleted: ids.length }, `${ids.length} logs deleted`)
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract filter parameters from request
 */
function extractFilters(c: any) {
  return {
    status: c.req.query('status'),
    sendType: c.req.query('send_type'),
    provider: c.req.query('provider'),
    campaignId: c.req.query('campaign_id'),
    search: c.req.query('search'),
    startDate: c.req.query('start_date'),
    endDate: c.req.query('end_date'),
    page: parseIntSafe(c.req.query('page'), 1),
    limit: parseIntSafe(c.req.query('limit'), 50),
  }
}

/**
 * Fetch logs for export (shared logic)
 */
async function fetchLogsForExport(userId: string, c: any): Promise<any[]> {
  if (d1Service.isConfigured()) {
    try {
      const result = await d1Service.getLogs(userId, {
        status: c.req.query('status'),
        sendType: c.req.query('send_type'),
        provider: c.req.query('provider'),
        startDate: c.req.query('start_date'),
        endDate: c.req.query('end_date'),
        limit: 10000,
      })
      if (result?.logs) return result.logs
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  return logService.getLogs()
}

/**
 * Generate CSV from logs
 */
function generateCSV(logs: any[]): string {
  const headers = [
    'ID',
    'Email',
    'Name',
    'Subject',
    'Status',
    'Send Type',
    'Provider',
    'Config',
    'Sent At',
    'Opened At',
    'Opens',
    'Clicks',
  ]

  const rows = logs.map((log) => [
    log.id || log.tracking_id,
    log.recipient_email || log.email,
    log.recipient_name || log.firstName || '',
    log.subject,
    log.status,
    log.send_type || 'direct',
    log.provider_type || 'smtp',
    log.config_name || '',
    log.sent_at || log.timestamp,
    log.opened_at || '',
    log.open_count || 0,
    log.click_count || 0,
  ])

  const escapeCSV = (cell: any) => `"${String(cell).replace(/"/g, '""')}"`

  return [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n')
}

export default app
