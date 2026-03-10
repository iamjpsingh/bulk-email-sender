<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCampaigns } from '../lib/query'
import MainLayout from '../components/layout/MainLayout.vue'

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
  <MainLayout>
    <header class="pb-4 border-b border-border">
      <div class="mb-4">
        <h1 class="text-[22px] font-semibold m-0">Campaign Calendar</h1>
        <p class="text-[13px] text-text-secondary mt-1">Schedule and track your email campaigns</p>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="py-1.5 px-3.5 bg-transparent border border-border rounded-md text-text-primary text-[13px] cursor-pointer hover:bg-bg-tertiary"
          @click="goToToday"
        >
          Today
        </button>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center justify-center w-[30px] h-[30px] bg-transparent border border-border rounded-md text-text-secondary cursor-pointer hover:bg-bg-tertiary hover:text-text-primary"
            @click="navigate(-1)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span class="text-[15px] font-semibold min-w-[180px] text-center">{{ headerTitle }}</span>
          <button
            class="flex items-center justify-center w-[30px] h-[30px] bg-transparent border border-border rounded-md text-text-secondary cursor-pointer hover:bg-bg-tertiary hover:text-text-primary"
            @click="navigate(1)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <div class="flex bg-bg-secondary border border-border rounded-md overflow-hidden ml-auto">
          <button
            v-for="mode in ['month', 'week', 'day'] as ViewMode[]"
            :key="mode"
            class="view-btn py-1.5 px-3.5 bg-transparent border-none text-[13px] cursor-pointer"
            :class="viewMode === mode ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'"
            @click="viewMode = mode"
          >
            {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden pt-4 gap-4">
      <div class="flex-1 overflow-y-auto transition-[flex] duration-200">
        <!-- Month View -->
        <div v-if="viewMode === 'month'" class="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
          <div
            v-for="day in dayNames"
            :key="day"
            class="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase bg-bg-secondary border-b border-border"
          >
            {{ day }}
          </div>
          <div
            v-for="(cell, i) in calendarDays"
            :key="i"
            class="day-cell min-h-[80px] p-2 border-r border-b border-border bg-bg-primary cursor-pointer transition-colors duration-150 relative hover:bg-bg-tertiary"
            :class="{
              'opacity-35': !cell.inMonth,
              'is-today': isToday(cell.date),
              'is-selected': selectedDate && isSameDay(cell.date, selectedDate),
            }"
            @click="selectDate(cell.date)"
          >
            <span class="day-number text-[13px] font-medium">{{ cell.date.getDate() }}</span>
            <div class="flex gap-1 mt-1.5 flex-wrap">
              <span
                v-for="c in getCampaignsForDate(cell.date).slice(0, 3)"
                :key="c.id"
                class="w-[7px] h-[7px] rounded-full shrink-0"
                :style="{ backgroundColor: statusColors[c.status] || '#71717a' }"
                :title="c.name"
              />
            </div>
            <span
              v-if="getCampaignsForDate(cell.date).length > 3"
              class="text-[10px] text-text-secondary absolute bottom-1 right-1.5"
              >+{{ getCampaignsForDate(cell.date).length - 3 }}</span
            >
          </div>
        </div>

        <!-- Week View -->
        <div v-if="viewMode === 'week'" class="grid grid-cols-7 gap-2">
          <div
            v-for="day in weekDays"
            :key="day.toISOString()"
            class="bg-bg-secondary border border-border rounded-lg min-h-[300px] cursor-pointer transition-colors duration-150"
            :class="{
              'border-accent': isToday(day),
              '!bg-[rgba(59,130,246,0.05)] !border-accent': selectedDate && isSameDay(day, selectedDate),
              'hover:border-text-secondary': true,
            }"
            @click="selectDate(day)"
          >
            <div class="flex justify-between items-center py-2.5 px-3 border-b border-border">
              <span class="text-xs text-text-secondary uppercase font-semibold">{{ dayNames[day.getDay()] }}</span>
              <span class="text-sm font-semibold">{{ day.getDate() }}</span>
            </div>
            <div class="p-2 flex flex-col gap-1.5">
              <div
                v-for="c in getCampaignsForDate(day)"
                :key="c.id"
                class="py-1.5 px-2 bg-bg-tertiary border-l-[3px] rounded text-xs flex flex-col gap-0.5"
                :style="{ borderLeftColor: statusColors[c.status] }"
              >
                <span class="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{{ c.name }}</span>
                <span class="text-text-secondary text-[11px]">{{ formatTime(c.scheduledAt) }}</span>
              </div>
              <div v-if="getCampaignsForDate(day).length === 0" class="text-xs text-text-secondary py-2 text-center">
                No campaigns
              </div>
            </div>
          </div>
        </div>

        <!-- Day View -->
        <div v-if="viewMode === 'day'" class="flex flex-col">
          <div v-for="hour in 24" :key="hour" class="flex min-h-[52px] border-b border-border">
            <span class="w-[60px] shrink-0 text-xs text-text-secondary pt-2 pr-3 text-right"
              >{{ (hour - 1).toString().padStart(2, '0') }}:00</span
            >
            <div class="flex-1 py-1 px-2 flex flex-col gap-1">
              <div
                v-for="c in getCampaignsForDate(currentDate).filter(
                  (c) => new Date(c.scheduledAt).getHours() === hour - 1
                )"
                :key="c.id"
                class="py-1.5 px-2.5 bg-bg-secondary border-l-[3px] rounded text-[13px] flex flex-col gap-0.5"
                :style="{ borderLeftColor: statusColors[c.status] }"
              >
                <strong>{{ c.name }}</strong>
                <span class="text-xs text-text-secondary"
                  >{{ formatTime(c.scheduledAt) }} &middot; {{ c.recipientCount }} recipients</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side Panel -->
      <transition name="panel">
        <div v-if="selectedDate" class="w-80 shrink-0 bg-bg-secondary border border-border rounded-lg overflow-y-auto">
          <div class="flex justify-between items-center p-4 border-b border-border">
            <h3 class="text-[15px] font-semibold m-0">
              {{ selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }}
            </h3>
            <button
              class="flex items-center justify-center w-7 h-7 bg-transparent border border-border rounded-md text-text-secondary cursor-pointer hover:bg-bg-tertiary hover:text-text-primary"
              @click="selectedDate = null"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="py-3 px-4 flex flex-col gap-2.5">
            <div v-if="selectedDayCampaigns.length === 0" class="text-center py-8">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-secondary)"
                stroke-width="1.5"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p class="text-text-secondary text-sm mt-3">No campaigns scheduled</p>
            </div>
            <div v-for="c in selectedDayCampaigns" :key="c.id" class="flex gap-3 p-3 bg-bg-tertiary rounded-lg">
              <div class="w-1 rounded shrink-0" :style="{ backgroundColor: statusColors[c.status] }" />
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-semibold m-0 mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  {{ c.name }}
                </h4>
                <div class="flex flex-col gap-[3px] text-xs text-text-secondary">
                  <span class="font-semibold capitalize" :style="{ color: statusColors[c.status] }">{{
                    c.status
                  }}</span>
                  <span>{{ c.recipientCount }} recipients</span>
                  <span>{{ formatTime(c.scheduledAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </MainLayout>
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
}

/* Selected day cell */
.day-cell.is-selected {
  background: rgba(59, 130, 246, 0.1);
  box-shadow: inset 0 0 0 1px #3b82f6;
}

/* View switcher button borders */
.view-btn + .view-btn {
  border-left: 1px solid var(--color-border, #27272a);
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
