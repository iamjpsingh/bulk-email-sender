<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../stores/auth'
import {
  LayoutDashboard,
  PenSquare,
  Send as SendIcon,
  FileText,
  Users,
  Zap,
  Calendar,
  BarChart3,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
} from 'lucide-vue-next'

const route = useRoute()
const { user, logout } = useAuth()
const mobileOpen = ref(false)
const collapsed = ref(false)

const mainNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/compose', label: 'Compose', icon: PenSquare },
  { path: '/campaigns', label: 'Campaigns', icon: SendIcon },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/contacts', label: 'Contacts', icon: Users },
]

const toolsNav = [
  { path: '/automations', label: 'Automations', icon: Zap },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
]

const settingsNav = [{ path: '/configs', label: 'Settings', icon: Settings }]

const userInitial = computed(() => user.value?.name?.charAt(0).toUpperCase() || '?')

const router = useRouter()

async function handleLogout() {
  await logout()
  router.replace('/login')
}

function handleNavClick() {
  mobileOpen.value = false
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <!-- Mobile hamburger button -->
  <button
    class="fixed top-4 left-4 z-[200] p-2 rounded-lg bg-bg-secondary border border-border text-text-primary md:hidden"
    @click="mobileOpen = !mobileOpen"
    :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
  >
    <X v-if="mobileOpen" :size="20" />
    <Menu v-else :size="20" />
  </button>

  <!-- Mobile overlay -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="mobileOpen" class="fixed inset-0 bg-black/60 z-[149] md:hidden" @click="mobileOpen = false" />
  </Transition>

  <!-- Sidebar -->
  <aside
    class="sidebar"
    :class="{ 'mobile-open': mobileOpen, 'is-collapsed': collapsed }"
    role="navigation"
    aria-label="Main navigation"
  >
    <!-- Header -->
    <div class="sidebar-header">
      <router-link to="/" class="logo" @click="handleNavClick">
        <SendIcon class="logo-icon" :size="24" />
        <Transition name="fade">
          <span v-if="!collapsed" class="logo-text">Dispatch</span>
        </Transition>
      </router-link>
      <button
        class="collapse-btn hidden md:flex"
        @click="toggleCollapse"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <ChevronsLeft :size="16" :class="{ 'rotate-180': collapsed }" />
      </button>
    </div>

    <!-- Main nav -->
    <nav class="sidebar-nav">
      <div class="nav-section">
        <router-link
          v-for="item in mainNav"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          :title="collapsed ? item.label : undefined"
          @click="handleNavClick"
        >
          <component :is="item.icon" class="nav-icon" :size="20" />
          <Transition name="fade">
            <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
          </Transition>
        </router-link>
      </div>

      <div class="nav-divider" />

      <div class="nav-section">
        <span v-if="!collapsed" class="nav-section-title">Tools</span>
        <router-link
          v-for="item in toolsNav"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          :title="collapsed ? item.label : undefined"
          @click="handleNavClick"
        >
          <component :is="item.icon" class="nav-icon" :size="20" />
          <Transition name="fade">
            <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
          </Transition>
        </router-link>
      </div>

      <div class="nav-divider" />

      <div class="nav-section">
        <router-link
          v-for="item in settingsNav"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          :title="collapsed ? item.label : undefined"
          @click="handleNavClick"
        >
          <component :is="item.icon" class="nav-icon" :size="20" />
          <Transition name="fade">
            <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
          </Transition>
        </router-link>
      </div>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="user-info" v-if="user">
        <div class="user-avatar" :title="user.name || 'User'">
          {{ userInitial }}
        </div>
        <Transition name="fade">
          <div v-if="!collapsed" class="user-details">
            <div class="user-name">{{ user.name || 'User' }}</div>
            <div class="user-email">{{ user.email || '' }}</div>
          </div>
        </Transition>
      </div>
      <button class="logout-btn" @click="handleLogout" :title="collapsed ? 'Logout' : undefined">
        <LogOut :size="16" />
        <Transition name="fade">
          <span v-if="!collapsed">Logout</span>
        </Transition>
      </button>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.sidebar {
  width: 240px;
  min-height: 100vh;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 150;
  transition: width 0.2s ease;

  &.is-collapsed {
    width: 68px;
  }
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  overflow: hidden;
}

.logo-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
  white-space: nowrap;
}

.collapse-btn {
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    color: var(--color-text-primary);
  }

  svg {
    transition: transform 0.2s ease;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 12px 4px;
  white-space: nowrap;
}

.nav-divider {
  height: 1px;
  background: var(--color-border);
  margin: 6px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  position: relative;

  &:hover {
    background: rgba(99, 102, 241, 0.08);
    color: var(--color-text-primary);
  }

  &.active {
    background: rgba(99, 102, 241, 0.15);
    color: var(--color-accent);

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 6px;
      bottom: 6px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--color-accent);
    }
  }
}

.nav-icon {
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--color-border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  overflow: hidden;
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.user-details {
  overflow: hidden;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 8px;
  width: 100%;
  font-family: inherit;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-danger);
  }
}

// Fade transition for collapsible text
.fade-enter-active {
  transition: opacity 0.15s ease 0.05s;
}
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .sidebar {
    width: 240px !important;
    transform: translateX(-100%);
    &.mobile-open {
      transform: translateX(0);
    }
  }
}
</style>
