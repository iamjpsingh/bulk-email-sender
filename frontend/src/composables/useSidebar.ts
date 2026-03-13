import { ref, watch } from 'vue'

const STORAGE_KEY = 'dispatch-sidebar-collapsed'

const collapsed = ref(
  typeof localStorage !== 'undefined'
    ? localStorage.getItem(STORAGE_KEY) === 'true'
    : false
)

watch(collapsed, (val) => {
  try { localStorage.setItem(STORAGE_KEY, String(val)) } catch {}
})

export function useSidebar() {
  function toggle() {
    collapsed.value = !collapsed.value
  }

  return { collapsed, toggle }
}
