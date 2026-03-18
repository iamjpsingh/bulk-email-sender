<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminApi, type SendingDomain, type DnsRecord, type SendingEmailRecord } from '../../lib/api/admin'
import { useToast } from '../../composables/useToast'
import Modal from '../../components/ui/Modal.vue'
import {
  Globe, Plus, Trash2, Check, Copy, Loader2, Shield, ShieldCheck, ShieldAlert,
  Mail, UserPlus, AlertCircle,
} from 'lucide-vue-next'

const toast = useToast()

const loading = ref(true)
const domains = ref<SendingDomain[]>([])
const emails = ref<SendingEmailRecord[]>([])

// Add domain
const showAddDomain = ref(false)
const newDomain = ref('')
const addingDomain = ref(false)
const dnsRecords = ref<DnsRecord[]>([])
const showDnsModal = ref(false)
const dnsDomainName = ref('')

// Add email
const showAddEmail = ref(false)
const newEmailDomainId = ref('')
const newEmailAddress = ref('')
const newEmailDisplayName = ref('')
const addingEmail = ref(false)

async function loadData() {
  loading.value = true
  try {
    const [d, e] = await Promise.all([adminApi.getDomains(), adminApi.getSendingEmails()])
    domains.value = d
    emails.value = e
  } catch (e: any) { toast.error(e.message) }
  finally { loading.value = false }
}

async function addDomain() {
  if (!newDomain.value.trim()) return
  addingDomain.value = true
  try {
    const result = await adminApi.addDomain(newDomain.value.trim())
    domains.value.unshift(result.domain)
    dnsRecords.value = result.dnsRecords
    dnsDomainName.value = result.domain.domain
    showAddDomain.value = false
    newDomain.value = ''
    showDnsModal.value = true
  } catch (e: any) { toast.error(e.message) }
  finally { addingDomain.value = false }
}

async function viewDns(domain: SendingDomain) {
  try {
    const records = await adminApi.getDnsRecords(domain.id)
    dnsRecords.value = records
    dnsDomainName.value = domain.domain
    showDnsModal.value = true
  } catch (e: any) { toast.error(e.message) }
}

async function verifyDomain(domain: SendingDomain) {
  try {
    await adminApi.verifyDomain(domain.id)
    toast.success(`${domain.domain} verified`)
    loadData()
  } catch (e: any) { toast.error(e.message) }
}

async function deleteDomain(domain: SendingDomain) {
  if (!confirm(`Delete ${domain.domain} and all its sending emails?`)) return
  try {
    await adminApi.deleteDomain(domain.id)
    toast.success('Domain deleted')
    loadData()
  } catch (e: any) { toast.error(e.message) }
}

async function addEmail() {
  if (!newEmailDomainId.value || !newEmailAddress.value.trim()) return
  addingEmail.value = true
  try {
    await adminApi.addSendingEmail(newEmailDomainId.value, newEmailAddress.value.trim(), newEmailDisplayName.value.trim() || undefined)
    toast.success('Sending email added')
    showAddEmail.value = false
    newEmailAddress.value = ''
    newEmailDisplayName.value = ''
    loadData()
  } catch (e: any) { toast.error(e.message) }
  finally { addingEmail.value = false }
}

async function deleteEmail(emailId: string) {
  try {
    await adminApi.deleteSendingEmail(emailId)
    toast.success('Sending email removed')
    loadData()
  } catch (e: any) { toast.error(e.message) }
}

async function setDefault(emailId: string) {
  try {
    await adminApi.updateSendingEmail(emailId, { is_default: true })
    toast.success('Default email updated')
    loadData()
  } catch (e: any) { toast.error(e.message) }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('Copied')
}

function domainEmails(domainId: string): SendingEmailRecord[] {
  return emails.value.filter(e => e.domain_id === domainId)
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-text-primary">Sending Domains</h2>
        <p class="text-sm text-text-muted mt-1">Add your domains, configure DNS, and create sending email addresses.</p>
      </div>
      <button class="btn-primary text-sm" @click="showAddDomain = true"><Plus :size="14" /> Add Domain</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12"><Loader2 :size="20" class="animate-spin text-text-muted" /></div>

    <div v-else-if="domains.length === 0" class="bg-surface-1 border border-border rounded-xl p-8 text-center">
      <Globe :size="36" class="mx-auto text-text-muted mb-3" />
      <p class="text-sm text-text-muted">No sending domains yet. Add one to start sending from your own domain.</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="domain in domains" :key="domain.id" class="bg-surface-1 border border-border rounded-xl">
        <!-- Domain header -->
        <div class="px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <ShieldCheck v-if="domain.verification_status === 'verified'" :size="16" class="text-green-400" />
            <ShieldAlert v-else :size="16" class="text-amber-400" />
            <span class="font-medium text-sm text-text-primary">{{ domain.domain }}</span>
            <span :class="['text-[10px] px-2 py-0.5 rounded-full font-medium',
              domain.verification_status === 'verified' ? 'bg-green-500/15 text-green-400' :
              domain.verification_status === 'failed' ? 'bg-red-500/15 text-red-400' :
              'bg-amber-500/15 text-amber-400']">
              {{ domain.verification_status }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button class="btn-ghost text-xs px-2 py-1" @click="viewDns(domain)" title="DNS Records">
              <Shield :size="13" />
            </button>
            <button v-if="domain.verification_status !== 'verified'" class="btn-ghost text-xs px-2 py-1 text-green-400" @click="verifyDomain(domain)" title="Verify">
              <Check :size="13" />
            </button>
            <button class="btn-ghost text-xs px-2 py-1 text-red-400" @click="deleteDomain(domain)" title="Delete">
              <Trash2 :size="13" />
            </button>
          </div>
        </div>

        <!-- Sending emails under this domain -->
        <div class="border-t border-border px-4 py-2 bg-surface-0">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Sending Emails</span>
            <button class="text-[11px] text-accent hover:text-accent/80 font-medium" @click="newEmailDomainId = domain.id; showAddEmail = true">
              <Plus :size="11" class="inline" /> Add
            </button>
          </div>
          <div v-if="domainEmails(domain.id).length === 0" class="text-xs text-text-muted py-2">No sending emails yet</div>
          <div v-for="email in domainEmails(domain.id)" :key="email.id" class="flex items-center justify-between py-1.5 text-xs">
            <div class="flex items-center gap-2">
              <Mail :size="12" class="text-text-muted" />
              <span class="text-text-primary">{{ email.display_name ? `${email.display_name} <${email.email}>` : email.email }}</span>
              <span v-if="email.is_default" class="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">Default</span>
            </div>
            <div class="flex items-center gap-1">
              <button v-if="!email.is_default" class="text-text-muted hover:text-accent text-[10px]" @click="setDefault(email.id)">Set Default</button>
              <button class="text-text-muted hover:text-red-400 p-0.5" @click="deleteEmail(email.id)"><Trash2 :size="11" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Domain Modal -->
    <Modal :show="showAddDomain" title="Add Sending Domain" size="sm" @close="showAddDomain = false">
      <div class="form-group">
        <label class="form-label">Domain</label>
        <input v-model="newDomain" class="form-input" placeholder="example.com" @keyup.enter="addDomain" />
        <p class="text-xs text-text-muted mt-1">Enter your domain name. You'll need to add DNS records to verify ownership.</p>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showAddDomain = false">Cancel</button>
        <button class="btn-primary" :disabled="!newDomain.trim() || addingDomain" @click="addDomain">
          <Loader2 v-if="addingDomain" :size="14" class="animate-spin" />
          Add Domain
        </button>
      </template>
    </Modal>

    <!-- DNS Records Modal -->
    <Modal :show="showDnsModal" :title="`DNS Records — ${dnsDomainName}`" size="lg" @close="showDnsModal = false">
      <p class="text-sm text-text-muted mb-4">Add these DNS records to your domain to enable email sending. After adding, click "Verify" to confirm.</p>
      <div class="space-y-3">
        <div v-for="(record, i) in dnsRecords" :key="i" class="bg-surface-0 border border-border rounded-lg p-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-text-secondary">{{ record.type }} Record — {{ record.purpose }}</span>
            <button class="text-text-muted hover:text-accent" @click="copyText(record.value)"><Copy :size="12" /></button>
          </div>
          <div class="text-[11px] text-text-muted mb-0.5">Name: <code class="text-text-secondary">{{ record.name }}</code></div>
          <div class="text-[11px] text-text-muted">Value: <code class="text-text-secondary break-all">{{ record.value }}</code></div>
        </div>
      </div>
    </Modal>

    <!-- Add Email Modal -->
    <Modal :show="showAddEmail" title="Add Sending Email" size="sm" @close="showAddEmail = false">
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input v-model="newEmailAddress" class="form-input" placeholder="hello@example.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Display Name (optional)</label>
        <input v-model="newEmailDisplayName" class="form-input" placeholder="My Company" />
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showAddEmail = false">Cancel</button>
        <button class="btn-primary" :disabled="!newEmailAddress.trim() || addingEmail" @click="addEmail">
          <Loader2 v-if="addingEmail" :size="14" class="animate-spin" /> Add Email
        </button>
      </template>
    </Modal>
  </div>
</template>
