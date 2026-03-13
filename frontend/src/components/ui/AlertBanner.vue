<script setup lang="ts">
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  type?: 'success' | 'error' | 'warning' | 'info'
  dismissible?: boolean
}>()

defineEmits<{
  (e: 'dismiss'): void
}>()

const icon = computed(() => {
  switch (props.type) {
    case 'success': return CheckCircle
    case 'error': return XCircle
    case 'warning': return AlertTriangle
    default: return Info
  }
})
</script>

<template>
  <div class="alert" :class="`alert--${type || 'info'}`" role="alert">
    <component :is="icon" :size="18" class="alert__icon" />
    <div class="alert__content">
      <slot />
    </div>
    <button v-if="dismissible" class="alert__close" @click="$emit('dismiss')" aria-label="Dismiss">
      <X :size="16" />
    </button>
  </div>
</template>

<style scoped>
.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid;
  font-size: 14px;
  line-height: 1.5;
}
.alert--success {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
}
.alert--error {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
  color: var(--color-danger);
}
.alert--warning {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.2);
  color: var(--color-warning);
}
.alert--info {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.2);
  color: var(--color-info);
}
.alert__icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.alert__content {
  flex: 1;
  min-width: 0;
  color: var(--color-text-secondary);
}
.alert__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}
.alert__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}
</style>
