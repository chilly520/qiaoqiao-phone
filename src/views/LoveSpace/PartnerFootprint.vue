<template>
  <div class="partner-footprint">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>{{ partnerName }} 的足迹</h2>
      <div class="header-action">
        <button @click="generateFootprint" class="magic-btn" :disabled="isGenerating">
          <i class="fa-solid fa-wand-magic-sparkles" :class="{ 'fa-spin': isGenerating }"></i>
        </button>
      </div>
    </div>

    <!-- 日历区域 -->
    <div class="calendar-section">
      <div class="calendar-header">
        <button @click="prevMonth" class="cal-btn-hex"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="month-label">{{ currentMonthLabel }}</span>
        <button @click="nextMonth" class="cal-btn-hex"><i class="fa-solid fa-chevron-right"></i></button>
        <button @click="selectedDate = todayStr; currentMonth = new Date()" class="today-tag">今天</button>
      </div>
      <div class="calendar-grid">
        <div v-for="day in ['日','一','二','三','四','五','六']" :key="day" class="weekday-label">{{ day }}</div>
        <div 
          v-for="d in calendarDays" 
          :key="d.dateStr" 
          class="calendar-day"
          :class="{ 
            'current-month': d.isCurrentMonth, 
            'selected': d.dateStr === selectedDate,
            'has-content': footprintDates.has(d.dateStr)
          }"
          @click="selectDate(d.dateStr)"
        >
          <span class="day-num">{{ d.day }}</span>
          <div v-if="footprintDates.has(d.dateStr)" class="pulse-dot"></div>
        </div>
      </div>
    </div>

    <div class="scroll-container" ref="scrollContainer">
      <!-- 今日状态 -->
      <div class="today-status" v-if="latestFootprint">
        <div class="status-card">
          <div class="status-icon">🕒</div>
          <div class="status-text">
            <p class="time">最后活跃: {{ formatTime(latestFootprint.createdAt) }}</p>
            <p class="content">在 <b>{{ latestFootprint.location || '地球某处' }}</b> {{ latestFootprint.content }}</p>
          </div>
        </div>
      </div>

      <!-- 足迹流 -->
      <div class="footprint-timeline">
        <div v-if="footprints.length === 0" class="empty-state">
          <div class="empty-icon">📍</div>
          <p>{{ partnerName }} 还没有留下足迹呢...</p>
          <button @click="generateFootprint" class="init-btn">召唤足迹</button>
        </div>

        <div v-for="(group, dateKey) in groupedFootprints" :key="dateKey" class="date-group">
          <div class="date-header">
            <span class="day-label">{{ formatDateLabel(dateKey) }}</span>
            <span class="weekday">{{ getWeekday(dateKey) }}</span>
          </div>
          
          <div v-for="(item, index) in group" :key="item.id" class="timeline-item">
            <div class="timeline-left">
              <span class="time">{{ getClock(item.createdAt) }}</span>
              <div class="line" v-if="index !== group.length - 1 || Object.keys(groupedFootprints).indexOf(dateKey) !== Object.keys(groupedFootprints).length - 1"></div>
            </div>
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="footprint-card">
                <button class="delete-btn-tiny" @click="deleteFootprint(item.id)">
                  <i class="fa-solid fa-xmark"></i>
                </button>
                <p class="text">{{ item.content }}</p>
                <div class="footprint-footer" v-if="item.location">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>{{ item.location }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'

const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const footprints = computed(() => loveSpaceStore.footprints || [])
const partnerName = computed(() => loveSpaceStore.partner?.name || 'TA')
const isGenerating = computed(() => loveSpaceStore.isMagicGenerating)
const scrollContainer = ref(null)

const selectedDate = ref(new Date().toISOString().split('T')[0])
const todayStr = new Date().toISOString().split('T')[0]
const currentMonth = ref(new Date())

const footprintDates = computed(() => {
  const dates = new Set()
  footprints.value.forEach(f => {
    if (f.createdAt) {
      dates.add(new Date(f.createdAt).toISOString().split('T')[0])
    }
  })
  return dates
})

const currentMonthLabel = computed(() => {
  return `${currentMonth.value.getFullYear()}年${currentMonth.value.getMonth() + 1}月`
})

const calendarDays = computed(() => {
  const d = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1)
  const days = []
  const startOffset = d.getDay()
  
  // Fill leading days from prev month
  const prevMonthLastDay = new Date(d.getFullYear(), d.getMonth(), 0).getDate()
  for (let i = startOffset - 1; i >= 0; i--) {
     const date = new Date(d.getFullYear(), d.getMonth() - 1, prevMonthLastDay - i)
     days.push({ 
       day: date.getDate(), 
       dateStr: date.toISOString().split('T')[0],
       isCurrentMonth: false 
     })
  }

  // Current month
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  for (let i = 1; i <= lastDay; i++) {
    const date = new Date(d.getFullYear(), d.getMonth(), i)
    days.push({ 
       day: i, 
       dateStr: date.toISOString().split('T')[0],
       isCurrentMonth: true 
    })
  }
  
  // Fill remaining days
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(d.getFullYear(), d.getMonth() + 1, i)
    days.push({ 
      day: i, 
      dateStr: date.toISOString().split('T')[0],
      isCurrentMonth: false 
    })
  }
  
  return days
})

function prevMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1)
}

function nextMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1)
}

function selectDate(dateStr) {
  selectedDate.value = dateStr
}

const sortedFootprints = computed(() => {
  return [...footprints.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const groupedFootprints = computed(() => {
  const groups = {}
  let list = sortedFootprints.value
  
  // 过滤出选中的日期
  const filtered = list.filter(f => {
    const dStr = new Date(f.createdAt).toISOString().split('T')[0]
    return dStr === selectedDate.value
  })

  if (filtered.length > 0) {
    groups[selectedDate.value] = filtered
  }
  
  return groups
})

const latestFootprint = computed(() => {
  const today = footprints.value.filter(f => f.createdAt?.startsWith(todayStr))
  return today.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || sortedFootprints.value[0]
})

function formatDateLabel(dateStr) {
  const d = new Date(dateStr)
  if (dateStr === todayStr) return '今天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function getWeekday(dateStr) {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return days[new Date(dateStr).getDay()]
}

function formatTime(dateStr) {
  const date = new Date(dateStr)
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

function getClock(dateStr) {
  const date = new Date(dateStr)
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

async function deleteFootprint(id) {
  loveSpaceStore.currentSpace.footprints = loveSpaceStore.currentSpace.footprints.filter(f => f.id !== id)
  await loveSpaceStore.saveToStorage()
}

async function generateFootprint() {
  if (isGenerating.value) return
  try {
    chatStore.triggerToast('正在施放足迹魔法... ✨', 'info')
    await loveSpaceStore.generateSingleFeature('footprint')
  } catch (e) {
    console.error('Generate footprint failed', e)
    chatStore.triggerToast('召唤足迹失败，稍后再试吧', 'error')
  }
}
</script>

<style scoped>
.partner-footprint {
  height: 100vh;
  background: #f8fbff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scroll-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.header {
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.calendar-section {
  background: white;
  padding: 10px 15px;
  border-bottom: 1px solid #f0f4ff;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.month-label {
  font-size: 14px;
  font-weight: 800;
  color: #5a5a7a;
}

.cal-btn-hex {
  background: none;
  border: none;
  color: #c084fc;
  font-size: 14px;
  cursor: pointer;
}

.today-tag {
  font-size: 11px;
  background: #f0f4ff;
  color: #818cf8;
  padding: 2px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}

.weekday-label {
  font-size: 10px;
  color: #a89bb9;
  padding: 4px 0;
}

.calendar-day {
  height: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 13px;
  color: #ccc;
  position: relative;
  cursor: pointer;
}

.calendar-day.current-month { color: #5a5a7a; }
.calendar-day.selected {
  background: #c084fc;
  color: white !important;
  font-weight: 800;
}

.calendar-day.has-content:not(.selected) {
  color: #818cf8;
  font-weight: 800;
}

.pulse-dot {
  position: absolute;
  bottom: 4px;
  width: 4px;
  height: 4px;
  background: #818cf8;
  border-radius: 50%;
}

.selected .pulse-dot { background: white; }

.today-status {
  padding: 20px;
}

.status-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  border: 1px solid #f0f4ff;
}

.status-icon {
  font-size: 32px;
}

.status-text .time {
  font-size: 11px;
  color: #a89bb9;
  margin-bottom: 4px;
}

.status-text .content {
  font-size: 15px;
  font-weight: 700;
  color: #5a5a7a;
}

.footprint-timeline {
  padding: 0 20px 40px;
}

.timeline-item {
  display: flex;
  gap: 15px;
  position: relative;
}

.timeline-left {
  width: 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-left .time {
  font-size: 13px;
  color: #8b7aa8;
  font-weight: 700;
}

.timeline-left .line {
  flex: 1;
  width: 2px;
  background: #eef2ff;
  margin: 8px 0;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  background: white;
  border: 2px solid #818cf8;
  border-radius: 50%;
  margin-top: 6px;
  box-shadow: 0 0 10px rgba(129, 140, 248, 0.2);
  z-index: 2;
}

.date-header {
  margin: 20px 0 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.day-label {
  font-size: 16px;
  font-weight: 800;
  color: #5a5a7a;
}

.weekday {
  font-size: 11px;
  color: #a89bb9;
  font-weight: 600;
  background: #f0f4ff;
  padding: 2px 8px;
  border-radius: 20px;
}

.timeline-content {
  flex: 1;
  padding-bottom: 30px;
}

.footprint-card {
  background: white;
  padding: 16px;
  border-radius: 12px 20px 20px 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  position: relative;
}

.delete-btn-tiny {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #eee;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s;
}

.delete-btn-tiny:hover {
  color: #ff6b6b;
}

.footprint-card .text {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 10px;
}

.footprint-footer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #818cf8;
  background: #f0f4ff;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  margin-top: 8px;
}

.empty-state {
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 50px;
  margin-bottom: 15px;
  opacity: 0.3;
}

.init-btn {
  margin-top: 20px;
  padding: 10px 24px;
  border-radius: 100px;
  border: none;
  background: #c084fc;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .partner-footprint {
    padding: 0;
  }
  
  .header {
    padding: 12px 16px;
  }
  
  h2 {
    font-size: 16px;
  }
  
  .back-btn,
  .magic-btn {
    font-size: 18px;
    padding: 8px;
  }
  
  .calendar-section {
    margin: 12px;
    padding: 15px;
  }
  
  .calendar-header {
    gap: 8px;
  }
  
  .month-label {
    font-size: 14px;
  }
  
  .cal-btn-hex {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
  
  .today-tag {
    font-size: 10px;
    padding: 4px 10px;
  }
  
  .calendar-grid {
    gap: 4px;
  }
  
  .weekday-label {
    font-size: 11px;
  }
  
  .calendar-day {
    min-height: 36px;
    padding: 4px;
  }
  
  .day-num {
    font-size: 12px;
  }
  
  .pulse-dot {
    width: 4px;
    height: 4px;
  }
  
  .today-status {
    padding: 0 12px;
  }
  
  .status-card {
    padding: 12px;
  }
  
  .status-icon {
    font-size: 20px;
  }
  
  .status-text .time {
    font-size: 11px;
  }
  
  .status-text .content {
    font-size: 13px;
  }
  
  .footprint-timeline {
    padding: 0 12px 24px;
  }
  
  .date-header {
    padding: 10px 12px;
    margin-bottom: 12px;
  }
  
  .day-label {
    font-size: 13px;
  }
  
  .weekday {
    font-size: 11px;
  }
  
  .timeline-item {
    gap: 8px;
  }
  
  .timeline-left {
    width: 50px;
  }
  
  .time {
    font-size: 10px;
  }
  
  .timeline-dot {
    width: 10px;
    height: 10px;
    left: -25px;
  }
  
  .footprint-card {
    padding: 12px;
    border-radius: 10px;
  }
  
  .delete-btn-tiny {
    font-size: 12px;
    padding: 2px;
  }
  
  .footprint-card .text {
    font-size: 13px;
    line-height: 1.5;
  }
  
  .footprint-footer {
    font-size: 10px;
  }
  
  .empty-state {
    padding: 60px 15px;
  }
  
  .empty-icon {
    font-size: 40px;
  }
  
  .init-btn {
    font-size: 13px;
    padding: 8px 20px;
  }
}
</style>
