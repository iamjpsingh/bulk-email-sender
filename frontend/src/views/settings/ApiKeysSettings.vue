<script setup lang="ts">
import EmptyState from '../../components/ui/EmptyState.vue'
import { Hash } from 'lucide-vue-next'
</script>

<template>
  <div>
    <div class="mb-5">
      <h2 class="flex items-center gap-2.5 text-base font-semibold text-text-primary mb-1">
        <Hash :size="18" class="text-accent" /> API Keys
      </h2>
      <p class="text-text-muted text-sm">Manage API keys for programmatic access</p>
    </div>

    <div class="bg-bg-card border border-border rounded-xl">
      <EmptyState
        :icon="Hash"
        title="API Keys"
        description="API key management will be available here. Use the backend API to create and manage keys."
      />
    </div>
  </div>
</template>
