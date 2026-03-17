# Dispatch — Feature Roadmap

**Date**: 2026-03-16
**Vision**: Open-source marketing automation platform — the 80% of HubSpot/Moengage for 0% of the cost.
**Positioning**: Deploys in 2 minutes. Does what marketers actually use. Free forever.

---

## What Already Exists

| Feature | Status | Notes |
|---------|--------|-------|
| Email campaigns (send, schedule) | Done | SMTP + Gmail OAuth + Microsoft OAuth |
| Batch processing (batchSize/delay) | Done | In-memory, single job at a time |
| Auth (Argon2 + sessions) | Done | Cookie-based, D1-backed |
| RBAC (owner/admin/manager/member/readonly) | Done | 50+ permissions, role + user-level overrides |
| Multi-org | Done | Org switcher in sidebar |
| Tracking (opens/clicks) | Done | Cloudflare Worker + D1 |
| Unsubscribe handling | Done | One-click via tracking worker |
| Bounce webhooks (SES/SendGrid/Mailgun) | Done | Parsers + routes |
| System mailer (8 providers) | Done | Platform-level email config via UI |
| OAuth dynamic config | Done | Reads system_settings, falls back to .env |
| Workflow builder (started) | Partial | n8n-style visual builder, basic nodes |
| Dashboard + Reports | Done | Campaign stats, email logs |
| WYSIWYG editor | Done | Quill-based |
| File upload (Excel) | Done | xlsx parsing with placeholder replacement |
| Scheduling | Done | SQLite-backed scheduled jobs |
| Security headers + Zod validation | Done | All 73 endpoints validated |

---

## Tier 1 — Core Foundation (Used by 90%+ of marketers)

These are the features every marketing platform user needs daily. Without these, Dispatch is incomplete.

### 1.1 Contact Management

**Priority**: HIGHEST — everything else depends on this
**What**: Centralized contact database with profiles, custom fields, import/export
**Why**: Currently contacts are uploaded per-campaign as Excel files. No persistent contact storage.

**Features**:
- Contact profiles (email, name, phone, company, custom fields)
- Import from CSV/Excel with field mapping
- Export contacts to CSV
- Contact detail page showing full history (emails received, opens, clicks, unsubscribes)
- Duplicate detection and merge
- Contact search and filter
- Bulk actions (tag, delete, export)
- Contact activity timeline (Matomo-style — every action, every session)

**Database**:
```sql
contacts (id, org_id, email, first_name, last_name, phone, company,
          status, source, custom_fields JSON, subscribed_at,
          unsubscribed_at, created_at, updated_at)

contact_activities (id, contact_id, type, metadata JSON, created_at)
-- types: email_sent, email_opened, email_clicked, unsubscribed,
--        form_submitted, tag_added, tag_removed, imported, updated
```

**Effort**: 3-4 days

---

### 1.2 Segmentation (Tags + Lists + Filters)

**Priority**: HIGHEST — required for targeted campaigns
**What**: Group contacts by behavior, tags, properties, and dynamic filters
**Why**: Sending to "everyone" is spam. Segments enable welcome series, re-engagement, targeted campaigns.

**Features**:
- **Tags**: Label contacts (e.g., "customer", "lead", "VIP", "churned")
  - Add/remove tags manually or via automation
  - Bulk tag on import
- **Static lists**: Manually curated groups (e.g., "Beta testers", "Conference 2026")
- **Dynamic segments**: Auto-updating groups based on filters:
  - Contact properties (company = "Acme", country = "India")
  - Behavior (opened last campaign, clicked in last 30 days, never opened)
  - Tags (has tag "customer" AND NOT "churned")
  - Engagement (opened > 3 emails, inactive for 60+ days)
  - Date-based (subscribed in last 7 days, birthday this month)
- **Segment preview**: See count and sample contacts before sending
- **RFM segments** (later): Recency/Frequency/Monetary for e-commerce

**Database**:
```sql
tags (id, org_id, name, color, contact_count, created_at)

contact_tags (contact_id, tag_id, created_at)

lists (id, org_id, name, description, type, filter_rules JSON,
       contact_count, created_at, updated_at)
-- type: 'static' | 'dynamic'
-- filter_rules: JSON query for dynamic lists

list_contacts (list_id, contact_id, added_at)
-- only for static lists; dynamic lists compute on query
```

**Effort**: 3-4 days

---

### 1.3 Simple Automations (Triggers + Actions)

**Priority**: HIGH — the #1 reason people buy marketing automation
**What**: Event-driven email sequences (welcome series, drip campaigns, re-engagement)
**Why**: 71% of users primarily automate email. Welcome emails are the #1 automation across every platform.

**Top 10 automations to support (ranked by usage)**:
1. **Welcome email on signup** — triggered when contact is created/tagged
2. **Drip sequence** — send emails over time (Day 1, Day 3, Day 7...)
3. **Re-engagement** — trigger when contact inactive for X days
4. **Post-action follow-up** — trigger on tag added, link clicked, email opened
5. **Birthday/anniversary** — date-field trigger
6. **Tag-based routing** — if opened → tag "engaged", if not → tag "cold"
7. **Internal notification** — alert team when contact hits threshold
8. **Unsubscribe handling** — auto-remove from lists, update tags
9. **Lead score update** — increment score on actions
10. **Conditional branching** — if/else based on contact properties or behavior

**Triggers**:
- Contact created
- Contact tagged / tag removed
- Email opened / clicked / bounced
- Form submitted
- Date reached (birthday, custom date field)
- Inactive for X days
- Lead score threshold reached
- Webhook/API event

**Actions**:
- Send email (from template)
- Wait / delay (minutes, hours, days)
- Add / remove tag
- Update contact field
- Add to / remove from list
- Send notification to team member (email or in-app)
- If/else branch (on contact property, tag, behavior)
- Go to another automation

**Database**:
```sql
automations (id, org_id, name, status, trigger_type, trigger_config JSON,
             created_by, created_at, updated_at)
-- status: 'draft' | 'active' | 'paused' | 'archived'

automation_steps (id, automation_id, type, config JSON, position,
                  next_step_id, condition_true_step_id, condition_false_step_id)
-- type: 'send_email' | 'wait' | 'add_tag' | 'remove_tag' | 'update_field' |
--       'add_to_list' | 'remove_from_list' | 'notify' | 'condition' | 'goto'

automation_enrollments (id, automation_id, contact_id, current_step_id,
                        status, enrolled_at, completed_at, next_action_at)
-- status: 'active' | 'completed' | 'exited' | 'paused'

automation_logs (id, enrollment_id, step_id, action, result, created_at)
```

**Effort**: 5-6 days (this is the most complex Tier 1 feature)

---

### 1.4 Campaign Analytics (Enhanced)

**Priority**: HIGH — marketers live in analytics dashboards
**What**: Matomo-level depth with Plausible-level simplicity
**Why**: Current tracking shows opens/clicks. Marketers need full campaign performance analysis.

**Features**:
- **Campaign overview**: sent, delivered, opened, clicked, bounced, unsubscribed — with rates
- **Timeline chart**: engagement over time (opens/clicks per hour after send)
- **Device/client breakdown**: Desktop vs mobile, Gmail vs Outlook vs Apple Mail
- **Geo breakdown**: Opens/clicks by country/city (from Worker IP geolocation)
- **Link performance**: Which links got most clicks, click heatmap on email
- **Contact-level view**: For each recipient — did they open, click, which links, when
- **Comparison**: Compare campaign A vs campaign B performance
- **Export**: Download analytics as CSV/PDF

**Data sources**: Already captured in D1 tracking worker (user agent, IP, timestamps). Need to surface it.

**Effort**: 3-4 days (mostly frontend dashboard work)

---

### 1.5 Email Templates

**Priority**: HIGH — most users don't write HTML from scratch
**What**: Reusable email templates with preview and personalization
**Why**: Every platform's email builder is a top feature. Currently Dispatch has a Quill editor but no template library.

**Features**:
- **Template library**: Save/reuse email designs
- **Categories**: Welcome, Newsletter, Promotion, Transactional, etc.
- **Starter templates**: 5-10 pre-built responsive templates
- **Preview**: Desktop + mobile preview before sending
- **Personalization tokens**: Click to insert `{{FirstName}}`, `{{Company}}`, etc.
- **Template versioning**: Track changes, revert to previous version
- **React Email integration** (optional): For developers who want code-based templates
  - React Email is MIT open-source, provider-agnostic
  - Produces cross-client-compatible HTML
  - Can be used alongside the visual editor

**Database**:
```sql
email_templates (id, org_id, name, category, subject, html_content,
                 text_content, thumbnail, variables JSON,
                 created_by, created_at, updated_at)
```

**Effort**: 3-4 days

---

## Tier 2 — Growth Features (Used by 40-60% of users)

These differentiate Dispatch from basic email tools and justify switching from Mailchimp/Mautic.

### 2.1 Forms & Lead Capture

**Priority**: HIGH — feeds the contact list
**What**: Embeddable forms that capture leads directly into Dispatch contacts
**Why**: HubSpot forms are rated 9.04/10. This is how contacts enter the system without CSV import.

**Features**:
- **Form builder**: Drag-and-drop fields (name, email, phone, company, custom)
- **Embed options**:
  - HTML snippet (paste into any website)
  - JavaScript widget (popup, slide-in, bar)
  - Hosted page (dispatch-hosted URL)
- **Form actions on submit**:
  - Create/update contact
  - Add tags
  - Add to list
  - Trigger automation (welcome email)
  - Redirect to thank you page
- **Double opt-in**: Confirmation email before adding to list
- **Spam protection**: Honeypot field + rate limiting
- **Analytics**: Submissions, conversion rate, drop-off

**Database**:
```sql
forms (id, org_id, name, fields JSON, settings JSON,
       submit_actions JSON, status, submission_count,
       created_by, created_at, updated_at)

form_submissions (id, form_id, contact_id, data JSON,
                  ip, user_agent, created_at)
```

**Effort**: 4-5 days

---

### 2.2 A/B Testing

**Priority**: HIGH — most common optimization tool across all platforms
**What**: Test subject lines, content, send times to optimize campaign performance
**Why**: Available on every platform from Mailchimp to Moengage. Standard expectation.

**Features**:
- **Subject line testing**: Send variant A and B to a sample, winner goes to rest
- **Content testing**: Two different email bodies
- **Send time testing**: Same email at different times
- **Winner criteria**: Open rate, click rate, or manual selection
- **Sample size**: Configurable (default 20% of list, 10% per variant)
- **Auto-send winner**: After X hours, automatically send winning variant to remaining contacts
- **Results dashboard**: Side-by-side comparison with statistical significance indicator

**Database**:
```sql
ab_tests (id, campaign_id, org_id, test_type, variants JSON,
          sample_size_percent, winner_criteria, winner_variant,
          auto_send_after_hours, status, created_at, completed_at)
-- test_type: 'subject' | 'content' | 'send_time'
-- variants: [{ id, subject, html_content, send_time, sample_contacts[] }]
```

**Effort**: 3-4 days

---

### 2.3 Lead Scoring

**Priority**: MEDIUM — used by B2B marketers heavily
**What**: Points-based system to identify hot leads based on behavior
**Why**: ActiveCampaign and HubSpot users rely on this for sales handoff

**Features**:
- **Scoring rules**:
  - +10 for email open
  - +25 for link click
  - +50 for form submission
  - +100 for pricing page visit (if web tracking added later)
  - -20 for inactivity (30 days)
  - Custom rules per org
- **Score decay**: Reduce score over time if no engagement
- **Thresholds**: "Hot lead" at 100+, "Warm" at 50+, "Cold" below 20
- **Actions on threshold**: Trigger automation, send notification, add tag
- **Leaderboard**: Sort contacts by score, see who's most engaged

**Database**:
```sql
scoring_rules (id, org_id, event_type, points, conditions JSON,
               created_at, updated_at)

contact_scores (contact_id, org_id, score, last_activity, updated_at)

score_history (id, contact_id, rule_id, points_change, reason, created_at)
```

**Effort**: 2-3 days

---

### 2.4 Pluggable Email Transports (Serverless)

**Priority**: HIGH — enables serverless deployment + provider flexibility
**What**: Abstract email sending behind a transport interface. Support SMTP, OAuth APIs, and HTTP API providers.
**Why**: Makes Dispatch serverless-compatible and gives users provider choice.

**Transports to implement**:

| Transport | Protocol | Serverless? | Self-hostable? |
|-----------|----------|------------|---------------|
| SMTP (Nodemailer) | SMTP/TCP | No (server only) | Yes |
| Gmail OAuth | REST API | Yes | N/A (Google service) |
| Microsoft Graph | REST API | Yes | N/A (Microsoft service) |
| AWS SES | REST API | Yes | No (AWS service) |
| Resend | REST API | Yes | No (SaaS) |
| SendGrid | REST API | Yes | No (SaaS) |
| Postmark | REST API | Yes | No (SaaS) |
| Mailgun | REST API | Yes | No (SaaS) |

**Architecture**:
```
src/services/transports/
  index.ts               ← EmailTransport interface + factory
  smtpTransport.ts       ← Nodemailer wrapper (server mode)
  gmailTransport.ts      ← Gmail API via OAuth
  microsoftTransport.ts  ← Microsoft Graph via OAuth
  sesTransport.ts        ← AWS SES HTTP API
  resendTransport.ts     ← Resend HTTP API
  sendgridTransport.ts   ← SendGrid HTTP API
  postmarkTransport.ts   ← Postmark HTTP API
  mailgunTransport.ts    ← Mailgun HTTP API
```

**Interface**:
```typescript
interface EmailTransport {
  name: string
  send(options: { from, to, subject, html, text, headers }): Promise<SendResult>
  testConnection(): Promise<boolean>
  dispose(): void
}
```

**Key decisions**:
- SMTP (Nodemailer) only loaded when selected — not bundled for serverless deploys
- Each transport is a separate file — tree-shakeable
- Factory function creates the right transport based on config
- emailService.ts becomes transport-agnostic

**Cost comparison at 100K emails/month**:

| Provider | Cost | Notes |
|----------|------|-------|
| AWS SES | $10 | Cheapest at scale |
| Mailgun | $75-100 | Good middle ground |
| SendGrid | $90 | Most features |
| Resend | $90 | Best DX |
| Postmark | $110 | Best deliverability |
| Own SMTP | $0-5 | Full control |

**Effort**: 3-4 days

---

### 2.5 Multi-Channel — SMS (via plugins)

**Priority**: MEDIUM — CEP users expect this
**What**: Send SMS alongside email in automations
**Why**: Push + SMS + email is the core multi-channel combo across Moengage, CleverTap, Braze

**Approach**: Same pluggable transport pattern as email:
- Twilio (most popular)
- AWS SNS
- MessageBird / Vonage
- Custom webhook (for any provider)

**Keep it simple**: SMS is just another action in the automation builder. No separate SMS campaigns UI — just add "Send SMS" as an automation step.

**Effort**: 2-3 days

---

### 2.6 Landing Pages (Simple)

**Priority**: LOW-MEDIUM — nice to have, not essential for v1
**What**: Simple hosted pages for lead capture
**Why**: HubSpot landing pages rated 9.04/10. But forms + embeds cover 80% of the same use case.

**If built**: Keep it minimal:
- 3-5 templates (signup, webinar, download, waitlist)
- Drag-and-drop sections (hero, features, form, CTA)
- Custom domain support via Cloudflare (leveraging existing CF integration)
- Published to Cloudflare Pages (static, edge-cached)

**Effort**: 5-6 days (can be deferred)

---

## Tier 3 — Power User Features (Used by 20-30%)

Build these after Tier 1 and 2 are solid. These attract enterprise users and advanced marketers.

### 3.1 Advanced Segmentation (RFM, Behavioral Cohorts)

- **RFM analysis**: Recency (days since last open/click), Frequency (total engagements), Monetary (if e-commerce integration exists)
- **Behavioral cohorts**: Group by "opened 3+ emails in last 30 days", "clicked but never purchased"
- **Cohort comparison**: Compare engagement of "January signups" vs "February signups" over time
- **Predictive segments**: "Likely to churn" based on declining engagement (requires ML later)

**Effort**: 3-4 days

### 3.2 Unified Contact Profiles (Light CDP)

- **Activity timeline**: Full chronological history per contact — every email, open, click, form submit, tag change
- **Cross-session identity**: Link the same person across form submissions, email clicks, and website visits
- **Custom properties**: Arbitrary key-value data (plan type, signup source, LTV)
- **Profile enrichment**: Auto-enrich from Clearbit/Hunter (optional API integration)

**Effort**: 3-4 days

### 3.3 Advanced Analytics & Reporting

- **Custom dashboards**: Drag widgets (charts, tables, metrics) onto a dashboard
- **Scheduled reports**: Email a PDF summary weekly/monthly
- **Attribution**: Which campaign drove the most conversions
- **Funnel analysis**: Define a funnel (received → opened → clicked → converted) and see drop-off
- **Revenue attribution** (if e-commerce): Track which emails generated revenue

**Effort**: 5-7 days

### 3.4 API & Webhooks (Developer Platform)

- **API keys**: Per-org API keys with scope-based permissions
- **REST API**: Full CRUD for contacts, lists, campaigns, automations
- **Webhooks out**: Push events to external systems (contact created, email sent, form submitted)
- **Zapier/n8n integration**: Standard webhook format compatible with integration platforms
- **SDK**: JavaScript/TypeScript client library

**Effort**: 4-5 days

### 3.5 Web Tracking (Matomo-style)

- **JavaScript snippet**: Embed on website to track page views, sessions, referrers
- **Visitor profiles**: Which pages a contact visited before/after email click
- **Referrer tracking**: Which search engine, campaign, or site sent the visitor
- **Event tracking**: Custom events (button clicks, video plays, scroll depth)
- **Session recordings**: (much later — complex to build)

**Effort**: 5-7 days

---

## Infrastructure Improvements (Parallel Track)

### Serverless Deployment (Cloudflare)

**Full Cloudflare stack**:
| Component | Cloudflare Service |
|-----------|-------------------|
| Frontend | Pages (static, edge-cached, global CDN) |
| API | Workers (Hono runs natively on Workers) |
| Database | D1 (SQLite at edge) |
| Cache/Sessions | KV |
| File storage | R2 |
| Job queue | Queues + Durable Objects |
| Cron/scheduler | Cron Triggers |
| Email receiving | Email Workers (bounce/reply handling) |
| Tracking | Workers + D1 (already built) |

**Deploy button**: One-click "Deploy to Cloudflare" in README

### One-Click Deploy Options

- **Cloudflare**: Pages + Workers + D1 + KV + R2 (free tier covers small use)
- **Railway**: One-click button, fill env vars, running in 2 minutes
- **Render**: Similar to Railway
- **Docker**: `docker compose up` for self-hosters
- **VPS**: `bun start` on any Linux server

### CI/CD Pipeline

- GitHub Actions for lint, type-check, test
- Auto-deploy to Cloudflare on merge to main
- Preview deployments on PRs

---

## Competitive Advantage Summary

| What competitors get wrong | What Dispatch does differently |
|---------------------------|-------------------------------|
| HubSpot: $800+/month for advanced features | Open-source, free forever |
| Mautic: Painful self-hosting, dated UI | One-click deploy, modern Vue 3 + Tailwind UI |
| CleverTap: No built-in email/SMS sending | Pluggable transports with 8+ providers built-in |
| Mailchimp: Limited automation at low tiers | Full automation engine at every tier (it's free) |
| Moengage/Braze: Enterprise-only pricing | Same features, zero cost |
| All of them: Vendor lock-in | Self-host, own your data, switch providers anytime |

**Pricing is the #1 churn reason across every marketing platform.** Dispatch's answer: it's free.

---

## Suggested Build Order

```
Phase 1 (Weeks 1-2): Contact Management + Segmentation
  ├── 1.1 Contact database, import/export, profiles
  ├── 1.2 Tags, static lists, dynamic segments
  └── 1.4 Enhanced campaign analytics dashboard

Phase 2 (Weeks 3-4): Automation Engine
  ├── 1.3 Triggers, actions, visual builder enhancement
  ├── 1.5 Email templates library
  └── 2.2 A/B testing (subject lines)

Phase 3 (Weeks 5-6): Growth & Capture
  ├── 2.1 Forms & lead capture (embeddable)
  ├── 2.3 Lead scoring
  └── 2.4 Pluggable transports (serverless-ready)

Phase 4 (Weeks 7-8): Platform & Deploy
  ├── One-click deploy (Cloudflare + Railway)
  ├── CI/CD pipeline
  ├── 2.5 SMS transport (Twilio)
  └── Setup wizard improvements

Phase 5 (Weeks 9+): Power Features
  ├── 3.1 RFM + behavioral cohorts
  ├── 3.2 Unified contact profiles
  ├── 3.4 API keys + webhooks out
  └── 3.3 Advanced analytics
```

---

## Key Architectural Decisions

1. **Pluggable transports** — EmailTransport interface, factory pattern, SMTP is optional
2. **Contact-centric data model** — everything links back to contacts (not email addresses)
3. **Automation engine** — event-driven with enrollment tracking and step execution
4. **Serverless-first** — all HTTP API providers work on edge, SMTP optional for server mode
5. **Per-org isolation** — each org has its own contacts, segments, automations, tracking
6. **Matomo-level depth, Plausible-level UI** — capture everything, show it simply
7. **React Email for templates** (optional) — MIT, provider-agnostic, cross-client compatible
8. **Cloudflare Email Workers** — inbound email processing for bounces/replies without webhooks

---

## Research Sources

Feature priorities based on real usage data across:
- **HubSpot** (TrustRadius, 2,272 reviews, 8.6/10)
- **ActiveCampaign** (TrustRadius, 936 reviews, 8.3/10)
- **Moengage, CleverTap, WebEngage, Braze, Insider** (G2/TrustRadius reviews + case studies)
- **Mailchimp** (published usage data — 71% automate email, 39% social, 35% landing pages)
- **Mautic** (GitHub discussions, community feedback)

**Key finding**: Users only use ~20% of marketing platform features. That 20% is: email sending, contact management, basic segmentation, and simple automations. Dispatch targets this 20% first.
