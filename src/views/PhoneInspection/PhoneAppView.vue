<template>
  <div class="phone-app-view">
    <transition name="slide-up" mode="out-in">
      <!-- Specific Apps -->
      <WeChatApp v-if="appId === 'wechat'" :wechat-data="phoneData?.apps?.wechat" :char-avatar="currentChar?.avatar"
        :char-name="currentChar?.userName || currentChar?.name" :char-id="currentChar?.id"
        :user-avatar="settingsStore.personalization.userProfile.avatar" @back="handleBack" />

      <PhotosApp v-else-if="appId === 'photos'" :photos-data="phoneData?.apps?.photos" @back="handleBack"
        @update-photo="handleUpdatePhoto" />

      <WalletApp v-else-if="appId === 'wallet'" :wallet-data="phoneData?.apps?.wallet" 
        :char-name="currentChar?.userName || currentChar?.name"
        @back="handleBack" />

      <CallsApp v-else-if="appId === 'calls'" :calls-data="phoneData?.apps?.calls" @back="handleBack" />

      <ShoppingApp v-else-if="appId === 'shopping'" :shopping-data="phoneData?.apps?.shopping" @back="handleBack" />

      <MeituanApp v-else-if="appId === 'meituan'" :takeout-data="phoneData?.apps?.meituan" @back="handleBack" />

      <BackpackApp v-else-if="appId === 'backpack'" :backpack-data="phoneData?.apps?.backpack" @back="handleBack" />

      <SettingsApp v-else-if="appId === 'settings'" :settings-data="phoneData?.apps?.settings" @back="handleBack" />

      <GenericInfoApp
        v-else-if="['messages', 'footprints', 'notes', 'reminders', 'browser', 'history', 'music', 'calendar', 'forum', 'recorder', 'files'].includes(appId)"
        :app-id="appId" :app-data="phoneData?.apps?.[appId]" :app-title="appTitle" 
        :current-char-name="currentChar?.userName || currentChar?.name"
        @back="handleBack" />

      <EmailApp v-else-if="appId === 'email'" :email-data="phoneData?.apps?.email" @back="handleBack" />

      <!-- Generic Fallback for Other Apps -->
      <div v-else class="generic-app-container">
        <div class="app-header !pt-14 !h-auto pb-4">
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
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'

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
const EmailApp = defineAsyncComponent(() => import('./apps/EmailApp.vue'))

const props = defineProps({
  appId: String,
  phoneData: Object
})

const emit = defineEmits(['back'])

const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const phoneInspection = usePhoneInspectionStore()

// 用 phoneInspectionStore 的 currentChar（查手机选中的角色），而非 chatStore.currentChatId（最近聊天的）
const currentChar = computed(() => phoneInspection.currentChar)

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
    email: '邮件',
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: white;
  border-bottom: 1px solid #eee;
}

.back-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f5f7;
  color: #333;
  transition: all 0.2s;
}

.back-btn:active {
  transform: scale(0.9);
  background: #e5e5e7;
}

.app-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.placeholder {
  width: 2.5rem;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  background: white;
}

.coming-soon {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.kawaii-loader-icon {
  position: relative;
  font-size: 5rem;
  color: #FFB7C5;
  margin-bottom: 2rem;
}

.floating-hearts {
  position: absolute;
  top: 0;
  right: -1rem;
}

.floating-hearts i {
  position: absolute;
  font-size: 1.5rem;
  color: #ff85a1;
  animation: floatHeart 2s infinite ease-in-out;
}

@keyframes floatHeart {
  0% { transform: translateY(0) scale(0.5); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(-2rem) scale(1.2); opacity: 0; }
}

.coming-soon h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 1rem;
}

.coming-soon p {
  color: #999;
  font-size: 0.95rem;
  margin-bottom: 2rem;
}

.kawaii-progress {
  width: 12rem;
  height: 0.5rem;
  background: #f0f0f0;
  border-radius: 1rem;
  overflow: hidden;
}

.kawaii-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFB7C5, #ff85a1);
  width: 60%;
  border-radius: 1rem;
  animation: progressPulse 2s infinite alternate ease-in-out;
}

@keyframes progressPulse {
  from { width: 30%; }
  to { width: 85%; }
}

.animate-bounce-soft {
  animation: bounceSoft 2s infinite ease-in-out;
}

@keyframes bounceSoft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from { transform: translateY(100%); }
.slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>
