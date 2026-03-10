<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
</script>

<template>
  <div class="flex min-h-screen">
    <AppSidebar />
    <main class="flex-1 ml-[240px] max-md:ml-0 p-8 min-h-screen bg-bg-primary">
      <div class="max-w-[1400px] mx-auto">
        <slot />
      </div>
    </main>
  </div>
</template>
