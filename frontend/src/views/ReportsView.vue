<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../stores/auth'
import DateInput from '../components/ui/DateInput.vue'
import {
  Mail,
  CheckCircle,
  XCircle,
  TrendingUp,
  Download,
  Trash2,
  Search,
  X,
  Check,
  Inbox,
  Loader2,
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Send
} from 'lucide-vue-next'

const { user, logout } = useAuth()

// Data
const logs = ref<any[]>([])
const stats = ref({ total: 0, sent: 0, failed: 0 })
const loading = ref(false)

// Filters
const searchQuery = ref('')
const statusFilter = ref<'all' | 'Sent' | 'Failed'>('all')
const dateFrom = ref('')
const dateTo = ref('')

const filteredLogs = computed(() => {
  let result = logs.value
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(log => 
      log.email.toLowerCase().includes(query) ||
      log.subject?.toLowerCase().includes(query) ||
      log.firstName?.toLowerCase().includes(query)
    )
  }
  
  // Status filter
  if (statusFilter.value !== 'all') {
    result = result.filter(log => log.status === statusFilter.value)
  }
  
  // Date filter
  if (dateFrom.value) {
    const from = new Date(dateFrom.value)
    result = result.filter(log => new Date(log.timestamp) >= from)
  }
  if (dateTo.value) {
    const to = new Date(dateTo.value)
    to.setHours(23, 59, 59)
    result = result.filter(log => new Date(log.timestamp) <= to)
  }
  
  return result
})

const successRate = computed(() => {
  if (stats.value.total === 0) return 0
  return Math.round((stats.value.sent / stats.value.total) * 100)
})

onMounted(async () => {
  await loadLogs()
})

async function loadLogs() {
  loading.value = true
  try {
    const response = await fetch('/report/logs', {
      credentials: 'include'
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    if (data.success) {
      logs.value = data.logs || []
      stats.value = data.stats || { total: 0, sent: 0, failed: 0 }
    } else {
      throw new Error(data.message || 'Failed to load logs')
    }
  } catch (err) {
    console.error('Error loading logs:', err)
  } finally {
    loading.value = false
  }
}

async function handleLogout() {
  await logout()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function getStatusClass(status: string) {
  switch (status) {
    case 'Sent': return 'success'
    case 'Failed': return 'danger'
    default: return 'warning'
  }
}

async function handleClearLogs() {
  if (confirm('Are you sure you want to clear all logs?')) {
    try {
      const response = await fetch('/report/clear', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        await loadLogs()
      }
    } catch (err) {
      console.error('Error clearing logs:', err)
    }
  }
}

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
}

function exportLogs(format: 'csv' | 'json') {
  window.open(`/report/export/${format}`, '_blank')
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
      <div class="reports-view fade-in">
        
        <header class="page-header">
          <div>
            <h1>Reports</h1>
            <p class="text-muted">Email delivery logs and analytics</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" @click="exportLogs('csv')">
              <Download :size="16" />
              Export CSV
            </button>
            <button class="btn btn-secondary" @click="exportLogs('json')">
              <Download :size="16" />
              Export JSON
            </button>
            <button class="btn btn-danger" @click="handleClearLogs">
              <Trash2 :size="16" />
              Clear Logs
            </button>
          </div>
        </header>
        
        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <Mail :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.total }}</div>
              <div class="stat-label">Total Emails</div>
            </div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-icon">
              <CheckCircle :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.sent }}</div>
              <div class="stat-label">Delivered</div>
            </div>
          </div>
          
          <div class="stat-card danger">
            <div class="stat-icon">
              <XCircle :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.failed }}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
          
          <div class="stat-card accent">
            <div class="stat-icon">
              <TrendingUp :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ successRate }}%</div>
              <div class="stat-label">Success Rate</div>
            </div>
          </div>
        </div>
        
        <!-- Filters -->
        <div class="filters glass-card">
          <div class="filter-row">
            <div class="search-box">
              <Search :size="18" class="search-icon" />
              <input
                v-model="searchQuery"
                type="text"
                class="form-input"
                placeholder="Search by email, name, or subject..."
              />
            </div>
            
            <select v-model="statusFilter" class="form-select">
              <option value="all">All Status</option>
              <option value="Sent">Sent</option>
              <option value="Failed">Failed</option>
            </select>
            
            <DateInput v-model="dateFrom" placeholder="From date" />
            <DateInput v-model="dateTo" placeholder="To date" />
            
            <button class="btn btn-ghost" @click="clearFilters">
              <X :size="16" />
              Clear
            </button>
          </div>
        </div>
        
        <!-- Logs table -->
        <div class="logs-table glass-card">
          <div v-if="loading" class="loading">
            <Loader2 :size="24" class="spin" />
            Loading logs...
          </div>
          
          <div v-else-if="filteredLogs.length === 0" class="empty">
            <Inbox :size="48" class="empty-icon" />
            <p>No logs found</p>
            <p class="text-muted">Send some emails to see reports here</p>
          </div>
          
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Email</th>
                <th>Name</th>
                <th>Subject</th>
                <th>Time</th>
                <th>Message ID</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in filteredLogs" :key="log.id">
                <td>
                  <span :class="`badge badge-${getStatusClass(log.status)}`">
                    <Check v-if="log.status === 'Sent'" :size="12" />
                    <X v-else :size="12" />
                    {{ log.status }}
                  </span>
                </td>
                <td class="mono">{{ log.email }}</td>
                <td>{{ log.firstName || '-' }}</td>
                <td class="truncate" style="max-width: 200px;">{{ log.subject || '-' }}</td>
                <td class="mono text-sm">{{ formatDate(log.timestamp) }}</td>
                <td class="mono text-sm truncate" style="max-width: 150px;">
                  {{ log.messageId || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
          
          <div v-if="filteredLogs.length > 0" class="table-footer">
            Showing {{ filteredLogs.length }} of {{ logs.length }} logs
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

.reports-view {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
  
  h1 {
    font-size: 28px;
    margin-bottom: 4px;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  &.success {
    border-left: 3px solid var(--success);
    
    .stat-icon {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }
  }
  
  &.danger {
    border-left: 3px solid var(--danger);
    
    .stat-icon {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
    }
  }
  
  &.accent {
    border-left: 3px solid var(--accent-primary);
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
    
    .stat-icon {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-primary);
    }
    
    .stat-value {
      color: var(--accent-primary);
    }
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filters {
  padding: 20px;
  margin-bottom: 24px;
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  
  .form-select, .date-input-wrapper {
    width: 150px;
  }
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 250px;
  
  .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
  }
  
  .form-input {
    padding-left: 44px;
  }
}

.logs-table {
  padding: 0;
  overflow: hidden;
}

.loading, .empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  
  .empty-icon {
    margin-bottom: 12px;
  }
}

.table-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
