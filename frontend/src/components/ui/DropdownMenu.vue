<script lang="ts">
import { h, computed, defineComponent } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from 'radix-vue'
import { cn } from '../../lib/utils'

// Re-export root and trigger as-is
export { DropdownMenuRoot as DropdownMenu }
export { DropdownMenuTrigger }
export { DropdownMenuGroup }
export { DropdownMenuSub }

// Styled content
export const DropdownMenuContentStyled = defineComponent({
  name: 'DropdownMenuContentStyled',
  props: {
    class: { type: String, default: '' },
    sideOffset: { type: Number, default: 4 },
    align: { type: String as () => 'start' | 'center' | 'end', default: 'start' },
  },
  setup(props, { slots, attrs }) {
    const classes = computed(() =>
      cn(
        'z-50 min-w-[180px] overflow-hidden bg-bg-secondary border border-border rounded-[--radius-md] p-1 shadow-lg',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=top]:slide-in-from-bottom-2 data-[side=right]:slide-in-from-left-2 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        props.class,
      ),
    )
    return () =>
      h(DropdownMenuPortal, {}, () =>
        h(
          DropdownMenuContent,
          {
            ...attrs,
            sideOffset: props.sideOffset,
            align: props.align,
            class: classes.value,
          },
          () => slots.default?.(),
        ),
      )
  },
})

// Styled item
export const DropdownMenuItemStyled = defineComponent({
  name: 'DropdownMenuItemStyled',
  props: {
    class: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    destructive: { type: Boolean, default: false },
  },
  emits: ['select'],
  setup(props, { slots, attrs, emit }) {
    const classes = computed(() =>
      cn(
        'relative flex items-center gap-2 rounded-[--radius-sm] px-2 py-1.5 text-sm outline-none cursor-pointer select-none transition-colors',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.destructive
          ? 'text-danger focus:bg-danger/10 focus:text-danger'
          : 'text-text-secondary focus:bg-accent/10 focus:text-text-primary',
        props.class,
      ),
    )
    return () =>
      h(
        DropdownMenuItem,
        {
          ...attrs,
          disabled: props.disabled,
          class: classes.value,
          onSelect: (e: Event) => emit('select', e),
        },
        () => slots.default?.(),
      )
  },
})

// Styled separator
export const DropdownMenuSeparatorStyled = defineComponent({
  name: 'DropdownMenuSeparatorStyled',
  props: {
    class: { type: String, default: '' },
  },
  setup(props, { attrs }) {
    const classes = computed(() =>
      cn('-mx-1 my-1 h-px bg-border', props.class),
    )
    return () =>
      h(DropdownMenuSeparator, { ...attrs, class: classes.value })
  },
})

// Styled label
export const DropdownMenuLabelStyled = defineComponent({
  name: 'DropdownMenuLabelStyled',
  props: {
    class: { type: String, default: '' },
  },
  setup(props, { slots, attrs }) {
    const classes = computed(() =>
      cn('px-2 py-1.5 text-xs font-semibold text-text-muted', props.class),
    )
    return () =>
      h(DropdownMenuLabel, { ...attrs, class: classes.value }, () => slots.default?.())
  },
})

// Styled sub trigger
export const DropdownMenuSubTriggerStyled = defineComponent({
  name: 'DropdownMenuSubTriggerStyled',
  props: {
    class: { type: String, default: '' },
  },
  setup(props, { slots, attrs }) {
    const classes = computed(() =>
      cn(
        'relative flex items-center gap-2 rounded-[--radius-sm] px-2 py-1.5 text-sm outline-none cursor-pointer select-none text-text-secondary focus:bg-accent/10 focus:text-text-primary',
        props.class,
      ),
    )
    return () =>
      h(DropdownMenuSubTrigger, { ...attrs, class: classes.value }, () => [
        slots.default?.(),
        h('svg', {
          xmlns: 'http://www.w3.org/2000/svg',
          width: '14',
          height: '14',
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          class: 'ml-auto',
        }, [
          h('path', { d: 'm9 18 6-6-6-6' }),
        ]),
      ])
  },
})

// Styled sub content
export const DropdownMenuSubContentStyled = defineComponent({
  name: 'DropdownMenuSubContentStyled',
  props: {
    class: { type: String, default: '' },
    sideOffset: { type: Number, default: 2 },
  },
  setup(props, { slots, attrs }) {
    const classes = computed(() =>
      cn(
        'z-50 min-w-[180px] overflow-hidden bg-bg-secondary border border-border rounded-[--radius-md] p-1 shadow-lg',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        props.class,
      ),
    )
    return () =>
      h(DropdownMenuPortal, {}, () =>
        h(
          DropdownMenuSubContent,
          { ...attrs, sideOffset: props.sideOffset, class: classes.value },
          () => slots.default?.(),
        ),
      )
  },
})
</script>

<script setup lang="ts">
/**
 * DropdownMenu - A composed dropdown menu built on Radix Vue.
 *
 * Usage:
 *   import {
 *     DropdownMenu,
 *     DropdownMenuTrigger,
 *     DropdownMenuContentStyled as DropdownMenuContent,
 *     DropdownMenuItemStyled as DropdownMenuItem,
 *     DropdownMenuSeparatorStyled as DropdownMenuSeparator,
 *     DropdownMenuLabelStyled as DropdownMenuLabel,
 *   } from '@/components/ui/DropdownMenu.vue'
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger as-child>
 *       <Button>Open</Button>
 *     </DropdownMenuTrigger>
 *     <DropdownMenuContent>
 *       <DropdownMenuLabel>Actions</DropdownMenuLabel>
 *       <DropdownMenuItem>Edit</DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *       <DropdownMenuItem :destructive="true">Delete</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
</script>
