<script setup lang="ts">
defineProps<{
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'default'
}>()
</script>

<template>
  <span :class="['badge', `badge--${variant || 'default'}`]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
  white-space: nowrap;
}
.badge--default {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}
.badge--success {
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-success);
}
.badge--warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--color-warning);
}
.badge--danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger);
}
.badge--info {
  background: rgba(59, 130, 246, 0.15);
  color: var(--color-info);
}
.badge--accent {
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-accent);
}
</style>
