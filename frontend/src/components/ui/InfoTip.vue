<script setup lang="ts">
import { HelpCircle } from 'lucide-vue-next'
import Tooltip from './Tooltip.vue'

withDefaults(defineProps<{
  text: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  size?: number
}>(), {
  side: 'top',
  size: 14,
})
</script>

<template>
  <Tooltip :content="text" :side="side">
    <span class="inline-flex items-center text-text-muted hover:text-text-secondary cursor-help transition-colors">
      <HelpCircle :size="size" />
    </span>
  </Tooltip>
</template>
