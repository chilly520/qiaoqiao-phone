<template>
  <div class="phone-inspection-app">
    <!-- 状态栏 -->
    <StatusBar />
    
    <!-- 主内容区 -->
    <transition name="fade" mode="out-in">
      <!-- 加载中 -->
      <div v-if="!currentChar || !phoneData" class="loading-screen">
        <div class="spinner"></div>
        <p>正在加载{{ currentChar?.name || '角色' }}的手机...</p>
      </div>
      
      <!-- 密码弹窗 -->
      <PasswordModal 
        v-else-if="showPasswordModal"
        :char-name="currentChar?.name"
        :password-hint="phoneData?.password?.hint"
        @verify="handleVerifyPassword"
        @close="showPasswordModal = false"
      />
      
      <!-- 桌面 -->
      <PhoneDesktop
        v-else-if="currentApp === 'desktop'"
        :wallpaper="currentWallpaper"
        @open-app="handleOpenApp"
      />
      
      <!-- 应用视图 -->
      <PhoneAppView
        v-else
        :app-id="currentApp"
        :phone-data="phoneData"
        @back="handleBackToDesktop"
      />
    </transition>
    
    <!-- 碎碎念气泡 -->
    <MutteringBubble 
      v-if="mutteringQueue.length > 0 && hasPermission"
      :queue="mutteringQueue"
      :char-avatar="currentChar?.avatar"
    />
    
    <!-- 被发现遮罩 -->
    <DiscoveredOverlay
      v-if="isDiscovered"
      :char-name="currentChar?.name"
      :char-avatar="currentChar?.avatar"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'
import StatusBar from './components/StatusBar.vue'
import PhoneDesktop from './components/PhoneDesktop.vue'
import PhoneAppView from './PhoneAppView.vue'
import PasswordModal from './components/PasswordModal.vue'
import MutteringBubble from './components/MutteringBubble.vue'
import DiscoveredOverlay from './components/DiscoveredOverlay.vue'

const router = useRouter()
const route = useRoute()
const phoneInspection = usePhoneInspectionStore()

// Computed
const currentChar = computed(() => phoneInspection.currentChar)
const phoneData = computed(() => phoneInspection.phoneData)
const currentApp = computed(() => phoneInspection.currentApp)
const showPasswordModal = computed(() => phoneInspection.showPasswordModal)
const mutteringQueue = computed(() => phoneInspection.mutteringQueue)
const isDiscovered = computed(() => phoneInspection.isDiscovered)
const currentWallpaper = computed(() => phoneInspection.currentWallpaper)
const hasPermission = computed(() => phoneInspection.hasPermission)

// Methods
function handleVerifyPassword(code) {
  const success = phoneInspection.verifyPassword(code)
  if (!success) {
    // 显示错误提示
    alert('密码错误！')
  }
}

function handleOpenApp(appId) {
  phoneInspection.openApp(appId)
}

function handleBackToDesktop() {
  phoneInspection.backToDesktop()
}

// Lifecycle
onMounted(async () => {
  const charId = route.params.charId
  if (charId) {
    // 确保数据已加载
    await phoneInspection.startInspection(charId)
    
    // 如果没有手机数据，生成一份
    if (!phoneInspection.phoneData) {
      await phoneInspection.generatePhoneData(charId)
      // 重新加载
      await phoneInspection.startInspection(charId)
    }
  }
})

onUnmounted(() => {
  phoneInspection.closeInspection()
})

// Watch route changes
watch(() => route.params.charId, (newCharId) => {
  if (newCharId && !phoneInspection.isOpen) {
    phoneInspection.startInspection(newCharId)
  }
})
</script>

<style scoped>
.phone-inspection-app {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  z-index: 9999;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.loading-screen {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 100;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-screen p {
  font-size: 16px;
  opacity: 0.9;
}
</style>
