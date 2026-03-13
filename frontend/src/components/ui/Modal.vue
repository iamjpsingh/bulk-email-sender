<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closable?: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true
})

const emit = defineEmits<Emits>()
const containerRef = ref<HTMLElement | null>(null)

function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !containerRef.value) return
  const focusable = containerRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable.length) return
  const first = focusable[0] as HTMLElement | undefined
  const last = focusable[focusable.length - 1] as HTMLElement | undefined
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleClose() {
  if (props.closable) {
    emit('close')
  }
}

function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.show) {
    handleClose()
  }
}

watch(() => props.show, async (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', trapFocus)
    await nextTick()
    const firstFocusable = containerRef.value?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  } else {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', trapFocus)
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  if (props.show) {
    document.body.style.overflow = 'hidden'
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
  document.removeEventListener('keydown', trapFocus)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="modal-overlay"
        @click="handleOverlayClick"
        role="dialog"
        :aria-modal="true"
        :aria-label="title"
      >
        <div
          ref="containerRef"
          :class="[
            'modal-container',
            `modal-${size}`
          ]"
          @click.stop
        >
          <!-- Header -->
          <div v-if="title || closable" class="modal-header">
            <h3 v-if="title" class="modal-title">{{ title }}</h3>
            <button
              v-if="closable"
              class="modal-close"
              @click="handleClose"
              aria-label="Close dialog"
            >
              <X :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="modal-content">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 10000;
}

.modal-container {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.6);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
}
.modal-sm { max-width: 400px; }
.modal-md { max-width: 500px; }
.modal-lg { max-width: 700px; }
.modal-xl { max-width: 900px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}
.modal-title { font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.modal-close:hover { background: rgba(239, 68, 68, 0.1); color: var(--color-danger); }

.modal-content { flex: 1; padding: 24px; overflow-y: auto; }
.modal-footer { padding: 16px 24px; border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; gap: 12px; }

/* Transition */
.modal-enter-active { transition: opacity 0.25s ease; }
.modal-enter-active .modal-container { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-leave-active .modal-container { transition: transform 0.15s ease, opacity 0.15s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-container { transform: scale(0.95) translateY(10px); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-container { transform: scale(0.97); opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal-container,
  .modal-leave-active .modal-container {
    transition: none;
  }
}
</style>
