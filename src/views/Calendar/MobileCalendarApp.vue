<template>
  <div class="mobile-calendar" :class="[{ 'dark-mode': isDarkMode }, currentTheme?.colors?.background]">
    <!-- 顶部导航栏 -->
    <div class="mobile-header">
      <button class="back-btn" @click="goBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="title-group">
        <h1 class="app-title">🌸 花间日历</h1>
        <span class="subtitle">万年历 · 日程 · 生理期</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" @click="showThemeSettings = true">
          🎨
        </button>
        <button class="add-btn" @click="showQuickAdd = true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 经期提醒横幅 -->
    <div v-if="filteredReminders.length > 0" class="reminder-banner">
      <div class="reminder-content">
        <span class="reminder-icon">🌙</span>
        <div class="reminder-text">
          <strong>{{ filteredReminders[0].title }}</strong>
          <span>{{ filteredReminders[0].message }}</span>
        </div>
      </div>
      <button class="reminder-close" @click="dismissReminder">×</button>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- Tab 1: 日历 -->
      <div v-if="activeTab === 'calendar'" class="tab-content">
        <!-- 月份导航 -->
        <div class="month-nav">
          <button class="nav-arrow" @click="handlePrev">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <div class="current-date">
            <span class="year-month">{{ currentDateText }}</span>
            <span class="lunar-info">{{ currentLunarInfo }}</span>
          </div>
          <button class="nav-arrow" @click="handleNext">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </button>
        </div>

        <!-- 周标题 -->
        <div class="week-header">
          <span v-for="day in weekDays" :key="day" :class="{ weekend: day === '日' || day === '六' }">
            {{ day }}
          </span>
        </div>

        <!-- 日历网格 - 移动端适配 -->
        <div class="calendar-grid-mobile">
          <div v-for="day in calendarDays" :key="day.date.getTime()" class="day-cell" :class="{
            'other-month': !day.isCurrentMonth,
            'is-today': day.isToday,
            'is-selected': day.isSelected,
            'has-events': day.events?.length > 0,
            'has-period': day.period?.type === 'period',
            'has-prediction': day.period?.type === 'prediction',
            'has-ovulation': day.period?.type === 'ovulation'
          }" @click="selectDate(day.date)">
            <div class="day-number">{{ day.date.getDate() }}</div>
            <div class="day-markers">
              <span v-if="day.festival || day.term" class="marker festival">{{ day.festival || day.term }}</span>
              <span v-else class="marker lunar">{{ day.lunar.dayName }}</span>
            </div>
            <div v-if="day.events?.length" class="event-dots">
              <span v-for="(event, idx) in day.events.slice(0, 3)" :key="idx" class="dot"
                :style="{ backgroundColor: event.color || '#ff9eb5' }" />
            </div>
          </div>
        </div>

        <!-- 选中日期详情卡片 -->
        <div class="selected-day-card" v-if="selectedDate">
          <div class="day-header">
            <div class="day-title">
              <span class="solar">{{ selectedDate.getMonth() + 1 }}月{{ selectedDate.getDate() }}日</span>
              <span class="weekday">{{ weekDays[selectedDate.getDay()] }}</span>
            </div>
            <div class="day-subtitle">
              {{ selectedLunar.yearName }} {{ selectedLunar.monthName }}{{ selectedLunar.dayName }}
              <span v-if="selectedTerm">· {{ selectedTerm }}</span>
              <span v-if="selectedFestival">· {{ selectedFestival }}</span>
            </div>
          </div>

          <!-- 生理期指示 -->
          <div v-if="periodStatus" class="period-indicator" :class="periodStatus.type">
            <span v-if="periodStatus.type === 'period'">🌙 生理期第 {{ periodStatus.day }} 天</span>
            <span v-else-if="periodStatus.type === 'prediction'">📅 预计经期第 {{ periodStatus.day }} 天</span>
            <span v-else-if="periodStatus.type === 'ovulation'">🌸 排卵期</span>
          </div>

          <!-- 倒计时展示 -->
          <div v-if="topCountdowns.length > 0" class="countdown-widget">
            <div v-for="cd in topCountdowns" :key="cd.id" class="cd-item"
              :style="{ backgroundColor: (cd.color || '#ff9eb5') + '20', color: cd.color || '#ff6b9d' }">
              <span class="cd-icon">⏳</span>
              <span class="cd-title">{{ cd.title }}</span>
              <span class="cd-days-text font-bold">
                {{ cd.daysLeft === 0 ? '就是今天' : `还有 ${cd.daysLeft} 天` }}
              </span>
            </div>
          </div>

          <!-- 今日日程 -->
          <div class="day-events">
            <div class="section-title">
              <span>📋 日程</span>
              <button class="add-mini" @click="openEventModal">+</button>
            </div>
            <div v-if="selectedEvents.length === 0" class="empty">暂无日程</div>
            <div v-for="event in selectedEvents" :key="event.id" class="event-item" @click="editEvent(event)">
              <span class="event-dot" :style="{ backgroundColor: event.color || '#ff9eb5' }"></span>
              <span class="event-time">{{ event.allDay ? '全天' : event.startTime }}</span>
              <span class="event-title">{{ event.title }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: 万年历 -->
      <div v-if="activeTab === 'almanac'" class="tab-content">
        <PerpetualCalendar />
      </div>

      <!-- Tab 3: 健康 -->
      <div v-if="activeTab === 'health'" class="tab-content">
        <HealthTracker />
      </div>

      <!-- Tab 4: 我的 -->
      <div v-if="activeTab === 'profile'" class="tab-content">
        <ProfilePage />
      </div>
    </div>

    <!-- 底部Tab导航 -->
    <div class="bottom-nav">
      <button class="nav-item" :class="{ active: activeTab === 'calendar' }" @click="activeTab = 'calendar'">
        <span class="nav-icon">📅</span>
        <span class="nav-label">日历</span>
      </button>
      <button class="nav-item" :class="{ active: activeTab === 'almanac' }" @click="activeTab = 'almanac'">
        <span class="nav-icon">📜</span>
        <span class="nav-label">万年历</span>
      </button>
      <button class="nav-item" :class="{ active: activeTab === 'health' }" @click="activeTab = 'health'">
        <span class="nav-icon">🌙</span>
        <span class="nav-label">健康</span>
      </button>
      <button class="nav-item" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">
        <span class="nav-icon">👤</span>
        <span class="nav-label">我的</span>
      </button>
    </div>

    <!-- 弹窗组件 -->
    <EventModal v-if="showEventModal" :event="editingEvent" :date="selectedDateStr" @close="closeEventModal"
      @save="saveEvent" />
    <PeriodModal v-if="showPeriodModal" :date="selectedDateStr" @close="showPeriodModal = false" @save="savePeriod" />
    <MoodModal v-if="showMoodModal" :date="selectedDateStr" :existing="selectedMood" @close="showMoodModal = false"
      @save="saveMood" />
    <CountdownModal v-if="showCountdownModal" @close="showCountdownModal = false" @save="saveCountdown" />
    <DiaryModal v-if="showDiaryModal" :date="selectedDateStr" :existing="selectedDiary" @close="showDiaryModal = false"
      @save="saveDiary" />
    <SleepModal v-if="showSleepModal" :date="selectedDateStr" @close="showSleepModal = false" @save="saveSleep" />
    <AISettingsModal v-if="showAISettings" @close="showAISettings = false" />
    <QuickAddModal v-if="showQuickAdd" :date="selectedDateStr" @close="showQuickAdd = false" @add="handleQuickAdd" />
    <ThemeSettingsModal v-if="showThemeSettings" :visible="showThemeSettings" @close="showThemeSettings = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '../../stores/calendarStore'
import { useChatStore } from '../../stores/chatStore'
import PerpetualCalendar from './components/PerpetualCalendar.vue'
import HealthTracker from './components/HealthTracker.vue'
import ProfilePage from './components/ProfilePage.vue'
import EventModal from './components/EventModal.vue'
import PeriodModal from './components/PeriodModal.vue'
import MoodModal from './components/MoodModal.vue'
import CountdownModal from './components/CountdownModal.vue'
import DiaryModal from './components/DiaryModal.vue'
import SleepModal from './components/SleepModal.vue'
import AISettingsModal from './components/AISettingsModal.vue'
import QuickAddModal from './components/QuickAddModal.vue'
import ThemeSettingsModal from './components/ThemeSettingsModal.vue'

const router = useRouter()
const calendarStore = useCalendarStore()
const chatStore = useChatStore()

// 当前Tab
const activeTab = ref('calendar')

// 弹窗状态
const showEventModal = ref(false)
const showPeriodModal = ref(false)
const showMoodModal = ref(false)
const showCountdownModal = ref(false)
const showDiaryModal = ref(false)
const showSleepModal = ref(false)
const showAISettings = ref(false)
const showQuickAdd = ref(false)
const showThemeSettings = ref(false)

const editingEvent = ref(null)
const weekDays = ['日', '一', '二', '三', '四', '五', '六']

// 计算属性
const calendarDays = computed(() => calendarStore.currentMonthDays)
const selectedDate = computed(() => calendarStore.selectedDate)
const currentTheme = computed(() => calendarStore.currentTheme)
const isDarkMode = computed(() => calendarStore.themeSettings?.isDarkMode)

const currentDateText = computed(() => {
  const d = calendarStore.currentDate
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const currentLunarInfo = computed(() => {
  const lunar = calendarStore.getLunarDate(calendarStore.currentDate)
  return `${lunar.monthName}${lunar.dayName}`
})

// 经期提醒
const periodReminders = computed(() => calendarStore.getPeriodReminders())
const dismissedReminders = ref(false)
const filteredReminders = computed(() => {
  if (dismissedReminders.value) return []
  return periodReminders.value
})

const selectedDateStr = computed(() => calendarStore.formatDateStr(selectedDate.value))
const selectedLunar = computed(() => calendarStore.getLunarDate(selectedDate.value))
const selectedTerm = computed(() => calendarStore.getSolarTerm(selectedDate.value))
const selectedFestival = computed(() => calendarStore.getFestival(selectedDate.value))
const periodStatus = computed(() => calendarStore.getPeriodStatus(selectedDate.value))
const selectedEvents = computed(() => calendarStore.getEventsForDate(selectedDateStr.value))
const selectedMood = computed(() => calendarStore.getMoodForDate(selectedDateStr.value))
const selectedDiary = computed(() => calendarStore.diaries.find(d => d.date === selectedDateStr.value))

// 首页倒计时展示 (近期的前2个)
function getDaysLeft(targetDateStr, isRecurring) {
  const target = new Date(targetDateStr)
  target.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isRecurring) {
    const currentYear = today.getFullYear()
    target.setFullYear(currentYear)
    if (target < today) {
      target.setFullYear(currentYear + 1)
    }
  }

  const diffTime = target - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
const topCountdowns = computed(() => {
  if (!calendarStore.countdowns?.length) return []
  return [...calendarStore.countdowns]
    .map(c => ({
      ...c,
      daysLeft: getDaysLeft(c.targetDate, c.isRecurring)
    }))
    .filter(c => c.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 2)
})

// 方法
function goBack() {
  router.push('/')
}

function handlePrev() {
  calendarStore.prevMonth()
}

function handleNext() {
  calendarStore.nextMonth()
}

function dismissReminder() {
  dismissedReminders.value = true
}

function selectDate(date) {
  calendarStore.selectDate(date)
}

function openEventModal() {
  editingEvent.value = null
  showEventModal.value = true
}

function editEvent(event) {
  editingEvent.value = event
  showEventModal.value = true
}

function closeEventModal() {
  showEventModal.value = false
  editingEvent.value = null
}

function saveEvent(event) {
  if (event.id) {
    calendarStore.updateEvent(event.id, event)
  } else {
    calendarStore.addEvent(event)
  }
  closeEventModal()
}

function savePeriod(data) {
  calendarStore.recordPeriod(data.startDate, data.endDate, data.symptoms)
  showPeriodModal.value = false
}

function saveMood(data) {
  calendarStore.recordMood(selectedDateStr.value, data.mood, data.note, data.tags)
  showMoodModal.value = false
}

function saveCountdown(data) {
  calendarStore.addCountdown(data)
  showCountdownModal.value = false
}

function saveDiary(data) {
  calendarStore.saveDiary(selectedDateStr.value, data.content, data.tags)
  showDiaryModal.value = false
}

function saveSleep(data) {
  calendarStore.recordSleep(selectedDateStr.value, data.bedTime, data.wakeTime, data.quality, data.note)
  showSleepModal.value = false
}

function handleQuickAdd(type) {
  showQuickAdd.value = false
  if (type === 'event') openEventModal()
  else if (type === 'period') showPeriodModal.value = true
  else if (type === 'mood') showMoodModal.value = true
  else if (type === 'countdown') showCountdownModal.value = true
  else if (type === 'diary') showDiaryModal.value = true
  else if (type === 'sleep') showSleepModal.value = true
}

onMounted(() => {
  if (calendarStore.periodData.cycles.length > 0) {
    calendarStore.generatePeriodPredictions()
  }
})
</script>

<style scoped>
.mobile-calendar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  transition: all 0.3s ease;
}

/* 顶部导航 */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 182, 193, 0.2);
}

.back-btn,
.add-btn,
.icon-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: #8b7aa8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-actions {
  display: flex;
  align-items: center;
}

.title-group {
  text-align: center;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.subtitle {
  font-size: 11px;
  color: #9a8fb8;
}

/* 提醒横幅 */
.reminder-banner {
  margin: 8px 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.4), rgba(255, 218, 224, 0.4));
  border-radius: 12px;
  border-left: 3px solid #ff6b9d;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reminder-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reminder-icon {
  font-size: 20px;
}

.reminder-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reminder-text strong {
  font-size: 14px;
  color: #5a5a7a;
}

.reminder-text span {
  font-size: 12px;
  color: #8b7aa8;
}

.reminder-close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  color: #8b7aa8;
  font-size: 18px;
  cursor: pointer;
}

/* 主内容区 */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 120px;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 月份导航 */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
}

.nav-arrow {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 182, 193, 0.2);
  color: #8b7aa8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.current-date {
  text-align: center;
}

.year-month {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
}

.lunar-info {
  font-size: 12px;
  color: #9a8fb8;
}

/* 周标题 */
.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
  text-align: center;
}

.week-header span {
  font-size: 13px;
  color: #9a8fb8;
  padding: 8px 0;
}

.week-header .weekend {
  color: #ff9eb5;
}

/* 日历网格 - 移动端 */
.calendar-grid-mobile {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 16px;
}

.day-cell {
  aspect-ratio: 1;
  border-radius: 10px;
  padding: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  position: relative;
}

.day-cell:active {
  transform: scale(0.95);
}

.day-cell.other-month {
  opacity: 0.4;
}

.day-cell.is-today {
  border-color: #ffb7c5;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.3), rgba(197, 201, 255, 0.3));
}

.day-cell.is-selected {
  border-color: #8b7aa8;
  background: white;
  box-shadow: 0 2px 8px rgba(139, 122, 168, 0.2);
}

.day-cell.has-period {
  background: linear-gradient(135deg, rgba(255, 182, 193, 0.4), rgba(255, 218, 224, 0.4));
}

.day-cell.has-prediction {
  background: linear-gradient(135deg, rgba(255, 228, 196, 0.4), rgba(255, 240, 220, 0.4));
}

.day-cell.has-ovulation {
  background: linear-gradient(135deg, rgba(230, 230, 250, 0.4), rgba(240, 230, 255, 0.4));
}

.day-number {
  font-size: 15px;
  font-weight: 600;
  color: #5a5a7a;
  line-height: 1.2;
}

.day-markers {
  font-size: 10px;
  color: #9a8fb8;
  margin-top: 2px;
  text-align: center;
  line-height: 1.1;
}

.day-markers .marker {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.day-markers .festival {
  color: #ff6b9d;
  font-weight: 500;
}

.event-dots {
  display: flex;
  gap: 2px;
  margin-top: auto;
  padding-bottom: 2px;
}

.event-dots .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

/* 选中日期卡片 */
.selected-day-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-top: 16px;
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.1);
}

.day-header {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.day-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.day-title .solar {
  font-size: 20px;
  font-weight: 600;
  color: #5a5a7a;
}

.day-title .weekday {
  font-size: 14px;
  color: #9a8fb8;
}

.day-subtitle {
  font-size: 13px;
  color: #8b7aa8;
  margin-top: 4px;
}

.period-indicator {
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 13px;
  margin-bottom: 12px;
  text-align: center;
}

.period-indicator.period {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.3), rgba(255, 218, 224, 0.3));
  color: #ff6b9d;
}

.period-indicator.prediction {
  background: linear-gradient(135deg, rgba(255, 228, 196, 0.3), rgba(255, 240, 220, 0.3));
  color: #d4a574;
}

.period-indicator.ovulation {
  background: linear-gradient(135deg, rgba(230, 230, 250, 0.3), rgba(240, 230, 255, 0.3));
  color: #8b7aa8;
}

.countdown-widget {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.cd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
}

.cd-title {
  flex: 1;
  margin-left: 8px;
  font-weight: 500;
}

.cd-days-text {
  font-size: 14px;
}

.day-events {
  margin-top: 12px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
  margin-bottom: 8px;
}

.add-mini {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 16px;
  cursor: pointer;
}

.day-events .empty {
  text-align: center;
  padding: 20px;
  color: #9a8fb8;
  font-size: 13px;
}

.day-events .event-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.day-events .event-item:last-child {
  border-bottom: none;
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.event-time {
  font-size: 12px;
  color: #9a8fb8;
  min-width: 40px;
}

.event-title {
  font-size: 14px;
  color: #5a5a7a;
  flex: 1;
}

/* 底部导航 */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 182, 193, 0.2);
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item.active .nav-icon {
  transform: scale(1.1);
}

.nav-item.active .nav-label {
  color: #ff6b9d;
  font-weight: 500;
}

.nav-icon {
  font-size: 22px;
  transition: transform 0.2s ease;
}

.nav-label {
  font-size: 11px;
  color: #9a8fb8;
}

/* --- 夜间模式样式 --- */
.dark-mode {
  background: #1f2937 !important;
  color: #f9fafb;
}

.dark-mode .mobile-header,
.dark-mode .bottom-nav {
  background: rgba(17, 24, 39, 0.95);
  border-color: rgba(55, 65, 81, 0.5);
}

.dark-mode .app-title,
.dark-mode .year-month,
.dark-mode .day-title .solar,
.dark-mode .day-number,
.dark-mode .section-title,
.dark-mode .event-title,
.dark-mode .reminder-text strong {
  color: #f9fafb;
}

.dark-mode .subtitle,
.dark-mode .lunar-info,
.dark-mode .day-subtitle,
.dark-mode .day-markers,
.dark-mode .event-time,
.dark-mode .nav-label,
.dark-mode .day-events .empty,
.dark-mode .reminder-text span {
  color: #9ca3af;
}

.dark-mode .back-btn,
.dark-mode .add-btn,
.dark-mode .icon-btn,
.dark-mode .nav-arrow,
.dark-mode .reminder-close {
  color: #d1d5db;
}

.dark-mode .nav-arrow {
  background: rgba(55, 65, 81, 0.5);
}

.dark-mode .day-cell {
  background: rgba(31, 41, 55, 0.6);
}

.dark-mode .day-cell.is-selected {
  background: #374151;
  border-color: #8b5cf6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.dark-mode .day-cell.other-month {
  opacity: 0.3;
}

.dark-mode .selected-day-card {
  background: #1f2937;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.dark-mode .day-header,
.dark-mode .event-item {
  border-color: rgba(55, 65, 81, 0.5);
}

.dark-mode .cd-item {
  background: rgba(31, 41, 55, 0.8) !important;
  color: #f9fafb !important;
}

.dark-mode .reminder-banner {
  background: linear-gradient(135deg, rgba(88, 28, 135, 0.4), rgba(157, 23, 77, 0.3));
  border-left-color: #ec4899;
}

.dark-mode .reminder-close {
  background: rgba(55, 65, 81, 0.6);
}

.dark-mode .add-mini {
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
}
</style>

<style>
/* 手机端日历夜间模式全局覆盖（作用于所有子组件） */
.mobile-calendar.dark-mode .date-selector,
.mobile-calendar.dark-mode .date-select,
.mobile-calendar.dark-mode .almanac-card,
.mobile-calendar.dark-mode .health-card,
.mobile-calendar.dark-mode .stat-item,
.mobile-calendar.dark-mode .menu-list,
.mobile-calendar.dark-mode .modal-content,
.mobile-calendar.dark-mode .help-content {
  background: #1f2937 !important;
  color: #f9fafb !important;
  border-color: rgba(55, 65, 81, 0.5) !important;
}

.mobile-calendar.dark-mode .card-header,
.mobile-calendar.dark-mode .info-section,
.mobile-calendar.dark-mode .menu-item,
.mobile-calendar.dark-mode .mood-item {
  border-color: rgba(55, 65, 81, 0.5) !important;
}

.mobile-calendar.dark-mode .yi-box,
.mobile-calendar.dark-mode .ji-box,
.mobile-calendar.dark-mode .god-box,
.mobile-calendar.dark-mode .shichen-item,
.mobile-calendar.dark-mode .fortune-item,
.mobile-calendar.dark-mode .next-prediction,
.mobile-calendar.dark-mode .mood-distribution,
.mobile-calendar.dark-mode .stat-box {
  background: rgba(31, 41, 55, 0.8) !important;
}

.mobile-calendar.dark-mode .card-header h2,
.mobile-calendar.dark-mode .card-header h3,
.mobile-calendar.dark-mode .info-section h3,
.mobile-calendar.dark-mode .sc-name,
.mobile-calendar.dark-mode .info-item .value,
.mobile-calendar.dark-mode .water-value,
.mobile-calendar.dark-mode .sleep-value,
.mobile-calendar.dark-mode .stat-num,
.mobile-calendar.dark-mode .menu-text,
.mobile-calendar.dark-mode .section-title,
.mobile-calendar.dark-mode .user-name {
  color: #f9fafb !important;
}

.mobile-calendar.dark-mode .info-item .label,
.mobile-calendar.dark-mode .sc-time,
.mobile-calendar.dark-mode .sleep-label,
.mobile-calendar.dark-mode .stat-label,
.mobile-calendar.dark-mode .water-target,
.mobile-calendar.dark-mode .date-display,
.mobile-calendar.dark-mode .empty,
.mobile-calendar.dark-mode .sleep-unit,
.mobile-calendar.dark-mode .user-bio {
  color: #9ca3af !important;
}

.mobile-calendar.dark-mode .card-header,
.mobile-calendar.dark-mode .profile-card {
  background: rgba(31, 41, 55, 0.8) !important;
}

.mobile-calendar.dark-mode .yi-box {
  background: linear-gradient(135deg, rgba(85, 140, 74, 0.2), rgba(85, 140, 74, 0.1)) !important;
}

.mobile-calendar.dark-mode .ji-box {
  background: linear-gradient(135deg, rgba(212, 85, 122, 0.2), rgba(212, 85, 122, 0.1)) !important;
}

.mobile-calendar.dark-mode select.date-select {
  background-color: #374151 !important;
  color: #f9fafb !important;
}
</style>
