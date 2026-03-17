<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import PageHeader from '../../components/ui/PageHeader.vue'
import { cn } from '../../lib/utils'
import {
  Mail,
  Server,
  Hash,
  Webhook,
  Radio,
} from 'lucide-vue-next'

const route = useRoute()

const navItems = [
  { path: '/settings/email', label: 'Email Providers', icon: Mail, description: 'OAuth & connected accounts' },
  { path: '/settings/smtp', label: 'SMTP', icon: Server, description: 'SMTP server configurations' },
  { path: '/settings/api-keys', label: 'API Keys', icon: Hash, description: 'Manage API access' },
  { path: '/settings/webhooks', label: 'Webhooks', icon: Webhook, description: 'Event notifications' },
  { path: '/settings/tracking', label: 'Tracking', icon: Radio, description: 'Email open & click tracking' },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <div>
    <PageHeader title="Settings" subtitle="Manage your account configuration and integrations" />

    <div class="flex gap-8 mt-6">
      <!-- Settings sidebar navigation -->
      <aside class="w-56 shrink-0 hidden md:block">
        <nav class="flex flex-col gap-1">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            :class="cn(
              'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
              isActive(item.path)
                ? 'bg-accent/8 text-accent font-medium'
                : 'text-text-muted hover:bg-surface-1 hover:text-text-primary'
            )"
          >
            <component
              :is="item.icon"
              :size="16"
              :class="isActive(item.path) ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm">{{ item.label }}</div>
            </div>
          </router-link>
        </nav>
      </aside>

      <!-- Mobile navigation (horizontal tabs) -->
      <div class="md:hidden w-full mb-4">
        <div class="flex gap-1 overflow-x-auto pb-2 -mx-2 px-2">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            :class="cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all',
              isActive(item.path)
                ? 'bg-accent/8 text-accent font-medium'
                : 'text-text-muted hover:bg-surface-1'
            )"
          >
            <component :is="item.icon" :size="14" />
            {{ item.label }}
          </router-link>
        </div>
      </div>

      <!-- Content area -->
      <div class="flex-1 min-w-0">
        <RouterView />
      </div>
    </div>
  </div>
</template>
