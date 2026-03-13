/**
 * Admin API — Org management, members, teams, roles, audit logs
 */
import { api } from './client'

// ============================================================================
// Types
// ============================================================================

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  settings: string
  memberCount?: number
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: string
  status: string
  email?: string
  name?: string
  invited_by: string | null
  joined_at: string
  created_at: string
}

export interface Team {
  id: string
  org_id: string
  name: string
  description: string | null
  member_count?: number
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: string
  email?: string
  name?: string
  added_at: string
}

export interface SystemRole {
  id: string
  name: string
  description: string
  permissions: string[]
}

export interface AuditLog {
  id: string
  org_id: string
  actor_id: string
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  changes: string | null
  metadata: string
  created_at: string
}

export interface ActivityLog {
  id: string
  org_id: string
  actor_id: string
  actor_email: string | null
  action: string
  entity_type: string
  description: string
  metadata: string
  created_at: string
}

// ============================================================================
// Admin API
// ============================================================================

export const adminApi = {
  // --- Organization ---
  getOrg: async (): Promise<Organization> => {
    const res = await api.get<Organization>('/admin/org')
    if (!res.success) throw new Error(res.message || 'Failed to load organization')
    return res.data!
  },

  updateOrg: async (updates: { name?: string; settings?: Record<string, unknown> }) => {
    const res = await api.put('/admin/org', updates)
    if (!res.success) throw new Error(res.message || 'Failed to update')
  },

  // --- Members ---
  getMembers: async (): Promise<OrgMember[]> => {
    const res = await api.get<{ members: OrgMember[] }>('/admin/org/members')
    return res.data?.members || []
  },

  addMember: async (email: string, role: string) => {
    const res = await api.post('/admin/org/members', { email, role })
    if (!res.success) throw new Error(res.message || 'Failed to add member')
    return res.data
  },

  updateMemberRole: async (userId: string, role: string) => {
    const res = await api.put(`/admin/org/members/${userId}/role`, { role })
    if (!res.success) throw new Error(res.message || 'Failed to update role')
  },

  removeMember: async (userId: string) => {
    const res = await api.delete(`/admin/org/members/${userId}`)
    if (!res.success) throw new Error(res.message || 'Failed to remove member')
  },

  // --- Teams ---
  getTeams: async (): Promise<Team[]> => {
    const res = await api.get<{ teams: Team[] }>('/admin/teams')
    return res.data?.teams || []
  },

  createTeam: async (name: string, description?: string): Promise<Team> => {
    const res = await api.post<Team>('/admin/teams', { name, description })
    if (!res.success) throw new Error(res.message || 'Failed to create team')
    return res.data!
  },

  updateTeam: async (teamId: string, updates: { name?: string; description?: string }) => {
    const res = await api.put(`/admin/teams/${teamId}`, updates)
    if (!res.success) throw new Error(res.message || 'Failed to update team')
  },

  deleteTeam: async (teamId: string) => {
    const res = await api.delete(`/admin/teams/${teamId}`)
    if (!res.success) throw new Error(res.message || 'Failed to delete team')
  },

  getTeamMembers: async (teamId: string): Promise<TeamMember[]> => {
    const res = await api.get<{ members: TeamMember[] }>(`/admin/teams/${teamId}/members`)
    return res.data?.members || []
  },

  addTeamMember: async (teamId: string, userId: string, role?: string) => {
    const res = await api.post(`/admin/teams/${teamId}/members`, { userId, role })
    if (!res.success) throw new Error(res.message || 'Failed to add team member')
  },

  removeTeamMember: async (teamId: string, userId: string) => {
    const res = await api.delete(`/admin/teams/${teamId}/members/${userId}`)
    if (!res.success) throw new Error(res.message || 'Failed to remove team member')
  },

  // --- Roles ---
  getRoles: async (): Promise<SystemRole[]> => {
    const res = await api.get<{ roles: SystemRole[] }>('/admin/roles')
    return res.data?.roles || []
  },

  getUserPermissions: async (userId: string): Promise<{ userId: string; role: string; permissions: string[] }> => {
    const res = await api.get<{ userId: string; role: string; permissions: string[] }>(`/admin/permissions/${userId}`)
    if (!res.success) throw new Error(res.message || 'Failed')
    return res.data!
  },

  grantPermission: async (userId: string, permission: string) => {
    const res = await api.post(`/admin/permissions/${userId}/grant`, { permission })
    if (!res.success) throw new Error(res.message || 'Failed')
  },

  revokePermission: async (userId: string, permission: string) => {
    const res = await api.post(`/admin/permissions/${userId}/revoke`, { permission })
    if (!res.success) throw new Error(res.message || 'Failed')
  },

  // --- Audit & Activity Logs ---
  getAuditLogs: async (params?: { action?: string; page?: number; limit?: number }): Promise<{ logs: AuditLog[]; total: number }> => {
    const qs = new URLSearchParams()
    if (params?.action) qs.set('action', params.action)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString() ? `?${qs}` : ''
    const res = await api.get<AuditLog[]>(`/admin/audit-logs${query}`)
    return { logs: res.data || [], total: res.meta?.pagination?.total as number || 0 }
  },

  getActivityLogs: async (params?: { page?: number; limit?: number }): Promise<{ logs: ActivityLog[]; total: number }> => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString() ? `?${qs}` : ''
    const res = await api.get<ActivityLog[]>(`/admin/activity-logs${query}`)
    return { logs: res.data || [], total: res.meta?.pagination?.total as number || 0 }
  },

  getRecentActivity: async (limit = 20): Promise<ActivityLog[]> => {
    const res = await api.get<{ activity: ActivityLog[] }>(`/admin/activity/recent?limit=${limit}`)
    return res.data?.activity || []
  },
}
