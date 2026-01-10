<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuth } from '../stores/auth'
import { useRoute } from 'vue-router'
import { useConfigs, useOAuthStatus, useCreateConfig, useUpdateConfig, useDeleteConfig, useTestConfig, useTestConnection, useConnectOAuth, useDisconnectOAuth, useTestOAuth } from '../lib/query'
import type { SMTPConfig } from '../lib/api'
import {
  Plus, Pencil, Trash2, Plug, X, Server, Check, Loader2, Inbox,
  LayoutDashboard, Mail, BarChart3, Settings, LogOut, Send, Link, Unlink
} from 'lucide-vue-next'

const { user, logout } = useAuth()
const route = useRoute()

// TanStack Query hooks
const { data: configs, isLoading: loading, refetch: refetchConfigs } = useConfigs()
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
const smtpConfigs = computed(() => (configs.value || []).filter(c => c.provider_type === 'smtp'))
const oauthConfigs = computed(() => (configs.value || []).filter(c => c.provider_type !== 'smtp'))

// Form state
const showForm = ref(false)
const editingId = ref<string | null>(null)
const testResult = ref<{ id: string; success: boolean; message: string } | null>(null)
const formTestResult = ref<{ success: boolean; message: string } | null>(null)

const form = ref({
  name: '', host: 'smtp.gmail.com', port: 587, secure: false,
  user: '', pass: '', from_email: '', from_name: '', is_default: false
})

// Toast
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 4000)
}

// Handle OAuth callback on mount
onMounted(() => {
  const success = route.query.success as string
  const error = route.query.error as string
  
  if (success?.includes('connected')) {
    showToast(`${success.includes('google') ? 'Google' : 'Microsoft'} account connected!`, 'success')
  } else if (error) {
    const messages: Record<string, string> = {
      google_denied: 'Google authorization denied',
      microsoft_denied: 'Microsoft authorization denied',
      google_failed: 'Failed to connect Google',
      microsoft_failed: 'Failed to connect Microsoft',
    }
    showToast(messages[error] || 'OAuth error', 'error')
  }
  
  if (success || error) {
    window.history.replaceState({}, '', '/configs')
  }
})

// Form actions
function resetForm() {
  form.value = { name: '', host: 'smtp.gmail.com', port: 587, secure: false, user: '', pass: '', from_email: '', from_name: '', is_default: false }
  editingId.value = null
  showForm.value = false
  formTestResult.value = null
}

function editConfig(config: SMTPConfig) {
  if (config.provider_type !== 'smtp') return
  form.value = {
    name: config.name, host: config.host || 'smtp.gmail.com', port: config.port || 587,
    secure: config.secure || false, user: config.user || '', pass: '',
    from_email: config.from_email, from_name: config.from_name || '', is_default: config.is_default
  }
  editingId.value = config.id
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingId.value) {
      await updateMutation.mutateAsync({ id: editingId.value, ...form.value })
      showToast('Configuration updated!', 'success')
    } else {
      await createMutation.mutateAsync(form.value)
      showToast('Configuration created!', 'success')
    }
    resetForm()
  } catch (err: any) {
    showToast(err.message || 'Failed to save', 'error')
  }
}

async function testFormConnection() {
  if (!form.value.host || !form.value.user || !form.value.pass) {
    showToast('Fill in host, username, and password first', 'error')
    return
  }
  formTestResult.value = null
  try {
    const result = await testConnectionMutation.mutateAsync({
      host: form.value.host, port: form.value.port, secure: form.value.secure,
      user: form.value.user, pass: form.value.pass
    })
    formTestResult.value = result
    if (result.success) showToast('Connection successful!', 'success')
  } catch (err: any) {
    formTestResult.value = { success: false, message: err.message || 'Test failed' }
  }
}

async function handleDelete(id: string) {
  if (!confirm('Delete this configuration?')) return
  try {
    await deleteMutation.mutateAsync(id)
    showToast('Configuration deleted', 'success')
  } catch (err: any) {
    showToast(err.message || 'Delete failed', 'error')
  }
}

async function handleTest(config: SMTPConfig) {
  testResult.value = null
  try {
    const result = config.provider_type === 'smtp'
      ? await testMutation.mutateAsync(config.id)
      : await testOAuthMutation.mutateAsync(config.id)
    testResult.value = { id: config.id, ...result }
    setTimeout(() => { if (testResult.value?.id === config.id) testResult.value = null }, 5000)
  } catch (err: any) {
    testResult.value = { id: config.id, success: false, message: err.message || 'Test failed' }
  }
}

async function connectOAuth(provider: 'google' | 'microsoft') {
  try {
    await connectMutation.mutateAsync(provider)
  } catch (err: any) {
    showToast(err.message || `Failed to connect ${provider}`, 'error')
  }
}

async function disconnectOAuth(configId: string) {
  if (!confirm('Disconnect this account?')) return
  try {
    await disconnectMutation.mutateAsync(configId)
    showToast('Account disconnected', 'success')
  } catch (err: any) {
    showToast(err.message || 'Disconnect failed', 'error')
  }
}

async function handleLogout() { await logout() }

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/compose', label: 'Compose', icon: Mail },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/configs', label: 'Configs', icon: Settings }
]
</script>

<template>
  <div class="app-layout">
    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.type">
        <Check v-if="toast.type === 'success'" :size="18" />
        <X v-else :size="18" />
        {{ toast.message }}
      </div>
    </Transition>
    
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <Send class="logo-icon" :size="28" />
          <span class="logo-text">MailFlow</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item" :class="{ active: $route.path === item.path }">
          <component :is="item.icon" class="nav-icon" :size="20" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info" v-if="user">
          <div class="user-avatar">{{ user?.name?.charAt(0).toUpperCase() || '?' }}</div>
          <div class="user-details">
            <div class="user-name">{{ user?.name || 'User' }}</div>
            <div class="user-email">{{ user?.email || '' }}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">
          <LogOut :size="16" /><span>Logout</span>
        </button>
      </div>
    </aside>
    
    <!-- Main -->
    <main class="main-content">
      <div class="configs-view fade-in">
        <header class="page-header">
          <div>
            <h1>Email Configurations</h1>
            <p class="text-muted">Connect email accounts or configure SMTP</p>
          </div>
        </header>
        
        <!-- OAuth Providers -->
        <section class="section">
          <h2 class="section-title"><Link :size="20" /> Connect Email Account</h2>
          <p class="section-desc">Connect Google or Microsoft account (OAuth 2.0)</p>
          
          <div class="oauth-providers">
            <!-- Google -->
            <div class="provider-card glass-card">
              <div class="provider-header">
                <div class="provider-logo google">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div class="provider-info">
                  <h3>Google Gmail</h3>
                  <p class="text-muted text-sm">Send via Gmail API</p>
                </div>
              </div>
              <div class="provider-status" :class="providers?.google?.configured ? 'configured' : 'not-configured'">
                <Check v-if="providers?.google?.configured" :size="14" />
                <X v-else :size="14" />
                {{ providers?.google?.configured ? 'Ready' : 'Not configured' }}
              </div>
              <button class="btn btn-google" :disabled="!providers?.google?.configured || connectMutation.isPending.value" @click="connectOAuth('google')">
                <Loader2 v-if="connectMutation.isPending.value" :size="16" class="spin" />
                <template v-else>Connect with Google</template>
              </button>
              <p v-if="!providers?.google?.configured" class="config-hint">Add GOOGLE_CLIENT_ID to .env</p>
            </div>
            
            <!-- Microsoft -->
            <div class="provider-card glass-card">
              <div class="provider-header">
                <div class="provider-logo microsoft">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/>
                    <path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/>
                  </svg>
                </div>
                <div class="provider-info">
                  <h3>Microsoft Outlook/365</h3>
                  <p class="text-muted text-sm">Send via Graph API</p>
                </div>
              </div>
              <div class="provider-status" :class="providers?.microsoft?.configured ? 'configured' : 'not-configured'">
                <Check v-if="providers?.microsoft?.configured" :size="14" />
                <X v-else :size="14" />
                {{ providers?.microsoft?.configured ? 'Ready' : 'Not configured' }}
              </div>
              <button class="btn btn-microsoft" :disabled="!providers?.microsoft?.configured || connectMutation.isPending.value" @click="connectOAuth('microsoft')">
                <Loader2 v-if="connectMutation.isPending.value" :size="16" class="spin" />
                <template v-else>Connect with Microsoft</template>
              </button>
              <p v-if="!providers?.microsoft?.configured" class="config-hint">Add MICROSOFT_CLIENT_ID to .env</p>
            </div>
          </div>
        </section>
        
        <!-- Connected OAuth -->
        <section v-if="oauthConfigs.length > 0" class="section">
          <h2 class="section-title"><Check :size="20" /> Connected Accounts</h2>
          <div class="configs-grid">
            <div v-for="config in oauthConfigs" :key="config.id" class="config-card glass-card oauth-card" :class="config.provider_type">
              <div class="config-header">
                <div class="config-title">
                  <div class="provider-logo-sm" :class="config.provider_type">
                    <svg v-if="config.provider_type === 'google'" viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/>
                      <path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/>
                    </svg>
                  </div>
                  <div>
                    <h3>{{ config.name }}</h3>
                    <p class="oauth-email">{{ config.oauth_email }}</p>
                  </div>
                </div>
                <div class="config-actions">
                  <span v-if="config.is_default" class="badge badge-success"><Check :size="12" /> Default</span>
                  <button class="btn btn-ghost btn-sm text-danger" @click="disconnectOAuth(config.id)"><Unlink :size="16" /></button>
                </div>
              </div>
              <div class="config-footer">
                <button class="btn btn-secondary btn-sm" :disabled="testOAuthMutation.isPending.value" @click="handleTest(config)">
                  <Loader2 v-if="testOAuthMutation.isPending.value" :size="14" class="spin" />
                  <Plug v-else :size="14" /> Test
                </button>
                <div v-if="testResult?.id === config.id" class="test-result" :class="testResult.success ? 'success' : 'error'">
                  <Check v-if="testResult.success" :size="14" /><X v-else :size="14" />
                  {{ testResult.success ? 'Connected!' : testResult.message }}
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <!-- SMTP Configs -->
        <section class="section">
          <div class="section-header">
            <div>
              <h2 class="section-title"><Server :size="20" /> SMTP Configurations</h2>
              <p class="section-desc">Traditional SMTP server configurations</p>
            </div>
            <button class="btn btn-secondary" @click="showForm = true; editingId = null">
              <Plus :size="18" /> Add SMTP
            </button>
          </div>
          
          <!-- Form Modal -->
          <div v-if="showForm" class="modal-overlay" @click.self="resetForm">
            <div class="modal glass-card fade-in">
              <div class="modal-header">
                <h2>{{ editingId ? 'Edit' : 'New' }} SMTP Configuration</h2>
                <button class="btn btn-ghost btn-sm" @click="resetForm"><X :size="18" /></button>
              </div>
              <form @submit.prevent="handleSubmit" class="modal-body">
                <div class="form-group">
                  <label class="form-label">Name *</label>
                  <input v-model="form.name" type="text" class="form-input" placeholder="My Gmail" required />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">SMTP Host *</label>
                    <input v-model="form.host" type="text" class="form-input" placeholder="smtp.gmail.com" required />
                  </div>
                  <div class="form-group" style="width: 120px;">
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
                  <div class="password-row">
                    <input v-model="form.pass" type="password" class="form-input" :required="!editingId" />
                    <button type="button" class="btn btn-outline btn-test-inline" :disabled="testConnectionMutation.isPending.value || !form.host || !form.user || !form.pass" @click="testFormConnection">
                      <Loader2 v-if="testConnectionMutation.isPending.value" :size="16" class="spin" />
                      <Plug v-else :size="16" />
                    </button>
                  </div>
                  <p class="text-muted text-sm mt-2">For Gmail, use App Password</p>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">From Email *</label>
                    <input v-model="form.from_email" type="email" class="form-input" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">From Name</label>
                    <input v-model="form.from_name" type="text" class="form-input" placeholder="Your Name" />
                  </div>
                </div>
                <label class="form-checkbox mb-4">
                  <input v-model="form.is_default" type="checkbox" /><span>Set as default</span>
                </label>
                <div v-if="formTestResult" class="form-test-result" :class="formTestResult.success ? 'success' : 'error'">
                  <Check v-if="formTestResult.success" :size="16" /><X v-else :size="16" />
                  {{ formTestResult.message }}
                </div>
                <div class="modal-actions">
                  <button type="button" class="btn btn-ghost" @click="resetForm">Cancel</button>
                  <button type="submit" class="btn btn-primary" :disabled="createMutation.isPending.value || updateMutation.isPending.value">
                    <Loader2 v-if="createMutation.isPending.value || updateMutation.isPending.value" :size="16" class="spin" />
                    {{ editingId ? 'Update' : 'Create' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <!-- Loading -->
          <div v-if="loading" class="loading"><Loader2 :size="24" class="spin" /> Loading...</div>
          
          <!-- Empty -->
          <div v-else-if="smtpConfigs.length === 0 && oauthConfigs.length === 0" class="empty glass-card">
            <Inbox :size="64" class="empty-icon" />
            <h3>No configurations yet</h3>
            <p class="text-muted">Connect an email account or add SMTP</p>
          </div>
          
          <!-- SMTP List -->
          <div v-else-if="smtpConfigs.length > 0" class="configs-grid">
            <div v-for="config in smtpConfigs" :key="config.id" class="config-card glass-card">
              <div class="config-header">
                <div class="config-title">
                  <Server :size="20" class="config-icon" />
                  <h3>{{ config.name }}</h3>
                  <span v-if="config.is_default" class="badge badge-success"><Check :size="12" /> Default</span>
                </div>
                <div class="config-actions">
                  <button class="btn btn-ghost btn-sm" @click="editConfig(config)"><Pencil :size="16" /></button>
                  <button class="btn btn-ghost btn-sm" @click="handleDelete(config.id)"><Trash2 :size="16" /></button>
                </div>
              </div>
              <div class="config-details">
                <div class="detail-row"><span class="detail-label">Host</span><span class="detail-value mono">{{ config.host }}:{{ config.port }}</span></div>
                <div class="detail-row"><span class="detail-label">User</span><span class="detail-value mono">{{ config.user }}</span></div>
                <div class="detail-row"><span class="detail-label">From</span><span class="detail-value">{{ config.from_name || config.from_email }}</span></div>
                <div class="detail-row"><span class="detail-label">Security</span><span class="detail-value">{{ config.secure ? 'TLS/SSL' : 'None' }}</span></div>
              </div>
              <div class="config-footer">
                <button class="btn btn-secondary btn-sm" :disabled="testMutation.isPending.value" @click="handleTest(config)">
                  <Loader2 v-if="testMutation.isPending.value" :size="14" class="spin" />
                  <Plug v-else :size="14" /> Test
                </button>
                <div v-if="testResult?.id === config.id" class="test-result" :class="testResult.success ? 'success' : 'error'">
                  <Check v-if="testResult.success" :size="14" /><X v-else :size="14" />
                  {{ testResult.success ? 'Connected!' : testResult.message }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
@import '../styles/layout.scss';
@import '../styles/configs.scss';
</style>
