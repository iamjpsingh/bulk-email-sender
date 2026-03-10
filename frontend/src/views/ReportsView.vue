<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLogs, useClearLogs, useDeleteLog } from '../lib/query'
import { useToast } from '../composables/useToast'
import DateInput from '../components/ui/DateInput.vue'
import MainLayout from '../components/layout/MainLayout.vue'
import {
  Mail,
  CheckCircle,
  XCircle,
  Download,
  Trash2,
  Search,
  X,
  Check,
  Inbox,
  Loader2,
  Eye,
  MousePointer,
} from 'lucide-vue-next'

const toast = useToast()

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
const stats = computed(
  () => logsData.value?.stats || { total: 0, sent: 0, failed: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 }
)
const pagination = computed(() => logsData.value?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
const openRate = computed(() => stats.value.openRate || 0)
const clickRate = computed(() => stats.value.clickRate || 0)
const hasSelection = computed(() => selectedIds.value.size > 0)
const selectionCount = computed(() => selectedIds.value.size)

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function getStatusClass(status: string) {
  switch (status?.toLowerCase()) {
    case 'sent':
      return 'success'
    case 'opened':
      return 'info'
    case 'clicked':
      return 'accent'
    case 'failed':
      return 'danger'
    default:
      return 'warning'
  }
}

function getSendTypeLabel(type: string) {
  switch (type) {
    case 'batch':
      return 'Batch'
    case 'scheduled':
      return 'Scheduled'
    default:
      return 'Direct'
  }
}

function getProviderLabel(provider: string) {
  switch (provider) {
    case 'google':
      return 'Gmail'
    case 'microsoft':
      return 'Outlook'
    default:
      return 'SMTP'
  }
}

function toggleSelectAll() {
  if (selectAll.value) {
    selectedIds.value = new Set()
    selectAll.value = false
  } else {
    selectedIds.value = new Set(logs.value.map((log) => log.id || log.tracking_id || ''))
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

function isSelected(id: string) {
  return selectedIds.value.has(id)
}

async function handleDeleteSelected() {
  if (selectedIds.value.size === 0) {
    toast.warning('No items selected')
    return
  }
  const count = selectedIds.value.size
  if (!confirm(`Delete ${count} selected log${count > 1 ? 's' : ''}?`)) return
  try {
    await deleteLogsMutation.mutateAsync(Array.from(selectedIds.value))
    selectedIds.value = new Set()
    selectAll.value = false
    toast.success(`${count} log${count > 1 ? 's' : ''} deleted`)
  } catch (err: any) {
    toast.error(`Failed to delete: ${err.message || 'Unknown error'}`)
  }
}

async function handleDeleteOne(id: string) {
  if (!confirm('Delete this log?')) return
  try {
    await deleteLogMutation.mutateAsync(id)
    selectedIds.value.delete(id)
    toast.success('Log deleted')
  } catch (err: any) {
    toast.error(`Failed to delete: ${err.message || 'Unknown error'}`)
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

function clearSelection() {
  selectedIds.value = new Set()
  selectAll.value = false
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
  window.open(`/api/report/export/${format}?${params}`, '_blank')
}
</script>

<template>
  <MainLayout>
    <!-- Page Header -->
    <header class="flex justify-between items-center mb-8 flex-wrap gap-4">
      <div>
        <h1 class="text-[28px] mb-1">Reports</h1>
        <p class="text-muted">Email delivery logs and analytics</p>
      </div>
      <div class="flex gap-3">
        <button class="btn-secondary" @click="exportLogs('csv')"><Download :size="16" />Export CSV</button>
        <button class="btn-secondary" @click="exportLogs('json')"><Download :size="16" />Export JSON</button>
      </div>
    </header>

    <!-- Stats Grid -->
    <div class="grid grid-cols-5 gap-4 mb-6 max-[1200px]:grid-cols-3 max-[768px]:grid-cols-2">
      <!-- Total -->
      <div class="flex items-center gap-4 p-5 bg-bg-card border border-border rounded-[var(--radius-lg)]">
        <div
          class="w-12 h-12 flex items-center justify-center bg-bg-secondary rounded-[var(--radius-md)] text-text-secondary"
        >
          <Mail :size="24" />
        </div>
        <div class="flex-1">
          <div class="text-[28px] font-bold text-text-primary leading-tight mono">{{ stats.total }}</div>
          <div class="text-[13px] text-text-muted uppercase tracking-wide">Total Emails</div>
        </div>
      </div>
      <!-- Delivered -->
      <div
        class="flex items-center gap-4 p-5 bg-bg-card border border-border border-l-[3px] border-l-success rounded-[var(--radius-lg)]"
      >
        <div
          class="w-12 h-12 flex items-center justify-center bg-[rgba(16,185,129,0.15)] text-success rounded-[var(--radius-md)]"
        >
          <CheckCircle :size="24" />
        </div>
        <div class="flex-1">
          <div class="text-[28px] font-bold text-text-primary leading-tight mono">{{ stats.sent }}</div>
          <div class="text-[13px] text-text-muted uppercase tracking-wide">Delivered</div>
        </div>
      </div>
      <!-- Failed -->
      <div
        class="flex items-center gap-4 p-5 bg-bg-card border border-border border-l-[3px] border-l-danger rounded-[var(--radius-lg)]"
      >
        <div
          class="w-12 h-12 flex items-center justify-center bg-[rgba(239,68,68,0.15)] text-danger rounded-[var(--radius-md)]"
        >
          <XCircle :size="24" />
        </div>
        <div class="flex-1">
          <div class="text-[28px] font-bold text-text-primary leading-tight mono">{{ stats.failed }}</div>
          <div class="text-[13px] text-text-muted uppercase tracking-wide">Failed</div>
        </div>
      </div>
      <!-- Opened -->
      <div
        class="flex items-center gap-4 p-5 bg-bg-card border border-border border-l-[3px] border-l-[#3b82f6] rounded-[var(--radius-lg)]"
      >
        <div
          class="w-12 h-12 flex items-center justify-center bg-[rgba(59,130,246,0.15)] text-[#3b82f6] rounded-[var(--radius-md)]"
        >
          <Eye :size="24" />
        </div>
        <div class="flex-1">
          <div class="text-[28px] font-bold text-text-primary leading-tight mono">{{ stats.opened || 0 }}</div>
          <div class="text-[13px] text-text-muted uppercase tracking-wide">Opened ({{ openRate }}%)</div>
        </div>
      </div>
      <!-- Clicked -->
      <div
        class="flex items-center gap-4 p-5 bg-bg-card border border-border border-l-[3px] border-l-accent rounded-[var(--radius-lg)]"
      >
        <div
          class="w-12 h-12 flex items-center justify-center bg-[rgba(6,182,212,0.15)] text-accent rounded-[var(--radius-md)]"
        >
          <MousePointer :size="24" />
        </div>
        <div class="flex-1">
          <div class="text-[28px] font-bold text-text-primary leading-tight mono">{{ stats.clicked || 0 }}</div>
          <div class="text-[13px] text-text-muted uppercase tracking-wide">Clicked ({{ clickRate }}%)</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass-card p-5 mb-6">
      <div class="flex gap-3 flex-wrap">
        <div class="relative flex-1 min-w-[250px]">
          <Search :size="18" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            v-model="searchQuery"
            type="text"
            class="form-input pl-11"
            placeholder="Search by email, name, or subject..."
            @keyup.enter="applyFilters"
          />
        </div>
        <select v-model="statusFilter" class="form-select w-[150px]" @change="applyFilters">
          <option value="all">All Status</option>
          <option value="sent">Sent</option>
          <option value="opened">Opened</option>
          <option value="clicked">Clicked</option>
          <option value="failed">Failed</option>
        </select>
        <select v-model="sendTypeFilter" class="form-select w-[150px]" @change="applyFilters">
          <option value="all">All Types</option>
          <option value="direct">Direct</option>
          <option value="batch">Batch</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <select v-model="providerFilter" class="form-select w-[150px]" @change="applyFilters">
          <option value="all">All Providers</option>
          <option value="smtp">SMTP</option>
          <option value="google">Gmail</option>
          <option value="microsoft">Outlook</option>
        </select>
        <DateInput v-model="dateFrom" placeholder="From date" @change="applyFilters" />
        <DateInput v-model="dateTo" placeholder="To date" @change="applyFilters" />
        <button class="btn-ghost" @click="clearFilters"><X :size="16" />Clear</button>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div
      v-if="hasSelection"
      class="glass-card flex items-center gap-4 px-5 py-3 mb-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)]"
    >
      <span class="font-semibold text-text-primary">{{ selectionCount }} selected</span>
      <button class="btn-danger btn-sm" @click="handleDeleteSelected"><Trash2 :size="16" />Delete Selected</button>
      <button class="btn-ghost btn-sm" @click="clearSelection"><X :size="16" />Clear Selection</button>
    </div>

    <!-- Logs Table -->
    <div class="glass-card p-0 overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-15 px-5 text-text-muted flex flex-col items-center gap-3">
        <Loader2 :size="24" class="spin" />Loading logs...
      </div>
      <!-- Empty -->
      <div
        v-else-if="logs.length === 0"
        class="text-center py-15 px-5 text-text-muted flex flex-col items-center gap-3"
      >
        <Inbox :size="48" class="text-text-muted" />
        <p>No logs found</p>
        <p class="text-muted">Send some emails to see reports here</p>
      </div>
      <!-- Table -->
      <table v-else class="data-table">
        <thead>
          <tr>
            <th class="w-10 text-center">
              <input
                type="checkbox"
                :checked="selectAll"
                @change="toggleSelectAll"
                class="w-4 h-4 cursor-pointer accent-accent"
              />
            </th>
            <th>Status</th>
            <th>Email</th>
            <th>Subject</th>
            <th>Type</th>
            <th>Provider</th>
            <th>Clicked</th>
            <th>Sent At</th>
            <th class="w-[60px] text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="log in logs"
            :key="log.id || log.tracking_id || ''"
            :class="{ 'bg-[rgba(6,182,212,0.1)]': isSelected(log.id || log.tracking_id || '') }"
          >
            <td class="w-10 text-center">
              <input
                type="checkbox"
                :checked="isSelected(log.id || log.tracking_id || '')"
                @change="toggleSelect(log.id || log.tracking_id || '')"
                class="w-4 h-4 cursor-pointer accent-accent"
              />
            </td>
            <td>
              <span :class="`badge-${getStatusClass(log.status)}`" class="inline-flex items-center gap-1">
                <Eye v-if="log.status === 'opened'" :size="12" />
                <MousePointer v-else-if="log.status === 'clicked'" :size="12" />
                <Check v-else-if="log.status === 'sent'" :size="12" />
                <X v-else :size="12" />
                {{ log.status }}
              </span>
            </td>
            <td class="mono">{{ log.recipient_email }}</td>
            <td class="truncate max-w-[180px]">{{ log.subject || '-' }}</td>
            <td class="text-sm">{{ getSendTypeLabel(log.send_type) }}</td>
            <td class="text-sm">{{ getProviderLabel(log.provider_type) }}</td>
            <td class="text-center">
              <Check v-if="(log.click_count || 0) > 0 || log.status === 'clicked'" :size="16" class="text-accent" />
              <span v-else class="text-text-muted">-</span>
            </td>
            <td class="mono text-sm">{{ formatDate(log.sent_at) }}</td>
            <td class="w-[60px] text-center">
              <button
                class="btn-ghost py-1 px-2 text-xs opacity-50 hover:opacity-100 hover:text-danger transition-opacity duration-200"
                @click="handleDeleteOne(log.id || log.tracking_id || '')"
                title="Delete"
              >
                <Trash2 :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Table Footer -->
      <div
        v-if="logs.length > 0"
        class="px-5 py-4 border-t border-border text-[13px] text-text-muted flex justify-between items-center"
      >
        <span>Showing {{ logs.length }} of {{ pagination.total }} logs</span>
        <div class="flex items-center gap-3" v-if="pagination.totalPages > 1">
          <button class="btn-ghost btn-sm" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">
            Previous
          </button>
          <span class="text-[13px]">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
          <button
            class="btn-ghost btn-sm"
            :disabled="pagination.page >= pagination.totalPages"
            @click="changePage(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </MainLayout>
</template>
