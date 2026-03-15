// src/services/bounceProcessor.ts - Unified Bounce/Complaint Handler

import { logger } from '../utils/logger'
import { queueEngine } from './queueEngine'
import { eventBus } from './eventBus'

export type BounceType = 'hard_bounce' | 'soft_bounce' | 'complaint' | 'unsubscribe'

export interface BounceEvent {
  email: string
  type: BounceType
  reason: string
  code?: string
  provider: string
  rawEvent?: unknown
}

// ============================================================================
// Provider-Specific Parsers
// ============================================================================

/**
 * Parse AWS SES SNS notification.
 * SES sends via SNS with notificationType: "Bounce" | "Complaint" | "Delivery"
 */
export function parseSES(payload: any): BounceEvent | null {
  // Handle SNS subscription confirmation
  if (payload.Type === 'SubscriptionConfirmation') {
    logger.info('SES SNS subscription confirmation — visit SubscribeURL to confirm')
    return null
  }

  // Parse SNS message wrapper
  const message = payload.Type === 'Notification' ? JSON.parse(payload.Message) : payload

  if (message.notificationType === 'Bounce') {
    const bounce = message.bounce
    const recipients = bounce?.bouncedRecipients || []
    if (recipients.length === 0) return null

    const recipient = recipients[0]
    const isHard = bounce.bounceType === 'Permanent'

    return {
      email: recipient.emailAddress,
      type: isHard ? 'hard_bounce' : 'soft_bounce',
      reason: recipient.diagnosticCode || bounce.bounceSubType || 'Bounce',
      code: recipient.status,
      provider: 'ses',
      rawEvent: payload,
    }
  }

  if (message.notificationType === 'Complaint') {
    const complaint = message.complaint
    const recipients = complaint?.complainedRecipients || []
    if (recipients.length === 0) return null

    return {
      email: recipients[0].emailAddress,
      type: 'complaint',
      reason: complaint.complaintFeedbackType || 'Spam complaint',
      provider: 'ses',
      rawEvent: payload,
    }
  }

  return null
}

/**
 * Parse Mailgun webhook event.
 * Mailgun POSTs form data with event-data JSON.
 */
export function parseMailgun(payload: any): BounceEvent | null {
  const eventData = payload['event-data'] || payload

  const event = eventData.event
  const recipient = eventData.recipient

  if (!recipient) return null

  if (event === 'failed') {
    const severity = eventData.severity // 'permanent' or 'temporary'
    const reason = eventData['delivery-status']?.message || eventData['delivery-status']?.description || 'Delivery failed'
    const code = eventData['delivery-status']?.code?.toString()

    return {
      email: recipient,
      type: severity === 'permanent' ? 'hard_bounce' : 'soft_bounce',
      reason,
      code,
      provider: 'mailgun',
      rawEvent: payload,
    }
  }

  if (event === 'complained') {
    return {
      email: recipient,
      type: 'complaint',
      reason: 'Spam complaint via Mailgun',
      provider: 'mailgun',
      rawEvent: payload,
    }
  }

  if (event === 'unsubscribed') {
    return {
      email: recipient,
      type: 'unsubscribe',
      reason: 'Unsubscribed via Mailgun',
      provider: 'mailgun',
      rawEvent: payload,
    }
  }

  return null
}

/**
 * Parse SendGrid Event Webhook.
 * SendGrid POSTs a JSON array of events.
 */
export function parseSendGrid(events: any[]): BounceEvent[] {
  const results: BounceEvent[] = []

  for (const event of events) {
    const email = event.email
    if (!email) continue

    if (event.event === 'bounce' || event.event === 'dropped') {
      results.push({
        email,
        type: event.type === 'blocked' ? 'soft_bounce' : 'hard_bounce',
        reason: event.reason || event.response || 'Bounce',
        code: event.status,
        provider: 'sendgrid',
        rawEvent: event,
      })
    }

    if (event.event === 'spamreport') {
      results.push({
        email,
        type: 'complaint',
        reason: 'Spam report via SendGrid',
        provider: 'sendgrid',
        rawEvent: event,
      })
    }

    if (event.event === 'unsubscribe' || event.event === 'group_unsubscribe') {
      results.push({
        email,
        type: 'unsubscribe',
        reason: 'Unsubscribed via SendGrid',
        provider: 'sendgrid',
        rawEvent: event,
      })
    }
  }

  return results
}

// ============================================================================
// Unified Processing
// ============================================================================

/**
 * Process a bounce event: suppress email, emit events.
 * userId is needed to scope suppression to the correct user.
 */
export function processBounce(userId: string, event: BounceEvent): void {
  const { email, type, reason } = event

  switch (type) {
    case 'hard_bounce':
      queueEngine.suppress(userId, email, 'hard_bounce', `${event.provider}:webhook`)
      eventBus.emit('email_bounced', { userId, email, bounceType: 'hard', reason })
      logger.info(`[Bounce] Hard bounce: ${email} — suppressed (${event.provider})`)
      break

    case 'soft_bounce':
      // Don't suppress on first soft bounce — queue engine tracks retries
      eventBus.emit('email_bounced', { userId, email, bounceType: 'soft', reason })
      logger.info(`[Bounce] Soft bounce: ${email} (${event.provider})`)
      break

    case 'complaint':
      queueEngine.suppress(userId, email, 'complaint', `${event.provider}:webhook`)
      eventBus.emit('email_unsubscribed', { userId, email, reason: 'complaint' })
      logger.info(`[Bounce] Complaint: ${email} — suppressed (${event.provider})`)
      break

    case 'unsubscribe':
      queueEngine.suppress(userId, email, 'unsubscribe', `${event.provider}:webhook`)
      eventBus.emit('email_unsubscribed', { userId, email, reason: 'unsubscribe' })
      logger.info(`[Bounce] Unsubscribe: ${email} — suppressed (${event.provider})`)
      break
  }
}
