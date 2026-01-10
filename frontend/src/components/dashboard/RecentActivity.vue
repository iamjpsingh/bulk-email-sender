<script setup lang="ts">
import type { EmailLog } from '../../stores/email'
import { ClipboardList, Inbox, Check, X } from 'lucide-vue-next'

defineProps<{
  logs: EmailLog[]
}>()

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getStatusClass(status: string) {
  switch (status) {
    case 'Sent': return 'success'
    case 'Failed': return 'danger'
    default: return 'warning'
  }
}
</script>

<template>
  <div class="recent-activity glass-card">
    <div class="card-header">
      <h3>
        <ClipboardList :size="18" class="header-icon" />
        Recent Activity
      </h3>
      <router-link to="/reports" class="btn btn-ghost btn-sm">
        View All
      </router-link>
    </div>
    
    <div v-if="logs.length === 0" class="empty-state">
      <Inbox :size="48" class="empty-icon" />
      <p>No recent activity</p>
    </div>
    
    <div v-else class="activity-list">
      <div v-for="log in logs" :key="log.id" class="activity-item">
        <div class="activity-status" :class="getStatusClass(log.status)">
          <Check v-if="log.status === 'Sent'" :size="14" />
          <X v-else :size="14" />
        </div>
        <div class="activity-content">
          <div class="activity-email truncate">{{ log.email }}</div>
          <div class="activity-meta">
            <span :class="`badge badge-${getStatusClass(log.status)}`">
              {{ log.status }}
            </span>
            <span class="activity-time">{{ formatTime(log.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.recent-activity {
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
  }
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  transition: background 0.2s ease;
  
  &:hover {
    background: rgba(6, 182, 212, 0.05);
  }
}

.activity-status {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  
  &.success {
    background: rgba(16, 185, 129, 0.15);
    color: var(--success);
  }
  
  &.danger {
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger);
  }
  
  &.warning {
    background: rgba(245, 158, 11, 0.15);
    color: var(--warning);
  }
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-email {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.activity-time {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
</style>
