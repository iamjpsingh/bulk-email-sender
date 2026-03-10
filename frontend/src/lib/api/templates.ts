/**
 * Templates API
 */
import { api, type Pagination } from './client'

// ============================================================================
// Template Types
// ============================================================================

export type TemplateCategory =
  | 'newsletter'
  | 'promotional'
  | 'transactional'
  | 'welcome'
  | 'follow_up'
  | 'announcement'
  | 'general'

export interface Template {
  id: string
  user_id: string
  name: string
  description: string | null
  category: TemplateCategory
  subject: string | null
  html_content: string
  text_content: string | null
  variables: string
  is_starter: number
  version: number
  created_at: string
  updated_at: string
}

export interface TemplateInput {
  name: string
  description?: string
  category?: TemplateCategory
  subject?: string
  html_content: string
  text_content?: string
}

// ============================================================================
// Templates API
// ============================================================================

export const templatesApi = {
  list: async (params?: {
    category?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<{ templates: Template[]; pagination: Pagination }> => {
    const qs = new URLSearchParams()
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') qs.set(k, String(v))
      })
    const res = await api.get<Template[]>(`/templates?${qs}`)
    return {
      templates: (res as any).data || [],
      pagination: (res as any).meta?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
    }
  },

  get: async (id: string): Promise<Template> => {
    const res = await api.get<Template>(`/templates/${id}`)
    if (!res.success) throw new Error(res.message || 'Template not found')
    return res.data!
  },

  create: async (input: TemplateInput): Promise<Template> => {
    const res = await api.post<Template>('/templates', input)
    if (!res.success) throw new Error(res.message || 'Failed to create template')
    return res.data!
  },

  update: async (id: string, updates: Partial<TemplateInput>) => {
    const res = await api.put(`/templates/${id}`, updates)
    if (!res.success) throw new Error(res.message || 'Failed to update template')
  },

  delete: async (id: string) => {
    const res = await api.delete(`/templates/${id}`)
    if (!res.success) throw new Error(res.message || 'Failed to delete template')
  },

  duplicate: async (id: string, name: string): Promise<Template> => {
    const res = await api.post<Template>(`/templates/${id}/duplicate`, { name })
    if (!res.success) throw new Error(res.message || 'Failed to duplicate')
    return res.data!
  },

  preview: async (html: string, data: Record<string, string>): Promise<{ html: string; variables: string[] }> => {
    const res = await api.post<{ html: string; variables: string[] }>('/templates/preview', { html, data })
    return res.data || { html: '', variables: [] }
  },

  getStarters: async (): Promise<Template[]> => {
    const res = await api.get<{ templates: Template[] }>('/templates/starters')
    return res.data?.templates || []
  },
}
