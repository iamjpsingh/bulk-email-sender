<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardStats, usePauseJob, useResumeJob, useCancelJob } from '../lib/query'
import { useAuth } from '../stores/auth'
import MainLayout from '../components/layout/MainLayout.vue'
import StatCard from '../components/ui/StatCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import AlertBanner from '../components/ui/AlertBanner.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import PageHeader from '../components/ui/PageHeader.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
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
  RefreshCw,
} from 'lucide-vue-next'

const { user } = useAuth()
const { data: dashboardData, isLoading, error, refetch } = useDashboardStats()

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

const currentDate = computed(() => {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
})
</script>

<template>
  <MainLayout>
    <!-- Header -->
    <PageHeader :title="`${greeting}${firstName ? `, ${firstName}` : ''}`" :subtitle="currentDate">
      <template #actions>
        <router-link to="/compose" class="btn-primary">
          <Plus :size="16" />
          New Campaign
        </router-link>
      </template>
    </PageHeader>

    <!-- Stats Grid: Skeleton Loading -->
    <div v-if="isLoading" class="grid grid-cols-4 gap-4 mb-6 max-lg:grid-cols-2 max-[480px]:grid-cols-1">
      <Skeleton variant="stat-card" :count="4" />
    </div>

    <!-- Stats Grid: Error State -->
    <AlertBanner v-else-if="error" type="error">
      <div class="flex items-center gap-3">
        <span>{{ (error as Error).message || 'Failed to load dashboard data' }}</span>
        <button class="btn-ghost btn-sm" @click="refetch()">
          <RefreshCw :size="14" /> Retry
        </button>
      </div>
    </AlertBanner>

    <!-- Stats Grid -->
    <div v-else class="grid grid-cols-4 gap-4 mb-6 max-lg:grid-cols-2 max-[480px]:grid-cols-1">
      <StatCard :icon="Mail" :value="stats.total" label="Total Sent" />
      <StatCard :icon="CheckCircle" :value="stats.sent" label="Delivered" color="success" />
      <StatCard :icon="XCircle" :value="stats.failed" label="Failed" color="danger" />
      <StatCard :icon="TrendingUp" :value="`${successRate}%`" label="Success Rate" color="accent" />
    </div>

    <!-- Job Queue -->
    <div v-if="hasQueueActivity || allVisibleJobs.length > 0" class="bg-bg-card border border-border rounded-xl overflow-hidden mb-6">
      <div class="flex justify-between items-center px-5 py-3.5 border-b border-border">
        <h3 class="flex items-center gap-2.5 text-sm font-semibold text-text-primary m-0">
          <Inbox :size="16" class="text-accent" />
          Active Jobs
        </h3>
        <div class="flex items-center gap-2">
          <span v-if="queueData.stats.running > 0" class="badge-info">
            <Loader2 :size="12" class="animate-spin" />
            {{ queueData.stats.running }} running
          </span>
          <span v-if="queueData.stats.pending > 0" class="inline-flex items-center gap-1 px-2 py-[3px] text-[11px] font-semibold rounded-full bg-warning/12 text-warning">
            <Clock :size="12" />
            {{ queueData.stats.pending }} queued
          </span>
          <span v-if="queueData.stats.paused > 0" class="inline-flex items-center gap-1 px-2 py-[3px] text-[11px] font-semibold rounded-full bg-[rgba(107,114,128,0.12)] text-text-muted">
            <Pause :size="12" />
            {{ queueData.stats.paused }} paused
          </span>
        </div>
      </div>

      <div v-if="allVisibleJobs.length > 0" class="flex flex-col">
        <div
          v-for="(job, idx) in allVisibleJobs"
          :key="job.id"
          :class="['flex items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-accent/3', idx > 0 && 'border-t border-[rgba(148,163,184,0.06)]']"
        >
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-semibold text-text-primary truncate mb-0.5">
              {{ job.subject || 'Untitled' }}
            </div>
            <div class="flex items-center gap-2 text-xs text-text-muted">
              <span class="font-semibold uppercase tracking-wider text-[10px]" :class="statusColorMap[job.status]">{{
                statusLabel(job.status)
              }}</span>
              <span class="opacity-40">|</span>
              <span>{{ job.sent_count }}/{{ job.total_count }} sent</span>
              <template v-if="job.config_name">
                <span class="opacity-40">|</span>
                <span>{{ job.config_name }}</span>
              </template>
            </div>
          </div>
          <div class="flex items-center gap-2.5 w-[140px] shrink-0">
            <ProgressBar :value="job.progress" :variant="job.status === 'running' ? 'accent' : job.status === 'pending' ? 'warning' : 'default'" size="sm" class="flex-1" />
            <span class="text-[11px] text-text-muted w-9 text-right font-mono tabular-nums">{{ job.progress }}%</span>
          </div>
          <div class="flex gap-1 shrink-0">
            <button v-if="job.status === 'running'" class="flex items-center justify-center w-7 h-7 border border-border rounded-md bg-transparent text-text-muted cursor-pointer transition-all duration-150 hover:bg-bg-tertiary hover:text-text-primary hover:border-border-hover" title="Pause" @click="handlePause(job.id)">
              <Pause :size="13" />
            </button>
            <button v-if="job.status === 'paused'" class="flex items-center justify-center w-7 h-7 border border-border rounded-md bg-transparent text-text-muted cursor-pointer transition-all duration-150 hover:bg-bg-tertiary hover:text-text-primary hover:border-border-hover" title="Resume" @click="handleResume(job.id)">
              <Play :size="13" />
            </button>
            <button
              v-if="['running', 'paused', 'pending'].includes(job.status)"
              class="flex items-center justify-center w-7 h-7 border border-border rounded-md bg-transparent text-text-muted cursor-pointer transition-all duration-150 hover:text-danger hover:border-danger hover:bg-danger/8"
              title="Cancel"
              @click="handleCancel(job.id)"
            >
              <X :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Onboarding / Welcome (only when no campaigns yet) -->
    <div v-if="!hasAnyCampaigns && !isLoading && !error" class="bg-bg-card border border-border rounded-xl mb-6">
      <EmptyState
        :icon="PenSquare"
        title="Ready to send your first campaign?"
        description="Set up your SMTP configuration, upload your contacts, and compose your first email. It only takes a few minutes."
      >
        <template #actions>
          <router-link to="/configs" class="btn-secondary">
            <Settings :size="16" />
            Setup SMTP
          </router-link>
          <router-link to="/compose" class="btn-primary">
            <PenSquare :size="16" />
            Create Campaign
          </router-link>
        </template>
      </EmptyState>
    </div>

    <!-- Quick Actions -->
    <div>
      <h3 class="text-sm font-semibold mb-3 text-text-muted uppercase tracking-wider">Quick Actions</h3>
      <div class="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2 max-[480px]:grid-cols-1">
        <router-link to="/compose" class="flex flex-col items-center gap-2 py-5 px-4 bg-bg-secondary border border-border rounded-xl no-underline transition-all duration-150 hover:border-accent group">
          <PenSquare :size="20" class="text-accent" />
          <span class="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">Compose</span>
        </router-link>
        <router-link to="/campaigns" class="flex flex-col items-center gap-2 py-5 px-4 bg-bg-secondary border border-border rounded-xl no-underline transition-all duration-150 hover:border-accent group">
          <Mail :size="20" class="text-accent" />
          <span class="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">Campaigns</span>
        </router-link>
        <router-link to="/contacts" class="flex flex-col items-center gap-2 py-5 px-4 bg-bg-secondary border border-border rounded-xl no-underline transition-all duration-150 hover:border-accent group">
          <Users :size="20" class="text-accent" />
          <span class="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">Contacts</span>
        </router-link>
        <router-link to="/reports" class="flex flex-col items-center gap-2 py-5 px-4 bg-bg-secondary border border-border rounded-xl no-underline transition-all duration-150 hover:border-accent group">
          <BarChart3 :size="20" class="text-accent" />
          <span class="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">Reports</span>
        </router-link>
        <router-link to="/templates" class="flex flex-col items-center gap-2 py-5 px-4 bg-bg-secondary border border-border rounded-xl no-underline transition-all duration-150 hover:border-accent group">
          <FileText :size="20" class="text-accent" />
          <span class="text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">Templates</span>
        </router-link>
      </div>
    </div>
  </MainLayout>
</template>
