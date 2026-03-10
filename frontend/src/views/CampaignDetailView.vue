<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MainLayout from '../components/layout/MainLayout.vue'
import { useToast } from '../composables/useToast'
import {
  useCampaign,
  useCampaignStats,
  useLaunchCampaign,
  usePauseCampaign,
  useCancelCampaign,
  useCloneCampaign,
  useArchiveCampaign,
} from '../lib/query'
import {
  ArrowLeft,
  Rocket,
  Pause,
  X,
  Copy,
  Archive,
  Loader2,
  Send,
  Eye,
  MousePointer,
  AlertTriangle,
  UserMinus,
  Users,
  Mail,
  Clock,
  CalendarDays,
  Tag,
  RefreshCw,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const campaignId = computed(() => String(route.params.id || ''))

// Queries
const { data: campaign, isLoading, error: campaignError, refetch: refetchCampaign } = useCampaign(campaignId)
const { data: stats, refetch: refetchStats } = useCampaignStats(campaignId)

// Mutations
const launchMutation = useLaunchCampaign()
const pauseMutation = usePauseCampaign()
const cancelMutation = useCancelCampaign()
const cloneMutation = useCloneCampaign()
const archiveMutation = useArchiveCampaign()

const actionInProgress = ref<string | null>(null)

// ============================================================================
// Actions
// ============================================================================

async function handleAction(action: string) {
  actionInProgress.value = action
  try {
    switch (action) {
      case 'launch':
        await launchMutation.mutateAsync(campaignId.value)
        toast.success('Campaign launched successfully')
        break
      case 'pause':
        await pauseMutation.mutateAsync(campaignId.value)
        toast.success('Campaign paused')
        break
      case 'cancel':
        await cancelMutation.mutateAsync(campaignId.value)
        toast.success('Campaign cancelled')
        break
      case 'clone':
        const cloned = await cloneMutation.mutateAsync(campaignId.value)
        toast.success('Campaign cloned')
        if (cloned?.id) {
          router.push(`/campaigns/${cloned.id}`)
        }
        return
      case 'archive':
        await archiveMutation.mutateAsync(campaignId.value)
        toast.success('Campaign archived')
        break
    }
    refetchCampaign()
    refetchStats()
  } catch (err: any) {
    toast.error(`Failed to ${action} campaign: ${err.message}`)
  } finally {
    actionInProgress.value = null
  }
}

function refreshData() {
  refetchCampaign()
  refetchStats()
}

// ============================================================================
// Helpers
// ============================================================================

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    draft: 'badge-muted',
    testing: 'badge-info',
    scheduled: 'badge-warning',
    sending: 'badge-info',
    paused: 'badge-warning',
    completed: 'badge-success',
    cancelled: 'badge-danger',
    archived: 'badge-muted',
  }
  return map[status] || 'badge-muted'
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNumber(n: number | undefined | null): string {
  if (n == null) return '0'
  return n.toLocaleString()
}

function formatRate(rate: number | undefined | null): string {
  if (rate == null) return '0.0'
  return (rate * 100).toFixed(1)
}

const progressPercent = computed(() => {
  const c = campaign.value
  if (!c || !c.total_recipients) return 0
  return Math.round((c.sent_count / c.total_recipients) * 100)
})

const canLaunch = computed(() => {
  const s = campaign.value?.status
  return s === 'draft' || s === 'scheduled'
})

const canPause = computed(() => {
  return campaign.value?.status === 'sending'
})

const canCancel = computed(() => {
  const s = campaign.value?.status
  return s === 'sending' || s === 'scheduled' || s === 'paused'
})

const canArchive = computed(() => {
  const s = campaign.value?.status
  return s === 'completed' || s === 'cancelled'
})

function campaignTypeLabel(type: string | undefined): string {
  const labels: Record<string, string> = {
    one_time: 'One-time',
    recurring: 'Recurring',
    ab_test: 'A/B Test',
    automation: 'Automation',
  }
  return labels[type || ''] || type || '-'
}
</script>

<template>
  <MainLayout>
    <!-- Back Button -->
    <router-link
      to="/campaigns"
      class="inline-flex items-center gap-2 text-text-muted text-sm mb-6 hover:text-text-primary transition-colors duration-200 no-underline"
    >
      <ArrowLeft :size="16" />
      Back to Campaigns
    </router-link>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-[80px] text-text-muted flex flex-col items-center gap-3">
      <Loader2 :size="28" class="spin" />
      <span class="text-sm">Loading campaign...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="campaignError" class="text-center py-[80px] flex flex-col items-center gap-3">
      <AlertTriangle :size="32" class="text-danger" />
      <p class="text-danger text-sm">{{ (campaignError as Error).message || 'Failed to load campaign' }}</p>
      <button class="btn-ghost text-sm" @click="refreshData"><RefreshCw :size="14" /> Try again</button>
    </div>

    <!-- Campaign Content -->
    <template v-else-if="campaign">
      <!-- Header -->
      <header class="flex justify-between items-start mb-8 flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <h1 class="text-[28px] font-bold m-0">{{ campaign.name }}</h1>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[11px] font-semibold capitalize tracking-[0.3px]"
              :class="statusBadgeClass(campaign.status)"
            >
              {{ campaign.status }}
            </span>
          </div>
          <p class="text-text-muted text-sm m-0">
            {{ campaignTypeLabel(campaign.type) }} campaign
            <span v-if="campaign.created_at"> &middot; Created {{ formatDate(campaign.created_at) }}</span>
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button class="btn-ghost text-sm" :disabled="!!actionInProgress" @click="refreshData">
            <RefreshCw :size="14" />
          </button>

          <button
            v-if="canLaunch"
            class="btn-primary text-sm"
            :disabled="!!actionInProgress"
            @click="handleAction('launch')"
          >
            <Loader2 v-if="actionInProgress === 'launch'" :size="14" class="spin" />
            <Rocket v-else :size="14" />
            Launch
          </button>

          <button
            v-if="canPause"
            class="btn-secondary text-sm"
            :disabled="!!actionInProgress"
            @click="handleAction('pause')"
          >
            <Loader2 v-if="actionInProgress === 'pause'" :size="14" class="spin" />
            <Pause v-else :size="14" />
            Pause
          </button>

          <button
            v-if="canCancel"
            class="btn-danger text-sm"
            :disabled="!!actionInProgress"
            @click="handleAction('cancel')"
          >
            <Loader2 v-if="actionInProgress === 'cancel'" :size="14" class="spin" />
            <X v-else :size="14" />
            Cancel
          </button>

          <button class="btn-ghost text-sm" :disabled="!!actionInProgress" @click="handleAction('clone')">
            <Loader2 v-if="actionInProgress === 'clone'" :size="14" class="spin" />
            <Copy v-else :size="14" />
            Clone
          </button>

          <button
            v-if="canArchive"
            class="btn-ghost text-sm"
            :disabled="!!actionInProgress"
            @click="handleAction('archive')"
          >
            <Loader2 v-if="actionInProgress === 'archive'" :size="14" class="spin" />
            <Archive v-else :size="14" />
            Archive
          </button>
        </div>
      </header>

      <!-- Progress Bar -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-text-secondary"> Send Progress </span>
          <span class="text-sm font-semibold text-text-primary">
            {{ formatNumber(campaign.sent_count) }} / {{ formatNumber(campaign.total_recipients) }}
            <span class="text-text-muted font-normal ml-1">({{ progressPercent }}%)</span>
          </span>
        </div>
        <div class="w-full h-2 bg-bg-secondary rounded-[--radius-sm] overflow-hidden">
          <div
            class="h-full rounded-[--radius-sm] transition-[width] duration-500 ease-in-out progress-fill"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div class="p-4 bg-bg-card border border-border rounded-[--radius-md]">
          <div class="flex items-center gap-2 mb-2 text-text-muted text-xs font-medium uppercase tracking-wider">
            <Users :size="14" />
            Recipients
          </div>
          <div class="text-xl font-bold text-text-primary">
            {{ formatNumber(stats?.total_recipients ?? campaign.total_recipients) }}
          </div>
        </div>

        <div class="p-4 bg-bg-card border border-border rounded-[--radius-md]">
          <div class="flex items-center gap-2 mb-2 text-text-muted text-xs font-medium uppercase tracking-wider">
            <Send :size="14" />
            Sent
          </div>
          <div class="text-xl font-bold text-text-primary">
            {{ formatNumber(stats?.sent ?? campaign.sent_count) }}
          </div>
          <div v-if="stats?.failed" class="text-xs text-danger mt-1">{{ formatNumber(stats.failed) }} failed</div>
        </div>

        <div class="p-4 bg-bg-card border border-border rounded-[--radius-md]">
          <div class="flex items-center gap-2 mb-2 text-text-muted text-xs font-medium uppercase tracking-wider">
            <Eye :size="14" />
            Opens
          </div>
          <div class="text-xl font-bold text-text-primary">
            {{ formatNumber(stats?.opened ?? campaign.open_count) }}
          </div>
          <div class="text-xs text-text-muted mt-1">{{ formatRate(stats?.open_rate) }}% rate</div>
        </div>

        <div class="p-4 bg-bg-card border border-border rounded-[--radius-md]">
          <div class="flex items-center gap-2 mb-2 text-text-muted text-xs font-medium uppercase tracking-wider">
            <MousePointer :size="14" />
            Clicks
          </div>
          <div class="text-xl font-bold text-text-primary">
            {{ formatNumber(stats?.clicked ?? campaign.click_count) }}
          </div>
          <div class="text-xs text-text-muted mt-1">{{ formatRate(stats?.click_rate) }}% rate</div>
        </div>

        <div class="p-4 bg-bg-card border border-border rounded-[--radius-md]">
          <div class="flex items-center gap-2 mb-2 text-text-muted text-xs font-medium uppercase tracking-wider">
            <AlertTriangle :size="14" />
            Bounced
          </div>
          <div class="text-xl font-bold text-text-primary">
            {{ formatNumber(stats?.bounced ?? campaign.bounce_count) }}
          </div>
        </div>

        <div class="p-4 bg-bg-card border border-border rounded-[--radius-md]">
          <div class="flex items-center gap-2 mb-2 text-text-muted text-xs font-medium uppercase tracking-wider">
            <UserMinus :size="14" />
            Unsubscribed
          </div>
          <div class="text-xl font-bold text-text-primary">
            {{ formatNumber(stats?.unsubscribed ?? campaign.unsubscribe_count) }}
          </div>
        </div>
      </div>

      <!-- Campaign Details -->
      <div class="p-6 bg-bg-card border border-border rounded-[--radius-lg]">
        <h2 class="text-base font-semibold text-text-primary mb-5">Campaign Details</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div class="flex items-start gap-3">
            <Mail :size="16" class="text-text-muted mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-text-muted font-medium uppercase tracking-wider mb-0.5">Subject</div>
              <div class="text-sm text-text-primary">{{ campaign.subject || '-' }}</div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <Tag :size="16" class="text-text-muted mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-text-muted font-medium uppercase tracking-wider mb-0.5">Type</div>
              <div class="text-sm text-text-primary">{{ campaignTypeLabel(campaign.type) }}</div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <Send :size="16" class="text-text-muted mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-text-muted font-medium uppercase tracking-wider mb-0.5">From</div>
              <div class="text-sm text-text-primary">
                {{ campaign.from_name || '-' }}
                <span class="text-text-muted">&lt;{{ campaign.from_email }}&gt;</span>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <Mail :size="16" class="text-text-muted mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-text-muted font-medium uppercase tracking-wider mb-0.5">Reply-To</div>
              <div class="text-sm text-text-primary">
                {{ (campaign as any).reply_to || campaign.from_email || '-' }}
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <Clock :size="16" class="text-text-muted mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-text-muted font-medium uppercase tracking-wider mb-0.5">Created</div>
              <div class="text-sm text-text-primary">{{ formatDate(campaign.created_at) }}</div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <CalendarDays :size="16" class="text-text-muted mt-0.5 shrink-0" />
            <div>
              <div class="text-xs text-text-muted font-medium uppercase tracking-wider mb-0.5">Scheduled At</div>
              <div class="text-sm text-text-primary">{{ formatDate(campaign.scheduled_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </MainLayout>
</template>

<style scoped>
.badge-muted {
  background: rgba(148, 163, 184, 0.15);
  color: var(--color-text-muted);
}
.badge-info {
  background: rgba(6, 182, 212, 0.15);
  color: var(--color-accent);
}
.progress-fill {
  background: linear-gradient(90deg, var(--color-accent), var(--color-success));
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
