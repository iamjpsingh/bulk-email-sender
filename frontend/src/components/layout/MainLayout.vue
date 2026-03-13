<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../../stores/auth'
import { useSidebar } from '../../composables/useSidebar'
import { cn } from '../../lib/utils'
import AppSidebar from './AppSidebar.vue'
import {
  Search,
  ChevronRight,
} from 'lucide-vue-next'

const route = useRoute()
const { user } = useAuth()
const { collapsed } = useSidebar()

const userInitial = computed(() => user.value?.name?.charAt(0).toUpperCase() || '?')

// Build breadcrumb from route
const breadcrumbs = computed(() => {
  const crumbs: Array<{ label: string; path?: string }> = []

  // Always start with Dispatch as root
  if (route.name === 'Dashboard') {
    crumbs.push({ label: 'Dashboard' })
  } else if (route.name === 'CampaignDetail') {
    crumbs.push({ label: 'Campaigns', path: '/campaigns' })
    crumbs.push({ label: 'Campaign Detail' })
  } else if (route.name && typeof route.name === 'string') {
    // Map route names to readable labels
    const labelMap: Record<string, string> = {
      Compose: 'Compose',
      Campaigns: 'Campaigns',
      Templates: 'Templates',
      Contacts: 'Contacts',
      Automations: 'Automations',
      Calendar: 'Calendar',
      Analytics: 'Analytics',
      Reports: 'Reports',
      Configs: 'Settings',
    }
    crumbs.push({ label: labelMap[route.name] || route.name })
  }

  return crumbs
})
</script>

<template>
  <div class="flex min-h-screen bg-bg-primary">
    <!-- Skip link for accessibility -->
    <a
      href="#main-content"
      :class="cn(
        'absolute -top-full left-4 z-99999',
        'px-4 py-2 rounded-b-md',
        'bg-accent text-white text-[13px] font-semibold no-underline',
        'transition-[top] duration-200',
        'focus:top-0'
      )"
    >
      Skip to content
    </a>

    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main content wrapper -->
    <div
      :class="cn(
        'flex flex-col flex-1 min-h-screen',
        'transition-[margin-left] duration-200 ease-out',
        'ml-0 md:ml-60',
        collapsed && 'md:ml-16'
      )"
    >
      <!-- Top bar -->
      <header
        :class="cn(
          'sticky top-0 z-40 shrink-0',
          'flex items-center justify-between',
          'h-14 px-6',
          'bg-bg-primary/80 backdrop-blur-xl',
          'border-b border-border'
        )"
      >
        <!-- Left: Breadcrumbs -->
        <nav class="flex items-center gap-1 min-w-0" aria-label="Breadcrumb">
          <span class="text-[13px] font-medium text-text-muted hidden md:inline">Dispatch</span>

          <template v-for="(crumb, index) in breadcrumbs" :key="index">
            <ChevronRight :size="14" class="text-text-muted/50 shrink-0 hidden md:block" />
            <router-link
              v-if="crumb.path"
              :to="crumb.path"
              class="text-[13px] font-medium text-text-muted hover:text-text-primary transition-colors duration-fast truncate"
            >
              {{ crumb.label }}
            </router-link>
            <span
              v-else
              class="text-[13px] font-semibold text-text-primary truncate"
            >
              {{ crumb.label }}
            </span>
          </template>
        </nav>

        <!-- Right: Search + User -->
        <div class="flex items-center gap-3">
          <!-- Search trigger (Cmd+K style) -->
          <button
            :class="cn(
              'hidden sm:flex items-center gap-2',
              'h-8 pl-3 pr-2 rounded-lg',
              'bg-surface-1 border border-border',
              'text-text-muted text-[13px]',
              'hover:border-border-hover hover:text-text-secondary',
              'transition-all duration-fast cursor-pointer'
            )"
          >
            <Search :size="14" class="shrink-0" />
            <span class="hidden lg:inline">Search...</span>
            <kbd
              :class="cn(
                'hidden lg:flex items-center gap-0.5',
                'h-5 px-1.5 rounded',
                'bg-bg-primary/60 border border-border',
                'text-[10px] font-mono font-medium text-text-muted'
              )"
            >
              <span class="text-[11px]">&#8984;</span>K
            </kbd>
          </button>

          <!-- Mobile search icon -->
          <button
            :class="cn(
              'sm:hidden flex items-center justify-center',
              'w-8 h-8 rounded-lg',
              'text-text-muted hover:text-text-primary',
              'hover:bg-surface-1',
              'transition-colors duration-fast cursor-pointer'
            )"
          >
            <Search :size="16" />
          </button>

          <!-- Separator -->
          <div class="hidden sm:block w-px h-5 bg-border" />

          <!-- User dropdown trigger -->
          <button
            v-if="user"
            :class="cn(
              'flex items-center gap-2 rounded-lg',
              'h-8 px-1.5',
              'hover:bg-surface-1',
              'transition-colors duration-fast cursor-pointer'
            )"
          >
            <div
              :class="cn(
                'flex items-center justify-center shrink-0',
                'w-6 h-6 rounded-md',
                'bg-linear-to-br from-accent to-accent-secondary',
                'text-white text-[10px] font-bold'
              )"
            >
              {{ userInitial }}
            </div>
            <span class="hidden md:block text-[13px] font-medium text-text-secondary max-w-[120px] truncate">
              {{ user.name || 'User' }}
            </span>
          </button>
        </div>
      </header>

      <!-- Page content -->
      <main
        id="main-content"
        class="flex-1 px-6 py-6"
      >
        <div class="max-w-[1400px] mx-auto">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
