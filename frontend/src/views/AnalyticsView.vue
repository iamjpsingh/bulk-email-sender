<template>
  <MainLayout>
    <header class="flex justify-between items-start mb-8">
      <div>
        <h1 class="text-[28px] font-bold m-0 tracking-[-0.03em]">Advanced Analytics</h1>
        <p class="text-text-secondary text-sm mt-1">Insights across all campaigns</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary" @click="exportData('csv')">Export CSV</button>
        <button class="btn-secondary" @click="exportData('json')">Export JSON</button>
      </div>
    </header>
    <div v-if="summaryLoading" class="text-center text-text-secondary py-20 text-[15px]">Loading analytics data...</div>
    <template v-else>
      <section class="grid grid-cols-3 gap-4 mb-9 max-lg:grid-cols-2 max-md:grid-cols-2">
        <div class="bg-bg-secondary border border-border rounded-[10px] py-[22px] px-6 flex flex-col gap-1.5">
          <span class="text-[13px] text-text-secondary uppercase tracking-[0.04em]">Total Campaigns</span>
          <span class="text-[32px] font-bold tracking-[-0.03em] leading-[1.1]">{{ summary.totalCampaigns }}</span>
        </div>
        <div class="bg-bg-secondary border border-border rounded-[10px] py-[22px] px-6 flex flex-col gap-1.5">
          <span class="text-[13px] text-text-secondary uppercase tracking-[0.04em]">Emails Sent</span>
          <span class="text-[32px] font-bold tracking-[-0.03em] leading-[1.1]">{{
            fmtNum(summary.totalEmailsSent)
          }}</span>
        </div>
        <div class="bg-bg-secondary border border-border rounded-[10px] py-[22px] px-6 flex flex-col gap-1.5">
          <span class="text-[13px] text-text-secondary uppercase tracking-[0.04em]">Avg Open Rate</span>
          <span class="text-[32px] font-bold tracking-[-0.03em] leading-[1.1] text-success"
            >{{ summary.avgOpenRate.toFixed(1) }}%</span
          >
        </div>
        <div class="bg-bg-secondary border border-border rounded-[10px] py-[22px] px-6 flex flex-col gap-1.5">
          <span class="text-[13px] text-text-secondary uppercase tracking-[0.04em]">Avg Click Rate</span>
          <span class="text-[32px] font-bold tracking-[-0.03em] leading-[1.1] text-success"
            >{{ summary.avgClickRate.toFixed(1) }}%</span
          >
        </div>
        <div class="bg-bg-secondary border border-border rounded-[10px] py-[22px] px-6 flex flex-col gap-1.5">
          <span class="text-[13px] text-text-secondary uppercase tracking-[0.04em]">Avg Bounce Rate</span>
          <span
            class="text-[32px] font-bold tracking-[-0.03em] leading-[1.1]"
            :class="summary.avgBounceRate > 5 ? 'text-danger' : 'text-success'"
          >
            {{ summary.avgBounceRate.toFixed(1) }}%
          </span>
        </div>
        <div
          class="bg-bg-secondary border border-accent rounded-[10px] py-[22px] px-6 flex flex-col gap-1.5 bg-[rgba(59,130,246,0.06)]"
        >
          <span class="text-[13px] text-text-secondary uppercase tracking-[0.04em]">Best Send Time</span>
          <span class="text-[24px] font-bold tracking-[-0.03em] leading-[1.1] text-accent">{{ bestSendTime }}</span>
          <span class="text-xs text-text-secondary mt-0.5">Based on highest open rates</span>
        </div>
      </section>
      <section class="mb-9">
        <h2 class="text-lg font-semibold mb-4 tracking-[-0.02em]">Campaign Reports</h2>
        <div class="overflow-x-auto border border-border rounded-[10px]">
          <table class="data-table w-full border-collapse text-sm">
            <thead>
              <tr class="bg-bg-tertiary">
                <th
                  class="py-3 px-4 text-left whitespace-nowrap text-text-secondary font-medium text-[13px] uppercase tracking-[0.03em] border-b border-border"
                >
                  Campaign
                </th>
                <th
                  class="py-3 px-4 text-left whitespace-nowrap text-text-secondary font-medium text-[13px] uppercase tracking-[0.03em] border-b border-border"
                >
                  Sent
                </th>
                <th
                  v-for="col in sortCols"
                  :key="col.key"
                  class="py-3 px-4 text-left whitespace-nowrap font-medium text-[13px] uppercase tracking-[0.03em] border-b border-border cursor-pointer select-none"
                  :class="sortField === col.key ? 'text-accent' : 'text-text-secondary hover:text-text-primary'"
                  @click="toggleSort(col.key)"
                >
                  {{ col.label }} {{ sortField === col.key ? (sortAsc ? '\u25B2' : '\u25BC') : '' }}
                </th>
                <th
                  class="py-3 px-4 text-left whitespace-nowrap text-text-secondary font-medium text-[13px] uppercase tracking-[0.03em] border-b border-border"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in sortedReports"
                :key="r.id"
                class="border-b border-border transition-colors duration-100 even:bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(59,130,246,0.05)] last:border-b-0"
              >
                <td class="py-3 px-4 whitespace-nowrap font-medium">{{ r.name }}</td>
                <td class="py-3 px-4 whitespace-nowrap">{{ fmtNum(r.sent) }}</td>
                <td class="py-3 px-4 whitespace-nowrap">
                  <span class="text-success">{{ r.openRate.toFixed(1) }}%</span>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                  <span class="text-success">{{ r.clickRate.toFixed(1) }}%</span>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">
                  <span :class="r.bounceRate > 5 ? 'text-danger' : 'text-success'">{{ r.bounceRate.toFixed(1) }}%</span>
                </td>
                <td class="py-3 px-4 whitespace-nowrap text-text-secondary">{{ fmtDate(r.date) }}</td>
              </tr>
              <tr v-if="!sortedReports.length">
                <td colspan="6" class="text-center text-text-secondary py-8 px-4">No campaign data available</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div class="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        <section class="mb-9">
          <h2 class="text-lg font-semibold mb-4 tracking-[-0.02em]">Device / Client Breakdown</h2>
          <div class="flex flex-col gap-3.5">
            <div v-for="d in deviceData" :key="d.name" class="flex items-center gap-3">
              <span class="w-[100px] text-[13px] text-text-secondary shrink-0 text-right">{{ d.name }}</span>
              <div class="flex-1 h-[22px] bg-bg-tertiary rounded overflow-hidden">
                <div
                  class="h-full bg-accent rounded transition-[width] duration-400 ease-out min-w-[2px]"
                  :style="{ width: d.percentage + '%' }"
                ></div>
              </div>
              <span class="w-[52px] text-[13px] font-semibold text-right shrink-0">{{ d.percentage.toFixed(1) }}%</span>
            </div>
            <div v-if="!deviceData.length" class="text-text-secondary text-sm text-center py-6">
              No device data available
            </div>
          </div>
        </section>
        <section class="mb-9">
          <h2 class="text-lg font-semibold mb-4 tracking-[-0.02em]">Send Time Heatmap</h2>
          <div class="bg-bg-secondary border border-border rounded-[10px] p-[18px] overflow-x-auto">
            <div class="flex gap-1 mb-1">
              <span class="w-10 shrink-0"></span>
              <span
                v-for="h in hmHours"
                :key="h"
                class="flex-1 text-center text-[11px] text-text-secondary min-w-[36px]"
                >{{ h }}</span
              >
            </div>
            <div v-for="(day, di) in hmDays" :key="day" class="flex gap-1 mb-1">
              <span class="w-10 shrink-0 text-xs text-text-secondary flex items-center">{{ day }}</span>
              <span
                v-for="hi in 8"
                :key="hi"
                class="hm-cell flex-1 min-w-[36px] h-7 rounded cursor-default transition-opacity duration-150 hover:opacity-80"
                :style="{ backgroundColor: hmColor(hmVal(di, hi - 1)) }"
                :title="`${day} ${hmHours[hi - 1]}: ${hmVal(di, hi - 1)}% open rate`"
              ></span>
            </div>
            <div class="flex items-center gap-1 mt-3 justify-center">
              <span class="text-[11px] text-text-secondary px-1">Low</span>
              <span
                v-for="c in ['#1a1a2e', '#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa']"
                :key="c"
                class="w-5 h-3 rounded-sm"
                :style="{ background: c }"
              ></span>
              <span class="text-[11px] text-text-secondary px-1">High</span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </MainLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAnalyticsSummary, useAnalyticsReports, useDeviceAnalytics, useTimeAnalysis } from '../lib/query'
import { analyticsApi } from '../lib/api'
import MainLayout from '../components/layout/MainLayout.vue'

const { data: summaryRaw, isLoading: summaryLoading } = useAnalyticsSummary()
const { data: reportsRaw } = useAnalyticsReports()
const { data: devicesRaw } = useDeviceAnalytics()
const { data: timeRaw } = useTimeAnalysis()

interface SummaryData {
  totalCampaigns: number
  totalEmailsSent: number
  avgOpenRate: number
  avgClickRate: number
  avgBounceRate: number
  bestSendTime?: string
}
interface ReportRow {
  id: string
  name: string
  sent: number
  openRate: number
  clickRate: number
  bounceRate: number
  date: string
}
interface DeviceRow {
  name: string
  percentage: number
}

const defaults: SummaryData = {
  totalCampaigns: 0,
  totalEmailsSent: 0,
  avgOpenRate: 0,
  avgClickRate: 0,
  avgBounceRate: 0,
}
const summary = computed<SummaryData>(() => {
  const raw = summaryRaw.value
  if (!raw) return defaults
  return {
    totalCampaigns: raw.total_campaigns,
    totalEmailsSent: raw.total_emails_sent,
    avgOpenRate: raw.avg_open_rate,
    avgClickRate: raw.avg_click_rate,
    avgBounceRate: raw.avg_bounce_rate,
    bestSendTime: raw.best_send_time ? `${raw.best_send_time.best_day} ${raw.best_send_time.best_hour}:00` : undefined,
  }
})
const reports = computed<ReportRow[]>(() => {
  return (reportsRaw.value || []).map((r) => ({
    id: r.campaign_id,
    name: r.campaign_name,
    sent: r.total_sent,
    openRate: r.open_rate,
    clickRate: r.click_rate,
    bounceRate: r.bounce_rate,
    date: '',
  }))
})
const deviceData = computed<DeviceRow[]>(() => (devicesRaw.value as DeviceRow[]) ?? [])
const timeData = computed<number[][]>(() => (timeRaw.value as number[][]) ?? [])
const bestSendTime = computed(() => summary.value.bestSendTime ?? 'Tue 10:00 AM')

type SortField = 'openRate' | 'clickRate' | 'bounceRate'
const sortCols: { key: SortField; label: string }[] = [
  { key: 'openRate', label: 'Open Rate' },
  { key: 'clickRate', label: 'Click Rate' },
  { key: 'bounceRate', label: 'Bounce Rate' },
]
const sortField = ref<SortField>('openRate')
const sortAsc = ref(false)
function toggleSort(field: SortField) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortField.value = field
    sortAsc.value = false
  }
}
const sortedReports = computed(() => {
  const rows = [...reports.value]
  const dir = sortAsc.value ? 1 : -1
  rows.sort((a, b) => dir * (a[sortField.value] - b[sortField.value]))
  return rows
})

const hmDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hmHours = ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p']
function hmVal(di: number, hi: number): number {
  return timeData.value?.[di]?.[hi] ?? 0
}
function hmColor(v: number): string {
  if (v <= 0) return '#1a1a2e'
  if (v < 10) return '#1e3a5f'
  if (v < 20) return '#1d4ed8'
  if (v < 35) return '#2563eb'
  if (v < 50) return '#3b82f6'
  return '#60a5fa'
}

function fmtNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}
function fmtDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function exportData(format: 'csv' | 'json') {
  try {
    const blob = await analyticsApi.export(format)
    downloadBlob(blob, `analytics-export.${format}`)
  } catch {
    const payload = { summary: summary.value, reports: reports.value, devices: deviceData.value }
    let content: string, mime: string
    if (format === 'json') {
      content = JSON.stringify(payload, null, 2)
      mime = 'application/json'
    } else {
      const rows = reports.value.map(
        (r) => `"${r.name}",${r.sent},${r.openRate},${r.clickRate},${r.bounceRate},${r.date}`
      )
      content = ['Campaign,Sent,Open Rate,Click Rate,Bounce Rate,Date', ...rows].join('\n')
      mime = 'text/csv'
    }
    downloadBlob(new Blob([content], { type: mime }), `analytics-export.${format}`)
  }
}
</script>
