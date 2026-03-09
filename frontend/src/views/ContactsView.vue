<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppLayout from '../components/layout/AppLayout.vue'
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
  Plus, Pencil, Trash2, Search, Upload, X, Check, Loader2,
  Users, ChevronLeft, ChevronRight, Tag, FolderInput, CheckSquare,
  Square, Mail, Shield, AlertTriangle
} from 'lucide-vue-next'

// ============================================================================
// State
// ============================================================================

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
const listForm = ref({ name: '', description: '' })
const editListForm = ref({ id: '', name: '', description: '' })
const contactForm = ref<ContactInput>({ email: '', first_name: '', last_name: '', company: '', phone: '' })
const editContactForm = ref<{ id: string } & Partial<ContactInput>>({ id: '', email: '' })
const importFile = ref<File | null>(null)
const bulkTagInput = ref('')
const bulkMoveTarget = ref('')

// Toast
const toast = ref<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 4000)
}

// ============================================================================
// Queries
// ============================================================================

const { data: lists, isLoading: listsLoading } = useContactLists()

const contactFilters = computed(() => ({
  search: searchQuery.value || undefined,
  page: currentPage.value,
  limit: 50,
}))

const { data: contactsData, isLoading: contactsLoading } = useContacts(activeListId, contactFilters)

const contacts = computed(() => contactsData.value?.contacts || [])
const pagination = computed(() => contactsData.value?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })

// ============================================================================
// Mutations
// ============================================================================

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
watch(lists, (val) => {
  if (val && val.length > 0 && !activeListId.value && val[0]) {
    activeListId.value = val[0].id
  }
}, { immediate: true })

// Reset page when list changes
watch(activeListId, () => {
  currentPage.value = 1
  selectedIds.value = []
})

// ============================================================================
// Handlers
// ============================================================================

async function handleCreateList() {
  if (!listForm.value.name.trim()) return
  try {
    await createListMutation.mutateAsync({ name: listForm.value.name, description: listForm.value.description || undefined })
    showToast('List created')
    showNewListModal.value = false
    listForm.value = { name: '', description: '' }
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

async function handleUpdateList() {
  if (!editListForm.value.name.trim()) return
  try {
    await updateListMutation.mutateAsync({ id: editListForm.value.id, name: editListForm.value.name, description: editListForm.value.description || undefined })
    showToast('List updated')
    showEditListModal.value = false
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

async function handleDeleteList(list: ContactList) {
  if (!confirm(`Delete "${list.name}" and all its contacts?`)) return
  try {
    await deleteListMutation.mutateAsync(list.id)
    showToast('List deleted')
    if (activeListId.value === list.id) activeListId.value = ''
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

function openEditList(list: ContactList) {
  editListForm.value = { id: list.id, name: list.name, description: list.description || '' }
  showEditListModal.value = true
}

async function handleAddContact() {
  if (!contactForm.value.email.trim()) return
  try {
    await addContactMutation.mutateAsync({ listId: activeListId.value, contact: contactForm.value })
    showToast('Contact added')
    showAddContactModal.value = false
    contactForm.value = { email: '', first_name: '', last_name: '', company: '', phone: '' }
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

function openEditContact(contact: Contact) {
  editContactForm.value = {
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

async function handleUpdateContact() {
  const { id, ...updates } = editContactForm.value
  try {
    await updateContactMutation.mutateAsync({ id, updates })
    showToast('Contact updated')
    showEditContactModal.value = false
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

async function handleBulkDelete() {
  if (!selectedIds.value.length) return
  if (!confirm(`Delete ${selectedIds.value.length} contact(s)?`)) return
  try {
    const deleted = await bulkDeleteMutation.mutateAsync(selectedIds.value)
    showToast(`${deleted} contact(s) deleted`)
    selectedIds.value = []
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

async function handleBulkTag() {
  const tags = bulkTagInput.value.split(',').map(t => t.trim()).filter(Boolean)
  if (!tags.length || !selectedIds.value.length) return
  try {
    const updated = await bulkTagMutation.mutateAsync({ ids: selectedIds.value, tags })
    showToast(`${updated} contact(s) tagged`)
    showBulkTagModal.value = false
    bulkTagInput.value = ''
    selectedIds.value = []
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

async function handleBulkMove() {
  if (!bulkMoveTarget.value || !selectedIds.value.length) return
  try {
    const moved = await bulkMoveMutation.mutateAsync({ ids: selectedIds.value, targetListId: bulkMoveTarget.value })
    showToast(`${moved} contact(s) moved`)
    showBulkMoveModal.value = false
    bulkMoveTarget.value = ''
    selectedIds.value = []
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

async function handleImport() {
  if (!importFile.value) return
  try {
    const result = await importMutation.mutateAsync({ listId: activeListId.value, file: importFile.value })
    showToast(`Imported ${result.imported} contacts (${result.duplicates} duplicates, ${result.invalid} invalid)`)
    showImportModal.value = false
    importFile.value = null
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  importFile.value = input.files?.[0] || null
}

// Validation
const validationEmails = ref('')
const validationResults = ref<any>(null)

async function handleValidate() {
  const emails = validationEmails.value.split('\n').map(e => e.trim()).filter(Boolean)
  if (!emails.length) return
  try {
    validationResults.value = await validateMutation.mutateAsync(emails)
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

// Selection
function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function toggleSelectAll() {
  if (selectedIds.value.length === contacts.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = contacts.value.map(c => c.id)
  }
}

const allSelected = computed(() => contacts.value.length > 0 && selectedIds.value.length === contacts.value.length)

function parseTags(tagsJson: string): string[] {
  try { return JSON.parse(tagsJson) } catch { return [] }
}
</script>

<template>
  <AppLayout>
    <div class="contacts-page">
      <!-- Toast -->
      <Transition name="toast">
        <div v-if="toast.show" class="toast" :class="toast.type">
          {{ toast.message }}
        </div>
      </Transition>

      <div class="page-header">
        <h1>Contacts</h1>
        <div class="header-actions">
          <button class="btn btn-ghost" @click="showValidateModal = true">
            <Shield :size="16" />
            Validate
          </button>
          <button class="btn btn-primary" @click="showNewListModal = true">
            <Plus :size="16" />
            New List
          </button>
        </div>
      </div>

      <div class="contacts-layout">
        <!-- Sidebar: Lists -->
        <div class="lists-panel">
          <div class="panel-header">
            <h3>Lists</h3>
          </div>
          <div v-if="listsLoading" class="loading-state">
            <Loader2 :size="20" class="spin" />
          </div>
          <div v-else-if="!lists?.length" class="empty-state">
            <Users :size="32" />
            <p>No lists yet</p>
          </div>
          <div v-else class="list-items">
            <div
              v-for="list in lists"
              :key="list.id"
              class="list-item"
              :class="{ active: activeListId === list.id }"
              @click="activeListId = list.id"
            >
              <div class="list-info">
                <span class="list-name">{{ list.name }}</span>
                <span class="list-count">{{ list.contact_count }}</span>
              </div>
              <div class="list-actions">
                <button class="btn-icon" @click.stop="openEditList(list)" title="Edit">
                  <Pencil :size="14" />
                </button>
                <button class="btn-icon danger" @click.stop="handleDeleteList(list)" title="Delete">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main: Contacts -->
        <div class="contacts-panel">
          <template v-if="activeListId">
            <!-- Toolbar -->
            <div class="contacts-toolbar">
              <div class="toolbar-left">
                <div class="search-box">
                  <Search :size="16" />
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search contacts..."
                    @input="currentPage = 1"
                  />
                </div>
              </div>
              <div class="toolbar-right">
                <button class="btn btn-ghost btn-sm" @click="showImportModal = true">
                  <Upload :size="14" />
                  Import
                </button>
                <button class="btn btn-primary btn-sm" @click="showAddContactModal = true">
                  <Plus :size="14" />
                  Add
                </button>
              </div>
            </div>

            <!-- Bulk actions bar -->
            <div v-if="selectedIds.length > 0" class="bulk-bar">
              <span>{{ selectedIds.length }} selected</span>
              <div class="bulk-actions">
                <button class="btn btn-ghost btn-sm" @click="showBulkTagModal = true">
                  <Tag :size="14" />
                  Tag
                </button>
                <button class="btn btn-ghost btn-sm" @click="showBulkMoveModal = true">
                  <FolderInput :size="14" />
                  Move
                </button>
                <button class="btn btn-ghost btn-sm danger" @click="handleBulkDelete">
                  <Trash2 :size="14" />
                  Delete
                </button>
              </div>
            </div>

            <!-- Table -->
            <div v-if="contactsLoading" class="loading-state">
              <Loader2 :size="24" class="spin" />
              <span>Loading contacts...</span>
            </div>
            <div v-else-if="!contacts.length" class="empty-state">
              <Mail :size="40" />
              <p>No contacts in this list</p>
              <p class="text-muted">Add contacts manually or import from a file</p>
            </div>
            <div v-else class="contacts-table-wrapper">
              <table class="contacts-table">
                <thead>
                  <tr>
                    <th class="col-check">
                      <button class="btn-icon" @click="toggleSelectAll">
                        <CheckSquare v-if="allSelected" :size="16" />
                        <Square v-else :size="16" />
                      </button>
                    </th>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Tags</th>
                    <th class="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="contact in contacts" :key="contact.id" :class="{ selected: selectedIds.includes(contact.id) }">
                    <td class="col-check">
                      <button class="btn-icon" @click="toggleSelect(contact.id)">
                        <CheckSquare v-if="selectedIds.includes(contact.id)" :size="16" />
                        <Square v-else :size="16" />
                      </button>
                    </td>
                    <td class="email-cell">{{ contact.email }}</td>
                    <td>{{ [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '-' }}</td>
                    <td>{{ contact.company || '-' }}</td>
                    <td>
                      <span class="status-badge" :class="contact.status">{{ contact.status }}</span>
                    </td>
                    <td>
                      <span v-for="tag in parseTags(contact.tags)" :key="tag" class="tag-badge">{{ tag }}</span>
                      <span v-if="!parseTags(contact.tags).length" class="text-muted">-</span>
                    </td>
                    <td class="col-actions">
                      <button class="btn-icon" @click="openEditContact(contact)" title="Edit">
                        <Pencil :size="14" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div v-if="pagination.totalPages > 1" class="pagination">
              <button class="btn btn-ghost btn-sm" :disabled="currentPage <= 1" @click="currentPage--">
                <ChevronLeft :size="14" />
              </button>
              <span class="page-info">Page {{ currentPage }} of {{ pagination.totalPages }} ({{ pagination.total }} total)</span>
              <button class="btn btn-ghost btn-sm" :disabled="currentPage >= pagination.totalPages" @click="currentPage++">
                <ChevronRight :size="14" />
              </button>
            </div>
          </template>

          <div v-else class="empty-state full">
            <Users :size="48" />
            <h3>Select a list</h3>
            <p class="text-muted">Choose a contact list from the sidebar, or create a new one</p>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Modals -->
      <!-- ================================================================ -->

      <!-- New List Modal -->
      <Transition name="modal">
        <div v-if="showNewListModal" class="modal-overlay" @click.self="showNewListModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3>New Contact List</h3>
              <button class="btn-icon" @click="showNewListModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Name</label>
                <input v-model="listForm.name" type="text" placeholder="e.g. Newsletter Subscribers" />
              </div>
              <div class="form-group">
                <label>Description (optional)</label>
                <input v-model="listForm.description" type="text" placeholder="Brief description" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showNewListModal = false">Cancel</button>
              <button class="btn btn-primary" @click="handleCreateList" :disabled="createListMutation.isPending.value">
                <Loader2 v-if="createListMutation.isPending.value" :size="14" class="spin" />
                Create
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Edit List Modal -->
      <Transition name="modal">
        <div v-if="showEditListModal" class="modal-overlay" @click.self="showEditListModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3>Edit List</h3>
              <button class="btn-icon" @click="showEditListModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Name</label>
                <input v-model="editListForm.name" type="text" />
              </div>
              <div class="form-group">
                <label>Description</label>
                <input v-model="editListForm.description" type="text" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showEditListModal = false">Cancel</button>
              <button class="btn btn-primary" @click="handleUpdateList" :disabled="updateListMutation.isPending.value">
                Save
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Add Contact Modal -->
      <Transition name="modal">
        <div v-if="showAddContactModal" class="modal-overlay" @click.self="showAddContactModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3>Add Contact</h3>
              <button class="btn-icon" @click="showAddContactModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Email *</label>
                <input v-model="contactForm.email" type="email" placeholder="email@example.com" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>First Name</label>
                  <input v-model="contactForm.first_name" type="text" />
                </div>
                <div class="form-group">
                  <label>Last Name</label>
                  <input v-model="contactForm.last_name" type="text" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Company</label>
                  <input v-model="contactForm.company" type="text" />
                </div>
                <div class="form-group">
                  <label>Phone</label>
                  <input v-model="contactForm.phone" type="text" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showAddContactModal = false">Cancel</button>
              <button class="btn btn-primary" @click="handleAddContact" :disabled="addContactMutation.isPending.value">
                <Loader2 v-if="addContactMutation.isPending.value" :size="14" class="spin" />
                Add Contact
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Edit Contact Modal -->
      <Transition name="modal">
        <div v-if="showEditContactModal" class="modal-overlay" @click.self="showEditContactModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3>Edit Contact</h3>
              <button class="btn-icon" @click="showEditContactModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Email</label>
                <input v-model="editContactForm.email" type="email" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>First Name</label>
                  <input v-model="editContactForm.first_name" type="text" />
                </div>
                <div class="form-group">
                  <label>Last Name</label>
                  <input v-model="editContactForm.last_name" type="text" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Company</label>
                  <input v-model="editContactForm.company" type="text" />
                </div>
                <div class="form-group">
                  <label>Phone</label>
                  <input v-model="editContactForm.phone" type="text" />
                </div>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select v-model="editContactForm.status">
                  <option value="active">Active</option>
                  <option value="unsubscribed">Unsubscribed</option>
                  <option value="bounced">Bounced</option>
                  <option value="complained">Complained</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showEditContactModal = false">Cancel</button>
              <button class="btn btn-primary" @click="handleUpdateContact" :disabled="updateContactMutation.isPending.value">
                Save
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Import Modal -->
      <Transition name="modal">
        <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
          <div class="modal">
            <div class="modal-header">
              <h3>Import Contacts</h3>
              <button class="btn-icon" @click="showImportModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <p class="text-muted">Upload a CSV or Excel file. Columns will be auto-mapped (email, first_name, last_name, company, phone).</p>
              <div class="form-group">
                <label>File</label>
                <input type="file" accept=".csv,.xlsx,.xls" @change="onFileChange" />
              </div>
              <div v-if="importMutation.data.value" class="import-result">
                <p><strong>Import complete:</strong></p>
                <p>Imported: {{ importMutation.data.value.imported }} | Duplicates: {{ importMutation.data.value.duplicates }} | Invalid: {{ importMutation.data.value.invalid }}</p>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showImportModal = false">Cancel</button>
              <button class="btn btn-primary" @click="handleImport" :disabled="!importFile || importMutation.isPending.value">
                <Loader2 v-if="importMutation.isPending.value" :size="14" class="spin" />
                Import
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Bulk Tag Modal -->
      <Transition name="modal">
        <div v-if="showBulkTagModal" class="modal-overlay" @click.self="showBulkTagModal = false">
          <div class="modal modal-sm">
            <div class="modal-header">
              <h3>Tag {{ selectedIds.length }} Contact(s)</h3>
              <button class="btn-icon" @click="showBulkTagModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Tags (comma-separated)</label>
                <input v-model="bulkTagInput" type="text" placeholder="vip, newsletter, lead" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showBulkTagModal = false">Cancel</button>
              <button class="btn btn-primary" @click="handleBulkTag" :disabled="bulkTagMutation.isPending.value">Apply</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Bulk Move Modal -->
      <Transition name="modal">
        <div v-if="showBulkMoveModal" class="modal-overlay" @click.self="showBulkMoveModal = false">
          <div class="modal modal-sm">
            <div class="modal-header">
              <h3>Move {{ selectedIds.length }} Contact(s)</h3>
              <button class="btn-icon" @click="showBulkMoveModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Target List</label>
                <select v-model="bulkMoveTarget">
                  <option value="" disabled>Select list...</option>
                  <option v-for="list in lists" :key="list.id" :value="list.id" :disabled="list.id === activeListId">
                    {{ list.name }}
                  </option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showBulkMoveModal = false">Cancel</button>
              <button class="btn btn-primary" @click="handleBulkMove" :disabled="!bulkMoveTarget || bulkMoveMutation.isPending.value">Move</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Validate Modal -->
      <Transition name="modal">
        <div v-if="showValidateModal" class="modal-overlay" @click.self="showValidateModal = false">
          <div class="modal modal-lg">
            <div class="modal-header">
              <h3>Validate Emails</h3>
              <button class="btn-icon" @click="showValidateModal = false"><X :size="18" /></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Emails (one per line, max 100)</label>
                <textarea v-model="validationEmails" rows="6" placeholder="user1@example.com&#10;user2@example.com"></textarea>
              </div>
              <div v-if="validationResults" class="validation-results">
                <div class="validation-summary">
                  <span class="badge success">Valid: {{ validationResults.valid }}</span>
                  <span class="badge danger">Invalid: {{ validationResults.invalid }}</span>
                  <span class="badge warning">Risky: {{ validationResults.risky }}</span>
                </div>
                <div class="validation-list">
                  <div v-for="r in validationResults.results" :key="r.email" class="validation-item" :class="{ valid: r.valid, invalid: !r.valid }">
                    <Check v-if="r.valid" :size="14" />
                    <AlertTriangle v-else :size="14" />
                    <span class="val-email">{{ r.email }}</span>
                    <span class="val-score">{{ r.score }}/100</span>
                    <span v-if="r.reason" class="val-reason">{{ r.reason }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showValidateModal = false; validationResults = null; validationEmails = ''">Close</button>
              <button class="btn btn-primary" @click="handleValidate" :disabled="validateMutation.isPending.value">
                <Loader2 v-if="validateMutation.isPending.value" :size="14" class="spin" />
                Validate
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </AppLayout>
</template>

<style scoped lang="scss">
.contacts-page {
  position: relative;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.contacts-layout {
  display: flex;
  gap: 24px;
  min-height: calc(100vh - 160px);
}

// ============================================================================
// Lists Panel
// ============================================================================

.lists-panel {
  width: 260px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
}

.list-items {
  padding: 8px;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(6, 182, 212, 0.05);
  }

  &.active {
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid var(--border-glow);
  }

  .list-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .list-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .list-count {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .list-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  &:hover .list-actions {
    opacity: 1;
  }
}

// ============================================================================
// Contacts Panel
// ============================================================================

.contacts-panel {
  flex: 1;
  min-width: 0;
}

.contacts-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;

  .toolbar-left {
    flex: 1;
  }

  .toolbar-right {
    display: flex;
    gap: 8px;
  }
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  max-width: 360px;

  input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 14px;
  }

  svg {
    color: var(--text-muted);
  }
}

.bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid var(--border-glow);
  border-radius: var(--radius-md);
  padding: 8px 16px;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--accent-primary);

  .bulk-actions {
    display: flex;
    gap: 6px;
  }
}

// ============================================================================
// Table
// ============================================================================

.contacts-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.contacts-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 10px 14px;
    text-align: left;
    font-size: 13px;
    border-bottom: 1px solid var(--border-color);
  }

  th {
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tbody tr {
    transition: background 0.1s;

    &:hover {
      background: rgba(6, 182, 212, 0.03);
    }

    &.selected {
      background: rgba(6, 182, 212, 0.06);
    }

    &:last-child td {
      border-bottom: none;
    }
  }

  .col-check {
    width: 40px;
  }

  .col-actions {
    width: 60px;
    text-align: center;
  }

  .email-cell {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--accent-primary);
  }
}

.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  &.active { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
  &.unsubscribed { background: rgba(234, 179, 8, 0.15); color: #eab308; }
  &.bounced { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
  &.complained { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
}

.tag-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  margin-right: 4px;
}

// ============================================================================
// Pagination
// ============================================================================

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;

  .page-info {
    font-size: 13px;
    color: var(--text-muted);
  }
}

// ============================================================================
// States
// ============================================================================

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--text-muted);
  text-align: center;

  &.full {
    min-height: 400px;
  }

  h3 {
    color: var(--text-primary);
    margin: 0;
  }

  p {
    margin: 0;
  }
}

.text-muted {
  color: var(--text-muted);
  font-size: 13px;
}

// ============================================================================
// Modals
// ============================================================================

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;

  &.modal-sm { width: 380px; }
  &.modal-lg { width: 640px; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 16px;

  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  input, select, textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;

    &:focus {
      border-color: var(--accent-primary);
    }
  }

  textarea {
    resize: vertical;
    font-family: var(--font-mono);
  }
}

.form-row {
  display: flex;
  gap: 12px;

  .form-group {
    flex: 1;
  }
}

// ============================================================================
// Validation Results
// ============================================================================

.validation-results {
  margin-top: 16px;
}

.validation-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.badge {
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;

  &.success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
  &.danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
  &.warning { background: rgba(234, 179, 8, 0.15); color: #eab308; }
}

.validation-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.validation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);

  &:last-child { border-bottom: none; }

  &.valid svg { color: #22c55e; }
  &.invalid svg { color: #ef4444; }

  .val-email {
    font-family: var(--font-mono);
    flex: 1;
  }

  .val-score {
    color: var(--text-muted);
    font-size: 12px;
  }

  .val-reason {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
  }
}

.import-result {
  margin-top: 12px;
  padding: 12px;
  background: rgba(34, 197, 94, 0.08);
  border-radius: var(--radius-md);
  font-size: 13px;
}

// ============================================================================
// Buttons & Utilities
// ============================================================================

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  color: var(--bg-primary);

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: rgba(6, 182, 212, 0.08);
    border-color: var(--border-glow);
    color: var(--text-primary);
  }

  &.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition: all 0.15s;

  &:hover {
    background: rgba(6, 182, 212, 0.1);
    color: var(--accent-primary);
  }

  &.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// ============================================================================
// Transitions
// ============================================================================

.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  z-index: 2000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);

  &.success {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  &.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
}

.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;

  .modal {
    transform: scale(0.95);
  }
}

// ============================================================================
// Responsive
// ============================================================================

@media (max-width: 768px) {
  .contacts-layout {
    flex-direction: column;
  }

  .lists-panel {
    width: 100%;
  }

  .form-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>
