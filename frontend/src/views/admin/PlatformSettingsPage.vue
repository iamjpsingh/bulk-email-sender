<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { adminApi } from '../../lib/api/admin'
import type { SystemMailerConfig, ProviderType } from '../../lib/api/admin'
import { cloudflareApi } from '../../lib/api/cloudflare'
import { useToast } from '../../composables/useToast'
import Skeleton from '../../components/ui/Skeleton.vue'
import InfoTip from '../../components/ui/InfoTip.vue'
import {
  Mail, Loader2, CheckCircle, XCircle, Send, Trash2, Server, Cloud, Globe, Zap,
  Settings, Link2, AlertTriangle, Radio, Webhook,
} from 'lucide-vue-next'

const route = useRoute()
const toast = useToast()

// State
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const sendingTest = ref(false)
const removing = ref(false)
const savingOAuth = ref(false)
const connectingOAuth = ref<string | null>(null)
const isConfigured = ref(false)

// Config
const provider = ref<ProviderType>('smtp')
const fromName = ref('Dispatch')
const fromEmail = ref('')
const connectedEmail = ref('')

// SMTP
const smtpHost = ref('')
const smtpPort = ref(587)
const smtpSecure = ref(false)
const smtpUsername = ref('')
const smtpPassword = ref('')

// SES
const sesAccessKey = ref('')
const sesSecretKey = ref('')
const sesRegion = ref('us-east-1')

// SendGrid
const sgApiKey = ref('')

// Mailgun
const mgApiKey = ref('')
const mgDomain = ref('')
const mgRegion = ref<'us' | 'eu'>('us')

// Postmark
const pmServerToken = ref('')

// SparkPost
const spApiKey = ref('')

// OAuth credentials (Google/Microsoft client ID+secret for the platform)
const googleClientId = ref('')
const googleClientSecret = ref('')
const msClientId = ref('')
const msClientSecret = ref('')
const googleOAuthSaved = ref(false)
const msOAuthSaved = ref(false)

// Cloudflare tracking
const cfConnected = ref(false)
const cfAccountName = ref('')
const webhookRegistered = ref(false)
const webhookProvider = ref('')

const providers = [
  { value: 'smtp' as ProviderType, label: 'SMTP Server', icon: Server, desc: 'Any SMTP server', domainLevel: false },
  { value: 'ses' as ProviderType, label: 'Amazon SES', icon: Cloud, desc: 'AWS — Domain-level sending', domainLevel: true },
  { value: 'sendgrid' as ProviderType, label: 'SendGrid', icon: Zap, desc: 'Twilio — Domain-level API', domainLevel: true },
  { value: 'mailgun' as ProviderType, label: 'Mailgun', icon: Mail, desc: 'Sinch — Domain-level API', domainLevel: true },
  { value: 'postmark' as ProviderType, label: 'Postmark', icon: Send, desc: 'ActiveCampaign — Transactional', domainLevel: true },
  { value: 'sparkpost' as ProviderType, label: 'SparkPost', icon: Zap, desc: 'MessageBird — High volume', domainLevel: true },
  { value: 'gmail' as ProviderType, label: 'Gmail', icon: Globe, desc: 'OAuth — Connect Google account', domainLevel: false },
  { value: 'outlook' as ProviderType, label: 'Outlook', icon: Globe, desc: 'OAuth — Connect Microsoft account', domainLevel: false },
]

const selectedProvider = computed(() => providers.find(p => p.value === provider.value))
const isOAuthProvider = computed(() => provider.value === 'gmail' || provider.value === 'outlook')
const isDomainLevel = computed(() => selectedProvider.value?.domainLevel ?? false)

const canSave = computed(() => {
  if (!fromName.value.trim() || !fromEmail.value.trim()) return false
  switch (provider.value) {
    case 'smtp': return !!smtpHost.value && smtpPort.value > 0 && !!smtpUsername.value && !!smtpPassword.value
    case 'ses': return !!sesAccessKey.value && !!sesSecretKey.value && !!sesRegion.value
    case 'sendgrid': return !!sgApiKey.value
    case 'mailgun': return !!mgApiKey.value && !!mgDomain.value
    case 'postmark': return !!pmServerToken.value
    case 'sparkpost': return !!spApiKey.value
    case 'gmail': case 'outlook': return false // OAuth uses connect flow, not manual save
    default: return false
  }
})

// Setup status
const setupStatus = computed(() => ({
  mailer: isConfigured.value,
  googleOAuth: googleOAuthSaved.value,
  microsoftOAuth: msOAuthSaved.value,
  tracking: cfConnected.value,
  webhooks: webhookRegistered.value,
}))

const setupComplete = computed(() => setupStatus.value.mailer)

function buildConfig(): SystemMailerConfig {
  const base: SystemMailerConfig = { fromName: fromName.value.trim(), fromEmail: fromEmail.value.trim(), providerConfig: { provider: provider.value } }
  switch (provider.value) {
    case 'smtp':
      base.providerConfig = { provider: 'smtp', host: smtpHost.value, port: smtpPort.value, secure: smtpSecure.value, username: smtpUsername.value, password: smtpPassword.value }
      break
    case 'ses':
      base.providerConfig = { provider: 'ses', accessKeyId: sesAccessKey.value, secretAccessKey: sesSecretKey.value, region: sesRegion.value }
      break
    case 'sendgrid':
      base.providerConfig = { provider: 'sendgrid', apiKey: sgApiKey.value }
      break
    case 'mailgun':
      base.providerConfig = { provider: 'mailgun', apiKey: mgApiKey.value, domain: mgDomain.value, region: mgRegion.value }
      break
    case 'postmark':
      base.providerConfig = { provider: 'postmark', serverToken: pmServerToken.value }
      break
    case 'sparkpost':
      base.providerConfig = { provider: 'sparkpost', apiKey: spApiKey.value }
      break
  }
  return base
}

function applyConfig(cfg: SystemMailerConfig) {
  fromName.value = cfg.fromName
  fromEmail.value = cfg.fromEmail
  const pc = cfg.providerConfig
  provider.value = pc.provider
  if (pc.provider === 'smtp') { smtpHost.value = pc.host || ''; smtpPort.value = pc.port || 587; smtpSecure.value = pc.secure || false; smtpUsername.value = pc.username || ''; smtpPassword.value = pc.password || '' }
  if (pc.provider === 'ses') { sesAccessKey.value = pc.accessKeyId || ''; sesSecretKey.value = pc.secretAccessKey || ''; sesRegion.value = pc.region || 'us-east-1' }
  if (pc.provider === 'sendgrid') { sgApiKey.value = pc.apiKey || '' }
  if (pc.provider === 'mailgun') { mgApiKey.value = pc.apiKey || ''; mgDomain.value = pc.domain || ''; mgRegion.value = pc.region || 'us' }
  if (pc.provider === 'postmark') { pmServerToken.value = pc.serverToken || '' }
  if (pc.provider === 'sparkpost') { spApiKey.value = pc.apiKey || '' }
  if (pc.provider === 'gmail' || pc.provider === 'outlook') { connectedEmail.value = pc.email || '' }
}

async function loadConfig() {
  try {
    const [mailerData, oauthData, cfStatus, whStatus] = await Promise.all([
      adminApi.getSystemMailer(),
      adminApi.getOAuthCredentials(),
      cloudflareApi.getStatus().catch(() => ({ connected: false })),
      adminApi.getWebhookStatus().catch(() => ({ registered: false, status: null })),
    ])
    isConfigured.value = mailerData.configured
    if (mailerData.config) applyConfig(mailerData.config)
    if (oauthData.google) { googleClientId.value = oauthData.google.clientId; googleClientSecret.value = oauthData.google.clientSecret; googleOAuthSaved.value = true }
    if (oauthData.microsoft) { msClientId.value = oauthData.microsoft.clientId; msClientSecret.value = oauthData.microsoft.clientSecret; msOAuthSaved.value = true }
    cfConnected.value = cfStatus.connected
    cfAccountName.value = (cfStatus as any).accountName || ''
    webhookRegistered.value = whStatus.registered
    webhookProvider.value = whStatus.status?.provider || ''
  } catch (e: any) {
    toast.error(e.message || 'Failed to load config')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await adminApi.saveSystemMailer(buildConfig())
    isConfigured.value = true
    toast.success('System mailer saved')
  } catch (e: any) { toast.error(e.message) } finally { saving.value = false }
}

async function handleTest() {
  testing.value = true
  try {
    await adminApi.testSystemMailer()
    toast.success('Connection verified')
  } catch (e: any) { toast.error(e.message) } finally { testing.value = false }
}

async function handleSendTest() {
  sendingTest.value = true
  try {
    await adminApi.sendTestEmail()
    toast.success('Test email sent — check your inbox')
  } catch (e: any) { toast.error(e.message) } finally { sendingTest.value = false }
}

async function handleRemove() {
  if (!confirm('Remove system mailer? Transactional emails will stop.')) return
  removing.value = true
  try {
    await adminApi.removeSystemMailer()
    isConfigured.value = false
    connectedEmail.value = ''
    toast.success('System mailer removed')
  } catch (e: any) { toast.error(e.message) } finally { removing.value = false }
}

async function saveOAuthCreds(prov: 'google' | 'microsoft') {
  savingOAuth.value = true
  try {
    const id = prov === 'google' ? googleClientId.value : msClientId.value
    const secret = prov === 'google' ? googleClientSecret.value : msClientSecret.value
    if (!id || !secret) { toast.error('Client ID and Secret are required'); return }
    await adminApi.saveOAuthCredentials(prov, id, secret)
    if (prov === 'google') googleOAuthSaved.value = true
    else msOAuthSaved.value = true
    toast.success(`${prov === 'google' ? 'Google' : 'Microsoft'} OAuth credentials saved`)
  } catch (e: any) { toast.error(e.message) } finally { savingOAuth.value = false }
}

async function connectOAuth(prov: 'gmail' | 'outlook') {
  connectingOAuth.value = prov
  try {
    const url = await adminApi.getOAuthConnectUrl(prov)
    window.location.href = url
  } catch (e: any) {
    toast.error(e.message)
    connectingOAuth.value = null
  }
}

onMounted(() => {
  // Handle OAuth callback result
  const q = route.query
  if (q.oauth_success) {
    toast.success(`Connected ${q.oauth_success} — ${q.email || ''}`)
    window.history.replaceState({}, '', route.path)
  }
  if (q.oauth_error) {
    toast.error(`OAuth error: ${q.oauth_error}`)
    window.history.replaceState({}, '', route.path)
  }
  if (q.cf_success) {
    toast.success(`Cloudflare connected — ${q.account || 'success'}`)
    window.history.replaceState({}, '', route.path)
  }
  if (q.cf_error) {
    toast.error(`Cloudflare error: ${q.cf_error}`)
    window.history.replaceState({}, '', route.path)
  }
  loadConfig()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-base font-semibold text-text-primary flex items-center gap-2">
          <Settings :size="18" class="text-accent" />
          Platform Settings
        </h2>
        <p class="text-sm text-text-muted mt-0.5">Configure system email and OAuth for the entire platform</p>
      </div>
    </div>

    <div v-if="loading"><Skeleton variant="card" :count="3" /></div>

    <div v-else class="max-w-2xl space-y-6">

      <!-- Setup Status -->
      <div class="bg-bg-card border border-border rounded-xl p-5">
        <h3 class="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          Setup Status
          <InfoTip text="Complete these steps to enable all platform features" />
        </h3>
        <div class="space-y-2">
          <div class="flex items-center gap-3 text-sm">
            <CheckCircle v-if="setupStatus.mailer" :size="16" class="text-success shrink-0" />
            <XCircle v-else :size="16" class="text-error shrink-0" />
            <span :class="setupStatus.mailer ? 'text-text-primary' : 'text-text-muted'">
              System Mailer — {{ setupStatus.mailer ? 'Configured' : 'Required for password reset, invitations' }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <CheckCircle v-if="setupStatus.googleOAuth" :size="16" class="text-success shrink-0" />
            <AlertTriangle v-else :size="16" class="text-warning shrink-0" />
            <span :class="setupStatus.googleOAuth ? 'text-text-primary' : 'text-text-muted'">
              Google OAuth — {{ setupStatus.googleOAuth ? 'Configured' : 'Optional — enables Gmail campaign sending' }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <CheckCircle v-if="setupStatus.microsoftOAuth" :size="16" class="text-success shrink-0" />
            <AlertTriangle v-else :size="16" class="text-warning shrink-0" />
            <span :class="setupStatus.microsoftOAuth ? 'text-text-primary' : 'text-text-muted'">
              Microsoft OAuth — {{ setupStatus.microsoftOAuth ? 'Configured' : 'Optional — enables Outlook campaign sending' }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <CheckCircle v-if="setupStatus.webhooks" :size="16" class="text-success shrink-0" />
            <AlertTriangle v-else :size="16" class="text-warning shrink-0" />
            <span :class="setupStatus.webhooks ? 'text-text-primary' : 'text-text-muted'">
              Bounce Webhooks — {{ setupStatus.webhooks ? `Auto-registered (${webhookProvider})` : 'Auto-registers when mailer is saved' }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <CheckCircle v-if="setupStatus.tracking" :size="16" class="text-success shrink-0" />
            <AlertTriangle v-else :size="16" class="text-warning shrink-0" />
            <span :class="setupStatus.tracking ? 'text-text-primary' : 'text-text-muted'">
              Email Tracking — {{ setupStatus.tracking ? `Cloudflare connected (${cfAccountName})` : 'Optional — deploy Workers for open/click tracking' }}
            </span>
          </div>
        </div>
      </div>

      <!-- OAuth Credentials (Google & Microsoft) -->
      <div class="bg-bg-card border border-border rounded-xl p-5">
        <h3 class="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
          <Link2 :size="16" class="text-accent" />
          OAuth App Credentials
          <InfoTip text="Required for Gmail/Outlook OAuth flows — both for campaign sending (per-user) and system mailer. Create apps in Google Cloud Console and Azure AD." />
        </h3>
        <p class="text-xs text-text-muted mb-4">These enable users to connect Gmail/Outlook for campaign sending</p>

        <!-- Google -->
        <div class="mb-4 p-3 bg-bg-tertiary rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-text-primary">Google OAuth</span>
            <span v-if="googleOAuthSaved" class="badge-sm badge-success">Saved</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group mb-0">
              <label class="form-label text-xs">Client ID</label>
              <input v-model="googleClientId" type="text" class="form-input text-sm" placeholder="xxx.apps.googleusercontent.com" />
            </div>
            <div class="form-group mb-0">
              <label class="form-label text-xs">Client Secret</label>
              <input v-model="googleClientSecret" type="password" class="form-input text-sm" placeholder="********" />
            </div>
          </div>
          <button class="btn-secondary btn-sm mt-2" :disabled="savingOAuth || !googleClientId || !googleClientSecret" @click="saveOAuthCreds('google')">
            <Loader2 v-if="savingOAuth" :size="14" class="animate-spin" /> Save Google Credentials
          </button>
        </div>

        <!-- Microsoft -->
        <div class="p-3 bg-bg-tertiary rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-text-primary">Microsoft OAuth</span>
            <span v-if="msOAuthSaved" class="badge-sm badge-success">Saved</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group mb-0">
              <label class="form-label text-xs">Client ID</label>
              <input v-model="msClientId" type="text" class="form-input text-sm" placeholder="Application (client) ID" />
            </div>
            <div class="form-group mb-0">
              <label class="form-label text-xs">Client Secret</label>
              <input v-model="msClientSecret" type="password" class="form-input text-sm" placeholder="********" />
            </div>
          </div>
          <button class="btn-secondary btn-sm mt-2" :disabled="savingOAuth || !msClientId || !msClientSecret" @click="saveOAuthCreds('microsoft')">
            <Loader2 v-if="savingOAuth" :size="14" class="animate-spin" /> Save Microsoft Credentials
          </button>
        </div>
      </div>

      <!-- System Mailer -->
      <div class="bg-bg-card border border-border rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Mail :size="16" class="text-accent" />
            System Mailer
            <InfoTip text="Used for password reset, invitation, and notification emails. Separate from campaign sending." />
          </h3>
          <span v-if="isConfigured" class="badge-sm badge-success flex items-center gap-1">
            <CheckCircle :size="12" /> Active
          </span>
        </div>

        <!-- Provider Selection -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <button
            v-for="p in providers"
            :key="p.value"
            type="button"
            :class="[
              'flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-center',
              provider === p.value
                ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                : 'border-border hover:border-text-muted'
            ]"
            @click="provider = p.value"
          >
            <component :is="p.icon" :size="16" :class="provider === p.value ? 'text-accent' : 'text-text-muted'" />
            <span class="text-xs font-medium" :class="provider === p.value ? 'text-accent' : 'text-text-primary'">{{ p.label }}</span>
          </button>
        </div>

        <!-- Domain-level info -->
        <div v-if="isDomainLevel" class="mb-4 p-3 bg-info/5 border border-info/20 rounded-lg text-sm text-info">
          <strong>Domain-level sending:</strong> You can send from any email address on your verified domain.
        </div>

        <!-- Sender Details (non-OAuth providers) -->
        <div v-if="!isOAuthProvider" class="grid grid-cols-2 gap-3 mb-4">
          <div class="form-group mb-0">
            <label class="form-label">From Name</label>
            <input v-model="fromName" type="text" class="form-input" placeholder="Dispatch" />
          </div>
          <div class="form-group mb-0">
            <label class="form-label flex items-center gap-1">
              From Email
              <InfoTip v-if="isDomainLevel" text="Any email on your verified domain" :size="12" />
            </label>
            <input v-model="fromEmail" type="email" class="form-input" placeholder="noreply@yourdomain.com" />
          </div>
        </div>

        <!-- SMTP -->
        <div v-if="provider === 'smtp'" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group mb-0">
              <label class="form-label">Host</label>
              <input v-model="smtpHost" type="text" class="form-input" placeholder="smtp.example.com" />
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Port</label>
              <input v-model.number="smtpPort" type="number" class="form-input" placeholder="587" />
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Username</label>
              <input v-model="smtpUsername" type="text" class="form-input" />
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Password</label>
              <input v-model="smtpPassword" type="password" class="form-input" />
            </div>
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="smtpSecure" type="checkbox" class="form-checkbox" />
            <span class="text-sm text-text-primary">SSL/TLS (port 465)</span>
          </label>
        </div>

        <!-- SES -->
        <div v-if="provider === 'ses'" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group mb-0">
              <label class="form-label">IAM Access Key ID</label>
              <input v-model="sesAccessKey" type="text" class="form-input" placeholder="AKIA..." />
            </div>
            <div class="form-group mb-0">
              <label class="form-label">IAM Secret Access Key</label>
              <input v-model="sesSecretKey" type="password" class="form-input" />
            </div>
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Region</label>
            <select v-model="sesRegion" class="form-input">
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-east-2">US East (Ohio)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">EU (Ireland)</option>
              <option value="eu-central-1">EU (Frankfurt)</option>
              <option value="ap-south-1">Asia Pacific (Mumbai)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
              <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
            </select>
          </div>
        </div>

        <!-- SendGrid -->
        <div v-if="provider === 'sendgrid'">
          <div class="form-group mb-0">
            <label class="form-label">API Key</label>
            <input v-model="sgApiKey" type="password" class="form-input" placeholder="SG.xxxxx" />
          </div>
        </div>

        <!-- Mailgun -->
        <div v-if="provider === 'mailgun'" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group mb-0">
              <label class="form-label">API Key</label>
              <input v-model="mgApiKey" type="password" class="form-input" placeholder="key-xxxxx" />
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Sending Domain</label>
              <input v-model="mgDomain" type="text" class="form-input" placeholder="mg.yourdomain.com" />
            </div>
          </div>
          <div class="form-group mb-0">
            <label class="form-label">Region</label>
            <select v-model="mgRegion" class="form-input">
              <option value="us">US</option>
              <option value="eu">EU</option>
            </select>
          </div>
        </div>

        <!-- Postmark -->
        <div v-if="provider === 'postmark'">
          <div class="form-group mb-0">
            <label class="form-label">Server API Token</label>
            <input v-model="pmServerToken" type="password" class="form-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </div>
        </div>

        <!-- SparkPost -->
        <div v-if="provider === 'sparkpost'">
          <div class="form-group mb-0">
            <label class="form-label">API Key</label>
            <input v-model="spApiKey" type="password" class="form-input" />
          </div>
        </div>

        <!-- Gmail OAuth Connect -->
        <div v-if="provider === 'gmail'" class="space-y-3">
          <div v-if="connectedEmail && isConfigured" class="p-3 bg-success/5 border border-success/20 rounded-lg">
            <div class="flex items-center gap-2 text-sm text-success font-medium">
              <CheckCircle :size="16" /> Connected as {{ connectedEmail }}
            </div>
          </div>
          <div v-else>
            <p class="text-sm text-text-muted mb-3">Connect your Google account via OAuth. Requires Google OAuth credentials saved above.</p>
            <button
              class="btn-primary"
              :disabled="!googleOAuthSaved || connectingOAuth === 'gmail'"
              @click="connectOAuth('gmail')"
            >
              <Loader2 v-if="connectingOAuth === 'gmail'" :size="16" class="animate-spin" />
              <Globe v-else :size="16" />
              Connect Gmail
            </button>
            <p v-if="!googleOAuthSaved" class="text-xs text-warning mt-2">Save Google OAuth credentials first</p>
          </div>
        </div>

        <!-- Outlook OAuth Connect -->
        <div v-if="provider === 'outlook'" class="space-y-3">
          <div v-if="connectedEmail && isConfigured" class="p-3 bg-success/5 border border-success/20 rounded-lg">
            <div class="flex items-center gap-2 text-sm text-success font-medium">
              <CheckCircle :size="16" /> Connected as {{ connectedEmail }}
            </div>
          </div>
          <div v-else>
            <p class="text-sm text-text-muted mb-3">Connect your Microsoft account via OAuth. Requires Microsoft OAuth credentials saved above.</p>
            <button
              class="btn-primary"
              :disabled="!msOAuthSaved || connectingOAuth === 'outlook'"
              @click="connectOAuth('outlook')"
            >
              <Loader2 v-if="connectingOAuth === 'outlook'" :size="16" class="animate-spin" />
              <Globe v-else :size="16" />
              Connect Outlook
            </button>
            <p v-if="!msOAuthSaved" class="text-xs text-warning mt-2">Save Microsoft OAuth credentials first</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 flex-wrap mt-5 pt-4 border-t border-border">
          <button v-if="!isOAuthProvider" class="btn-primary" :disabled="!canSave || saving" @click="handleSave">
            <Loader2 v-if="saving" :size="16" class="animate-spin" /> Save Configuration
          </button>
          <button v-if="isConfigured" class="btn-secondary" :disabled="testing" @click="handleTest">
            <Loader2 v-if="testing" :size="16" class="animate-spin" />
            <CheckCircle v-else :size="16" /> Test Connection
          </button>
          <button v-if="isConfigured" class="btn-secondary" :disabled="sendingTest" @click="handleSendTest">
            <Loader2 v-if="sendingTest" :size="16" class="animate-spin" />
            <Send v-else :size="16" /> Send Test Email
          </button>
          <button v-if="isConfigured" class="btn-ghost text-error" :disabled="removing" @click="handleRemove">
            <Trash2 :size="16" /> Remove
          </button>
        </div>
      </div>

      <!-- Info -->
      <div class="bg-bg-tertiary border border-border rounded-lg p-4 text-sm text-text-muted">
        <p class="font-medium text-text-secondary mb-1">What uses this mailer?</p>
        <ul class="list-disc list-inside space-y-0.5">
          <li>Password reset emails</li>
          <li>Organization invitation emails</li>
          <li>Platform notifications</li>
        </ul>
        <p class="mt-2 text-xs">This is separate from campaign sending, which uses per-user SMTP/OAuth configs.</p>
      </div>
    </div>
  </div>
</template>
