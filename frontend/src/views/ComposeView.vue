<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfigs, useContactLists } from '../lib/query'
import { emailApi, templatesApi, contactsApi } from '../lib/api'
import type { Template } from '../lib/api'
import { useToast } from '../composables/useToast'
import { parseExcelFile, getContactEmail, getContactName, replacePlaceholders } from '../lib/excelParser'
import EmailEditor from '../components/compose/EmailEditor.vue'
import EmailPreviewModal from '../components/compose/EmailPreviewModal.vue'
import HtmlCodeEditor from '../components/compose/HtmlCodeEditor.vue'
import Stepper from '../components/ui/Stepper.vue'
import AlertBanner from '../components/ui/AlertBanner.vue'
import InfoTip from '../components/ui/InfoTip.vue'
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
  ArrowLeft,
  ArrowRight,
  Mail,
  Zap,
  Clock,
  AlertCircle,
  ChevronRight,
} from 'lucide-vue-next'

const toast = useToast()

// ───── Data / Queries ─────
const { data: configsData } = useConfigs()
const smtpConfigs = computed(() => configsData.value || [])
const { data: contactLists } = useContactLists()
const lists = computed(() => contactLists.value || [])

// ───── Wizard Step ─────
const activeStep = ref(0)

// ───── Form Data ─────
const campaignName = ref('')
const subject = ref('')
const htmlContent = ref('')
const excelFile = ref<File | null>(null)
const contacts = ref<any[]>([])
const columns = ref<string[]>([])
const delay = ref(20)
const selectedListId = ref('')
const loadingContacts = ref(false)
const recipientMode = ref<'list' | 'upload'>('list')
const selectedConfigId = ref('')

// Batch
const useBatch = ref(false)
const batchSize = ref(20)
const batchDelay = ref(60)
const emailDelay = ref(45)

// Rotation
const rotationMode = ref('smart')

// Schedule
const useSchedule = ref(false)
const scheduledTime = ref('')
const notifyEmail = ref('')

// Range
const rangeType = ref<'all' | 'first' | 'range'>('all')
const firstN = ref(50)
const rangeFrom = ref(1)
const rangeTo = ref(100)

const sending = ref(false)
const result = ref<any>(null)

// Preview
const showPreview = ref(false)
const previewContactIndex = ref(0)

// Templates
const templates = ref<Template[]>([])
const selectedTemplateId = ref('')
const loadingTemplates = ref(false)
const loadingTemplate = ref(false)
const editorMode = ref<'preview' | 'rich' | 'html'>('rich')

// ───── Step validation ─────
const step1Valid = computed(() => !!selectedConfigId.value && contacts.value.length > 0)
const step2Valid = computed(() => !!subject.value.trim() && !!htmlContent.value.trim())
const step3Valid = computed(() => {
  if (useSchedule.value && !scheduledTime.value) return false
  return true
})

const stepperSteps = computed(() => [
  { label: 'Recipients', completed: step1Valid.value && activeStep.value > 0 },
  { label: 'Content', completed: step2Valid.value && activeStep.value > 1 },
  { label: 'Settings', completed: step3Valid.value && activeStep.value > 2 },
  { label: 'Review & Send', completed: false },
])

const canProceed = computed(() => {
  if (activeStep.value === 0) return step1Valid.value
  if (activeStep.value === 1) return step2Valid.value
  if (activeStep.value === 2) return step3Valid.value
  return true
})

const canSend = computed(() => step1Valid.value && step2Valid.value && step3Valid.value)

function goNext() {
  if (canProceed.value && activeStep.value < 3) activeStep.value++
}
function goBack() {
  if (activeStep.value > 0) activeStep.value--
}
function goToStep(idx: number) {
  // Allow jumping to completed steps or current
  if (idx <= activeStep.value) {
    activeStep.value = idx
  }
}

// ───── Contact Loading ─────
async function loadContactsFromList(listId: string) {
  if (!listId) { contacts.value = []; columns.value = []; return }
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
watch(selectedListId, (id) => { if (id) loadContactsFromList(id) })

// ───── Templates ─────
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
    if (tpl.subject && !subject.value) subject.value = tpl.subject
    toast.success(`Template "${tpl.name}" applied`)
  } catch (err: any) {
    toast.error(err.message || 'Failed to load template')
    selectedTemplateId.value = ''
  } finally {
    loadingTemplate.value = false
  }
}

watch(selectedTemplateId, (id) => {
  if (id) { applyTemplate(id); editorMode.value = 'preview' }
  else { editorMode.value = 'rich' }
})

// ───── File Upload ─────
async function handleFileSelected(file: File) {
  excelFile.value = file
  const parsed = await parseExcelFile(file)
  contacts.value = parsed.contacts
  columns.value = parsed.columns
}

// ───── Preview Helpers ─────
const templatePreviewHtml = computed(() => {
  if (!htmlContent.value) return ''
  return replacePlaceholders(htmlContent.value, previewContact.value)
})

const previewContact = computed(() => {
  if (contacts.value.length > 0) return contacts.value[previewContactIndex.value] || contacts.value[0]
  return { Email: 'john@example.com', FirstName: 'John', LastName: 'Doe', Company: 'Acme Inc', Name: 'John Doe' }
})

const previewToEmail = computed(() => getContactEmail(previewContact.value))
const previewToName = computed(() => getContactName(previewContact.value))
const previewSubject = computed(() => replacePlaceholders(subject.value, previewContact.value))
const previewContent = computed(() => replacePlaceholders(htmlContent.value, previewContact.value))

const previewFromName = computed(() => {
  const cfg = smtpConfigs.value.find(c => c.id === selectedConfigId.value)
  return cfg?.from_name || cfg?.name || 'Your Name'
})
const previewFromEmail = computed(() => {
  const cfg = smtpConfigs.value.find(c => c.id === selectedConfigId.value)
  return cfg?.from_email || cfg?.oauth_email || 'you@example.com'
})

function nextPreviewContact() {
  if (contacts.value.length > 0) previewContactIndex.value = (previewContactIndex.value + 1) % contacts.value.length
}
function prevPreviewContact() {
  if (contacts.value.length > 0) previewContactIndex.value = previewContactIndex.value === 0 ? contacts.value.length - 1 : previewContactIndex.value - 1
}

const selectedCount = computed(() => {
  if (contacts.value.length === 0) return 0
  if (rangeType.value === 'all') return contacts.value.length
  if (rangeType.value === 'first') return Math.min(firstN.value, contacts.value.length)
  return Math.min(rangeTo.value - rangeFrom.value + 1, contacts.value.length)
})

const selectedConfigName = computed(() => {
  const cfg = smtpConfigs.value.find(c => c.id === selectedConfigId.value)
  if (!cfg) return ''
  if (cfg.provider_type === 'google') return `${cfg.name} (Gmail)`
  if (cfg.provider_type === 'microsoft') return `${cfg.name} (Outlook)`
  return `${cfg.name} (${cfg.host})`
})

// ───── Send ─────
async function handleSend() {
  if (!canSend.value) return
  sending.value = true
  result.value = null

  const formData = new FormData()
  const config = smtpConfigs.value.find(c => c.id === selectedConfigId.value)
  if (!config) { toast.error('No SMTP config selected'); sending.value = false; return }

  formData.set('configId', config.id)
  formData.set('campaignName', campaignName.value || `Campaign ${new Date().toLocaleDateString()}`)
  formData.set('subject', subject.value)
  formData.set('htmlContent', htmlContent.value)
  formData.set('delay', delay.value.toString())

  if (excelFile.value) formData.set('excelFile', excelFile.value)

  let start = 0, count = contacts.value.length
  if (rangeType.value === 'first') count = Math.min(firstN.value, contacts.value.length)
  else if (rangeType.value === 'range') { start = rangeFrom.value - 1; count = Math.min(rangeTo.value - rangeFrom.value + 1, contacts.value.length - start) }
  formData.set('emailRangeStart', start.toString())
  formData.set('emailRangeCount', count.toString())

  if (useBatch.value) {
    formData.set('useBatch', 'on')
    formData.set('batchSize', batchSize.value.toString())
    formData.set('batchDelay', batchDelay.value.toString())
    formData.set('emailDelay', emailDelay.value.toString())
  }

  if (useSchedule.value && scheduledTime.value) {
    formData.set('scheduleEmail', 'on')
    formData.set('scheduledTime', new Date(scheduledTime.value).toISOString())
    if (notifyEmail.value) formData.set('notifyEmail', notifyEmail.value)
  }

  try {
    const response = await emailApi.send(formData)
    result.value = response
    if (response.success) toast.success(response.message || 'Emails sent successfully!')
    else toast.error(response.message || 'Failed to send emails')
  } catch (err: any) {
    result.value = { success: false, message: err.message || 'Failed to send emails' }
    toast.error(err.message || 'Failed to send emails')
  } finally {
    sending.value = false
  }
}

onMounted(() => { fetchTemplates() })
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <header class="mb-8">
      <div class="flex items-start justify-between gap-4 max-md:flex-col">
        <div class="flex-1 min-w-0">
          <input
            v-model="campaignName"
            type="text"
            class="text-2xl font-semibold text-text-primary bg-transparent border-none outline-none w-full placeholder:text-text-muted/60"
            placeholder="Untitled Campaign"
          />
          <p class="text-text-muted text-sm mt-0.5">Name your campaign so you can find it later in reports</p>
        </div>
      </div>
      <Stepper :steps="stepperSteps" :currentStep="activeStep" class="mt-5" @step-click="goToStep" />
    </header>

    <!-- Result banner -->
    <AlertBanner v-if="result" :type="result.success ? 'success' : 'error'" dismissible class="mb-6" @dismiss="result = null">
      <strong class="block mb-1">{{ result.success ? 'Success!' : 'Error' }}</strong>
      <p class="text-sm opacity-80 m-0">{{ result.message }}</p>
    </AlertBanner>

    <!-- ═══════════════ STEP 1: Recipients ═══════════════ -->
    <div v-show="activeStep === 0" class="wizard-step">
      <div class="step-header">
        <div>
          <h2 class="step-title"><Users :size="20" class="text-accent" /> Choose Recipients</h2>
          <p class="step-desc">Select who will receive this campaign. Pick a contact list or upload a file.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Email Config -->
        <div class="card">
          <h3 class="card-title">
            <Settings :size="16" class="text-accent" />
            Email Provider
            <InfoTip text="Choose the SMTP configuration or connected email account to send from" side="right" />
          </h3>
          <select v-model="selectedConfigId" class="form-select">
            <option value="">Select provider...</option>
            <option v-for="config in smtpConfigs" :key="config.id" :value="config.id">
              {{ config.name }}
              <template v-if="config.provider_type === 'google'">(Gmail)</template>
              <template v-else-if="config.provider_type === 'microsoft'">(Outlook)</template>
              <template v-else>({{ config.host }})</template>
            </option>
          </select>
          <p v-if="smtpConfigs.length === 0" class="text-text-muted text-[13px] mt-2">
            No providers configured. <router-link to="/settings/smtp" class="text-accent hover:underline">Add one</router-link>
          </p>
          <div v-else-if="selectedConfigId" class="mt-2 flex items-center gap-1.5 text-[13px] text-success">
            <CheckCircle :size="14" /> Provider selected
          </div>
        </div>

        <!-- Recipients -->
        <div class="card">
          <h3 class="card-title">
            <Users :size="16" class="text-accent" />
            Recipients
            <InfoTip text="Choose a saved contact list or upload a CSV/Excel file with email addresses" side="right" />
          </h3>

          <!-- Mode toggle -->
          <div class="flex gap-1 mb-4 p-0.5 bg-bg-tertiary rounded-lg">
            <button
              class="flex-1 text-[13px] font-medium py-1.5 rounded-md transition-all"
              :class="recipientMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'"
              @click="recipientMode = 'list'"
            >Contact List</button>
            <button
              class="flex-1 text-[13px] font-medium py-1.5 rounded-md transition-all"
              :class="recipientMode === 'upload' ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'"
              @click="recipientMode = 'upload'"
            ><Upload :size="13" class="inline -mt-px mr-1" />Upload File</button>
          </div>

          <!-- Contact list -->
          <div v-if="recipientMode === 'list'">
            <select v-model="selectedListId" class="form-select" :disabled="loadingContacts">
              <option value="">Select a contact list...</option>
              <option v-for="list in lists" :key="list.id" :value="list.id">
                {{ list.name }} ({{ list.contact_count }} contacts)
              </option>
            </select>
            <p v-if="lists.length === 0" class="text-text-muted text-[13px] mt-2">
              No lists yet. <router-link to="/contacts" class="text-accent hover:underline">Create one</router-link>
            </p>
            <p v-if="loadingContacts" class="text-text-muted text-[13px] mt-2 flex items-center gap-1">
              <Loader2 :size="12" class="animate-spin" /> Loading contacts...
            </p>
            <div v-else-if="contacts.length > 0 && selectedListId" class="mt-2 flex items-center gap-1.5 text-[13px] text-success">
              <CheckCircle :size="14" /> <strong>{{ contacts.length }}</strong> contacts loaded
            </div>
          </div>

          <!-- File upload -->
          <div v-else>
            <label class="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-border rounded-xl bg-bg-primary cursor-pointer transition-all hover:border-accent hover:bg-accent/3 group">
              <Upload :size="24" class="text-text-muted group-hover:text-accent transition-colors" />
              <span class="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                Click to upload <span class="text-text-muted">CSV, XLSX, or XLS</span>
              </span>
              <input type="file" class="hidden" accept=".csv,.xlsx,.xls"
                @change="(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSelected(f) }" />
            </label>
            <div v-if="contacts.length > 0 && !selectedListId" class="mt-2 flex items-center gap-1.5 text-[13px] text-success">
              <CheckCircle :size="14" /> <strong>{{ contacts.length }}</strong> contacts from file
            </div>
          </div>
        </div>
      </div>

      <!-- Validation hint -->
      <div v-if="!step1Valid" class="mt-4 p-3 bg-warning/8 border border-warning/20 rounded-lg text-[13px] text-warning flex items-start gap-2">
        <AlertCircle :size="16" class="shrink-0 mt-0.5" />
        <span>
          <template v-if="!selectedConfigId">Select an email provider to continue.</template>
          <template v-else>Add recipients by choosing a contact list or uploading a file.</template>
        </span>
      </div>
    </div>

    <!-- ═══════════════ STEP 2: Content ═══════════════ -->
    <div v-show="activeStep === 1" class="wizard-step">
      <div class="step-header">
        <div>
          <h2 class="step-title"><Mail :size="20" class="text-accent" /> Write Your Email</h2>
          <p class="step-desc">Compose your email content. Start from a template or write from scratch.</p>
        </div>
      </div>

      <!-- Template selector -->
      <div class="card mb-5">
        <h3 class="card-title">
          <FileText :size="16" class="text-accent" />
          Start from Template
          <InfoTip text="Templates pre-fill your email content. You can edit it after applying." side="right" />
          <span class="text-[11px] font-normal text-text-muted ml-auto">(optional)</span>
        </h3>
        <select v-model="selectedTemplateId" class="form-select" :disabled="loadingTemplates">
          <option value="">{{ loadingTemplates ? 'Loading...' : 'Choose a template or start blank...' }}</option>
          <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">
            {{ tpl.name }}
            <template v-if="tpl.category !== 'general'"> ({{ tpl.category }})</template>
          </option>
        </select>
        <p v-if="loadingTemplate" class="text-text-muted text-[13px] mt-2 flex items-center gap-1">
          <Loader2 :size="12" class="animate-spin" /> Applying template...
        </p>
      </div>

      <!-- Mode switcher -->
      <div class="flex justify-between items-center mb-3" v-if="selectedTemplateId">
        <span class="text-[13px] text-text-muted">Editor mode:</span>
        <div class="flex gap-1.5">
          <button class="btn-ghost btn-sm" :class="{ '!text-accent !bg-accent/8': editorMode === 'preview' }" @click="editorMode = 'preview'">
            <LayoutTemplate :size="14" /> Preview
          </button>
          <button class="btn-ghost btn-sm" :class="{ '!text-accent !bg-accent/8': editorMode === 'rich' }" @click="editorMode = 'rich'">
            <Send :size="14" /> Rich Editor
          </button>
          <button class="btn-ghost btn-sm" :class="{ '!text-accent !bg-accent/8': editorMode === 'html' }" @click="editorMode = 'html'">
            <Code :size="14" /> HTML
          </button>
        </div>
      </div>

      <!-- Template preview mode -->
      <div v-if="editorMode === 'preview'" class="card">
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
          <div class="px-4 py-3 border-b border-gray-200 text-[13px]"><strong>Subject:</strong> {{ previewSubject }}</div>
          <div class="p-5 text-[14px] leading-[1.7]" v-html="templatePreviewHtml || previewContent"></div>
        </div>
        <div class="flex items-center justify-between mt-3 text-[12px] text-text-muted">
          <span>Template content is locked. Click "Edit Content" to modify.</span>
          <button class="btn-ghost btn-sm" @click="editorMode = 'rich'">Switch to Editor</button>
        </div>
      </div>

      <!-- Rich editor -->
      <div v-else-if="editorMode === 'rich'" class="flex flex-col gap-2">
        <div v-if="selectedTemplateId" class="flex justify-end gap-2 text-sm text-text-muted">
          <button class="btn-ghost btn-sm" @click="editorMode = 'preview'">View HTML Preview</button>
          <button class="btn-secondary btn-sm" @click="showPreview = true"><Eye :size="14" /> Full Preview</button>
        </div>
        <EmailEditor v-model:subject="subject" v-model:content="htmlContent" v-model:delay="delay" :columns="columns" @preview="showPreview = true" />
      </div>

      <!-- HTML editor -->
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

      <!-- Validation hint -->
      <div v-if="!step2Valid" class="mt-4 p-3 bg-warning/8 border border-warning/20 rounded-lg text-[13px] text-warning flex items-start gap-2">
        <AlertCircle :size="16" class="shrink-0 mt-0.5" />
        <span>
          <template v-if="!subject.trim()">Enter a subject line for your email.</template>
          <template v-else>Add some email content using the editor above.</template>
        </span>
      </div>
    </div>

    <!-- ═══════════════ STEP 3: Settings ═══════════════ -->
    <div v-show="activeStep === 2" class="wizard-step">
      <div class="step-header">
        <div>
          <h2 class="step-title"><Settings :size="20" class="text-accent" /> Sending Settings</h2>
          <p class="step-desc">Configure how and when your emails are sent. All settings are optional — defaults work great for most campaigns.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Range selector -->
        <div class="card" v-if="contacts.length > 0">
          <h3 class="card-title">
            <Users :size="16" class="text-accent" />
            Recipient Range
            <InfoTip text="Choose to send to all contacts, only the first N, or a specific range. Useful for testing with a small batch first." side="right" />
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
            <input v-model.number="firstN" type="number" class="form-input" min="1" :max="contacts.length" placeholder="Number of contacts" />
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

        <!-- Batch settings -->
        <div class="card">
          <h3 class="card-title">
            <Zap :size="16" class="text-accent" />
            Batch Sending
            <InfoTip text="Split your campaign into smaller batches with delays between them. Helps avoid rate limits and improves deliverability." side="right" />
          </h3>
          <label class="form-checkbox">
            <input type="checkbox" v-model="useBatch" />
            <span>Enable batch sending</span>
          </label>
          <div v-if="useBatch" class="mt-4 pt-4 border-t border-border flex flex-col gap-3">
            <div class="form-group !mb-0">
              <label class="form-label flex items-center gap-1.5">
                Batch Size
                <InfoTip text="Number of emails to send in each batch before pausing" :size="12" />
              </label>
              <input v-model.number="batchSize" type="number" class="form-input" min="1" max="100" />
            </div>
            <div class="form-group !mb-0">
              <label class="form-label flex items-center gap-1.5">
                Batch Delay (seconds)
                <InfoTip text="Wait time between batches. 60+ seconds recommended." :size="12" />
              </label>
              <input v-model.number="batchDelay" type="number" class="form-input" min="1" />
            </div>
            <div class="form-group !mb-0">
              <label class="form-label flex items-center gap-1.5">
                Email Delay (seconds)
                <InfoTip text="Wait time between individual emails within a batch" :size="12" />
              </label>
              <input v-model.number="emailDelay" type="number" class="form-input" min="1" />
            </div>
          </div>
        </div>

        <!-- Schedule settings -->
        <div class="card">
          <h3 class="card-title">
            <Clock :size="16" class="text-accent" />
            Schedule
            <InfoTip text="Schedule your campaign to send at a specific date and time instead of sending immediately" side="right" />
          </h3>
          <label class="form-checkbox">
            <input type="checkbox" v-model="useSchedule" />
            <span>Schedule for later</span>
          </label>
          <div v-if="useSchedule" class="mt-4 pt-4 border-t border-border flex flex-col gap-3">
            <div class="form-group !mb-0">
              <label class="form-label">Scheduled Time</label>
              <input v-model="scheduledTime" type="datetime-local" class="form-input" />
            </div>
            <div class="form-group !mb-0">
              <label class="form-label flex items-center gap-1.5">
                Notification Email
                <InfoTip text="Get notified by email when the scheduled campaign finishes sending" :size="12" />
                <span class="text-[11px] font-normal text-text-muted">(optional)</span>
              </label>
              <input v-model="notifyEmail" type="email" class="form-input" placeholder="you@example.com" />
            </div>
          </div>
        </div>

        <!-- Server Rotation -->
        <div class="card">
          <h3 class="card-title">
            <Zap :size="16" class="text-accent" />
            Server Rotation
            <InfoTip text="When you have multiple sending providers, choose how to distribute emails across them. Smart mode picks the best provider automatically." side="right" />
          </h3>
          <div class="flex flex-col gap-2">
            <label v-for="mode in [
              { value: 'smart', label: 'Smart (Auto)', desc: 'Score-based selection — picks best provider by quota, speed, and success rate' },
              { value: 'round_robin', label: 'Round Robin', desc: 'Distribute evenly across all configured providers' },
              { value: 'manual', label: 'Manual', desc: 'Use only the selected provider above' },
            ]" :key="mode.value" class="flex items-start gap-2.5 p-2.5 rounded-lg border border-border cursor-pointer hover:border-accent/30 transition" :class="rotationMode === mode.value ? 'border-accent/40 bg-accent/5' : ''">
              <input type="radio" :value="mode.value" v-model="rotationMode" class="mt-0.5 accent-accent" />
              <div>
                <div class="text-xs font-medium" :class="rotationMode === mode.value ? 'text-accent' : 'text-text-primary'">{{ mode.label }}</div>
                <div class="text-[10px] text-text-muted">{{ mode.desc }}</div>
              </div>
            </label>
          </div>
        </div>

        <!-- Delay between emails (standalone, outside batch) -->
        <div class="card" v-if="!useBatch">
          <h3 class="card-title">
            <Clock :size="16" class="text-accent" />
            Email Delay
            <InfoTip text="Wait time between sending individual emails. 15-30 seconds recommended to avoid rate limits." side="right" />
          </h3>
          <div class="form-group !mb-0">
            <label class="form-label">Delay Between Emails (seconds)</label>
            <input v-model.number="delay" type="number" class="form-input" min="15" max="60" />
            <p class="text-text-muted text-[12px] mt-1.5">15-30 seconds recommended to avoid rate limits</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════ STEP 4: Review & Send ═══════════════ -->
    <div v-show="activeStep === 3" class="wizard-step">
      <div class="step-header">
        <div>
          <h2 class="step-title"><CheckCircle :size="20" class="text-accent" /> Review & Send</h2>
          <p class="step-desc">Double-check everything before sending. Click any section to go back and edit.</p>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <!-- Summary cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Provider -->
          <button class="card text-left hover:border-accent/40 transition-colors" @click="activeStep = 0">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] text-text-muted uppercase tracking-wider font-medium">Provider</span>
              <ChevronRight :size="14" class="text-text-muted" />
            </div>
            <p class="text-sm font-medium text-text-primary truncate">{{ selectedConfigName || 'Not selected' }}</p>
          </button>

          <!-- Recipients -->
          <button class="card text-left hover:border-accent/40 transition-colors" @click="activeStep = 0">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] text-text-muted uppercase tracking-wider font-medium">Recipients</span>
              <ChevronRight :size="14" class="text-text-muted" />
            </div>
            <p class="text-sm font-medium text-text-primary">
              <span class="text-accent">{{ selectedCount }}</span> contacts
              <span v-if="rangeType !== 'all'" class="text-text-muted font-normal">({{ rangeType === 'first' ? `first ${firstN}` : `${rangeFrom}-${rangeTo}` }})</span>
            </p>
          </button>

          <!-- Schedule -->
          <button class="card text-left hover:border-accent/40 transition-colors" @click="activeStep = 2">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] text-text-muted uppercase tracking-wider font-medium">Delivery</span>
              <ChevronRight :size="14" class="text-text-muted" />
            </div>
            <p class="text-sm font-medium text-text-primary">
              <template v-if="useSchedule && scheduledTime">Scheduled: {{ new Date(scheduledTime).toLocaleString() }}</template>
              <template v-else>Send immediately</template>
            </p>
            <p v-if="useBatch" class="text-[12px] text-text-muted mt-0.5">Batch: {{ batchSize }} per batch, {{ batchDelay }}s delay</p>
          </button>
        </div>

        <!-- Email preview -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="card-title !mb-0">
              <Eye :size="16" class="text-accent" />
              Email Preview
            </h3>
            <div class="flex gap-2">
              <button class="btn-ghost btn-sm" @click="activeStep = 1">Edit Content</button>
              <button class="btn-secondary btn-sm" @click="showPreview = true"><Eye :size="14" /> Full Preview</button>
            </div>
          </div>
          <div class="border border-border rounded-xl overflow-hidden bg-white text-[#0f172a]">
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between text-[13px] bg-gray-50 flex-wrap gap-2">
              <span><strong>From:</strong> {{ previewFromName }} &lt;{{ previewFromEmail }}&gt;</span>
              <span><strong>To:</strong> {{ previewToName }} &lt;{{ previewToEmail }}&gt;</span>
            </div>
            <div class="px-4 py-3 border-b border-gray-200 text-[13px]"><strong>Subject:</strong> {{ previewSubject }}</div>
            <div class="p-5 text-[14px] leading-[1.7] max-h-[300px] overflow-y-auto" v-html="templatePreviewHtml || previewContent"></div>
          </div>
        </div>

        <!-- Send button -->
        <div class="card !p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm text-text-secondary">
              <span v-if="canSend" class="text-success flex items-center gap-1.5">
                <CheckCircle :size="16" /> Ready to send
              </span>
              <span v-else class="text-warning flex items-center gap-1.5">
                <AlertCircle :size="16" /> Some required fields are missing
              </span>
            </div>
          </div>
          <button class="btn btn-primary btn-lg w-full" :disabled="!canSend || sending" @click="handleSend">
            <Loader2 v-if="sending" :size="18" class="animate-spin" />
            <Calendar v-else-if="useSchedule" :size="18" />
            <Send v-else :size="18" />
            {{ useSchedule ? 'Schedule' : 'Send' }} Campaign to {{ selectedCount }} contacts
          </button>
          <p class="text-[12px] text-text-muted text-center mt-3">
            <template v-if="useSchedule">Your campaign will be queued and sent at the scheduled time.</template>
            <template v-else>Emails will start sending immediately after you click the button.</template>
          </p>
        </div>
      </div>
    </div>

    <!-- ═══════════════ Navigation ═══════════════ -->
    <div class="flex items-center justify-between mt-8 pt-5 border-t border-border">
      <button v-if="activeStep > 0" class="btn btn-secondary" @click="goBack">
        <ArrowLeft :size="16" /> Back
      </button>
      <div v-else />

      <div class="flex items-center gap-3">
        <span class="text-[13px] text-text-muted">Step {{ activeStep + 1 }} of 4</span>
        <button
          v-if="activeStep < 3"
          class="btn btn-primary"
          :disabled="!canProceed"
          @click="goNext"
        >
          Continue <ArrowRight :size="16" />
        </button>
      </div>
    </div>

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
  </div>
</template>

<style scoped>
.wizard-step {
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.step-header {
  margin-bottom: 24px;
}
.step-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px 0;
}
.step-desc {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
}
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
}
</style>
