# Dispatch — Product Requirements Document

## Project Overview

**Dispatch** is an open-source email marketing and automation platform. Self-hosted, privacy-first, developer-friendly. Send bulk campaigns, automate email sequences, manage contacts, score engagement, and track everything — without paying for Mailchimp, SendGrid, or HubSpot.

**License**: MIT (Open Source)
**Stack**: Bun + Hono + Vue 3 + Tailwind CSS + shadcn-vue + Cloudflare D1/Workers

---

## Problem Statement

Open-source email tools fall into two camps:
- **Too simple**: Send emails, no tracking, no automation, no contact management
- **Too complex**: Require Kafka, Redis, PostgreSQL, Docker Compose with 10 services

Dispatch is the middle ground — a single binary with everything built-in.

---

## Target Users

- **Developers** — Self-host, integrate via API, extend with plugins
- **Small teams/startups** — Full email marketing without SaaS costs
- **Freelancers** — Client campaigns with full control and white-label
- **Open-source projects** — Announcements, release emails, community newsletters
- **Agencies** — Multi-client campaign management

---

## Features

### 1. Persistent Job Queue
- SQLite-backed job queue
- Job states: pending, running, paused, completed, failed, cancelled
- Automatic recovery on server restart (resume from last checkpoint)
- Dead letter queue for permanently failed emails
- Priority levels (1-10) for urgent campaigns
- Concurrent job support (multiple campaigns at once)

### 2. Contact Management & Import
- Persistent contact lists stored in SQLite
- Multi-format import: CSV, Excel (.xlsx/.xls), JSON, copy-paste
- Field mapping UI: Map imported columns to contact fields
- Smart duplicate detection: Merge or skip duplicates on import
- Contact fields: Email, first name, last name, company, phone, tags, custom fields (unlimited key-value)
- Contact status: Active, unsubscribed, bounced, complained
- Bulk operations: Delete, tag, move between lists, export
- Import history: Track what was imported, when, how many
- Auto-validation on import: Syntax check, MX verify, disposable detection

### 3. Email Validation & Scoring
- Pre-send validation: MX record check, syntax (RFC 5322), disposable domain detection
- Contact health score (0-100) based on email validity, engagement history, suppression status
- List hygiene report: Breakdown before sending (valid/invalid/risky/suppressed)
- Auto-clean: Option to remove invalid contacts before campaign

### 4. Bounce & Unsubscribe Handling
- 5 provider parsers (SES, SendGrid, Mailgun, Postmark, SparkPost)
- Auto-webhook registration and SNS auto-confirm
- Signature verification (4 methods)
- Hard/soft bounce suppression, complaint auto-unsubscribe
- List-Unsubscribe header (RFC 8058 one-click) + List-Unsubscribe-Post
- Hosted unsubscribe confirmation page (Cloudflare Worker)
- Suppression list management UI (view, search, remove, export)

### 5. Retry & Error Handling
- Exponential backoff with jitter
- Error classification: rate_limit, temporary, permanent, network
- Configurable max retries per error type
- Automatic provider failover
- Dead letter queue with manual retry option

### 6. Tracking & Real-Time Updates
- Open tracking (pixel), click tracking (link redirect), unsubscribe tracking
- Cloudflare Worker with OAuth connect, one-click deploy, Worker Routes
- D1 analytics with geo/device/browser/email client data
- Server-Sent Events (SSE) for live dashboard updates
- Campaign-level real-time stats (sent/failed/opened/clicked as they happen)

### 7. Compliance Headers
- List-Unsubscribe + List-Unsubscribe-Post on every email
- Precedence: bulk header
- Feedback-ID for Google Postmaster Tools
- Auto-add physical address footer (configurable)

### 8. HTML Template Management
- Template library: Save, organize, duplicate, version templates
- Template categories: Newsletter, Promotional, Transactional, Welcome, Follow-up
- GrapesJS visual drag-and-drop builder (13 blocks)
- MJML compilation
- Responsive preview: Desktop, tablet, mobile views
- Template variables: `{{FirstName}}`, `{{Company}}`, `{{UnsubscribeLink}}`, custom variables
- Smart content blocks (`{{#smart}}`)
- 10 pre-built starter templates
- Multi-language template variants

### 9. Campaign Management
- Campaign lifecycle: Draft → Test → Scheduled → Sending → Completed → Archived
- Campaign types: One-time, Recurring, A/B Test, RSS Digest
- 4-step campaign builder wizard (recipients → template → sender → schedule)
- Campaign cloning, tags, detail view with click heatmap
- Calendar with drag-and-drop rescheduling
- Server rotation: smart, round_robin, manual, weighted modes

### 10. Email Marketing Automation
- Visual flowchart editor (Vue Flow) with 15 node types
- 7 trigger types: list join, tag added, score change, date field, form submit, manual, API
- Condition evaluation with 9 operators
- Node config panel, enrollment tracking, background execution
- Goal-based exit conditions
- Minimap + controls

### 11. Engagement Scoring
- Contact engagement score (0-100, auto-calculated)
- Score rules: opens, clicks, replies, bounces, complaints, inactivity decay
- Segments by score: Hot, Warm, Cold, Dead
- Re-engagement triggers
- Score visible in contact list, campaign reports, automation conditions
- Manual score adjustment

### 12. A/B Testing
- Test variables: Subject line, sender name, email content, send time
- 2-5 variants per test with configurable sample size
- Winner criteria: Open rate, click rate, or click-to-open rate
- Auto-send winner after test duration

### 13. Contact Segmentation
- Static + dynamic segments
- Rules with AND/OR logic (tag, score, campaign engagement, custom fields)
- Segment size preview before saving
- Segments usable in campaigns, automations, and reports

### 14. Webhook System
- Outgoing webhooks for events: sent, opened, clicked, bounced, unsubscribed, complained
- Webhook management UI (create, test, enable/disable, view logs)
- HMAC signature verification
- Retry failed deliveries (3 attempts with backoff)

### 15. API Key Authentication
- Named API keys with 6 scoped permissions
- Argon2 hashed at rest, expiry support
- Rate limiting per key
- API key management UI

### 16. Smart Provider Routing
- Score-based provider selection: quota remaining, success rate, speed, cost
- Auto-failover when provider returns errors
- 8 providers: SMTP, SES, SendGrid, Mailgun, Postmark, SparkPost, Gmail OAuth, Outlook OAuth

### 17. Email Warmup
- Gradual volume ramp for new sender domains/IPs
- Configurable warmup schedule
- Warmup progress tracker

### 18. Campaign Calendar
- Visual month/week/day calendar view
- Drag-and-drop rescheduling
- Color-coded by campaign type or status

### 19. Analytics & Reporting
- Campaign analytics: Delivery rate, open rate, click rate, bounce rate, unsubscribe rate
- Click heatmap, device/client breakdown, send time heatmap
- Email health dashboard (0-100 score)
- Custom report builder (column picker + filters + CSV export)
- Spam scanner
- Recipient profile page (stats, open hours, top links, recent events)

### 20. Forms & Landing Pages
- Form CRUD with field mapping, actions, embed codes (HTML/JS/API)
- Public submission endpoint + submissions viewer
- Landing page CRUD with 4 templates
- HTML/CSS editor, preview, form embed, visit tracking, SEO meta

### 21. Multi-Org & RBAC
- Full organization system with org switcher
- Roles: owner, admin, manager, member, readonly
- 50+ granular permissions, role-based baseline + user-level overrides
- Teams, invitations with email delivery
- Audit logging (actor, action, entity, timestamp)

### 22. Platform Admin
- Invisible super-admin (not part of any org)
- System mailer setup (8 providers, OAuth credential management)
- Tracking infrastructure setup (Cloudflare Worker deploy)
- Platform-wide user and organization management
- System settings, monitoring

### 23. Multi-Language Email
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

### Reliability
- Zero email loss on server restart
- Graceful degradation if tracking worker is down
- Automatic job recovery within 30s of restart
- Automation sequences survive restarts

### Security
- Argon2 password hashing
- API keys hashed at rest
- Webhook HMAC signatures
- Input sanitization on all endpoints (Zod validation)
- Rate limiting on auth + send endpoints
- CSRF protection on mutation endpoints
- Security headers

### Scalability
- 100K+ contacts per list
- 10+ concurrent campaigns
- 50+ automation sequences active
- 1000+ templates stored

---

## Out of Scope

- Full ESP (no shared IP pools, no ISP relationship management)
- PDF report export (CSV/JSON only)
- Multi-tenant SaaS hosting with billing
- CRM with deals/pipelines (email-focused, not a full CRM)
