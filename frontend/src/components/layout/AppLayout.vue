<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import {
  LayoutDashboard,
  Mail,
  BarChart3,
  Settings,
  LogOut,
  Send
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/compose', label: 'Compose', icon: Mail },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/configs', label: 'Configs', icon: Settings }
]

const currentPath = computed(() => route.path)

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

onMounted(() => {
  console.log('AppLayout mounted, current route:', route.path)
  console.log('User:', auth.user.value)
})
</script>

<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <Send class="logo-icon" :size="28" />
          <span class="logo-text">MailFlow</span>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: currentPath === item.path }"
        >
          <component :is="item.icon" class="nav-icon" :size="20" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">
            {{ auth.user.value?.name?.charAt(0).toUpperCase() || '?' }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ auth.user.value?.name || 'User' }}</div>
            <div class="user-email">{{ auth.user.value?.email || '' }}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">
          <LogOut :size="16" />
          <span class="hide-mobile">Logout</span>
        </button>
      </div>
    </aside>
    
    <!-- Main content -->
    <main class="main-content">
      <div class="content-wrapper">
        <slot>
          <!-- Fallback content if slot is empty -->
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">
            Loading content...
          </div>
        </slot>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  
  &-icon {
    color: var(--accent-primary);
  }
  
  &-text {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(6, 182, 212, 0.1);
    color: var(--text-primary);
  }
  
  &.active {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(20, 184, 166, 0.1));
    color: var(--accent-primary);
    border: 1px solid var(--border-glow);
    
    .nav-icon {
      color: var(--accent-primary);
    }
  }
}

.nav-icon {
  transition: transform 0.2s ease;
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--bg-primary);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-content {
  flex: 1;
  margin-left: 260px;
  padding: 32px;
  min-height: 100vh;
  background: var(--bg-primary);
  overflow-y: auto;
}

.content-wrapper {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 64px);
}

@media (max-width: 768px) {
  .sidebar {
    width: 70px;
    
    .logo-text, .nav-label, .user-details {
      display: none;
    }
    
    .sidebar-header {
      padding: 16px;
      justify-content: center;
    }
    
    .nav-item {
      justify-content: center;
      padding: 14px;
    }
    
    .user-info {
      justify-content: center;
    }
  }
  
  .main-content {
    margin-left: 70px;
    padding: 16px;
  }
  
  .hide-mobile {
    display: none;
  }
}
</style>
