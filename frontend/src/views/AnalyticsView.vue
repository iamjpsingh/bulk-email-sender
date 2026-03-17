<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useAnalyticsSummary, useAnalyticsReports, useDeviceAnalytics, useTimeAnalysis } from '../lib/query'
import { analyticsApi } from '../lib/api'
import PageHeader from '../components/ui/PageHeader.vue'
import StatCard from '../components/ui/StatCard.vue'
import EmailHealthDashboard from '../components/analytics/EmailHealthDashboard.vue'
import { BarChart3, Mail, TrendingUp, MousePointer, AlertTriangle, Clock } from 'lucide-vue-next'

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent])

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

const campaignChartOption = computed(() => ({
  backgroundColor: 'transparent',
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(30, 36, 51, 0.95)',
    borderColor: 'rgba(148, 163, 184, 0.12)',
    textStyle: { color: '#f8fafc', fontSize: 13 },
  },
  grid: { left: 40, right: 20, top: 20, bottom: 30 },
  xAxis: {
    type: 'category',
    data: reports.value.map(r => r.name.slice(0, 12)),
    axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    axisLabel: { color: '#94a3b8', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '{value}%' },
    splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.08)' } },
  },
  series: [
    {
      name: 'Open Rate',
      type: 'bar',
      data: reports.value.map(r => r.openRate),
      itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
      barWidth: '35%',
    },
    {
      name: 'Click Rate',
      type: 'bar',
      data: reports.value.map(r => r.clickRate),
      itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
      barWidth: '35%',
    },
  ],
}))

const hmDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hmHours = ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p']
function hmVal(di: number, hi: number): number {
  return timeData.value?.[di]?.[hi] ?? 0
}
function hmColor(v: number): string {
  if (v <= 0) return 'rgba(30, 36, 51, 0.8)'
  if (v < 10) return 'rgba(59, 130, 246, 0.15)'
  if (v < 20) return 'rgba(59, 130, 246, 0.3)'
  if (v < 35) return 'rgba(59, 130, 246, 0.5)'
  if (v < 50) return 'rgba(59, 130, 246, 0.7)'
  return 'rgba(59, 130, 246, 0.9)'
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

<template>
  <div>
    <PageHeader title="Advanced Analytics" subtitle="Insights across all campaigns">
      <template #actions>
        <button class="btn-secondary" @click="exportData('csv')">Export CSV</button>
        <button class="btn-secondary" @click="exportData('json')">Export JSON</button>
      </template>
    </PageHeader>

    <div v-if="summaryLoading" class="text-center text-text-muted py-20 text-sm">Loading analytics data...</div>

    <template v-else>
      <!-- Stats Grid -->
      <section class="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-2 gap-4 mb-8">
        <StatCard :icon="BarChart3" :value="summary.totalCampaigns" label="Total Campaigns" />
        <StatCard :icon="Mail" :value="fmtNum(summary.totalEmailsSent)" label="Emails Sent" />
        <StatCard :icon="TrendingUp" :value="`${summary.avgOpenRate.toFixed(1)}%`" label="Avg Open Rate" color="success" />
        <StatCard :icon="MousePointer" :value="`${summary.avgClickRate.toFixed(1)}%`" label="Avg Click Rate" color="success" />
        <StatCard :icon="AlertTriangle" :value="`${summary.avgBounceRate.toFixed(1)}%`" label="Avg Bounce Rate" :color="summary.avgBounceRate > 5 ? 'danger' : 'success'" />
        <StatCard :icon="Clock" :value="bestSendTime" label="Best Send Time" color="accent" />
      </section>

      <!-- Email Health Score -->
      <section class="mb-8">
        <EmailHealthDashboard />
      </section>

      <!-- Campaign Reports Table -->
      <section class="mb-8">
        <h2 class="text-base font-semibold text-text-primary mb-4">Campaign Reports</h2>
        <div class="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="data-table w-full border-collapse text-sm">
              <thead>
                <tr class="bg-bg-tertiary">
                  <th class="py-3 px-4 text-left whitespace-nowrap text-text-muted font-medium text-xs uppercase tracking-wider border-b border-border">
                    Campaign
                  </th>
                  <th class="py-3 px-4 text-left whitespace-nowrap text-text-muted font-medium text-xs uppercase tracking-wider border-b border-border">
                    Sent
                  </th>
                  <th
                    v-for="col in sortCols"
                    :key="col.key"
                    class="py-3 px-4 text-left whitespace-nowrap font-medium text-xs uppercase tracking-wider border-b border-border cursor-pointer select-none transition-colors duration-150"
                    :class="sortField === col.key ? 'text-accent' : 'text-text-muted hover:text-text-primary'"
                    @click="toggleSort(col.key)"
                  >
                    {{ col.label }} {{ sortField === col.key ? (sortAsc ? '\u25B2' : '\u25BC') : '' }}
                  </th>
                  <th class="py-3 px-4 text-left whitespace-nowrap text-text-muted font-medium text-xs uppercase tracking-wider border-b border-border">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in sortedReports"
                  :key="r.id"
                  class="border-b border-border transition-colors duration-100 hover:bg-bg-tertiary last:border-b-0"
                >
                  <td class="py-3 px-4 whitespace-nowrap font-medium text-text-primary">{{ r.name }}</td>
                  <td class="py-3 px-4 whitespace-nowrap text-text-secondary">{{ fmtNum(r.sent) }}</td>
                  <td class="py-3 px-4 whitespace-nowrap">
                    <span class="text-success font-medium">{{ r.openRate.toFixed(1) }}%</span>
                  </td>
                  <td class="py-3 px-4 whitespace-nowrap">
                    <span class="text-success font-medium">{{ r.clickRate.toFixed(1) }}%</span>
                  </td>
                  <td class="py-3 px-4 whitespace-nowrap">
                    <span :class="r.bounceRate > 5 ? 'text-danger' : 'text-success'" class="font-medium">{{ r.bounceRate.toFixed(1) }}%</span>
                  </td>
                  <td class="py-3 px-4 whitespace-nowrap text-text-muted">{{ fmtDate(r.date) }}</td>
                </tr>
                <tr v-if="!sortedReports.length">
                  <td colspan="6" class="text-center text-text-muted py-10 px-4">No campaign data available</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Campaign Performance Chart -->
      <section class="mb-8" v-if="reports.length > 0">
        <h2 class="text-base font-semibold text-text-primary mb-4">Campaign Performance</h2>
        <div class="bg-bg-card border border-border rounded-xl p-5">
          <VChart :option="campaignChartOption" style="height: 300px" autoresize />
        </div>
      </section>

      <!-- Device Breakdown + Heatmap -->
      <div class="grid grid-cols-2 max-lg:grid-cols-1 gap-6">
        <section class="mb-8">
          <h2 class="text-base font-semibold text-text-primary mb-4">Device / Client Breakdown</h2>
          <div class="bg-bg-card border border-border rounded-xl p-5">
            <div class="flex flex-col gap-4">
              <div v-for="d in deviceData" :key="d.name" class="flex items-center gap-3">
                <span class="w-24 text-[13px] text-text-muted shrink-0 text-right">{{ d.name }}</span>
                <div class="flex-1 h-5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    class="h-full bg-accent rounded-full transition-[width] duration-500 ease-out min-w-[2px]"
                    :style="{ width: d.percentage + '%' }"
                  ></div>
                </div>
                <span class="w-14 text-[13px] font-semibold text-text-primary text-right shrink-0">{{ d.percentage.toFixed(1) }}%</span>
              </div>
              <div v-if="!deviceData.length" class="text-text-muted text-sm text-center py-8">
                No device data available
              </div>
            </div>
          </div>
        </section>

        <section class="mb-8">
          <h2 class="text-base font-semibold text-text-primary mb-4">Send Time Heatmap</h2>
          <div class="bg-bg-card border border-border rounded-xl p-5 overflow-x-auto">
            <div class="flex gap-1 mb-1.5">
              <span class="w-10 shrink-0"></span>
              <span
                v-for="h in hmHours"
                :key="h"
                class="flex-1 text-center text-[11px] text-text-muted min-w-9"
              >{{ h }}</span>
            </div>
            <div v-for="(day, di) in hmDays" :key="day" class="flex gap-1 mb-1">
              <span class="w-10 shrink-0 text-xs text-text-muted flex items-center">{{ day }}</span>
              <span
                v-for="hi in 8"
                :key="hi"
                class="flex-1 min-w-9 h-7 rounded cursor-default transition-opacity duration-150 hover:opacity-80"
                :style="{ backgroundColor: hmColor(hmVal(di, hi - 1)) }"
                :title="`${day} ${hmHours[hi - 1]}: ${hmVal(di, hi - 1)}% open rate`"
              ></span>
            </div>
            <div class="flex items-center gap-1.5 mt-4 justify-center">
              <span class="text-[11px] text-text-muted">Low</span>
              <span
                v-for="c in ['rgba(30,36,51,0.8)', 'rgba(59,130,246,0.15)', 'rgba(59,130,246,0.3)', 'rgba(59,130,246,0.6)', 'rgba(59,130,246,0.9)']"
                :key="c"
                class="w-5 h-3 rounded-sm"
                :style="{ background: c }"
              ></span>
              <span class="text-[11px] text-text-muted">High</span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
