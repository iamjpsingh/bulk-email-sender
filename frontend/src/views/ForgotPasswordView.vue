<script setup lang="ts">
import { ref } from 'vue'
import { authApi } from '../lib/api'
import { Send, Loader2, AlertCircle, CheckCircle, ArrowLeft, Mail } from 'lucide-vue-next'

const email = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

async function handleSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const msg = await authApi.forgotPassword(email.value)
    success.value = msg
  } catch (err: any) {
    error.value = err.message || 'Failed to send reset email'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-bg-primary">
    <div class="w-full max-w-[400px]">
      <!-- Logo -->
      <div class="text-center mb-10">
        <div class="flex items-center justify-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Send class="text-white" :size="20" />
          </div>
        </div>
        <h1 class="text-[26px] font-bold tracking-tight text-text-primary mb-1">Reset Password</h1>
        <p class="text-text-muted text-sm">Enter your email to receive a reset link</p>
      </div>

      <div class="bg-bg-card border border-border rounded-xl p-8">
        <!-- Success state -->
        <div v-if="success" class="text-center">
          <div class="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle :size="24" class="text-success" />
          </div>
          <p class="text-text-primary text-sm mb-6">{{ success }}</p>
          <router-link to="/login" class="text-accent text-sm font-medium hover:underline">
            Back to Sign In
          </router-link>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-1">
          <div v-if="error" class="flex items-start gap-2.5 py-3 px-3.5 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm mb-4" role="alert">
            <AlertCircle :size="16" class="shrink-0 mt-0.5" />
            <span>{{ error }}</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="reset-email">Email Address</label>
            <input
              id="reset-email"
              v-model="email"
              type="email"
              class="form-input"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>

          <button
            type="submit"
            class="flex items-center justify-center gap-2 w-full h-11 mt-2 bg-accent text-white text-sm font-semibold rounded-lg transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="loading || !email.trim()"
          >
            <Loader2 v-if="loading" :size="18" class="spin" />
            <template v-else>
              <Mail :size="16" />
              <span>Send Reset Link</span>
            </template>
          </button>
        </form>

        <div class="flex items-center justify-center gap-1.5 mt-6 pt-6 border-t border-border">
          <router-link to="/login" class="flex items-center gap-1 text-accent text-sm font-medium hover:underline">
            <ArrowLeft :size="14" />
            Back to Sign In
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
