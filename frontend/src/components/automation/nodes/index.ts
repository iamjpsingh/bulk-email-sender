// Custom Vue Flow node components for automation builder

import { markRaw, type Component, h } from 'vue'
import BaseNode from './BaseNode.vue'
import {
  Workflow, Mail, Clock, GitBranch, Filter, Shuffle, Globe, Tag, Minus, UserCog, ArrowRightLeft,
  Zap, Square, MessageSquare,
} from 'lucide-vue-next'

// Node type configurations
export const NODE_TYPES = {
  trigger: {
    label: 'Trigger',
    icon: markRaw(Workflow),
    color: '#22c55e',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-green-500/40',
    category: 'trigger',
  },
  send_email: {
    label: 'Send Email',
    icon: markRaw(Mail),
    color: '#6366f1',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-indigo-500/40',
    category: 'action',
  },
  send_whatsapp: {
    label: 'Send WhatsApp',
    icon: markRaw(MessageSquare),
    color: '#25d366',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-green-500/40',
    category: 'action',
  },
  wait: {
    label: 'Wait',
    icon: markRaw(Clock),
    color: '#8b5cf6',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-violet-500/40',
    category: 'timing',
  },
  delay_until: {
    label: 'Delay Until',
    icon: markRaw(Clock),
    color: '#a78bfa',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-violet-400/40',
    category: 'timing',
  },
  condition: {
    label: 'Condition',
    icon: markRaw(GitBranch),
    color: '#f59e0b',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-amber-500/40',
    category: 'logic',
    hasTrueHandle: true,
    hasFalseHandle: true,
  },
  filter: {
    label: 'Filter',
    icon: markRaw(Filter),
    color: '#f97316',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-orange-500/40',
    category: 'logic',
  },
  split_test: {
    label: 'A/B Split',
    icon: markRaw(Shuffle),
    color: '#ec4899',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-pink-500/40',
    category: 'logic',
    hasTrueHandle: true,
    hasFalseHandle: true,
  },
  http_request: {
    label: 'HTTP Request',
    icon: markRaw(Globe),
    color: '#06b6d4',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-cyan-500/40',
    category: 'action',
  },
  add_tag: {
    label: 'Add Tag',
    icon: markRaw(Tag),
    color: '#10b981',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-emerald-500/40',
    category: 'action',
  },
  remove_tag: {
    label: 'Remove Tag',
    icon: markRaw(Minus),
    color: '#ef4444',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-red-500/40',
    category: 'action',
  },
  update_contact: {
    label: 'Update Contact',
    icon: markRaw(UserCog),
    color: '#3b82f6',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-blue-500/40',
    category: 'action',
  },
  move_to_list: {
    label: 'Move to List',
    icon: markRaw(ArrowRightLeft),
    color: '#14b8a6',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-teal-500/40',
    category: 'action',
  },
  score_change: {
    label: 'Change Score',
    icon: markRaw(Zap),
    color: '#eab308',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-yellow-500/40',
    category: 'action',
  },
  webhook: {
    label: 'Webhook',
    icon: markRaw(Globe),
    color: '#0ea5e9',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-sky-500/40',
    category: 'action',
  },
  end: {
    label: 'End',
    icon: markRaw(Square),
    color: '#ef4444',
    bgColor: 'var(--color-surface-1)',
    borderColor: 'border-red-500/40',
    category: 'end',
    hasSourceHandle: false,
  },
} as const

export type NodeTypeName = keyof typeof NODE_TYPES

// Palette categories for the toolbar
export const NODE_PALETTE = [
  { category: 'Actions', items: ['send_email', 'add_tag', 'remove_tag', 'update_contact', 'move_to_list', 'score_change', 'webhook', 'http_request'] },
  { category: 'Timing', items: ['wait', 'delay_until'] },
  { category: 'Logic', items: ['condition', 'filter', 'split_test'] },
  { category: 'End', items: ['end'] },
] as const

export { BaseNode }
