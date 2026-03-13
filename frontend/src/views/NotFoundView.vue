<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft, Home } from 'lucide-vue-next'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace('/')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-bg-primary">
    <div class="text-center max-w-[420px]">
      <div class="mb-6">
        <span class="block text-[100px] font-[800] tracking-[-0.05em] leading-none text-accent/20 select-none">404</span>
      </div>
      <h1 class="text-2xl font-semibold mb-3 text-text-primary">Page Not Found</h1>
      <p class="text-sm text-text-muted mb-10 leading-relaxed max-w-[320px] mx-auto">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div class="flex gap-3 justify-center">
        <button class="btn-ghost" @click="goBack">
          <ArrowLeft :size="16" />
          Go Back
        </button>
        <router-link to="/" class="btn-primary">
          <Home :size="16" />
          Dashboard
        </router-link>
      </div>
    </div>
  </div>
</template>
