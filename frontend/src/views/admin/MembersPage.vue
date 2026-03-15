<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminApi } from '../../lib/api/admin'
import type { OrgMember } from '../../lib/api/admin'
import { useToast } from '../../composables/useToast'
import Modal from '../../components/ui/Modal.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import { Users, UserPlus, UserMinus, Pencil, Loader2 } from 'lucide-vue-next'

const toast = useToast()
const loading = ref(true)
const members = ref<OrgMember[]>([])
const showAddMember = ref(false)
const addMemberForm = ref({ email: '', role: 'member' })
const addingMember = ref(false)
const memberConfirm = ref<{ show: boolean; userId: string }>({ show: false, userId: '' })
const editRoleModal = ref<{ show: boolean; userId: string; name: string; currentRole: string; newRole: string }>({
  show: false, userId: '', name: '', currentRole: '', newRole: '',
})

const roleOptions = ['readonly', 'member', 'manager', 'admin', 'owner']

function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    owner: 'badge-accent', admin: 'badge-warning', manager: 'badge-info',
    member: 'badge-default', readonly: 'badge-muted',
  }
  return map[role] || 'badge-default'
}

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function loadMembers() {
  try {
    members.value = await adminApi.getMembers()
  } catch (e: any) {
    toast.error(e.message || 'Failed to load members')
  } finally {
    loading.value = false
  }
}

async function addMember() {
  addingMember.value = true
  try {
    await adminApi.addMember(addMemberForm.value.email, addMemberForm.value.role)
    toast.success('Member added')
    showAddMember.value = false
    addMemberForm.value = { email: '', role: 'member' }
    await loadMembers()
  } catch (e: any) {
    toast.error(e.message || 'Failed to add member')
  } finally {
    addingMember.value = false
  }
}

function promptEditRole(m: OrgMember) {
  editRoleModal.value = {
    show: true, userId: m.user_id,
    name: m.name || m.email || '',
    currentRole: m.role, newRole: m.role,
  }
}

async function confirmEditRole() {
  const { userId, newRole } = editRoleModal.value
  editRoleModal.value.show = false
  try {
    await adminApi.updateMemberRole(userId, newRole)
    toast.success('Role updated')
    await loadMembers()
  } catch (e: any) {
    toast.error(e.message || 'Failed to update role')
  }
}

function promptRemoveMember(userId: string) {
  memberConfirm.value = { show: true, userId }
}

async function confirmRemoveMember() {
  const userId = memberConfirm.value.userId
  memberConfirm.value = { show: false, userId: '' }
  try {
    await adminApi.removeMember(userId)
    toast.success('Member removed')
    await loadMembers()
  } catch (e: any) {
    toast.error(e.message || 'Failed to remove member')
  }
}

onMounted(loadMembers)
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-4">
      <Skeleton variant="card" :count="2" />
    </div>

    <template v-else>
      <div class="flex justify-between items-center mb-4">
        <p class="text-sm text-text-muted">{{ members.length }} member{{ members.length !== 1 ? 's' : '' }}</p>
        <button class="btn-primary btn-sm" @click="showAddMember = true">
          <UserPlus :size="15" /> Add Member
        </button>
      </div>

      <div v-if="members.length === 0" class="bg-bg-card border border-border rounded-xl">
        <EmptyState :icon="Users" title="No members" description="Add your first team member" />
      </div>

      <div v-else class="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table class="data-table w-full">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Joined</th>
              <th scope="col" class="w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td class="font-medium text-text-primary">{{ m.name || '-' }}</td>
              <td class="text-text-muted text-sm">{{ m.email }}</td>
              <td>
                <span :class="['badge-sm', roleBadgeClass(m.role)]">{{ m.role }}</span>
              </td>
              <td>
                <span :class="['badge-sm', m.status === 'active' ? 'badge-success' : 'badge-warning']">
                  {{ m.status }}
                </span>
              </td>
              <td class="text-text-muted text-sm">{{ formatDate(m.joined_at) }}</td>
              <td>
                <div class="flex items-center gap-1">
                  <button class="btn-ghost btn-sm" @click="promptEditRole(m)" title="Change role">
                    <Pencil :size="14" />
                  </button>
                  <button
                    v-if="m.role !== 'owner'"
                    class="btn-ghost btn-sm text-danger"
                    @click="promptRemoveMember(m.user_id)"
                    title="Remove member"
                  >
                    <UserMinus :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Add Member Modal -->
      <Modal :show="showAddMember" title="Add Member" size="sm" @close="showAddMember = false">
        <form id="add-member-form" @submit.prevent="addMember">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input v-model="addMemberForm.email" type="email" class="form-input" placeholder="user@example.com" required />
            <p class="text-xs text-text-muted mt-1">User must already have an account</p>
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select v-model="addMemberForm.role" class="form-select">
              <option v-for="r in roleOptions.filter(r => r !== 'owner')" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
        </form>
        <template #footer>
          <button class="btn-ghost" @click="showAddMember = false">Cancel</button>
          <button type="submit" form="add-member-form" class="btn-primary" :disabled="addingMember">
            <Loader2 v-if="addingMember" :size="16" class="spin" />
            Add Member
          </button>
        </template>
      </Modal>

      <!-- Edit Role Modal -->
      <Modal :show="editRoleModal.show" title="Change Role" size="sm" @close="editRoleModal.show = false">
        <p class="text-sm text-text-muted mb-4">
          Change role for <strong class="text-text-primary">{{ editRoleModal.name }}</strong>
        </p>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select v-model="editRoleModal.newRole" class="form-select">
            <option v-for="r in roleOptions" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <template #footer>
          <button class="btn-ghost" @click="editRoleModal.show = false">Cancel</button>
          <button class="btn-primary" @click="confirmEditRole" :disabled="editRoleModal.newRole === editRoleModal.currentRole">
            Update Role
          </button>
        </template>
      </Modal>

      <!-- Confirm Remove -->
      <ConfirmDialog
        :show="memberConfirm.show"
        title="Remove Member"
        message="Are you sure you want to remove this member from the organization?"
        confirm-text="Remove"
        variant="danger"
        @confirm="confirmRemoveMember"
        @cancel="memberConfirm = { show: false, userId: '' }"
      />
    </template>
  </div>
</template>
