# Dispatch v4.2 — Production Polish & MailWizz-Level Features

**Date**: 2026-03-18
**Branch**: `new-framework`
**Scope**: Make Dispatch production-ready with MailWizz/Mautic-level feature completeness.

---

## Critical Fixes

### 1. Router Black Screen — FIXED
- **Cause**: `<Transition name="page" mode="out-in">` in MainLayout.vue was waiting for leave animation to finish before mounting new component. Missing CSS animation = infinite blank state.
- **Fix**: Removed Transition wrapper. RouterView renders directly now.

### 2. Platform Admin Is NOT Part of Any Organization
Platform admin is a **system-level entity**. It has NO org_id, no org membership, no org context. It exists above all organizations.

**Current state**: Platform admin routes use `requirePlatformAdmin()` which checks `is_platform_admin` flag — no org context.

**What needs enforcing**:
- Platform admin should NEVER appear in any org's member list
- Platform admin dashboard shows ALL orgs, ALL users — not org-scoped data
- When platform admin logs in, sidebar shows "Platform" context, not any org
- Platform admin cannot be invited to orgs, cannot accept invites
- Platform admin role (`platform_super_admin`) is already filtered from getRoles endpoint

**Changes needed**:
- `src/middleware/auth.ts` — Platform admin requests should NOT set orgId context
- `src/routes/admin.ts` — Platform routes already use `requirePlatformAdmin()` ✓
- Frontend sidebar — Show platform-specific nav when isPlatformAdmin, hide org switcher
- Frontend auth context — Platform admin has `orgId: null`, no org-scoped queries

---

## Phase 1: Org & User Identity System

### 1.1 Org Unique Slug/Username
Every org gets a unique slug (like @mycompany). Used in URLs, API, tracking.

**DB changes**: `organizations.slug` already exists — need uniqueness enforcement + user-facing picker.

**Flow**:
```
Create Org → Enter name → Auto-suggest slug → Check availability → Confirm
Example: "Acme Corp" → suggests "acme-corp" → taken? suggest "acme-corp-1"
```

**API**:
```
GET  /api/admin/org/check-slug?slug=acme → { available: true/false, suggestions: [...] }
PUT  /api/admin/org/slug → update org slug (owner only)
```

**Frontend**: Slug picker in OrgSettings with real-time availability check.

### 1.2 User Unique Username
Every user gets a unique handle (like @john). Used for mentions, assignments.

**DB changes**: Add `username` column to users table (unique, lowercase, alphanumeric + hyphens).

**Flow**:
```
Register → Auto-suggest username from email prefix → Check availability → Confirm
Profile → Change username (with availability check)
```

**API**:
```
GET  /api/auth/check-username?username=john → { available: true/false }
PUT  /api/auth/profile/username → update username
```

---

## Phase 2: Domain & Sending Email Management

### 2.1 Domain Management
Add a domain → verify it → create multiple sending emails under it.

**DB tables**:
```sql
CREATE TABLE sending_domains (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  verification_status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  dkim_record TEXT,
  spf_record TEXT,
  dmarc_record TEXT,
  verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(org_id, domain)
);

CREATE TABLE sending_emails (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  is_default INTEGER DEFAULT 0,
  assigned_to TEXT, -- user_id or null (all users)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (domain_id) REFERENCES sending_domains(id),
  UNIQUE(org_id, email)
);
```

**Admin controls**:
- Org admin adds domain → gets DNS records to add (DKIM, SPF, return-path)
- System verifies DNS records via API
- Admin creates sending emails: `hello@domain.com`, `newsletter@domain.com`
- Admin assigns emails to users (or "all users")
- Users only see emails assigned to them when composing

### 2.2 Sending Server (Provider Config) Improvements
Like MailWizz's "Delivery Servers" concept:

**Per server config includes**:
- Provider type + credentials
- Sending domain(s) it can send from
- Daily/hourly limits
- Warmup status
- Health status (last error, success rate)
- Whether to track bounces via webhook, API polling, or Worker

**Rotation modes** (per campaign):
- **Smart (auto)**: Score-based selection using routingEngine (already built)
- **Manual**: User selects which servers to use + order
- **Round-robin**: Distribute evenly across selected servers
- **Weighted**: User sets percentage per server (e.g., SES 60%, Mailgun 40%)

**UI**: When composing a campaign, show "Sending Servers" section:
```
┌─────────────────────────────────────────────┐
│ Sending Servers                             │
│                                             │
│ Mode: [Smart ▾] [Manual] [Round Robin]      │
│                                             │
│ ☑ SES (us-east-1) — 450/500 remaining      │
│ ☑ Mailgun (mg.example.com) — 280/300       │
│ ☐ SendGrid — 500/500 remaining             │
│                                             │
│ Rotation: Smart (based on quota + speed)    │
└─────────────────────────────────────────────┘
```

---

## Phase 3: Bounce Processing — Complete System

### 3.1 Three Methods for Bounce Collection

**Method 1: Webhooks (current — already built)**
- Provider calls our endpoint on bounce/complaint
- SES, SendGrid, Mailgun, Postmark, SparkPost all done
- Auto-registration on provider config save

**Method 2: API Polling**
- Periodically call provider API to fetch bounces
- Good for providers where webhook setup is complex
- Or as a backup/verification layer

```
SES:     GET bounce/complaint notifications from SNS (already via webhook)
SendGrid: GET /v3/suppression/bounces, GET /v3/suppression/spam_reports
Mailgun:  GET /{domain}/events?event=failed
Postmark: GET /bounces, GET /spam-complaints
SparkPost: GET /api/v1/events/message?events=bounce,spam_complaint
```

**New service**: `src/services/bouncePollingService.ts`
- Runs on configurable interval (default: every 15 minutes)
- Polls each configured provider's API for new bounces
- Deduplicates against already-processed webhook events
- Good as a fallback if webhooks miss events

**Method 3: Cloudflare Worker Email Processing (optional)**
- For orgs who deploy our tracking Worker on their domain
- Worker can also receive bounce notification emails (via Email Routing)
- Parse bounce notification emails (DSN format / RFC 3464)
- No webhook setup needed — just route bounce emails to the Worker

### 3.2 Bounce Dashboard
- Real-time bounce/complaint rates per domain, per provider
- Alerts when rates exceed thresholds (>2% bounce, >0.1% complaint)
- One-click re-verify suppressed contacts
- Export suppression list

---

## Phase 4: Better Templates & Preview

### 4.1 Professional Starter Templates
Replace basic starters with production-quality responsive templates:

| Template | Use Case |
|----------|----------|
| Welcome Series | New subscriber welcome |
| Newsletter | Weekly/monthly content digest |
| Product Update | Feature announcements |
| Event Invitation | Webinar, conference, meetup |
| Promotional | Sale, discount, offer |
| Re-engagement | Win back inactive subscribers |
| Transactional | Order confirmation, receipt |
| Survey/Feedback | NPS, satisfaction survey |
| Milestone | Birthday, anniversary, achievement |
| Plain Text | Simple text-only email |

Each template: responsive HTML, dark mode compatible, variable placeholders, unsubscribe footer.

### 4.2 Live Preview with Contact Data
- Select a contact from your list
- Preview shows actual replaced values (`{{FirstName}}` → "John")
- Toggle between desktop/tablet/mobile widths
- Dark mode preview option

### 4.3 Template Thumbnail Generation
- Auto-generate thumbnail screenshot of each template
- Show in template library grid view
- Update on template save

---

## Phase 5: Enhanced Form Builder

### 5.1 External Form Connection
Connect ANY external form (React, Vue, plain HTML, WordPress, Webflow):

**Method 1: JavaScript SDK** (already have embed code)
```html
<script src="https://yourapp.com/f/frm_abc.js"></script>
```

**Method 2: API endpoint** (already built)
```javascript
fetch('/api/forms/frm_abc/submit', { method: 'POST', body: JSON.stringify(data) })
```

**Method 3: Webhook receiver** (new)
- Register a webhook URL in Dispatch
- Any form service (Typeform, Google Forms, JotForm) can POST to it
- Map incoming fields to contact fields
- Support for Zapier/Make/n8n integration

### 5.2 Form Analytics
- Submission count over time (chart)
- Conversion rate (views → submissions)
- Field completion rates
- Drop-off analysis
- Geographic breakdown

---

## Phase 6: Platform Admin Separation

### 6.1 Platform Admin Dashboard (Separate from Org Admin)
Platform admin sees:
- System health (DB size, active sessions, queue depth)
- All organizations with stats
- All users across all orgs
- System mailer status
- Tracking Worker deployments
- Global bounce/complaint rates
- License/usage limits

### 6.2 Platform Admin Has No Org Context
- Login → goes directly to `/admin/platform` (not `/` dashboard)
- Sidebar shows Platform nav only (no Campaigns, Contacts, etc.)
- No org switcher in sidebar
- Can "impersonate" an org to see their dashboard (read-only)

---

## Phase 7: Deep Analytics (Matomo-Level Depth)

Like the Matomo screenshot — full visitor/recipient profiling, not just open/click counts.

### 7.1 Recipient Profile & Activity Log
Every contact gets a rich profile page showing:

**Overview card**:
- Name, email, company, phone
- Engagement score (0-100)
- Subscription preference (subscribed/paused/unsubscribed)
- First seen date, last activity date
- Total emails received / opened / clicked
- Tags, segments, lists

**Activity timeline** (already built, needs enrichment):
- Email sent, opened, clicked (with URLs)
- Form submissions
- Page visits (from tracking Worker)
- Tag changes, score changes
- Automation enrollments/exits
- Bounce/complaint events

**Email engagement breakdown**:
- Which campaigns they opened/clicked
- Which links they clicked (with click count per link)
- Open time analysis (when do they open emails?)
- Device/OS/browser they use to open emails

### 7.2 Visitor Tracking from Tracking Worker
The Cloudflare Worker already tracks opens/clicks. Extend it to capture:

**Data already captured** (via Worker):
- IP address → geo (country, city via Cloudflare headers `cf-ipcountry`)
- User-Agent → device, browser, OS parsing
- Timestamp of each event
- Link clicked (original URL)

**New: Parse User-Agent into structured data**:
```
User-Agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36..."
→ { browser: "Chrome 120", os: "macOS 14", device: "Desktop", brand: "Apple" }
```

**New: Track referral source from click URLs**:
- Direct (no referrer)
- Search engine (Google, Bing, DuckDuckGo)
- Social (Twitter, LinkedIn, Facebook, Reddit)
- Website (referrer domain)
- Email client (Gmail web, Outlook web, Apple Mail, etc.)

### 7.3 Campaign Analytics Dashboard (Enhanced)
For each campaign, show Matomo-level detail:

**Summary cards**: Sent, Delivered, Opened, Clicked, Bounced, Unsubscribed (already done)

**New sections**:

| Section | What It Shows |
|---------|---------------|
| **Referral Sources** | Where clicks came from: Direct, Search, Social, Email Client |
| **Top Pages Visited** | Which URLs recipients clicked, with pageview counts |
| **Geographic Map** | Country/city heatmap of opens/clicks |
| **Device Breakdown** | Desktop vs Mobile vs Tablet, with OS and browser |
| **Email Client** | Gmail, Outlook, Apple Mail, Yahoo, Thunderbird, etc. |
| **Time-of-Day Heatmap** | When recipients open emails (already built, enhance) |
| **Click Flow** | Which link → which page → how long on page |
| **Top Movers** | Contacts with biggest engagement changes |

### 7.4 Backend: Enhanced Event Storage

**Add to D1 tracking schema** (Worker-side):
```sql
-- Already have: events (id, email_id, type, link_id, ip, ua, created_at)
-- Add columns:
ALTER TABLE events ADD COLUMN country TEXT;
ALTER TABLE events ADD COLUMN city TEXT;
ALTER TABLE events ADD COLUMN device_type TEXT; -- desktop, mobile, tablet
ALTER TABLE events ADD COLUMN browser TEXT;
ALTER TABLE events ADD COLUMN os TEXT;
ALTER TABLE events ADD COLUMN email_client TEXT;
ALTER TABLE events ADD COLUMN referrer TEXT;
```

**Worker enhancement**: Parse CF headers + User-Agent at event time:
```javascript
// In Worker fetch handler, after logging event:
const country = request.headers.get('cf-ipcountry') || ''
const city = request.cf?.city || ''
const ua = request.headers.get('user-agent') || ''
const { browser, os, device } = parseUserAgent(ua)
const emailClient = detectEmailClient(ua)
```

**Backend API endpoints**:
```
GET /analytics/campaigns/:id/geo         → country/city breakdown
GET /analytics/campaigns/:id/devices     → device/browser/OS breakdown
GET /analytics/campaigns/:id/clients     → email client breakdown
GET /analytics/campaigns/:id/referrers   → referral source breakdown
GET /analytics/campaigns/:id/pages       → top clicked URLs with pageviews
GET /analytics/campaigns/:id/timeline    → hour-by-hour open/click activity
GET /analytics/contacts/:id/profile      → full recipient profile
GET /analytics/contacts/:id/engagement   → per-campaign engagement data
```

### 7.5 Campaign Builder UX Improvements

**Tooltips everywhere**:
- Subject line → "Use {{FirstName}} for personalization. Keep under 50 chars."
- From Name → "Recipients see this as the sender name"
- Reply-To → "Where replies go. Leave empty to use From address"
- Batch Size → "How many emails to send per batch. Lower = safer for new domains"
- Email Delay → "Seconds between individual emails within a batch"
- Batch Delay → "Seconds between batches. Helps avoid rate limits"
- A/B Test → "Test different subjects or content. Winner is auto-declared"
- Schedule → "Send at a specific time. Uses server timezone"
- Frequency Cap → "Maximum emails this contact can receive per week"

**Campaign type selector with descriptions**:
```
┌─────────────────────────────────────────────┐
│ Campaign Type                               │
│                                             │
│ ● One-Time Campaign                         │
│   Send once to a contact list.              │
│   Best for: newsletters, announcements      │
│                                             │
│ ○ A/B Test                                  │
│   Test variants, auto-pick winner.          │
│   Best for: optimizing subject/content      │
│                                             │
│ ○ Recurring                                 │
│   Repeat on schedule (daily/weekly/monthly) │
│   Best for: digest emails, reports          │
│                                             │
│ ○ Automation-Triggered                      │
│   Sent by automation flows.                 │
│   Best for: welcome series, drip campaigns  │
└─────────────────────────────────────────────┘
```

**Step-by-step campaign wizard** (instead of one big form):
1. **Recipients** → Select list/segment, show count, preview sample
2. **Content** → Choose template or compose, preview with real data
3. **Sender** → From name, from email, reply-to (with domain validation)
4. **Settings** → Batch config, tracking, frequency cap, A/B test
5. **Schedule** → Send now, schedule for later, or save as draft
6. **Review** → Summary of everything before sending

---

## Execution Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Router fix | Done | Critical — was breaking navigation |
| 2 | Platform admin no-org enforcement | 2h | Critical — user asked 10 times |
| 3 | Org slug picker + availability | 2h | High — identity system |
| 4 | User username system | 2h | High — identity system |
| 5 | Sending domain management | 4h | High — domain-level email control |
| 6 | Sending email per domain + user assignment | 3h | High — multi-email support |
| 7 | Manual/smart server rotation per campaign | 4h | High — MailWizz parity |
| 8 | Bounce API polling service | 3h | Medium — backup bounce collection |
| 9 | Professional starter templates (10) | 4h | Medium — better out-of-box |
| 10 | Live preview with contact data | 2h | Medium — better template editing |
| 11 | Form webhook receiver | 2h | Medium — connect external forms |
| 12 | Platform admin dashboard separation | 3h | High — enforce no-org context |
| 13 | Deep analytics: UA/geo parsing in Worker | 3h | High — Matomo-level data capture |
| 14 | Deep analytics: campaign breakdown dashboards | 4h | High — geo, device, client, referrer |
| 15 | Deep analytics: recipient profile page | 3h | High — full contact engagement view |
| 16 | Campaign builder wizard + tooltips | 4h | High — better onboarding UX |

**Total**: ~47 hours

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Router fix | Done | Critical — was breaking navigation |
| 2 | Platform admin no-org enforcement | 2h | Critical — user asked 10 times |
| 3 | Org slug picker + availability | 2h | High — identity system |
| 4 | User username system | 2h | High — identity system |
| 5 | Sending domain management | 4h | High — domain-level email control |
| 6 | Sending email per domain + user assignment | 3h | High — multi-email support |
| 7 | Manual/smart server rotation per campaign | 4h | High — MailWizz parity |
| 8 | Bounce API polling service | 3h | Medium — backup bounce collection |
| 9 | Professional starter templates (10) | 4h | Medium — better out-of-box |
| 10 | Live preview with contact data | 2h | Medium — better template editing |
| 11 | Form webhook receiver | 2h | Medium — connect external forms |
| 12 | Platform admin dashboard separation | 3h | High — enforce no-org context |

**Total**: ~33 hours
