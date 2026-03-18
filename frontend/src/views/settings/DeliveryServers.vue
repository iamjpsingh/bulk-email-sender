<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  useConfigs, useCreateConfig, useUpdateConfig, useDeleteConfig,
  useTestConfig, useTestConnection, useOAuthStatus, useConnectOAuth, useDisconnectOAuth,
} from '../../lib/query'
import { useToast } from '../../composables/useToast'
import type { SMTPConfig } from '../../lib/api'
import Modal from '../../components/ui/Modal.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import InfoTip from '../../components/ui/InfoTip.vue'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem,
} from 'radix-vue'
import {
  Plus, Pencil, Trash2, Plug, Server, Loader2, Inbox, Copy,
  Cloud, Zap, Mail, Globe, Send, MoreVertical,
  ShieldCheck, ShieldAlert,
} from 'lucide-vue-next'

const toast = useToast()
const { data: configs, isLoading: loading } = useConfigs()
const createMutation = useCreateConfig()
const updateMutation = useUpdateConfig()
const deleteMutation = useDeleteConfig()
const testMutation = useTestConfig()
const testConnectionMutation = useTestConnection()
const connectOAuth = useConnectOAuth()

const allServers = computed(() => configs.value || [])
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })
const showAddModal = ref(false)
const showForm = ref(false)
const editingId = ref<string | null>(null)
// actionMenuOpen removed — using radix-vue DropdownMenu with portal (no overflow issues)
const verifying = ref<string | null>(null)
const formStep = ref(1) // 1=credentials, 2=sender, 3=verify
const expandedServer = ref<string | null>(null) // which server card is expanded
const addingEmail = ref(false)
const newEmail = ref({ serverId: '', email: '', displayName: '' })
const fetchingDomains = ref(false)
const fetchedDomains = ref<string[]>([])
const domainFetchNote = ref('')

const form = ref({
  name: '', provider_type: 'smtp',
  // SMTP
  host: '', port: 587, secure: false, user: '', pass: '',
  // API providers
  api_key: '', api_secret: '', api_region: 'us-east-1', api_domain: '',
  // Sender
  from_email: '', from_name: '',
  // Tracking
  tracking_domain: '',
  // Limits
  hourly_limit: 0, daily_limit: 500,
  // Flags
  is_default: false, force_from: false,
  // Callback
  bounce_webhook_url: '',
})

const providerTypes = [
  { value: 'smtp', label: 'SMTP', icon: Server, desc: 'Any SMTP server', color: 'text-text-muted', fields: ['host', 'port', 'user', 'pass'] },
  { value: 'ses', label: 'Amazon SES', icon: Cloud, desc: 'IAM keys — domain-level', color: 'text-amber-400', fields: ['api_key', 'api_secret', 'api_region'] },
  { value: 'sendgrid', label: 'SendGrid', icon: Zap, desc: 'API key', color: 'text-blue-400', fields: ['api_key'] },
  { value: 'mailgun', label: 'Mailgun', icon: Mail, desc: 'API key + domain', color: 'text-red-400', fields: ['api_key', 'api_domain', 'api_region'] },
  { value: 'postmark', label: 'Postmark', icon: Send, desc: 'Server token', color: 'text-yellow-400', fields: ['api_key'] },
  { value: 'sparkpost', label: 'SparkPost', icon: Zap, desc: 'API key', color: 'text-orange-400', fields: ['api_key'] },
  { value: 'google', label: 'Gmail', icon: Globe, desc: 'OAuth — one click', color: 'text-green-400', fields: [] },
  { value: 'microsoft', label: 'Outlook', icon: Globe, desc: 'OAuth — one click', color: 'text-blue-400', fields: [] },
]

function selectProvider(type: string) {
  showAddModal.value = false
  if (type === 'google' || type === 'microsoft') {
    connectOAuth.mutate(type as any)
    return
  }
  form.value = {
    name: providerTypes.find(p => p.value === type)?.label || type,
    provider_type: type,
    host: type === 'smtp' ? 'smtp.gmail.com' : '', port: 587, secure: false, user: '', pass: '',
    api_key: '', api_secret: '', api_region: type === 'ses' ? 'us-east-1' : type === 'mailgun' ? 'us' : '', api_domain: '',
    from_email: '', from_name: '',
    tracking_domain: '', hourly_limit: 0,
    daily_limit: type === 'ses' ? 50000 : type === 'sendgrid' ? 100000 : type === 'mailgun' ? 10000 : 500,
    is_default: false, force_from: false, bounce_webhook_url: '',
  }
  editingId.value = null
  formStep.value = 1
  showForm.value = true
}

function editServer(server: SMTPConfig) {
  form.value = {
    name: server.name || '', provider_type: server.provider_type || 'smtp',
    host: server.host || '', port: server.port || 587, secure: !!server.secure,
    user: server.user || '', pass: '',
    api_key: server.api_key || '', api_secret: '', api_region: server.api_region || '',
    api_domain: server.api_domain || '',
    from_email: server.from_email || '', from_name: server.from_name || '',
    tracking_domain: (server as any).tracking_domain || '',
    hourly_limit: (server as any).hourly_limit || 0,
    daily_limit: (server as any).daily_limit || 500,
    is_default: !!server.is_default, force_from: !!(server as any).force_from,
    bounce_webhook_url: (server as any).bounce_webhook_url || '',
  }
  editingId.value = server.id
  formStep.value = 1
  showForm.value = true
  actionMenuOpen.value = null
}

async function saveServer() {
  try {
    if (editingId.value) {
      await updateMutation.mutateAsync({ id: editingId.value, updates: form.value })
      toast.success('Server updated')
    } else {
      await createMutation.mutateAsync(form.value as any)
      toast.success('Server added — verify connection to activate')
    }
    showForm.value = false
  } catch (e: any) { toast.error(e.message) }
}

async function verifyServer(id: string) {
  verifying.value = id
  actionMenuOpen.value = null
  try {
    await testMutation.mutateAsync(id)
    toast.success('Connection verified — server is ready to send')
  } catch (e: any) { toast.error(`Verification failed: ${e.message}`) }
  finally { verifying.value = null }
}

async function deleteServer() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
  try { await deleteMutation.mutateAsync(id); toast.success('Server deleted') }
  catch (e: any) { toast.error(e.message) }
}

async function fetchDomains() {
  fetchingDomains.value = true
  fetchedDomains.value = []
  domainFetchNote.value = ''
  try {
    const res = await fetch('/api/config/fetch-domains', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_type: form.value.provider_type,
        api_key: form.value.api_key,
        api_secret: form.value.api_secret,
        api_region: form.value.api_region,
      }),
    })
    const data = await res.json()
    if (data.success) {
      fetchedDomains.value = data.data.domains || []
      domainFetchNote.value = data.data.note || ''
      if (fetchedDomains.value.length === 1) {
        form.value.api_domain = fetchedDomains.value[0]
      }
    } else {
      toast.error(data.message || 'Failed to fetch domains')
    }
  } catch (e: any) { toast.error(e.message) }
  finally { fetchingDomains.value = false }
}

function getProvider(type: string) { return providerTypes.find(p => p.value === type) }
function getBounceUrl(server: SMTPConfig) {
  const base = window.location.origin
  const type = server.provider_type === 'ses' ? 'ses' : server.provider_type
  return `${base}/api/webhooks/bounce/${type}`
}

function toggleExpand(serverId: string) {
  expandedServer.value = expandedServer.value === serverId ? null : serverId
}

function getDomain(server: SMTPConfig): string {
  if (server.api_domain) return server.api_domain
  if (server.from_email) return server.from_email.split('@')[1] || ''
  return ''
}

function openAddEmail(serverId: string) {
  const server = allServers.value.find(s => s.id === serverId)
  const domain = server ? getDomain(server) : ''
  newEmail.value = { serverId, email: domain ? `@${domain}` : '', displayName: '' }
  addingEmail.value = true
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-text-primary">Delivery Servers</h2>
        <p class="text-sm text-text-muted mt-1">
          Manage email sending providers. Each server must be verified before sending.
          <InfoTip text="Add your email provider credentials. Bounce webhooks are auto-registered for API providers. You must verify the connection before sending campaigns." />
        </p>
      </div>
      <button class="btn-primary" @click="showAddModal = true"><Plus :size="14" /> Add Server</button>
    </div>

    <div v-if="loading"><Skeleton variant="card" :count="3" /></div>

    <div v-else-if="allServers.length === 0" class="bg-bg-card border border-border rounded-xl">
      <EmptyState :icon="Inbox" title="No delivery servers" description="Add a delivery server to start sending emails">
        <template #actions><button class="btn-primary" @click="showAddModal = true"><Plus :size="14" /> Add Server</button></template>
      </EmptyState>
    </div>

    <!-- Server Cards -->
    <div v-else class="space-y-3">
      <div v-for="server in allServers" :key="server.id" class="bg-bg-card border border-border rounded-xl transition hover:border-border-hover">
        <!-- Server Header (always visible) -->
        <div class="p-4 cursor-pointer" @click="toggleExpand(server.id)">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-surface-1 flex items-center justify-center shrink-0">
                <component :is="getProvider(server.provider_type)?.icon || Server" :size="18" :class="getProvider(server.provider_type)?.color || 'text-text-muted'" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="text-sm font-semibold text-text-primary">{{ server.name || getProvider(server.provider_type)?.label }}</span>
                  <span v-if="server.is_default" class="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">Default</span>
                  <span v-if="(server as any).verified" class="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5"><ShieldCheck :size="10" /> Verified</span>
                  <span v-else class="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5"><ShieldAlert :size="10" /> Unverified</span>
                </div>
                <div class="flex items-center gap-4 text-xs text-text-muted mt-1 flex-wrap">
                  <span>{{ getProvider(server.provider_type)?.label }}</span>
                  <span v-if="server.from_email">{{ server.from_email }}</span>
                  <span v-if="server.api_domain">{{ server.api_domain }}</span>
                  <span v-if="server.api_region">{{ server.api_region }}</span>
                  <span v-if="server.host">{{ server.host }}:{{ server.port }}</span>
                </div>
              </div>
            </div>

            <!-- Actions (stop propagation so click doesn't toggle expand) -->
            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <button
                v-if="verifying !== server.id"
                @click="verifyServer(server.id)"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition"
                :class="(server as any).verified ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'"
              ><Plug :size="12" /> Verify</button>
              <Loader2 v-else :size="14" class="animate-spin text-text-muted" />
              <DropdownMenuRoot>
                <DropdownMenuTrigger as-child>
                  <button class="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-1 transition"><MoreVertical :size="14" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent :side-offset="4" align="end" class="z-50 min-w-[140px] bg-surface-1 border border-border rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
                    <DropdownMenuItem class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-surface-0 transition outline-none" @select="editServer(server)"><Pencil :size="12" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer text-red-400 hover:bg-surface-0 transition outline-none" @select="deleteConfirm = { show: true, id: server.id }"><Trash2 :size="12" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </div>
          </div>
        </div>

        <!-- Expanded: Domain, Sending Emails, Bounce URL -->
        <div v-if="expandedServer === server.id" class="border-t border-border bg-surface-0 px-4 py-3 space-y-3">
          <!-- Domain -->
          <div v-if="getDomain(server)" class="flex items-center gap-2 text-xs">
            <Globe :size="13" class="text-text-muted" />
            <span class="text-text-muted">Sending Domain:</span>
            <span class="text-text-primary font-medium">{{ getDomain(server) }}</span>
          </div>

          <!-- From Address -->
          <div v-if="server.from_email" class="flex items-center gap-2 text-xs">
            <Mail :size="13" class="text-text-muted" />
            <span class="text-text-muted">Default From:</span>
            <span class="text-text-primary">{{ server.from_name ? `${server.from_name} <${server.from_email}>` : server.from_email }}</span>
          </div>

          <!-- Sending Emails (additional addresses you can send from on this server) -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Sending Emails</span>
              <button class="text-[10px] text-accent hover:text-accent/80 font-medium" @click.stop="openAddEmail(server.id)"><Plus :size="10" class="inline" /> Add Email</button>
            </div>
            <div v-if="!server.from_email && !server.api_domain" class="text-xs text-text-muted py-1">Configure a From email when editing this server</div>
            <div v-else class="text-xs text-text-muted py-1">Additional sending addresses can be configured per campaign when composing.</div>
          </div>

          <!-- Bounce Webhook URL -->
          <div class="pt-2 border-t border-border">
            <div class="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Bounce/Complaint Webhook</div>
            <div class="flex items-center gap-2">
              <code class="text-[10px] font-mono text-text-secondary flex-1 break-all">{{ getBounceUrl(server) }}</code>
              <button class="text-text-muted hover:text-accent p-0.5" @click.stop="navigator.clipboard.writeText(getBounceUrl(server)); toast.success('Copied')"><Copy :size="11" /></button>
            </div>
            <p class="text-[10px] text-text-muted mt-1">For API providers (SES, SendGrid, Mailgun, Postmark, SparkPost), this is auto-registered when you save the server. For SMTP, add it manually in your provider dashboard.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Provider Picker -->
    <Modal :show="showAddModal" title="Add Delivery Server" size="lg" @close="showAddModal = false">
      <p class="text-sm text-text-muted mb-4">Choose your email provider. Bounce webhooks are auto-registered for API providers.</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          v-for="p in providerTypes" :key="p.value"
          class="flex flex-col items-center gap-2 p-4 bg-surface-0 border border-border rounded-xl hover:border-accent/40 hover:bg-accent/5 transition cursor-pointer text-center"
          @click="selectProvider(p.value)"
        >
          <component :is="p.icon" :size="20" :class="p.color" />
          <span class="text-xs font-semibold text-text-primary">{{ p.label }}</span>
          <span class="text-[10px] text-text-muted leading-tight">{{ p.desc }}</span>
        </button>
      </div>
    </Modal>

    <!-- Server Form (Step-by-Step) -->
    <Modal :show="showForm" :title="editingId ? 'Edit Server' : `Add ${getProvider(form.provider_type)?.label || 'Server'}`" size="md" @close="showForm = false">
      <!-- Step indicators -->
      <div class="flex items-center gap-2 mb-5">
        <button v-for="s in 3" :key="s" @click="formStep = s" :class="['w-8 h-8 rounded-full text-xs font-bold transition', formStep >= s ? 'bg-accent text-white' : 'bg-surface-1 text-text-muted']">{{ s }}</button>
        <div class="flex-1 flex items-center gap-1 text-[10px] text-text-muted ml-2">
          <span :class="formStep === 1 ? 'text-accent font-medium' : ''">Credentials</span>
          <span>→</span>
          <span :class="formStep === 2 ? 'text-accent font-medium' : ''">Domain & Limits</span>
          <span>→</span>
          <span :class="formStep === 3 ? 'text-accent font-medium' : ''">Review</span>
        </div>
      </div>

      <!-- Step 1: Provider Credentials -->
      <div v-if="formStep === 1" class="space-y-4">
        <div class="form-group"><label class="form-label">Server Name <InfoTip text="A name to identify this server in your list" :size="12" /></label><input v-model="form.name" class="form-input" placeholder="My SES Server" /></div>

        <template v-if="form.provider_type === 'smtp'">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">Host</label><input v-model="form.host" class="form-input" placeholder="smtp.gmail.com" /></div>
            <div class="form-group"><label class="form-label">Port</label><input v-model.number="form.port" type="number" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Username</label><input v-model="form.user" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Password</label><input v-model="form.pass" type="password" class="form-input" /></div>
          </div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="form.secure" class="form-checkbox" /> Use SSL/TLS (port 465)</label>
          <!-- SMTP: needs from email here since there's no domain auto-fetch -->
          <div class="pt-3 border-t border-border grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">From Email</label><input v-model="form.from_email" class="form-input" placeholder="hello@example.com" /></div>
            <div class="form-group"><label class="form-label">From Name</label><input v-model="form.from_name" class="form-input" placeholder="My Company" /></div>
          </div>
        </template>

        <template v-if="form.provider_type === 'ses'">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">IAM Access Key ID <InfoTip text="Your AWS IAM access key. Must have SES send permission." :size="12" /></label><input v-model="form.api_key" class="form-input" placeholder="AKIA..." /></div>
            <div class="form-group"><label class="form-label">IAM Secret Access Key</label><input v-model="form.api_secret" type="password" class="form-input" /></div>
          </div>
          <div class="form-group"><label class="form-label">Region</label>
            <select v-model="form.api_region" class="form-input">
              <option value="us-east-1">us-east-1 — US East (N. Virginia)</option>
              <option value="us-east-2">us-east-2 — US East (Ohio)</option>
              <option value="us-west-1">us-west-1 — US West (N. California)</option>
              <option value="us-west-2">us-west-2 — US West (Oregon)</option>
              <option value="eu-west-1">eu-west-1 — EU (Ireland)</option>
              <option value="eu-west-2">eu-west-2 — EU (London)</option>
              <option value="eu-central-1">eu-central-1 — EU (Frankfurt)</option>
              <option value="eu-south-1">eu-south-1 — EU (Milan)</option>
              <option value="ap-south-1">ap-south-1 — Asia Pacific (Mumbai)</option>
              <option value="ap-southeast-1">ap-southeast-1 — Asia Pacific (Singapore)</option>
              <option value="ap-southeast-2">ap-southeast-2 — Asia Pacific (Sydney)</option>
              <option value="ap-northeast-1">ap-northeast-1 — Asia Pacific (Tokyo)</option>
              <option value="ap-northeast-2">ap-northeast-2 — Asia Pacific (Seoul)</option>
              <option value="ca-central-1">ca-central-1 — Canada (Central)</option>
              <option value="sa-east-1">sa-east-1 — South America (São Paulo)</option>
              <option value="me-south-1">me-south-1 — Middle East (Bahrain)</option>
              <option value="af-south-1">af-south-1 — Africa (Cape Town)</option>
            </select>
          </div>
          <p class="text-xs text-text-muted">After adding, the system will use your IAM keys to send. Enter a verified domain in the next step.</p>
        </template>

        <template v-if="form.provider_type === 'sendgrid' || form.provider_type === 'sparkpost'">
          <div class="form-group"><label class="form-label">API Key <InfoTip text="Full access API key from your provider dashboard" :size="12" /></label><input v-model="form.api_key" type="password" class="form-input" /></div>
        </template>

        <template v-if="form.provider_type === 'mailgun'">
          <div class="form-group"><label class="form-label">API Key</label><input v-model="form.api_key" type="password" class="form-input" /></div>
          <div class="form-group"><label class="form-label">Region</label><select v-model="form.api_region" class="form-input"><option value="us">US</option><option value="eu">EU</option></select></div>
          <p class="text-xs text-text-muted">After adding, enter your verified Mailgun domain in the next step.</p>
        </template>

        <template v-if="form.provider_type === 'postmark'">
          <div class="form-group"><label class="form-label">Server Token <InfoTip text="Found in Postmark → Server → API Tokens" :size="12" /></label><input v-model="form.api_key" type="password" class="form-input" /></div>
        </template>
      </div>

      <!-- Step 2: Domain & Sending Identity -->
      <div v-if="formStep === 2" class="space-y-4">
        <!-- For SMTP: already collected from email in step 1, show limits only -->
        <template v-if="form.provider_type === 'smtp'">
          <div class="bg-surface-0 rounded-lg p-3 text-xs text-text-muted">
            SMTP server — From address set in previous step. Configure limits below.
          </div>
        </template>

        <!-- For API providers: fetch domains + from email -->
        <template v-else>
          <div class="form-group">
            <label class="form-label">Sending Domain <InfoTip text="Select a verified domain from your provider. Click 'Fetch Domains' to load them automatically." :size="12" /></label>
            <div class="flex gap-2">
              <select v-if="fetchedDomains.length > 0" v-model="form.api_domain" class="form-input flex-1">
                <option value="">Select a domain...</option>
                <option v-for="d in fetchedDomains" :key="d" :value="d">{{ d }}</option>
              </select>
              <input v-else v-model="form.api_domain" class="form-input flex-1" placeholder="example.com" />
              <button type="button" class="btn-secondary text-xs px-3 shrink-0" :disabled="fetchingDomains" @click="fetchDomains">
                <Loader2 v-if="fetchingDomains" :size="12" class="animate-spin" />
                <Globe v-else :size="12" />
                Fetch
              </button>
            </div>
            <p v-if="domainFetchNote" class="text-[10px] text-amber-400 mt-1">{{ domainFetchNote }}</p>
            <p v-else-if="fetchedDomains.length > 0" class="text-[10px] text-green-400 mt-1">{{ fetchedDomains.length }} verified domain{{ fetchedDomains.length !== 1 ? 's' : '' }} found</p>
            <p v-else class="text-[10px] text-text-muted mt-1">Click "Fetch" to auto-load verified domains, or enter manually. One server = one domain.</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">From Email <InfoTip text="Must be an address on the domain above" :size="12" /></label><input v-model="form.from_email" class="form-input" :placeholder="form.api_domain ? `hello@${form.api_domain}` : 'hello@example.com'" /></div>
            <div class="form-group"><label class="form-label">From Name</label><input v-model="form.from_name" class="form-input" placeholder="My Company" /></div>
          </div>
        </template>

        <!-- Limits (all providers) -->
        <div class="pt-3 border-t border-border">
          <div class="text-xs font-semibold text-text-secondary mb-2">Sending Limits</div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">Hourly Limit <InfoTip text="Max emails per hour. 0 = unlimited." :size="12" /></label><input v-model.number="form.hourly_limit" type="number" class="form-input" min="0" /></div>
            <div class="form-group"><label class="form-label">Daily Limit <InfoTip text="Max emails per day." :size="12" /></label><input v-model.number="form.daily_limit" type="number" class="form-input" min="0" /></div>
          </div>
        </div>

        <!-- Options -->
        <div class="space-y-2">
          <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="form.is_default" class="form-checkbox" /> Set as default delivery server</label>
          <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" v-model="form.force_from" class="form-checkbox" /> Force From address <InfoTip text="Campaigns using this server cannot override the From email/name" :size="12" /></label>
        </div>
      </div>

      <!-- Step 3: Review -->
      <div v-if="formStep === 3" class="space-y-3">
        <div class="bg-surface-0 rounded-lg p-4 space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-text-muted">Provider</span><span class="text-text-primary font-medium">{{ getProvider(form.provider_type)?.label }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Name</span><span class="text-text-primary">{{ form.name }}</span></div>
          <div v-if="form.from_email" class="flex justify-between"><span class="text-text-muted">From</span><span class="text-text-primary">{{ form.from_name }} &lt;{{ form.from_email }}&gt;</span></div>
          <div v-if="form.host" class="flex justify-between"><span class="text-text-muted">Host</span><span class="text-text-primary font-mono text-xs">{{ form.host }}:{{ form.port }}</span></div>
          <div v-if="form.api_domain" class="flex justify-between"><span class="text-text-muted">Domain</span><span class="text-text-primary">{{ form.api_domain }}</span></div>
          <div v-if="form.api_region" class="flex justify-between"><span class="text-text-muted">Region</span><span class="text-text-primary">{{ form.api_region }}</span></div>
          <div v-if="form.tracking_domain" class="flex justify-between"><span class="text-text-muted">Tracking Domain</span><span class="text-text-primary">{{ form.tracking_domain }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Daily Limit</span><span class="text-text-primary">{{ form.daily_limit || 'Unlimited' }}</span></div>
          <div v-if="form.is_default" class="flex justify-between"><span class="text-text-muted">Default</span><span class="text-green-400">Yes</span></div>
        </div>

        <div class="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
          <ShieldAlert :size="14" class="inline mr-1" />
          After saving, click <strong>Verify</strong> to test the connection. You cannot send emails until the server is verified.
        </div>

        <div class="bg-surface-0 rounded-lg p-3 text-xs text-text-muted">
          <strong class="text-text-secondary">Bounce Webhook URL:</strong>
          <code class="block mt-1 font-mono text-[11px] text-text-secondary break-all">{{ window.location.origin }}/api/webhooks/bounce/{{ form.provider_type === 'ses' ? 'ses' : form.provider_type }}</code>
          <p class="mt-1">This URL is auto-registered for API providers. For SMTP, configure bounces in your provider's dashboard.</p>
        </div>
      </div>

      <template #footer>
        <button v-if="formStep > 1" class="btn-ghost" @click="formStep--">Back</button>
        <div class="flex-1"></div>
        <button class="btn-ghost" @click="showForm = false">Cancel</button>
        <button v-if="formStep < 3" class="btn-primary" @click="formStep++">Next</button>
        <button v-else class="btn-primary" :disabled="!form.name" @click="saveServer">
          <Loader2 v-if="createMutation.isPending.value || updateMutation.isPending.value" :size="14" class="animate-spin" />
          {{ editingId ? 'Update Server' : 'Add Server' }}
        </button>
      </template>
    </Modal>

    <ConfirmDialog :show="deleteConfirm.show" title="Delete Server" message="Delete this delivery server? Campaigns using it will need a different server." confirmText="Delete" variant="danger" @confirm="deleteServer" @cancel="deleteConfirm.show = false" />
  </div>
</template>
