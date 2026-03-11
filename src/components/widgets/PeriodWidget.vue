<template>
  <div class="period-widget bg-white rounded-[24px] p-4 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] border border-rose-100/50 h-full flex flex-col animate-fade-in">
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[15px] font-black text-slate-800 flex items-center gap-2">
        <i class="fa-solid fa-flower text-rose-400 text-sm"></i> 经期
      </h3>
      <i class="fa-solid fa-asterisk text-rose-400 text-[20px] animate-pulse-slow"></i>
    </div>

    <!-- Calendar Grid -->
    <div class="flex-1 flex flex-col items-center justify-center">
      <div class="grid grid-cols-7 gap-1 w-full">
        <div v-for="day in displayDays" :key="day.id" 
             class="aspect-square rounded-full flex items-center justify-center relative"
             :class="getDayClass(day)">
          <div v-if="day.isCurrentPeriod" class="absolute inset-0 bg-rose-400 rounded-full animate-pulse-glow"></div>
          <div v-else-if="day.isPredictedPeriod" class="absolute inset-0 bg-rose-200 rounded-full"></div>
          <div v-else-if="day.isOvulation" class="absolute inset-0 bg-purple-200 rounded-full"></div>
          <span v-if="day.isCurrentMonth" 
                class="relative z-10 text-[9px] font-bold"
                :class="getDayTextClass(day)">
            {{ day.day }}
          </span>
        </div>
      </div>
    </div>

    <!-- Countdown -->
    <div class="mt-3 text-center">
      <div class="flex items-baseline justify-center gap-1">
        <span class="text-[28px] font-black text-slate-800">{{ daysUntilNext }}</span>
        <span class="text-[11px] font-bold text-slate-500">天</span>
      </div>
      <p class="text-[9px] text-slate-400 font-medium mt-0.5">距离预测经期</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCalendarStore } from '@/stores/calendarStore'

const calendarStore = useCalendarStore()

const displayDays = ref([])
const daysUntilNext = ref(0)

onMounted(() => {
  generateCalendarDays()
  calculateDaysUntilNext()
})

function generateCalendarDays() {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  
  const startDay = firstDayOfMonth.getDay()
  const totalDays = lastDayOfMonth.getDate()
  
  const days = []
  
  // Previous month days
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      id: `prev-${i}`,
      day: prevMonthLastDay - i,
      isCurrentMonth: false,
      isCurrentPeriod: false,
      isPredictedPeriod: false,
      isOvulation: false
    })
  }
  
  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(currentYear, currentMonth, day)
    const dayInfo = checkDayStatus(currentDate)
    
    days.push({
      id: `current-${day}`,
      day: day,
      isCurrentMonth: true,
      ...dayInfo
    })
  }
  
  // Next month days
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      id: `next-${i}`,
      day: i,
      isCurrentMonth: false,
      isCurrentPeriod: false,
      isPredictedPeriod: false,
      isOvulation: false
    })
  }
  
  displayDays.value = days
}

function checkDayStatus(date) {
  const periodData = calendarStore.periodData
  
  // Check current period
  for (const cycle of periodData.cycles) {
    const start = new Date(cycle.startDate)
    const end = new Date(cycle.endDate)
    if (date >= start && date <= end) {
      return { isCurrentPeriod: true, isPredictedPeriod: false, isOvulation: false }
    }
  }
  
  // Check predicted period
  for (const pred of periodData.predictions) {
    const start = new Date(pred.startDate)
    const end = new Date(pred.endDate)
    if (date >= start && date <= end) {
      if (pred.type === 'ovulation') {
        return { isCurrentPeriod: false, isPredictedPeriod: false, isOvulation: true }
      }
      return { isCurrentPeriod: false, isPredictedPeriod: true, isOvulation: false }
    }
  }
  
  return { isCurrentPeriod: false, isPredictedPeriod: false, isOvulation: false }
}

function calculateDaysUntilNext() {
  const predictions = calendarStore.periodData.predictions
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const nextPeriod = predictions.find(p => {
    const startDate = new Date(p.startDate)
    return startDate >= today && p.type === 'period'
  })
  
  if (nextPeriod) {
    const startDate = new Date(nextPeriod.startDate)
    const diffTime = startDate.getTime() - today.getTime()
    daysUntilNext.value = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  } else {
    daysUntilNext.value = 0
  }
}

function getDayTextClass(day) {
  if (day.isCurrentPeriod) {
    return 'text-white'
  } else if (day.isPredictedPeriod) {
    return 'text-rose-600'
  } else if (day.isOvulation) {
    return 'text-purple-600'
  } else {
    return 'text-slate-400'
  }
}

function getDayClass(day) {
  if (day.isCurrentPeriod) {
    return 'bg-rose-400 text-white shadow-lg shadow-rose-200'
  } else if (day.isPredictedPeriod) {
    return 'bg-rose-100'
  } else if (day.isOvulation) {
    return 'bg-purple-100'
  } else if (!day.isCurrentMonth) {
    return 'text-slate-200'
  } else {
    return ''
  }
}
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-pulse-glow {
  animation: pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251, 113, 133, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(251, 113, 133, 0); }
}

.animate-pulse-slow {
  animation: pulseSlow 3s ease-in-out infinite;
}

@keyframes pulseSlow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}
</style>
