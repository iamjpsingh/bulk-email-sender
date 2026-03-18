<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../lib/api/admin'
import type { Organization, OrgMember, Team, TeamMember, SystemRole, AuditLog, ActivityLog } from '../lib/api/admin'
import { useToast } from '../composables/useToast'
import MainLayout from '../components/layout/MainLayout.vue'
import PageHeader from '../components/ui/PageHeader.vue'
import AppTabs from '../components/ui/AppTabs.vue'
import Modal from '../components/ui/Modal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import {
  Building2, Users, UsersRound, Shield, ScrollText,
  Plus, Pencil, Trash2, UserPlus, UserMinus, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-vue-next'

const toast = useToast()
const activeTab = ref('org')
const loading = ref(true)

const tabs = [
  { key: 'org', label: 'Organization' },
  { key: 'members', label: 'Members' },
  { key: 'teams', label: 'Teams' },
  { key: 'roles', label: 'Roles' },
  { key: 'audit', label: 'Audit Logs' },
]

// ============================================================================
// Data
// ============================================================================

const org = ref<Organization | null>(null)
const members = ref<OrgMember[]>([])
const teams = ref<Team[]>([])
const roles = ref<SystemRole[]>([])
const auditLogs = ref<AuditLog[]>([])
const auditTotal = ref(0)
const auditPage = ref(1)
const activityLogs = ref<ActivityLog[]>([])

// ============================================================================
// Organization
// ============================================================================

const orgForm = ref({ name: '' })
const savingOrg = ref(false)

async function loadOrg() {
  try {
    org.value = await adminApi.getOrg()
    orgForm.value.name = org.value.name
  } catch (e: any) {
    toast.error(e.message || 'Failed to load organization')
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

// ============================================================================
// Members
// ============================================================================

const showAddMember = ref(false)
const addMemberForm = ref({ email: '', role: 'member' })
const addingMember = ref(false)
const memberConfirm = ref<{ show: boolean; userId: string }>({ show: false, userId: '' })
const editRoleModal = ref<{ show: boolean; userId: string; name: string; currentRole: string; newRole: string }>({
  show: false, userId: '', name: '', currentRole: '', newRole: '',
})

async function loadMembers() {
  try {
    members.value = await adminApi.getMembers()
  } catch (e: any) {
    toast.error(e.message || 'Failed to load members')
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
    show: true,
    userId: m.user_id,
    name: m.name || m.email || '',
    currentRole: m.role,
    newRole: m.role,
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

// ============================================================================
// Teams
// ============================================================================

const showCreateTeam = ref(false)
const teamForm = ref({ name: '', description: '' })
const creatingTeam = ref(false)
const teamConfirm = ref<{ show: boolean; teamId: string }>({ show: false, teamId: '' })
const expandedTeam = ref<string | null>(null)
const teamMembers = ref<Record<string, TeamMember[]>>({})

async function loadTeams() {
  try {
    teams.value = await adminApi.getTeams()
  } catch (e: any) {
    toast.error(e.message || 'Failed to load teams')
  }
}

async function createTeam() {
  creatingTeam.value = true
  try {
    await adminApi.createTeam(teamForm.value.name, teamForm.value.description || undefined)
    toast.success('Team created')
    showCreateTeam.value = false
    teamForm.value = { name: '', description: '' }
    await loadTeams()
  } catch (e: any) {
    toast.error(e.message || 'Failed to create team')
  } finally {
    creatingTeam.value = false
  }
}

function promptDeleteTeam(teamId: string) {
  teamConfirm.value = { show: true, teamId }
}

async function confirmDeleteTeam() {
  const teamId = teamConfirm.value.teamId
  teamConfirm.value = { show: false, teamId: '' }
  try {
    await adminApi.deleteTeam(teamId)
    toast.success('Team deleted')
    await loadTeams()
  } catch (e: any) {
    toast.error(e.message || 'Failed to delete team')
  }
}

async function toggleTeamMembers(teamId: string) {
  if (expandedTeam.value === teamId) {
    expandedTeam.value = null
    return
  }
  expandedTeam.value = teamId
  if (!teamMembers.value[teamId]) {
    try {
      teamMembers.value[teamId] = await adminApi.getTeamMembers(teamId)
    } catch {
      teamMembers.value[teamId] = []
    }
  }
}

// ============================================================================
// Roles
// ============================================================================

async function loadRoles() {
  try {
    roles.value = await adminApi.getRoles()
  } catch (e: any) {
    toast.error(e.message || 'Failed to load roles')
  }
}

// ============================================================================
// Audit Logs
// ============================================================================

const auditLoading = ref(false)
const auditLogType = ref<'audit' | 'activity'>('audit')

async function loadAuditLogs(page = 1) {
  auditLoading.value = true
  auditPage.value = page
  try {
    if (auditLogType.value === 'audit') {
      const result = await adminApi.getAuditLogs({ page, limit: 25 })
      auditLogs.value = result.logs
      auditTotal.value = result.total
    } else {
      const result = await adminApi.getActivityLogs({ page, limit: 25 })
      activityLogs.value = result.logs
      auditTotal.value = result.total
    }
  } catch (e: any) {
    toast.error(e.message || 'Failed to load logs')
  } finally {
    auditLoading.value = false
  }
}

const auditTotalPages = computed(() => Math.ceil(auditTotal.value / 25) || 1)

function switchLogType(type: 'audit' | 'activity') {
  auditLogType.value = type
  loadAuditLogs(1)
}

// ============================================================================
// Helpers
// ============================================================================

const roleOptions = ['readonly', 'member', 'manager', 'admin', 'owner']

function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    owner: 'badge-accent',
    admin: 'badge-warning',
    manager: 'badge-info',
    member: 'badge-default',
    readonly: 'badge-muted',
  }
  return map[role] || 'badge-default'
}

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ============================================================================
// Init
// ============================================================================

onMounted(async () => {
  await loadOrg()
  loading.value = false
})

async function onTabChange(key: string) {
  activeTab.value = key
  if (key === 'members' && members.value.length === 0) await loadMembers()
  if (key === 'teams' && teams.value.length === 0) await loadTeams()
  if (key === 'roles' && roles.value.length === 0) await loadRoles()
  if (key === 'audit' && auditLogs.value.length === 0) await loadAuditLogs()
}
</script>

<template>
  <MainLayout>
    <PageHeader title="Admin" subtitle="Manage your organization, team, and permissions" />

    <AppTabs :tabs="tabs" :model-value="activeTab" @update:model-value="onTabChange" />

    <div class="mt-6">
      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <Skeleton variant="card" :count="2" />
      </div>

      <!-- ================================================================ -->
      <!-- Organization Tab -->
      <!-- ================================================================ -->
      <div v-else-if="activeTab === 'org'">
        <div class="bg-bg-card border border-border rounded-xl p-6 max-w-xl">
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

      <!-- ================================================================ -->
      <!-- Members Tab -->
      <!-- ================================================================ -->
      <div v-else-if="activeTab === 'members'">
        <div class="flex justify-between items-center mb-4">
          <p class="text-sm text-text-muted">{{ members.length }} member{{ members.length !== 1 ? 's' : '' }}</p>
          <button class="btn-primary btn-sm" @click="showAddMember = true">
            <UserPlus :size="15" /> Add Member
          </button>
        </div>

        <div v-if="members.length === 0" class="bg-bg-card border border-border rounded-xl">
          <EmptyState :icon="Users" title="No members" description="Add your first team member" />
        </div>

        <div v-else class="bg-bg-card border border-border rounded-xl">
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
      </div>

      <!-- ================================================================ -->
      <!-- Teams Tab -->
      <!-- ================================================================ -->
      <div v-else-if="activeTab === 'teams'">
        <div class="flex justify-between items-center mb-4">
          <p class="text-sm text-text-muted">{{ teams.length }} team{{ teams.length !== 1 ? 's' : '' }}</p>
          <button class="btn-primary btn-sm" @click="showCreateTeam = true">
            <Plus :size="15" /> Create Team
          </button>
        </div>

        <div v-if="teams.length === 0" class="bg-bg-card border border-border rounded-xl">
          <EmptyState :icon="UsersRound" title="No teams yet" description="Create teams to organize your members" />
        </div>

        <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4">
          <div v-for="team in teams" :key="team.id" class="bg-bg-card border border-border rounded-xl p-5">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h3 class="text-[15px] font-semibold text-text-primary">{{ team.name }}</h3>
                <p v-if="team.description" class="text-sm text-text-muted mt-0.5">{{ team.description }}</p>
              </div>
              <div class="flex items-center gap-1">
                <button class="btn-ghost btn-sm text-danger" @click="promptDeleteTeam(team.id)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <div class="flex items-center gap-3 text-sm text-text-muted mb-3">
              <span class="flex items-center gap-1">
                <Users :size="14" /> {{ team.member_count || 0 }} member{{ (team.member_count || 0) !== 1 ? 's' : '' }}
              </span>
              <span>Created {{ formatDate(team.created_at) }}</span>
            </div>

            <button
              class="btn-ghost btn-sm w-full justify-center"
              @click="toggleTeamMembers(team.id)"
            >
              {{ expandedTeam === team.id ? 'Hide Members' : 'Show Members' }}
            </button>

            <div v-if="expandedTeam === team.id" class="mt-3 border-t border-border pt-3">
              <div v-if="!teamMembers[team.id]?.length" class="text-sm text-text-muted text-center py-2">
                No members
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="tm in teamMembers[team.id]"
                  :key="tm.id"
                  class="flex items-center justify-between p-2 rounded-lg bg-bg-tertiary"
                >
                  <div>
                    <span class="text-sm font-medium text-text-primary">{{ tm.name || tm.email }}</span>
                    <span class="badge-sm badge-default ml-2">{{ tm.role }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Create Team Modal -->
        <Modal :show="showCreateTeam" title="Create Team" size="sm" @close="showCreateTeam = false">
          <form id="create-team-form" @submit.prevent="createTeam">
            <div class="form-group">
              <label class="form-label">Team Name *</label>
              <input v-model="teamForm.name" type="text" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <input v-model="teamForm.description" type="text" class="form-input" />
            </div>
          </form>
          <template #footer>
            <button class="btn-ghost" @click="showCreateTeam = false">Cancel</button>
            <button type="submit" form="create-team-form" class="btn-primary" :disabled="creatingTeam">
              <Loader2 v-if="creatingTeam" :size="16" class="spin" />
              Create
            </button>
          </template>
        </Modal>
      </div>

      <!-- ================================================================ -->
      <!-- Roles Tab -->
      <!-- ================================================================ -->
      <div v-else-if="activeTab === 'roles'">
        <div v-if="roles.length === 0" class="bg-bg-card border border-border rounded-xl">
          <EmptyState :icon="Shield" title="No roles defined" description="System roles are created during setup" />
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="role in roles"
            :key="role.id"
            class="bg-bg-card border border-border rounded-xl p-5"
          >
            <div class="flex items-center gap-3 mb-3">
              <div class="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Shield :size="18" class="text-accent" />
              </div>
              <div>
                <h3 class="text-[15px] font-semibold text-text-primary">{{ role.name }}</h3>
                <p v-if="role.description" class="text-sm text-text-muted">{{ role.description }}</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="perm in role.permissions.slice(0, 12)"
                :key="perm"
                class="text-xs px-2 py-0.5 rounded-md bg-bg-tertiary text-text-muted font-mono"
              >
                {{ perm }}
              </span>
              <span
                v-if="role.permissions.length > 12"
                class="text-xs px-2 py-0.5 rounded-md bg-bg-tertiary text-text-muted"
              >
                +{{ role.permissions.length - 12 }} more
              </span>
              <span
                v-if="role.permissions.includes('*')"
                class="text-xs px-2 py-0.5 rounded-md bg-accent/10 text-accent font-semibold"
              >
                Full Access
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Audit Logs Tab -->
      <!-- ================================================================ -->
      <div v-else-if="activeTab === 'audit'">
        <div class="flex items-center gap-4 mb-4">
          <div class="flex bg-bg-tertiary rounded-lg p-0.5">
            <button
              :class="[
                'px-3 py-1.5 text-sm rounded-md transition-all',
                auditLogType === 'audit' ? 'bg-bg-card text-text-primary font-medium shadow-xs' : 'text-text-muted hover:text-text-primary'
              ]"
              @click="switchLogType('audit')"
            >
              Audit Logs
            </button>
            <button
              :class="[
                'px-3 py-1.5 text-sm rounded-md transition-all',
                auditLogType === 'activity' ? 'bg-bg-card text-text-primary font-medium shadow-xs' : 'text-text-muted hover:text-text-primary'
              ]"
              @click="switchLogType('activity')"
            >
              Activity
            </button>
          </div>
          <span class="text-sm text-text-muted">{{ auditTotal }} total</span>
        </div>

        <div v-if="auditLoading" class="space-y-2">
          <Skeleton variant="text" :count="8" />
        </div>

        <div v-else-if="(auditLogType === 'audit' ? auditLogs : activityLogs).length === 0" class="bg-bg-card border border-border rounded-xl">
          <EmptyState :icon="ScrollText" title="No logs yet" description="Actions will appear here as your team works" />
        </div>

        <div v-else class="bg-bg-card border border-border rounded-xl">
          <!-- Audit Logs Table -->
          <table v-if="auditLogType === 'audit'" class="data-table w-full">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Actor</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in auditLogs" :key="log.id">
                <td>
                  <span class="text-sm font-mono text-text-primary">{{ log.action }}</span>
                </td>
                <td class="text-sm text-text-muted">{{ log.entity_type }}{{ log.entity_id ? `: ${log.entity_id.substring(0, 16)}...` : '' }}</td>
                <td class="text-sm text-text-muted">{{ log.actor_email || log.actor_id.substring(0, 12) }}</td>
                <td class="text-sm text-text-muted">{{ formatDate(log.created_at) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Activity Logs Table -->
          <table v-else class="data-table w-full">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Description</th>
                <th scope="col">Actor</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in activityLogs" :key="log.id">
                <td>
                  <span class="text-sm font-mono text-text-primary">{{ log.action }}</span>
                </td>
                <td class="text-sm text-text-muted">{{ log.description }}</td>
                <td class="text-sm text-text-muted">{{ log.actor_email || log.actor_id.substring(0, 12) }}</td>
                <td class="text-sm text-text-muted">{{ formatDate(log.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="auditTotalPages > 1" class="flex items-center justify-center gap-2 mt-4">
          <button
            class="btn-ghost btn-sm"
            :disabled="auditPage <= 1"
            @click="loadAuditLogs(auditPage - 1)"
          >
            <ChevronLeft :size="16" />
          </button>
          <span class="text-sm text-text-muted">Page {{ auditPage }} of {{ auditTotalPages }}</span>
          <button
            class="btn-ghost btn-sm"
            :disabled="auditPage >= auditTotalPages"
            @click="loadAuditLogs(auditPage + 1)"
          >
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Dialogs -->
    <ConfirmDialog
      :show="memberConfirm.show"
      title="Remove Member"
      message="Are you sure you want to remove this member from the organization?"
      confirm-text="Remove"
      variant="danger"
      @confirm="confirmRemoveMember"
      @cancel="memberConfirm = { show: false, userId: '' }"
    />
    <ConfirmDialog
      :show="teamConfirm.show"
      title="Delete Team"
      message="Are you sure you want to delete this team? All team memberships will be removed."
      confirm-text="Delete"
      variant="danger"
      @confirm="confirmDeleteTeam"
      @cancel="teamConfirm = { show: false, teamId: '' }"
    />
  </MainLayout>
</template>
