/**
 * Route Configuration
 * Single source of truth for all API routes
 */

// API Route Prefixes - used by both backend and frontend proxy
export const API_ROUTES = [
  '/auth',
  '/oauth',
  '/user',
  '/config',
  '/send',
  '/report',
  '/dashboard',
  '/track',
  '/batch-status',
  '/batch-pause',
  '/batch-resume',
  '/batch-cancel',
  '/scheduled-jobs',
  '/parse-excel',
  '/provider-info',
  '/test-notification',
  '/public',
  '/health',
] as const

// Route Groups for documentation
export const ROUTE_GROUPS = {
  AUTH: {
    prefix: '/auth',
    endpoints: [
      { method: 'POST', path: '/login', description: 'User login' },
      { method: 'POST', path: '/register', description: 'User registration' },
      { method: 'POST', path: '/logout', description: 'User logout' },
      { method: 'GET', path: '/me', description: 'Get current user' },
    ],
  },
  OAUTH: {
    prefix: '/oauth',
    endpoints: [
      { method: 'GET', path: '/status', description: 'OAuth provider status' },
      { method: 'GET', path: '/google/connect', description: 'Initiate Google OAuth' },
      { method: 'GET', path: '/microsoft/connect', description: 'Initiate Microsoft OAuth' },
      { method: 'POST', path: '/:configId/test', description: 'Test OAuth connection' },
      { method: 'DELETE', path: '/:configId/disconnect', description: 'Disconnect OAuth' },
    ],
  },
  CONFIG: {
    prefix: '/config',
    endpoints: [
      { method: 'GET', path: '/list', description: 'List all configs' },
      { method: 'GET', path: '/smtp', description: 'Get SMTP configs' },
      { method: 'POST', path: '/create', description: 'Create config' },
      { method: 'POST', path: '/smtp/test', description: 'Test SMTP connection' },
      { method: 'DELETE', path: '/delete/:id', description: 'Delete config' },
    ],
  },
  SEND: {
    prefix: '/send',
    endpoints: [
      { method: 'POST', path: '/', description: 'Send emails' },
      { method: 'POST', path: '/parse-excel', description: 'Parse Excel file' },
      { method: 'POST', path: '/provider-info', description: 'Get provider info' },
    ],
  },
  BATCH: {
    prefix: '/batch',
    endpoints: [
      { method: 'GET', path: '-status', description: 'Get batch status' },
      { method: 'POST', path: '-pause', description: 'Pause batch job' },
      { method: 'POST', path: '-resume', description: 'Resume batch job' },
      { method: 'DELETE', path: '-cancel', description: 'Cancel batch job' },
    ],
  },
  SCHEDULE: {
    prefix: '/scheduled-jobs',
    endpoints: [
      { method: 'GET', path: '/', description: 'List scheduled jobs' },
      { method: 'DELETE', path: '/:id', description: 'Cancel scheduled job' },
    ],
  },
  REPORT: {
    prefix: '/report',
    endpoints: [
      { method: 'GET', path: '/', description: 'Get reports' },
      { method: 'GET', path: '/logs', description: 'Get logs with filtering' },
      { method: 'GET', path: '/stats', description: 'Get email statistics' },
      { method: 'GET', path: '/campaigns', description: 'Get campaigns list' },
      { method: 'GET', path: '/campaigns/:id', description: 'Get campaign details' },
      { method: 'GET', path: '/export/csv', description: 'Export as CSV' },
      { method: 'GET', path: '/export/json', description: 'Export as JSON' },
      { method: 'DELETE', path: '/clear', description: 'Clear local logs' },
    ],
  },
  DASHBOARD: {
    prefix: '/dashboard',
    endpoints: [
      { method: 'GET', path: '/stats', description: 'Dashboard stats' },
      { method: 'GET', path: '/poll-status', description: 'Polling status' },
      { method: 'GET', path: '/data', description: 'Dashboard data' },
    ],
  },
  TRACKING: {
    prefix: '/track',
    endpoints: [
      { method: 'GET', path: '/status', description: 'Tracking status' },
      { method: 'GET', path: '/open/:emailLogId', description: 'Track email open (pixel)' },
      { method: 'GET', path: '/click/:emailLogId', description: 'Track link click' },
    ],
  },
} as const

export type ApiRoute = typeof API_ROUTES[number]
