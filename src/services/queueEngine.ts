// src/services/queueEngine.ts - SQLite-backed Persistent Job Queue

import Database from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { emailService } from './emailService';
import { logService } from './logService';
import { d1Service } from './d1Service';
import { retryEngine, type ErrorType } from './retryEngine';
import { FileService } from './fileService';
import type { EmailConfig, Contact } from '../types';

// ============================================================================
// Types
// ============================================================================

export type JobType = 'direct' | 'batch' | 'scheduled' | 'automation';
export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface QueueJob {
  id: string;
  campaign_id: string | null;
  user_id: string;
  type: JobType;
  status: JobStatus;
  priority: number;
  config_json: string;
  contacts_json: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  last_processed_index: number;
  batch_size: number;
  email_delay_sec: number;
  batch_delay_min: number;
  scheduled_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  last_error: string | null;
  retry_count: number;
  // Derived fields (not in DB)
  html_content?: string;
  subject?: string;
  from_email?: string;
  from_name?: string;
  config_name?: string;
  notify_email?: string;
}

export interface EnqueueOptions {
  campaignId?: string;
  type?: JobType;
  priority?: number;
  batchSize?: number;
  emailDelaySec?: number;
  batchDelayMin?: number;
  scheduledAt?: string;
  htmlContent: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  configName?: string;
  notifyEmail?: string;
}

export interface DeadLetter {
  id: string;
  job_id: string;
  recipient_email: string;
  recipient_name: string | null;
  error_message: string | null;
  error_code: string | null;
  error_type: string | null;
  attempts: number;
  created_at: string;
  last_attempt_at: string | null;
}

export interface QueueStats {
  pending: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
  total_sent: number;
  total_failed: number;
  dead_letters: number;
}

// ============================================================================
// Queue Engine
// ============================================================================

class QueueEngine {
  private db: Database;
  private maxConcurrent = 3;
  private workerInterval: Timer | null = null;
  private activeJobs: Map<string, { abort: boolean }> = new Map();

  constructor() {
    const dbPath = './data/queue.db';
    const dbDir = dirname(dbPath);

    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL');
    this.db.exec('PRAGMA busy_timeout=5000');
    this.initSchema();
  }

  // --------------------------------------------------------------------------
  // Schema
  // --------------------------------------------------------------------------

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'batch',
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 5,
        config_json TEXT NOT NULL,
        contacts_json TEXT NOT NULL,
        html_content TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        from_email TEXT NOT NULL DEFAULT '',
        from_name TEXT NOT NULL DEFAULT '',
        config_name TEXT,
        notify_email TEXT,
        total_count INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        last_processed_index INTEGER NOT NULL DEFAULT 0,
        batch_size INTEGER DEFAULT 20,
        email_delay_sec INTEGER DEFAULT 45,
        batch_delay_min INTEGER DEFAULT 60,
        scheduled_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_error TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority, created_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_at);

      CREATE TABLE IF NOT EXISTS dead_letters (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        error_message TEXT,
        error_code TEXT,
        error_type TEXT,
        attempts INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_attempt_at TEXT,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_dl_job ON dead_letters(job_id);

      CREATE TABLE IF NOT EXISTS suppression_list (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        reason TEXT NOT NULL,
        source TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, email)
      );

      CREATE INDEX IF NOT EXISTS idx_suppress_user ON suppression_list(user_id);
      CREATE INDEX IF NOT EXISTS idx_suppress_email ON suppression_list(email);
    `);

    console.log('✅ Queue database initialized (data/queue.db)');
  }

  // --------------------------------------------------------------------------
  // Enqueue / Dequeue
  // --------------------------------------------------------------------------

  /**
   * Add a new job to the queue
   */
  enqueue(
    userId: string,
    emailConfig: EmailConfig,
    contacts: Contact[],
    options: EnqueueOptions
  ): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const campaignId = options.campaignId || d1Service.generateCampaignId();

    this.db.prepare(`
      INSERT INTO jobs (
        id, campaign_id, user_id, type, status, priority,
        config_json, contacts_json, html_content, subject, from_email, from_name,
        config_name, notify_email,
        total_count, batch_size, email_delay_sec, batch_delay_min, scheduled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      campaignId,
      userId,
      options.type || 'batch',
      options.scheduledAt ? 'pending' : 'pending',
      options.priority ?? 5,
      JSON.stringify(emailConfig),
      JSON.stringify(contacts),
      options.htmlContent,
      options.subject,
      options.fromEmail,
      options.fromName,
      options.configName || null,
      options.notifyEmail || null,
      contacts.length,
      options.batchSize ?? 20,
      options.emailDelaySec ?? 45,
      options.batchDelayMin ?? 60,
      options.scheduledAt || null
    );

    console.log(`📥 Job enqueued: ${jobId} (${contacts.length} contacts, priority ${options.priority ?? 5})`);
    return jobId;
  }

  /**
   * Get the next pending job by priority (lower = higher priority)
   */
  dequeue(): QueueJob | null {
    const job = this.db.prepare(`
      SELECT * FROM jobs
      WHERE status = 'pending'
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
    `).get() as QueueJob | null;

    return job;
  }

  // --------------------------------------------------------------------------
  // Job Control
  // --------------------------------------------------------------------------

  /**
   * Pause a running job
   */
  pause(jobId: string): boolean {
    const result = this.db.prepare(`
      UPDATE jobs SET status = 'paused', updated_at = datetime('now')
      WHERE id = ? AND status = 'running'
    `).run(jobId);

    if (result.changes > 0) {
      const control = this.activeJobs.get(jobId);
      if (control) control.abort = true;
      console.log(`⏸️ Job paused: ${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Resume a paused job
   */
  resume(jobId: string): boolean {
    const result = this.db.prepare(`
      UPDATE jobs SET status = 'pending', updated_at = datetime('now')
      WHERE id = ? AND status = 'paused'
    `).run(jobId);

    if (result.changes > 0) {
      console.log(`▶️ Job resumed: ${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel a job (pending, running, or paused)
   */
  cancel(jobId: string): boolean {
    const result = this.db.prepare(`
      UPDATE jobs SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status IN ('pending', 'running', 'paused')
    `).run(jobId);

    if (result.changes > 0) {
      const control = this.activeJobs.get(jobId);
      if (control) control.abort = true;
      console.log(`❌ Job cancelled: ${jobId}`);
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Progress Tracking
  // --------------------------------------------------------------------------

  /**
   * Update job progress (called after each email)
   */
  updateProgress(
    jobId: string,
    lastProcessedIndex: number,
    sentCount: number,
    failedCount: number,
    lastError?: string
  ) {
    this.db.prepare(`
      UPDATE jobs SET
        last_processed_index = ?,
        sent_count = ?,
        failed_count = ?,
        last_error = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(lastProcessedIndex, sentCount, failedCount, lastError || null, jobId);
  }

  /**
   * Mark job as completed
   */
  private completeJob(jobId: string) {
    this.db.prepare(`
      UPDATE jobs SET
        status = 'completed',
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);
    this.activeJobs.delete(jobId);
  }

  /**
   * Mark job as failed
   */
  private failJob(jobId: string, error: string) {
    this.db.prepare(`
      UPDATE jobs SET
        status = 'failed',
        last_error = ?,
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(error, jobId);
    this.activeJobs.delete(jobId);
  }

  // --------------------------------------------------------------------------
  // Dead Letter Queue
  // --------------------------------------------------------------------------

  /**
   * Add a permanently failed email to dead letter queue
   */
  addToDeadLetter(
    jobId: string,
    recipientEmail: string,
    recipientName: string | null,
    errorMessage: string,
    errorType: ErrorType,
    attempts: number
  ) {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.db.prepare(`
      INSERT INTO dead_letters (id, job_id, recipient_email, recipient_name, error_message, error_type, attempts, last_attempt_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, jobId, recipientEmail, recipientName, errorMessage, errorType, attempts);
  }

  /**
   * Get dead letters for a job or user
   */
  getDeadLetters(jobId?: string, limit = 50, offset = 0): DeadLetter[] {
    if (jobId) {
      return this.db.prepare(`
        SELECT * FROM dead_letters WHERE job_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(jobId, limit, offset) as DeadLetter[];
    }
    return this.db.prepare(`
      SELECT * FROM dead_letters ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset) as DeadLetter[];
  }

  // --------------------------------------------------------------------------
  // Suppression List
  // --------------------------------------------------------------------------

  /**
   * Check if email is suppressed for a user
   */
  isSuppressed(userId: string, email: string): boolean {
    const result = this.db.prepare(`
      SELECT 1 FROM suppression_list WHERE user_id = ? AND email = ?
    `).get(userId, email.toLowerCase());
    return !!result;
  }

  /**
   * Add email to suppression list
   */
  suppress(userId: string, email: string, reason: string, source?: string) {
    const id = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO suppression_list (id, user_id, email, reason, source)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, userId, email.toLowerCase(), reason, source || null);
    } catch {
      // Already exists, ignore
    }
  }

  /**
   * Remove email from suppression list
   */
  unsuppress(userId: string, email: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM suppression_list WHERE user_id = ? AND email = ?
    `).run(userId, email.toLowerCase());
    return result.changes > 0;
  }

  /**
   * Get suppression list for a user
   */
  getSuppressionList(userId: string, limit = 50, offset = 0) {
    return this.db.prepare(`
      SELECT * FROM suppression_list WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  /**
   * Get a single job by ID
   */
  getJob(jobId: string): QueueJob | null {
    return this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as QueueJob | null;
  }

  /**
   * Get jobs for a user
   */
  getJobs(userId: string, status?: JobStatus, limit = 20, offset = 0): QueueJob[] {
    if (status) {
      return this.db.prepare(`
        SELECT * FROM jobs WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(userId, status, limit, offset) as QueueJob[];
    }
    return this.db.prepare(`
      SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as QueueJob[];
  }

  /**
   * Get queue statistics for a user
   */
  getStats(userId: string): QueueStats {
    const stats = this.db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        COALESCE(SUM(sent_count), 0) as total_sent,
        COALESCE(SUM(failed_count), 0) as total_failed
      FROM jobs WHERE user_id = ?
    `).get(userId) as any;

    const dlCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM dead_letters dl
      JOIN jobs j ON dl.job_id = j.id WHERE j.user_id = ?
    `).get(userId) as any;

    return {
      pending: stats.pending || 0,
      running: stats.running || 0,
      paused: stats.paused || 0,
      completed: stats.completed || 0,
      failed: stats.failed || 0,
      cancelled: stats.cancelled || 0,
      total_sent: stats.total_sent || 0,
      total_failed: stats.total_failed || 0,
      dead_letters: dlCount?.count || 0,
    };
  }

  // --------------------------------------------------------------------------
  // Job Processing Worker
  // --------------------------------------------------------------------------

  /**
   * Start the background worker that processes jobs
   */
  startWorker(intervalMs = 5000) {
    if (this.workerInterval) return;

    this.workerInterval = setInterval(() => {
      this.processNextJob();
    }, intervalMs);

    console.log(`⚙️ Queue worker started (polling every ${intervalMs / 1000}s, max ${this.maxConcurrent} concurrent)`);
  }

  /**
   * Stop the background worker
   */
  stopWorker() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      console.log('⚙️ Queue worker stopped');
    }
  }

  /**
   * Set max concurrent jobs
   */
  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, Math.min(max, 10));
  }

  /**
   * Get count of currently active jobs
   */
  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Get IDs of currently active jobs
   */
  getActiveJobIds(): string[] {
    return Array.from(this.activeJobs.keys());
  }

  /**
   * Process the next available job (supports concurrency)
   */
  private async processNextJob() {
    // Check if we have capacity for more concurrent jobs
    if (this.activeJobs.size >= this.maxConcurrent) return;

    const job = this.dequeue();
    if (!job) return;

    // Skip if this job is already being processed
    if (this.activeJobs.has(job.id)) return;

    // Mark as running
    this.db.prepare(`
      UPDATE jobs SET status = 'running', started_at = COALESCE(started_at, datetime('now')), updated_at = datetime('now')
      WHERE id = ?
    `).run(job.id);

    const control = { abort: false };
    this.activeJobs.set(job.id, control);

    console.log(`🚀 Processing job ${job.id}: ${job.total_count} contacts (from index ${job.last_processed_index}) [${this.activeJobs.size}/${this.maxConcurrent} slots]`);

    // Run in background — don't await so worker can pick up more jobs
    this.executeJob(job, control).catch((error) => {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Job ${job.id} failed:`, msg);
      this.failJob(job.id, msg);
    });
  }

  /**
   * Execute a job — send emails with retry and checkpoint
   */
  private async executeJob(job: QueueJob, control: { abort: boolean }) {
    const contacts: Contact[] = JSON.parse(job.contacts_json);
    const emailConfig: EmailConfig = JSON.parse(job.config_json);

    // Configure transporter
    emailService.createTransport(emailConfig);

    const campaignId = job.campaign_id || d1Service.generateCampaignId();
    let sentCount = job.sent_count;
    let failedCount = job.failed_count;
    let lastIndex = job.last_processed_index;

    // Process from where we left off
    for (let i = lastIndex; i < contacts.length; i++) {
      // Check if paused or cancelled
      if (control.abort) {
        console.log(`⏸️ Job ${job.id} interrupted at index ${i}`);
        this.updateProgress(job.id, i, sentCount, failedCount);
        return;
      }

      const contact = contacts[i];

      // Check suppression list
      if (this.isSuppressed(job.user_id, contact.Email)) {
        console.log(`🚫 Skipping suppressed email: ${contact.Email}`);
        lastIndex = i + 1;
        this.updateProgress(job.id, lastIndex, sentCount, failedCount);
        continue;
      }

      // Attempt to send with retry
      const success = await this.sendWithRetry(job, contact, campaignId, emailConfig);

      if (success) {
        sentCount++;
      } else {
        failedCount++;
      }

      lastIndex = i + 1;

      // Checkpoint progress every email
      this.updateProgress(job.id, lastIndex, sentCount, failedCount);

      // Delay between emails
      if (i < contacts.length - 1 && !control.abort) {
        const delaySec = job.email_delay_sec || 45;

        // Check if we're at a batch boundary
        const batchSize = job.batch_size || 20;
        const positionInBatch = (i - (job.last_processed_index || 0) + 1) % batchSize;
        if (positionInBatch === 0 && i < contacts.length - 1) {
          // Batch boundary — longer delay
          const batchDelayMs = (job.batch_delay_min || 1) * 60 * 1000;
          console.log(`⏳ Batch boundary — waiting ${job.batch_delay_min || 1} min before next batch`);
          await this.interruptibleSleep(batchDelayMs, control);
        } else {
          await this.interruptibleSleep(delaySec * 1000, control);
        }
      }
    }

    // Job completed
    this.completeJob(job.id);
    console.log(`🎉 Job ${job.id} completed: ${sentCount} sent, ${failedCount} failed`);

    // Send completion notification
    if (job.notify_email) {
      await this.sendCompletionNotification(job, sentCount, failedCount);
    }
  }

  /**
   * Send a single email with retry logic
   */
  private async sendWithRetry(
    job: QueueJob,
    contact: Contact,
    campaignId: string,
    emailConfig: EmailConfig
  ): Promise<boolean> {
    let attempts = 0;
    const maxAttempts = 4; // 1 initial + 3 retries for temporary errors

    while (attempts < maxAttempts) {
      try {
        // Personalize content
        let personalizedContent = FileService.replacePlaceholders(job.html_content || '', contact);
        const personalizedSubject = FileService.replacePlaceholders(job.subject || '', contact);

        // Register tracking
        if (d1Service.isConfigured()) {
          const trackingResult = await d1Service.registerEmail({
            userId: job.user_id,
            campaignId,
            campaignName: `Campaign ${new Date().toLocaleDateString()}`,
            subject: personalizedSubject,
            fromEmail: job.from_email || '',
            fromName: job.from_name,
            recipientEmail: contact.Email,
            recipientName: contact.FirstName || String(contact['Name'] || ''),
            sendType: job.type === 'direct' ? 'direct' : 'batch',
            providerType: 'smtp',
            configName: job.config_name || '',
          });

          if (trackingResult) {
            personalizedContent = d1Service.injectTracking(personalizedContent, trackingResult.trackingId);
          }
        }

        // Compliance headers (CAN-SPAM, RFC 8058)
        const unsubUrl = job.from_email ? `mailto:${job.from_email}?subject=unsubscribe` : '';
        const feedbackId = `${job.id}:${Date.now()}:${job.from_email || 'noreply'}`;

        const mailOptions = {
          from: `${job.from_name || ''} <${job.from_email || ''}>`,
          to: contact.Email,
          subject: personalizedSubject,
          html: personalizedContent,
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'Precedence': 'bulk',
            'Feedback-ID': feedbackId,
          },
        };

        const info = await emailService.sendSingleEmail(mailOptions);

        // Log success
        logService.addLog({
          id: `q_${job.id}_${Date.now()}`,
          email: contact.Email,
          status: 'Sent',
          timestamp: new Date().toISOString(),
          messageId: info.messageId,
          firstName: contact.FirstName,
          company: contact.Company,
          subject: personalizedSubject,
        });

        console.log(`✅ [${job.id}] Sent to ${contact.Email} (${info.messageId})`);
        return true;
      } catch (error) {
        attempts++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorType = retryEngine.classifyError(error instanceof Error ? error : errorMessage);

        console.error(`❌ [${job.id}] Failed ${contact.Email} (attempt ${attempts}, ${errorType}): ${errorMessage}`);

        if (errorType === 'permanent' || !retryEngine.shouldRetry(errorType, attempts)) {
          // Permanent failure — dead letter queue
          this.addToDeadLetter(
            job.id,
            contact.Email,
            contact.FirstName || null,
            errorMessage,
            errorType,
            attempts
          );

          // Suppress on hard bounce
          if (errorType === 'permanent') {
            this.suppress(job.user_id, contact.Email, 'bounce_hard', `job:${job.id}`);
          }

          // Log failure
          logService.addLog({
            id: `q_${job.id}_${Date.now()}`,
            email: contact.Email,
            status: 'Failed',
            message: `${retryEngine.describeError(errorType)} (${errorMessage})`,
            timestamp: new Date().toISOString(),
            firstName: contact.FirstName,
            company: contact.Company,
            subject: job.subject || '',
          });

          return false;
        }

        // Wait before retry
        const delay = retryEngine.getRetryDelay(attempts, errorType);
        console.log(`🔄 Retrying ${contact.Email} in ${Math.round(delay / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return false;
  }

  /**
   * Sleep that can be interrupted by pause/cancel
   */
  private async interruptibleSleep(ms: number, control: { abort: boolean }): Promise<void> {
    const interval = 1000; // Check every second
    let elapsed = 0;
    while (elapsed < ms && !control.abort) {
      await new Promise(resolve => setTimeout(resolve, Math.min(interval, ms - elapsed)));
      elapsed += interval;
    }
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(job: QueueJob, sentCount: number, failedCount: number) {
    try {
      const { notificationService } = await import('./notificationService');

      await notificationService.sendJobCompletionNotification(
        job.user_id,
        job.notify_email!,
        {
          sent: sentCount,
          failed: failedCount,
          total: job.total_count,
          errors: 0,
        },
        {
          id: job.id,
          subject: job.subject || '',
          startTime: job.started_at || job.created_at,
          endTime: new Date().toISOString(),
          configUsed: job.config_name || 'Queue Job',
          batchMode: job.type === 'batch',
        },
        job.config_name || 'Queue Job'
      );

      console.log(`📧 Completion notification sent to ${job.notify_email}`);
    } catch (error) {
      console.error('❌ Failed to send completion notification:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Startup Recovery
  // --------------------------------------------------------------------------

  /**
   * Recover jobs that were running when the server was interrupted
   * Called on startup
   */
  recoverInterruptedJobs(): number {
    const interrupted = this.db.prepare(`
      SELECT id FROM jobs WHERE status = 'running'
    `).all() as { id: string }[];

    if (interrupted.length === 0) return 0;

    // Reset running jobs to pending so the worker picks them up
    this.db.prepare(`
      UPDATE jobs SET status = 'pending', updated_at = datetime('now')
      WHERE status = 'running'
    `).run();

    console.log(`🔄 Recovered ${interrupted.length} interrupted job(s)`);
    return interrupted.length;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Delete old completed/failed/cancelled jobs
   */
  cleanup(olderThanDays = 30): number {
    const result = this.db.prepare(`
      DELETE FROM jobs
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND completed_at < datetime('now', '-' || ? || ' days')
    `).run(olderThanDays);

    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} old jobs`);
    }
    return result.changes;
  }
}

export const queueEngine = new QueueEngine();
