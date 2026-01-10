<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settingsStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const store = useSettingsStore()
const { weather, personalization } = storeToRefs(store)

const displayLocation = computed(() => {
    return weather.value.virtualLocation || weather.value.realLocation || '虚拟城市'
})

// --- Personalization Helpers ---
const getIconStyle = (appId) => {
    const iconUrl = personalization.value.icons.map[appId]
    if (iconUrl) {
        return {
            backgroundImage: `url('${iconUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }
    }
    return {}
}

const getCardBg = (type) => { // 'time' | 'location' | 'weather' | 'card1' | 'card2'
    const bg = personalization.value.cardBgs[type] || personalization.value.widgets[type]
    if (bg) {
        return {
             backgroundImage: `url('${bg}')`,
             backgroundSize: 'cover',
             backgroundPosition: 'center'
        }
    }
    return {}
}

const getGlobalFontStyle = computed(() => ({
    color: personalization.value.globalFont.color,
    textShadow: personalization.value.globalFont.shadow
}))

const getWidgetFontStyle = computed(() => ({
    color: '#ffffff',
    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
}))

const hasCustomIcon = (appId) => !!personalization.value.icons.map[appId]

// Functions matching original HTML
const openApp = (appId) => {
  if (appId === 'wechat') {
    router.push('/wechat')
  } else if (appId === 'search') {
    router.push('/search')
  } else if (appId === 'settings') {
    router.push('/settings')
  } else if (appId === 'syslog') {
    router.push('/system-logs')
  } else if (appId === 'worldbook') {
    router.push('/worldbook')
  }
}

// 优化：使用ref存储时间，减少DOM操作
const currentTime = ref('00:00:00')
const currentDate = ref('2024年1月1日 星期一')

let clockTimer = null

// Update clock - 优化性能
const updateClock = () => {
  const now = new Date()
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  currentDate.value = now.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    weekday: 'long' 
  })
}

// Desktop Drag Logic
const pagesContainer = ref(null)
let isDragging = false
let startX = 0
let scrollLeft = 0

const handleMouseDown = (e) => {
    isDragging = true
    startX = e.pageX - pagesContainer.value.offsetLeft
    scrollLeft = pagesContainer.value.scrollLeft
    pagesContainer.value.style.cursor = 'grabbing'
    pagesContainer.value.style.scrollSnapType = 'none'
}

const handleMouseLeave = () => {
    isDragging = false
    if(pagesContainer.value) {
        pagesContainer.value.style.cursor = 'grab'
        pagesContainer.value.style.scrollSnapType = 'x mandatory'
    }
}

const handleMouseUp = () => {
    isDragging = false
    if(pagesContainer.value) {
        pagesContainer.value.style.cursor = 'grab'
        pagesContainer.value.style.scrollSnapType = 'x mandatory'
    }
}

const handleMouseMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    const x = e.pageX - pagesContainer.value.offsetLeft
    const walk = (x - startX) * 1.5
    pagesContainer.value.scrollLeft = scrollLeft - walk
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer)
  }
})
</script>

<template>
  <!-- EXACT copy from original HTML structure -->
  <main id="desktop" class="flex-1 w-full h-full z-10 pt-8">
    <div class="app-pages-container" id="app-swiper"
      ref="pagesContainer"
      @mousedown="handleMouseDown"
      @mouseleave="handleMouseLeave"
      @mouseup="handleMouseUp"
      @mousemove="handleMouseMove"
    >
      <!-- Page 1 -->
      <div class="app-page">
        <!-- Time Widget -->
        <div id="widget-time" :style="getCardBg('time')"
          class="col-span-4 glass-panel rounded-[24px] p-6 flex flex-col justify-center items-start h-40 relative overflow-hidden group">
          <div v-if="!getCardBg('time').backgroundImage" class="absolute -right-6 -top-6 opacity-10 text-[9rem] pointer-events-none">
            <i class="fa-regular fa-clock"></i>
          </div>
          <div id="clock-large" class="text-6xl font-thin tracking-tighter drop-shadow-sm" :style="getWidgetFontStyle">{{ currentTime }}</div>
          <div id="date-large" class="text-lg mt-2 pl-1 font-medium tracking-widest" :style="getWidgetFontStyle">
            {{ currentDate }}
          </div>
        </div>

        <!-- Location Widget -->
        <div id="widget-location" @click="openApp('settings')" :style="getCardBg('location')"
          class="col-span-2 glass-panel rounded-[24px] p-5 flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer">
          <div class="flex justify-between items-start">
            <i class="fa-solid fa-location-dot text-xl text-blue-600"></i>
            <span class="text-[10px] bg-blue-500/30 px-2 py-1 rounded-full text-blue-50 backdrop-blur-md border border-blue-400/20">映射</span>
          </div>
          <div>
            <div class="text-sm" :style="getWidgetFontStyle">当前位置</div>
            <div class="text-xl font-bold truncate" id="desktop-location-text" :style="getWidgetFontStyle">{{ displayLocation }}</div>
          </div>
        </div>

        <!-- Weather Widget -->
        <div id="widget-weather" :style="getCardBg('weather')"
          class="col-span-2 glass-panel rounded-[24px] p-5 flex flex-col justify-between h-32 relative overflow-hidden">
          <div v-if="!getCardBg('weather').backgroundImage" class="absolute -right-4 -bottom-4 text-7xl opacity-20 text-yellow-500 pointer-events-none"
            id="desktop-weather-bg-icon">
            <i class="fa-solid fa-sun"></i>
          </div>
          <div class="text-right text-4xl font-light flex flex-col items-end">
            <i class="fa-solid fa-sun weather-icon text-yellow-500" id="desktop-weather-icon"></i>
            <span id="desktop-temp" :style="getWidgetFontStyle">24°</span>
          </div>
          <div>
            <div class="text-sm" id="desktop-weather-desc" :style="getWidgetFontStyle">晴朗</div>
            <div class="text-xs" :style="getWidgetFontStyle">AQI 35</div>
          </div>
        </div>

        <!-- Apps Grid -->
        <!-- WeChat -->
        <div class="col-span-1 flex flex-col items-center gap-2 cursor-pointer app-icon-wrapper group"
          @click="openApp('wechat')">
          <div id="icon-wechat" :style="getIconStyle('wechat')"
            class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
            <i v-if="!hasCustomIcon('wechat')" class="fa-brands fa-weixin text-[34px] icon-gradient"></i>
          </div>
          <span class="text-xs font-medium drop-shadow-sm tracking-wide text-white/90">微信</span>
        </div>

        <!-- Search -->
        <div class="col-span-1 flex flex-col items-center gap-2 cursor-pointer app-icon-wrapper group"
          @click="openApp('search')">
          <div id="icon-search" :style="getIconStyle('search')"
            class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
            <svg v-if="!hasCustomIcon('search')" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <span class="text-xs font-medium drop-shadow-sm tracking-wide text-white/90">查手机</span>
        </div>

        <!-- Weibo -->
        <div class="col-span-1 flex flex-col items-center gap-2 cursor-pointer app-icon-wrapper group"
          @click="openApp('weibo')">
          <div id="icon-weibo" :style="getIconStyle('weibo')"
            class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
            <i v-if="!hasCustomIcon('weibo')" class="fa-brands fa-weibo text-[36px] icon-gradient"></i>
          </div>
          <span class="text-xs font-medium drop-shadow-sm tracking-wide text-white/90">微博</span>
        </div>
      </div>

      <!-- Page 2 -->
      <div class="app-page" style="overflow-y: hidden; padding-top: 1rem; align-content: flex-start;">
        <div class="col-span-4 h-1"></div>

        <!-- Couple Space App -->
        <div class="col-span-1 flex flex-col items-center gap-2 cursor-pointer app-icon-wrapper group">
          <div id="icon-couple" :style="getIconStyle('couple')"
            class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
            <svg v-if="!hasCustomIcon('couple')" width="30" height="30" viewBox="0 0 24 24" fill="#ec4899" style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <span class="text-xs font-medium drop-shadow-sm tracking-wide text-white/90">情侣空间</span>
        </div>

        <!-- Games App -->
        <div class="col-span-1 flex flex-col items-center gap-2 cursor-pointer app-icon-wrapper group">
          <div id="icon-games" :style="getIconStyle('games')"
            class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
            <svg v-if="!hasCustomIcon('games')" width="30" height="30" viewBox="0 0 24 24" fill="#8b5cf6" style="filter: drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3));">
              <path
                d="M21 9h-2V7c0-1.66-1.34-3-3-3s-3 1.34-3 3v2H9V7c0-1.66-1.34-3-3-3S3 5.34 3 7v2H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h22c.55 0 1-.45 1-1V10c0-.55-.45-1-1-1zM11 15H9v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H5c-.55 0-1-.45-1-1s.45-1 1-1h2v-2c0-.55.45-1 1-1s1 .45 1 1v2h2c.55 0 1 .45 1 1s-.45 1-1 1zm8-1c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
            </svg>
          </div>
          <span class="text-xs font-medium drop-shadow-sm tracking-wide text-white/90">小游戏</span>
        </div>

        <!-- Custom Widget Card 1 -->
        <div class="col-span-2 glass-panel rounded-[24px] overflow-hidden relative aspect-[1.33]">
          <div id="widget-overlay-card1" v-if="!getCardBg('card1').backgroundImage"
            class="absolute inset-0 flex flex-col items-center justify-center opacity-70 pointer-events-none transition-opacity duration-300">
            <i class="fa-regular fa-image text-3xl mb-2 text-white/80 drop-shadow-md"></i>
            <span class="text-xs text-white/90 font-medium">组件 1</span>
          </div>
          <div id="widget-img-card1" :style="getCardBg('card1')" class="absolute inset-0 w-full h-full pointer-events-none">
          </div>
        </div>

        <!-- Custom Widget Card 2 -->
        <div class="col-span-2 glass-panel rounded-[24px] overflow-hidden relative aspect-[1.33]">
          <div id="widget-overlay-card2" v-if="!getCardBg('card2').backgroundImage"
            class="absolute inset-0 flex flex-col items-center justify-center opacity-70 pointer-events-none transition-opacity duration-300">
            <i class="fa-regular fa-star text-3xl mb-2 text-white/80 drop-shadow-md"></i>
            <span class="text-xs text-white/90 font-medium">组件 2</span>
          </div>
          <div id="widget-img-card2" :style="getCardBg('card2')" class="absolute inset-0 w-full h-full pointer-events-none">
          </div>
        </div>
      </div>
    </div>

    <!-- Dock (Fixed Footer) -->
    <div class="dock-container" style="padding-bottom: 20px;">
      <div class="flex flex-col items-center gap-1 cursor-pointer group" @click="openApp('settings')">
        <div id="icon-settings" :style="getIconStyle('settings')"
          class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
          <svg v-if="!hasCustomIcon('settings')" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
            </path>
          </svg>
        </div>
        <span class="text-[10px] text-white font-medium drop-shadow-md">设置</span>
      </div>

      <div class="flex flex-col items-center gap-1 cursor-pointer group" @click="openApp('worldbook')">
        <div id="icon-worldbook" :style="getIconStyle('worldbook')"
          class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
          <svg v-if="!hasCustomIcon('worldbook')" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </div>
        <span class="text-[10px] text-white font-medium drop-shadow-md">世界书</span>
      </div>

      <div class="flex flex-col items-center gap-1 cursor-pointer group">
        <div id="icon-reset" :style="getIconStyle('reset')"
          class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
          <svg v-if="!hasCustomIcon('reset')" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </div>
        <span class="text-[10px] text-white font-medium drop-shadow-md">重置</span>
      </div>

      <div class="flex flex-col items-center gap-1 cursor-pointer group" @click="openApp('syslog')">
        <div id="icon-syslog" :style="getIconStyle('syslog')"
          class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
          <svg v-if="!hasCustomIcon('syslog')" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <span class="text-[10px] text-white font-medium drop-shadow-md">系统日志</span>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* No custom styles needed - all styles are in global style.css */
</style>
