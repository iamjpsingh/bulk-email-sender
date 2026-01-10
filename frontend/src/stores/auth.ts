import { ref, computed } from 'vue'

export interface User {
  id: string
  email: string
  name: string
}

// Global auth state
const user = ref<User | null>(null)
const isInitialized = ref(false)
const loading = ref(false)

// Initialize auth state by checking session with server
async function initializeAuth(): Promise<void> {
  if (isInitialized.value) return
  
  loading.value = true
  try {
    const response = await fetch('/auth/me', {
      credentials: 'include'
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.user) {
        user.value = data.user
      }
    }
  } catch (error) {
    console.error('Auth initialization failed:', error)
  } finally {
    loading.value = false
    isInitialized.value = true
  }
}

// Login function
async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
  loading.value = true
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    
    if (data.success && data.user) {
      user.value = data.user
      return { success: true }
    }
    
    return { success: false, message: data.message || 'Login failed' }
  } catch (error) {
    return { success: false, message: 'Network error' }
  } finally {
    loading.value = false
  }
}

// Register function
async function register(name: string, email: string, password: string): Promise<{ success: boolean; message?: string }> {
  loading.value = true
  try {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password })
    })
    
    const data = await response.json()
    
    if (data.success && data.user) {
      user.value = data.user
      return { success: true }
    }
    
    return { success: false, message: data.message || 'Registration failed' }
  } catch (error) {
    return { success: false, message: 'Network error' }
  } finally {
    loading.value = false
  }
}

// Logout function
async function logout(): Promise<void> {
  loading.value = true
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    user.value = null
    loading.value = false
  }
}

// Check if user is authenticated
function requireAuth(): boolean {
  return !!user.value
}

// Auth composable
export function useAuth() {
  return {
    user: computed(() => user.value),
    isAuthenticated: computed(() => !!user.value),
    isInitialized: computed(() => isInitialized.value),
    loading: computed(() => loading.value),
    initializeAuth,
    login,
    register,
    logout,
    requireAuth
  }
}
