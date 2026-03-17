<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import Modal from '../components/ui/Modal.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import StatCard from '../components/ui/StatCard.vue'
import FlowCanvas from '../components/automation/FlowCanvas.vue'
import NodeConfigPanel from '../components/automation/NodeConfigPanel.vue'
import { automationsApi } from '../lib/api'
import { useToast } from '../composables/useToast'
import {
  Workflow, Plus, Trash2, Play, Pause, Square, Loader2, Inbox, Users, CheckCircle, AlertTriangle, Activity, ArrowLeft,
} from 'lucide-vue-next'

const toast = useToast()

interface Automation {
  id: string
  name: string
  description: string
  trigger_type: string
  status: 'draft' | 'active' | 'paused'
  entry_list_id?: string
  enrolled_count: number
  completed_count: number
  flow_json?: string
  steps?: any[]
  created_at: string
  updated_at: string
}
interface AutomationStats { enrolled: number; completed: number; active: number; failed: number }

const automations = ref<Automation[]>([])
const loading = ref(false)
const selectedId = ref<string | null>(null)
const stats = ref<AutomationStats>({ enrolled: 0, completed: 0, active: 0, failed: 0 })
const showCreateModal = ref(false)
const createForm = ref({ name: '', description: '', trigger_type: 'manual', entry_list_id: '' })
const creating = ref(false)
const deleteConfirm = ref<{ show: boolean; id: string }>({ show: false, id: '' })
const editingNodeId = ref<string | null>(null)
const flowCanvasRef = ref<InstanceType<typeof FlowCanvas> | null>(null)

const selected = computed(() => automations.value.find((a) => a.id === selectedId.value) || null)

// Parse flow_json into Vue Flow nodes/edges
const flowNodes = computed<Node[]>(() => {
  if (!selected.value?.flow_json) return []
  try {
    const flow = JSON.parse(selected.value.flow_json)
    return flow.nodes || []
  } catch { return [] }
})

const flowEdges = computed<Edge[]>(() => {
  if (!selected.value?.flow_json) return []
  try {
    const flow = JSON.parse(selected.value.flow_json)
    return flow.edges || []
  } catch { return [] }
})

// Get the node being edited in config panel
const editingNode = computed(() => {
  if (!editingNodeId.value || !flowCanvasRef.value) return null
  // Access from the VueFlow internal state
  return null // Will be handled via events
})

const triggerLabels: Record<string, string> = {
  list_join: 'List Join', tag_added: 'Tag Added', score_change: 'Score Change',
  date_field: 'Date Field', form_submit: 'Form Submit', manual: 'Manual', api: 'API',
}

async function fetchAutomations() {
  loading.value = true
  try { automations.value = (await automationsApi.list()) as any[] } catch { automations.value = [] }
  finally { loading.value = false }
}

async function selectAutomation(id: string) {
  selectedId.value = id
  editingNodeId.value = null
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
  } catch (e: any) { toast.error(`Failed: ${e.message}`) }
  finally { creating.value = false }
}

async function handleAction(id: string, action: 'activate' | 'pause' | 'deactivate') {
  try {
    const actionMap: Record<string, (id: string) => Promise<void>> = {
      activate: automationsApi.activate, pause: automationsApi.pause, deactivate: automationsApi.deactivate,
    }
    await actionMap[action]!(id)
    await selectAutomation(id)
    await fetchAutomations()
  } catch (e: any) { toast.error(`Action failed: ${e.message}`) }
}

function promptDelete(id: string) { deleteConfirm.value = { show: true, id } }

async function confirmDelete() {
  const id = deleteConfirm.value.id
  deleteConfirm.value.show = false
  try {
    await automationsApi.delete(id)
    automations.value = automations.value.filter((a) => a.id !== id)
    if (selectedId.value === id) selectedId.value = null
  } catch (e: any) { toast.error(`Failed: ${e.message}`) }
}

async function handleFlowSave(nodes: Node[], edges: Edge[]) {
  if (!selected.value) return
  try {
    await automationsApi.update(selected.value.id, {
      name: selected.value.name,
      description: selected.value.description,
      trigger_type: selected.value.trigger_type,
      flow_json: JSON.stringify({ nodes, edges }),
    })
    // Update local
    const idx = automations.value.findIndex(a => a.id === selected.value!.id)
    if (idx >= 0) automations.value[idx].flow_json = JSON.stringify({ nodes, edges })
    toast.success('Flow saved')
  } catch (e: any) { toast.error(`Save failed: ${e.message}`) }
}

function handleNodeSelect(nodeId: string | null) {
  editingNodeId.value = nodeId
}

function handleNodeUpdate(nodeId: string, data: Record<string, any>) {
  // The FlowCanvas handles its own state via VueFlow reactivity
  // This just triggers re-render if needed
}

function handleNodeDelete(nodeId: string) {
  flowCanvasRef.value?.deleteNode(nodeId)
  editingNodeId.value = null
}

fetchAutomations()
</script>

<template>
  <div>
    <PageHeader title="Automations" subtitle="Build automated email workflows with drag-and-drop">
      <template #actions>
        <button class="btn-primary" @click="showCreateModal = true"><Plus :size="16" /> New Automation</button>
      </template>
    </PageHeader>

    <div class="flex gap-6 items-start max-[900px]:flex-col">
      <!-- Sidebar: Automation List -->
      <div class="w-[280px] min-w-[280px] max-[900px]:w-full max-[900px]:min-w-0 bg-bg-card border border-border rounded-xl overflow-hidden shrink-0">
        <div v-if="loading"><Skeleton variant="text" :count="5" height="56px" /></div>
        <EmptyState v-else-if="automations.length === 0" :icon="Inbox" title="No automations yet" />
        <div v-else class="flex flex-col max-h-[calc(100vh-220px)] overflow-y-auto">
          <div
            v-for="a in automations" :key="a.id"
            class="px-4 py-3 cursor-pointer border-b border-border transition-all last:border-b-0"
            :class="selectedId === a.id ? 'bg-accent/8 border-l-[3px] border-l-accent' : 'hover:bg-bg-tertiary'"
            @click="selectAutomation(a.id)"
          >
            <div class="flex justify-between items-center mb-1">
              <span class="font-semibold text-sm text-text-primary truncate">{{ a.name }}</span>
              <StatusBadge :status="a.status" type="automation" />
            </div>
            <div class="flex items-center gap-2 text-xs">
              <span class="text-accent/80">{{ triggerLabels[a.trigger_type] || a.trigger_type }}</span>
              <span class="text-text-muted">{{ a.enrolled_count }} enrolled</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main: Flow Canvas or Empty State -->
      <div class="flex-1 min-w-0 flex flex-col gap-4" v-if="selected">
        <!-- Header -->
        <div class="bg-bg-card border border-border rounded-xl p-4 flex justify-between items-center gap-4">
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-semibold text-text-primary truncate">{{ selected.name }}</h2>
            <p class="text-xs text-text-muted">{{ selected.description || 'No description' }} — {{ triggerLabels[selected.trigger_type] }} trigger</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button v-if="selected.status !== 'active'" class="btn-primary text-xs px-3 py-1.5" @click="handleAction(selected.id, 'activate')">
              <Play :size="14" /> Activate
            </button>
            <button v-if="selected.status === 'active'" class="btn-secondary text-xs px-3 py-1.5" @click="handleAction(selected.id, 'pause')">
              <Pause :size="14" /> Pause
            </button>
            <button v-if="selected.status !== 'draft'" class="btn-secondary text-xs px-3 py-1.5" @click="handleAction(selected.id, 'deactivate')">
              <Square :size="14" /> Stop
            </button>
            <button class="btn-ghost text-xs px-2 py-1.5 text-red-400 hover:text-red-300" @click="promptDelete(selected.id)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <!-- Stats (active only) -->
        <div v-if="selected.status === 'active'" class="grid grid-cols-4 max-[900px]:grid-cols-2 gap-3">
          <StatCard :icon="Users" :value="stats.enrolled" label="Enrolled" />
          <StatCard :icon="Activity" :value="stats.active" label="Active" color="accent" />
          <StatCard :icon="CheckCircle" :value="stats.completed" label="Completed" color="success" />
          <StatCard :icon="AlertTriangle" :value="stats.failed" label="Failed" color="danger" />
        </div>

        <!-- Flow Canvas + Config Panel -->
        <div class="flex gap-4 items-start">
          <div class="flex-1 min-w-0 h-[560px]">
            <FlowCanvas
              ref="flowCanvasRef"
              :key="selected.id"
              :automation-id="selected.id"
              :trigger-type="selected.trigger_type"
              :initial-nodes="flowNodes"
              :initial-edges="flowEdges"
              @save="handleFlowSave"
              @node-select="handleNodeSelect"
            />
          </div>

          <!-- Config Panel (shows when a node is selected) -->
          <!-- We pass the node data from the editing state -->
        </div>
      </div>

      <EmptyState v-else :icon="Workflow" title="No automation selected" description="Select an automation from the list or create a new one" class="flex-1 min-w-0 min-h-[400px]" />
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
          <option value="form_submit">Form Submit</option>
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
          <Loader2 v-if="creating" :size="16" class="animate-spin" /> Create
        </button>
      </template>
    </Modal>

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
