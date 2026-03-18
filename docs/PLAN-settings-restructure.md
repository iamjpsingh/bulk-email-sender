# Settings Restructure — MailWizz-Style Delivery Servers

## Current Problem
Settings has scattered pages that don't make sense:
- Email Providers (only Gmail/Outlook OAuth)
- SMTP (manual configs)
- Tracking (separate page)
- Domains (separate page)
- All disconnected from each other

## New Structure

```
Settings
├── Delivery Servers      ← All email providers in one place
├── Sending Domains       ← All domains across all providers, one view
├── API Keys              ← Developer access
└── Webhooks              ← Event notifications
```

### 1. Delivery Servers (replaces Email Providers + SMTP)

**One page to add ANY provider:**

| Provider | What You Enter | What It Auto-Does |
|----------|---------------|-------------------|
| SMTP | Host, port, user, pass | Test connection |
| Amazon SES | Access Key, Secret, Region | Fetch verified domains, register bounce webhook |
| SendGrid | API Key | Fetch authenticated domains, register event webhook |
| Mailgun | API Key, Region | Fetch domains, register bounce webhook |
| Postmark | Server Token | Fetch domains, register bounce webhook |
| SparkPost | API Key | Register bounce webhook |
| Gmail OAuth | One-click connect | Get email address |
| Outlook OAuth | One-click connect | Get email address |

**Each server card shows:**
- Provider type + name
- Status (active/paused/error)
- Domains it can send from
- Daily limit + usage
- Health (success rate, last error)
- Warmup status

### 2. Sending Domains (replaces Domains + Tracking)

**Shows ALL domains from ALL providers in one table:**

| Domain | Provider | Status | Tracking | Emails |
|--------|----------|--------|----------|--------|
| example.com | SES (us-east-1) | Verified | Active | 3 |
| mg.mysite.io | Mailgun | Verified | Not Set | 1 |
| mail.store.co | SendGrid | Pending | — | 0 |

**Each domain row expands to show:**
- DNS records needed (DKIM, SPF, DMARC)
- Tracking setup (deploy Cloudflare Worker from here)
- Sending emails under this domain (hello@, newsletter@, etc.)
- Assign emails to users

### 3. What Gets Removed
- `/settings/email` → merged into Delivery Servers
- `/settings/smtp` → merged into Delivery Servers
- `/settings/tracking` → merged into Sending Domains
- `/settings/domains` → becomes the new Sending Domains page

### Implementation
1. Create new `DeliveryServersPage.vue` — replaces EmailSettings + SmtpSettings
2. Update `SendingDomainsPage.vue` — enhanced DomainsSettings with tracking built in
3. Update SettingsLayout nav — remove old items, add new ones
4. Update router — new routes
5. Keep API Keys + Webhooks as-is
