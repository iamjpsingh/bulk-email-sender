# Dispatch — Feature Roadmap

What's built, what's next, and where we're going.

**Last updated**: 2026-03-17
**Current version**: v4.0
**Completion**: ~80% of full v4.0 vision

---

## Status Legend

| Icon | Meaning |
|------|---------|
| Done | Shipped and working |
| Partial | Started, needs completion |
| Planned | Designed, not yet coded |
| Future | On radar, no spec yet |

---

## Core Platform

| Feature | Status | Details |
|---------|--------|---------|
| Bun + Hono backend | Done | Port 5500, SSE support, 73+ validated endpoints |
| Vue 3 + Tailwind frontend | Done | SPA with TanStack Query, Lucide icons |
| SQLite persistence | Done | Bun native SQLite, 5 migrations |
| Session auth (Argon2 + cookies) | Done | Secure cookies, session expiry, cleanup |
| Multi-organization | Done | Org switcher, isolated data per org |
| RBAC (50+ permissions) | Done | owner/admin/manager/member/readonly + user overrides |
| Platform admin (invisible) | Done | System-level super admin, hidden from all orgs |
| Team management | Done | Create teams, assign members, team roles |
| User invitations | Done | Email-based invites with token acceptance |
| Audit logging | Done | Actor, action, entity, timestamp on all admin ops |
| Password reset flow | Done | Token-based reset with email delivery |
| CSRF protection | Done | Token-based, skipped for webhooks/tracking |
| Security headers | Done | Helmet-style headers on all responses |
| Zod validation | Done | All 73 endpoints validated |
| SSE real-time updates | Done | Live campaign progress streaming |
| Graceful error handling | Done | Consistent error responses across API |

---

## Email Sending

| Feature | Status | Details |
|---------|--------|---------|
| SMTP sending (Nodemailer) | Done | Any SMTP server |
| Gmail OAuth sending | Done | Google API with token refresh |
| Outlook OAuth sending | Done | Microsoft Graph API with token refresh |
| Amazon SES (IAM API keys) | Done | HMAC-SHA256 credential derivation, domain-level |
| SendGrid (API) | Done | REST API, domain-level sending |
| Mailgun (API) | Done | REST API, US/EU regions, domain-level |
| Postmark (API) | Done | Server token auth, transactional streams |
| SparkPost (API) | Done | REST API, high-volume sending |
| Batch processing | Done | Configurable batch size, delays, pause/resume/cancel |
| Scheduled campaigns | Done | SQLite-backed job persistence |
| Provider rate limits | Done | Google 500/day, Microsoft 300/day, SMTP 500/day |
| Plain-text fallback | Done | Auto-generated text version from HTML |
| Placeholder replacement | Done | `{{FirstName}}`, `{{Company}}`, any Excel column |
| Queue engine (persistent) | Done | SQLite-backed, survives restart |
| Retry engine | Done | Exponential backoff, error classification |
| Suppression list | Done | Hard bounce / complaint / unsubscribe auto-suppress |
| Frequency capping | Done | Per-org max emails per contact per window (configurable) |
| Graymail suppression | Done | Auto-suppress after N sends without engagement (default 11) |
| Preference center checks | Done | Skip unsubscribed/paused contacts before sending |
| Smart provider routing | Partial | Score-based selection designed, basic implementation |
| Provider failover | Planned | Auto-switch on provider errors |
| Email warmup | Planned | Gradual volume ramp for new domains |

---

## System Mailer (Platform Admin)

| Feature | Status | Details |
|---------|--------|---------|
| 8-provider support | Done | SMTP, SES, SendGrid, Mailgun, Postmark, SparkPost, Gmail, Outlook |
| Platform settings UI | Done | Provider selector grid, dynamic forms per provider |
| OAuth credential management | Done | Google + Microsoft client ID/secret via UI |
| OAuth connect flow (Gmail/Outlook) | Done | One-click OAuth for system mailer |
| Password reset emails | Done | Wired to system mailer with fallback |
| Invitation emails | Done | Fire-and-forget with error logging |
| Test connection / send test | Done | Verify provider + send test email |
| Masked config in API | Done | Sensitive fields hidden in responses |
| Setup wizard status | Done | Shows mailer, OAuth, tracking, webhook status |
| Dynamic OAuth config | Done | Reads system_settings first, falls back to .env |
| `.env` simplified to 4 lines | Done | PORT, SESSION_SECRET, FRONTEND_URL, BASE_URL |

---

## Bounce & Complaint Handling

| Feature | Status | Details |
|---------|--------|---------|
| SES bounce parser (SNS) | Done | Hard/soft bounce + complaint from SNS notifications |
| SendGrid bounce parser | Done | JSON array events — bounce, spamreport, dropped |
| Mailgun bounce parser | Done | event-data JSON — failed, complained, unsubscribed |
| Postmark bounce parser | Done | RecordType — Bounce, SpamComplaint |
| SparkPost bounce parser | Done | msys.message_event — bounce, spam_complaint, list_unsubscribe |
| Auto-webhook registration | Done | Registers webhooks with provider API on mailer save |
| SNS subscription auto-confirm | Done | Fetches SubscribeURL automatically |
| Webhook signature verification | Done | SNS X.509, Mailgun HMAC-SHA256, SendGrid ECDSA, SparkPost HMAC-SHA1 |
| Hard bounce suppression | Done | Permanent suppress on first hard bounce |
| Soft bounce tracking | Done | Suppress after 3 failures |
| Complaint auto-unsubscribe | Done | Permanent suppress + unsubscribe event |

---

## Email Tracking

| Feature | Status | Details |
|---------|--------|---------|
| Open tracking (pixel) | Done | 1x1 GIF injection |
| Click tracking (link rewrite) | Done | 302 redirect via tracking URL |
| Unsubscribe page | Done | Hosted confirmation page |
| Cloudflare Worker tracking | Done | Edge-deployed, D1 storage |
| Cloudflare OAuth connect | Done | One-click login, no API keys needed |
| One-click Worker deployment | Done | Deploy to org's Cloudflare account via API |
| Worker Routes (same domain) | Done | `domain.com/o/*`, `/c/*`, `/u/*` — first-party tracking |
| Subdomain option | Done | `e.domain.com` alternative with auto DNS |
| D1 analytics pull | Done | Query org's D1 for open/click/unsub stats |
| Per-org tracking config | Done | Each org deploys their own Worker |
| Tracking settings UI | Done | Settings > Tracking page for org admins |
| Platform tracking setup | Done | Cloudflare section in platform settings wizard |
| Click heatmap | Done | Color-coded bar chart per link in campaign detail view |
| Preference center | Done | 6 levels: subscribed, campaign_only, digest, paused, unsubscribed |

---

## Contact Management

| Feature | Status | Details |
|---------|--------|---------|
| Contact CRUD | Done | Create, read, update, delete with profiles |
| Contact lists | Done | Create/manage lists, add/remove contacts |
| Excel/CSV import | Done | XLSX, XLS, CSV with field mapping |
| Bulk operations | Done | Tag, delete, move, export in batch |
| Custom fields | Done | Any field from import becomes a placeholder |
| Tags | Done | Add/remove tags, filter by tags |
| Engagement scoring | Done | 0-100 auto-calculated, opens +5, clicks +10 |
| Score decay | Done | Gradual decrease for inactive contacts |
| Search & filter | Done | Global search, filter by tag/status/score |
| Email validation | Done | Syntax, MX lookup, disposable domain detection |
| Duplicate detection | Done | Find same-email across lists |
| Contact timeline | Done | Chronological activity feed with event icons + metadata |
| Contact preferences UI | Done | Activity + Preferences tabs in contact modal |
| Frequency capping | Done | Per-org configurable (default 5/week, adjustable) |
| Graymail suppression | Done | Configurable threshold, at-risk + graymail contact lists |
| Contact merge | Planned | Merge duplicates keeping newest data |

---

## Campaigns

| Feature | Status | Details |
|---------|--------|---------|
| Create/edit campaigns | Done | Draft, schedule, send |
| Campaign detail view | Done | Performance stats, click heatmap, recipient list |
| Campaign reports | Done | Sent, delivered, failed, opened, clicked, bounced |
| A/B testing (basic) | Done | Subject line and content variants |
| A/B auto-winner | Done | Configure metric + hours, auto-declare winner |
| Click heatmap | Done | Color-coded link performance in campaign detail |
| Campaign calendar | Partial | View exists, needs drag-and-drop scheduling |
| RSS digest emails | Done | RSS service (283 lines), feed polling, auto-compose |

---

## Templates

| Feature | Status | Details |
|---------|--------|---------|
| Template library | Done | Save, edit, delete, use in campaigns |
| Quill WYSIWYG editor | Done | Rich text editing for email content |
| Template variables | Done | `{{FirstName}}`, `{{Company}}`, custom columns |
| GrapesJS visual builder | Planned | Drag-and-drop email blocks (MJML-based) |
| MJML compilation | Planned | MJML source → responsive HTML |
| Reusable sections | Planned | Save headers/footers/CTAs for reuse |
| Smart content blocks | Planned | Different content per segment in same email |
| Email preview (desktop/mobile) | Planned | Responsive preview modes |

---

## Automation

| Feature | Status | Details |
|---------|--------|---------|
| Automation CRUD | Done | Create, edit, activate, deactivate |
| Trigger types | Done | List join, tag added, form submit, API call, score threshold |
| Condition evaluation | Done | Real evaluation engine with 9 operators |
| Visual flow editor | Done | @vue-flow/core canvas with drag-and-drop, minimap, controls |
| 15 node types | Done | trigger, send_email, wait, delay_until, condition, filter, split_test, http_request, add_tag, remove_tag, update_contact, move_to_list, score_change, webhook, end |
| Node config panel | Done | Per-node-type configuration forms |
| Enrollment tracking | Done | Track contacts through sequences |
| Background execution | Done | Worker processes automation steps |
| Flow minimap + controls | Done | Zoom, fit, snap-to-grid, minimap overview |
| Goal-based exit | Planned | Auto-unenroll when goal achieved |

---

## Segmentation

| Feature | Status | Details |
|---------|--------|---------|
| Static segments | Done | Manual membership |
| Dynamic segments | Done | Rules-based, auto-updating |
| Segment rules | Done | Tag, score, status, engagement, custom fields |
| AND/OR logic | Done | Combine multiple conditions |
| RFM analysis | Planned | Recency/Frequency/Monetary segmentation |
| Behavioral cohorts | Planned | Group by engagement patterns |

---

## Analytics & Reporting

| Feature | Status | Details |
|---------|--------|---------|
| Campaign analytics | Done | Open rate, click rate, bounce rate, unsub rate |
| Real-time dashboard | Done | SSE-powered live stats |
| Email logs | Done | JSON file logging of all events |
| Spam content scanner | Done | Pre-send risk scoring |
| Email health dashboard | Done | 0-100 score, 5 metrics, color-coded, recommendations |
| Click heatmap | Done | Per-link heat visualization in campaign detail |
| Device/client breakdown | Done | User-Agent parsing in analytics view |
| Send time heatmap | Done | Day/hour engagement heatmap |
| Custom report builder | Planned | User-defined reports with filters |
| Reply tracking | Planned | Detect and log email replies |

---

## Forms & Landing Pages

| Feature | Status | Details |
|---------|--------|---------|
| Form CRUD | Done | Create, edit, delete, toggle status |
| Form field mapping | Done | Map form fields to contact fields |
| Form actions | Done | Add tag, enroll automation, webhook, update score |
| Form embed codes | Done | HTML, JavaScript widget, API example with copy |
| Public form submission | Done | Accepts JSON + URL-encoded, CORS, required fields |
| Form submissions viewer | Done | View all submissions with data + IP |
| Landing page CRUD | Done | Create, edit, publish/unpublish, delete |
| 4 built-in templates | Done | Lead capture, webinar, coming soon, thank you |
| Page HTML/CSS editor | Done | Code editor with tab switching |
| Page preview | Done | iframe preview modal |
| Form embed in pages | Done | Link form to page, auto-inject JS widget |
| Page visit tracking | Done | Visit count incremented per page view |
| SEO meta tags | Done | Title, description, OG image |

---

## API & Integrations

| Feature | Status | Details |
|---------|--------|---------|
| Outgoing webhooks | Done | Create, test, enable/disable, view logs |
| Webhook HMAC signing | Done | Secret-based request signing |
| API key management | Partial | Route exists, needs scoped permissions |
| WhatsApp integration | Partial | Service skeleton, needs Twilio implementation |
| Plugin system | Planned | Provider plugins, hook plugins, template plugins |
| CLI tool | Planned | `dispatch send`, `dispatch contacts import`, etc. |

---

## Infrastructure & DevOps

| Feature | Status | Details |
|---------|--------|---------|
| Hot reload dev server | Done | `bun run dev` |
| Frontend Vite dev server | Done | `bun run dev` with proxy |
| Database migrations | Done | 5 migrations, auto-run on startup |
| Cloudflare Worker deployment | Done | Tracking worker with D1 |
| Production build | Done | `bun start` + `bun run build` |
| Docker support | Future | Containerized deployment |
| Horizontal scaling | Future | Multi-instance with shared DB |

---

## What Was Built Today (2026-03-17)

Everything below was implemented in a single session:

### Backend (19 new/modified files)
- Postmark + SparkPost bounce parsers
- Auto-webhook registration service (5 providers)
- Webhook signature verification middleware (SNS, Mailgun, SendGrid, SparkPost)
- Cloudflare OAuth + Worker deployment service
- Tracking Worker template + D1 schema
- Per-org tracking config (DB migration 005)
- Frequency capping service + queue worker integration
- Graymail suppression service + queue worker integration
- Preference center service (6 preference levels)
- A/B auto-winner logic
- All routes wired (admin, campaigns, contacts, webhooks)

### Frontend (21 new/modified files)
- Visual automation builder (Vue Flow canvas + 15 node types + config panel)
- Email health dashboard component (score, metrics, recommendations)
- Contact timeline component (chronological activity feed)
- Contact preferences component (6 preference options)
- Click heatmap component (color-coded link performance)
- Cloudflare API client + tracking settings page
- Campaign detail view updated with heatmap
- Analytics view updated with health dashboard
- Contacts view updated with timeline + preferences modal
- Settings nav updated with Tracking item

---

## What's Remaining (Pick Up Tomorrow)

### High Priority
1. **GrapesJS email builder** — Drag-and-drop visual email composition (needs `grapesjs` + `grapesjs-mjml` packages)
2. **MJML compilation** — Backend endpoint to compile MJML → responsive HTML
3. **Goal-based automation exit** — Auto-unenroll contacts when they achieve a goal
4. **Contact merge** — Merge duplicate contacts keeping newest data

### Medium Priority
5. **Campaign calendar drag-and-drop** — Reschedule campaigns by dragging
6. **Custom report builder** — User-defined reports with column selection + filters
7. **Reply tracking** — Inbound email webhook to detect replies
8. **Smart content blocks** — `{{#smart}}` template syntax with conditional content
9. **API key scoped permissions** — Per-key access control (read, send, contacts, admin)

### Lower Priority
10. **Smart provider routing** — Complete the score-based selection with real failover
11. **Email warmup** — Gradual volume ramp for new domains/IPs
12. **RFM segmentation** — Recency/Frequency/Monetary analysis
13. **Reusable email sections** — Save and reuse headers/footers/CTAs
14. **Email preview modes** — Desktop/tablet/mobile responsive preview

### Future (v5.0)
15. **Plugin system** — Provider, hook, template plugins with manifest
16. **CLI tool** — Command-line campaign management
17. **WhatsApp channel** — Full Twilio integration
18. **Multi-language emails** — Template variants per language
19. **Docker deployment** — Containerized self-hosting

---

## Tech Debt

| Item | Priority | Notes |
|------|----------|-------|
| Warmup/routing services skeletal | Medium | Route files exist with minimal logic |
| WhatsApp skeleton | Low | Service exists but not functional |
| API key scoped permissions | Medium | Route exists, needs authorization logic |

---

## Package Dependencies

### Installed
| Package | Purpose |
|---------|---------|
| `@vue-flow/core` | Visual automation builder |
| `@vue-flow/minimap` | Automation flow minimap |
| `@vue-flow/controls` | Automation flow controls |

### Needed Next
| Package | Purpose | Phase |
|---------|---------|-------|
| `grapesjs` | Visual email builder | Next |
| `grapesjs-mjml` | MJML support for builder | Next |
| `grapesjs-preset-newsletter` | Newsletter blocks | Next |
| `mjml` | MJML to HTML compilation (backend) | Next |

**Current stack**: Bun, Hono, Vue 3, Tailwind, TanStack Query, Vue Flow, Nodemailer, Cloudflare Workers + D1. No Redis, no Kafka, no Docker.
