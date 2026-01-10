<script setup>
import { RouterView, useRoute } from 'vue-router'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from './stores/settingsStore'

const route = useRoute()
const store = useSettingsStore()

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
        styles['--global-text-color'] = font.color // For CSS variable usage
    }
    
    // Global Text Shadow
    if (font.shadow) {
        styles.textShadow = font.shadow
    }

    // Global Font Family (if URL provided)
    // Note: To truly load a font URL dynamically requires @font-face injection, 
    // simply setting font-family won't work without the font loaded.
    // For now, we'll assume the URL might be a system font name or we need a font loader.
    // Given the task, let's just apply the color/shadow to the root.
    
    // Global Background (Overlay or Main BG)
    if (store.personalization.globalBg) {
        styles.background = store.personalization.globalBg
    }
    
    // Custom CSS injection is handled best by a style tag in head, but for reactivity:
    // We might render a dynamic style block if needed, or rely on specific properties.
    
    return styles
})

// Inject Custom CSS (Reactive)
const customCss = computed(() => store.personalization.customCss)
</script>

<template>
  <div class="app-root w-full h-[100dvh] relative overflow-hidden flex flex-col text-gray-800" :style="globalStyles">
    <!-- Dynamic Styles Block -->
    <component is="style" v-if="customCss">{{ customCss }}</component>

    <!-- Wallpaper Layer (from original HTML) -->
    <div id="wallpaper-layer" :style="wallpaperStyle"></div>
    
    <!-- Global Status Bar -->
    <div class="h-[28px] w-full flex justify-between items-center px-5 z-[100] relative select-none shrink-0"
         :style="{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }"
    >
        <span class="font-bold text-[13px] tracking-wide">{{ currentTime }}</span>
        <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-signal text-[11px]"></i>
            <i class="fa-solid fa-wifi text-[12px]"></i>
            <span class="text-[12px] font-bold ml-1">100%</span>
            <i class="fa-solid fa-battery-full text-[14px]"></i>
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 w-full h-full overflow-hidden relative z-10 flex flex-col">
        <!-- 使用key强制组件重新渲染 -->
        <RouterView :key="routeKey" />
    </div>
  </div>
</template>
