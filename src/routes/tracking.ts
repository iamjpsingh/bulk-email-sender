/**
 * Tracking Routes
 * Status check for tracking configuration
 */
import { Hono } from 'hono'
import { d1Service } from '../services/d1Service'
import { success } from '../utils/response'

const app = new Hono()

/**
 * Get tracking status
 * GET /track/status
 */
app.get('/track/status', (c) => {
  return success(c, {
    enabled: d1Service.isConfigured(),
    workerUrl: d1Service.getWorkerUrl(),
  })
})

export default app
