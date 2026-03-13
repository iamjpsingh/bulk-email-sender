import { db } from '../db/connection'
import { auditService } from './auditService'
import { orgService } from './orgService'

export interface AuthUser {
  id: string
  email: string
  name: string
  status: string
  is_platform_admin: number
}

export interface AuthSession {
  token: string
  user: AuthUser
  orgId: string | null
  expiresAt: string
}

class AuthLocalService {
  /**
   * Register a new user. Creates a personal org for them.
   */
  async register(email: string, password: string, name: string): Promise<AuthSession | null> {
    const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase().trim())
    if (existing) return null

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' })

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), name.trim(), passwordHash)

    // Create personal org
    const org = orgService.create(userId, `${name.trim()}'s Workspace`)

    // Create session
    const session = this.createSession(userId, org.id)

    auditService.log({
      orgId: org.id,
      actorId: userId,
      actorEmail: email,
      action: 'user.register',
      entityType: 'user',
      entityId: userId,
    })

    return session
  }

  /**
   * Login with email/password
   */
  async login(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<AuthSession | null> {
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?').get(
      email.toLowerCase().trim(), 'active'
    ) as (AuthUser & { password_hash: string }) | null

    if (!user) return null

    const valid = await Bun.password.verify(password, user.password_hash)
    if (!valid) return null

    // Update last login
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id)

    // Get user's default org (first active org they're a member of)
    const orgs = orgService.listForUser(user.id)
    const defaultOrgId = orgs.length > 0 ? orgs[0].id : null

    const session = this.createSession(user.id, defaultOrgId, ipAddress, userAgent)

    auditService.log({
      orgId: defaultOrgId || undefined,
      actorId: user.id,
      actorEmail: user.email,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
    })

    return session
  }

  /**
   * Logout - delete session
   */
  logout(token: string): boolean {
    const session = db.prepare('SELECT user_id, org_id FROM sessions WHERE token = ?').get(token) as { user_id: string; org_id: string | null } | null

    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)

    if (session) {
      auditService.log({
        orgId: session.org_id || undefined,
        actorId: session.user_id,
        action: 'user.logout',
        entityType: 'session',
      })
    }

    return true
  }

  /**
   * Validate session token. Returns user + org context.
   * Synchronous - bun:sqlite is sync.
   */
  validateSession(token: string): { user: AuthUser; orgId: string | null } | null {
    const row = db.prepare(`
      SELECT s.user_id, s.org_id, s.expires_at,
             u.id, u.email, u.name, u.status, u.is_platform_admin
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now') AND u.status = 'active'
    `).get(token) as any

    if (!row) return null

    return {
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        status: row.status,
        is_platform_admin: row.is_platform_admin,
      },
      orgId: row.org_id,
    }
  }

  /**
   * Switch active org for a session
   */
  switchOrg(token: string, orgId: string): boolean {
    const result = db.prepare('UPDATE sessions SET org_id = ? WHERE token = ?').run(orgId, token)
    return result.changes > 0
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): AuthUser | null {
    return db.prepare('SELECT id, email, name, status, is_platform_admin FROM users WHERE id = ?').get(userId) as AuthUser | null
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): AuthUser | null {
    return db.prepare('SELECT id, email, name, status, is_platform_admin FROM users WHERE email = ?').get(email.toLowerCase().trim()) as AuthUser | null
  }

  /**
   * Create a platform super admin
   */
  async createPlatformAdmin(email: string, password: string, name: string): Promise<AuthUser | null> {
    const session = await this.register(email, password, name)
    if (!session) return null

    db.prepare('UPDATE users SET is_platform_admin = 1 WHERE id = ?').run(session.user.id)
    return { ...session.user, is_platform_admin: 1 }
  }

  /**
   * Promote existing user to platform admin
   */
  promoteToPlatformAdmin(userId: string): boolean {
    const result = db.prepare('UPDATE users SET is_platform_admin = 1 WHERE id = ?').run(userId)
    return result.changes > 0
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions(): number {
    const result = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run()
    return result.changes
  }

  /**
   * List all users (platform admin only)
   */
  listAllUsers(page = 1, limit = 50): { users: AuthUser[]; total: number } {
    const offset = (page - 1) * limit
    const total = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count
    const users = db.prepare(`
      SELECT id, email, name, status, is_platform_admin, last_login_at, created_at
      FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset) as AuthUser[]
    return { users, total }
  }

  // ------- Private -------

  private createSession(userId: string, orgId: string | null, ipAddress?: string, userAgent?: string): AuthSession {
    const token = this.generateToken()
    const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, org_id, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, token, orgId, ipAddress || null, userAgent || null, expiresAt)

    const user = this.getUser(userId)!
    return { token, user, orgId, expiresAt }
  }

  private generateToken(): string {
    const bytes = new Uint8Array(48)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

export const authLocalService = new AuthLocalService()
