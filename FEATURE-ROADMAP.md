# Dispatch — Feature Roadmap

What's built, what's next, and where we're going.

**Last updated**: 2026-03-24
**Current version**: v4.2 (feature-complete + production polish)
**Frontend**: Vue 3 + shadcn-vue + Tailwind CSS v4

---

## What's Done (v4.0 — Complete)

Everything below is shipped and working.

### Core Platform (16/16)
Bun + Hono backend, Vue 3 + Tailwind frontend, SQLite, session auth, multi-org, RBAC (50+ permissions), platform admin (invisible), teams, invitations, audit logging, password reset, CSRF, security headers, Zod validation, SSE real-time, error handling

### Email Sending (21/21)
8 providers (SMTP, SES, SendGrid, Mailgun, Postmark, SparkPost, Gmail OAuth, Outlook OAuth), batch processing, scheduling, rate limits, plain-text fallback, placeholders, smart content blocks (`{{#smart}}`), queue engine, retry engine, suppression list, frequency capping, graymail suppression, preference center checks, provider routing, email warmup, provider failover

### System Mailer (11/11)
8-provider support, platform settings UI, OAuth credential management, OAuth connect flow, password reset + invitation emails wired, test connection, masked config, setup wizard, dynamic OAuth, `.env` simplified to 4 lines

### Bounce & Complaint (11/11)
5 provider parsers (SES, SendGrid, Mailgun, Postmark, SparkPost), auto-webhook registration, SNS auto-confirm, signature verification (4 methods), hard/soft bounce suppression, complaint auto-unsubscribe

### Email Tracking (14/14)
Open/click/unsubscribe tracking, Cloudflare Worker (OAuth connect, one-click deploy, Worker Routes, subdomain option), D1 analytics, per-org config, tracking settings UI, platform tracking setup, click heatmap, preference center

### Contact Management (16/16)
CRUD, lists, Excel/CSV import, bulk ops, custom fields, tags, engagement scoring, score decay, search/filter, email validation, duplicate detection, contact merge, contact timeline, preferences UI, frequency capping, graymail suppression

### Campaigns (8/8)
Create/edit, detail view with click heatmap, reports, A/B testing + auto-winner, RSS digest, calendar with drag-and-drop rescheduling

### Templates & Email Builder (9/9)
Template library, Quill editor, template variables, GrapesJS visual builder (13 blocks), MJML compilation, smart content blocks, email preview modes (desktop/tablet/mobile), multi-language variants, reusable sections

### Automation (10/10)
CRUD, 7 trigger types, condition evaluation (9 operators), Vue Flow visual editor (15 node types), node config panel, enrollment tracking, background execution, minimap + controls, goal-based exit

### Segmentation (4/4)
Static + dynamic segments, segment rules, AND/OR logic

### Analytics & Reporting (9/9)
Campaign analytics, real-time dashboard, email logs, spam scanner, email health dashboard (0-100 score), click heatmap, device/client breakdown, send time heatmap, custom report builder (column picker + filters + CSV export)

### Forms & Landing Pages (13/13)
Form CRUD + field mapping + actions + embed codes (HTML/JS/API) + public submission + submissions viewer, landing page CRUD + 4 templates + HTML/CSS editor + preview + form embed + visit tracking + SEO meta

### API & Integrations (7/7)
Outgoing webhooks, HMAC signing, API keys (6 scopes, Argon2, expiry), plugin manager, RSS feeds, reply tracking (SendGrid/Mailgun/Postmark inbound)

### Deep Analytics (5/5 backend)
User-Agent parser (browser/OS/device/email client), referral source detection, Tracking Worker captures geo/device/browser at edge, D1 schema with country/city/device/browser/os/email_client/referrer columns, API endpoints for geo/devices/clients/referrers/recipient profile

### Platform Admin Separation (Done)
Sidebar shows only Platform + Settings (no org items), org switcher hidden, router blocks org-scoped routes, redirects to `/admin/platform`

---

## What's Done (v4.2 Session)

| # | Item | Status |
|---|------|--------|
| 1 | Org unique slug picker | Done — `checkSlugAvailability()`, `updateSlug()`, availability + suggestions API |
| 2 | User unique username | Done — `username` column, `checkUsername()`, `setUsername()`, `suggestUsername()`, routes |
| 3 | Sending domain management | Done — `sending_domains` table, add/verify/delete, DNS records generation |
| 4 | Sending emails per domain | Done — `sending_emails` table, add/update/delete, assign to users, list for user |
| 5 | Manual/smart server rotation | Done — `rotation_config` on campaigns, 4 modes: smart/manual/round_robin/weighted |
| 6 | Bounce API polling | Done — `bouncePollingService.ts`, polls SendGrid/Mailgun/Postmark/SparkPost APIs |
| 7 | Form webhook receiver | Done — `POST /forms/:id/webhook`, supports Typeform/JotForm/Zapier/flat JSON |

## All v4.2 Items Complete

| # | Item | Status |
|---|------|--------|
| 1 | Deep analytics frontend | Done — CampaignBreakdown.vue (devices/browsers/OS, email clients, referral sources) |
| 2 | Recipient profile page | Done — RecipientProfile.vue (stats, open hours, top links, recent events, tags) |
| 3 | Campaign builder wizard | Done — Already existed (4-step wizard in ComposeView) |
| 4 | Tooltips on campaign fields | Done — Already had InfoTips on all 10+ fields |
| 5 | Professional starter templates | Done — 10 templates (Welcome, Newsletter, Promo, Follow-up, Announcement, Event, Re-engagement, Product Update, Survey, Plain Text) |
| 6 | Live preview with contact data | Done — Already existed in ComposeView |
| 7 | Reusable sections API | Done — Frontend API methods added (list/create/delete/use) |
| 8 | Org slug picker UI | Done — OrgSettings rewritten with slug picker, availability check, suggestions |
| 9 | Username API | Done — Backend + frontend API (profile page TBD) |
| 10 | Domain management UI | Done — DomainsSettings.vue (add domain, DNS records, verify, sending emails) |
| 11 | Rotation config UI | Done — Server rotation selector in ComposeView (smart/round_robin/manual) |

### Future (v5.0)
| # | Item | Notes |
|---|------|-------|
| 16 | RFM segmentation | Recency/Frequency/Monetary scoring |
| 17 | Behavioral cohorts | Group contacts by engagement patterns |
| 18 | CLI tool | `dispatch send`, `dispatch contacts import` |
| 19 | WhatsApp full wiring | Connect existing service (509 lines) to Twilio |
| 20 | Docker deployment | Containerized self-hosting |
| 21 | Horizontal scaling | Multi-instance with shared DB |

---

## Stack

**Backend**: Bun, Hono, Nodemailer, bun:sqlite, MJML, Cloudflare Workers + D1
**Frontend**: Vue 3, Tailwind CSS v4, shadcn-vue, TanStack Vue Query, Vue Flow, GrapesJS, Lucide Icons
