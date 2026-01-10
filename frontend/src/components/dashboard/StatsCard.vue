<script setup lang="ts">
import { Component } from 'vue'

defineProps<{
  label: string
  value: string | number
  icon: Component
  variant?: 'default' | 'success' | 'danger' | 'accent'
}>()
</script>

<template>
  <div class="stat-card" :class="variant">
    <div class="stat-icon">
      <component :is="icon" :size="24" />
    </div>
    <div class="stat-content">
      <div class="stat-value mono">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  &.success {
    border-left: 3px solid var(--success);
    
    .stat-icon {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }
  }
  
  &.danger {
    border-left: 3px solid var(--danger);
    
    .stat-icon {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
    }
  }
  
  &.accent {
    border-left: 3px solid var(--accent-primary);
    box-shadow: 0 0 30px var(--accent-glow);
    
    .stat-icon {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-primary);
    }
    
    .stat-value {
      color: var(--accent-primary);
    }
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
