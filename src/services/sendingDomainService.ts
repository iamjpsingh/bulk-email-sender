// src/services/sendingDomainService.ts — Domain + Sending Email Management

import { db } from '../db/connection'
import { generateId } from '../utils/id'
import { logger } from '../utils/logger'

// ============================================================================
// Types
// ============================================================================

export interface SendingDomain {
  id: string
  org_id: string
  domain: string
  verification_status: 'pending' | 'verified' | 'failed'
  dkim_selector: string | null
  dkim_record: string | null
  spf_included: number
  return_path: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface SendingEmail {
  id: string
  org_id: string
  domain_id: string
  email: string
  display_name: string | null
  is_default: number
  assigned_to: string | null
  status: 'active' | 'disabled'
  created_at: string
}

// ============================================================================
// Service
// ============================================================================

class SendingDomainService {
  // ---------- Domains ----------

  addDomain(orgId: string, domain: string): SendingDomain {
    const id = generateId('dom')
    const normalized = domain.toLowerCase().trim()

    const existing = db.prepare('SELECT 1 FROM sending_domains WHERE org_id = ? AND domain = ?').get(orgId, normalized)
    if (existing) throw new Error(`Domain "${normalized}" already exists`)

    // Generate DKIM selector
    const selector = `dispatch${Date.now() % 10000}`

    db.prepare(`
      INSERT INTO sending_domains (id, org_id, domain, dkim_selector, return_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, orgId, normalized, selector, `bounce.${normalized}`)

    logger.info(`[Domain] Added ${normalized} for org ${orgId}`)
    return db.prepare('SELECT * FROM sending_domains WHERE id = ?').get(id) as SendingDomain
  }

  listDomains(orgId: string): SendingDomain[] {
    return db.prepare('SELECT * FROM sending_domains WHERE org_id = ? ORDER BY created_at DESC').all(orgId) as SendingDomain[]
  }

  getDomain(orgId: string, domainId: string): SendingDomain | null {
    return db.prepare('SELECT * FROM sending_domains WHERE id = ? AND org_id = ?').get(domainId, orgId) as SendingDomain | null
  }

  /**
   * Get DNS records the org needs to add for domain verification.
   */
  getDnsRecords(domain: SendingDomain): { type: string; name: string; value: string; purpose: string }[] {
    return [
      {
        type: 'TXT',
        name: `${domain.dkim_selector}._domainkey.${domain.domain}`,
        value: `v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY`,
        purpose: 'DKIM — Email authentication',
      },
      {
        type: 'TXT',
        name: domain.domain,
        value: 'v=spf1 include:_spf.dispatch.app ~all',
        purpose: 'SPF — Authorize sending',
      },
      {
        type: 'TXT',
        name: `_dmarc.${domain.domain}`,
        value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@dispatch.app',
        purpose: 'DMARC — Policy enforcement',
      },
      {
        type: 'CNAME',
        name: `bounce.${domain.domain}`,
        value: 'bounce.dispatch.app',
        purpose: 'Return-Path — Bounce handling',
      },
    ]
  }

  /**
   * Verify domain DNS records. In production, this would do DNS lookups.
   * For now, marks as verified when called.
   */
  verifyDomain(orgId: string, domainId: string): boolean {
    const result = db.prepare(`
      UPDATE sending_domains
      SET verification_status = 'verified', verified_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND org_id = ?
    `).run(domainId, orgId)
    return result.changes > 0
  }

  deleteDomain(orgId: string, domainId: string): boolean {
    const result = db.prepare('DELETE FROM sending_domains WHERE id = ? AND org_id = ?').run(domainId, orgId)
    return result.changes > 0
  }

  // ---------- Sending Emails ----------

  addEmail(orgId: string, domainId: string, email: string, displayName?: string, assignedTo?: string): SendingEmail {
    const id = generateId('se')

    // Verify domain belongs to org
    const domain = this.getDomain(orgId, domainId)
    if (!domain) throw new Error('Domain not found')

    // Verify email matches domain
    const emailDomain = email.split('@')[1]?.toLowerCase()
    if (emailDomain !== domain.domain) throw new Error(`Email must be on domain ${domain.domain}`)

    db.prepare(`
      INSERT INTO sending_emails (id, org_id, domain_id, email, display_name, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, orgId, domainId, email.toLowerCase(), displayName || null, assignedTo || null)

    return db.prepare('SELECT * FROM sending_emails WHERE id = ?').get(id) as SendingEmail
  }

  listEmails(orgId: string, domainId?: string): SendingEmail[] {
    if (domainId) {
      return db.prepare('SELECT * FROM sending_emails WHERE org_id = ? AND domain_id = ? ORDER BY created_at DESC').all(orgId, domainId) as SendingEmail[]
    }
    return db.prepare('SELECT * FROM sending_emails WHERE org_id = ? ORDER BY created_at DESC').all(orgId) as SendingEmail[]
  }

  /**
   * Get sending emails available to a specific user.
   * Returns emails assigned to them or to everyone (assigned_to IS NULL).
   */
  listEmailsForUser(orgId: string, userId: string): SendingEmail[] {
    return db.prepare(`
      SELECT se.*, sd.domain, sd.verification_status
      FROM sending_emails se
      JOIN sending_domains sd ON se.domain_id = sd.id
      WHERE se.org_id = ? AND se.status = 'active'
      AND (se.assigned_to IS NULL OR se.assigned_to = ?)
      AND sd.verification_status = 'verified'
      ORDER BY se.is_default DESC, se.created_at DESC
    `).all(orgId, userId) as any[]
  }

  updateEmail(orgId: string, emailId: string, updates: { display_name?: string; assigned_to?: string | null; is_default?: boolean }): boolean {
    const sets: string[] = []
    const params: any[] = []
    if (updates.display_name !== undefined) { sets.push('display_name = ?'); params.push(updates.display_name) }
    if (updates.assigned_to !== undefined) { sets.push('assigned_to = ?'); params.push(updates.assigned_to) }
    if (updates.is_default !== undefined) {
      if (updates.is_default) {
        // Clear other defaults in org
        db.prepare('UPDATE sending_emails SET is_default = 0 WHERE org_id = ?').run(orgId)
      }
      sets.push('is_default = ?'); params.push(updates.is_default ? 1 : 0)
    }
    if (sets.length === 0) return false
    params.push(emailId, orgId)
    const result = db.prepare(`UPDATE sending_emails SET ${sets.join(', ')} WHERE id = ? AND org_id = ?`).run(...params)
    return result.changes > 0
  }

  deleteEmail(orgId: string, emailId: string): boolean {
    const result = db.prepare('DELETE FROM sending_emails WHERE id = ? AND org_id = ?').run(emailId, orgId)
    return result.changes > 0
  }
}

export const sendingDomainService = new SendingDomainService()
