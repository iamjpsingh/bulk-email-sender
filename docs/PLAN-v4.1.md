# Dispatch v4.1 — Platform Setup Wizard & Tracking Infrastructure

**Date**: 2026-03-16
**Branch**: `new-framework`
**Scope**: Everything needed to go from "fresh install" to "fully operational" in one wizard flow.

---

## What Already Exists (Done)

| Feature | Status | Files |
|---------|--------|-------|
| System settings table + service | Done | `src/db/migrations/004_system_settings.ts`, `src/services/systemSettingsService.ts` |
| System mailer (8 providers) | Done | `src/services/systemMailerService.ts` |
| Platform settings UI (provider selector, forms, OAuth connect) | Done | `frontend/src/views/admin/PlatformSettingsPage.vue` |
| Platform settings routes (mailer CRUD, test, OAuth creds, OAuth connect) | Done | `src/routes/admin.ts` |
| OAuth dynamic config (reads system_settings, falls back to .env) | Done | `src/services/oauthService.ts` |
| Password reset emails wired | Done | `src/routes/auth.ts` |
| Invitation emails wired | Done | `src/services/invitationService.ts` |
| Bounce parsers: SES, Mailgun, SendGrid | Done | `src/services/bounceProcessor.ts` |
| Bounce webhook routes: `/webhooks/bounce/ses,mailgun,sendgrid` | Done | `src/routes/webhooks.ts` |
| Platform admin invisible, plan references removed | Done | Multiple files |

---

## What We're Building (This Plan)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLATFORM SETUP WIZARD                       │
│                                                                 │
│  Step 1: System Mailer ........... [Done — needs auto-webhook]  │
│  Step 2: OAuth Credentials ....... [Done]                       │
│  Step 3: Tracking Setup .......... [NEW — Cloudflare Workers]   │
│  Step 4: Webhook Security ........ [NEW — signature verify]     │
│                                                                 │
│  Auto-actions on save:                                          │
│  • Register bounce webhooks with provider API                   │
│  • Deploy tracking Worker to org's Cloudflare                   │
│  • Create Worker Routes on their domains                        │
│  • Pull analytics back to dashboard                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Auto-Webhook Registration (Day 1 Morning)

**Goal**: When platform admin saves a provider config, we call the provider's API to register our bounce/complaint webhook URLs automatically. Like MailWizz — add API key, everything works.

### 1.1 Webhook Registration Service

**New file**: `src/services/webhookRegistrationService.ts`

```typescript
// Each provider has a different API for registering webhooks:

interface WebhookRegistration {
  register(config: ProviderConfig, webhookBaseUrl: string): Promise<{ success: boolean; webhookId?: string; error?: string }>
  unregister(config: ProviderConfig, webhookId: string): Promise<void>
}
```

**Provider-specific logic**:

| Provider | API to Register Webhook | What We Register |
|----------|------------------------|-----------------|
| **SES** | Create SNS Topic → Subscribe HTTPS endpoint → Set SES notification config | `POST /api/webhooks/bounce/ses` for Bounce + Complaint |
| **SendGrid** | `PUT /v3/user/webhooks/event/settings` | `POST /api/webhooks/bounce/sendgrid` for bounce, spamreport, dropped |
| **Mailgun** | `POST /v3/domains/{domain}/webhooks` | `POST /api/webhooks/bounce/mailgun` for `permanent_fail`, `temporary_fail`, `complained` |
| **Postmark** | `PUT /webhooks` with server token | `POST /api/webhooks/bounce/postmark` for Bounce, SpamComplaint |
| **SparkPost** | `POST /api/v1/webhooks` | `POST /api/webhooks/bounce/sparkpost` for bounce, spam_complaint, policy_rejection |

**SES registration flow** (most complex — requires SNS):
```
1. Create SNS topic: POST to SNS API → get topicArn
2. Subscribe our endpoint: POST to SNS API with Protocol=https, Endpoint=our_webhook_url
3. Wait for SNS to POST SubscriptionConfirmation (our webhook auto-confirms)
4. Configure SES notifications: PUT to SES API with topicArn for Bounce + Complaint
```

**For SES SNS subscription confirmation** — update existing `/webhooks/bounce/ses` handler:
```typescript
// Already partially handled in parseSES — needs to actually call the SubscribeURL
if (payload.Type === 'SubscriptionConfirmation') {
  await fetch(payload.SubscribeURL) // Confirm the subscription
  return null
}
```

**SendGrid registration** (simplest):
```typescript
await fetch('https://api.sendgrid.com/v3/user/webhooks/event/settings', {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    enabled: true,
    url: `${baseUrl}/api/webhooks/bounce/sendgrid`,
    bounce: true, spam_report: true, deferred: true, dropped: true,
  }),
})
```

**Mailgun registration**:
```typescript
const webhookTypes = ['permanent_fail', 'temporary_fail', 'complained']
for (const type of webhookTypes) {
  await fetch(`${baseUrl}/v3/domains/${domain}/webhooks`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
    body: JSON.stringify({ id: type, url: `${webhookBaseUrl}/api/webhooks/bounce/mailgun` }),
  })
}
```

**Postmark registration**:
```typescript
await fetch('https://api.postmarkapp.com/webhooks', {
  method: 'POST',
  headers: { 'X-Postmark-Server-Token': serverToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    Url: `${webhookBaseUrl}/api/webhooks/bounce/postmark`,
    Triggers: {
      Bounce: { Enabled: true, IncludeContent: false },
      SpamComplaint: { Enabled: true, IncludeContent: false },
    },
  }),
})
```

**SparkPost registration**:
```typescript
await fetch('https://api.sparkpost.com/api/v1/webhooks', {
  method: 'POST',
  headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Dispatch Bounce Handler',
    target: `${webhookBaseUrl}/api/webhooks/bounce/sparkpost`,
    events: ['bounce', 'spam_complaint', 'policy_rejection', 'out_of_band', 'list_unsubscribe'],
  }),
})
```

**Files to create**:
- `src/services/webhookRegistrationService.ts` — all provider registration logic

**Files to modify**:
- `src/routes/admin.ts` — call `webhookRegistrationService.register()` after `saveSystemMailer`
- `src/routes/webhooks.ts` — auto-confirm SNS subscriptions (call `SubscribeURL`)

**Effort**: 3 hours

### 1.2 Postmark Bounce Parser

**Add to `src/services/bounceProcessor.ts`**:

```typescript
export function parsePostmark(payload: any): BounceEvent | null {
  const recordType = payload.RecordType

  if (recordType === 'Bounce') {
    return {
      email: payload.Email,
      type: payload.Type === 'HardBounce' ? 'hard_bounce' : 'soft_bounce',
      reason: payload.Description || payload.Details || 'Bounce',
      code: payload.TypeCode?.toString(),
      provider: 'postmark',
      rawEvent: payload,
    }
  }

  if (recordType === 'SpamComplaint') {
    return {
      email: payload.Email,
      type: 'complaint',
      reason: payload.Description || 'Spam complaint via Postmark',
      provider: 'postmark',
      rawEvent: payload,
    }
  }

  return null
}
```

**Add route** in `src/routes/webhooks.ts`:
```typescript
app.post('/webhooks/bounce/postmark', async (c) => {
  const payload = await c.req.json()
  const event = parsePostmark(payload)
  if (!event) return c.json({ ok: true, message: 'Ignored' })
  processBounce('system', event)
  return c.json({ ok: true, processed: event.type })
})
```

**Effort**: 30 minutes

### 1.3 SparkPost Bounce Parser

**Add to `src/services/bounceProcessor.ts`**:

```typescript
export function parseSparkPost(payload: any): BounceEvent[] {
  const results: BounceEvent[] = []
  const events = payload.msys ? [payload] : (Array.isArray(payload) ? payload : [])

  for (const wrapper of events) {
    // SparkPost wraps events in msys.message_event or msys.relay_message
    const event = wrapper.msys?.message_event || wrapper.msys?.relay_message || wrapper

    const type = event.type
    const email = event.rcpt_to || event.raw_rcpt_to

    if (!email) continue

    if (type === 'bounce' || type === 'out_of_band') {
      results.push({
        email,
        type: event.bounce_class === '10' || event.bounce_class === '30' ? 'hard_bounce' : 'soft_bounce',
        reason: event.reason || event.raw_reason || 'Bounce',
        code: event.error_code,
        provider: 'sparkpost',
        rawEvent: wrapper,
      })
    }

    if (type === 'spam_complaint') {
      results.push({
        email,
        type: 'complaint',
        reason: event.report_by || 'Spam complaint via SparkPost',
        provider: 'sparkpost',
        rawEvent: wrapper,
      })
    }

    if (type === 'list_unsubscribe' || type === 'link_unsubscribe') {
      results.push({
        email,
        type: 'unsubscribe',
        reason: 'Unsubscribed via SparkPost',
        provider: 'sparkpost',
        rawEvent: wrapper,
      })
    }
  }

  return results
}
```

**Add route** in `src/routes/webhooks.ts`:
```typescript
app.post('/webhooks/bounce/sparkpost', async (c) => {
  const payload = await c.req.json()
  const events = parseSparkPost(payload)
  for (const event of events) processBounce('system', event)
  return c.json({ ok: true, processed: events.length })
})
```

**Effort**: 30 minutes

---

## Phase 2: Webhook Signature Verification (Day 1 Afternoon)

**Goal**: Verify that inbound webhook requests actually come from the provider, not spoofed.

### 2.1 Signature Verification Middleware

**New file**: `src/middleware/webhookSignature.ts`

Each provider signs webhooks differently:

| Provider | Signature Method | Header |
|----------|-----------------|--------|
| **SES/SNS** | X.509 certificate signature in payload (`SigningCertURL` + `Signature`) | Embedded in JSON |
| **SendGrid** | ECDSA signature with verification key | `X-Twilio-Email-Event-Webhook-Signature` + `X-Twilio-Email-Event-Webhook-Timestamp` |
| **Mailgun** | HMAC-SHA256 with webhook signing key | `timestamp`, `token`, `signature` in body |
| **Postmark** | Basic auth or custom header (challenge-based) | N/A (webhook has no sig, use IP allowlist or challenge) |
| **SparkPost** | HMAC-SHA1 of request body with auth token | `X-MessageSystems-Webhook-Token` |

```typescript
// src/middleware/webhookSignature.ts

import { createHmac, createVerify } from 'crypto'
import { systemSettingsService } from '../services/systemSettingsService'

export function verifyMailgunSignature(timestamp: string, token: string, signature: string, signingKey: string): boolean {
  const computed = createHmac('sha256', signingKey)
    .update(timestamp + token)
    .digest('hex')
  return computed === signature
}

export function verifySendGridSignature(publicKey: string, payload: string, signature: string, timestamp: string): boolean {
  const verifier = createVerify('sha256')
  verifier.update(timestamp + payload)
  return verifier.verify(publicKey, signature, 'base64')
}

export function verifySparkPostSignature(body: string, signature: string, authToken: string): boolean {
  const computed = createHmac('sha1', authToken)
    .update(body)
    .digest('hex')
  return computed === signature
}

// SNS: Verify the X.509 certificate signature (validate SigningCertURL is from amazonaws.com)
export async function verifySNSSignature(payload: any): Promise<boolean> {
  // 1. Validate SigningCertURL is from *.amazonaws.com
  const certUrl = new URL(payload.SigningCertURL)
  if (!certUrl.hostname.endsWith('.amazonaws.com')) return false

  // 2. Download certificate
  const certRes = await fetch(payload.SigningCertURL)
  const cert = await certRes.text()

  // 3. Build string to sign (varies by Type)
  const fields = payload.Type === 'Notification'
    ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
    : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']

  let stringToSign = ''
  for (const field of fields) {
    if (payload[field] !== undefined) {
      stringToSign += `${field}\n${payload[field]}\n`
    }
  }

  // 4. Verify
  const verifier = createVerify('SHA1withRSA')
  verifier.update(stringToSign)
  return verifier.verify(cert, payload.Signature, 'base64')
}
```

**Store signing keys**: When auto-registering webhooks, store provider signing keys in `system_settings`:
- Mailgun: HTTP API signing key from domain info
- SendGrid: Event Webhook verification key (from Settings > Mail Settings > Event Webhook)
- SparkPost: Auth token returned when creating webhook
- SES/SNS: No separate key needed (uses X.509 cert in payload)

**Apply to webhook routes** in `src/routes/webhooks.ts`:
```typescript
app.post('/webhooks/bounce/mailgun', async (c) => {
  const payload = await c.req.json()
  const eventData = payload['event-data'] || payload
  const sig = eventData.signature || payload.signature

  if (sig) {
    const signingKey = systemSettingsService.get('mailgun_webhook_signing_key')
    if (signingKey && !verifyMailgunSignature(sig.timestamp, sig.token, sig.signature, signingKey)) {
      return c.json({ ok: false, error: 'Invalid signature' }, 401)
    }
  }
  // ... existing parse + process logic
})
```

**Files to create**:
- `src/middleware/webhookSignature.ts`

**Files to modify**:
- `src/routes/webhooks.ts` — add signature checks to all 5 bounce endpoints
- `src/services/webhookRegistrationService.ts` — store signing keys during registration

**Effort**: 2 hours

---

## Phase 3: Cloudflare Tracking Infrastructure (Day 1 Evening + Day 2 Morning)

**Goal**: One-click Cloudflare Worker deployment for first-party email tracking. User logs into Cloudflare, we deploy the Worker, create routes, done.

### 3.1 Cloudflare OAuth Integration

**Register Dispatch as Cloudflare OAuth app** (manual one-time setup):
- Cloudflare Developer Dashboard → Create OAuth client
- Scopes: `account:read`, `zone:read`, `workers_scripts:write`, `workers_routes:write`, `d1:write`
- Redirect URI: `{BASE_URL}/api/admin/cloudflare/callback`
- Store `CF_OAUTH_CLIENT_ID` + `CF_OAUTH_CLIENT_SECRET` in platform admin settings

**OAuth flow**:
```
User clicks "Connect Cloudflare"
  → GET /api/admin/cloudflare/connect
  → Redirect to https://dash.cloudflare.com/oauth2/authorize?client_id=...&scope=...&redirect_uri=...
  → User logs in to Cloudflare, clicks "Authorize"
  → Cloudflare redirects to /api/admin/cloudflare/callback?code=...
  → We exchange code for access_token + refresh_token
  → Store tokens in system_settings (keyed by org_id)
  → Redirect back to platform settings UI with success
```

**New file**: `src/services/cloudflareService.ts`

```typescript
interface CloudflareConfig {
  accessToken: string
  refreshToken: string
  accountId: string
  expiresAt: number
}

class CloudflareService {
  // OAuth
  getAuthUrl(orgId: string): string
  async exchangeCode(code: string): Promise<CloudflareConfig>
  async refreshToken(config: CloudflareConfig): Promise<string>

  // Account
  async getAccount(token: string): Promise<{ id: string; name: string }>
  async listZones(token: string): Promise<Zone[]>

  // Worker deployment
  async deployTrackingWorker(token: string, accountId: string, workerName: string): Promise<void>
  async createWorkerRoute(token: string, zoneId: string, pattern: string, workerName: string): Promise<void>
  async deleteWorkerRoute(token: string, zoneId: string, routeId: string): Promise<void>

  // D1
  async createD1Database(token: string, accountId: string, dbName: string): Promise<string>
  async executeD1Query(token: string, accountId: string, dbId: string, sql: string): Promise<any>
  async getTrackingStats(token: string, accountId: string, dbId: string): Promise<TrackingStats>

  // Worker analytics
  async getWorkerAnalytics(token: string, accountId: string, workerName: string): Promise<WorkerAnalytics>
}
```

**Effort**: 3 hours

### 3.2 Tracking Worker Template

**New file**: `src/templates/tracking-worker.ts`

This is the Worker script we deploy to the org's Cloudflare account. It handles:
- `/{open_path}/:id` — 1x1 transparent pixel, logs open event to D1
- `/{click_path}/:id` — 302 redirect to real URL, logs click event to D1
- `/{unsub_path}/:id` — Unsubscribe page

```typescript
// Template is a string that gets variable-replaced before deployment:
// {{D1_BINDING}} → the D1 database binding name
// {{OPEN_PATH}} → configurable path prefix (default: "o")
// {{CLICK_PATH}} → configurable path prefix (default: "c")
// {{UNSUB_PATH}} → configurable path prefix (default: "u")

export function generateWorkerScript(config: {
  openPath: string    // default "o"
  clickPath: string   // default "c"
  unsubPath: string   // default "u"
  d1Binding: string   // default "TRACKING_DB"
}): string {
  return `
// Dispatch Tracking Worker — deployed to org's Cloudflare account
// Handles email open tracking, click tracking, and unsubscribes
// All data stored in D1 database on this account

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // Open tracking — returns 1x1 transparent GIF
    if (path.startsWith('/${config.openPath}/')) {
      const id = path.split('/')[2]
      if (!id) return new Response('', { status: 404 })

      // Log open event (non-blocking)
      env.${config.d1Binding}.prepare(
        'INSERT INTO events (id, email_id, type, ip, ua, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
      ).bind(crypto.randomUUID(), id, 'open', request.headers.get('cf-connecting-ip'), request.headers.get('user-agent'))
        .run().catch(() => {})

      // 1x1 transparent GIF
      const pixel = new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59])
      return new Response(pixel, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Expires': '0',
        },
      })
    }

    // Click tracking — 302 redirect
    if (path.startsWith('/${config.clickPath}/')) {
      const id = path.split('/')[2]
      if (!id) return new Response('', { status: 404 })

      // Look up original URL
      const link = await env.${config.d1Binding}.prepare(
        'SELECT original_url FROM links WHERE id = ?'
      ).bind(id).first()

      if (!link) return new Response('Link not found', { status: 404 })

      // Log click event (non-blocking)
      env.${config.d1Binding}.prepare(
        'INSERT INTO events (id, email_id, type, link_id, ip, ua, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
      ).bind(crypto.randomUUID(), link.email_id || '', 'click', id, request.headers.get('cf-connecting-ip'), request.headers.get('user-agent'))
        .run().catch(() => {})

      return Response.redirect(link.original_url, 302)
    }

    // Unsubscribe
    if (path.startsWith('/${config.unsubPath}/')) {
      const id = path.split('/')[2]
      if (!id) return new Response('', { status: 404 })

      if (request.method === 'POST') {
        // Process unsubscribe
        await env.${config.d1Binding}.prepare(
          'INSERT INTO events (id, email_id, type, ip, ua, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
        ).bind(crypto.randomUUID(), id, 'unsubscribe', request.headers.get('cf-connecting-ip'), request.headers.get('user-agent'))
          .run()

        return new Response('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Unsubscribed</h2><p>You have been unsubscribed.</p></body></html>', {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Show unsubscribe confirmation page
      return new Response('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Unsubscribe</h2><p>Click to confirm.</p><form method="POST"><button type="submit" style="padding:12px 32px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px">Unsubscribe</button></form></body></html>', {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Not a tracking request — pass through (Worker Routes only match specific paths)
    return new Response('Not found', { status: 404 })
  },
}
`
}
```

**D1 schema template** (deployed to org's D1):

```sql
-- Tracking database schema
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  recipient TEXT NOT NULL,
  subject TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  email_id TEXT,
  original_url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'click', 'unsubscribe')),
  link_id TEXT,
  ip TEXT,
  ua TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_email ON events(email_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_links_email ON links(email_id);
```

**Files to create**:
- `src/templates/tracking-worker.ts` — Worker script generator
- `src/templates/tracking-schema.sql` — D1 schema for tracking

**Effort**: 2 hours

### 3.3 One-Click Deployment Flow

**How it works end-to-end**:

```
1. Platform admin clicks "Connect Cloudflare" → OAuth login
2. After OAuth: we store tokens, fetch account info + list zones
3. UI shows their domains: [example.com] [mysite.io] [store.co]
4. Admin selects domain(s) and tracking path config:
   ┌──────────────────────────────────────────────┐
   │  Tracking Setup for example.com              │
   │                                              │
   │  ● Same domain (recommended)                 │
   │    example.com/o/* — open tracking            │
   │    example.com/c/* — click tracking           │
   │    example.com/u/* — unsubscribe              │
   │                                              │
   │  ○ Subdomain                                 │
   │    e.example.com/o/* — open tracking          │
   │    e.example.com/c/* — click tracking         │
   │                                              │
   │  Custom paths: [o] / [c] / [u]              │
   │                                              │
   │  [Deploy Tracking Worker]                    │
   └──────────────────────────────────────────────┘
5. On "Deploy":
   a. Create D1 database: "dispatch-tracking-{orgSlug}"
   b. Run D1 schema SQL
   c. Upload Worker script (with D1 binding)
   d. Create Worker Routes:
      - example.com/o/* → dispatch-tracking worker
      - example.com/c/* → dispatch-tracking worker
      - example.com/u/* → dispatch-tracking worker
   e. If subdomain option: create DNS CNAME record too
   f. Save tracking config to system_settings
6. Done. Tracking is live immediately.
```

**Routes to add** in `src/routes/admin.ts`:

```
GET    /admin/cloudflare/connect          → redirect to Cloudflare OAuth
GET    /admin/cloudflare/callback         → exchange code, store tokens
GET    /admin/cloudflare/status           → connection status + account info
GET    /admin/cloudflare/zones            → list domains on account
POST   /admin/cloudflare/deploy           → deploy Worker + routes to selected zone
DELETE /admin/cloudflare/undeploy/:zoneId → remove Worker routes from zone
GET    /admin/cloudflare/analytics        → pull tracking stats from D1
```

**Files to modify**:
- `src/routes/admin.ts` — add Cloudflare routes
- `src/config/index.ts` — add `/api/admin/cloudflare/callback` to PUBLIC_PATHS

**Effort**: 4 hours

### 3.4 Tracking Integration with Email Sending

**When sending an email** (both campaign and system), if tracking is configured:

1. Register email in org's D1: `INSERT INTO emails (id, campaign_id, recipient, subject)`
2. Rewrite links: `https://real-url.com` → `https://example.com/c/{linkId}`
3. Inject open pixel: `<img src="https://example.com/o/{emailId}" width="1" height="1" />`
4. Set List-Unsubscribe header: `<https://example.com/u/{emailId}>`

**This replaces** the current `TRACKING_WORKER_URL` approach. Instead of a central tracking worker, each org has their own Worker on their own domain.

**New file**: `src/services/trackingService.ts`

```typescript
class TrackingService {
  // Register an email for tracking, get back tracking URLs
  async registerEmail(orgId: string, options: {
    campaignId: string
    recipient: string
    subject: string
    links: string[] // original URLs in the email HTML
  }): Promise<{
    emailId: string
    pixelUrl: string
    unsubUrl: string
    linkMap: Record<string, string> // original → tracking URL
  }>

  // Pull analytics from org's D1
  async getStats(orgId: string, campaignId: string): Promise<{
    opens: number
    uniqueOpens: number
    clicks: number
    uniqueClicks: number
    unsubscribes: number
    topLinks: { url: string; clicks: number }[]
  }>
}
```

**Files to create**:
- `src/services/trackingService.ts`

**Files to modify**:
- `src/services/emailService.ts` — use trackingService instead of d1Service
- `src/services/systemMailerService.ts` — optionally inject tracking for system emails

**Effort**: 3 hours

---

## Phase 4: Frontend — Setup Wizard UI (Day 2 Afternoon)

### 4.1 Enhanced Platform Settings Page

Update `frontend/src/views/admin/PlatformSettingsPage.vue` with a wizard flow:

**Wizard steps shown at top**:
```
[1. System Mailer ✓] → [2. OAuth ✓] → [3. Tracking ○] → [4. Ready!]
```

**Step 3 — Tracking Setup (New Section)**:

```
┌──────────────────────────────────────────────────────────────┐
│  📡 Email Tracking                                           │
│                                                              │
│  Track opens, clicks, and unsubscribes using your own domain │
│  with a Cloudflare Worker. First-party tracking bypasses     │
│  ad blockers and privacy filters.                            │
│                                                              │
│  [Connect Cloudflare Account]                                │
│  ─── OR ───                                                  │
│  Status: ✅ Connected (account: Acme Corp)                    │
│                                                              │
│  Your Domains:                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ☑ example.com      [Same domain ▾]  Status: Deployed  │  │
│  │ ☐ mysite.io        [Subdomain ▾]    Status: —         │  │
│  │ ☐ store.co         [Same domain ▾]  Status: —         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Deploy Workers]  [Remove All]                              │
│                                                              │
│  Live Stats (last 24h):                                      │
│  Opens: 1,247  |  Clicks: 389  |  Unsubs: 12                │
└──────────────────────────────────────────────────────────────┘
```

**Frontend API additions** in `frontend/src/lib/api/admin.ts`:

```typescript
// Cloudflare integration
cloudflareConnect: () => Promise<string> // returns auth URL
cloudflareStatus: () => Promise<{ connected: boolean; account?: string; zones?: Zone[] }>
cloudflareDeploy: (zoneId: string, options: DeployOptions) => Promise<void>
cloudflareUndeploy: (zoneId: string) => Promise<void>
cloudflareAnalytics: () => Promise<TrackingStats>
```

**Effort**: 3 hours

### 4.2 Setup Status Dashboard

At the top of Platform Settings, show a card summarizing setup status:

```
┌──────────────────────────────────────────────────────────────┐
│  Platform Setup                                              │
│                                                              │
│  ✅ System Mailer — SendGrid configured                       │
│  ✅ OAuth Credentials — Google + Microsoft configured          │
│  ⚠️  Email Tracking — Not configured                          │
│  ✅ Webhook Auto-Registration — Active (SendGrid)              │
│                                                              │
│  System health: 3/4 complete                                 │
└──────────────────────────────────────────────────────────────┘
```

**Effort**: 1 hour

---

## Phase 5: Org-Level Tracking Config (Day 2 Evening)

### 5.1 Per-Org Tracking Domains

Each org needs its own tracking domain configuration. When an org admin connects their Cloudflare:

**DB migration**: `005_tracking_config.ts`

```sql
CREATE TABLE tracking_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  d1_database_id TEXT NOT NULL,
  open_path TEXT DEFAULT 'o',
  click_path TEXT DEFAULT 'c',
  unsub_path TEXT DEFAULT 'u',
  use_subdomain INTEGER DEFAULT 0,
  subdomain TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  deployed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(org_id, domain)
);
```

### 5.2 Org Admin Tracking UI

In org settings (not platform settings), each org admin can:
1. Connect their Cloudflare account (OAuth)
2. Select domains from their account
3. Deploy/undeploy tracking Workers
4. View tracking analytics per domain

**New component**: `frontend/src/views/settings/TrackingSettingsPage.vue`

**New route**: `/settings/tracking`

**Effort**: 3 hours

---

## Summary: File Changes

### New Files (10)

| File | Purpose |
|------|---------|
| `src/services/webhookRegistrationService.ts` | Auto-register bounce webhooks with provider APIs |
| `src/middleware/webhookSignature.ts` | Verify inbound webhook signatures |
| `src/services/cloudflareService.ts` | Cloudflare OAuth + API (deploy Workers, manage routes, D1) |
| `src/services/trackingService.ts` | Register emails for tracking, pull analytics from D1 |
| `src/templates/tracking-worker.ts` | Worker script template for org deployment |
| `src/templates/tracking-schema.sql` | D1 schema for tracking database |
| `src/db/migrations/005_tracking_config.ts` | Tracking config table per org |
| `frontend/src/views/settings/TrackingSettingsPage.vue` | Org-level tracking setup UI |
| `frontend/src/lib/api/cloudflare.ts` | Frontend Cloudflare API methods |
| `frontend/src/components/admin/SetupWizardStatus.vue` | Setup progress indicator component |

### Modified Files (8)

| File | Change |
|------|--------|
| `src/services/bounceProcessor.ts` | Add `parsePostmark()` + `parseSparkPost()` parsers |
| `src/routes/webhooks.ts` | Add Postmark + SparkPost endpoints, signature verification, SNS auto-confirm |
| `src/routes/admin.ts` | Add Cloudflare OAuth + deploy routes, call auto-webhook on mailer save |
| `src/config/index.ts` | Add Cloudflare callback to PUBLIC_PATHS |
| `src/services/emailService.ts` | Use trackingService for link rewriting + pixel injection |
| `frontend/src/views/admin/PlatformSettingsPage.vue` | Add tracking section, wizard steps, setup status |
| `frontend/src/lib/api/admin.ts` | Add Cloudflare + webhook registration API methods |
| `frontend/src/router/index.ts` | Add `/settings/tracking` route |

---

## Execution Order

```
Day 1 Morning (3-4 hours):
├── Phase 1.1: webhookRegistrationService.ts (auto-register webhooks)
├── Phase 1.2: Postmark bounce parser + route
└── Phase 1.3: SparkPost bounce parser + route

Day 1 Afternoon (2 hours):
└── Phase 2: Webhook signature verification middleware + apply to all routes

Day 1 Evening (5 hours):
├── Phase 3.1: cloudflareService.ts (OAuth + API)
├── Phase 3.2: tracking-worker.ts template
└── Phase 3.3: Deployment flow (routes in admin.ts)

Day 2 Morning (3 hours):
├── Phase 3.4: trackingService.ts (register emails, pull analytics)
└── Wire into emailService.ts

Day 2 Afternoon (4 hours):
├── Phase 4.1: Update PlatformSettingsPage.vue (tracking section + wizard)
├── Phase 4.2: Setup status dashboard component
└── Frontend Cloudflare API

Day 2 Evening (3 hours):
├── Phase 5.1: tracking_configs DB migration
├── Phase 5.2: Org-level TrackingSettingsPage.vue
└── Testing + verify end-to-end flow
```

**Total effort**: ~20 hours across 2 days

---

## .env After This (Platform Admin's Dream)

```bash
# That's it. Everything else is configured via Platform Admin UI.
PORT=5500
SESSION_SECRET=your-secret-here
FRONTEND_URL=http://localhost:5173
BASE_URL=http://localhost:5500
```

Everything else — OAuth credentials, system mailer, tracking config, webhook URLs — is managed through the UI and stored in `system_settings`.

---

## Architecture Diagram

```
                    ┌─────────────────────────┐
                    │   Platform Admin UI       │
                    │   /admin/platform-settings │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │   Backend (Bun + Hono)    │
                    │                          │
                    │  system_settings table    │◄── OAuth creds, mailer config
                    │  webhookRegistration      │──► Auto-register webhooks
                    │  cloudflareService        │──► Deploy Workers via API
                    │  trackingService          │──► Register emails in D1
                    │  systemMailerService      │──► Send via 8 providers
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────────┐
              │                │                    │
     ┌────────▼──────┐  ┌─────▼──────┐  ┌─────────▼────────┐
     │ Email Provider │  │ Cloudflare │  │ Bounce Webhooks  │
     │ APIs           │  │ Workers    │  │ (inbound)        │
     │                │  │            │  │                  │
     │ SES            │  │ org1.com   │  │ /bounce/ses      │
     │ SendGrid       │  │  /o/* open │  │ /bounce/sendgrid │
     │ Mailgun        │  │  /c/* click│  │ /bounce/mailgun  │
     │ Postmark       │  │  /u/* unsub│  │ /bounce/postmark │
     │ SparkPost      │  │            │  │ /bounce/sparkpost│
     │ Gmail OAuth    │  │ D1 database│  │                  │
     │ Outlook OAuth  │  │ (tracking) │  │ Signature verify │
     │ SMTP           │  │            │  │ Auto-suppression │
     └────────────────┘  └────────────┘  └──────────────────┘
```
