<script setup lang="ts">
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue'
import { Mail, Clock, Eye } from 'lucide-vue-next'
import 'quill/dist/quill.snow.css'

const props = defineProps<{
  subject: string
  content: string
  delay: number
  columns?: string[]
}>()

const emit = defineEmits(['update:subject', 'update:content', 'update:delay', 'preview'])

const editorRef = ref<HTMLDivElement>()
let quill: any = null

// Dynamic placeholders based on Excel columns
const dynamicPlaceholders = computed(() => {
  if (props.columns && props.columns.length > 0) {
    return props.columns.map((col) => ({
      label: col,
      value: `{{${col}}}`,
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
          [{ font: [] }],
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ script: 'sub' }, { script: 'super' }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ direction: 'rtl' }, { align: [] }],
          ['link', 'image', 'video', 'blockquote', 'code-block'],
          ['clean'],
        ],
      },
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

watch(
  () => props.content,
  (newContent) => {
    if (quill && newContent !== quill.root.innerHTML) {
      quill.root.innerHTML = newContent || ''
    }
  }
)

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
    <div class="editor-header">
      <h3>
        <Mail :size="18" class="header-icon" />
        Email Content
      </h3>
      <button
        class="btn btn-secondary btn-sm preview-btn"
        @click="emit('preview')"
        :disabled="!props.subject && !props.content"
      >
        <Eye :size="16" />
        Preview
      </button>
    </div>

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

<style scoped lang="scss">
/* Component-specific styles only. Quill overrides are in main.scss */
.email-editor {
  padding: 24px;

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-primary);
  }

  .header-icon {
    color: var(--color-accent);
  }
}

.placeholders {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.placeholder-label {
  font-size: 13px;
  color: var(--color-text-muted);
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
  color: var(--color-accent);
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-mono);

  &:hover {
    background: rgba(99, 102, 241, 0.2);
    border-color: var(--color-accent);
  }
}

.editor-wrapper {
  margin-bottom: 24px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);

  &:focus-within {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }
}

/* Quill dark theme alignment with Dispatch UI */
:deep(.ql-toolbar.ql-snow) {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

:deep(.ql-container.ql-snow) {
  border: 1px solid var(--color-border);
  border-top: 0;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  min-height: 280px;
}

:deep(.ql-editor) {
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.7;
  padding: 18px 18px 32px;
}

:deep(.ql-editor p) {
  margin: 0 0 10px;
}

:deep(.ql-editor a) {
  color: var(--color-accent);
  text-decoration: underline;
}

:deep(.ql-toolbar button),
:deep(.ql-toolbar .ql-picker-label),
:deep(.ql-toolbar .ql-picker-item) {
  color: var(--color-text-secondary);
  stroke: var(--color-text-secondary);
}

:deep(.ql-toolbar button:hover),
:deep(.ql-toolbar button.ql-active),
:deep(.ql-toolbar .ql-picker-label:hover),
:deep(.ql-toolbar .ql-picker-label.ql-active),
:deep(.ql-toolbar .ql-picker-item:hover),
:deep(.ql-toolbar .ql-picker-item.ql-selected) {
  color: var(--color-text-primary);
  stroke: var(--color-accent);
}

:deep(.ql-picker-options) {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

:deep(.ql-stroke) {
  stroke: var(--color-text-secondary);
}

:deep(.ql-fill) {
  fill: var(--color-text-secondary);
}

:deep(.ql-toolbar button.ql-active .ql-stroke),
:deep(.ql-toolbar .ql-picker-label.ql-active .ql-stroke),
:deep(.ql-toolbar .ql-picker-item.ql-selected .ql-stroke) {
  stroke: var(--color-accent);
}

:deep(.ql-toolbar button.ql-active .ql-fill),
:deep(.ql-toolbar .ql-picker-label.ql-active .ql-fill),
:deep(.ql-toolbar .ql-picker-item.ql-selected .ql-fill) {
  fill: var(--color-accent);
}

:deep(.ql-toolbar .ql-picker.ql-expanded .ql-picker-label) {
  color: var(--color-text-primary);
}

:deep(.ql-snow .ql-picker.ql-expanded .ql-picker-label .ql-stroke) {
  stroke: var(--color-text-primary);
}

:deep(.ql-tooltip) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

:deep(.ql-tooltip input[type='text']) {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

:deep(.ql-tooltip a.ql-action),
:deep(.ql-tooltip a.ql-remove) {
  color: var(--color-accent);
}
</style>
