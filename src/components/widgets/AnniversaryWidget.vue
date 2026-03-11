<template>
  <div class="anniversary-widget bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 rounded-[24px] p-4 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] border border-pink-100/50 h-full flex flex-col animate-fade-in relative overflow-hidden">
    <!-- Background Decorations -->
    <div class="absolute top-2 right-2 w-12 h-12 bg-gradient-to-br from-pink-200/30 to-purple-200/30 rounded-full blur-xl"></div>
    <div class="absolute bottom-2 left-2 w-10 h-10 bg-gradient-to-tr from-rose-200/30 to-pink-200/30 rounded-full blur-xl"></div>
    
    <!-- Header -->
    <div class="flex items-center justify-between mb-3 relative z-10">
      <h3 class="text-[15px] font-black text-slate-700 flex items-center gap-2">
        <i class="fa-solid fa-cake-candles text-pink-400 text-sm"></i> 纪念日
      </h3>
      <div class="flex items-center gap-1">
        <i class="fa-solid fa-heart text-pink-400 text-[12px] animate-heartbeat"></i>
        <i class="fa-solid fa-star text-purple-400 text-[10px] animate-twinkle"></i>
      </div>
    </div>

    <!-- Content -->
    <div v-if="anniversaries.length > 0" class="flex-1 flex flex-col justify-center relative z-10">
      <div v-for="(anni, index) in anniversaries.slice(0, 2)" :key="anni.id" 
           class="bg-white/80 backdrop-blur-sm rounded-[16px] p-3 mb-2 border border-pink-100/50 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white shadow-md">
            <i :class="getIconClass(anni.type)" class="text-[12px]"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-bold text-slate-700 truncate">{{ anni.name }}</div>
            <div class="text-[9px] text-slate-400 font-medium">{{ formatDate(anni.date) }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1">
            <span class="text-[16px] font-black bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
              {{ getDaysUntil(anni.date) }}
            </span>
            <span class="text-[9px] font-bold text-slate-500">天后</span>
          </div>
          <div class="text-[8px] text-pink-400 font-bold bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
            {{ getDayOfWeek(anni.date) }}
          </div>
        </div>
      </div>
      
      <div v-if="anniversaries.length > 2" class="text-center mt-1">
        <span class="text-[8px] text-slate-400 font-medium">还有 {{ anniversaries.length - 2 }} 个纪念日...</span>
      </div>
    </div>
    
    <div v-else class="flex-1 flex flex-col items-center justify-center relative z-10">
      <div class="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center mb-2 border border-pink-100">
        <i class="fa-regular fa-calendar text-2xl text-pink-300"></i>
      </div>
      <p class="text-[9px] text-slate-400 font-medium">还没有纪念日哦~</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCalendarStore } from '@/stores/calendarStore'

const calendarStore = useCalendarStore()

const anniversaries = ref([])

onMounted(() => {
  loadAnniversaries()
})

function loadAnniversaries() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const allAnniversaries = calendarStore.anniversaries || []
  
  // Filter future anniversaries and calculate days until
  const futureAnniversaries = allAnniversaries
    .map(anni => {
      const anniDate = new Date(anni.date)
      const thisYearDate = new Date(today.getFullYear(), anniDate.getMonth(), anniDate.getDate())
      
      let nextDate = thisYearDate
      if (thisYearDate < today) {
        nextDate = new Date(today.getFullYear() + 1, anniDate.getMonth(), anniDate.getDate())
      }
      
      return {
        ...anni,
        nextDate: nextDate,
        daysUntil: Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24))
      }
    })
    .filter(anni => anni.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
  
  anniversaries.value = futureAnniversaries.slice(0, 5)
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
</style>
