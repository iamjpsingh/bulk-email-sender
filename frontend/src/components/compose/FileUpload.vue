<script setup lang="ts">
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, FileText, X, Download, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  excelFile: File | null
  htmlTemplate: File | null
}>()

const emit = defineEmits(['update:excelFile', 'update:htmlTemplate', 'contactsLoaded'])

const excelInput = ref<HTMLInputElement>()
const htmlInput = ref<HTMLInputElement>()
const contactCount = ref(0)
const columns = ref<string[]>([])
const error = ref('')

async function handleExcelChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  error.value = ''
  emit('update:excelFile', file)
  
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      error.value = 'Excel file has no sheets'
      return
    }
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      error.value = 'Excel sheet not found'
      return
    }
    const json = XLSX.utils.sheet_to_json(sheet)
    
    if (json.length === 0) {
      error.value = 'Excel file is empty'
      return
    }
    
    // Check for Email column
    const firstRow = json[0] as any
    if (!firstRow.Email && !firstRow.email) {
      error.value = 'Excel must have an "Email" column'
      return
    }
    
    columns.value = Object.keys(firstRow)
    contactCount.value = json.length
    emit('contactsLoaded', json)
  } catch (err) {
    error.value = 'Failed to parse Excel file'
  }
}

function handleHtmlChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  emit('update:htmlTemplate', file || null)
}

function clearExcel() {
  emit('update:excelFile', null)
  contactCount.value = 0
  columns.value = []
  if (excelInput.value) excelInput.value.value = ''
  emit('contactsLoaded', [])
}

function clearHtml() {
  emit('update:htmlTemplate', null)
  if (htmlInput.value) htmlInput.value.value = ''
}
</script>

<template>
  <div class="file-upload glass-card">
    <h3>
      <FileSpreadsheet :size="18" class="header-icon" />
      File Uploads
    </h3>
    
    <!-- Excel upload -->
    <div class="upload-section">
      <label class="form-label">Contacts (Excel) *</label>
      <div class="upload-area" @click="excelInput?.click()">
        <input
          ref="excelInput"
          type="file"
          accept=".xlsx,.xls"
          @change="handleExcelChange"
          hidden
        />
        <div v-if="!excelFile" class="upload-placeholder">
          <FileSpreadsheet :size="32" class="upload-icon" />
          <span>Click to upload Excel file</span>
          <span class="text-muted text-sm">Required: Email column</span>
        </div>
        <div v-else class="upload-file">
          <FileSpreadsheet :size="24" class="file-icon" />
          <div class="file-info">
            <span class="file-name">{{ excelFile.name }}</span>
            <span class="file-meta">{{ contactCount }} contacts</span>
          </div>
          <button class="btn btn-ghost btn-sm" @click.stop="clearExcel">
            <X :size="16" />
          </button>
        </div>
      </div>
      
      <div v-if="error" class="upload-error">
        <AlertCircle :size="16" />
        {{ error }}
      </div>
      
      <div v-if="columns.length > 0" class="columns-preview">
        <span class="text-muted text-sm">Available placeholders:</span>
        <div class="columns-list">
          <code v-for="col in columns" :key="col">{{ '{{' + col + '}}' }}</code>
        </div>
      </div>
      
      <a href="/public/samples/sample-contacts.xlsx" class="btn btn-ghost btn-sm mt-2" download>
        <Download :size="14" />
        Download Sample
      </a>
    </div>
    
    <!-- HTML template upload -->
    <div class="upload-section">
      <label class="form-label">HTML Template (Optional)</label>
      <div class="upload-area small" @click="htmlInput?.click()">
        <input
          ref="htmlInput"
          type="file"
          accept=".html"
          @change="handleHtmlChange"
          hidden
        />
        <div v-if="!htmlTemplate" class="upload-placeholder">
          <FileText :size="20" />
          <span>Upload HTML template</span>
        </div>
        <div v-else class="upload-file">
          <FileText :size="20" class="file-icon" />
          <span class="file-name">{{ htmlTemplate.name }}</span>
          <button class="btn btn-ghost btn-sm" @click.stop="clearHtml">
            <X :size="16" />
          </button>
        </div>
      </div>
      <p class="text-muted text-sm mt-2">Overrides editor content if provided</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.file-upload {
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

.upload-section {
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.upload-area {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--accent-primary);
    background: rgba(6, 182, 212, 0.05);
  }
  
  &.small {
    padding: 16px;
  }
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  
  .upload-icon {
    color: var(--text-muted);
  }
}

.upload-file {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .file-icon {
    color: var(--accent-primary);
  }
  
  .file-info {
    flex: 1;
    text-align: left;
  }
  
  .file-name {
    display: block;
    font-size: 14px;
    color: var(--text-primary);
  }
  
  .file-meta {
    font-size: 12px;
    color: var(--text-muted);
  }
}

.upload-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: 13px;
}

.columns-preview {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.columns-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  
  code {
    padding: 4px 8px;
    background: var(--bg-primary);
    border-radius: 4px;
    font-size: 12px;
    color: var(--accent-primary);
  }
}
</style>
