<template>
  <div class="search-view">
    <!-- 动态背景 -->
    <div class="background" :style="{ backgroundImage: `url(${bgImage})` }"></div>
    <div class="overlay"></div>
    
    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="time">{{ currentTime }}</div>
      <div class="icons">
        <i class="fa-solid fa-signal"></i>
        <i class="fa-solid fa-wifi"></i>
        <i class="fa-solid fa-battery-full"></i>
      </div>
    </div>
    
    <!-- 标题 -->
    <div class="header">
      <div class="icon-wrapper">
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>
      <h1 class="title">查手机</h1>
      <p class="subtitle">选择要查看的角色</p>
    </div>
    
    <!-- 搜索框 -->
    <div class="search-bar">
      <i class="fa-solid fa-search"></i>
      <input 
        v-model="searchQuery"
        type="text"
        placeholder="搜索角色..."
        @input="filterChats"
      />
      <button 
        v-if="searchQuery"
        class="clear-btn"
        @click="clearSearch"
      >
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
    
    <!-- 角色列表 -->
    <div class="chat-list">
      <div 
        v-for="chat in filteredChats" 
        :key="chat.id"
        class="chat-item"
        @click="selectChat(chat)"
      >
        <div class="avatar-wrapper">
          <img :src="getAvatar(chat)" :alt="chat.name" />
          <div class="online-dot"></div>
        </div>
        <div class="info">
          <div class="name">{{ chat.name }}</div>
          <div class="remark">{{ chat.remark || chat.status || '暂无备注' }}</div>
        </div>
        <div class="arrow">
          <i class="fa-solid fa-chevron-right"></i>
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-if="filteredChats.length === 0" class="empty-state">
        <i class="fa-solid fa-user-slash"></i>
        <p>没有找到角色</p>
      </div>
    </div>
    
    <!-- 返回按钮 -->
    <button class="back-btn" @click="goBack">
      <i class="fa-solid fa-arrow-left"></i>
      返回桌面
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'

const router = useRouter()
const chatStore = useChatStore()
const phoneInspection = usePhoneInspectionStore()

const searchQuery = ref('')
const filteredChats = ref([])
const currentTime = ref('')
const bgImage = ref('/wallpapers/default.svg')

// 获取所有聊天（排除群聊）
const allChats = computed(() => {
  return Object.values(chatStore.chats || {}).filter(chat => !chat.isGroup)
})

// 过滤角色
function filterChats() {
  if (!searchQuery.value.trim()) {
    filteredChats.value = allChats.value
  } else {
    const query = searchQuery.value.toLowerCase()
    filteredChats.value = allChats.value.filter(chat => 
      chat.name.toLowerCase().includes(query) ||
      (chat.remark && chat.remark.toLowerCase().includes(query))
    )
  }
}

// 清除搜索
function clearSearch() {
  searchQuery.value = ''
  filterChats()
}

// 获取头像（确保使用正确的头像）
function getAvatar(chat) {
  // 优先使用 chat.avatar，如果没有使用默认头像
  return chat.avatar || '/avatars/default.png'
}

// 选择角色
function selectChat(chat) {
  // 确保手机数据已初始化
  if (!chat.phoneData) {
    // 生成手机数据
    phoneInspection.generatePhoneData(chat.id)
  }
  
  // 跳转到查手机页面
  router.push({
    name: 'phone-inspection',
    params: { charId: chat.id }
  })
}

// 返回
function goBack() {
  router.push('/')
}

// 更新时间
function updateTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

// 初始化
onMounted(() => {
  filterChats()
  updateTime()
  const timer = setInterval(updateTime, 1000)
  onUnmounted(() => clearInterval(timer))
})
</script>

<style scoped>
.search-view {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.background {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: all 0.5s ease;
}

.overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.85) 0%, rgba(118, 75, 162, 0.85) 100%);
  backdrop-filter: blur(10px);
  z-index: 1;
}

/* 状态栏 */
.status-bar {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.time {
  letter-spacing: 0.5px;
}

.icons {
  display: flex;
  gap: 6px;
}

.icons i {
  font-size: 12px;
  opacity: 0.9;
}

/* 标题区 */
.header {
  position: relative;
  z-index: 10;
  padding: 40px 20px 30px;
  text-align: center;
}

.icon-wrapper {
  width: 70px;
  height: 70px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: white;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
}

.title {
  font-size: 32px;
  font-weight: 700;
  color: white;
  margin: 0 0 8px 0;
  text-shadow: 0 2px 12px rgba(0,0,0,0.2);
  letter-spacing: 1px;
}

.subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
}

/* 搜索框 */
.search-bar {
  position: relative;
  z-index: 10;
  margin: 0 20px 20px;
}

.search-bar input {
  width: 100%;
  padding: 16px 50px 16px 50px;
  border: none;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  font-size: 16px;
  color: #1D1D1F;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-bar input:focus {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 12px 48px rgba(0,0,0,0.2);
  transform: translateY(-2px);
}

.search-bar input::placeholder {
  color: #86868B;
}

.search-bar i {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  color: #86868B;
  font-size: 18px;
}

.clear-btn {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border: none;
  background: rgba(0,0,0,0.08);
  border-radius: 50%;
  color: #86868B;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(0,0,0,0.15);
  color: #1D1D1F;
}

/* 角色列表 */
.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
  z-index: 10;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.chat-item:active {
  transform: scale(0.97);
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.avatar-wrapper {
  position: relative;
  width: 56px;
  height: 56px;
  margin-right: 16px;
  flex-shrink: 0;
}

.avatar-wrapper img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  border: 2px solid rgba(255, 255, 255, 0.8);
}

.online-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  background: #34C759;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(52, 199, 89, 0.4);
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 17px;
  font-weight: 600;
  color: #1D1D1F;
  margin-bottom: 5px;
}

.remark {
  font-size: 14px;
  color: #86868B;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: #C7C7CC;
  font-size: 16px;
  margin-left: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: rgba(255, 255, 255, 0.9);
}

.empty-state i {
  font-size: 72px;
  margin-bottom: 20px;
  opacity: 0.6;
}

.empty-state p {
  font-size: 16px;
  opacity: 0.8;
}

/* 返回按钮 */
.back-btn {
  position: relative;
  z-index: 10;
  margin: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 18px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.back-btn:active {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(0.98);
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
</style>
