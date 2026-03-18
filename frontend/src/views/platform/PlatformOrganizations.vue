<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi, type Organization } from '../../lib/api/admin'
import { useToast } from '../../composables/useToast'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import { Building2, Search, Loader2, Users, ChevronLeft, ChevronRight, Ban, CheckCircle, Trash2, MoreVertical, Archive } from 'lucide-vue-next'

const toast = useToast()
const loading = ref(true)
const orgs = ref<Organization[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const searchQuery = ref('')
const statusFilter = ref('')
const deleteConfirm = ref<{ show: boolean; orgId: string; name: string }>({ show: false, orgId: '', name: '' })
const actionMenuOpen = ref<string | null>(null)

const filtered = computed(() => {
  let result = orgs.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(o => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
  }
  if (statusFilter.value) {
    result = result.filter(o => o.status === statusFilter.value)
  }
  return result
})

async function loadOrgs() {
  loading.value = true
  try {
    const data = await adminApi.platformListOrgs(page.value, limit)
    orgs.value = data.orgs
    total.value = data.total
  } catch (e: any) { toast.error(e.message) }
  finally { loading.value = false }
}

async function updateStatus(orgId: string, status: string) {
  actionMenuOpen.value = null
  try {
    await adminApi.platformUpdateOrgStatus(orgId, status)
    toast.success(`Organization ${status}`)
    loadOrgs()
  } catch (e: any) { toast.error(e.message) }
}

async function confirmDelete() {
  const orgId = deleteConfirm.value.orgId
  deleteConfirm.value.show = false
  try {
    await adminApi.platformDeleteOrg(orgId)
    toast.success('Organization deleted')
    loadOrgs()
  } catch (e: any) { toast.error(e.message) }
}

function promptDelete(org: Organization) {
  actionMenuOpen.value = null
  deleteConfirm.value = { show: true, orgId: org.id, name: org.name }
}

function toggleMenu(orgId: string) {
  actionMenuOpen.value = actionMenuOpen.value === orgId ? null : orgId
}

function nextPage() { if (page.value * limit < total.value) { page.value++; loadOrgs() } }
function prevPage() { if (page.value > 1) { page.value--; loadOrgs() } }

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(loadOrgs)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Organizations</h1>
        <p class="text-sm text-text-muted mt-1">{{ total }} organization{{ total !== 1 ? 's' : '' }} on the platform</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 mb-4">
      <div class="relative flex-1 max-w-md">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input v-model="searchQuery" type="text" class="form-input pl-10" placeholder="Search organizations..." />
      </div>
      <select v-model="statusFilter" class="form-input w-36">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
        <option value="archived">Archived</option>
      </select>
    </div>

    <div v-if="loading" class="flex justify-center py-12"><Loader2 :size="20" class="animate-spin text-text-muted" /></div>

    <div v-else class="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-bg-tertiary border-b border-border">
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Organization</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Slug</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Members</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Created</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-20">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="org in filtered" :key="org.id" class="hover:bg-surface-0 transition">
            <td class="px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Building2 :size="14" class="text-accent" />
                </div>
                <span class="font-medium text-text-primary">{{ org.name }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-text-muted font-mono text-xs">@{{ org.slug }}</td>
            <td class="px-4 py-3">
              <span :class="[
                'px-2 py-0.5 rounded-full text-[11px] font-medium',
                org.status === 'active' ? 'bg-green-500/15 text-green-400' :
                org.status === 'suspended' ? 'bg-red-500/15 text-red-400' :
                'bg-surface-2 text-text-muted'
              ]">{{ org.status }}</span>
            </td>
            <td class="px-4 py-3 text-text-secondary">
              <div class="flex items-center gap-1"><Users :size="12" class="text-text-muted" /> {{ org.memberCount || '-' }}</div>
            </td>
            <td class="px-4 py-3 text-text-muted text-xs">{{ formatDate(org.created_at) }}</td>
            <td class="px-4 py-3 text-right relative">
              <button @click="toggleMenu(org.id)" class="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-1 transition">
                <MoreVertical :size="14" />
              </button>
              <div v-if="actionMenuOpen === org.id" class="absolute right-4 top-10 z-10 bg-surface-1 border border-border rounded-lg shadow-lg py-1 min-w-[170px]">
                <button
                  v-if="org.status === 'active'"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-amber-400 hover:bg-surface-0 transition"
                  @click="updateStatus(org.id, 'suspended')"
                ><Ban :size="12" /> Suspend</button>
                <button
                  v-if="org.status === 'suspended'"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-green-400 hover:bg-surface-0 transition"
                  @click="updateStatus(org.id, 'active')"
                ><CheckCircle :size="12" /> Activate</button>
                <button
                  v-if="org.status === 'active'"
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-text-muted hover:bg-surface-0 transition"
                  @click="updateStatus(org.id, 'archived')"
                ><Archive :size="12" /> Archive</button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-red-400 hover:bg-surface-0 transition"
                  @click="promptDelete(org)"
                ><Trash2 :size="12" /> Delete</button>
              </div>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="6" class="px-4 py-12 text-center text-text-muted">No organizations found</td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > limit" class="flex items-center justify-between px-4 py-3 border-t border-border">
        <span class="text-xs text-text-muted">Page {{ page }} of {{ Math.ceil(total / limit) }}</span>
        <div class="flex gap-1">
          <button class="btn-ghost text-xs px-2 py-1" :disabled="page <= 1" @click="prevPage"><ChevronLeft :size="14" /></button>
          <button class="btn-ghost text-xs px-2 py-1" :disabled="page * limit >= total" @click="nextPage"><ChevronRight :size="14" /></button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :show="deleteConfirm.show"
      title="Delete Organization"
      :message="`Delete &quot;${deleteConfirm.name}&quot; and all its data? This removes all members and cannot be undone.`"
      confirmText="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteConfirm.show = false"
    />
  </div>
</template>
