<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Bell } from 'lucide-vue-next'

const props = defineProps<{
  enabled: boolean
  scheduledTime: string
  notifyEmail: string
}>()

const emit = defineEmits([
  'update:enabled',
  'update:scheduledTime',
  'update:notifyEmail'
])

const minDateTime = computed(() => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 5)
  return now.toISOString().slice(0, 16)
})

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
</script>

<template>
  <div class="schedule-settings glass-card">
    <div class="settings-header">
      <label class="form-checkbox">
        <input
          type="checkbox"
          :checked="enabled"
          @change="emit('update:enabled', ($event.target as HTMLInputElement).checked)"
        />
        <span>
          <Calendar :size="16" class="checkbox-icon" />
          Schedule for Later
        </span>
      </label>
    </div>
    
    <p class="text-muted text-sm mb-4">
      Send emails at a specific date and time
    </p>
    
    <div v-if="enabled" class="settings-content fade-in">
      <div class="form-group">
        <label class="form-label">
          <Calendar :size="14" />
          Schedule Date & Time
        </label>
        <input
          :value="scheduledTime"
          @input="emit('update:scheduledTime', ($event.target as HTMLInputElement).value)"
          type="datetime-local"
          class="form-input"
          :min="minDateTime"
        />
        <span class="text-muted text-sm">Timezone: {{ timezone }}</span>
      </div>
      
      <div class="form-group">
        <label class="form-label">
          <Bell :size="14" />
          Notification Email (Optional)
        </label>
        <input
          :value="notifyEmail"
          @input="emit('update:notifyEmail', ($event.target as HTMLInputElement).value)"
          type="email"
          class="form-input"
          placeholder="you@example.com"
        />
        <span class="text-muted text-sm">Get notified when campaign completes</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.schedule-settings {
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

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
