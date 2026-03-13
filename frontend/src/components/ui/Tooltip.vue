<script setup lang="ts">
import { computed } from 'vue'
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipProvider,
} from 'radix-vue'
import { cn } from '../../lib/utils'

interface Props {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  delayDuration?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  side: 'top',
  sideOffset: 6,
  delayDuration: 300,
})

const contentClasses = computed(() =>
  cn(
    'z-50 overflow-hidden bg-bg-tertiary text-text-primary text-xs px-2.5 py-1.5 rounded-[--radius-sm] shadow-md border border-border',
    'animate-in fade-in-0 zoom-in-95',
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
    'data-[side=top]:slide-in-from-bottom-2',
    'data-[side=right]:slide-in-from-left-2',
    'data-[side=bottom]:slide-in-from-top-2',
    'data-[side=left]:slide-in-from-right-2',
    props.class,
  ),
)
</script>

<template>
  <TooltipProvider :delay-duration="delayDuration">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :side-offset="sideOffset"
          :class="contentClasses"
        >
          {{ content }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
