<template>
  <div class="phone-inspection-app">
    <!-- 状态栏 -->
    <StatusBar />

    <!-- 主内容区 -->
    <transition name="fade" mode="out-in">
      <!-- Splash Screen with Cat Logo -->
      <div v-if="isLoading"
        class="loading-container fixed inset-0 z-[1000] flex flex-col items-center justify-center"
        style="background: linear-gradient(180deg, #f0f8ff 0%, #e8f0fa 50%, #dfe8f5 100%);">
        
        <!-- Floating snowflakes -->
        <div class="splash-snowflakes">
          <div class="snowflake" v-for="i in 8" :key="i" 
               :style="{ '--delay': `${i * 0.6}s`, '--x': `${10 + i * 10}%`, '--size': `${12 + (i % 3) * 4}px` }">
            ❄
          </div>
        </div>

        <!-- Cat Logo with glow -->
        <div class="relative mb-6">
          <div class="absolute inset-[-24px] rounded-full opacity-40"
               style="background: radial-gradient(circle, rgba(180,210,240,0.6) 0%, transparent 70%);"></div>
          <img src="/cat-logo.png" class="relative w-40 h-40 object-contain drop-shadow-[0_8px_32px_rgba(150,190,220,0.4)]"
               style="animation: cat-float 3s ease-in-out infinite;" />
        </div>

        <!-- App name -->
        <div class="text-center mb-8">
          <h1 class="text-[20px] font-light tracking-[0.2em] mb-2"
              style="color: #7ba7c9; font-family: 'SF Pro Display', -apple-system, sans-serif;">
            CHILLY PHONE
          </h1>
          <p class="text-[12px] tracking-wider" style="color: #a8c4d8;">
            正在连接 {{ charName }}...
          </p>
        </div>

        <!-- Progress -->
        <div class="flex flex-col items-center gap-2">
          <div class="w-40 h-[2px] rounded-full overflow-hidden" style="background: rgba(180,210,240,0.3);">
            <div class="h-full rounded-full transition-all duration-500 ease-out"
                 style="background: linear-gradient(90deg, #a8d4f0, #7ba7c9);"
                 :style="{ width: `${progress}%` }"></div>
          </div>
          <p class="text-[10px] tracking-wide" style="color: #b8c8d8;">{{ progress }}%</p>
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

    <!-- 全局自定义通知/确认弹窗 -->
    <MessageModal
      v-model="modalState.show"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      :ok-text="modalState.okText"
      :cancel-text="modalState.cancelText"
      @confirm="modalState.onConfirm && modalState.onConfirm()"
      @cancel="modalState.onCancel && modalState.onCancel()"
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
import MessageModal from './components/MessageModal.vue'
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
const modalState = computed(() => phoneInspection.modalState)

const charName = computed(() => {
  const char = currentChar.value
  return char?.name || char?.displayName || (char?.bio && char?.bio.name) || char?.remark || '未知角色'
})

// Methods
function handleVerifyPassword(code) {
  phoneInspection.verifyPassword(code)
}

function handleOpenApp(appId) {
  phoneInspection.openApp(appId)
}

function handleBackToDesktop() {
  phoneInspection.backToDesktop()
}

// Lifecycle
// [BUG FIX] onMounted 是 async, 中间有多个 await. 如果用户在 await 期间快速返回
// (组件卸载), 后续代码仍会继续执行并修改 store (startInspection / generatePhoneData),
// 导致已卸载组件污染全局 store 状态. 加 isMounted 标志, await 后检查再继续.
let isMounted = true
onMounted(async () => {
  const charId = route.params.charId
  if (charId) {
    // 确保数据已加载
    await phoneInspection.startInspection(charId)
    if (!isMounted) return

    // 如果没有手机数据，生成一份
    if (!phoneInspection.phoneData) {
      await phoneInspection.generatePhoneData(charId)
      if (!isMounted) return
      // 重新加载
      await phoneInspection.startInspection(charId)
    }
  }
})

onUnmounted(() => {
  isMounted = false
  phoneInspection.closeInspection()
})

// Watch route changes
// [BUG FIX] 原回调非 async 但调用 startInspection (返回 Promise), 用户快速切换路由时
// 多个 startInspection 并发执行, 后启动的先完成会覆盖先启动的结果, 状态错乱.
// 用 latestReqId 标记最新请求, 只让最新一次的 startInspection 生效.
let latestRouteReqId = 0
watch(() => route.params.charId, (newCharId) => {
  if (!newCharId || phoneInspection.isOpen) return
  const myReqId = ++latestRouteReqId
  phoneInspection.startInspection(newCharId).then(() => {
    // 如果在本次启动期间又触发了新的路由切换, 忽略本次结果
    if (myReqId !== latestRouteReqId) return
  }).catch(() => {})
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

/* Splash screen animations */
.splash-snowflakes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.snowflake {
  position: absolute;
  font-size: var(--size, 14px);
  color: rgba(180, 210, 240, 0.4);
  left: var(--x);
  bottom: -30px;
  animation: snow-fall 5s ease-in-out infinite;
  animation-delay: var(--delay);
}

@keyframes snow-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 0.7;
  }
  85% {
    opacity: 0.4;
  }
  100% {
    transform: translateY(-100vh) rotate(360deg);
    opacity: 0;
  }
}

@keyframes cat-float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
</style>
