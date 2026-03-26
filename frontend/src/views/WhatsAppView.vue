<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/vue-query'
import { useApiQuery, useApiMutation } from '../composables/useApiQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import SlidePanel from '../components/ui/SlidePanel.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import Modal from '../components/ui/Modal.vue'
import { whatsappApi } from '../lib/api'
import type { WhatsAppConfig, WhatsAppConfigInput, WhatsAppTemplate } from '../lib/api'
import { useToast } from '../composables/useToast'
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  RefreshCw,
  MessageCircle,
  Smartphone,
  Loader2,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-vue-next'

const toast = useToast()
const queryClient = useQueryClient()

// ============================================================================
// Zod Schemas (frontend form validation)
// ============================================================================

const ConfigFormSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  phone_number_id: z.string().min(1, 'Phone Number ID is required'),
  access_token: z.string(),
  business_account_id: z.string().optional(),
  phone_display: z.string().optional(),
  daily_limit: z.number().int().min(1).max(100000).default(1000),
})

const SendFormSchema = z.object({
  phone: z.string().min(7, 'Enter a valid phone number with country code'),
})

// ============================================================================
// State
// ============================================================================

const activeTab = ref<'accounts' | 'templates' | 'messages'>('accounts')
const selectedConfigId = ref('')

// Config editor
const showConfigEditor = ref(false)
const editingConfigId = ref<string | null>(null)
const configForm = ref<WhatsAppConfigInput>({
  name: '', provider: 'meta', phone_number_id: '',
  business_account_id: '', access_token: '', phone_display: '', daily_limit: 1000,
})
const showToken = ref(false)
const formErrors = ref<Record<string, string>>({})

// Send modal
const showSendModal = ref(false)
const sendForm = ref({ phone: '', templateName: '', language: 'en', params: [] as string[] })
const sendTemplateBody = ref('')
const sendErrors = ref<Record<string, string>>({})

// Delete
const deleteConfirm = ref<{ show: boolean; type: 'config' | 'template'; id: string }>({ show: false, type: 'config', id: '' })

// ============================================================================
// TanStack Queries — cached, auto-loading, deduplicated
// ============================================================================

const { data: configs, isLoading: loadingConfigs } = useApiQuery(
  ['wa-configs'],
  () => whatsappApi.getConfigs(),
)

const { data: templates, isLoading: loadingTemplates } = useApiQuery(
  computed(() => ['wa-templates', selectedConfigId.value]),
  () => whatsappApi.getTemplates(selectedConfigId.value),
  { enabled: computed(() => !!selectedConfigId.value) }
)

const { data: messagesData } = useApiQuery(
  computed(() => ['wa-messages', selectedConfigId.value]),
  () => whatsappApi.getMessages({ configId: selectedConfigId.value || undefined, limit: 100 }),
)

const { data: stats } = useApiQuery(
  computed(() => ['wa-stats', selectedConfigId.value]),
  () => whatsappApi.getStats(selectedConfigId.value || undefined),
)

// ============================================================================
// TanStack Mutations — with auto-invalidation
// ============================================================================

const syncMutation = useApiMutation(
  (configId: string) => whatsappApi.syncTemplates(configId),
  { invalidate: [['wa-templates']], success: 'Templates synced from Meta' }
)

const deleteMutation = useApiMutation(
  async ({ type, id }: { type: 'config' | 'template'; id: string }) => {
    if (type === 'config') await whatsappApi.deleteConfig(id)
    else await whatsappApi.deleteTemplate(id)
  },
  {
    invalidate: [['wa-configs'], ['wa-templates']],
    success: 'Deleted successfully',
  }
)

const sendMutation = useApiMutation(
  async (input: { configId: string; phone: string; templateName: string; language: string; components?: any[] }) => {
    await whatsappApi.sendTemplate(input.configId, input.phone, input.templateName, input.language, input.components)
  },
  { invalidate: [['wa-messages'], ['wa-stats']], success: 'Message sent' }
)

// ============================================================================
// Computed
// ============================================================================

const configsList = computed(() => configs.value || [])
const templatesList = computed(() => templates.value || [])
const messagesList = computed(() => messagesData.value?.messages || [])

const templateParams = computed(() => {
  const matches = sendTemplateBody.value.match(/\{\{(\d+)\}\}/g)
  if (!matches) return []
  return [...new Set(matches)].sort()
})

// ============================================================================
// Handlers
// ============================================================================

// Auto-select first config
watch(configsList, (list) => {
  if (list.length && !selectedConfigId.value) {
    selectedConfigId.value = list[0]?.id ?? ''
  }
}, { immediate: true })

function openAddConfig() {
  configForm.value = { name: '', provider: 'meta', phone_number_id: '', business_account_id: '', access_token: '', phone_display: '', daily_limit: 1000 }
  editingConfigId.value = null
  showToken.value = false
  formErrors.value = {}
  showConfigEditor.value = true
}

function openEditConfig(cfg: WhatsAppConfig) {
  configForm.value = {
    name: cfg.name, provider: cfg.provider, phone_number_id: cfg.phone_number_id,
    business_account_id: cfg.business_account_id || '', access_token: '',
    phone_display: cfg.phone_display || '', daily_limit: cfg.daily_limit,
  }
  editingConfigId.value = cfg.id
  showToken.value = false
  formErrors.value = {}
  showConfigEditor.value = true
}

async function saveConfig() {
  formErrors.value = {}
  const schema = editingConfigId.value
    ? ConfigFormSchema.extend({ access_token: z.string().optional() })
    : ConfigFormSchema.extend({ access_token: z.string().min(1, 'Access Token is required') })

  const result = schema.safeParse(configForm.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      formErrors.value[issue.path[0] as string] = issue.message
    }
    return
  }

  try {
    if (editingConfigId.value) {
      await whatsappApi.updateConfig(editingConfigId.value, configForm.value)
      toast.success('Account updated')
    } else {
      await whatsappApi.createConfig(configForm.value)
      toast.success('WhatsApp account connected')
    }
    showConfigEditor.value = false
    queryClient.invalidateQueries({ queryKey: ['wa-configs'] })
  } catch (err: any) {
    toast.error(err.message)
  }
}

function openSendModal(tpl: WhatsAppTemplate) {
  sendForm.value = { phone: '', templateName: tpl.meta_template_name, language: tpl.language, params: [] }
  sendTemplateBody.value = tpl.body_text || ''
  const count = (tpl.body_text || '').match(/\{\{(\d+)\}\}/g)?.length || 0
  sendForm.value.params = Array(count).fill('')
  sendErrors.value = {}
  showSendModal.value = true
}

async function sendMessage() {
  sendErrors.value = {}
  const result = SendFormSchema.safeParse(sendForm.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      sendErrors.value[issue.path[0] as string] = issue.message
    }
    return
  }

  const components = sendForm.value.params.length ? [{
    type: 'body',
    parameters: sendForm.value.params.map(p => ({ type: 'text', text: p })),
  }] : undefined

  await sendMutation.mutateAsync({
    configId: selectedConfigId.value,
    phone: sendForm.value.phone,
    templateName: sendForm.value.templateName,
    language: sendForm.value.language,
    components,
  })
  showSendModal.value = false
}

function confirmDelete() {
  const { type, id } = deleteConfirm.value
  deleteConfirm.value.show = false
  deleteMutation.mutate({ type, id })
}

function statusColor(status: string): string {
  switch (status) {
    case 'APPROVED': case 'active': case 'delivered': case 'read': case 'sent': return 'bg-success/15 text-success'
    case 'PENDING': case 'queued': return 'bg-warning/15 text-warning'
    case 'REJECTED': case 'DISABLED': case 'error': case 'failed': return 'bg-danger/15 text-danger'
    case 'PAUSED': case 'paused': return 'bg-muted text-muted-foreground'
    default: return 'bg-muted text-muted-foreground'
  }
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function copyWebhookToken(token: string | null) {
  if (!token) return
  navigator.clipboard.writeText(token)
  toast.success('Webhook verify token copied')
}
</script>

<template>
  <div>
    <PageHeader title="WhatsApp" subtitle="Send marketing messages via WhatsApp Business API">
      <template #actions>
        <Button @click="openAddConfig"><Plus :size="16" /> Connect Account</Button>
      </template>
    </PageHeader>

    <!-- Stats bar -->
    <div v-if="stats && stats.total_messages > 0" class="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-5">
      <div class="bg-card border border-border rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-foreground">{{ stats.sent }}</div>
        <div class="text-xs text-muted-foreground">Sent</div>
      </div>
      <div class="bg-card border border-border rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-success">{{ stats.delivered }}</div>
        <div class="text-xs text-muted-foreground">Delivered ({{ stats.delivery_rate }}%)</div>
      </div>
      <div class="bg-card border border-border rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-accent">{{ stats.read }}</div>
        <div class="text-xs text-muted-foreground">Read ({{ stats.read_rate }}%)</div>
      </div>
      <div class="bg-card border border-border rounded-lg p-3 text-center">
        <div class="text-lg font-bold text-danger">{{ stats.failed }}</div>
        <div class="text-xs text-muted-foreground">Failed</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-5">
      <button
        v-for="tab in (['accounts', 'templates', 'messages'] as const)"
        :key="tab"
        :class="['px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize', activeTab === tab ? 'bg-accent text-white' : 'bg-muted text-muted-foreground hover:text-foreground']"
        @click="activeTab = tab"
      >{{ tab }}</button>
    </div>

    <!-- Accounts Tab -->
    <div v-if="activeTab === 'accounts'">
      <div v-if="loadingConfigs" class="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
        <Skeleton variant="card" :count="3" />
      </div>

      <div v-else-if="configsList.length === 0" class="bg-card border border-border rounded-xl">
        <EmptyState :icon="MessageCircle" title="No WhatsApp accounts" description="Connect your WhatsApp Business account to start sending messages">
          <template #actions>
            <Button @click="openAddConfig"><Plus :size="16" /> Connect Account</Button>
          </template>
        </EmptyState>
      </div>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] max-md:grid-cols-1 gap-4">
        <div v-for="cfg in configsList" :key="cfg.id" class="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-primary/25">
          <div class="flex justify-between items-start">
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-foreground truncate m-0">{{ cfg.name }}</h3>
              <p class="text-xs text-muted-foreground mt-1 m-0 flex items-center gap-1">
                <Smartphone :size="11" /> {{ cfg.phone_display || cfg.phone_number_id }}
              </p>
            </div>
            <span :class="['shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded-full', statusColor(cfg.status)]">{{ cfg.status }}</span>
          </div>

          <div class="flex gap-4 text-xs text-muted-foreground">
            <span>{{ cfg.provider }}</span>
            <span>{{ cfg.sent_today }}/{{ cfg.daily_limit }} today</span>
          </div>

          <div v-if="cfg.webhook_verify_token" class="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
            <span class="text-xs text-muted-foreground truncate flex-1 font-mono">verify: {{ cfg.webhook_verify_token.substring(0, 20) }}...</span>
            <Button variant="ghost" size="sm" title="Copy token" @click="copyWebhookToken(cfg.webhook_verify_token)"><Copy :size="11" /></Button>
          </div>

          <div class="flex justify-between items-center pt-3 border-t border-border mt-auto">
            <Button variant="ghost" size="sm" title="Edit" @click="openEditConfig(cfg)"><Pencil :size="14" /></Button>
            <Button variant="ghost" size="sm" class="text-danger" title="Delete" @click="deleteConfirm = { show: true, type: 'config', id: cfg.id }"><Trash2 :size="14" /></Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Templates Tab -->
    <div v-if="activeTab === 'templates'">
      <div class="flex items-center gap-3 mb-4">
        <Select v-model="selectedConfigId" class="max-w-xs">
          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Select account</SelectItem>
            <SelectItem v-for="cfg in configsList" :key="cfg.id" :value="cfg.id">{{ cfg.name }}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" :disabled="!selectedConfigId || syncMutation.isPending.value" @click="syncMutation.mutate(selectedConfigId)">
          <RefreshCw :size="14" :class="{ 'animate-spin': syncMutation.isPending.value }" /> Sync from Meta
        </Button>
      </div>

      <div v-if="!selectedConfigId" class="text-sm text-muted-foreground py-8 text-center">Select an account to view templates</div>

      <div v-else-if="loadingTemplates" class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        <Skeleton variant="card" :count="4" />
      </div>

      <div v-else-if="templatesList.length === 0" class="bg-card border border-border rounded-xl">
        <EmptyState :icon="MessageCircle" title="No templates" description="Sync templates from Meta or create new ones in the Meta Business Manager">
          <template #actions>
            <Button :disabled="syncMutation.isPending.value" @click="syncMutation.mutate(selectedConfigId)">
              <RefreshCw :size="16" :class="{ 'animate-spin': syncMutation.isPending.value }" /> Sync Templates
            </Button>
          </template>
        </EmptyState>
      </div>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] max-md:grid-cols-1 gap-3">
        <div v-for="tpl in templatesList" :key="tpl.id" class="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 hover:border-primary/25 transition-all">
          <div class="flex justify-between items-start">
            <div class="min-w-0">
              <h4 class="text-sm font-semibold text-foreground truncate m-0">{{ tpl.meta_template_name }}</h4>
              <p class="text-xs text-muted-foreground mt-0.5 m-0">{{ tpl.language }} &middot; {{ tpl.category }}</p>
            </div>
            <span :class="['shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full', statusColor(tpl.status)]">{{ tpl.status }}</span>
          </div>
          <p v-if="tpl.body_text" class="text-xs text-muted-foreground line-clamp-3 m-0">{{ tpl.body_text }}</p>
          <div class="flex justify-between items-center pt-2 border-t border-border mt-auto">
            <Button v-if="tpl.status === 'APPROVED'" variant="ghost" size="sm" class="text-success" @click="openSendModal(tpl)">
              <Send :size="13" /> Send
            </Button>
            <span v-else />
            <Button variant="ghost" size="sm" class="text-danger" @click="deleteConfirm = { show: true, type: 'template', id: tpl.id }"><Trash2 :size="13" /></Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Messages Tab -->
    <div v-if="activeTab === 'messages'">
      <div class="flex items-center gap-3 mb-4">
        <Select v-model="selectedConfigId" class="max-w-xs">
          <SelectTrigger><SelectValue placeholder="All accounts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All accounts</SelectItem>
            <SelectItem v-for="cfg in configsList" :key="cfg.id" :value="cfg.id">{{ cfg.name }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="messagesList.length === 0" class="text-sm text-muted-foreground py-8 text-center">No messages yet</div>

      <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border text-left text-xs text-muted-foreground">
              <th class="px-4 py-3 font-medium">Phone</th>
              <th class="px-4 py-3 font-medium">Type</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium max-md:hidden">Sent</th>
              <th class="px-4 py-3 font-medium max-md:hidden">Delivered</th>
              <th class="px-4 py-3 font-medium max-md:hidden">Read</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="msg in messagesList" :key="msg.id" class="border-b border-border last:border-0 hover:bg-card/50">
              <td class="px-4 py-3 font-mono text-foreground">{{ msg.phone_number }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ msg.message_type }}</td>
              <td class="px-4 py-3"><span :class="['px-2 py-0.5 text-[10px] font-bold rounded-full', statusColor(msg.status)]">{{ msg.status }}</span></td>
              <td class="px-4 py-3 text-muted-foreground max-md:hidden">{{ formatDate(msg.sent_at) }}</td>
              <td class="px-4 py-3 text-muted-foreground max-md:hidden">{{ formatDate(msg.delivered_at) }}</td>
              <td class="px-4 py-3 text-muted-foreground max-md:hidden">{{ formatDate(msg.read_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ConfirmDialog
      :show="deleteConfirm.show"
      :title="deleteConfirm.type === 'config' ? 'Remove Account' : 'Delete Template'"
      :message="deleteConfirm.type === 'config' ? 'Remove this WhatsApp account? All templates and messages will be deleted.' : 'Delete this template? It will also be removed from Meta.'"
      confirmText="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteConfirm.show = false"
    />

    <!-- Config Editor -->
  <SlidePanel :show="showConfigEditor" :title="editingConfigId ? 'Edit Account' : 'Connect WhatsApp Account'" size="md" @close="showConfigEditor = false">
    <form @submit.prevent="saveConfig" class="flex flex-col gap-4">
      <div>
        <Label>Account Name *</Label>
        <Input v-model="configForm.name" type="text" :class="{ 'border-danger!': formErrors.name }" placeholder="My WhatsApp Business" />
        <p v-if="formErrors.name" class="text-xs text-danger mt-1">{{ formErrors.name }}</p>
      </div>

      <div>
        <Label>Provider</Label>
        <Select v-model="configForm.provider">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="meta">Meta Cloud API (Direct)</SelectItem>
            <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
            <SelectItem value="360dialog">360dialog</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Phone Number ID *</Label>
        <Input v-model="configForm.phone_number_id" type="text" :class="{ 'border-danger!': formErrors.phone_number_id }" placeholder="From Meta Developer Dashboard" />
        <p v-if="formErrors.phone_number_id" class="text-xs text-danger mt-1">{{ formErrors.phone_number_id }}</p>
        <p v-else class="text-xs text-muted-foreground mt-1">Found in Meta Developer Portal > WhatsApp > API Setup</p>
      </div>

      <div>
        <Label>Business Account ID</Label>
        <Input v-model="configForm.business_account_id" type="text" placeholder="Required for template sync" />
        <p class="text-xs text-muted-foreground mt-1">Required to sync/create templates. Found in Business Settings.</p>
      </div>

      <div>
        <Label>{{ editingConfigId ? 'New Access Token (leave blank to keep current)' : 'Access Token *' }}</Label>
        <div class="relative">
          <Input v-model="configForm.access_token" :type="showToken ? 'text' : 'password'" class="pr-10" :class="{ 'border-danger!': formErrors.access_token }" placeholder="Permanent token or System User token" />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" @click="showToken = !showToken">
            <Eye v-if="!showToken" :size="16" /><EyeOff v-else :size="16" />
          </button>
        </div>
        <p v-if="formErrors.access_token" class="text-xs text-danger mt-1">{{ formErrors.access_token }}</p>
      </div>

      <div>
        <Label>Display Phone Number</Label>
        <Input v-model="configForm.phone_display" type="text" placeholder="+1 234 567 8900" />
      </div>

      <div>
        <Label>Daily Limit</Label>
        <Input v-model="configForm.daily_limit" type="number" min="1" max="100000" />
      </div>

      <div class="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="ghost" type="button" @click="showConfigEditor = false">Cancel</Button>
        <Button type="submit">
          {{ editingConfigId ? 'Update' : 'Connect' }}
        </Button>
      </div>
    </form>
  </SlidePanel>

  <!-- Send Template Modal -->
  <Modal :show="showSendModal" title="Send WhatsApp Message" size="md" @close="showSendModal = false">
    <form @submit.prevent="sendMessage" class="flex flex-col gap-4">
      <div>
        <Label>Template</Label>
        <Input :model-value="sendForm.templateName" type="text" disabled />
      </div>

      <div>
        <Label>Recipient Phone Number *</Label>
        <Input v-model="sendForm.phone" type="tel" :class="{ 'border-danger!': sendErrors.phone }" placeholder="14155552671 (with country code)" />
        <p v-if="sendErrors.phone" class="text-xs text-danger mt-1">{{ sendErrors.phone }}</p>
        <p v-else class="text-xs text-muted-foreground mt-1">Include country code without + sign (e.g. 14155552671)</p>
      </div>

      <div v-if="templateParams.length > 0" class="flex flex-col gap-2">
        <Label>Template Parameters</Label>
        <div v-for="(param, i) in templateParams" :key="param" class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-12 shrink-0">{{ param }}</span>
          <Input v-model="sendForm.params[i]" type="text" class="flex-1" :placeholder="`Value for ${param}`" />
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-3 border-t border-border">
        <Button variant="ghost" type="button" @click="showSendModal = false">Cancel</Button>
        <Button type="submit" :disabled="sendMutation.isPending.value">
          <Loader2 v-if="sendMutation.isPending.value" :size="16" class="animate-spin" />
          <Send v-else :size="16" />
          Send Message
        </Button>
      </div>
    </form>
  </Modal>
  </div>
</template>
