<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  LayoutDashboard,
  PenSquare,
  Send,
  FileText,
  Users,
  Zap,
  Calendar,
  BarChart2,
  BarChart3,
  Settings,
  Shield,
  FormInput,
  Globe,
  MessageCircle,
  ArrowRight,
  Hash,
} from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const router = useRouter()
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, section: 'Navigation' },
  { label: 'Compose Email', path: '/compose', icon: PenSquare, section: 'Navigation' },
  { label: 'Campaigns', path: '/campaigns', icon: Send, section: 'Navigation' },
  { label: 'Templates', path: '/templates', icon: FileText, section: 'Navigation' },
  { label: 'Contacts', path: '/contacts', icon: Users, section: 'Navigation' },
  { label: 'Automations', path: '/automations', icon: Zap, section: 'Navigation' },
  { label: 'WhatsApp', path: '/whatsapp', icon: MessageCircle, section: 'Navigation' },
  { label: 'Forms', path: '/forms', icon: FormInput, section: 'Navigation' },
  { label: 'Pages', path: '/pages', icon: Globe, section: 'Navigation' },
  { label: 'Calendar', path: '/calendar', icon: Calendar, section: 'Navigation' },
  { label: 'Analytics', path: '/analytics', icon: BarChart2, section: 'Navigation' },
  { label: 'Reports', path: '/reports', icon: BarChart3, section: 'Navigation' },
  { label: 'Email Settings', path: '/settings/email', icon: Settings, section: 'Settings' },
  { label: 'SMTP Configuration', path: '/settings/smtp', icon: Settings, section: 'Settings' },
  { label: 'API Keys', path: '/settings/api-keys', icon: Hash, section: 'Settings' },
  { label: 'Webhooks', path: '/settings/webhooks', icon: Zap, section: 'Settings' },
  { label: 'Organization', path: '/admin/organization', icon: Shield, section: 'Admin' },
  { label: 'Members', path: '/admin/members', icon: Users, section: 'Admin' },
  { label: 'Teams', path: '/admin/teams', icon: Users, section: 'Admin' },
  { label: 'Roles & Permissions', path: '/admin/roles', icon: Shield, section: 'Admin' },
  { label: 'Audit Logs', path: '/admin/audit', icon: BarChart3, section: 'Admin' },
]

const filtered = computed(() => {
  if (!query.value.trim()) return navItems
  const q = query.value.toLowerCase()
  return navItems.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.section.toLowerCase().includes(q) ||
    item.path.toLowerCase().includes(q)
  )
})

const groupedResults = computed(() => {
  const groups: Record<string, typeof navItems> = {}
  for (const item of filtered.value) {
    if (!groups[item.section]) groups[item.section] = []
    groups[item.section]!.push(item)
  }
  return groups
})

const flatResults = computed(() => filtered.value)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    query.value = ''
    selectedIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

watch(query, () => {
  selectedIndex.value = 0
})

function close() {
  emit('update:open', false)
}

function navigate(path: string) {
  router.push(path)
  close()
}

function handleKeydown(e: KeyboardEvent) {
  const items = flatResults.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % items.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + items.length) % items.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = items[selectedIndex.value]
    if (item) navigate(item.path)
  } else if (e.key === 'Escape') {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

        <!-- Palette -->
        <div
          class="relative w-full max-w-[560px] mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          @keydown="handleKeydown"
        >
          <!-- Search input -->
          <div class="flex items-center gap-3 px-4 border-b border-border">
            <Search :size="18" class="text-muted-foreground shrink-0" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="flex-1 h-12 bg-transparent text-[15px] text-foreground placeholder-text-muted outline-none border-none"
              placeholder="Type a command or search..."
            />
            <kbd class="hidden sm:flex items-center h-5 px-1.5 rounded bg-muted border border-border text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>

          <!-- Results -->
          <div class="max-h-[360px] overflow-y-auto py-2">
            <template v-if="flatResults.length === 0">
              <div class="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for "{{ query }}"
              </div>
            </template>

            <template v-for="(items, section) in groupedResults" :key="section">
              <div class="px-3 pt-2 pb-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  {{ section }}
                </span>
              </div>
              <div
                v-for="item in items"
                :key="item.path"
                :class="[
                  'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                  flatResults.indexOf(item) === selectedIndex
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:bg-secondary'
                ]"
                @click="navigate(item.path)"
                @mouseenter="selectedIndex = flatResults.indexOf(item)"
              >
                <component
                  :is="item.icon"
                  :size="16"
                  :class="flatResults.indexOf(item) === selectedIndex ? 'text-accent' : 'text-muted-foreground'"
                />
                <span class="flex-1 text-sm font-medium">{{ item.label }}</span>
                <ArrowRight
                  v-if="flatResults.indexOf(item) === selectedIndex"
                  :size="14"
                  class="text-accent/60"
                />
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-muted/50">
            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <kbd class="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px]">&uarr;&darr;</kbd>
              Navigate
            </div>
            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <kbd class="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px]">&crarr;</kbd>
              Open
            </div>
            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <kbd class="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px]">esc</kbd>
              Close
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
