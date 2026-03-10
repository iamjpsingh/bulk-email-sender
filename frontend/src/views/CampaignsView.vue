<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import MainLayout from '../components/layout/MainLayout.vue'
import { campaignsApi, templatesApi, contactsApi } from '../lib/api'
import type { Campaign as CampaignType } from '../lib/api'
import { useToast } from '../composables/useToast'
import {
  Mail,
  Users,
  Send,
  Plus,
  Pencil,
  Copy,
  Pause,
  X,
  Archive,
  Trash2,
  Search,
  Loader2,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Eye,
  MousePointer,
  Clock,
  Rocket,
} from 'lucide-vue-next'
const toast = useToast()
// ============================================================================
// Types
// ============================================================================
interface CampaignForm {
  name: string
  type: string
  subject: string
  from_name: string
  from_email: string
  reply_to: string
  template_id: string
  contact_list_id: string
  batch_size: number
  email_delay: number
  batch_delay: number
}
// ============================================================================
// State
// ============================================================================
const campaigns = ref<CampaignType[]>([])
const loading = ref(false)
const error = ref('')
const statusFilter = ref('all')
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const limit = 20
const showCreateModal = ref(false)
const saving = ref(false)
const actionLoading = ref<string | null>(null)
const form = ref<CampaignForm>({
  name: '',
  type: 'one_time',
  subject: '',
  from_name: '',
  from_email: '',
  reply_to: '',
  template_id: '',
  contact_list_id: '',
  batch_size: 50,
  email_delay: 1000,
  batch_delay: 5000,
})
const templates = ref<{ id: string; name: string }[]>([])
const contactLists = ref<{ id: string; name: string; contact_count: number }[]>([])
const statusTabs = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sending', label: 'Sending' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]
// ============================================================================
// Data Loading
// ============================================================================
async function fetchCampaigns() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { page: currentPage.value, limit }
    if (statusFilter.value !== 'all') params.status = statusFilter.value
    if (searchQuery.value) params.search = searchQuery.value
    const data = await campaignsApi.list(params)
    campaigns.value = data.campaigns || []
    totalPages.value = data.pagination?.totalPages || 1
    totalCount.value = data.pagination?.total || campaigns.value.length
  } catch (err: any) {
    error.value = err.message
    campaigns.value = []
  } finally {
    loading.value = false
  }
}
async function loadFormData() {
  try {
    const [tplRes, listRes] = await Promise.all([
      templatesApi.list().catch(() => ({ templates: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })),
      contactsApi.getLists().catch(() => []),
    ])
    templates.value = (tplRes as any).templates || []
    contactLists.value = Array.isArray(listRes) ? listRes : []
  } catch {
    /* silently ignore - dropdowns will be empty */
  }
}
// ============================================================================
// Actions
// ============================================================================
async function createCampaign() {
  saving.value = true
  try {
    await campaignsApi.create(form.value as any)
    showCreateModal.value = false
    resetForm()
    await fetchCampaigns()
  } catch (err: any) {
    toast.error(`Failed to create campaign: ${err.message}`)
  } finally {
    saving.value = false
  }
}
function setStatusFilter(value: string) {
  statusFilter.value = value
  currentPage.value = 1
}

async function campaignAction(id: string, action: string) {
  actionLoading.value = `${id}-${action}`
  try {
    const actionMap: Record<string, (id: string) => Promise<any>> = {
      launch: campaignsApi.launch,
      pause: campaignsApi.pause,
      cancel: campaignsApi.cancel,
      clone: campaignsApi.clone,
      archive: campaignsApi.archive,
    }
    const fn = actionMap[action]
    if (fn) {
      await fn(id)
    }
    await fetchCampaigns()
  } catch (err: any) {
    toast.error(`Failed to ${action} campaign: ${err.message}`)
  } finally {
    actionLoading.value = null
  }
}
async function deleteCampaign(id: string) {
  if (!confirm('Are you sure you want to delete this campaign?')) return
  actionLoading.value = `${id}-delete`
  try {
    await campaignsApi.delete(id)
    await fetchCampaigns()
  } catch (err: any) {
    toast.error(`Failed to delete campaign: ${err.message}`)
  } finally {
    actionLoading.value = null
  }
}
function resetForm() {
  form.value = {
    name: '',
    type: 'one_time',
    subject: '',
    from_name: '',
    from_email: '',
    reply_to: '',
    template_id: '',
    contact_list_id: '',
    batch_size: 50,
    email_delay: 1000,
    batch_delay: 5000,
  }
}
function openCreateModal() {
  resetForm()
  loadFormData()
  showCreateModal.value = true
}
// ============================================================================
// Helpers
// ============================================================================
function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    draft: 'badge-muted',
    scheduled: 'badge-warning',
    sending: 'badge-info',
    completed: 'badge-success',
    cancelled: 'badge-danger',
    archived: 'badge-muted',
  }
  return map[status] || 'badge-muted'
}
function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function pct(value: number, total: number): string {
  if (!total) return '0'
  return Math.round((value / total) * 100).toString()
}
function isActionLoading(id: string, action: string): boolean {
  return actionLoading.value === `${id}-${action}`
}
function changePage(p: number) {
  currentPage.value = p
}
// ============================================================================
// Watchers & Init
// ============================================================================
watch([statusFilter, currentPage], () => fetchCampaigns())
watch(searchQuery, () => {
  currentPage.value = 1
  fetchCampaigns()
})
onMounted(() => fetchCampaigns())
</script>
<template>
  <MainLayout>
    <header class="flex justify-between items-center mb-7">
      <div>
        <h1 class="text-[28px] font-bold mb-1">Campaigns</h1>
        <p class="text-text-muted text-sm">Create and manage email campaigns</p>
      </div>
      <button class="btn btn-primary" @click="openCreateModal"><Plus :size="16" /> New Campaign</button>
    </header>
    <!-- Status Tabs -->
    <div class="flex items-center gap-1 mb-6 pb-3 border-b border-border flex-wrap">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        class="px-4 py-2 border-none rounded-[--radius-md] text-[13px] font-medium cursor-pointer transition-all duration-200"
        :class="
          statusFilter === tab.value
            ? 'bg-accent text-bg-primary font-semibold'
            : 'bg-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary'
        "
        @click="setStatusFilter(tab.value)"
      >
        {{ tab.label }}
      </button>
      <div class="ml-auto relative">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          v-model="searchQuery"
          type="text"
          class="form-input pl-9 w-[220px] h-9 text-[13px]"
          placeholder="Search campaigns..."
        />
      </div>
    </div>
    <!-- Loading / Empty / Error -->
    <div v-if="loading" class="text-center py-[60px] px-5 text-text-muted flex flex-col items-center gap-3">
      <Loader2 :size="24" class="spin" /> Loading campaigns...
    </div>
    <div v-else-if="error" class="text-center py-[60px] px-5 text-danger flex flex-col items-center gap-3">
      {{ error }}
    </div>
    <div
      v-else-if="campaigns.length === 0"
      class="text-center py-[60px] px-5 text-text-muted flex flex-col items-center gap-3"
    >
      <Inbox :size="48" class="opacity-40" />
      <p>No campaigns found</p>
      <p class="text-text-muted text-sm">Create your first campaign to get started</p>
    </div>
    <!-- Campaign Cards -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="c in campaigns"
        :key="c.id"
        class="p-5 bg-bg-card border border-border rounded-[--radius-lg] transition-colors duration-200 hover:border-accent"
      >
        <!-- Header row -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-3">
            <router-link
              :to="`/campaigns/${c.id}`"
              class="text-base font-semibold text-text-primary m-0 no-underline hover:text-accent transition-colors"
              >{{ c.name }}</router-link
            >
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[11px] font-semibold capitalize tracking-[0.3px]"
              :class="statusBadgeClass(c.status)"
              >{{ c.status }}</span
            >
          </div>
          <div class="flex gap-1">
            <button
              class="btn-ghost px-2 py-1 text-xs"
              title="Edit"
              :disabled="!!actionLoading"
              @click="campaignAction(c.id, 'edit')"
            >
              <Pencil :size="14" />
            </button>
            <button
              class="btn-ghost px-2 py-1 text-xs"
              title="Clone"
              :disabled="!!actionLoading"
              @click="campaignAction(c.id, 'clone')"
            >
              <Loader2 v-if="isActionLoading(c.id, 'clone')" :size="14" class="spin" /><Copy v-else :size="14" />
            </button>
            <button
              v-if="c.status === 'draft' || c.status === 'scheduled'"
              class="btn-ghost px-2 py-1 text-xs"
              title="Launch"
              :disabled="!!actionLoading"
              @click="campaignAction(c.id, 'launch')"
            >
              <Loader2 v-if="isActionLoading(c.id, 'launch')" :size="14" class="spin" /><Rocket v-else :size="14" />
            </button>
            <button
              v-if="c.status === 'sending'"
              class="btn-ghost px-2 py-1 text-xs"
              title="Pause"
              :disabled="!!actionLoading"
              @click="campaignAction(c.id, 'pause')"
            >
              <Loader2 v-if="isActionLoading(c.id, 'pause')" :size="14" class="spin" /><Pause v-else :size="14" />
            </button>
            <button
              v-if="c.status === 'sending' || c.status === 'scheduled'"
              class="btn-ghost px-2 py-1 text-xs"
              title="Cancel"
              :disabled="!!actionLoading"
              @click="campaignAction(c.id, 'cancel')"
            >
              <Loader2 v-if="isActionLoading(c.id, 'cancel')" :size="14" class="spin" /><X v-else :size="14" />
            </button>
            <button
              v-if="c.status === 'completed' || c.status === 'cancelled'"
              class="btn-ghost px-2 py-1 text-xs"
              title="Archive"
              :disabled="!!actionLoading"
              @click="campaignAction(c.id, 'archive')"
            >
              <Archive :size="14" />
            </button>
            <button
              class="btn-ghost px-2 py-1 text-xs opacity-50 transition-opacity duration-200 hover:opacity-100 hover:text-danger"
              title="Delete"
              :disabled="!!actionLoading"
              @click="deleteCampaign(c.id)"
            >
              <Loader2 v-if="isActionLoading(c.id, 'delete')" :size="14" class="spin" /><Trash2 v-else :size="14" />
            </button>
          </div>
        </div>
        <!-- Meta row -->
        <div class="flex flex-wrap gap-4 mb-3.5 text-[13px] text-text-secondary">
          <span class="inline-flex items-center gap-1.5"><Mail :size="14" /> {{ c.subject || 'No subject' }}</span>
          <span class="inline-flex items-center gap-1.5"><Users :size="14" /> {{ c.total_recipients }} recipients</span>
          <span class="inline-flex items-center gap-1.5"><Clock :size="14" /> {{ formatDate(c.created_at) }}</span>
          <span v-if="c.scheduled_at" class="inline-flex items-center gap-1.5 text-warning"
            ><Clock :size="14" /> Scheduled: {{ formatDate(c.scheduled_at) }}</span
          >
        </div>
        <!-- Stats bar -->
        <div
          v-if="c.sent_count > 0 || c.status !== 'draft'"
          class="flex items-center gap-5 pt-3 border-t border-border text-[13px] flex-wrap"
        >
          <div class="inline-flex items-center gap-1 text-text-secondary">
            <Send :size="13" />
            <span class="font-semibold text-text-primary">{{ c.sent_count }}</span>
            <span class="text-text-muted">sent</span>
            <span v-if="c.total_recipients" class="text-text-muted text-xs"
              >({{ pct(c.sent_count, c.total_recipients) }}%)</span
            >
          </div>
          <div class="inline-flex items-center gap-1 text-blue-500">
            <Eye :size="13" />
            <span class="font-semibold text-blue-500">{{ c.open_count }}</span>
            <span class="text-text-muted">opened</span>
            <span v-if="c.sent_count" class="text-text-muted text-xs">({{ pct(c.open_count, c.sent_count) }}%)</span>
          </div>
          <div class="inline-flex items-center gap-1 text-accent">
            <MousePointer :size="13" />
            <span class="font-semibold text-accent">{{ c.click_count }}</span>
            <span class="text-text-muted">clicked</span>
            <span v-if="c.sent_count" class="text-text-muted text-xs">({{ pct(c.click_count, c.sent_count) }}%)</span>
          </div>
          <div v-if="c.total_recipients" class="flex-1 min-w-[80px] h-1 bg-bg-secondary rounded-sm overflow-hidden">
            <div
              class="h-full rounded-sm transition-[width] duration-300 ease-in-out progress-fill"
              :style="{ width: pct(c.sent_count, c.total_recipients) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-4 pt-6">
      <button class="btn btn-ghost text-sm" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">
        <ChevronLeft :size="16" /> Prev
      </button>
      <span class="text-[13px] text-text-muted"
        >Page {{ currentPage }} of {{ totalPages }} ({{ totalCount }} total)</span
      >
      <button class="btn btn-ghost text-sm" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">
        Next <ChevronRight :size="16" />
      </button>
    </div>
  </MainLayout>
  <!-- Create Campaign Modal -->
  <Teleport to="body">
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-5"
      @click.self="showCreateModal = false"
    >
      <div
        class="bg-bg-card border border-border rounded-[--radius-lg] w-full max-w-[640px] max-h-[90vh] overflow-y-auto"
      >
        <div class="flex justify-between items-center px-6 py-5 border-b border-border">
          <h2 class="text-lg font-semibold m-0">New Campaign</h2>
          <button class="btn-ghost px-2 py-1 text-xs" @click="showCreateModal = false"><X :size="18" /></button>
        </div>
        <form class="p-6" @submit.prevent="createCampaign">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5 col-span-2">
              <label class="text-[13px] font-medium text-text-secondary">Campaign Name *</label>
              <input v-model="form.name" type="text" class="form-input" required placeholder="e.g. March Newsletter" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[13px] font-medium text-text-secondary">Type</label>
              <select v-model="form.type" class="form-select">
                <option value="one_time">One-time</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[13px] font-medium text-text-secondary">Subject *</label>
              <input v-model="form.subject" type="text" class="form-input" required placeholder="Email subject line" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[13px] font-medium text-text-secondary">From Name</label>
              <input v-model="form.from_name" type="text" class="form-input" placeholder="Sender name" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[13px] font-medium text-text-secondary">From Email *</label>
              <input
                v-model="form.from_email"
                type="email"
                class="form-input"
                required
                placeholder="sender@example.com"
              />
            </div>
            <div class="flex flex-col gap-1.5 col-span-2">
              <label class="text-[13px] font-medium text-text-secondary">Reply-To</label>
              <input
                v-model="form.reply_to"
                type="email"
                class="form-input"
                placeholder="reply@example.com (optional)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[13px] font-medium text-text-secondary">Template</label>
              <select v-model="form.template_id" class="form-select">
                <option value="">-- No template --</option>
                <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[13px] font-medium text-text-secondary">Contact List</label>
              <select v-model="form.contact_list_id" class="form-select">
                <option value="">-- Select list --</option>
                <option v-for="l in contactLists" :key="l.id" :value="l.id">
                  {{ l.name }} ({{ l.contact_count }})
                </option>
              </select>
            </div>
          </div>
          <fieldset class="border border-border rounded-[--radius-md] p-4 mt-4">
            <legend class="text-[13px] font-semibold text-text-secondary px-2">Batch Settings</legend>
            <div class="grid grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-text-secondary">Batch Size</label>
                <input v-model.number="form.batch_size" type="number" class="form-input" min="1" max="500" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-text-secondary">Email Delay (ms)</label>
                <input v-model.number="form.email_delay" type="number" class="form-input" min="0" step="100" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-text-secondary">Batch Delay (ms)</label>
                <input v-model.number="form.batch_delay" type="number" class="form-input" min="0" step="1000" />
              </div>
            </div>
          </fieldset>
          <div class="flex justify-end gap-3 pt-5 border-t border-border mt-5">
            <button type="button" class="btn btn-ghost" @click="showCreateModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <Loader2 v-if="saving" :size="16" class="spin" /> {{ saving ? 'Creating...' : 'Create Campaign' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.badge-muted {
  background: rgba(148, 163, 184, 0.15);
  color: var(--color-text-muted);
}
.progress-fill {
  background: linear-gradient(90deg, var(--color-accent), var(--color-success));
}
</style>
