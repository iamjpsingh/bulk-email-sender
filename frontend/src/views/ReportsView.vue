<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLogs, useClearLogs, useDeleteLog } from '../lib/query'
import { useToast } from '../composables/useToast'
import DateInput from '../components/ui/DateInput.vue'
import PageHeader from '../components/ui/PageHeader.vue'
import StatCard from '../components/ui/StatCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import AppPagination from '../components/ui/AppPagination.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import SearchInput from '../components/ui/SearchInput.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import {
  Mail,
  CheckCircle,
  XCircle,
  Download,
  Trash2,
  X,
  Check,
  Inbox,
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
const deleteConfirm = ref<{ show: boolean; type: 'single' | 'bulk'; id: string }>({ show: false, type: 'single', id: '' })

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

function handleDeleteSelected() {
  if (selectedIds.value.size === 0) {
    toast.warning('No items selected')
    return
  }
  deleteConfirm.value = { show: true, type: 'bulk', id: '' }
}

async function confirmDeleteSelected() {
  deleteConfirm.value.show = false
  const count = selectedIds.value.size
  try {
    await deleteLogsMutation.mutateAsync(Array.from(selectedIds.value))
    selectedIds.value = new Set()
    selectAll.value = false
    toast.success(`${count} log${count > 1 ? 's' : ''} deleted`)
  } catch (err: any) {
    toast.error(`Failed to delete: ${err.message || 'Unknown error'}`)
  }
}

function handleDeleteOne(id: string) {
  deleteConfirm.value = { show: true, type: 'single', id }
}

async function confirmDeleteOne() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
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
  <div>
    <div class="reports-page">
      <!-- Header -->
      <PageHeader title="Reports" subtitle="Email delivery logs and analytics">
        <template #actions>
          <button class="btn-secondary" @click="exportLogs('csv')"><Download :size="16" />Export CSV</button>
          <button class="btn-secondary" @click="exportLogs('json')"><Download :size="16" />Export JSON</button>
        </template>
      </PageHeader>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <StatCard :icon="Mail" :value="stats.total" label="Total Emails" />
        <StatCard :icon="CheckCircle" :value="stats.sent" label="Delivered" color="success" />
        <StatCard :icon="XCircle" :value="stats.failed" label="Failed" color="danger" />
        <StatCard :icon="Eye" :value="stats.opened || 0" :label="`Opened (${openRate}%)`" color="info" />
        <StatCard :icon="MousePointer" :value="stats.clicked || 0" :label="`Clicked (${clickRate}%)`" color="accent" />
      </div>

      <!-- Filters -->
      <div class="filters-card glass-card">
        <!-- Search row -->
        <div class="filters-search-row">
          <SearchInput
            v-model="searchQuery"
            placeholder="Search by email, name, or subject..."
            class="filters-search"
            @search="applyFilters"
          />
        </div>
        <!-- Filter controls row -->
        <div class="filters-controls-row">
          <div class="filters-selects">
            <select v-model="statusFilter" class="form-select filters-select" @change="applyFilters">
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="failed">Failed</option>
            </select>
            <select v-model="sendTypeFilter" class="form-select filters-select" @change="applyFilters">
              <option value="all">All Types</option>
              <option value="direct">Direct</option>
              <option value="batch">Batch</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <select v-model="providerFilter" class="form-select filters-select" @change="applyFilters">
              <option value="all">All Providers</option>
              <option value="smtp">SMTP</option>
              <option value="google">Gmail</option>
              <option value="microsoft">Outlook</option>
            </select>
            <DateInput v-model="dateFrom" placeholder="From date" @change="applyFilters" />
            <DateInput v-model="dateTo" placeholder="To date" @change="applyFilters" />
          </div>
          <button class="btn-ghost filters-clear" @click="clearFilters"><X :size="14" />Clear filters</button>
        </div>
      </div>

      <!-- Bulk Actions -->
      <Transition name="bulk-bar">
        <div v-if="hasSelection" class="bulk-actions-bar">
          <span class="bulk-actions-count">{{ selectionCount }} selected</span>
          <div class="bulk-actions-buttons">
            <button class="btn-danger btn-sm" @click="handleDeleteSelected"><Trash2 :size="14" />Delete Selected</button>
            <button class="btn-ghost btn-sm" @click="clearSelection"><X :size="14" />Clear</button>
          </div>
        </div>
      </Transition>

      <!-- Logs Table -->
      <div class="table-container glass-card">
        <!-- Loading -->
        <table v-if="loading" class="data-table reports-table">
          <thead>
            <tr>
              <th class="th-checkbox"></th>
              <th>Status</th>
              <th>Email</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Provider</th>
              <th>Clicked</th>
              <th>Sent At</th>
              <th class="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <Skeleton variant="table-row" :count="8" />
          </tbody>
        </table>

        <!-- Empty -->
        <EmptyState
          v-else-if="logs.length === 0"
          :icon="Inbox"
          title="No logs found"
          description="Send some emails to see reports here"
        />

        <!-- Table -->
        <table v-else class="data-table reports-table">
          <thead>
            <tr>
              <th class="th-checkbox">
                <label class="table-checkbox">
                  <input
                    type="checkbox"
                    :checked="selectAll"
                    @change="toggleSelectAll"
                  />
                  <span class="table-checkbox-mark"></span>
                </label>
              </th>
              <th>Status</th>
              <th>Email</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Provider</th>
              <th>Clicked</th>
              <th>Sent At</th>
              <th class="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in logs"
              :key="log.id || log.tracking_id || ''"
              class="table-row"
              :class="{ 'table-row--selected': isSelected(log.id || log.tracking_id || '') }"
            >
              <td class="td-checkbox">
                <label class="table-checkbox">
                  <input
                    type="checkbox"
                    :checked="isSelected(log.id || log.tracking_id || '')"
                    @change="toggleSelect(log.id || log.tracking_id || '')"
                  />
                  <span class="table-checkbox-mark"></span>
                </label>
              </td>
              <td>
                <StatusBadge :status="log.status" type="email" />
              </td>
              <td class="td-email">{{ log.recipient_email }}</td>
              <td class="td-subject">{{ log.subject || '-' }}</td>
              <td class="td-meta">{{ getSendTypeLabel(log.send_type) }}</td>
              <td class="td-meta">{{ getProviderLabel(log.provider_type) }}</td>
              <td class="td-clicked">
                <Check v-if="(log.click_count || 0) > 0 || log.status === 'clicked'" :size="16" class="clicked-icon" />
                <span v-else class="clicked-none">-</span>
              </td>
              <td class="td-date">{{ formatDate(log.sent_at) }}</td>
              <td class="td-actions">
                <button
                  class="delete-btn"
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
        <AppPagination
          v-if="logs.length > 0"
          :page="pagination.page"
          :total-pages="pagination.totalPages"
          :total="pagination.total"
          :showing="logs.length"
          @update:page="changePage"
        />
      </div>

      <ConfirmDialog
        :show="deleteConfirm.show"
        :title="deleteConfirm.type === 'bulk' ? 'Delete Selected Logs' : 'Delete Log'"
        :message="deleteConfirm.type === 'bulk' ? `Delete ${selectedIds.size} selected log${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.` : 'Delete this log? This cannot be undone.'"
        confirmText="Delete"
        variant="danger"
        @confirm="deleteConfirm.type === 'bulk' ? confirmDeleteSelected() : confirmDeleteOne()"
        @cancel="deleteConfirm.show = false"
      />
    </div>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------
   PAGE LAYOUT
   ---------------------------------------------------------------- */
.reports-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ----------------------------------------------------------------
   STATS GRID — 4 across, 5th wraps
   ---------------------------------------------------------------- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ----------------------------------------------------------------
   FILTERS CARD
   ---------------------------------------------------------------- */
.filters-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filters-search-row {
  width: 100%;
}

.filters-search {
  width: 100%;
}

/* Make the search input slightly taller for prominence */
.filters-search :deep(.form-input) {
  height: 44px;
  font-size: 15px;
}

.filters-controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filters-selects {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.filters-select {
  width: 150px !important;
  flex-shrink: 0;
}

.filters-clear {
  flex-shrink: 0;
  margin-left: auto;
  white-space: nowrap;
  font-size: 13px;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.filters-clear:hover {
  opacity: 1;
}

@media (max-width: 900px) {
  .filters-controls-row {
    flex-wrap: wrap;
  }

  .filters-select {
    width: 130px !important;
  }
}

/* ----------------------------------------------------------------
   BULK ACTIONS BAR
   ---------------------------------------------------------------- */
.bulk-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-lg);
}

.bulk-actions-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.bulk-actions-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Transition */
.bulk-bar-enter-active {
  transition: all 0.2s ease;
}
.bulk-bar-leave-active {
  transition: all 0.15s ease;
}
.bulk-bar-enter-from,
.bulk-bar-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ----------------------------------------------------------------
   TABLE CONTAINER
   ---------------------------------------------------------------- */
.table-container {
  padding: 0;
  overflow: hidden;
}

/* ----------------------------------------------------------------
   TABLE OVERRIDES
   ---------------------------------------------------------------- */
.reports-table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
}

/* Header */
.reports-table thead th {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 2;
  white-space: nowrap;
  user-select: none;
}

/* Checkbox column */
.th-checkbox,
.td-checkbox {
  width: 48px;
  text-align: center;
  padding-left: 16px !important;
  padding-right: 4px !important;
}

/* Actions column */
.th-actions {
  width: 60px;
  text-align: center;
}

/* Rows */
.reports-table tbody td {
  font-size: 14px;
  color: var(--color-text-secondary);
  padding: 11px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  transition: background-color 0.12s ease;
}

/* Subtle alternating rows */
.reports-table tbody tr:nth-child(even) td {
  background: rgba(148, 163, 184, 0.02);
}

/* Hover */
.reports-table tbody tr:hover td {
  background: rgba(99, 102, 241, 0.06);
}

/* Selected row */
.table-row--selected td {
  background: rgba(99, 102, 241, 0.08) !important;
}

/* Last row no border */
.reports-table tbody tr:last-child td {
  border-bottom: none;
}

/* ----------------------------------------------------------------
   CUSTOM CHECKBOX
   ---------------------------------------------------------------- */
.table-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  width: 18px;
  height: 18px;
}

.table-checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.table-checkbox-mark {
  width: 16px;
  height: 16px;
  border: 1.5px solid rgba(148, 163, 184, 0.3);
  border-radius: 4px;
  background: var(--color-bg-secondary);
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.table-checkbox input:checked + .table-checkbox-mark {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.table-checkbox input:checked + .table-checkbox-mark::after {
  content: '';
  width: 4px;
  height: 7px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
  margin-top: -1px;
}

.table-checkbox:hover .table-checkbox-mark {
  border-color: var(--color-accent);
}

/* ----------------------------------------------------------------
   CELL STYLES
   ---------------------------------------------------------------- */

/* Email: monospace, truncate */
.td-email {
  font-family: var(--font-mono);
  font-size: 13px !important;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Subject: truncate */
.td-subject {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Meta columns (type, provider) */
.td-meta {
  font-size: 13px !important;
  color: var(--color-text-muted) !important;
}

/* Clicked column */
.td-clicked {
  text-align: center;
}

.clicked-icon {
  color: var(--color-accent);
}

.clicked-none {
  color: var(--color-text-muted);
  font-size: 13px;
}

/* Date column */
.td-date {
  font-family: var(--font-mono);
  font-size: 12px !important;
  color: var(--color-text-muted) !important;
  white-space: nowrap;
}

/* Actions column */
.td-actions {
  width: 60px;
  text-align: center;
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.table-row:hover .delete-btn {
  opacity: 0.6;
}

.delete-btn:hover {
  opacity: 1 !important;
  color: var(--color-danger);
  background: rgba(239, 68, 68, 0.1);
}
</style>
