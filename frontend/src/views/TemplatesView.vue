<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MainLayout from '../components/layout/MainLayout.vue'
import { templatesApi } from '../lib/api'
import type { Template as TemplateType } from '../lib/api'
import { useToast } from '../composables/useToast'
import { FileText, Plus, Pencil, Trash2, Copy, Search, X, Loader2, Inbox, Eye } from 'lucide-vue-next'

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

async function deleteTemplate(id: string) {
  if (!confirm('Delete this template?')) return
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
  <MainLayout>
    <header class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-[28px] font-bold mb-1 text-text-primary">Templates</h1>
        <p class="text-text-muted">Create and manage reusable email templates</p>
      </div>
      <button class="btn-primary" @click="openNewTemplate"><Plus :size="18" /> New Template</button>
    </header>

    <!-- Search + Filter -->
    <div class="flex flex-col gap-4 mb-6">
      <div class="relative">
        <Search :size="18" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input v-model="searchQuery" type="text" class="form-input pl-[42px]" placeholder="Search templates..." />
      </div>
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="cat in categories"
          :key="cat"
          class="px-4 py-2 text-[13px] font-medium font-sans border border-border rounded-lg bg-transparent text-text-secondary cursor-pointer transition-all duration-200 hover:border-accent hover:text-accent hover:bg-accent/5"
          :class="{
            '!bg-gradient-to-br !from-accent/20 !to-teal-500/10 !border-border-glow !text-accent':
              activeCategory === cat,
          }"
          @click="activeCategory = cat"
        >
          {{ categoryLabel(cat) }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center gap-3 py-12 text-text-muted">
      <Loader2 :size="24" class="spin" /> Loading templates...
    </div>

    <!-- Empty -->
    <div v-else-if="filteredTemplates.length === 0 && !loading" class="glass-card text-center py-16 px-6">
      <Inbox :size="64" class="text-text-muted mb-4 mx-auto" />
      <h3 class="mb-2 text-text-primary">No templates found</h3>
      <p class="text-text-muted">
        {{
          searchQuery || activeCategory !== 'all'
            ? 'Try adjusting your filters'
            : 'Create your first template to get started'
        }}
      </p>
      <button v-if="!searchQuery && activeCategory === 'all'" class="btn-primary mt-4" @click="openNewTemplate">
        <Plus :size="18" /> Create Template
      </button>
    </div>

    <!-- Template Grid -->
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] max-[768px]:grid-cols-1 gap-5">
      <div
        v-for="tpl in filteredTemplates"
        :key="tpl.id"
        class="glass-card p-5 flex flex-col gap-2 transition-all duration-200 hover:border-border-glow hover:shadow-[var(--shadow-glow)]"
      >
        <div class="flex justify-between items-center gap-3">
          <h3 class="text-base font-semibold m-0 truncate">{{ tpl.name }}</h3>
          <span class="badge-info">{{ categoryLabel(tpl.category) }}</span>
        </div>
        <p class="text-sm text-text-secondary m-0 truncate">{{ tpl.subject || 'No subject' }}</p>
        <p v-if="tpl.description" class="text-text-muted text-sm m-0 truncate">{{ tpl.description }}</p>
        <div class="flex justify-between items-center mt-auto pt-3 border-t border-border">
          <span class="text-text-muted text-sm">{{ formatDate(tpl.updated_at) }}</span>
          <div class="flex gap-0.5">
            <button class="btn-ghost text-sm px-2 py-1" title="Edit" @click="openEditTemplate(tpl)">
              <Pencil :size="15" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1" title="Duplicate" @click="duplicateTemplate(tpl)">
              <Copy :size="15" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1 text-danger" title="Delete" @click="deleteTemplate(tpl.id)">
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Starter Templates -->
    <section v-if="starters.length > 0" class="mt-6 mb-8">
      <h2 class="flex items-center gap-2.5 text-lg mb-2 text-text-primary">
        <FileText :size="20" /> Starter Templates
      </h2>
      <p class="text-text-muted text-sm">Clone a pre-built template to get started quickly</p>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 mt-4">
        <div v-for="s in starters" :key="s.id" class="glass-card p-4 flex flex-col gap-2.5">
          <div class="flex justify-between items-center gap-2">
            <h4 class="text-[15px] font-semibold m-0 truncate">{{ s.name }}</h4>
            <span class="badge-info">{{ categoryLabel(s.category) }}</span>
          </div>
          <p class="text-text-muted text-sm">{{ s.description }}</p>
          <button class="btn-secondary text-sm px-3 py-1.5" @click="cloneStarter(s)"><Copy :size="14" /> Clone</button>
        </div>
      </div>
    </section>
  </MainLayout>

  <!-- Editor Slide-out -->
  <Transition name="slideout">
    <div v-if="showEditor" class="fixed inset-0 bg-black/70 z-[1000] flex justify-end" @click.self="closeEditor">
      <div
        class="glass-card w-[90vw] max-w-[1100px] h-screen flex flex-col rounded-none border-l border-border overflow-hidden max-[768px]:w-screen"
      >
        <div class="flex justify-between items-center px-6 py-5 border-b border-border shrink-0">
          <h2 class="text-lg font-semibold m-0">{{ editingId ? 'Edit Template' : 'New Template' }}</h2>
          <button class="btn-ghost text-sm px-2 py-1" @click="closeEditor"><X :size="18" /></button>
        </div>
        <div class="flex flex-1 overflow-hidden max-[768px]:flex-col">
          <div class="flex-1 p-6 overflow-y-auto flex flex-col border-r border-border">
            <div class="form-group">
              <label class="form-label">Name *</label>
              <input v-model="form.name" type="text" class="form-input" placeholder="Template name" required />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input v-model="form.description" type="text" class="form-input" placeholder="Brief description" />
            </div>
            <div class="grid grid-cols-2 max-[768px]:grid-cols-1 gap-4">
              <div class="form-group">
                <label class="form-label">Category</label>
                <select v-model="form.category" class="form-select">
                  <option v-for="cat in categories.filter((c) => c !== 'all')" :key="cat" :value="cat">
                    {{ categoryLabel(cat) }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Subject Line *</label>
                <input v-model="form.subject" type="text" class="form-input" placeholder="Email subject" required />
              </div>
            </div>
            <div class="form-group flex-1 flex flex-col">
              <label class="form-label">HTML Content</label>
              <textarea
                v-model="form.html_content"
                class="form-input flex-1 min-h-[200px] font-mono text-[13px] leading-relaxed resize-none whitespace-pre overflow-x-auto"
                style="tab-size: 2; overflow-wrap: normal"
                placeholder="<html>&#10;  <body>&#10;    <h1>Hello {{FirstName}}</h1>&#10;  </body>&#10;</html>"
                spellcheck="false"
              ></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-5 border-t border-border mt-4 shrink-0">
              <button class="btn-ghost" @click="closeEditor">Cancel</button>
              <button class="btn-secondary" @click="updatePreview" :disabled="!form.html_content">
                <Eye :size="16" /> Preview
              </button>
              <button class="btn-primary" @click="saveTemplate" :disabled="saving || !form.name || !form.subject">
                <Loader2 v-if="saving" :size="16" class="spin" />
                {{ editingId ? 'Update' : 'Create' }}
              </button>
            </div>
          </div>
          <div class="w-[45%] max-[768px]:w-full max-[768px]:h-[300px] flex flex-col overflow-hidden">
            <div class="px-5 py-3 border-b border-border shrink-0">
              <span class="text-text-muted text-sm">Live Preview</span>
            </div>
            <div class="flex-1 overflow-hidden bg-white">
              <iframe
                v-if="previewHtml"
                :srcdoc="previewHtml"
                sandbox="allow-same-origin"
                class="w-full h-full border-none"
              ></iframe>
              <div v-else class="flex flex-col items-center justify-center h-full gap-3 bg-bg-secondary">
                <Eye :size="32" class="text-text-muted" />
                <p class="text-text-muted text-sm">Write HTML to see a live preview</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slideout-enter-active,
.slideout-leave-active {
  transition: all 0.3s ease;
}
.slideout-enter-active .glass-card,
.slideout-leave-active .glass-card {
  transition: transform 0.3s ease;
}
.slideout-enter-from,
.slideout-leave-to {
  background: rgba(0, 0, 0, 0);
}
.slideout-enter-from .glass-card,
.slideout-leave-to .glass-card {
  transform: translateX(100%);
}
</style>
