<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import SearchInput from '../components/ui/SearchInput.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import SlidePanel from '../components/ui/SlidePanel.vue'
import { templatesApi } from '../lib/api'
import type { Template as TemplateType } from '../lib/api'
import { useToast } from '../composables/useToast'
import HtmlCodeEditor from '../components/compose/HtmlCodeEditor.vue'
import Modal from '../components/ui/Modal.vue'
import { FileText, Plus, Pencil, Trash2, Copy, Loader2, Inbox, Send } from 'lucide-vue-next'

const toast = useToast()

// ============================================================================
// State
// ============================================================================

const templates = ref<TemplateType[]>([])
const starters = ref<TemplateType[]>([])
const loading = ref(false)
const startersLoading = ref(false)
const activeCategory = ref('all')
const searchQuery = ref('')
const showEditor = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const previewHtml = ref('')
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })

const showTestSendModal = ref(false)
const testSendTemplateId = ref('')
const testSendForm = ref({ to: '', subject: '' })
const testSending = ref(false)

const categories = ['all', 'newsletter', 'promotional', 'welcome', 'follow-up', 'announcement', 'general']

const form = ref({
  name: '',
  description: '',
  category: 'general',
  subject: '',
  html_content: '',
})

// ============================================================================
// Computed
// ============================================================================

const filteredTemplates = computed(() => {
  let result = templates.value
  if (activeCategory.value !== 'all') {
    result = result.filter((t) => t.category === activeCategory.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    )
  }
  return result
})

// ============================================================================
// API
// ============================================================================

async function fetchTemplates() {
  loading.value = true
  try {
    const data = await templatesApi.list()
    templates.value = data.templates || []
  } catch (err: any) {
    toast.error(err.message || 'Failed to load templates')
  } finally {
    loading.value = false
  }
}

async function fetchStarters() {
  startersLoading.value = true
  try {
    starters.value = await templatesApi.getStarters()
  } catch {
    // Starters are optional, fail silently
  } finally {
    startersLoading.value = false
  }
}

async function saveTemplate() {
  saving.value = true
  try {
    if (editingId.value) {
      await templatesApi.update(editingId.value, form.value as any)
    } else {
      await templatesApi.create(form.value as any)
    }
    toast.success(editingId.value ? 'Template updated' : 'Template created')
    closeEditor()
    fetchTemplates()
  } catch (err: any) {
    toast.error(err.message || 'Failed to save')
  } finally {
    saving.value = false
  }
}

function promptDelete(id: string) {
  deleteConfirm.value = { show: true, id }
}

async function confirmDelete() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
  try {
    await templatesApi.delete(id)
    toast.success('Template deleted')
    fetchTemplates()
  } catch (err: any) {
    toast.error(err.message || 'Delete failed')
  }
}

async function duplicateTemplate(template: TemplateType) {
  try {
    await templatesApi.duplicate(template.id, `${template.name} (Copy)`)
    toast.success('Template duplicated')
    fetchTemplates()
  } catch (err: any) {
    toast.error(err.message || 'Duplicate failed')
  }
}

function openTestSend(tpl: TemplateType) {
  testSendTemplateId.value = tpl.id
  testSendForm.value = { to: '', subject: `[TEST] ${tpl.name}` }
  showTestSendModal.value = true
}

async function sendTestEmail() {
  testSending.value = true
  try {
    await templatesApi.testSend(testSendTemplateId.value, {
      to: testSendForm.value.to || undefined,
      subject: testSendForm.value.subject || undefined,
    })
    toast.success('Test email sent')
    showTestSendModal.value = false
  } catch (err: any) {
    toast.error(err.message || 'Failed to send test')
  } finally {
    testSending.value = false
  }
}

async function cloneStarter(starter: TemplateType) {
  try {
    await templatesApi.create({
      name: starter.name,
      description: starter.description || undefined,
      category: starter.category as any,
      subject: starter.subject || undefined,
      html_content: starter.html_content,
    })
    toast.success('Starter template cloned')
    fetchTemplates()
  } catch (err: any) {
    toast.error(err.message || 'Clone failed')
  }
}

async function updatePreview() {
  if (!form.value.html_content.trim()) {
    previewHtml.value = ''
    return
  }
  try {
    const data = await templatesApi.preview(form.value.html_content, {})
    previewHtml.value = data.html || form.value.html_content
  } catch {
    previewHtml.value = form.value.html_content
  }
}

// ============================================================================
// Editor
// ============================================================================

function openNewTemplate() {
  form.value = { name: '', description: '', category: 'general', subject: '', html_content: '' }
  editingId.value = null
  previewHtml.value = ''
  showEditor.value = true
}

function openEditTemplate(template: TemplateType) {
  form.value = {
    name: template.name,
    description: template.description || '',
    category: template.category,
    subject: template.subject || '',
    html_content: template.html_content,
  }
  editingId.value = template.id
  previewHtml.value = template.html_content
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
  editingId.value = null
  form.value = { name: '', description: '', category: 'general', subject: '', html_content: '' }
  previewHtml.value = ''
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function categoryLabel(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')
}

// Debounced preview update
let previewTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => form.value.html_content,
  () => {
    if (previewTimeout) clearTimeout(previewTimeout)
    previewTimeout = setTimeout(updatePreview, 600)
  }
)

// Initial fetch
fetchTemplates()
fetchStarters()
</script>

<template>
  <div>
    <PageHeader title="Templates" subtitle="Create and manage reusable email templates">
      <template #actions>
        <button class="btn-primary" @click="openNewTemplate"><Plus :size="16" /> New Template</button>
      </template>
    </PageHeader>

    <!-- Search + Filter -->
    <div class="flex flex-col gap-4 mb-6">
      <SearchInput v-model="searchQuery" placeholder="Search templates..." />
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="cat in categories"
          :key="cat"
          class="px-3.5 py-1.5 text-[13px] font-medium font-sans border rounded-lg cursor-pointer transition-all duration-150"
          :class="
            activeCategory === cat
              ? 'bg-accent text-white border-accent'
              : 'bg-transparent text-text-secondary border-border hover:border-text-muted hover:text-text-primary'
          "
          @click="activeCategory = cat"
        >
          {{ categoryLabel(cat) }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      <Skeleton variant="card" :count="6" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredTemplates.length === 0 && !loading" class="bg-bg-card border border-border rounded-xl">
      <EmptyState
        :icon="Inbox"
        title="No templates found"
        :description="searchQuery || activeCategory !== 'all' ? 'Try adjusting your filters' : 'Create your first template to get started'"
      >
        <template v-if="!searchQuery && activeCategory === 'all'" #actions>
          <button class="btn-primary" @click="openNewTemplate">
            <Plus :size="16" /> Create Template
          </button>
        </template>
      </EmptyState>
    </div>

    <!-- Template Grid -->
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-md:grid-cols-1 gap-4">
      <div
        v-for="tpl in filteredTemplates"
        :key="tpl.id"
        class="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-2 transition-all duration-150 hover:border-border-hover hover:shadow-sm"
      >
        <div class="flex justify-between items-center gap-3">
          <h3 class="text-sm font-semibold m-0 truncate text-text-primary">{{ tpl.name }}</h3>
          <span class="badge-info shrink-0">{{ categoryLabel(tpl.category) }}</span>
        </div>
        <p class="text-sm text-text-secondary m-0 truncate">{{ tpl.subject || 'No subject' }}</p>
        <p v-if="tpl.description" class="text-text-muted text-sm m-0 truncate">{{ tpl.description }}</p>
        <div class="flex justify-between items-center mt-auto pt-3 border-t border-border">
          <span class="text-text-muted text-[13px]">{{ formatDate(tpl.updated_at) }}</span>
          <div class="flex gap-0.5">
            <button class="btn-ghost text-sm px-2 py-1" title="Edit" @click="openEditTemplate(tpl)">
              <Pencil :size="14" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1" title="Duplicate" @click="duplicateTemplate(tpl)">
              <Copy :size="14" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1" title="Send Test" @click="openTestSend(tpl)">
              <Send :size="14" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1 text-danger" title="Delete" @click="promptDelete(tpl.id)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Starter Templates -->
    <section v-if="starters.length > 0" class="mt-8 mb-8">
      <div class="mb-4">
        <h2 class="flex items-center gap-2.5 text-base font-semibold text-text-primary mb-1">
          <FileText :size="18" class="text-accent" /> Starter Templates
        </h2>
        <p class="text-text-muted text-sm">Clone a pre-built template to get started quickly</p>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        <div v-for="s in starters" :key="s.id" class="bg-bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5">
          <div class="flex justify-between items-center gap-2">
            <h4 class="text-sm font-semibold m-0 truncate text-text-primary">{{ s.name }}</h4>
            <span class="badge-info shrink-0">{{ categoryLabel(s.category) }}</span>
          </div>
          <p class="text-text-muted text-sm">{{ s.description }}</p>
          <button class="btn-secondary text-sm px-3 py-1.5 self-start" @click="cloneStarter(s)"><Copy :size="14" /> Clone</button>
        </div>
      </div>
    </section>
    <ConfirmDialog
      :show="deleteConfirm.show"
      title="Delete Template"
      message="Delete this template? This cannot be undone."
      confirmText="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteConfirm.show = false"
    />

    <!-- Test Send Modal -->
    <Modal :show="showTestSendModal" title="Send Test Email" @close="showTestSendModal = false">
      <div class="flex flex-col gap-4">
        <div>
          <label class="form-label">Recipient Email</label>
          <input v-model="testSendForm.to" type="email" class="form-input" placeholder="Leave blank to send to yourself" />
        </div>
        <div>
          <label class="form-label">Subject Line</label>
          <input v-model="testSendForm.subject" type="text" class="form-input" />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button class="btn-ghost" @click="showTestSendModal = false">Cancel</button>
          <button class="btn-primary" @click="sendTestEmail" :disabled="testSending">
            <Loader2 v-if="testSending" :size="16" class="spin" />
            <Send v-else :size="16" />
            Send Test
          </button>
        </div>
      </div>
    </Modal>

    <!-- Editor Slide-out (full width) -->
  <SlidePanel :show="showEditor" :title="editingId ? 'Edit Template' : 'New Template'" size="xl" @close="closeEditor">
    <div class="flex flex-1 overflow-hidden max-md:flex-col -m-6 h-[calc(100%+48px)]">
      <!-- Left: Form + Monaco Editor -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Top fields row -->
        <div class="p-5 pb-0 shrink-0">
          <div class="grid grid-cols-[1fr_1fr_auto] max-md:grid-cols-1 gap-3 mb-3">
            <div>
              <label class="form-label">Name *</label>
              <input v-model="form.name" type="text" class="form-input" placeholder="Template name" required />
            </div>
            <div>
              <label class="form-label">Subject Line *</label>
              <input v-model="form.subject" type="text" class="form-input" placeholder="Email subject" required />
            </div>
            <div>
              <label class="form-label">Category</label>
              <select v-model="form.category" class="form-select">
                <option v-for="cat in categories.filter((c) => c !== 'all')" :key="cat" :value="cat">
                  {{ categoryLabel(cat) }}
                </option>
              </select>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Description</label>
            <input v-model="form.description" type="text" class="form-input" placeholder="Brief description (optional)" />
          </div>
        </div>

        <!-- Monaco HTML editor -->
        <div class="flex-1 px-5 pb-0 min-h-0">
          <label class="form-label mb-1.5">HTML Content</label>
          <HtmlCodeEditor
            :content="form.html_content"
            @update:content="form.html_content = $event"
            class="h-[calc(100%-28px)]!"
          />
        </div>

        <!-- Footer actions -->
        <div class="flex justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
          <button class="btn-ghost" @click="closeEditor">Cancel</button>
          <button class="btn-primary" @click="saveTemplate" :disabled="saving || !form.name || !form.subject">
            <Loader2 v-if="saving" :size="16" class="spin" />
            {{ editingId ? 'Update' : 'Create' }}
          </button>
        </div>
      </div>

      <!-- Right: Live Preview (auto-updates) -->
      <div class="w-[40%] max-md:w-full max-md:h-[300px] flex flex-col overflow-hidden border-l border-border">
        <div class="px-5 py-3 border-b border-border shrink-0">
          <span class="text-text-muted text-sm font-medium">Live Preview</span>
        </div>
        <div class="flex-1 overflow-hidden bg-white">
          <iframe
            v-if="previewHtml"
            :srcdoc="previewHtml"
            sandbox="allow-same-origin"
            class="w-full h-full border-none"
          ></iframe>
          <div v-else class="flex flex-col items-center justify-center h-full gap-3 bg-bg-secondary">
            <FileText :size="32" class="text-text-muted" />
            <p class="text-text-muted text-sm">Write HTML to see a live preview</p>
          </div>
        </div>
      </div>
    </div>
  </SlidePanel>
  </div>
</template>
