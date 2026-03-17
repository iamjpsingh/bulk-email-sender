<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  label: string
  icon: any
  color: string
  bgColor: string
  borderColor: string
  selected?: boolean
  hasSourceHandle?: boolean
  hasTargetHandle?: boolean
  hasTrueHandle?: boolean
  hasFalseHandle?: boolean
}>()
</script>

<template>
  <div
    class="px-4 py-3 rounded-xl border-2 shadow-sm min-w-[180px] max-w-[220px] transition-all"
    :class="[selected ? 'ring-2 ring-accent/40 shadow-md' : '', borderColor]"
    :style="{ backgroundColor: bgColor }"
  >
    <Handle v-if="hasTargetHandle !== false" type="target" :position="Position.Top" class="!w-3 !h-3 !bg-text-muted !border-2 !border-surface-0" />

    <div class="flex items-center gap-2.5">
      <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" :style="{ backgroundColor: color + '20' }">
        <component :is="icon" :size="14" :style="{ color }" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold text-text-primary truncate">{{ label }}</div>
        <div class="text-[10px] text-text-muted truncate"><slot /></div>
      </div>
    </div>

    <!-- Standard source handle -->
    <Handle v-if="hasSourceHandle !== false && !hasTrueHandle" type="source" :position="Position.Bottom" class="!w-3 !h-3 !bg-text-muted !border-2 !border-surface-0" />

    <!-- Condition: true/false handles -->
    <template v-if="hasTrueHandle">
      <Handle type="source" :position="Position.Bottom" id="true" class="!w-3 !h-3 !bg-green-500 !border-2 !border-surface-0" :style="{ left: '35%' }" />
      <Handle v-if="hasFalseHandle" type="source" :position="Position.Bottom" id="false" class="!w-3 !h-3 !bg-red-500 !border-2 !border-surface-0" :style="{ left: '65%' }" />
      <div class="flex justify-between mt-2 -mx-1 text-[9px] font-medium">
        <span class="text-green-500 pl-2">Yes</span>
        <span v-if="hasFalseHandle" class="text-red-500 pr-2">No</span>
      </div>
    </template>
  </div>
</template>
