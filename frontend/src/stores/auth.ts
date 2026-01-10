/**
 * Auth Store
 * Uses TanStack Query for state management
 */
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useCurrentUser, useLogin, useRegister, useLogout, queryKeys } from '../lib/query'
import type { User } from '../lib/api'

export type { User }

// Track if we've attempted to initialize auth
const authInitialized = ref(false)

/**
 * Auth composable - wraps TanStack Query hooks
 */
export function useAuth() {
  const queryClient = useQueryClient()
  const { data: user, isLoading: loading, isFetched } = useCurrentUser()
  const loginMutation = useLogin()
  const registerMutation = useRegister()
  const logoutMutation = useLogout()

  const isAuthenticated = computed(() => !!user.value)
  const isInitialized = computed(() => authInitialized.value || isFetched.value)

  async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      await loginMutation.mutateAsync({ email, password })
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Login failed' }
    }
  }

  async function register(name: string, email: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      await registerMutation.mutateAsync({ name, email, password })
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Registration failed' }
    }
  }

  async function logout(): Promise<void> {
    await logoutMutation.mutateAsync()
  }

  // For router guard - initialize auth state
  async function initializeAuth(): Promise<void> {
    if (authInitialized.value) return
    
    try {
      // Try to fetch current user - will fail if not authenticated
      await queryClient.fetchQuery({
        queryKey: queryKeys.auth.me,
        queryFn: async () => {
          const { authApi } = await import('../lib/api')
          return await authApi.getMe()
        },
      })
    } catch {
      // Not authenticated - that's okay, just set to null
      queryClient.setQueryData(queryKeys.auth.me, null)
    } finally {
      authInitialized.value = true
    }
  }

  function requireAuth(): boolean {
    return !!user.value
  }

  return {
    user: computed(() => user.value),
    isAuthenticated,
    isInitialized,
    loading: computed(() => loading.value || loginMutation.isPending.value || registerMutation.isPending.value),
    initializeAuth,
    login,
    register,
    logout,
    requireAuth,
  }
}
