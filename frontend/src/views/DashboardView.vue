<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '../stores/auth'
import { useDashboardStats } from '../lib/query'
import {
  Mail,
  CheckCircle,
  XCircle,
  TrendingUp,
  Plus,
  PenSquare,
  BarChart3,
  Settings,
  Download,
  LayoutDashboard,
  LogOut,
  Send
} from 'lucide-vue-next'

const { user, logout } = useAuth()

// Use TanStack Query for dashboard data
const { data: dashboardData, isLoading } = useDashboardStats()

const stats = computed(() => dashboardData.value?.stats || { total: 0, sent: 0, failed: 0 })
const successRate = computed(() => {
  const s = stats.value
  return s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0
})

async function handleLogout() {
  await logout()
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/compose', label: 'Compose', icon: Mail },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/configs', label: 'Configs', icon: Settings }
]
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
          :class="{ active: $route.path === item.path }"
        >
          <component :is="item.icon" class="nav-icon" :size="20" />
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      
      <div class="sidebar-footer">
        <div class="user-info" v-if="user">
          <div class="user-avatar">
            {{ user.name?.charAt(0).toUpperCase() || '?' }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ user.name || 'User' }}</div>
            <div class="user-email">{{ user.email || '' }}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">
          <LogOut :size="16" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
    
    <!-- Main content -->
    <main class="main-content">
      <div class="dashboard fade-in">
        
        <header class="page-header">
          <div>
            <h1>Dashboard</h1>
            <p class="text-muted">Overview of your email campaigns</p>
          </div>
          <router-link to="/compose" class="btn btn-primary">
            <Plus :size="18" />
            New Campaign
          </router-link>
        </header>
        
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <Mail :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.total }}</div>
              <div class="stat-label">Total Sent</div>
            </div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-icon">
              <CheckCircle :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.sent }}</div>
              <div class="stat-label">Delivered</div>
            </div>
          </div>
          
          <div class="stat-card danger">
            <div class="stat-icon">
              <XCircle :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ stats.failed }}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
          
          <div class="stat-card accent">
            <div class="stat-icon">
              <TrendingUp :size="24" />
            </div>
            <div class="stat-content">
              <div class="stat-value mono">{{ successRate }}%</div>
              <div class="stat-label">Success Rate</div>
            </div>
          </div>
        </div>
        
        <!-- Welcome Message -->
        <div class="welcome-card glass-card">
          <h3>Welcome to MailFlow!</h3>
          <p class="text-muted">Get started by creating your first email campaign or configuring your SMTP settings.</p>
          <div class="welcome-actions">
            <router-link to="/compose" class="btn btn-primary">
              <PenSquare :size="18" />
              Create Campaign
            </router-link>
            <router-link to="/configs" class="btn btn-secondary">
              <Settings :size="18" />
              Setup SMTP
            </router-link>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="quick-actions glass-card">
          <h3>Quick Actions</h3>
          <div class="actions-grid">
            <router-link to="/compose" class="action-card">
              <PenSquare :size="28" class="action-icon" />
              <span class="action-label">Compose Email</span>
            </router-link>
            <router-link to="/reports" class="action-card">
              <BarChart3 :size="28" class="action-icon" />
              <span class="action-label">View Reports</span>
            </router-link>
            <router-link to="/configs" class="action-card">
              <Settings :size="28" class="action-icon" />
              <span class="action-label">SMTP Settings</span>
            </router-link>
            <a href="/public/samples/sample-contacts.xlsx" class="action-card" download>
              <Download :size="28" class="action-icon" />
              <span class="action-label">Sample Excel</span>
            </a>
          </div>
        </div>
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
}

.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  
  h1 {
    font-size: 28px;
    margin-bottom: 4px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
  
  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  &.success {
    border-left: 3px solid var(--success);
    
    .stat-icon {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }
  }
  
  &.danger {
    border-left: 3px solid var(--danger);
    
    .stat-icon {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
    }
  }
  
  &.accent {
    border-left: 3px solid var(--accent-primary);
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
    
    .stat-icon {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-primary);
    }
    
    .stat-value {
      color: var(--accent-primary);
    }
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.welcome-card {
  padding: 32px;
  text-align: center;
  margin-bottom: 32px;
  
  h3 {
    font-size: 24px;
    margin-bottom: 12px;
    color: var(--text-primary);
  }
  
  p {
    margin-bottom: 24px;
    font-size: 16px;
  }
}

.welcome-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.quick-actions {
  padding: 24px;
  
  h3 {
    font-size: 18px;
    margin-bottom: 20px;
  }
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    transform: translateY(-2px);
    
    .action-icon {
      transform: scale(1.1);
    }
  }
}

.action-icon {
  transition: transform 0.2s ease;
}

.action-label {
  font-size: 14px;
  font-weight: 500;
}
</style>
