<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>标题</label>
          <input v-model="form.title" type="text" placeholder="例如：结婚纪念日、项目截止日..." />
        </div>

        <div class="form-group">
          <label>目标日期</label>
          <input v-model="form.targetDate" type="date" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>类型</label>
            <select v-model="form.type">
              <option value="anniversary">纪念日</option>
              <option value="birthday">生日</option>
              <option value="deadline">截止日</option>
              <option value="holiday">节日</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="form-group checkbox">
            <label class="toggle-label">
              <input v-model="form.isRecurring" type="checkbox" />
              <span>每年重复</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>颜色标记</label>
          <div class="color-picker">
            <button v-for="color in colors" :key="color" class="color-btn" :class="{ active: form.color === color }"
              :style="{ backgroundColor: color }" @click="form.color = color" />
          </div>
        </div>

        <div class="form-group">
          <label>备注</label>
          <textarea v-model="form.note" rows="2" placeholder="添加备注..." />
        </div>

        <div class="form-group">
          <label class="toggle-label">
            <input v-model="form.showOnWidget" type="checkbox" />
            <span>应用到桌面小组件</span>
          </label>
        </div>

        <div class="form-group">
          <label class="toggle-label">
            <input v-model="form.aiNotify" type="checkbox" />
            <span>让AI角色提醒我</span>
          </label>
        </div>

        <div v-if="form.aiNotify" class="ai-bind-section">
          <label>选择提醒的AI角色</label>
          <div class="ai-char-list">
            <label v-for="char in availableChars" :key="char.id" class="ai-char-option">
              <input v-model="form.aiChars" type="checkbox" :value="char.id" />
              <img :src="char.avatar || '/default-avatar.png'" />
              <span>{{ char.name }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button class="btn-primary" :disabled="!form.title || !form.targetDate" @click="save">创建</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '../../../stores/chatStore'

const emit = defineEmits(['close', 'save'])
const chatStore = useChatStore()

const colors = ['#ff9eb5', '#ffd8a8', '#c5c9ff', '#a8d8ea', '#7fb069', '#e6e6fa', '#ffb7c5', '#d4a5a5', '#9ec4bb', '#b4a7d6']

const availableChars = computed(() => chatStore.contactList)

const props = defineProps({
  title: { type: String, default: '创建倒计时' },
  type: { type: String, default: 'custom' }
})

const form = ref({
  title: '',
  targetDate: new Date().toISOString().split('T')[0],
  type: props.type,
  isRecurring: props.type === 'anniversary' || props.type === 'birthday',
  color: '#ff9eb5',
  note: '',
  showOnWidget: true,
  aiNotify: false,
  aiChars: []
})

function close() {
  emit('close')
}

function save() {
  emit('save', { ...form.value })
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
}

.modal-container {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.2), rgba(197, 201, 255, 0.2));
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
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  font-size: 14px;
  color: #5a5a7a;
  background: rgba(255, 255, 255, 0.8);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #ffb7c5;
  box-shadow: 0 0 0 3px rgba(255, 183, 197, 0.2);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-row .form-group {
  margin-bottom: 16px;
}

.checkbox .toggle-label {
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

.ai-char-option input:checked+img {
  border-color: #ff9eb5;
  box-shadow: 0 0 0 3px rgba(255, 158, 181, 0.3);
}

.ai-char-option span {
  font-size: 11px;
  color: #5a5a7a;
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(139, 122, 168, 0.1);
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 10px 24px;
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
</style>
