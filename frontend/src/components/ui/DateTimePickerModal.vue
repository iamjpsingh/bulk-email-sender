<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from './Modal.vue'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-vue-next'

interface Props {
  show: boolean
  modelValue?: string
  title?: string
}

interface Emits {
  (e: 'close'): void
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Select Date & Time'
})

const emit = defineEmits<Emits>()

const currentMonth = ref(new Date())
const selectedDate = ref<Date | null>(null)
const selectedHour = ref(12)
const selectedMinute = ref(0)
const selectedPeriod = ref<'AM' | 'PM'>('PM')

// Initialize from modelValue
if (props.modelValue) {
  try {
    const date = new Date(props.modelValue)
    selectedDate.value = date
    currentMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
    
    let hours = date.getHours()
    selectedPeriod.value = hours >= 12 ? 'PM' : 'AM'
    selectedHour.value = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    selectedMinute.value = date.getMinutes()
  } catch {
    selectedDate.value = null
  }
}

const monthName = computed(() => {
  return currentMonth.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

const daysInMonth = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  
  const days = []
  
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day))
  }
  
  return days
})

const timeDisplay = computed(() => {
  const hour = selectedHour.value.toString().padStart(2, '0')
  const minute = selectedMinute.value.toString().padStart(2, '0')
  return `${hour}:${minute}`
})

function handleDateSelect(date: Date) {
  selectedDate.value = date
}

function updateDateTime() {
  if (!selectedDate.value) return
  
  let hours = selectedHour.value
  if (selectedPeriod.value === 'PM' && hours !== 12) {
    hours += 12
  } else if (selectedPeriod.value === 'AM' && hours === 12) {
    hours = 0
  }
  
  const dateTime = new Date(selectedDate.value)
  dateTime.setHours(hours, selectedMinute.value, 0, 0)
  
  emit('update:modelValue', dateTime.toISOString().slice(0, 16))
}

function handleConfirm() {
  if (selectedDate.value) {
    updateDateTime()
  }
  emit('close')
}

function previousMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1)
}

function nextMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1)
}

function isToday(date: Date) {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function isSelected(date: Date) {
  if (!selectedDate.value) return false
  return date.toDateString() === selectedDate.value.toDateString()
}

function setToNow() {
  const now = new Date()
  selectedDate.value = now
  currentMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
  
  let hours = now.getHours()
  selectedPeriod.value = hours >= 12 ? 'PM' : 'AM'
  selectedHour.value = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  selectedMinute.value = now.getMinutes()
  
  updateDateTime()
}

function clearDateTime() {
  selectedDate.value = null
  selectedHour.value = 12
  selectedMinute.value = 0
  selectedPeriod.value = 'PM'
  emit('update:modelValue', '')
  emit('close')
}

function handleClose() {
  emit('close')
}

// Time picker functions
function incrementHour() {
  selectedHour.value = selectedHour.value === 12 ? 1 : selectedHour.value + 1
}

function decrementHour() {
  selectedHour.value = selectedHour.value === 1 ? 12 : selectedHour.value - 1
}

function incrementMinute() {
  selectedMinute.value = selectedMinute.value === 59 ? 0 : selectedMinute.value + 1
}

function decrementMinute() {
  selectedMinute.value = selectedMinute.value === 0 ? 59 : selectedMinute.value - 1
}

function togglePeriod() {
  selectedPeriod.value = selectedPeriod.value === 'AM' ? 'PM' : 'AM'
}
</script>

<template>
  <Modal
    :show="show"
    :title="title"
    size="md"
    @close="handleClose"
  >
    <div class="datetime-picker-modal">
      <!-- Calendar Section -->
      <div class="calendar-section">
        <div class="calendar-header">
          <button type="button" class="nav-btn" @click="previousMonth">
            <ChevronLeft :size="18" />
          </button>
          <h3 class="month-title">{{ monthName }}</h3>
          <button type="button" class="nav-btn" @click="nextMonth">
            <ChevronRight :size="18" />
          </button>
        </div>
        
        <div class="calendar-grid">
          <div class="weekday-header">
            <div class="weekday">Su</div>
            <div class="weekday">Mo</div>
            <div class="weekday">Tu</div>
            <div class="weekday">We</div>
            <div class="weekday">Th</div>
            <div class="weekday">Fr</div>
            <div class="weekday">Sa</div>
          </div>
          
          <div class="days-grid">
            <button
              v-for="(day, index) in daysInMonth"
              :key="index"
              type="button"
              :class="[
                'day-btn',
                {
                  'is-today': day && isToday(day),
                  'is-selected': day && isSelected(day),
                  'is-empty': !day
                }
              ]"
              :disabled="!day"
              @click="day && handleDateSelect(day)"
            >
              {{ day ? day.getDate() : '' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Time Section -->
      <div class="time-section">
        <div class="time-header">
          <Clock :size="16" />
          <span>Time</span>
        </div>
        
        <div class="time-picker">
          <!-- Hour -->
          <div class="time-column">
            <button class="time-btn" @click="incrementHour">+</button>
            <div class="time-display">{{ selectedHour.toString().padStart(2, '0') }}</div>
            <button class="time-btn" @click="decrementHour">-</button>
          </div>
          
          <div class="time-separator">:</div>
          
          <!-- Minute -->
          <div class="time-column">
            <button class="time-btn" @click="incrementMinute">+</button>
            <div class="time-display">{{ selectedMinute.toString().padStart(2, '0') }}</div>
            <button class="time-btn" @click="decrementMinute">-</button>
          </div>
          
          <!-- AM/PM -->
          <div class="time-column">
            <button class="period-btn" @click="togglePeriod">
              {{ selectedPeriod }}
            </button>
          </div>
        </div>
        
        <div class="time-display-large">
          {{ timeDisplay }} {{ selectedPeriod }}
        </div>
      </div>
    </div>
    
    <!-- Footer Actions -->
    <template #footer>
      <button class="btn btn-ghost" @click="clearDateTime">
        Clear
      </button>
      <button class="btn btn-secondary" @click="setToNow">
        Now
      </button>
      <button class="btn btn-primary" @click="handleConfirm" :disabled="!selectedDate">
        Confirm
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.datetime-picker-modal {
  padding: 10px 0;
}

.calendar-section {
  margin-bottom: 24px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(6, 182, 212, 0.1);
    color: var(--accent-primary);
  }
}

.month-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.calendar-grid {
  margin-bottom: 16px;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 12px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled):not(.is-empty) {
    background: rgba(6, 182, 212, 0.1);
    color: var(--accent-primary);
    transform: scale(1.05);
  }
  
  &.is-today {
    background: rgba(6, 182, 212, 0.15);
    color: var(--accent-primary);
    font-weight: 600;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }
  
  &.is-selected {
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-weight: 600;
    
    &:hover {
      background: #0891b2;
      transform: scale(1.05);
    }
  }
  
  &.is-empty {
    cursor: default;
    opacity: 0;
    pointer-events: none;
  }
}

.time-section {
  padding: 20px 0;
  border-top: 1px solid var(--border-color);
}

.time-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.time-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.time-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.time-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--accent-primary);
    color: var(--bg-primary);
    transform: scale(1.1);
  }
}

.time-display {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.time-separator {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 8px;
}

.period-btn {
  width: 48px;
  height: 48px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--accent-primary);
    color: var(--bg-primary);
    border-color: var(--accent-primary);
  }
}

.time-display-large {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: var(--font-mono);
  padding: 12px;
  background: rgba(6, 182, 212, 0.1);
  border-radius: var(--radius-md);
  border: 1px solid rgba(6, 182, 212, 0.2);
}
</style>