<template>
  <div class="love-space-app">
    <!-- 顶部羁绊区 -->
    <div class="love-header">
      <div class="avatar-group">
        <div class="avatar-wrapper user">
          <img :src="userAvatar" class="avatar" alt="用户">
          <div class="avatar-ring"></div>
        </div>
        <div class="love-connector">
          <div class="heart-line">
            <i class="fa-solid fa-heart heartbeat"></i>
          </div>
        </div>
        <div class="avatar-wrapper partner">
          <img :src="partnerAvatar" class="avatar" alt="角色">
          <div class="avatar-ring"></div>
        </div>
      </div>
      <div class="love-days">
        <div class="days-count">💕 相恋第 {{ loveDays }} 天</div>
        <div class="desktop-widget-toggle">
          <label class="toggle-container">
            <input type="checkbox" v-model="applyToDesktop">
            <span class="checkmark"></span>
            <span class="label-text">同步到桌面小组件</span>
          </label>
        </div>
        <div class="next-countdown" v-if="nextAnniversary">
          距离{{ nextAnniversary.name }}还有 {{ nextAnniversary.days }} 天
        </div>
      </div>
    </div>

    <!-- 功能网格 -->
    <div class="function-grid">
      <!-- 甜蜜留言 -->
      <div class="func-card" @click="openModule('message')">
        <div class="func-icon" style="background: linear-gradient(135deg, #ffecd2, #fcb69f);">
          💌
        </div>
        <div class="func-name">甜蜜留言</div>
      </div>

      <!-- 交换日记 -->
      <div class="func-card" @click="openModule('diary')">
        <div class="func-icon" style="background: linear-gradient(135deg, #a8edea, #fed6e3);">
          📔
        </div>
        <div class="func-name">交换日记</div>
      </div>

      <!-- 纪念日 -->
      <div class="func-card" @click="openModule('anniversary')">
        <div class="func-icon" style="background: linear-gradient(135deg, #ff9a9e, #fecfef);">
          🎉
        </div>
        <div class="func-name">纪念日</div>
      </div>

      <!-- 角色足迹 -->
      <div class="func-card" @click="openModule('footprint')">
        <div class="func-icon" style="background: linear-gradient(135deg, #a18cd1, #fbc2eb);">
          👣
        </div>
        <div class="func-name">一日足迹</div>
      </div>

      <!-- 便利贴 -->
      <div class="func-card" @click="openModule('sticky')">
        <div class="func-icon" style="background: linear-gradient(135deg, #ffecd2, #fcb69f);">
          📝
        </div>
        <div class="func-name">便利贴</div>
      </div>

      <!-- 写信 -->
      <div class="func-card" @click="openModule('letter')">
        <div class="func-icon" style="background: linear-gradient(135deg, #e0c3fc, #8ec5fc);">
          ✉️
        </div>
        <div class="func-name">写信</div>
      </div>

      <!-- 两人小屋 -->
      <div class="func-card" @click="openModule('house')">
        <div class="func-icon" style="background: linear-gradient(135deg, #fad0c4, #ffd1ff);">
          🏠
        </div>
        <div class="func-name">两人小屋</div>
      </div>

      <!-- 灵魂提问 -->
      <div class="func-card" @click="openModule('question')">
        <div class="func-icon" style="background: linear-gradient(135deg, #a8edea, #fed6e3);">
          ❓
        </div>
        <div class="func-name">灵魂提问</div>
      </div>

      <!-- 相册 -->
      <div class="func-card" @click="openModule('album')">
        <div class="func-icon" style="background: linear-gradient(135deg, #ff9a9e, #fecfef);">
          📷
        </div>
        <div class="func-name">相册</div>
      </div>

      <!-- 扭蛋机 -->
      <div class="func-card" @click="openModule('gacha')">
        <div class="func-icon" style="background: linear-gradient(135deg, #fbc2eb, #a6c1ee);">
          🎰
        </div>
        <div class="func-name">扭蛋机</div>
      </div>
    </div>

    <!-- 一键生成按钮 -->
    <button class="magic-generate" @click="generateContent" title="魔法生成">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      <span>魔法生成</span>
    </button>

    <!-- 角色选择/邀请弹窗 -->
    <div v-if="showRoleModal" class="role-modal-overlay" @click.self="closeRoleModal">
      <div class="role-modal">
        <h3>💕 选择你的 TA</h3>
        <p class="modal-desc">首次开通需要向角色申请哦~</p>
        <div class="role-list">
          <div 
            v-for="role in availableRoles" 
            :key="role.id"
            class="role-item"
            :class="{ selected: selectedRole?.id === role.id }"
            @click="selectRole(role)">
            <img :src="role.avatar || '/avatars/default.jpg'" class="role-avatar" :alt="role.name">
            <div class="role-info">
              <div class="role-name">{{ role.name }}</div>
              <div class="role-remark">{{ role.remark }}</div>
            </div>
            <div v-if="selectedRole?.id === role.id" class="selected-mark">✓</div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closeRoleModal">取消</button>
          <button class="confirm-btn" @click="confirmRole" :disabled="!selectedRole">
            💌 发送邀请
          </button>
        </div>
      </div>
    </div>

    <!-- 邀请卡片（微信聊天） -->
    <div v-if="showInviteCard" class="invite-card-wrapper">
      <div class="invite-card">
        <div class="card-header">
          <div class="envelope-icon">💌</div>
          <h3>情侣空间邀请</h3>
        </div>
        <div class="card-content">
          <p class="invite-text">
            💕 我想和你开通专属情侣空间<br>
            记录我们的甜蜜时光
          </p>
          <div class="invite-preview">
            <div class="preview-avatars">
              <img :src="userAvatar" class="preview-avatar" alt="用户">
              <i class="fa-solid fa-heart"></i>
              <img :src="selectedRole?.avatar || '/avatars/default.jpg'" class="preview-avatar" :alt="selectedRole?.name">
            </div>
          </div>
        </div>
        <div class="card-actions">
          <button class="accept-btn" @click="acceptInvite">
            <i class="fa-solid fa-heart"></i> 同意开通
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'

const router = useRouter()
const chatStore = useChatStore()
const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()

// 状态
// 状态
const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg')
const partnerAvatar = computed(() => loveSpaceStore.partner?.avatar || '/avatars/default.jpg')
const loveDays = computed(() => loveSpaceStore.loveDays)
const nextAnniversary = computed(() => loveSpaceStore.nextAnniversary)
const showRoleModal = ref(false)
const showInviteCard = ref(false)
const selectedRole = ref(null)
const currentModule = ref('')
const applyToDesktop = computed({
  get: () => loveSpaceStore.applyToDesktop,
  set: (val) => {
    loveSpaceStore.applyToDesktop = val
    loveSpaceStore.saveToStorage()
  }
})

// 可用角色列表（从微信通讯录获取）
const availableRoles = computed(() => {
  const contacts = chatStore.contactList || []
  // 排除群聊和用户自己
  return contacts.filter(contact => {
    return !contact.isGroup && contact.id !== 'user'
  }).map(contact => ({
    id: contact.id,
    name: contact.name,
    remark: contact.remark || contact.name,
    avatar: contact.avatar
  }))
})

// 方法
function openModule(moduleName) {
  currentModule.value = moduleName
  router.push(`/couple/${moduleName}`)
}

function selectRole(role) {
  selectedRole.value = role
}

function closeRoleModal() {
  showRoleModal.value = false
  selectedRole.value = null
}

function confirmRole() {
  if (!selectedRole.value) return
  
  // 保存角色选择到 store
  loveSpaceStore.partner = {
    id: selectedRole.value.id,
    name: selectedRole.value.name,
    avatar: selectedRole.value.avatar
  }
  partnerAvatar.value = selectedRole.value.avatar
  
  // 关闭弹窗
  showRoleModal.value = false
  
  // 发送到微信聊天并跳转
  sendInviteToChat()
}

function sendInviteToChat() {
  const partnerMatch = availableRoles.value.find(r => r.id === selectedRole.value.id)
  if (!partnerMatch) return

  // 1. 发送带有特殊指令的消息
  chatStore.addMessage(selectedRole.value.id, {
    role: 'user',
    content: `[LOVESPACE_INVITE:${selectedRole.value.id}]`,
    skipAI: false // 让 AI 响应
  });

  // 2. 触发 AI 响应以模拟“对方也想开通”
  chatStore.sendMessageToAI(selectedRole.value.id, {
    hiddenHint: `用户向你发送了情侣空间开通邀请，你非常开心并期待，请你以惊喜、甜蜜的语气回应，并表示非常愿意。回复的内容中严禁包含任何 [LOVESPACE_INVITE] 标签，只需普通表白即可。`
  });

  // 3. 跳转到聊天窗口
  chatStore.currentChatId = selectedRole.value.id;
  router.push('/wechat');
}

function acceptInvite() {
  // 同意开通
  showInviteCard.value = false
  
  // 初始化情侣空间
  initLoveSpace()
  
  // 显示契约达成卡片
  showContractCard()
}

function initLoveSpace() {
  const spaceData = {
    initialized: true,
    partner: selectedRole.value,
    startDate: new Date().toISOString(),
    loveDays: 0,
    diary: [],
    messages: [],
    anniversaries: [],
    footprints: [],
    stickies: [],
    letters: [],
    house: {},
    questions: [],
    album: [],
    gachaHistory: []
  }
  
  localStorage.setItem('loveSpace', JSON.stringify(spaceData))
  calculateLoveDays()
}

function showContractCard() {
  // TODO: 显示契约达成卡片
  alert('💕 契约达成！情侣空间已开通~')
}

function calculateLoveDays() {
  const spaceData = loveSpaceData.value
  if (!spaceData.startDate) return
  
  const start = new Date(spaceData.startDate)
  const now = new Date()
  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  loveDays.value = diff
}

function generateContent() {
  // TODO: AI 生成内容逻辑
  alert('✨ 正在施展魔法生成中...')
}

onMounted(async () => {
  // 1. Ensure store is loaded from forage
  await loveSpaceStore.loadFromStorage()

  const urlParams = new URLSearchParams(window.location.search);
  const charIdFromUrl = urlParams.get('char');

  // 2. Check if we are coming from a chat card to "ACCEPT/START"
  if (charIdFromUrl && !loveSpaceStore.initialized) {
    const partner = availableRoles.value.find(r => r.id === charIdFromUrl);
    if (partner) {
      loveSpaceStore.partner = partner;
      await loveSpaceStore.initSpace();
      
      // Send a "Contract Reached" message to chat
      chatStore.addMessage(charIdFromUrl, {
        role: 'system',
        content: `[LOVESPACE_CONTRACT:1]`,
        skipAI: true
      });
      
      // Clear URL params without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // 3. Regular status check
  if (loveSpaceStore.initialized) {
    partnerAvatar.value = loveSpaceStore.partner?.avatar || ''
    calculateLoveDays()
  } else {
    // 第一次打开，检查是否有可用角色
    if (availableRoles.value.length === 0) {
      // 没有角色，提示用户先添加好友
      chatStore.triggerToast('请先在微信通讯录中添加好友，然后再来开通哦~', 'warn')
      router.push('/wechat')
    } else {
      // 显示角色选择
      showRoleModal.value = true
    }
  }
})
</script>

<style scoped>
.love-space-app {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff5f7 0%, #ffe6eb 100%);
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 顶部羁绊区 */
.love-header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(255, 182, 193, 0.3);
}

.avatar-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 16px;
}

.avatar-wrapper {
  position: relative;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatar-ring {
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border-radius: 50%;
  border: 2px dashed #ffb7c5;
  animation: spin 10s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.love-connector {
  display: flex;
  align-items: center;
}

.heart-line {
  font-size: 32px;
  color: #ff6b9d;
}

.heartbeat {
  animation: heartbeat 1.5s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.love-days {
  text-align: center;
}

.days-count {
  font-size: 18px;
  font-weight: 600;
  color: #ff6b9d;
  margin-bottom: 4px;
}

.next-countdown {
  font-size: 11px;
  color: #8b7aa8;
  margin-top: 8px;
  background: rgba(255, 255, 255, 0.5);
  padding: 4px 12px;
  border-radius: 20px;
  display: inline-block;
}

/* 桌面组件开关 */
.desktop-widget-toggle {
  margin: 8px 0;
  display: flex;
  justify-content: center;
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: #a89bb9;
}

.toggle-container input {
  display: none;
}

.checkmark {
  width: 16px;
  height: 16px;
  border: 1.5px solid #ffb7c5;
  border-radius: 4px;
  position: relative;
  transition: all 0.2s;
  background: white;
}

.toggle-container input:checked + .checkmark {
  background: #ff6b9d;
  border-color: #ff6b9d;
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
  left: 4.5px;
  top: 1.5px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.toggle-container input:checked + .checkmark:after {
  display: block;
}

.label-text {
  font-weight: 500;
}

/* 功能网格 */
.function-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.func-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(255, 182, 193, 0.2);
  transition: transform 0.2s;
  cursor: pointer;
}

.func-card:hover {
  transform: translateY(-4px);
}

.func-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin: 0 auto 8px;
}

.func-name {
  font-size: 13px;
  color: #5a5a7a;
  font-weight: 500;
}

/* 魔法生成按钮 */
.magic-generate {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border: none;
  border-radius: 50px;
  padding: 14px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(255, 107, 157, 0.4);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: transform 0.2s;
}

.magic-generate:hover {
  transform: scale(1.05);
}

/* 角色选择弹窗 */
.role-modal-overlay {
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
}

.role-modal {
  background: white;
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.role-modal h3 {
  font-size: 20px;
  color: #ff6b9d;
  margin-bottom: 8px;
  text-align: center;
}

.modal-desc {
  font-size: 13px;
  color: #8b7aa8;
  text-align: center;
  margin-bottom: 20px;
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.role-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 2px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

.role-item:hover {
  border-color: #ffb7c5;
  background: #fff5f7;
}

.role-item.selected {
  border-color: #ff6b9d;
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(255, 183, 197, 0.1));
}

.role-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.role-info {
  flex: 1;
}

.role-name {
  font-size: 15px;
  font-weight: 600;
  color: #5a5a7a;
}

.role-remark {
  font-size: 12px;
  color: #8b7aa8;
  margin-top: 2px;
}

.selected-mark {
  color: #ff6b9d;
  font-size: 20px;
  font-weight: bold;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.confirm-btn {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 邀请卡片 */
.invite-card-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.invite-card {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 360px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(255, 107, 157, 0.3);
}

.card-header {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  padding: 20px;
  text-align: center;
}

.envelope-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.card-header h3 {
  font-size: 18px;
  margin: 0;
}

.card-content {
  padding: 24px;
}

.invite-text {
  font-size: 15px;
  color: #5a5a7a;
  line-height: 1.6;
  margin-bottom: 20px;
}

.invite-preview {
  background: #fff5f7;
  border-radius: 12px;
  padding: 16px;
}

.preview-avatars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 24px;
  color: #ff6b9d;
}

.preview-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.card-actions {
  padding: 16px;
  background: #fafafa;
}

.accept-btn {
  width: 100%;
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
