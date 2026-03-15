<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminApi } from '../../lib/api/admin'
import type { Organization } from '../../lib/api/admin'
import { useToast } from '../../composables/useToast'
import Skeleton from '../../components/ui/Skeleton.vue'
import { Building2, Loader2 } from 'lucide-vue-next'

const toast = useToast()
const loading = ref(true)
const org = ref<Organization | null>(null)
const orgForm = ref({ name: '' })
const savingOrg = ref(false)

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

async function loadOrg() {
  try {
    org.value = await adminApi.getOrg()
    orgForm.value.name = org.value.name
  } catch (e: any) {
    toast.error(e.message || 'Failed to load organization')
  } finally {
    loading.value = false
  }
}

async function saveOrg() {
  savingOrg.value = true
  try {
    await adminApi.updateOrg({ name: orgForm.value.name })
    toast.success('Organization updated')
    await loadOrg()
  } catch (e: any) {
    toast.error(e.message || 'Failed to save')
  } finally {
    savingOrg.value = false
  }
}

onMounted(loadOrg)
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-4">
      <Skeleton variant="card" :count="1" />
    </div>

    <div v-else class="bg-bg-card border border-border rounded-xl p-6 max-w-xl">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Building2 :size="20" class="text-accent" />
        </div>
        <div>
          <h3 class="text-[15px] font-semibold text-text-primary">Organization Settings</h3>
          <p class="text-sm text-text-muted">{{ org?.slug }}</p>
        </div>
      </div>

      <form @submit.prevent="saveOrg">
        <div class="form-group">
          <label class="form-label">Organization Name</label>
          <input v-model="orgForm.name" type="text" class="form-input" required />
        </div>

        <div class="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg text-sm text-text-muted mb-4">
          <span>Status: <strong class="text-text-primary">{{ org?.status || 'active' }}</strong></span>
          <span class="mx-2 text-border">|</span>
          <span>Created: <strong class="text-text-primary">{{ org ? formatDate(org.created_at) : '-' }}</strong></span>
        </div>

        <button type="submit" class="btn-primary" :disabled="savingOrg">
          <Loader2 v-if="savingOrg" :size="16" class="spin" />
          Save Changes
        </button>
      </form>
    </div>
  </div>
</template>
