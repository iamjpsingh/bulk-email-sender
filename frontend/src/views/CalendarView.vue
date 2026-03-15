<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, X as XIcon, Calendar } from 'lucide-vue-next'
import { useCampaigns } from '../lib/query'
import PageHeader from '../components/ui/PageHeader.vue'

type ViewMode = 'month' | 'week' | 'day'

interface Campaign {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled'
  recipientCount: number
  scheduledAt: string
}

const viewMode = ref<ViewMode>('month')
const currentDate = ref(new Date())
const selectedDate = ref<Date | null>(null)

const { data: campaignsData } = useCampaigns()

const campaigns = computed<Campaign[]>(() => {
  if (!campaignsData.value) return []
  return Array.isArray(campaignsData.value) ? campaignsData.value : []
})

const statusColors: Record<string, string> = {
  draft: '#71717a',
  scheduled: '#3b82f6',
  sending: '#eab308',
  completed: '#22c55e',
  cancelled: '#ef4444',
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const currentMonth = computed(() => currentDate.value.getMonth())
const currentYear = computed(() => currentDate.value.getFullYear())
const headerTitle = computed(() => {
  if (viewMode.value === 'day') {
    return `${monthNames[currentMonth.value]} ${currentDate.value.getDate()}, ${currentYear.value}`
  }
  return `${monthNames[currentMonth.value]} ${currentYear.value}`
})

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getCampaignsForDate(date: Date): Campaign[] {
  return campaigns.value.filter((c) => {
    if (!c.scheduledAt) return false
    return isSameDay(new Date(c.scheduledAt), date)
  })
}

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const days: { date: Date; inMonth: boolean }[] = []

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), inMonth: false })
  }
  return days
})

const weekDays = computed(() => {
  const d = new Date(currentDate.value)
  const dayOfWeek = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - dayOfWeek)
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(day)
  }
  return days
})

const selectedDayCampaigns = computed(() => {
  if (!selectedDate.value) return []
  return getCampaignsForDate(selectedDate.value)
})

function navigate(dir: number) {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'month') d.setMonth(d.getMonth() + dir)
  else if (viewMode.value === 'week') d.setDate(d.getDate() + dir * 7)
  else d.setDate(d.getDate() + dir)
  currentDate.value = d
}

function selectDate(date: Date) {
  selectedDate.value = isSameDay(date, selectedDate.value ?? new Date(0)) ? null : date
}

function goToToday() {
  currentDate.value = new Date()
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}
</script>

<template>
  <div>
    <PageHeader title="Campaign Calendar" subtitle="Schedule and track your email campaigns">
      <template #actions>
        <button class="btn-ghost" @click="goToToday">Today</button>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center justify-center w-8 h-8 bg-transparent border border-border rounded-lg text-text-secondary cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary"
            @click="navigate(-1)"
          >
            <ChevronLeft :size="16" />
          </button>
          <span class="text-sm font-semibold min-w-[180px] text-center text-text-primary">{{ headerTitle }}</span>
          <button
            class="flex items-center justify-center w-8 h-8 bg-transparent border border-border rounded-lg text-text-secondary cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary"
            @click="navigate(1)"
          >
            <ChevronRight :size="16" />
          </button>
        </div>
        <div class="flex bg-bg-tertiary rounded-lg overflow-hidden p-0.5">
          <button
            v-for="mode in ['month', 'week', 'day'] as ViewMode[]"
            :key="mode"
            class="view-btn py-1.5 px-4 border-none text-[13px] font-medium cursor-pointer rounded-md transition-all duration-150"
            :class="viewMode === mode ? 'bg-accent text-white shadow-sm' : 'bg-transparent text-text-secondary hover:text-text-primary'"
            @click="viewMode = mode"
          >
            {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
          </button>
        </div>
      </template>
    </PageHeader>

    <div class="flex-1 flex overflow-hidden pt-4 gap-4">
      <div class="flex-1 overflow-y-auto transition-[flex] duration-200">
        <!-- Month View -->
        <div v-if="viewMode === 'month'" class="grid grid-cols-7 bg-bg-card border border-border rounded-xl overflow-hidden">
          <div
            v-for="day in dayNames"
            :key="day"
            class="p-2.5 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wider bg-bg-tertiary border-b border-border"
          >
            {{ day }}
          </div>
          <div
            v-for="(cell, i) in calendarDays"
            :key="i"
            class="day-cell min-h-[80px] p-2 border-r border-b border-border bg-bg-card cursor-pointer transition-colors duration-150 relative hover:bg-bg-tertiary"
            :class="{
              'opacity-30': !cell.inMonth,
              'is-today': isToday(cell.date),
              'is-selected': selectedDate && isSameDay(cell.date, selectedDate),
            }"
            @click="selectDate(cell.date)"
          >
            <span class="day-number text-[13px] font-medium text-text-secondary">{{ cell.date.getDate() }}</span>
            <div class="flex gap-1 mt-1.5 flex-wrap">
              <span
                v-for="c in getCampaignsForDate(cell.date).slice(0, 3)"
                :key="c.id"
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :style="{ backgroundColor: statusColors[c.status] || '#71717a' }"
                :title="c.name"
              />
            </div>
            <span
              v-if="getCampaignsForDate(cell.date).length > 3"
              class="text-[10px] text-text-muted absolute bottom-1 right-1.5"
            >+{{ getCampaignsForDate(cell.date).length - 3 }}</span>
          </div>
        </div>

        <!-- Week View -->
        <div v-if="viewMode === 'week'" class="grid grid-cols-7 gap-2">
          <div
            v-for="day in weekDays"
            :key="day.toISOString()"
            class="bg-bg-card border border-border rounded-xl min-h-[300px] cursor-pointer transition-all duration-150"
            :class="{
              'border-accent': isToday(day),
              '!bg-accent/5 !border-accent': selectedDate && isSameDay(day, selectedDate),
              'hover:border-text-muted': true,
            }"
            @click="selectDate(day)"
          >
            <div class="flex justify-between items-center py-2.5 px-3 border-b border-border">
              <span class="text-[11px] text-text-muted uppercase font-semibold tracking-wider">{{ dayNames[day.getDay()] }}</span>
              <span
                class="text-sm font-semibold"
                :class="isToday(day) ? 'text-accent' : 'text-text-primary'"
              >{{ day.getDate() }}</span>
            </div>
            <div class="p-2 flex flex-col gap-2">
              <div
                v-for="c in getCampaignsForDate(day)"
                :key="c.id"
                class="py-1.5 px-2 bg-bg-tertiary border-l-[3px] rounded text-xs flex flex-col gap-0.5"
                :style="{ borderLeftColor: statusColors[c.status] }"
              >
                <span class="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-text-primary">{{ c.name }}</span>
                <span class="text-text-muted text-[11px]">{{ formatTime(c.scheduledAt) }}</span>
              </div>
              <div v-if="getCampaignsForDate(day).length === 0" class="text-[11px] text-text-muted py-3 text-center">
                No campaigns
              </div>
            </div>
          </div>
        </div>

        <!-- Day View -->
        <div v-if="viewMode === 'day'" class="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div v-for="hour in 24" :key="hour" class="flex min-h-[52px] border-b border-border last:border-b-0">
            <span class="w-[60px] shrink-0 text-xs text-text-muted pt-2.5 pr-3 text-right">
              {{ (hour - 1).toString().padStart(2, '0') }}:00
            </span>
            <div class="flex-1 py-1 px-2 flex flex-col gap-1 border-l border-border">
              <div
                v-for="c in getCampaignsForDate(currentDate).filter(
                  (c) => new Date(c.scheduledAt).getHours() === hour - 1
                )"
                :key="c.id"
                class="py-1.5 px-2.5 bg-bg-tertiary border-l-[3px] rounded text-[13px] flex flex-col gap-0.5"
                :style="{ borderLeftColor: statusColors[c.status] }"
              >
                <strong class="text-text-primary">{{ c.name }}</strong>
                <span class="text-xs text-text-muted">
                  {{ formatTime(c.scheduledAt) }} &middot; {{ c.recipientCount }} recipients
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side Panel -->
      <transition name="panel">
        <div v-if="selectedDate" class="w-80 shrink-0 bg-bg-card border border-border rounded-xl overflow-y-auto">
          <div class="flex justify-between items-center p-4 border-b border-border">
            <h3 class="text-sm font-semibold m-0 text-text-primary">
              {{ selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }}
            </h3>
            <button
              class="flex items-center justify-center w-7 h-7 bg-transparent border border-border rounded-lg text-text-secondary cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary hover:text-text-primary"
              @click="selectedDate = null"
            >
              <XIcon :size="14" />
            </button>
          </div>
          <div class="py-3 px-4 flex flex-col gap-3">
            <div v-if="selectedDayCampaigns.length === 0" class="text-center py-10">
              <Calendar :size="36" class="text-text-muted mx-auto" />
              <p class="text-text-muted text-sm mt-3">No campaigns scheduled</p>
            </div>
            <div v-for="c in selectedDayCampaigns" :key="c.id" class="flex gap-3 p-3 bg-bg-tertiary rounded-lg">
              <div class="w-1 rounded-full shrink-0" :style="{ backgroundColor: statusColors[c.status] }" />
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold m-0 mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis text-text-primary">
                  {{ c.name }}
                </h4>
                <div class="flex flex-col gap-0.5 text-xs text-text-muted">
                  <span class="font-semibold capitalize" :style="{ color: statusColors[c.status] }">{{ c.status }}</span>
                  <span>{{ c.recipientCount }} recipients</span>
                  <span>{{ formatTime(c.scheduledAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
/* Day cell: remove right border on every 7th child */
.day-cell:nth-child(7n) {
  border-right: none;
}

/* Today marker */
.day-cell.is-today .day-number {
  background: var(--color-accent, #06b6d4);
  color: #fff;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

/* Selected day cell */
.day-cell.is-selected {
  background: rgba(6, 182, 212, 0.06);
  box-shadow: inset 0 0 0 1px var(--color-accent, #06b6d4);
}

/* Panel transition */
.panel-enter-active,
.panel-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
