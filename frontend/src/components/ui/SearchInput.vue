<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'

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
    <Search :size="18" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    <Input
      type="text"
      class="pl-[42px]"
      :model-value="modelValue"
      :placeholder="placeholder || 'Search...'"
      @update:model-value="$emit('update:modelValue', String($event))"
      @keyup.enter="$emit('search')"
    />
  </div>
</template>
