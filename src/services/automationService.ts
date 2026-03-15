// src/services/automationService.ts - Email Marketing Automation (Drip Sequences)

import Database from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { eventBus } from './eventBus'
import { logger } from '../utils/logger'
import { generateId } from '../utils/id'
import { evaluateCondition } from './conditionEngine'
import { contactService } from './contactService'

// ============================================================================
// Types
// ============================================================================

export type TriggerType = 'list_join' | 'tag_added' | 'score_change' | 'date_field' | 'form_submit' | 'manual' | 'api'
export type AutomationStatus = 'draft' | 'active' | 'paused' | 'completed'
export type StepType =
  | 'send_email' | 'wait' | 'condition' | 'filter' | 'split_test'
  | 'delay_until' | 'http_request' | 'score_change'
  | 'update_contact' | 'add_tag' | 'remove_tag' | 'move_to_list'
  | 'webhook' | 'end'
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'exited'

export interface Automation {
  id: string
  org_id: string
  user_id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_config: string // JSON
  entry_list_id: string | null
  status: AutomationStatus
  enrolled_count: number
  completed_count: number
  flow_json: string // JSON: full flowchart definition
  created_at: string
  updated_at: string
}

export interface AutomationInput {
  name: string
  description?: string
  trigger_type: TriggerType
  trigger_config?: Record<string, unknown>
  entry_list_id?: string
  flow?: AutomationFlow
}

export interface AutomationStep {
  id: string
  automation_id: string
  step_order: number
  step_type: StepType
  config_json: string // JSON
  next_step_id: string | null
  true_step_id: string | null
  false_step_id: string | null
}

export interface AutomationEnrollment {
  id: string
  automation_id: string
  contact_id: string
  current_step_id: string | null
  status: EnrollmentStatus
  enrolled_at: string
  next_action_at: string | null
  completed_at: string | null
  exit_reason: string | null
}

export interface AutomationFlow {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export type FlowNode =
  | { id: string; type: 'trigger'; triggerType: TriggerType; config?: Record<string, unknown> }
  | { id: string; type: 'send_email'; templateId: string; subject: string }
  | { id: string; type: 'wait'; duration: number; unit: 'hours' | 'days' | 'weeks' }
  | { id: string; type: 'condition'; field: string; operator: string; value: string }
  | { id: string; type: 'filter'; field: string; operator: string; value: string }
  | { id: string; type: 'split_test'; paths: { label: string; percentage: number }[] }
  | { id: string; type: 'delay_until'; date?: string; field?: string }
  | { id: string; type: 'http_request'; url: string; method: string; headers?: Record<string, string>; bodyTemplate?: string }
  | { id: string; type: 'score_change'; amount: number; reason?: string }
  | { id: string; type: 'update_contact'; field: string; value: string }
  | { id: string; type: 'add_tag'; tag: string }
  | { id: string; type: 'remove_tag'; tag: string }
  | { id: string; type: 'move_to_list'; listId: string }
  | { id: string; type: 'webhook'; url: string; method: 'GET' | 'POST' }
  | { id: string; type: 'end' }

export interface FlowEdge {
  from: string
  to: string
  label?: 'true' | 'false' | 'default'
}

// ============================================================================
// Service
// ============================================================================

class AutomationService {
  private db: Database
  private workerInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    const dbPath = './data/automations.db'
    const dbDir = dirname(dbPath)

    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    this.db = new Database(dbPath)
    this.db.exec('PRAGMA journal_mode=WAL')
    this.db.exec('PRAGMA busy_timeout=5000')
    this.initSchema()
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        org_id TEXT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        trigger_type TEXT NOT NULL CHECK (trigger_type IN (
          'list_join', 'tag_added', 'score_change', 'date_field', 'manual', 'api'
        )),
        trigger_config TEXT NOT NULL DEFAULT '{}',
        entry_list_id TEXT,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
        enrolled_count INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        flow_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_auto_user ON automations(user_id);
      CREATE INDEX IF NOT EXISTS idx_auto_status ON automations(status);

      CREATE TABLE IF NOT EXISTS automation_steps (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        step_type TEXT NOT NULL CHECK (step_type IN (
          'send_email', 'wait', 'condition', 'update_contact', 'add_tag',
          'remove_tag', 'move_to_list', 'webhook', 'end'
        )),
        config_json TEXT NOT NULL DEFAULT '{}',
        next_step_id TEXT,
        true_step_id TEXT,
        false_step_id TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_as_automation ON automation_steps(automation_id);

      CREATE TABLE IF NOT EXISTS automation_enrollments (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        current_step_id TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'exited')),
        enrolled_at TEXT DEFAULT (datetime('now')),
        next_action_at TEXT,
        completed_at TEXT,
        exit_reason TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id),
        UNIQUE(automation_id, contact_id)
      );

      CREATE INDEX IF NOT EXISTS idx_ae_automation ON automation_enrollments(automation_id);
      CREATE INDEX IF NOT EXISTS idx_ae_next ON automation_enrollments(next_action_at) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_ae_contact ON automation_enrollments(contact_id);
    `)

    // Add org_id to existing tables (idempotent)
    try { this.db.exec('ALTER TABLE automations ADD COLUMN org_id TEXT') } catch {}
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_auto_org ON automations(org_id)')

    logger.info('Automations database initialized (data/automations.db)')
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  create(orgId: string, userId: string, input: AutomationInput): Automation {
    const id = generateId('auto')

    this.db.prepare(`
      INSERT INTO automations (id, org_id, user_id, name, description, trigger_type, trigger_config, entry_list_id, flow_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, orgId, userId, input.name,
      input.description || null,
      input.trigger_type,
      JSON.stringify(input.trigger_config || {}),
      input.entry_list_id || null,
      JSON.stringify(input.flow || { nodes: [], edges: [] })
    )

    return this.db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as Automation
  }

  get(orgId: string, automationId: string): Automation | null {
    return this.db.prepare(`
      SELECT * FROM automations WHERE id = ? AND org_id = ?
    `).get(automationId, orgId) as Automation | null
  }

  update(orgId: string, automationId: string, updates: Partial<AutomationInput>): boolean {
    const sets: string[] = []
    const params: any[] = []

    if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name) }
    if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description) }
    if (updates.trigger_type !== undefined) { sets.push('trigger_type = ?'); params.push(updates.trigger_type) }
    if (updates.trigger_config !== undefined) { sets.push('trigger_config = ?'); params.push(JSON.stringify(updates.trigger_config)) }
    if (updates.entry_list_id !== undefined) { sets.push('entry_list_id = ?'); params.push(updates.entry_list_id) }
    if (updates.flow !== undefined) { sets.push('flow_json = ?'); params.push(JSON.stringify(updates.flow)) }

    if (sets.length === 0) return false

    sets.push("updated_at = datetime('now')")
    params.push(automationId, orgId)

    const result = this.db.prepare(`
      UPDATE automations SET ${sets.join(', ')} WHERE id = ? AND org_id = ? AND status IN ('draft', 'paused')
    `).run(...params)

    return result.changes > 0
  }

  delete(orgId: string, automationId: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM automations WHERE id = ? AND org_id = ? AND status IN ('draft', 'completed')
    `).run(automationId, orgId)
    return result.changes > 0
  }

  list(orgId: string): Automation[] {
    return this.db.prepare(`
      SELECT * FROM automations WHERE org_id = ? ORDER BY updated_at DESC
    `).all(orgId) as Automation[]
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  activate(orgId: string, automationId: string): boolean {
    // First, compile flow into steps
    const automation = this.get(orgId, automationId)
    if (!automation) return false

    const flow: AutomationFlow = JSON.parse(automation.flow_json)
    this.compileFlowToSteps(automationId, flow)

    const result = this.db.prepare(`
      UPDATE automations SET status = 'active', updated_at = datetime('now')
      WHERE id = ? AND org_id = ? AND status IN ('draft', 'paused')
    `).run(automationId, orgId)

    return result.changes > 0
  }

  pause(orgId: string, automationId: string): boolean {
    const result = this.db.prepare(`
      UPDATE automations SET status = 'paused', updated_at = datetime('now')
      WHERE id = ? AND org_id = ? AND status = 'active'
    `).run(automationId, orgId)
    return result.changes > 0
  }

  deactivate(orgId: string, automationId: string): boolean {
    const result = this.db.prepare(`
      UPDATE automations SET status = 'completed', updated_at = datetime('now')
      WHERE id = ? AND org_id = ?
    `).run(automationId, orgId)
    return result.changes > 0
  }

  // --------------------------------------------------------------------------
  // Enrollment
  // --------------------------------------------------------------------------

  enrollContact(automationId: string, contactId: string): boolean {
    const firstStep = this.db.prepare(`
      SELECT id FROM automation_steps WHERE automation_id = ? ORDER BY step_order ASC LIMIT 1
    `).get(automationId) as { id: string } | null

    if (!firstStep) return false

    const id = generateId('enr')

    try {
      this.db.prepare(`
        INSERT INTO automation_enrollments (id, automation_id, contact_id, current_step_id, next_action_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(id, automationId, contactId, firstStep.id)

      this.db.prepare(`
        UPDATE automations SET enrolled_count = enrolled_count + 1 WHERE id = ?
      `).run(automationId)

      return true
    } catch {
      // Duplicate enrollment
      return false
    }
  }

  exitContact(automationId: string, contactId: string, reason: string): boolean {
    const result = this.db.prepare(`
      UPDATE automation_enrollments
      SET status = 'exited', exit_reason = ?, completed_at = datetime('now')
      WHERE automation_id = ? AND contact_id = ? AND status = 'active'
    `).run(reason, automationId, contactId)
    return result.changes > 0
  }

  getEnrollments(automationId: string, limit = 50, offset = 0): AutomationEnrollment[] {
    return this.db.prepare(`
      SELECT * FROM automation_enrollments WHERE automation_id = ?
      ORDER BY enrolled_at DESC LIMIT ? OFFSET ?
    `).all(automationId, limit, offset) as AutomationEnrollment[]
  }

  // --------------------------------------------------------------------------
  // Steps
  // --------------------------------------------------------------------------

  getSteps(automationId: string): AutomationStep[] {
    return this.db.prepare(`
      SELECT * FROM automation_steps WHERE automation_id = ? ORDER BY step_order
    `).all(automationId) as AutomationStep[]
  }

  private compileFlowToSteps(automationId: string, flow: AutomationFlow): void {
    // Clear existing steps
    this.db.prepare('DELETE FROM automation_steps WHERE automation_id = ?').run(automationId)

    if (!flow.nodes || flow.nodes.length === 0) return

    const stmt = this.db.prepare(`
      INSERT INTO automation_steps (id, automation_id, step_order, step_type, config_json, next_step_id, true_step_id, false_step_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = this.db.transaction(() => {
      for (let i = 0; i < flow.nodes.length; i++) {
        const node = flow.nodes[i]
        const stepId = `step_${automationId}_${i}`

        // Find outgoing edges
        const defaultEdge = flow.edges.find(e => e.from === node.id && (!e.label || e.label === 'default'))
        const trueEdge = flow.edges.find(e => e.from === node.id && e.label === 'true')
        const falseEdge = flow.edges.find(e => e.from === node.id && e.label === 'false')

        // Map edge targets to step IDs
        const findStepId = (nodeId: string) => {
          const idx = flow.nodes.findIndex(n => n.id === nodeId)
          return idx >= 0 ? `step_${automationId}_${idx}` : null
        }

        const { id: _, type, ...config } = node as any

        stmt.run(
          stepId,
          automationId,
          i,
          type,
          JSON.stringify(config),
          defaultEdge ? findStepId(defaultEdge.to) : null,
          trueEdge ? findStepId(trueEdge.to) : null,
          falseEdge ? findStepId(falseEdge.to) : null
        )
      }
    })

    transaction()
  }

  // --------------------------------------------------------------------------
  // Worker (process due enrollments)
  // --------------------------------------------------------------------------

  /**
   * Process all due enrollment actions. Called by worker interval.
   * Returns number of enrollments processed.
   */
  processDueActions(): number {
    const due = this.db.prepare(`
      SELECT e.*, s.step_type, s.config_json, s.next_step_id, s.true_step_id, s.false_step_id, a.org_id
      FROM automation_enrollments e
      JOIN automation_steps s ON e.current_step_id = s.id
      JOIN automations a ON e.automation_id = a.id
      WHERE e.status = 'active' AND e.next_action_at <= datetime('now')
      ORDER BY e.next_action_at
      LIMIT 100
    `).all() as (AutomationEnrollment & { step_type: StepType; config_json: string; next_step_id: string | null; true_step_id: string | null; false_step_id: string | null; org_id: string })[]

    let processed = 0

    for (const enrollment of due) {
      try {
        this.executeStep(enrollment)
        processed++
      } catch (err) {
        logger.error(`Automation step error for enrollment ${enrollment.id}:`, err)
      }
    }

    return processed
  }

  private executeStep(enrollment: AutomationEnrollment & { step_type: StepType; config_json: string; next_step_id: string | null; true_step_id: string | null; false_step_id: string | null; org_id: string }): void {
    const config = JSON.parse(enrollment.config_json)

    switch (enrollment.step_type) {
      case 'send_email':
        // Emit event - the email sending is handled by the queue/campaign system
        eventBus.emit('automation_step_completed', '', {
          automationId: enrollment.automation_id,
          contactId: enrollment.contact_id,
          stepType: 'send_email',
          templateId: config.templateId,
          subject: config.subject,
        })
        this.advanceToNext(enrollment.id, enrollment.next_step_id)
        break

      case 'wait': {
        const duration = config.duration || 1
        const unit = config.unit || 'days'
        const delayMs = this.unitToMs(duration, unit)
        const nextAt = new Date(Date.now() + delayMs).toISOString()

        // Move to next step but schedule the action time
        this.db.prepare(`
          UPDATE automation_enrollments SET current_step_id = ?, next_action_at = ? WHERE id = ?
        `).run(enrollment.next_step_id, nextAt, enrollment.id)
        break
      }

      case 'condition': {
        // Evaluate condition against contact data
        const contact = contactService.getContact(enrollment.org_id || '', enrollment.contact_id)
        if (contact) {
          const result = evaluateCondition(contact, { field: config.field, operator: config.operator, value: config.value })
          this.advanceToNext(enrollment.id, result ? (enrollment.true_step_id || enrollment.next_step_id) : (enrollment.false_step_id || enrollment.next_step_id))
        } else {
          // Contact not found — take false branch
          this.advanceToNext(enrollment.id, enrollment.false_step_id || enrollment.next_step_id)
        }
        break
      }

      case 'filter': {
        // Filter is like condition but only has one output (pass or exit)
        const filterContact = contactService.getContact(enrollment.org_id || '', enrollment.contact_id)
        if (filterContact && evaluateCondition(filterContact, { field: config.field, operator: config.operator, value: config.value })) {
          this.advanceToNext(enrollment.id, enrollment.next_step_id)
        } else {
          // Filtered out — exit automation
          this.db.prepare(`
            UPDATE automation_enrollments SET status = 'exited', exit_reason = 'filtered', completed_at = datetime('now') WHERE id = ?
          `).run(enrollment.id)
        }
        break
      }

      case 'split_test': {
        // A/B split — randomly choose path based on percentages
        const paths: { label: string; percentage: number }[] = config.paths || []
        const rand = Math.random() * 100
        let cumulative = 0
        let chosenIndex = 0
        for (let i = 0; i < paths.length; i++) {
          cumulative += paths[i].percentage
          if (rand < cumulative) { chosenIndex = i; break }
        }
        // For split tests, step has multiple next_step references encoded in config
        const nextSteps: string[] = config.next_steps || []
        this.advanceToNext(enrollment.id, nextSteps[chosenIndex] || enrollment.next_step_id)
        break
      }

      case 'delay_until': {
        // Wait until a specific date or contact field date
        let targetDate: string
        if (config.field) {
          const dateContact = contactService.getContact(enrollment.org_id || '', enrollment.contact_id)
          const customFields = dateContact ? JSON.parse(dateContact.custom_fields || '{}') : {}
          targetDate = customFields[config.field] || new Date().toISOString()
        } else {
          targetDate = config.date || new Date().toISOString()
        }
        if (new Date(targetDate) <= new Date()) {
          this.advanceToNext(enrollment.id, enrollment.next_step_id)
        } else {
          this.db.prepare(`
            UPDATE automation_enrollments SET next_action_at = ? WHERE id = ?
          `).run(targetDate, enrollment.id)
        }
        break
      }

      case 'http_request': {
        // Call external API
        const url = config.url
        if (url) {
          fetch(url, {
            method: config.method || 'POST',
            headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
            body: config.bodyTemplate || JSON.stringify({ contactId: enrollment.contact_id }),
          }).catch((err) => logger.error('HTTP request node error:', err))
        }
        this.advanceToNext(enrollment.id, enrollment.next_step_id)
        break
      }

      case 'score_change': {
        // Change engagement score
        eventBus.emit('automation_step_completed', '', {
          automationId: enrollment.automation_id,
          contactId: enrollment.contact_id,
          stepType: 'score_change',
          amount: config.amount || 0,
          reason: config.reason || 'automation',
        })
        this.advanceToNext(enrollment.id, enrollment.next_step_id)
        break
      }

      case 'add_tag':
      case 'remove_tag':
      case 'update_contact':
      case 'move_to_list':
        // Emit event for contact updates
        eventBus.emit('automation_step_completed', '', {
          automationId: enrollment.automation_id,
          contactId: enrollment.contact_id,
          stepType: enrollment.step_type,
          config,
        })
        this.advanceToNext(enrollment.id, enrollment.next_step_id)
        break

      case 'webhook':
        // Fire webhook
        if (config.url) {
          fetch(config.url, {
            method: config.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId: enrollment.contact_id, automationId: enrollment.automation_id }),
          }).catch(() => {})
        }
        this.advanceToNext(enrollment.id, enrollment.next_step_id)
        break

      case 'end':
        this.db.prepare(`
          UPDATE automation_enrollments SET status = 'completed', completed_at = datetime('now') WHERE id = ?
        `).run(enrollment.id)
        this.db.prepare(`
          UPDATE automations SET completed_count = completed_count + 1 WHERE id = ?
        `).run(enrollment.automation_id)
        break
    }
  }

  private advanceToNext(enrollmentId: string, nextStepId: string | null): void {
    if (!nextStepId) {
      // No next step - complete the enrollment
      this.db.prepare(`
        UPDATE automation_enrollments SET status = 'completed', completed_at = datetime('now') WHERE id = ?
      `).run(enrollmentId)
      return
    }

    this.db.prepare(`
      UPDATE automation_enrollments SET current_step_id = ?, next_action_at = datetime('now') WHERE id = ?
    `).run(nextStepId, enrollmentId)
  }

  private unitToMs(duration: number, unit: string): number {
    switch (unit) {
      case 'hours': return duration * 60 * 60 * 1000
      case 'days': return duration * 24 * 60 * 60 * 1000
      case 'weeks': return duration * 7 * 24 * 60 * 60 * 1000
      default: return duration * 24 * 60 * 60 * 1000
    }
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  getStats(automationId: string): { enrolled: number; active: number; completed: number; exited: number } {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as enrolled,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'exited' THEN 1 ELSE 0 END) as exited
      FROM automation_enrollments WHERE automation_id = ?
    `).get(automationId) as any

    return {
      enrolled: row.enrolled || 0,
      active: row.active || 0,
      completed: row.completed || 0,
      exited: row.exited || 0,
    }
  }

  /**
   * Start the automation worker (polls every 60 seconds)
   */
  startWorker(intervalMs = 60000): void {
    if (this.workerInterval) return

    this.workerInterval = setInterval(() => {
      const processed = this.processDueActions()
      if (processed > 0) {
        logger.debug(`Automation worker processed ${processed} actions`)
      }
    }, intervalMs)

    logger.startup('   Automation worker started (60s interval)')
  }

  stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval)
      this.workerInterval = null
    }
  }
}

export const automationService = new AutomationService()
