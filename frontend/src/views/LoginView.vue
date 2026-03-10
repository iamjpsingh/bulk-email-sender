<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { Send, Zap, BarChart3, Clock, Loader2, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-vue-next'

const router = useRouter()
const { login, register, loading } = useAuth()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const name = ref('')
const error = ref('')
const showPassword = ref(false)
const shakeError = ref(false)

const isFormValid = computed(() => {
  if (!email.value.trim() || !password.value.trim()) return false
  if (mode.value === 'register' && !name.value.trim()) return false
  return true
})

async function handleSubmit() {
  error.value = ''
  shakeError.value = false

  try {
    let result
    if (mode.value === 'login') {
      result = await login(email.value, password.value)
    } else {
      result = await register(name.value, email.value, password.value)
    }

    if (result.success) {
      router.replace('/')
    } else {
      error.value = result.message || 'Authentication failed'
      triggerShake()
    }
  } catch (err) {
    error.value = 'Network error — make sure backend is running on port 3000'
    triggerShake()
    console.error('Auth error:', err)
  }
}

function triggerShake() {
  shakeError.value = true
  setTimeout(() => {
    shakeError.value = false
  }, 500)
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
  email.value = ''
  password.value = ''
  name.value = ''
  showPassword.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
    <!-- Animated background -->
    <div class="bg-grid absolute inset-0 pointer-events-none"></div>
    <div
      class="bg-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none opacity-40"
    ></div>

    <div class="w-full max-w-[420px] relative z-1 animate-fade-in">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-3 mb-3">
          <div
            class="w-12 h-12 rounded-2xl bg-linear-to-br from-accent to-accent-secondary flex items-center justify-center shadow-[0_4px_20px_rgba(99,102,241,0.4)]"
          >
            <Send class="text-white" :size="24" />
          </div>
        </div>
        <h1 class="logo-text font-mono text-[32px] font-bold mb-1">Dispatch</h1>
        <p class="text-text-muted text-[15px]">Bulk email campaigns, simplified</p>
      </div>

      <!-- Form card -->
      <div class="glass-card p-8">
        <div class="text-center mb-7">
          <h2 class="text-2xl mb-2">{{ mode === 'login' ? 'Welcome back' : 'Create account' }}</h2>
          <p class="text-text-muted text-sm">
            {{ mode === 'login' ? 'Sign in to your account' : 'Get started with Dispatch' }}
          </p>
        </div>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-1">
          <!-- Error message -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            leave-active-class="transition-all duration-200 ease-in"
            enter-from-class="opacity-0 -translate-y-2 scale-95"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="error"
              class="flex items-start gap-2.5 py-3 px-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-xl text-danger text-sm mb-4"
              :class="{ 'animate-shake': shakeError }"
              role="alert"
            >
              <AlertCircle :size="18" class="shrink-0 mt-0.5" />
              <span>{{ error }}</span>
            </div>
          </Transition>

          <!-- Name field (register only) -->
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            leave-active-class="transition-all duration-200 ease-in"
            enter-from-class="opacity-0 -translate-y-3"
            leave-to-class="opacity-0 -translate-y-3"
          >
            <div v-if="mode === 'register'" class="form-group">
              <label class="form-label" for="name-input">Full Name</label>
              <input
                id="name-input"
                v-model="name"
                type="text"
                class="form-input"
                placeholder="John Doe"
                autocomplete="name"
                required
              />
            </div>
          </Transition>

          <!-- Email field -->
          <div class="form-group">
            <label class="form-label" for="email-input">Email Address</label>
            <input
              id="email-input"
              v-model="email"
              type="email"
              class="form-input"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>

          <!-- Password field -->
          <div class="form-group">
            <label class="form-label" for="password-input">Password</label>
            <div class="relative">
              <input
                id="password-input"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input pr-11"
                placeholder="••••••••"
                minlength="6"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                required
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary transition-colors duration-150 rounded"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                tabindex="-1"
              >
                <EyeOff v-if="showPassword" :size="18" />
                <Eye v-else :size="18" />
              </button>
            </div>
          </div>

          <!-- Submit button -->
          <button type="submit" class="btn btn-primary btn-lg w-full mt-2 group" :disabled="loading || !isFormValid">
            <Loader2 v-if="loading" :size="18" class="spin" />
            <template v-else>
              <span>{{ mode === 'login' ? 'Sign In' : 'Create Account' }}</span>
              <ArrowRight :size="18" class="transition-transform duration-200 group-hover:translate-x-0.5" />
            </template>
          </button>
        </form>

        <!-- Toggle mode -->
        <div class="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-border">
          <span class="text-text-muted text-sm">
            {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
          </span>
          <button
            class="text-accent text-sm font-semibold hover:underline cursor-pointer bg-transparent border-none font-sans"
            @click="toggleMode"
          >
            {{ mode === 'login' ? 'Sign Up' : 'Sign In' }}
          </button>
        </div>
      </div>

      <!-- Features -->
      <div class="flex justify-center gap-8 mt-10 max-[480px]:flex-col max-[480px]:items-center max-[480px]:gap-3">
        <div class="flex items-center gap-2 text-[13px] text-text-muted">
          <Zap :size="16" class="text-accent" />
          <span>Batch Processing</span>
        </div>
        <div class="flex items-center gap-2 text-[13px] text-text-muted">
          <BarChart3 :size="16" class="text-accent" />
          <span>Real-time Tracking</span>
        </div>
        <div class="flex items-center gap-2 text-[13px] text-text-muted">
          <Clock :size="16" class="text-accent" />
          <span>Scheduled Sends</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-grid {
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
}

.bg-glow {
  background: radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%);
}

.logo-text {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-6px);
  }
  40% {
    transform: translateX(6px);
  }
  60% {
    transform: translateX(-4px);
  }
  80% {
    transform: translateX(4px);
  }
}

.animate-shake {
  animation: shake 0.4s ease-in-out;
}
</style>
