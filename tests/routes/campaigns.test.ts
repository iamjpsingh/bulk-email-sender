import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// Mock dependencies before importing routes
vi.mock('../../src/services/campaignService', () => ({
  campaignService: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    saveDraft: vi.fn(),
    schedule: vi.fn(),
    setStatus: vi.fn(),
    clone: vi.fn(),
    getDashboardStats: vi.fn(),
    getStats: vi.fn(),
    createABVariant: vi.fn(),
    getABVariants: vi.fn(),
    declareWinner: vi.fn(),
  },
}))

vi.mock('../../src/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))

import { campaignService } from '../../src/services/campaignService'
import campaignRoutes from '../../src/routes/campaigns'

const TEST_USER = { id: 'user-1', email: 'test@test.com', name: 'Test User' }

function createApp() {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.user = TEST_USER as any
    await next()
  })
  app.route('/', campaignRoutes)
  return app
}

function jsonRequest(method: string, path: string, body?: object) {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new Request(`http://localhost${path}`, init)
}

const SAMPLE_CAMPAIGN = {
  id: 'camp-1',
  name: 'Test Campaign',
  subject: 'Hello World',
  from_email: 'sender@example.com',
  from_name: 'Sender',
  status: 'draft',
  type: 'regular',
  created_at: '2025-01-01T00:00:00Z',
}

describe('Campaign Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // GET /campaigns
  // ==========================================================================
  describe('GET /campaigns', () => {
    it('returns a paginated list of campaigns', async () => {
      const app = createApp()
      vi.mocked(campaignService.list).mockReturnValue({
        campaigns: [SAMPLE_CAMPAIGN],
        total: 1,
      })

      const res = await app.fetch(new Request('http://localhost/campaigns'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.meta.pagination.total).toBe(1)
      expect(body.meta.pagination.page).toBe(1)
    })

    it('passes filter params to the service', async () => {
      const app = createApp()
      vi.mocked(campaignService.list).mockReturnValue({ campaigns: [], total: 0 })

      await app.fetch(new Request('http://localhost/campaigns?status=draft&type=regular&search=hello&page=2&limit=10'))

      expect(campaignService.list).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          status: 'draft',
          type: 'regular',
          search: 'hello',
          page: 2,
          limit: 10,
        })
      )
    })

    it('returns empty array when no campaigns exist', async () => {
      const app = createApp()
      vi.mocked(campaignService.list).mockReturnValue({ campaigns: [], total: 0 })

      const res = await app.fetch(new Request('http://localhost/campaigns'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
      expect(body.meta.pagination.total).toBe(0)
    })
  })

  // ==========================================================================
  // POST /campaigns
  // ==========================================================================
  describe('POST /campaigns', () => {
    const validPayload = {
      name: 'New Campaign',
      subject: 'Hello',
      from_email: 'sender@example.com',
      from_name: 'Sender',
    }

    it('creates a new campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.create).mockReturnValue({
        ...SAMPLE_CAMPAIGN,
        id: 'camp-new',
      })

      const res = await app.fetch(jsonRequest('POST', '/campaigns', validPayload))

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('camp-new')
      expect(body.message).toBe('Campaign created')
    })

    it('returns 400 when name is missing', async () => {
      const app = createApp()

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns', {
          subject: 'Hello',
          from_email: 'a@b.com',
          from_name: 'Sender',
        })
      )

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toContain('required')
    })

    it('returns 400 when subject is missing', async () => {
      const app = createApp()

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns', {
          name: 'Campaign',
          from_email: 'a@b.com',
          from_name: 'Sender',
        })
      )

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
    })

    it('returns 400 when from_email is missing', async () => {
      const app = createApp()

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns', {
          name: 'Campaign',
          subject: 'Hello',
          from_name: 'Sender',
        })
      )

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
    })

    it('returns 400 when from_name is missing', async () => {
      const app = createApp()

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns', {
          name: 'Campaign',
          subject: 'Hello',
          from_email: 'a@b.com',
        })
      )

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  // ==========================================================================
  // GET /campaigns/:id
  // ==========================================================================
  describe('GET /campaigns/:id', () => {
    it('returns a specific campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.get).mockReturnValue(SAMPLE_CAMPAIGN)

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('camp-1')
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.get).mockReturnValue(null)

      const res = await app.fetch(new Request('http://localhost/campaigns/nonexistent'))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toContain('not found')
    })
  })

  // ==========================================================================
  // PUT /campaigns/:id
  // ==========================================================================
  describe('PUT /campaigns/:id', () => {
    it('updates a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.update).mockReturnValue(true)

      const res = await app.fetch(jsonRequest('PUT', '/campaigns/camp-1', { name: 'Updated Campaign' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('updated')
    })

    it('returns 404 when campaign not found or cannot be edited', async () => {
      const app = createApp()
      vi.mocked(campaignService.update).mockReturnValue(false)

      const res = await app.fetch(jsonRequest('PUT', '/campaigns/nonexistent', { name: 'X' }))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  // ==========================================================================
  // DELETE /campaigns/:id
  // ==========================================================================
  describe('DELETE /campaigns/:id', () => {
    it('deletes a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.delete).mockReturnValue(true)

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1', { method: 'DELETE' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('deleted')
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.delete).mockReturnValue(false)

      const res = await app.fetch(new Request('http://localhost/campaigns/nonexistent', { method: 'DELETE' }))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  // ==========================================================================
  // Campaign Lifecycle
  // ==========================================================================
  describe('POST /campaigns/:id/draft', () => {
    it('saves a draft', async () => {
      const app = createApp()
      vi.mocked(campaignService.saveDraft).mockReturnValue(true)

      const res = await app.fetch(jsonRequest('POST', '/campaigns/camp-1/draft', { html_content: '<p>Hi</p>' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('Draft saved')
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.saveDraft).mockReturnValue(false)

      const res = await app.fetch(jsonRequest('POST', '/campaigns/nonexistent/draft', {}))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  describe('POST /campaigns/:id/schedule', () => {
    it('schedules a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.schedule).mockReturnValue(true)

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns/camp-1/schedule', {
          scheduled_at: '2025-06-01T12:00:00Z',
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('scheduled')
    })

    it('returns 400 when scheduled_at is missing', async () => {
      const app = createApp()

      const res = await app.fetch(jsonRequest('POST', '/campaigns/camp-1/schedule', {}))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toContain('scheduled_at')
    })

    it('returns 404 when campaign is not found or wrong status', async () => {
      const app = createApp()
      vi.mocked(campaignService.schedule).mockReturnValue(false)

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns/camp-1/schedule', {
          scheduled_at: '2025-06-01T12:00:00Z',
        })
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  describe('POST /campaigns/:id/launch', () => {
    it('launches a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.setStatus).mockReturnValue(true)

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1/launch', { method: 'POST' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('launched')
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.setStatus).mockReturnValue(false)

      const res = await app.fetch(new Request('http://localhost/campaigns/nonexistent/launch', { method: 'POST' }))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  describe('POST /campaigns/:id/pause', () => {
    it('pauses a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.setStatus).mockReturnValue(true)

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1/pause', { method: 'POST' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('paused')
    })
  })

  describe('POST /campaigns/:id/cancel', () => {
    it('cancels a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.setStatus).mockReturnValue(true)

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1/cancel', { method: 'POST' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('cancelled')
    })
  })

  describe('POST /campaigns/:id/clone', () => {
    it('clones a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.clone).mockReturnValue({
        ...SAMPLE_CAMPAIGN,
        id: 'camp-clone',
        name: 'Test Campaign (Copy)',
      })

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1/clone', { method: 'POST' }))

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('camp-clone')
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.clone).mockReturnValue(null)

      const res = await app.fetch(new Request('http://localhost/campaigns/nonexistent/clone', { method: 'POST' }))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  describe('POST /campaigns/:id/archive', () => {
    it('archives a campaign', async () => {
      const app = createApp()
      vi.mocked(campaignService.setStatus).mockReturnValue(true)

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1/archive', { method: 'POST' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('archived')
    })
  })

  // ==========================================================================
  // Campaign Stats
  // ==========================================================================
  describe('GET /campaigns/:id/stats', () => {
    it('returns campaign statistics', async () => {
      const app = createApp()
      vi.mocked(campaignService.getStats).mockReturnValue({
        total_recipients: 100,
        sent_count: 90,
        failed_count: 5,
        open_count: 40,
        click_count: 10,
        bounce_count: 3,
        unsubscribe_count: 1,
      })

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1/stats'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.total_recipients).toBe(100)
      expect(body.data.sent).toBe(90)
      expect(body.data.open_rate).toBeGreaterThan(0)
      expect(body.data.click_rate).toBeGreaterThan(0)
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.getStats).mockReturnValue(null)

      const res = await app.fetch(new Request('http://localhost/campaigns/nonexistent/stats'))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  // ==========================================================================
  // A/B Testing
  // ==========================================================================
  describe('POST /campaigns/:id/ab/variant', () => {
    it('creates an A/B variant', async () => {
      const app = createApp()
      vi.mocked(campaignService.get).mockReturnValue(SAMPLE_CAMPAIGN)
      vi.mocked(campaignService.createABVariant).mockReturnValue({
        id: 'var-1',
        label: 'A',
        percentage: 50,
      })

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns/camp-1/ab/variant', {
          label: 'A',
          percentage: 50,
          subject: 'Test A',
        })
      )

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('var-1')
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.get).mockReturnValue(null)

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns/nonexistent/ab/variant', {
          label: 'A',
        })
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  describe('GET /campaigns/:id/ab/variants', () => {
    it('returns A/B variants', async () => {
      const app = createApp()
      vi.mocked(campaignService.get).mockReturnValue(SAMPLE_CAMPAIGN)
      vi.mocked(campaignService.getABVariants).mockReturnValue([
        { id: 'var-1', label: 'A' },
        { id: 'var-2', label: 'B' },
      ])

      const res = await app.fetch(new Request('http://localhost/campaigns/camp-1/ab/variants'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.variants).toHaveLength(2)
    })

    it('returns 404 when campaign not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.get).mockReturnValue(null)

      const res = await app.fetch(new Request('http://localhost/campaigns/nonexistent/ab/variants'))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  describe('POST /campaigns/:id/ab/winner', () => {
    it('declares an A/B winner', async () => {
      const app = createApp()
      vi.mocked(campaignService.declareWinner).mockReturnValue(true)

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns/camp-1/ab/winner', {
          variant_id: 'var-1',
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('Winner')
    })

    it('returns 400 when variant_id is missing', async () => {
      const app = createApp()

      const res = await app.fetch(jsonRequest('POST', '/campaigns/camp-1/ab/winner', {}))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
    })

    it('returns 404 when variant not found', async () => {
      const app = createApp()
      vi.mocked(campaignService.declareWinner).mockReturnValue(false)

      const res = await app.fetch(
        jsonRequest('POST', '/campaigns/camp-1/ab/winner', {
          variant_id: 'nonexistent',
        })
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })
  })

  // ==========================================================================
  // Dashboard Stats
  // ==========================================================================
  describe('GET /campaigns/dashboard', () => {
    it('returns campaign dashboard stats', async () => {
      const app = createApp()
      vi.mocked(campaignService.getDashboardStats).mockReturnValue({
        total: 10,
        draft: 3,
        sending: 2,
        completed: 5,
      })

      const res = await app.fetch(new Request('http://localhost/campaigns/dashboard'))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.total).toBe(10)
    })
  })
})
