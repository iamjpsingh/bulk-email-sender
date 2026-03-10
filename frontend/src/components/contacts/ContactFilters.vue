<script setup lang="ts">
import { Search, Upload, Plus } from 'lucide-vue-next'

const searchQuery = defineModel<string>('searchQuery', { required: true })

const emit = defineEmits<{
  (e: 'search-input'): void
  (e: 'import'): void
  (e: 'add'): void
}>()
</script>

<template>
  <div class="flex justify-between items-center mb-4 gap-3">
    <div class="flex-1">
      <div class="flex items-center gap-2 bg-bg-secondary border border-border rounded-lg px-3 py-2 max-w-[360px]">
        <Search :size="16" class="text-text-muted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search contacts..."
          class="flex-1 bg-transparent border-none outline-none text-text-primary text-sm"
          @input="emit('search-input')"
        />
      </div>
    </div>
    <div class="flex gap-2">
      <button
        class="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
        @click="emit('import')"
      >
        <Upload :size="14" />
        Import
      </button>
      <button
        class="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
        @click="emit('add')"
      >
        <Plus :size="14" />
        Add
      </button>
    </div>
  </div>
</template>
