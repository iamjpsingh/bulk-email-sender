<script setup lang="ts">
defineProps<{
  variant?: 'text' | 'card' | 'table-row' | 'circle' | 'stat-card'
  width?: string
  height?: string
  count?: number
}>()
</script>

<template>
  <template v-if="variant === 'card'">
    <div v-for="i in (count || 1)" :key="i" class="skeleton-card">
      <div class="skeleton skeleton-line" style="width: 60%; height: 16px" />
      <div class="skeleton skeleton-line" style="width: 80%; height: 12px" />
      <div class="skeleton skeleton-line" style="width: 40%; height: 12px" />
    </div>
  </template>

  <template v-else-if="variant === 'table-row'">
    <tr v-for="i in (count || 3)" :key="i" class="skeleton-row">
      <td v-for="c in 5" :key="c" class="px-4 py-3">
        <div class="skeleton skeleton-line" :style="{ width: `${50 + Math.random() * 40}%`, height: '14px' }" />
      </td>
    </tr>
  </template>

  <template v-else-if="variant === 'stat-card'">
    <div v-for="i in (count || 4)" :key="i" class="skeleton-stat">
      <div class="skeleton" style="width: 44px; height: 44px; border-radius: var(--radius-md)" />
      <div class="flex flex-col gap-2 flex-1">
        <div class="skeleton skeleton-line" style="width: 60%; height: 24px" />
        <div class="skeleton skeleton-line" style="width: 40%; height: 12px" />
      </div>
    </div>
  </template>

  <template v-else-if="variant === 'circle'">
    <div
      class="skeleton"
      :style="{
        width: width || '40px',
        height: height || '40px',
        borderRadius: '50%',
      }"
    />
  </template>

  <template v-else>
    <div
      v-for="i in (count || 1)"
      :key="i"
      class="skeleton skeleton-line"
      :style="{
        width: width || '100%',
        height: height || '14px',
      }"
    />
  </template>
</template>

<style scoped>
.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.skeleton-line {
  border-radius: 4px;
}
.skeleton-stat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.skeleton-row td {
  border-bottom: 1px solid var(--color-border);
}
</style>
