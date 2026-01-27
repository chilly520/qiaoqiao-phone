<script setup>
import { RouterView, useRoute, useRouter } from 'vue-router'
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from './stores/settingsStore'
import { useChatStore } from './stores/chatStore'
import { batteryMonitor } from './utils/batteryMonitor'

import { notificationService } from './utils/notificationService'
import { backgroundManager } from './utils/backgroundManager'
import CallBanner from './components/CallBanner.vue'
import CallVisualizer from './components/CallVisualizer.vue'

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

// Swipe Logic
const bannerDragOffset = ref(0)
const isBannerDragging = ref(false)
let bannerStartX = 0

const handleBannerPanStart = (e) => {
    isBannerDragging.value = true
    bannerStartX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
    bannerDragOffset.value = 0
}

const handleBannerPanMove = (e) => {
    if (!isBannerDragging.value) return
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
    bannerDragOffset.value = clientX - bannerStartX
}

const handleBannerPanEnd = () => {
    if (!isBannerDragging.value) return
    isBannerDragging.value = false

    // Threshold to dismiss
    if (Math.abs(bannerDragOffset.value) > 100) {
        showBanner.value = false
        // Reset immediately so next pop is clean
        setTimeout(() => { bannerDragOffset.value = 0 }, 300)
    } else {
        // Bounce back
        bannerDragOffset.value = 0
    }
}

const handleBannerClickWrapper = () => {
    if (Math.abs(bannerDragOffset.value) > 5) return // Ignore click if dragged
    handleBannerClick()
}

watch(() => chatStore.notificationEvent, (evt) => {
    if (!evt) return

    const isViewingChat = route.name === 'wechat' && chatStore.currentChatId === evt.chatId
    if (isViewingChat && document.visibilityState === 'visible') return

    // Trigger Banner
    bannerData.value = evt
    bannerDragOffset.value = 0 // Reset pos
    showBanner.value = true

    // ALSO trigger system notification (for real phone notification bar)
    const notificationTitle = evt.name || '新消息'
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

// --- Location System ---
const locationInputValue = ref('')

const handleLocationClick = () => {
    locationInputValue.value = store.weather.userLocation?.name || ''
    store.showLocationInput = true
}

const confirmLocation = () => {
    if (locationInputValue.value.trim()) {
        store.setUserLocation({ name: locationInputValue.value })
        chatStore.triggerToast('📍 位置已更新', 'success')
    }
    store.showLocationInput = false
}

// Watch global state to sync internal value
watch(() => store.showLocationInput, (val) => {
    if (val) {
        locationInputValue.value = store.weather.userLocation?.name || ''
    }
})

// ... existing Global Toast System ...
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
    <div class="app-root w-full min-h-[100dvh] h-[100dvh] relative overflow-hidden flex flex-col text-gray-800"
        :style="[globalStyles, { paddingBottom: 'var(--safe-area-inset-bottom)' }]"
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
                <!-- User Location Setting -->
                <div class="flex items-center gap-1 cursor-pointer hover:opacity-70 px-1 rounded transition-opacity"
                    @click="handleLocationClick" title="设置当前位置">
                    <i class="fa-solid fa-location-dot"
                        :class="statusBarStyle.color === '#ffffff' ? 'text-[10px]' : 'text-[10px] opacity-70'"></i>
                    <span v-if="store.weather.userLocation?.name"
                        class="text-[10px] max-w-[60px] truncate opacity-80">{{
                            store.weather.userLocation.name.split('>').pop().trim() }}</span>
                </div>
                <i class="fa-solid fa-signal"
                    :class="statusBarStyle.color === '#ffffff' ? 'text-[11px]' : 'text-[11px] opacity-80'"></i>
                <i class="fa-solid fa-wifi"
                    :class="statusBarStyle.color === '#ffffff' ? 'text-[12px]' : 'text-[12px] opacity-80'"></i>
                <span class="text-[12px] font-bold ml-1" :class="batteryColor">{{ batteryLevel }}%</span>
                <i class="fa-solid"
                    :class="[batteryIcon, batteryColor, statusBarStyle.color === '#ffffff' ? 'text-[14px]' : 'text-[14px] opacity-80']"></i>
            </div>
        </div>

        <div v-if="showBanner && bannerData" class="fixed top-2 left-0 right-0 z-[5000] px-3 animate-slide-down">
            <!-- Banner Container -->
            <div class="w-full max-w-[500px] mx-auto bg-white/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-[24px] p-3.5 flex items-center gap-3.5 border border-white/40 ring-1 ring-black/5 active:scale-[0.98] cursor-pointer touch-none select-none"
                :style="{
                    transform: `translateX(${bannerDragOffset}px)`,
                    transition: isBannerDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s',
                    opacity: 1 - Math.abs(bannerDragOffset) / 300
                }" @click="handleBannerClickWrapper" @touchstart="handleBannerPanStart"
                @touchmove="handleBannerPanMove" @touchend="handleBannerPanEnd" @mousedown="handleBannerPanStart"
                @mousemove="handleBannerPanMove" @mouseup="handleBannerPanEnd" @mouseleave="handleBannerPanEnd">
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
                        <span class="text-[15px] font-bold text-[#1c1c1e] truncate tracking-tight">{{ bannerData.name ||
                            bannerData.title }}</span>
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

        <div class="flex-1 w-full h-full overflow-hidden relative z-10 flex flex-col">
            <!-- 使用key强制组件重新渲染 -->
            <RouterView :key="routeKey" />
        </div>

        <!-- Global Call Components -->
        <CallBanner />
        <CallVisualizer />

        <!-- Custom Location Input Modal -->
        <Transition name="fade">
            <div v-if="store.showLocationInput"
                class="fixed inset-0 z-[10000] flex items-center justify-center p-6 backdrop-blur-md bg-black/20"
                @click.self="store.showLocationInput = false">
                <div
                    class="w-full max-w-[320px] bg-white/90 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-white/40 p-6 animate-scale-in">
                    <div class="flex flex-col gap-4">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                                <i class="fa-solid fa-location-dot text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-[17px] font-bold text-gray-900 tracking-tight">设置位置</h3>
                                <p class="text-[12px] text-gray-500 font-medium">输入当前地理信息</p>
                            </div>
                        </div>

                        <div class="relative">
                            <input v-model="locationInputValue" type="text" placeholder="省 > 市 > 区/街道"
                                class="w-full bg-black/5 border-none rounded-2xl px-4 py-3 text-[15px] focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                                @keyup.enter="confirmLocation" autofocus />
                        </div>

                        <div class="flex gap-3 mt-2">
                            <button @click="store.showLocationInput = false"
                                class="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-[15px] font-bold active:scale-95 transition-all">
                                取消
                            </button>
                            <button @click="confirmLocation"
                                class="flex-1 py-3 rounded-2xl bg-blue-500 text-white text-[15px] font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                                确定
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
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

@keyframes scaleIn {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
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
