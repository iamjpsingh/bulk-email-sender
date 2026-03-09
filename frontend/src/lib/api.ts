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

export interface QueueJobSummary {
  id: string
  type: 'direct' | 'batch' | 'scheduled' | 'automation'
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  subject: string
  from_email: string
  config_name: string | null
  total_count: number
  sent_count: number
  failed_count: number
  last_processed_index: number
  progress: number
  created_at: string
  started_at: string | null
  last_error: string | null
}

export interface QueueStats {
  pending: number
  running: number
  paused: number
  completed: number
  failed: number
  cancelled: number
  total_sent: number
  total_failed: number
  dead_letters: number
}

export interface QueueDashboard {
  stats: QueueStats
  activeJobs: QueueJobSummary[]
  pendingJobs: QueueJobSummary[]
  recentJobs: QueueJobSummary[]
}

export interface DashboardStats {
  stats: EmailStats
  queue: QueueDashboard
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
    const emptyQueue = { stats: { pending: 0, running: 0, paused: 0, completed: 0, failed: 0, cancelled: 0, total_sent: 0, total_failed: 0, dead_letters: 0 }, activeJobs: [], pendingJobs: [], recentJobs: [] }
    return res.data || { stats: { total: 0, sent: 0, failed: 0 }, queue: emptyQueue, scheduledJobs: [], recentLogs: [], timestamp: '' }
  },

  getPollStatus: async () => {
    const res = await api.get<{ pollNeeded: boolean; pollInterval: number; hasActiveJobs: boolean; hasPendingJobs: boolean; hasScheduledJobs: boolean; activeJobCount: number; pendingJobCount: number; pausedJobCount: number }>('/dashboard/poll-status')
    return res.data
  },
}

// Queue
export const queueApi = {
  getJobs: async (status?: string): Promise<QueueJobSummary[]> => {
    const params = status ? `?status=${status}` : ''
    const res = await api.get<QueueJobSummary[]>(`/queue/jobs${params}`)
    return res.data || []
  },

  getJob: async (jobId: string): Promise<QueueJobSummary> => {
    const res = await api.get<QueueJobSummary>(`/queue/jobs/${jobId}`)
    if (!res.success) throw new Error(res.message || 'Job not found')
    return res.data!
  },

  pauseJob: async (jobId: string) => {
    const res = await api.post(`/queue/jobs/${jobId}/pause`)
    if (!res.success) throw new Error(res.message || 'Failed to pause job')
  },

  resumeJob: async (jobId: string) => {
    const res = await api.post(`/queue/jobs/${jobId}/resume`)
    if (!res.success) throw new Error(res.message || 'Failed to resume job')
  },

  cancelJob: async (jobId: string) => {
    const res = await api.delete(`/queue/jobs/${jobId}`)
    if (!res.success) throw new Error(res.message || 'Failed to cancel job')
  },

  getStats: async (): Promise<QueueStats> => {
    const res = await api.get<QueueStats>('/queue/stats')
    return res.data || { pending: 0, running: 0, paused: 0, completed: 0, failed: 0, cancelled: 0, total_sent: 0, total_failed: 0, dead_letters: 0 }
  },
}

// ============================================================================
// Contact Types
// ============================================================================

export interface ContactList {
  id: string
  user_id: string
  name: string
  description: string | null
  contact_count: number
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  list_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  phone: string | null
  tags: string
  custom_fields: string
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  engagement_score: number
  source: string | null
  created_at: string
  updated_at: string
}

export interface ContactInput {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  tags?: string[]
  custom_fields?: Record<string, string>
  status?: string
  source?: string
}

export interface ImportResult {
  total: number
  imported: number
  duplicates: number
  invalid: number
  errors: { row: number; email: string; reason: string }[]
}

export interface ImportHistory {
  id: string
  list_id: string
  filename: string
  format: string
  total_rows: number
  imported: number
  duplicates: number
  invalid: number
  created_at: string
}

export interface ValidationResult {
  email: string
  valid: boolean
  score: number
  checks: { syntax: boolean; mx: boolean; disposable: boolean; suppressed: boolean }
  reason?: string
}

export interface BulkValidationResult {
  total: number
  valid: number
  invalid: number
  risky: number
  suppressed: number
  results: ValidationResult[]
}

// ============================================================================
// Contacts API
// ============================================================================

export const contactsApi = {
  // Lists
  getLists: async (): Promise<ContactList[]> => {
    const res = await api.get<{ lists: ContactList[] }>('/contacts/lists')
    if (!res.success) throw new Error(res.message || 'Failed to load lists')
    return res.data?.lists || []
  },

  createList: async (name: string, description?: string): Promise<ContactList> => {
    const res = await api.post<ContactList>('/contacts/lists', { name, description })
    if (!res.success) throw new Error(res.message || 'Failed to create list')
    return res.data!
  },

  updateList: async (id: string, name: string, description?: string) => {
    const res = await api.put(`/contacts/lists/${id}`, { name, description })
    if (!res.success) throw new Error(res.message || 'Failed to update list')
  },

  deleteList: async (id: string) => {
    const res = await api.delete(`/contacts/lists/${id}`)
    if (!res.success) throw new Error(res.message || 'Failed to delete list')
  },

  // Contacts
  getContacts: async (listId: string, params?: {
    search?: string
    status?: string
    tags?: string
    page?: number
    limit?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }): Promise<{ contacts: Contact[]; pagination: Pagination }> => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          qs.set(key, String(value))
        }
      })
    }
    const res = await api.get<Contact[]>(`/contacts/${listId}?${qs}`)
    return {
      contacts: (res as any).data || [],
      pagination: (res as any).meta?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
    }
  },

  addContact: async (listId: string, contact: ContactInput): Promise<Contact> => {
    const res = await api.post<Contact>(`/contacts/${listId}`, contact)
    if (!res.success) throw new Error(res.message || 'Failed to add contact')
    return res.data!
  },

  updateContact: async (id: string, updates: Partial<ContactInput>) => {
    const res = await api.put(`/contacts/item/${id}`, updates)
    if (!res.success) throw new Error(res.message || 'Failed to update contact')
  },

  // Bulk
  bulkDelete: async (ids: string[]): Promise<number> => {
    const res = await api.post<{ deleted: number }>('/contacts/bulk/delete', { ids })
    if (!res.success) throw new Error(res.message || 'Failed to delete contacts')
    return res.data?.deleted || 0
  },

  bulkTag: async (ids: string[], tags: string[]): Promise<number> => {
    const res = await api.post<{ updated: number }>('/contacts/bulk/tag', { ids, tags })
    if (!res.success) throw new Error(res.message || 'Failed to tag contacts')
    return res.data?.updated || 0
  },

  bulkMove: async (ids: string[], targetListId: string): Promise<number> => {
    const res = await api.post<{ moved: number }>('/contacts/bulk/move', { ids, target_list_id: targetListId })
    if (!res.success) throw new Error(res.message || 'Failed to move contacts')
    return res.data?.moved || 0
  },

  // Search
  search: async (q: string): Promise<Contact[]> => {
    const res = await api.get<{ contacts: Contact[] }>(`/contacts/search?q=${encodeURIComponent(q)}`)
    return res.data?.contacts || []
  },

  // Import
  importContacts: async (listId: string, file: File, fieldMapping?: Record<string, string>, skipDuplicates = true): Promise<ImportResult> => {
    const formData = new FormData()
    formData.append('file', file)
    if (fieldMapping) formData.append('fieldMapping', JSON.stringify(fieldMapping))
    formData.append('skipDuplicates', String(skipDuplicates))
    const res = await api.upload<ImportResult>(`/contacts/${listId}/import`, formData)
    if (!res.success) throw new Error(res.message || 'Failed to import contacts')
    return res.data!
  },

  getImportHistory: async (): Promise<ImportHistory[]> => {
    const res = await api.get<{ history: ImportHistory[] }>('/contacts/import-history')
    return res.data?.history || []
  },

  // Validation
  validateEmails: async (emails: string[]): Promise<BulkValidationResult> => {
    const res = await api.post<BulkValidationResult>('/contacts/validate', { emails })
    if (!res.success) throw new Error(res.message || 'Validation failed')
    return res.data!
  },

  validateSingle: async (email: string): Promise<ValidationResult> => {
    const res = await api.post<ValidationResult>('/contacts/validate-single', { email })
    if (!res.success) throw new Error(res.message || 'Validation failed')
    return res.data!
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
