<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  useConfigs,
  useCreateConfig,
  useUpdateConfig,
  useDeleteConfig,
  useTestConfig,
  useTestConnection,
} from '../../lib/query'
import { useToast } from '../../composables/useToast'
import type { SMTPConfig } from '../../lib/api'
import Modal from '../../components/ui/Modal.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import { Plus, Pencil, Trash2, Plug, Server, Check, X, Loader2, Inbox } from 'lucide-vue-next'

const toast = useToast()
const { data: configs, isLoading: loading } = useConfigs()

const createMutation = useCreateConfig()
const updateMutation = useUpdateConfig()
const deleteMutation = useDeleteConfig()
const testMutation = useTestConfig()
const testConnectionMutation = useTestConnection()

const smtpConfigs = computed(() => (configs.value || []).filter((c) => c.provider_type === 'smtp'))

const showForm = ref(false)
const editingId = ref<string | null>(null)
const testResult = ref<{ id: string; success: boolean; message: string } | null>(null)
const formTestResult = ref<{ success: boolean; message: string } | null>(null)
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })

const form = ref({
  name: '', host: 'smtp.gmail.com', port: 587, secure: false,
  user: '', pass: '', from_email: '', from_name: '', is_default: false,
})

function resetForm() {
  form.value = {
    name: '', host: 'smtp.gmail.com', port: 587, secure: false,
    user: '', pass: '', from_email: '', from_name: '', is_default: false,
  }
  editingId.value = null
  showForm.value = false
  formTestResult.value = null
}

function openAddForm() {
  showForm.value = true
  editingId.value = null
}

function editConfig(config: SMTPConfig) {
  form.value = {
    name: config.name, host: config.host || 'smtp.gmail.com',
    port: config.port || 587, secure: config.secure || false,
    user: config.user || '', pass: '',
    from_email: config.from_email, from_name: config.from_name || '',
    is_default: config.is_default,
  }
  editingId.value = config.id
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingId.value) {
      await updateMutation.mutateAsync({ id: editingId.value, ...form.value })
      toast.success('Configuration updated!')
    } else {
      await createMutation.mutateAsync(form.value)
      toast.success('Configuration created!')
    }
    resetForm()
  } catch (err: any) {
    toast.error(err.message || 'Failed to save')
  }
}

async function testFormConnection() {
  if (!form.value.host || !form.value.user || !form.value.pass) {
    toast.error('Fill in host, username, and password first')
    return
  }
  formTestResult.value = null
  try {
    const result = await testConnectionMutation.mutateAsync({
      host: form.value.host, port: form.value.port,
      secure: form.value.secure, user: form.value.user, pass: form.value.pass,
    })
    formTestResult.value = result
    if (result.success) toast.success('Connection successful!')
  } catch (err: any) {
    formTestResult.value = { success: false, message: err.message || 'Test failed' }
  }
}

function promptDelete(id: string) {
  deleteConfirm.value = { show: true, id }
}

async function confirmDeleteConfig() {
  const id = deleteConfirm.value.id
  deleteConfirm.value = { show: false, id: '' }
  try {
    await deleteMutation.mutateAsync(id)
    toast.success('Configuration deleted')
  } catch (err: any) {
    toast.error(err.message || 'Delete failed')
  }
}

async function handleTest(config: SMTPConfig) {
  testResult.value = null
  try {
    const result = await testMutation.mutateAsync(config.id)
    testResult.value = { id: config.id, ...result }
    setTimeout(() => {
      if (testResult.value?.id === config.id) testResult.value = null
    }, 5000)
  } catch (err: any) {
    testResult.value = { id: config.id, success: false, message: err.message || 'Test failed' }
  }
}
</script>

<template>
  <div>
    <div class="flex justify-between items-start mb-5">
      <div>
        <h2 class="flex items-center gap-2.5 text-base font-semibold text-text-primary mb-1">
          <Server :size="18" class="text-accent" /> SMTP Configurations
        </h2>
        <p class="text-text-muted text-sm">Traditional SMTP server configurations</p>
      </div>
      <button class="btn-secondary" @click="openAddForm()"><Plus :size="16" /> Add SMTP</button>
    </div>

    <!-- Form Modal -->
    <Modal :show="showForm" :title="`${editingId ? 'Edit' : 'New'} SMTP Configuration`" size="md" @close="resetForm">
      <form id="smtp-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input v-model="form.name" type="text" class="form-input" placeholder="My Gmail" required />
        </div>
        <div class="flex gap-3">
          <div class="form-group flex-1">
            <label class="form-label">SMTP Host *</label>
            <input v-model="form.host" type="text" class="form-input" placeholder="smtp.gmail.com" required />
          </div>
          <div class="form-group w-[120px]">
            <label class="form-label">Port *</label>
            <input v-model.number="form.port" type="number" class="form-input" required />
          </div>
        </div>
        <label class="form-checkbox mb-4">
          <input v-model="form.secure" type="checkbox" /><span>Use TLS/SSL</span>
        </label>
        <div class="form-group">
          <label class="form-label">Username *</label>
          <input v-model="form.user" type="text" class="form-input" placeholder="you@gmail.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password {{ editingId ? '(leave blank to keep)' : '*' }}</label>
          <div class="flex gap-2">
            <input v-model="form.pass" type="password" class="form-input flex-1" :required="!editingId" />
            <button
              type="button" class="btn-secondary px-3 min-w-[44px]"
              :disabled="testConnectionMutation.isPending.value || !form.host || !form.user || !form.pass"
              @click="testFormConnection"
            >
              <Loader2 v-if="testConnectionMutation.isPending.value" :size="16" class="spin" />
              <Plug v-else :size="16" />
            </button>
          </div>
          <p class="text-text-muted text-sm mt-2">For Gmail, use App Password</p>
        </div>
        <div class="flex gap-3">
          <div class="form-group flex-1">
            <label class="form-label">From Email *</label>
            <input v-model="form.from_email" type="email" class="form-input" required />
          </div>
          <div class="form-group flex-1">
            <label class="form-label">From Name</label>
            <input v-model="form.from_name" type="text" class="form-input" placeholder="Your Name" />
          </div>
        </div>
        <label class="form-checkbox mb-4">
          <input v-model="form.is_default" type="checkbox" /><span>Set as default</span>
        </label>
        <div
          v-if="formTestResult"
          class="flex items-center gap-2 p-3 rounded-lg text-sm"
          :class="formTestResult.success ? 'bg-emerald-500/10 text-success' : 'bg-red-500/10 text-danger'"
        >
          <Check v-if="formTestResult.success" :size="16" /><X v-else :size="16" />
          {{ formTestResult.message }}
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="resetForm">Cancel</button>
        <button
          type="submit" form="smtp-form" class="btn-primary"
          :disabled="createMutation.isPending.value || updateMutation.isPending.value"
        >
          <Loader2
            v-if="createMutation.isPending.value || updateMutation.isPending.value"
            :size="16" class="spin"
          />
          {{ editingId ? 'Update' : 'Create' }}
        </button>
      </template>
    </Modal>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4">
      <Skeleton variant="card" :count="3" />
    </div>

    <!-- Empty -->
    <div v-else-if="smtpConfigs.length === 0" class="bg-bg-card border border-border rounded-xl">
      <EmptyState :icon="Inbox" title="No SMTP configurations" description="Add an SMTP server to send emails" />
    </div>

    <!-- SMTP List -->
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4">
      <div v-for="config in smtpConfigs" :key="config.id" class="bg-bg-card border border-border rounded-xl p-5">
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-bg-tertiary">
              <Server :size="16" class="text-text-muted" />
            </div>
            <h3 class="text-sm font-semibold text-text-primary m-0">{{ config.name }}</h3>
            <span v-if="config.is_default" class="badge-success inline-flex items-center gap-1">
              <Check :size="12" /> Default
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button class="btn-ghost btn-sm" @click="editConfig(config)"><Pencil :size="15" /></button>
            <button class="btn-ghost btn-sm" @click="promptDelete(config.id)"><Trash2 :size="15" /></button>
          </div>
        </div>
        <div class="flex flex-col gap-2.5 mb-4 p-3.5 bg-bg-tertiary rounded-lg">
          <div class="flex justify-between text-[13px]">
            <span class="text-text-muted">Host</span>
            <span class="text-text-primary font-mono text-[12px]">{{ config.host }}:{{ config.port }}</span>
          </div>
          <div class="flex justify-between text-[13px]">
            <span class="text-text-muted">User</span>
            <span class="text-text-primary font-mono text-[12px]">{{ config.user }}</span>
          </div>
          <div class="flex justify-between text-[13px]">
            <span class="text-text-muted">From</span>
            <span class="text-text-primary">{{ config.from_name || config.from_email }}</span>
          </div>
          <div class="flex justify-between text-[13px]">
            <span class="text-text-muted">Security</span>
            <span class="text-text-primary">{{ config.secure ? 'TLS/SSL' : 'None' }}</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button class="btn-secondary btn-sm" :disabled="testMutation.isPending.value" @click="handleTest(config)">
            <Loader2 v-if="testMutation.isPending.value" :size="14" class="spin" />
            <Plug v-else :size="14" /> Test
          </button>
          <div
            v-if="testResult?.id === config.id"
            class="flex items-center gap-1.5 text-[13px]"
            :class="testResult.success ? 'text-success' : 'text-danger'"
          >
            <Check v-if="testResult.success" :size="14" /><X v-else :size="14" />
            {{ testResult.success ? 'Connected!' : testResult.message }}
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :show="deleteConfirm.show"
      title="Delete Configuration"
      message="Are you sure you want to delete this SMTP configuration?"
      confirm-text="Delete"
      variant="danger"
      @confirm="confirmDeleteConfig"
      @cancel="deleteConfirm = { show: false, id: '' }"
    />
  </div>
</template>
