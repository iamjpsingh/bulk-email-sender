<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import { Send, Zap, BarChart3, Clock, Loader2, AlertCircle } from 'lucide-vue-next'

const router = useRouter()
const { login, register, loading } = useAuth()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const name = ref('')
const error = ref('')

async function handleSubmit() {
  error.value = ''
  
  try {
    let result
    if (mode.value === 'login') {
      result = await login(email.value, password.value)
    } else {
      result = await register(name.value, email.value, password.value)
    }
    
    if (result.success) {
      router.push('/')
    } else {
      error.value = result.message || 'Authentication failed'
    }
  } catch (err) {
    error.value = 'Network error - make sure backend is running on port 3000'
    console.error('Auth error:', err)
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
  // Clear form when switching modes
  email.value = ''
  password.value = ''
  name.value = ''
}
</script>

<template>
  <div class="login-page">
    <!-- Animated background -->
    <div class="bg-grid"></div>
    <div class="bg-glow"></div>
    
    <div class="login-container fade-in">
      <!-- Logo -->
      <div class="login-header">
        <div class="logo-large">
          <Send class="logo-icon" :size="40" />
          <span class="logo-text">MailFlow</span>
        </div>
        <p class="tagline">Bulk email campaigns, simplified</p>
      </div>
      
      <!-- Form card -->
      <div class="login-card glass-card">
        <div class="card-header">
          <h2>{{ mode === 'login' ? 'Welcome back' : 'Create account' }}</h2>
          <p class="text-muted">
            {{ mode === 'login' ? 'Sign in to your account' : 'Get started with MailFlow' }}
          </p>
        </div>
        
        <form @submit.prevent="handleSubmit" class="login-form">
          <!-- Error message -->
          <div v-if="error" class="error-message">
            <AlertCircle :size="18" />
            <span>{{ error }}</span>
          </div>
          
          <!-- Name field (register only) -->
          <div v-if="mode === 'register'" class="form-group">
            <label class="form-label">Full Name</label>
            <input
              v-model="name"
              type="text"
              class="form-input"
              placeholder="John Doe"
              required
            />
          </div>
          
          <!-- Email field -->
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input
              v-model="email"
              type="email"
              class="form-input"
              placeholder="you@example.com"
              required
            />
          </div>
          
          <!-- Password field -->
          <div class="form-group">
            <label class="form-label">Password</label>
            <input
              v-model="password"
              type="password"
              class="form-input"
              placeholder="••••••••"
              minlength="6"
              required
            />
          </div>
          
          <!-- Submit button -->
          <button
            type="submit"
            class="btn btn-primary btn-lg w-full"
            :disabled="loading"
          >
            <Loader2 v-if="loading" :size="18" class="spin" />
            <span v-else>{{ mode === 'login' ? 'Sign In' : 'Create Account' }}</span>
          </button>
        </form>
        
        <!-- Toggle mode -->
        <div class="card-footer">
          <span class="text-muted">
            {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
          </span>
          <button class="btn btn-ghost btn-sm" @click="toggleMode">
            {{ mode === 'login' ? 'Sign Up' : 'Sign In' }}
          </button>
        </div>
      </div>
      
      <!-- Features -->
      <div class="features">
        <div class="feature">
          <Zap :size="18" class="feature-icon" />
          <span>Batch Processing</span>
        </div>
        <div class="feature">
          <BarChart3 :size="18" class="feature-icon" />
          <span>Real-time Tracking</span>
        </div>
        <div class="feature">
          <Clock :size="18" class="feature-icon" />
          <span>Scheduled Sends</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
}

.bg-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
  opacity: 0.5;
}

.login-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-large {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
  
  .logo-icon {
    color: var(--accent-primary);
  }
  
  .logo-text {
    font-family: var(--font-mono);
    font-size: 32px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.tagline {
  color: var(--text-muted);
  font-size: 15px;
}

.login-card {
  padding: 32px;
}

.card-header {
  text-align: center;
  margin-bottom: 28px;
  
  h2 {
    font-size: 24px;
    margin-bottom: 8px;
  }
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: var(--danger);
  font-size: 14px;
  margin-bottom: 16px;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.features {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 40px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  
  &-icon {
    color: var(--accent-primary);
  }
}

@media (max-width: 480px) {
  .features {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
}
</style>
