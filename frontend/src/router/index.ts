import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'
import { usePermissions } from '../composables/usePermissions'

const routes = [
  // Guest routes (no layout)
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { guest: true },
  },
  {
    path: '/reset-password/:token',
    name: 'ResetPassword',
    component: () => import('../views/ResetPasswordView.vue'),
    meta: { guest: true },
  },
  {
    path: '/invite/:token',
    name: 'AcceptInvite',
    component: () => import('../views/AcceptInviteView.vue'),
  },

  // Authenticated routes (wrapped in MainLayout)
  {
    path: '/',
    component: () => import('../components/layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { breadcrumb: 'Dashboard' },
      },
      {
        path: 'compose',
        name: 'Compose',
        component: () => import('../views/ComposeView.vue'),
        meta: { breadcrumb: 'Compose' },
      },
      {
        path: 'campaigns',
        name: 'Campaigns',
        component: () => import('../views/CampaignsView.vue'),
        meta: { breadcrumb: 'Campaigns' },
      },
      {
        path: 'campaigns/:id',
        name: 'CampaignDetail',
        component: () => import('../views/CampaignDetailView.vue'),
        meta: { breadcrumb: 'Campaign Detail', parent: { name: 'Campaigns', path: '/campaigns' } },
      },
      {
        path: 'contacts',
        name: 'Contacts',
        component: () => import('../views/ContactsView.vue'),
        meta: { breadcrumb: 'Contacts' },
      },
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('../views/TemplatesView.vue'),
        meta: { breadcrumb: 'Templates' },
      },
      {
        path: 'automations',
        name: 'Automations',
        component: () => import('../views/AutomationsView.vue'),
        meta: { breadcrumb: 'Automations' },
      },
      {
        path: 'whatsapp',
        name: 'WhatsApp',
        component: () => import('../views/WhatsAppView.vue'),
        meta: { breadcrumb: 'WhatsApp' },
      },
      {
        path: 'forms',
        name: 'Forms',
        component: () => import('../views/FormsView.vue'),
        meta: { breadcrumb: 'Forms' },
      },
      {
        path: 'pages',
        name: 'Pages',
        component: () => import('../views/PagesView.vue'),
        meta: { breadcrumb: 'Pages' },
      },
      {
        path: 'calendar',
        name: 'Calendar',
        component: () => import('../views/CalendarView.vue'),
        meta: { breadcrumb: 'Calendar' },
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('../views/AnalyticsView.vue'),
        meta: { breadcrumb: 'Analytics' },
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('../views/ReportsView.vue'),
        meta: { breadcrumb: 'Reports' },
      },

      // Settings — nested sub-pages
      {
        path: 'settings',
        component: () => import('../views/settings/SettingsLayout.vue'),
        meta: { breadcrumb: 'Settings' },
        children: [
          { path: '', redirect: { name: 'SettingsEmail' } },
          {
            path: 'email',
            name: 'SettingsEmail',
            component: () => import('../views/settings/EmailSettings.vue'),
            meta: { breadcrumb: 'Email Providers' },
          },
          {
            path: 'smtp',
            name: 'SettingsSMTP',
            component: () => import('../views/settings/SmtpSettings.vue'),
            meta: { breadcrumb: 'SMTP' },
          },
          {
            path: 'api-keys',
            name: 'SettingsApiKeys',
            component: () => import('../views/settings/ApiKeysSettings.vue'),
            meta: { breadcrumb: 'API Keys' },
          },
          {
            path: 'webhooks',
            name: 'SettingsWebhooks',
            component: () => import('../views/settings/WebhooksSettings.vue'),
            meta: { breadcrumb: 'Webhooks' },
          },
          {
            path: 'tracking',
            name: 'SettingsTracking',
            component: () => import('../views/settings/TrackingSettings.vue'),
            meta: { breadcrumb: 'Tracking' },
          },
        ],
      },

      // Admin — nested sub-pages
      {
        path: 'admin',
        component: () => import('../views/admin/AdminLayout.vue'),
        meta: { breadcrumb: 'Admin' },
        children: [
          { path: '', redirect: { name: 'AdminOrg' } },
          {
            path: 'organization',
            name: 'AdminOrg',
            component: () => import('../views/admin/OrgSettings.vue'),
            meta: { breadcrumb: 'Organization' },
          },
          {
            path: 'members',
            name: 'AdminMembers',
            component: () => import('../views/admin/MembersPage.vue'),
            meta: { breadcrumb: 'Members' },
          },
          {
            path: 'teams',
            name: 'AdminTeams',
            component: () => import('../views/admin/TeamsPage.vue'),
            meta: { breadcrumb: 'Teams' },
          },
          {
            path: 'roles',
            name: 'AdminRoles',
            component: () => import('../views/admin/RolesPage.vue'),
            meta: { breadcrumb: 'Roles' },
          },
          {
            path: 'audit',
            name: 'AdminAudit',
            component: () => import('../views/admin/AuditPage.vue'),
            meta: { breadcrumb: 'Audit Logs' },
          },
          {
            path: 'platform',
            name: 'AdminPlatform',
            component: () => import('../views/admin/PlatformPage.vue'),
            meta: { breadcrumb: 'Platform' },
          },
          {
            path: 'platform-settings',
            name: 'AdminPlatformSettings',
            component: () => import('../views/admin/PlatformSettingsPage.vue'),
            meta: { breadcrumb: 'Platform Settings' },
          },
        ],
      },
    ],
  },

  // 404
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

  if (!isInitialized.value) {
    await initializeAuth()
  }

  const requiresAuth = to.matched.some(r => r.meta.requiresAuth)
  const isGuestRoute = to.meta.guest

  if (requiresAuth && !isAuthenticated.value) {
    next({ path: '/login', replace: true })
  } else if (isGuestRoute && isAuthenticated.value) {
    // Platform admin goes to platform dashboard, not org dashboard
    const { isPlatformAdmin } = useAuth()
    if (isPlatformAdmin.value) {
      next({ path: '/admin/platform', replace: true })
    } else {
      next({ path: '/', replace: true })
    }
  } else if (requiresAuth && isAuthenticated.value) {
    const { isPlatformAdmin } = useAuth()

    // Platform admin: block org-scoped routes, redirect to platform
    if (isPlatformAdmin.value) {
      const isPlatformRoute = to.path.startsWith('/admin/platform')
      if (!isPlatformRoute && to.path !== '/') {
        next({ path: '/admin/platform', replace: true })
        return
      }
    }

    // Permission gating: admin routes require admin role
    const isAdminRoute = to.path.startsWith('/admin')
    const isSettingsRoute = to.path.startsWith('/settings')
    if (isAdminRoute || isSettingsRoute) {
      const { isAdmin, can } = usePermissions()
      // Platform admin can access /admin/platform* routes
      if (isAdminRoute && !isAdmin.value && !isPlatformAdmin.value) {
        next({ path: '/', replace: true })
        return
      }
      if (isSettingsRoute && !can('settings.view') && !can('smtp.view')) {
        next({ path: '/', replace: true })
        return
      }
    }
    next()
  } else {
    next()
  }
})

export default router
