<script setup lang="ts">
import EmptyState from '../../components/ui/EmptyState.vue'
import { Webhook } from 'lucide-vue-next'
</script>

<template>
  <div>
    <div class="mb-5">
      <h2 class="flex items-center gap-2.5 text-base font-semibold text-text-primary mb-1">
        <Webhook :size="18" class="text-accent" /> Webhooks
      </h2>
      <p class="text-text-muted text-sm">Configure webhooks to receive real-time event notifications</p>
    </div>

    <div class="bg-bg-card border border-border rounded-xl">
      <EmptyState
        :icon="Webhook"
        title="Webhooks"
        description="Webhook management will be available here. Use the backend API to create and manage webhooks."
      />
    </div>
  </div>
</template>
