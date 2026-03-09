<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../stores/auth'
import { useLogs, useClearLogs, useDeleteLog } from '../lib/query'
import DateInput from '../components/ui/DateInput.vue'
import {
  Mail, CheckCircle, XCircle, Download, Trash2, Search, X, Check,
  Inbox, Loader2, LayoutDashboard, BarChart3, Settings, LogOut,
  Send, Eye, MousePointer
} from 'lucide-vue-next'

const { user, logout } = useAuth()

// Filters
const searchQuery = ref('')
const statusFilter = ref('all')
const sendTypeFilter = ref('all')
const providerFilter = ref('all')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const limit = ref(50)

// Selection
const selectedIds = ref<Set<string>>(new Set())
const selectAll = ref(false)

const filters = computed(() => ({
  page: page.value,
  limit: limit.value,
  ...(statusFilter.value !== 'all' && { status: statusFilter.value }),
  ...(sendTypeFilter.value !== 'all' && { send_type: sendTypeFilter.value }),
  ...(providerFilter.value !== 'all' && { provider: providerFilter.value }),
  ...(searchQuery.value && { search: searchQuery.value }),
  ...(dateFrom.value && { start_date: dateFrom.value }),
  ...(dateTo.value && { end_date: dateTo.value }),
}))

const { data: logsData, isLoading: loading } = useLogs(filters)
const deleteLogsMutation = useClearLogs()
const deleteLogMutation = useDeleteLog()

const logs = computed(() => logsData.value?.logs || [])
const stats = computed(() => logsData.value?.stats || { total: 0, sent: 0, failed: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 })
const pagination = computed(() => logsData.value?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
const openRate = computed(() => stats.value.openRate || 0)
const clickRate = computed(() => stats.value.clickRate || 0)
const hasSelection = computed(() => selectedIds.value.size > 0)
const selectionCount = computed(() => selectedIds.value.size)

async function handleLogout() { await logout() }

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function getStatusClass(status: string) {
  switch (status?.toLowerCase()) {
    case 'sent': return 'success'
    case 'opened': return 'info'
    case 'clicked': return 'accent'
    case 'failed': return 'danger'
    default: return 'warning'
  }
}

function getSendTypeLabel(type: string) {
  switch (type) {
    case 'batch': return '📦 Batch'
    case 'scheduled': return '⏰ Scheduled'
    default: return '📧 Direct'
  }
}

function getProviderLabel(provider: string) {
  switch (provider) {
    case 'google': return '🔵 Gmail'
    case 'microsoft': return '🟦 Outlook'
    default: return '📮 SMTP'
  }
}

function toggleSelectAll() {
  if (selectAll.value) {
    selectedIds.value = new Set()
    selectAll.value = false
  } else {
    selectedIds.value = new Set(logs.value.map(log => log.id || log.tracking_id))
    selectAll.value = true
  }
}

function toggleSelect(id: string) {
  const newSet = new Set(selectedIds.value)
  if (newSet.has(id)) newSet.delete(id)
  else newSet.add(id)
  selectedIds.value = newSet
  selectAll.value = newSet.size === logs.value.length
}

function isSelected(id: string) { return selectedIds.value.has(id) }

async function handleDeleteSelected() {
  console.log('Delete clicked, selected:', selectedIds.value.size, Array.from(selectedIds.value))
  if (selectedIds.value.size === 0) {
    alert('No items selected')
    return
  }
  const count = selectedIds.value.size
  if (!confirm(`Delete ${count} selected log${count > 1 ? 's' : ''}?`)) return
  try {
    console.log('Calling delete API with IDs:', Array.from(selectedIds.value))
    await deleteLogsMutation.mutateAsync(Array.from(selectedIds.value))
    console.log('Delete successful')
    selectedIds.value = new Set()
    selectAll.value = false
    // Force page refresh to show updated data
    window.location.reload()
  } catch (err: any) { 
    console.error('Error deleting logs:', err)
    alert(`Failed to delete: ${err.message || 'Unknown error'}`)
  }
}

async function handleDeleteOne(id: string) {
  if (!confirm('Delete this log?')) return
  try {
    await deleteLogMutation.mutateAsync(id)
    selectedIds.value.delete(id)
    // Force page refresh to show updated data
    window.location.reload()
  } catch (err: any) { 
    console.error('Error deleting log:', err)
    alert(`Failed to delete: ${err.message || 'Unknown error'}`)
  }
}

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  sendTypeFilter.value = 'all'
  providerFilter.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
  page.value = 1
}

function applyFilters() {
  page.value = 1
  selectedIds.value = new Set()
  selectAll.value = false
}

function changePage(newPage: number) {
  page.value = newPage
  selectedIds.value = new Set()
  selectAll.value = false
}

function exportLogs(format: 'csv' | 'json') {
  const params = new URLSearchParams()
  if (statusFilter.value !== 'all') params.set('status', statusFilter.value)
  if (sendTypeFilter.value !== 'all') params.set('send_type', sendTypeFilter.value)
  if (providerFilter.value !== 'all') params.set('provider', providerFilter.value)
  if (dateFrom.value) params.set('start_date', dateFrom.value)
  if (dateTo.value) params.set('end_date', dateTo.value)
  window.open(`/report/export/${format}?${params}`, '_blank')
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
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <Send class="logo-icon" :size="28" />
          <span class="logo-text">Dispatch</span>
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
    
    <main class="main-content">
      <div class="reports-view fade-in">
        <header class="page-header">
          <div>
            <h1>Reports</h1>
            <p class="text-muted">Email delivery logs and analytics</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" @click="exportLogs('csv')"><Download :size="16" />Export CSV</button>
            <button class="btn btn-secondary" @click="exportLogs('json')"><Download :size="16" />Export JSON</button>
          </div>
        </header>
        
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon"><Mail :size="24" /></div><div class="stat-content"><div class="stat-value mono">{{ stats.total }}</div><div class="stat-label">Total Emails</div></div></div>
          <div class="stat-card success"><div class="stat-icon"><CheckCircle :size="24" /></div><div class="stat-content"><div class="stat-value mono">{{ stats.sent }}</div><div class="stat-label">Delivered</div></div></div>
          <div class="stat-card danger"><div class="stat-icon"><XCircle :size="24" /></div><div class="stat-content"><div class="stat-value mono">{{ stats.failed }}</div><div class="stat-label">Failed</div></div></div>
          <div class="stat-card info"><div class="stat-icon"><Eye :size="24" /></div><div class="stat-content"><div class="stat-value mono">{{ stats.opened || 0 }}</div><div class="stat-label">Opened ({{ openRate }}%)</div></div></div>
          <div class="stat-card accent"><div class="stat-icon"><MousePointer :size="24" /></div><div class="stat-content"><div class="stat-value mono">{{ stats.clicked || 0 }}</div><div class="stat-label">Clicked ({{ clickRate }}%)</div></div></div>
        </div>
        
        <div class="filters glass-card">
          <div class="filter-row">
            <div class="search-box">
              <Search :size="18" class="search-icon" />
              <input v-model="searchQuery" type="text" class="form-input" placeholder="Search by email, name, or subject..." @keyup.enter="applyFilters" />
            </div>
            <select v-model="statusFilter" class="form-select" @change="applyFilters">
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="failed">Failed</option>
            </select>
            <select v-model="sendTypeFilter" class="form-select" @change="applyFilters">
              <option value="all">All Types</option>
              <option value="direct">Direct</option>
              <option value="batch">Batch</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <select v-model="providerFilter" class="form-select" @change="applyFilters">
              <option value="all">All Providers</option>
              <option value="smtp">SMTP</option>
              <option value="google">Gmail</option>
              <option value="microsoft">Outlook</option>
            </select>
            <DateInput v-model="dateFrom" placeholder="From date" @change="applyFilters" />
            <DateInput v-model="dateTo" placeholder="To date" @change="applyFilters" />
            <button class="btn btn-ghost" @click="clearFilters"><X :size="16" />Clear</button>
          </div>
        </div>
        
        <div v-if="hasSelection" class="bulk-actions glass-card">
          <span class="selection-count">{{ selectionCount }} selected</span>
          <button class="btn btn-danger btn-sm" @click="handleDeleteSelected"><Trash2 :size="16" />Delete Selected</button>
          <button class="btn btn-ghost btn-sm" @click="selectedIds = new Set(); selectAll = false"><X :size="16" />Clear Selection</button>
        </div>
        
        <div class="logs-table glass-card">
          <div v-if="loading" class="loading"><Loader2 :size="24" class="spin" />Loading logs...</div>
          <div v-else-if="logs.length === 0" class="empty"><Inbox :size="48" class="empty-icon" /><p>No logs found</p><p class="text-muted">Send some emails to see reports here</p></div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th class="checkbox-col"><input type="checkbox" :checked="selectAll" @change="toggleSelectAll" class="checkbox" /></th>
                <th>Status</th><th>Email</th><th>Subject</th><th>Type</th><th>Provider</th><th>Clicked</th><th>Sent At</th><th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id || log.tracking_id" :class="{ selected: isSelected(log.id || log.tracking_id) }">
                <td class="checkbox-col"><input type="checkbox" :checked="isSelected(log.id || log.tracking_id)" @change="toggleSelect(log.id || log.tracking_id)" class="checkbox" /></td>
                <td><span :class="`badge badge-${getStatusClass(log.status)}`"><Eye v-if="log.status === 'opened'" :size="12" /><MousePointer v-else-if="log.status === 'clicked'" :size="12" /><Check v-else-if="log.status === 'sent'" :size="12" /><X v-else :size="12" />{{ log.status }}</span></td>
                <td class="mono">{{ log.recipient_email || log.email }}</td>
                <td class="truncate" style="max-width: 180px;">{{ log.subject || '-' }}</td>
                <td class="text-sm">{{ getSendTypeLabel(log.send_type) }}</td>
                <td class="text-sm">{{ getProviderLabel(log.provider_type) }}</td>
                <td class="text-center"><Check v-if="log.click_count > 0 || log.status === 'clicked'" :size="16" class="check-icon clicked" /><span v-else class="dash">-</span></td>
                <td class="mono text-sm">{{ formatDate(log.sent_at || log.timestamp) }}</td>
                <td class="actions-col"><button class="btn btn-ghost btn-xs delete-btn" @click="handleDeleteOne(log.id || log.tracking_id)" title="Delete"><Trash2 :size="14" /></button></td>
              </tr>
            </tbody>
          </table>
          <div v-if="logs.length > 0" class="table-footer">
            <span>Showing {{ logs.length }} of {{ pagination.total }} logs</span>
            <div class="pagination" v-if="pagination.totalPages > 1">
              <button class="btn btn-sm btn-ghost" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">Previous</button>
              <span class="page-info">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
              <button class="btn btn-sm btn-ghost" :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)">Next</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>


<style scoped lang="scss">
.app-layout { display: flex; min-height: 100vh; }
.sidebar { width: 260px; background: var(--bg-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
.sidebar-header { padding: 24px; border-bottom: 1px solid var(--border-color); }
.logo { display: flex; align-items: center; gap: 12px; &-icon { color: var(--accent-primary); } &-text { font-family: var(--font-mono); font-size: 20px; font-weight: 700; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; } }
.sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: var(--radius-md); color: var(--text-secondary); text-decoration: none; transition: all 0.2s ease; &:hover { background: rgba(6, 182, 212, 0.1); color: var(--text-primary); } &.active { background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(20, 184, 166, 0.1)); color: var(--accent-primary); border: 1px solid var(--border-glow); .nav-icon { color: var(--accent-primary); } } }
.nav-label { font-size: 14px; font-weight: 500; }
.sidebar-footer { padding: 16px; border-top: 1px solid var(--border-color); }
.user-info { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.user-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--bg-primary); }
.user-details { flex: 1; min-width: 0; }
.user-name { font-size: 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-email { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.main-content { flex: 1; margin-left: 260px; padding: 32px; min-height: 100vh; background: var(--bg-primary); }
.reports-view { max-width: 1400px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; h1 { font-size: 28px; margin-bottom: 4px; } }
.header-actions { display: flex; gap: 12px; }
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; @media (max-width: 1200px) { grid-template-columns: repeat(3, 1fr); } @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); } }
.stat-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); &.success { border-left: 3px solid var(--success); .stat-icon { background: rgba(16, 185, 129, 0.15); color: var(--success); } } &.danger { border-left: 3px solid var(--danger); .stat-icon { background: rgba(239, 68, 68, 0.15); color: var(--danger); } } &.info { border-left: 3px solid #3b82f6; .stat-icon { background: rgba(59, 130, 246, 0.15); color: #3b82f6; } } &.accent { border-left: 3px solid var(--accent-primary); .stat-icon { background: rgba(6, 182, 212, 0.15); color: var(--accent-primary); } } }
.stat-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); border-radius: var(--radius-md); color: var(--text-secondary); }
.stat-content { flex: 1; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
.stat-label { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.filters { padding: 20px; margin-bottom: 24px; }
.filter-row { display: flex; gap: 12px; flex-wrap: wrap; .form-select { width: 150px; } }
.search-box { position: relative; flex: 1; min-width: 250px; .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); } .form-input { padding-left: 44px; } }
.bulk-actions { display: flex; align-items: center; gap: 16px; padding: 12px 20px; margin-bottom: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); .selection-count { font-weight: 600; color: var(--text-primary); } }
.logs-table { padding: 0; overflow: hidden; }
.loading, .empty { text-align: center; padding: 60px 20px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.checkbox-col { width: 40px; text-align: center; }
.actions-col { width: 60px; text-align: center; }
.checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent-primary); }
tr.selected { background: rgba(6, 182, 212, 0.1); }
.delete-btn { opacity: 0.5; transition: opacity 0.2s; &:hover { opacity: 1; color: var(--danger); } }
.btn-xs { padding: 4px 8px; font-size: 12px; }
.check-icon { &.opened { color: #3b82f6; } &.clicked { color: var(--accent-primary); } }
.dash { color: var(--text-muted); }
.table-footer { padding: 16px 20px; border-top: 1px solid var(--border-color); font-size: 13px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; }
.pagination { display: flex; align-items: center; gap: 12px; .page-info { font-size: 13px; } }
.text-center { text-align: center; }
.badge { display: inline-flex; align-items: center; gap: 4px; }
</style>
