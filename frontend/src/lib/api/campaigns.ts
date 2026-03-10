/**
 * Campaigns API
 */
import { api, type Pagination } from './client'

// ============================================================================
// Campaign Types
// ============================================================================

export type CampaignType = 'one_time' | 'recurring' | 'ab_test' | 'automation'
export type CampaignStatus =
  | 'draft'
  | 'testing'
  | 'scheduled'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived'

export interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  template_id: string | null
  list_id: string | null
  subject: string
  from_name: string
  from_email: string
  total_recipients: number
  sent_count: number
  failed_count: number
  open_count: number
  click_count: number
  bounce_count: number
  unsubscribe_count: number
  scheduled_at: string | null
  sent_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignInput {
  name: string
  type?: CampaignType
  template_id?: string
  list_id?: string
  subject: string
  from_name: string
  from_email: string
  reply_to?: string
  tags?: string[]
  batch_size?: number
  email_delay?: number
  batch_delay?: number
}

// ============================================================================
// Campaigns API
// ============================================================================

export const campaignsApi = {
  list: async (params?: {
    status?: string
    type?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<{ campaigns: Campaign[]; pagination: Pagination }> => {
    const qs = new URLSearchParams()
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') qs.set(k, String(v))
      })
    const res = await api.get<Campaign[]>(`/campaigns?${qs}`)
    return {
      campaigns: (res as any).data || [],
      pagination: (res as any).meta?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    }
  },

  get: async (id: string): Promise<Campaign> => {
    const res = await api.get<Campaign>(`/campaigns/${id}`)
    if (!res.success) throw new Error(res.message || 'Campaign not found')
    return res.data!
  },

  create: async (input: CampaignInput): Promise<Campaign> => {
    const res = await api.post<Campaign>('/campaigns', input)
    if (!res.success) throw new Error(res.message || 'Failed to create campaign')
    return res.data!
  },

  update: async (id: string, updates: Partial<CampaignInput>) => {
    const res = await api.put(`/campaigns/${id}`, updates)
    if (!res.success) throw new Error(res.message || 'Failed to update')
  },

  delete: async (id: string) => {
    const res = await api.delete(`/campaigns/${id}`)
    if (!res.success) throw new Error(res.message || 'Failed to delete')
  },

  launch: async (id: string) => {
    await api.post(`/campaigns/${id}/launch`)
  },
  pause: async (id: string) => {
    await api.post(`/campaigns/${id}/pause`)
  },
  cancel: async (id: string) => {
    await api.post(`/campaigns/${id}/cancel`)
  },
  clone: async (id: string): Promise<Campaign> => {
    const res = await api.post<Campaign>(`/campaigns/${id}/clone`)
    if (!res.success) throw new Error(res.message || 'Failed to clone')
    return res.data!
  },
  archive: async (id: string) => {
    await api.post(`/campaigns/${id}/archive`)
  },
  schedule: async (id: string, scheduledAt: string) => {
    await api.post(`/campaigns/${id}/schedule`, { scheduled_at: scheduledAt })
  },

  getStats: async (id: string) => {
    const res = await api.get<any>(`/campaigns/${id}/stats`)
    return res.data
  },

  getDashboard: async () => {
    const res = await api.get<any>('/campaigns/dashboard')
    return res.data
  },
}
