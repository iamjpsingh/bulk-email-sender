<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useAuth } from './stores/auth'
import ToastContainer from './components/ui/ToastContainer.vue'

const route = useRoute()
const { initializeAuth } = useAuth()

onMounted(async () => {
  await initializeAuth()
})
</script>

<template>
  <div id="app">
    <RouterView v-slot="{ Component }" :key="route.fullPath">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <ToastContainer />
  </div>
</template>

<style>
#app {
  min-height: 100vh;
}

.page-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.page-leave-active {
  transition: opacity 0.12s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}
</style>
