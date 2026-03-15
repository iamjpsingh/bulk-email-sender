<script setup lang="ts">
import { ref, computed } from 'vue'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import SlidePanel from '../components/ui/SlidePanel.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import Modal from '../components/ui/Modal.vue'
import AppTabs from '../components/ui/AppTabs.vue'
import { formsApi, contactsApi } from '../lib/api'
import type { FormEndpoint, FormAction, ContactList } from '../lib/api'
import { useToast } from '../composables/useToast'
import {
  Plus,
  Pencil,
  Trash2,
  Code2,
  Power,
  PowerOff,
  Inbox,
  Loader2,
  Copy,
  Check,
  ClipboardList,
} from 'lucide-vue-next'

const toast = useToast()

// ============================================================================
// State
// ============================================================================

const forms = ref<FormEndpoint[]>([])
const lists = ref<ContactList[]>([])
const loading = ref(false)
const showEditor = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })
const showEmbedModal = ref(false)
const embedCode = ref({ html: '', js: '', api: '' })
const embedCopied = ref(false)
const showSubmissions = ref(false)
const submissionsData = ref<{ submissions: any[]; total: number }>({ submissions: [], total: 0 })
const submissionsFormName = ref('')
const submissionsLoading = ref(false)
const activeTab = ref('settings')

const form = ref({
  name: '',
  list_id: '',
  field_mapping: {} as Record<string, string>,
  required_fields: ['email'] as string[],
  allowed_domains: [] as string[],
  redirect_url: '',
  actions: [] as FormAction[],
  double_optin: false,
  success_message: 'Thank you for subscribing!',
})

const fieldMappingEntries = ref<{ from: string; to: string }[]>([
  { from: 'email', to: 'email' },
  { from: 'name', to: 'first_name' },
])

const allowedDomainsText = ref('')

const editorTabs = [
  { key: 'settings', label: 'Settings' },
  { key: 'fields', label: 'Field Mapping' },
  { key: 'actions', label: 'Actions' },
  { key: 'advanced', label: 'Advanced' },
]

// ============================================================================
// API
// ============================================================================

async function fetchForms() {
  loading.value = true
  try {
    forms.value = await formsApi.list()
  } catch (err: any) {
    toast.error(err.message || 'Failed to load forms')
  } finally {
    loading.value = false
  }
}

async function fetchLists() {
  try {
    lists.value = await contactsApi.getLists()
  } catch {
    // non-critical
  }
}

async function saveForm() {
  saving.value = true
  try {
    // Build field mapping from entries
    const mapping: Record<string, string> = {}
    for (const entry of fieldMappingEntries.value) {
      if (entry.from.trim() && entry.to.trim()) {
        mapping[entry.from.trim()] = entry.to.trim()
      }
    }

    const payload = {
      name: form.value.name,
      list_id: form.value.list_id,
      field_mapping: mapping,
      required_fields: form.value.required_fields.filter(Boolean),
      allowed_domains: allowedDomainsText.value.split('\n').map(d => d.trim()).filter(Boolean),
      redirect_url: form.value.redirect_url || undefined,
      actions: form.value.actions,
      double_optin: form.value.double_optin,
      success_message: form.value.success_message,
    }

    if (editingId.value) {
      await formsApi.update(editingId.value, payload)
    } else {
      await formsApi.create(payload)
    }
    toast.success(editingId.value ? 'Form updated' : 'Form created')
    closeEditor()
    fetchForms()
  } catch (err: any) {
    toast.error(err.message || 'Failed to save form')
  } finally {
    saving.value = false
  }
}

async function toggleForm(f: FormEndpoint) {
  try {
    const newStatus = await formsApi.toggle(f.id)
    toast.success(`Form ${newStatus}`)
    fetchForms()
  } catch (err: any) {
    toast.error(err.message || 'Failed to toggle form')
  }
}

async function showEmbed(f: FormEndpoint) {
  try {
    embedCode.value = await formsApi.getEmbed(f.id)
    showEmbedModal.value = true
    embedCopied.value = false
  } catch (err: any) {
    toast.error(err.message || 'Failed to get embed code')
  }
}

async function viewSubmissions(f: FormEndpoint) {
  submissionsFormName.value = f.name
  submissionsLoading.value = true
  showSubmissions.value = true
  try {
    submissionsData.value = await formsApi.getSubmissions(f.id)
  } catch (err: any) {
    toast.error(err.message || 'Failed to load submissions')
  } finally {
    submissionsLoading.value = false
  }
}

function copyEmbed(text: string) {
  navigator.clipboard.writeText(text)
  embedCopied.value = true
  toast.success('Copied to clipboard')
  setTimeout(() => { embedCopied.value = false }, 2000)
}

async function confirmDelete() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
  try {
    await formsApi.delete(id)
    toast.success('Form deleted')
    fetchForms()
  } catch (err: any) {
    toast.error(err.message || 'Delete failed')
  }
}

// ============================================================================
// Editor
// ============================================================================

function openNewForm() {
  form.value = {
    name: '',
    list_id: lists.value[0]?.id || '',
    field_mapping: {},
    required_fields: ['email'],
    allowed_domains: [],
    redirect_url: '',
    actions: [],
    double_optin: false,
    success_message: 'Thank you for subscribing!',
  }
  fieldMappingEntries.value = [
    { from: 'email', to: 'email' },
    { from: 'name', to: 'first_name' },
  ]
  allowedDomainsText.value = ''
  editingId.value = null
  activeTab.value = 'settings'
  showEditor.value = true
}

function openEditForm(f: FormEndpoint) {
  form.value = {
    name: f.name,
    list_id: f.list_id,
    field_mapping: safeJson(f.field_mapping, {}),
    required_fields: safeJson(f.required_fields, ['email']),
    allowed_domains: safeJson(f.allowed_domains, []),
    redirect_url: f.redirect_url || '',
    actions: safeJson(f.actions, []),
    double_optin: !!f.double_optin,
    success_message: f.success_message || 'Thank you for subscribing!',
  }
  const mapping = safeJson(f.field_mapping, {})
  fieldMappingEntries.value = Object.entries(mapping).map(([from, to]) => ({ from, to: to as string }))
  if (fieldMappingEntries.value.length === 0) {
    fieldMappingEntries.value = [{ from: 'email', to: 'email' }]
  }
  allowedDomainsText.value = safeJson(f.allowed_domains, []).join('\n')
  editingId.value = f.id
  activeTab.value = 'settings'
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
  editingId.value = null
}

function addFieldMapping() {
  fieldMappingEntries.value.push({ from: '', to: '' })
}

function removeFieldMapping(index: number) {
  fieldMappingEntries.value.splice(index, 1)
}

function addAction() {
  form.value.actions.push({ type: 'add_tag', tag: '' })
}

function removeAction(index: number) {
  form.value.actions.splice(index, 1)
}

function safeJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function listName(listId: string): string {
  return lists.value.find(l => l.id === listId)?.name || listId
}

// Initial fetch
fetchForms()
fetchLists()
</script>

<template>
  <div>
    <PageHeader title="Forms" subtitle="Create form endpoints for lead capture on external websites">
      <template #actions>
        <button class="btn-primary" @click="openNewForm"><Plus :size="16" /> New Form</button>
      </template>
    </PageHeader>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
      <Skeleton variant="card" :count="4" />
    </div>

    <!-- Empty -->
    <div v-else-if="forms.length === 0" class="bg-bg-card border border-border rounded-xl">
      <EmptyState
        :icon="Inbox"
        title="No form endpoints"
        description="Create a form to start capturing leads from your website"
      >
        <template #actions>
          <button class="btn-primary" @click="openNewForm"><Plus :size="16" /> Create Form</button>
        </template>
      </EmptyState>
    </div>

    <!-- Forms Grid -->
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] max-md:grid-cols-1 gap-4">
      <div
        v-for="f in forms"
        :key="f.id"
        class="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-3 transition-all duration-150 hover:border-border-hover"
      >
        <div class="flex justify-between items-start gap-3">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-text-primary truncate m-0">{{ f.name }}</h3>
            <p class="text-xs text-text-muted mt-1 m-0">List: {{ listName(f.list_id) }}</p>
          </div>
          <span
            :class="[
              'shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded-full',
              f.status === 'active'
                ? 'bg-success/15 text-success'
                : 'bg-warning/15 text-warning'
            ]"
          >
            {{ f.status }}
          </span>
        </div>

        <div class="flex gap-4 text-xs text-text-secondary">
          <span>{{ f.submission_count }} submissions</span>
          <span>{{ formatDate(f.created_at) }}</span>
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-border mt-auto">
          <div class="flex gap-1">
            <button class="btn-ghost text-sm px-2 py-1" title="Edit" @click="openEditForm(f)">
              <Pencil :size="14" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1" title="Embed Code" @click="showEmbed(f)">
              <Code2 :size="14" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1" title="View Submissions" @click="viewSubmissions(f)">
              <ClipboardList :size="14" />
            </button>
            <button
              class="btn-ghost text-sm px-2 py-1"
              :title="f.status === 'active' ? 'Pause' : 'Activate'"
              @click="toggleForm(f)"
            >
              <PowerOff v-if="f.status === 'active'" :size="14" class="text-warning" />
              <Power v-else :size="14" class="text-success" />
            </button>
          </div>
          <button class="btn-ghost text-sm px-2 py-1 text-danger" title="Delete" @click="deleteConfirm = { show: true, id: f.id }">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :show="deleteConfirm.show"
      title="Delete Form"
      message="Delete this form endpoint? Existing embeds will stop working."
      confirmText="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteConfirm.show = false"
    />

    <!-- Editor Panel -->
  <SlidePanel :show="showEditor" :title="editingId ? 'Edit Form' : 'New Form'" size="lg" @close="closeEditor">
    <div class="flex flex-col gap-6">
      <AppTabs v-model="activeTab" :tabs="editorTabs" variant="pill" />

      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="flex flex-col gap-4">
        <div>
          <label class="form-label">Form Name *</label>
          <input v-model="form.name" type="text" class="form-input" placeholder="e.g. Newsletter Signup" />
        </div>
        <div>
          <label class="form-label">Target Contact List *</label>
          <select v-model="form.list_id" class="form-select">
            <option value="" disabled>Select a list</option>
            <option v-for="l in lists" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>
        <div>
          <label class="form-label">Success Message</label>
          <input v-model="form.success_message" type="text" class="form-input" placeholder="Thank you for subscribing!" />
        </div>
        <div>
          <label class="form-label">Redirect URL (optional)</label>
          <input v-model="form.redirect_url" type="url" class="form-input" placeholder="https://example.com/thank-you" />
        </div>
        <div class="flex items-center gap-3">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.double_optin" class="sr-only peer" />
            <div class="w-9 h-5 bg-surface-3 rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
          <span class="text-sm text-text-secondary">Require double opt-in</span>
        </div>
      </div>

      <!-- Field Mapping Tab -->
      <div v-if="activeTab === 'fields'" class="flex flex-col gap-4">
        <p class="text-sm text-text-muted m-0">Map form field names to contact fields. The form field name should match your HTML input name attribute.</p>
        <div v-for="(entry, i) in fieldMappingEntries" :key="i" class="flex gap-3 items-center">
          <input v-model="entry.from" class="form-input flex-1" placeholder="Form field (e.g. email)" />
          <span class="text-text-muted text-sm shrink-0">maps to</span>
          <select v-model="entry.to" class="form-select flex-1">
            <option value="email">email</option>
            <option value="first_name">first_name</option>
            <option value="last_name">last_name</option>
            <option value="company">company</option>
            <option value="phone">phone</option>
          </select>
          <button class="btn-ghost text-danger px-1.5 py-1" @click="removeFieldMapping(i)"><Trash2 :size="14" /></button>
        </div>
        <button class="btn-secondary self-start text-sm" @click="addFieldMapping"><Plus :size="14" /> Add Field</button>

        <div class="mt-2">
          <label class="form-label">Required Fields</label>
          <p class="text-xs text-text-muted mb-2 m-0">Comma-separated list of required form fields</p>
          <input
            :value="form.required_fields.join(', ')"
            @input="form.required_fields = ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean)"
            class="form-input"
            placeholder="email, name"
          />
        </div>
      </div>

      <!-- Actions Tab -->
      <div v-if="activeTab === 'actions'" class="flex flex-col gap-4">
        <p class="text-sm text-text-muted m-0">Actions to execute when a form is submitted.</p>
        <div v-for="(action, i) in form.actions" :key="i" class="flex gap-3 items-center bg-surface-2 rounded-lg p-3">
          <select v-model="action.type" class="form-select w-40 shrink-0">
            <option value="add_tag">Add Tag</option>
            <option value="enroll_automation">Enroll in Automation</option>
            <option value="send_email">Send Email</option>
            <option value="update_score">Update Score</option>
            <option value="webhook">Webhook</option>
          </select>
          <input
            v-if="action.type === 'add_tag'"
            v-model="action.tag"
            class="form-input flex-1"
            placeholder="Tag name"
          />
          <input
            v-if="action.type === 'webhook'"
            v-model="action.url"
            class="form-input flex-1"
            placeholder="Webhook URL"
          />
          <input
            v-if="action.type === 'update_score'"
            v-model.number="action.amount"
            type="number"
            class="form-input w-24"
            placeholder="+10"
          />
          <button class="btn-ghost text-danger px-1.5 py-1 shrink-0" @click="removeAction(i)"><Trash2 :size="14" /></button>
        </div>
        <button class="btn-secondary self-start text-sm" @click="addAction"><Plus :size="14" /> Add Action</button>
      </div>

      <!-- Advanced Tab -->
      <div v-if="activeTab === 'advanced'" class="flex flex-col gap-4">
        <div>
          <label class="form-label">Allowed Domains</label>
          <p class="text-xs text-text-muted mb-2 m-0">One domain per line. Leave empty to allow any domain.</p>
          <textarea v-model="allowedDomainsText" class="form-input" rows="4" placeholder="https://example.com&#10;https://blog.example.com"></textarea>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn-ghost" @click="closeEditor">Cancel</button>
      <button class="btn-primary" @click="saveForm" :disabled="saving || !form.name || !form.list_id">
        <Loader2 v-if="saving" :size="16" class="spin" />
        {{ editingId ? 'Update' : 'Create' }}
      </button>
    </template>
  </SlidePanel>

  <!-- Embed Code Modal -->
  <Modal :show="showEmbedModal" title="Embed Code" size="lg" @close="showEmbedModal = false">
    <div class="flex flex-col gap-5">
      <div>
        <h4 class="text-sm font-semibold text-text-primary mb-2">HTML Embed</h4>
        <div class="relative">
          <pre class="bg-surface-3 rounded-lg p-4 text-xs text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap">{{ embedCode.html }}</pre>
          <button
            class="absolute top-2 right-2 btn-ghost text-xs px-2 py-1"
            @click="copyEmbed(embedCode.html)"
          >
            <Check v-if="embedCopied" :size="12" class="text-success" />
            <Copy v-else :size="12" />
          </button>
        </div>
      </div>
      <div>
        <h4 class="text-sm font-semibold text-text-primary mb-2">JavaScript Widget</h4>
        <div class="relative">
          <pre class="bg-surface-3 rounded-lg p-4 text-xs text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap">{{ embedCode.js }}</pre>
          <button class="absolute top-2 right-2 btn-ghost text-xs px-2 py-1" @click="copyEmbed(embedCode.js)">
            <Copy :size="12" />
          </button>
        </div>
      </div>
      <div v-if="embedCode.api">
        <h4 class="text-sm font-semibold text-text-primary mb-2">API Example</h4>
        <div class="relative">
          <pre class="bg-surface-3 rounded-lg p-4 text-xs text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap">{{ embedCode.api }}</pre>
          <button class="absolute top-2 right-2 btn-ghost text-xs px-2 py-1" @click="copyEmbed(embedCode.api)">
            <Copy :size="12" />
          </button>
        </div>
      </div>
    </div>
  </Modal>

  <!-- Submissions Modal -->
  <Modal :show="showSubmissions" :title="`Submissions - ${submissionsFormName}`" size="lg" @close="showSubmissions = false">
    <div v-if="submissionsLoading" class="flex justify-center py-12">
      <Loader2 :size="24" class="spin text-accent" />
    </div>
    <div v-else-if="submissionsData.submissions.length === 0" class="py-12 text-center text-text-muted text-sm">
      No submissions yet
    </div>
    <div v-else class="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
      <div
        v-for="sub in submissionsData.submissions"
        :key="sub.id"
        class="bg-surface-2 rounded-lg p-4 text-sm"
      >
        <div class="flex justify-between items-center mb-2">
          <span class="text-text-muted text-xs">{{ formatDate(sub.created_at) }}</span>
          <span v-if="sub.ip_address" class="text-text-muted text-xs">{{ sub.ip_address }}</span>
        </div>
        <pre class="text-text-secondary text-xs whitespace-pre-wrap m-0">{{ JSON.stringify(JSON.parse(sub.data || '{}'), null, 2) }}</pre>
      </div>
    </div>
  </Modal>
  </div>
</template>
