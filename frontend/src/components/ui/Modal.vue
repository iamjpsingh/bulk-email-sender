<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface Props {
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
})

const emit = defineEmits<{
  close: []
}>()

const sizeClasses: Record<string, string> = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[500px]',
  lg: 'sm:max-w-[700px]',
  xl: 'sm:max-w-[900px]',
}

function handleOpenChange(open: boolean) {
  if (!open && props.closable) {
    emit('close')
  }
}
</script>

<template>
  <Dialog :open="show" @update:open="handleOpenChange">
    <DialogContent :class="sizeClasses[size]" @pointer-down-outside="closable ? undefined : $event.preventDefault()">
      <DialogHeader v-if="title || closable">
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <slot />

      <DialogFooter v-if="$slots.footer">
        <slot name="footer" />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
