<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../../lib/utils'

interface Props {
  orientation?: 'horizontal' | 'vertical'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'horizontal',
})

const classes = computed(() =>
  cn(
    'shrink-0 bg-border',
    props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
    props.class,
  ),
)
</script>

<template>
  <div
    role="separator"
    :aria-orientation="orientation"
    :class="classes"
  />
</template>
