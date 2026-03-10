/**
 * Auth API
 */
import { api, type User } from './client'

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
