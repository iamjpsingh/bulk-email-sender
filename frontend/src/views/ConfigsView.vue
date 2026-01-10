<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '../stores/auth'
import {
  Plus,
  Pencil,
  Trash2,
  Plug,
  X,
  Server,
  Check,
  Loader2,
  Inbox,
  LayoutDashboard,
  Mail,
  BarChart3,
  Settings,
  LogOut,
  Send
} from 'lucide-vue-next'

const { user, logout } = useAuth()

// Data
const configs = ref<any[]>([])
const loading = ref(false)

// Form
const showForm = ref(false)
const editingId = ref<string | null>(null)
const testing = ref<string | null>(null)
const testResult = ref<{ id: string; success: boolean; message: string } | null>(null)

const form = ref({
  name: '',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  from_email: '',
  from_name: '',
  is_default: false
})

onMounted(async () => {
  await loadConfigs()
})

async function loadConfigs() {
  loading.value = true
  try {
    const response = await fetch('/config/list', {
      credentials: 'include'
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    if (data.success) {
      configs.value = data.configs || []
    } else {
      throw new Error(data.message || 'Failed to load configs')
    }
  } catch (err) {
    console.error('Error loading configs:', err)
  } finally {
    loading.value = false
  }
}

async function handleLogout() {
  await logout()
}

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
    is_default: false
  }
  editingId.value = null
  showForm.value = false
}

function editConfig(config: any) {
  form.value = {
    name: config.name,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: '',
    from_email: config.from_email,
    from_name: config.from_name,
    is_default: config.is_default
  }
  editingId.value = config.id
  showForm.value = true
}

async function handleSubmit() {
  try {
    const endpoint = editingId.value ? `/config/update/${editingId.value}` : '/config/create'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })
    
    const data = await response.json()
    if (data.success) {
      await loadConfigs()
      resetForm()
    }
  } catch (err) {
    console.error('Error saving config:', err)
  }
}

async function handleDelete(id: string) {
  if (confirm('Are you sure you want to delete this configuration?')) {
    try {
      const response = await fetch(`/config/delete/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const data = await response.json()
      if (data.success) {
        await loadConfigs()
      }
    } catch (err) {
      console.error('Error deleting config:', err)
    }
  }
}

async function handleTest(id: string) {
  testing.value = id
  testResult.value = null
  
  try {
    const response = await fetch(`/config/test/${id}`, {
      method: 'POST',
      credentials: 'include'
    })
    
    const data = await response.json()
    testResult.value = { id, success: data.success, message: data.message }
  } catch (err: any) {
    testResult.value = { id, success: false, message: 'Network error' }
  } finally {
    testing.value = null
    
    setTimeout(() => {
      if (testResult.value?.id === id) {
        testResult.value = null
      }
    }, 5000)
  }
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/compose', label: 'Compose', icon: Mail },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/configs', label: 'Configs', icon: Settings }
]
</script>

<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <Send class="logo-icon" :size="28" />
          <span class="logo-text">MailFlow</span>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <component :is="item.icon" class="nav-icon" :size="20" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      
      <div class="sidebar-footer">
        <div class="user-info" v-if="user">
          <div class="user-avatar">
            {{ user?.name?.charAt(0).toUpperCase() || '?' }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ user?.name || 'User' }}</div>
            <div class="user-email">{{ user?.email || '' }}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">
          <LogOut :size="16" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
    
    <!-- Main content -->
    <main class="main-content">
      <div class="configs-view fade-in">
        
        <header class="page-header">
          <div>
            <h1>SMTP Configurations</h1>
            <p class="text-muted">Manage your email sending configurations</p>
          </div>
          <button class="btn btn-primary" @click="showForm = true; editingId = null">
            <Plus :size="18" />
            Add Configuration
          </button>
        </header>
        
        <!-- Config form modal -->
        <div v-if="showForm" class="modal-overlay" @click.self="resetForm">
          <div class="modal glass-card fade-in">
            <div class="modal-header">
              <h2>{{ editingId ? 'Edit' : 'New' }} Configuration</h2>
              <button class="btn btn-ghost btn-sm" @click="resetForm">
                <X :size="18" />
              </button>
            </div>
            
            <form @submit.prevent="handleSubmit" class="modal-body">
              <div class="form-group">
                <label class="form-label">Configuration Name *</label>
                <input v-model="form.name" type="text" class="form-input" placeholder="e.g., My Gmail" required />
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
                <input v-model="form.secure" type="checkbox" />
                <span>Use TLS/SSL</span>
              </label>
              
              <div class="form-group">
                <label class="form-label">Username *</label>
                <input v-model="form.user" type="text" class="form-input" placeholder="you@gmail.com" required />
              </div>
              
              <div class="form-group">
                <label class="form-label">Password {{ editingId ? '(leave blank to keep)' : '*' }}</label>
                <input v-model="form.pass" type="password" class="form-input" :required="!editingId" />
                <p class="text-muted text-sm mt-2">For Gmail, use App Password (not regular password)</p>
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
                <input v-model="form.is_default" type="checkbox" />
                <span>Set as default configuration</span>
              </label>
              
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" @click="resetForm">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  {{ editingId ? 'Update' : 'Create' }} Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <!-- Configs list -->
        <div v-if="loading" class="loading">
          <Loader2 :size="24" class="spin" />
          Loading configurations...
        </div>
        
        <div v-else-if="configs.length === 0" class="empty glass-card">
          <Inbox :size="64" class="empty-icon" />
          <h3>No configurations yet</h3>
          <p class="text-muted">Add your first SMTP configuration to start sending emails</p>
          <button class="btn btn-primary" @click="showForm = true">
            <Plus :size="18" />
            Add Configuration
          </button>
        </div>
        
        <div v-else class="configs-grid">
          <div v-for="config in configs" :key="config.id" class="config-card glass-card">
            <div class="config-header">
              <div class="config-title">
                <Server :size="20" class="config-icon" />
                <h3>{{ config.name }}</h3>
                <span v-if="config.is_default" class="badge badge-success">
                  <Check :size="12" />
                  Default
                </span>
              </div>
              <div class="config-actions">
                <button class="btn btn-ghost btn-sm" @click="editConfig(config)">
                  <Pencil :size="16" />
                </button>
                <button class="btn btn-ghost btn-sm" @click="handleDelete(config.id)">
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
            
            <div class="config-details">
              <div class="detail-row">
                <span class="detail-label">Host</span>
                <span class="detail-value mono">{{ config.host }}:{{ config.port }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">User</span>
                <span class="detail-value mono">{{ config.user }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">From</span>
                <span class="detail-value">{{ config.from_name || config.from_email }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Security</span>
                <span class="detail-value">{{ config.secure ? 'TLS/SSL' : 'None' }}</span>
              </div>
            </div>
            
            <div class="config-footer">
              <button
                class="btn btn-secondary btn-sm"
                :disabled="testing === config.id"
                @click="handleTest(config.id)"
              >
                <Loader2 v-if="testing === config.id" :size="14" class="spin" />
                <Plug v-else :size="14" />
                Test Connection
              </button>
              
              <div v-if="testResult && testResult.id === config.id" class="test-result" :class="testResult.success ? 'success' : 'error'">
                <Check v-if="testResult.success" :size="14" />
                <X v-else :size="14" />
                {{ testResult.success ? 'Connected!' : testResult.message }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  
  &-icon {
    color: var(--accent-primary);
  }
  
  &-text {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(6, 182, 212, 0.1);
    color: var(--text-primary);
  }
  
  &.active {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(20, 184, 166, 0.1));
    color: var(--accent-primary);
    border: 1px solid var(--border-glow);
    
    .nav-icon {
      color: var(--accent-primary);
    }
  }
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--bg-primary);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-content {
  flex: 1;
  margin-left: 260px;
  padding: 32px;
  min-height: 100vh;
  background: var(--bg-primary);
}

.configs-view {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  
  h1 {
    font-size: 28px;
    margin-bottom: 4px;
  }
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.empty {
  text-align: center;
  padding: 60px;
  
  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 16px;
  }
  
  h3 {
    margin-bottom: 8px;
  }
  
  p {
    margin-bottom: 24px;
  }
}

.configs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.config-card {
  padding: 24px;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.config-title {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .config-icon {
    color: var(--accent-primary);
  }
  
  h3 {
    font-size: 18px;
  }
  
  .badge {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.config-actions {
  display: flex;
  gap: 4px;
}

.config-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: var(--text-muted);
}

.detail-value {
  font-size: 14px;
  color: var(--text-secondary);
}

.config-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  
  &.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success);
  }
  
  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
  }
}

// Modal
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

.modal {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  
  h2 {
    font-size: 20px;
  }
}

.modal-body {
  padding: 24px;
}

.form-row {
  display: flex;
  gap: 16px;
  
  .form-group {
    flex: 1;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}
</style>
