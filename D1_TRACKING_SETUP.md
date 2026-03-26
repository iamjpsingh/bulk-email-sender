# Email Tracking Setup

Track email opens, clicks, and unsubscribes using Cloudflare Workers + D1.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Dispatch App (Backend)                                         │
│                                                                 │
│  1. Send email → Register with Worker → Get tracking_id        │
│  2. Inject pixel: <img src="worker.dev/o/{tracking_id}">       │
│  3. Wrap links: worker.dev/c/{tracking_id}?url=...             │
│  4. Reports page → Fetch stats from Worker API                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (dispatch-tracker.workers.dev)               │
│                                                                 │
│  /o/:id     → Return 1x1 pixel, record open in D1              │
│  /c/:id     → Record click in D1, redirect to original URL     │
│  /u/:id     → One-click unsubscribe                            │
│  /api/email → Register new email, return tracking_id           │
│  /api/stats → Return stats for user/campaign                   │
│  /api/logs  → Return filtered logs with pagination             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare D1 Database                                         │
│                                                                 │
│  campaigns       - Campaign info and aggregate stats           │
│  emails          - Individual email records with tracking_id   │
│  tracking_events - Opens, clicks, unsubscribes with metadata   │
└─────────────────────────────────────────────────────────────────┘
```

## Option A: Deploy via UI (Recommended)

The easiest way. Platform admin connects Cloudflare and deploys Workers from the app.

1. Login as **platform admin**
2. Go to **Settings → Tracking**
3. Click **Connect Cloudflare** — OAuth flow authenticates your account
4. Select a **zone** (domain) to deploy to
5. Click **Deploy** — Worker + D1 database are created automatically
6. Done — tracking is active for all organizations

The UI also shows per-zone analytics (opens, clicks, unsubscribes) and lets you undeploy.

## Option B: Manual CLI Deploy

For self-hosting or if you prefer manual control.

### 1. Install Wrangler

```bash
bun add -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
cd tracking-worker
wrangler d1 create dispatch
```

Copy the `database_id` from output into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "dispatch"
database_id = "your-database-id-here"
```

### 4. Initialize Database

```bash
wrangler d1 execute dispatch --file=schema.sql
```

### 5. Deploy Worker

```bash
bun install
wrangler deploy
```

You'll get a URL like: `https://dispatch-tracker.your-subdomain.workers.dev`

### 6. Configure Your App

Add to `.env`:

```env
TRACKING_WORKER_URL=https://dispatch-tracker.your-subdomain.workers.dev
```

### 7. Restart App

```bash
bun run dev
```

## How It Works

### Sending Email
1. App calls Worker API: `POST /api/email` to register the email
2. Worker creates record in D1, returns `tracking_id`
3. App injects tracking pixel and wraps links in the email HTML

### Open Tracking
1. Recipient's email client loads the 1x1 pixel
2. Worker records open event with timestamp, device, country, user agent
3. Returns transparent GIF

### Click Tracking
1. Recipient clicks a tracked link
2. Worker records click event in D1
3. Redirects to original URL

### Unsubscribe
1. Recipient clicks unsubscribe link (`/u/:trackingId`)
2. Worker records unsubscribe event, shows confirmation page
3. Contact is suppressed from future sends

## Worker API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/o/:trackingId` | GET | Track open (returns pixel) |
| `/c/:trackingId?url=...` | GET | Track click (redirect) |
| `/u/:trackingId` | GET | One-click unsubscribe |
| `/api/email` | POST | Register email for tracking |
| `/api/stats?user_id=...` | GET | Get user/campaign stats |
| `/api/logs?user_id=...` | GET | Get filtered logs |
| `/health` | GET | Health check |

## Without Tracking

The app works without tracking — emails send normally, local logs are kept. Tracking adds:
- Open/click/unsubscribe tracking via Cloudflare Worker
- Persistent logs in D1
- Geo/device analytics
- Advanced filtering and stats

## Costs

Cloudflare free tier:
- **Workers**: 100,000 requests/day
- **D1**: 5GB storage, 5M reads/day, 100K writes/day

More than enough for most email campaigns.

## Troubleshooting

### Worker not responding
```bash
cd tracking-worker
wrangler tail  # View live logs
```

### Database errors
```bash
wrangler d1 execute dispatch --command "SELECT COUNT(*) FROM emails"
wrangler d1 execute dispatch --file=schema.sql  # Re-run schema
```
