// src/routes/queue.ts - Queue Management API Routes

import { Hono } from 'hono';
import { queueEngine } from '../services/queueEngine';
import type { JobStatus } from '../services/queueEngine';

const queue = new Hono();

// ============================================================================
// Job Queue Management
// ============================================================================

/**
 * GET /queue/jobs - List jobs for the authenticated user
 * Query params: status, limit, offset
 */
queue.get('/queue/jobs', (c) => {
  const userId = c.get('userId') as string;
  const status = c.req.query('status') as JobStatus | undefined;
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  const jobs = queueEngine.getJobs(userId, status, limit, offset);

  // Strip large JSON fields from list view
  const jobSummaries = jobs.map(job => ({
    id: job.id,
    campaign_id: job.campaign_id,
    type: job.type,
    status: job.status,
    priority: job.priority,
    subject: job.subject,
    from_email: job.from_email,
    config_name: job.config_name,
    total_count: job.total_count,
    sent_count: job.sent_count,
    failed_count: job.failed_count,
    last_processed_index: job.last_processed_index,
    batch_size: job.batch_size,
    progress: job.total_count > 0
      ? Math.round((job.last_processed_index / job.total_count) * 100)
      : 0,
    scheduled_at: job.scheduled_at,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    last_error: job.last_error,
  }));

  return c.json({ success: true, data: jobSummaries });
});

/**
 * GET /queue/jobs/:id - Get a specific job
 */
queue.get('/queue/jobs/:id', (c) => {
  const jobId = c.req.param('id');
  const job = queueEngine.getJob(jobId);

  if (!job) {
    return c.json({ success: false, message: 'Job not found' }, 404);
  }

  // Return job without raw contacts JSON (can be huge)
  const { contacts_json, config_json, ...jobData } = job;

  return c.json({
    success: true,
    data: {
      ...jobData,
      progress: job.total_count > 0
        ? Math.round((job.last_processed_index / job.total_count) * 100)
        : 0,
    },
  });
});

/**
 * POST /queue/jobs/:id/pause - Pause a running job
 */
queue.post('/queue/jobs/:id/pause', (c) => {
  const jobId = c.req.param('id');
  const paused = queueEngine.pause(jobId);

  if (!paused) {
    return c.json({ success: false, message: 'Job is not running or does not exist' }, 400);
  }

  return c.json({ success: true, message: 'Job paused' });
});

/**
 * POST /queue/jobs/:id/resume - Resume a paused job
 */
queue.post('/queue/jobs/:id/resume', (c) => {
  const jobId = c.req.param('id');
  const resumed = queueEngine.resume(jobId);

  if (!resumed) {
    return c.json({ success: false, message: 'Job is not paused or does not exist' }, 400);
  }

  return c.json({ success: true, message: 'Job resumed — will be picked up by worker' });
});

/**
 * DELETE /queue/jobs/:id - Cancel a job
 */
queue.delete('/queue/jobs/:id', (c) => {
  const jobId = c.req.param('id');
  const cancelled = queueEngine.cancel(jobId);

  if (!cancelled) {
    return c.json({ success: false, message: 'Job cannot be cancelled (already completed or does not exist)' }, 400);
  }

  return c.json({ success: true, message: 'Job cancelled' });
});

// ============================================================================
// Queue Stats
// ============================================================================

/**
 * GET /queue/stats - Get queue statistics for the authenticated user
 */
queue.get('/queue/stats', (c) => {
  const userId = c.get('userId') as string;
  const stats = queueEngine.getStats(userId);
  return c.json({ success: true, data: stats });
});

// ============================================================================
// Dead Letter Queue
// ============================================================================

/**
 * GET /queue/dead-letters - List dead letters
 * Query params: job_id, limit, offset
 */
queue.get('/queue/dead-letters', (c) => {
  const jobId = c.req.query('job_id');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const deadLetters = queueEngine.getDeadLetters(jobId || undefined, limit, offset);
  return c.json({ success: true, data: deadLetters });
});

// ============================================================================
// Suppression List
// ============================================================================

/**
 * GET /queue/suppression - Get suppression list
 */
queue.get('/queue/suppression', (c) => {
  const userId = c.get('userId') as string;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const list = queueEngine.getSuppressionList(userId, limit, offset);
  return c.json({ success: true, data: list });
});

/**
 * POST /queue/suppression - Add email to suppression list
 */
queue.post('/queue/suppression', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const { email, reason } = body;

  if (!email || !reason) {
    return c.json({ success: false, message: 'email and reason are required' }, 400);
  }

  queueEngine.suppress(userId, email, reason, 'manual');
  return c.json({ success: true, message: `${email} added to suppression list` });
});

/**
 * DELETE /queue/suppression/:email - Remove email from suppression list
 */
queue.delete('/queue/suppression/:email', (c) => {
  const userId = c.get('userId') as string;
  const email = decodeURIComponent(c.req.param('email'));

  const removed = queueEngine.unsuppress(userId, email);
  if (!removed) {
    return c.json({ success: false, message: 'Email not found in suppression list' }, 404);
  }

  return c.json({ success: true, message: `${email} removed from suppression list` });
});

export default queue;
