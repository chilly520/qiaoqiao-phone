<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ isEditing ? '编辑日程' : '新建日程' }}</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>标题</label>
          <input v-model="form.title" type="text" placeholder="输入日程标题..." />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>日期</label>
            <input v-model="form.date" type="date" />
          </div>
          <div class="form-group checkbox">
            <label class="toggle-label">
              <input v-model="form.allDay" type="checkbox" />
              <span>全天</span>
            </label>
          </div>
        </div>
        
        <div v-if="!form.allDay" class="form-row">
          <div class="form-group">
            <label>开始时间</label>
            <input v-model="form.startTime" type="time" />
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <input v-model="form.endTime" type="time" />
          </div>
        </div>
        
        <div class="form-group">
          <label>类型</label>
          <div class="type-options">
            <button
              v-for="type in eventTypes"
              :key="type.value"
              class="type-btn"
              :class="{ active: form.type === type.value }"
              :style="{ '--type-color': type.color }"
              @click="form.type = type.value"
            >
              <span class="type-dot" :style="{ backgroundColor: type.color }"></span>
              {{ type.label }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>颜色标记</label>
          <div class="color-picker">
            <button
              v-for="color in colors"
              :key="color"
              class="color-btn"
              :class="{ active: form.color === color }"
              :style="{ backgroundColor: color }"
              @click="form.color = color"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>备注</label>
          <textarea v-model="form.note" rows="3" placeholder="添加备注..."></textarea>
        </div>
        
        <div class="form-group">
          <label class="toggle-label">
            <input v-model="form.isRecurring" type="checkbox" />
            <span>周期性重复</span>
          </label>
        </div>
        
        <div v-if="form.isRecurring" class="form-row">
          <div class="form-group">
            <label>重复频率</label>
            <select v-model="form.recurringType">
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </select>
          </div>
          <div class="form-group">
            <label>间隔</label>
            <input v-model.number="form.recurringInterval" type="number" min="1" max="30" />
          </div>
        </div>
        
        <div class="form-group">
          <label class="toggle-label">
            <input v-model="form.aiBound" type="checkbox" />
            <span>允许AI角色查看此日程</span>
          </label>
        </div>
        
        <div v-if="form.aiBound" class="ai-bind-section">
          <label>选择可查看的AI角色</label>
          <div class="ai-char-list">
            <label
              v-for="char in availableChars"
              :key="char.id"
              class="ai-char-option"
            >
              <input v-model="form.aiChars" type="checkbox" :value="char.id" />
              <img :src="char.avatar || '/default-avatar.png'" />
              <span>{{ char.name }}</span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button v-if="isEditing" class="btn-danger" @click="deleteEvent">删除</button>
        <div class="spacer"></div>
        <button class="btn-secondary" @click="close">取消</button>
        <button class="btn-primary" :disabled="!form.title" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useChatStore } from '@/stores/chatStore'

const props = defineProps({
  event: Object,
  date: String
})

const emit = defineEmits(['close', 'save'])
const chatStore = useChatStore()

const eventTypes = [
  { value: 'schedule', label: '日程', color: '#ff9eb5' },
  { value: 'todo', label: '待办', color: '#a8d8ea' },
  { value: 'anniversary', label: '纪念日', color: '#ffd8a8' },
  { value: 'birthday', label: '生日', color: '#c5c9ff' },
  { value: 'work', label: '工作', color: '#7fb069' },
  { value: 'personal', label: '个人', color: '#e6e6fa' }
]

const colors = ['#ff9eb5', '#ffd8a8', '#c5c9ff', '#a8d8ea', '#7fb069', '#e6e6fa', '#ffb7c5', '#d4a5a5', '#9ec4bb', '#b4a7d6']

const isEditing = computed(() => !!props.event)

const availableChars = computed(() => chatStore.contactList)

const form = ref({
  title: '',
  date: props.date,
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  type: 'schedule',
  color: '#ff9eb5',
  note: '',
  isRecurring: false,
  recurringType: 'daily',
  recurringInterval: 1,
  aiBound: false,
  aiChars: [],
  completed: false
})

// 编辑时填充数据
watch(() => props.event, (event) => {
  if (event) {
    form.value = {
      title: event.title || '',
      date: event.date || props.date,
      allDay: event.allDay || false,
      startTime: event.startTime || '09:00',
      endTime: event.endTime || '10:00',
      type: event.type || 'schedule',
      color: event.color || '#ff9eb5',
      note: event.note || '',
      isRecurring: event.isRecurring || false,
      recurringType: event.recurringType || 'daily',
      recurringInterval: event.recurringInterval || 1,
      aiBound: event.aiBound || false,
      aiChars: event.aiChars || [],
      completed: event.completed || false
    }
  }
}, { immediate: true })

function close() {
  emit('close')
}

function save() {
  emit('save', {
    ...(props.event || {}),
    ...form.value
  })
}

function deleteEvent() {
  if (confirm('确定要删除这个日程吗？')) {
    emit('save', { ...props.event, _deleted: true })
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(90, 90, 122, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 480px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 107, 157, 0.2);
  color: #ff6b9d;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  max-height: calc(85vh - 140px);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5a5a7a;
  margin-bottom: 6px;
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group input[type="time"],
.form-group input[type="number"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  font-size: 14px;
  color: #5a5a7a;
  background: rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #ffb7c5;
  box-shadow: 0 0 0 3px rgba(255, 183, 197, 0.2);
}

.form-group textarea {
  resize: vertical;
  min-height: 60px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-row .form-group {
  margin-bottom: 16px;
}

.checkbox .toggle-label,
.form-group .toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 0;
}

.toggle-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #ff9eb5;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.type-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 10px;
  background: white;
  font-size: 12px;
  color: #5a5a7a;
  cursor: pointer;
  transition: all 0.3s ease;
}

.type-btn:hover {
  border-color: var(--type-color);
}

.type-btn.active {
  border-color: var(--type-color);
  background: rgba(255, 158, 181, 0.1);
}

.type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #5a5a7a;
  transform: scale(1.15);
}

.ai-bind-section {
  padding: 12px;
  background: rgba(197, 201, 255, 0.1);
  border-radius: 12px;
}

.ai-bind-section label {
  font-size: 12px;
  margin-bottom: 10px;
}

.ai-char-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.ai-char-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.ai-char-option:hover {
  background: rgba(197, 201, 255, 0.2);
}

.ai-char-option input {
  display: none;
}

.ai-char-option img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.ai-char-option input:checked + img {
  border-color: #ff9eb5;
  box-shadow: 0 0 0 3px rgba(255, 158, 181, 0.3);
}

.ai-char-option span {
  font-size: 11px;
  color: #5a5a7a;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(139, 122, 168, 0.1);
}

.spacer {
  flex: 1;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255, 183, 197, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
}

.btn-secondary:hover {
  background: rgba(139, 122, 168, 0.2);
}

.btn-danger {
  background: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
}

.btn-danger:hover {
  background: rgba(255, 107, 107, 0.2);
}
</style>
