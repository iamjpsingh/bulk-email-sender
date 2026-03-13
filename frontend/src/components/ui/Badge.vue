<script setup lang="ts">
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-accent/15 text-accent',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-danger/15 text-danger',
        info: 'bg-info/15 text-info',
        outline: 'border border-border text-text-secondary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeVariants = VariantProps<typeof badgeVariants>

interface Props {
  variant?: NonNullable<BadgeVariants['variant']>
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
})

const classes = computed(() =>
  cn(badgeVariants({ variant: props.variant }), props.class),
)
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
