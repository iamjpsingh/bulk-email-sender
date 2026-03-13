<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../../lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const classes = computed(() =>
  cn(
    'bg-bg-card border border-border rounded-[--radius-lg] shadow-sm transition-shadow duration-200 hover:shadow-md',
    props.class,
  ),
)
</script>

<template>
  <div :class="classes">
    <div
      v-if="$slots.header"
      class="flex flex-col gap-1.5 px-6 py-4"
    >
      <slot name="header" />
    </div>
    <div class="px-6 py-4">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="flex items-center px-6 py-4 border-t border-border"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
