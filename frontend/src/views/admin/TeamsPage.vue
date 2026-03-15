<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminApi } from '../../lib/api/admin'
import type { Team, TeamMember } from '../../lib/api/admin'
import { useToast } from '../../composables/useToast'
import Modal from '../../components/ui/Modal.vue'
import ConfirmDialog from '../../components/ui/ConfirmDialog.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import { UsersRound, Users, Plus, Trash2, Loader2 } from 'lucide-vue-next'

const toast = useToast()
const loading = ref(true)
const teams = ref<Team[]>([])
const showCreateTeam = ref(false)
const teamForm = ref({ name: '', description: '' })
const creatingTeam = ref(false)
const teamConfirm = ref<{ show: boolean; teamId: string }>({ show: false, teamId: '' })
const expandedTeam = ref<string | null>(null)
const teamMembers = ref<Record<string, TeamMember[]>>({})

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

async function loadTeams() {
  try {
    teams.value = await adminApi.getTeams()
  } catch (e: any) {
    toast.error(e.message || 'Failed to load teams')
  } finally {
    loading.value = false
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

onMounted(loadTeams)
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-4">
      <Skeleton variant="card" :count="2" />
    </div>

    <template v-else>
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
            <button class="btn-ghost btn-sm text-danger" @click="promptDeleteTeam(team.id)">
              <Trash2 :size="14" />
            </button>
          </div>

          <div class="flex items-center gap-3 text-sm text-text-muted mb-3">
            <span class="flex items-center gap-1">
              <Users :size="14" /> {{ team.member_count || 0 }} member{{ (team.member_count || 0) !== 1 ? 's' : '' }}
            </span>
            <span>Created {{ formatDate(team.created_at) }}</span>
          </div>

          <button class="btn-ghost btn-sm w-full justify-center" @click="toggleTeamMembers(team.id)">
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

      <ConfirmDialog
        :show="teamConfirm.show"
        title="Delete Team"
        message="Are you sure you want to delete this team? All team memberships will be removed."
        confirm-text="Delete"
        variant="danger"
        @confirm="confirmDeleteTeam"
        @cancel="teamConfirm = { show: false, teamId: '' }"
      />
    </template>
  </div>
</template>
