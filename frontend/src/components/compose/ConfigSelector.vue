<script setup lang="ts">
import { useConfigStore } from '../../stores/config'
import { Server, Check, ExternalLink } from 'lucide-vue-next'

const configStore = useConfigStore()

function selectConfig(id: string) {
  configStore.selectConfig(id)
}
</script>

<template>
  <div class="config-selector glass-card">
    <div class="selector-header">
      <h3>
        <Server :size="18" class="header-icon" />
        SMTP Configuration
      </h3>
      <router-link to="/configs" class="btn btn-ghost btn-sm">
        <ExternalLink :size="14" />
        Manage
      </router-link>
    </div>
    
    <div v-if="configStore.loading" class="loading">
      <span class="spin">Loading configs...</span>
    </div>
    
    <div v-else-if="configStore.configs.length === 0" class="empty">
      <p>No SMTP configurations found</p>
      <router-link to="/configs" class="btn btn-secondary btn-sm">
        Add Configuration
      </router-link>
    </div>
    
    <div v-else class="config-list">
      <div
        v-for="config in configStore.configs"
        :key="config.id"
        class="config-item"
        :class="{ active: configStore.selectedConfigId === config.id }"
        @click="selectConfig(config.id)"
      >
        <div class="config-radio">
          <div class="radio-dot" v-if="configStore.selectedConfigId === config.id">
            <Check :size="12" />
          </div>
        </div>
        <div class="config-info">
          <div class="config-name">
            {{ config.name }}
            <span v-if="config.is_default" class="badge badge-success">Default</span>
          </div>
          <div class="config-details mono">
            {{ config.host }}:{{ config.port }}
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="configStore.selectedConfigId" class="selected-info">
      <Check :size="16" />
      Configuration selected
    </div>
  </div>
</template>

<style scoped lang="scss">
.config-selector {
  padding: 20px;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  
  h3 {
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .header-icon {
    color: var(--accent-primary);
  }
}

.loading, .empty {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  
  p {
    margin-bottom: 12px;
  }
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--accent-primary);
  }
  
  &.active {
    border-color: var(--accent-primary);
    background: rgba(6, 182, 212, 0.1);
    
    .config-radio {
      border-color: var(--accent-primary);
      background: var(--accent-primary);
    }
  }
}

.config-radio {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.radio-dot {
  color: var(--bg-primary);
}

.config-info {
  flex: 1;
  min-width: 0;
}

.config-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.config-details {
  font-size: 12px;
  color: var(--text-muted);
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--success);
}
</style>
