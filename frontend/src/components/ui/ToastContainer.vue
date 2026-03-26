<script setup lang="ts">
import { useToast } from '../../composables/useToast'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const { toasts, remove } = useToast()

const iconMap = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info }
const colorMap = {
  success: 'border-l-[var(--color-success)] bg-[rgba(16,185,129,0.12)]',
  error: 'border-l-[var(--color-danger)] bg-[rgba(239,68,68,0.12)]',
  warning: 'border-l-[var(--color-warning)] bg-[rgba(245,158,11,0.12)]',
  info: 'border-l-[var(--color-accent)] bg-[rgba(99,102,241,0.12)]',
}
const textMap = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-accent)]',
}
const titleMap = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed top-5 right-5 z-9999 flex flex-col gap-3 w-[380px] pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-x-full scale-95"
        leave-to-class="opacity-0 translate-x-full scale-95"
        move-class="transition-all duration-300 ease-out"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-start gap-3 py-3.5 px-4 rounded-xl border-l-4 backdrop-blur-xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          :class="colorMap[toast.type]"
          role="alert"
        >
          <component :is="iconMap[toast.type]" :size="20" class="shrink-0 mt-0.5" :class="textMap[toast.type]" />
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold uppercase tracking-wider mb-0.5" :class="textMap[toast.type]">
              {{ titleMap[toast.type] }}
            </div>
            <span class="text-sm text-foreground leading-snug">{{ toast.message }}</span>
          </div>
          <button
            class="shrink-0 p-1.5 -mr-1 -mt-0.5 rounded-lg hover:bg-white/10 text-muted-foreground cursor-pointer transition-colors duration-150"
            @click="remove(toast.id)"
            aria-label="Dismiss notification"
          >
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
