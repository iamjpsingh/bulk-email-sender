<script setup lang="ts">
import DateTimeInput from '../ui/DateTimeInput.vue'
import { Zap, Clock } from 'lucide-vue-next'

const useBatch = defineModel<boolean>('useBatch', { required: true })
const batchSize = defineModel<number>('batchSize', { required: true })
const batchDelay = defineModel<number>('batchDelay', { required: true })
const emailDelay = defineModel<number>('emailDelay', { required: true })
const useSchedule = defineModel<boolean>('useSchedule', { required: true })
const scheduledTime = defineModel<string>('scheduledTime', { required: true })
const notifyEmail = defineModel<string>('notifyEmail', { required: true })
</script>

<template>
  <!-- Batch settings -->
  <div class="glass-card p-5">
    <h3 class="text-[15px] mb-4 flex items-center gap-2">
      <Zap :size="18" class="text-accent" />
      Batch Settings
    </h3>
    <label class="form-checkbox">
      <input type="checkbox" v-model="useBatch" />
      <span>Enable batch sending</span>
    </label>

    <div v-if="useBatch" class="mt-4 pt-4 border-t border-border">
      <div class="form-group">
        <label class="form-label">Batch Size</label>
        <input v-model.number="batchSize" type="number" class="form-input" min="1" max="100" />
      </div>
      <div class="form-group">
        <label class="form-label">Batch Delay (seconds)</label>
        <input v-model.number="batchDelay" type="number" class="form-input" min="1" />
      </div>
      <div class="form-group">
        <label class="form-label">Email Delay (seconds)</label>
        <input v-model.number="emailDelay" type="number" class="form-input" min="1" />
      </div>
    </div>
  </div>

  <!-- Schedule settings -->
  <div class="glass-card p-5">
    <h3 class="text-[15px] mb-4 flex items-center gap-2">
      <Clock :size="18" class="text-accent" />
      Schedule Settings
    </h3>
    <label class="form-checkbox">
      <input type="checkbox" v-model="useSchedule" />
      <span>Schedule for later</span>
    </label>

    <div v-if="useSchedule" class="mt-4 pt-4 border-t border-border">
      <div class="form-group">
        <label class="form-label">Scheduled Time</label>
        <DateTimeInput v-model="scheduledTime" placeholder="Select date and time" />
      </div>
      <div class="form-group">
        <label class="form-label">Notification Email (optional)</label>
        <input v-model="notifyEmail" type="email" class="form-input" placeholder="notify@example.com" />
      </div>
    </div>
  </div>
</template>
