<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MainLayout from '../components/layout/MainLayout.vue'
import ContactFormModal from '../components/contacts/ContactFormModal.vue'
import ImportModal from '../components/contacts/ImportModal.vue'
import ContactFilters from '../components/contacts/ContactFilters.vue'
import ValidateModal from '../components/contacts/ValidateModal.vue'
import ListFormModal from '../components/contacts/ListFormModal.vue'
import BulkActionsModal from '../components/contacts/BulkActionsModal.vue'
import ContactsTable from '../components/contacts/ContactsTable.vue'
import { useToast } from '../composables/useToast'
import {
  useContactLists,
  useCreateContactList,
  useUpdateContactList,
  useDeleteContactList,
  useContacts,
  useAddContact,
  useUpdateContact,
  useBulkDeleteContacts,
  useBulkTagContacts,
  useBulkMoveContacts,
  useImportContacts,
  useValidateEmails,
} from '../lib/query'
import type { Contact, ContactInput, ContactList } from '../lib/api'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  Tag,
  FolderInput,
  Shield,
} from 'lucide-vue-next'

const activeListId = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const selectedIds = ref<string[]>([])

// Modals
const showNewListModal = ref(false)
const showEditListModal = ref(false)
const showAddContactModal = ref(false)
const showEditContactModal = ref(false)
const showImportModal = ref(false)
const showBulkTagModal = ref(false)
const showBulkMoveModal = ref(false)
const showValidateModal = ref(false)

// Forms
const editListData = ref({ id: '', name: '', description: '' })
const editContactData = ref<{ id: string } & Partial<ContactInput> & { status?: string }>({ id: '', email: '' })

// Toast
const toast = useToast()

// Validate modal ref
const validateModalRef = ref<InstanceType<typeof ValidateModal> | null>(null)

const { data: lists, isLoading: listsLoading } = useContactLists()

const contactFilters = computed(() => ({
  search: searchQuery.value || undefined,
  page: currentPage.value,
  limit: 50,
}))

const { data: contactsData, isLoading: contactsLoading } = useContacts(activeListId, contactFilters)

const contacts = computed(() => contactsData.value?.contacts || [])
const pagination = computed(() => contactsData.value?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })

const createListMutation = useCreateContactList()
const updateListMutation = useUpdateContactList()
const deleteListMutation = useDeleteContactList()
const addContactMutation = useAddContact()
const updateContactMutation = useUpdateContact()
const bulkDeleteMutation = useBulkDeleteContacts()
const bulkTagMutation = useBulkTagContacts()
const bulkMoveMutation = useBulkMoveContacts()
const importMutation = useImportContacts()
const validateMutation = useValidateEmails()

// Auto-select first list
watch(
  lists,
  (val) => {
    if (val && val.length > 0 && !activeListId.value && val[0]) {
      activeListId.value = val[0].id
    }
  },
  { immediate: true }
)

// Reset page when list changes
watch(activeListId, () => {
  currentPage.value = 1
  selectedIds.value = []
})

async function handleCreateList(data: { name: string; description: string }) {
  if (!data.name.trim()) return
  try {
    await createListMutation.mutateAsync({ name: data.name, description: data.description || undefined })
    toast.success('List created')
    showNewListModal.value = false
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleUpdateList(data: { id?: string; name: string; description: string }) {
  if (!data.name.trim() || !data.id) return
  try {
    await updateListMutation.mutateAsync({ id: data.id, name: data.name, description: data.description || undefined })
    toast.success('List updated')
    showEditListModal.value = false
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleDeleteList(list: ContactList) {
  if (!confirm(`Delete "${list.name}" and all its contacts?`)) return
  try {
    await deleteListMutation.mutateAsync(list.id)
    toast.success('List deleted')
    if (activeListId.value === list.id) activeListId.value = ''
  } catch (e: any) {
    toast.error(e.message)
  }
}

function openEditList(list: ContactList) {
  editListData.value = { id: list.id, name: list.name, description: list.description || '' }
  showEditListModal.value = true
}

async function handleAddContact(data: { id?: string } & Partial<ContactInput>) {
  if (!data.email?.trim()) return
  try {
    await addContactMutation.mutateAsync({
      listId: activeListId.value,
      contact: {
        email: data.email || '',
        first_name: data.first_name,
        last_name: data.last_name,
        company: data.company,
        phone: data.phone,
      },
    })
    toast.success('Contact added')
    showAddContactModal.value = false
  } catch (e: any) {
    toast.error(e.message)
  }
}

function openEditContact(contact: Contact) {
  editContactData.value = {
    id: contact.id,
    email: contact.email,
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    company: contact.company || '',
    phone: contact.phone || '',
    status: contact.status,
  }
  showEditContactModal.value = true
}

async function handleUpdateContact(data: { id?: string } & Partial<ContactInput> & { status?: string }) {
  if (!data.id) return
  const { id, ...updates } = data
  try {
    await updateContactMutation.mutateAsync({ id, updates })
    toast.success('Contact updated')
    showEditContactModal.value = false
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleBulkDelete() {
  if (!selectedIds.value.length || !confirm(`Delete ${selectedIds.value.length} contact(s)?`)) return
  try {
    const deleted = await bulkDeleteMutation.mutateAsync(selectedIds.value)
    toast.success(`${deleted} contact(s) deleted`)
    selectedIds.value = []
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleBulkTag(tags: string[]) {
  if (!tags.length || !selectedIds.value.length) return
  try {
    const updated = await bulkTagMutation.mutateAsync({ ids: selectedIds.value, tags })
    toast.success(`${updated} contact(s) tagged`)
    showBulkTagModal.value = false
    selectedIds.value = []
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleBulkMove(targetListId: string) {
  if (!targetListId || !selectedIds.value.length) return
  try {
    const moved = await bulkMoveMutation.mutateAsync({ ids: selectedIds.value, targetListId })
    toast.success(`${moved} contact(s) moved`)
    showBulkMoveModal.value = false
    selectedIds.value = []
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleImport(file: File) {
  try {
    const result = await importMutation.mutateAsync({ listId: activeListId.value, file })
    toast.success(`Imported ${result.imported} contacts (${result.duplicates} duplicates, ${result.invalid} invalid)`)
    showImportModal.value = false
  } catch (e: any) {
    toast.error(e.message)
  }
}

async function handleValidate(emails: string[]) {
  try {
    const results = await validateMutation.mutateAsync(emails)
    validateModalRef.value?.setResults(results)
  } catch (e: any) {
    toast.error(e.message)
  }
}

// Selection
function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function toggleSelectAll() {
  if (selectedIds.value.length === contacts.value.length) selectedIds.value = []
  else selectedIds.value = contacts.value.map((c) => c.id)
}
</script>

<template>
  <MainLayout>
    <div class="relative">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-text-primary">Contacts</h1>
        <div class="flex gap-2">
          <button
            class="btn-ghost inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
            @click="showValidateModal = true"
          >
            <Shield :size="16" /> Validate
          </button>
          <button
            class="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
            @click="showNewListModal = true"
          >
            <Plus :size="16" /> New List
          </button>
        </div>
      </div>

      <div class="flex max-md:flex-col gap-6 min-h-[calc(100vh-160px)]">
        <!-- Sidebar: Lists -->
        <div class="w-[260px] max-md:w-full shrink-0 bg-bg-secondary border border-border rounded-xl overflow-hidden">
          <div class="p-4 border-b border-border">
            <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider">Lists</h3>
          </div>
          <div
            v-if="listsLoading"
            class="flex flex-col items-center justify-center gap-3 py-12 px-4 text-text-muted text-center"
          >
            <Loader2 :size="20" class="animate-spin" />
          </div>
          <div
            v-else-if="!lists?.length"
            class="flex flex-col items-center justify-center gap-3 py-12 px-4 text-text-muted text-center"
          >
            <Users :size="32" />
            <p class="m-0">No lists yet</p>
          </div>
          <div v-else class="p-2">
            <div
              v-for="list in lists"
              :key="list.id"
              class="group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-150"
              :class="
                activeListId === list.id ? 'bg-accent/[0.12] border border-border-glow' : 'hover:bg-accent/[0.05]'
              "
              @click="activeListId = list.id"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="text-sm font-medium text-text-primary truncate">{{ list.name }}</span>
                <span class="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-[10px] shrink-0">{{
                  list.contact_count
                }}</span>
              </div>
              <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  class="bg-transparent border-none cursor-pointer p-1 text-text-muted rounded hover:bg-accent/10 hover:text-accent transition-all duration-150"
                  @click.stop="openEditList(list)"
                  title="Edit"
                >
                  <Pencil :size="14" />
                </button>
                <button
                  class="bg-transparent border-none cursor-pointer p-1 text-text-muted rounded hover:bg-red-500/10 hover:text-red-500 transition-all duration-150"
                  @click.stop="handleDeleteList(list)"
                  title="Delete"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main: Contacts -->
        <div class="flex-1 min-w-0">
          <template v-if="activeListId">
            <ContactFilters
              v-model:searchQuery="searchQuery"
              @search-input="currentPage = 1"
              @import="showImportModal = true"
              @add="showAddContactModal = true"
            />

            <!-- Bulk actions bar -->
            <div
              v-if="selectedIds.length > 0"
              class="flex items-center justify-between bg-accent/[0.08] border border-border-glow rounded-lg px-4 py-2 mb-3 text-sm text-accent"
            >
              <span>{{ selectedIds.length }} selected</span>
              <div class="flex gap-1.5">
                <button
                  class="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
                  @click="showBulkTagModal = true"
                >
                  <Tag :size="14" /> Tag
                </button>
                <button
                  class="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
                  @click="showBulkMoveModal = true"
                >
                  <FolderInput :size="14" /> Move
                </button>
                <button
                  class="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-500/[0.08] hover:border-red-500/30"
                  @click="handleBulkDelete"
                >
                  <Trash2 :size="14" /> Delete
                </button>
              </div>
            </div>

            <!-- Table -->
            <ContactsTable
              :contacts="contacts"
              :loading="contactsLoading"
              :selectedIds="selectedIds"
              @toggle-select="toggleSelect"
              @toggle-select-all="toggleSelectAll"
              @edit="openEditContact"
            />

            <!-- Pagination -->
            <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-3 mt-4">
              <button
                class="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
                :disabled="currentPage <= 1"
                @click="currentPage--"
              >
                <ChevronLeft :size="14" />
              </button>
              <span class="text-[13px] text-text-muted"
                >Page {{ currentPage }} of {{ pagination.totalPages }} ({{ pagination.total }} total)</span
              >
              <button
                class="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
                :disabled="currentPage >= pagination.totalPages"
                @click="currentPage++"
              >
                <ChevronRight :size="14" />
              </button>
            </div>
          </template>

          <div
            v-else
            class="flex flex-col items-center justify-center gap-3 py-12 px-4 text-text-muted text-center min-h-[400px]"
          >
            <Users :size="48" />
            <h3 class="text-text-primary m-0">Select a list</h3>
            <p class="text-text-muted text-[13px] m-0">Choose a contact list from the sidebar, or create a new one</p>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <ListFormModal
        :show="showNewListModal"
        mode="create"
        :saving="createListMutation.isPending.value"
        @close="showNewListModal = false"
        @save="handleCreateList"
      />
      <ListFormModal
        :show="showEditListModal"
        mode="edit"
        :listData="editListData"
        :saving="updateListMutation.isPending.value"
        @close="showEditListModal = false"
        @save="handleUpdateList"
      />
      <ContactFormModal
        :show="showAddContactModal"
        mode="create"
        :saving="addContactMutation.isPending.value"
        @close="showAddContactModal = false"
        @save="handleAddContact"
      />
      <ContactFormModal
        :show="showEditContactModal"
        mode="edit"
        :contact="editContactData"
        :saving="updateContactMutation.isPending.value"
        @close="showEditContactModal = false"
        @save="handleUpdateContact"
      />
      <ImportModal
        :show="showImportModal"
        :importing="importMutation.isPending.value"
        :importResult="importMutation.data.value ?? undefined"
        @close="showImportModal = false"
        @import="handleImport"
      />
      <BulkActionsModal
        :show="showBulkTagModal"
        mode="tag"
        :selectedCount="selectedIds.length"
        :saving="bulkTagMutation.isPending.value"
        @close="showBulkTagModal = false"
        @tag="handleBulkTag"
      />
      <BulkActionsModal
        :show="showBulkMoveModal"
        mode="move"
        :selectedCount="selectedIds.length"
        :lists="lists"
        :activeListId="activeListId"
        :saving="bulkMoveMutation.isPending.value"
        @close="showBulkMoveModal = false"
        @move="handleBulkMove"
      />
      <ValidateModal
        ref="validateModalRef"
        :show="showValidateModal"
        :validating="validateMutation.isPending.value"
        @close="showValidateModal = false"
        @validate="handleValidate"
      />
    </div>
  </MainLayout>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
