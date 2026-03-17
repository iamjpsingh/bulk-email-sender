<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '@vue-flow/core'
import { NODE_TYPES, type NodeTypeName } from './nodes'
import { X, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  node: Node | null
}>()

const emit = defineEmits<{
  close: []
  delete: [nodeId: string]
  update: [nodeId: string, data: Record<string, any>]
}>()

const nodeType = computed(() => props.node?.type as NodeTypeName | undefined)
const nodeConfig = computed(() => NODE_TYPES[nodeType.value as NodeTypeName])
const config = computed(() => props.node?.data?.config || {})

function updateConfig(key: string, value: any) {
  if (!props.node) return
  const updated = { ...props.node.data, config: { ...config.value, [key]: value } }
  // Also update summary for display
  updated.summary = getSummary(props.node.type as string, { ...config.value, [key]: value })
  emit('update', props.node.id, updated)
}

function getSummary(type: string, cfg: Record<string, any>): string {
  switch (type) {
    case 'send_email': return cfg.subject || 'No subject'
    case 'wait': return `${cfg.duration || 1} ${cfg.unit || 'days'}`
    case 'delay_until': return cfg.date || 'Not set'
    case 'condition': return cfg.field ? `${cfg.field} ${cfg.operator || '='} ${cfg.value || ''}` : 'Not configured'
    case 'filter': return cfg.field ? `${cfg.field} ${cfg.operator || '='} ${cfg.value || ''}` : 'Not configured'
    case 'split_test': return `${cfg.percentage_a || 50}% / ${cfg.percentage_b || 50}%`
    case 'add_tag': return cfg.tag || 'No tag'
    case 'remove_tag': return cfg.tag || 'No tag'
    case 'update_contact': return cfg.field ? `${cfg.field} = ${cfg.value || ''}` : 'Not configured'
    case 'move_to_list': return cfg.list_id || 'No list'
    case 'score_change': return cfg.amount ? `${cfg.amount > 0 ? '+' : ''}${cfg.amount}` : 'Not set'
    case 'http_request': return cfg.url || 'No URL'
    case 'webhook': return cfg.url || 'No URL'
    default: return ''
  }
}
</script>

<template>
  <div v-if="node && nodeConfig" class="bg-surface-1 border border-border rounded-xl p-4 w-72">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded flex items-center justify-center" :style="{ backgroundColor: nodeConfig.color + '20' }">
          <component :is="nodeConfig.icon" :size="12" :style="{ color: nodeConfig.color }" />
        </div>
        <span class="text-sm font-semibold text-text-primary">{{ nodeConfig.label }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button v-if="node.type !== 'trigger'" @click="emit('delete', node.id)" class="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition">
          <Trash2 :size="14" />
        </button>
        <button @click="emit('close')" class="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text-secondary transition">
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Trigger config -->
    <template v-if="node.type === 'trigger'">
      <p class="text-xs text-text-muted">Trigger type is set when creating the automation.</p>
    </template>

    <!-- Send Email -->
    <template v-else-if="node.type === 'send_email'">
      <div class="space-y-3">
        <div class="form-group mb-0">
          <label class="form-label text-xs">Subject Line</label>
          <input class="form-input text-sm" :value="config.subject" @input="updateConfig('subject', ($event.target as HTMLInputElement).value)" placeholder="Email subject..." />
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Template ID</label>
          <input class="form-input text-sm" :value="config.template_id" @input="updateConfig('template_id', ($event.target as HTMLInputElement).value)" placeholder="Select template..." />
        </div>
      </div>
    </template>

    <!-- Wait -->
    <template v-else-if="node.type === 'wait'">
      <div class="flex gap-2">
        <div class="form-group mb-0 flex-1">
          <label class="form-label text-xs">Duration</label>
          <input class="form-input text-sm" type="number" min="1" :value="config.duration || 1" @input="updateConfig('duration', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="form-group mb-0 flex-1">
          <label class="form-label text-xs">Unit</label>
          <select class="form-input text-sm" :value="config.unit || 'days'" @change="updateConfig('unit', ($event.target as HTMLSelectElement).value)">
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
          </select>
        </div>
      </div>
    </template>

    <!-- Delay Until -->
    <template v-else-if="node.type === 'delay_until'">
      <div class="form-group mb-0">
        <label class="form-label text-xs">Wait until date/time</label>
        <input class="form-input text-sm" type="datetime-local" :value="config.date" @input="updateConfig('date', ($event.target as HTMLInputElement).value)" />
      </div>
    </template>

    <!-- Condition / Filter -->
    <template v-else-if="node.type === 'condition' || node.type === 'filter'">
      <div class="space-y-3">
        <div class="form-group mb-0">
          <label class="form-label text-xs">Contact Field</label>
          <select class="form-input text-sm" :value="config.field" @change="updateConfig('field', ($event.target as HTMLSelectElement).value)">
            <option value="">Select field...</option>
            <option value="email">Email</option>
            <option value="first_name">First Name</option>
            <option value="last_name">Last Name</option>
            <option value="company">Company</option>
            <option value="engagement_score">Engagement Score</option>
            <option value="status">Status</option>
            <option value="tags">Tags</option>
          </select>
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Operator</label>
          <select class="form-input text-sm" :value="config.operator || 'equals'" @change="updateConfig('operator', ($event.target as HTMLSelectElement).value)">
            <option value="equals">Equals</option>
            <option value="not_equals">Not Equals</option>
            <option value="contains">Contains</option>
            <option value="not_contains">Not Contains</option>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
            <option value="exists">Exists</option>
            <option value="not_exists">Not Exists</option>
            <option value="has_tag">Has Tag</option>
          </select>
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Value</label>
          <input class="form-input text-sm" :value="config.value" @input="updateConfig('value', ($event.target as HTMLInputElement).value)" placeholder="Comparison value..." />
        </div>
      </div>
    </template>

    <!-- Split Test -->
    <template v-else-if="node.type === 'split_test'">
      <div class="flex gap-2">
        <div class="form-group mb-0 flex-1">
          <label class="form-label text-xs">Path A %</label>
          <input class="form-input text-sm" type="number" min="1" max="99" :value="config.percentage_a || 50" @input="updateConfig('percentage_a', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="form-group mb-0 flex-1">
          <label class="form-label text-xs">Path B %</label>
          <input class="form-input text-sm" type="number" min="1" max="99" :value="config.percentage_b || 50" @input="updateConfig('percentage_b', Number(($event.target as HTMLInputElement).value))" />
        </div>
      </div>
    </template>

    <!-- Add/Remove Tag -->
    <template v-else-if="node.type === 'add_tag' || node.type === 'remove_tag'">
      <div class="form-group mb-0">
        <label class="form-label text-xs">Tag Name</label>
        <input class="form-input text-sm" :value="config.tag" @input="updateConfig('tag', ($event.target as HTMLInputElement).value)" placeholder="Enter tag name..." />
      </div>
    </template>

    <!-- Update Contact -->
    <template v-else-if="node.type === 'update_contact'">
      <div class="space-y-3">
        <div class="form-group mb-0">
          <label class="form-label text-xs">Field</label>
          <input class="form-input text-sm" :value="config.field" @input="updateConfig('field', ($event.target as HTMLInputElement).value)" placeholder="e.g. status" />
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">New Value</label>
          <input class="form-input text-sm" :value="config.value" @input="updateConfig('value', ($event.target as HTMLInputElement).value)" placeholder="New value..." />
        </div>
      </div>
    </template>

    <!-- Move to List -->
    <template v-else-if="node.type === 'move_to_list'">
      <div class="form-group mb-0">
        <label class="form-label text-xs">Target List ID</label>
        <input class="form-input text-sm" :value="config.list_id" @input="updateConfig('list_id', ($event.target as HTMLInputElement).value)" placeholder="List ID..." />
      </div>
    </template>

    <!-- Score Change -->
    <template v-else-if="node.type === 'score_change'">
      <div class="form-group mb-0">
        <label class="form-label text-xs">Score Change</label>
        <input class="form-input text-sm" type="number" :value="config.amount || 0" @input="updateConfig('amount', Number(($event.target as HTMLInputElement).value))" placeholder="+10 or -5" />
      </div>
      <p class="text-[10px] text-text-muted mt-1">Positive to add, negative to subtract</p>
    </template>

    <!-- HTTP Request / Webhook -->
    <template v-else-if="node.type === 'http_request' || node.type === 'webhook'">
      <div class="space-y-3">
        <div class="form-group mb-0">
          <label class="form-label text-xs">URL</label>
          <input class="form-input text-sm" :value="config.url" @input="updateConfig('url', ($event.target as HTMLInputElement).value)" placeholder="https://..." />
        </div>
        <div class="form-group mb-0">
          <label class="form-label text-xs">Method</label>
          <select class="form-input text-sm" :value="config.method || 'POST'" @change="updateConfig('method', ($event.target as HTMLSelectElement).value)">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>
    </template>

    <!-- End -->
    <template v-else-if="node.type === 'end'">
      <p class="text-xs text-text-muted">Contacts reaching this node exit the automation.</p>
    </template>

    <!-- Node ID (debug) -->
    <div class="mt-4 pt-3 border-t border-border">
      <span class="text-[10px] text-text-muted font-mono">{{ node.id }}</span>
    </div>
  </div>
</template>
