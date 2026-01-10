<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuth } from './stores/auth'

const { initializeAuth } = useAuth()

onMounted(async () => {
  // Initialize authentication state on app startup
  await initializeAuth()
})
</script>

<template>
  <div id="app">
    <RouterView />
  </div>
</template>

<style>
#app {
  min-height: 100vh;
}
</style>
