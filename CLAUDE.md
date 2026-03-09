# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Dispatch

Open-source bulk email campaign platform with tracking, multi-provider support, and batch processing.

## Commands

```bash
# Backend (Bun + Hono, port 3000)
bun run dev          # Dev server with hot reload
bun start            # Production

# Frontend (Vue 3 + Vite, port 5173)
cd frontend && npm run dev      # Dev server
cd frontend && npm run build    # Production build (vue-tsc + vite)

# Tracking Worker (Cloudflare)
cd tracking-worker && npx wrangler dev       # Local worker
cd tracking-worker && npx wrangler deploy    # Deploy to Cloudflare
cd tracking-worker && npx wrangler d1 execute dispatch --file=schema.sql --remote  # Init D1 schema

# Database
bun run reset-db     # Delete local SQLite DBs (data/users.db, data/scheduler.db)
bun run clean        # Remove dist, uploads, logs, users.db
```

## Architecture

Three separate applications in one repo:

### Backend (`src/`)
Bun runtime + Hono framework. Entry: `src/app.ts`. All config centralized in `src/config/index.ts`.

- `src/routes/` — API route handlers (auth, send, report, config, dashboard, tracking, oauth)
- `src/services/` — Business logic:
  - `emailService.ts` — Nodemailer SMTP sending with placeholder replacement and D1 tracking injection
  - `batchService.ts` — In-memory batch processor (batchSize/emailDelay/batchDelay). **State is lost on restart.**
  - `schedulerService.ts` — SQLite-backed scheduled jobs (`data/scheduler.db`)
  - `d1Service.ts` — Cloudflare Worker API client for tracking (register emails, inject tracking pixel/links)
  - `d1UserDatabase.ts` — User/session/config CRUD via Cloudflare Worker
  - `logService.ts` — Local JSON file logging (`logs/email-logs.json`)
  - `notificationService.ts` — Job completion email notifications
  - `fileService.ts` — Excel parsing, placeholder replacement (`{{FirstName}}`, `{{Company}}`, etc.)
  - `providerLimits.ts` — Rate limits per provider (Google 500/day, Microsoft 300/day, SMTP 500/day)
- `src/middleware/auth.ts` — Session cookie validation via D1
- `src/types/index.ts` — All TypeScript interfaces

### Frontend (`frontend/`)
Vue 3 SPA with Vue Router and TanStack Vue Query. Uses Quill for WYSIWYG editing.

- Views: `LoginView`, `DashboardView`, `ComposeView`, `ReportsView`, `ConfigsView`
- State: TanStack Vue Query composables in `stores/` (auth, email, config)
- API client: `lib/api.ts`
- **Route conflict awareness**: Frontend uses `/configs`, `/reports` (plural). Backend uses `/config`, `/report` (singular). Vite proxy in `frontend/vite.config.ts` maps specific backend paths.

### Tracking Worker (`tracking-worker/`)
Cloudflare Worker + D1 database. Handles open pixel (`/o/:trackingId`), click redirect (`/c/:trackingId`), and email registration API.

- Schema: `tracking-worker/schema.sql` — users, sessions, smtp_configs, campaigns, emails, tracking_events
- Config: `tracking-worker/wrangler.toml` — D1 binding, worker name

## Key Patterns

- **Email providers**: SMTP (any), Google Gmail (OAuth), Microsoft Outlook (OAuth). OAuth flows in `src/routes/oauth.ts` and `src/services/oauthService.ts`.
- **Tracking flow**: emailService registers email with D1 worker → gets trackingId → injects 1x1 pixel + wraps links → worker records opens/clicks
- **Batch processing**: Single job at a time, in-memory state. Supports pause/resume/cancel via `batchService`. Uses setTimeout for batch delays.
- **Auth**: Argon2 password hashing, session tokens stored in D1, cookie-based (`session_token`).
- **File uploads**: Multer → `uploads/` directory. Excel parsed via `xlsx` package.
- **Environment**: All secrets in `.env` (see `.env.example`). Tracking requires `TRACKING_WORKER_URL`. OAuth requires `GOOGLE_CLIENT_ID`/`MICROSOFT_CLIENT_ID` + secrets.

## v3.0 Roadmap

Planning docs in `docs/PRD.md` and `docs/TRD.md`. Key improvements:
- **Phase 1**: Persistent SQLite job queue, retry engine, email validation, bounce/unsubscribe handling, SSE real-time updates
- **Phase 2**: Plugin system, contact lists, A/B testing, webhooks, API keys
- **Phase 3**: Smart provider routing, email warmup, campaign calendar, CLI tool

## Development Workflow (Claude Flow)

Claude Flow (RuFlo V3) is installed as a **Claude Code orchestration layer** — it does NOT run as part of Dispatch. Use it for structured development.

### When to Use What

| Task | Tool | How |
|------|------|-----|
| **New feature (multi-file)** | SPARC orchestrator | `/sparc` — breaks work into spec → pseudocode → architecture → code → test |
| **Backend API work** | Backend dev agent | Spawn via Task tool with `backend-dev` agent from `.claude/agents/development/backend/` |
| **Code review before PR** | Code review skill | `.claude/skills/github-code-review/` — multi-agent review with security + performance analysis |
| **Complex refactor** | Pair programming | `.claude/skills/pair-programming/` — driver/navigator mode with continuous verification |
| **Debugging** | SPARC debug mode | `/sparc debug` — systematic root cause analysis |
| **Pre-deploy validation** | Production validator | `.claude/agents/testing/production-validator.md` — scans for mocks, stubs, TODOs |
| **Simple edit (<3 files)** | Direct edit | Just use Edit tool directly — no agent overhead needed |
| **Performance check** | Analysis commands | `.claude/commands/analysis/performance-bottlenecks.md` |

### SPARC Commands (Primary Workflow)

Use SPARC for any feature that touches 3+ files. Available via `.claude/commands/sparc/`:

```
/sparc              # Full orchestrator — delegates to specialist modes
/sparc code         # Implementation mode
/sparc tdd          # Test-driven development
/sparc debug        # Systematic debugging
/sparc architect    # System design
/sparc security-review  # Security audit
/sparc docs-writer  # Documentation generation
```

### Agent Spawning for Parallel Work

When building features that span backend + frontend + worker, spawn agents in parallel:

```bash
# Initialize swarm for complex multi-file work
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

Rules for agent spawning:
- Put ALL agent Task calls in ONE message for parallel execution
- Use `run_in_background: true` for all agent spawns
- After spawning, STOP — do not poll or check status
- When results arrive, review ALL before proceeding

### Memory (Cross-Session Knowledge)

Store patterns and decisions that should persist:

```bash
npx @claude-flow/cli@latest memory store --key "queue-schema" --value "SQLite in data/queue.db" --namespace dispatch
npx @claude-flow/cli@latest memory search --query "email validation" --namespace dispatch
```

### Hooks (Already Active)

These run automatically — no setup needed:
- **Route intelligence** — auto-suggests agent type per task (visible in prompt)
- **Pre-edit** — validates changes before writing
- **Post-edit** — quality check after writing
- **Session save/restore** — preserves context across sessions

### CLI Quick Reference

```bash
npx @claude-flow/cli@latest doctor --fix    # Diagnose and fix issues
npx @claude-flow/cli@latest daemon start    # Start background workers
npx @claude-flow/cli@latest memory list     # Show stored knowledge
```

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless necessary — prefer editing existing files
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- Use `/src` for source, `/tests` for tests, `/docs` for docs
- Keep files under 500 lines — split if growing larger
- Batch all related operations (reads, writes, agent spawns) into ONE message
