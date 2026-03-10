<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, Home } from 'lucide-vue-next'

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
  <div class="not-found">
    <div class="not-found-content">
      <AlertTriangle :size="48" class="text-warning opacity-60" />
      <h1>Page Not Found</h1>
      <p class="text-muted">The page you're looking for doesn't exist or has been moved.</p>
      <div class="not-found-actions">
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

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg-primary);
}

.not-found-content {
  text-align: center;
  max-width: 400px;
}

.not-found-content h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 16px 0 8px;
  color: var(--color-text-primary);
}

.not-found-content p {
  color: var(--color-text-muted);
  margin-bottom: 24px;
}

.not-found-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
