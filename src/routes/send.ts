/**
 * Send Routes
 * Email sending, batch processing, scheduling
 */
import { Hono } from 'hono'
import { emailService } from '../services/emailService'
import { batchService } from '../services/batchService'
import { schedulerService } from '../services/schedulerService'
import { notificationService } from '../services/notificationService'
import { queueEngine } from '../services/queueEngine'
import { ProviderDetection } from '../services/providerLimits'
import { FileService } from '../services/fileService'
import { d1UserDatabase, type D1SMTPConfig } from '../services/d1UserDatabase'
import { oauthService } from '../services/oauthService'
import { d1Service } from '../services/d1Service'
import { requireAuth } from '../middleware/auth'
import { getProviderLimits } from '../config'
import { success, error } from '../utils/response'
import { getValidOAuthToken, sendOAuthEmail, type OAuthProvider } from '../utils/oauth'
import { parseIntSafe } from '../utils/validation'
import type { EmailJob, EmailConfig, BatchConfig, NotificationConfig } from '../types'

// Type alias for compatibility
type UserSMTPConfig = D1SMTPConfig & { user?: string; pass?: string; host: string }

const app = new Hono()

// ============================================================================
// Initialize Notification Service
// ============================================================================

if (process.env.NOTIFICATION_SMTP_USER) {
  const notificationConfig: NotificationConfig = {
    host: process.env.NOTIFICATION_SMTP_HOST || process.env.SMTP_HOST || '',
    port: parseInt(process.env.NOTIFICATION_SMTP_PORT || process.env.SMTP_PORT || '587'),
    secure: (process.env.NOTIFICATION_SMTP_SECURE || process.env.SMTP_SECURE) === 'true',
    user: process.env.NOTIFICATION_SMTP_USER || '',
    pass: process.env.NOTIFICATION_SMTP_PASS || '',
    fromName: process.env.NOTIFICATION_FROM_NAME || 'Email Campaign Notifications',
  }
  notificationService.setupGlobalNotificationSender(notificationConfig)
  console.log('📧 Notification service configured')
}

// ============================================================================
// Main Send Endpoint
// ============================================================================

/**
 * Send emails
 * POST /send
 */
app.post('/send', async (c) => {
  try {
    const user = requireAuth(c)
    console.log(`📧 Send request from user: ${user.email}`)

    const formData = await c.req.formData()

    // Get user configuration
    const userConfig = await getUserConfig(user.id, formData.get('configId') as string)
    if (!userConfig) {
      return error(c, 'No SMTP configuration found. Please add an SMTP configuration first.', 400)
    }

    console.log(`✅ Using config: ${userConfig.name} (${userConfig.provider_type || 'smtp'})`)

    const isOAuthConfig = userConfig.provider_type === 'google' || userConfig.provider_type === 'microsoft'

    // Extract form data
    const subject = (formData.get('subject') as string) || ''
    const htmlContent = (formData.get('htmlContent') as string) || ''
    const delay = parseIntSafe(formData.get('delay') as string, 20)

    // Batch processing
    const useBatch = formData.get('useBatch') === 'on'
    const batchSize = parseIntSafe(formData.get('batchSize') as string, 20)
    const batchDelay = parseIntSafe(formData.get('batchDelay') as string, 60)
    const emailDelay = parseIntSafe(formData.get('emailDelay') as string, 45)

    // Scheduling
    const scheduleEmail = formData.get('scheduleEmail') === 'on'
    const scheduledTime = formData.get('scheduledTime') as string
    const notifyEmail = formData.get('notifyEmail') as string
    const notifyBrowser = formData.get('notifyBrowser') === 'on'

    const excelFile = formData.get('excelFile') as File
    const htmlTemplateFile = formData.get('htmlTemplate') as File

    // Validate required fields
    const validationError = validateSendRequest(userConfig, isOAuthConfig, subject, scheduleEmail, scheduledTime)
    if (validationError) {
      return error(c, validationError, 400)
    }

    if (!excelFile || excelFile.size === 0) {
      return error(c, 'Excel file is required', 400)
    }

    // Validate content
    if (!htmlTemplateFile || htmlTemplateFile.size === 0) {
      if (!htmlContent || htmlContent.trim() === '' || htmlContent === '<p><br></p>') {
        return error(c, 'Email content is required (either in editor or upload HTML template)', 400)
      }
    }

    // Test connection
    const connectionError = await testConnection(userConfig, isOAuthConfig, user.id)
    if (connectionError) {
      return error(c, connectionError, 400)
    }

    // Process Excel file
    const contactsResult = await processExcelFile(excelFile, formData)
    if ('error' in contactsResult) {
      return error(c, contactsResult.error, 400)
    }
    const contacts = contactsResult.contacts

    // Check provider limits
    const limitError = checkProviderLimits(userConfig, isOAuthConfig, contacts.length, !!notifyEmail)
    if (limitError) {
      return error(c, limitError, 400)
    }

    // Process HTML template
    const finalHtmlContent = await processHtmlTemplate(htmlTemplateFile, htmlContent)
    if ('error' in finalHtmlContent) {
      return error(c, finalHtmlContent.error, 400)
    }

    // Build email config
    const emailConfig = isOAuthConfig ? null : buildEmailConfig(userConfig)
    const fromEmail = userConfig.from_email || userConfig.oauth_email || ''
    const fromName = userConfig.from_name || userConfig.name || ''

    // Handle scheduling vs immediate sending
    if (scheduleEmail) {
      if (isOAuthConfig) {
        return error(c, 'Scheduled sending is not yet supported for OAuth accounts. Please send immediately or use SMTP.', 400)
      }

      return handleScheduledSend(c, {
        user,
        userConfig,
        contacts,
        subject,
        htmlContent: finalHtmlContent.content,
        emailConfig: emailConfig!,
        useBatch,
        batchSize,
        batchDelay,
        emailDelay,
        delay,
        scheduledTime,
        notifyEmail,
        notifyBrowser,
        fromEmail,
        fromName,
      })
    }

    // Immediate sending
    if (isOAuthConfig) {
      return handleOAuthSend(c, {
        user,
        userConfig,
        contacts,
        subject,
        htmlContent: finalHtmlContent.content,
        useBatch,
        emailDelay,
        delay,
      })
    }

    return handleSmtpSend(c, {
      user,
      userConfig,
      contacts,
      subject,
      htmlContent: finalHtmlContent.content,
      emailConfig: emailConfig!,
      useBatch,
      batchSize,
      batchDelay,
      emailDelay,
      delay,
      notifyEmail,
      fromEmail,
      fromName,
    })
  } catch (err) {
    console.error('Send endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error occurred'
    return error(c, `Server error: ${message}`, 500)
  }
})

// ============================================================================
// Supporting Endpoints
// ============================================================================

/**
 * Test notification
 * POST /test-notification
 */
app.post('/test-notification', async (c) => {
  try {
    const user = requireAuth(c)
    const body = await c.req.json()
    const { testEmail } = body

    if (!testEmail) {
      return error(c, 'Test email required', 400)
    }

    const sent = await notificationService.sendTestNotification(user.id, testEmail)
    return success(
      c,
      { sent },
      sent ? '✅ Test notification sent successfully' : '❌ Failed to send test notification'
    )
  } catch (err) {
    console.error('Test notification error:', err)
    return error(c, 'Failed to send test notification', 500)
  }
})

/**
 * Get provider info
 * POST /provider-info
 */
app.post('/provider-info', async (c) => {
  try {
    const formData = await c.req.formData()
    const smtpHost = (formData.get('smtpHost') as string) || ''
    const hasNotification = (formData.get('hasNotification') as string) === 'true'

    if (!smtpHost) {
      return error(c, 'SMTP host required', 400)
    }

    const provider = ProviderDetection.detectProvider(smtpHost)
    const maxContacts = ProviderDetection.calculateMaxContacts(smtpHost, hasNotification)

    return success(c, {
      provider: provider.name,
      dailyLimit: provider.dailyLimit,
      maxContacts,
      recommendedBatchSize: provider.recommendedBatchSize,
      recommendedDelay: provider.recommendedDelay,
    })
  } catch (err) {
    return error(c, 'Failed to detect provider', 500)
  }
})

/**
 * Parse Excel file
 * POST /parse-excel
 */
app.post('/parse-excel', async (c) => {
  try {
    const formData = await c.req.formData()
    const excelFile = formData.get('excelFile') as File

    if (!excelFile || excelFile.size === 0) {
      return error(c, 'Excel file is required', 400)
    }

    const arrayBuffer = await excelFile.arrayBuffer()
    const filename = `temp_${Date.now()}_${excelFile.name}`
    const filePath = await FileService.saveUploadedFile(new Uint8Array(arrayBuffer), filename)
    const contacts = await FileService.parseExcelFile(filePath)

    return success(c, {
      contacts: contacts.slice(0, 5),
      totalCount: contacts.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse Excel file'
    return error(c, message, 500)
  }
})

// ============================================================================
// Scheduled Jobs
// ============================================================================

app.get('/scheduled-jobs', (c) => {
  const jobs = schedulerService.getScheduledJobs()
  return success(c, jobs)
})

app.delete('/scheduled-jobs/:id', async (c) => {
  const jobId = c.req.param('id')
  const cancelled = await schedulerService.cancelScheduledJob(jobId)

  if (cancelled) {
    return success(c, undefined, 'Scheduled job cancelled')
  }
  return error(c, 'Job not found or cannot be cancelled', 404)
})

// ============================================================================
// Batch Control (delegates to queue engine, legacy endpoints preserved)
// ============================================================================

app.get('/batch-status', (c) => {
  const user = requireAuth(c)
  const activeIds = queueEngine.getActiveJobIds()
  const runningJobs = queueEngine.getJobs(user.id, 'running', 5)

  // Map to legacy BatchStatus format for backward compatibility
  const currentJob = runningJobs[0] || null
  return success(c, {
    isRunning: runningJobs.length > 0,
    currentJob: currentJob ? {
      id: currentJob.id,
      totalContacts: currentJob.total_count,
      currentBatch: Math.ceil(currentJob.last_processed_index / (currentJob.batch_size || 20)),
      totalBatches: Math.ceil(currentJob.total_count / (currentJob.batch_size || 20)),
      emailsSent: currentJob.sent_count,
      emailsFailed: currentJob.failed_count,
      status: currentJob.status === 'running' ? 'Running' : currentJob.status,
      nextBatchTime: undefined,
    } : null,
    totalJobs: runningJobs.length + activeIds.length,
    completedJobs: 0,
  })
})

app.post('/batch-pause', async (c) => {
  const user = requireAuth(c)
  const runningJobs = queueEngine.getJobs(user.id, 'running', 1)
  if (runningJobs.length > 0) {
    queueEngine.pause(runningJobs[0].id)
  }
  return success(c, undefined, 'Job paused')
})

app.post('/batch-resume', async (c) => {
  const user = requireAuth(c)
  const pausedJobs = queueEngine.getJobs(user.id, 'paused', 1)
  if (pausedJobs.length > 0) {
    queueEngine.resume(pausedJobs[0].id)
  }
  return success(c, undefined, 'Job resumed')
})

app.delete('/batch-cancel', async (c) => {
  const user = requireAuth(c)
  const runningJobs = queueEngine.getJobs(user.id, 'running', 1)
  if (runningJobs.length > 0) {
    queueEngine.cancel(runningJobs[0].id)
  }
  return success(c, undefined, 'Job cancelled')
})

// ============================================================================
// Helper Functions
// ============================================================================

async function getUserConfig(userId: string, configId: string | null): Promise<UserSMTPConfig | null> {
  let userConfig: UserSMTPConfig | null = null

  if (configId) {
    const configs = await d1UserDatabase.getUserSMTPConfigs(userId)
    const found = configs.find((config) => config.id === configId)
    if (found) {
      userConfig = { ...found, user: found.username, pass: found.password }
    }
  }

  if (!userConfig) {
    const defaultConfig = await d1UserDatabase.getUserDefaultSMTPConfig(userId)
    if (defaultConfig) {
      userConfig = { ...defaultConfig, user: defaultConfig.username, pass: defaultConfig.password }
    }
  }

  return userConfig
}

function validateSendRequest(
  config: UserSMTPConfig,
  isOAuth: boolean,
  subject: string,
  scheduleEmail: boolean,
  scheduledTime: string
): string | null {
  const missing: string[] = []

  if (!isOAuth) {
    if (!config.host) missing.push('SMTP Host')
    if (!config.user) missing.push('SMTP User')
    if (!config.pass) missing.push('SMTP Password')
    if (!config.from_email) missing.push('From Email')
  } else {
    if (!config.oauth_email) missing.push('OAuth Email')
    if (!config.oauth_access_token) missing.push('OAuth Access Token')
  }

  if (!subject || subject.trim() === '') missing.push('Subject')
  if (scheduleEmail && !scheduledTime) missing.push('Scheduled Time')

  return missing.length > 0 ? `Missing required fields: ${missing.join(', ')}` : null
}

async function testConnection(config: UserSMTPConfig, isOAuth: boolean, userId: string): Promise<string | null> {
  if (isOAuth) {
    console.log(`🔍 Testing OAuth connection for ${config.provider_type}...`)
    try {
      const accessToken = await getValidOAuthToken(config, userId)
      const isValid = await oauthService.testConnection(config.provider_type as OAuthProvider, accessToken)
      if (!isValid) {
        return `${config.provider_type === 'google' ? 'Google' : 'Microsoft'} OAuth connection failed. Please reconnect your account.`
      }
      console.log(`✅ OAuth connection verified for ${config.provider_type}`)
      return null
    } catch (err) {
      return `OAuth error: ${err instanceof Error ? err.message : 'Unknown error'}. Please reconnect your account.`
    }
  }

  // SMTP connection test
  console.log(`🔍 Testing SMTP connection to ${config.host}:${config.port}...`)
  const emailConfig = buildEmailConfig(config)

  try {
    const valid = await emailService.testConnection(emailConfig)
    if (!valid) {
      return buildSmtpErrorMessage(config.host)
    }
    return null
  } catch (err) {
    return buildSmtpErrorDetails(err, config.host, config.port)
  }
}

function buildEmailConfig(config: UserSMTPConfig): EmailConfig {
  return {
    host: config.host,
    port: config.port,
    secure: !!config.secure,
    auth: {
      user: config.user || config.username || '',
      pass: config.pass || config.password || '',
    },
  }
}

function buildSmtpErrorMessage(host: string): string {
  if (host.includes('gmail')) {
    return `Gmail SMTP connection failed. Please ensure:
• You're using an App Password (not your regular Gmail password)
• 2-Factor Authentication is enabled on your Google account
• Host: smtp.gmail.com, Port: 465 (SSL) or 587 (TLS)
• Generate App Password: https://myaccount.google.com/apppasswords`
  }
  if (host.includes('outlook') || host.includes('hotmail')) {
    return `Outlook SMTP connection failed. Please ensure:
• Host: smtp-mail.outlook.com, Port: 587
• Use your regular Outlook password
• Enable "Less secure app access" if needed`
  }
  return 'SMTP connection failed. Please check your settings.'
}

function buildSmtpErrorDetails(err: unknown, host: string, port: number): string {
  if (!(err instanceof Error)) return 'SMTP connection test failed.'

  if (err.message.includes('Invalid login') || err.message.includes('Username and Password not accepted')) {
    if (host.includes('gmail')) {
      return `❌ Gmail Authentication Failed:
🔧 Quick Fix:
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character App Password (not your regular password)
4. SMTP Settings: smtp.gmail.com:465 with SSL enabled`
    }
    return `❌ Authentication Failed: Invalid username or password for ${host}`
  }

  if (err.message.includes('ECONNREFUSED') || err.message.includes('ESOCKET')) {
    return `❌ Connection Failed: Cannot connect to ${host}:${port}
🔧 Check these settings:
• Gmail: smtp.gmail.com:465 (SSL) or smtp.gmail.com:587 (TLS)
• Outlook: smtp-mail.outlook.com:587 (TLS)
• Yahoo: smtp.mail.yahoo.com:587 (TLS)`
  }

  return `❌ SMTP Error: ${err.message}`
}

async function processExcelFile(
  file: File,
  formData: FormData
): Promise<{ contacts: any[] } | { error: string }> {
  try {
    console.log('📊 Processing Excel file...')
    const arrayBuffer = await file.arrayBuffer()
    const filename = `${Date.now()}_${file.name}`
    const filePath = await FileService.saveUploadedFile(new Uint8Array(arrayBuffer), filename)
    const allContacts = await FileService.parseExcelFile(filePath)
    console.log(`📋 Parsed ${allContacts.length} contacts from Excel file`)

    // Apply email range selection
    const emailRangeStart = parseIntSafe(formData.get('emailRangeStart') as string, 0)
    const emailRangeCount = parseIntSafe(formData.get('emailRangeCount') as string, allContacts.length)

    const endIndex = Math.min(emailRangeStart + emailRangeCount, allContacts.length)
    const contacts = allContacts.slice(emailRangeStart, endIndex)

    console.log(`📧 Email range: ${emailRangeStart + 1} to ${endIndex} (${contacts.length} selected)`)
    return { contacts }
  } catch (err) {
    console.error('Excel parsing error:', err)
    return { error: `Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }
}

function checkProviderLimits(
  config: UserSMTPConfig,
  isOAuth: boolean,
  contactCount: number,
  hasNotification: boolean
): string | null {
  let maxContacts: number
  let providerName: string

  if (isOAuth) {
    const limits = getProviderLimits(config.provider_type as 'google' | 'microsoft')
    maxContacts = limits.daily
    providerName = config.provider_type === 'google' ? 'Gmail API' : 'Microsoft Graph'
  } else {
    maxContacts = ProviderDetection.calculateMaxContacts(config.host, hasNotification)
    providerName = ProviderDetection.detectProvider(config.host).name
  }

  if (contactCount > maxContacts) {
    return `${providerName} limit: Maximum ${maxContacts} contacts allowed${hasNotification ? ' (1 reserved for notification)' : ''}`
  }

  return null
}

async function processHtmlTemplate(
  templateFile: File | null,
  htmlContent: string
): Promise<{ content: string } | { error: string }> {
  if (templateFile && templateFile.size > 0) {
    try {
      console.log('📄 Processing HTML template file...')
      const arrayBuffer = await templateFile.arrayBuffer()
      const filename = `${Date.now()}_${templateFile.name}`
      const filePath = await FileService.saveUploadedFile(new Uint8Array(arrayBuffer), filename)
      const content = await FileService.readHTMLTemplate(filePath)
      console.log('✅ Using HTML template as primary content')
      return { content }
    } catch (err) {
      return { error: `Failed to process HTML template: ${err instanceof Error ? err.message : 'Unknown error'}` }
    }
  }
  return { content: htmlContent }
}

// ============================================================================
// Send Handlers
// ============================================================================

async function handleScheduledSend(c: any, params: any) {
  const {
    user, userConfig, contacts, subject, htmlContent, emailConfig,
    useBatch, batchSize, batchDelay, emailDelay, delay,
    scheduledTime, notifyEmail, notifyBrowser, fromEmail, fromName,
  } = params

  const scheduledDate = new Date(scheduledTime)
  if (scheduledDate <= new Date()) {
    return error(c, 'Scheduled time must be in the future', 400)
  }

  const batchConfig: BatchConfig | null = useBatch
    ? { batchSize, emailDelay, batchDelay, enabled: true }
    : null

  const emailJob: EmailJob = {
    contacts,
    htmlContent,
    subject: subject.trim(),
    fromEmail,
    fromName,
    config: emailConfig,
    delay: useBatch ? emailDelay : delay,
  }

  const jobId = await schedulerService.scheduleJob(
    user.id,
    emailJob,
    batchConfig,
    scheduledDate,
    userConfig.name,
    notifyEmail,
    notifyBrowser
  )

  console.log(`📅 Email campaign scheduled: ${jobId} for user ${user.email}`)

  return success(c, {
    jobId,
    scheduledTime: scheduledDate.toISOString(),
    contactCount: contacts.length,
    scheduledMode: true,
    batchMode: useBatch,
    configUsed: userConfig.name,
  }, `📅 Email campaign scheduled for ${scheduledDate.toLocaleString()}`)
}

async function handleOAuthSend(c: any, params: any) {
  const { user, userConfig, contacts, subject, htmlContent, useBatch, emailDelay, delay } = params

  console.log(`🚀 Starting OAuth email job: ${contacts.length} contacts via ${userConfig.provider_type}`)

  const delayMs = useBatch ? emailDelay * 1000 : delay * 1000

  // Send in background
  sendBulkOAuthEmails(userConfig, user.id, contacts, subject.trim(), htmlContent, delayMs)
    .then((result) => {
      console.log(`📊 OAuth send complete: ${result.sent} sent, ${result.failed} failed`)
    })
    .catch((err) => {
      console.error('OAuth bulk email sending failed:', err)
    })

  return success(c, {
    contactCount: contacts.length,
    configUsed: userConfig.name,
    provider: userConfig.provider_type,
  }, `Email sending started for ${contacts.length} contacts via ${userConfig.provider_type === 'google' ? 'Gmail' : 'Outlook'}`)
}

async function handleSmtpSend(c: any, params: any) {
  const {
    user, userConfig, contacts, subject, htmlContent, emailConfig,
    useBatch, batchSize, batchDelay, emailDelay, delay, notifyEmail, fromEmail, fromName,
  } = params

  // Enqueue to persistent job queue (replaces in-memory batchService)
  const jobId = queueEngine.enqueue(user.id, emailConfig, contacts, {
    type: useBatch ? 'batch' : 'direct',
    htmlContent,
    subject: subject.trim(),
    fromEmail,
    fromName,
    configName: userConfig.name,
    notifyEmail: notifyEmail || undefined,
    batchSize: useBatch ? batchSize : contacts.length,
    emailDelaySec: useBatch ? emailDelay : delay,
    batchDelayMin: useBatch ? batchDelay : 0,
    priority: 5,
  })

  console.log(`📦 Job ${jobId} enqueued: ${contacts.length} contacts (${useBatch ? 'batch' : 'direct'} mode)`)

  if (useBatch) {
    return success(c, {
      jobId,
      contactCount: contacts.length,
      batchMode: true,
      batchConfig: { batchSize, emailDelay, batchDelay, enabled: true },
      configUsed: userConfig.name,
    }, `Job queued! ${contacts.length} contacts in batches of ${batchSize}.`)
  }

  return success(c, {
    jobId,
    contactCount: contacts.length,
    configUsed: userConfig.name,
  }, `Job queued for ${contacts.length} contacts`)
}

// ============================================================================
// OAuth Bulk Send
// ============================================================================

async function sendBulkOAuthEmails(
  config: UserSMTPConfig,
  userId: string,
  contacts: any[],
  subject: string,
  htmlContent: string,
  delayMs: number = 1000
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const accessToken = await getValidOAuthToken(config, userId)

  let sent = 0
  let failed = 0
  const errors: string[] = []

  const campaignId = d1Service.generateCampaignId()
  const fromEmail = config.oauth_email || config.from_email || ''
  const fromName = config.from_name || config.name || ''
  const provider = config.provider_type as OAuthProvider

  console.log(`📧 Starting OAuth bulk send: ${contacts.length} emails via ${provider}`)

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]

    // Find email field
    const emailField = Object.keys(contact).find(
      (key) => key.toLowerCase().includes('email') || (typeof contact[key] === 'string' && contact[key].includes('@'))
    )
    const toEmail = emailField ? contact[emailField] : null

    if (!toEmail || !toEmail.includes('@')) {
      console.log(`⚠️ Skipping contact ${i + 1}: No valid email found`)
      failed++
      errors.push(`Contact ${i + 1}: No valid email`)
      continue
    }

    // Find name field
    const nameField = Object.keys(contact).find(
      (key) => key.toLowerCase().includes('name') && !key.toLowerCase().includes('email')
    )
    const recipientName = nameField ? contact[nameField] : ''

    // Replace placeholders with exact key match
    const replacePlaceholders = (text: string) => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (contact[key] !== undefined) {
          return String(contact[key] || '')
        }
        return match
      })
    }

    const personalizedSubject = replacePlaceholders(subject)
    let personalizedContent = replacePlaceholders(htmlContent)

    // Register tracking
    if (d1Service.isConfigured()) {
      const trackingResult = await d1Service.registerEmail({
        userId,
        campaignId,
        campaignName: `OAuth Campaign ${new Date().toLocaleDateString()}`,
        subject: personalizedSubject,
        fromEmail,
        fromName,
        recipientEmail: toEmail,
        recipientName,
        sendType: 'direct',
        providerType: provider,
        configName: config.name,
      })

      if (trackingResult) {
        personalizedContent = d1Service.injectTracking(personalizedContent, trackingResult.trackingId)
      }
    }

    // Send email
    const result = await sendOAuthEmail(
      provider,
      accessToken,
      toEmail,
      personalizedSubject,
      personalizedContent,
      fromName,
      fromEmail
    )

    if (result.success) {
      sent++
      console.log(`✅ [${i + 1}/${contacts.length}] Sent to ${toEmail}`)
    } else {
      failed++
      errors.push(`${toEmail}: ${result.error}`)
      console.log(`❌ [${i + 1}/${contacts.length}] Failed: ${toEmail} - ${result.error}`)
    }

    // Delay between emails
    if (i < contacts.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  console.log(`📊 OAuth bulk send complete: ${sent} sent, ${failed} failed`)
  return { sent, failed, errors }
}

export default app
