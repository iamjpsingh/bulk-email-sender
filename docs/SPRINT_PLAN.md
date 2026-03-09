# Dispatch v3.0 — Agile Sprint Plan

## Overview

- **Methodology**: Agile Scrum
- **Sprint Duration**: 2 weeks each
- **Total Sprints**: 12 (across 3 phases)
- **Story Points**: Fibonacci (1, 2, 3, 5, 8, 13)
- **Velocity Target**: ~20 SP per sprint
- **No ORM**: Raw SQL with `bun:sqlite` + D1 prepared statements

---

## Phase 1: Foundation & Reliability (Sprints 1-4)

### Epic 1: Persistent Job Queue
> Replace in-memory batch state with SQLite-backed persistent queue

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E1-S1 | As a developer, I can create `data/queue.db` with jobs, dead_letters, suppression_list tables using `bun:sqlite` | 3 | S1 | Backend |
| E1-S2 | As a developer, I can enqueue/dequeue jobs with priority ordering | 5 | S1 | Backend |
| E1-S3 | As a developer, I can checkpoint job progress (last_processed_index) so jobs resume after restart | 5 | S1 | Backend |
| E1-S4 | As a developer, I can pause/resume/cancel jobs via API and state persists in SQLite | 3 | S1 | Backend |
| E1-S5 | As a system, interrupted jobs (status=running) are auto-recovered on server startup | 5 | S2 | Backend |
| E1-S6 | As a developer, I can refactor `batchService.ts` to use queueEngine instead of in-memory state | 8 | S2 | Backend |
| E1-S7 | As a developer, I can support multiple concurrent jobs (not limited to 1) | 5 | S2 | Backend |
| E1-S8 | As a user, I can see job queue status on the dashboard (pending, running, completed jobs) | 3 | S2 | Frontend |

**Sprint 1 Capacity: 16 SP** — Queue engine core
**Sprint 2 Capacity: 21 SP** — Recovery, refactor, concurrency

---

### Epic 2: Retry Engine & Error Handling
> Exponential backoff with error classification

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E2-S1 | As a developer, I can classify SMTP errors into rate_limit, temporary, permanent, network | 3 | S1 | Backend |
| E2-S2 | As a developer, I can retry failed emails with exponential backoff and jitter | 3 | S1 | Backend |
| E2-S3 | As a system, permanently failed emails are moved to dead_letters table | 2 | S2 | Backend |
| E2-S4 | As a user, I can view and retry dead letter emails from the UI | 3 | S3 | Frontend |

---

### Epic 3: Contact Management & Import
> Persistent contact lists with multi-format import

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E3-S1 | As a developer, I can CRUD contact lists via D1 (contactService.ts) | 5 | S2 | Backend/Worker |
| E3-S2 | As a developer, I can CRUD contacts with email, name, company, tags, custom_fields | 5 | S2 | Backend/Worker |
| E3-S3 | As a user, I can import contacts from CSV/Excel with field mapping | 8 | S3 | Backend |
| E3-S4 | As a user, I can see a field mapping UI during import (map columns to contact fields) | 5 | S3 | Frontend |
| E3-S5 | As a system, duplicates are detected during import (skip or merge options) | 3 | S3 | Backend |
| E3-S6 | As a user, I can view/search/filter contacts in a paginated list view | 5 | S3 | Frontend |
| E3-S7 | As a user, I can bulk delete, tag, or move contacts between lists | 3 | S3 | Frontend |
| E3-S8 | As a user, I can export contacts as CSV/JSON/Excel | 3 | S4 | Backend |
| E3-S9 | As a user, I can select a contact list when composing a campaign (instead of uploading Excel every time) | 5 | S4 | Frontend |
| E3-S10 | As a developer, I add `/contacts` routes and wire them to the frontend router | 2 | S3 | Full Stack |

---

### Epic 4: Email Validation & Contact Health Score
> Pre-send validation and health scoring

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E4-S1 | As a developer, I can validate email syntax (RFC 5322) | 2 | S3 | Backend |
| E4-S2 | As a developer, I can verify MX records exist for email domains (dns/promises) | 3 | S3 | Backend |
| E4-S3 | As a developer, I can detect disposable email domains from a bundled list | 2 | S3 | Backend |
| E4-S4 | As a developer, I can check if an email is in the suppression list | 1 | S3 | Backend |
| E4-S5 | As a system, contacts get a health score (0-100) based on validation checks | 3 | S4 | Backend |
| E4-S6 | As a user, I can see a validation report before sending (valid/invalid/risky/suppressed breakdown) | 5 | S4 | Frontend |
| E4-S7 | As a user, I can auto-validate contacts on import | 2 | S4 | Backend |

---

### Epic 5: Bounce & Unsubscribe Handling
> Suppression list, compliance headers, unsubscribe flow

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E5-S1 | As a developer, I can detect hard/soft bounces from SMTP response codes and add to suppression list | 3 | S3 | Backend |
| E5-S2 | As a developer, I can add List-Unsubscribe and List-Unsubscribe-Post headers to every email | 2 | S3 | Backend |
| E5-S3 | As a developer, I can add Precedence:bulk and Feedback-ID headers | 1 | S3 | Backend |
| E5-S4 | As a developer, I can create an unsubscribe confirmation page on the Cloudflare Worker | 5 | S4 | Worker |
| E5-S5 | As a developer, I can handle one-click unsubscribe (POST) per RFC 8058 | 3 | S4 | Worker |
| E5-S6 | As a user, I can view/search/manage the suppression list in the UI | 3 | S4 | Frontend |
| E5-S7 | As a system, suppressed emails are automatically skipped during campaign sends | 2 | S4 | Backend |

---

### Epic 6: Real-Time Updates (SSE)
> Server-Sent Events for live dashboard

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E6-S1 | As a developer, I can create an EventBus (in-memory pub/sub) for internal events | 3 | S4 | Backend |
| E6-S2 | As a developer, I can create SSE streaming endpoint `/events/campaign/:id` using Hono streaming | 3 | S4 | Backend |
| E6-S3 | As a developer, I can emit events (email_sent, email_failed, job_completed, etc.) from the queue worker | 2 | S4 | Backend |
| E6-S4 | As a developer, I can create a `useSSE` Vue composable that connects to the SSE endpoint | 3 | S4 | Frontend |
| E6-S5 | As a user, I can see live stats on the dashboard updating in real-time without page refresh | 5 | S4 | Frontend |

**Sprint 3 Capacity: 21 SP** — Contacts, validation, bounce
**Sprint 4 Capacity: 22 SP** — Unsubscribe, SSE, export, health scores

---

## Phase 2: Marketing Features (Sprints 5-8)

### Epic 7: HTML Template Management
> Template library with code editor and starter templates

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E7-S1 | As a developer, I can CRUD templates in D1 (templateService.ts) with name, category, html, variables | 5 | S5 | Backend/Worker |
| E7-S2 | As a developer, I can auto-extract `{{variables}}` from HTML content | 2 | S5 | Backend |
| E7-S3 | As a developer, I can render template preview with sample contact data | 2 | S5 | Backend |
| E7-S4 | As a user, I can create/edit templates with an HTML code editor and live preview | 8 | S5 | Frontend |
| E7-S5 | As a user, I can organize templates by category (newsletter, promotional, welcome, etc.) | 2 | S5 | Frontend |
| E7-S6 | As a user, I can duplicate a template | 1 | S5 | Full Stack |
| E7-S7 | As a user, I can import/export templates as HTML or JSON files | 3 | S6 | Full Stack |
| E7-S8 | As a user, I can pick from 10 built-in starter templates | 5 | S6 | Full Stack |
| E7-S9 | As a user, I can preview templates in desktop/tablet/mobile viewport sizes | 3 | S6 | Frontend |

**Sprint 5 Capacity: 20 SP** — Template CRUD, editor, categories

---

### Epic 8: Campaign Management
> Full campaign lifecycle with wizard

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E8-S1 | As a developer, I can CRUD campaigns in D1 with lifecycle states (draft → sending → completed) | 5 | S6 | Backend/Worker |
| E8-S2 | As a user, I can create a campaign with a step wizard: recipients → template → sender → schedule → review | 8 | S6 | Frontend |
| E8-S3 | As a user, I can send a test email to preview in my real inbox before launching | 3 | S6 | Full Stack |
| E8-S4 | As a user, I can clone an existing campaign | 2 | S7 | Full Stack |
| E8-S5 | As a user, I can organize campaigns with tags and folders | 2 | S7 | Full Stack |
| E8-S6 | As a system, campaign drafts auto-save every 30 seconds | 3 | S7 | Frontend |
| E8-S7 | As a user, I can view campaign stats (sent, delivered, opened, clicked, bounced, unsubscribed) | 5 | S7 | Full Stack |
| E8-S8 | As a user, I can compare metrics between 2+ campaigns side by side | 5 | S7 | Frontend |

**Sprint 6 Capacity: 22 SP** — Templates finish, campaign CRUD, wizard
**Sprint 7 Capacity: 17 SP** — Campaign features, stats, comparison

---

### Epic 9: Engagement Scoring
> Auto-calculated 0-100 contact engagement score

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E9-S1 | As a developer, I can create scoring engine that updates scores on open (+5), click (+10), bounce (-100), unsubscribe (-100) | 5 | S7 | Backend |
| E9-S2 | As a developer, I can apply daily score decay (no engagement in 30d → -10, 90d → -30) via background worker | 3 | S7 | Backend |
| E9-S3 | As a user, I can see engagement scores in the contact list (Hot/Warm/Cold/Dead badges) | 3 | S8 | Frontend |
| E9-S4 | As a user, I can filter contacts by score range | 2 | S8 | Frontend |

---

### Epic 10: Contact Segmentation
> Static and dynamic segments with rule builder

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E10-S1 | As a developer, I can create static segments (manually add/remove contacts) | 3 | S8 | Backend/Worker |
| E10-S2 | As a developer, I can create dynamic segments with AND/OR rules (tag, score, status, list, campaign engagement) | 8 | S8 | Backend |
| E10-S3 | As a user, I can build segment rules in a form UI and preview the matching count | 5 | S8 | Frontend |
| E10-S4 | As a user, I can use segments as campaign recipients | 2 | S8 | Frontend |

---

### Epic 11: A/B Testing
> Subject/content variants with auto-winner selection

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E11-S1 | As a developer, I can create A/B test campaigns with 2-5 variants (subject, template, sender) | 5 | S8 | Backend |
| E11-S2 | As a developer, I can split test pool by percentage and auto-select winner after duration | 5 | S8 | Backend |
| E11-S3 | As a user, I can set up an A/B test in the campaign wizard | 3 | S8 | Frontend |
| E11-S4 | As a user, I can see A/B test results with comparison chart | 3 | S8 | Frontend |

**Sprint 8 Capacity: 22 SP** — Scoring, segmentation, A/B testing (select stories to fit)

---

### Epic 12: Marketing Automation
> Drip sequences with visual flow builder

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E12-S1 | As a developer, I can create automations in D1 with trigger type, flow definition, enrollment tracking | 5 | S9 | Backend/Worker |
| E12-S2 | As a developer, I can define automation steps: send_email, wait, condition, add_tag, update_contact, webhook, end | 8 | S9 | Backend |
| E12-S3 | As a developer, I can run an automation worker (60s poll) that processes due enrollment steps | 5 | S9 | Backend |
| E12-S4 | As a developer, I can enroll contacts when they join a list or get a tag (trigger types) | 3 | S9 | Backend |
| E12-S5 | As a user, I can build automation flows with a visual flowchart editor | 8 | S10 | Frontend |
| E12-S6 | As a user, I can activate/pause/deactivate automations | 2 | S10 | Frontend |
| E12-S7 | As a user, I can view automation stats with funnel visualization (drop-off per step) | 5 | S10 | Frontend |
| E12-S8 | As a user, I can see enrolled contacts and their current step | 3 | S10 | Frontend |

**Sprint 9 Capacity: 21 SP** — Automation backend
**Sprint 10 Capacity: 18 SP** — Automation frontend

---

### Epic 13: Webhooks & API Keys
> External integrations and programmatic access

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E13-S1 | As a developer, I can create outgoing webhooks with HMAC signing for events (sent, opened, bounced, etc.) | 5 | S10 | Backend |
| E13-S2 | As a developer, I can retry failed webhook deliveries (3 attempts with backoff) | 2 | S10 | Backend |
| E13-S3 | As a user, I can manage webhooks in the UI (create, test, enable/disable, view delivery logs) | 5 | S10 | Frontend |
| E13-S4 | As a developer, I can generate scoped API keys (read, send, contacts, campaigns, admin) | 5 | S10 | Backend |
| E13-S5 | As a developer, I can authenticate via `X-API-Key` header in addition to session cookies | 3 | S10 | Backend |
| E13-S6 | As a user, I can manage API keys in the UI (create, revoke, view scopes) | 3 | S10 | Frontend |

---

## Phase 3: Intelligence & Scale (Sprints 11-12)

### Epic 14: Smart Provider Routing & Warmup
> Score-based provider selection, auto-failover, warmup

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E14-S1 | As a developer, I can score providers by quota remaining, success rate, speed and auto-select best | 5 | S11 | Backend |
| E14-S2 | As a developer, I can auto-failover to next provider when current one returns errors | 3 | S11 | Backend |
| E14-S3 | As a user, I can see provider health dashboard (quota used, failure rate, avg speed) | 3 | S11 | Frontend |
| E14-S4 | As a developer, I can create warmup schedules for new sender configs (gradual volume ramp) | 5 | S11 | Backend |
| E14-S5 | As a user, I can see warmup progress for each SMTP config | 2 | S11 | Frontend |

---

### Epic 15: Advanced Analytics
> Campaign reports, link analytics, geo/device breakdown

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E15-S1 | As a user, I can see detailed campaign reports (delivery, open, click, bounce, unsubscribe rates) | 5 | S11 | Full Stack |
| E15-S2 | As a user, I can see which links in my email got the most clicks | 3 | S11 | Full Stack |
| E15-S3 | As a user, I can see geographic heatmap of opens/clicks (from CF headers) | 5 | S12 | Full Stack |
| E15-S4 | As a user, I can see device/client breakdown (Gmail vs Outlook, mobile vs desktop) | 3 | S12 | Full Stack |
| E15-S5 | As a user, I can see best send time analysis based on open patterns | 3 | S12 | Backend |
| E15-S6 | As a user, I can export any report as CSV or JSON | 2 | S12 | Backend |

**Sprint 11 Capacity: 21 SP** — Routing, warmup, analytics start

---

### Epic 16: Plugin System
> Extensible provider and hook plugins

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E16-S1 | As a developer, I can define plugin manifest format (JSON) with config, limits, entry point | 3 | S12 | Backend |
| E16-S2 | As a developer, I can load/unload provider plugins dynamically (ProviderPlugin interface) | 5 | S12 | Backend |
| E16-S3 | As a developer, I can execute hook plugins at lifecycle points (pre_send, post_send, on_bounce, etc.) | 5 | S12 | Backend |
| E16-S4 | As a user, I can manage plugins in settings (install, enable, disable, configure) | 3 | S12 | Frontend |

---

### Epic 17: CLI Tool & Campaign Calendar
> Terminal access and schedule overview

| ID | Story | SP | Sprint | Layer |
|----|-------|-----|--------|-------|
| E17-S1 | As a developer, I can use `dispatch send`, `dispatch contacts`, `dispatch campaign` CLI commands | 5 | S12 | CLI |
| E17-S2 | As a user, I can see a calendar view of scheduled campaigns with conflict detection | 5 | S12 | Frontend |

**Sprint 12 Capacity: 22 SP** — Analytics, plugins, CLI, calendar

---

## Sprint Summary

| Sprint | Focus | Key Deliverables | SP |
|--------|-------|-----------------|-----|
| **S1** | Queue Core | Job queue engine, retry engine, error classification | 16 |
| **S2** | Queue Integration | Recovery, batchService refactor, concurrent jobs, contact service setup | 21 |
| **S3** | Contacts & Validation | Import wizard, field mapping, MX/syntax validation, bounce detection, compliance headers | 21 |
| **S4** | Unsubscribe & SSE | Unsubscribe worker, suppression management, EventBus, SSE, live dashboard | 22 |
| **S5** | Templates | Template CRUD, HTML editor, live preview, categories | 20 |
| **S6** | Campaigns | Campaign service, wizard, test send, starter templates, import/export | 22 |
| **S7** | Campaign Analytics | Clone, tags, auto-save, stats, comparison, scoring engine, score decay | 17 |
| **S8** | Segmentation & A/B | Dynamic segments, rule builder, A/B testing, engagement badges | 22 |
| **S9** | Automation Backend | Automation service, steps, worker, triggers | 21 |
| **S10** | Automation Frontend & Integrations | Flow builder, webhooks, API keys | 18 |
| **S11** | Intelligence | Smart routing, warmup, provider dashboard, advanced analytics | 21 |
| **S12** | Extensibility | Plugins, CLI, calendar, geo analytics, device breakdown | 22 |

---

## Definition of Done (per story)

- [ ] Code written and follows existing patterns (Hono routes, Vue composables, D1 queries)
- [ ] TypeScript interfaces added to `src/types/index.ts`
- [ ] API endpoints documented in route file
- [ ] Frontend wired to API via `lib/api.ts` and `lib/query.ts`
- [ ] New routes proxied in `frontend/vite.config.ts`
- [ ] Manual testing passes
- [ ] No TypeScript errors (`vue-tsc` + `tsc`)

---

## Claude Flow Agent Mapping

Use these agents/skills for each layer of work:

| Work Type | Agent/Skill | Path |
|-----------|------------|------|
| **System design** | `/sparc architect` | `.claude/commands/sparc/architect.md` |
| **Backend API** | Backend dev agent | `.claude/agents/development/backend/` |
| **Database schema** | `/sparc code` | `.claude/commands/sparc/code.md` |
| **Frontend views** | `/sparc designer` | `.claude/commands/sparc/designer.md` |
| **Worker updates** | `/sparc devops` | `.claude/commands/sparc/devops.md` |
| **Testing** | `/sparc tdd` | `.claude/commands/sparc/tdd.md` |
| **Code review** | Code review skill | `.claude/skills/github-code-review/` |
| **Debugging** | `/sparc debug` | `.claude/commands/sparc/debug.md` |
| **Security audit** | `/sparc security-review` | `.claude/commands/sparc/security-review.md` |
| **Documentation** | `/sparc docs-writer` | `.claude/commands/sparc/docs-writer.md` |
| **Performance** | `/sparc optimizer` | `.claude/commands/sparc/optimizer.md` |
| **Integration** | `/sparc integration` | `.claude/commands/sparc/integration.md` |
| **CI/CD** | DevOps agent | `.claude/agents/devops/ci-cd/` |
| **Complex multi-file** | SPARC orchestrator | `.claude/commands/sparc/sparc.md` |

### Sprint Workflow

```
1. Start sprint → Pick stories from backlog
2. Per story:
   a. /sparc architect  → Design approach (if complex)
   b. /sparc code       → Implement backend service + routes
   c. /sparc designer   → Build frontend views + components
   d. /sparc tdd        → Write tests
   e. /sparc integration → Wire frontend ↔ backend ↔ worker
3. End sprint → /sparc security-review → Code review skill → Deploy
```
