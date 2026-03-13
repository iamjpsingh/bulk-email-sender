// src/routes/admin.ts - Admin API routes

import { Hono } from 'hono'
import { requireAuth, getOrgId } from '../middleware/auth'
import { requirePermission, requireAnyPermission, requirePlatformAdmin, requireOrgMember } from '../middleware/rbac'
import { PERMISSIONS } from '../services/rbacService'
import { authLocalService } from '../services/authLocalService'
import { orgService } from '../services/orgService'
import { teamService } from '../services/teamService'
import { rbacService } from '../services/rbacService'
import { auditService } from '../services/auditService'
import { success, error, paginated } from '../utils/response'

const app = new Hono()

// ============================================================================
// Platform Admin (super-admin only, no org context needed)
// ============================================================================

/** List all users (paginated) */
app.get('/admin/platform/users', requirePlatformAdmin(), (c) => {
  const page = Number(c.req.query('page')) || 1
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  const { users, total } = authLocalService.listAllUsers(page, limit)
  return paginated(c, users, { page, limit, total })
})

/** Promote a user to platform admin by email */
app.post('/admin/platform/promote', requirePlatformAdmin(), async (c) => {
  const { email } = await c.req.json()
  if (!email) return error(c, 'Email is required', 400)

  const target = authLocalService.getUserByEmail(email)
  if (!target) return error(c, 'User not found', 404)

  if (target.is_platform_admin) {
    return error(c, 'User is already a platform admin', 400)
  }

  try {
    authLocalService.promoteToPlatformAdmin(target.id)
    return success(c, { userId: target.id, email: target.email }, 'User promoted to platform admin')
  } catch (e: any) {
    return error(c, e.message || 'Failed to promote user', 500)
  }
})

/** List all organizations (paginated) */
app.get('/admin/platform/orgs', requirePlatformAdmin(), (c) => {
  const page = Number(c.req.query('page')) || 1
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  const { orgs, total } = orgService.listAll(page, limit)
  return paginated(c, orgs, { page, limit, total })
})

/** Cleanup expired sessions */
app.post('/admin/platform/cleanup', requirePlatformAdmin(), (c) => {
  try {
    const deleted = authLocalService.cleanupSessions()
    return success(c, { sessionsDeleted: deleted }, 'Session cleanup complete')
  } catch (e: any) {
    return error(c, e.message || 'Cleanup failed', 500)
  }
})

// ============================================================================
// Organization Management (org-scoped)
// ============================================================================

/** Get current org details */
app.get('/admin/org', requirePermission(PERMISSIONS.ORG_VIEW), (c) => {
  const orgId = getOrgId(c)
  const org = orgService.get(orgId)
  if (!org) return error(c, 'Organization not found', 404)

  const memberCount = orgService.getMemberCount(orgId)
  return success(c, { ...org, memberCount })
})

/** Update current org */
app.put('/admin/org', requirePermission(PERMISSIONS.ORG_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const body = await c.req.json()

  const updates: { name?: string; settings?: Record<string, unknown> } = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.settings !== undefined) updates.settings = body.settings

  try {
    const updated = orgService.update(orgId, updates, user.id)
    if (!updated) return error(c, 'No changes applied', 400)
    return success(c, undefined, 'Organization updated')
  } catch (e: any) {
    return error(c, e.message || 'Failed to update organization', 500)
  }
})

/** List org members */
app.get('/admin/org/members', requirePermission(PERMISSIONS.USERS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const members = orgService.getMembers(orgId)
  return success(c, { members })
})

/** Add member to org by email */
app.post('/admin/org/members', requirePermission(PERMISSIONS.USERS_INVITE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const { email, role } = await c.req.json()

  if (!email) return error(c, 'Email is required', 400)

  const target = authLocalService.getUserByEmail(email)
  if (!target) return error(c, 'User not found. They must register first.', 404)

  const existing = orgService.getMember(orgId, target.id)
  if (existing) return error(c, 'User is already a member of this organization', 400)

  try {
    const member = orgService.addMember(orgId, target.id, role || 'member', user.id)
    return success(c, member, 'Member added', 201)
  } catch (e: any) {
    return error(c, e.message || 'Failed to add member', 500)
  }
})

/** Change member role */
app.put('/admin/org/members/:userId/role', requirePermission(PERMISSIONS.USERS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const targetId = c.req.param('userId')
  const { role } = await c.req.json()

  if (!role) return error(c, 'Role is required', 400)

  if (!rbacService.canManageUser(user.id, targetId, orgId)) {
    return error(c, 'You cannot manage a user with equal or higher role', 403)
  }

  try {
    const updated = orgService.updateMemberRole(orgId, targetId, role, user.id)
    if (!updated) return error(c, 'Member not found or no change', 404)
    return success(c, undefined, 'Member role updated')
  } catch (e: any) {
    return error(c, e.message || 'Failed to update member role', 500)
  }
})

/** Remove member from org */
app.delete('/admin/org/members/:userId', requirePermission(PERMISSIONS.USERS_REMOVE), (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const targetId = c.req.param('userId')

  if (user.id === targetId) {
    return error(c, 'You cannot remove yourself', 400)
  }

  if (!rbacService.canManageUser(user.id, targetId, orgId)) {
    return error(c, 'You cannot remove a user with equal or higher role', 403)
  }

  try {
    const removed = orgService.removeMember(orgId, targetId, user.id)
    if (!removed) return error(c, 'Member not found or is org owner', 404)
    return success(c, undefined, 'Member removed')
  } catch (e: any) {
    return error(c, e.message || 'Failed to remove member', 500)
  }
})

// ============================================================================
// Team Management (org-scoped)
// ============================================================================

/** List teams */
app.get('/admin/teams', requirePermission(PERMISSIONS.TEAMS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const teams = teamService.list(orgId)
  return success(c, { teams })
})

/** Create team */
app.post('/admin/teams', requirePermission(PERMISSIONS.TEAMS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const { name, description } = await c.req.json()

  if (!name || !name.trim()) return error(c, 'Team name is required', 400)

  try {
    const team = teamService.create(orgId, name.trim(), user.id, description)
    return success(c, team, 'Team created', 201)
  } catch (e: any) {
    return error(c, e.message || 'Failed to create team', 500)
  }
})

/** Update team */
app.put('/admin/teams/:teamId', requirePermission(PERMISSIONS.TEAMS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const teamId = c.req.param('teamId')
  const body = await c.req.json()

  const updates: { name?: string; description?: string } = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description

  try {
    const updated = teamService.update(orgId, teamId, updates, user.id)
    if (!updated) return error(c, 'Team not found or no change', 404)
    return success(c, undefined, 'Team updated')
  } catch (e: any) {
    return error(c, e.message || 'Failed to update team', 500)
  }
})

/** Delete team */
app.delete('/admin/teams/:teamId', requirePermission(PERMISSIONS.TEAMS_MANAGE), (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const teamId = c.req.param('teamId')

  try {
    const deleted = teamService.delete(orgId, teamId, user.id)
    if (!deleted) return error(c, 'Team not found', 404)
    return success(c, undefined, 'Team deleted')
  } catch (e: any) {
    return error(c, e.message || 'Failed to delete team', 500)
  }
})

/** List team members */
app.get('/admin/teams/:teamId/members', requirePermission(PERMISSIONS.TEAMS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const teamId = c.req.param('teamId')

  const team = teamService.get(orgId, teamId)
  if (!team) return error(c, 'Team not found', 404)

  const members = teamService.getMembers(teamId)
  return success(c, { members })
})

/** Add member to team */
app.post('/admin/teams/:teamId/members', requirePermission(PERMISSIONS.TEAMS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const teamId = c.req.param('teamId')
  const { userId, role } = await c.req.json()

  if (!userId) return error(c, 'userId is required', 400)

  const team = teamService.get(orgId, teamId)
  if (!team) return error(c, 'Team not found', 404)

  // Verify user is an org member
  const orgMember = orgService.getMember(orgId, userId)
  if (!orgMember) return error(c, 'User is not a member of this organization', 400)

  try {
    const added = teamService.addMember(orgId, teamId, userId, role || 'member', user.id)
    if (!added) return error(c, 'User is already a team member', 400)
    return success(c, undefined, 'Member added to team', 201)
  } catch (e: any) {
    return error(c, e.message || 'Failed to add team member', 500)
  }
})

/** Remove member from team */
app.delete('/admin/teams/:teamId/members/:userId', requirePermission(PERMISSIONS.TEAMS_MANAGE), (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const teamId = c.req.param('teamId')
  const targetId = c.req.param('userId')

  try {
    const removed = teamService.removeMember(orgId, teamId, targetId, user.id)
    if (!removed) return error(c, 'Team member not found', 404)
    return success(c, undefined, 'Member removed from team')
  } catch (e: any) {
    return error(c, e.message || 'Failed to remove team member', 500)
  }
})

// ============================================================================
// Roles & Permissions (org-scoped)
// ============================================================================

/** List system roles */
app.get('/admin/roles', requirePermission(PERMISSIONS.ROLES_VIEW), (c) => {
  const roles = rbacService.listSystemRoles()
  return success(c, { roles })
})

/** Get effective permissions for a user */
app.get('/admin/permissions/:userId', requirePermission(PERMISSIONS.PERMISSIONS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const targetId = c.req.param('userId')

  const role = rbacService.getUserRole(targetId, orgId)
  const permissions = rbacService.getEffectivePermissions(targetId, orgId)

  return success(c, { userId: targetId, role, permissions })
})

/** Grant permission override */
app.post('/admin/permissions/:userId/grant', requirePermission(PERMISSIONS.PERMISSIONS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const targetId = c.req.param('userId')
  const { permission } = await c.req.json()

  if (!permission) return error(c, 'Permission is required', 400)

  if (!rbacService.canManageUser(user.id, targetId, orgId)) {
    return error(c, 'You cannot manage permissions for a user with equal or higher role', 403)
  }

  try {
    rbacService.grantPermission(orgId, targetId, permission, user.id)
    return success(c, undefined, 'Permission granted')
  } catch (e: any) {
    return error(c, e.message || 'Failed to grant permission', 500)
  }
})

/** Revoke permission (explicit deny) */
app.post('/admin/permissions/:userId/revoke', requirePermission(PERMISSIONS.PERMISSIONS_MANAGE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const targetId = c.req.param('userId')
  const { permission } = await c.req.json()

  if (!permission) return error(c, 'Permission is required', 400)

  if (!rbacService.canManageUser(user.id, targetId, orgId)) {
    return error(c, 'You cannot manage permissions for a user with equal or higher role', 403)
  }

  try {
    rbacService.revokePermission(orgId, targetId, permission, user.id)
    return success(c, undefined, 'Permission revoked')
  } catch (e: any) {
    return error(c, e.message || 'Failed to revoke permission', 500)
  }
})

/** Remove permission override (revert to role default) */
app.delete('/admin/permissions/:userId/:permission', requirePermission(PERMISSIONS.PERMISSIONS_MANAGE), (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const targetId = c.req.param('userId')
  const permission = c.req.param('permission')

  if (!rbacService.canManageUser(user.id, targetId, orgId)) {
    return error(c, 'You cannot manage permissions for a user with equal or higher role', 403)
  }

  try {
    rbacService.removePermissionOverride(orgId, targetId, permission)
    return success(c, undefined, 'Permission override removed')
  } catch (e: any) {
    return error(c, e.message || 'Failed to remove permission override', 500)
  }
})

// ============================================================================
// Audit & Activity Logs (org-scoped)
// ============================================================================

/** Query audit logs */
app.get('/admin/audit-logs', requirePermission(PERMISSIONS.AUDIT_VIEW), (c) => {
  const orgId = getOrgId(c)
  const query = {
    orgId,
    action: c.req.query('action') || undefined,
    entityType: c.req.query('entityType') || undefined,
    from: c.req.query('from') || undefined,
    to: c.req.query('to') || undefined,
    page: Number(c.req.query('page')) || 1,
    limit: Math.min(Number(c.req.query('limit')) || 50, 200),
  }

  const { logs, total } = auditService.queryAuditLogs(query)
  return paginated(c, logs, { page: query.page, limit: query.limit, total })
})

/** Query activity logs */
app.get('/admin/activity-logs', requirePermission(PERMISSIONS.LOGS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const query = {
    orgId,
    action: c.req.query('action') || undefined,
    entityType: c.req.query('entityType') || undefined,
    from: c.req.query('from') || undefined,
    to: c.req.query('to') || undefined,
    page: Number(c.req.query('page')) || 1,
    limit: Math.min(Number(c.req.query('limit')) || 50, 200),
  }

  const { logs, total } = auditService.queryActivityLogs(query)
  return paginated(c, logs, { page: query.page, limit: query.limit, total })
})

/** Recent activity for dashboard */
app.get('/admin/activity/recent', requirePermission(PERMISSIONS.LOGS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100)
  const activity = auditService.getRecentActivity(orgId, limit)
  return success(c, { activity })
})

export default app
