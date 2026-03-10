/**
 * OAuth Utilities
 * Shared OAuth handling logic
 */
import { SERVER } from '../config'
import { logger } from './logger'
import { d1UserDatabase } from '../services/d1UserDatabase'
import { oauthService } from '../services/oauthService'

export type OAuthProvider = 'google' | 'microsoft'

interface OAuthCallbackParams {
  code: string | undefined
  state: string | undefined
  error: string | undefined
}

interface OAuthCallbackResult {
  success: boolean
  redirectUrl: string
}

/**
 * Handle OAuth callback for any provider
 * Eliminates duplicate code between Google and Microsoft callbacks
 */
export async function handleOAuthCallback(
  provider: OAuthProvider,
  params: OAuthCallbackParams
): Promise<OAuthCallbackResult> {
  const frontendUrl = SERVER.FRONTEND_URL
  const { code, state, error } = params

  // Handle OAuth errors
  if (error) {
    return {
      success: false,
      redirectUrl: `${frontendUrl}/configs?error=${provider}_denied`,
    }
  }

  // Validate required params
  if (!code || !state) {
    return {
      success: false,
      redirectUrl: `${frontendUrl}/configs?error=invalid_callback`,
    }
  }

  // Validate state
  const stateData = oauthService.validateState(state)
  if (!stateData || stateData.provider !== provider) {
    return {
      success: false,
      redirectUrl: `${frontendUrl}/configs?error=invalid_state`,
    }
  }

  try {
    // Exchange code for tokens
    const tokens = provider === 'google'
      ? await oauthService.exchangeGoogleCode(code)
      : await oauthService.exchangeMicrosoftCode(code)

    // Get existing configs
    const existingConfigs = await d1UserDatabase.getUserSMTPConfigs(stateData.userId)
    const existingConfig = existingConfigs.find(
      (cfg) => cfg.provider_type === provider && cfg.oauth_email === tokens.email
    )

    // Update or create config
    if (existingConfig) {
      // Update all OAuth tokens, not just access token
      await d1UserDatabase.updateSMTPConfig(existingConfig.id, stateData.userId, {
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token,
        oauth_expires_at: new Date(tokens.expires_at).toISOString(),
      })
      logger.debug(`Updated ${provider} OAuth for: ${tokens.email}`)
    } else {
      const configName = provider === 'google' ? `Gmail - ${tokens.name}` : `Outlook - ${tokens.name}`
      await d1UserDatabase.createSMTPConfig({
        user_id: stateData.userId,
        name: configName,
        provider_type: provider,
        oauth_email: tokens.email,
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token,
        oauth_expires_at: new Date(tokens.expires_at).toISOString(),
        is_default: existingConfigs.length === 0,
      })
      logger.info(`Connected ${provider} account: ${tokens.email}`)
    }

    return {
      success: true,
      redirectUrl: `${frontendUrl}/configs?success=${provider}_connected`,
    }
  } catch (err) {
    logger.error(`${provider} OAuth callback error:`, err)
    return {
      success: false,
      redirectUrl: `${frontendUrl}/configs?error=${provider}_failed`,
    }
  }
}

/**
 * Get valid OAuth access token (refresh if needed)
 */
export async function getValidOAuthToken(
  config: {
    id: string
    provider_type: string
    oauth_access_token?: string
    oauth_refresh_token?: string
    oauth_expires_at?: string
  },
  userId: string
): Promise<string> {
  if (!config.oauth_access_token || !config.oauth_refresh_token) {
    throw new Error('OAuth tokens not found. Please reconnect your account.')
  }

  // Check if token needs refresh
  if (d1UserDatabase.needsTokenRefresh(config as any)) {
    logger.debug(`Refreshing OAuth token for ${config.provider_type}...`)

    try {
      const newTokens = config.provider_type === 'google'
        ? await oauthService.refreshGoogleToken(config.oauth_refresh_token)
        : await oauthService.refreshMicrosoftToken(config.oauth_refresh_token)

      await d1UserDatabase.updateOAuthTokens(
        config.id,
        userId,
        newTokens.access_token,
        new Date(newTokens.expires_at).toISOString()
      )
      
      logger.debug(`OAuth token refreshed for ${config.provider_type}`)
      return newTokens.access_token
    } catch (err) {
      logger.error('Failed to refresh OAuth token:', err)
      throw new Error('OAuth token expired. Please reconnect your account.')
    }
  }

  return config.oauth_access_token
}

/**
 * Send single email via OAuth
 */
export async function sendOAuthEmail(
  provider: OAuthProvider,
  accessToken: string,
  to: string,
  subject: string,
  htmlContent: string,
  fromName: string,
  fromEmail: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (provider === 'google') {
      const result = await oauthService.sendGmailEmail(
        accessToken, to, subject, htmlContent, fromName, fromEmail
      )
      return { success: true, messageId: result.messageId }
    } else {
      const result = await oauthService.sendOutlookEmail(
        accessToken, to, subject, htmlContent, fromName
      )
      return { success: true, messageId: result.messageId }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
