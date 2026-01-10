import { ref } from 'vue'
import { api } from '../services/api'

export interface SMTPConfig {
  id: string
  name: string
  host: string
  port: number
  secure: boolean
  user: string
  pass?: string
  from_email: string
  from_name: string
  is_default: boolean
}

// Reactive state
const configs = ref<SMTPConfig[]>([])
const selectedConfigId = ref<string | null>(null)
const loading = ref(false)

// Vue composable
export function useConfigStore() {
  async function loadConfigs() {
    loading.value = true
    try {
      const res = await api.get('/config/list')
      if (res.success) {
        // Map backend response to frontend format
        configs.value = (res.configs || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          host: c.host,
          port: c.port,
          secure: c.secure,
          user: c.user,
          from_email: c.from_email,
          from_name: c.from_name || '',
          is_default: c.is_default || false
        }))
        // Auto-select default config
        const defaultConfig = configs.value.find(c => c.is_default)
        if (defaultConfig && !selectedConfigId.value) {
          selectedConfigId.value = defaultConfig.id
        }
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    } finally {
      loading.value = false
    }
  }

  async function createConfig(config: Omit<SMTPConfig, 'id'>) {
    // Map frontend format to backend format
    const payload = {
      name: config.name,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: config.pass,
      fromEmail: config.from_email,
      fromName: config.from_name,
      isDefault: config.is_default
    }
    const res = await api.post('/config/smtp', payload)
    if (res.success) {
      await loadConfigs()
      return res.config
    }
    throw new Error(res.message || 'Failed to create config')
  }

  async function updateConfig(id: string, config: Partial<SMTPConfig>) {
    // Map frontend format to backend format
    const payload: any = {}
    if (config.name !== undefined) payload.name = config.name
    if (config.host !== undefined) payload.host = config.host
    if (config.port !== undefined) payload.port = config.port
    if (config.secure !== undefined) payload.secure = config.secure
    if (config.user !== undefined) payload.user = config.user
    if (config.pass !== undefined) payload.pass = config.pass
    if (config.from_email !== undefined) payload.fromEmail = config.from_email
    if (config.from_name !== undefined) payload.fromName = config.from_name
    if (config.is_default !== undefined) payload.isDefault = config.is_default
    
    const res = await api.put(`/config/smtp/${id}`, payload)
    if (res.success) {
      await loadConfigs()
      return res.config
    }
    throw new Error(res.message || 'Failed to update config')
  }

  async function deleteConfig(id: string) {
    const res = await api.delete(`/config/smtp/${id}`)
    if (res.success) {
      await loadConfigs()
      if (selectedConfigId.value === id) {
        selectedConfigId.value = null
      }
    } else {
      throw new Error(res.message || 'Failed to delete config')
    }
  }

  async function testConfig(id: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post(`/config/smtp/${id}/test`, {})
    return { success: res.success, message: res.message || '' }
  }

  function selectConfig(id: string) {
    selectedConfigId.value = id
  }

  return {
    configs,
    selectedConfigId,
    loading,
    loadConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    testConfig,
    selectConfig
  }
}

// API functions for TanStack Query
export const configApi = {
  getConfigs: async (): Promise<SMTPConfig[]> => {
    try {
      const res = await api.get('/config/list')
      if (res.success) {
        // Map backend response to frontend format
        return (res.configs || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          host: c.host,
          port: c.port,
          secure: c.secure,
          user: c.user,
          from_email: c.from_email,
          from_name: c.from_name || '',
          is_default: c.is_default || false
        }))
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
    }
    return []
  },

  createConfig: async (config: Omit<SMTPConfig, 'id'>): Promise<SMTPConfig> => {
    // Map frontend format to backend format
    const payload = {
      name: config.name,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: config.pass,
      fromEmail: config.from_email,
      fromName: config.from_name,
      isDefault: config.is_default
    }
    const res = await api.post('/config/smtp', payload)
    if (res.success) {
      return res.config
    }
    throw new Error(res.message || 'Failed to create config')
  },

  updateConfig: async ({ id, ...config }: Partial<SMTPConfig> & { id: string }): Promise<SMTPConfig> => {
    // Map frontend format to backend format
    const payload: any = {}
    if (config.name !== undefined) payload.name = config.name
    if (config.host !== undefined) payload.host = config.host
    if (config.port !== undefined) payload.port = config.port
    if (config.secure !== undefined) payload.secure = config.secure
    if (config.user !== undefined) payload.user = config.user
    if (config.pass !== undefined) payload.pass = config.pass
    if (config.from_email !== undefined) payload.fromEmail = config.from_email
    if (config.from_name !== undefined) payload.fromName = config.from_name
    if (config.is_default !== undefined) payload.isDefault = config.is_default
    
    const res = await api.put(`/config/smtp/${id}`, payload)
    if (res.success) {
      return res.config
    }
    throw new Error(res.message || 'Failed to update config')
  },

  deleteConfig: async (id: string): Promise<void> => {
    const res = await api.delete(`/config/smtp/${id}`)
    if (!res.success) {
      throw new Error(res.message || 'Failed to delete config')
    }
  },

  testConfig: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/config/smtp/${id}/test`, {})
    return { success: res.success, message: res.message || '' }
  }
}
