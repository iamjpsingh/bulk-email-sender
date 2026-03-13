<script setup lang="ts">
import Modal from './Modal.vue'
import { AlertTriangle } from 'lucide-vue-next'

defineProps<{
  show: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
}>()

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <Modal :show="show" :title="title || 'Confirm'" size="sm" @close="$emit('cancel')">
    <div class="confirm-body">
      <div
        v-if="variant === 'danger' || variant === 'warning'"
        class="confirm-icon"
        :class="`confirm-icon--${variant}`"
      >
        <AlertTriangle :size="24" />
      </div>
      <p class="confirm-message">{{ message }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost btn-sm" @click="$emit('cancel')">
        {{ cancelText || 'Cancel' }}
      </button>
      <button
        :class="['btn btn-sm', variant === 'danger' ? 'btn-danger' : 'btn-primary']"
        @click="$emit('confirm')"
      >
        {{ confirmText || 'Confirm' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.confirm-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 8px 0;
}
.confirm-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
}
.confirm-icon--danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger);
}
.confirm-icon--warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--color-warning);
}
.confirm-message {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
}
</style>
