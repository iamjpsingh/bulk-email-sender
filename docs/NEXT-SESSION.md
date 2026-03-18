# Next Session — What to Do

## Priority 1: shadcn-vue Full Migration
**Plan**: `docs/PLAN-shadcn-migration.md`
**Time**: ~18 hours

### Phase 1: Create 6 Missing Components
1. `ui/select` — radix-vue Select with Portal (replaces raw `<select>`)
2. `ui/switch` — radix-vue Switch (replaces checkbox toggles)
3. `ui/checkbox` — radix-vue Checkbox (replaces raw checkboxes)
4. `ui/table` — Table, TableHeader, TableBody, TableRow, TableHead, TableCell
5. `ui/label` — Styled label (replaces `class="form-label"`)
6. `ui/textarea` — Styled textarea (replaces `class="form-input"` on textareas)

### Phase 2: Migrate 40 View Files
Start with Platform pages → Settings → Admin → Core → Tools → Auth

### Phase 3: Remove Old CSS Classes
Remove `btn-primary`, `form-input`, `form-label`, etc. from `tailwind.css`

---

## Priority 2: UX Fixes Still Needed

| # | Issue | Notes |
|---|-------|-------|
| 1 | Delivery Server domain fetch for SES | Need AWS SigV4 signing or show manual + guidance |
| 2 | System mailer tracking Worker | No option to deploy tracking for system transactional emails |
| 3 | Email-based bounce Worker | For SMTP without API — Cloudflare Email Routing to parse DSN |
| 4 | Platform admin — view inside org | Click org → see its members, campaigns, contacts (read-only) |
| 5 | Delivery Server verify flow | After save, must verify before sending — need proper status tracking |

---

## What Was Fixed Today (2026-03-18/19)

### Backend
- OAuth credentials now from system_settings ONLY (no .env fallback)
- Redirect URIs auto-computed from BASE_URL with /api prefix
- `.env` reduced to 4 lines: PORT, SESSION_SECRET, FRONTEND_URL, BASE_URL
- Platform admin user/org CRUD endpoints (suspend/activate/delete)
- Fetch verified domains from provider API (SendGrid, Mailgun, Postmark, SparkPost)
- Fixed OAuth callback route: `/api/auth/google/callback` (was missing /api prefix)
- DNS records changed from fake dispatch.app to informational guidance
- SES region dropdown: all 17 AWS regions with codes
- Sending domain service: DNS records are informational, not fake

### Frontend
- Platform admin layout: own sidebar with ALL features + Platform section
- Platform Users: radix-vue DropdownMenu with Portal
- Platform Organizations: card layout with inline actions + detail modal
- Campaigns: radix-vue DropdownMenu with Portal
- Delivery Servers: radix-vue DropdownMenu with Portal
- Delivery Servers: 3-step form (Credentials → Domain + Limits → Review)
- Delivery Servers: "Fetch Domains" button to auto-load from provider API
- Delivery Servers: expandable cards with domain, from email, bounce URL
- Settings restructured: Delivery Servers + API Keys + Webhooks (removed scattered pages)
- MainLayout: removed backdrop-blur from header (was blocking tooltips/notifications)
- Removed overflow-hidden from 6 view files (caused dropdown clipping)
- Router guard simplified: only admin routes blocked, settings open to all authenticated
- Platform Settings: OAuth redirect URLs shown with copy buttons
- Platform Settings: Cloudflare OAuth section added

### Architecture
- Platform admin = solo user with all features + god powers, NOT part of any org
- Domains belong to delivery servers, not separate page
- OAuth only from system_settings, never .env
- Redirect URIs auto-computed from BASE_URL
