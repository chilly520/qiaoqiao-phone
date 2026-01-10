<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router'
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from './stores/settingsStore'
import { useChatStore } from './stores/chatStore'

const route = useRoute()
const router = useRouter()
const store = useSettingsStore()
const chatStore = useChatStore()

// 使用路由路径作为key，强制组件在路由切换时重新渲染
const routeKey = computed(() => route.path)

// Status Bar Time
const currentTime = ref('12:00')
let timer = null
const updateTime = () => {
    const now = new Date()
    currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
onMounted(() => {
    updateTime()
    timer = setInterval(updateTime, 1000)
})
onUnmounted(() => {
    if(timer) clearInterval(timer)
})

// --- Personalization Bindings ---
const wallpaperStyle = computed(() => {
    const url = store.personalization.wallpaper
    if (!url) return {}
    return {
        backgroundImage: `url('${url}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
    }
})

const globalStyles = computed(() => {
    const font = store.personalization.globalFont
    const styles = {}
    
    // Global Font Color
    if (font.color) {
        styles.color = font.color
        styles['--global-text-color'] = font.color 
    }
    
    // Global Text Shadow
    if (font.shadow) {
        styles.textShadow = font.shadow
    }

    if (store.personalization.globalBg) {
        styles.background = store.personalization.globalBg
    }
    
    return styles
})

// Inject Custom CSS (Reactive)
const customCss = computed(() => store.personalization.customCss)

// Status Bar Style based on Route
const statusBarStyle = computed(() => {
    const transparentRoutes = ['home']
    if (transparentRoutes.includes(route.name)) {
        return {
            color: '#ffffff',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            backgroundColor: 'transparent'
        }
    }
    return {
        color: '#000000',
        textShadow: 'none',
        backgroundColor: '#ededed' 
    }
})

// --- Global Notification Banner ---
const showBanner = ref(false)
const bannerData = ref(null)
let bannerTimer = null

watch(() => chatStore.notificationEvent, (evt) => {
    if (!evt) return
    
    const isViewingChat = route.name === 'wechat' && chatStore.currentChatId === evt.chatId
    if (isViewingChat && document.visibilityState === 'visible') return

    // Trigger Banner
    bannerData.value = evt
    showBanner.value = true
    
    if (bannerTimer) clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => {
        showBanner.value = false
    }, 4000)
})

const handleBannerClick = () => {
    if (!bannerData.value) return
    
    // Navigate to Chat
    chatStore.setCurrentChat(bannerData.value.chatId)
    router.push('/wechat')
    showBanner.value = false
}
</script>

<template>
  <div class="app-root w-full h-[100dvh] relative overflow-hidden flex flex-col text-gray-800" :style="globalStyles">
    <!-- Dynamic Styles Block -->
    <component is="style" v-if="customCss">{{ customCss }}</component>

    <!-- Wallpaper Layer (from original HTML) -->
    <div id="wallpaper-layer" :style="wallpaperStyle"></div>
    
    <!-- Global Status Bar -->
    <div class="h-[28px] w-full flex justify-between items-center px-5 z-[100] relative select-none shrink-0 transition-colors duration-300"
         :style="statusBarStyle"
    >
        <span class="font-bold text-[13px] tracking-wide">{{ currentTime }}</span>
        <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-signal" :class="statusBarStyle.color === '#ffffff' ? 'text-[11px]' : 'text-[11px] opacity-80'"></i>
            <i class="fa-solid fa-wifi" :class="statusBarStyle.color === '#ffffff' ? 'text-[12px]' : 'text-[12px] opacity-80'"></i>
            <span class="text-[12px] font-bold ml-1">100%</span>
            <i class="fa-solid fa-battery-full" :class="statusBarStyle.color === '#ffffff' ? 'text-[14px]' : 'text-[14px] opacity-80'"></i>
        </div>
    </div>

    <!-- Notification Banner -->
    <div v-if="showBanner && bannerData" 
         class="fixed top-2 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-[#90c7f0]/95 backdrop-blur-md shadow-2xl rounded-2xl z-[200] p-4 flex items-center gap-4 cursor-pointer animate-slide-down border border-white/20"
         @click="handleBannerClick"
    >
        <div class="w-12 h-12 rounded-lg bg-white/20 overflow-hidden shrink-0 border border-white/30 shadow-inner">
             <img v-if="bannerData.avatar" :src="bannerData.avatar" class="w-full h-full object-cover" />
             <div v-else class="w-full h-full flex items-center justify-center text-white/70"><i class="fa-solid fa-user"></i></div>
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="flex justify-between items-baseline mb-0.5">
                <span class="font-bold text-gray-800 text-[15px] truncate text-shadow-sm">{{ bannerData.name }}</span>
                <span class="text-[11px] text-gray-600/80">现在</span>
            </div>
            <p class="text-[13px] text-gray-700 leading-snug truncate opacity-90 font-medium">{{ bannerData.content }}</p>
        </div>
    </div>

    <!-- Main Content Area -->

    <!-- Main Content Area -->
    <div class="flex-1 w-full h-full overflow-hidden relative z-10 flex flex-col">
        <!-- 使用key强制组件重新渲染 -->
        <RouterView :key="routeKey" />
    </div>
  </div>
</template>

<style>
@keyframes slideDown {
    from { transform: translate(-50%, -120%); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
}
.animate-slide-down {
    animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
