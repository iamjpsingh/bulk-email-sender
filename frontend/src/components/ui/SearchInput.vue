<script setup lang="ts">
import { Search } from 'lucide-vue-next'

defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search'): void
}>()
</script>

<template>
  <div class="relative">
    <Search :size="18" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
    <input
      type="text"
      class="form-input pl-[42px]"
      :value="modelValue"
      :placeholder="placeholder || 'Search...'"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keyup.enter="$emit('search')"
    />
  </div>
</template>
