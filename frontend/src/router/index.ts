import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/compose',
    name: 'Compose',
    component: () => import('../views/ComposeView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('../views/ReportsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/contacts',
    name: 'Contacts',
    component: () => import('../views/ContactsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/configs',
    name: 'Configs',
    component: () => import('../views/ConfigsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/templates',
    name: 'Templates',
    component: () => import('../views/TemplatesView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/campaigns',
    name: 'Campaigns',
    component: () => import('../views/CampaignsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/campaigns/:id',
    name: 'CampaignDetail',
    component: () => import('../views/CampaignDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/automations',
    name: 'Automations',
    component: () => import('../views/AutomationsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/calendar',
    name: 'Calendar',
    component: () => import('../views/CalendarView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('../views/AnalyticsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

// Global navigation guard
router.beforeEach(async (to, _from, next) => {
  const { isAuthenticated, isInitialized, initializeAuth } = useAuth()

  // Always initialize auth on first navigation
  if (!isInitialized.value) {
    await initializeAuth()
  }

  const requiresAuth = to.meta.requiresAuth
  const isGuestRoute = to.meta.guest

  if (requiresAuth && !isAuthenticated.value) {
    // Replace (not push) to avoid back-button loops between login and protected pages
    next({ path: '/login', replace: true })
  } else if (isGuestRoute && isAuthenticated.value) {
    // Replace so pressing back from dashboard doesn't go back to login
    next({ path: '/', replace: true })
  } else {
    // Allow navigation
    next()
  }
})

export default router
