<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>🤖 AI角色访问管理</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="intro-text">
          选择可以与日历数据互动的AI角色，让它们记住你的日程、纪念日，更好地陪伴你
        </div>
        
        <div class="char-list">
          <div
            v-for="char in availableChars"
            :key="char.id"
            class="char-item"
            :class="{ 'is-bound': isBound(char.id) }"
          >
            <div class="char-header">
              <div class="char-info">
                <img :src="char.avatar || '/default-avatar.png'" class="char-avatar" />
                <div class="char-meta">
                  <span class="char-name">{{ char.name }}</span>
                  <span class="char-status" :class="{ online: isOnline(char.id) }">
                    {{ isOnline(char.id) ? '在线' : '离线' }}
                  </span>
                </div>
              </div>
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="isBound(char.id)"
                  @change="toggleBind(char.id)"
                />
                <span class="slider"></span>
              </label>
            </div>
            
            <div v-if="isBound(char.id)" class="permissions">
              <div class="permission-item">
                <label class="checkbox-label">
                  <input
                    v-model="settings[char.id].schedule"
                    type="checkbox"
                  />
                  <span>日程安排</span>
                </label>
                <span class="permission-desc">AI可以读取你的日程和提醒</span>
              </div>
              
              <div class="permission-item">
                <label class="checkbox-label">
                  <input
                    v-model="settings[char.id].period"
                    type="checkbox"
                  />
                  <span>生理期数据</span>
                </label>
                <span class="permission-desc">AI可以了解你的生理周期</span>
              </div>
              
              <div class="permission-item">
                <label class="checkbox-label">
                  <input
                    v-model="settings[char.id].mood"
                    type="checkbox"
                  />
                  <span>心情记录</span>
                </label>
                <span class="permission-desc">AI可以读取你的心情日记</span>
              </div>
              
              <div class="permission-item">
                <label class="checkbox-label">
                  <input
                    v-model="settings[char.id].sleep"
                    type="checkbox"
                  />
                  <span>睡眠记录</span>
                </label>
                <span class="permission-desc">AI可以了解你的睡眠情况</span>
              </div>
              
              <div class="permission-item">
                <label class="checkbox-label">
                  <input
                    v-model="settings[char.id].diary"
                    type="checkbox"
                  />
                  <span>日记内容</span>
                </label>
                <span class="permission-desc">AI可以读取标记为可读的日记</span>
              </div>
              
              <div class="permission-item">
                <label class="checkbox-label">
                  <input
                    v-model="settings[char.id].countdowns"
                    type="checkbox"
                  />
                  <span>纪念日/倒计时</span>
                </label>
                <span class="permission-desc">AI可以记住重要日期</span>
              </div>
              
              <div class="permission-item">
                <label class="checkbox-label">
                  <input
                    v-model="settings[char.id].reminders"
                    type="checkbox"
                  />
                  <span>主动提醒</span>
                </label>
                <span class="permission-desc">AI会主动提醒你日程和纪念日</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="tip-box">
          <span class="tip-icon">💡</span>
          <span>绑定后，AI会在对话中更贴心地关心你，比如提醒即将到来的日程、纪念日等</span>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button class="btn-primary" @click="save">保存设置</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '../../../stores/chatStore'
import { useCalendarStore } from '../../../stores/calendarStore'

const emit = defineEmits(['close'])
const chatStore = useChatStore()
const calendarStore = useCalendarStore()

const availableChars = computed(() => chatStore.contactList)

const settings = ref({})

// 初始化设置
availableChars.value.forEach(char => {
  const existing = calendarStore.aiAccessSettings[char.id] || {}
  settings.value[char.id] = {
    enabled: existing.enabled || false,
    schedule: existing.schedule !== false, // 默认开启
    period: existing.period || false,
    mood: existing.mood || false,
    sleep: existing.sleep || false,
    diary: existing.diary || false,
    countdowns: existing.countdowns !== false, // 默认开启
    reminders: existing.reminders || false
  }
})

function isBound(charId) {
  return settings.value[charId]?.enabled
}

function isOnline(charId) {
  const chat = chatStore.chats[charId]
  return chat && chat.isOnline
}

function toggleBind(charId) {
  settings.value[charId].enabled = !settings.value[charId].enabled
}

function close() {
  emit('close')
}

function save() {
  Object.keys(settings.value).forEach(charId => {
    calendarStore.setAIAccess(charId, settings.value[charId])
  })
  emit('close')
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
  max-width: 480px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.3), rgba(255, 183, 197, 0.2));
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

.intro-text {
  font-size: 14px;
  color: #8b7aa8;
  text-align: center;
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(197, 201, 255, 0.1);
  border-radius: 10px;
}

.char-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.char-item {
  border: 1px solid rgba(139, 122, 168, 0.15);
  border-radius: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.6);
  transition: all 0.3s ease;
}

.char-item.is-bound {
  border-color: rgba(255, 158, 181, 0.3);
  background: white;
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.08);
}

.char-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.char-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(139, 122, 168, 0.1);
}

.char-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.char-name {
  font-size: 15px;
  font-weight: 600;
  color: #5a5a7a;
}

.char-status {
  font-size: 12px;
  color: #9a8fb8;
}

.char-status.online {
  color: #7fb069;
}

.switch {
  position: relative;
  width: 48px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(139, 122, 168, 0.2);
  border-radius: 26px;
  transition: 0.3s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

input:checked + .slider {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
}

input:checked + .slider:before {
  transform: translateX(22px);
}

.permissions {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed rgba(139, 122, 168, 0.2);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.permission-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #5a5a7a;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
  accent-color: #ff9eb5;
}

.permission-desc {
  font-size: 10px;
  color: #9a8fb8;
  padding-left: 22px;
}

.tip-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 216, 168, 0.2);
  border-radius: 10px;
  margin-top: 20px;
  font-size: 13px;
  color: #8b7aa8;
}

.tip-icon {
  font-size: 16px;
  flex-shrink: 0;
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
  background: linear-gradient(135deg, #c5c9ff, #e6e6fa);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(197, 201, 255, 0.4);
}

.btn-secondary {
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
}

.btn-secondary:hover {
  background: rgba(139, 122, 168, 0.2);
}
</style>
