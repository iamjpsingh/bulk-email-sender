# Email Tracking Setup

Track email opens and clicks using Cloudflare Workers + D1.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Bun App (localhost:3000)                                  │
│                                                                 │
│  1. Send email → Register with Worker → Get tracking_id        │
│  2. Inject pixel: <img src="worker.dev/o/{tracking_id}">       │
│  3. Wrap links: worker.dev/c/{tracking_id}?url=...             │
│  4. Reports page → Fetch stats from Worker API                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (mailflow-tracker.workers.dev)               │
│                                                                 │
│  /o/:id     → Return 1x1 pixel, record open in D1              │
│  /c/:id     → Record click in D1, redirect to original URL     │
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
│  tracking_events - Detailed open/click events                  │
└─────────────────────────────────────────────────────────────────┘
```

## Setup (5 minutes)

### 1. Install Wrangler

```bash
# Using bun
bun add -g wrangler

# Or npm
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
cd tracking-worker
wrangler d1 create mailflow
```

Copy the `database_id` from output and paste in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "mailflow"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← Paste here
```

### 4. Initialize Database

```bash
wrangler d1 execute mailflow --file=schema.sql
```

### 5. Deploy Worker

```bash
bun install  # or npm install
wrangler deploy
```

You'll get a URL like: `https://mailflow-tracker.your-subdomain.workers.dev`

### 6. Configure Your App

Add to `.env`:

```env
TRACKING_WORKER_URL=https://mailflow-tracker.thedevimapro.workers.dev
```

### 7. Restart App

```bash
bun run dev
```

You should see:
```
📊 Tracking:
   ✅ Cloudflare Worker
```

## How It Works

### When Sending Email

1. Your app calls Worker API: `POST /api/email`
2. Worker creates record in D1, returns `tracking_id`
3. Your app injects tracking pixel and wraps links:

```html
<!-- Tracking pixel -->
<img src="https://worker.dev/o/abc123" width="1" height="1" />

<!-- Wrapped link -->
<a href="https://worker.dev/c/abc123?url=https%3A%2F%2Fexample.com">Click</a>
```

### When Recipient Opens Email

1. Email client loads pixel from Worker
2. Worker records open event in D1 with:
   - Timestamp
   - Device type (mobile/desktop/tablet)
   - Country/city (from Cloudflare headers)
   - User agent
3. Returns 1x1 transparent GIF

### When Recipient Clicks Link

1. Click goes to Worker
2. Worker records click event in D1
3. Redirects to original URL

### Reports Page

1. Frontend calls `/report/logs` on your app
2. Your app fetches from Worker: `GET /api/logs?user_id=...`
3. Worker queries D1 and returns filtered results

## Worker API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/o/:trackingId` | GET | Track open (returns pixel) |
| `/c/:trackingId?url=...` | GET | Track click (redirects) |
| `/api/email` | POST | Register email for tracking |
| `/api/stats?user_id=...` | GET | Get user/campaign stats |
| `/api/logs?user_id=...` | GET | Get filtered logs |
| `/health` | GET | Health check |

### Filter Options for `/api/logs`

- `user_id` (required)
- `status` - sent, opened, clicked, failed
- `send_type` - direct, batch, scheduled
- `provider` - smtp, google, microsoft
- `campaign_id`
- `search` - search in email, name, subject
- `start_date`, `end_date`
- `page`, `limit`

## Local Development

```bash
cd tracking-worker
wrangler dev
```

This runs Worker locally at `http://localhost:8787`

For local testing:
```env
TRACKING_WORKER_URL=http://localhost:8787
```

## Costs

Cloudflare free tier:
- **Workers**: 100,000 requests/day
- **D1**: 5GB storage, 5M reads/day, 100K writes/day

More than enough for most email campaigns.

## Troubleshooting

### "Tracking Worker not configured"

Check `.env` has:
```env
TRACKING_WORKER_URL=https://your-worker.workers.dev
```

### Worker not responding

```bash
cd tracking-worker
wrangler tail  # View live logs
```

### Database errors

```bash
# Check database
wrangler d1 execute mailflow --command "SELECT COUNT(*) FROM emails"

# Re-run schema
wrangler d1 execute mailflow --file=schema.sql
```

## Without Tracking

The app works without tracking - emails send normally, local logs are kept. Tracking just adds:
- Open/click tracking via Worker
- Persistent logs in D1
- Advanced filtering and stats
