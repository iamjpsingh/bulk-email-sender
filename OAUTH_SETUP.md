# OAuth Setup Guide

Google and Microsoft OAuth for sending emails via their APIs.

## Why OAuth?

- **Google Gmail**: Basic SMTP auth requires "App Passwords" which need 2FA enabled
- **Microsoft 365/Outlook**: Basic auth is deprecated/disabled for many tenants
- **Better Security**: OAuth tokens are more secure than storing passwords
- **Better UX**: Users click "Connect" instead of manually entering SMTP settings

---

## How It Works in Dispatch

OAuth credentials are configured by the **platform admin** via the app UI — no `.env` variables needed.

1. Platform admin goes to **Platform Settings → System Mailer**
2. Enters Google/Microsoft Client ID and Client Secret
3. Credentials are stored in the database (`system_settings` table)
4. Org users can then click **"Connect Google"** or **"Connect Microsoft"** in Settings → Delivery Servers to authorize their accounts

The redirect URI is auto-computed from your `BASE_URL` in `.env`:
- Google: `{BASE_URL}/api/auth/google/callback`
- Microsoft: `{BASE_URL}/api/auth/microsoft/callback`

---

## Google Gmail OAuth

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API" → Click "Enable"

### 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (or "Internal" for Google Workspace)
3. Fill in: App name, support email, developer contact
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users if in testing mode

### 3. Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Authorized redirect URIs:
   - `http://localhost:5500/api/auth/google/callback` (development)
   - `https://yourdomain.com/api/auth/google/callback` (production)
5. Copy the **Client ID** and **Client Secret**

### 4. Enter in Dispatch

1. Login as platform admin
2. Go to **Platform Settings → System Mailer**
3. Enter the Google Client ID and Client Secret
4. Save

---

## Microsoft Outlook/365 OAuth

### 1. Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Fill in:
   - Name: "Dispatch"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Web → `http://localhost:5500/api/auth/microsoft/callback`
5. Click "Register"

### 2. Configure API Permissions

1. Go to "API permissions" → "Add a permission"
2. Select "Microsoft Graph" → "Delegated permissions"
3. Add: `Mail.Send`, `User.Read`, `offline_access`
4. Click "Add permissions"

### 3. Create Client Secret

1. Go to "Certificates & secrets" → "New client secret"
2. Add description, select expiration (24 months recommended)
3. **Copy the secret value immediately** (shown only once)

### 4. Enter in Dispatch

1. Login as platform admin
2. Go to **Platform Settings → System Mailer**
3. Enter the Microsoft Client ID and Client Secret
4. Save

---

## Testing

1. Login as a regular org user
2. Go to **Settings → Delivery Servers**
3. Click **Add Server** → Select Gmail or Outlook
4. Click **Connect** — OAuth flow will redirect you
5. Authorize the application
6. You should be redirected back with the account connected

---

## Troubleshooting

### "Access blocked: This app's request is invalid" (Google)
- Check redirect URI matches exactly (including `/api/` prefix)
- Ensure Gmail API is enabled
- Add your email to test users if app is in testing mode

### "AADSTS50011: The reply URL does not match" (Microsoft)
- Check redirect URI matches exactly in Azure Portal
- Must include `/api/auth/microsoft/callback`

### Token Refresh Issues
- Google: Ensure `access_type=offline` and `prompt=consent` in auth URL (handled automatically)
- Microsoft: Ensure `offline_access` scope is requested (handled automatically)

---

## Security Notes

1. OAuth credentials are stored encrypted in the database, not in `.env`
2. Only platform admin can configure OAuth credentials
3. Rotate client secrets periodically
4. Monitor OAuth usage in Google/Azure dashboards
