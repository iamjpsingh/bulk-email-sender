<script setup lang="ts">
import { ref, computed } from 'vue'
import MainLayout from '../components/layout/MainLayout.vue'
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

async function handleDelete(id: string) {
  if (!confirm('Delete this automation? This cannot be undone.')) return
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

const statusClass: Record<string, string> = { active: 'success', paused: 'warning', draft: 'info' }
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
  <MainLayout>
    <header class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-[28px] font-bold mb-1 text-text-primary">Automations</h1>
        <p class="text-text-muted">Build automated email workflows</p>
      </div>
      <button class="btn-primary" @click="showCreateModal = true"><Plus :size="18" /> New Automation</button>
    </header>

    <div class="flex gap-6 items-start max-[900px]:flex-col">
      <!-- List -->
      <div class="w-[340px] min-w-[340px] max-[900px]:w-full max-[900px]:min-w-0 glass-card p-0 overflow-hidden">
        <div v-if="loading" class="text-center py-10 px-5 text-text-muted flex flex-col items-center gap-2">
          <Loader2 :size="24" class="spin" /> Loading...
        </div>
        <div
          v-else-if="automations.length === 0"
          class="text-center py-10 px-5 text-text-muted flex flex-col items-center gap-2"
        >
          <Inbox :size="40" />
          <p>No automations yet</p>
        </div>
        <div v-else class="flex flex-col">
          <div
            v-for="a in automations"
            :key="a.id"
            class="px-5 py-4 cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-accent/5"
            :class="{ 'bg-accent/10 border-l-[3px] border-l-accent': selectedId === a.id }"
            @click="selectAutomation(a.id)"
          >
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold text-sm text-text-primary">{{ a.name }}</span
              ><span :class="`badge-${statusClass[a.status] || 'info'}`">{{ a.status }}</span>
            </div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="badge-info">{{ triggerLabels[a.trigger_type] || a.trigger_type }}</span>
              <span class="text-text-muted text-sm">{{ a.enrolled_count }} enrolled</span>
              <span class="text-text-muted text-sm">{{ a.completed_count }} done</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail -->
      <div class="flex-1 min-w-0 flex flex-col gap-4" v-if="selected">
        <div class="glass-card p-5 flex justify-between items-start gap-4">
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-bold mb-1 text-text-primary">{{ selected.name }}</h2>
            <p class="text-text-muted text-sm">{{ selected.description || 'No description' }}</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button
              v-if="selected.status !== 'active'"
              class="btn-primary text-sm px-3 py-1.5"
              @click="handleAction(selected.id, 'activate')"
            >
              <Play :size="16" /> Activate
            </button>
            <button
              v-if="selected.status === 'active'"
              class="btn-secondary text-sm px-3 py-1.5"
              @click="handleAction(selected.id, 'pause')"
            >
              <Pause :size="16" /> Pause
            </button>
            <button
              v-if="selected.status !== 'draft'"
              class="btn-secondary text-sm px-3 py-1.5"
              @click="handleAction(selected.id, 'deactivate')"
            >
              <Square :size="16" /> Deactivate
            </button>
            <button class="btn-danger text-sm px-3 py-1.5" @click="handleDelete(selected.id)">
              <Trash2 :size="16" /> Delete
            </button>
          </div>
        </div>

        <div v-if="selected.status === 'active'" class="grid grid-cols-4 max-[900px]:grid-cols-2 gap-3">
          <div
            class="bg-bg-card border border-border rounded-lg p-4 text-center"
            v-for="s in [
              { v: stats.enrolled, l: 'Enrolled' },
              { v: stats.active, l: 'Active' },
              { v: stats.completed, l: 'Completed' },
              { v: stats.failed, l: 'Failed' },
            ]"
            :key="s.l"
          >
            <span class="block text-2xl font-bold text-text-primary mb-1 font-mono">{{ s.v }}</span
            ><span class="text-xs text-text-muted uppercase tracking-wider">{{ s.l }}</span>
          </div>
        </div>

        <div class="glass-card p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-base font-semibold text-text-primary">Workflow Steps</h3>
            <button class="btn-secondary text-sm px-3 py-1.5" @click="saveFlow">Save Flow</button>
          </div>
          <div
            class="flex items-center gap-3 py-3.5 px-4 bg-accent/10 border border-border-glow rounded-lg text-accent font-semibold text-sm"
          >
            <Workflow :size="18" /><span>Trigger: {{ triggerLabels[selected.trigger_type] }}</span>
          </div>
          <div class="flex justify-center py-2 text-text-muted" v-if="selected.steps.length">
            <ArrowDown :size="16" />
          </div>

          <template v-for="(step, idx) in selected.steps" :key="step.id">
            <div
              class="flex items-center gap-3 py-3.5 px-4 bg-bg-secondary border border-border rounded-lg cursor-pointer transition-all duration-150 hover:border-accent/30"
              :class="{ '!border-accent shadow-[0_0_0_2px_rgba(6,182,212,0.1)]': editingStepIndex === idx }"
              @click="editingStepIndex = editingStepIndex === idx ? null : idx"
            >
              <component :is="stepIcons[step.type]" :size="18" />
              <div class="flex-1 min-w-0 flex flex-col">
                <span class="font-semibold text-sm">{{ stepLabels[step.type] }}</span
                ><span class="text-text-muted text-sm whitespace-nowrap overflow-hidden text-ellipsis">{{
                  getStepSummary(step)
                }}</span>
              </div>
              <button
                class="bg-transparent border-none cursor-pointer text-text-muted p-1 rounded transition-all duration-150 flex items-center hover:text-danger hover:bg-danger/10"
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
                  <label class="form-label">Template ID</label
                  ><input class="form-input" v-model="step.config.template_id" placeholder="Select a template..." />
                </div>
                <div class="form-group">
                  <label class="form-label">Subject</label
                  ><input class="form-input" v-model="step.config.subject" placeholder="Email subject line" />
                </div>
              </template>
              <template v-else-if="step.type === 'wait'">
                <div class="flex gap-3">
                  <div class="form-group flex-1">
                    <label class="form-label">Duration</label
                    ><input class="form-input" type="number" min="1" v-model.number="step.config.duration" />
                  </div>
                  <div class="form-group flex-1">
                    <label class="form-label">Unit</label
                    ><select class="form-select" v-model="step.config.unit">
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>
              </template>
              <template v-else-if="step.type === 'condition'">
                <div class="form-group">
                  <label class="form-label">Field</label
                  ><input class="form-input" v-model="step.config.field" placeholder="e.g. opened_last_email" />
                </div>
                <div class="form-group">
                  <label class="form-label">Operator</label
                  ><select class="form-select" v-model="step.config.operator">
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                    <option value="contains">Contains</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Value</label
                  ><input class="form-input" v-model="step.config.value" placeholder="Comparison value" />
                </div>
              </template>
              <template v-else-if="step.type === 'add_tag'">
                <div class="form-group">
                  <label class="form-label">Tag Name</label
                  ><input class="form-input" v-model="step.config.tag" placeholder="Enter tag name" />
                </div>
              </template>
            </div>
            <div class="flex justify-center py-2 text-text-muted" v-if="idx < selected.steps.length - 1">
              <ArrowDown :size="16" />
            </div>
          </template>

          <div class="mt-4 flex justify-center">
            <button v-if="!showStepSelector" class="btn-secondary text-sm px-3 py-1.5" @click="showStepSelector = true">
              <Plus :size="16" /> Add Step
            </button>
            <div v-else class="flex gap-2 flex-wrap justify-center">
              <button
                v-for="st in ['send_email', 'wait', 'condition', 'add_tag', 'end'] as const"
                :key="st"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-bg-secondary border border-border rounded-lg text-text-secondary text-[13px] font-medium cursor-pointer font-sans transition-all duration-150 hover:border-accent hover:text-accent hover:bg-accent/5"
                @click="addStep(st)"
              >
                <component :is="stepIcons[st]" :size="16" /> {{ stepLabels[st] }}
              </button>
              <button class="btn-ghost text-sm px-3 py-1.5" @click="showStepSelector = false">
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="flex-1 min-w-0 flex flex-col gap-4 items-center justify-center min-h-[400px]">
        <Workflow :size="48" class="text-text-muted" />
        <p class="text-text-muted">Select an automation to view its workflow</p>
      </div>
    </div>
  </MainLayout>

  <!-- Create Modal -->
  <Transition name="modal">
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]"
      @click.self="showCreateModal = false"
    >
      <div class="glass-card w-full max-w-[500px] mx-4">
        <div class="flex justify-between items-center px-6 py-5 border-b border-border">
          <h3 class="text-lg font-semibold">New Automation</h3>
          <button
            class="bg-transparent border-none cursor-pointer text-text-muted p-1 rounded transition-all duration-150 flex items-center hover:text-danger hover:bg-danger/10"
            @click="showCreateModal = false"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="p-6">
          <div class="form-group">
            <label class="form-label">Name</label
            ><input class="form-input" v-model="createForm.name" placeholder="Welcome sequence..." />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label
            ><input class="form-input" v-model="createForm.description" placeholder="Optional description" />
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
            <label class="form-label">Entry List ID <span class="text-text-muted">(optional)</span></label
            ><input class="form-input" v-model="createForm.entry_list_id" placeholder="Contact list to enroll from" />
          </div>
        </div>
        <div class="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button class="btn-ghost" @click="showCreateModal = false">Cancel</button>
          <button class="btn-primary" :disabled="!createForm.name || creating" @click="handleCreate">
            <Loader2 v-if="creating" :size="16" class="spin" /> Create Automation
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .glass-card,
.modal-leave-active .glass-card {
  transition: transform 0.2s;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .glass-card,
.modal-leave-to .glass-card {
  transform: scale(0.95);
}
</style>
