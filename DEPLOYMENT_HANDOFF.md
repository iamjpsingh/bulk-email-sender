# Dispatch — VPS Deployment Handoff

> Status snapshot for continuing the "Dockerize + deploy to Contabo VPS via Traefik/Coolify" work in a new chat. Nothing in the codebase has been changed yet — only inspection has happened.

**Target domain:** `track.xtrusio.org`
**Target host:** Contabo VPS, Docker, existing Coolify/Traefik reverse proxy on a shared Docker network (assumed `coolify`, to be confirmed).
**Goal:** One-to-three command deployment, production-grade, no host-port binding.

---

## 1. Project understanding (verified)

- **Repo:** `E:\Developmet\Projects\bulk-email-sender` (project name: **Dispatch** v3.0.0).
- **Three apps in one repo:**
  1. **Backend** — Bun + Hono. Entry: `src/app.ts`. All API under `/api/*`. Listens on `PORT` (default `5500` from config; existing `Dockerfile`/compose set `3000`).
  2. **Frontend** — Vue 3 + Vite + Tailwind v4 SPA in `frontend/`. Builds to `frontend/dist/`. Calls `/api` on same origin (`VITE_API_URL` overridable).
  3. **Tracking worker** — Cloudflare Worker (`tracking-worker/`) bound to D1 db `dispatch` (id `04636489-ef6e-4adc-a9e4-112292231c49`). Already deployed; **not** containerized. Backend reaches it via `TRACKING_WORKER_URL`.
- **Local SQLite** in `data/` (`users.db`, `scheduler.db`, queue db). User data and sessions live in **Cloudflare D1** through the worker, not locally.
- **Auth:** argon2 + session cookie (`session_token`) + CSRF middleware + per-route rate limiting.
- **Email providers:** SMTP (nodemailer), Google Gmail OAuth, Microsoft Graph OAuth.
- **Package manager:** **bun / bunx only** (user requirement — never npm/npx).

### Required env vars (derived from source)

| Var | Purpose | Required |
|---|---|---|
| `NODE_ENV` | `production` | yes |
| `PORT` | internal port | yes (use `3000`) |
| `BASE_URL` | `https://track.xtrusio.org` | yes |
| `FRONTEND_URL` | `https://track.xtrusio.org` | yes |
| `SESSION_SECRET` | random 32+ chars | yes |
| `TRACKING_WORKER_URL` | deployed Cloudflare Worker URL | yes |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Gmail OAuth | optional |
| `MICROSOFT_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Outlook OAuth | optional |
| `SMTP_HOST/PORT/SECURE/USER/PASS`, `FROM_EMAIL`, `FROM_NAME` | default SMTP | optional |
| `NOTIFICATION_SMTP_*`, `NOTIFICATION_FROM_NAME` | job-completion mail | optional |
| `LOG_LEVEL` | `info`/`warn`/`debug` | optional |

**Note:** `.env.example` exists in the repo but I'm restricted from reading it. The list above comes from `src/config/index.ts` and `src/services/notificationService.ts`.

---

## 2. Inspection summary — files reviewed

- `package.json`, `bun.lock`
- `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/lib/api/client.ts`
- `src/app.ts`, `src/config/index.ts`
- `src/routes/index.ts`, `src/routes/auth.ts`, `src/routes/tracking.ts`, `src/routes/oauth.ts`
- `src/services/d1UserDatabase.ts` (excerpt)
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- `tracking-worker/wrangler.toml`
- `README.md`

Existing `Dockerfile` is reasonable (multi-stage), but compose file is dev-style (host ports, no proxy network).

---

## 3. Problems found (must fix before VPS deploy)

| # | Problem | Severity | Where |
|---|---|---|---|
| 1 | **Backend does not serve the built SPA.** `src/app.ts` only exposes `/public/*` static. Dockerfile copies SPA to `dist/frontend/` but nothing serves it → `track.xtrusio.org/` returns API JSON; `/login`, `/dashboard` 404. | **Blocker** | `src/app.ts` |
| 2 | `GET /` returns API metadata, conflicts with SPA root. | Blocker (after #1) | `src/routes/index.ts` |
| 3 | Existing `docker-compose.yml` binds host port `3000:3000`, has no `networks:`, no Traefik labels. | Blocker | `docker-compose.yml` |
| 4 | `PORT` mismatch: config defaults to `5500`, Dockerfile/compose use `3000`. Works because env wins, but worth normalizing. | Minor | docs/`.env.example` |
| 5 | Behind Traefik, cookies need `x-forwarded-proto`. Hono `isHttps()` honors it; just must set `BASE_URL`/`FRONTEND_URL` to https. | Note | n/a |
| 6 | `data/`, `logs/`, `uploads/` need persistent volumes (currently bind-mounted to host). Should switch to named volumes for portability. | Minor | compose |
| 7 | Final image is heavy (full `oven/bun:1`). Can switch runtime stage to `oven/bun:1-slim`. | Optimization | Dockerfile |
| 8 | Healthcheck uses `bun -e fetch(...)` — works but slow. `wget --spider` is more conventional. | Cosmetic | Dockerfile |
| 9 | OAuth public paths in `AUTH.PUBLIC_PATHS` only whitelist callbacks; init paths may need verification. | Investigate | `src/config/index.ts` |
| 10 | Tests / lint not yet executed. | Verify | n/a |

---

## 4. What is DONE

- Full project inspection (structure, stack, env, ports, build commands, external deps).
- Identified the SPA-serving gap (the single biggest blocker).
- Confirmed tracking worker stays on Cloudflare — only the Bun app goes on the VPS.
- Drafted required env list from source (since `.env.example` is restricted).
- Drafted plan for Dockerfile + compose rewrite.
- Surfaced 6 open questions to user (network name, cert resolver, port, OAuth redirect URI access, `.env.example` overwrite, release approach).

---

## 5. What is REMAINING (pickup list for next chat)

### A. User decisions still needed
1. **Coolify/Traefik network name** — assume `coolify`, but confirm. Same for cert resolver name (`letsencrypt` is Coolify default).
2. **Internal port** — keep `3000`?
3. **`TRACKING_WORKER_URL`** — confirm the deployed worker URL is ready.
4. **OAuth redirect URIs** — user must add `https://track.xtrusio.org/auth/google/callback` and `…/auth/microsoft/callback` in their Google + Microsoft consoles.
5. **OK to overwrite `.env.example`** with a fresh source-derived version? (I cannot read the existing one.)
6. **Release approach** — Recommended: **Option A** (clone repo on VPS + `docker compose up -d --build`). Confirm.

### B. Code fixes (after approval)
- [ ] Add SPA static serving + history-mode fallback to `src/app.ts`. Suggested:
  ```ts
  import { serveStatic } from 'hono/bun'
  // after API routes, before notFound:
  app.use('/assets/*', serveStatic({ root: './dist/frontend' }))
  app.use('/*', serveStatic({ root: './dist/frontend', path: 'index.html' }))
  ```
  Make sure these come **after** `/api/*` routes but **before** the JSON 404.
- [ ] Move `GET /` API info to `GET /api/info` in `src/routes/index.ts` (or remove root JSON entirely so SPA wins at `/`).
- [ ] (Optional) Verify OAuth init paths are in `AUTH.PUBLIC_PATHS`.

### C. Local verification (after code fixes)
```bash
# Root
bun install
bun run lint           # best-effort
bun test               # 75 backend tests expected
# Frontend
cd frontend && bun install && bun run build && cd ..
# Docker build sanity
docker build -t dispatch:local .
```

### D. Docker rewrite

**`Dockerfile` (replace existing):**
- Stage 1: `oven/bun:1` builds frontend with `bunx vue-tsc -b && bunx vite build`.
- Stage 2: `oven/bun:1-slim` runtime, installs prod deps with `bun install --production --frozen-lockfile`, copies `src/`, `tsconfig.json`, `public/samples/`, and stage-1 `frontend/dist/` → `/app/dist/frontend/`.
- `EXPOSE 3000`, `ENV NODE_ENV=production`, healthcheck via `wget --spider -q http://127.0.0.1:3000/health`.
- `CMD ["bun", "run", "src/app.ts"]`.

**`docker-compose.yml` (replace existing):**
- No `ports:` exposed.
- Service on **external network** `coolify` (configurable via env).
- Traefik labels for `track.xtrusio.org`, https-only, `letsencrypt` cert resolver, redirect HTTP→HTTPS.
- Named volumes: `dispatch_data`, `dispatch_logs`, `dispatch_uploads`.
- `restart: unless-stopped`, `env_file: .env`.

Skeleton:
```yaml
services:
  app:
    build: .
    container_name: dispatch
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      PORT: 3000
    volumes:
      - dispatch_data:/app/data
      - dispatch_logs:/app/logs
      - dispatch_uploads:/app/uploads
    networks:
      - proxy
    labels:
      - traefik.enable=true
      - traefik.docker.network=${PROXY_NETWORK:-coolify}
      - traefik.http.routers.dispatch.rule=Host(`track.xtrusio.org`)
      - traefik.http.routers.dispatch.entrypoints=https
      - traefik.http.routers.dispatch.tls=true
      - traefik.http.routers.dispatch.tls.certresolver=${CERT_RESOLVER:-letsencrypt}
      - traefik.http.services.dispatch.loadbalancer.server.port=3000
      # http -> https redirect
      - traefik.http.routers.dispatch-http.rule=Host(`track.xtrusio.org`)
      - traefik.http.routers.dispatch-http.entrypoints=http
      - traefik.http.routers.dispatch-http.middlewares=redirect-to-https
      - traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https

volumes:
  dispatch_data:
  dispatch_logs:
  dispatch_uploads:

networks:
  proxy:
    external: true
    name: ${PROXY_NETWORK:-coolify}
```

### E. Files to create / replace

- [ ] `.env.example` — fresh, source-derived (overwrite after user OK).
- [ ] `Dockerfile` — replace.
- [ ] `docker-compose.yml` — replace.
- [ ] `DEPLOYMENT.md` — local verify, build, VPS clone, .env, network attach, deploy, logs, restart, update, rollback. DNS + Traefik troubleshooting.
- [ ] `.dockerignore` — already good; keep.

### F. Final smoke test on VPS
- DNS A record `track.xtrusio.org` → VPS IP (TTL 300).
- `docker network inspect coolify` shows the container attached.
- `docker compose logs -f app` clean startup.
- `https://track.xtrusio.org/health` → `{"status":"OK",...}`.
- `https://track.xtrusio.org/` → SPA loads.

---

## 6. Recommended commands (final state)

**On dev machine:**
```bash
git add Dockerfile docker-compose.yml .env.example DEPLOYMENT.md src/app.ts src/routes/index.ts
git commit -m "feat(deploy): production Docker + Traefik setup for track.xtrusio.org"
git push
```

**On VPS (one-time):**
```bash
git clone <repo> /opt/dispatch && cd /opt/dispatch
cp .env.example .env && nano .env       # fill SESSION_SECRET, TRACKING_WORKER_URL, OAuth, SMTP
docker compose up -d --build
docker compose logs -f app
```

**Updates:**
```bash
cd /opt/dispatch && git pull && docker compose up -d --build
```

**Rollback:**
```bash
cd /opt/dispatch && git checkout <prev-sha> && docker compose up -d --build
```

---

## 7. Open questions (paste these into the next chat)

1. Is the Coolify/Traefik network really named `coolify`? What's the cert resolver name?
2. Internal container port — keep `3000`?
3. `TRACKING_WORKER_URL` — what value should I put in `.env.example` as the placeholder?
4. May I overwrite `.env.example`?
5. Release approach: Option A (clone on VPS) confirmed?
6. Any other apps on the VPS that already use port 3000? (Doesn't matter if no host bind, but useful to know.)

---

## 8. Pickup prompt for the new chat

> Continue the Dispatch VPS deployment work. See `DEPLOYMENT_HANDOFF.md` in the repo root for the full status. Answers to the open questions:
> 1. Network: `___`  /  Cert resolver: `___`
> 2. Internal port: `___`
> 3. TRACKING_WORKER_URL: `___`
> 4. OK to overwrite `.env.example`: `yes/no`
> 5. Release approach: `A / B / C`
>
> Proceed: run local checks → apply the SPA-serving fix in `src/app.ts` → rewrite `Dockerfile` and `docker-compose.yml` → write `DEPLOYMENT.md` → build the image locally to confirm.

---

_Last updated: 2026-04-29. Branch: `fix-traking`. No code changed yet._
