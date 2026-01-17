<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router'
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from './stores/settingsStore'
import { useChatStore } from './stores/chatStore'
import { batteryMonitor } from './utils/batteryMonitor'

import { notificationService } from './utils/notificationService'
import { backgroundManager } from './utils/backgroundManager'

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

    // Initialize battery monitoring
    batteryMonitor.init().then((initialized) => {
        if (initialized) {
            const info = batteryMonitor.getBatteryInfo()
            batteryLevel.value = info.level
            batteryCharging.value = info.charging

            batteryMonitor.onChange((info) => {
                batteryLevel.value = info.level
                batteryCharging.value = info.charging
            })
        }
    })

    // Request Notification Permissions
    const requestNotify = async () => {
        const granted = await notificationService.requestPermission()
        if (granted) console.log('[App] Notification permission granted')
    }
    
    // Try immediately
    requestNotify()

    // Try on interaction (fallback)
    const unlockKeepAlive = () => {
        requestNotify()
        backgroundManager.enable()
        console.log('[App] Background keep-alive enabled via user gesture')
        window.removeEventListener('click', unlockKeepAlive)
        window.removeEventListener('touchstart', unlockKeepAlive)
    }
    window.addEventListener('click', unlockKeepAlive, { once: true })
    window.addEventListener('touchstart', unlockKeepAlive, { once: true })
})
onUnmounted(() => {
    if (timer) clearInterval(timer)
    batteryMonitor.destroy()
})

// Battery Status
const batteryLevel = ref(100)
const batteryCharging = ref(false)

const batteryIcon = computed(() => {
    if (batteryCharging.value) return 'fa-battery-bolt'
    if (batteryLevel.value > 80) return 'fa-battery-full'
    if (batteryLevel.value > 60) return 'fa-battery-three-quarters'
    if (batteryLevel.value > 40) return 'fa-battery-half'
    if (batteryLevel.value > 20) return 'fa-battery-quarter'
    return 'fa-battery-empty'
})

const batteryColor = computed(() => {
    if (batteryCharging.value) return 'text-green-500'
    if (batteryLevel.value <= 20) return 'text-red-500'
    if (batteryLevel.value <= 30) return 'text-orange-500'
    return ''
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

    // Wallpaper Overlay Opacity for Dark Mode
    styles['--wallpaper-overlay-opacity'] = store.personalization.wallpaperOverlayOpacity || 0.5

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

    // ALSO trigger system notification (for real phone notification bar)
    const notificationTitle = `[小手机] ${evt.name || '新消息'}`
    notificationService.sendNotification(notificationTitle, {
        body: evt.content,
        icon: evt.avatar
    })

    if (bannerTimer) clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => {
        showBanner.value = false
    }, 4000)
})

const handleBannerClick = () => {
    if (!bannerData.value) return

    // Navigate to Chat
    chatStore.currentChatId = bannerData.value.chatId
    router.push('/wechat')
    showBanner.value = false
}

// --- Global Toast System ---
const showToast = ref(false)
const toastData = ref({ message: '', type: 'info' })
let toastTimer = null

watch(() => chatStore.toastEvent, (evt) => {
    if (!evt) return

    // Display toast globally
    toastData.value = { message: evt.message, type: evt.type || 'info' }
    showToast.value = true

    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
        showToast.value = false
    }, 3000)
})
</script>

<template>
    <div class="app-root w-full h-[100dvh] relative overflow-hidden flex flex-col text-gray-800" :style="globalStyles"
        :data-theme="store.personalization.theme">
        <!-- Dynamic Styles Block -->
        <component is="style" v-if="customCss">{{ customCss }}</component>

        <!-- Wallpaper Layer (from original HTML) -->
        <div id="wallpaper-layer" :style="wallpaperStyle"></div>

        <!-- Global Status Bar -->
        <div class="h-[28px] w-full flex justify-between items-center px-5 z-[100] relative select-none shrink-0 transition-colors duration-300"
            :style="statusBarStyle">
            <span class="font-bold text-[13px] tracking-wide">{{ currentTime }}</span>
            <div class="flex items-center gap-1.5">
                <i class="fa-solid fa-signal"
                    :class="statusBarStyle.color === '#ffffff' ? 'text-[11px]' : 'text-[11px] opacity-80'"></i>
                <i class="fa-solid fa-wifi"
                    :class="statusBarStyle.color === '#ffffff' ? 'text-[12px]' : 'text-[12px] opacity-80'"></i>
                <span class="text-[12px] font-bold ml-1" :class="batteryColor">{{ batteryLevel }}%</span>
                <i class="fa-solid"
                    :class="[batteryIcon, batteryColor, statusBarStyle.color === '#ffffff' ? 'text-[14px]' : 'text-[14px] opacity-80']"></i>
            </div>
        </div>

        <div v-if="showBanner && bannerData"
            class="fixed top-2 left-0 right-0 z-[5000] px-3 cursor-pointer animate-slide-down" @click="handleBannerClick">
            <!-- Banner Container -->
            <div
                class="w-full max-w-[500px] mx-auto bg-white/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[24px] p-3.5 flex items-center gap-3.5 border border-white/40 ring-1 ring-black/5 transition-all active:scale-[0.98]">
                <!-- Avatar (Rounded Square - iOS Style) -->
                <div class="w-[44px] h-[44px] rounded-[12px] overflow-hidden shrink-0 shadow-sm bg-black/5 relative">
                    <img v-if="bannerData.avatar" :src="bannerData.avatar" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full bg-[#e1e1e1] flex items-center justify-center">
                        <i class="fa-solid fa-user text-white text-lg"></i>
                    </div>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                    <div class="flex items-center justify-between w-full">
                        <span class="text-[15px] font-bold text-[#1c1c1e] truncate tracking-tight">{{ bannerData.name || bannerData.title }}</span>
                        <span
                            class="text-[11px] text-[#1c1c1e]/40 font-semibold whitespace-nowrap tracking-tight uppercase">现在</span>
                    </div>
                    <div class="text-[14px] text-[#1c1c1e]/80 truncate leading-snug font-medium">{{ bannerData.content
                    }}</div>
                </div>
            </div>
        </div>

        <!-- Global Toast Notification -->
        <div v-if="showToast"
            class="fixed top-16 left-1/2 px-6 py-3.5 rounded-2xl backdrop-blur-lg shadow-xl z-[9999] flex items-center gap-3 min-w-[200px] max-w-[90%] border border-white/30 animate-toast-pop"
            :class="{
                'bg-gradient-to-br from-blue-400/90 to-blue-500/90': toastData.type === 'info' || !toastData.type,
                'bg-gradient-to-br from-green-400/90 to-green-500/90': toastData.type === 'success',
                'bg-gradient-to-br from-rose-500/90 to-pink-600/90': toastData.type === 'error',
                'bg-gradient-to-br from-amber-400/90 to-orange-500/90': toastData.type === 'warning',
            }" style="transform: translateX(-50%);">
            <i class="text-xl text-white drop-shadow-md" :class="{
                'fa-solid fa-circle-info': toastData.type === 'info' || !toastData.type,
                'fa-solid fa-circle-check': toastData.type === 'success',
                'fa-solid fa-circle-exclamation': toastData.type === 'error',
                'fa-solid fa-triangle-exclamation': toastData.type === 'warning'
            }"></i>
            <span class="font-semibold text-sm text-white drop-shadow-sm">{{ toastData.message }}</span>
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
    from {
        transform: translateY(-120%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.animate-slide-down {
    animation: slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Toast Animation - Pure Vertical Fade */
@keyframes toastPop {
    0% {
        opacity: 0;
        transform: translate(-50%, -10px) scale(0.98);
    }

    100% {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
    }
}

.animate-toast-pop {
    animation: toastPop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
</style>
