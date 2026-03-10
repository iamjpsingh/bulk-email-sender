<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  useConfigs,
  useOAuthStatus,
  useCreateConfig,
  useUpdateConfig,
  useDeleteConfig,
  useTestConfig,
  useTestConnection,
  useConnectOAuth,
  useDisconnectOAuth,
  useTestOAuth,
} from '../lib/query'
import { useToast } from '../composables/useToast'
import type { SMTPConfig } from '../lib/api'
import MainLayout from '../components/layout/MainLayout.vue'
import { Plus, Pencil, Trash2, Plug, X, Server, Check, Loader2, Inbox, Link, Unlink } from 'lucide-vue-next'

const route = useRoute()
const toast = useToast()

// TanStack Query hooks
const { data: configs, isLoading: loading } = useConfigs()
const { data: providers } = useOAuthStatus()

// Mutations
const createMutation = useCreateConfig()
const updateMutation = useUpdateConfig()
const deleteMutation = useDeleteConfig()
const testMutation = useTestConfig()
const testConnectionMutation = useTestConnection()
const connectMutation = useConnectOAuth()
const disconnectMutation = useDisconnectOAuth()
const testOAuthMutation = useTestOAuth()

// Computed
const smtpConfigs = computed(() => (configs.value || []).filter((c) => c.provider_type === 'smtp'))
const oauthConfigs = computed(() => (configs.value || []).filter((c) => c.provider_type !== 'smtp'))

// Form state
const showForm = ref(false)
const editingId = ref<string | null>(null)
const testResult = ref<{ id: string; success: boolean; message: string } | null>(null)
const formTestResult = ref<{ success: boolean; message: string } | null>(null)

const form = ref({
  name: '',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  from_email: '',
  from_name: '',
  is_default: false,
})

// Handle OAuth callback on mount
onMounted(() => {
  const success = route.query.success as string
  const error = route.query.error as string

  if (success?.includes('connected')) {
    toast.success(`${success.includes('google') ? 'Google' : 'Microsoft'} account connected!`)
  } else if (error) {
    const messages: Record<string, string> = {
      google_denied: 'Google authorization denied',
      microsoft_denied: 'Microsoft authorization denied',
      google_failed: 'Failed to connect Google',
      microsoft_failed: 'Failed to connect Microsoft',
    }
    toast.error(messages[error] || 'OAuth error')
  }

  if (success || error) {
    window.history.replaceState({}, '', '/configs')
  }
})

// Form actions
function resetForm() {
  form.value = {
    name: '',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from_email: '',
    from_name: '',
    is_default: false,
  }
  editingId.value = null
  showForm.value = false
  formTestResult.value = null
}

function openAddForm() {
  showForm.value = true
  editingId.value = null
}

function editConfig(config: SMTPConfig) {
  if (config.provider_type !== 'smtp') return
  form.value = {
    name: config.name,
    host: config.host || 'smtp.gmail.com',
    port: config.port || 587,
    secure: config.secure || false,
    user: config.user || '',
    pass: '',
    from_email: config.from_email,
    from_name: config.from_name || '',
    is_default: config.is_default,
  }
  editingId.value = config.id
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingId.value) {
      await updateMutation.mutateAsync({ id: editingId.value, ...form.value })
      toast.success('Configuration updated!')
    } else {
      await createMutation.mutateAsync(form.value)
      toast.success('Configuration created!')
    }
    resetForm()
  } catch (err: any) {
    toast.error(err.message || 'Failed to save')
  }
}

async function testFormConnection() {
  if (!form.value.host || !form.value.user || !form.value.pass) {
    toast.error('Fill in host, username, and password first')
    return
  }
  formTestResult.value = null
  try {
    const result = await testConnectionMutation.mutateAsync({
      host: form.value.host,
      port: form.value.port,
      secure: form.value.secure,
      user: form.value.user,
      pass: form.value.pass,
    })
    formTestResult.value = result
    if (result.success) toast.success('Connection successful!')
  } catch (err: any) {
    formTestResult.value = { success: false, message: err.message || 'Test failed' }
  }
}

async function handleDelete(id: string) {
  if (!confirm('Delete this configuration?')) return
  try {
    await deleteMutation.mutateAsync(id)
    toast.success('Configuration deleted')
  } catch (err: any) {
    toast.error(err.message || 'Delete failed')
  }
}

async function handleTest(config: SMTPConfig) {
  testResult.value = null
  try {
    const result =
      config.provider_type === 'smtp'
        ? await testMutation.mutateAsync(config.id)
        : await testOAuthMutation.mutateAsync(config.id)
    testResult.value = { id: config.id, ...result }
    setTimeout(() => {
      if (testResult.value?.id === config.id) testResult.value = null
    }, 5000)
  } catch (err: any) {
    testResult.value = { id: config.id, success: false, message: err.message || 'Test failed' }
  }
}

async function connectOAuth(provider: 'google' | 'microsoft') {
  try {
    await connectMutation.mutateAsync(provider)
  } catch (err: any) {
    toast.error(err.message || `Failed to connect ${provider}`)
  }
}

async function disconnectOAuth(configId: string) {
  if (!confirm('Disconnect this account?')) return
  try {
    await disconnectMutation.mutateAsync(configId)
    toast.success('Account disconnected')
  } catch (err: any) {
    toast.error(err.message || 'Disconnect failed')
  }
}
</script>

<template>
  <MainLayout>
    <!-- Page Header -->
    <header class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-[28px] mb-1">Email Configurations</h1>
        <p class="text-muted">Connect email accounts or configure SMTP</p>
      </div>
    </header>

    <!-- OAuth Providers -->
    <section class="mb-8">
      <h2 class="flex items-center gap-2.5 text-lg mb-2"><Link :size="20" /> Connect Email Account</h2>
      <p class="text-text-muted text-sm mb-5">Connect Google or Microsoft account (OAuth 2.0)</p>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
        <!-- Google -->
        <div class="glass-card p-6 flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(66,133,244,0.1)]"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-base mb-1">Google Gmail</h3>
              <p class="text-muted text-sm">Send via Gmail API</p>
            </div>
          </div>
          <div
            class="flex items-center gap-1.5 text-[13px] py-2 px-3 rounded-[var(--radius-sm)]"
            :class="
              providers?.google?.configured
                ? 'bg-[rgba(16,185,129,0.1)] text-success'
                : 'bg-[rgba(239,68,68,0.1)] text-danger'
            "
          >
            <Check v-if="providers?.google?.configured" :size="14" />
            <X v-else :size="14" />
            {{ providers?.google?.configured ? 'Ready' : 'Not configured' }}
          </div>
          <button
            class="flex items-center justify-center gap-2 py-2.5 px-5 text-sm font-semibold rounded-[var(--radius-md)] cursor-pointer border-none bg-[#4285F4] text-white hover:bg-[#3367D6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            :disabled="!providers?.google?.configured || connectMutation.isPending.value"
            @click="connectOAuth('google')"
          >
            <Loader2 v-if="connectMutation.isPending.value" :size="16" class="spin" />
            <template v-else>Connect with Google</template>
          </button>
          <p v-if="!providers?.google?.configured" class="text-xs text-text-muted text-center">
            Add GOOGLE_CLIENT_ID to .env
          </p>
        </div>

        <!-- Microsoft -->
        <div class="glass-card p-6 flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center bg-[rgba(0,164,239,0.1)]">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#00A4EF" d="M1 13h10v10H1z" />
                <path fill="#7FBA00" d="M13 1h10v10H13z" />
                <path fill="#FFB900" d="M13 13h10v10H13z" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-base mb-1">Microsoft Outlook/365</h3>
              <p class="text-muted text-sm">Send via Graph API</p>
            </div>
          </div>
          <div
            class="flex items-center gap-1.5 text-[13px] py-2 px-3 rounded-[var(--radius-sm)]"
            :class="
              providers?.microsoft?.configured
                ? 'bg-[rgba(16,185,129,0.1)] text-success'
                : 'bg-[rgba(239,68,68,0.1)] text-danger'
            "
          >
            <Check v-if="providers?.microsoft?.configured" :size="14" />
            <X v-else :size="14" />
            {{ providers?.microsoft?.configured ? 'Ready' : 'Not configured' }}
          </div>
          <button
            class="flex items-center justify-center gap-2 py-2.5 px-5 text-sm font-semibold rounded-[var(--radius-md)] cursor-pointer border-none bg-[#00A4EF] text-white hover:bg-[#0078D4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            :disabled="!providers?.microsoft?.configured || connectMutation.isPending.value"
            @click="connectOAuth('microsoft')"
          >
            <Loader2 v-if="connectMutation.isPending.value" :size="16" class="spin" />
            <template v-else>Connect with Microsoft</template>
          </button>
          <p v-if="!providers?.microsoft?.configured" class="text-xs text-text-muted text-center">
            Add MICROSOFT_CLIENT_ID to .env
          </p>
        </div>
      </div>
    </section>

    <!-- Connected OAuth -->
    <section v-if="oauthConfigs.length > 0" class="mb-8">
      <h2 class="flex items-center gap-2.5 text-lg mb-2"><Check :size="20" /> Connected Accounts</h2>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-5">
        <div
          v-for="config in oauthConfigs"
          :key="config.id"
          class="glass-card p-5"
          :class="{
            'border-l-[3px] border-l-[#4285F4]': config.provider_type === 'google',
            'border-l-[3px] border-l-[#00A4EF]': config.provider_type === 'microsoft',
            'border-l-[3px] border-l-accent': config.provider_type !== 'google' && config.provider_type !== 'microsoft',
          }"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center bg-bg-secondary">
                <svg v-if="config.provider_type === 'google'" viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#F25022" d="M1 1h10v10H1z" />
                  <path fill="#00A4EF" d="M1 13h10v10H1z" />
                  <path fill="#7FBA00" d="M13 1h10v10H13z" />
                  <path fill="#FFB900" d="M13 13h10v10H13z" />
                </svg>
              </div>
              <div>
                <h3 class="text-base m-0">{{ config.name }}</h3>
                <p class="text-[13px] text-text-muted mt-0.5">{{ config.oauth_email }}</p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <span v-if="config.is_default" class="badge-success inline-flex items-center gap-1"
                ><Check :size="12" /> Default</span
              >
              <button class="btn-ghost btn-sm text-danger" @click="disconnectOAuth(config.id)">
                <Unlink :size="16" />
              </button>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="btn-secondary btn-sm"
              :disabled="testOAuthMutation.isPending.value"
              @click="handleTest(config)"
            >
              <Loader2 v-if="testOAuthMutation.isPending.value" :size="14" class="spin" />
              <Plug v-else :size="14" /> Test
            </button>
            <div
              v-if="testResult?.id === config.id"
              class="flex items-center gap-1.5 text-[13px]"
              :class="testResult.success ? 'text-success' : 'text-danger'"
            >
              <Check v-if="testResult.success" :size="14" /><X v-else :size="14" />
              {{ testResult.success ? 'Connected!' : testResult.message }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SMTP Configs -->
    <section class="mb-8">
      <div class="flex justify-between items-start mb-5">
        <div>
          <h2 class="flex items-center gap-2.5 text-lg mb-2"><Server :size="20" /> SMTP Configurations</h2>
          <p class="text-text-muted text-sm">Traditional SMTP server configurations</p>
        </div>
        <button class="btn-secondary" @click="openAddForm()"><Plus :size="18" /> Add SMTP</button>
      </div>

      <!-- Form Modal -->
      <div
        v-if="showForm"
        class="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-6"
        @click.self="resetForm"
      >
        <div class="glass-card w-full max-w-[500px] max-h-[90vh] overflow-y-auto animate-fade-in">
          <div class="flex justify-between items-center px-6 py-5 border-b border-border">
            <h2 class="text-lg m-0">{{ editingId ? 'Edit' : 'New' }} SMTP Configuration</h2>
            <button class="btn-ghost btn-sm" @click="resetForm"><X :size="18" /></button>
          </div>
          <form @submit.prevent="handleSubmit" class="p-6">
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input v-model="form.name" type="text" class="form-input" placeholder="My Gmail" required />
            </div>
            <div class="flex gap-3">
              <div class="form-group flex-1">
                <label class="form-label">SMTP Host *</label>
                <input v-model="form.host" type="text" class="form-input" placeholder="smtp.gmail.com" required />
              </div>
              <div class="form-group w-[120px]">
                <label class="form-label">Port *</label>
                <input v-model.number="form.port" type="number" class="form-input" required />
              </div>
            </div>
            <label class="form-checkbox mb-4">
              <input v-model="form.secure" type="checkbox" /><span>Use TLS/SSL</span>
            </label>
            <div class="form-group">
              <label class="form-label">Username *</label>
              <input v-model="form.user" type="text" class="form-input" placeholder="you@gmail.com" required />
            </div>
            <div class="form-group">
              <label class="form-label">Password {{ editingId ? '(leave blank to keep)' : '*' }}</label>
              <div class="flex gap-2">
                <input v-model="form.pass" type="password" class="form-input flex-1" :required="!editingId" />
                <button
                  type="button"
                  class="btn-secondary px-3 min-w-[44px]"
                  :disabled="testConnectionMutation.isPending.value || !form.host || !form.user || !form.pass"
                  @click="testFormConnection"
                >
                  <Loader2 v-if="testConnectionMutation.isPending.value" :size="16" class="spin" />
                  <Plug v-else :size="16" />
                </button>
              </div>
              <p class="text-muted text-sm mt-2">For Gmail, use App Password</p>
            </div>
            <div class="flex gap-3">
              <div class="form-group flex-1">
                <label class="form-label">From Email *</label>
                <input v-model="form.from_email" type="email" class="form-input" required />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">From Name</label>
                <input v-model="form.from_name" type="text" class="form-input" placeholder="Your Name" />
              </div>
            </div>
            <label class="form-checkbox mb-4">
              <input v-model="form.is_default" type="checkbox" /><span>Set as default</span>
            </label>
            <div
              v-if="formTestResult"
              class="flex items-center gap-2 p-3 rounded-[var(--radius-sm)] text-sm"
              :class="
                formTestResult.success
                  ? 'bg-[rgba(16,185,129,0.1)] text-success'
                  : 'bg-[rgba(239,68,68,0.1)] text-danger'
              "
            >
              <Check v-if="formTestResult.success" :size="16" /><X v-else :size="16" />
              {{ formTestResult.message }}
            </div>
            <div class="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
              <button type="button" class="btn-ghost" @click="resetForm">Cancel</button>
              <button
                type="submit"
                class="btn-primary"
                :disabled="createMutation.isPending.value || updateMutation.isPending.value"
              >
                <Loader2
                  v-if="createMutation.isPending.value || updateMutation.isPending.value"
                  :size="16"
                  class="spin"
                />
                {{ editingId ? 'Update' : 'Create' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center gap-3 py-12 text-text-muted">
        <Loader2 :size="24" class="spin" /> Loading...
      </div>

      <!-- Empty -->
      <div v-else-if="smtpConfigs.length === 0 && oauthConfigs.length === 0" class="glass-card text-center py-16 px-6">
        <Inbox :size="64" class="text-text-muted mb-4" />
        <h3 class="mb-2">No configurations yet</h3>
        <p class="text-muted">Connect an email account or add SMTP</p>
      </div>

      <!-- SMTP List -->
      <div v-else-if="smtpConfigs.length > 0" class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-5">
        <div v-for="config in smtpConfigs" :key="config.id" class="glass-card p-5">
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <Server :size="20" class="text-text-muted" />
              <h3 class="text-base m-0">{{ config.name }}</h3>
              <span v-if="config.is_default" class="badge-success inline-flex items-center gap-1"
                ><Check :size="12" /> Default</span
              >
            </div>
            <div class="flex items-center gap-1">
              <button class="btn-ghost btn-sm" @click="editConfig(config)"><Pencil :size="16" /></button>
              <button class="btn-ghost btn-sm" @click="handleDelete(config.id)"><Trash2 :size="16" /></button>
            </div>
          </div>
          <div class="flex flex-col gap-2 mb-4 p-3 bg-bg-secondary rounded-[var(--radius-sm)]">
            <div class="flex justify-between text-[13px]">
              <span class="text-text-muted">Host</span
              ><span class="text-text-primary mono">{{ config.host }}:{{ config.port }}</span>
            </div>
            <div class="flex justify-between text-[13px]">
              <span class="text-text-muted">User</span><span class="text-text-primary mono">{{ config.user }}</span>
            </div>
            <div class="flex justify-between text-[13px]">
              <span class="text-text-muted">From</span
              ><span class="text-text-primary">{{ config.from_name || config.from_email }}</span>
            </div>
            <div class="flex justify-between text-[13px]">
              <span class="text-text-muted">Security</span
              ><span class="text-text-primary">{{ config.secure ? 'TLS/SSL' : 'None' }}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="btn-secondary btn-sm" :disabled="testMutation.isPending.value" @click="handleTest(config)">
              <Loader2 v-if="testMutation.isPending.value" :size="14" class="spin" />
              <Plug v-else :size="14" /> Test
            </button>
            <div
              v-if="testResult?.id === config.id"
              class="flex items-center gap-1.5 text-[13px]"
              :class="testResult.success ? 'text-success' : 'text-danger'"
            >
              <Check v-if="testResult.success" :size="14" /><X v-else :size="14" />
              {{ testResult.success ? 'Connected!' : testResult.message }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </MainLayout>
</template>
