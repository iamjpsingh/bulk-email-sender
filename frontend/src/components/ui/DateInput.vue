<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import DatePickerModal from './DatePickerModal.vue'

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Select date...'
})

const emit = defineEmits<Emits>()

const showModal = ref(false)

const displayValue = computed(() => {
  const value = props.modelValue
  if (!value) return ''
  
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return ''
  }
})

function handleInputClick() {
  if (!props.disabled) {
    showModal.value = true
  }
}

function handleDateUpdate(value: string) {
  emit('update:modelValue', value)
}

function handleModalClose() {
  showModal.value = false
}
</script>

<template>
  <div class="date-input-wrapper">
    <input
      :value="displayValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="date-input"
      readonly
      @click="handleInputClick"
    />
    <Calendar :size="18" class="date-icon" />
    
    <DatePickerModal
      :show="showModal"
      :model-value="modelValue"
      @update:model-value="handleDateUpdate"
      @close="handleModalClose"
    />
  </div>
</template>

<style scoped>
.date-input-wrapper { position: relative; }
.date-input {
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
}
.date-input::placeholder { color: var(--color-text-muted); }
.date-input:focus { outline: none; border-color: var(--color-accent); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); background: var(--color-bg-primary); }
.date-input:hover:not(:focus) { border-color: rgba(99, 102, 241, 0.3); }
.date-input:disabled { opacity: 0.6; cursor: not-allowed; background: var(--color-bg-card); }
.date-icon { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: var(--color-accent); pointer-events: none; transition: color 0.2s ease; }
</style>