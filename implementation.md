# MailFlow - Implementation Plan

## Current State: 6.5/10
**Stack**: Bun + Hono backend, Vue 3 + TypeScript frontend
**DB**: Hybrid bun:sqlite + Cloudflare D1 (needs consolidation)
**UI**: Custom SCSS, dark theme, 5 views, 8 components

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Database Consolidation
**Goal**: Single source of truth with bun:sqlite + Drizzle ORM

**Why**: Current D1 HTTP bridge adds 1000x latency per query. Dual DB creates sync issues.

**Tasks**:
- [ ] Install Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- [ ] Define schema in `src/db/schema.ts` with all tables:
  ```
  users          - id (uuid), email, name, password_hash, created_at, updated_at
  sessions       - id (uuid), user_id (FK), token, expires_at, created_at
  smtp_configs   - id (uuid), user_id (FK), name, provider, host, port, user, pass, is_default, created_at
  oauth_tokens   - id (uuid), user_id (FK), provider, access_token, refresh_token, expires_at
  contacts       - id (uuid), user_id (FK), email, first_name, last_name, company, tags, custom_fields (JSON), status, created_at
  contact_lists  - id (uuid), user_id (FK), name, description, created_at
  contact_list_members - contact_id (FK), list_id (FK)
  templates      - id (uuid), user_id (FK), name, subject, html_content, text_content, placeholders (JSON), created_at, updated_at
  campaigns      - id (uuid), user_id (FK), name, subject, from_email, from_name, template_id (FK), list_id (FK), config_id (FK), status, total_recipients, scheduled_at, sent_at, completed_at, created_at
  campaign_emails - id (uuid), campaign_id (FK), contact_id (FK), status, message_id, sent_at, opened_at, clicked_at, bounced_at, error_message
  tracking_events - id (uuid), campaign_id (FK), email_id (FK), event_type, link_url, user_agent, ip_address, device_type, timestamp
  scheduled_jobs  - id (uuid), user_id (FK), campaign_id (FK), scheduled_time, status, config (JSON), created_at, started_at, completed_at
  automation_workflows - id (uuid), user_id (FK), name, trigger_type, status, steps (JSON), created_at
  webhook_endpoints - id (uuid), user_id (FK), url, events (JSON), secret, active, created_at
  audit_log       - id (uuid), user_id (FK), action, entity_type, entity_id, details (JSON), ip_address, timestamp
  ```
- [ ] Set production PRAGMAs on DB init:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA cache_size = -64000;
  PRAGMA foreign_keys = ON;
  PRAGMA auto_vacuum = INCREMENTAL;
  PRAGMA temp_store = MEMORY;
  ```
- [ ] Replace `Date.now()` IDs with `crypto.randomUUID()`
- [ ] Create migration files with `drizzle-kit`
- [ ] Migrate data from D1 tables to local SQLite
- [ ] Remove `d1Service.ts` and `d1UserDatabase.ts` (keep Worker for tracking pixels only)
- [ ] Update all services to use Drizzle queries
- [ ] Add Litestream config for continuous backups to S3/R2

**Files to create**:
```
src/db/
  index.ts          - DB singleton with PRAGMAs
  schema.ts         - Drizzle schema definitions
  migrate.ts        - Migration runner
drizzle/
  migrations/       - Generated SQL migration files
drizzle.config.ts   - Drizzle Kit config
```

**Files to modify**:
```
src/services/userDatabase.ts    - Replace with Drizzle queries
src/services/d1UserDatabase.ts  - Remove (consolidate into userDatabase)
src/services/d1Service.ts       - Remove tracking DB calls, keep pixel/click URL generation
src/services/logService.ts      - Switch from JSON file to SQLite
src/services/schedulerService.ts - Use Drizzle for scheduled_jobs
src/routes/auth.ts              - Use new DB layer
src/routes/config.ts            - Use new DB layer
src/routes/dashboard.ts         - Use new DB layer
src/routes/report.ts            - Use new DB layer
```

### 1.2 Security Hardening
**Goal**: Fix critical vulnerabilities before adding features

**Tasks**:
- [ ] Add rate limiting middleware (hono-rate-limiter or custom)
  - Login: 5 attempts per 15 min per IP
  - Registration: 3 per hour per IP
  - Email sending: 10 per minute per user
  - API general: 100 per minute per user
- [ ] Add CSRF protection middleware
- [ ] Enforce HTTPS in production (redirect HTTP -> HTTPS)
- [ ] Validate SESSION_SECRET on startup (throw if missing/default)
- [ ] Add request size limits (10MB max body)
- [ ] Fix file upload security:
  - Validate file type (only .xlsx, .csv)
  - Limit file size (5MB)
  - Sanitize filename (no path traversal)
  - Auto-cleanup after processing
- [ ] Strengthen password policy (12+ chars, complexity)
- [ ] Add email verification on registration
- [ ] Add account lockout after 10 failed login attempts
- [ ] Add List-Unsubscribe header to all sent emails
- [ ] Add audit logging for sensitive actions

---

## Phase 2: UI Redesign (Week 3-5)

### 2.1 Design System Setup
**Goal**: Vercel/Notion/Linear quality UI with Tailwind CSS

**Tasks**:
- [ ] Install Tailwind CSS v4 + PostCSS
- [ ] Configure dark/light mode with CSS variables
- [ ] Define design tokens:
  ```
  Colors: Neutral scale (slate), Primary (cyan/blue), Success, Warning, Danger
  Typography: Inter (sans), JetBrains Mono (mono)
  Spacing: 4px base unit
  Radius: sm(4), md(8), lg(12), xl(16), 2xl(24)
  Shadows: subtle, default, elevated
  ```
- [ ] Remove old SCSS files (main.scss, layout.scss, configs.scss)
- [ ] Add transitions and animations config

### 2.2 Component Library
**Goal**: Reusable, accessible components

**Create base components** (`frontend/src/components/ui/`):
```
Button.vue        - variants: primary, secondary, ghost, danger | sizes: sm, md, lg
Input.vue         - text, email, password, search | with label, error, icon slots
Select.vue        - single/multi select with search
Checkbox.vue      - with label and description
Toggle.vue        - on/off switch
Badge.vue         - status badges with dot indicator
Card.vue          - with header, body, footer slots
Table.vue         - sortable, selectable, with pagination
DataTable.vue     - virtual scrolling for large datasets
Modal.vue         - accessible, focus trap, backdrop close
Dialog.vue        - confirmation dialogs
Toast.vue         - notification toasts (success, error, warning, info)
Dropdown.vue      - menu dropdown with keyboard navigation
Tabs.vue          - tab navigation
Tooltip.vue       - hover tooltips
Skeleton.vue      - loading skeletons
EmptyState.vue    - illustrated empty states
CommandPalette.vue - Cmd+K command palette
Avatar.vue        - user avatar with fallback
Breadcrumb.vue    - breadcrumb navigation
Progress.vue      - progress bar
Spinner.vue       - loading spinner
```

**Create layout components** (`frontend/src/components/layout/`):
```
AppLayout.vue     - shared sidebar + header + main content area
Sidebar.vue       - collapsible, with nav items, user menu, theme toggle
Header.vue        - page title, breadcrumbs, actions slot
PageWrapper.vue   - consistent page padding, max-width, animations
```

### 2.3 Page Redesign
**Goal**: Modern SaaS UX for all existing pages

**Login page** (`/login`):
- [ ] Clean, centered form (Vercel style)
- [ ] Social login buttons (Google, Microsoft)
- [ ] Password strength meter
- [ ] Email verification flow
- [ ] Forgot password link

**Dashboard** (`/`):
- [ ] KPI cards with sparkline trends
- [ ] Campaign performance chart (opens, clicks over time)
- [ ] Recent campaigns table
- [ ] Active jobs with real-time progress
- [ ] Quick actions grid
- [ ] Activity feed

**Compose** (`/compose`):
- [ ] Step-by-step wizard OR side-by-side editor
- [ ] Template selector
- [ ] Contact list selector (from contacts page)
- [ ] Improved Quill editor with image upload
- [ ] Live preview panel
- [ ] Spam score checker
- [ ] Send test email button
- [ ] Auto-save drafts

**Reports** (`/reports`):
- [ ] Charts: open rate, click rate, bounce rate over time
- [ ] Campaign comparison table
- [ ] Click heatmap per email
- [ ] Domain performance breakdown
- [ ] Export: CSV, PDF
- [ ] Saved filters/views

**Configs** (`/configs`):
- [ ] Card-based layout for providers
- [ ] Inline connection testing
- [ ] SMTP configuration wizard
- [ ] OAuth flow with status indicators
- [ ] Default provider selection

### 2.4 New Pages
**Goal**: Fill feature gaps

**Contacts** (`/contacts`) - NEW:
- [ ] Contact list with search, filter, sort
- [ ] Import from CSV/Excel
- [ ] Manual add/edit contact
- [ ] Bulk actions (tag, delete, move to list)
- [ ] Contact detail slide panel (info, email history, engagement)
- [ ] List management (create, rename, delete lists)
- [ ] Segmentation by tags, engagement, custom fields
- [ ] Deduplication detection
- [ ] Export contacts

**Templates** (`/templates`) - NEW:
- [ ] Template gallery with preview cards
- [ ] Create/edit with WYSIWYG editor
- [ ] Duplicate template
- [ ] Template categories/folders
- [ ] Placeholder variable insertion
- [ ] Preview in desktop/mobile view
- [ ] Import HTML template

**Automation** (`/automation`) - NEW:
- [ ] Workflow list with status (active/paused/draft)
- [ ] Visual workflow builder:
  - Triggers: contact added, tag applied, email opened/clicked, schedule
  - Conditions: if opened, if clicked, wait X days, if tag
  - Actions: send email, add tag, remove from list, webhook
- [ ] Sequence builder (simpler: email 1 -> wait -> email 2 -> wait -> email 3)
- [ ] Workflow templates (welcome series, follow-up, re-engagement)
- [ ] Performance stats per workflow

**Settings** (`/settings`) - NEW:
- [ ] Profile: name, email, password change
- [ ] Security: 2FA setup, active sessions, login history
- [ ] API keys: generate, revoke, permissions
- [ ] Webhooks: add endpoint, select events, test
- [ ] Notifications: email preferences
- [ ] Billing: plan, usage, invoices (placeholder)
- [ ] Team: invite members, roles (placeholder)

**404 page** - NEW:
- [ ] Clean "page not found" with navigation back

---

## Phase 3: Backend Features (Week 5-7)

### 3.1 Contact Management API
```
GET    /api/contacts              - List contacts (paginated, filterable)
GET    /api/contacts/:id          - Get single contact
POST   /api/contacts              - Create contact
PUT    /api/contacts/:id          - Update contact
DELETE /api/contacts/:id          - Delete contact
POST   /api/contacts/import       - Bulk import from CSV/Excel
POST   /api/contacts/export       - Export contacts
GET    /api/contacts/lists        - List contact lists
POST   /api/contacts/lists        - Create list
PUT    /api/contacts/lists/:id    - Update list
DELETE /api/contacts/lists/:id    - Delete list
POST   /api/contacts/lists/:id/add    - Add contacts to list
POST   /api/contacts/lists/:id/remove - Remove contacts from list
POST   /api/contacts/deduplicate  - Find and merge duplicates
```

### 3.2 Template Management API
```
GET    /api/templates             - List templates
GET    /api/templates/:id         - Get template
POST   /api/templates             - Create template
PUT    /api/templates/:id         - Update template
DELETE /api/templates/:id         - Delete template
POST   /api/templates/:id/duplicate - Clone template
POST   /api/templates/import      - Import HTML
```

### 3.3 Campaign Management API (Enhanced)
```
GET    /api/campaigns             - List campaigns
GET    /api/campaigns/:id         - Campaign detail with stats
POST   /api/campaigns             - Create campaign
PUT    /api/campaigns/:id         - Update draft campaign
DELETE /api/campaigns/:id         - Delete campaign
POST   /api/campaigns/:id/send    - Start sending
POST   /api/campaigns/:id/pause   - Pause sending
POST   /api/campaigns/:id/resume  - Resume sending
POST   /api/campaigns/:id/cancel  - Cancel campaign
GET    /api/campaigns/:id/emails  - List individual email statuses
POST   /api/campaigns/:id/test    - Send test email
```

### 3.4 Automation Engine
```
GET    /api/automations           - List workflows
GET    /api/automations/:id       - Get workflow
POST   /api/automations           - Create workflow
PUT    /api/automations/:id       - Update workflow
DELETE /api/automations/:id       - Delete workflow
POST   /api/automations/:id/activate   - Activate
POST   /api/automations/:id/deactivate - Pause
GET    /api/automations/:id/stats      - Performance stats
```

**Automation Engine Implementation** (`src/services/automationService.ts`):
- Step executor with delay handling
- Condition evaluator (opened? clicked? tagged?)
- Trigger listener (new contact, tag applied, schedule)
- Queue processing with persistence
- Rate limiting per automation

### 3.5 Email Improvements
- [ ] Add retry logic (3 retries with exponential backoff)
- [ ] Add email queue with persistence (SQLite-backed)
- [ ] Add bounce handling (parse DSN emails)
- [ ] Add List-Unsubscribe header (RFC 8058)
- [ ] Add text/plain alternative (multipart/alternative)
- [ ] Add attachment support
- [ ] Add unsubscribe management endpoint
- [ ] Add spam score checking (basic heuristic)
- [ ] Add CC/BCC support
- [ ] Generate text/plain from HTML automatically

### 3.6 Webhook System
```
GET    /api/webhooks              - List webhook endpoints
POST   /api/webhooks              - Create endpoint
PUT    /api/webhooks/:id          - Update endpoint
DELETE /api/webhooks/:id          - Delete endpoint
POST   /api/webhooks/:id/test     - Send test event
```

**Webhook events emitted**:
```
email.sent, email.delivered, email.opened, email.clicked,
email.bounced, email.unsubscribed, campaign.completed,
contact.created, contact.updated, automation.triggered
```

### 3.7 Reporting & Analytics API
```
GET /api/analytics/overview       - KPI summary (opens, clicks, bounces, unsubs)
GET /api/analytics/trends         - Time-series data (daily/weekly/monthly)
GET /api/analytics/campaigns/:id  - Per-campaign deep analytics
GET /api/analytics/domains        - Performance by recipient domain
GET /api/analytics/devices        - Device/client breakdown
GET /api/analytics/geo            - Geographic distribution
```

---

## Phase 4: Integration Layer (Week 7-8)

### 4.1 Xtrusio Outreach Connection
**Goal**: Bidirectional data flow between MailFlow and xtrusio-outreach

**Inbound API** (MailFlow receives from xtrusio):
```
POST /api/integrations/xtrusio/contacts   - Receive contacts with enrichment data
POST /api/integrations/xtrusio/campaign    - Create campaign from xtrusio selection
```

**Outbound Webhooks** (MailFlow pushes to xtrusio):
```
Events: email.sent, email.opened, email.clicked, email.bounced, campaign.completed
Payload: { event, contact_id, campaign_id, timestamp, metadata }
```

**Email Verification** (MailFlow calls xtrusio):
```
Before sending: POST http://localhost:5301/api/email/verify-bulk
Validate contacts before campaign send
```

**Shared Contract**:
```typescript
// Contact format both sides understand
interface SharedContact {
  email: string
  firstName?: string
  lastName?: string
  company?: string
  domain?: string
  source: 'xtrusio' | 'mailflow' | 'import'
  enrichment?: {
    industry?: string
    companySize?: string
    products?: string
    confidence?: 'high' | 'medium' | 'low'
  }
}

// Campaign status
type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed'

// Webhook event
interface WebhookEvent {
  event: string
  timestamp: string
  data: {
    campaign_id: string
    contact_email: string
    contact_id?: string
    metadata?: Record<string, unknown>
  }
}
```

### 4.2 API Key Authentication
- [ ] Generate API keys per user (prefix: `mf_live_` / `mf_test_`)
- [ ] API key auth middleware (alongside session auth)
- [ ] Key permissions (read, write, admin)
- [ ] Key rotation and revocation
- [ ] Rate limiting per API key

---

## Phase 5: Polish & Production (Week 8-10)

### 5.1 Testing
- [ ] Setup Vitest for unit tests
- [ ] Setup @testing-library/vue for component tests
- [ ] Setup Playwright for E2E tests
- [ ] Target: 70% coverage on critical paths
  - Auth flow
  - Email sending
  - Contact management
  - Campaign creation
  - Batch processing

### 5.2 Developer Experience
- [ ] Add ESLint + Prettier config
- [ ] Add pre-commit hooks (Husky + lint-staged)
- [ ] Add TypeScript strict mode
- [ ] Add `CLAUDE.md` with project conventions
- [ ] Add `.env.example` with all variables documented

### 5.3 Operational Readiness
- [ ] Add structured logging (JSON format)
- [ ] Add Sentry error tracking (frontend + backend)
- [ ] Add graceful shutdown handler
- [ ] Add database health check in `/health` endpoint
- [ ] Add log rotation (max 100MB, keep 7 days)
- [ ] Add monitoring endpoint (`/metrics`)
- [ ] Setup Litestream for SQLite backups
- [ ] Add Docker Compose for local development

### 5.4 Performance
- [ ] Add database indexes:
  ```sql
  CREATE INDEX idx_contacts_user_email ON contacts(user_id, email);
  CREATE INDEX idx_contacts_list ON contact_list_members(list_id);
  CREATE INDEX idx_campaign_emails_status ON campaign_emails(campaign_id, status);
  CREATE INDEX idx_tracking_campaign ON tracking_events(campaign_id, event_type);
  CREATE INDEX idx_tracking_timestamp ON tracking_events(timestamp);
  CREATE INDEX idx_campaigns_user ON campaigns(user_id, status);
  CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp);
  CREATE INDEX idx_sessions_token ON sessions(token);
  ```
- [ ] Add virtual scrolling for large contact lists
- [ ] Add response compression (gzip/brotli)
- [ ] Add static asset caching headers
- [ ] Add service worker for offline dashboard

### 5.5 Compliance
- [ ] Add CAN-SPAM compliant unsubscribe flow
- [ ] Add GDPR data export endpoint
- [ ] Add GDPR data deletion endpoint
- [ ] Add consent tracking in contacts table
- [ ] Add privacy policy link in email footer
- [ ] Add physical address field in settings (CAN-SPAM requirement)

---

## Architecture After Implementation

```
bulk-email-sender/
  src/
    app.ts                    - Hono app entry
    db/
      index.ts                - DB singleton + PRAGMAs
      schema.ts               - Drizzle schema (all tables)
      migrate.ts              - Migration runner
    config/
      index.ts                - All configuration
    middleware/
      auth.ts                 - Session + API key auth
      rateLimit.ts            - Rate limiting
      csrf.ts                 - CSRF protection
    routes/
      auth.ts                 - Login, register, verify email
      oauth.ts                - Google/Microsoft OAuth
      contacts.ts             - Contact CRUD + lists     [NEW]
      templates.ts            - Template CRUD             [NEW]
      campaigns.ts            - Campaign management       [ENHANCED]
      automations.ts          - Workflow CRUD             [NEW]
      webhooks.ts             - Webhook management        [NEW]
      analytics.ts            - Reporting & analytics     [NEW]
      integrations.ts         - Xtrusio connection        [NEW]
      settings.ts             - User settings             [NEW]
      tracking.ts             - Pixel/click tracking
      health.ts               - Health check
    services/
      emailService.ts         - Email sending (with retry)
      queueService.ts         - Persistent email queue    [NEW]
      batchService.ts         - Batch processing
      schedulerService.ts     - Job scheduling
      automationService.ts    - Workflow engine           [NEW]
      contactService.ts       - Contact management        [NEW]
      templateService.ts      - Template management       [NEW]
      webhookService.ts       - Webhook dispatcher        [NEW]
      analyticsService.ts     - Stats aggregation         [NEW]
      auditService.ts         - Audit logging             [NEW]
      fileService.ts          - File upload/parsing
      oauthService.ts         - OAuth flows
      notificationService.ts  - Email notifications
    utils/
      validation.ts           - Input validation (with zod)
      response.ts             - Response helpers
      oauth.ts                - OAuth utilities
    types/
      index.ts                - All TypeScript types
  drizzle/
    migrations/               - SQL migration files
  drizzle.config.ts
  frontend/
    src/
      components/
        ui/                   - 20+ reusable components    [NEW]
        layout/               - AppLayout, Sidebar, Header [RESTRUCTURED]
        compose/              - Email editor components
        contacts/             - Contact management UI      [NEW]
        campaigns/            - Campaign components        [NEW]
        automation/           - Workflow builder            [NEW]
      views/
        LoginView.vue         - [REDESIGNED]
        DashboardView.vue     - [REDESIGNED]
        ComposeView.vue       - [REDESIGNED]
        ContactsView.vue      - [NEW]
        TemplatesView.vue     - [NEW]
        AutomationView.vue    - [NEW]
        ReportsView.vue       - [REDESIGNED]
        ConfigsView.vue       - [REDESIGNED]
        SettingsView.vue      - [NEW]
        NotFoundView.vue      - [NEW]
      lib/
        api.ts                - API client
        query.ts              - TanStack Query composables
      stores/
        auth.ts               - Auth state
        ui.ts                 - Theme, toasts, modals     [NEW]
      router/
        index.ts              - All routes
    tailwind.config.ts        - Tailwind configuration     [NEW]
```

---

## Tech Stack (Final)

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Backend Framework | Hono |
| Database | bun:sqlite (single file) |
| ORM | Drizzle ORM |
| Frontend | Vue 3 + TypeScript |
| State | TanStack Vue Query |
| Styling | Tailwind CSS v4 |
| Icons | Lucide Vue |
| Editor | Quill (or TipTap upgrade) |
| Validation | Zod (shared frontend + backend) |
| Testing | Vitest + Playwright |
| Error Tracking | Sentry |
| Backups | Litestream -> S3/R2 |

---

## Milestones

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1 | DB Foundation | Drizzle schema, migrations, consolidated DB |
| 2 | Security | Rate limiting, CSRF, file validation, audit log |
| 3 | Design System | Tailwind setup, 20+ components, AppLayout |
| 4 | Page Redesign | Dashboard, Compose, Reports, Configs redesigned |
| 5 | Contacts & Templates | Full contact management + template library |
| 6 | Campaign & Email | Enhanced campaigns, retry logic, queue, unsubscribe |
| 7 | Automation | Workflow builder, sequence engine, triggers |
| 8 | Integration | Xtrusio connection, webhooks, API keys |
| 9 | Testing & Polish | 70% test coverage, Sentry, structured logging |
| 10 | Production | Litestream backups, Docker, monitoring, compliance |

---

## Success Criteria

**Technical**:
- Single database (bun:sqlite) with Drizzle ORM
- 70%+ test coverage on critical paths
- TypeScript strict mode enabled
- Zero critical security vulnerabilities
- < 100ms API response time (p95)
- < 2s page load time

**Product**:
- Contact management with lists and segmentation
- Template library with WYSIWYG editor
- Basic automation (sequences + conditions)
- Campaign analytics with charts
- Xtrusio integration working bidirectionally
- Unsubscribe management (CAN-SPAM compliant)

**UX**:
- Vercel/Notion-quality design with dark/light mode
- Command palette (Cmd+K)
- Loading skeletons on all pages
- Toast notifications for all actions
- Keyboard navigation support
- Mobile-responsive layout
