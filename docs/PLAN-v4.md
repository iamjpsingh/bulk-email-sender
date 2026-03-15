# Dispatch v4.0 — Implementation Plan

## Overview

Complete email marketing platform with n8n-style visual automation, multi-provider API transports (SES/Mailgun/SendGrid), universal form connector, dynamic content, and landing pages. Inspired by Mautic + HubSpot, built for self-hosting.

**Current state**: 28 features (v3.0)
**Target state**: 55+ features (v4.0)
**Stack**: Same — Bun + Hono + Vue 3 + Cloudflare Workers. No new infrastructure.

---

## Phase 0: Critical Bug Fixes (Day 1)

### 0.1 SQL Injection in Dynamic ORDER BY
- **Files**: `contactService.ts:282`, `campaignService.ts`, `templateService.ts`
- **Fix**: Whitelist allowed column names in a const array, reject anything not in list
- **Effort**: 1 hour

### 0.2 CSRF Bypass Path Mismatch
- **File**: `src/middleware/csrf.ts:56`
- **Fix**: Change `/track/` to `/api/track/` and `/webhooks/incoming` to `/api/webhooks/`
- **Effort**: 15 minutes

### 0.3 Remove Dead Code
- **File**: `src/services/emailService.ts:29-101` — delete commented-out method
- **Effort**: 5 minutes

### 0.4 Secure ID Generation
- **Files**: All services using `Date.now() + Math.random()`
- **Fix**: Create `src/utils/id.ts` with `generateId(prefix)` using `crypto.randomUUID()`
- **Effort**: 1 hour

### 0.5 Graceful Shutdown
- **File**: `src/app.ts`
- **Fix**: Listen SIGTERM/SIGINT, stop workers, wait for active jobs to checkpoint, close DBs
- **Effort**: 30 minutes

---

## Phase 1: Multi-Provider API Transports (Week 1)

Goal: Connect SES, Mailgun, SendGrid with just an API key. No complex SMTP config.

### 1.1 Transport Provider Interface
**What**: Abstract email sending behind a common interface.
**Files to create**:
- `src/services/transports/types.ts` — interface definition
- `src/services/transports/smtp.ts` — wrap existing Nodemailer
- `src/services/transports/ses.ts` — AWS SES API (just fetch + SigV4)
- `src/services/transports/mailgun.ts` — Mailgun REST API (just fetch)
- `src/services/transports/sendgrid.ts` — SendGrid REST API (just fetch)
- `src/services/transports/index.ts` — factory: config -> transport

```typescript
// src/services/transports/types.ts
interface EmailTransport {
  name: string
  send(options: {
    from: { name: string; email: string }
    to: string
    subject: string
    html: string
    text?: string
    headers?: Record<string, string>
    replyTo?: string
  }): Promise<{ messageId: string; provider: string }>

  verify(): Promise<boolean>
}
```

**Provider configs** (what user needs to enter):
```
SES:      { accessKeyId, secretAccessKey, region }           → 3 fields
Mailgun:  { apiKey, domain }                                 → 2 fields
SendGrid: { apiKey }                                         → 1 field
SMTP:     { host, port, user, pass, secure }                 → 5 fields (existing)
```

**Files to change**:
- `src/services/emailService.ts` — use transport interface instead of raw Nodemailer
- `src/services/queueWorker.ts` — resolve transport from job config
- `src/routes/config.ts` — add provider_type field, simplify config forms

**Dependencies**: None (all use native fetch, SES signing done manually or with lightweight signer)
**Effort**: 3 days

### 1.2 Bounce Webhook Processing
**What**: Receive bounce/complaint callbacks from SES, Mailgun, SendGrid.
**Where**: Backend API (public endpoint, no auth needed)

**How each provider works**:
- **SES**: SNS → POST JSON with `notificationType: "Bounce"` or `"Complaint"`
- **Mailgun**: POST form data with `event: "failed"` or `"complained"`
- **SendGrid**: POST JSON array with `event: "bounce"` or `"spamreport"`

**Files to create**:
- `src/services/bounceProcessor.ts` — parse provider payloads, classify, suppress

```typescript
// Unified bounce handler
function processBounce(provider: string, payload: unknown): {
  email: string
  type: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'unsubscribe'
  reason: string
  code?: string
}

// Actions:
// hard_bounce → suppress permanently, emit email_bounced
// soft_bounce → increment counter, suppress after 3
// complaint  → suppress permanently, emit email_unsubscribed
```

**Files to change**:
- `src/routes/webhooks.ts` — add `POST /webhooks/bounce/:provider`
- `src/config/index.ts` — add to PUBLIC_PATHS
- `src/middleware/csrf.ts` — skip CSRF for bounce webhooks
**Effort**: 2 days

### 1.3 Plain-Text Email Fallback
**What**: Auto-generate text version for every HTML email.
**Files to change**: `emailService.ts`, `queueWorker.ts`
**How**: Strip tags, convert links, preserve structure. ~30 lines.
**Effort**: 0.5 day

---

## Phase 2: Deliverability & Compliance (Week 2)

### 2.1 Preference Center / Unsubscribe Page
**What**: Hosted page where contacts manage preferences instead of just unsubscribing.
**Where**: Tracking worker (Cloudflare)

**Routes on tracking worker**:
```
GET  /preferences/:trackingId  → show preference page
POST /preferences/:trackingId  → save preferences
```

**Page shows**:
- Unsubscribe from this campaign only
- Unsubscribe from all marketing emails
- Reduce frequency (weekly/monthly digest only)
- Pause all emails for 30 days
- Reason (optional): "Too many emails", "Not relevant", "Other"

**D1 schema addition**:
```sql
CREATE TABLE email_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  preference TEXT NOT NULL CHECK (preference IN
    ('subscribed', 'campaign_only', 'digest_weekly', 'digest_monthly', 'paused', 'unsubscribed')),
  pause_until TEXT,
  reason TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, email)
);
```

**Files to change**:
- `tracking-worker/src/index.ts` — add preference routes + HTML template
- `tracking-worker/schema.sql` — add table
- `src/services/queueWorker.ts` — update List-Unsubscribe header URL
- `src/services/emailService.ts` — same
**Effort**: 2 days

### 2.2 Email Validation (MX + Syntax + Disposable)
**Files to create**:
- `src/services/emailValidator.ts` — validate() returns { valid, score, issues[] }
- `src/data/disposable-domains.json` — ~3000 known disposable domains

**Integration points**: contactService.importContacts(), queueWorker pre-send check
**Effort**: 1.5 days

### 2.3 Frequency Capping
**What**: Max N emails per contact per time window.
**Config**: per-org setting, default 5/week
**Tracking**: `emails_received_count` + `last_window_start` on contact record
**Queue worker checks before send**: if over limit, skip (log as "frequency_capped")
**Campaigns can be exempt**: `exempt_from_frequency_cap: true`
**Effort**: 1 day

### 2.4 Graymail Suppression
**What**: Auto-suppress contacts with no engagement in last N sends.
**Track**: `sends_since_last_engagement` per contact
**Default threshold**: 11 (same as HubSpot)
**Engagement resets counter**: open or click event
**Queue worker skips**: unless campaign has `include_graymail: true`
**Effort**: 1 day

### 2.5 Spam Content Pre-Scanner
**Files to create**: `src/services/spamScanner.ts`
**Checks**: ALL CAPS subject, excessive !!! or $$$ or FREE, known spam phrases, image-only email, missing text version, missing unsubscribe link
**Returns**: { score: 0-10, warnings: string[], pass: boolean }
**Integration**: send route returns warnings, frontend shows them, user can proceed
**Effort**: 1 day

### 2.6 Email Health Dashboard
**What**: Composite sender reputation score.
**Metrics** (last 30 days):
- Bounce rate (target: < 2%)
- Complaint rate (target: < 0.1%)
- Unsubscribe rate (target: < 0.5%)
- Open rate (benchmark: > 20%)
- Graymail percentage

**Score**: Excellent / Good / Needs Improvement / Poor
**Recommendations**: Actionable text ("Your bounce rate is 3.2% — consider validating your list")
**Endpoint**: `GET /api/analytics/email-health`
**Effort**: 1.5 days

---

## Phase 3: n8n-Style Visual Automation Builder (Week 3-4)

This is the big one. Build a proper visual flow builder.

### 3.1 Expand Node Types
**Current node types**: send_email, wait, condition, update_contact, add_tag, remove_tag, webhook, end

**New node types to add**:

| Node | What It Does | Config |
|------|-------------|--------|
| `trigger` | Entry point — how contacts enter | list_join, tag_added, form_submit, api_call, score_threshold |
| `filter` | Remove contacts that don't match criteria | Same as condition but only has "pass" output |
| `split_test` | A/B split traffic down 2+ paths | percentage per path |
| `delay_until` | Wait until specific date/time or field value | date, or contact field |
| `http_request` | Call any external API | url, method, headers, body template |
| `score_change` | Add/subtract engagement points | amount, reason |
| `move_to_list` | Move contact to different list | target list_id |
| `send_sms` | (future) Send SMS via Twilio | phone field, message template |

**Files to change**:
- `src/services/automationService.ts` — add types, add execution logic per node type
**Effort**: 2 days

### 3.2 Real Condition Evaluation
**Current**: `automationService.ts:441` always takes true branch.
**Fix**: Actually evaluate conditions against contact data.

```typescript
// Condition evaluation engine
function evaluateCondition(
  contact: Contact,
  condition: { field: string; operator: string; value: string }
): boolean {
  const contactValue = getFieldValue(contact, condition.field)

  switch (condition.operator) {
    case 'equals': return contactValue === condition.value
    case 'not_equals': return contactValue !== condition.value
    case 'contains': return String(contactValue).includes(condition.value)
    case 'not_contains': return !String(contactValue).includes(condition.value)
    case 'greater_than': return Number(contactValue) > Number(condition.value)
    case 'less_than': return Number(contactValue) < Number(condition.value)
    case 'exists': return contactValue != null && contactValue !== ''
    case 'not_exists': return contactValue == null || contactValue === ''
    case 'in_segment': return segmentService.isContactInSegment(contact.id, condition.value)
    case 'has_tag': return contact.tags.includes(condition.value)
    case 'score_above': return contact.engagement_score > Number(condition.value)
  }
}
```

**Files to change**:
- `src/services/automationService.ts` — replace hardcoded true branch
- `src/services/contactService.ts` — add `getContactById()`
- `src/services/segmentService.ts` — add `isContactInSegment()`
**Effort**: 1.5 days

### 3.3 Goal-Based Automation Exit
**What**: Auto-unenroll contacts when they achieve a goal.
**Add to automations table**: `goal_condition TEXT` (JSON)
**Check before each step**: if goal met → mark completed, exit_reason = 'goal_achieved'
**Effort**: 0.5 day

### 3.4 Vue Flow Canvas (Frontend)
**What**: Full visual flow builder using @vue-flow/core.
**This is the core UI work.**

**Components to create**:
```
frontend/src/components/automation/
  FlowCanvas.vue          — main canvas wrapper
  FlowToolbar.vue         — toolbar with node palette
  FlowMinimap.vue         — minimap overview
  nodes/
    TriggerNode.vue       — entry point (green)
    SendEmailNode.vue     — email action (blue)
    WaitNode.vue          — delay (gray)
    ConditionNode.vue     — if/else branch (yellow, 2 outputs)
    FilterNode.vue        — pass/block (orange, 1 output)
    SplitTestNode.vue     — A/B split (purple, N outputs)
    ActionNode.vue        — tag/score/update/move (blue)
    WebhookNode.vue       — HTTP call (teal)
    EndNode.vue           — terminal (red)
  panels/
    NodeConfigPanel.vue   — right sidebar to configure selected node
    FlowStatsPanel.vue    — show enrollment/completion counts
```

**UX flow**:
1. User drags node from toolbar onto canvas
2. Connects nodes by dragging from output handle to input handle
3. Clicks node to configure in right panel
4. Condition nodes show two outputs: green (true) / red (false)
5. Split test nodes show N outputs with percentage labels
6. Save button serializes to `flow_json` and sends to API
7. "Activate" button compiles flow to steps and starts automation

**Data flow**:
```
Vue Flow state (nodes + edges)
  → serialize to AutomationFlow JSON
  → POST /api/automations/:id (update flow_json)
  → On activate: backend compileFlowToSteps() → automation_steps table
```

**Dependencies**: `@vue-flow/core`, `@vue-flow/minimap`, `@vue-flow/controls`
**Effort**: 5 days

---

## Phase 4: Universal Form Connector (Week 5)

### 4.1 Form Endpoint Service
**What**: Create form endpoints that any external form can POST to.

**Backend service** (`src/services/formService.ts`):
```typescript
interface FormEndpoint {
  id: string           // frm_xxxxx
  org_id: string
  name: string
  list_id: string      // add submissions to this list
  field_mapping: Record<string, string>  // { "name": "first_name", "email": "email" }
  required_fields: string[]              // ["email"]
  allowed_domains: string[]             // CORS origins, empty = allow all
  redirect_url: string | null           // redirect after submit (for HTML forms)
  actions: FormAction[]                 // what happens on submit
  submission_count: number
  created_at: string
}

type FormAction =
  | { type: 'add_to_list'; listId: string }
  | { type: 'add_tag'; tag: string }
  | { type: 'enroll_automation'; automationId: string }
  | { type: 'send_email'; templateId: string }
  | { type: 'webhook'; url: string }
  | { type: 'update_score'; amount: number }
```

**Backend routes** (`src/routes/forms.ts`):
```
POST   /api/forms              → create form endpoint
GET    /api/forms              → list form endpoints
GET    /api/forms/:id          → get form endpoint + embed code
PUT    /api/forms/:id          → update form endpoint
DELETE /api/forms/:id          → delete form endpoint
GET    /api/forms/:id/submissions → list submissions (paginated)
```

**Effort**: 2 days

### 4.2 Form Submission Handler (Tracking Worker)
**What**: Receive form submissions from any website.

**Tracking worker routes**:
```
POST /f/:formId              → receive submission (JSON or form-data)
GET  /f/:formId/config       → return field config (for JS-powered forms)
GET  /f/:formId.js           → embeddable JS that creates a basic form
OPTIONS /f/:formId           → CORS preflight
```

**Submission flow**:
```
External form POSTs to /f/frm_abc123
  → Worker validates required fields
  → Worker calls backend API to:
     - Create/update contact
     - Execute configured actions (add to list, tag, automation)
  → Worker returns:
     - JSON: { success: true, message: "Thanks!" }
     - OR redirects to redirect_url (for HTML forms)
  → Worker logs submission in D1
```

**CORS**: Check `allowed_domains` from form config. If empty, allow all.

**Embed code options** (shown in form detail page):
```html
<!-- Option 1: HTML form (simplest) -->
<form action="https://track.dispatch.app/f/frm_abc123" method="POST">
  <input name="email" required />
  <input name="name" />
  <button type="submit">Subscribe</button>
</form>

<!-- Option 2: JavaScript (async, no page reload) -->
<script src="https://track.dispatch.app/f/frm_abc123.js"></script>
<div id="dispatch-form-frm_abc123"></div>

<!-- Option 3: API call (React, Vue, whatever) -->
fetch('https://track.dispatch.app/f/frm_abc123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, name, company })
})
```

**D1 schema**:
```sql
CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  submission_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  contact_id TEXT,
  data_json TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);
```

**Effort**: 2 days

### 4.3 Form Embed UI (Frontend)
**What**: Form management page + embed code generator.
**View**: `frontend/src/views/FormsView.vue`
**Components**:
- Form list with submission counts
- Create/edit form modal (field mapping, actions, domains)
- Embed code tab (shows all 3 embed options with copy buttons)
- Submissions table with contact link
**Effort**: 2 days

---

## Phase 5: Dynamic Content & Landing Pages (Week 6-7)

### 5.1 Dynamic Content Blocks
**What**: Different content shown to different contacts in same email.

**Template syntax**:
```html
{{#smart}}
  {{#when segment "VIP"}}
    <h1>Exclusive VIP offer - 50% off</h1>
  {{/when}}
  {{#when field "country" equals "US"}}
    <h1>Free shipping in the US!</h1>
  {{/when}}
  {{#default}}
    <h1>Check out our latest deals</h1>
  {{/default}}
{{/smart}}
```

**How it works**:
1. Template is saved with smart blocks as-is
2. At send time, `fileService.replacePlaceholders()` evaluates smart blocks per contact
3. First matching `{{#when}}` wins, falls back to `{{#default}}`
4. If no match and no default, block is removed

**In GrapesJS builder**: Any block can be marked "Smart". Opens a rules panel:
- Rule 1: If contact in segment [VIP], show this variant
- Rule 2: If contact field [country] equals [US], show this variant
- Default: show this variant

**Files to change**:
- `src/services/fileService.ts` — add smart block parser + evaluator
- `src/services/segmentService.ts` — add isContactInSegment()
- Frontend: SmartBlockEditor.vue component
**Effort**: 3 days

### 5.2 Landing Page Service
**What**: Simple hosted landing pages with tracking + form embed.

**NOT a full page builder** — template-based pages with content editing.

**Templates** (3-4 built-in):
- Lead capture page (hero + form)
- Webinar registration (details + form + countdown)
- Coming soon (teaser + email capture)
- Thank you / confirmation page

**Architecture**:
```
Backend:
  src/services/landingPageService.ts
  src/routes/pages.ts

  POST /api/pages          → create page
  GET  /api/pages          → list pages
  PUT  /api/pages/:id      → update page
  DELETE /api/pages/:id    → delete page

Tracking Worker:
  GET /p/:slug             → serve page HTML

  Page HTML includes:
  - Tracking pixel (pixel URL from D1)
  - Form embed (if form_id configured)
  - Dynamic content (if contact known via cookie)
  - Meta tags (title, description, OG tags)
```

**Page schema**:
```sql
CREATE TABLE landing_pages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'lead_capture',
  html_content TEXT NOT NULL,
  meta_description TEXT,
  form_id TEXT,
  tracking_enabled INTEGER DEFAULT 1,
  published INTEGER DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Effort**: 3 days

### 5.3 Click Heatmap
**What**: Visual overlay showing which links got clicks.
**Where**: Frontend analytics
**How**: Render email in iframe, overlay colored badges on links using existing `getLinkClicks()` data
**Effort**: 2 days

### 5.4 Contact Activity Timeline
**What**: Chronological view of all contact interactions.
**Endpoint**: `GET /api/contacts/:id/timeline`
**Sources**: sends, opens, clicks, bounces, form submissions, automation events, tag changes, score changes
**Effort**: 2 days

---

## Phase 6: Email Builder & Templates (Week 8-9)

### 6.1 GrapesJS Visual Email Builder
**What**: Proper drag-and-drop email builder replacing Tiptap for email composition.
**Where**: Frontend

**Components**:
```
frontend/src/components/editor/
  EmailBuilder.vue         — GrapesJS wrapper
  BuilderToolbar.vue       — mode toggle (Visual / Code / Preview)
  BlockPalette.vue         — draggable email blocks

Blocks:
  - Header (logo + nav)
  - Hero (image + headline + CTA)
  - Text block
  - Image (with link)
  - Button (CTA)
  - Columns (2-col, 3-col)
  - Divider
  - Social links
  - Footer (address + unsubscribe)
  - Spacer
```

**Key details**:
- Uses `grapesjs-mjml` plugin — edits in MJML, compiles to responsive HTML
- Saved templates store both MJML source and compiled HTML
- Keep existing Tiptap editor as "Simple mode" for quick emails
- Toggle: `[Simple Editor] [Visual Builder] [HTML Code]`

**Dependencies**: `grapesjs`, `grapesjs-mjml`, `grapesjs-preset-newsletter`
**Effort**: 5 days

### 6.2 MJML Template Compilation
**What**: Accept MJML source, compile to responsive HTML.
**Backend**: `POST /api/templates/compile` — takes MJML string, returns HTML
**Package**: `mjml` (add to backend)
**Effort**: 0.5 day

### 6.3 Saved Reusable Sections
**What**: Save email blocks (headers, CTAs, footers) for reuse across templates.
**Table**: `template_sections` in templates.db
**API**: CRUD at `/api/templates/sections`
**GrapesJS**: Loads saved sections as custom blocks in palette
**Effort**: 1.5 days

### 6.4 Email Preview & Test Send
**What**: Preview email as specific contact, send test to self.
**Endpoints**:
- `POST /api/templates/:id/preview` — render with contact data, return HTML
- `POST /api/templates/:id/test-send` — send single test email
**Frontend**: Preview modal with contact dropdown + "Send test" button
**Effort**: 1 day

---

## Phase 7: Advanced Features (Week 10-11)

### 7.1 RSS/Blog Digest Emails
**What**: Auto-send email when RSS feed has new posts.
**Service**: `src/services/rssService.ts`
**How**: Poll RSS URL on interval, detect new items, compile into template, queue send
**No deps**: Parse RSS XML with DOMParser (built into Bun)
**Effort**: 2 days

### 7.2 Contact Merge & Deduplication
**API**: `GET /api/contacts/duplicates`, `POST /api/contacts/merge`
**Logic**: Find same-email across lists, merge keeping newest data, combine tags, sum scores
**Effort**: 1.5 days

### 7.3 Custom Report Builder
**What**: User-defined reports with column selection, filters, date range.
**Backend**: Accept report config, execute against analytics DB, return data
**Security**: Whitelist allowed columns/tables (no raw SQL from user)
**Frontend**: Column picker + filter builder + chart preview
**Effort**: 3 days

### 7.4 Reply Tracking
**What**: Know when contacts reply to your emails.
**How**: Inbound email webhook (SendGrid Inbound Parse / Mailgun Routes)
**Endpoint**: `POST /api/webhooks/inbound/:provider` — receive forwarded replies
**Match**: Reply-To header or In-Reply-To Message-ID → find original campaign
**Effort**: 2 days

### 7.5 A/B Test Auto-Winner
**What**: Automatically declare winner after test period.
**How**: When creating A/B test, set `auto_winner_after_hours` and `winner_metric` (opens/clicks)
**Worker**: Check active A/B tests, if time elapsed → compute winner → send remainder
**Effort**: 1 day

---

## Dependency Graph

```
Phase 0 (Bugs) ──────────────────────────────────────────────────
    |
Phase 1 (Transports) ── Phase 2 (Deliverability)
    |                        |
    └───── Phase 3 (Visual Automation Builder) ──────────────────
                |                    |
          Phase 4 (Forms)    Phase 5 (Dynamic Content + Pages)
                |                    |
                └────── Phase 6 (Email Builder) ─────────────────
                              |
                        Phase 7 (Advanced)
```

Critical path: Phase 0 → 1 → 3 (automation builder is the marquee feature)
Parallel: Phase 2 can run alongside Phase 1. Phase 4, 5, 6 are independent.

---

## Effort Summary

| Phase | Focus | Features | Days |
|-------|-------|----------|------|
| 0 | Bug Fixes | 5 | 0.5 |
| 1 | API Transports + Bounces | 3 | 5.5 |
| 2 | Deliverability & Compliance | 6 | 8 |
| 3 | n8n-Style Automation Builder | 4 | 9 |
| 4 | Universal Form Connector | 3 | 6 |
| 5 | Dynamic Content & Landing Pages | 4 | 10 |
| 6 | Email Builder (GrapesJS) | 4 | 8 |
| 7 | Advanced Features | 5 | 9.5 |
| **TOTAL** | | **34** | **56.5 (~12 weeks)** |

---

## New npm Packages

| Package | Where | Purpose |
|---------|-------|---------|
| `mjml` | backend | MJML → HTML compilation |
| `grapesjs` | frontend | Visual email builder |
| `grapesjs-mjml` | frontend | MJML support for GrapesJS |
| `grapesjs-preset-newsletter` | frontend | Newsletter blocks/components |
| `@vue-flow/core` | frontend | Flow canvas for automation builder |
| `@vue-flow/minimap` | frontend | Minimap for flow canvas |
| `@vue-flow/controls` | frontend | Zoom/fit controls for flow canvas |

**Total: 7 packages (4 frontend, 1 backend, 2 frontend utility)**
**No new infrastructure. No Redis. No Kafka. No Docker.**

---

## New Files Summary

### Backend Services (13 files)
```
src/utils/id.ts                          — secure ID generation
src/services/transports/types.ts         — transport interface
src/services/transports/smtp.ts          — SMTP (refactored)
src/services/transports/ses.ts           — AWS SES API
src/services/transports/mailgun.ts       — Mailgun REST API
src/services/transports/sendgrid.ts      — SendGrid REST API
src/services/transports/index.ts         — transport factory
src/services/bounceProcessor.ts          — bounce webhook parsing
src/services/emailValidator.ts           — MX/syntax/disposable check
src/services/spamScanner.ts              — content risk analysis
src/services/formService.ts              — form endpoint CRUD
src/services/landingPageService.ts       — landing page CRUD
src/services/rssService.ts               — RSS feed polling
```

### Backend Routes (2 files)
```
src/routes/forms.ts                      — form endpoint management
src/routes/pages.ts                      — landing page management
```

### Backend Data (1 file)
```
src/data/disposable-domains.json         — disposable email domain list
```

### Frontend Components (20+ files)
```
frontend/src/components/automation/
  FlowCanvas.vue
  FlowToolbar.vue
  nodes/TriggerNode.vue
  nodes/SendEmailNode.vue
  nodes/WaitNode.vue
  nodes/ConditionNode.vue
  nodes/FilterNode.vue
  nodes/SplitTestNode.vue
  nodes/ActionNode.vue
  nodes/WebhookNode.vue
  nodes/EndNode.vue
  panels/NodeConfigPanel.vue

frontend/src/components/editor/
  EmailBuilder.vue
  SmartBlockEditor.vue

frontend/src/components/analytics/
  ClickHeatmap.vue
  ReportBuilder.vue

frontend/src/components/contacts/
  ContactTimeline.vue

frontend/src/views/
  FormsView.vue
  PagesView.vue
```

---

## What's NOT in Scope (v5.0+)

- AI content generation (LLM-powered)
- SMS channel (Twilio integration)
- Per-contact ML send-time optimization
- Multi-touch revenue attribution
- Anonymous visitor tracking
- Customer journey visualization
- Predictive lead scoring
- Social media integration
- SEO tools
- Video hosting
