<template>
  <div class="love-space-app">
    <!-- 1. 角色列表选择器 (Selector Mode) -->
    <div v-if="!loveSpaceStore.currentPartnerId" class="space-selector-view animate-fade-in">
      <div class="selector-header">
        <div class="app-icon-wrapper">
          <i class="fa-solid fa-heart-pulse"></i>
        </div>
        <h1 class="selector-title">情侣空间</h1>
        <p class="selector-subtitle">选择进入与 TA 的专属记忆</p>
      </div>

      <div class="selector-list">
        <div 
          v-for="role in availableRoles" 
          :key="role.id" 
          class="role-card"
          @click="handleSelectSpace(role)">
          <div class="role-avatar-wrapper">
            <img :src="role.avatar || '/avatars/default.jpg'" class="role-avatar" :alt="role.name">
            <div class="online-status"></div>
          </div>
          <div class="role-details">
            <div class="role-name-row">
              <span class="role-name">{{ role.name }}</span>
              <span v-if="getSpaceStatus(role.id)" class="status-tag">已结契</span>
            </div>
            <div class="role-remark">{{ role.remark }}</div>
          </div>
          <i class="fa-solid fa-chevron-right arrow-icon"></i>
        </div>
      </div>

      <div class="selector-footer">
        <button class="back-home-btn" @click="router.push('/')">
          <i class="fa-solid fa-house"></i> 回到主界面
        </button>
      </div>
    </div>

    <!-- 2. 专属空间展示 (Active Space Mode) -->
    <div v-else class="active-space-view animate-fade-in">
      <!-- 顶部导航栏 -->
      <div class="space-nav">
        <button class="nav-back-btn" @click="exitSpace">
          <i class="fa-solid fa-chevron-left"></i> 列表
        </button>
        <span class="nav-title">{{ partnerName }} 的空间</span>
        <button class="nav-magic-btn" @click="generateContent" :disabled="isMagicGenerating" title="魔法生成">
          <i class="fa-solid fa-wand-magic-sparkles" :class="{ 'fa-spin': isMagicGenerating }"></i>
        </button>
      </div>

      <div class="space-content">
        <!-- 顶部羁绊区 -->
        <div class="love-header" v-if="loveSpaceStore.initialized">
          <div class="avatar-group">
            <div class="avatar-wrapper user">
              <img :src="userAvatar" class="avatar" alt="用户">
            </div>
            <div class="love-connector">
              <div class="heart-line">
                <i class="fa-solid fa-heart heartbeat"></i>
              </div>
            </div>
            <div class="avatar-wrapper partner">
              <img :src="partnerAvatar" class="avatar" alt="角色">
            </div>
          </div>
          <div class="love-days-content">
            <div class="days-count" @click="showDateEditor = !showDateEditor" title="点击设置或重置">
              💕 相恋第 {{ loveDays }} 天
              <i class="fa-solid fa-gear edit-icon" :class="{ 'active': showDateEditor }"></i>
            </div>
            
            <div v-if="showDateEditor" class="date-editor-panel animate-fade-in">
              <div class="editor-header">空间管理</div>
              <div class="editor-row">
                <span>相识日期:</span>
                <input type="date" v-model="tempStartDate" @change="updateLoveDate" class="date-input">
              </div>
              <div class="editor-row mt-4">
                <button @click="resetCurrentSpace" class="force-reset-btn">
                  <i class="fa-solid fa-trash-can"></i> 解除绑定并清空空间
                </button>
              </div>
            </div>

            <div class="desktop-sync-row">
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
        
        <!-- 未初始化状态展示 -->
        <div class="love-header empty" v-else @click="showRoleModal = true">
          <div class="avatar-group">
            <div class="avatar-wrapper user">
              <img :src="userAvatar" class="avatar" alt="用户">
            </div>
            <div class="love-connector empty">
              <i class="fa-solid fa-heart text-gray-200"></i>
            </div>
            <div class="avatar-wrapper empty-partner">
              <div class="avatar-placeholder"><i class="fa-solid fa-plus"></i></div>
            </div>
          </div>
          <div class="invite-entry">
            <h3>💕 尚未开通情侣空间</h3>
            <p>✨ 点击发送邀请，开启与 {{ partnerName }} 的专属甜蜜记忆</p>
          </div>
        </div>

        <!-- 功能网格 -->
        <div class="function-grid">
          <div class="func-card" @click="openModule('messages')">
            <div class="func-icon" style="background: linear-gradient(135deg, #ffecd2, #fcb69f);">💌</div>
            <div class="func-name">甜蜜留言</div>
          </div>
          <div class="func-card" @click="openModule('diary')">
            <div class="func-icon" style="background: linear-gradient(135deg, #a8edea, #fed6e3);">📔</div>
            <div class="func-name">交换日记</div>
          </div>
          <div class="func-card" @click="openModule('anniversary')">
            <div class="func-icon" style="background: linear-gradient(135deg, #ff9a9e, #fecfef);">🎉</div>
            <div class="func-name">纪念日</div>
          </div>
          <div class="func-card" @click="openModule('footprint')">
            <div class="func-icon" style="background: linear-gradient(135deg, #a18cd1, #fbc2eb);">👣</div>
            <div class="func-name">一日足迹</div>
          </div>
          <div class="func-card" @click="openModule('sticky')">
            <div class="func-icon" style="background: linear-gradient(135deg, #ffecd2, #fcb69f);">📝</div>
            <div class="func-name">便利贴</div>
          </div>
          <div class="func-card" @click="openModule('letter')">
            <div class="func-icon" style="background: linear-gradient(135deg, #e0c3fc, #8ec5fc);">✉️</div>
            <div class="func-name">写信</div>
          </div>
          <div class="func-card" @click="openModule('house')">
            <div class="func-icon" style="background: linear-gradient(135deg, #fad0c4, #ffd1ff);">🏠</div>
            <div class="func-name">两人小屋</div>
          </div>
          <div class="func-card" @click="openModule('question')">
            <div class="func-icon" style="background: linear-gradient(135deg, #a8edea, #fed6e3);">❓</div>
            <div class="func-name">灵魂提问</div>
          </div>
          <div class="func-card" @click="openModule('album')">
            <div class="func-icon" style="background: linear-gradient(135deg, #ff9a9e, #fecfef);">📷</div>
            <div class="func-name">相册</div>
          </div>
          <div class="func-card" @click="openModule('gacha')">
            <div class="func-icon" style="background: linear-gradient(135deg, #fbc2eb, #a6c1ee);">🎰</div>
            <div class="func-name">扭蛋机</div>
          </div>
        </div>
      </div>


    </div>

    <!-- 角色邀请确认弹窗 -->
    <div v-if="showRoleModal" class="role-modal-overlay" @click.self="showRoleModal = false">
      <div class="role-modal animate-pop-in">
        <div class="modal-seal">💌</div>
        <h3>结契邀请</h3>
        
        <!-- 如果已有选中的角色，直接显示确认步骤 -->
        <div v-if="loveSpaceStore.partner" class="confirmation-step">
          <p class="modal-desc mb-4">要向 <b>{{ loveSpaceStore.partner.remark || loveSpaceStore.partner.name }}</b> 发起情侣空间邀请吗？</p>
          
          <div class="modal-illustration">
             <div class="preview-avatar-box">
               <img :src="loveSpaceStore.partner.avatar || '/avatars/default.jpg'" class="illus-avatar">
               <span class="label">{{ loveSpaceStore.partner.remark || loveSpaceStore.partner.name }}</span>
             </div>
             <div class="illus-heart"><i class="fa-solid fa-heart pulse"></i></div>
             <div class="preview-avatar-box">
               <img :src="userAvatar" class="illus-avatar">
               <span class="label">我</span>
             </div>
          </div>

          <div class="modal-actions-grid">
            <button class="modal-btn secondary" @click="showRoleModal = false">还没准备好</button>
            <button class="modal-btn primary" @click="confirmInvite">发送心动邀请</button>
          </div>
        </div>
        
        <!-- 否则显示角色选择步骤 -->
        <div v-else-if="!showConfirmation" class="role-selector-step">
          <p class="modal-desc mb-4">✨ 选择你想邀请的 TA</p>
          <div class="role-select-grid">
            <div 
              v-for="role in availableRoles" 
              :key="role.id" 
              class="role-option-card"
              :class="{ 'selected': selectedRole?.id === role.id }"
              @click="selectedRole = role">
              <img :src="role.avatar || '/avatars/default.jpg'" class="role-option-avatar" :alt="role.name">
              <span class="role-option-name">{{ role.remark || role.name }}</span>
            </div>
          </div>
          <div class="modal-actions-grid mt-6">
            <button class="modal-btn secondary" @click="showRoleModal = false">取消</button>
            <button class="modal-btn primary" :disabled="!selectedRole" @click="showConfirmation = true">下一步</button>
          </div>
        </div>
        
        <!-- 步骤 2: 确认邀请（当没有预选择角色时） -->
        <div v-else class="confirmation-step">
          <p class="modal-desc mb-4">要向 <b>{{ selectedRole.remark || selectedRole.name }}</b> 发起情侣空间邀请吗？</p>
          
          <div class="modal-illustration">
             <div class="preview-avatar-box">
               <img :src="selectedRole.avatar || '/avatars/default.jpg'" class="illus-avatar">
               <span class="label">{{ selectedRole.remark || selectedRole.name }}</span>
             </div>
             <div class="illus-heart"><i class="fa-solid fa-heart pulse"></i></div>
             <div class="preview-avatar-box">
               <img :src="userAvatar" class="illus-avatar">
               <span class="label">我</span>
             </div>
          </div>

          <div class="modal-actions-grid">
            <button class="modal-btn secondary" @click="showConfirmation = false; selectedRole = null">返回</button>
            <button class="modal-btn primary" @click="confirmInvite">发送心动邀请</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'

const router = useRouter()
const chatStore = useChatStore()
const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()

// --- 状态与计算属性 ---
const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg')
const partnerAvatar = computed(() => loveSpaceStore.partner?.avatar || '/avatars/default.jpg')
const partnerName = computed(() => loveSpaceStore.partner?.name || 'TA')
const loveDays = computed(() => loveSpaceStore.loveDays)
const nextAnniversary = computed(() => loveSpaceStore.nextAnniversary)

const showRoleModal = ref(false)
const showDateEditor = ref(false)
const tempStartDate = ref('')
const isMagicGenerating = ref(false)
const selectedRole = ref(null) // 用户选择的角色
const showConfirmation = ref(false) // 是否显示确认步骤

const applyToDesktop = computed({
  get: () => loveSpaceStore.applyToDesktop,
  set: (val) => {
    if (loveSpaceStore.currentPartnerId) {
      loveSpaceStore.currentSpace.applyToDesktop = val
      loveSpaceStore.saveToStorage()
    }
  }
})

const availableRoles = computed(() => {
  const contacts = chatStore.contactList || []
  return contacts.filter(c => !c.isGroup && c.id !== 'user').map(c => ({
    id: c.id,
    name: c.name,
    remark: c.remark || c.name,
    avatar: c.avatar
  }))
})

// --- 方法 ---
function getSpaceStatus(charId) {
  return loveSpaceStore.spaces[charId]?.initialized
}

async function handleSelectSpace(role) {
  await loveSpaceStore.selectSpace(role.id)
  // 如果空间刚创建且没有伙伴信息，立即补全（为了 UI 显示正确）
  if (!loveSpaceStore.partner) {
    loveSpaceStore.spaces[role.id].partner = JSON.parse(JSON.stringify(role))
  }
  // 同步当前日期编辑器
  if (loveSpaceStore.startDate) {
    tempStartDate.value = loveSpaceStore.startDate.split('T')[0]
  } else {
    tempStartDate.value = new Date().toISOString().split('T')[0]
  }
}

function exitSpace() {
  loveSpaceStore.exitSpace()
}

function openModule(moduleName) {
  console.log(`[LoveSpace] Opening module: ${moduleName}`)
  
  if (!loveSpaceStore.initialized) {
    showRoleModal.value = true
    return
  }

  const routeName = `couple-${moduleName}`
  
  // Verify if route exists to prevent "打不开" (not opening) issues
  const hasRoute = router.hasRoute(routeName)
  if (!hasRoute) {
    console.error(`[LoveSpace] Route ${routeName} not found. Check router configuration.`)
    chatStore.triggerToast('该模块正在快马加鞭研发中... ✨', 'info')
    return
  }

  router.push({ name: routeName })
}

function confirmInvite() {
  // 确定使用哪个角色：优先使用已选择的角色，否则使用选中的角色
  const roleToUse = loveSpaceStore.partner || selectedRole.value
  
  // 添加调试日志和保护
  console.log('[LoveSpaceApp] confirmInvite called:', {
    partner: loveSpaceStore.partner,
    selectedRole: selectedRole.value,
    roleToUse
  })
  
  if (!roleToUse) {
    console.error('[LoveSpaceApp] No role selected!')
    chatStore.triggerToast('请先选择邀请对象', 'error')
    return
  }
  
  if (!roleToUse.id) {
    console.error('[LoveSpaceApp] Role has no ID!', roleToUse)
    chatStore.triggerToast('角色信息不完整，请重试', 'error')
    return
  }
  
  const currentId = roleToUse.id
  
  // 如果没有初始化空间，则初始化
  if (!loveSpaceStore.initialized) {
    loveSpaceStore.initSpace(roleToUse)
  }
  
  // 获取亲密度数据
  const intimacyData = JSON.parse(localStorage.getItem('chat_intimacy_' + currentId) || '{}')
  const intimacy = intimacyData.intimacy || 0
  const level = intimacyData.level || 1

  chatStore.addMessage(currentId, {
    role: 'user',
    content: `[LOVESPACE_INVITE:${currentId}]`,
    skipAI: false
  });

  chatStore.sendMessageToAI(currentId, {
    hiddenHint: `用户【${settingsStore.personalization.userProfile.name}】向你发送了情侣空间邀请。

【亲密度信息】
- 当前亲密度：${intimacy}
- 关系等级：Lv.${level}

【决策规则】
- 如果亲密度 < 100 或 关系等级 < Lv.3，你可以选择拒绝
- 如果亲密度 >= 100 且 关系等级 >= Lv.3，你应该接受

【如果接受】
请你以极度深情、惊喜且甜蜜的口吻接受这个邀请，文字要撩人。
然后添加以下两个协议标签：
1. 绑定指令：[LS_JSON:{"commands":[{"type":"bind","startDate":"${new Date().toISOString().split('T')[0]}","days":0}]}]
2. 契约卡片：[LOVESPACE_CONTRACT:1]

【如果拒绝】
请你以温柔但坚定的语气拒绝，说明理由（比如觉得进展太快、还不够了解等）。
然后添加拒绝协议：[LOVESPACE_REJECT:${currentId}]

示例回复结构：
接受：甜蜜文字 + [LS_JSON:...] + [LOVESPACE_CONTRACT:1]
拒绝：温柔拒绝文字 + [LOVESPACE_REJECT:xxx]`  });

  chatStore.currentChatId = currentId;
  router.push('/wechat');
  showRoleModal.value = false
  selectedRole.value = null
  showConfirmation.value = false
}

function updateLoveDate() {
  if (tempStartDate.value) {
    loveSpaceStore.updateStartDate(new Date(tempStartDate.value).toISOString())
    showDateEditor.value = false
  }
}

async function resetCurrentSpace() {
  chatStore.triggerConfirm(
    '解除绑定',
    '确定要解除绑定并清空所有记录吗？此操作将永久删除你与该角色的所有恋爱记忆，不可撤销。',
    async () => {
      await loveSpaceStore.resetSpace()
      showDateEditor.value = false
      chatStore.triggerToast('空间已重置，记忆已随风而去...', 'info')
    },
    null,
    '确定重置',
    '我再想想'
  )
}

async function generateContent() {
  if (isMagicGenerating.value) return
  isMagicGenerating.value = true
  chatStore.triggerToast('正在为你凝聚恋爱魔法... ✨', 'info')
  try {
    await loveSpaceStore.generateMagicContent()
  } finally {
    isMagicGenerating.value = false
  }
}

onMounted(async () => {
  await loveSpaceStore.loadFromStorage()
  
  const urlParams = new URLSearchParams(window.location.search);
  const charIdFromUrl = urlParams.get('char');

  if (charIdFromUrl) {
    // 直接从 chatStore 获取联系人列表，不依赖 computed
    const contacts = chatStore.contactList || []
    const partner = contacts.find(c => c.id === charIdFromUrl && !c.isGroup && c.id !== 'user')
    
    if (partner) {
      if (!loveSpaceStore.spaces[charIdFromUrl]?.initialized) {
        await loveSpaceStore.initSpace(partner);
        chatStore.addMessage(charIdFromUrl, {
          role: 'system',
          content: `[LOVESPACE_CONTRACT:1]`,
          skipAI: true
        });
      }
      await loveSpaceStore.selectSpace(charIdFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  
  if (loveSpaceStore.startDate) {
    tempStartDate.value = loveSpaceStore.startDate.split('T')[0]
  }
})

watch(() => loveSpaceStore.currentPartnerId, (newId) => {
  if (newId && loveSpaceStore.startDate) {
    tempStartDate.value = loveSpaceStore.startDate.split('T')[0]
  }
})
</script>

<style scoped>
.love-space-app {
  min-height: 100vh;
  background: linear-gradient(180deg, #f0f7ff 0%, #fff0f5 100%);
  display: flex;
  flex-direction: column;
  color: #5a5a7a;
  position: relative;
  overflow-x: hidden;
}

/* 1. 列表选择器样式 */
.space-selector-view {
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.selector-header {
  text-align: center;
  margin-bottom: 40px;
}

.app-icon-wrapper {
  width: 80px;
  height: 80px;
  background: white;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: #ff6b9d;
  margin: 0 auto 20px;
  box-shadow: 0 10px 25px rgba(255, 107, 157, 0.2);
}

.selector-title {
  font-size: 30px;
  font-weight: 900;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.selector-subtitle {
  font-size: 14px;
  color: #8b7aa8;
}

.selector-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 30px;
}

.role-card {
  background: white;
  padding: 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
}

.role-card:active { transform: scale(0.96); background: #fff8fa; }

.role-avatar-wrapper { position: relative; }
.role-avatar {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  object-fit: cover;
  border: 4px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.06);
}
.online-status {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 14px;
  height: 14px;
  background: #4cd964;
  border: 3px solid white;
  border-radius: 50%;
}

.role-details { flex: 1; }
.role-name-row { display: flex; align-items: center; gap: 8px; }
.role-name { font-size: 18px; font-weight: 700; color: #7c4dff; }
.status-tag {
  font-size: 10px;
  padding: 2px 8px;
  background: #ff6b9d15;
  color: #ff6b9d;
  border-radius: 20px;
  font-weight: 800;
}
.role-remark { font-size: 12px; color: #a89bb9; margin-top: 2px; }
.arrow-icon { color: #eee; font-size: 14px; }

.selector-footer { padding: 20px 0; }
.back-home-btn {
  width: 100%;
  background: white;
  border: none;
  padding: 16px;
  border-radius: 100px;
  font-size: 16px;
  font-weight: 700;
  color: #5a5a7a;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

/* 2. 活跃空间视图样式 */
.active-space-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.space-nav {
  padding: 15px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.nav-back-btn {
  background: white;
  border: none;
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 700;
  color: #5a5a7a;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.nav-title {
  text-align: center;
  font-weight: 900;
  font-size: 15px;
}

.nav-magic-btn {
  background: white;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #ff6b9d;
  box-shadow: 0 2px 8px rgba(255,107,157,0.15);
  cursor: pointer;
}

.space-content {
  padding: 0 20px 100px;
  flex: 1;
  overflow-y: auto;
}

.love-header {
  background: white;
  border-radius: 28px;
  padding: 24px;
  margin: 10px 0 20px;
  box-shadow: 0 12px 30px rgba(255, 182, 193, 0.2);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.love-header.empty {
  border: 2px dashed #ffb7c5;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 40px 24px;
}

.avatar-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.avatar {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid white;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
}

.love-connector { font-size: 26px; color: #ff6b9d; }
.heartbeat { animation: heartbeat 1.5s infinite; }

.love-days-content { text-align: center; }
.days-count {
  font-size: 20px;
  font-weight: 900;
  color: #ff6b9d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}
.edit-icon { font-size: 14px; opacity: 0.2; transition: 0.3s; }
.edit-icon.active { transform: rotate(90deg); opacity: 0.8; }

.desktop-sync-row { margin-top: 10px; display: flex; justify-content: center; }
.toggle-container { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a89bb9; cursor: pointer; }
.toggle-container input { display: none; }
.checkmark { width: 16px; height: 16px; border: 1.5px solid #ffb7c5; border-radius: 4px; position: relative; background: white; }
.toggle-container input:checked + .checkmark { background: #ff6b9d; border-color: #ff6b9d; }
.checkmark:after { content: ""; position: absolute; display: none; left: 4px; top: 1px; width: 5px; height: 8px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.toggle-container input:checked + .checkmark:after { display: block; }

.next-countdown {
  font-size: 11px;
  color: #ffb7c5;
  background: #fff5f7;
  padding: 4px 15px;
  border-radius: 100px;
  display: inline-block;
  margin-top: 10px;
}

.function-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.func-card {
  background: white;
  border-radius: 20px;
  padding: 16px 10px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(255, 182, 193, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}
.func-card:active { transform: translateY(2px); background: #fffafb; }
.func-icon { width: 48px; height: 48px; border-radius: 14px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.func-name { font-size: 12px; font-weight: 700; color: #5a5a7a; }

.magic-generate {
  position: fixed;
  bottom: 40px;
  right: 30px;
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 100px;
  box-shadow: 0 10px 25px rgba(255, 107, 157, 0.4);
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 100;
}

/* 3. 弹窗样式 (FIXED MISSING) */
.role-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.role-modal {
  background: white;
  width: 100%;
  max-width: 320px;
  border-radius: 30px;
  padding: 30px 24px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0,0,0,0.2);
  position: relative;
}

.modal-seal { font-size: 40px; margin-bottom: 5px; }
.role-modal h3 { font-size: 22px; font-weight: 900; color: #ff6b9d; margin-bottom: 10px; }
.modal-desc { font-size: 14px; color: #8b7aa8; margin-bottom: 25px; line-height: 1.5; }
.modal-desc b { color: #ff6b9d; }

.modal-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 30px;
}
.preview-avatar-box { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.preview-avatar-box .label { font-size: 11px; font-weight: 700; color: #a89bb9; }
.illus-avatar { width: 55px; height: 55px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.illus-heart { font-size: 24px; color: #ff6b9d; }

/* 角色选择网格 */
.role-select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
}
.role-option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: 16px;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}
.role-option-card:hover {
  background: #fff0f5;
  transform: translateY(-2px);
}
.role-option-card.selected {
  background: #fff0f5;
  border-color: #ff6b9d;
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.2);
}
.role-option-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.role-option-name {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-actions-grid { display: flex; flex-direction: column; gap: 12px; }
.modal-btn { padding: 14px; border-radius: 100px; border: none; font-weight: 800; font-size: 15px; cursor: pointer; transition: 0.2s; }
.modal-btn.primary { background: #ff6b9d; color: white; box-shadow: 0 4px 15px rgba(255, 107, 157, 0.3); }
.modal-btn.secondary { background: #f5f5f5; color: #a89bb9; }

/* 动画 */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.7; } }

.animate-fade-in { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.animate-pop-in { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes popIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }

/* 日期编辑器 */
.date-editor-panel {
  background: white;
  border: 1px solid #ffecf0;
  padding: 20px;
  border-radius: 20px;
  margin: 15px 0;
  box-shadow: 0 10px 25px rgba(255, 107, 157, 0.1);
}
.editor-header { font-size: 13px; font-weight: 800; text-align: left; margin-bottom: 15px; color: #8b7aa8; border-bottom: 1px solid #fefefe; }
.editor-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
.date-input { border: 1.5px solid #ffecf0; border-radius: 8px; padding: 6px 12px; color: #ff6b9d; font-family: inherit; font-size: 12px; background: #fffafa; }
.force-reset-btn { width: 100%; margin-top: 15px; padding: 12px; background: #fff1f0; border: 1px solid #ffa39e; color: #ff4d4f; border-radius: 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
</style>
