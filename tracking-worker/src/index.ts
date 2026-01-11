/**
 * MailFlow Worker - Complete D1 Backend
 * All data stored in Cloudflare D1
 * 
 * Auth APIs:
 * - POST /api/auth/register - Create user
 * - POST /api/auth/login - Login user
 * - POST /api/auth/logout - Logout user
 * - GET /api/auth/validate - Validate session
 * 
 * Config APIs:
 * - GET /api/configs - Get user's SMTP configs
 * - POST /api/configs - Create SMTP config
 * - PUT /api/configs/:id - Update SMTP config
 * - DELETE /api/configs/:id - Delete SMTP config
 * 
 * Tracking APIs:
 * - GET /o/:id - Track open (returns pixel)
 * - GET /c/:id - Track click (redirects)
 * - POST /api/email - Register email for tracking
 * - GET /api/stats - Get tracking stats
 * - GET /api/logs - Get email logs
 * - GET /api/dashboard - Get dashboard stats
 */

export interface Env {
  DB: D1Database
}

// 1x1 transparent GIF
const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ========== TRACKING ENDPOINTS ==========
      if (path.startsWith('/o/')) {
        const trackingId = path.slice(3);
        ctx.waitUntil(recordOpen(env.DB, trackingId, request));
        return pixelResponse();
      }

      if (path.startsWith('/c/')) {
        const trackingId = path.slice(3);
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return new Response('Missing URL', { status: 400 });
        ctx.waitUntil(recordClick(env.DB, trackingId, decodeURIComponent(targetUrl), request));
        return Response.redirect(decodeURIComponent(targetUrl), 302);
      }

      // ========== AUTH ENDPOINTS ==========
      if (path === '/api/auth/register' && request.method === 'POST') {
        return handleRegister(env.DB, request);
      }
      if (path === '/api/auth/login' && request.method === 'POST') {
        return handleLogin(env.DB, request);
      }
      if (path === '/api/auth/logout' && request.method === 'POST') {
        return handleLogout(env.DB, request);
      }
      if (path === '/api/auth/validate') {
        return handleValidateSession(env.DB, request);
      }

      // ========== CONFIG ENDPOINTS ==========
      if (path === '/api/configs' && request.method === 'GET') {
        return handleGetConfigs(env.DB, url);
      }
      if (path === '/api/configs' && request.method === 'POST') {
        return handleCreateConfig(env.DB, request);
      }
      if (path.startsWith('/api/configs/') && request.method === 'PUT') {
        const configId = path.split('/')[3];
        return handleUpdateConfig(env.DB, configId, request);
      }
      if (path.startsWith('/api/configs/') && request.method === 'DELETE') {
        const configId = path.split('/')[3];
        return handleDeleteConfig(env.DB, configId, url);
      }

      // ========== EMAIL/TRACKING ENDPOINTS ==========
      if (path === '/api/email' && request.method === 'POST') {
        return handleRegisterEmail(env.DB, request);
      }
      if (path === '/api/stats') {
        return handleGetStats(env.DB, url);
      }
      if (path === '/api/logs') {
        return handleGetLogs(env.DB, url);
      }
      if (path === '/api/logs/bulk-delete' && request.method === 'POST') {
        return handleBulkDeleteLogs(env.DB, request);
      }
      if (path.startsWith('/api/logs/') && request.method === 'DELETE') {
        const logId = path.split('/')[3];
        return handleDeleteLog(env.DB, logId, url);
      }
      if (path === '/api/dashboard') {
        return handleGetDashboard(env.DB, url);
      }

      if (path === '/health') {
        return json({ status: 'ok', timestamp: new Date().toISOString() });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return json({ success: false, error: String(error) }, 500);
    }
  }
};

// =============================================================================
// AUTH HANDLERS
// =============================================================================

async function handleRegister(db: D1Database, request: Request): Promise<Response> {
  try {
    const { email, password, name } = await request.json() as any;
    
    if (!email || !password) {
      return json({ success: false, error: 'Email and password required' }, 400);
    }

    // Check if user exists
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
    if (existing) {
      return json({ success: false, error: 'Email already registered' }, 400);
    }

    // Hash password (simple hash for demo - use bcrypt in production)
    const passwordHash = await hashPassword(password);
    const userId = generateId();

    await db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(userId, email.toLowerCase(), passwordHash, name || '').run();

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(generateId(), userId, token, expiresAt).run();

    return json({
      success: true,
      user: { id: userId, email: email.toLowerCase(), name },
      token,
      expiresAt
    });
  } catch (e) {
    console.error('Register error:', e);
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleLogin(db: D1Database, request: Request): Promise<Response> {
  try {
    const { email, password } = await request.json() as any;
    
    if (!email || !password) {
      return json({ success: false, error: 'Email and password required' }, 400);
    }

    const user = await db.prepare(
      'SELECT id, email, password_hash, name FROM users WHERE email = ? AND is_active = 1'
    ).bind(email.toLowerCase()).first() as any;

    if (!user) {
      return json({ success: false, error: 'Invalid credentials' }, 401);
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return json({ success: false, error: 'Invalid credentials' }, 401);
    }

    // Update last login
    await db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').bind(user.id).run();

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(generateId(), user.id, token, expiresAt).run();

    return json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
      expiresAt
    });
  } catch (e) {
    console.error('Login error:', e);
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleLogout(db: D1Database, request: Request): Promise<Response> {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token) {
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    }
    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleValidateSession(db: D1Database, request: Request): Promise<Response> {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return json({ success: false, error: 'No token' }, 401);
    }

    const session = await db.prepare(`
      SELECT s.*, u.email, u.name FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).bind(token).first() as any;

    if (!session) {
      return json({ success: false, error: 'Invalid or expired session' }, 401);
    }

    return json({
      success: true,
      user: { id: session.user_id, email: session.email, name: session.name }
    });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

// =============================================================================
// CONFIG HANDLERS
// =============================================================================

async function handleGetConfigs(db: D1Database, url: URL): Promise<Response> {
  try {
    const userId = url.searchParams.get('user_id');
    if (!userId) return json({ success: false, error: 'user_id required' }, 400);

    const configs = await db.prepare(`
      SELECT id, user_id, name, host, port, secure, username, password, from_email, from_name,
             provider_type, oauth_email, oauth_access_token, oauth_refresh_token, oauth_expires_at, 
             is_default, created_at, updated_at
      FROM smtp_configs WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(userId).all();

    return json({ success: true, configs: configs.results });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleCreateConfig(db: D1Database, request: Request): Promise<Response> {
  try {
    const data = await request.json() as any;
    const { user_id, name, host, port, secure, username, password, from_email, from_name,
            provider_type, oauth_email, oauth_access_token, oauth_refresh_token, oauth_expires_at, is_default } = data;

    if (!user_id || !name) {
      return json({ success: false, error: 'user_id and name required' }, 400);
    }

    const configId = generateId();

    // If setting as default, unset other defaults
    if (is_default) {
      await db.prepare('UPDATE smtp_configs SET is_default = 0 WHERE user_id = ?').bind(user_id).run();
    }

    await db.prepare(`
      INSERT INTO smtp_configs (id, user_id, name, host, port, secure, username, password, from_email, from_name,
                                provider_type, oauth_email, oauth_access_token, oauth_refresh_token, oauth_expires_at, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      configId, user_id, name, host || '', port || 587, secure ? 1 : 0, username || '', password || '',
      from_email || '', from_name || '', provider_type || 'smtp', oauth_email || '',
      oauth_access_token || '', oauth_refresh_token || '', oauth_expires_at || '', is_default ? 1 : 0
    ).run();

    return json({ success: true, id: configId });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleUpdateConfig(db: D1Database, configId: string, request: Request): Promise<Response> {
  try {
    const data = await request.json() as any;
    const { user_id, name, host, port, secure, username, password, from_email, from_name,
            provider_type, oauth_email, oauth_access_token, oauth_refresh_token, oauth_expires_at, is_default } = data;

    // Verify ownership
    const existing = await db.prepare('SELECT user_id FROM smtp_configs WHERE id = ?').bind(configId).first() as any;
    if (!existing || existing.user_id !== user_id) {
      return json({ success: false, error: 'Config not found' }, 404);
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await db.prepare('UPDATE smtp_configs SET is_default = 0 WHERE user_id = ?').bind(user_id).run();
    }

    // Build update query dynamically
    const updates: string[] = ['updated_at = datetime("now")'];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (host !== undefined) { updates.push('host = ?'); values.push(host); }
    if (port !== undefined) { updates.push('port = ?'); values.push(port); }
    if (secure !== undefined) { updates.push('secure = ?'); values.push(secure ? 1 : 0); }
    if (username !== undefined) { updates.push('username = ?'); values.push(username); }
    if (password !== undefined) { updates.push('password = ?'); values.push(password); }
    if (from_email !== undefined) { updates.push('from_email = ?'); values.push(from_email); }
    if (from_name !== undefined) { updates.push('from_name = ?'); values.push(from_name); }
    if (provider_type !== undefined) { updates.push('provider_type = ?'); values.push(provider_type); }
    if (oauth_email !== undefined) { updates.push('oauth_email = ?'); values.push(oauth_email); }
    if (oauth_access_token !== undefined) { updates.push('oauth_access_token = ?'); values.push(oauth_access_token); }
    if (oauth_refresh_token !== undefined) { updates.push('oauth_refresh_token = ?'); values.push(oauth_refresh_token); }
    if (oauth_expires_at !== undefined) { updates.push('oauth_expires_at = ?'); values.push(oauth_expires_at); }
    if (is_default !== undefined) { updates.push('is_default = ?'); values.push(is_default ? 1 : 0); }

    values.push(configId);
    await db.prepare(`UPDATE smtp_configs SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleDeleteConfig(db: D1Database, configId: string, url: URL): Promise<Response> {
  try {
    const userId = url.searchParams.get('user_id');
    if (!userId) return json({ success: false, error: 'user_id required' }, 400);

    const result = await db.prepare('DELETE FROM smtp_configs WHERE id = ? AND user_id = ?').bind(configId, userId).run();
    
    return json({ success: true, deleted: result.meta.changes > 0 });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

// =============================================================================
// TRACKING HANDLERS
// =============================================================================

async function recordOpen(db: D1Database, trackingId: string, request: Request) {
  try {
    const meta = getRequestMeta(request);
    
    await db.prepare(`
      UPDATE emails SET 
        status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
        opened_at = COALESCE(opened_at, datetime('now')),
        open_count = open_count + 1
      WHERE tracking_id = ?
    `).bind(trackingId).run();

    const email = await db.prepare(
      'SELECT id, campaign_id, recipient_email FROM emails WHERE tracking_id = ?'
    ).bind(trackingId).first() as any;

    if (email) {
      await db.prepare(`
        INSERT INTO tracking_events (id, email_id, campaign_id, recipient_email, event_type, user_agent, ip_address, country, city, device_type, created_at)
        VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, datetime('now'))
      `).bind(generateId(), email.id, email.campaign_id, email.recipient_email, meta.userAgent, meta.ip, meta.country, meta.city, meta.device).run();

      await db.prepare('UPDATE campaigns SET opened_count = opened_count + 1 WHERE id = ?').bind(email.campaign_id).run();
    }
  } catch (e) {
    console.error('Record open error:', e);
  }
}

async function recordClick(db: D1Database, trackingId: string, linkUrl: string, request: Request) {
  try {
    const meta = getRequestMeta(request);

    await db.prepare(`
      UPDATE emails SET 
        status = 'clicked',
        clicked_at = COALESCE(clicked_at, datetime('now')),
        click_count = click_count + 1
      WHERE tracking_id = ?
    `).bind(trackingId).run();

    const email = await db.prepare(
      'SELECT id, campaign_id, recipient_email FROM emails WHERE tracking_id = ?'
    ).bind(trackingId).first() as any;

    if (email) {
      await db.prepare(`
        INSERT INTO tracking_events (id, email_id, campaign_id, recipient_email, event_type, link_url, user_agent, ip_address, country, city, device_type, created_at)
        VALUES (?, ?, ?, ?, 'click', ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(generateId(), email.id, email.campaign_id, email.recipient_email, linkUrl, meta.userAgent, meta.ip, meta.country, meta.city, meta.device).run();

      await db.prepare('UPDATE campaigns SET clicked_count = clicked_count + 1 WHERE id = ?').bind(email.campaign_id).run();
    }
  } catch (e) {
    console.error('Record click error:', e);
  }
}

async function handleRegisterEmail(db: D1Database, request: Request): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { user_id, campaign_id, campaign_name, subject, from_email, from_name,
            recipient_email, recipient_name, send_type, provider_type, config_name, message_id } = body;

    const trackingId = generateId();
    const emailId = generateId();

    await db.prepare(`
      INSERT INTO campaigns (id, user_id, name, subject, from_email, from_name, send_type, provider_type, config_name, total_recipients, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'sending', datetime('now'))
      ON CONFLICT(id) DO UPDATE SET total_recipients = total_recipients + 1
    `).bind(campaign_id, user_id, campaign_name || 'Campaign', subject, from_email, from_name || '', send_type || 'direct', provider_type || 'smtp', config_name || '').run();

    await db.prepare(`
      INSERT INTO emails (id, tracking_id, campaign_id, user_id, recipient_email, recipient_name, subject, send_type, provider_type, config_name, message_id, status, sent_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', datetime('now'))
    `).bind(emailId, trackingId, campaign_id, user_id, recipient_email, recipient_name || '', subject, send_type || 'direct', provider_type || 'smtp', config_name || '', message_id || '').run();

    return json({ success: true, tracking_id: trackingId, email_id: emailId });
  } catch (e) {
    console.error('Register email error:', e);
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleGetStats(db: D1Database, url: URL): Promise<Response> {
  try {
    const userId = url.searchParams.get('user_id');
    const campaignId = url.searchParams.get('campaign_id');

    if (campaignId) {
      const campaign = await db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(campaignId).first() as any;
      if (!campaign) return json({ success: false, error: 'Campaign not found' }, 404);

      const openRate = campaign.total_recipients > 0 ? Math.round((campaign.opened_count / campaign.total_recipients) * 100) : 0;
      const clickRate = campaign.opened_count > 0 ? Math.round((campaign.clicked_count / campaign.opened_count) * 100) : 0;

      return json({ success: true, data: { ...campaign, open_rate: openRate, click_rate: clickRate } });
    }

    if (userId) {
      const stats = await db.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN status IN ('sent', 'opened', 'clicked') THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status IN ('opened', 'clicked') THEN 1 ELSE 0 END) as opened,
          SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked
        FROM emails WHERE user_id = ?
      `).bind(userId).first() as any;

      const campaigns = await db.prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(userId).all();

      return json({
        success: true,
        data: {
          stats: { ...stats, openRate: stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0, clickRate: stats.opened > 0 ? Math.round((stats.clicked / stats.opened) * 100) : 0 },
          campaigns: campaigns.results
        }
      });
    }

    return json({ success: false, error: 'user_id or campaign_id required' }, 400);
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleGetLogs(db: D1Database, url: URL): Promise<Response> {
  try {
    const userId = url.searchParams.get('user_id');
    if (!userId) return json({ success: false, error: 'user_id required' }, 400);

    const status = url.searchParams.get('status');
    const sendType = url.searchParams.get('send_type');
    const provider = url.searchParams.get('provider');
    const campaignId = url.searchParams.get('campaign_id');
    const search = url.searchParams.get('search');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let where = 'user_id = ?';
    const params: any[] = [userId];

    if (status) { where += ' AND status = ?'; params.push(status); }
    if (sendType) { where += ' AND send_type = ?'; params.push(sendType); }
    if (provider) { where += ' AND provider_type = ?'; params.push(provider); }
    if (campaignId) { where += ' AND campaign_id = ?'; params.push(campaignId); }
    if (search) { where += ' AND (recipient_email LIKE ? OR recipient_name LIKE ? OR subject LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    if (startDate) { where += ' AND sent_at >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND sent_at <= ?'; params.push(endDate); }

    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM emails WHERE ${where}`).bind(...params).first() as any;
    const total = countResult?.count || 0;

    const logs = await db.prepare(`SELECT * FROM emails WHERE ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();

    const stats = await db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status IN ('sent', 'opened', 'clicked') THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status IN ('opened', 'clicked') THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked
      FROM emails WHERE ${where}
    `).bind(...params).first() as any;

    return json({
      success: true,
      logs: logs.results,
      stats: { ...stats, openRate: stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0, clickRate: stats.opened > 0 ? Math.round((stats.clicked / stats.opened) * 100) : 0 },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleDeleteLog(db: D1Database, logId: string, url: URL): Promise<Response> {
  try {
    const userId = url.searchParams.get('user_id');
    if (!userId) return json({ success: false, error: 'user_id required' }, 400);

    // First delete tracking events for this email
    await db.prepare('DELETE FROM tracking_events WHERE email_id = ?').bind(logId).run();
    
    // Then delete the email by id OR tracking_id
    await db.prepare('DELETE FROM emails WHERE (id = ? OR tracking_id = ?) AND user_id = ?').bind(logId, logId, userId).run();
    
    return json({ success: true, message: 'Log deleted' });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleBulkDeleteLogs(db: D1Database, request: Request): Promise<Response> {
  try {
    const { user_id, ids } = await request.json() as { user_id: string; ids: string[] };
    
    if (!user_id) return json({ success: false, error: 'user_id required' }, 400);
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return json({ success: false, error: 'ids array required' }, 400);
    }

    const placeholders = ids.map(() => '?').join(',');
    
    // First delete tracking events for these emails
    await db.prepare(`DELETE FROM tracking_events WHERE email_id IN (${placeholders})`)
      .bind(...ids).run();
    
    // Then delete the emails by id OR tracking_id
    await db.prepare(`DELETE FROM emails WHERE (id IN (${placeholders}) OR tracking_id IN (${placeholders})) AND user_id = ?`)
      .bind(...ids, ...ids, user_id).run();

    return json({ success: true, deleted: ids.length, message: `${ids.length} logs deleted` });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

async function handleGetDashboard(db: D1Database, url: URL): Promise<Response> {
  try {
    const userId = url.searchParams.get('user_id');
    if (!userId) return json({ success: false, error: 'user_id required' }, 400);

    // Get overall stats
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as totalEmails,
        SUM(CASE WHEN status IN ('sent', 'opened', 'clicked') THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status IN ('opened', 'clicked') THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked
      FROM emails WHERE user_id = ?
    `).bind(userId).first() as any;

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await db.prepare(`
      SELECT COUNT(*) as count FROM emails WHERE user_id = ? AND date(sent_at) = ?
    `).bind(userId, today).first() as any;

    // Get campaign count
    const campaignCount = await db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE user_id = ?').bind(userId).first() as any;

    // Get recent activity
    const recentEmails = await db.prepare(`
      SELECT recipient_email, subject, status, sent_at FROM emails 
      WHERE user_id = ? ORDER BY sent_at DESC LIMIT 10
    `).bind(userId).all();

    // Get config count
    const configCount = await db.prepare('SELECT COUNT(*) as count FROM smtp_configs WHERE user_id = ?').bind(userId).first() as any;

    return json({
      success: true,
      data: {
        stats: {
          totalEmails: stats?.totalEmails || 0,
          sent: stats?.sent || 0,
          failed: stats?.failed || 0,
          opened: stats?.opened || 0,
          clicked: stats?.clicked || 0,
          openRate: stats?.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0,
          clickRate: stats?.opened > 0 ? Math.round((stats.clicked / stats.opened) * 100) : 0,
          todaySent: todayStats?.count || 0,
          totalCampaigns: campaignCount?.count || 0,
          totalConfigs: configCount?.count || 0
        },
        recentActivity: recentEmails.results
      }
    });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function pixelResponse(): Response {
  return new Response(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }
  });
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'mailflow_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

function getRequestMeta(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  return {
    userAgent: ua,
    ip: request.headers.get('cf-connecting-ip') || '',
    country: request.headers.get('cf-ipcountry') || '',
    city: request.headers.get('cf-ipcity') || '',
    device: detectDevice(ua)
  };
}

function detectDevice(ua: string): string {
  const l = ua.toLowerCase();
  if (l.includes('mobile') || l.includes('android') || l.includes('iphone')) return 'mobile';
  if (l.includes('tablet') || l.includes('ipad')) return 'tablet';
  if (l.includes('bot') || l.includes('crawler')) return 'bot';
  return 'desktop';
}
