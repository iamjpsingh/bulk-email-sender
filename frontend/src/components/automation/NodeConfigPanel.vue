<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '@vue-flow/core'
import { NODE_TYPES, type NodeTypeName } from './nodes'
import { X, Trash2 } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  <div v-if="node && nodeConfig" class="bg-secondary border border-border rounded-xl p-4 w-72">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded flex items-center justify-center" :style="{ backgroundColor: nodeConfig.color + '20' }">
          <component :is="nodeConfig.icon" :size="12" :style="{ color: nodeConfig.color }" />
        </div>
        <span class="text-sm font-semibold text-foreground">{{ nodeConfig.label }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button v-if="node.type !== 'trigger'" @click="emit('delete', node.id)" class="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition">
          <Trash2 :size="14" />
        </button>
        <button @click="emit('close')" class="p-1 rounded hover:bg-card text-muted-foreground hover:text-muted-foreground transition">
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Trigger config -->
    <template v-if="node.type === 'trigger'">
      <p class="text-xs text-muted-foreground">Trigger type is set when creating the automation.</p>
    </template>

    <!-- Send Email -->
    <template v-else-if="node.type === 'send_email'">
      <div class="space-y-3">
        <div class="mb-0">
          <Label class="text-xs">Subject Line</Label>
          <Input class="text-sm" :model-value="config.subject" @update:model-value="updateConfig('subject', $event)" placeholder="Email subject..." />
        </div>
        <div class="mb-0">
          <Label class="text-xs">Template ID</Label>
          <Input class="text-sm" :model-value="config.template_id" @update:model-value="updateConfig('template_id', $event)" placeholder="Select template..." />
        </div>
      </div>
    </template>

    <!-- Wait -->
    <template v-else-if="node.type === 'wait'">
      <div class="flex gap-2">
        <div class="flex-1">
          <Label class="text-xs">Duration</Label>
          <Input class="text-sm" type="number" min="1" :model-value="config.duration || 1" @update:model-value="updateConfig('duration', Number($event))" />
        </div>
        <div class="flex-1">
          <Label class="text-xs">Unit</Label>
          <Select :model-value="config.unit || 'days'" @update:model-value="updateConfig('unit', $event)">
            <SelectTrigger class="text-sm"><SelectValue placeholder="Unit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="weeks">Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </template>

    <!-- Delay Until -->
    <template v-else-if="node.type === 'delay_until'">
      <div class="mb-0">
        <Label class="text-xs">Wait until date/time</Label>
        <Input class="text-sm" type="datetime-local" :model-value="config.date" @update:model-value="updateConfig('date', $event)" />
      </div>
    </template>

    <!-- Condition / Filter -->
    <template v-else-if="node.type === 'condition' || node.type === 'filter'">
      <div class="space-y-3">
        <div class="mb-0">
          <Label class="text-xs">Contact Field</Label>
          <Select :model-value="config.field || ''" @update:model-value="updateConfig('field', $event)">
            <SelectTrigger class="text-sm"><SelectValue placeholder="Select field..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="first_name">First Name</SelectItem>
              <SelectItem value="last_name">Last Name</SelectItem>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="engagement_score">Engagement Score</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="tags">Tags</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="mb-0">
          <Label class="text-xs">Operator</Label>
          <Select :model-value="config.operator || 'equals'" @update:model-value="updateConfig('operator', $event)">
            <SelectTrigger class="text-sm"><SelectValue placeholder="Operator" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="not_equals">Not Equals</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="not_contains">Not Contains</SelectItem>
              <SelectItem value="greater_than">Greater Than</SelectItem>
              <SelectItem value="less_than">Less Than</SelectItem>
              <SelectItem value="exists">Exists</SelectItem>
              <SelectItem value="not_exists">Not Exists</SelectItem>
              <SelectItem value="has_tag">Has Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="mb-0">
          <Label class="text-xs">Value</Label>
          <Input class="text-sm" :model-value="config.value" @update:model-value="updateConfig('value', $event)" placeholder="Comparison value..." />
        </div>
      </div>
    </template>

    <!-- Split Test -->
    <template v-else-if="node.type === 'split_test'">
      <div class="flex gap-2">
        <div class="flex-1">
          <Label class="text-xs">Path A %</Label>
          <Input class="text-sm" type="number" min="1" max="99" :model-value="config.percentage_a || 50" @update:model-value="updateConfig('percentage_a', Number($event))" />
        </div>
        <div class="flex-1">
          <Label class="text-xs">Path B %</Label>
          <Input class="text-sm" type="number" min="1" max="99" :model-value="config.percentage_b || 50" @update:model-value="updateConfig('percentage_b', Number($event))" />
        </div>
      </div>
    </template>

    <!-- Add/Remove Tag -->
    <template v-else-if="node.type === 'add_tag' || node.type === 'remove_tag'">
      <div class="mb-0">
        <Label class="text-xs">Tag Name</Label>
        <Input class="text-sm" :model-value="config.tag" @update:model-value="updateConfig('tag', $event)" placeholder="Enter tag name..." />
      </div>
    </template>

    <!-- Update Contact -->
    <template v-else-if="node.type === 'update_contact'">
      <div class="space-y-3">
        <div class="mb-0">
          <Label class="text-xs">Field</Label>
          <Input class="text-sm" :model-value="config.field" @update:model-value="updateConfig('field', $event)" placeholder="e.g. status" />
        </div>
        <div class="mb-0">
          <Label class="text-xs">New Value</Label>
          <Input class="text-sm" :model-value="config.value" @update:model-value="updateConfig('value', $event)" placeholder="New value..." />
        </div>
      </div>
    </template>

    <!-- Move to List -->
    <template v-else-if="node.type === 'move_to_list'">
      <div class="mb-0">
        <Label class="text-xs">Target List ID</Label>
        <Input class="text-sm" :model-value="config.list_id" @update:model-value="updateConfig('list_id', $event)" placeholder="List ID..." />
      </div>
    </template>

    <!-- Score Change -->
    <template v-else-if="node.type === 'score_change'">
      <div class="mb-0">
        <Label class="text-xs">Score Change</Label>
        <Input class="text-sm" type="number" :model-value="config.amount || 0" @update:model-value="updateConfig('amount', Number($event))" placeholder="+10 or -5" />
      </div>
      <p class="text-[10px] text-muted-foreground mt-1">Positive to add, negative to subtract</p>
    </template>

    <!-- HTTP Request / Webhook -->
    <template v-else-if="node.type === 'http_request' || node.type === 'webhook'">
      <div class="space-y-3">
        <div class="mb-0">
          <Label class="text-xs">URL</Label>
          <Input class="text-sm" :model-value="config.url" @update:model-value="updateConfig('url', $event)" placeholder="https://..." />
        </div>
        <div class="mb-0">
          <Label class="text-xs">Method</Label>
          <Select :model-value="config.method || 'POST'" @update:model-value="updateConfig('method', $event)">
            <SelectTrigger class="text-sm"><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </template>

    <!-- End -->
    <template v-else-if="node.type === 'end'">
      <p class="text-xs text-muted-foreground">Contacts reaching this node exit the automation.</p>
    </template>

    <!-- Node ID (debug) -->
    <div class="mt-4 pt-3 border-t border-border">
      <span class="text-[10px] text-muted-foreground font-mono">{{ node.id }}</span>
    </div>
  </div>
</template>
