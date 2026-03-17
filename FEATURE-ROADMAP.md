# Dispatch — Feature Roadmap

What's built, what's next, and where we're going.

**Last updated**: 2026-03-18
**Current version**: v4.0 (feature-complete)
**Completion**: ~95% of v4.0, starting v4.2 production polish

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

### Templates & Email Builder (8/9)
Template library, Quill editor, template variables, GrapesJS visual builder (13 blocks), MJML compilation, smart content blocks, email preview modes (desktop/tablet/mobile), multi-language variants. **Remaining**: reusable sections UI component (backend done)

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

## What's Remaining (v4.2 — Pick Up Next)

### High Priority — Build Next
| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | **Org unique slug picker** | 2h | Auto-suggest, availability check, UI in OrgSettings |
| 2 | **User unique username** | 2h | `username` column, auto-suggest from email, profile picker |
| 3 | **Sending domain management** | 4h | Add domain → DNS records → verify → create sending emails |
| 4 | **Sending emails per domain** | 3h | Multiple emails per domain, assign to users, admin controls |
| 5 | **Manual/smart server rotation** | 4h | Per-campaign provider selection: smart/manual/round-robin/weighted |
| 6 | **Deep analytics frontend** | 4h | Geo map, device breakdown, email client, referrer charts on campaign detail |
| 7 | **Recipient profile page** | 3h | Full contact engagement view: stats, links, open hours, events |
| 8 | **Campaign builder wizard** | 4h | Step-by-step: Recipients → Content → Sender → Settings → Schedule → Review |
| 9 | **Tooltips on all campaign fields** | 2h | Subject, From, Reply-To, Batch Size, Delay, etc. |
| 10 | **Professional starter templates** | 4h | 10 responsive templates (Welcome, Newsletter, Promo, etc.) |

### Medium Priority
| # | Item | Effort | Notes |
|---|------|--------|-------|
| 11 | **Bounce API polling** | 3h | Backup bounce collection from provider APIs |
| 12 | **Live preview with contact data** | 2h | Select contact, see real placeholder values |
| 13 | **Form webhook receiver** | 2h | Connect Typeform/JotForm/Zapier to forms |
| 14 | **Reusable sections frontend** | 2h | UI to save/browse/insert template sections (backend done) |
| 15 | **Template thumbnail generation** | 2h | Auto-screenshot for template library grid |

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

## Packages Installed

| Package | Where | Purpose |
|---------|-------|---------|
| `@vue-flow/core` | frontend | Visual automation builder |
| `@vue-flow/minimap` | frontend | Automation flow minimap |
| `@vue-flow/controls` | frontend | Automation flow controls |
| `grapesjs` | frontend | Visual email builder |
| `grapesjs-mjml` | frontend | MJML support |
| `grapesjs-preset-newsletter` | frontend | Newsletter blocks |
| `mjml` | backend | MJML → HTML compilation |

**Stack**: Bun, Hono, Vue 3, Tailwind, TanStack Query, Vue Flow, GrapesJS, MJML, Nodemailer, Cloudflare Workers + D1.
