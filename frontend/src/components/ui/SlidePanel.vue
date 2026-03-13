<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  show: boolean
  title?: string
  size?: 'md' | 'lg' | 'xl'
  flush?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'lg',
  flush: false,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.show) {
    emit('close')
  }
}

watch(() => props.show, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  if (props.show) document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="slide">
      <div v-if="show" class="slide-overlay" @click.self="emit('close')">
        <div :class="['slide-panel', `slide-panel--${size}`]">
          <div v-if="title" class="slide-panel__header">
            <h2 class="slide-panel__title">{{ title }}</h2>
            <button class="slide-panel__close" @click="emit('close')" aria-label="Close">
              <X :size="18" />
            </button>
          </div>
          <div class="slide-panel__content" :class="{ 'slide-panel__content--flush': flush }">
            <slot />
          </div>
          <div v-if="$slots.footer" class="slide-panel__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.slide-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  justify-content: flex-end;
}
.slide-panel {
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.slide-panel--md { width: 600px; max-width: 90vw; }
.slide-panel--lg { width: 900px; max-width: 90vw; }
.slide-panel--xl { width: 1100px; max-width: 90vw; }

.slide-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.slide-panel__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}
.slide-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.slide-panel__close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-danger);
}
.slide-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.slide-panel__content--flush {
  padding: 0;
  overflow: hidden;
}
.slide-panel__footer {
  padding: 16px 24px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

/* Transition */
.slide-enter-active { transition: all 0.3s ease; }
.slide-enter-active .slide-panel { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-leave-active { transition: all 0.2s ease; }
.slide-leave-active .slide-panel { transition: transform 0.2s ease; }
.slide-enter-from { background: rgba(0, 0, 0, 0); }
.slide-enter-from .slide-panel { transform: translateX(100%); }
.slide-leave-to { background: rgba(0, 0, 0, 0); }
.slide-leave-to .slide-panel { transform: translateX(100%); }
</style>
