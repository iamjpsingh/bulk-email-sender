// src/routes/admin.ts - Admin API routes

import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, getOrgId } from '../middleware/auth'
import { requirePermission, requireAnyPermission, requirePlatformAdmin, requireOrgMember } from '../middleware/rbac'
import { PERMISSIONS } from '../services/rbacService'
import { authLocalService } from '../services/authLocalService'
import { orgService } from '../services/orgService'
import { teamService } from '../services/teamService'
import { rbacService } from '../services/rbacService'
import { auditService } from '../services/auditService'
import { invitationService } from '../services/invitationService'
import { systemSettingsService } from '../services/systemSettingsService'
import { systemMailerService } from '../services/systemMailerService'
import type { SystemMailerConfig, GmailOAuthProviderConfig, OutlookOAuthProviderConfig } from '../services/systemMailerService'
import { SERVER } from '../config'
import { success, error, paginated } from '../utils/response'
import { validateBody } from '../utils/validate'

// ============================================================================
// Schemas
// ============================================================================

const EmailSchema = z.object({ email: z.string().email('Valid email is required') })

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.record(z.unknown()).optional(),
})

const AddMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.string().max(50).optional(),
})

const RoleSchema = z.object({ role: z.string().min(1, 'Role is required').max(50) })

const TeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(200),
  description: z.string().max(1000).optional(),
})

const TeamMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: z.string().max(50).optional(),
})

const PermissionSchema = z.object({ permission: z.string().min(1, 'Permission is required') })

const InviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['admin', 'manager', 'member', 'readonly']).default('member'),
})

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
// Platform Settings (system mailer, OAuth config, etc.)
// ============================================================================

/** Get system mailer config (sensitive fields masked) */
app.get('/admin/platform/settings/mailer', requirePlatformAdmin(), (c) => {
  const masked = systemMailerService.getMaskedConfig()
  return success(c, { configured: !!masked, config: masked })
})

/** Save system mailer config */
app.put('/admin/platform/settings/mailer', requirePlatformAdmin(), async (c) => {
  const user = requireAuth(c)
  try {
    const body = await c.req.json() as SystemMailerConfig
    if (!body.fromName || !body.fromEmail || !body.providerConfig?.provider) {
      return error(c, 'fromName, fromEmail, and providerConfig are required', 400)
    }
    systemMailerService.saveConfig(body, user.id)
    return success(c, undefined, 'System mailer configuration saved')
  } catch (e: any) {
    return error(c, e.message || 'Failed to save mailer config', 500)
  }
})

/** Test system mailer connection */
app.post('/admin/platform/settings/mailer/test', requirePlatformAdmin(), async (c) => {
  try {
    const result = await systemMailerService.verify()
    if (result.success) return success(c, undefined, 'Connection verified successfully')
    return error(c, `Connection failed: ${result.error}`, 400)
  } catch (e: any) {
    return error(c, e.message || 'Test failed', 500)
  }
})

/** Send a test email via system mailer */
app.post('/admin/platform/settings/mailer/send-test', requirePlatformAdmin(), async (c) => {
  const user = requireAuth(c)
  try {
    await systemMailerService.send({
      to: user.email,
      subject: 'Dispatch — Test Email',
      html: '<div style="font-family: sans-serif; padding: 20px;"><h2>Test Email</h2><p>Your system mailer is working correctly.</p><p style="color: #888; font-size: 12px;">Sent by Dispatch</p></div>',
      text: 'Test Email\n\nYour system mailer is working correctly.',
    })
    return success(c, undefined, `Test email sent to ${user.email}`)
  } catch (e: any) {
    return error(c, e.message || 'Failed to send test email', 500)
  }
})

/** Remove system mailer config */
app.delete('/admin/platform/settings/mailer', requirePlatformAdmin(), (c) => {
  const user = requireAuth(c)
  systemMailerService.removeConfig(user.id)
  return success(c, undefined, 'System mailer configuration removed')
})

/** Get/save OAuth credentials (Google/Microsoft client ID+secret for the platform) */
app.get('/admin/platform/settings/oauth', requirePlatformAdmin(), (c) => {
  const google = systemSettingsService.getJson<{ clientId: string; clientSecret: string }>('oauth_google') || null
  const microsoft = systemSettingsService.getJson<{ clientId: string; clientSecret: string }>('oauth_microsoft') || null
  return success(c, {
    google: google ? { clientId: google.clientId, clientSecret: '********' } : null,
    microsoft: microsoft ? { clientId: microsoft.clientId, clientSecret: '********' } : null,
  })
})

app.put('/admin/platform/settings/oauth', requirePlatformAdmin(), async (c) => {
  const user = requireAuth(c)
  try {
    const body = await c.req.json() as { provider: 'google' | 'microsoft'; clientId: string; clientSecret: string }
    if (!body.provider || !body.clientId || !body.clientSecret) {
      return error(c, 'provider, clientId, and clientSecret required', 400)
    }
    systemSettingsService.setJson(`oauth_${body.provider}`, { clientId: body.clientId, clientSecret: body.clientSecret }, user.id)
    return success(c, undefined, `${body.provider} OAuth credentials saved`)
  } catch (e: any) {
    return error(c, e.message || 'Failed', 500)
  }
})

/** Initiate OAuth connect flow for platform system mailer (Gmail/Outlook) */
app.get('/admin/platform/settings/mailer/oauth/:provider/connect', requirePlatformAdmin(), (c) => {
  const user = requireAuth(c)
  const provider = c.req.param('provider') as 'gmail' | 'outlook'

  const oauthCreds = systemSettingsService.getJson<{ clientId: string; clientSecret: string }>(`oauth_${provider === 'gmail' ? 'google' : 'microsoft'}`)
  if (!oauthCreds) return error(c, `${provider} OAuth credentials not configured. Save Client ID and Secret first.`, 400)

  const state = Buffer.from(JSON.stringify({ userId: user.id, purpose: 'platform_mailer', provider })).toString('base64url')

  if (provider === 'gmail') {
    const params = new URLSearchParams({
      client_id: oauthCreds.clientId,
      redirect_uri: `${SERVER.BASE_URL}/api/admin/platform/settings/mailer/oauth/callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return success(c, { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
  } else {
    const params = new URLSearchParams({
      client_id: oauthCreds.clientId,
      redirect_uri: `${SERVER.BASE_URL}/api/admin/platform/settings/mailer/oauth/callback`,
      response_type: 'code',
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
      state,
    })
    return success(c, { authUrl: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` })
  }
})

/** OAuth callback for platform system mailer */
app.get('/admin/platform/settings/mailer/oauth/callback', async (c) => {
  const code = c.req.query('code')
  const stateParam = c.req.query('state')
  const oauthError = c.req.query('error')

  if (oauthError || !code || !stateParam) {
    return c.redirect(`${SERVER.FRONTEND_URL}/admin/platform-settings?oauth_error=${oauthError || 'missing_code'}`)
  }

  let stateData: { userId: string; purpose: string; provider: string }
  try {
    stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return c.redirect(`${SERVER.FRONTEND_URL}/admin/platform-settings?oauth_error=invalid_state`)
  }

  const provider = stateData.provider as 'gmail' | 'outlook'
  const oauthKey = provider === 'gmail' ? 'google' : 'microsoft'
  const oauthCreds = systemSettingsService.getJson<{ clientId: string; clientSecret: string }>(`oauth_${oauthKey}`)
  if (!oauthCreds) return c.redirect(`${SERVER.FRONTEND_URL}/admin/platform-settings?oauth_error=no_credentials`)

  const redirectUri = `${SERVER.BASE_URL}/api/admin/platform/settings/mailer/oauth/callback`

  try {
    if (provider === 'gmail') {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: oauthCreds.clientId, client_secret: oauthCreds.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      })
      if (!tokenRes.ok) throw new Error('Token exchange failed')
      const tokens = await tokenRes.json() as any

      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const userInfo = await userRes.json() as any

      // Get existing mailer config or create base
      const existing = systemMailerService.getConfig()
      const config: SystemMailerConfig = {
        fromName: existing?.fromName || 'Dispatch',
        fromEmail: userInfo.email,
        providerConfig: {
          provider: 'gmail',
          email: userInfo.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          clientId: oauthCreds.clientId,
          clientSecret: oauthCreds.clientSecret,
        },
      }
      systemMailerService.saveConfig(config, stateData.userId)
      return c.redirect(`${SERVER.FRONTEND_URL}/admin/platform-settings?oauth_success=gmail&email=${encodeURIComponent(userInfo.email)}`)
    } else {
      const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: oauthCreds.clientId, client_secret: oauthCreds.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access' }),
      })
      if (!tokenRes.ok) throw new Error('Token exchange failed')
      const tokens = await tokenRes.json() as any

      const userRes = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const userInfo = await userRes.json() as any
      const email = userInfo.mail || userInfo.userPrincipalName

      const existing = systemMailerService.getConfig()
      const config: SystemMailerConfig = {
        fromName: existing?.fromName || 'Dispatch',
        fromEmail: email,
        providerConfig: {
          provider: 'outlook',
          email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
          clientId: oauthCreds.clientId,
          clientSecret: oauthCreds.clientSecret,
        },
      }
      systemMailerService.saveConfig(config, stateData.userId)
      return c.redirect(`${SERVER.FRONTEND_URL}/admin/platform-settings?oauth_success=outlook&email=${encodeURIComponent(email)}`)
    }
  } catch (e: any) {
    return c.redirect(`${SERVER.FRONTEND_URL}/admin/platform-settings?oauth_error=${encodeURIComponent(e.message)}`)
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
  const updates = await validateBody(c, UpdateOrgSchema)

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
  const { email, role } = await validateBody(c, AddMemberSchema)

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
  const { role } = await validateBody(c, RoleSchema)

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
  const { name, description } = await validateBody(c, TeamSchema)

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
  const updates = await validateBody(c, TeamSchema.partial())

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
  const { userId, role } = await validateBody(c, TeamMemberSchema)

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

/** List system roles (excludes platform_super_admin — invisible to org users) */
app.get('/admin/roles', requirePermission(PERMISSIONS.ROLES_VIEW), (c) => {
  const roles = rbacService.listSystemRoles().filter(r => r.name !== 'platform_super_admin')
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
  const { permission } = await validateBody(c, PermissionSchema)

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
  const { permission } = await validateBody(c, PermissionSchema)

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

// ============================================================================
// Invitations (org-scoped)
// ============================================================================

/** List pending invitations for current org */
app.get('/admin/invitations', requirePermission(PERMISSIONS.USERS_VIEW), (c) => {
  const orgId = getOrgId(c)
  const invitations = invitationService.listForOrg(orgId)
  return success(c, { invitations })
})

/** Send an invitation */
app.post('/admin/invitations', requirePermission(PERMISSIONS.USERS_INVITE), async (c) => {
  const user = requireAuth(c)
  const orgId = getOrgId(c)
  const { email, role } = await validateBody(c, InviteSchema)

  try {
    const invitation = invitationService.create(orgId, email, role, user.id)
    return success(c, invitation, 'Invitation sent', 201)
  } catch (e: any) {
    return error(c, e.message || 'Failed to send invitation', 400)
  }
})

/** Cancel an invitation */
app.delete('/admin/invitations/:id', requirePermission(PERMISSIONS.USERS_INVITE), (c) => {
  const user = requireAuth(c)
  const id = c.req.param('id')

  const cancelled = invitationService.cancel(id, user.id)
  if (!cancelled) return error(c, 'Invitation not found or already processed', 404)
  return success(c, undefined, 'Invitation cancelled')
})

/** Resend an invitation */
app.post('/admin/invitations/:id/resend', requirePermission(PERMISSIONS.USERS_INVITE), (c) => {
  const user = requireAuth(c)
  const id = c.req.param('id')

  const invitation = invitationService.resend(id, user.id)
  if (!invitation) return error(c, 'Invitation not found or already processed', 404)
  return success(c, invitation, 'Invitation resent')
})

// ============================================================================
// Invitation acceptance (authenticated, no org context needed)
// ============================================================================

/** Get invitation details by token (for accept page) */
app.get('/admin/invitations/accept/:token', (c) => {
  const token = c.req.param('token')
  const invitation = invitationService.getByToken(token)
  if (!invitation) return error(c, 'Invalid or expired invitation', 404)
  return success(c, {
    orgName: invitation.org_name,
    inviterName: invitation.inviter_name,
    role: invitation.role,
    email: invitation.email,
  })
})

/** Accept an invitation */
app.post('/admin/invitations/accept/:token', (c) => {
  const user = requireAuth(c)
  const token = c.req.param('token')

  const result = invitationService.accept(token, user.id)
  if (!result) return error(c, 'Invalid invitation or email mismatch', 400)
  return success(c, result, 'Invitation accepted')
})

/** List my pending invitations (for current user's email) */
app.get('/admin/invitations/mine', (c) => {
  const user = requireAuth(c)
  const invitations = invitationService.listForEmail(user.email)
  return success(c, { invitations })
})

export default app
