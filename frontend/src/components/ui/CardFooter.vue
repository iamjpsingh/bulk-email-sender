<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../../lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const classes = computed(() =>
  cn('flex items-center px-6 py-4 border-t border-border', props.class),
)
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
