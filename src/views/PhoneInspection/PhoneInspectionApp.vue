<template>
  <div class="phone-inspection-app">
    <!-- 状态栏 -->
    <StatusBar />

    <!-- 主内容区 -->
    <transition name="fade" mode="out-in">
      <!-- Kawaii Loading State: Dreamy Synchronization -->
      <div v-if="isLoading"
        class="loading-container fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-[#F5F5FF]">
        <div class="relative w-56 h-56 mb-12 flex items-center justify-center">
          <!-- Dreamy Orbit -->
          <div
            class="absolute inset-0 rounded-full border-4 border-dashed border-pink-200 animate-spin-slow opacity-60">
          </div>
          <div
            class="absolute inset-4 rounded-full border-2 border-dotted border-purple-200 animate-spin-reverse opacity-40">
          </div>

          <!-- Character Avatar with Pulse -->
          <div
            class="relative z-10 w-28 h-28 rounded-full border-4 border-white shadow-[0_10px_30px_rgba(255,182,193,0.4)] overflow-hidden animate-pulse-soft">
            <img :src="currentChar?.avatar" class="w-full h-full object-cover">
          </div>

          <!-- Decorative Clouds -->
          <div class="absolute -top-4 -right-2 text-4xl text-white opacity-80 animate-bounce-soft"><i
              class="fa-solid fa-cloud"></i></div>
          <div class="absolute -bottom-2 -left-4 text-3xl text-white opacity-60 animate-bounce-soft"
            style="animation-delay: -1s"><i class="fa-solid fa-cloud"></i></div>
        </div>

        <div class="text-center px-10">
          <h2 class="text-[#8F5E6E] font-black text-2xl tracking-widest mb-4 uppercase">正在连线 {{ charName }}
          </h2>
          <div
            class="w-64 h-4 bg-white/60 rounded-full overflow-hidden border-2 border-white shadow-inner mx-auto mb-2">
            <div class="h-full bg-gradient-to-r from-pink-300 to-purple-300 transition-all duration-300 rounded-full"
              :style="{ width: `${progress}%` }"></div>
          </div>
          <p class="text-[#A66D7A] text-sm font-bold opacity-60 italic">正在偷偷建立数据桥接... {{ progress }}%</p>
        </div>
      </div>

      <!-- 密码弹窗 -->
      <PasswordModal v-else-if="showPasswordModal" :char-name="charName" :password-hint="phoneData?.password?.hint"
        @verify="handleVerifyPassword" @close="showPasswordModal = false" />

      <!-- 桌面 -->
      <PhoneDesktop v-else-if="currentApp === 'desktop'" :wallpaper="currentWallpaper" @open-app="handleOpenApp" />

      <!-- 应用视图 -->
      <PhoneAppView v-else :app-id="currentApp" :phone-data="phoneData" @back="handleBackToDesktop" />
    </transition>

    <!-- 碎碎念气泡 -->
    <MutteringBubble v-if="mutteringQueue.length > 0 && hasPermission" :queue="mutteringQueue"
      :char-avatar="currentChar?.avatar" />

    <!-- 被发现遮罩 -->
    <DiscoveredOverlay v-if="isDiscovered" :char-name="currentChar?.name" :char-avatar="currentChar?.avatar" />
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

const charName = computed(() => {
  const char = currentChar.value
  return char?.name || char?.displayName || (char?.bio && char?.bio.name) || char?.remark || '未知角色'
})

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
  to {
    transform: rotate(360deg);
  }
}

.loading-screen p {
  font-size: 16px;
  opacity: 0.9;
}
</style>
