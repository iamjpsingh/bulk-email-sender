import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/compose',
    name: 'Compose',
    component: () => import('../views/ComposeView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('../views/ReportsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/configs',
    name: 'Configs',
    component: () => import('../views/ConfigsView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Global navigation guard
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, isInitialized, initializeAuth } = useAuth()
  
  // Always initialize auth on first navigation
  if (!isInitialized.value) {
    await initializeAuth()
  }
  
  const requiresAuth = to.meta.requiresAuth
  const isGuestRoute = to.meta.guest
  
  if (requiresAuth && !isAuthenticated.value) {
    // Redirect to login if authentication is required but user is not authenticated
    next('/login')
  } else if (isGuestRoute && isAuthenticated.value) {
    // Redirect to dashboard if user is authenticated but trying to access guest route
    next('/')
  } else {
    // Allow navigation
    next()
  }
})

export default router
