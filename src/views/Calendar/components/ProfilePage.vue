<template>
  <div class="profile-page">
    <!-- 用户信息卡片 -->
    <div class="profile-card">
      <div class="user-avatar" @click="showAvatarEdit = true">
        <img v-if="userProfile.avatar" :src="userProfile.avatar" class="avatar-img" alt="avatar">
        <div v-else class="avatar-circle">👤</div>
        <div class="avatar-edit-hint">📷</div>
      </div>
      <div class="user-info">
        <h2 class="user-name" @click="showNameEdit = true">{{ userProfile.name || '用户' }}</h2>
        <p class="user-bio">记录每一天的美好时光</p>
      </div>
    </div>

    <!-- 数据统计 -->
    <div class="stats-overview">
      <div class="stat-item">
        <div class="stat-icon">📅</div>
        <div class="stat-num">{{ calendarStore.statsOverview.totalEvents }}</div>
        <div class="stat-label">日程</div>
      </div>
      <div class="stat-item">
        <div class="stat-icon">🌙</div>
        <div class="stat-num">{{ calendarStore.statsOverview.periodCycles }}</div>
        <div class="stat-label">经期记录</div>
      </div>
      <div class="stat-item">
        <div class="stat-icon">😊</div>
        <div class="stat-num">{{ calendarStore.statsOverview.moodCount }}</div>
        <div class="stat-label">心情</div>
      </div>
      <div class="stat-item">
        <div class="stat-icon">📝</div>
        <div class="stat-num">{{ calendarStore.statsOverview.diaryCount }}</div>
        <div class="stat-label">日记</div>
      </div>
    </div>

    <!-- 功能菜单 -->
    <div class="menu-section">
      <h3 class="section-title">功能设置</h3>

      <div class="menu-list">
        <div class="menu-item" @click="showAISettings = true">
          <span class="menu-icon">🤖</span>
          <span class="menu-text">AI角色绑定</span>
          <span class="menu-arrow">›</span>
        </div>

        <div class="menu-item" @click="showCountdownModal = true">
          <span class="menu-icon">⏰</span>
          <span class="menu-text">倒计时管理</span>
          <span class="menu-badge">{{ countdownCount }}</span>
          <span class="menu-arrow">›</span>
        </div>

        <div class="menu-item" @click="showDiaryModal = true">
          <span class="menu-icon">📔</span>
          <span class="menu-text">我的日记</span>
          <span class="menu-arrow">›</span>
        </div>
      </div>
    </div>

    <!-- 提醒设置 -->
    <div class="menu-section">
      <h3 class="section-title">提醒设置</h3>

      <div class="menu-list">
        <div class="menu-item toggle">
          <span class="menu-icon">🌙</span>
          <span class="menu-text">经期提醒</span>
          <label class="toggle-switch">
            <input type="checkbox" v-model="reminderSettings.enabled" @change="updateReminders">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="menu-item toggle" v-if="reminderSettings.enabled">
          <span class="menu-icon">⏰</span>
          <span class="menu-text">提前提醒(天)</span>
          <select v-model="reminderSettings.remindBefore" @change="updateReminders" class="remind-select">
            <option :value="1">1天</option>
            <option :value="2">2天</option>
            <option :value="3">3天</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="menu-section">
      <h3 class="section-title">数据管理</h3>

      <div class="menu-list">
        <div class="menu-item" @click="exportData">
          <span class="menu-icon">📤</span>
          <span class="menu-text">导出数据</span>
          <span class="menu-arrow">›</span>
        </div>

        <div class="menu-item danger" @click="clearAllData">
          <span class="menu-icon">🗑️</span>
          <span class="menu-text">清除所有数据</span>
          <span class="menu-arrow">›</span>
        </div>
      </div>
    </div>

    <!-- 帮助入口 -->
    <div class="menu-section">
      <h3 class="section-title">帮助</h3>

      <div class="menu-list">
        <div class="menu-item" @click="goToHelp">
          <span class="menu-icon">�</span>
          <span class="menu-text">使用帮助</span>
          <span class="menu-arrow">›</span>
        </div>
      </div>
    </div>

    <!-- 版本信息 -->
    <div class="version-info">
      <p>花间日历 v1.0.0</p>
      <p class="slogan">记录生活，珍藏时光</p>
    </div>

    <!-- 弹窗 -->
    <AISettingsModal v-if="showAISettings" @close="showAISettings = false" />
    <CountdownManagerModal v-if="showCountdownModal" @close="showCountdownModal = false" />
    <DiaryModal v-if="showDiaryModal" :date="todayStr" @close="showDiaryModal = false" @save="saveDiary" />

    <!-- 头像编辑弹窗 -->
    <div v-if="showAvatarEdit" class="modal-overlay" @click="showAvatarEdit = false">
      <div class="modal-content" @click.stop>
        <h3>修改头像</h3>
        <div class="avatar-preview" v-if="tempAvatar">
          <img :src="tempAvatar" alt="preview">
        </div>
        <div class="avatar-options">
          <button class="option-btn" @click="triggerFileUpload">
            📁 本地上传
          </button>
          <button class="option-btn" @click="showUrlInput = true">
            🔗 URL链接
          </button>
        </div>
        <div v-if="showUrlInput" class="url-input-section">
          <input v-model="avatarUrl" placeholder="输入图片URL" class="url-input">
          <button class="confirm-btn" @click="loadAvatarFromUrl">加载</button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" @change="handleFileUpload" style="display: none">
        <div class="modal-actions">
          <button class="cancel-btn" @click="showAvatarEdit = false">取消</button>
          <button class="save-btn" @click="saveAvatar" :disabled="!tempAvatar">保存</button>
        </div>
      </div>
    </div>

    <!-- 昵称编辑弹窗 -->
    <div v-if="showNameEdit" class="modal-overlay" @click="showNameEdit = false">
      <div class="modal-content" @click.stop>
        <h3>修改昵称</h3>
        <input v-model="tempName" placeholder="输入昵称" class="name-input" maxlength="20">
        <div class="modal-actions">
          <button class="cancel-btn" @click="showNameEdit = false">取消</button>
          <button class="save-btn" @click="saveName">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '../../../stores/calendarStore'
import AISettingsModal from './AISettingsModal.vue'
import CountdownManagerModal from './CountdownManagerModal.vue'
import DiaryModal from './DiaryModal.vue'

const router = useRouter()
const calendarStore = useCalendarStore()

const showAISettings = ref(false)
const showCountdownModal = ref(false)
const showDiaryModal = ref(false)

// 用户资料
const userProfile = ref({
  name: '',
  avatar: ''
})

// 头像编辑
const showAvatarEdit = ref(false)
const showUrlInput = ref(false)
const tempAvatar = ref('')
const avatarUrl = ref('')
const fileInput = ref(null)

// 昵称编辑
const showNameEdit = ref(false)
const tempName = ref('')

const todayStr = computed(() => calendarStore.formatDateStr(new Date()))
const countdownCount = computed(() => calendarStore.countdowns.length)

// 提醒设置
const reminderSettings = ref({
  enabled: calendarStore.periodReminders?.enabled ?? true,
  remindBefore: calendarStore.periodReminders?.remindBefore ?? 2
})

// 加载用户资料
onMounted(() => {
  const saved = localStorage.getItem('calendar_user_profile')
  if (saved) {
    userProfile.value = JSON.parse(saved)
  }
})

// 保存用户资料
function saveUserProfile() {
  localStorage.setItem('calendar_user_profile', JSON.stringify(userProfile.value))
}

// 触发文件上传
function triggerFileUpload() {
  fileInput.value?.click()
}

// 处理文件上传
function handleFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过5MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    tempAvatar.value = e.target.result
  }
  reader.readAsDataURL(file)
}

// 从URL加载头像
function loadAvatarFromUrl() {
  if (!avatarUrl.value) return
  tempAvatar.value = avatarUrl.value
  showUrlInput.value = false
}

// 保存头像
function saveAvatar() {
  if (tempAvatar.value) {
    userProfile.value.avatar = tempAvatar.value
    saveUserProfile()
  }
  showAvatarEdit.value = false
  tempAvatar.value = ''
  avatarUrl.value = ''
}

// 保存昵称
function saveName() {
  if (tempName.value.trim()) {
    userProfile.value.name = tempName.value.trim()
    saveUserProfile()
  }
  showNameEdit.value = false
}

// 打开昵称编辑时初始化
function openNameEdit() {
  tempName.value = userProfile.value.name || ''
  showNameEdit.value = true
}

// 跳转到帮助页面
function goToHelp() {
  router.push('/calendar/help')
}

function updateReminders() {
  calendarStore.updatePeriodReminderSettings({
    enabled: reminderSettings.value.enabled,
    remindBefore: reminderSettings.value.remindBefore
  })
}

function saveCountdown(data) {
  calendarStore.addCountdown(data)
  showCountdownModal.value = false
}

function saveDiary(data) {
  calendarStore.saveDiary(todayStr.value, data.content, data.tags)
  showDiaryModal.value = false
}

function exportData() {
  const data = {
    events: calendarStore.events,
    periodData: calendarStore.periodData,
    moodRecords: calendarStore.moodRecords,
    countdowns: calendarStore.countdowns,
    sleepRecords: calendarStore.sleepRecords,
    waterRecords: calendarStore.waterRecords,
    diaries: calendarStore.diaries,
    userProfile: userProfile.value,
    exportDate: new Date().toISOString()
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calendar_backup_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)

  alert('数据已导出！')
}

function clearAllData() {
  if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
    localStorage.removeItem('calendar_data')
    localStorage.removeItem('calendar_user_profile')
    location.reload()
  }
}
</script>

<style scoped>
.profile-page {
  padding-bottom: 20px;
}

/* 用户卡片 */
.profile-card {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.4), rgba(197, 201, 255, 0.4));
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-avatar {
  position: relative;
  cursor: pointer;
}

.user-avatar .avatar-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.15);
}

.user-avatar .avatar-img {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.15);
}

.avatar-edit-hint {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border: 2px solid white;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 4px 0;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.user-name:hover {
  background: rgba(255, 255, 255, 0.3);
}

.user-bio {
  font-size: 13px;
  color: #8b7aa8;
  margin: 0;
}

/* 统计概览 */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  background: white;
  border-radius: 16px;
  padding: 16px 8px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(139, 122, 168, 0.08);
}

.stat-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #5a5a7a;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: #9a8fb8;
  margin-top: 4px;
}

/* 菜单区块 */
.menu-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #9a8fb8;
  margin: 0 0 8px 12px;
  text-transform: uppercase;
}

.menu-list {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(139, 122, 168, 0.08);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
  cursor: pointer;
  transition: background 0.2s ease;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:active {
  background: rgba(139, 122, 168, 0.05);
}

.menu-item.danger {
  color: #ff6b9d;
}

.menu-item.danger .menu-icon {
  color: #ff6b9d;
}

.menu-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-right: 12px;
}

.menu-text {
  flex: 1;
  font-size: 14px;
  color: #5a5a7a;
}

.menu-arrow {
  font-size: 18px;
  color: #c5c9ff;
}

.menu-badge {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-right: 8px;
}

/* 开关 */
.toggle-switch {
  position: relative;
  width: 50px;
  height: 28px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e0e0e0;
  border-radius: 28px;
  transition: 0.3s;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
}

input:checked+.toggle-slider {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
}

input:checked+.toggle-slider:before {
  transform: translateX(22px);
}

.remind-select {
  padding: 4px 10px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 8px;
  background: white;
  color: #5a5a7a;
  font-size: 13px;
}

/* 帮助内容 */
.help-content {
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(139, 122, 168, 0.08);
}

.help-section {
  margin-bottom: 16px;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 8px 0;
}

.help-section p {
  font-size: 13px;
  color: #8b7aa8;
  margin: 4px 0;
  line-height: 1.5;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item.full-width {
  flex-direction: column;
  align-items: flex-start;
}

.label {
  font-size: 13px;
  color: #9a8fb8;
  margin-bottom: 4px;
}

.value {
  font-size: 14px;
  color: #5a5a7a;
}

.highlight {
  color: #ff6b9d;
}

/* 运势 */
.fortune-grid {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.fortune-grid::-webkit-scrollbar {
  display: none;
}

.fortune-item {
  flex: 0 0 auto;
  min-width: 60px;
  text-align: center;
  padding: 10px 8px;
  background: rgba(139, 122, 168, 0.05);
  border-radius: 10px;
}

/* 版本信息 */
.version-info {
  text-align: center;
  padding: 24px;
  color: #9a8fb8;
}

.version-info p {
  margin: 0;
  font-size: 13px;
}

.version-info .slogan {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.8;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 24px;
  width: 100%;
  max-width: 320px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-content h3 {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 20px 0;
  text-align: center;
}

/* 头像预览 */
.avatar-preview {
  width: 120px;
  height: 120px;
  margin: 0 auto 20px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #ffb7c5;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 头像选项 */
.avatar-options {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.option-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  background: white;
  color: #5a5a7a;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.option-btn:hover {
  background: rgba(255, 183, 197, 0.1);
  border-color: #ffb7c5;
}

/* URL输入 */
.url-input-section {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.url-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 10px;
  font-size: 14px;
}

.confirm-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 14px;
  cursor: pointer;
}

/* 昵称输入 */
.name-input {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 10px;
  font-size: 16px;
  margin-bottom: 20px;
  box-sizing: border-box;
}

/* 弹窗按钮 */
.modal-actions {
  display: flex;
  gap: 12px;
}

.modal-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  border: 1px solid rgba(139, 122, 168, 0.3);
  background: white;
  color: #8b7aa8;
}

.save-btn {
  border: none;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
