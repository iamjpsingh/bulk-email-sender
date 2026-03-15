<script setup lang="ts">
import { ref, computed } from 'vue'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import SlidePanel from '../components/ui/SlidePanel.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import Modal from '../components/ui/Modal.vue'
import { pagesApi, formsApi } from '../lib/api'
import type { LandingPage, LandingPageInput, PageTemplate, FormEndpoint } from '../lib/api'
import { useToast } from '../composables/useToast'
import HtmlCodeEditor from '../components/compose/HtmlCodeEditor.vue'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Globe,
  GlobeLock,
  Inbox,
  Loader2,
  BarChart3,
  FileText,
  Copy,
  ExternalLink,
} from 'lucide-vue-next'

const toast = useToast()

// ============================================================================
// State
// ============================================================================

const pages = ref<LandingPage[]>([])
const templates = ref<PageTemplate[]>([])
const forms = ref<FormEndpoint[]>([])
const loading = ref(false)
const showEditor = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })
const showTemplateChooser = ref(false)
const previewUrl = ref('')
const showPreview = ref(false)
const publishedUrl = ref('')
const urlCopied = ref(false)
const editorTab = ref<'content' | 'style'>('content')

const form = ref<LandingPageInput>({
  title: '',
  slug: '',
  template: 'custom',
  html_content: '',
  css_content: '',
  meta_description: '',
  meta_image: '',
  form_id: '',
  tracking_enabled: true,
})

// ============================================================================
// API
// ============================================================================

async function fetchPages() {
  loading.value = true
  try {
    pages.value = await pagesApi.list()
  } catch (err: any) {
    toast.error(err.message || 'Failed to load pages')
  } finally {
    loading.value = false
  }
}

async function fetchTemplates() {
  try {
    templates.value = await pagesApi.getTemplates()
  } catch {
    // non-critical
  }
}

async function fetchForms() {
  try {
    forms.value = await formsApi.list()
  } catch {
    // non-critical
  }
}

async function savePage() {
  saving.value = true
  try {
    if (editingId.value) {
      await pagesApi.update(editingId.value, form.value)
    } else {
      await pagesApi.create(form.value)
    }
    toast.success(editingId.value ? 'Page updated' : 'Page created')
    closeEditor()
    fetchPages()
  } catch (err: any) {
    toast.error(err.message || 'Failed to save page')
  } finally {
    saving.value = false
  }
}

async function publishPage(page: LandingPage) {
  try {
    const url = await pagesApi.publish(page.id)
    publishedUrl.value = url
    toast.success(url ? `Published at ${url}` : 'Page published')
    fetchPages()
  } catch (err: any) {
    toast.error(err.message || 'Failed to publish')
  }
}

async function unpublishPage(page: LandingPage) {
  try {
    await pagesApi.unpublish(page.id)
    toast.success('Page unpublished')
    fetchPages()
  } catch (err: any) {
    toast.error(err.message || 'Failed to unpublish')
  }
}

async function confirmDelete() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
  try {
    await pagesApi.delete(id)
    toast.success('Page deleted')
    fetchPages()
  } catch (err: any) {
    toast.error(err.message || 'Delete failed')
  }
}

function openPreview(page: LandingPage) {
  previewUrl.value = pagesApi.getPreviewUrl(page.id)
  showPreview.value = true
}

function copyUrl(url: string) {
  navigator.clipboard.writeText(url)
  urlCopied.value = true
  toast.success('URL copied')
  setTimeout(() => { urlCopied.value = false }, 2000)
}

// ============================================================================
// Editor
// ============================================================================

function openNewPage() {
  showTemplateChooser.value = true
}

function chooseTemplate(tpl: PageTemplate | null) {
  showTemplateChooser.value = false
  form.value = {
    title: '',
    slug: '',
    template: tpl?.id || 'custom',
    html_content: tpl?.html || '',
    css_content: tpl?.css || '',
    meta_description: '',
    meta_image: '',
    form_id: '',
    tracking_enabled: true,
  }
  editingId.value = null
  editorTab.value = 'content'
  showEditor.value = true
}

function openEditPage(page: LandingPage) {
  form.value = {
    title: page.title,
    slug: page.slug,
    template: page.template,
    html_content: page.html_content,
    css_content: page.css_content,
    meta_description: page.meta_description || '',
    meta_image: page.meta_image || '',
    form_id: page.form_id || '',
    tracking_enabled: !!page.tracking_enabled,
  }
  editingId.value = page.id
  editorTab.value = 'content'
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
  editingId.value = null
}

function generateSlug() {
  form.value.slug = form.value.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Initial fetch
fetchPages()
fetchTemplates()
fetchForms()
</script>

<template>
  <div>
    <PageHeader title="Landing Pages" subtitle="Create and publish landing pages for campaigns">
      <template #actions>
        <button class="btn-primary" @click="openNewPage"><Plus :size="16" /> New Page</button>
      </template>
    </PageHeader>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
      <Skeleton variant="card" :count="4" />
    </div>

    <!-- Empty -->
    <div v-else-if="pages.length === 0" class="bg-bg-card border border-border rounded-xl">
      <EmptyState
        :icon="Inbox"
        title="No landing pages"
        description="Create a landing page for your campaigns"
      >
        <template #actions>
          <button class="btn-primary" @click="openNewPage"><Plus :size="16" /> Create Page</button>
        </template>
      </EmptyState>
    </div>

    <!-- Pages Grid -->
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] max-md:grid-cols-1 gap-4">
      <div
        v-for="page in pages"
        :key="page.id"
        class="bg-bg-card border border-border rounded-xl p-5 flex flex-col gap-3 transition-all duration-150 hover:border-border-hover"
      >
        <div class="flex justify-between items-start gap-3">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-text-primary truncate m-0">{{ page.title }}</h3>
            <p class="text-xs text-text-muted mt-1 m-0 font-mono">/p/{{ page.slug }}</p>
          </div>
          <span
            :class="[
              'shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded-full',
              page.published
                ? 'bg-success/15 text-success'
                : 'bg-surface-3 text-text-muted'
            ]"
          >
            {{ page.published ? 'Published' : 'Draft' }}
          </span>
        </div>

        <div class="flex gap-4 text-xs text-text-secondary flex-wrap">
          <span class="flex items-center gap-1"><BarChart3 :size="12" /> {{ page.visit_count }} visits</span>
          <span>{{ page.template }}</span>
          <span>{{ formatDate(page.updated_at) }}</span>
        </div>

        <!-- Published URL bar -->
        <div v-if="page.published" class="flex items-center gap-2 bg-surface-3/50 rounded-md px-3 py-1.5">
          <span class="text-xs text-text-muted truncate flex-1 font-mono">/p/{{ page.slug }}</span>
          <button class="btn-ghost px-1 py-0.5" title="Copy URL" @click="copyUrl('/p/' + page.slug)">
            <Copy :size="11" />
          </button>
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-border mt-auto">
          <div class="flex gap-1">
            <button class="btn-ghost text-sm px-2 py-1" title="Edit" @click="openEditPage(page)">
              <Pencil :size="14" />
            </button>
            <button class="btn-ghost text-sm px-2 py-1" title="Preview" @click="openPreview(page)">
              <Eye :size="14" />
            </button>
            <button
              v-if="!page.published"
              class="btn-ghost text-sm px-2 py-1 text-success"
              title="Publish"
              @click="publishPage(page)"
            >
              <Globe :size="14" />
            </button>
            <button
              v-else
              class="btn-ghost text-sm px-2 py-1 text-warning"
              title="Unpublish"
              @click="unpublishPage(page)"
            >
              <GlobeLock :size="14" />
            </button>
          </div>
          <button class="btn-ghost text-sm px-2 py-1 text-danger" title="Delete" @click="deleteConfirm = { show: true, id: page.id }">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :show="deleteConfirm.show"
      title="Delete Page"
      message="Delete this landing page? This cannot be undone."
      confirmText="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteConfirm.show = false"
    />

    <!-- Template Chooser Modal -->
  <Modal :show="showTemplateChooser" title="Choose a Template" size="lg" @close="showTemplateChooser = false">
    <div class="grid grid-cols-2 max-md:grid-cols-1 gap-4">
      <div
        class="bg-surface-2 border border-border rounded-xl p-5 flex flex-col items-center gap-3 cursor-pointer hover:border-accent transition-colors"
        @click="chooseTemplate(null)"
      >
        <FileText :size="32" class="text-text-muted" />
        <span class="text-sm font-semibold text-text-primary">Blank Page</span>
        <span class="text-xs text-text-muted text-center">Start from scratch</span>
      </div>
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="bg-surface-2 border border-border rounded-xl p-5 flex flex-col items-center gap-3 cursor-pointer hover:border-accent transition-colors"
        @click="chooseTemplate(tpl)"
      >
        <FileText :size="32" class="text-accent" />
        <span class="text-sm font-semibold text-text-primary">{{ tpl.name }}</span>
        <span class="text-xs text-text-muted text-center">Pre-built template</span>
      </div>
    </div>
  </Modal>

  <!-- Page Editor Panel -->
  <SlidePanel :show="showEditor" :title="editingId ? 'Edit Page' : 'New Page'" size="xl" @close="closeEditor">
    <div class="flex flex-col gap-5 -m-6 h-[calc(100%+48px)]">
      <!-- Top fields -->
      <div class="p-5 pb-0 shrink-0">
        <div class="grid grid-cols-[1fr_1fr_auto] max-md:grid-cols-1 gap-3 mb-3">
          <div>
            <label class="form-label">Page Title *</label>
            <input v-model="form.title" type="text" class="form-input" placeholder="My Landing Page" @blur="!editingId && !form.slug && generateSlug()" />
          </div>
          <div>
            <label class="form-label">Slug *</label>
            <div class="flex items-center gap-1">
              <span class="text-text-muted text-sm">/p/</span>
              <input v-model="form.slug" type="text" class="form-input flex-1" placeholder="my-page" />
            </div>
          </div>
          <div>
            <label class="form-label">Linked Form</label>
            <select v-model="form.form_id" class="form-select">
              <option value="">None</option>
              <option v-for="f in forms" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 max-md:grid-cols-1 gap-3">
          <div>
            <label class="form-label">Meta Description</label>
            <input v-model="form.meta_description" type="text" class="form-input" placeholder="SEO description" />
          </div>
          <div>
            <label class="form-label">Social Image URL</label>
            <input v-model="form.meta_image" type="url" class="form-input" placeholder="https://..." />
          </div>
        </div>

        <!-- Tab switcher for content/style -->
        <div class="flex gap-1 mt-4">
          <button
            :class="['px-3 py-1.5 text-xs font-medium rounded-md transition-colors', editorTab === 'content' ? 'bg-accent text-white' : 'bg-surface-3 text-text-secondary hover:text-text-primary']"
            @click="editorTab = 'content'"
          >
            HTML
          </button>
          <button
            :class="['px-3 py-1.5 text-xs font-medium rounded-md transition-colors', editorTab === 'style' ? 'bg-accent text-white' : 'bg-surface-3 text-text-secondary hover:text-text-primary']"
            @click="editorTab = 'style'"
          >
            CSS
          </button>
        </div>
      </div>

      <!-- Editor area -->
      <div class="flex-1 px-5 min-h-0">
        <HtmlCodeEditor
          v-if="editorTab === 'content'"
          :content="form.html_content"
          @update:content="form.html_content = $event"
          class="h-full!"
        />
        <HtmlCodeEditor
          v-else
          :content="form.css_content || ''"
          @update:content="form.css_content = $event"
          class="h-full!"
        />
      </div>

      <!-- Footer -->
      <div class="flex justify-between items-center px-5 py-4 border-t border-border shrink-0">
        <div class="flex items-center gap-3">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="form.tracking_enabled" class="sr-only peer" />
            <div class="w-9 h-5 bg-surface-3 rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
          <span class="text-xs text-text-muted">Track visits</span>
        </div>
        <div class="flex gap-3">
          <button class="btn-ghost" @click="closeEditor">Cancel</button>
          <button class="btn-primary" @click="savePage" :disabled="saving || !form.title || !form.slug">
            <Loader2 v-if="saving" :size="16" class="spin" />
            {{ editingId ? 'Update' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </SlidePanel>

  <!-- Preview Modal -->
  <Modal :show="showPreview" title="Page Preview" size="xl" @close="showPreview = false">
    <div class="bg-white rounded-lg overflow-hidden -m-6" style="height: 70vh">
      <iframe :src="previewUrl" class="w-full h-full border-none" sandbox="allow-same-origin allow-scripts" />
    </div>
  </Modal>
  </div>
</template>
