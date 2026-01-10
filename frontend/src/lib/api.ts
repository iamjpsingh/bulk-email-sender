/**
 * API Client
 * Centralized HTTP client with type-safe responses
 */

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  error?: string
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasMore: boolean
    }
  }
}

export interface User {
  id: string
  email: string
  name: string
}

export interface SMTPConfig {
  id: string
  name: string
  provider_type: 'smtp' | 'google' | 'microsoft'
  host?: string
  port?: number
  secure?: boolean
  user?: string
  from_email: string
  from_name?: string
  is_default: boolean
  oauth_email?: string
  created_at?: string
}

export interface EmailLog {
  id: string
  tracking_id?: string
  recipient_email: string
  recipient_name?: string
  subject: string
  status: 'sent' | 'failed' | 'opened' | 'clicked'
  send_type: 'direct' | 'batch' | 'scheduled'
  provider_type: 'smtp' | 'google' | 'microsoft'
  config_name?: string
  sent_at: string
  opened_at?: string
  open_count?: number
  click_count?: number
}

export interface EmailStats {
  total: number
  sent: number
  failed: number
  opened?: number
  clicked?: number
  openRate?: number
  clickRate?: number
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore?: boolean
}

export interface BatchStatus {
  isRunning: boolean
  currentJob: {
    id: string
    totalContacts: number
    currentBatch: number
    totalBatches: number
    emailsSent: number
    emailsFailed: number
    status: string
    nextBatchTime?: string
  } | null
}

export interface ScheduledJob {
  id: string
  scheduled_time: string
  status: 'scheduled' | 'running' | 'completed' | 'cancelled'
  contact_count: number
  subject: string
  use_batch: boolean
}

export interface ProviderStatus {
  configured: boolean
  name: string
  description: string
}

export interface DashboardStats {
  stats: EmailStats
  batch: BatchStatus | null
  scheduledJobs: ScheduledJob[]
  recentLogs: EmailLog[]
  timestamp: string
}

// ============================================================================
// API Client
// ============================================================================

const BASE_URL = import.meta.env.VITE_API_URL || ''

class ApiClient {
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const options: RequestInit = {
      method,
      credentials: 'include',
      headers: {},
    }

    if (body && !(body instanceof FormData)) {
      ;(options.headers as Record<string, string>)['Content-Type'] = 'application/json'
      options.body = JSON.stringify(body)
    } else if (body instanceof FormData) {
      options.body = body
    }

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, options)

      // Handle non-JSON responses
      const contentType = res.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        if (!res.ok) {
          return { success: false, message: `HTTP Error: ${res.status}` }
        }
        return { success: true } as ApiResponse<T>
      }

      const json = await res.json()
      return this.normalizeResponse<T>(json)
    } catch (err) {
      console.error('API request failed:', err)
      return { success: false, message: 'Network error - check if backend is running' }
    }
  }

  /**
   * Normalize response to consistent format
   * Handles both { success, data } and legacy { success, configs/logs/etc }
   */
  private normalizeResponse<T>(json: any): ApiResponse<T> {
    // Already in correct format
    if (json.data !== undefined) {
      return json as ApiResponse<T>
    }

    // Legacy format - extract data from root
    const { success, message, error, meta, ...rest } = json
    return {
      success,
      message,
      error,
      meta,
      data: Object.keys(rest).length > 0 ? (rest as T) : undefined,
    }
  }

  // HTTP Methods
  get<T>(endpoint: string) {
    return this.request<T>('GET', endpoint)
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>('POST', endpoint, body)
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>('PUT', endpoint, body)
  }

  delete<T>(endpoint: string) {
    return this.request<T>('DELETE', endpoint)
  }

  upload<T>(endpoint: string, formData: FormData) {
    return this.request<T>('POST', endpoint, formData)
  }
}

export const api = new ApiClient()

// ============================================================================
// API Functions (for TanStack Query)
// ============================================================================

// Auth
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<{ user: User }>('/auth/login', { email, password })
    if (!res.success) throw new Error(res.message || 'Login failed')
    return res.data!.user
  },

  register: async (name: string, email: string, password: string) => {
    const res = await api.post<{ user: User }>('/auth/register', { name, email, password })
    if (!res.success) throw new Error(res.message || 'Registration failed')
    return res.data!.user
  },

  logout: async () => {
    await api.post('/auth/logout')
  },

  getMe: async () => {
    const res = await api.get<{ user: User }>('/auth/me')
    if (!res.success) throw new Error(res.message || 'Not authenticated')
    return res.data!.user
  },
}

// Configs
export const configApi = {
  list: async (): Promise<SMTPConfig[]> => {
    const res = await api.get<{ configs: SMTPConfig[] }>('/config/list')
    if (!res.success) throw new Error(res.message || 'Failed to load configs')
    return res.data?.configs || []
  },

  create: async (config: Partial<SMTPConfig> & { pass?: string }) => {
    const res = await api.post<{ configId: string }>('/config/smtp', {
      name: config.name,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: config.pass,
      fromEmail: config.from_email,
      fromName: config.from_name,
      isDefault: config.is_default,
    })
    if (!res.success) throw new Error(res.message || 'Failed to create config')
    return res.data?.configId
  },

  update: async (id: string, config: Partial<SMTPConfig> & { pass?: string }) => {
    const res = await api.put(`/config/smtp/${id}`, {
      name: config.name,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: config.pass,
      fromEmail: config.from_email,
      fromName: config.from_name,
      isDefault: config.is_default,
    })
    if (!res.success) throw new Error(res.message || 'Failed to update config')
  },

  delete: async (id: string) => {
    const res = await api.delete(`/config/smtp/${id}`)
    if (!res.success) throw new Error(res.message || 'Failed to delete config')
  },

  test: async (id: string) => {
    const res = await api.post<{ valid: boolean }>(`/config/test/${id}`)
    return { success: res.success && res.data?.valid, message: res.message || '' }
  },

  testConnection: async (config: { host: string; port: number; secure: boolean; user: string; pass: string }) => {
    const res = await api.post<{ valid: boolean }>('/config/smtp/test', config)
    return { success: res.success && res.data?.valid, message: res.message || '' }
  },
}

// OAuth
export const oauthApi = {
  getStatus: async (): Promise<Record<string, ProviderStatus>> => {
    const res = await api.get<{ providers: Record<string, ProviderStatus> }>('/oauth/status')
    if (!res.success) throw new Error(res.message || 'Failed to load OAuth status')
    return res.data?.providers || {}
  },

  connect: async (provider: 'google' | 'microsoft'): Promise<string> => {
    const res = await api.get<{ authUrl: string }>(`/oauth/${provider}/connect`)
    if (!res.success || !res.data?.authUrl) throw new Error(res.message || 'Failed to get auth URL')
    return res.data.authUrl
  },

  disconnect: async (configId: string) => {
    const res = await api.delete(`/oauth/${configId}/disconnect`)
    if (!res.success) throw new Error(res.message || 'Failed to disconnect')
  },

  test: async (configId: string) => {
    const res = await api.post<{ valid: boolean }>(`/oauth/${configId}/test`)
    return { success: res.success && res.data?.valid, message: res.message || '' }
  },
}

// Reports
export const reportApi = {
  getLogs: async (filters?: {
    status?: string
    send_type?: string
    provider?: string
    search?: string
    start_date?: string
    end_date?: string
    page?: number
    limit?: number
  }): Promise<{ logs: EmailLog[]; stats: EmailStats; pagination: Pagination }> => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value))
        }
      })
    }
    const res = await api.get<{ logs: EmailLog[]; stats: EmailStats; pagination: Pagination }>(
      `/report/logs?${params}`
    )
    if (!res.success) throw new Error(res.message || 'Failed to load logs')
    return {
      logs: res.data?.logs || [],
      stats: res.data?.stats || { total: 0, sent: 0, failed: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 },
      pagination: res.data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
    }
  },

  getStats: async (): Promise<EmailStats> => {
    const res = await api.get<EmailStats>('/report/stats')
    if (!res.success) throw new Error(res.message || 'Failed to load stats')
    return res.data || { total: 0, sent: 0, failed: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 }
  },

  deleteLog: async (id: string) => {
    const res = await api.delete(`/report/logs/${id}`)
    if (!res.success) throw new Error(res.message || 'Failed to delete log')
  },

  deleteLogs: async (ids: string[]) => {
    const res = await api.post<{ deleted: number }>('/report/logs/delete-bulk', { ids })
    if (!res.success) throw new Error(res.message || 'Failed to delete logs')
    return res.data?.deleted || 0
  },
}

// Dashboard
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const res = await api.get<DashboardStats>('/dashboard/stats')
    if (!res.success) throw new Error(res.message || 'Failed to load dashboard')
    return res.data || { stats: { total: 0, sent: 0, failed: 0 }, batch: null, scheduledJobs: [], recentLogs: [], timestamp: '' }
  },

  getPollStatus: async () => {
    const res = await api.get<{ pollNeeded: boolean; pollInterval: number; hasActiveBatch: boolean; hasScheduledJobs: boolean }>('/dashboard/poll-status')
    return res.data
  },
}

// Email Sending
export const emailApi = {
  send: async (formData: FormData) => {
    const res = await api.upload<{ contactCount: number; jobId?: string; message: string }>('/send', formData)
    if (!res.success) throw new Error(res.message || 'Failed to send emails')
    return res
  },

  parseExcel: async (file: File) => {
    const formData = new FormData()
    formData.append('excelFile', file)
    const res = await api.upload<{ contacts: any[]; totalCount: number }>('/parse-excel', formData)
    if (!res.success) throw new Error(res.message || 'Failed to parse Excel')
    return res.data
  },

  getProviderInfo: async (host: string, hasNotification: boolean) => {
    const formData = new FormData()
    formData.append('smtpHost', host)
    formData.append('hasNotification', String(hasNotification))
    const res = await api.upload<{ provider: string; dailyLimit: number; maxContacts: number }>('/provider-info', formData)
    return res.data
  },
}

// Batch
export const batchApi = {
  getStatus: async (): Promise<BatchStatus> => {
    const res = await api.get<BatchStatus>('/batch-status')
    return res.data || { isRunning: false, currentJob: null }
  },

  pause: async () => {
    await api.post('/batch-pause')
  },

  resume: async () => {
    await api.post('/batch-resume')
  },

  cancel: async () => {
    await api.delete('/batch-cancel')
  },
}

// Scheduled Jobs
export const scheduledApi = {
  list: async (): Promise<ScheduledJob[]> => {
    const res = await api.get<ScheduledJob[]>('/scheduled-jobs')
    return res.data || []
  },

  cancel: async (jobId: string) => {
    const res = await api.delete(`/scheduled-jobs/${jobId}`)
    if (!res.success) throw new Error(res.message || 'Failed to cancel job')
  },
}
