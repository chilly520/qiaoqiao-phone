<template>
  <div class="phone-desktop" :style="desktopStyle" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
    <!-- Kawaii Overlay -->
    <div class="kawaii-background-overlay"></div>

    <!-- Floating Sparkles -->
    <div class="sparkles-container">
      <div v-for="n in 6" :key="n" class="sparkle" :style="getSparkleStyle(n)"></div>
    </div>

    <!-- Clock Widget - Cute Style -->
    <div class="kawaii-clock animate-bounce-soft">
      <div class="time-wrapper">
        <span class="time">{{ currentTime }}</span>
        <div class="time-glow"></div>
      </div>
      <div class="date-bubble">
        <i class="fa-solid fa-cloud-sun mr-2 text-yellow-300"></i>
        <span>{{ currentDate }}</span>
      </div>
    </div>

    <!-- Desktop Paging Content -->
    <div class="desktop-pages-container flex-1 relative overflow-hidden">
      <transition :name="slideDirection === 'left' ? 'slide-left' : 'slide-right'" mode="out-in">
        <!-- PAGE 1: 2 Frames + Primary Apps -->
        <div v-if="currentPage === 1" key="page1" class="desktop-page px-8">
          <!-- Photo Frames -->
          <div class="photo-frames-container mt-6 flex justify-between gap-4">
            <div v-for="frame in desktopFrames" :key="frame.id" class="photo-frame-item group"
              @click="handleOpenApp('photos')">
              <div class="frame-border">
                <div class="frame-inner">
                  <img v-if="frame.url" :src="frame.url" class="frame-img">
                  <div v-else class="frame-empty">
                    <i class="fa-solid fa-heart text-pink-200 text-xl"></i>
                  </div>
                </div>
                <div class="frame-tape"></div>
              </div>
              <span class="frame-label">{{ frame.note || '记录美好' }}</span>
            </div>
          </div>

          <!-- App Grid Page 1 -->
          <div class="app-grid mt-10">
            <div v-for="(app, index) in page1Apps" :key="app.id" class="app-item group" @click="handleOpenApp(app.id)">
              <div class="app-icon-container">
                <div class="app-icon" :style="getIconStyle(app)">
                  <div class="icon-inner-shadow"></div>
                  <i :class="app.icon"></i>
                </div>
                <div v-if="getBadge(app.id)" class="kawaii-badge">{{ getBadge(app.id) }}</div>
              </div>
              <span class="app-label text-shadow">{{ app.name }}</span>
            </div>
          </div>
        </div>

        <!-- PAGE 2: Anniversary Widget + Secondary Apps -->
        <div v-else key="page2" class="desktop-page px-8">
          <!-- Anniversary Widget -->
          <div
            class="anniversary-widget mt-6 p-5 rounded-[28px] bg-white/80 backdrop-blur-md shadow-lg border-2 border-pink-100 flex flex-col items-center animate-pop-in">
            <div class="heart-icon text-pink-400 text-3xl mb-1 mt-1">
              <i :class="anniversaryData.isFuture ? 'fa-solid fa-gift' : 'fa-solid fa-heart-pulse'" class="animate-pulse"></i>
            </div>
            <div class="text-[#8F5E6E] font-black text-sm uppercase tracking-widest">{{ anniversaryData.title }}</div>
            <div class="flex items-baseline gap-1 mt-1 mb-1">
              <span class="text-4xl font-black text-[#FC6C9C] tracking-tighter">{{ daysSince }}</span>
              <span class="text-xs font-bold text-[#FC6C9C]">{{ anniversaryData.unit }}</span>
            </div>
            <p class="text-[10px] text-gray-400 font-bold italic text-center px-4">{{ anniversaryData.desc }}</p>
          </div>

          <!-- App Grid Page 2 -->
          <div class="app-grid mt-10">
            <div v-for="(app, index) in page2Apps" :key="app.id" class="app-item group" @click="handleOpenApp(app.id)">
              <div class="app-icon-container">
                <div class="app-icon" :style="getIconStyle(app)">
                  <div class="icon-inner-shadow"></div>
                  <i :class="app.icon"></i>
                </div>
                <div v-if="getBadge(app.id)" class="kawaii-badge">{{ getBadge(app.id) }}</div>
              </div>
              <span class="app-label text-shadow">{{ app.name }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Paging Dots -->
    <div class="paging-dots flex gap-2 justify-center">
      <div v-for="p in 2" :key="p" class="dot" :class="{ active: currentPage === p }" @click="switchPage(p)"></div>
    </div>

    <!-- Cute Floating Dock -->
    <div class="kawaii-dock-area">
      <div class="dock-cloud">
        <div v-for="app in dockApps" :key="app.id" class="dock-item" @click="handleOpenApp(app.id)">
          <div class="dock-icon" :style="getIconStyle(app)">
            <i :class="app.icon"></i>
            <div class="dock-dot"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Batch Generate Modal -->
    <BatchGenerateModal v-model="showGenerateModal" @generate="handleBatchGenerate" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePhoneInspectionStore } from '../../../stores/phoneInspectionStore'
import { useCalendarStore } from '../../../stores/calendarStore'
import BatchGenerateModal from './BatchGenerateModal.vue'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: () => ({
      url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1470&auto=format&fit=crop',
      type: 'static'
    })
  }
})

const phoneStore = usePhoneInspectionStore()
if (!phoneStore) {
  console.error('[PhoneDesktop] CRITICAL: usePhoneInspectionStore() returned null/undefined!')
}

console.log('[PhoneDesktop] Store initialized:', !!phoneStore)

const calendarStore = useCalendarStore()
const emit = defineEmits(['open-app'])

const currentTime = ref('')
const currentDate = ref('')
const currentPage = ref(1)
const slideDirection = ref('left')
const showGenerateModal = ref(false)

const desktopStyle = computed(() => {
  const url = props.wallpaper?.url || 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1470&auto=format&fit=crop'
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
})

const desktopFrames = computed(() => {
  const frames = phoneStore.phoneData?.desktopFrames
  if (!frames || frames.length === 0) {
    return [
      { id: 'f1', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300', note: '心动瞬间' },
      { id: 'f2', url: null, note: '虚位以待' }
    ]
  }
  return frames
})
// 从日历 store 获取最近的纪念日
const nearestAnniversary = computed(() => {
  const anniversaries = calendarStore.anniversaries || []
  if (anniversaries.length === 0) return null
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // 计算每个纪念日距离今天的天数
  const anniversariesWithDays = anniversaries.map(anni => {
    const anniDate = new Date(anni.date)
    const thisYearDate = new Date(today.getFullYear(), anniDate.getMonth(), anniDate.getDate())
    
    let nextDate = thisYearDate
    if (thisYearDate < today) {
      nextDate = new Date(today.getFullYear() + 1, anniDate.getMonth(), anniDate.getDate())
    }
    
    const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24))
    
    // 计算已经过去的天数（如果是过去的纪念日）
    const daysSince = Math.floor((today - anniDate) / (1000 * 60 * 60 * 24))
    
    return {
      ...anni,
      daysUntil,
      daysSince: daysSince >= 0 ? daysSince : 0
    }
  })
  
  // 返回最近的纪念日（优先未来的，其次是过去的）
  const future = anniversariesWithDays.filter(a => a.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil)
  const past = anniversariesWithDays.filter(a => a.daysUntil < 0).sort((a, b) => b.daysSince - a.daysSince)
  
  return future.length > 0 ? future[0] : past[0]
})

const anniversaryData = computed(() => {
  if (!nearestAnniversary.value) {
    return { title: '心动', date: '2026-01-01', unit: '天', desc: '遇见你真好' }
  }
  
  const isFuture = nearestAnniversary.value.daysUntil > 0
  
  return {
    title: nearestAnniversary.value.name || '纪念日',
    date: nearestAnniversary.value.date,
    unit: '天',
    desc: getAnniversaryDesc(nearestAnniversary.value),
    isFuture
  }
})

const daysSince = computed(() => {
  if (!nearestAnniversary.value) {
    return 0
  }
  
  // 如果是未来的纪念日，显示倒计时天数
  if (nearestAnniversary.value.isFuture) {
    return nearestAnniversary.value.daysUntil
  }
  
  // 如果是过去的纪念日，显示已经过去的天数
  return nearestAnniversary.value.daysSince || 0
})

function getAnniversaryDesc(anni) {
  const typeMap = {
    'birthday': '生日快乐！',
    'anniversary': '特别的纪念日',
    'travel': '旅行的回忆',
    'graduation': '毕业纪念',
    'wedding': '结婚纪念日',
    'baby': '宝宝的成长',
    'pet': '宠物的陪伴',
    'other': '美好的日子'
  }
  return typeMap[anni.type] || '值得纪念的日子'
}

// App distribution
const page1Apps = [
  { id: 'wechat', name: '微信', icon: 'fa-brands fa-weixin', color: '#BDECB6', textColor: '#5A8F53' },
  { id: 'calls', name: '通话', icon: 'fa-solid fa-phone', color: '#FFD1DC', textColor: '#A66D7A' },
  { id: 'messages', name: '短信', icon: 'fa-solid fa-envelope', color: '#C1E1C1', textColor: '#6B8E6B' },
  { id: 'wallet', name: '钱包', icon: 'fa-solid fa-wallet', color: '#FDFD96', textColor: '#968F30' },
  { id: 'shopping', name: '市集', icon: 'fa-solid fa-basket-shopping', color: '#FFB7CE', textColor: '#9C586E' },
  { id: 'photos', name: '画廊', icon: 'fa-solid fa-camera-retro', color: '#B2E2F2', textColor: '#5B8A99' },
  { id: 'backpack', name: '背包', icon: 'fa-solid fa-briefcase', color: '#FFD700', textColor: '#8B4513' },
  { id: 'settings', name: '枢纽', icon: 'fa-solid fa-gear', color: '#DCDCDC', textColor: '#696969' }
]

const page2Apps = [
  { id: 'footprints', name: '足迹', icon: 'fa-solid fa-shoe-prints', color: '#AEEEEE', textColor: '#5F9EA0' },
  { id: 'notes', name: '碎片', icon: 'fa-solid fa-pen-nib', color: '#C5A3FF', textColor: '#6E4BA6' },
  { id: 'reminders', name: '备忘录', icon: 'fa-solid fa-check-double', color: '#98FB98', textColor: '#2E8B57' },
  { id: 'browser', name: '探索', icon: 'fa-solid fa-paper-plane', color: '#A0E7E5', textColor: '#4F8A88' },
  { id: 'history', name: '回忆', icon: 'fa-solid fa-clock-rotate-left', color: '#FFC0CB', textColor: '#D02090' },
  { id: 'music', name: '音符', icon: 'fa-solid fa-music', color: '#E0BBE4', textColor: '#7C5D81' },
  { id: 'calendar', name: '时光', icon: 'fa-solid fa-calendar-days', color: '#FEC8D8', textColor: '#8F5E6E' },
  { id: 'meituan', name: '便当', icon: 'fa-solid fa-cookie-bite', color: '#FFE5B4', textColor: '#8B6A47' },
  { id: 'forum', name: '树洞', icon: 'fa-solid fa-comment-dots', color: '#D4F1F4', textColor: '#58888C' },
  { id: 'recorder', name: '留声', icon: 'fa-solid fa-microphone-lines', color: '#FFA07A', textColor: '#B22222' },
  { id: 'email', name: '邮件', icon: 'fa-solid fa-paper-plane', color: '#BFEFFF', textColor: '#4682B4' },
  { id: 'files', name: '宝库', icon: 'fa-solid fa-folder-open', color: '#B0C4DE', textColor: '#4682B4' }
]

const dockApps = [
  { id: 'wechat', icon: 'fa-brands fa-weixin', color: '#BDECB6' },
  { id: 'calls', icon: 'fa-solid fa-heart', color: '#FFD1DC' },
  { id: 'photos', icon: 'fa-solid fa-image', color: '#B2E2F2' },
  { id: 'generate', icon: 'fa-solid fa-wand-magic-sparkles', color: '#FC6C9C', isAction: true },
  { id: 'settings', icon: 'fa-solid fa-paw', color: '#E0BBE4' }
]

function getBadge(appId) {
  if (appId === 'wechat') {
    return phoneStore.phoneData?.apps?.wechat?.conversations?.reduce((acc, c) => acc + (c.unread || 0), 0) || null
  }
  return null
}

function getIconStyle(app) {
  return {
    backgroundColor: app.color,
    color: app.textColor || 'white',
    boxShadow: `0 8px 0 ${adjustColor(app.color, -15)}`
  }
}

function adjustColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
}

function handleOpenApp(appId) {
  const app = dockApps.find(a => a.id === appId) || [...page1Apps, ...page2Apps].find(a => a.id === appId)
  if (app?.isAction) {
    if (appId === 'generate') showGenerateModal.value = true
    return
  }
  emit('open-app', appId)
}

async function handleBatchGenerate(selectedIds) {
  if (!phoneStore.currentCharId) return
  phoneStore.triggerToast('正在生成数据，请稍候~', 'info')
  const success = await phoneStore.batchGenerateAppData(phoneStore.currentCharId, selectedIds)
  if (success) {
    phoneStore.triggerToast('数据生成完成喵~', 'success')
    // 触发碎碎念：优先使用第一个生成的应用作为碎碎念来源
    if (selectedIds && selectedIds.length > 0) {
      phoneStore.triggerMuttering(selectedIds[0])
    }
  } else {
    phoneStore.triggerToast('生成失败，请重试', 'error')
  }
}

function switchPage(p) {
  if (p === currentPage.value) return
  slideDirection.value = p > currentPage.value ? 'left' : 'right'
  currentPage.value = p
}

// Swipe support
const touchStartX = ref(0)
function handleTouchStart(e) {
  touchStartX.value = e.touches[0].clientX
}
function handleTouchEnd(e) {
  const touchEndX = e.changedTouches[0].clientX
  const diff = touchStartX.value - touchEndX
  if (Math.abs(diff) > 50) {
    if (diff > 0 && currentPage.value === 1) switchPage(2)
    else if (diff < 0 && currentPage.value === 2) switchPage(1)
  }
}

function getSparkleStyle(n) {
  return {
    top: `${Math.random() * 80}%`,
    left: `${Math.random() * 90}%`,
    animationDelay: `${n * 0.4}s`
  }
}

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  currentDate.value = `${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
}

onMounted(() => {
  updateTime()
  const timer = setInterval(updateTime, 60000)
  onUnmounted(() => clearInterval(timer))
})
</script>

<style scoped>
.phone-desktop {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: #E3F2FD;
}

.kawaii-background-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 192, 203, 0.1) 100%);
  pointer-events: none;
}

/* Photo Frames */
.photo-frames-container {
  z-index: 5;
}

.photo-frame-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.photo-frame-item:hover {
  transform: rotate(-2deg) scale(1.05);
}

.frame-border {
  position: relative;
  padding: 6px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  width: 100%;
  aspect-ratio: 1;
}

.frame-inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #fdf2f8;
  border-radius: 2px;
}

.frame-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.frame-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frame-tape {
  position: absolute;
  top: -8px;
  left: 20%;
  width: 60%;
  height: 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 2px;
  transform: rotate(-3deg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.frame-label {
  margin-top: 6px;
  font-size: 10px;
  font-weight: 900;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  background: rgba(255, 182, 193, 0.6);
  padding: 2px 8px;
  border-radius: 10px;
}

/* Sparkles */
.sparkles-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  animation: sparkle-float 3s infinite ease-in-out;
  opacity: 0.6;
}

@keyframes sparkle-float {

  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.4;
  }

  50% {
    transform: translateY(-20px) scale(1.2);
    opacity: 0.8;
  }
}

/* Clock Widget */
.kawaii-clock {
  margin-top: 50px;
  text-align: center;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.time {
  font-size: 64px;
  font-weight: 800;
  color: white;
  text-shadow: 4px 4px 0 rgba(255, 182, 193, 0.4);
  letter-spacing: -2px;
}

.date-bubble {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 12px;
  border-radius: 20px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 700;
  color: #A66D7A;
}

/* App Grid */
.desktop-page {
  animation: fade-in-up 0.4s ease-out;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px 10px;
}

.paging-dots {
  position: absolute;
  bottom: 120px;
  left: 0;
  right: 0;
}

.dot {
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  opacity: 0.3;
  transition: all 0.3s;
  cursor: pointer;
}

.dot.active {
  opacity: 0.8;
  transform: scale(1.3);
}

.anniversary-widget {
  width: 100%;
}

.text-shadow {
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.shadow-inner {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-icon-container {
  position: relative;
  width: 58px;
  height: 58px;
  margin: 0 auto;
}

.app-icon {
  width: 100%;
  height: 100%;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;
}

.app-icon:active {
  transform: translateY(4px);
}

.app-label {
  margin-top: 8px;
  font-size: 11px;
  font-weight: bold;
  color: #8F5E6E;
  text-align: center;
}

.kawaii-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #FF69B4;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  border: 2px solid white;
}

/* Dock UI */
.kawaii-dock-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 10px;
  background: linear-gradient(to top, rgba(255, 255, 255, 0.8), transparent 80%);
  pointer-events: none;
}

.dock-cloud {
  pointer-events: auto;
  display: flex;
  gap: 12px;
  padding: 8px 18px;
  background: white;
  border-radius: 35px;
  box-shadow: 0 8px 0 #F0F0F0, 0 15px 30px rgba(0, 0, 0, 0.05);
}

.dock-icon {
  width: 50px;
  height: 50px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  cursor: pointer;
}

.animate-bounce-soft {
  animation: bounce-soft 4s infinite ease-in-out;
}

@keyframes bounce-soft {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

.app-grid-container::-webkit-scrollbar {
  display: none;
}
</style>
