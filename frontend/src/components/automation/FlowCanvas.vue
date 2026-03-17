<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { VueFlow, useVueFlow, type Node, type Edge, type Connection, MarkerType } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import BaseNode from './nodes/BaseNode.vue'
import { NODE_TYPES, NODE_PALETTE, type NodeTypeName } from './nodes'
import { Plus, Save, Loader2, GripVertical } from 'lucide-vue-next'

const props = defineProps<{
  automationId: string
  triggerType: string
  initialNodes?: Node[]
  initialEdges?: Edge[]
}>()

const emit = defineEmits<{
  save: [nodes: Node[], edges: Edge[]]
  nodeSelect: [nodeId: string | null]
}>()

const saving = ref(false)
const showPalette = ref(false)

const { nodes, edges, addNodes, addEdges, removeNodes, removeEdges, onConnect, onNodeClick, onPaneClick, fitView, getNode } = useVueFlow({
  nodes: props.initialNodes || [],
  edges: props.initialEdges || [],
  defaultEdgeOptions: {
    animated: true,
    style: { stroke: 'var(--color-border)', strokeWidth: 2 },
    markerEnd: MarkerType.ArrowClosed,
  },
})

// Ensure trigger node exists
if (!nodes.value.find(n => n.type === 'trigger')) {
  addNodes([{
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { label: 'Trigger', triggerType: props.triggerType },
  }])
}

// Handle new connections
onConnect((connection: Connection) => {
  addEdges([{
    id: `e-${connection.source}-${connection.target}-${connection.sourceHandle || 'default'}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    animated: true,
    style: { stroke: connection.sourceHandle === 'false' ? '#ef4444' : connection.sourceHandle === 'true' ? '#22c55e' : 'var(--color-border)', strokeWidth: 2 },
    markerEnd: MarkerType.ArrowClosed,
  }])
})

// Node click → emit for config panel
onNodeClick(({ node }) => {
  emit('nodeSelect', node.id)
})

onPaneClick(() => {
  emit('nodeSelect', null)
})

// Add node from palette
function addFlowNode(type: NodeTypeName) {
  const id = `${type}-${Date.now()}`
  const cfg = NODE_TYPES[type]

  // Find a good position: below the last node
  const yPositions = nodes.value.map(n => n.position.y)
  const maxY = yPositions.length ? Math.max(...yPositions) : 0
  const xCenter = 250

  addNodes([{
    id,
    type,
    position: { x: xCenter, y: maxY + 120 },
    data: { label: cfg.label, config: {} },
  }])

  showPalette.value = false
  nextTick(() => {
    emit('nodeSelect', id)
  })
}

function deleteNode(nodeId: string) {
  // Don't delete trigger
  const node = getNode.value(nodeId)
  if (!node || node.type === 'trigger') return

  // Remove connected edges
  const connectedEdges = edges.value.filter(e => e.source === nodeId || e.target === nodeId)
  removeEdges(connectedEdges.map(e => e.id))
  removeNodes([nodeId])
  emit('nodeSelect', null)
}

async function handleSave() {
  saving.value = true
  emit('save', nodes.value, edges.value)
  setTimeout(() => { saving.value = false }, 500)
}

// Expose for parent
defineExpose({ deleteNode, addFlowNode, fitView })
</script>

<template>
  <div class="relative w-full h-full min-h-[500px] bg-surface-0 rounded-xl border border-border overflow-hidden">
    <!-- Toolbar -->
    <div class="absolute top-3 left-3 z-10 flex items-center gap-2">
      <button
        @click="showPalette = !showPalette"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-1 border border-border rounded-lg text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition shadow-sm"
      >
        <Plus :size="14" /> Add Node
      </button>
      <button
        @click="handleSave"
        :disabled="saving"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 transition shadow-sm disabled:opacity-50"
      >
        <Loader2 v-if="saving" :size="14" class="animate-spin" />
        <Save v-else :size="14" />
        Save
      </button>
      <button
        @click="fitView({ padding: 0.2 })"
        class="px-2.5 py-1.5 bg-surface-1 border border-border rounded-lg text-xs text-text-muted hover:text-text-secondary transition shadow-sm"
      >
        Fit
      </button>
    </div>

    <!-- Node Palette -->
    <div v-if="showPalette" class="absolute top-12 left-3 z-20 bg-surface-1 border border-border rounded-xl shadow-lg p-3 w-56">
      <div v-for="group in NODE_PALETTE" :key="group.category" class="mb-3 last:mb-0">
        <div class="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">{{ group.category }}</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="type in group.items"
            :key="type"
            @click="addFlowNode(type as NodeTypeName)"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-0 border border-border rounded-lg text-[11px] font-medium text-text-secondary hover:border-accent/40 hover:text-accent transition"
          >
            <component :is="NODE_TYPES[type as NodeTypeName].icon" :size="12" :style="{ color: NODE_TYPES[type as NodeTypeName].color }" />
            {{ NODE_TYPES[type as NodeTypeName].label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Vue Flow Canvas -->
    <VueFlow
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
      :min-zoom="0.3"
      :max-zoom="2"
      :snap-to-grid="true"
      :snap-grid="[20, 20]"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :edges-updatable="true"
      class="w-full h-full"
    >
      <!-- Custom node rendering -->
      <template #node-trigger="{ data, selected }">
        <BaseNode
          :label="data.label || 'Trigger'"
          :icon="NODE_TYPES.trigger.icon"
          :color="NODE_TYPES.trigger.color"
          :bg-color="NODE_TYPES.trigger.bgColor"
          :border-color="NODE_TYPES.trigger.borderColor"
          :selected="selected"
          :has-target-handle="false"
        >
          {{ data.triggerType || 'Manual' }}
        </BaseNode>
      </template>

      <template v-for="(cfg, type) in NODE_TYPES" :key="type" #[`node-${type}`]="{ data, selected }">
        <BaseNode
          v-if="type !== 'trigger'"
          :label="data.label || cfg.label"
          :icon="cfg.icon"
          :color="cfg.color"
          :bg-color="cfg.bgColor"
          :border-color="cfg.borderColor"
          :selected="selected"
          :has-source-handle="(cfg as any).hasSourceHandle !== false"
          :has-true-handle="(cfg as any).hasTrueHandle === true"
          :has-false-handle="(cfg as any).hasFalseHandle === true"
        >
          {{ data.summary || '' }}
        </BaseNode>
      </template>

      <MiniMap
        :pannable="true"
        :zoomable="true"
        class="!bg-surface-1 !border-border"
      />
      <Controls class="!bg-surface-1 !border-border !shadow-sm" />
    </VueFlow>
  </div>
</template>

<style>
/* Override Vue Flow theme for dark mode compatibility */
.vue-flow {
  --vf-node-bg: var(--color-surface-1);
  --vf-node-text: var(--color-text-primary);
  --vf-handle: var(--color-text-muted);
  --vf-box-shadow: none;
}
.vue-flow__minimap {
  border-radius: 8px;
  overflow: hidden;
}
.vue-flow__controls {
  border-radius: 8px;
  overflow: hidden;
}
.vue-flow__controls button {
  background: var(--color-surface-1);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}
.vue-flow__controls button:hover {
  background: var(--color-surface-2);
}
</style>
