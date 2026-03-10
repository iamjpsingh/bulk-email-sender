<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import DateTimePickerModal from './DateTimePickerModal.vue'

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select date and time...'
})

const emit = defineEmits<Emits>()

const showModal = ref(false)

const displayValue = computed(() => {
  if (!props.modelValue) return ''
  
  try {
    const date = new Date(props.modelValue)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return props.modelValue
  }
})

function handleInputClick() {
  if (!props.disabled) {
    showModal.value = true
  }
}

function handleDateTimeUpdate(value: string) {
  emit('update:modelValue', value)
}

function handleModalClose() {
  showModal.value = false
}
</script>

<template>
  <div class="datetime-input-wrapper">
    <input
      :value="displayValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="datetime-input"
      readonly
      @click="handleInputClick"
    />
    <div class="datetime-icon">
      <Calendar :size="16" />
    </div>
    
    <DateTimePickerModal
      :show="showModal"
      :model-value="modelValue"
      @update:model-value="handleDateTimeUpdate"
      @close="handleModalClose"
    />
  </div>
</template>

<style scoped lang="scss">
.datetime-input-wrapper {
  position: relative;
}

.datetime-input {
  width: 100%;
  padding: 14px 48px 14px 16px;
  font-family: var(--font-sans);
  font-size: 15px;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  cursor: pointer;

  &::placeholder {
    color: var(--color-text-muted);
  }

  &:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
    background: var(--color-bg-primary);
  }

  &:hover:not(:focus) {
    border-color: rgba(99, 102, 241, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--color-bg-card);
  }
}

.datetime-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-accent);
  pointer-events: none;
  transition: color 0.2s ease;
}
</style>