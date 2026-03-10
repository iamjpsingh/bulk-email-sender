// src/routes/apikeys.ts - API Key Management

import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { success, error } from '../utils/response'
import { logger } from '../utils/logger'
import Database from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// ============================================================================
// Types
// ============================================================================

interface ApiKey {
  id: string
  user_id: string
  name: string
  key_prefix: string // First 8 chars for identification
  key_hash: string // Argon2 hash of full key
  scopes: string // JSON array
  last_used_at: string | null
  expires_at: string | null
  enabled: number
  created_at: string
}

// ============================================================================
// Database
// ============================================================================

const dbPath = './data/apikeys.db'
const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const db = new Database(dbPath)
db.exec('PRAGMA journal_mode=WAL')
db.exec('PRAGMA busy_timeout=5000')
db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT DEFAULT '["read"]',
    last_used_at TEXT,
    expires_at TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ak_user ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_ak_prefix ON api_keys(key_prefix);
`)

logger.info('API Keys database initialized (data/apikeys.db)')

// ============================================================================
// Routes
// ============================================================================

const app = new Hono()

/**
 * GET /api-keys - List API keys for user
 */
app.get('/api-keys', (c) => {
  const user = requireAuth(c)

  const keys = db.prepare(`
    SELECT id, name, key_prefix, scopes, last_used_at, expires_at, enabled, created_at
    FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
  `).all(user.id) as Omit<ApiKey, 'key_hash' | 'user_id'>[]

  return success(c, { keys })
})

/**
 * POST /api-keys - Create a new API key
 */
app.post('/api-keys', async (c) => {
  const user = requireAuth(c)
  const body = await c.req.json()

  if (!body.name?.trim()) {
    return error(c, 'Key name is required', 400)
  }

  const validScopes = ['read', 'send', 'contacts', 'campaigns', 'templates', 'admin']
  const scopes: string[] = (body.scopes || ['read']).filter((s: string) => validScopes.includes(s))

  // Generate API key
  const id = `ak_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const rawKey = generateApiKey()
  const keyPrefix = rawKey.substring(0, 8)
  const keyHash = await Bun.password.hash(rawKey, { algorithm: 'argon2id' })

  db.prepare(`
    INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, user.id, body.name.trim(), keyPrefix, keyHash,
    JSON.stringify(scopes),
    body.expires_at || null
  )

  // Return the raw key ONLY on creation - it cannot be retrieved again
  return success(c, {
    id,
    name: body.name.trim(),
    key: rawKey,
    key_prefix: keyPrefix,
    scopes,
    message: 'Save this key - it cannot be shown again',
  }, 'API key created', 201)
})

/**
 * DELETE /api-keys/:id - Revoke an API key
 */
app.delete('/api-keys/:id', (c) => {
  const user = requireAuth(c)
  const keyId = c.req.param('id')

  const result = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(keyId, user.id)
  if (result.changes === 0) return error(c, 'API key not found', 404)

  return success(c, undefined, 'API key revoked')
})

/**
 * POST /api-keys/:id/toggle - Enable/disable a key
 */
app.post('/api-keys/:id/toggle', async (c) => {
  const user = requireAuth(c)
  const keyId = c.req.param('id')
  const body = await c.req.json()

  const result = db.prepare(`
    UPDATE api_keys SET enabled = ? WHERE id = ? AND user_id = ?
  `).run(body.enabled ? 1 : 0, keyId, user.id)

  if (result.changes === 0) return error(c, 'API key not found', 404)
  return success(c, undefined, body.enabled ? 'Key enabled' : 'Key disabled')
})

/**
 * PUT /api-keys/:id/scopes - Update key scopes
 */
app.put('/api-keys/:id/scopes', async (c) => {
  const user = requireAuth(c)
  const keyId = c.req.param('id')
  const body = await c.req.json()

  const validScopes = ['read', 'send', 'contacts', 'campaigns', 'templates', 'admin']
  const scopes: string[] = (body.scopes || []).filter((s: string) => validScopes.includes(s))

  if (scopes.length === 0) {
    return error(c, 'At least one valid scope is required', 400)
  }

  const result = db.prepare(`
    UPDATE api_keys SET scopes = ? WHERE id = ? AND user_id = ?
  `).run(JSON.stringify(scopes), keyId, user.id)

  if (result.changes === 0) return error(c, 'API key not found', 404)
  return success(c, undefined, 'Scopes updated')
})

// ============================================================================
// API Key Validation (exported for auth middleware)
// ============================================================================

export async function validateApiKey(key: string): Promise<{ userId: string; scopes: string[] } | null> {
  const prefix = key.substring(0, 8)

  const candidates = db.prepare(`
    SELECT * FROM api_keys WHERE key_prefix = ? AND enabled = 1
  `).all(prefix) as ApiKey[]

  for (const candidate of candidates) {
    // Check expiry
    if (candidate.expires_at && new Date(candidate.expires_at) < new Date()) {
      continue
    }

    const valid = await Bun.password.verify(key, candidate.key_hash)
    if (valid) {
      // Update last used
      db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(candidate.id)

      return {
        userId: candidate.user_id,
        scopes: JSON.parse(candidate.scopes),
      }
    }
  }

  return null
}

// ============================================================================
// Helpers
// ============================================================================

function generateApiKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `dsp_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`
}

export default app
