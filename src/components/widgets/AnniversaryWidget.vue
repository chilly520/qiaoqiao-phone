<template>
  <div class="anniversary-widget bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 rounded-[24px] p-4 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] border border-pink-100/50 h-full flex flex-col animate-fade-in relative overflow-hidden hover:shadow-lg transition-all duration-300">
    <!-- Background Decorations -->
    <div class="absolute top-2 right-2 w-12 h-12 bg-gradient-to-br from-pink-200/30 to-purple-200/30 rounded-full blur-xl"></div>
    <div class="absolute bottom-2 left-2 w-10 h-10 bg-gradient-to-tr from-rose-200/30 to-pink-200/30 rounded-full blur-xl"></div>
    
    <!-- Header -->
    <div class="flex items-center justify-between mb-2 relative z-10">
      <h3 class="text-[13px] font-black text-slate-700 flex items-center gap-1.5">
        <i class="fa-solid fa-cake-candles text-pink-400 text-xs"></i> 纪念日
      </h3>
      <div class="flex items-center gap-1">
        <i class="fa-solid fa-heart text-pink-400 text-[10px] animate-heartbeat"></i>
        <i class="fa-solid fa-star text-purple-400 text-[9px] animate-twinkle"></i>
        <i class="fa-solid fa-cog text-slate-400 text-[11px] ml-0.5 hover:rotate-90 transition-transform cursor-pointer" @click.stop="showSettings = true"></i>
      </div>
    </div>

    <!-- Content -->
    <div v-if="displayAnniversaries.length > 0" 
         class="flex-1 flex flex-col justify-center relative z-10"
         @touchstart="handleTouchStart"
         @touchmove="handleTouchMove"
         @touchend="handleTouchEnd">
      <!-- 轮播卡片 -->
      <div 
        class="bg-white/80 backdrop-blur-sm rounded-[14px] p-2.5 border border-pink-100/50 shadow-sm hover:shadow-md transition-all animate-fade-in"
        :style="{ transform: `translateX(${touchMoveX - touchStartX}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease' }"
      >
        <div class="flex items-center gap-1.5 mb-1.5">
          <div class="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <i :class="getIconClass(currentAnniversary.type)" class="text-[11px]"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[10px] font-bold text-slate-700 leading-tight line-clamp-2">{{ currentAnniversary.name }}</div>
            <div class="text-[8px] text-slate-400 font-medium mt-0.5">{{ formatDate(currentAnniversary.date) }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-0.5">
            <span class="text-[13px] font-black bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
              {{ getDaysUntil(currentAnniversary.date) }}
            </span>
            <span class="text-[7px] font-bold text-slate-500">天后</span>
          </div>
          <div class="text-[6px] text-pink-400 font-bold bg-pink-50 px-1.5 py-0.5 rounded-full border border-pink-100">
            {{ getDayOfWeek(currentAnniversary.date) }}
          </div>
        </div>
      </div>
      
      <!-- 轮播指示器 -->
      <div v-if="displayAnniversaries.length > 1" class="flex items-center justify-center gap-1 mt-2">
        <span v-for="(_, idx) in displayAnniversaries" :key="idx" 
              class="w-1.5 h-1.5 rounded-full transition-all duration-300"
              :class="idx === currentIndex ? 'bg-pink-400 w-3' : 'bg-slate-300'"></span>
      </div>
    </div>
    
    <div v-else class="flex-1 flex flex-col items-center justify-center relative z-10">
      <div class="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center mb-2 border border-pink-100">
        <i class="fa-regular fa-calendar text-2xl text-pink-300"></i>
      </div>
      <p class="text-[9px] text-slate-400 font-medium">还没有纪念日哦~</p>
      <p class="text-[8px] text-slate-400 mt-1">点击齿轮图标添加</p>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
         @click="closeModal">
      <div class="bg-white rounded-[24px] w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl animate-modal-slide-up"
           @click.stop>
        <!-- Modal Header -->
        <div class="bg-gradient-to-r from-pink-400 to-purple-400 p-4 flex items-center justify-between">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-cake-candles"></i>
            纪念日配置
          </h3>
          <button @click.stop="closeModal" 
                  class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
            <i class="fa-solid fa-xmark text-white text-lg"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-4 overflow-y-auto max-h-[60vh]">
          <div class="mb-4">
            <p class="text-[12px] text-slate-500 mb-2">
              <i class="fa-solid fa-circle-info text-pink-400 mr-1"></i>
              勾选希望在桌面显示的纪念日（最多显示 2 个）
            </p>
          </div>

          <!-- Calendar Store Anniversaries -->
          <div v-if="calendarAnniversaries.length > 0 || calendarCountdowns.length > 0" class="mb-4">
            <h4 class="text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-2">
              <i class="fa-regular fa-calendar-check text-pink-400"></i>
              日历纪念日
            </h4>
            <div class="space-y-2">
              <div v-for="item in calendarAnniversaries" :key="item.id"
                   class="flex items-center gap-3 p-3 rounded-[12px] border border-pink-100 hover:bg-pink-50 transition-all">
                <input type="checkbox" :id="'cal-' + item.id" v-model="selectedIds" :value="'cal-' + item.id"
                       class="w-4 h-4 rounded border-pink-300 text-pink-500 focus:ring-pink-500">
                <label :for="'cal-' + item.id" class="flex-1 cursor-pointer">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white flex-shrink-0">
                      <i :class="getIconClass(item.type)" class="text-[10px]"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[12px] font-bold text-slate-700 truncate">{{ item.name || item.title }}</div>
                      <div class="text-[9px] text-slate-400">{{ safeFormatDate(item.targetDate || item.date) }} · 剩{{ safeGetDaysUntil(item.targetDate || item.date) }}天</div>
                    </div>
                  </div>
                </label>
              </div>
              <div v-for="item in calendarCountdowns" :key="item.id"
                   class="flex items-center gap-3 p-3 rounded-[12px] border border-pink-100 hover:bg-pink-50 transition-all">
                <input type="checkbox" :id="'count-' + item.id" v-model="selectedIds" :value="'count-' + item.id"
                       class="w-4 h-4 rounded border-pink-300 text-pink-500 focus:ring-pink-500">
                <label :for="'count-' + item.id" class="flex-1 cursor-pointer">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white flex-shrink-0">
                      <i :class="getIconClass(item.type)" class="text-[10px]"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[12px] font-bold text-slate-700 truncate">{{ item.name || item.title }}</div>
                      <div class="text-[9px] text-slate-400">{{ safeFormatDate(item.targetDate || item.date) }} · 剩{{ safeGetDaysUntil(item.targetDate || item.date) }}天</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Love Space Anniversaries -->
          <div v-if="loveSpaceAnniversaries.length > 0" class="mb-4">
            <h4 class="text-[13px] font-bold text-slate-700 mb-2 flex items-center gap-2">
              <i class="fa-solid fa-house-chimney text-purple-400"></i>
              情侣空间纪念日
            </h4>
            <div class="space-y-2">
              <div v-for="(item, index) in loveSpaceAnniversaries" :key="'ls-' + index"
                   class="flex items-center gap-3 p-3 rounded-[12px] border border-purple-100 hover:bg-purple-50 transition-all">
                <input type="checkbox" :id="'ls-' + index" v-model="selectedIds" :value="'ls-' + index"
                       class="w-4 h-4 rounded border-purple-300 text-purple-500 focus:ring-purple-500">
                <label :for="'ls-' + index" class="flex-1 cursor-pointer">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white flex-shrink-0">
                      <i class="fa-solid fa-heart text-[10px]"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[12px] font-bold text-slate-700 truncate">{{ item.name || item.title }}</div>
                      <div class="text-[9px] text-slate-400">{{ safeFormatDate(item.date) }} · 剩{{ safeGetDaysUntil(item.date) }}天</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="totalAvailableItems === 0" class="text-center py-8">
            <div class="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center mb-3">
              <i class="fa-regular fa-calendar text-3xl text-pink-300"></i>
            </div>
            <p class="text-[12px] text-slate-500">暂无可用纪念日</p>
            <p class="text-[11px] text-slate-400 mt-2">请先在日历或情侣空间中创建纪念日</p>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div class="text-[11px] text-slate-500">
            已选择 <span class="font-bold text-pink-500">{{ selectedIds.length }}</span> 个
          </div>
          <div class="flex gap-2">
            <button @click.stop="selectedIds = []" 
                    class="px-4 py-2 text-[12px] rounded-[10px] border border-slate-300 text-slate-600 hover:bg-slate-100 transition-all">
              清空
            </button>
            <button @click.stop="saveSettings" 
                    class="px-6 py-2 text-[12px] font-bold text-white bg-gradient-to-r from-pink-400 to-purple-400 rounded-[10px] hover:shadow-lg hover:scale-105 transition-all">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCalendarStore } from '@/stores/calendarStore'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'

const calendarStore = useCalendarStore()
const loveSpaceStore = useLoveSpaceStore()

const showSettings = ref(false)
const selectedIds = ref([])
const anniversaries = ref([])
const currentIndex = ref(0)
let rotationInterval = null

// 触摸滑动相关
const touchStartX = ref(0)
const touchMoveX = ref(0)
const isSwiping = ref(false)
const SWIPE_THRESHOLD = 30 // 滑动阈值（像素）

// Computed
const calendarAnniversaries = computed(() => calendarStore.anniversaries || [])
const calendarCountdowns = computed(() => calendarStore.countdowns || [])
const loveSpaceAnniversaries = computed(() => loveSpaceStore.anniversaries || [])

const totalAvailableItems = computed(() => {
  return calendarAnniversaries.value.length + calendarCountdowns.value.length + loveSpaceAnniversaries.value.length
})

const displayAnniversaries = computed(() => {
  // 根据 selectedIds 过滤和排序
  const allItems = getAllItems()
  const filtered = allItems.filter(item => selectedIds.value.includes(item.fullId))
  
  // 按天数排序（最近的在前）
  return filtered.sort((a, b) => a.daysUntil - b.daysUntil)
})

const currentAnniversary = computed(() => {
  if (displayAnniversaries.value.length === 0) return null
  return displayAnniversaries.value[currentIndex.value] || displayAnniversaries.value[0]
})

onMounted(() => {
  loadSettings()
  loadAnniversaries()
  
  // 启动轮播
  if (displayAnniversaries.value.length > 1) {
    rotationInterval = setInterval(() => {
      currentIndex.value = (currentIndex.value + 1) % displayAnniversaries.value.length
    }, 4000) // 每 4 秒切换一次
  }
})

onUnmounted(() => {
  // 清理定时器
  if (rotationInterval) {
    clearInterval(rotationInterval)
  }
})

// 触摸事件处理
function handleTouchStart(e) {
  touchStartX.value = e.touches[0].clientX
  isSwiping.value = true
}

function handleTouchMove(e) {
  if (!isSwiping.value) return
  touchMoveX.value = e.touches[0].clientX
}

function handleTouchEnd() {
  if (!isSwiping.value) return
  
  const diff = touchStartX.value - touchMoveX.value
  
  // 判断滑动方向
  if (Math.abs(diff) > SWIPE_THRESHOLD) {
    if (diff > 0) {
      // 向左滑动，显示下一个
      nextAnniversary()
    } else {
      // 向右滑动，显示上一个
      prevAnniversary()
    }
  }
  
  // 重置状态
  isSwiping.value = false
  touchStartX.value = 0
  touchMoveX.value = 0
}

function nextAnniversary() {
  if (displayAnniversaries.value.length <= 1) return
  currentIndex.value = (currentIndex.value + 1) % displayAnniversaries.value.length
}

function prevAnniversary() {
  if (displayAnniversaries.value.length <= 1) return
  currentIndex.value = (currentIndex.value - 1 + displayAnniversaries.value.length) % displayAnniversaries.value.length
}

function getAllItems() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const items = []
  
  // Calendar anniversaries
  calendarAnniversaries.value.forEach(item => {
    const targetStr = item.targetDate || item.date
    const itemDate = new Date(targetStr)
    let nextDate = new Date(itemDate)
    
    if (item.isRecurring) {
      nextDate.setFullYear(today.getFullYear())
      if (nextDate < today) {
        nextDate.setFullYear(today.getFullYear() + 1)
      }
    }
    
    items.push({
      ...item,
      fullId: 'cal-' + item.id,
      name: item.title || item.name,
      date: targetStr,
      nextDate,
      daysUntil: Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24)),
      source: 'calendar'
    })
  })
  
  // Calendar countdowns
  calendarCountdowns.value.forEach(item => {
    const targetStr = item.targetDate || item.date
    const itemDate = new Date(targetStr)
    let nextDate = new Date(itemDate)
    
    if (item.isRecurring) {
      nextDate.setFullYear(today.getFullYear())
      if (nextDate < today) {
        nextDate.setFullYear(today.getFullYear() + 1)
      }
    }
    
    items.push({
      ...item,
      fullId: 'count-' + item.id,
      name: item.title || item.name,
      date: targetStr,
      nextDate,
      daysUntil: Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24)),
      source: 'calendar'
    })
  })
  
  // Love Space anniversaries
  loveSpaceAnniversaries.value.forEach((item, index) => {
    const targetStr = item.date
    const itemDate = new Date(targetStr)
    let nextDate = new Date(itemDate)
    
    if (item.isRecurring) {
      nextDate.setFullYear(today.getFullYear())
      if (nextDate < today) {
        nextDate.setFullYear(today.getFullYear() + 1)
      }
    }
    
    items.push({
      ...item,
      fullId: 'ls-' + index,
      name: item.name || item.title,
      date: targetStr,
      nextDate,
      daysUntil: Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24)),
      source: 'loveSpace',
      type: item.type || 'anniversary'
    })
  })
  
  return items.filter(item => item.daysUntil >= 0)
}

function loadAnniversaries() {
  // 这个函数现在主要用于初始化，实际显示由 displayAnniversaries 计算属性处理
}

function loadSettings() {
  const saved = localStorage.getItem('anniversary_widget_settings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      selectedIds.value = settings.selectedIds || []
    } catch (e) {
      console.error('Failed to load anniversary settings:', e)
    }
  }
}

function closeModal() {
  showSettings.value = false
}

function saveSettings() {
  const settings = {
    selectedIds: selectedIds.value
  }
  localStorage.setItem('anniversary_widget_settings', JSON.stringify(settings))
  closeModal()
}

function getDaysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const anniDate = new Date(dateStr)
  const thisYearDate = new Date(today.getFullYear(), anniDate.getMonth(), anniDate.getDate())
  
  let nextDate = thisYearDate
  if (thisYearDate < today) {
    nextDate = new Date(today.getFullYear() + 1, anniDate.getMonth(), anniDate.getDate())
  }
  
  const diff = nextDate - today
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function safeFormatDate(dateStr) {
  if (!dateStr) return '未设置日期'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '日期无效'
    return `${date.getMonth() + 1}月${date.getDate()}日`
  } catch (e) {
    return '日期错误'
  }
}

function safeGetDaysUntil(dateStr) {
  if (!dateStr) return 'NaN'
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const anniDate = new Date(dateStr)
    if (isNaN(anniDate.getTime())) return 'NaN'
    
    const thisYearDate = new Date(today.getFullYear(), anniDate.getMonth(), anniDate.getDate())
    
    let nextDate = thisYearDate
    if (thisYearDate < today) {
      nextDate = new Date(today.getFullYear() + 1, anniDate.getMonth(), anniDate.getDate())
    }
    
    const diff = nextDate - today
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  } catch (e) {
    return 'NaN'
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function getDayOfWeek(dateStr) {
  const date = new Date(dateStr)
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[date.getDay()]
}

function getIconClass(type) {
  const iconMap = {
    'birthday': 'fa-solid fa-cake-candles',
    'anniversary': 'fa-solid fa-heart',
    'travel': 'fa-solid fa-plane',
    'graduation': 'fa-solid fa-graduation-cap',
    'wedding': 'fa-solid fa-ring',
    'baby': 'fa-solid fa-baby',
    'pet': 'fa-solid fa-paw',
    'other': 'fa-solid fa-gift'
  }
  return iconMap[type] || iconMap.other
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.animate-heartbeat {
  animation: heartbeat 1.5s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  10%, 30% { transform: scale(0.9); }
  20%, 40% { transform: scale(1.1); }
}

.animate-twinkle {
  animation: twinkle 2s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
  50% { opacity: 0.5; transform: scale(1.2) rotate(180deg); }
}

.animate-modal-slide-up {
  animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
