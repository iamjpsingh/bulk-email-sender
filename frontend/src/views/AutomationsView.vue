<script setup lang="ts">
import { ref, computed } from 'vue'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import Modal from '../components/ui/Modal.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import StatCard from '../components/ui/StatCard.vue'
import { automationsApi } from '../lib/api'
import { useToast } from '../composables/useToast'
import {
  Mail,
  Workflow,
  Plus,
  Trash2,
  Play,
  Pause,
  Square,
  X,
  Loader2,
  Clock,
  Tag,
  GitBranch,
  ArrowDown,
  Inbox,
  Users,
  CheckCircle,
  AlertTriangle,
  Activity,
} from 'lucide-vue-next'

const toast = useToast()

interface AutomationStep {
  id: string
  type: 'send_email' | 'wait' | 'condition' | 'add_tag' | 'end'
  config: Record<string, any>
}
interface Automation {
  id: string
  name: string
  description: string
  trigger_type: 'list_join' | 'tag_added' | 'score_change' | 'manual' | 'api'
  status: 'draft' | 'active' | 'paused'
  entry_list_id?: string
  enrolled_count: number
  completed_count: number
  steps: AutomationStep[]
  created_at: string
  updated_at: string
}
interface AutomationStats {
  enrolled: number
  completed: number
  active: number
  failed: number
}

const automations = ref<Automation[]>([])
const loading = ref(false)
const selectedId = ref<string | null>(null)
const stats = ref<AutomationStats>({ enrolled: 0, completed: 0, active: 0, failed: 0 })
const showCreateModal = ref(false)
const createForm = ref({ name: '', description: '', trigger_type: 'manual', entry_list_id: '' })
const creating = ref(false)
const showStepSelector = ref(false)
const editingStepIndex = ref<number | null>(null)
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })

const selected = computed(() => automations.value.find((a) => a.id === selectedId.value) || null)

async function fetchAutomations() {
  loading.value = true
  try {
    automations.value = (await automationsApi.list()) as any[]
  } catch {
    automations.value = []
  } finally {
    loading.value = false
  }
}

async function selectAutomation(id: string) {
  selectedId.value = id
  try {
    const detail = (await automationsApi.get(id)) as Automation
    const idx = automations.value.findIndex((a) => a.id === id)
    if (idx >= 0) automations.value[idx] = detail
    stats.value = (await automationsApi.getStats(id)) || { enrolled: 0, completed: 0, active: 0, failed: 0 }
  } catch {
    stats.value = { enrolled: 0, completed: 0, active: 0, failed: 0 }
  }
}

async function handleCreate() {
  creating.value = true
  try {
    const created = (await automationsApi.create(createForm.value as any)) as unknown as Automation
    automations.value.push(created)
    showCreateModal.value = false
    createForm.value = { name: '', description: '', trigger_type: 'manual', entry_list_id: '' }
    selectedId.value = created.id
  } catch (e: any) {
    toast.error(`Failed to create: ${e.message}`)
  } finally {
    creating.value = false
  }
}

function promptDelete(id: string) {
  deleteConfirm.value = { show: true, id }
}

async function confirmDelete() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
  try {
    await automationsApi.delete(id)
    automations.value = automations.value.filter((a) => a.id !== id)
    if (selectedId.value === id) selectedId.value = null
  } catch (e: any) {
    toast.error(`Failed to delete: ${e.message}`)
  }
}

async function handleAction(id: string, action: 'activate' | 'pause' | 'deactivate') {
  try {
    const actionMap: Record<string, (id: string) => Promise<void>> = {
      activate: automationsApi.activate,
      pause: automationsApi.pause,
      deactivate: automationsApi.deactivate,
    }
    await actionMap[action]!(id)
    await selectAutomation(id)
    await fetchAutomations()
  } catch (e: any) {
    toast.error(`Action failed: ${e.message}`)
  }
}

function addStep(type: AutomationStep['type']) {
  if (!selected.value) return
  const defaults: Record<string, any> = {
    send_email: { template_id: '', subject: '' },
    wait: { duration: 1, unit: 'days' },
    condition: { field: '', operator: 'equals', value: '' },
    add_tag: { tag: '' },
    end: {},
  }
  selected.value.steps.push({ id: crypto.randomUUID(), type, config: defaults[type] })
  showStepSelector.value = false
  editingStepIndex.value = selected.value.steps.length - 1
}

function removeStep(index: number) {
  if (!selected.value) return
  selected.value.steps.splice(index, 1)
  if (editingStepIndex.value === index) editingStepIndex.value = null
}

async function saveFlow() {
  if (!selected.value) return
  try {
    await automationsApi.update(selected.value.id, {
      name: selected.value.name,
      description: selected.value.description,
      trigger_type: selected.value.trigger_type,
      steps: selected.value.steps,
    })
    toast.success('Flow saved.')
  } catch (e: any) {
    toast.error(`Save failed: ${e.message}`)
  }
}

const triggerLabels: Record<string, string> = {
  list_join: 'List Join',
  tag_added: 'Tag Added',
  score_change: 'Score Change',
  manual: 'Manual',
  api: 'API',
}
const stepIcons: Record<string, any> = {
  send_email: Mail,
  wait: Clock,
  condition: GitBranch,
  add_tag: Tag,
  end: Square,
}
const stepLabels: Record<string, string> = {
  send_email: 'Send Email',
  wait: 'Wait',
  condition: 'Condition',
  add_tag: 'Add Tag',
  end: 'End',
}

function getStepSummary(step: AutomationStep) {
  const c = step.config
  switch (step.type) {
    case 'send_email':
      return c.subject || 'No subject set'
    case 'wait':
      return `${c.duration} ${c.unit}`
    case 'condition':
      return c.field ? `${c.field} ${c.operator} ${c.value}` : 'Not configured'
    case 'add_tag':
      return c.tag || 'No tag set'
    case 'end':
      return 'Automation ends'
  }
}

fetchAutomations()
</script>

<template>
  <div>
    <PageHeader title="Automations" subtitle="Build automated email workflows">
      <template #actions>
        <button class="btn-primary" @click="showCreateModal = true"><Plus :size="16" /> New Automation</button>
      </template>
    </PageHeader>

    <div class="flex gap-6 items-start max-[900px]:flex-col">
      <!-- List -->
      <div class="w-[320px] min-w-[320px] max-[900px]:w-full max-[900px]:min-w-0 bg-bg-card border border-border rounded-xl overflow-hidden">
        <div v-if="loading" class="flex flex-col">
          <Skeleton variant="text" :count="5" height="56px" />
        </div>
        <EmptyState v-else-if="automations.length === 0" :icon="Inbox" title="No automations yet" />
        <div v-else class="flex flex-col">
          <div
            v-for="a in automations"
            :key="a.id"
            class="px-4 py-3.5 cursor-pointer border-b border-border transition-all duration-150 last:border-b-0"
            :class="selectedId === a.id ? 'bg-accent/8 border-l-[3px] border-l-accent' : 'hover:bg-bg-tertiary'"
            @click="selectAutomation(a.id)"
          >
            <div class="flex justify-between items-center mb-1.5">
              <span class="font-semibold text-sm text-text-primary truncate">{{ a.name }}</span>
              <StatusBadge :status="a.status" type="automation" />
            </div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="badge-info">{{ triggerLabels[a.trigger_type] || a.trigger_type }}</span>
              <span class="text-text-muted text-[13px]">{{ a.enrolled_count }} enrolled</span>
              <span class="text-text-muted text-[13px]">{{ a.completed_count }} done</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail -->
      <div class="flex-1 min-w-0 flex flex-col gap-4" v-if="selected">
        <!-- Header card -->
        <div class="bg-bg-card border border-border rounded-xl p-5 flex justify-between items-start gap-4">
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-semibold mb-1 text-text-primary">{{ selected.name }}</h2>
            <p class="text-text-muted text-sm">{{ selected.description || 'No description' }}</p>
          </div>
          <div class="flex gap-2 flex-wrap shrink-0">
            <button
              v-if="selected.status !== 'active'"
              class="btn-primary text-sm px-3 py-1.5"
              @click="handleAction(selected.id, 'activate')"
            >
              <Play :size="14" /> Activate
            </button>
            <button
              v-if="selected.status === 'active'"
              class="btn-secondary text-sm px-3 py-1.5"
              @click="handleAction(selected.id, 'pause')"
            >
              <Pause :size="14" /> Pause
            </button>
            <button
              v-if="selected.status !== 'draft'"
              class="btn-secondary text-sm px-3 py-1.5"
              @click="handleAction(selected.id, 'deactivate')"
            >
              <Square :size="14" /> Deactivate
            </button>
            <button class="btn-danger text-sm px-3 py-1.5" @click="promptDelete(selected.id)">
              <Trash2 :size="14" /> Delete
            </button>
          </div>
        </div>

        <!-- Stats -->
        <div v-if="selected.status === 'active'" class="grid grid-cols-4 max-[900px]:grid-cols-2 gap-4">
          <StatCard :icon="Users" :value="stats.enrolled" label="Enrolled" />
          <StatCard :icon="Activity" :value="stats.active" label="Active" color="accent" />
          <StatCard :icon="CheckCircle" :value="stats.completed" label="Completed" color="success" />
          <StatCard :icon="AlertTriangle" :value="stats.failed" label="Failed" color="danger" />
        </div>

        <!-- Workflow Steps -->
        <div class="bg-bg-card border border-border rounded-xl p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-sm font-semibold text-text-primary">Workflow Steps</h3>
            <button class="btn-secondary text-sm px-3 py-1.5" @click="saveFlow">Save Flow</button>
          </div>

          <!-- Trigger -->
          <div class="flex items-center gap-3 py-3.5 px-4 bg-accent/8 border border-accent/20 rounded-lg text-accent font-semibold text-sm">
            <Workflow :size="18" />
            <span>Trigger: {{ triggerLabels[selected.trigger_type] }}</span>
          </div>

          <div class="flex justify-center py-2 text-text-muted" v-if="selected.steps.length">
            <ArrowDown :size="16" />
          </div>

          <template v-for="(step, idx) in selected.steps" :key="step.id">
            <!-- Step card -->
            <div
              class="flex items-center gap-3 py-3.5 px-4 bg-bg-tertiary border border-border rounded-lg cursor-pointer transition-all duration-150 hover:border-accent/30"
              :class="{ '!border-accent shadow-[0_0_0_1px] shadow-accent/10': editingStepIndex === idx }"
              @click="editingStepIndex = editingStepIndex === idx ? null : idx"
            >
              <div class="w-8 h-8 rounded-lg bg-bg-card border border-border flex items-center justify-center shrink-0">
                <component :is="stepIcons[step.type]" :size="16" class="text-text-secondary" />
              </div>
              <div class="flex-1 min-w-0 flex flex-col">
                <span class="font-semibold text-sm text-text-primary">{{ stepLabels[step.type] }}</span>
                <span class="text-text-muted text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">{{ getStepSummary(step) }}</span>
              </div>
              <button
                class="bg-transparent border-none cursor-pointer text-text-muted p-1.5 rounded-md transition-all duration-150 flex items-center hover:text-danger hover:bg-danger/10"
                @click.stop="removeStep(idx)"
                title="Remove"
              >
                <X :size="14" />
              </button>
            </div>

            <!-- Step Config -->
            <div v-if="editingStepIndex === idx" class="mt-2 p-4 bg-bg-card border border-border rounded-lg">
              <template v-if="step.type === 'send_email'">
                <div class="form-group">
                  <label class="form-label">Template ID</label>
                  <input class="form-input" v-model="step.config.template_id" placeholder="Select a template..." />
                </div>
                <div class="form-group">
                  <label class="form-label">Subject</label>
                  <input class="form-input" v-model="step.config.subject" placeholder="Email subject line" />
                </div>
              </template>
              <template v-else-if="step.type === 'wait'">
                <div class="flex gap-3">
                  <div class="form-group flex-1">
                    <label class="form-label">Duration</label>
                    <input class="form-input" type="number" min="1" v-model.number="step.config.duration" />
                  </div>
                  <div class="form-group flex-1">
                    <label class="form-label">Unit</label>
                    <select class="form-select" v-model="step.config.unit">
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>
              </template>
              <template v-else-if="step.type === 'condition'">
                <div class="form-group">
                  <label class="form-label">Field</label>
                  <input class="form-input" v-model="step.config.field" placeholder="e.g. opened_last_email" />
                </div>
                <div class="form-group">
                  <label class="form-label">Operator</label>
                  <select class="form-select" v-model="step.config.operator">
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                    <option value="contains">Contains</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Value</label>
                  <input class="form-input" v-model="step.config.value" placeholder="Comparison value" />
                </div>
              </template>
              <template v-else-if="step.type === 'add_tag'">
                <div class="form-group">
                  <label class="form-label">Tag Name</label>
                  <input class="form-input" v-model="step.config.tag" placeholder="Enter tag name" />
                </div>
              </template>
            </div>

            <div class="flex justify-center py-2 text-text-muted" v-if="idx < selected.steps.length - 1">
              <ArrowDown :size="16" />
            </div>
          </template>

          <!-- Add Step -->
          <div class="mt-5 flex justify-center">
            <button v-if="!showStepSelector" class="btn-secondary text-sm px-3 py-1.5" @click="showStepSelector = true">
              <Plus :size="16" /> Add Step
            </button>
            <div v-else class="flex gap-2 flex-wrap justify-center">
              <button
                v-for="st in ['send_email', 'wait', 'condition', 'add_tag', 'end'] as const"
                :key="st"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-bg-tertiary border border-border rounded-lg text-text-secondary text-[13px] font-medium cursor-pointer font-sans transition-all duration-150 hover:border-accent hover:text-accent hover:bg-accent/5"
                @click="addStep(st)"
              >
                <component :is="stepIcons[st]" :size="14" /> {{ stepLabels[st] }}
              </button>
              <button class="btn-ghost text-sm px-3 py-1.5" @click="showStepSelector = false">
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        :icon="Workflow"
        title="No automation selected"
        description="Select an automation to view its workflow"
        class="flex-1 min-w-0 min-h-[400px]"
      />
    </div>

    <!-- Create Modal -->
  <Modal :show="showCreateModal" title="New Automation" size="md" @close="showCreateModal = false">
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" v-model="createForm.name" placeholder="Welcome sequence..." />
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" v-model="createForm.description" placeholder="Optional description" />
    </div>
    <div class="form-group">
      <label class="form-label">Trigger Type</label>
      <select class="form-select" v-model="createForm.trigger_type">
        <option value="list_join">List Join</option>
        <option value="tag_added">Tag Added</option>
        <option value="score_change">Score Change</option>
        <option value="manual">Manual</option>
        <option value="api">API</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Entry List ID <span class="text-text-muted">(optional)</span></label>
      <input class="form-input" v-model="createForm.entry_list_id" placeholder="Contact list to enroll from" />
    </div>
    <template #footer>
      <button class="btn-ghost" @click="showCreateModal = false">Cancel</button>
      <button class="btn-primary" :disabled="!createForm.name || creating" @click="handleCreate">
        <Loader2 v-if="creating" :size="16" class="spin" /> Create Automation
      </button>
    </template>
  </Modal>

  <!-- Delete Confirm -->
  <ConfirmDialog
    :show="deleteConfirm.show"
    title="Delete Automation"
    message="Delete this automation? This cannot be undone."
    confirmText="Delete"
    variant="danger"
    @confirm="confirmDelete"
    @cancel="deleteConfirm.show = false"
  />
  </div>
</template>
