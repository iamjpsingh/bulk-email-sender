<script setup lang="ts">
defineProps<{
  label: string
  required?: boolean
  error?: string
  helpText?: string
}>()
</script>

<template>
  <div class="form-group">
    <label class="form-label">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </label>
    <slot />
    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-else-if="helpText" class="form-help">{{ helpText }}</p>
  </div>
</template>

<style scoped>
.form-error {
  font-size: 12px;
  color: var(--color-danger);
  margin: 6px 0 0;
}
.form-help {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 6px 0 0;
}
</style>
