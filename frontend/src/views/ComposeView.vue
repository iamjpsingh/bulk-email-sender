<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfigs, useContactLists } from '../lib/query'
import { emailApi, templatesApi, contactsApi } from '../lib/api'
import type { Template } from '../lib/api'
import { useToast } from '../composables/useToast'
import { parseExcelFile, getContactEmail, getContactName, replacePlaceholders } from '../lib/excelParser'
import EmailEditor from '../components/compose/EmailEditor.vue'
import SendOptions from '../components/compose/SendOptions.vue'
import EmailPreviewModal from '../components/compose/EmailPreviewModal.vue'
import MainLayout from '../components/layout/MainLayout.vue'
import Stepper from '../components/ui/Stepper.vue'
import AlertBanner from '../components/ui/AlertBanner.vue'
import {
  Send,
  Calendar,
  Loader2,
  CheckCircle,
  Users,
  Settings,
  FileText,
  Eye,
  Code,
  LayoutTemplate,
  Upload,
} from 'lucide-vue-next'
import HtmlCodeEditor from '../components/compose/HtmlCodeEditor.vue'

const toast = useToast()

// TanStack Query for configs and contact lists
const { data: configsData } = useConfigs()
const smtpConfigs = computed(() => configsData.value || [])
const { data: contactLists } = useContactLists()
const lists = computed(() => contactLists.value || [])

// Form data
const campaignName = ref('')
const subject = ref('')
const htmlContent = ref('')
const excelFile = ref<File | null>(null)
const contacts = ref<any[]>([])
const columns = ref<string[]>([])
const delay = ref(20)

// Contact list selection
const selectedListId = ref('')
const loadingContacts = ref(false)
const recipientMode = ref<'list' | 'upload'>('list')

async function loadContactsFromList(listId: string) {
  if (!listId) {
    contacts.value = []
    columns.value = []
    return
  }
  loadingContacts.value = true
  try {
    const res = await contactsApi.getContacts(listId, { limit: 10000 })
    contacts.value = res.contacts.map(c => ({
      Email: c.email,
      FirstName: c.first_name || '',
      LastName: c.last_name || '',
      Company: c.company || '',
      Name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email,
    }))
    columns.value = ['Email', 'FirstName', 'LastName', 'Company', 'Name']
  } catch (err: any) {
    toast.error(err.message || 'Failed to load contacts')
    contacts.value = []
  } finally {
    loadingContacts.value = false
  }
}

watch(selectedListId, (id) => {
  if (id) loadContactsFromList(id)
})

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

const stepperSteps = computed(() => [
  { label: 'Config', completed: !!selectedConfigId.value },
  { label: 'Recipients', completed: contacts.value.length > 0 },
  { label: 'Compose', completed: !!subject.value.trim() && !!htmlContent.value.trim() },
  { label: 'Send', completed: false },
])

const currentStepIndex = computed(() => {
  if (!selectedConfigId.value) return 0
  if (contacts.value.length <= 0) return 1
  if (!subject.value.trim() || !htmlContent.value.trim()) return 2
  return 3
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
  formData.set('campaignName', campaignName.value || `Campaign ${new Date().toLocaleDateString()}`)
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
      <div class="flex items-start justify-between gap-4 max-md:flex-col">
        <div class="flex-1 min-w-0">
          <input
            v-model="campaignName"
            type="text"
            class="text-2xl font-semibold text-text-primary bg-transparent border-none outline-none w-full placeholder:text-text-muted/60"
            placeholder="Untitled Campaign"
          />
          <p class="text-text-muted text-sm mt-0.5">Give your campaign a name to find it later</p>
        </div>
      </div>
      <Stepper :steps="stepperSteps" :currentStep="currentStepIndex" class="mt-5" />
    </header>

    <!-- Result message -->
    <AlertBanner
      v-if="result"
      :type="result.success ? 'success' : 'error'"
      dismissible
      class="mb-6"
      @dismiss="result = null"
    >
      <strong class="block mb-1">{{ result.success ? 'Success!' : 'Error' }}</strong>
      <p class="text-sm opacity-80 m-0">{{ result.message }}</p>
    </AlertBanner>

    <div class="grid grid-cols-[minmax(320px,400px)_1fr] gap-6 max-lg:grid-cols-1">
      <!-- Left column -->
      <div class="flex flex-col gap-4">
        <!-- Email Config selector -->
        <div class="bg-bg-card border border-border rounded-xl p-5">
          <h3 class="text-sm font-semibold mb-4 flex items-center gap-2 text-text-primary">
            <Settings :size="16" class="text-accent" />
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
            No configs found. <router-link to="/configs" class="text-accent hover:underline">Create one</router-link>
          </p>
        </div>

        <!-- Recipients -->
        <div class="bg-bg-card border border-border rounded-xl p-5">
          <h3 class="text-sm font-semibold mb-4 flex items-center gap-2 text-text-primary">
            <Users :size="16" class="text-accent" />
            Recipients
          </h3>

          <!-- Mode toggle -->
          <div class="flex gap-1 mb-4 p-0.5 bg-bg-tertiary rounded-lg">
            <button
              class="flex-1 text-[13px] font-medium py-1.5 rounded-md transition-all"
              :class="recipientMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'"
              @click="recipientMode = 'list'"
            >
              Contact List
            </button>
            <button
              class="flex-1 text-[13px] font-medium py-1.5 rounded-md transition-all"
              :class="recipientMode === 'upload' ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'"
              @click="recipientMode = 'upload'"
            >
              <Upload :size="13" class="inline -mt-px mr-1" />Upload File
            </button>
          </div>

          <!-- Contact list selector -->
          <div v-if="recipientMode === 'list'">
            <select v-model="selectedListId" class="form-select" :disabled="loadingContacts">
              <option value="">Select a contact list...</option>
              <option v-for="list in lists" :key="list.id" :value="list.id">
                {{ list.name }} ({{ list.contact_count }} contacts)
              </option>
            </select>
            <p v-if="lists.length === 0" class="text-text-muted text-[13px] mt-2">
              No lists found. <router-link to="/contacts" class="text-accent hover:underline">Create one</router-link>
            </p>
            <p v-if="loadingContacts" class="text-text-muted text-[13px] mt-2 flex items-center gap-1">
              <Loader2 :size="12" class="animate-spin" /> Loading contacts...
            </p>
            <div v-else-if="contacts.length > 0 && selectedListId" class="mt-2 p-2.5 bg-bg-tertiary rounded-lg text-[13px] text-text-secondary">
              <strong class="text-accent">{{ contacts.length }}</strong> contacts loaded
            </div>
          </div>

          <!-- File upload fallback -->
          <div v-else>
            <label
              class="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-border rounded-xl bg-bg-primary cursor-pointer transition-all hover:border-accent hover:bg-accent/3 group"
            >
              <Upload :size="24" class="text-text-muted group-hover:text-accent transition-colors" />
              <span class="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                Click to upload <span class="text-text-muted">CSV, XLSX, or XLS</span>
              </span>
              <input
                type="file"
                class="hidden"
                accept=".csv,.xlsx,.xls"
                @change="(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSelected(f) }"
              />
            </label>
            <div v-if="contacts.length > 0 && !selectedListId" class="mt-2 p-2.5 bg-bg-tertiary rounded-lg text-[13px] text-text-secondary">
              <strong class="text-accent">{{ contacts.length }}</strong> contacts loaded from file
            </div>
          </div>
        </div>

        <!-- Template selector -->
        <div class="bg-bg-card border border-border rounded-xl p-5">
          <h3 class="text-sm font-semibold mb-4 flex items-center gap-2 text-text-primary">
            <FileText :size="16" class="text-accent" />
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
        </div>

        <!-- Range selector -->
        <div v-if="contacts.length > 0" class="bg-bg-card border border-border rounded-xl p-5">
          <h3 class="text-sm font-semibold mb-4 flex items-center gap-2 text-text-primary">
            <Users :size="16" class="text-accent" />
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
            <span class="text-text-muted text-sm">to</span>
            <input v-model.number="rangeTo" type="number" class="form-input w-[100px]" min="1" placeholder="To" />
          </div>

          <div class="p-3 bg-bg-tertiary rounded-lg text-sm text-text-secondary">
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
      <div class="flex flex-col gap-4">
        <!-- Mode switcher (when template selected) -->
        <div class="flex justify-end gap-1.5" v-if="selectedTemplateId">
          <button
            class="btn-ghost btn-sm"
            :class="{ '!text-accent !bg-accent/8': editorMode === 'preview' }"
            @click="editorMode = 'preview'"
          >
            <LayoutTemplate :size="14" /> Preview
          </button>
          <button
            class="btn-ghost btn-sm"
            :class="{ '!text-accent !bg-accent/8': editorMode === 'rich' }"
            @click="editorMode = 'rich'"
          >
            <Send :size="14" /> Rich Editor
          </button>
          <button
            class="btn-ghost btn-sm"
            :class="{ '!text-accent !bg-accent/8': editorMode === 'html' }"
            @click="editorMode = 'html'"
          >
            <Code :size="14" /> HTML Editor
          </button>
        </div>

        <!-- Template preview mode -->
        <div v-if="editorMode === 'preview'" class="bg-bg-card border border-border rounded-xl p-5">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <p class="text-[11px] text-text-muted uppercase tracking-wider font-medium mb-1">Template Preview</p>
              <h3 class="text-base font-semibold m-0 text-text-primary">{{ previewSubject || subject || 'Untitled Subject' }}</h3>
              <p class="text-sm text-text-muted mt-1">
                Showing preview with {{ contacts.length > 0 ? 'first contact' : 'sample data' }}.
              </p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button class="btn-secondary btn-sm" @click="showPreview = true"><Eye :size="14" /> Full Preview</button>
              <button class="btn-primary btn-sm" @click="editorMode = 'rich'">Edit Content</button>
            </div>
          </div>
          <div class="border border-border rounded-xl overflow-hidden bg-white text-[#0f172a]">
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between text-[13px] bg-gray-50">
              <span><strong>From:</strong> {{ previewFromName }} &lt;{{ previewFromEmail }}&gt;</span>
              <span><strong>To:</strong> {{ previewToName }} &lt;{{ previewToEmail }}&gt;</span>
            </div>
            <div class="px-4 py-3 border-b border-gray-200 text-[13px]">
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
          <div v-if="selectedTemplateId" class="flex justify-end gap-2 text-sm text-text-muted">
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
          <div class="flex items-center justify-between text-sm text-text-muted">
            <span v-text="'Raw HTML editor (placeholders like {{FirstName}} stay intact)'" />
            <div class="flex gap-2">
              <button class="btn-ghost btn-sm" @click="editorMode = 'preview'">Preview</button>
              <button class="btn-secondary btn-sm" @click="showPreview = true"><Eye :size="14" /> Full Preview</button>
            </div>
          </div>
          <HtmlCodeEditor v-model:content="htmlContent" />
        </div>

        <!-- Send button -->
        <div class="bg-bg-card border border-border rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm text-text-secondary">
              <span v-if="canSend" class="text-success flex items-center gap-1.5">
                <CheckCircle :size="16" />
                Ready to send
              </span>
              <span v-else class="flex items-center gap-1.5">
                <span v-if="!selectedConfigId" class="text-warning">Select an SMTP config to continue</span>
                <span v-else-if="contacts.length === 0" class="text-warning">Select a contact list to continue</span>
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

