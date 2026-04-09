<template>
  <div class="search-view">
    <!-- Kawaii Background -->
    <div class="kawaii-background"></div>
    <div class="kawaii-overlay"></div>

    <!-- Floating Decorations -->
    <div class="absolute top-10 right-10 text-6xl text-white opacity-20 animate-bounce-soft"><i
        class="fa-solid fa-cloud"></i></div>
    <div class="absolute bottom-40 left-5 text-4xl text-white opacity-30 animate-pulse-soft"><i
        class="fa-solid fa-cat"></i></div>

    <!-- Status Bar (Kawaii Style) -->
    <div class="kawaii-status-bar">
      <div class="time-bubble">
        <span>{{ currentTime }}</span>
      </div>
      <div class="icons">
        <i class="fa-solid fa-signal"></i>
        <i class="fa-solid fa-wifi"></i>
        <div class="battery-mini">
          <div class="level"></div>
        </div>
      </div>
    </div>

    <!-- Header -->
    <div class="kawaii-header">
      <div class="icon-bubble animate-bounce-soft">
        <i class="fa-solid fa-paw"></i>
      </div>
      <h1 class="kawaii-title">查手机</h1>
      <p class="kawaii-subtitle">请选择要连接的角色终端</p>
    </div>

    <!-- Search Bar -->
    <div class="kawaii-search-container px-6 mb-6">
      <div class="kawaii-search-bar">
        <i class="fa-solid fa-heart mr-3 text-pink-300"></i>
        <input v-model="searchQuery" type="text" placeholder="找找谁的小秘密..." @input="filterChats" />
        <button v-if="searchQuery" @click="clearSearch" class="close-search">
          <i class="fa-solid fa-circle-xmark"></i>
        </button>
      </div>
    </div>

    <!-- Character List -->
    <div class="kawaii-list px-6 flex-1 overflow-y-auto pb-32">
      <div v-for="chat in filteredChats" :key="chat.id" class="kawaii-item group" @click="selectChat(chat)">
        <div class="avatar-ring">
          <img :src="getAvatar(chat)" :alt="chat.name || '角色'" />
          <div class="status-dot"></div>
        </div>
        <div class="info">
          <div class="name">{{ getDisplayName(chat) }}</div>
          <div class="remark">{{ chat.remark || chat.status || '暂无备注喵' }}</div>
        </div>
        <div class="kawaii-arrow">
          <i class="fa-solid fa-heart text-pink-200 group-hover:text-pink-400 transition-colors"></i>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredChats.length === 0" class="kawaii-empty">
        <i class="fa-solid fa-face-sad-tear text-6xl opacity-30 mb-4"></i>
        <p>找不到相关的终端信号呢...</p>
      </div>
    </div>

    <!-- Exit Button -->
    <div class="kawaii-footer">
      <button class="kawaii-back-btn" @click="goBack">
        <i class="fa-solid fa-house-chimney mr-2"></i>
        回到主界面
      </button>
    </div>
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

const allChats = computed(() => {
  if (!chatStore.chats) return []
  // 使用更稳妥的映射方式
  const list = []
  for (const [id, chat] of Object.entries(chatStore.chats)) {
    if (!chat || chat.isGroup) continue

    // 强制解析一个“绝对存在”的名字
    const charName = (chat.name || chat.displayName || (chat.bio && chat.bio.name) || chat.remark || id).trim() || id

    list.push({
      id: id,
      name: String(charName), // 确保是字符串
      remark: (chat.remark || chat.status || '暂无备注喵').trim(),
      avatar: chat.avatar,
      isGroup: !!chat.isGroup,
      raw: chat
    })
  }
  return list
})

function getDisplayName(chat) {
  return chat.name || chat.id || '未知信号'
}

function filterChats() {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    filteredChats.value = allChats.value
  } else {
    filteredChats.value = allChats.value.filter(chat => {
      const name = (chat.name || '').toLowerCase()
      const remark = (chat.remark || '').toLowerCase()
      const id = (chat.id || '').toLowerCase()
      return name.includes(query) || remark.includes(query) || id.includes(query)
    })
  }
}

function clearSearch() {
  searchQuery.value = ''
  filterChats()
}

function getAvatar(chat) {
  return chat.avatar || '/avatars/default.png'
}

function selectChat(chat) {
  // 我们在 store 里已经改成了 Mock 模式，这里直接调用即可
  phoneInspection.generatePhoneData(chat.id)

  router.push({
    name: 'phone-inspection',
    params: { charId: chat.id }
  })
}

function goBack() {
  router.push('/')
}

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

onMounted(() => {
  filterChats()
  updateTime()
  const timer = setInterval(updateTime, 1000)
  onUnmounted(() => clearInterval(timer))
})

// 监听数据变化，确保初始化时（如从本地存储加载）能及时显示
watch(allChats, () => {
  filterChats()
}, { deep: true })
</script>

<style scoped>
.search-view {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Outfit', sans-serif;
}

.kawaii-background {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #B2EBF2 0%, #FBC2EB 100%);
}

.kawaii-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.3) 0%, transparent 100%);
  pointer-events: none;
}

.kawaii-status-bar {
  position: relative;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  padding: 12px 24px;
  color: #8F5E6E;
  font-weight: 900;
}

.time-bubble {
  background: rgba(255, 255, 255, 0.4);
  padding: 2px 10px;
  border-radius: 12px;
}

.battery-mini {
  width: 20px;
  height: 10px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 3px;
  display: inline-block;
  vertical-align: middle;
  padding: 1px;
}

.battery-mini .level {
  width: 80%;
  height: 100%;
  background: #BDECB6;
  border-radius: 1px;
}

.kawaii-header {
  position: relative;
  z-index: 10;
  padding: 40px 0 20px;
  text-align: center;
}

.icon-bubble {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  background: white;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: #8FD9FF;
  box-shadow: 0 8px 0 #FFF, 0 20px 40px rgba(0, 0, 0, 0.1);
}

.kawaii-title {
  font-size: 42px;
  font-weight: 900;
  color: white;
  text-shadow: 4px 4px 0 rgba(143, 94, 110, 0.2);
  margin-bottom: 4px;
}

.kawaii-subtitle {
  font-size: 14px;
  font-weight: 700;
  color: rgba(143, 94, 110, 0.8);
  background: rgba(255, 255, 255, 0.4);
  display: inline-block;
  padding: 4px 16px;
  border-radius: 20px;
}

.kawaii-search-bar {
  background: white;
  border-radius: 24px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 10px 0 #E3F2FD, 0 20px 40px rgba(0, 0, 0, 0.05);
  border: 3px solid #FFF;
}

.kawaii-search-bar input {
  flex: 1;
  border: none;
  background: none;
  font-size: 16px;
  font-weight: 700;
  color: #8F5E6E;
  outline: none;
}

.kawaii-search-bar input::placeholder {
  color: #FEC8D8;
}

.kawaii-item {
  background: white;
  border-radius: 28px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  box-shadow: 0 8px 0 #F0F0F0;
  transition: all 0.2s;
  cursor: pointer;
  border: 3px solid transparent;
}

.kawaii-item:active {
  transform: translateY(4px);
  box-shadow: 0 4px 0 #F0F0F0;
  border-color: #FFB7CE;
}

.avatar-ring {
  width: 64px;
  height: 64px;
  margin-right: 16px;
  position: relative;
  background: #FFF;
  border: 3px solid #FEC8D8;
  border-radius: 20px;
  padding: 3px;
}

.avatar-ring img {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  object-fit: cover;
}

.status-dot {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  background: #BDECB6;
  border: 4px solid white;
  border-radius: 50%;
}

.info .name {
  font-size: 20px;
  font-weight: 900;
  background: linear-gradient(135deg, #FF69B4 0%, #00BFFF 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.05));
}

.info .remark {
  font-size: 13px;
  color: #A66D7A;
  opacity: 0.6;
  font-weight: 700;
}

.kawaii-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px;
  background: linear-gradient(to top, rgba(255, 255, 255, 0.8), transparent);
}

.kawaii-back-btn {
  width: 100%;
  background: white;
  border: 4px solid #F0F0F0;
  padding: 16px;
  border-radius: 30px;
  font-size: 18px;
  font-weight: 900;
  color: #8F5E6E;
  box-shadow: 0 10px 0 #F0F0F0;
  transition: all 0.2s;
}

.kawaii-back-btn:active {
  transform: translateY(4px);
  box-shadow: 0 6px 0 #F0F0F0;
}

@keyframes bounce-soft {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

@keyframes pulse-soft {

  0%,
  100% {
    opacity: 0.2;
    transform: scale(1);
  }

  50% {
    opacity: 0.4;
    transform: scale(1.1);
  }
}

@media (max-width: 480px) {
  .kawaii-header {
    padding: 24px 0 12px;
  }
  .icon-bubble {
    width: 52px;
    height: 52px;
    border-radius: 20px;
    font-size: 26px;
    box-shadow: 0 4px 0 #FFF, 0 10px 20px rgba(0, 0, 0, 0.08);
  }
  .kawaii-title {
    font-size: 28px;
    text-shadow: 2px 2px 0 rgba(143, 94, 110, 0.15);
  }
  .kawaii-subtitle {
    font-size: 12px;
    padding: 3px 12px;
  }
  .kawaii-search-container {
    padding-left: 12px !important;
    padding-right: 12px !important;
    margin-bottom: 12px !important;
  }
  .kawaii-search-bar {
    padding: 10px 14px;
    border-radius: 20px;
    box-shadow: 0 6px 0 #E3F2FD, 0 12px 24px rgba(0, 0, 0, 0.04);
    border: 2px solid #FFF;
  }
  .kawaii-search-bar input {
    font-size: 14px;
  }
  .kawaii-list {
    padding-left: 12px !important;
    padding-right: 12px !important;
    padding-bottom: 100px !important;
  }
  .kawaii-item {
    border-radius: 20px;
    padding: 12px;
    margin-bottom: 10px;
    box-shadow: 0 4px 0 #F0F0F0;
    border: 2px solid transparent;
  }
  .avatar-ring {
    width: 48px;
    height: 48px;
    margin-right: 12px;
    border-radius: 16px;
    padding: 2px;
  }
  .avatar-ring img {
    border-radius: 11px;
  }
  .status-dot {
    width: 12px;
    height: 12px;
    border: 3px solid white;
  }
  .info .name {
    font-size: 15px;
  }
  .info .remark {
    font-size: 11px;
  }
  .kawaii-footer {
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 8px));
  }
  .kawaii-back-btn {
    padding: 12px;
    border-radius: 22px;
    font-size: 15px;
    border: 3px solid #F0F0F0;
    box-shadow: 0 6px 0 #F0F0F0;
  }
}
</style>
