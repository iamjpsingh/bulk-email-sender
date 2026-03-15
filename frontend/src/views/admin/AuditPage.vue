<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../lib/api/admin'
import type { AuditLog, ActivityLog } from '../../lib/api/admin'
import { useToast } from '../../composables/useToast'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const toast = useToast()
const auditLogs = ref<AuditLog[]>([])
const activityLogs = ref<ActivityLog[]>([])
const auditTotal = ref(0)
const auditPage = ref(1)
const auditLoading = ref(true)
const auditLogType = ref<'audit' | 'activity'>('audit')

const auditTotalPages = computed(() => Math.ceil(auditTotal.value / 25) || 1)

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function loadAuditLogs(page = 1) {
  auditLoading.value = true
  auditPage.value = page
  try {
    if (auditLogType.value === 'audit') {
      const result = await adminApi.getAuditLogs({ page, limit: 25 })
      auditLogs.value = result.logs
      auditTotal.value = result.total
    } else {
      const result = await adminApi.getActivityLogs({ page, limit: 25 })
      activityLogs.value = result.logs
      auditTotal.value = result.total
    }
  } catch (e: any) {
    toast.error(e.message || 'Failed to load logs')
  } finally {
    auditLoading.value = false
  }
}

function switchLogType(type: 'audit' | 'activity') {
  auditLogType.value = type
  loadAuditLogs(1)
}

onMounted(() => loadAuditLogs(1))
</script>

<template>
  <div>
    <div class="flex items-center gap-4 mb-4">
      <div class="flex bg-bg-tertiary rounded-lg p-0.5">
        <button
          :class="[
            'px-3 py-1.5 text-sm rounded-md transition-all',
            auditLogType === 'audit' ? 'bg-bg-card text-text-primary font-medium shadow-xs' : 'text-text-muted hover:text-text-primary'
          ]"
          @click="switchLogType('audit')"
        >
          Audit Logs
        </button>
        <button
          :class="[
            'px-3 py-1.5 text-sm rounded-md transition-all',
            auditLogType === 'activity' ? 'bg-bg-card text-text-primary font-medium shadow-xs' : 'text-text-muted hover:text-text-primary'
          ]"
          @click="switchLogType('activity')"
        >
          Activity
        </button>
      </div>
      <span class="text-sm text-text-muted">{{ auditTotal }} total</span>
    </div>

    <div v-if="auditLoading" class="space-y-2">
      <Skeleton variant="text" :count="8" />
    </div>

    <div v-else-if="(auditLogType === 'audit' ? auditLogs : activityLogs).length === 0" class="bg-bg-card border border-border rounded-xl">
      <EmptyState :icon="ScrollText" title="No logs yet" description="Actions will appear here as your team works" />
    </div>

    <div v-else class="bg-bg-card border border-border rounded-xl overflow-hidden">
      <!-- Audit Logs Table -->
      <table v-if="auditLogType === 'audit'" class="data-table w-full">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Entity</th>
            <th scope="col">Actor</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in auditLogs" :key="log.id">
            <td><span class="text-sm font-mono text-text-primary">{{ log.action }}</span></td>
            <td class="text-sm text-text-muted">{{ log.entity_type }}{{ log.entity_id ? `: ${log.entity_id.substring(0, 16)}...` : '' }}</td>
            <td class="text-sm text-text-muted">{{ log.actor_email || log.actor_id.substring(0, 12) }}</td>
            <td class="text-sm text-text-muted">{{ formatDate(log.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Activity Logs Table -->
      <table v-else class="data-table w-full">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Description</th>
            <th scope="col">Actor</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in activityLogs" :key="log.id">
            <td><span class="text-sm font-mono text-text-primary">{{ log.action }}</span></td>
            <td class="text-sm text-text-muted">{{ log.description }}</td>
            <td class="text-sm text-text-muted">{{ log.actor_email || log.actor_id.substring(0, 12) }}</td>
            <td class="text-sm text-text-muted">{{ formatDate(log.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="auditTotalPages > 1" class="flex items-center justify-center gap-2 mt-4">
      <button class="btn-ghost btn-sm" :disabled="auditPage <= 1" @click="loadAuditLogs(auditPage - 1)">
        <ChevronLeft :size="16" />
      </button>
      <span class="text-sm text-text-muted">Page {{ auditPage }} of {{ auditTotalPages }}</span>
      <button class="btn-ghost btn-sm" :disabled="auditPage >= auditTotalPages" @click="loadAuditLogs(auditPage + 1)">
        <ChevronRight :size="16" />
      </button>
    </div>
  </div>
</template>
