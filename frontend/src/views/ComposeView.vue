<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfigs } from '../lib/query'
import { emailApi, templatesApi } from '../lib/api'
import type { Template } from '../lib/api'
import { useToast } from '../composables/useToast'
import { parseExcelFile, getContactEmail, getContactName, replacePlaceholders } from '../lib/excelParser'
import EmailEditor from '../components/compose/EmailEditor.vue'
import RecipientUpload from '../components/compose/RecipientUpload.vue'
import SendOptions from '../components/compose/SendOptions.vue'
import EmailPreviewModal from '../components/compose/EmailPreviewModal.vue'
import MainLayout from '../components/layout/MainLayout.vue'
import {
  Send,
  Calendar,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Users,
  Settings,
  FileText,
  Eye,
  Code,
  LayoutTemplate,
} from 'lucide-vue-next'
import HtmlCodeEditor from '../components/compose/HtmlCodeEditor.vue'

const toast = useToast()

// TanStack Query for configs
const { data: configsData } = useConfigs()
const smtpConfigs = computed(() => configsData.value || [])

// Form data
const subject = ref('')
const htmlContent = ref('')
const excelFile = ref<File | null>(null)
const contacts = ref<any[]>([])
const columns = ref<string[]>([])
const delay = ref(20)

// SMTP Config
const selectedConfigId = ref('')

// Batch settings
const useBatch = ref(false)
const batchSize = ref(20)
const batchDelay = ref(60)
const emailDelay = ref(45)

// Schedule settings
const useSchedule = ref(false)
const scheduledTime = ref('')
const notifyEmail = ref('')

// Range settings
const rangeType = ref<'all' | 'first' | 'range'>('all')
const firstN = ref(50)
const rangeFrom = ref(1)
const rangeTo = ref(100)

const sending = ref(false)
const result = ref<any>(null)

// Preview state
const showPreview = ref(false)
const previewContactIndex = ref(0)

// Template state
const templates = ref<Template[]>([])
const selectedTemplateId = ref('')
const loadingTemplates = ref(false)
const loadingTemplate = ref(false)
const editorMode = ref<'preview' | 'rich' | 'html'>('rich')

async function fetchTemplates() {
  loadingTemplates.value = true
  try {
    const res = await templatesApi.list()
    templates.value = res.templates || []
  } catch (err: any) {
    toast.error(err.message || 'Failed to load templates')
  } finally {
    loadingTemplates.value = false
  }
}

async function applyTemplate(templateId: string) {
  if (!templateId) return
  loadingTemplate.value = true
  try {
    const tpl = await templatesApi.get(templateId)
    htmlContent.value = tpl.html_content || ''
    if (tpl.subject && !subject.value) {
      subject.value = tpl.subject
    }
    toast.success(`Template "${tpl.name}" applied`)
  } catch (err: any) {
    toast.error(err.message || 'Failed to load template')
    selectedTemplateId.value = ''
  } finally {
    loadingTemplate.value = false
  }
}

watch(selectedTemplateId, (id) => {
  if (id) {
    applyTemplate(id)
    editorMode.value = 'preview'
  } else {
    editorMode.value = 'rich'
  }
})

// Inline template preview with placeholder substitution
const templatePreviewHtml = computed(() => {
  if (!htmlContent.value) return ''
  return replacePlaceholders(htmlContent.value, previewContact.value)
})

// Get preview contact (first contact or sample)
const previewContact = computed(() => {
  if (contacts.value.length > 0) {
    return contacts.value[previewContactIndex.value] || contacts.value[0]
  }
  return {
    Email: 'john@example.com',
    FirstName: 'John',
    LastName: 'Doe',
    Company: 'Acme Inc',
    Name: 'John Doe',
  }
})

const previewToEmail = computed(() => getContactEmail(previewContact.value))
const previewToName = computed(() => getContactName(previewContact.value))
const previewSubject = computed(() => replacePlaceholders(subject.value, previewContact.value))
const previewContent = computed(() => replacePlaceholders(htmlContent.value, previewContact.value))

const previewFromName = computed(() => {
  const cfg = smtpConfigs.value.find((c) => c.id === selectedConfigId.value)
  return cfg?.from_name || cfg?.name || 'Your Name'
})
const previewFromEmail = computed(() => {
  const cfg = smtpConfigs.value.find((c) => c.id === selectedConfigId.value)
  return cfg?.from_email || cfg?.oauth_email || 'you@example.com'
})

function nextPreviewContact() {
  if (contacts.value.length > 0) {
    previewContactIndex.value = (previewContactIndex.value + 1) % contacts.value.length
  }
}

function prevPreviewContact() {
  if (contacts.value.length > 0) {
    previewContactIndex.value =
      previewContactIndex.value === 0 ? contacts.value.length - 1 : previewContactIndex.value - 1
  }
}

const selectedCount = computed(() => {
  if (contacts.value.length === 0) return 0
  if (rangeType.value === 'all') return contacts.value.length
  if (rangeType.value === 'first') return Math.min(firstN.value, contacts.value.length)
  return Math.min(rangeTo.value - rangeFrom.value + 1, contacts.value.length)
})

const canSend = computed(() => {
  return selectedConfigId.value && subject.value.trim() && contacts.value.length > 0 && htmlContent.value.trim()
})

async function handleFileSelected(file: File) {
  excelFile.value = file
  const parsed = await parseExcelFile(file)
  contacts.value = parsed.contacts
  columns.value = parsed.columns
}

async function handleSend() {
  if (!canSend.value) return

  sending.value = true
  result.value = null

  const formData = new FormData()
  const config = smtpConfigs.value.find((c) => c.id === selectedConfigId.value)
  if (!config) {
    toast.error('No SMTP config selected')
    sending.value = false
    return
  }

  formData.set('configId', config.id)
  formData.set('subject', subject.value)
  formData.set('htmlContent', htmlContent.value)
  formData.set('delay', delay.value.toString())

  if (excelFile.value) {
    formData.set('excelFile', excelFile.value)
  }

  // Range
  let start = 0
  let count = contacts.value.length
  if (rangeType.value === 'first') {
    count = Math.min(firstN.value, contacts.value.length)
  } else if (rangeType.value === 'range') {
    start = rangeFrom.value - 1
    count = Math.min(rangeTo.value - rangeFrom.value + 1, contacts.value.length - start)
  }
  formData.set('emailRangeStart', start.toString())
  formData.set('emailRangeCount', count.toString())

  // Batch settings
  if (useBatch.value) {
    formData.set('useBatch', 'on')
    formData.set('batchSize', batchSize.value.toString())
    formData.set('batchDelay', batchDelay.value.toString())
    formData.set('emailDelay', emailDelay.value.toString())
  }

  // Schedule settings
  if (useSchedule.value && scheduledTime.value) {
    const utcTime = new Date(scheduledTime.value).toISOString()
    formData.set('scheduleEmail', 'on')
    formData.set('scheduledTime', utcTime)
    if (notifyEmail.value) {
      formData.set('notifyEmail', notifyEmail.value)
    }
  }

  try {
    const response = await emailApi.send(formData)
    result.value = response
    if (response.success) {
      toast.success(response.message || 'Emails sent successfully!')
    } else {
      toast.error(response.message || 'Failed to send emails')
    }
  } catch (err: any) {
    result.value = { success: false, message: err.message || 'Failed to send emails' }
    toast.error(err.message || 'Failed to send emails')
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  fetchTemplates()
})
</script>

<template>
  <MainLayout>
    <header class="mb-8">
      <div>
        <h1 class="text-[28px] font-bold mb-1">Compose Campaign</h1>
        <p class="text-text-muted text-sm">Create and send bulk email campaigns</p>
      </div>
      <!-- Progress steps -->
      <div class="flex items-center gap-2 mt-5">
        <div class="flex items-center gap-2 text-sm" :class="selectedConfigId ? 'text-success' : 'text-text-muted'">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-200"
            :class="selectedConfigId ? 'bg-success/15 border-success text-success' : 'border-border text-text-muted'"
          >
            1
          </div>
          <span class="hidden sm:inline">Config</span>
        </div>
        <div class="w-6 h-px bg-border"></div>
        <div class="flex items-center gap-2 text-sm" :class="contacts.length > 0 ? 'text-success' : 'text-text-muted'">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-200"
            :class="contacts.length > 0 ? 'bg-success/15 border-success text-success' : 'border-border text-text-muted'"
          >
            2
          </div>
          <span class="hidden sm:inline">Contacts</span>
        </div>
        <div class="w-6 h-px bg-border"></div>
        <div
          class="flex items-center gap-2 text-sm"
          :class="subject.trim() && htmlContent.trim() ? 'text-success' : 'text-text-muted'"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-200"
            :class="
              subject.trim() && htmlContent.trim()
                ? 'bg-success/15 border-success text-success'
                : 'border-border text-text-muted'
            "
          >
            3
          </div>
          <span class="hidden sm:inline">Content</span>
        </div>
        <div class="w-6 h-px bg-border"></div>
        <div class="flex items-center gap-2 text-sm" :class="canSend ? 'text-accent' : 'text-text-muted'">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-200"
            :class="canSend ? 'bg-accent/15 border-accent text-accent' : 'border-border text-text-muted'"
          >
            4
          </div>
          <span class="hidden sm:inline">Send</span>
        </div>
      </div>
    </header>

    <!-- Result message -->
    <div
      v-if="result"
      class="flex items-center gap-4 px-5 py-4 rounded-[var(--radius-md)] mb-6"
      :class="
        result.success
          ? 'bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] text-success'
          : 'bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-danger'
      "
    >
      <CheckCircle v-if="result.success" :size="24" />
      <XCircle v-else :size="24" />
      <div class="flex-1">
        <strong class="block mb-1">{{ result.success ? 'Success!' : 'Error' }}</strong>
        <p class="text-sm opacity-80 m-0">{{ result.message }}</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="result = null">
        <X :size="16" />
      </button>
    </div>

    <div class="grid grid-cols-[400px_1fr] gap-6 max-lg:grid-cols-1">
      <!-- Left column -->
      <div class="flex flex-col gap-5">
        <!-- Email Config selector -->
        <div class="glass-card p-5">
          <h3 class="text-[15px] mb-4 flex items-center gap-2">
            <Settings :size="18" class="text-accent" />
            Email Configuration
          </h3>
          <select v-model="selectedConfigId" class="form-select">
            <option value="">Select config...</option>
            <option v-for="config in smtpConfigs" :key="config.id" :value="config.id">
              {{ config.name }}
              <template v-if="config.provider_type === 'google'">(Gmail)</template>
              <template v-else-if="config.provider_type === 'microsoft'">(Outlook)</template>
              <template v-else>({{ config.host }})</template>
            </option>
          </select>
          <p v-if="smtpConfigs.length === 0" class="text-text-muted text-[13px] mt-2">
            No configs found. <router-link to="/configs" class="text-accent">Create one</router-link>
          </p>
        </div>

        <!-- File upload (extracted component) -->
        <RecipientUpload :contacts="contacts" :columns="columns" @file-selected="handleFileSelected" />

        <!-- Template selector -->
        <div class="glass-card p-5">
          <h3 class="text-[15px] mb-4 flex items-center gap-2">
            <FileText :size="18" class="text-accent" />
            Use Template
          </h3>
          <select v-model="selectedTemplateId" class="form-select" :disabled="loadingTemplates">
            <option value="">{{ loadingTemplates ? 'Loading...' : 'Select a template...' }}</option>
            <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">
              {{ tpl.name }}
              <template v-if="tpl.category !== 'general'"> ({{ tpl.category }})</template>
            </option>
          </select>
          <p v-if="templates.length === 0 && !loadingTemplates" class="text-text-muted text-[13px] mt-2">
            No templates found. Create one in Templates.
          </p>
          <p v-if="loadingTemplate" class="text-text-muted text-[13px] mt-2 flex items-center gap-1">
            <Loader2 :size="12" class="animate-spin" /> Applying template...
          </p>
          <!-- Inline preview -->
          <div v-if="selectedTemplateId && htmlContent && !loadingTemplate" class="mt-3">
            <p class="text-text-muted text-[12px] mb-1.5">
              Preview ({{ contacts.length > 0 ? 'using first contact' : 'sample data' }}):
            </p>
            <div
              class="template-inline-preview rounded-[var(--radius-sm)] border border-border bg-white overflow-hidden max-h-[180px] overflow-y-auto"
            >
              <div class="p-3 text-[12px] text-[#374151] leading-relaxed" v-html="templatePreviewHtml"></div>
            </div>
          </div>
        </div>

        <!-- Range selector -->
        <div v-if="contacts.length > 0" class="glass-card p-5">
          <h3 class="text-[15px] mb-4 flex items-center gap-2">
            <Users :size="18" class="text-accent" />
            Email Range
          </h3>
          <div class="flex flex-col gap-3 mb-4">
            <label class="form-checkbox">
              <input type="radio" v-model="rangeType" value="all" />
              <span>Send to all ({{ contacts.length }})</span>
            </label>
            <label class="form-checkbox">
              <input type="radio" v-model="rangeType" value="first" />
              <span>First N contacts</span>
            </label>
            <label class="form-checkbox">
              <input type="radio" v-model="rangeType" value="range" />
              <span>Specific range</span>
            </label>
          </div>

          <div v-if="rangeType === 'first'" class="mb-3">
            <input v-model.number="firstN" type="number" class="form-input" min="1" :max="contacts.length" />
          </div>

          <div v-if="rangeType === 'range'" class="flex items-center gap-3 mb-3">
            <input v-model.number="rangeFrom" type="number" class="form-input w-[100px]" min="1" placeholder="From" />
            <span class="text-text-muted">to</span>
            <input v-model.number="rangeTo" type="number" class="form-input w-[100px]" min="1" placeholder="To" />
          </div>

          <div class="p-3 bg-bg-secondary rounded-[var(--radius-sm)] text-sm text-text-secondary">
            Will send to <strong class="text-accent">{{ selectedCount }}</strong> contacts
          </div>
        </div>

        <!-- Batch + Schedule settings (extracted component) -->
        <SendOptions
          v-model:useBatch="useBatch"
          v-model:batchSize="batchSize"
          v-model:batchDelay="batchDelay"
          v-model:emailDelay="emailDelay"
          v-model:useSchedule="useSchedule"
          v-model:scheduledTime="scheduledTime"
          v-model:notifyEmail="notifyEmail"
        />
      </div>

      <!-- Right column - Editor / Preview -->
      <div class="flex flex-col gap-5">
        <!-- Mode switcher (when template selected) -->
        <div class="flex justify-end gap-2" v-if="selectedTemplateId">
          <button
            class="btn-ghost btn-sm"
            :class="{ 'text-accent': editorMode === 'preview' }"
            @click="editorMode = 'preview'"
          >
            <LayoutTemplate :size="14" /> Preview
          </button>
          <button
            class="btn-ghost btn-sm"
            :class="{ 'text-accent': editorMode === 'rich' }"
            @click="editorMode = 'rich'"
          >
            <Send :size="14" /> Rich Editor
          </button>
          <button
            class="btn-ghost btn-sm"
            :class="{ 'text-accent': editorMode === 'html' }"
            @click="editorMode = 'html'"
          >
            <Code :size="14" /> HTML Editor
          </button>
        </div>

        <!-- Template preview mode -->
        <div v-if="editorMode === 'preview'" class="glass-card p-5">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <p class="text-[12px] text-text-muted uppercase tracking-wide mb-1">Template Preview</p>
              <h3 class="text-base font-semibold m-0">{{ previewSubject || subject || 'Untitled Subject' }}</h3>
              <p class="text-sm text-text-secondary mt-1">
                Showing preview with {{ contacts.length > 0 ? 'first contact' : 'sample data' }}.
              </p>
            </div>
            <div class="flex gap-2">
              <button class="btn-secondary btn-sm" @click="showPreview = true"><Eye :size="14" /> Full Preview</button>
              <button class="btn-primary btn-sm" @click="editorMode = 'rich'">Edit Content</button>
            </div>
          </div>
          <div class="border border-border rounded-[var(--radius-md)] overflow-hidden bg-white text-[#0f172a]">
            <div
              class="px-4 py-3 border-b border-border flex items-center justify-between text-[13px] bg-[rgba(15,23,42,0.03)]"
            >
              <span><strong>From:</strong> {{ previewFromName }} &lt;{{ previewFromEmail }}&gt;</span>
              <span><strong>To:</strong> {{ previewToName }} &lt;{{ previewToEmail }}&gt;</span>
            </div>
            <div class="px-4 py-3 border-b border-border text-[13px]">
              <strong>Subject:</strong> {{ previewSubject }}
            </div>
            <div class="p-5 text-[14px] leading-[1.7]" v-html="templatePreviewHtml || previewContent"></div>
          </div>
          <div class="flex items-center justify-between mt-3 text-[12px] text-text-muted">
            <span>Template content is locked. Click "Edit Content" to switch back to the editor.</span>
            <button class="btn-ghost btn-sm" @click="editorMode = 'rich'">Switch to Editor</button>
          </div>
        </div>

        <!-- Rich editor -->
        <div v-else-if="editorMode === 'rich'" class="flex flex-col gap-2">
          <div v-if="selectedTemplateId" class="flex justify-end gap-2 text-sm text-text-secondary">
            <button class="btn-ghost btn-sm" @click="editorMode = 'preview'">View HTML Preview</button>
            <button class="btn-secondary btn-sm" @click="showPreview = true"><Eye :size="14" /> Full Preview</button>
          </div>
          <EmailEditor
            v-model:subject="subject"
            v-model:content="htmlContent"
            v-model:delay="delay"
            :columns="columns"
            @preview="showPreview = true"
          />
        </div>

        <!-- HTML code editor (Monaco) -->
        <div v-else-if="editorMode === 'html'" class="flex flex-col gap-3">
          <div class="flex items-center justify-between text-sm text-text-secondary">
            <span v-text="'Raw HTML editor (placeholders like {{FirstName}} stay intact)'" />
            <div class="flex gap-2">
              <button class="btn-ghost btn-sm" @click="editorMode = 'preview'">Preview</button>
              <button class="btn-secondary btn-sm" @click="showPreview = true"><Eye :size="14" /> Full Preview</button>
            </div>
          </div>
          <HtmlCodeEditor v-model:content="htmlContent" />
        </div>

        <!-- Send button -->
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm text-text-secondary">
              <span v-if="canSend" class="text-success flex items-center gap-1.5">
                <CheckCircle :size="16" />
                Ready to send
              </span>
              <span v-else class="flex items-center gap-1.5">
                <span v-if="!selectedConfigId" class="text-warning">Select an SMTP config to continue</span>
                <span v-else-if="contacts.length === 0" class="text-warning">Upload contacts to continue</span>
                <span v-else-if="!subject.trim()" class="text-warning">Enter a subject line</span>
                <span v-else class="text-warning">Add email content</span>
              </span>
            </div>
          </div>
          <button class="btn btn-primary btn-lg w-full" :disabled="!canSend || sending" @click="handleSend">
            <Loader2 v-if="sending" :size="18" class="animate-spin" />
            <Calendar v-else-if="useSchedule" :size="18" />
            <Send v-else :size="18" />
            {{ useSchedule ? 'Schedule' : 'Send' }} to {{ selectedCount }} contacts
          </button>
        </div>
      </div>
    </div>
  </MainLayout>

  <!-- Email Preview Modal -->
  <EmailPreviewModal
    :show="showPreview"
    :contacts="contacts"
    :contactIndex="previewContactIndex"
    :fromName="previewFromName"
    :fromEmail="previewFromEmail"
    :toName="previewToName"
    :toEmail="previewToEmail"
    :previewSubject="previewSubject"
    :previewContent="previewContent"
    @close="showPreview = false"
    @prev="prevPreviewContact"
    @next="nextPreviewContact"
  />
</template>

<style scoped>
/* Inline template preview */
.template-inline-preview :deep(img) {
  max-width: 100%;
  height: auto;
}

.template-inline-preview :deep(h1),
.template-inline-preview :deep(h2),
.template-inline-preview :deep(h3) {
  font-size: 14px;
  margin: 4px 0;
}

.template-inline-preview :deep(p) {
  margin: 4px 0;
}
</style>
