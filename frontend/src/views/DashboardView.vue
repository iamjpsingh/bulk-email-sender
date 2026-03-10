<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardStats, usePauseJob, useResumeJob, useCancelJob } from '../lib/query'
import { useAuth } from '../stores/auth'
import MainLayout from '../components/layout/MainLayout.vue'
import {
  Mail,
  CheckCircle,
  XCircle,
  TrendingUp,
  Plus,
  PenSquare,
  BarChart3,
  Settings,
  Pause,
  Play,
  X,
  Loader2,
  Clock,
  Inbox,
  Users,
  FileText,
  ArrowUpRight,
} from 'lucide-vue-next'

const { user } = useAuth()
const { data: dashboardData, isLoading } = useDashboardStats()

const stats = computed(() => dashboardData.value?.stats || { total: 0, sent: 0, failed: 0 })
const successRate = computed(() => {
  const s = stats.value
  return s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0
})

const queueData = computed(
  () =>
    dashboardData.value?.queue || {
      stats: {
        pending: 0,
        running: 0,
        paused: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total_sent: 0,
        total_failed: 0,
        dead_letters: 0,
      },
      activeJobs: [],
      pendingJobs: [],
      recentJobs: [],
    }
)
const hasQueueActivity = computed(() => {
  const q = queueData.value.stats
  return q.running > 0 || q.pending > 0 || q.paused > 0
})
const allVisibleJobs = computed(() => {
  const active = queueData.value.activeJobs || []
  const pending = queueData.value.pendingJobs || []
  return [...active, ...pending].slice(0, 5)
})

const hasAnyCampaigns = computed(() => stats.value.total > 0)

const pauseJob = usePauseJob()
const resumeJob = useResumeJob()
const cancelJob = useCancelJob()

function handlePause(jobId: string) {
  pauseJob.mutate(jobId)
}
function handleResume(jobId: string) {
  resumeJob.mutate(jobId)
}
function handleCancel(jobId: string) {
  cancelJob.mutate(jobId)
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    running: 'Running',
    pending: 'Queued',
    paused: 'Paused',
    completed: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return map[status] || status
}

const statusColorMap: Record<string, string> = {
  running: 'text-accent',
  pending: 'text-warning',
  paused: 'text-text-muted',
  completed: 'text-success',
  failed: 'text-danger',
}

const fillStyleMap: Record<string, string> = {
  running: 'background: linear-gradient(90deg, var(--color-accent), var(--color-accent-secondary))',
  pending: 'background: var(--color-warning)',
  paused: 'background: var(--color-text-muted)',
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

const firstName = computed(() => {
  const n = user.value?.name
  return n ? n.split(' ')[0] : ''
})
</script>

<template>
  <MainLayout>
    <!-- Header -->
    <header class="flex justify-between items-start mb-8">
      <div>
        <h1 class="text-[28px] font-bold mb-1">
          {{ greeting }}<span v-if="firstName">, {{ firstName }}</span>
        </h1>
        <p class="text-text-muted text-sm">Here's what's happening with your campaigns</p>
      </div>
      <router-link to="/compose" class="btn-primary">
        <Plus :size="18" />
        New Campaign
      </router-link>
    </header>

    <!-- Stats Grid -->
    <div class="grid grid-cols-4 gap-4 mb-8 max-lg:grid-cols-2 max-[480px]:grid-cols-1">
      <div class="stat-card group">
        <div
          class="flex items-center justify-center w-11 h-11 bg-bg-tertiary rounded-xl text-text-secondary group-hover:bg-accent/10 group-hover:text-accent transition-colors duration-200"
        >
          <Mail :size="22" />
        </div>
        <div class="flex-1">
          <div class="text-[26px] font-bold text-text-primary leading-tight font-mono">{{ stats.total }}</div>
          <div class="text-[12px] text-text-muted uppercase tracking-wider">Total Sent</div>
        </div>
      </div>

      <div class="stat-card border-l-[3px] border-l-success group">
        <div class="flex items-center justify-center w-11 h-11 rounded-xl bg-success/15 text-success">
          <CheckCircle :size="22" />
        </div>
        <div class="flex-1">
          <div class="text-[26px] font-bold text-text-primary leading-tight font-mono">{{ stats.sent }}</div>
          <div class="text-[12px] text-text-muted uppercase tracking-wider">Delivered</div>
        </div>
      </div>

      <div class="stat-card border-l-[3px] border-l-danger group">
        <div class="flex items-center justify-center w-11 h-11 rounded-xl bg-danger/15 text-danger">
          <XCircle :size="22" />
        </div>
        <div class="flex-1">
          <div class="text-[26px] font-bold text-text-primary leading-tight font-mono">{{ stats.failed }}</div>
          <div class="text-[12px] text-text-muted uppercase tracking-wider">Failed</div>
        </div>
      </div>

      <div class="stat-card border-l-[3px] border-l-accent group">
        <div class="flex items-center justify-center w-11 h-11 rounded-xl bg-accent/15 text-accent">
          <TrendingUp :size="22" />
        </div>
        <div class="flex-1">
          <div class="text-[26px] font-bold leading-tight font-mono text-accent">{{ successRate }}%</div>
          <div class="text-[12px] text-text-muted uppercase tracking-wider">Success Rate</div>
        </div>
      </div>
    </div>

    <!-- Job Queue -->
    <div v-if="hasQueueActivity || allVisibleJobs.length > 0" class="glass-card p-6 mb-8">
      <div class="flex justify-between items-center mb-5">
        <h3 class="flex items-center gap-2.5 text-base font-semibold m-0">
          <Inbox :size="18" class="text-accent" />
          Active Jobs
        </h3>
        <div class="flex gap-2">
          <span v-if="queueData.stats.running > 0" class="badge-info">
            <Loader2 :size="12" class="animate-spin" />
            {{ queueData.stats.running }} running
          </span>
          <span v-if="queueData.stats.pending > 0" class="badge-warning">
            <Clock :size="12" />
            {{ queueData.stats.pending }} queued
          </span>
          <span
            v-if="queueData.stats.paused > 0"
            class="inline-flex items-center gap-1 py-1 px-2.5 rounded-xl text-xs font-semibold bg-[rgba(107,114,128,0.15)] text-text-muted"
          >
            <Pause :size="12" />
            {{ queueData.stats.paused }} paused
          </span>
        </div>
      </div>

      <div v-if="allVisibleJobs.length > 0" class="flex flex-col gap-2.5">
        <div
          v-for="job in allVisibleJobs"
          :key="job.id"
          class="flex items-center gap-4 py-3 px-4 bg-bg-secondary border border-border rounded-xl transition-all duration-200 hover:border-border-glow"
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-text-primary truncate mb-0.5">
              {{ job.subject || 'Untitled' }}
            </div>
            <div class="flex items-center gap-2 text-xs text-text-muted">
              <span class="font-semibold uppercase tracking-wider text-[11px]" :class="statusColorMap[job.status]">{{
                statusLabel(job.status)
              }}</span>
              <span class="text-text-muted">·</span>
              <span>{{ job.sent_count }}/{{ job.total_count }} sent</span>
              <template v-if="job.config_name">
                <span class="text-text-muted">·</span>
                <span>{{ job.config_name }}</span>
              </template>
            </div>
          </div>
          <div class="flex items-center gap-2 w-[140px] shrink-0">
            <div class="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 ease-out"
                :style="[{ width: job.progress + '%' }, fillStyleMap[job.status] || '']"
              ></div>
            </div>
            <span class="text-xs text-text-secondary w-9 text-right font-mono">{{ job.progress }}%</span>
          </div>
          <div class="flex gap-1 shrink-0">
            <button v-if="job.status === 'running'" class="job-action-btn" title="Pause" @click="handlePause(job.id)">
              <Pause :size="14" />
            </button>
            <button v-if="job.status === 'paused'" class="job-action-btn" title="Resume" @click="handleResume(job.id)">
              <Play :size="14" />
            </button>
            <button
              v-if="['running', 'paused', 'pending'].includes(job.status)"
              class="job-action-btn hover:text-danger! hover:border-danger!"
              title="Cancel"
              @click="handleCancel(job.id)"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Onboarding / Welcome (only when no campaigns yet) -->
    <div v-if="!hasAnyCampaigns && !isLoading" class="glass-card p-10 text-center mb-8">
      <div
        class="w-16 h-16 rounded-2xl bg-linear-to-br from-accent/20 to-accent-secondary/20 flex items-center justify-center mx-auto mb-5"
      >
        <PenSquare :size="28" class="text-accent" />
      </div>
      <h3 class="text-2xl mb-2 text-text-primary">Ready to send your first campaign?</h3>
      <p class="text-text-muted mb-6 text-sm max-w-md mx-auto">
        Set up your SMTP configuration, upload your contacts, and compose your first email. It only takes a few minutes.
      </p>
      <div class="flex justify-center gap-3 flex-wrap">
        <router-link to="/configs" class="btn-secondary">
          <Settings :size="16" />
          Setup SMTP
        </router-link>
        <router-link to="/compose" class="btn-primary">
          <PenSquare :size="16" />
          Create Campaign
        </router-link>
      </div>
    </div>

    <!-- Quick Actions -->
    <div>
      <h3 class="text-base font-semibold mb-4 text-text-primary">Quick Actions</h3>
      <div class="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2 max-[480px]:grid-cols-1">
        <router-link to="/compose" class="quick-action group">
          <PenSquare :size="22" class="text-accent transition-transform duration-200 group-hover:scale-110" />
          <span class="text-[13px] font-medium">Compose</span>
          <ArrowUpRight
            :size="14"
            class="absolute top-3 right-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />
        </router-link>
        <router-link to="/campaigns" class="quick-action group">
          <Mail :size="22" class="text-accent transition-transform duration-200 group-hover:scale-110" />
          <span class="text-[13px] font-medium">Campaigns</span>
          <ArrowUpRight
            :size="14"
            class="absolute top-3 right-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />
        </router-link>
        <router-link to="/contacts" class="quick-action group">
          <Users :size="22" class="text-accent transition-transform duration-200 group-hover:scale-110" />
          <span class="text-[13px] font-medium">Contacts</span>
          <ArrowUpRight
            :size="14"
            class="absolute top-3 right-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />
        </router-link>
        <router-link to="/reports" class="quick-action group">
          <BarChart3 :size="22" class="text-accent transition-transform duration-200 group-hover:scale-110" />
          <span class="text-[13px] font-medium">Reports</span>
          <ArrowUpRight
            :size="14"
            class="absolute top-3 right-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />
        </router-link>
        <router-link to="/templates" class="quick-action group">
          <FileText :size="22" class="text-accent transition-transform duration-200 group-hover:scale-110" />
          <span class="text-[13px] font-medium">Templates</span>
          <ArrowUpRight
            :size="14"
            class="absolute top-3 right-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />
        </router-link>
      </div>
    </div>
  </MainLayout>
</template>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  transition: all 0.2s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.job-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.job-action-btn:hover {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-color: var(--color-accent);
}

.quick-action {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  text-decoration: none;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}
.quick-action:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
}
</style>
