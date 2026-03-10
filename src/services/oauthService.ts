/**
 * OAuth Service
 * Google & Microsoft OAuth integration
 */
import { randomBytes } from 'crypto'
import { logger } from '../utils/logger'
import { OAUTH } from '../config'

export type EmailProvider = 'google' | 'microsoft' | 'smtp'

export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  scope: string
}

// OAuth URLs
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

class OAuthService {
  private stateStore: Map<string, { userId: string; provider: EmailProvider; timestamp: number }> = new Map()

  constructor() {
    // Clean up expired states every 10 minutes
    setInterval(() => this.cleanExpiredStates(), 10 * 60 * 1000)
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Generate secure state parameter for OAuth flow
   */
  generateState(userId: string, provider: EmailProvider): string {
    const state = randomBytes(32).toString('hex')
    this.stateStore.set(state, {
      userId,
      provider,
      timestamp: Date.now(),
    })
    return state
  }

  /**
   * Validate and consume state
   */
  validateState(state: string): { userId: string; provider: EmailProvider } | null {
    const data = this.stateStore.get(state)
    if (!data) return null

    // State expires after 10 minutes
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(state)
      return null
    }

    this.stateStore.delete(state)
    return { userId: data.userId, provider: data.provider }
  }

  private cleanExpiredStates(): void {
    const now = Date.now()
    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.timestamp > 10 * 60 * 1000) {
        this.stateStore.delete(state)
      }
    }
  }

  // ============================================================================
  // Authorization URLs
  // ============================================================================

  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthUrl(userId: string): string {
    const { CLIENT_ID, REDIRECT_URI, SCOPES } = OAUTH.GOOGLE

    if (!CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID not configured')
    }

    const state = this.generateState(userId, 'google')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    return `${GOOGLE_AUTH_URL}?${params.toString()}`
  }

  /**
   * Get Microsoft OAuth authorization URL
   */
  getMicrosoftAuthUrl(userId: string): string {
    const { CLIENT_ID, REDIRECT_URI, SCOPES } = OAUTH.MICROSOFT

    if (!CLIENT_ID) {
      throw new Error('MICROSOFT_CLIENT_ID not configured')
    }

    const state = this.generateState(userId, 'microsoft')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
    })

    return `${MICROSOFT_AUTH_URL}?${params.toString()}`
  }

  // ============================================================================
  // Token Exchange
  // ============================================================================

  /**
   * Exchange Google authorization code for tokens
   */
  async exchangeGoogleCode(code: string): Promise<OAuthTokens & { email: string; name: string }> {
    const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = OAUTH.GOOGLE

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured')
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      logger.error('Google token exchange failed:', error)
      throw new Error('Failed to exchange Google authorization code')
    }

    const tokens = await tokenResponse.json()

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to get Google user info')
    }

    const userInfo = await userResponse.json()

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
      email: userInfo.email,
      name: userInfo.name || userInfo.email,
    }
  }

  /**
   * Exchange Microsoft authorization code for tokens
   */
  async exchangeMicrosoftCode(code: string): Promise<OAuthTokens & { email: string; name: string }> {
    const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPES } = OAUTH.MICROSOFT

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: SCOPES.join(' '),
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      logger.error('Microsoft token exchange failed:', error)
      throw new Error('Failed to exchange Microsoft authorization code')
    }

    const tokens = await tokenResponse.json()

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to get Microsoft user info')
    }

    const userInfo = await userResponse.json()

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
      email: userInfo.mail || userInfo.userPrincipalName,
      name: userInfo.displayName || userInfo.mail,
    }
  }

  // ============================================================================
  // Token Refresh
  // ============================================================================

  /**
   * Refresh Google access token
   */
  async refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
    const { CLIENT_ID, CLIENT_SECRET } = OAUTH.GOOGLE

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured')
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh Google token')
    }

    const tokens = await response.json()
    return {
      access_token: tokens.access_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    }
  }

  /**
   * Refresh Microsoft access token
   */
  async refreshMicrosoftToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
    const { CLIENT_ID, CLIENT_SECRET, SCOPES } = OAUTH.MICROSOFT

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Microsoft OAuth credentials not configured')
    }

    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES.join(' '),
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh Microsoft token')
    }

    const tokens = await response.json()
    return {
      access_token: tokens.access_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    }
  }

  // ============================================================================
  // Email Sending
  // ============================================================================

  /**
   * Send email via Gmail API
   */
  async sendGmailEmail(
    accessToken: string,
    to: string,
    subject: string,
    htmlContent: string,
    fromName: string,
    fromEmail: string
  ): Promise<{ messageId: string }> {
    const messageParts = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      htmlContent,
    ]

    const message = messageParts.join('\r\n')
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Gmail send failed:', error)
      throw new Error(`Failed to send email via Gmail: ${response.status}`)
    }

    const result = await response.json()
    return { messageId: result.id }
  }

  /**
   * Send email via Microsoft Graph API
   */
  async sendOutlookEmail(
    accessToken: string,
    to: string,
    subject: string,
    htmlContent: string,
    fromName: string
  ): Promise<{ messageId: string }> {
    const emailData = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: htmlContent,
        },
        toRecipients: [
          {
            emailAddress: { address: to },
          },
        ],
        from: {
          emailAddress: {
            name: fromName,
          },
        },
      },
      saveToSentItems: true,
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Outlook send failed:', error)
      throw new Error(`Failed to send email via Outlook: ${response.status}`)
    }

    return { messageId: `outlook_${Date.now()}` }
  }

  // ============================================================================
  // Connection Test
  // ============================================================================

  /**
   * Test OAuth connection
   */
  async testConnection(provider: EmailProvider, accessToken: string): Promise<boolean> {
    try {
      if (provider === 'google') {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        return response.ok
      } else if (provider === 'microsoft') {
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        return response.ok
      }
      return false
    } catch {
      return false
    }
  }
}

export const oauthService = new OAuthService()
