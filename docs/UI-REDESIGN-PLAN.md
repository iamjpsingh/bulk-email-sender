# Dispatch — UI/UX Redesign Plan

**Goal**: Every page is a complete mini-app with proper navigation, drill-down, and SaaS-level UX.
**Reference**: HubSpot Marketing Hub, Mautic, Mailchimp, Matomo
**Components**: shadcn-vue (reka-ui) + Tailwind CSS v4

---

## Research-Backed Design Patterns

Based on analysis of HubSpot, Mautic, Matomo, and Mailchimp:

### Pattern 1: List → Detail with Tabs (HubSpot + Mautic)
Every entity (campaign, contact, form, page) has:
- **List page**: Table/cards with search, filters, bulk actions
- **Detail page**: Header with status + Stats row + Tabbed content
- Tabs keep related info grouped without overwhelming

### Pattern 2: Consistent Analytics Skeleton (Matomo)
Every analytics view follows the same structure:
- **Sparkline stat cards** at top (small inline trends)
- **Evolution chart** below (line/bar chart with date range)
- **Data table** at bottom (sortable, drill-down rows, export)

### Pattern 3: Scrollable Report (Mailchimp)
Email reports use a single scrollable page with clear sections:
- Stats cards → 24h chart → Click map → Top links → Activity breakdown
- No tabs needed — just scroll. Each section has a clear heading.

### Pattern 4: Contact 3-Column Layout (HubSpot)
Contact detail uses three columns:
- **Left**: Properties card (name, email, score, tags)
- **Middle**: Tabs (Activity timeline, Campaigns, Preferences)
- **Right**: Associations (lists, segments, automations)

### Pattern 5: Widget Dashboard (All platforms)
Dashboard uses clickable Card widgets. Every metric links to detail.

---

## Design Principles

1. **List → Detail → Sub-detail** — Never cram everything on one page
2. **Breadcrumbs everywhere** — User always knows where they are
3. **Progressive disclosure** — Summary first, drill deeper on click
4. **Consistent skeletons** — All list pages look the same. All detail pages look the same.
5. **Clickable stat cards** — Every number links to its source data
6. **Empty states guide action** — Not "nothing here" but "Here's how to start"
7. **Tabs, not page cramming** — Related data in tabs, not all visible at once

---

## New shadcn Components Installed

- `Breadcrumb` — BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage
- `Card` — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `Accordion` — Accordion, AccordionItem, AccordionTrigger, AccordionContent

---

## Navigation Pattern

Every page that has a detail view gets **nested routes**:

```
/campaigns                    → CampaignsView (list)
/campaigns/:id                → CampaignDetailView (detail)
/campaigns/:id/analytics      → Campaign analytics tab
/campaigns/:id/recipients     → Campaign recipients tab

/contacts                     → ContactsView (list with sidebar)
/contacts/:id                 → ContactDetailView (timeline, preferences, activity)

/forms                        → FormsView (list)
/forms/:id                    → FormDetailView (submissions, analytics, embed)

/pages                        → PagesView (list)
/pages/:id                    → PageDetailView (editor, analytics, settings)

/templates                    → TemplatesView (list)
/templates/:id/edit           → Template editor (full screen)

/analytics                    → AnalyticsOverview (summary cards → drill down)
/analytics/campaigns          → Campaign performance deep-dive
/analytics/contacts           → Contact engagement analytics
/analytics/deliverability     → Bounce/complaint/reputation

/settings/api-keys            → API key management (full CRUD)
/settings/webhooks            → Webhook management (full CRUD)
```

Breadcrumb auto-generated from route.matched + meta.breadcrumb.

---

## Page-by-Page Redesign

### 1. Dashboard (`/`)

**Current**: Stats + Active Jobs + Quick Actions
**Redesign**: Command center with deep links

```
┌─────────────────────────────────────────────────────┐
│ Good morning, JP                                     │
│ Here's what's happening with your email campaigns    │
├─────────────────────────────────────────────────────┤
│                                                       │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ 12,450  │ │ 98.2%   │ │ 34.5%   │ │ 4.2%    │   │
│ │ Sent    │ │ Deliver │ │ Opens   │ │ Clicks  │   │
│ │ →       │ │ →       │ │ →       │ │ →       │   │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│  (click any card → goes to /analytics)               │
│                                                       │
│ ┌─ Active Campaigns ──────────────────────────────┐ │
│ │ March Newsletter   ████████░░ 82%  [View →]     │ │
│ │ Welcome Sequence   ███░░░░░░░ 34%  [View →]     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─ Recent Activity ───────────────────────────────┐ │
│ │ 2m ago   Campaign "Q1 Report" completed          │ │
│ │ 15m ago  New contact imported (150 contacts)     │ │
│ │ 1h ago   Form "Newsletter" got 12 submissions    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─ Quick Stats ───────────────────────────────────┐ │
│ │ Contacts: 5,234  |  Lists: 12  |  Automations: 3│ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Key changes**:
- Every stat card is a `<router-link>` to the relevant detail page
- Active campaigns show progress with direct "View" link to `/campaigns/:id`
- Recent Activity section replaces the quick-actions grid
- Quick stats row at bottom links to respective pages

---

### 2. Campaigns (`/campaigns`)

**Current**: Cards with actions — good
**Redesign**: Keep cards but add better filtering + status pipeline

```
Breadcrumb: Dashboard > Campaigns

┌─ Pipeline View (optional toggle) ────────────────┐
│ Draft(3)  │  Scheduled(2)  │  Sending(1)  │ Done(45) │
└──────────────────────────────────────────────────┘

┌─ List View (default) ────────────────────────────┐
│ [Search...] [Status ▾] [Type ▾] [Date ▾] [+New]  │
│                                                    │
│ ┌─ Card ──────────────────────────────────────┐  │
│ │ March Newsletter          SENDING  82%       │  │
│ │ 12,000 recipients · 34% open · 4.2% click   │  │
│ │ [View Details →]                              │  │
│ └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Campaign Detail** (`/campaigns/:id`) — ALREADY EXISTS, needs tabs:

```
Breadcrumb: Dashboard > Campaigns > March Newsletter

┌─ Header ─────────────────────────────────────────┐
│ March Newsletter                      [SENDING]   │
│ Created Mar 15 · 12,000 recipients                │
│ [Pause] [Clone] [Archive]                         │
├──────────────────────────────────────────────────┤
│ [Overview] [Recipients] [Analytics] [Activity]    │
├──────────────────────────────────────────────────┤
│                                                    │
│ Overview tab:                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │Sent  │ │Opens │ │Click │ │Bounce│ │Unsub │   │
│ │9,840 │ │34.5% │ │4.2%  │ │0.8%  │ │0.2%  │   │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│                                                    │
│ ┌─ Performance Over Time (line chart) ──────────┐│
│ │  opens ── clicks ── bounces over hours         ││
│ └────────────────────────────────────────────────┘│
│                                                    │
│ ┌─ Top Clicked Links ──────────────────────────┐ │
│ │ 1. https://example.com/pricing    234 clicks  │ │
│ │ 2. https://example.com/demo       89 clicks   │ │
│ └───────────────────────────────────────────────┘ │
│                                                    │
│ Recipients tab:                                    │
│ Table of all recipients with status per person     │
│ [Search] [Filter by status]                        │
│                                                    │
│ Analytics tab:                                     │
│ Device breakdown, email client, geo, send time     │
│                                                    │
│ Activity tab:                                      │
│ Timeline: "Opened by john@..." "Clicked by..."     │
└──────────────────────────────────────────────────┘
```

---

### 3. Contacts (`/contacts`)

**Current**: List + sidebar for lists — good base
**Add**: Contact detail page

**Contact Detail** (`/contacts/:id`) — NEW PAGE:

```
Breadcrumb: Dashboard > Contacts > john@example.com

┌─ Header ─────────────────────────────────────────┐
│ ┌─────┐ John Doe                    Score: 78 🔥  │
│ │ JD  │ john@example.com                          │
│ └─────┘ Active · VIP · Newsletter                 │
├──────────────────────────────────────────────────┤
│ [Activity] [Campaigns] [Preferences] [Details]    │
├──────────────────────────────────────────────────┤
│                                                    │
│ Activity tab:                                      │
│ Timeline: opened, clicked, imported, tagged...     │
│                                                    │
│ Campaigns tab:                                     │
│ List of campaigns this contact received + status   │
│                                                    │
│ Preferences tab:                                   │
│ Subscriptions, frequency, channels                 │
│                                                    │
│ Details tab:                                       │
│ Edit contact fields, custom fields, tags           │
└──────────────────────────────────────────────────┘
```

---

### 4. Forms (`/forms`)

**Current**: Card list + SlidePanel editor
**Redesign**: Full detail page per form

**Forms List** (`/forms`):
```
Breadcrumb: Dashboard > Forms

┌─ Header ──────────────────────────────────────────┐
│ Forms                              [+ New Form]    │
├───────────────────────────────────────────────────┤
│                                                     │
│ ┌─ Card ─────────────────────────────────────┐    │
│ │ Newsletter Signup           ACTIVE          │    │
│ │ 1,234 submissions · 45% conversion          │    │
│ │ Last submission: 2 hours ago                 │    │
│ │ [View Details →]  [Embed Code]  [Toggle]    │    │
│ └─────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

**Form Detail** (`/forms/:id`) — NEW PAGE:

```
Breadcrumb: Dashboard > Forms > Newsletter Signup

┌─ Header ──────────────────────────────────────────┐
│ Newsletter Signup                    [ACTIVE]       │
│ Connected to list: Newsletter Subscribers           │
│ [Edit] [Embed] [Disable]                           │
├───────────────────────────────────────────────────┤
│ [Overview] [Submissions] [Settings] [Embed Code]   │
├───────────────────────────────────────────────────┤
│                                                     │
│ Overview tab:                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ 1,234    │ │ 45%      │ │ 23       │           │
│ │ Total    │ │ Conv.    │ │ Today    │           │
│ └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│ ┌─ Submissions Over Time (chart) ─────────────┐   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Submissions tab:                                    │
│ Table: email, name, date, source, status            │
│ [Search] [Export CSV]                               │
│                                                     │
│ Settings tab:                                       │
│ Name, target list, success message, redirect URL,   │
│ field mapping, actions, allowed domains              │
│                                                     │
│ Embed Code tab:                                     │
│ ┌─ HTML ────────────────────────────────────────┐ │
│ │ <script src="dispatch.js/forms/abc123"></script>│ │
│ │ [Copy]                                          │ │
│ ├─ React / Next.js ──────────────────────────────┤ │
│ │ npm install @dispatch/forms                     │ │
│ │ <DispatchForm id="abc123" />                    │ │
│ │ [Copy]                                          │ │
│ ├─ API ──────────────────────────────────────────┤ │
│ │ POST /api/forms/abc123/submit                   │ │
│ │ { "email": "...", "name": "..." }               │ │
│ │ [Copy]                                          │ │
│ └─────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────┘
```

**Connect External Form** — In embed tab, show:
- JavaScript snippet (works with ANY website)
- API endpoint (works with ANY framework)
- HTML form action (simplest)

This way React, Next.js, WordPress, anything can submit to Dispatch.

---

### 5. Pages (`/pages`)

**Current**: Card list + HTML editor
**Redesign**: Full detail page + visual editor option

**Page Detail** (`/pages/:id`) — NEW PAGE:

```
Breadcrumb: Dashboard > Pages > My Landing Page

┌─ Header ──────────────────────────────────────────┐
│ My Landing Page                  [PUBLISHED]        │
│ /p/my-landing-page · 1,234 views                   │
│ [Edit] [Preview] [Unpublish]                        │
├───────────────────────────────────────────────────┤
│ [Overview] [Editor] [Settings]                      │
├───────────────────────────────────────────────────┤
│                                                     │
│ Overview tab:                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ 1,234    │ │ 89       │ │ 7.2%     │           │
│ │ Views    │ │ Form     │ │ Conv.    │           │
│ │          │ │ Submits  │ │ Rate     │           │
│ └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│ ┌─ Traffic Over Time (chart) ──────────────────┐  │
│ └──────────────────────────────────────────────┘  │
│                                                     │
│ Editor tab:                                         │
│ [Visual] [Code] toggle                              │
│ Full-height GrapesJS editor OR code editor          │
│                                                     │
│ Settings tab:                                       │
│ Title, slug, linked form, SEO meta, tracking        │
└───────────────────────────────────────────────────┘
```

---

### 6. Analytics (`/analytics`)

**Current**: Everything on one page — too dense
**Redesign**: Overview with drill-down sub-pages

**Analytics Overview** (`/analytics`):
```
Breadcrumb: Dashboard > Analytics

┌──────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐│
│ │ 45       │ │ 125K     │ │ 34.5%    │ │ 4.2% ││
│ │Campaigns │ │ Sent     │ │ Avg Open │ │ Click││
│ └──────────┘ └──────────┘ └──────────┘ └──────┘│
│                                                    │
│ ┌─ Email Health Score ────────────── 82/100 ────┐│
│ │ ████████████████████░░░░  Good                 ││
│ │ Bounce: 0.8% ✓  Complaint: 0.1% ✓  Spam: Low ││
│ └────────────────────────────────────────────────┘│
│                                                    │
│ ┌─ Campaign Performance ── [View All →] ────────┐│
│ │ Top 5 campaigns by open rate (bar chart)       ││
│ └────────────────────────────────────────────────┘│
│                                                    │
│ ┌─ Engagement ──── [View All →] ────────────────┐│
│ │ Send time heatmap (7x8 grid)                   ││
│ └────────────────────────────────────────────────┘│
│                                                    │
│ ┌─ Devices ── [View All →] ─────────────────────┐│
│ │ Desktop 62% · Mobile 31% · Tablet 7%          ││
│ └────────────────────────────────────────────────┘│
│                                                    │
│ [Custom Report Builder →]                          │
└──────────────────────────────────────────────────┘
```

Each section's "View All →" links to a deeper page.

---

### 7. API Keys (`/settings/api-keys`) — FULL BUILD

```
Breadcrumb: Settings > API Keys

┌─ Header ──────────────────────────────────────────┐
│ API Keys                           [+ Create Key]  │
│ Generate keys for programmatic access               │
├───────────────────────────────────────────────────┤
│                                                     │
│ ┌─ Table ─────────────────────────────────────┐   │
│ │ Name      │ Key        │ Scopes  │ Last Used│   │
│ │ Production│ sk_••••abc │ All     │ 2h ago   │   │
│ │ Staging   │ sk_••••def │ Read    │ Never    │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Create modal:                                       │
│ ┌───────────────────────────────────────────────┐ │
│ │ Name: [Production Key           ]              │ │
│ │ Scopes: ☑ Read ☑ Send ☑ Contacts ☐ Admin     │ │
│ │ Expires: [Never ▾]                             │ │
│ │                         [Cancel] [Create]      │ │
│ └───────────────────────────────────────────────┘ │
│                                                     │
│ After creation — show key ONCE:                     │
│ ┌─ ⚠ Copy this key now ────────────────────────┐ │
│ │ sk_live_abc123def456...                [Copy]  │ │
│ │ This key won't be shown again.                 │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

---

### 8. Webhooks (`/settings/webhooks`) — FULL BUILD

```
Breadcrumb: Settings > Webhooks

┌─ Header ──────────────────────────────────────────┐
│ Webhooks                         [+ Add Endpoint]  │
│ Get notified when events happen                     │
├───────────────────────────────────────────────────┤
│                                                     │
│ ┌─ Card ─────────────────────────────────────┐    │
│ │ https://api.example.com/hooks    [ACTIVE]   │    │
│ │ Events: sent, opened, clicked, bounced      │    │
│ │ Last delivery: 5m ago · 99.2% success       │    │
│ │ [Test] [Edit] [Disable] [Delete]            │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ Create/Edit modal:                                  │
│ ┌───────────────────────────────────────────────┐ │
│ │ URL: [https://api.example.com/hooks        ]   │ │
│ │ Events:                                        │ │
│ │ ☑ email.sent     ☑ email.opened               │ │
│ │ ☑ email.clicked  ☑ email.bounced              │ │
│ │ ☑ email.complained ☑ contact.unsubscribed     │ │
│ │ ☐ contact.created  ☐ contact.updated          │ │
│ │                                                │ │
│ │ Secret: [auto-generated HMAC key    ] [Copy]  │ │
│ │                         [Cancel] [Save]        │ │
│ └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

---

## Implementation Order

### Tier 1 — Foundation (do first)
1. Install Breadcrumb + Card components ✅ DONE
2. Add breadcrumb support to router (meta.breadcrumb on all routes)
3. Update MainLayout.vue breadcrumbs to use shadcn Breadcrumb component
4. Create shared `DetailPageLayout` component (header + stats + tabs pattern)

### Tier 2 — Build Empty Pages
5. API Keys — full CRUD with backend wiring
6. Webhooks — full CRUD with backend wiring

### Tier 3 — Add Detail Pages (new routes)
7. Form Detail page (`/forms/:id`) — overview, submissions, settings, embed
8. Page Detail page (`/pages/:id`) — overview, editor, settings
9. Contact Detail page (`/contacts/:id`) — activity, campaigns, preferences

### Tier 4 — Enhance Existing Pages
10. Dashboard — clickable stat cards, recent activity, deep links
11. Analytics — split into overview + sub-pages
12. Campaign Detail — add Recipients + Activity tabs

### Tier 5 — Polish
13. Calendar improvements
14. WhatsApp messaging UI
15. Compose flow refinements

---

## Components to Use

| Pattern | Component |
|---------|-----------|
| Page header with breadcrumb | `Breadcrumb` + `PageHeader` |
| Metric displays | `Card` + `CardHeader` + `CardContent` |
| Drill-down sections | `Card` with `<router-link>` wrapping |
| Tab navigation in detail pages | shadcn `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` |
| Data tables | shadcn `Table` + `AppPagination` |
| Forms in modals | `Modal` + `Label` + `Input` + `flex flex-col gap-2` |
| Status indicators | `StatusBadge` + `Badge` |
| Loading states | `Skeleton` |
| Empty states | `EmptyState` with action buttons |
| Expandable sections | `Accordion` |
| Side editors | `SlidePanel` |
| Confirmations | `ConfirmDialog` |
| Charts | vue-echarts (already installed) |
| Progress | `ProgressBar` |
