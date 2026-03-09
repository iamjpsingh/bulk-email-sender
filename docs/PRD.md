# Dispatch v3.0 — Product Requirements Document

## Project Overview

**Dispatch** is an open-source email marketing and automation platform. Self-hosted, privacy-first, developer-friendly. Send bulk campaigns, automate email sequences, manage contacts, score engagement, and track everything — without paying for Mailchimp, SendGrid, or HubSpot.

**License**: MIT (Open Source)
**Stack**: Bun + Hono + Vue 3 + Cloudflare D1/Workers

---

## Problem Statement

Open-source email tools fall into two camps:
- **Too simple**: Send emails, no tracking, no automation, no contact management
- **Too complex**: Require Kafka, Redis, PostgreSQL, Docker Compose with 10 services

Dispatch is the middle ground — a single binary with everything built-in.

**v2.0 limitations**:
- In-memory batch state (lost on restart)
- No contact management (upload Excel every time)
- No email templates (recreate from scratch)
- No campaign lifecycle (create → test → send → analyze)
- No automation (drip sequences, follow-ups)
- No engagement scoring
- No bounce/unsubscribe handling
- No deliverability tools
- Basic analytics, no real-time updates

---

## Goals

1. **Complete campaign lifecycle** — Create, design, test, schedule, send, analyze
2. **Contact management** — Import, segment, score, suppress
3. **Template system** — Design once, reuse everywhere
4. **Marketing automation** — Drip sequences, trigger-based emails, follow-ups
5. **Engagement scoring** — Score contacts based on opens, clicks, replies
6. **Reliable delivery** — Persistent queue, retry, bounce handling, validation
7. **Real-time analytics** — SSE-powered live dashboard
8. **Extensible** — Plugin system for providers and hooks
9. **Compliance** — Unsubscribe, GDPR consent tracking

---

## Target Users

- **Developers** — Self-host, integrate via API, extend with plugins
- **Small teams/startups** — Full email marketing without SaaS costs
- **Freelancers** — Client campaigns with full control and white-label
- **Open-source projects** — Announcements, release emails, community newsletters
- **Agencies** — Multi-client campaign management

---

## Feature Requirements

### P0 — Must Have (Phase 1: Foundation)

#### 1. Persistent Job Queue
- SQLite-backed job queue replacing in-memory batch state
- Job states: pending, running, paused, completed, failed, cancelled
- Automatic recovery on server restart (resume from last checkpoint)
- Dead letter queue for permanently failed emails
- Priority levels (1-10) for urgent campaigns
- Concurrent job support (multiple campaigns at once)

#### 2. Contact Management & Import
- **Persistent contact lists** stored in D1
- **Multi-format import**: CSV, Excel (.xlsx/.xls), JSON, copy-paste
- **Field mapping UI**: Map imported columns to contact fields (drag-and-drop)
- **Smart duplicate detection**: Merge or skip duplicates on import
- **Contact fields**: Email, first name, last name, company, phone, tags, custom fields (unlimited key-value)
- **Contact status**: Active, unsubscribed, bounced, complained
- **Bulk operations**: Delete, tag, move between lists, export
- **Import history**: Track what was imported, when, how many
- **Auto-validation on import**: Syntax check, MX verify, disposable detection

#### 3. Email Validation & Scoring
- **Pre-send validation**: MX record check, syntax (RFC 5322), disposable domain detection
- **Contact health score** (0-100):
  - Valid email syntax: +20
  - MX record exists: +20
  - Not disposable: +15
  - Not in suppression list: +15
  - Has engagement history (opened/clicked before): +30
- **List hygiene report**: Show breakdown before sending (valid/invalid/risky/suppressed)
- **Auto-clean**: Option to remove invalid contacts before campaign

#### 4. Bounce & Unsubscribe Handling
- SMTP response code parsing (hard bounce 5xx, soft bounce 4xx)
- Automatic suppression list (bounced + unsubscribed + complained)
- List-Unsubscribe header (RFC 8058 one-click)
- List-Unsubscribe-Post header
- Hosted unsubscribe confirmation page (Cloudflare Worker)
- Unsubscribe reason collection (optional survey)
- Suppression list management UI (view, search, remove, export)

#### 5. Retry & Error Handling
- Exponential backoff with jitter
- Error classification: rate_limit, temporary, permanent, network
- Configurable max retries per error type
- Automatic provider failover
- Dead letter queue with manual retry option

#### 6. Improved Tracking & Real-Time Updates
- Open tracking (pixel), click tracking (link redirect) — already exists
- Bounce event tracking (new)
- Unsubscribe event tracking (new)
- **Server-Sent Events (SSE)** for live dashboard updates
- Campaign-level real-time stats (sent/failed/opened/clicked as they happen)
- Event bus for internal pub/sub

#### 7. Compliance Headers
- List-Unsubscribe + List-Unsubscribe-Post on every email
- Precedence: bulk header
- Feedback-ID for Google Postmaster Tools
- Auto-add physical address footer (configurable)

### P1 — Should Have (Phase 2: Marketing Features)

#### 8. HTML Template Management
- **Template library**: Save, organize, duplicate, version templates
- **Template categories**: Newsletter, Promotional, Transactional, Welcome, Follow-up
- **Code editor**: Raw HTML editing with syntax highlighting and live preview
- **Responsive preview**: Desktop, tablet, mobile views
- **Template variables**: `{{FirstName}}`, `{{Company}}`, `{{UnsubscribeLink}}`, `{{TrackingPixel}}`, custom variables
- **Starter templates**: 10-15 pre-built responsive HTML templates
- **Import/Export**: HTML file, ZIP with images, JSON template format
- **Template thumbnails**: Auto-generated preview screenshots
- **Template sharing**: Share templates between users (same instance)

#### 9. Campaign Management
- **Campaign lifecycle**: Draft → Test → Scheduled → Sending → Completed → Archived
- **Campaign types**: One-time, Recurring, A/B Test, Automation sequence
- **Campaign builder wizard**:
  1. Select recipients (list, segment, or manual)
  2. Choose/create template
  3. Configure sender (from name, email, reply-to)
  4. Set schedule (now, later, recurring)
  5. Preview & test (send test email)
  6. Review & launch
- **Campaign cloning**: Duplicate entire campaign with one click
- **Campaign tags/folders**: Organize campaigns
- **Campaign comparison**: Side-by-side metrics for 2+ campaigns
- **Draft auto-save**: Save progress every 30 seconds
- **Send test email**: Preview in real inbox before launching

#### 10. Email Marketing Automation
- **Drip sequences**: Multi-step email series with delays
  - Step 1: Welcome email (immediately)
  - Step 2: Feature guide (Day 3)
  - Step 3: Case study (Day 7)
  - Step 4: Offer (Day 14)
- **Trigger types**:
  - Time-based: Send after X days/hours
  - Event-based: Send when opened, clicked, not opened
  - Date-based: Send on birthday, anniversary, custom date field
- **Automation builder**: Visual flowchart editor
  - Nodes: Send email, Wait, Condition (if/else), Split (A/B)
  - Conditions: Opened email? Clicked link? Tag matches? Score above X?
- **Automation states**: Draft, Active, Paused, Completed
- **Exit conditions**: Contact unsubscribes, reaches end, meets goal
- **Automation analytics**: Funnel view showing drop-off at each step

#### 11. Engagement Scoring
- **Contact engagement score** (0-100, auto-calculated):
  - Email opened: +5 per open (max +20)
  - Link clicked: +10 per click (max +30)
  - Replied (if detectable): +20
  - Unsubscribed: -100 (removed)
  - Bounced: -100 (removed)
  - No engagement in 30 days: -10
  - No engagement in 90 days: -30
- **Score decay**: Scores decrease over time without engagement
- **Segments by score**: Hot (80-100), Warm (50-79), Cold (20-49), Dead (0-19)
- **Re-engagement trigger**: Auto-send re-engagement email when score drops below threshold
- **Score visible**: In contact list, campaign reports, automation conditions
- **Manual score adjustment**: Admins can boost/lower scores

#### 12. A/B Testing
- **Test variables**: Subject line, sender name, email content, send time
- **Variant count**: 2-5 variants per test
- **Test sample**: Configurable % of list (default 20%)
- **Winner criteria**: Open rate, click rate, or click-to-open rate
- **Auto-send winner**: After test duration (1h-72h), send winner to remaining list
- **Statistical confidence**: Show confidence level before declaring winner
- **A/B test report**: Full comparison with charts

#### 13. Contact Segmentation
- **Static segments**: Manually add/remove contacts
- **Dynamic segments**: Auto-update based on rules
  - Rules: Tag is X, Score above Y, Opened campaign Z, Imported from list W, Custom field equals V
  - Combine with AND/OR logic
- **Segment size preview**: Show count before saving
- **Use segments in**: Campaign recipients, automation entry, reports filter

#### 14. Webhook System
- Outgoing webhooks for events: sent, opened, clicked, bounced, unsubscribed, complained
- Webhook management UI (create, test, enable/disable, view logs)
- Retry failed deliveries (3 attempts with backoff)
- HMAC signature verification
- Webhook payload format: JSON with event type, timestamp, contact, campaign

#### 15. API Key Authentication
- Generate named API keys with scoped permissions
- Scopes: read, send, contacts, campaigns, admin
- Rate limiting per key
- Key rotation (create new → deprecate old)
- API key management UI

### P2 — Nice to Have (Phase 3: Intelligence & Scale)

#### 16. Smart Provider Routing
- Score-based provider selection: quota remaining (40%), success rate (35%), speed (15%), cost (10%)
- Auto-failover when provider returns errors
- Per-provider daily sending stats
- Provider health dashboard

#### 17. Email Warmup
- Gradual volume ramp for new sender domains/IPs
- Configurable warmup schedule (e.g., Day 1: 50 emails, Day 2: 100, ...)
- Auto-enable warmup mode for new SMTP configs
- Warmup progress tracker

#### 18. Campaign Calendar
- Visual month/week/day calendar view
- Drag-and-drop rescheduling
- Conflict detection (overlapping campaigns to same list)
- Color-coded by campaign type or status

#### 19. Advanced Analytics
- **Campaign reports**: Delivery rate, open rate, click rate, bounce rate, unsubscribe rate
- **Link-level click map**: Which links get clicked most
- **Geographic heatmap**: Open/click locations (from Cloudflare headers)
- **Device/client breakdown**: Gmail vs Outlook vs Apple Mail, mobile vs desktop
- **Time analysis**: Best send time based on open patterns
- **Exportable reports**: CSV, JSON
- **Dashboard widgets**: Customizable dashboard

#### 20. Plugin System
- Provider plugins: Add Amazon SES, SendGrid, Postmark, etc.
- Hook plugins: pre_send, post_send, on_bounce, on_open, on_click
- Template plugins: Custom template engines
- Plugin manifest (JSON), lifecycle management, settings UI

#### 21. CLI Tool
- `dispatch send --template=welcome --list=customers`
- `dispatch contacts import file.csv --list=my-list`
- `dispatch campaign status abc123`
- `dispatch templates list`
- Pipe support: `cat emails.csv | dispatch send`

#### 22. Multi-Language Email
- Template variants per language (en, es, fr, etc.)
- Contact language field
- Auto-select template variant based on contact language
- Fallback to default language

---

## Non-Functional Requirements

### Performance
- Send rate: 100+ emails/minute (provider permitting)
- Dashboard load: < 2 seconds
- Tracking pixel response: < 50ms (edge-deployed)
- Job queue operations: < 10ms
- Contact import: 10K contacts in < 5 seconds
- Template save/load: < 500ms

### Reliability
- Zero email loss on server restart
- Graceful degradation if tracking worker is down
- Automatic job recovery within 30s of restart
- Automation sequences survive restarts

### Security
- Argon2 password hashing (already done)
- API keys hashed at rest
- Webhook HMAC signatures
- Input sanitization on all endpoints
- Rate limiting on auth + send endpoints
- CSRF protection on mutation endpoints

### Scalability
- 100K+ contacts per list
- 10+ concurrent campaigns
- 50+ automation sequences active
- 1000+ templates stored
- D1 optimized with proper indexes

---

## Success Metrics

| Metric | v2 (Current) | v3 Target |
|--------|-------------|-----------|
| Job recovery on restart | 0% | 100% |
| Contact management | None (upload every time) | Full CRM-lite |
| Templates | None | Library with builder |
| Automation | None | Drip sequences + triggers |
| Engagement scoring | None | 0-100 auto-calculated |
| Bounce detection | None | Automatic |
| Unsubscribe compliance | None | RFC 8058 one-click |
| Real-time tracking | Polling | SSE live |
| A/B testing | None | Up to 5 variants |
| Max contacts/campaign | ~10K | 100K+ |
| API access | Session only | API keys + session |

---

## Out of Scope

- Full ESP (no shared IP pools, no ISP relationship management)
- Drag-and-drop visual email builder (we provide HTML code editor + Quill WYSIWYG + starter templates)
- PDF report export (CSV/JSON only — open source, keep it simple)
- SMS/push/WhatsApp channels
- Multi-tenant SaaS hosting with billing
- CRM with deals/pipelines (we're email-focused, not a full CRM)
- Landing page builder

---

## Rollout Plan

| Phase | Features | Focus |
|-------|----------|-------|
| **Phase 1** | Persistent queue, contact management, email validation, bounce/unsubscribe, retry engine, compliance headers, SSE real-time | Foundation & Reliability |
| **Phase 2** | Template management, campaign management, automation, engagement scoring, A/B testing, segmentation, webhooks, API keys | Marketing Features |
| **Phase 3** | Smart routing, warmup, calendar, advanced analytics, plugins, CLI, multi-language | Intelligence & Scale |
