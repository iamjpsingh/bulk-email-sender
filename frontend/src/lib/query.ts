/**
 * TanStack Query Setup & Composables
 */
import { computed, isRef, type Ref, type ComputedRef } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  authApi,
  configApi,
  oauthApi,
  reportApi,
  dashboardApi,
  batchApi,
  scheduledApi,
  type SMTPConfig,
} from './api'

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  configs: {
    all: ['configs'] as const,
    list: () => [...queryKeys.configs.all, 'list'] as const,
  },
  oauth: {
    status: ['oauth', 'status'] as const,
  },
  reports: {
    all: ['reports'] as const,
    logs: (filters?: Record<string, any>) => [...queryKeys.reports.all, 'logs', filters] as const,
    stats: () => [...queryKeys.reports.all, 'stats'] as const,
  },
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    pollStatus: ['dashboard', 'poll-status'] as const,
  },
  batch: {
    status: ['batch', 'status'] as const,
  },
  scheduled: {
    list: ['scheduled', 'list'] as const,
  },
}

// ============================================================================
// Auth Composables
// ============================================================================

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.getMe,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ name, email, password }: { name: string; email: string; password: string }) =>
      authApi.register(name, email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me, null)
      queryClient.clear()
    },
  })
}

// ============================================================================
// Config Composables
// ============================================================================

export function useConfigs() {
  return useQuery({
    queryKey: queryKeys.configs.list(),
    queryFn: configApi.list,
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useCreateConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: configApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all })
    },
  })
}

export function useUpdateConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...config }: { id: string } & Partial<SMTPConfig> & { pass?: string }) =>
      configApi.update(id, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all })
    },
  })
}

export function useDeleteConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: configApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all })
    },
  })
}

export function useTestConfig() {
  return useMutation({
    mutationFn: configApi.test,
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: configApi.testConnection,
  })
}

// ============================================================================
// OAuth Composables
// ============================================================================

export function useOAuthStatus() {
  return useQuery({
    queryKey: queryKeys.oauth.status,
    queryFn: oauthApi.getStatus,
    staleTime: 60 * 1000, // 1 minute
  })
}

export function useConnectOAuth() {
  return useMutation({
    mutationFn: oauthApi.connect,
    onSuccess: (authUrl) => {
      window.location.href = authUrl
    },
  })
}

export function useDisconnectOAuth() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: oauthApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all })
    },
  })
}

export function useTestOAuth() {
  return useMutation({
    mutationFn: oauthApi.test,
  })
}

// ============================================================================
// Report Composables
// ============================================================================

type LogFilters = {
  status?: string
  send_type?: string
  provider?: string
  search?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
}

export function useLogs(filters?: LogFilters | Ref<LogFilters> | ComputedRef<LogFilters>) {
  // Support both reactive and non-reactive filters
  const resolvedFilters = computed<LogFilters | undefined>(() => {
    if (!filters) return undefined
    if (isRef(filters)) return filters.value
    return filters
  })

  return useQuery({
    queryKey: computed(() => queryKeys.reports.logs(resolvedFilters.value)),
    queryFn: () => reportApi.getLogs(resolvedFilters.value),
    staleTime: 10 * 1000, // 10 seconds
  })
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.reports.stats(),
    queryFn: reportApi.getStats,
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useClearLogs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => reportApi.deleteLogs(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}

export function useDeleteLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reportApi.deleteLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}

// ============================================================================
// Dashboard Composables
// ============================================================================

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: dashboardApi.getStats,
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  })
}

export function usePollStatus() {
  return useQuery({
    queryKey: queryKeys.dashboard.pollStatus,
    queryFn: dashboardApi.getPollStatus,
    staleTime: 5 * 1000,
  })
}

// ============================================================================
// Batch Composables
// ============================================================================

export function useBatchStatus() {
  return useQuery({
    queryKey: queryKeys.batch.status,
    queryFn: batchApi.getStatus,
    staleTime: 3 * 1000, // 3 seconds for active monitoring
  })
}

export function usePauseBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: batchApi.pause,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batch.status })
    },
  })
}

export function useResumeBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: batchApi.resume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batch.status })
    },
  })
}

export function useCancelBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: batchApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batch.status })
    },
  })
}

// ============================================================================
// Scheduled Jobs Composables
// ============================================================================

export function useScheduledJobs() {
  return useQuery({
    queryKey: queryKeys.scheduled.list,
    queryFn: scheduledApi.list,
    staleTime: 10 * 1000, // 10 seconds
  })
}

export function useCancelScheduledJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: scheduledApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduled.list })
    },
  })
}
