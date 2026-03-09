# OAuth Setup Guide for Dispatch

This guide explains how to set up Google and Microsoft OAuth for sending emails via their APIs.

## Why OAuth?

- **Google Gmail**: Basic SMTP auth requires "App Passwords" which need 2FA enabled
- **Microsoft 365/Outlook**: Basic auth is deprecated/disabled for many tenants
- **Better Security**: OAuth tokens are more secure than storing passwords
- **Better UX**: Users click "Connect" instead of manually entering SMTP settings

---

## Google Gmail OAuth Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

### 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (or "Internal" for Google Workspace)
3. Fill in required fields:
   - App name: "Dispatch" (or your app name)
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users (your email addresses) if in testing mode

### 3. Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: "Dispatch"
5. Authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://yourdomain.com/auth/google/callback` (production)
6. Click "Create"
7. Copy the **Client ID** and **Client Secret**

### 4. Add to .env

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

---

## Microsoft Outlook/365 OAuth Setup

### 1. Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Fill in:
   - Name: "Dispatch"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Web → `http://localhost:3000/auth/microsoft/callback`
5. Click "Register"

### 2. Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Select "Delegated permissions"
5. Add these permissions:
   - `Mail.Send`
   - `User.Read`
   - `offline_access`
6. Click "Add permissions"
7. (Optional) Click "Grant admin consent" if you're an admin

### 3. Create Client Secret

1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Add description: "Dispatch Secret"
4. Select expiration (recommend 24 months)
5. Click "Add"
6. **Copy the secret value immediately** (you won't see it again!)

### 4. Get Application (Client) ID

1. Go to "Overview"
2. Copy the "Application (client) ID"

### 5. Add to .env

```env
MICROSOFT_CLIENT_ID=your_application_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret_value
MICROSOFT_REDIRECT_URI=http://localhost:3000/auth/microsoft/callback
```

---

## Testing OAuth

1. Start the server: `bun run dev`
2. Go to http://localhost:3000
3. Login to your account
4. Navigate to "Configs"
5. Click "Connect Google" or "Connect Microsoft"
6. Authorize the application
7. You should be redirected back with the account connected

---

## Production Deployment

For production, update the redirect URIs:

```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
MICROSOFT_REDIRECT_URI=https://yourdomain.com/auth/microsoft/callback
```

Also update the redirect URIs in:
- Google Cloud Console → Credentials → Your OAuth Client
- Azure Portal → App registrations → Your App → Authentication

---

## Troubleshooting

### Google: "Access blocked: This app's request is invalid"
- Check that redirect URI matches exactly (including trailing slash)
- Ensure Gmail API is enabled
- Add your email to test users if app is in testing mode

### Microsoft: "AADSTS50011: The reply URL specified in the request does not match"
- Check that redirect URI matches exactly in Azure Portal
- Ensure you're using the correct Application (client) ID

### Token Refresh Issues
- Google: Ensure `access_type=offline` and `prompt=consent` are in auth URL
- Microsoft: Ensure `offline_access` scope is requested

---

## Security Notes

1. **Never commit** `.env` file with real credentials
2. Use **environment variables** in production
3. Rotate client secrets periodically
4. Monitor OAuth usage in Google/Azure dashboards
5. Revoke access for unused accounts
