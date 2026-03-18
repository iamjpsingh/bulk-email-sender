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
  Plus, Pencil, Trash2, Plug, Server, Check, X, Loader2, Inbox,
  Cloud, Zap, Mail, Globe, Send, MoreVertical, CheckCircle, AlertCircle,
} from 'lucide-vue-next'

const toast = useToast()
const { data: configs, isLoading: loading } = useConfigs()
const { data: oauthStatus } = useOAuthStatus()
const createMutation = useCreateConfig()
const updateMutation = useUpdateConfig()
const deleteMutation = useDeleteConfig()
const testMutation = useTestConfig()
const testConnectionMutation = useTestConnection()
const connectOAuth = useConnectOAuth()
const disconnectOAuth = useDisconnectOAuth()

const allServers = computed(() => configs.value || [])
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })
const showAddModal = ref(false)
const selectedProvider = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const actionMenuOpen = ref<string | null>(null)

const form = ref({
  name: '', host: '', port: 587, secure: false,
  user: '', pass: '', from_email: '', from_name: '', is_default: false,
  provider_type: 'smtp',
  api_key: '', api_secret: '', api_region: 'us-east-1', api_domain: '',
})

const providerTypes = [
  { value: 'smtp', label: 'SMTP Server', icon: Server, desc: 'Any SMTP server (Gmail, custom, etc.)', color: 'text-text-muted' },
  { value: 'ses', label: 'Amazon SES', icon: Cloud, desc: 'AWS SES — Domain-level sending with IAM keys', color: 'text-amber-400' },
  { value: 'sendgrid', label: 'SendGrid', icon: Zap, desc: 'Twilio SendGrid — API-based sending', color: 'text-blue-400' },
  { value: 'mailgun', label: 'Mailgun', icon: Mail, desc: 'Sinch Mailgun — API-based sending', color: 'text-red-400' },
  { value: 'postmark', label: 'Postmark', icon: Send, desc: 'ActiveCampaign Postmark — Transactional', color: 'text-yellow-400' },
  { value: 'sparkpost', label: 'SparkPost', icon: Zap, desc: 'MessageBird SparkPost — High volume', color: 'text-orange-400' },
  { value: 'google', label: 'Gmail OAuth', icon: Globe, desc: 'Connect Google account — one click', color: 'text-green-400' },
  { value: 'microsoft', label: 'Outlook OAuth', icon: Globe, desc: 'Connect Microsoft account — one click', color: 'text-blue-400' },
]

function selectProvider(type: string) {
  selectedProvider.value = type
  showAddModal.value = false

  if (type === 'google' || type === 'microsoft') {
    // OAuth connect — redirect
    connectOAuth.mutate(type as any)
    return
  }

  // Show form for this provider
  form.value = {
    name: '', host: '', port: 587, secure: false,
    user: '', pass: '', from_email: '', from_name: '', is_default: false,
    provider_type: type,
    api_key: '', api_secret: '', api_region: 'us-east-1', api_domain: '',
  }

  // Pre-fill defaults
  if (type === 'smtp') { form.value.host = 'smtp.gmail.com'; form.value.name = 'SMTP Server' }
  if (type === 'ses') { form.value.name = 'Amazon SES' }
  if (type === 'sendgrid') { form.value.name = 'SendGrid' }
  if (type === 'mailgun') { form.value.name = 'Mailgun' }
  if (type === 'postmark') { form.value.name = 'Postmark' }
  if (type === 'sparkpost') { form.value.name = 'SparkPost' }

  editingId.value = null
  showForm.value = true
}

function editServer(server: SMTPConfig) {
  form.value = {
    name: server.name || '', host: server.host || '', port: server.port || 587,
    secure: !!server.secure, user: server.user || '', pass: '',
    from_email: server.from_email || '', from_name: server.from_name || '',
    is_default: !!server.is_default, provider_type: server.provider_type || 'smtp',
    api_key: server.api_key || '', api_secret: '', api_region: server.api_region || 'us-east-1',
    api_domain: server.api_domain || '',
  }
  editingId.value = server.id
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
      toast.success('Server added')
    }
    showForm.value = false
  } catch (e: any) { toast.error(e.message) }
}

async function testServer(id: string) {
  actionMenuOpen.value = null
  try {
    await testMutation.mutateAsync(id)
    toast.success('Connection successful')
  } catch (e: any) { toast.error(e.message) }
}

async function deleteServer() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
  try {
    await deleteMutation.mutateAsync(id)
    toast.success('Server deleted')
  } catch (e: any) { toast.error(e.message) }
}

function promptDelete(id: string) {
  actionMenuOpen.value = null
  deleteConfirm.value = { show: true, id }
}

function getProviderIcon(type: string) {
  return providerTypes.find(p => p.value === type)?.icon || Server
}

function getProviderLabel(type: string) {
  return providerTypes.find(p => p.value === type)?.label || type
}

function getProviderColor(type: string) {
  return providerTypes.find(p => p.value === type)?.color || 'text-text-muted'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-text-primary">Delivery Servers</h2>
        <p class="text-sm text-text-muted mt-1">
          Add and manage your email sending providers. Each server is a connection to an email service.
          <InfoTip text="Add SMTP, SES, SendGrid, Mailgun, Postmark, SparkPost, or connect Gmail/Outlook via OAuth. Bounce webhooks are auto-registered when you add API-based providers." />
        </p>
      </div>
      <button class="btn-primary" @click="showAddModal = true"><Plus :size="14" /> Add Server</button>
    </div>

    <div v-if="loading"><Skeleton variant="card" :count="3" /></div>

    <div v-else-if="allServers.length === 0" class="bg-bg-card border border-border rounded-xl">
      <EmptyState :icon="Inbox" title="No delivery servers" description="Add a delivery server to start sending emails">
        <template #actions>
          <button class="btn-primary" @click="showAddModal = true"><Plus :size="14" /> Add Server</button>
        </template>
      </EmptyState>
    </div>

    <!-- Server Cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="server in allServers" :key="server.id" class="bg-bg-card border border-border rounded-xl p-4 transition hover:border-border-hover">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-surface-1 flex items-center justify-center">
              <component :is="getProviderIcon(server.provider_type)" :size="16" :class="getProviderColor(server.provider_type)" />
            </div>
            <div>
              <div class="text-sm font-semibold text-text-primary">{{ server.name || getProviderLabel(server.provider_type) }}</div>
              <div class="text-xs text-text-muted">{{ getProviderLabel(server.provider_type) }}</div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <span v-if="server.is_default" class="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">Default</span>
            <div class="relative">
              <button @click="actionMenuOpen = actionMenuOpen === server.id ? null : server.id" class="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-1 transition">
                <MoreVertical :size="14" />
              </button>
              <div v-if="actionMenuOpen === server.id" class="absolute right-0 top-8 z-10 bg-surface-1 border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface-0 transition" @click="testServer(server.id)">
                  <Plug :size="12" /> Test Connection
                </button>
                <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface-0 transition" @click="editServer(server)">
                  <Pencil :size="12" /> Edit
                </button>
                <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-red-400 hover:bg-surface-0 transition" @click="promptDelete(server.id)">
                  <Trash2 :size="12" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="text-xs text-text-muted space-y-1">
          <div v-if="server.from_email">From: <span class="text-text-secondary">{{ server.from_name ? `${server.from_name} <${server.from_email}>` : server.from_email }}</span></div>
          <div v-if="server.host">Host: <span class="text-text-secondary">{{ server.host }}:{{ server.port }}</span></div>
          <div v-if="server.api_domain">Domain: <span class="text-text-secondary">{{ server.api_domain }}</span></div>
          <div v-if="server.api_region">Region: <span class="text-text-secondary">{{ server.api_region }}</span></div>
        </div>
      </div>
    </div>

    <!-- Add Server Modal — Provider Picker -->
    <Modal :show="showAddModal" title="Add Delivery Server" size="lg" @close="showAddModal = false">
      <p class="text-sm text-text-muted mb-4">Choose your email provider. Bounce webhooks are auto-registered for API-based providers.</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          v-for="p in providerTypes"
          :key="p.value"
          class="flex flex-col items-center gap-2 p-4 bg-surface-0 border border-border rounded-xl hover:border-accent/40 hover:bg-accent/5 transition cursor-pointer text-center"
          @click="selectProvider(p.value)"
        >
          <component :is="p.icon" :size="20" :class="p.color" />
          <span class="text-xs font-semibold text-text-primary">{{ p.label }}</span>
          <span class="text-[10px] text-text-muted leading-tight">{{ p.desc }}</span>
        </button>
      </div>
    </Modal>

    <!-- Server Form Modal -->
    <Modal :show="showForm" :title="editingId ? 'Edit Server' : `Add ${getProviderLabel(form.provider_type)}`" size="md" @close="showForm = false">
      <div class="space-y-4">
        <div class="form-group">
          <label class="form-label">Server Name</label>
          <input v-model="form.name" class="form-input" placeholder="My SES Server" />
        </div>

        <!-- SMTP fields -->
        <template v-if="form.provider_type === 'smtp'">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">Host</label><input v-model="form.host" class="form-input" placeholder="smtp.gmail.com" /></div>
            <div class="form-group"><label class="form-label">Port</label><input v-model.number="form.port" type="number" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Username</label><input v-model="form.user" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Password</label><input v-model="form.pass" type="password" class="form-input" /></div>
          </div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="form.secure" class="form-checkbox" /> SSL/TLS</label>
        </template>

        <!-- SES fields -->
        <template v-if="form.provider_type === 'ses'">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">IAM Access Key ID</label><input v-model="form.api_key" class="form-input" placeholder="AKIA..." /></div>
            <div class="form-group"><label class="form-label">IAM Secret Access Key</label><input v-model="form.api_secret" type="password" class="form-input" /></div>
          </div>
          <div class="form-group">
            <label class="form-label">Region</label>
            <select v-model="form.api_region" class="form-input">
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">EU (Ireland)</option>
              <option value="eu-central-1">EU (Frankfurt)</option>
              <option value="ap-south-1">Asia Pacific (Mumbai)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>
        </template>

        <!-- SendGrid / SparkPost -->
        <template v-if="form.provider_type === 'sendgrid' || form.provider_type === 'sparkpost'">
          <div class="form-group"><label class="form-label">API Key</label><input v-model="form.api_key" type="password" class="form-input" /></div>
        </template>

        <!-- Mailgun -->
        <template v-if="form.provider_type === 'mailgun'">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">API Key</label><input v-model="form.api_key" type="password" class="form-input" /></div>
            <div class="form-group"><label class="form-label">Domain</label><input v-model="form.api_domain" class="form-input" placeholder="mg.example.com" /></div>
          </div>
          <div class="form-group">
            <label class="form-label">Region</label>
            <select v-model="form.api_region" class="form-input"><option value="us">US</option><option value="eu">EU</option></select>
          </div>
        </template>

        <!-- Postmark -->
        <template v-if="form.provider_type === 'postmark'">
          <div class="form-group"><label class="form-label">Server Token</label><input v-model="form.api_key" type="password" class="form-input" /></div>
        </template>

        <!-- From fields (all providers) -->
        <div class="pt-3 border-t border-border">
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group"><label class="form-label">From Email</label><input v-model="form.from_email" class="form-input" placeholder="hello@example.com" /></div>
            <div class="form-group"><label class="form-label">From Name</label><input v-model="form.from_name" class="form-input" placeholder="My Company" /></div>
          </div>
          <label class="flex items-center gap-2 text-sm mt-2"><input type="checkbox" v-model="form.is_default" class="form-checkbox" /> Set as default server</label>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showForm = false">Cancel</button>
        <button class="btn-primary" :disabled="!form.name" @click="saveServer">
          <Loader2 v-if="createMutation.isPending.value || updateMutation.isPending.value" :size="14" class="animate-spin" />
          {{ editingId ? 'Update' : 'Add Server' }}
        </button>
      </template>
    </Modal>

    <ConfirmDialog
      :show="deleteConfirm.show"
      title="Delete Server"
      message="Delete this delivery server? Campaigns using it will need a different server."
      confirmText="Delete"
      variant="danger"
      @confirm="deleteServer"
      @cancel="deleteConfirm.show = false"
    />
  </div>
</template>
