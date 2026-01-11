/**
 * Dashboard Routes
 * Stats, polling status, and real-time data
 */
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { logService } from '../services/logService'
import { success, error } from '../utils/response'

// Lazy-loaded services
let batchService: any = null
let schedulerService: any = null

/**
 * Get batch service (lazy load)
 */
function getBatchService() {
  if (!batchService) {
    try {
      batchService = require('../services/batchService').batchService
    } catch {
      return null
    }
  }
  return batchService
}

/**
 * Get scheduler service (lazy load)
 */
function getSchedulerService() {
  if (!schedulerService) {
    try {
      schedulerService = require('../services/schedulerService').schedulerService
    } catch {
      return null
    }
  }
  return schedulerService
}

// Dashboard state cache
const dashboardCache = {
  lastBatchCheck: 0,
  lastScheduledCheck: 0,
  hasBatchJobs: false,
  hasScheduledJobs: false,
  cacheValidFor: 5000, // 5 seconds
}

const app = new Hono()

/**
 * Get dashboard stats
 * GET /dashboard/stats
 */
app.get('/dashboard/stats', (c) => {
  requireAuth(c)

  try {
    const batch = getBatchService()
    const scheduler = getSchedulerService()

    const batchStatus = batch?.getBatchStatus() ?? null
    const scheduledJobs = scheduler?.getScheduledJobs() ?? []
    const allLogs = logService.getLogs() ?? []

    return success(c, {
      stats: logService.getStats(),
      batch: batchStatus,
      scheduledJobs,
      recentLogs: allLogs.slice(0, 10),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return success(c, {
      stats: { sent: 0, failed: 0, total: 0 },
      batch: null,
      scheduledJobs: [],
      recentLogs: [],
      timestamp: new Date().toISOString(),
    })
  }
})

/**
 * Get polling status (lightweight)
 * GET /dashboard/poll-status
 */
app.get('/dashboard/poll-status', (c) => {
  requireAuth(c)

  try {
    const now = Date.now()
    let hasActiveBatch = false
    let hasScheduledJobs = false
    let hasRunningScheduledJobs = false

    // Check batch status (with cache)
    if (now - dashboardCache.lastBatchCheck < dashboardCache.cacheValidFor) {
      hasActiveBatch = dashboardCache.hasBatchJobs
    } else {
      const batch = getBatchService()
      if (batch) {
        const status = batch.getBatchStatus()
        hasActiveBatch = status?.isRunning ?? false
        dashboardCache.hasBatchJobs = hasActiveBatch
        dashboardCache.lastBatchCheck = now
      }
    }

    // Check scheduled jobs (with cache)
    if (now - dashboardCache.lastScheduledCheck < dashboardCache.cacheValidFor) {
      hasScheduledJobs = dashboardCache.hasScheduledJobs
    } else {
      const scheduler = getSchedulerService()
      if (scheduler) {
        const jobs = scheduler.getScheduledJobs() ?? []
        hasScheduledJobs = jobs.length > 0
        hasRunningScheduledJobs = jobs.some((j: any) => j.status === 'running')
        dashboardCache.hasScheduledJobs = hasScheduledJobs
        dashboardCache.lastScheduledCheck = now
      }
    }

    // Determine polling interval
    let pollNeeded = false
    let pollInterval = 30000 // Default: 30s

    if (hasActiveBatch) {
      pollNeeded = true
      pollInterval = 3000 // Fast: 3s for active batch
    } else if (hasRunningScheduledJobs) {
      pollNeeded = true
      pollInterval = 10000 // Medium: 10s for running scheduled
    } else if (hasScheduledJobs) {
      pollNeeded = true
      pollInterval = 30000 // Slow: 30s for pending scheduled
    }

    return success(c, {
      pollNeeded,
      pollInterval,
      hasActiveBatch,
      hasScheduledJobs,
      hasRunningScheduledJobs,
      activeBatchCount: hasActiveBatch ? 1 : 0,
      scheduledJobCount: hasScheduledJobs ? 1 : 0,
      lastUpdated: new Date().toISOString(),
      cached: true,
    })
  } catch (err) {
    console.error('Poll status error:', err)
    return success(c, {
      pollNeeded: false,
      pollInterval: 30000,
      hasActiveBatch: false,
      hasScheduledJobs: false,
      hasRunningScheduledJobs: false,
      activeBatchCount: 0,
      scheduledJobCount: 0,
      lastUpdated: new Date().toISOString(),
      error: 'Service unavailable',
    })
  }
})

/**
 * Get dashboard data (optimized)
 * GET /dashboard/data
 */
app.get('/dashboard/data', (c) => {
  requireAuth(c)

  try {
    let batchStatus = null
    let scheduledJobs: any[] = []

    // Only fetch if we know there's data
    if (dashboardCache.hasBatchJobs) {
      const batch = getBatchService()
      batchStatus = batch?.getBatchStatus() ?? null
    }

    if (dashboardCache.hasScheduledJobs) {
      const scheduler = getSchedulerService()
      const allJobs = scheduler?.getScheduledJobs() ?? []
      scheduledJobs = allJobs
        .filter((j: any) => j.status === 'scheduled' || j.status === 'running')
        .slice(0, 5)
    }

    return success(c, {
      batch: batchStatus,
      scheduledJobs,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard data error:', err)
    return error(c, 'Failed to fetch dashboard data', 500)
  }
})

export default app
