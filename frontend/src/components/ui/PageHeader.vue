<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="flex justify-between items-start mb-8 gap-4 flex-wrap">
    <div class="min-w-0">
      <h1 class="text-[24px] font-bold text-text-primary leading-tight tracking-[-0.02em] m-0">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="text-sm text-text-muted mt-1 m-0">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-3 shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>
