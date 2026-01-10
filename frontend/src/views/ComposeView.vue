<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../stores/auth'
import { useConfigs } from '../lib/query'
import { emailApi } from '../lib/api'
import DateTimeInput from '../components/ui/DateTimeInput.vue'
import EmailEditor from '../components/compose/EmailEditor.vue'
import {
  Send,
  Calendar,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Users,
  Upload,
  Settings,
  Mail,
  LayoutDashboard,
  BarChart3,
  LogOut,
  Clock,
  Zap,
  Eye,
  EyeOff,
  TrendingUp
} from 'lucide-vue-next'

const { user, logout } = useAuth()

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

// Get preview contact (first contact or sample)
const previewContact = computed(() => {
  if (contacts.value.length > 0) {
    return contacts.value[previewContactIndex.value] || contacts.value[0]
  }
  // Sample contact if no contacts loaded
  return {
    Email: 'john@example.com',
    FirstName: 'John',
    LastName: 'Doe',
    Company: 'Acme Inc',
    Name: 'John Doe'
  }
})

// Find email field in contact (could be Email, email, E-mail, etc.)
const getContactEmail = (contact: Record<string, any>): string => {
  const emailKeys = ['Email', 'email', 'EMAIL', 'E-mail', 'e-mail', 'EmailAddress', 'email_address']
  for (const key of emailKeys) {
    if (contact[key] && contact[key].includes('@')) {
      return contact[key]
    }
  }
  // Fallback: find any field with @ symbol
  for (const value of Object.values(contact)) {
    if (typeof value === 'string' && value.includes('@')) {
      return value
    }
  }
  return ''
}

// Find name field in contact
const getContactName = (contact: Record<string, any>): string => {
  if (contact.FirstName) {
    return `${contact.FirstName} ${contact.LastName || ''}`.trim()
  }
  if (contact.Name) return contact.Name
  if (contact.name) return contact.name
  if (contact.FullName) return contact.FullName
  if (contact.full_name) return contact.full_name
  return ''
}

const previewToEmail = computed(() => getContactEmail(previewContact.value))
const previewToName = computed(() => getContactName(previewContact.value))

// Replace placeholders in content for preview
const previewSubject = computed(() => {
  return replacePlaceholders(subject.value, previewContact.value)
})

const previewContent = computed(() => {
  return replacePlaceholders(htmlContent.value, previewContact.value)
})

function replacePlaceholders(text: string, contact: Record<string, any>): string {
  if (!text) return ''
  let result = text
  for (const [key, value] of Object.entries(contact)) {
    const placeholder = `{{${key}}}`
    result = result.split(placeholder).join(value || '')
  }
  return result
}

function nextPreviewContact() {
  if (contacts.value.length > 0) {
    previewContactIndex.value = (previewContactIndex.value + 1) % contacts.value.length
  }
}

function prevPreviewContact() {
  if (contacts.value.length > 0) {
    previewContactIndex.value = previewContactIndex.value === 0 
      ? contacts.value.length - 1 
      : previewContactIndex.value - 1
  }
}

const selectedCount = computed(() => {
  if (contacts.value.length === 0) return 0
  if (rangeType.value === 'all') return contacts.value.length
  if (rangeType.value === 'first') return Math.min(firstN.value, contacts.value.length)
  return Math.min(rangeTo.value - rangeFrom.value + 1, contacts.value.length)
})

const canSend = computed(() => {
  return selectedConfigId.value && 
         subject.value.trim() && 
         contacts.value.length > 0 &&
         htmlContent.value.trim()
})

async function handleLogout() {
  await logout()
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    excelFile.value = file
    parseExcelFile(file)
  }
}

async function parseExcelFile(file: File) {
  try {
    // Use xlsx library for proper Excel/CSV parsing
    const XLSX = await import('xlsx')
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      console.error('No sheets found in workbook')
      return
    }
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) {
      console.error('Worksheet not found')
      return
    }
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (jsonData.length < 2) {
      console.error('File must have at least a header row and one data row')
      return
    }
    
    // First row is headers (column names)
    const headerRow = jsonData[0]
    if (!headerRow) {
      console.error('No header row found')
      return
    }
    const headers = headerRow.map((h: any) => String(h).trim())
    columns.value = headers
    
    // Parse contacts from remaining rows
    const parsedContacts = []
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.length === 0) continue
      
      const contact: Record<string, any> = {}
      headers.forEach((header, index) => {
        contact[header] = row[index] !== undefined ? String(row[index]).trim() : ''
      })
      
      // Only add if has at least email-like field
      const hasEmail = Object.values(contact).some(v => 
        typeof v === 'string' && v.includes('@')
      )
      if (hasEmail || Object.values(contact).some(v => v)) {
        parsedContacts.push(contact)
      }
    }
    
    contacts.value = parsedContacts
  } catch (err) {
    console.error('Error parsing file:', err)
    // Fallback to simple CSV parsing
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    
    if (lines.length < 2) return
    
    const headerLine = lines[0]
    if (!headerLine) return
    
    const headers = headerLine.split(',').map(h => h.trim())
    columns.value = headers
    
    const parsedContacts = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const values = line.split(',')
      const contact: Record<string, any> = {}
      headers.forEach((header, index) => {
        contact[header] = values[index]?.trim() || ''
      })
      parsedContacts.push(contact)
    }
    
    contacts.value = parsedContacts
  }
}

async function handleSend() {
  if (!canSend.value) return
  
  sending.value = true
  result.value = null
  
  const formData = new FormData()
  
  // Config
  const config = smtpConfigs.value.find((c) => c.id === selectedConfigId.value)
  if (!config) {
    result.value = { success: false, message: 'No SMTP config selected' }
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
  } catch (err: any) {
    result.value = { success: false, message: err.message || 'Failed to send emails' }
  } finally {
    sending.value = false
  }
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
      <div class="compose-view fade-in">
        
        <header class="page-header">
          <div>
            <h1>Compose Campaign</h1>
            <p class="text-muted">Create and send bulk email campaigns</p>
          </div>
        </header>
        
        <!-- Result message -->
        <div v-if="result" class="result-message" :class="result.success ? 'success' : 'error'">
          <CheckCircle v-if="result.success" :size="24" />
          <XCircle v-else :size="24" />
          <div>
            <strong>{{ result.success ? 'Success!' : 'Error' }}</strong>
            <p>{{ result.message }}</p>
          </div>
          <button class="btn btn-ghost btn-sm" @click="result = null">
            <X :size="16" />
          </button>
        </div>
        
        <div class="compose-grid">
          <!-- Left column -->
          <div class="compose-left">
            <!-- Email Config selector -->
            <div class="section glass-card">
              <h3>
                <Settings :size="18" class="header-icon" />
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
              <p v-if="smtpConfigs.length === 0" class="text-muted" style="font-size: 13px; margin-top: 8px;">
                No configs found. <router-link to="/configs" class="text-accent">Create one</router-link>
              </p>
            </div>
            
            <!-- File upload -->
            <div class="section glass-card">
              <h3>
                <Upload :size="18" class="header-icon" />
                Upload Contacts
              </h3>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                @change="handleFileUpload"
                class="form-input"
              />
              <p v-if="contacts.length > 0" class="text-success" style="font-size: 13px; margin-top: 8px;">
                ✅ {{ contacts.length }} contacts loaded
              </p>
              <p class="text-muted" style="font-size: 13px; margin-top: 8px;">
                Upload CSV or Excel file with Name, Email columns
              </p>
            </div>
            
            <!-- Range selector -->
            <div v-if="contacts.length > 0" class="section glass-card">
              <h3>
                <Users :size="18" class="header-icon" />
                Email Range
              </h3>
              <div class="range-options">
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
              
              <div v-if="rangeType === 'first'" class="range-input">
                <input v-model.number="firstN" type="number" class="form-input" min="1" :max="contacts.length" />
              </div>
              
              <div v-if="rangeType === 'range'" class="range-inputs">
                <input v-model.number="rangeFrom" type="number" class="form-input" min="1" placeholder="From" />
                <span>to</span>
                <input v-model.number="rangeTo" type="number" class="form-input" min="1" placeholder="To" />
              </div>
              
              <div class="range-preview">
                Will send to <strong class="text-accent">{{ selectedCount }}</strong> contacts
              </div>
            </div>
            
            <!-- Batch settings -->
            <div class="section glass-card">
              <h3>
                <Zap :size="18" class="header-icon" />
                Batch Settings
              </h3>
              <label class="form-checkbox">
                <input type="checkbox" v-model="useBatch" />
                <span>Enable batch sending</span>
              </label>
              
              <div v-if="useBatch" class="batch-settings">
                <div class="form-group">
                  <label class="form-label">Batch Size</label>
                  <input v-model.number="batchSize" type="number" class="form-input" min="1" max="100" />
                </div>
                <div class="form-group">
                  <label class="form-label">Batch Delay (seconds)</label>
                  <input v-model.number="batchDelay" type="number" class="form-input" min="1" />
                </div>
                <div class="form-group">
                  <label class="form-label">Email Delay (seconds)</label>
                  <input v-model.number="emailDelay" type="number" class="form-input" min="1" />
                </div>
              </div>
            </div>
            
            <!-- Schedule settings -->
            <div class="section glass-card">
              <h3>
                <Clock :size="18" class="header-icon" />
                Schedule Settings
              </h3>
              <label class="form-checkbox">
                <input type="checkbox" v-model="useSchedule" />
                <span>Schedule for later</span>
              </label>
              
              <div v-if="useSchedule" class="schedule-settings">
                <div class="form-group">
                  <label class="form-label">Scheduled Time</label>
                  <DateTimeInput v-model="scheduledTime" placeholder="Select date and time" />
                </div>
                <div class="form-group">
                  <label class="form-label">Notification Email (optional)</label>
                  <input v-model="notifyEmail" type="email" class="form-input" placeholder="notify@example.com" />
                </div>
              </div>
            </div>
          </div>
          
          <!-- Right column - Editor -->
          <div class="compose-right">
            <!-- Email editor -->
            <EmailEditor
              v-model:subject="subject"
              v-model:content="htmlContent"
              v-model:delay="delay"
              :columns="columns"
              @preview="showPreview = true"
            />
            
            <!-- Send button -->
            <div class="send-section glass-card">
              <button
                class="btn btn-primary btn-lg"
                :disabled="!canSend || sending"
                @click="handleSend"
              >
                <Loader2 v-if="sending" :size="18" class="spin" />
                <Calendar v-else-if="useSchedule" :size="18" />
                <Send v-else :size="18" />
                {{ useSchedule ? 'Schedule' : 'Send' }} to {{ selectedCount }} contacts
              </button>
              
              <p v-if="!canSend" class="send-hint text-muted">
                <span v-if="!selectedConfigId">Select an SMTP config</span>
                <span v-else-if="!subject.trim()">Enter a subject</span>
                <span v-else-if="contacts.length === 0">Upload contacts</span>
                <span v-else>Add email content</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
    
    <!-- Email Preview Modal -->
    <Teleport to="body">
      <div v-if="showPreview" class="preview-overlay" @click.self="showPreview = false">
        <div class="preview-modal">
          <div class="preview-header">
            <h2>
              <Eye :size="20" />
              Email Preview
            </h2>
            <button class="btn btn-ghost btn-sm" @click="showPreview = false">
              <X :size="20" />
            </button>
          </div>
          
          <!-- Contact selector -->
          <div class="preview-contact-selector" v-if="contacts.length > 0">
            <button class="btn btn-ghost btn-sm" @click="prevPreviewContact" :disabled="contacts.length <= 1">
              ←
            </button>
            <span class="contact-info">
              <strong>{{ previewToName || previewToEmail || 'Contact' }}</strong>
              <span class="text-muted">({{ previewContactIndex + 1 }} of {{ contacts.length }})</span>
            </span>
            <button class="btn btn-ghost btn-sm" @click="nextPreviewContact" :disabled="contacts.length <= 1">
              →
            </button>
          </div>
          <div v-else class="preview-contact-selector sample">
            <span class="text-muted">Using sample data (upload contacts to preview with real data)</span>
          </div>
          
          <!-- Email preview -->
          <div class="preview-email">
            <div class="preview-email-header">
              <div class="preview-row">
                <span class="preview-label">From:</span>
                <span>{{ smtpConfigs.find(c => c.id === selectedConfigId)?.from_name || smtpConfigs.find(c => c.id === selectedConfigId)?.name || 'Your Name' }} &lt;{{ smtpConfigs.find(c => c.id === selectedConfigId)?.from_email || smtpConfigs.find(c => c.id === selectedConfigId)?.oauth_email || 'you@example.com' }}&gt;</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">To:</span>
                <span v-if="previewToEmail">
                  <template v-if="previewToName">
                    {{ previewToName }} &lt;{{ previewToEmail }}&gt;
                  </template>
                  <template v-else>
                    {{ previewToEmail }}
                  </template>
                </span>
                <span v-else class="text-muted">(No email found in contact)</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Subject:</span>
                <span class="preview-subject">{{ previewSubject || '(No subject)' }}</span>
              </div>
            </div>
            
            <div class="preview-email-body">
              <div v-if="previewContent" v-html="previewContent"></div>
              <div v-else class="preview-empty">
                <Mail :size="48" />
                <p>No content yet. Start writing your email!</p>
              </div>
            </div>
          </div>
          
          <div class="preview-footer">
            <button class="btn btn-secondary" @click="showPreview = false">
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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

.compose-view {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
  
  h1 {
    font-size: 28px;
    margin-bottom: 4px;
  }
}

.result-message {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  
  &.success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: var(--success);
  }
  
  &.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--danger);
  }
  
  > div {
    flex: 1;
    
    strong {
      display: block;
      margin-bottom: 4px;
    }
    
    p {
      font-size: 14px;
      opacity: 0.8;
      margin: 0;
    }
  }
}

.compose-grid {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.compose-left {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.compose-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  padding: 20px;
  
  h3 {
    font-size: 15px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .header-icon {
    color: var(--accent-primary);
  }
}

.range-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.range-input {
  margin-bottom: 12px;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  
  input {
    width: 100px;
  }
  
  span {
    color: var(--text-muted);
  }
}

.range-preview {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--text-secondary);
}

.batch-settings, .schedule-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.send-section {
  text-align: center;
  padding: 24px;
}

.send-hint {
  margin-top: 12px;
  font-size: 13px;
}

// Preview Modal
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.preview-modal {
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  
  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    margin: 0;
    color: var(--text-primary);
  }
}

.preview-contact-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  
  &.sample {
    padding: 16px 24px;
  }
  
  .contact-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
}

.preview-email {
  flex: 1;
  overflow-y: auto;
  background: #ffffff;
}

.preview-email-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.preview-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #374151;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.preview-label {
  font-weight: 600;
  color: #6b7280;
  min-width: 60px;
}

.preview-subject {
  font-weight: 600;
  color: #111827;
}

.preview-email-body {
  padding: 24px;
  min-height: 300px;
  color: #111827;
  font-size: 15px;
  line-height: 1.6;
  
  // Reset styles for email content
  h1, h2, h3, h4, h5, h6 {
    color: #111827;
    margin-bottom: 12px;
  }
  
  p {
    margin-bottom: 12px;
    color: #374151;
  }
  
  a {
    color: #2563eb;
  }
  
  img {
    max-width: 100%;
    height: auto;
  }
  
  ul, ol {
    margin-bottom: 12px;
    padding-left: 24px;
  }
  
  blockquote {
    border-left: 4px solid #e5e7eb;
    padding-left: 16px;
    margin: 16px 0;
    color: #6b7280;
  }
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #9ca3af;
  
  p {
    margin-top: 16px;
    color: #9ca3af;
  }
}

.preview-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
  display: flex;
  justify-content: flex-end;
}
</style>
