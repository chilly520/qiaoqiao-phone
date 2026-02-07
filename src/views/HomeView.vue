<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settingsStore'
import { useLoggerStore } from '../stores/loggerStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const store = useSettingsStore()
const logger = useLoggerStore()
const { weather, personalization } = storeToRefs(store)

const displayLocation = computed(() => {
  return weather.value.virtualLocation || weather.value.realLocation || '虚拟城市'
})

// --- Personalization Helpers ---
function getIconStyle(appId) {
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

function getCardBg(type) { // 'time' | 'location' | 'weather' | 'card1' | 'card2'
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

function hasCustomIcon(appId) {
  return !!personalization.value.icons.map[appId]
}

// Functions matching original HTML
function openApp(appId) {
  logger.info(`打开应用: ${appId}`)
  const safeNavigate = (path) => {
    router.push(path).catch(err => {
      // Ignore navigation failures (duplicates, cancelled) to prevent Promise Rejection logs
      if (err.name !== 'NavigationDuplicated' && !err.message.includes('Avoided redundant navigation')) {
        logger.warn('Nav Warning', { path, error: err.message })
      }
    })
  }

  if (appId === 'wechat') {
    safeNavigate('/wechat')
  } else if (appId === 'search') {
    safeNavigate('/search')
  } else if (appId === 'settings') {
    safeNavigate('/settings')
  } else if (appId === 'syslog') {
    safeNavigate('/system-logs')
  } else if (appId === 'worldbook') {
    safeNavigate('/worldbook')
  } else if (appId === 'weibo') {
    safeNavigate('/weibo')
  } else if (appId === 'reset') {
    // Confirm before reset
    if (confirm('确定要重置应用吗？这将刷新页面。')) {
      // Store a flag to scroll to top after reload
      sessionStorage.setItem('justReloaded', 'true')
      location.reload()
    }
  }
}

const currentTime = ref('00:00:00')
const currentDate = ref('2024年1月1日 星期一')

let clockTimer = null

function updateClock() {
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

function handleMouseDown(e) {
  isDragging = true
  startX = e.pageX - pagesContainer.value.offsetLeft
  scrollLeft = pagesContainer.value.scrollLeft
  pagesContainer.value.style.cursor = 'grabbing'
  pagesContainer.value.style.scrollSnapType = 'none'
}

function handleMouseLeave() {
  isDragging = false
  if (pagesContainer.value) {
    pagesContainer.value.style.cursor = 'grab'
    pagesContainer.value.style.scrollSnapType = 'x mandatory'
  }
}

function handleMouseUp() {
  isDragging = false
  if (pagesContainer.value) {
    pagesContainer.value.style.cursor = 'grab'
    pagesContainer.value.style.scrollSnapType = 'x mandatory'
  }
}

function handleMouseMove(e) {
  if (!isDragging) return
  e.preventDefault()
  const x = e.pageX - pagesContainer.value.offsetLeft
  const walk = (x - startX) * 1.5
  pagesContainer.value.scrollLeft = scrollLeft - walk
}

const currentPage = ref(0)
function handleScroll() {
  if (!pagesContainer.value) return
  const scrollPos = pagesContainer.value.scrollLeft
  const pageWidth = pagesContainer.value.offsetWidth
  if (pageWidth > 0) {
    currentPage.value = Math.round(scrollPos / pageWidth)
  }
}

// --- Weather Logic ---
const weatherTemp = ref('--°')
const weatherDesc = ref('获取中')
const weatherIconClass = ref('fa-sun')
const weatherAqi = ref('AQI --')

async function fetchWeather() {
  const queryLoc = weather.value.realLocation || weather.value.virtualLocation || 'Beijing'
  if (!queryLoc) return

  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(queryLoc)}?format=j1`)
    if (res.ok) {
      const data = await res.json()
      const current = data.current_condition[0]

      weatherTemp.value = `${current.temp_C}°`
      weatherDesc.value = current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '晴'

      const descLower = (current.weatherDesc?.[0]?.value || '').toLowerCase()
      if (descLower.includes('rain') || descLower.includes('shower')) weatherIconClass.value = 'fa-cloud-rain'
      else if (descLower.includes('cloud') || descLower.includes('overcast') || descLower.includes('partly')) weatherIconClass.value = 'fa-cloud'
      else if (descLower.includes('snow')) weatherIconClass.value = 'fa-snowflake'
      else if (descLower.includes('fog') || descLower.includes('mist')) weatherIconClass.value = 'fa-smog'
      else if (descLower.includes('thunder')) weatherIconClass.value = 'fa-bolt'
      else weatherIconClass.value = 'fa-sun'

      weatherAqi.value = `AQI ${Math.floor(Math.random() * 50 + 20)}`

      // Sync to Global Store for AI Context
      store.updateLiveWeather({
        temp: weatherTemp.value,
        desc: weatherDesc.value,
        aqi: weatherAqi.value,
        icon: weatherIconClass.value
      })

      logger.debug('天气更新成功', { temp: weatherTemp.value, desc: weatherDesc.value, icon: weatherIconClass.value })
    } else {
      logger.warn('天气获取失败', { status: res.status, statusText: res.statusText })
    }
  } catch (e) {
    logger.error('天气接口报错', { message: e.message, stack: e.stack })
    weatherDesc.value = '离线'
  }
}

function getTimeClass() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 8) return 'time-morning'
  if (hour >= 8 && hour < 12) return 'time-day'
  if (hour >= 12 && hour < 17) return 'time-day'
  if (hour >= 17 && hour < 19) return 'time-dusk'
  return 'time-night'
}

function getTimeBg() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 8) return 'linear-gradient(135deg, rgba(255, 154, 158, 0.12), rgba(254, 207, 239, 0.12))'
  if (hour >= 8 && hour < 17) return 'linear-gradient(135deg, rgba(161, 196, 253, 0.12), rgba(194, 233, 251, 0.12))'
  if (hour >= 17 && hour < 19) return 'linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15))'
  return 'linear-gradient(135deg, rgba(36, 57, 73, 0.2), rgba(81, 127, 164, 0.2))'
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)

  // Check Weather Cache
  const now = Date.now()
  const lastUpdate = weather.value.lastUpdate || 0
  const cacheDuration = 30 * 60 * 1000 // 30 mins

  if (weather.value.temp && weather.value.temp !== '--°' && (now - lastUpdate < cacheDuration)) {
    // Use cached data locally
    weatherTemp.value = weather.value.temp
    weatherDesc.value = weather.value.desc
    weatherIconClass.value = weather.value.icon
    weatherAqi.value = weather.value.aqi
    logger.debug('使用缓存天气数据', { time: new Date(lastUpdate).toLocaleTimeString() })
  } else {
    // Fetch fresh data
    fetchWeather()
  }

  // Background refresh
  setInterval(fetchWeather, cacheDuration)

  // Fix scroll position after reload
  if (sessionStorage.getItem('justReloaded') === 'true') {
    sessionStorage.removeItem('justReloaded')
    // Scroll to top to ensure dock is visible
    window.scrollTo({ top: 0, behavior: 'instant' })
    // Also scroll the pages container to first page
    if (pagesContainer.value) {
      pagesContainer.value.scrollLeft = 0
    }
  }

})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>


<template>
  <!-- EXACT copy from original HTML structure -->
  <main id="desktop" class="flex-1 w-full h-full z-10 pt-1">
    <div class="app-pages-container" id="app-swiper" ref="pagesContainer" @mousedown="handleMouseDown"
      @mouseleave="handleMouseLeave" @mouseup="handleMouseUp" @mousemove="handleMouseMove" @scroll="handleScroll">
      <!-- Page 1 -->
      <div class="app-page">
        <!-- Time Widget - Thinner and more transparent -->
        <div id="widget-time"
          :class="['col-span-4 glass-panel rounded-[24px] flex flex-col justify-center items-center h-[120px] mb-3 relative overflow-hidden group text-center transition-all duration-1000 backdrop-blur-[32px] border border-white/10', getTimeClass()]"
          :style="{ background: getTimeBg() }">

          <!-- Glow effect from other AI -->
          <div class="glow-effect"></div>

          <!-- Shine sweep effect -->
          <div class="absolute inset-0 pointer-events-none">
            <div
              class="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-[25deg] animate-shine">
            </div>
          </div>

          <!-- Dynamic Stars -->
          <div v-if="new Date().getHours() >= 17 || new Date().getHours() < 7"
            class="absolute inset-0 pointer-events-none">
            <div class="star s1"></div>
            <div class="star s2"></div>
            <div class="star s3"></div>
          </div>

          <div class="relative z-10 flex flex-col items-center">
            <div id="clock-large"
              class="text-6xl font-extralight tracking-[2px] drop-shadow-xl text-white leading-none">{{
                currentTime.split(':').slice(0, 2).join(':') }}</div>
            <div id="date-large" class="text-sm mt-2 font-normal text-white/90 drop-shadow-lg tracking-wider">
              {{ currentDate }}
            </div>
          </div>
        </div>

        <!-- Location Widget - More horizontal and crystal clear -->
        <div id="widget-location" @click="openApp('settings')"
          class="col-span-2 glass-panel rounded-[24px] p-4 flex flex-col justify-between h-[115px] relative overflow-hidden cursor-pointer group backdrop-blur-[32px] border border-white/10">
          <!-- Ultra low opacity tech gradient -->
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-blue-500/10 to-cyan-400/10"></div>

          <!-- Map grid pattern -->
          <div class="absolute inset-0 opacity-20"
            style="background-image: linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px); background-size: 20px 20px;">
          </div>

          <!-- Radar scan animation -->
          <div class="absolute top-6 right-6 w-2 h-2 bg-white/90 rounded-full animate-radar"></div>

          <div class="flex justify-between items-start relative z-10">
            <span class="text-2xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">📍</span>
            <span
              class="text-[10px] bg-white/20 px-2 py-1 rounded-full text-white backdrop-blur-sm border border-white/20 drop-shadow-md">定位中</span>
          </div>
          <div class="relative z-10">
            <div class="text-[10px] text-white/70 tracking-widest uppercase">Current Location</div>
            <div class="text-2xl font-bold text-white drop-shadow-lg mt-0.5">{{ displayLocation }}</div>
          </div>
        </div>

        <!-- Weather Widget - Elongated and frosted -->
        <div id="widget-weather"
          class="col-span-2 glass-panel rounded-[24px] p-4 flex flex-col justify-between items-end h-[115px] relative overflow-hidden group backdrop-blur-[32px] border border-white/10">
          <!-- Extreme transparency weather background -->
          <div class="absolute inset-0 transition-all duration-1000" :style="{
            background: weatherIconClass === 'fa-sun' ? 'linear-gradient(to bottom right, rgba(255, 237, 213, 0.12), rgba(254, 215, 170, 0.15))' :
              weatherIconClass === 'fa-cloud-rain' ? 'linear-gradient(to bottom right, rgba(219, 234, 254, 0.12), rgba(147, 197, 253, 0.15))' :
                weatherIconClass === 'fa-cloud' ? 'linear-gradient(to bottom right, rgba(224, 242, 254, 0.12), rgba(186, 230, 253, 0.15))' :
                  weatherIconClass === 'fa-snowflake' ? 'linear-gradient(to bottom right, rgba(240, 249, 255, 0.12), rgba(224, 242, 254, 0.15))' :
                    'linear-gradient(to bottom right, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.1))'
          }"></div>

          <!-- Animated elements container (Left side) -->
          <div class="absolute top-4 left-4 z-0">
            <!-- Sun -->
            <div v-if="weatherIconClass === 'fa-sun'" class="css-sun"></div>
            <!-- Cloud -->
            <div v-if="weatherIconClass === 'fa-cloud' || weatherIconClass === 'fa-cloud-rain'" class="css-cloud"></div>
            <!-- Rain drops below cloud -->
            <div v-if="weatherIconClass === 'fa-cloud-rain'" class="absolute top-8 left-2 flex gap-2">
              <div class="w-0.5 h-3 bg-blue-300/60 rounded-full animate-rain-drop"></div>
              <div class="w-0.5 h-3 bg-blue-300/60 rounded-full animate-rain-drop" style="animation-delay: 0.2s"></div>
              <div class="w-0.5 h-3 bg-blue-300/60 rounded-full animate-rain-drop" style="animation-delay: 0.4s"></div>
            </div>
          </div>

          <!-- Weather info split layout -->
          <div class="relative z-10 flex flex-col justify-between h-full w-full">
            <div class="flex justify-between items-start">
              <!-- Moon icon for night (Right top) -->
              <div class="w-full text-right">
                <span v-if="getTimeClass() === 'time-night'" class="text-indigo-200/50 text-xl animate-pulse"><i
                    class="fa-solid fa-moon"></i></span>
              </div>
            </div>

            <div class="flex justify-between items-end w-full">
              <!-- Info moved to Left Bottom -->
              <div class="flex flex-col items-start">
                <span class="text-sm font-semibold text-white drop-shadow-md">{{ weatherDesc }}</span>
                <span
                  class="text-[9px] text-white/80 bg-black/10 px-2 py-0.5 rounded-full mt-1 border border-white/10 uppercase tracking-tighter">{{
                    weatherAqi }}</span>
              </div>
              <!-- Temperature stays on Right Bottom -->
              <div class="flex flex-col items-end">
                <span class="text-5xl font-extralight text-white drop-shadow-lg leading-none">{{
                  weatherTemp.replace('°', '') }}<span class="text-2xl">°</span></span>
              </div>
            </div>
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
            <svg v-if="!hasCustomIcon('search')" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ec4899"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
              style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
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
            <svg v-if="!hasCustomIcon('couple')" width="30" height="30" viewBox="0 0 24 24" fill="#ec4899"
              style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
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
            <svg v-if="!hasCustomIcon('games')" width="30" height="30" viewBox="0 0 24 24" fill="#8b5cf6"
              style="filter: drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3));">
              <path
                d="M21 9h-2V7c0-1.66-1.34-3-3-3s-3 1.34-3 3v2H9V7c0-1.66-1.34-3-3-3S3 5.34 3 7v2H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h22c.55 0 1-.45 1-1V10c0-.55-.45-1-1-1zM11 15H9v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H5c-.55 0-1-.45-1-1s.45-1 1-1h2v-2c0-.55.45-1 1-1s1 .45 1 1v2h2c.55 0 1 .45 1 1s-.45 1-1 1zm8-1c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
            </svg>
          </div>
          <span class="text-xs font-medium drop-shadow-sm tracking-wide text-white/90">小游戏</span>
        </div>

        <!-- Custom Widget Card 1 - Square -->
        <div
          class="col-span-2 glass-panel rounded-[24px] overflow-hidden relative aspect-square backdrop-blur-[32px] border border-white/10">
          <div id="widget-overlay-card1" v-if="!getCardBg('card1').backgroundImage"
            class="absolute inset-0 flex flex-col items-center justify-center opacity-70 pointer-events-none transition-opacity duration-300">
            <i class="fa-regular fa-image text-3xl mb-2 text-white/80 drop-shadow-md"></i>
            <span class="text-[10px] text-white/90 font-medium uppercase tracking-widest">Widget 01</span>
          </div>
          <div id="widget-img-card1" :style="getCardBg('card1')"
            class="absolute inset-0 w-full h-full pointer-events-none opacity-80">
          </div>
        </div>

        <!-- Custom Widget Card 2 - Square -->
        <div
          class="col-span-2 glass-panel rounded-[24px] overflow-hidden relative aspect-square backdrop-blur-[32px] border border-white/10">
          <div id="widget-overlay-card2" v-if="!getCardBg('card2').backgroundImage"
            class="absolute inset-0 flex flex-col items-center justify-center opacity-70 pointer-events-none transition-opacity duration-300">
            <i class="fa-regular fa-star text-3xl mb-2 text-white/80 drop-shadow-md"></i>
            <span class="text-[10px] text-white/90 font-medium uppercase tracking-widest">Widget 02</span>
          </div>
          <div id="widget-img-card2" :style="getCardBg('card2')"
            class="absolute inset-0 w-full h-full pointer-events-none opacity-80">
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination Dots - Moved higher to avoid dock overlap -->
    <div class="absolute bottom-[105px] left-0 right-0 flex justify-center gap-2 z-20 pointer-events-none">
      <div
        :class="['w-1 h-1 rounded-full transition-all duration-300', currentPage === 0 ? 'bg-white scale-125 shadow-[0_0_8px_white]' : 'bg-white/20']">
      </div>
      <div
        :class="['w-1 h-1 rounded-full transition-all duration-300', currentPage === 1 ? 'bg-white scale-125 shadow-[0_0_8px_white]' : 'bg-white/20']">
      </div>
    </div>

    <!-- Dock (Fixed Footer) -->
    <div class="dock-container">
      <div class="flex flex-col items-center gap-1 cursor-pointer group" @click="openApp('settings')">
        <div id="icon-settings" :style="getIconStyle('settings')"
          class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
          <svg v-if="!hasCustomIcon('settings')" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ec4899"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
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
          <svg v-if="!hasCustomIcon('worldbook')" width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </div>
        <span class="text-[10px] text-white font-medium drop-shadow-md">世界书</span>
      </div>

      <div class="flex flex-col items-center gap-1 cursor-pointer group" @click="openApp('reset')">
        <div id="icon-reset" :style="getIconStyle('reset')"
          class="w-[50px] h-[50px] flex items-center justify-center glass-icon group-active:scale-90 overflow-hidden">
          <svg v-if="!hasCustomIcon('reset')" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ec4899"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
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
          <svg v-if="!hasCustomIcon('syslog')" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ec4899"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style="filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));">
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
/* Weather Animations */

/* Shine sweep animation */
@keyframes shine {
  0% {
    transform: translateX(-100%) rotate(25deg);
  }

  100% {
    transform: translateX(100%) rotate(25deg);
  }
}

.animate-shine {
  animation: shine 8s linear infinite;
}

.glow-effect {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 50% -20%, rgba(255, 255, 255, 0.4), transparent 70%);
  pointer-events: none;
  z-index: 1;
}

/* Star animations */
.star {
  position: absolute;
  background: white;
  border-radius: 50%;
  opacity: 0.6;
  filter: drop-shadow(0 0 2px white);
}

.s1 {
  width: 3px;
  height: 3px;
  top: 20%;
  left: 15%;
  animation: twinkle 3s infinite;
}

.s2 {
  width: 2px;
  height: 2px;
  top: 40%;
  right: 20%;
  animation: twinkle 4s infinite 1s;
}

.s3 {
  width: 2px;
  height: 2px;
  top: 70%;
  left: 30%;
  animation: twinkle 5s infinite 2s;
}

@keyframes twinkle {

  0%,
  100% {
    opacity: 0.2;
    transform: scale(0.8);
  }

  50% {
    opacity: 0.8;
    transform: scale(1.2);
  }
}

/* Radar ping animation */
@keyframes radar-ping {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.8);
    transform: scale(1);
  }

  70% {
    box-shadow: 0 0 0 15px rgba(255, 255, 255, 0);
    transform: scale(1.1);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
    transform: scale(1);
  }
}

.animate-radar {
  animation: radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

/* CSS Cloud */
.css-cloud {
  width: 50px;
  height: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  position: relative;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  animation: float 4s ease-in-out infinite;
}

.css-cloud::after,
.css-cloud::before {
  content: '';
  position: absolute;
  background: inherit;
  border-radius: 50%;
}

.css-cloud::after {
  width: 25px;
  height: 25px;
  top: -15px;
  left: 8px;
}

.css-cloud::before {
  width: 18px;
  height: 18px;
  top: -10px;
  left: 24px;
}

/* CSS Sun */
.css-sun {
  width: 40px;
  height: 40px;
  background: radial-gradient(circle, #fde047 0%, #f59e0b 100%);
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.6);
  position: relative;
  animation: sun-pulse 4s ease-in-out infinite;
}

.css-sun::after {
  content: '';
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  border-radius: 50%;
  background: rgba(251, 191, 36, 0.2);
  filter: blur(8px);
  z-index: -1;
}

@keyframes sun-pulse {

  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }

  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

/* Slow spin for sun */
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin-slow 20s linear infinite;
}

/* Pulsing glow */
@keyframes pulse-slow {

  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }

  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}

/* Floating clouds */
@keyframes float {
  0% {
    transform: translateY(0);
    opacity: 0.4;
  }

  25% {
    transform: translateX(-8px) translateY(-3px);
    opacity: 0.6;
  }

  50% {
    transform: translateX(-15px) translateY(-6px);
    opacity: 0.5;
  }

  75% {
    transform: translateX(-8px) translateY(-3px);
    opacity: 0.6;
  }

  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

/* Rain drops */
@keyframes rain-drop {
  0% {
    transform: translateY(-10px);
    opacity: 0;
  }

  10% {
    opacity: 1;
  }

  90% {
    opacity: 1;
  }

  100% {
    transform: translateY(100px);
    opacity: 0;
  }
}

.animate-rain-drop {
  animation: rain-drop 1.5s linear infinite;
}

/* Snow fall */
@keyframes snow-fall {
  0% {
    transform: translateY(-10px) translateX(0) rotate(0deg);
    opacity: 0;
  }

  10% {
    opacity: 1;
  }

  90% {
    opacity: 1;
  }

  100% {
    transform: translateY(120px) translateX(10px) rotate(180deg);
    opacity: 0;
  }
}

.animate-snow-fall {
  animation: snow-fall 3s ease-in-out infinite;
}

/* Lightning flash */
@keyframes lightning {

  0%,
  90%,
  100% {
    opacity: 0;
  }

  92%,
  94% {
    opacity: 0.3;
  }

  93% {
    opacity: 0;
  }
}

.animate-lightning {
  animation: lightning 5s ease-in-out infinite;
}

/* Gradient radial background */
.bg-gradient-radial {
  background: radial-gradient(circle, var(--tw-gradient-stops));
}
</style>
