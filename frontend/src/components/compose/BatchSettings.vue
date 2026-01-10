<script setup lang="ts">
import { computed } from 'vue'
import { Zap, Clock, Mail } from 'lucide-vue-next'

const props = defineProps<{
  enabled: boolean
  batchSize: number
  batchDelay: number
  emailDelay: number
  contactCount: number
}>()

const emit = defineEmits([
  'update:enabled',
  'update:batchSize',
  'update:batchDelay',
  'update:emailDelay'
])

const totalBatches = computed(() => {
  if (props.contactCount === 0) return 0
  return Math.ceil(props.contactCount / props.batchSize)
})

const estimatedTime = computed(() => {
  if (props.contactCount === 0) return '0 min'
  
  const batchCount = totalBatches.value
  
  // Time for emails within batches
  const emailTime = props.contactCount * props.emailDelay / 60
  
  // Time between batches
  const batchTime = (batchCount - 1) * props.batchDelay
  
  const totalMinutes = Math.round(emailTime + batchTime)
  
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return `${hours}h ${mins}m`
})
</script>

<template>
  <div class="batch-settings glass-card">
    <div class="settings-header">
      <label class="form-checkbox">
        <input
          type="checkbox"
          :checked="enabled"
          @change="emit('update:enabled', ($event.target as HTMLInputElement).checked)"
        />
        <span>
          <Zap :size="16" class="checkbox-icon" />
          Enable Batch Processing
        </span>
      </label>
    </div>
    
    <p class="text-muted text-sm mb-4">
      Recommended for large lists to avoid Gmail/SMTP rate limits
    </p>
    
    <div v-if="enabled" class="settings-content fade-in">
      <div class="settings-grid">
        <div class="form-group">
          <label class="form-label">
            <Mail :size="14" />
            Emails per Batch
          </label>
          <input
            :value="batchSize"
            @input="emit('update:batchSize', Number(($event.target as HTMLInputElement).value))"
            type="number"
            class="form-input"
            min="5"
            max="50"
          />
          <span class="text-muted text-sm">Max 20 for Gmail</span>
        </div>
        
        <div class="form-group">
          <label class="form-label">
            <Clock :size="14" />
            Batch Delay (min)
          </label>
          <input
            :value="batchDelay"
            @input="emit('update:batchDelay', Number(($event.target as HTMLInputElement).value))"
            type="number"
            class="form-input"
            min="30"
            max="180"
          />
          <span class="text-muted text-sm">Between batches</span>
        </div>
        
        <div class="form-group">
          <label class="form-label">
            <Clock :size="14" />
            Email Delay (sec)
          </label>
          <input
            :value="emailDelay"
            @input="emit('update:emailDelay', Number(($event.target as HTMLInputElement).value))"
            type="number"
            class="form-input"
            min="30"
            max="60"
          />
          <span class="text-muted text-sm">Between emails</span>
        </div>
      </div>
      
      <div v-if="contactCount > 0" class="batch-preview">
        <div class="preview-item">
          <span class="preview-label">Total Batches</span>
          <span class="preview-value mono">{{ totalBatches }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">Estimated Time</span>
          <span class="preview-value mono text-accent">{{ estimatedTime }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.batch-settings {
  padding: 20px;
}

.settings-header {
  margin-bottom: 8px;
  
  .form-checkbox {
    span {
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  
  .checkbox-icon {
    color: var(--accent-primary);
  }
}

.settings-content {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.batch-preview {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.preview-value {
  font-size: 18px;
  font-weight: 600;
}
</style>
