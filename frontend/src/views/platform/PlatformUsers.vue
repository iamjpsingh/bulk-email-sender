<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi, type PlatformUser } from '../../lib/api/admin'
import { useToast } from '../../composables/useToast'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from 'radix-vue'
import { Users, Search, Loader2, ChevronLeft, ChevronRight, Ban, CheckCircle, Trash2, MoreVertical, Mail } from 'lucide-vue-next'

const toast = useToast()
const loading = ref(true)
const users = ref<PlatformUser[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const searchQuery = ref('')
const statusFilter = ref('')
const deleteConfirm = ref<{ show: boolean; userId: string; name: string }>({ show: false, userId: '', name: '' })

const filtered = computed(() => {
  let result = users.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }
  if (statusFilter.value) {
    result = result.filter(u => u.status === statusFilter.value)
  }
  return result
})

async function loadUsers() {
  loading.value = true
  try {
    const data = await adminApi.platformListUsers(page.value, limit)
    users.value = data.users
    total.value = data.total
  } catch (e: any) { toast.error(e.message) }
  finally { loading.value = false }
}

async function updateStatus(userId: string, status: string) {
  try {
    await adminApi.platformUpdateUserStatus(userId, status)
    toast.success(`User ${status}`)
    loadUsers()
  } catch (e: any) { toast.error(e.message) }
}

async function confirmDelete() {
  const userId = deleteConfirm.value.userId
  deleteConfirm.value.show = false
  try {
    await adminApi.platformDeleteUser(userId)
    toast.success('User deleted')
    loadUsers()
  } catch (e: any) { toast.error(e.message) }
}

function promptDelete(u: PlatformUser) {
  deleteConfirm.value = { show: true, userId: u.id, name: u.name }
}

function nextPage() { if (page.value * limit < total.value) { page.value++; loadUsers() } }
function prevPage() { if (page.value > 1) { page.value--; loadUsers() } }

function formatDate(d: string | null): string {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(loadUsers)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Users</h1>
        <p class="text-sm text-text-muted mt-1">{{ total }} user{{ total !== 1 ? 's' : '' }} across all organizations</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 mb-4">
      <div class="relative flex-1 max-w-md">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input v-model="searchQuery" type="text" class="form-input pl-10" placeholder="Search by name or email..." />
      </div>
      <select v-model="statusFilter" class="form-input w-36">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
        <option value="pending">Pending</option>
      </select>
    </div>

    <div v-if="loading" class="flex justify-center py-12"><Loader2 :size="20" class="animate-spin text-text-muted" /></div>

    <!-- Users Table (no overflow-hidden, radix dropdown with portal) -->
    <div v-else class="bg-bg-card border border-border rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-bg-tertiary border-b border-border">
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">User</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Email</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Last Login</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Joined</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider w-16"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="u in filtered" :key="u.id" class="hover:bg-surface-0 transition">
            <td class="px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                  {{ u.name?.charAt(0).toUpperCase() || '?' }}
                </div>
                <span class="font-medium text-text-primary">{{ u.name }}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-text-muted text-xs">{{ u.email }}</td>
            <td class="px-4 py-3">
              <span :class="[
                'px-2 py-0.5 rounded-full text-[11px] font-medium',
                u.status === 'active' ? 'bg-green-500/15 text-green-400' :
                u.status === 'suspended' ? 'bg-red-500/15 text-red-400' :
                'bg-amber-500/15 text-amber-400'
              ]">{{ u.status }}</span>
            </td>
            <td class="px-4 py-3 text-text-muted text-xs">{{ formatDate(u.last_login_at) }}</td>
            <td class="px-4 py-3 text-text-muted text-xs">{{ formatDate(u.created_at) }}</td>
            <td class="px-4 py-3 text-right">
              <!-- Radix Dropdown with Portal — never clipped by table overflow -->
              <DropdownMenuRoot>
                <DropdownMenuTrigger as-child>
                  <button class="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-1 transition">
                    <MoreVertical :size="14" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent
                    :side-offset="4"
                    align="end"
                    class="z-50 min-w-[160px] bg-surface-1 border border-border rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
                  >
                    <DropdownMenuItem
                      v-if="u.status === 'active'"
                      class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer text-amber-400 hover:bg-surface-0 transition outline-none"
                      @select="updateStatus(u.id, 'suspended')"
                    >
                      <Ban :size="12" /> Suspend User
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="u.status === 'suspended'"
                      class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer text-green-400 hover:bg-surface-0 transition outline-none"
                      @select="updateStatus(u.id, 'active')"
                    >
                      <CheckCircle :size="12" /> Activate User
                    </DropdownMenuItem>
                    <DropdownMenuSeparator class="h-px bg-border my-1" />
                    <DropdownMenuItem
                      class="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer text-red-400 hover:bg-surface-0 transition outline-none"
                      @select="promptDelete(u)"
                    >
                      <Trash2 :size="12" /> Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="6" class="px-4 py-12 text-center text-text-muted">No users found</td>
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
      title="Delete User"
      :message="`Delete ${deleteConfirm.name}? This will remove them from all organizations. This cannot be undone.`"
      confirmText="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteConfirm.show = false"
    />
  </div>
</template>
