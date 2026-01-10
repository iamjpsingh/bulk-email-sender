<script setup lang="ts">
import { computed } from 'vue'
import { RefreshCw, Zap, Calendar, Moon, Play } from 'lucide-vue-next'

const props = defineProps<{
  batchStatus: any
  scheduledJobs: any[]
}>()

const emit = defineEmits(['refresh'])

const hasActiveJobs = computed(() => {
  return props.batchStatus?.isRunning || props.scheduledJobs?.length > 0
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function getProgress(job: any) {
  if (!job) return 0
  return Math.round((job.emailsSent / job.totalContacts) * 100)
}
</script>

<template>
  <div class="active-jobs glass-card">
    <div class="card-header">
      <h3>
        <Zap :size="18" class="header-icon" />
        Active Jobs
      </h3>
      <button class="btn btn-ghost btn-sm" @click="emit('refresh')">
        <RefreshCw :size="16" />
        Refresh
      </button>
    </div>
    
    <div v-if="!hasActiveJobs" class="empty-state">
      <Moon :size="48" class="empty-icon" />
      <p>No active jobs</p>
      <router-link to="/compose" class="btn btn-secondary btn-sm">
        <Play :size="14" />
        Start a campaign
      </router-link>
    </div>
    
    <div v-else class="jobs-list">
      <!-- Batch Job -->
      <div v-if="batchStatus?.isRunning && batchStatus.currentJob" class="job-item batch">
        <div class="job-header">
          <span class="job-type badge badge-info">Batch</span>
          <span class="job-status pulse">Running</span>
        </div>
        <div class="job-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill"
              :style="{ width: `${getProgress(batchStatus.currentJob)}%` }"
            ></div>
          </div>
          <span class="progress-text mono">
            {{ batchStatus.currentJob.emailsSent }}/{{ batchStatus.currentJob.totalContacts }}
          </span>
        </div>
        <div class="job-meta">
          <span>Batch {{ batchStatus.currentJob.currentBatch }}/{{ batchStatus.currentJob.totalBatches }}</span>
          <span v-if="batchStatus.currentJob.nextBatchTime">
            Next: {{ formatDate(batchStatus.currentJob.nextBatchTime) }}
          </span>
        </div>
      </div>
      
      <!-- Scheduled Jobs -->
      <div 
        v-for="job in scheduledJobs.slice(0, 3)" 
        :key="job.id" 
        class="job-item scheduled"
      >
        <div class="job-header">
          <span class="job-type badge badge-warning">
            <Calendar :size="12" />
            Scheduled
          </span>
          <span class="job-status">{{ job.status }}</span>
        </div>
        <div class="job-subject truncate">{{ job.subject }}</div>
        <div class="job-meta">
          <span>{{ job.contact_count }} contacts</span>
          <span>{{ formatDate(job.scheduled_time) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.active-jobs {
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h3 {
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .header-icon {
    color: var(--accent-primary);
  }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  
  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 12px;
  }
  
  p {
    color: var(--text-muted);
    margin-bottom: 16px;
  }
}

.jobs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.job-item {
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  
  &.batch {
    border-left: 3px solid var(--accent-primary);
  }
  
  &.scheduled {
    border-left: 3px solid var(--warning);
  }
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.job-type {
  display: flex;
  align-items: center;
  gap: 4px;
}

.job-status {
  font-size: 12px;
  color: var(--success);
  font-weight: 600;
}

.job-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.job-subject {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.job-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
