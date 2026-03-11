<template>
  <div class="phone-app-view">
    <transition name="slide-up" mode="out-in">
      <!-- Specific Apps -->
      <WeChatApp v-if="appId === 'wechat'" :wechat-data="phoneData?.apps?.wechat" :char-avatar="currentChar?.avatar"
        :char-name="currentChar?.name" :char-id="currentChar?.id"
        :user-avatar="settingsStore.personalization.userProfile.avatar" @back="handleBack" />

      <PhotosApp v-else-if="appId === 'photos'" :photos-data="phoneData?.apps?.photos" @back="handleBack"
        @update-photo="handleUpdatePhoto" />

      <WalletApp v-else-if="appId === 'wallet'" :wallet-data="phoneData?.apps?.wallet" :char-name="currentChar?.name"
        @back="handleBack" />

      <CallsApp v-else-if="appId === 'calls'" :calls-data="phoneData?.apps?.calls" @back="handleBack" />

      <ShoppingApp v-else-if="appId === 'shopping'" :shopping-data="phoneData?.apps?.shopping" @back="handleBack" />

      <MeituanApp v-else-if="appId === 'meituan'" :takeout-data="phoneData?.apps?.meituan" @back="handleBack" />

      <BackpackApp v-else-if="appId === 'backpack'" :backpack-data="phoneData?.apps?.backpack" @back="handleBack" />

      <SettingsApp v-else-if="appId === 'settings'" :settings-data="phoneData?.apps?.settings" @back="handleBack" />

      <!-- Generic Info Driven Apps (Messages, Footprints, Notes, Browser, etc.) -->
      <GenericInfoApp
        v-else-if="['messages', 'footprints', 'notes', 'reminders', 'browser', 'history', 'music', 'calendar', 'forum', 'recorder', 'files'].includes(appId)"
        :app-id="appId" :app-data="phoneData?.apps?.[appId]" :app-title="appTitle" @back="handleBack" />

      <!-- Generic Fallback for Other Apps -->
      <div v-else class="generic-app-container">
        <div class="app-header !pt-16 !h-auto pb-4">
          <button class="back-btn" @click="handleBack">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <span class="app-title">{{ appTitle }}</span>
          <div class="placeholder"></div>
        </div>

        <div class="app-content">
          <div class="coming-soon">
            <div class="kawaii-loader-icon">
              <i class="fa-solid fa-face-smile-wink animate-bounce-soft"></i>
              <div class="floating-hearts">
                <i class="fa-solid fa-heart"></i>
                <i class="fa-solid fa-heart" style="animation-delay: 1s"></i>
              </div>
            </div>
            <h3>正在连接至 {{ appTitle }}</h3>
            <p>正在努力打通 {{ currentChar?.name || '角色' }} 的信号，请稍后再试喵~</p>
            <div class="kawaii-progress">
              <div class="kawaii-progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'

// Lazy load app components
const WeChatApp = defineAsyncComponent(() => import('./apps/WeChatApp.vue'))
const PhotosApp = defineAsyncComponent(() => import('./apps/PhotosApp.vue'))
const WalletApp = defineAsyncComponent(() => import('./apps/WalletApp.vue'))
const CallsApp = defineAsyncComponent(() => import('./apps/CallsApp.vue'))
const ShoppingApp = defineAsyncComponent(() => import('./apps/ShoppingApp.vue'))
const BackpackApp = defineAsyncComponent(() => import('./apps/BackpackApp.vue'))
const SettingsApp = defineAsyncComponent(() => import('./apps/SettingsApp.vue'))
const MeituanApp = defineAsyncComponent(() => import('./apps/MeituanApp.vue'))
const GenericInfoApp = defineAsyncComponent(() => import('./apps/GenericInfoApp.vue'))

const props = defineProps({
  appId: String,
  phoneData: Object
})

const emit = defineEmits(['back'])

const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const currentChar = computed(() => {
  const charId = chatStore.currentChatId
  return chatStore.chats[charId]
})

const appTitle = computed(() => {
  const titles = {
    wechat: '微信',
    calls: '通话记录',
    messages: '短信',
    wallet: '钱包',
    shopping: '市集',
    footprints: '足迹',
    backpack: '背包',
    notes: '碎片',
    reminders: '备忘录',
    browser: '探索',
    history: '回忆',
    photos: '画廊',
    music: '音符',
    calendar: '时光',
    meituan: '便当',
    forum: '树洞',
    recorder: '留声',
    files: '宝库',
    settings: '设置'
  }
  return titles[props.appId] || '应用'
})

function handleBack() {
  emit('back')
}

function handleUpdatePhoto({ index, url }) {
  // Update the data in chatStore to persist it
  if (props.phoneData?.apps?.photos?.photos) {
    props.phoneData.apps.photos.photos[index].url = url
    props.phoneData.apps.photos.photos[index].generated = true
    chatStore.saveChats()
  }
}
</script>

<style scoped>
.phone-app-view {
  position: absolute;
  inset: 0;
  background: #F5F5F7;
  z-index: 50;
  overflow: hidden;
}

.generic-app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
  height: 94px;
  padding-top: 44px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 15px;
  padding-right: 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.back-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #007AFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.app-title {
  font-size: 17px;
  font-weight: 600;
  color: #1D1D1F;
}

.placeholder {
  width: 40px;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.kawaii-loader-icon {
  width: 120px;
  height: 120px;
  background: white;
  border-radius: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #FFD1DC;
  margin-bottom: 32px;
  box-shadow: 0 10px 0 #FFD1DC, 0 20px 40px rgba(0, 0, 0, 0.05);
  position: relative;
}

.floating-hearts {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.floating-hearts i {
  position: absolute;
  font-size: 20px;
  color: #FFB7CE;
  animation: heart-float 2s infinite ease-in-out;
}

.floating-hearts i:first-child {
  top: -10px;
  right: 0;
}

.floating-hearts i:last-child {
  bottom: 0;
  left: -10px;
}

@keyframes heart-float {

  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  50% {
    transform: translateY(-15px) scale(1.2);
  }
}

.coming-soon h3 {
  font-size: 26px;
  font-weight: 900;
  color: #8F5E6E;
  margin-bottom: 12px;
  text-align: center;
}

.coming-soon p {
  font-size: 14px;
  color: #A66D7A;
  text-align: center;
  max-width: 250px;
  line-height: 1.6;
  font-weight: 700;
  margin-bottom: 40px;
  opacity: 0.8;
}

.kawaii-progress {
  width: 240px;
  height: 12px;
  background: white;
  border-radius: 6px;
  border: 3px solid #FFD1DC;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}

.kawaii-progress-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #FFB7CE, #FFD1DC, #FFB7CE);
  background-size: 200% 100%;
  animation: loading-wave 2s infinite linear;
}

@keyframes loading-wave {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
