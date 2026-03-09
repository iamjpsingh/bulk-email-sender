<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '../stores/auth'
import { useDashboardStats, usePauseJob, useResumeJob, useCancelJob } from '../lib/query'
// Queue types come from dashboardData
import {
  Mail,
  CheckCircle,
  XCircle,
  TrendingUp,
  Plus,
  PenSquare,
  BarChart3,
  Settings,
  Download,
  LayoutDashboard,
  LogOut,
  Send,
  Pause,
  Play,
  X,
  Loader2,
  Clock,
  Inbox
} from 'lucide-vue-next'

const { user, logout } = useAuth()

// Use TanStack Query for dashboard data
const { data: dashboardData } = useDashboardStats()

const stats = computed(() => dashboardData.value?.stats || { total: 0, sent: 0, failed: 0 })
const successRate = computed(() => {
  const s = stats.value
  return s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0
})

// Queue data
const queueData = computed(() => dashboardData.value?.queue || { stats: { pending: 0, running: 0, paused: 0, completed: 0, failed: 0, cancelled: 0, total_sent: 0, total_failed: 0, dead_letters: 0 }, activeJobs: [], pendingJobs: [], recentJobs: [] })
const hasQueueActivity = computed(() => {
  const q = queueData.value.stats
  return q.running > 0 || q.pending > 0 || q.paused > 0
})
const allVisibleJobs = computed(() => {
  const active = queueData.value.activeJobs || []
  const pending = queueData.value.pendingJobs || []
  return [...active, ...pending].slice(0, 5)
})

// Job control mutations
const pauseJob = usePauseJob()
const resumeJob = useResumeJob()
const cancelJob = useCancelJob()

function handlePause(jobId: string) { pauseJob.mutate(jobId) }
function handleResume(jobId: string) { resumeJob.mutate(jobId) }
function handleCancel(jobId: string) { cancelJob.mutate(jobId) }

function statusLabel(status: string) {
  switch (status) {
    case 'running': return 'Running'
    case 'pending': return 'Queued'
    case 'paused': return 'Paused'
    case 'completed': return 'Done'
    case 'failed': return 'Failed'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}

async function handleLogout() {
  await logout()
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/compose', label: 'Compose', icon: Mail },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/configs', label: 'Configs', icon: Settings }
]
</script>

<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <Send class="logo-icon" :size="28" />
          <span class="logo-text">Dispatch</span>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <component :is="item.icon" class="nav-icon" :size="20" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      
      <div class="sidebar-footer">
        <div class="user-info" v-if="user">
          <div class="user-avatar">
            {{ user.name?.charAt(0).toUpperCase() || '?' }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ user.name || 'User' }}</div>
            <div class="user-email">{{ user.email || '' }}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">
          <LogOut :size="16" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
    
    <!-- Main content -->
    <main class="main-content">
      <div class="dashboard fade-in">
        
        <header class="page-header">
          <div>
            <h1>Dashboard</h1>
            <p class="text-muted">Overview of your email campaigns</p>
          </div>
          <router-link to="/compose" class="btn btn-primary">
            <Plus :size="18" />
            New Campaign
          </router-link>
        </header>
        
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <Mail :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.total }}</div>
              <div class="stat-label">Total Sent</div>
            </div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-icon">
              <CheckCircle :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.sent }}</div>
              <div class="stat-label">Delivered</div>
            </div>
          </div>
          
          <div class="stat-card danger">
            <div class="stat-icon">
              <XCircle :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.failed }}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
          
          <div class="stat-card accent">
            <div class="stat-icon">
              <TrendingUp :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ successRate }}%</div>
              <div class="stat-label">Success Rate</div>
            </div>
          </div>
        </div>
        
        <!-- Job Queue Status -->
        <div v-if="hasQueueActivity || allVisibleJobs.length > 0" class="queue-section glass-card">
          <div class="queue-header">
            <h3>
              <Inbox :size="20" />
              Job Queue
            </h3>
            <div class="queue-badges">
              <span v-if="queueData.stats.running > 0" class="badge badge-running">
                <Loader2 :size="12" class="spin" />
                {{ queueData.stats.running }} running
              </span>
              <span v-if="queueData.stats.pending > 0" class="badge badge-pending">
                <Clock :size="12" />
                {{ queueData.stats.pending }} queued
              </span>
              <span v-if="queueData.stats.paused > 0" class="badge badge-paused">
                <Pause :size="12" />
                {{ queueData.stats.paused }} paused
              </span>
            </div>
          </div>

          <div v-if="allVisibleJobs.length > 0" class="job-list">
            <div v-for="job in allVisibleJobs" :key="job.id" class="job-item">
              <div class="job-info">
                <div class="job-subject">{{ job.subject || 'Untitled' }}</div>
                <div class="job-meta">
                  <span class="job-status" :class="'status-' + job.status">{{ statusLabel(job.status) }}</span>
                  <span class="job-count">{{ job.sent_count }}/{{ job.total_count }} sent</span>
                  <span v-if="job.config_name" class="job-config">{{ job.config_name }}</span>
                </div>
              </div>
              <div class="job-progress-wrap">
                <div class="job-progress-bar">
                  <div class="job-progress-fill" :class="'fill-' + job.status" :style="{ width: job.progress + '%' }"></div>
                </div>
                <span class="job-progress-text mono">{{ job.progress }}%</span>
              </div>
              <div class="job-actions">
                <button v-if="job.status === 'running'" class="btn-icon" title="Pause" @click="handlePause(job.id)">
                  <Pause :size="14" />
                </button>
                <button v-if="job.status === 'paused'" class="btn-icon" title="Resume" @click="handleResume(job.id)">
                  <Play :size="14" />
                </button>
                <button v-if="job.status === 'running' || job.status === 'paused' || job.status === 'pending'" class="btn-icon btn-danger" title="Cancel" @click="handleCancel(job.id)">
                  <X :size="14" />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="queue-empty">
            <p class="text-muted">No active jobs</p>
          </div>
        </div>

        <!-- Welcome Message -->
        <div class="welcome-card glass-card">
          <h3>Welcome to Dispatch!</h3>
          <p class="text-muted">Get started by creating your first email campaign or configuring your SMTP settings.</p>
          <div class="welcome-actions">
            <router-link to="/compose" class="btn btn-primary">
              <PenSquare :size="18" />
              Create Campaign
            </router-link>
            <router-link to="/configs" class="btn btn-secondary">
              <Settings :size="18" />
              Setup SMTP
            </router-link>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="quick-actions glass-card">
          <h3>Quick Actions</h3>
          <div class="actions-grid">
            <router-link to="/compose" class="action-card">
              <PenSquare :size="28" class="action-icon" />
              <span class="action-label">Compose Email</span>
            </router-link>
            <router-link to="/reports" class="action-card">
              <BarChart3 :size="28" class="action-icon" />
              <span class="action-label">View Reports</span>
            </router-link>
            <router-link to="/configs" class="action-card">
              <Settings :size="28" class="action-icon" />
              <span class="action-label">SMTP Settings</span>
            </router-link>
            <a href="/public/samples/sample-contacts.xlsx" class="action-card" download>
              <Download :size="28" class="action-icon" />
              <span class="action-label">Sample Excel</span>
            </a>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  
  &-icon {
    color: var(--accent-primary);
  }
  
  &-text {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(6, 182, 212, 0.1);
    color: var(--text-primary);
  }
  
  &.active {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(20, 184, 166, 0.1));
    color: var(--accent-primary);
    border: 1px solid var(--border-glow);
    
    .nav-icon {
      color: var(--accent-primary);
    }
  }
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--bg-primary);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-content {
  flex: 1;
  margin-left: 260px;
  padding: 32px;
  min-height: 100vh;
  background: var(--bg-primary);
}

.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  
  h1 {
    font-size: 28px;
    margin-bottom: 4px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
  
  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  &.success {
    border-left: 3px solid var(--success);
    
    .stat-icon {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }
  }
  
  &.danger {
    border-left: 3px solid var(--danger);
    
    .stat-icon {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
    }
  }
  
  &.accent {
    border-left: 3px solid var(--accent-primary);
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
    
    .stat-icon {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-primary);
    }
    
    .stat-value {
      color: var(--accent-primary);
    }
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.welcome-card {
  padding: 32px;
  text-align: center;
  margin-bottom: 32px;
  
  h3 {
    font-size: 24px;
    margin-bottom: 12px;
    color: var(--text-primary);
  }
  
  p {
    margin-bottom: 24px;
    font-size: 16px;
  }
}

.welcome-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.quick-actions {
  padding: 24px;
  
  h3 {
    font-size: 18px;
    margin-bottom: 20px;
  }
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    transform: translateY(-2px);
    
    .action-icon {
      transform: scale(1.1);
    }
  }
}

.action-icon {
  transition: transform 0.2s ease;
}

.action-label {
  font-size: 14px;
  font-weight: 500;
}

// Queue Section
.queue-section {
  padding: 24px;
  margin-bottom: 32px;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    margin: 0;
  }
}

.queue-badges {
  display: flex;
  gap: 8px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;

  &-running {
    background: rgba(6, 182, 212, 0.15);
    color: var(--accent-primary);
  }

  &-pending {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  &-paused {
    background: rgba(107, 114, 128, 0.15);
    color: #9ca3af;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.job-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-glow);
  }
}

.job-info {
  flex: 1;
  min-width: 0;
}

.job-subject {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.job-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.job-status {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 11px;

  &.status-running { color: var(--accent-primary); }
  &.status-pending { color: #f59e0b; }
  &.status-paused { color: #9ca3af; }
  &.status-completed { color: var(--success); }
  &.status-failed { color: var(--danger); }
}

.job-progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 140px;
  flex-shrink: 0;
}

.job-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
}

.job-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;

  &.fill-running {
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  }
  &.fill-pending {
    background: #f59e0b;
  }
  &.fill-paused {
    background: #6b7280;
  }
}

.job-progress-text {
  font-size: 12px;
  color: var(--text-secondary);
  width: 36px;
  text-align: right;
}

.job-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.btn-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-primary);
    color: var(--text-primary);
    border-color: var(--accent-primary);
  }

  &.btn-danger:hover {
    color: var(--danger);
    border-color: var(--danger);
  }
}

.queue-empty {
  text-align: center;
  padding: 16px;
}
</style>
