<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../../lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const classes = computed(() =>
  cn('flex flex-col gap-1.5 px-6 py-4', props.class),
)
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
