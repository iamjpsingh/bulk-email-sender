import { ref } from 'vue'
import { api } from '../services/api'

export interface EmailLog {
  id: string
  email: string
  status: 'Sent' | 'Failed' | 'Error'
  message?: string
  timestamp: string
  messageId?: string
  firstName?: string
  company?: string
  subject?: string
}

export interface EmailStats {
  total: number
  sent: number
  failed: number
}

export interface BatchJob {
  id: string
  totalContacts: number
  currentBatch: number
  totalBatches: number
  emailsSent: number
  emailsFailed: number
  status: string
  nextBatchTime?: string
}

export interface BatchStatus {
  isRunning: boolean
  currentJob: BatchJob | null
}

export interface ScheduledJob {
  id: string
  scheduled_time: string
  status: string
  contact_count: number
  subject: string
  use_batch: boolean
}

// Reactive state
const sending = ref(false)

// Vue composable
export function useEmailStore() {
  async function sendEmails(formData: FormData) {
    sending.value = true
    try {
      const res = await api.upload('/send', formData)
      if (!res.success) {
        throw new Error(res.message || 'Failed to send emails')
      }
      return res
    } finally {
      sending.value = false
    }
  }

  return {
    sending,
    sendEmails
  }
}

// API functions for TanStack Query
export const emailApi = {
  getLogs: async (): Promise<{ logs: EmailLog[]; stats: EmailStats }> => {
    try {
      const res = await api.get('/report')
      if (res.success) {
        return {
          logs: res.logs || [],
          stats: res.stats || { total: 0, sent: 0, failed: 0 }
        }
      }
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
    return { logs: [], stats: { total: 0, sent: 0, failed: 0 } }
  },

  getBatchStatus: async (): Promise<BatchStatus> => {
    try {
      const res = await api.get('/batch-status')
      if (res.success) {
        return res.data || { isRunning: false, currentJob: null }
      }
    } catch (err) {
      console.error('Failed to get batch status:', err)
    }
    return { isRunning: false, currentJob: null }
  },

  getScheduledJobs: async (): Promise<ScheduledJob[]> => {
    try {
      const res = await api.get('/scheduled-jobs')
      if (res.success) {
        return res.data || []
      }
    } catch (err) {
      console.error('Failed to get scheduled jobs:', err)
    }
    return []
  },

  sendEmails: async (formData: FormData): Promise<any> => {
    const res = await api.upload('/send', formData)
    if (!res.success) {
      throw new Error(res.message || 'Failed to send emails')
    }
    return res
  },

  clearLogs: async (): Promise<void> => {
    const res = await api.delete('/report/clear')
    if (!res.success) {
      throw new Error(res.message || 'Failed to clear logs')
    }
  },

  cancelScheduledJob: async (jobId: string): Promise<void> => {
    const res = await api.delete(`/scheduled-jobs/${jobId}`)
    if (!res.success) {
      throw new Error(res.message || 'Failed to cancel job')
    }
  },

  pauseBatch: async (): Promise<void> => {
    await api.post('/batch-pause', {})
  },

  resumeBatch: async (): Promise<void> => {
    await api.post('/batch-resume', {})
  },

  cancelBatch: async (): Promise<void> => {
    await api.post('/batch-cancel', {})
  }
}
