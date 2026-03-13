<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 rounded-[--radius-md] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent/90 shadow-sm active:bg-accent/80',
        secondary:
          'bg-bg-secondary text-text-primary border border-border hover:bg-bg-tertiary active:bg-bg-tertiary/80',
        outline:
          'border border-border bg-transparent text-text-secondary hover:bg-bg-secondary hover:text-text-primary active:bg-bg-tertiary',
        ghost:
          'bg-transparent text-text-secondary hover:bg-bg-secondary hover:text-text-primary active:bg-bg-tertiary',
        destructive: 'bg-danger text-white hover:bg-danger/90 shadow-sm active:bg-danger/80',
        link: 'text-accent underline-offset-4 hover:underline bg-transparent',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        sm: 'h-8 px-3 text-xs gap-1.5',
        lg: 'h-12 px-7 text-base gap-2.5',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonVariants = VariantProps<typeof buttonVariants>

interface Props {
  variant?: NonNullable<ButtonVariants['variant']>
  size?: NonNullable<ButtonVariants['size']>
  disabled?: boolean
  loading?: boolean
  asChild?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  disabled: false,
  loading: false,
  asChild: false,
})

const attrs = useAttrs()

const isLink = computed(() => !!attrs.href || !!attrs.to)
const tag = computed(() => {
  if (props.asChild) return 'span'
  if (isLink.value) return 'a'
  return 'button'
})

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class),
)
</script>

<template>
  <component
    :is="tag"
    :class="classes"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading || undefined"
    v-bind="$attrs"
  >
    <svg
      v-if="loading"
      class="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <slot />
  </component>
</template>
