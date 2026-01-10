<script setup lang="ts">
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue'
import { Mail, Clock } from 'lucide-vue-next'
import 'quill/dist/quill.snow.css'

const props = defineProps<{
  subject: string
  content: string
  delay: number
  columns?: string[]
}>()

const emit = defineEmits(['update:subject', 'update:content', 'update:delay'])

const editorRef = ref<HTMLDivElement>()
let quill: any = null

// Dynamic placeholders based on Excel columns
const dynamicPlaceholders = computed(() => {
  if (props.columns && props.columns.length > 0) {
    return props.columns.map(col => ({
      label: col,
      value: `{{${col}}}`
    }))
  }
  return []
})

const showPlaceholders = computed(() => dynamicPlaceholders.value.length > 0)

onMounted(async () => {
  if (editorRef.value) {
    // Dynamic import to avoid SSR issues
    const Quill = (await import('quill')).default
    
    quill = new Quill(editorRef.value, {
      theme: 'snow',
      placeholder: 'Write your email content here...',
      modules: {
        toolbar: [
          [{ 'font': [] }],
          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'script': 'sub' }, { 'script': 'super' }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          [{ 'indent': '-1' }, { 'indent': '+1' }],
          [{ 'direction': 'rtl' }, { 'align': [] }],
          ['link', 'image', 'video', 'blockquote', 'code-block'],
          ['clean']
        ]
      }
    })
    
    if (props.content) {
      quill.root.innerHTML = props.content
    }
    
    quill.on('text-change', () => {
      if (quill) {
        emit('update:content', quill.root.innerHTML)
      }
    })
  }
})

onBeforeUnmount(() => {
  quill = null
})

watch(() => props.content, (newContent) => {
  if (quill && newContent !== quill.root.innerHTML) {
    quill.root.innerHTML = newContent || ''
  }
})

function insertPlaceholder(value: string) {
  if (quill) {
    const range = quill.getSelection(true)
    if (range) {
      quill.insertText(range.index, value, 'user')
      quill.setSelection(range.index + value.length, 0)
    }
  }
}
</script>

<template>
  <div class="email-editor glass-card">
    <h3>
      <Mail :size="18" class="header-icon" />
      Email Content
    </h3>
    
    <!-- Subject -->
    <div class="form-group">
      <label class="form-label">Subject *</label>
      <input
        :value="subject"
        @input="emit('update:subject', ($event.target as HTMLInputElement).value)"
        type="text"
        class="form-input"
        placeholder="Enter email subject..."
      />
    </div>
    
    <!-- Dynamic Placeholders -->
    <div v-if="showPlaceholders" class="placeholders">
      <span class="placeholder-label">Insert placeholder:</span>
      <div class="placeholder-buttons">
        <button
          v-for="p in dynamicPlaceholders"
          :key="p.value"
          type="button"
          class="placeholder-btn"
          @click="insertPlaceholder(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>
    
    <!-- Editor -->
    <div class="editor-wrapper">
      <div ref="editorRef"></div>
    </div>
    
    <!-- Delay -->
    <div class="form-group">
      <label class="form-label">
        <Clock :size="14" />
        Delay Between Emails (seconds)
      </label>
      <input
        :value="delay"
        @input="emit('update:delay', Number(($event.target as HTMLInputElement).value))"
        type="number"
        class="form-input"
        min="15"
        max="60"
      />
      <p class="text-muted text-sm mt-2">15-30 seconds recommended to avoid rate limits</p>
    </div>
  </div>
</template>

<style lang="scss">
.email-editor {
  padding: 24px;
  
  h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-primary);
  }
  
  .header-icon {
    color: var(--accent-primary);
  }
}

.placeholders {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.placeholder-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.placeholder-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.placeholder-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-primary);
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-mono);
  
  &:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: var(--accent-primary);
  }
}

.editor-wrapper {
  margin-bottom: 24px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  
  &:focus-within {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

// ============================================
// QUILL DARK THEME - CLEAN OVERRIDE
// ============================================

.ql-toolbar.ql-snow {
  background: var(--bg-primary) !important;
  border: none !important;
  border-bottom: 1px solid var(--border-color) !important;
  padding: 10px 12px !important;
  
  .ql-formats {
    margin-right: 8px !important;
  }
  
  // All toolbar buttons - NO BORDERS
  button {
    width: 32px !important;
    height: 32px !important;
    padding: 6px !important;
    border: none !important;
    background: transparent !important;
    border-radius: 4px !important;
    
    &:hover {
      background: rgba(6, 182, 212, 0.15) !important;
    }
    
    &.ql-active {
      background: rgba(6, 182, 212, 0.25) !important;
    }
  }
  
  // SVG icons in toolbar
  .ql-stroke {
    stroke: #94a3b8 !important;
  }
  
  .ql-fill {
    fill: #94a3b8 !important;
  }
  
  .ql-thin {
    stroke: #94a3b8 !important;
  }
  
  button:hover .ql-stroke,
  button.ql-active .ql-stroke,
  .ql-picker-label:hover .ql-stroke {
    stroke: #06b6d4 !important;
  }
  
  button:hover .ql-fill,
  button.ql-active .ql-fill {
    fill: #06b6d4 !important;
  }
  
  // Picker labels (Font, Header dropdowns)
  .ql-picker {
    color: #94a3b8 !important;
    
    .ql-picker-label {
      border: 1px solid var(--border-color) !important;
      border-radius: 4px !important;
      padding: 4px 8px !important;
      background: transparent !important;
      
      &:hover {
        border-color: #06b6d4 !important;
      }
      
      &::before {
        color: #94a3b8 !important;
      }
      
      .ql-stroke {
        stroke: #94a3b8 !important;
      }
    }
    
    &.ql-expanded .ql-picker-label {
      border-color: #06b6d4 !important;
      
      &::before {
        color: #06b6d4 !important;
      }
      
      .ql-stroke {
        stroke: #06b6d4 !important;
      }
    }
  }
  
  // Color picker button - NO BORDER
  .ql-color-picker,
  .ql-background {
    .ql-picker-label {
      border: none !important;
      padding: 2px !important;
    }
  }
  
  // Align picker button - NO BORDER  
  .ql-align {
    .ql-picker-label {
      border: none !important;
      padding: 2px !important;
    }
  }
}

// ALL DROPDOWN MENUS
.ql-snow .ql-picker-options {
  background: #0a0f1a !important;
  border: 1px solid rgba(148, 163, 184, 0.15) !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
  padding: 4px !important;
}

// Font & Header dropdown items
.ql-snow .ql-picker.ql-font .ql-picker-options,
.ql-snow .ql-picker.ql-header .ql-picker-options {
  .ql-picker-item {
    padding: 8px 12px !important;
    border-radius: 4px !important;
    
    &::before {
      color: #94a3b8 !important;
    }
    
    &:hover {
      background: rgba(6, 182, 212, 0.1) !important;
      
      &::before {
        color: #06b6d4 !important;
      }
    }
    
    &.ql-selected {
      background: rgba(6, 182, 212, 0.15) !important;
      
      &::before {
        color: #06b6d4 !important;
      }
    }
  }
}

// COLOR PICKER - Grid layout with actual colors
.ql-snow .ql-color-picker .ql-picker-options,
.ql-snow .ql-background .ql-picker-options {
  background: #0a0f1a !important;
  padding: 8px !important;
  width: 200px !important;
  
  .ql-picker-item {
    width: 24px !important;
    height: 24px !important;
    border: none !important;
    border-radius: 3px !important;
    margin: 2px !important;
    padding: 0 !important;
    display: inline-block !important;
    float: none !important;
    
    &:hover {
      outline: 2px solid #06b6d4 !important;
      outline-offset: 1px !important;
    }
    
    &.ql-selected {
      outline: 2px solid #06b6d4 !important;
      outline-offset: 1px !important;
    }
  }
}

// When color picker is expanded, use flex
.ql-snow .ql-color-picker.ql-expanded .ql-picker-options,
.ql-snow .ql-background.ql-expanded .ql-picker-options {
  display: flex !important;
  flex-wrap: wrap !important;
}

// ALIGNMENT DROPDOWN - Horizontal with dark background
.ql-snow .ql-picker.ql-align .ql-picker-options {
  background: #0a0f1a !important;
  padding: 4px !important;
  width: auto !important;
  
  .ql-picker-item {
    width: 32px !important;
    height: 32px !important;
    padding: 6px !important;
    border-radius: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    
    &:hover {
      background: rgba(6, 182, 212, 0.1) !important;
    }
    
    &.ql-selected {
      background: rgba(6, 182, 212, 0.15) !important;
    }
    
    svg {
      width: 18px !important;
      height: 18px !important;
    }
  }
}

// When alignment picker is expanded, show as flex row
.ql-snow .ql-picker.ql-align.ql-expanded .ql-picker-options {
  display: flex !important;
  flex-direction: row !important;
}

// SVG in all picker items
.ql-snow .ql-picker-options .ql-picker-item svg .ql-stroke,
.ql-snow .ql-picker-options .ql-picker-item svg line,
.ql-snow .ql-picker-options .ql-picker-item svg path {
  stroke: #94a3b8 !important;
}

.ql-snow .ql-picker-options .ql-picker-item:hover svg .ql-stroke,
.ql-snow .ql-picker-options .ql-picker-item:hover svg line,
.ql-snow .ql-picker-options .ql-picker-item:hover svg path,
.ql-snow .ql-picker-options .ql-picker-item.ql-selected svg .ql-stroke,
.ql-snow .ql-picker-options .ql-picker-item.ql-selected svg line,
.ql-snow .ql-picker-options .ql-picker-item.ql-selected svg path {
  stroke: #06b6d4 !important;
}

// Editor container
.ql-container.ql-snow {
  border: none !important;
  font-family: var(--font-sans) !important;
  font-size: 15px !important;
  background: var(--bg-secondary) !important;
}

// Editor content
.ql-editor {
  min-height: 350px !important;
  padding: 20px !important;
  color: #f1f5f9 !important;
  line-height: 1.7 !important;
  
  &.ql-blank::before {
    color: #64748b !important;
    font-style: normal !important;
    left: 20px !important;
  }
  
  h1, h2, h3, h4, h5, h6 {
    color: #f1f5f9 !important;
    margin-bottom: 12px !important;
  }
  
  p {
    margin-bottom: 12px !important;
  }
  
  a {
    color: #06b6d4 !important;
  }
  
  blockquote {
    border-left: 4px solid #06b6d4 !important;
    padding-left: 16px !important;
    margin: 16px 0 !important;
    color: #94a3b8 !important;
    background: rgba(6, 182, 212, 0.05) !important;
    padding: 12px 16px !important;
    border-radius: 0 8px 8px 0 !important;
  }
  
  pre.ql-syntax {
    background: #0a0f1a !important;
    color: #f1f5f9 !important;
    border: 1px solid rgba(148, 163, 184, 0.1) !important;
    border-radius: 8px !important;
    padding: 16px !important;
    font-family: 'Space Mono', monospace !important;
    font-size: 13px !important;
  }
  
  ul, ol {
    padding-left: 24px !important;
    margin-bottom: 12px !important;
  }
  
  img {
    max-width: 100% !important;
    border-radius: 8px !important;
  }
}

// Tooltip (link editor)
.ql-tooltip {
  background: #0a0f1a !important;
  border: 1px solid rgba(148, 163, 184, 0.2) !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
  color: #f1f5f9 !important;
  padding: 12px 16px !important;
  z-index: 1000 !important;
  
  &::before {
    color: #94a3b8 !important;
  }
  
  input[type="text"] {
    background: #111827 !important;
    border: 1px solid rgba(148, 163, 184, 0.2) !important;
    border-radius: 6px !important;
    color: #f1f5f9 !important;
    padding: 8px 12px !important;
    font-size: 14px !important;
    
    &:focus {
      border-color: #06b6d4 !important;
      outline: none !important;
    }
  }
  
  a {
    color: #06b6d4 !important;
    
    &:hover {
      color: #14b8a6 !important;
    }
  }
  
  a.ql-remove {
    color: #ef4444 !important;
    
    &:hover {
      color: #dc2626 !important;
    }
  }
  
  .ql-preview {
    color: #06b6d4 !important;
  }
}

// Image resize handles
.ql-editor img {
  cursor: pointer;
}

// Snow theme overrides
.ql-snow .ql-tooltip {
  background: #0a0f1a !important;
}
</style>