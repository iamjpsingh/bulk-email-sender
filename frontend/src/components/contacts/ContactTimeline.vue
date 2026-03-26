<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { contactsApi, type TimelineEvent } from '../../lib/api'
import { Mail, AlertTriangle, Tag, UserCog, Loader2, Clock, Link, FormInput, Zap, MessageSquare } from 'lucide-vue-next'

const props = defineProps<{
  contactId: string
}>()

const loading = ref(true)
const events = ref<TimelineEvent[]>([])
const error = ref('')

const eventIcons: Record<string, any> = {
  email_sent: Mail,
  email_opened: Mail,
  link_clicked: Link,
  form_submitted: FormInput,
  tag_added: Tag,
  tag_removed: Tag,
  score_changed: Zap,
  contact_updated: UserCog,
  bounced: AlertTriangle,
  unsubscribed: AlertTriangle,
  automation_enrolled: Clock,
  automation_completed: Clock,
  whatsapp_sent: MessageSquare,
}

const eventColors: Record<string, string> = {
  email_sent: '#6366f1',
  email_opened: '#10b981',
  link_clicked: '#3b82f6',
  form_submitted: '#8b5cf6',
  tag_added: '#14b8a6',
  tag_removed: '#f97316',
  score_changed: '#eab308',
  contact_updated: '#6366f1',
  bounced: '#ef4444',
  unsubscribed: '#ef4444',
  automation_enrolled: '#8b5cf6',
  automation_completed: '#22c55e',
  whatsapp_sent: '#25d366',
}

async function loadTimeline() {
  loading.value = true
  error.value = ''
  try {
    events.value = await contactsApi.getTimeline(props.contactId)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function getIcon(type: string) {
  return eventIcons[type] || Clock
}

function getColor(type: string) {
  return eventColors[type] || '#64748b'
}

watch(() => props.contactId, loadTimeline)
onMounted(loadTimeline)
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-8">
      <Loader2 :size="18" class="animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="error" class="text-sm text-muted-foreground text-center py-6">{{ error }}</div>

    <div v-else-if="events.length === 0" class="text-sm text-muted-foreground text-center py-6">No activity yet</div>

    <div v-else class="relative pl-6">
      <!-- Timeline line -->
      <div class="absolute left-[11px] top-2 bottom-2 w-px bg-border"></div>

      <div v-for="event in events" :key="event.id" class="relative mb-4 last:mb-0">
        <!-- Dot -->
        <div
          class="absolute -left-6 top-1 w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 border-surface-0"
          :style="{ backgroundColor: getColor(event.type) + '20' }"
        >
          <component :is="getIcon(event.type)" :size="10" :style="{ color: getColor(event.type) }" />
        </div>

        <!-- Content -->
        <div class="bg-secondary border border-border rounded-lg px-3 py-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm text-foreground">{{ event.description }}</span>
            <span class="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{{ formatDate(event.created_at) }}</span>
          </div>
          <div v-if="event.metadata" class="mt-1 text-[11px] text-muted-foreground">
            <template v-if="event.metadata.subject">Subject: {{ event.metadata.subject }}</template>
            <template v-else-if="event.metadata.url">URL: {{ event.metadata.url }}</template>
            <template v-else-if="event.metadata.tag">Tag: {{ event.metadata.tag }}</template>
            <template v-else-if="event.metadata.amount">Score: {{ Number(event.metadata.amount) > 0 ? '+' : '' }}{{ event.metadata.amount }}</template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
