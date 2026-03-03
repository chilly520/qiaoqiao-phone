<template>
  <div class="calendar-app" :class="{ 'dark-mode': isDarkMode }">
    <!-- 顶部导航栏 -->
    <div class="calendar-header" :class="currentTheme.colors.background">
      <div class="header-left">
        <button class="icon-btn" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="app-title">🌸 花间日历</h1>
      </div>

      <div class="header-center">
        <!-- 视图切换按钮 -->
        <div class="view-switcher">
          <button class="view-btn" :class="{ active: calendarStore.viewMode === 'month' }"
            @click="calendarStore.setViewMode('month')">月</button>
          <button class="view-btn" :class="{ active: calendarStore.viewMode === 'week' }"
            @click="calendarStore.setViewMode('week')">周</button>
          <button class="view-btn" :class="{ active: calendarStore.viewMode === 'day' }"
            @click="calendarStore.setViewMode('day')">日</button>
        </div>

        <button class="nav-btn" @click="handlePrev">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
        <span class="current-month">{{ currentDateText }}</span>
        <button class="nav-btn" @click="handleNext">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </button>
        <button class="today-btn" :class="`bg-gradient-to-r ${currentTheme.colors.primary}`"
          @click="goToToday">今天</button>
      </div>

      <div class="header-right">
        <button class="icon-btn" :class="{ active: showThemeSettings }" @click="showThemeSettings = true" title="主题设置">
          🎨
        </button>
        <button class="icon-btn" :class="{ active: showAISettings }" @click="showAISettings = true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button class="icon-btn" @click="showQuickAdd = true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 经期提醒横幅 -->
    <div v-if="filteredReminders.length > 0" class="reminder-banner">
      <div v-for="reminder in filteredReminders" :key="reminder.type" class="reminder-item">
        <span class="reminder-icon">🌙</span>
        <div class="reminder-content">
          <strong>{{ reminder.title }}</strong>
          <span>{{ reminder.message }}</span>
        </div>
        <button class="reminder-close" @click="dismissReminder">×</button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="calendar-body">
      <!-- 左侧日历区 -->
      <div class="calendar-main">
        <!-- 周标题 -->
        <div class="week-header">
          <span v-for="day in weekDays" :key="day" :class="{ weekend: day === '六' || day === '日' }">
            {{ day }}
          </span>
        </div>

        <!-- 月视图 -->
        <div v-if="calendarStore.viewMode === 'month'" class="calendar-grid">
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
            <div class="day-lunar">
              <span v-if="day.festival" class="festival">{{ day.festival }}</span>
              <span v-else-if="day.term" class="term">{{ day.term }}</span>
              <span v-else>{{ day.lunar.dayName }}</span>
            </div>
            <div v-if="day.events?.length" class="day-events">
              <span v-for="(event, idx) in day.events.slice(0, 3)" :key="idx" class="event-dot"
                :style="{ backgroundColor: event.color || '#ff9eb5' }" />
            </div>
            <div v-if="day.mood" class="day-mood">{{ getMoodEmoji(day.mood.mood) }}</div>
          </div>
        </div>

        <!-- 周视图 -->
        <div v-else-if="calendarStore.viewMode === 'week'" class="week-view">
          <div v-for="day in calendarDays.slice(0, 7)" :key="day.date.getTime()" class="week-day-column">
            <div class="week-day-header" :class="{ today: day.isToday }">
              <div>{{ weekDays[day.date.getDay()] }}</div>
              <div style="font-size: 18px; margin-top: 4px;">{{ day.date.getDate() }}</div>
            </div>
            <div class="week-events">
              <div v-for="event in day.events" :key="event.id" class="event-item"
                :style="{ borderLeft: '3px solid ' + (event.color || '#ff9eb5') }" @click="editEvent(event)">
                <span class="event-time">{{ event.allDay ? '全天' : event.startTime }}</span>
                <span class="event-title">{{ event.title }}</span>
              </div>
              <div v-if="!day.events?.length" class="empty-tip" style="padding: 20px 0;">无日程</div>
            </div>
          </div>
        </div>

        <!-- 日视图 -->
        <div v-else-if="calendarStore.viewMode === 'day'" class="day-view">
          <div class="day-header" style="text-align: center; padding: 20px;">
            <div style="font-size: 24px; font-weight: 600; color: #5a5a7a;">
              {{ selectedDate.getMonth() + 1 }}月{{ selectedDate.getDate() }}日 {{ weekDays[selectedDate.getDay()] }}
            </div>
            <div style="font-size: 14px; color: #9a8fb8; margin-top: 4px;">
              {{ selectedLunar.monthName }}{{ selectedLunar.dayName }} · {{ selectedTerm || selectedFestival || '普通日子'
              }}
            </div>
          </div>
          <div class="day-timeline">
            <div v-for="hour in 24" :key="hour" class="hour-slot">
              <div class="hour-label">{{ String(hour - 1).padStart(2, '0') }}:00</div>
              <div class="hour-content"></div>
            </div>
          </div>
          <div class="day-events-overlay" style="position: relative; margin-top: -1440px; padding-left: 62px;">
            <div v-for="event in selectedEvents" :key="event.id" class="day-event-item" :style="{
              background: event.color || '#ff9eb5',
              position: 'absolute',
              left: '62px',
              right: '20px',
              top: (parseInt(event.startTime?.split(':')[0] || 0) * 60 + parseInt(event.startTime?.split(':')[1] || 0)) + 'px',
              height: '60px',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              fontSize: '13px',
              cursor: 'pointer'
            }" @click="editEvent(event)">
              <div style="font-weight: 600;">{{ event.title }}</div>
              <div style="font-size: 11px; opacity: 0.9;">{{ event.startTime }} - {{ event.endTime }}</div>
            </div>
          </div>
        </div>

        <!-- 底部快捷信息 -->
        <div class="calendar-footer">
          <div class="footer-item">
            <span class="dot period"></span>
            <span>生理期</span>
          </div>
          <div class="footer-item">
            <span class="dot prediction"></span>
            <span>预测</span>
          </div>
          <div class="footer-item">
            <span class="dot ovulation"></span>
            <span>排卵期</span>
          </div>
        </div>
      </div>

      <!-- 右侧信息面板 -->
      <div class="side-panel">
        <!-- 今日概览 -->
        <div class="panel-card today-overview">
          <div class="card-header">
            <span class="card-title">📅 今日概览</span>
            <span class="card-date">{{ selectedDateText }}</span>
          </div>
          <div class="lunar-info">
            <div class="lunar-main">{{ selectedLunar.yearName }} {{ selectedLunar.monthName }}{{ selectedLunar.dayName
              }}</div>
            <div class="lunar-sub">
              <span v-if="selectedLunar.zodiac">🐲 {{ selectedLunar.zodiac }}年</span>
              <span v-if="selectedTerm">🌱 {{ selectedTerm }}</span>
              <span v-if="selectedFestival">🎉 {{ selectedFestival }}</span>
            </div>
          </div>
        </div>

        <!-- 统计数据概览 -->
        <div class="panel-card stats-card">
          <div class="card-header">
            <span class="card-title">📊 本月概览</span>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ calendarStore.statsOverview.periodCycles }}</div>
              <div class="stat-label">记录周期</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ calendarStore.statsOverview.moodCount }}</div>
              <div class="stat-label">心情记录</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ calendarStore.statsOverview.avgSleep || '-' }}</div>
              <div class="stat-label">平均睡眠(小时)</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ calendarStore.statsOverview.avgWater || '-' }}</div>
              <div class="stat-label">平均饮水(ml)</div>
            </div>
          </div>
        </div>

        <!-- 天气显示 (模拟数据) -->
        <div class="panel-card weather-card">
          <div class="card-header">
            <span class="card-title">🌤️ 今日天气</span>
            <span class="card-date">{{ selectedDateText }}</span>
          </div>
          <div class="weather-main">
            <div class="weather-icon">☀️</div>
            <div class="weather-info">
              <div class="weather-temp">24°</div>
              <div class="weather-desc">晴朗 · 空气质量良</div>
            </div>
          </div>
          <div class="weather-forecast">
            <div class="forecast-item">
              <div class="forecast-day">明天</div>
              <div class="forecast-icon">⛅</div>
              <div class="forecast-temp">22°</div>
            </div>
            <div class="forecast-item">
              <div class="forecast-day">后天</div>
              <div class="forecast-icon">🌧️</div>
              <div class="forecast-temp">19°</div>
            </div>
            <div class="forecast-item">
              <div class="forecast-day">周五</div>
              <div class="forecast-icon">☀️</div>
              <div class="forecast-temp">25°</div>
            </div>
          </div>
        </div>

        <!-- 生理期状态 -->
        <div v-if="periodStatus" class="panel-card period-card" :class="periodStatus.type">
          <div class="card-header">
            <span class="card-title">🌙 生理健康</span>
          </div>
          <div class="period-info">
            <template v-if="periodStatus.type === 'period'">
              <div class="period-day">第 {{ periodStatus.day }} 天</div>
              <div class="period-text">生理期期间，注意保暖和休息</div>
            </template>
            <template v-else-if="periodStatus.type === 'prediction'">
              <div class="period-day">预计第 {{ periodStatus.day }} 天</div>
              <div class="period-text">准备好生理用品</div>
            </template>
            <template v-else-if="periodStatus.type === 'ovulation'">
              <div class="period-text">排卵期 - 注意身体变化</div>
            </template>
          </div>
        </div>

        <!-- 今日日程 -->
        <div class="panel-card">
          <div class="card-header">
            <span class="card-title">📋 今日日程</span>
            <button class="add-btn" @click="openEventModal()">+</button>
          </div>
          <div class="event-list">
            <div v-for="event in selectedEvents" :key="event.id" class="event-item"
              :class="{ 'all-day': event.allDay, completed: event.completed }" @click="editEvent(event)">
              <span class="event-color" :style="{ backgroundColor: event.color || '#ff9eb5' }"></span>
              <span class="event-time">{{ event.allDay ? '全天' : event.startTime }}</span>
              <span class="event-title">{{ event.title }}</span>
              <span v-if="event.aiBound" class="ai-badge">AI</span>
            </div>
            <div v-if="selectedEvents.length === 0" class="empty-tip">点击 + 添加日程</div>
          </div>
        </div>

        <!-- 念记/纪念日 -->
        <div class="panel-card">
          <div class="card-header">
            <span class="card-title">🌸 纪念日 ({{ calendarStore.anniversaries.length }})</span>
            <button class="add-btn" @click="showAnniversaryModal = true">+</button>
          </div>
          <div class="countdown-list">
            <div v-for="item in calendarStore.anniversaries" :key="item.id" class="countdown-item">
              <div class="countdown-info">
                <span class="countdown-title">{{ item.title }}</span>
                <span class="countdown-date">{{ item.targetDate }} (每年)</span>
              </div>
              <div class="countdown-days anniversary">
                {{ getAnniversaryDays(item.targetDate) }}
                <small>天</small>
              </div>
            </div>
            <div v-if="calendarStore.anniversaries.length === 0" class="empty-tip">记录重要纪念日</div>
          </div>
        </div>

        <!-- 倒计时 -->
        <div class="panel-card">
          <div class="card-header">
            <span class="card-title">⏰ 倒计时 ({{ calendarStore.countdowns.length }})</span>
            <button class="add-btn" @click="showCountdownModal = true">+</button>
          </div>
          <div class="countdown-list">
            <div v-for="item in upcomingCountdowns" :key="item.id" class="countdown-item">
              <div class="countdown-info">
                <span class="countdown-title">{{ item.title }}</span>
                <span class="countdown-date">{{ item.targetDate }}</span>
              </div>
              <div class="countdown-days" :class="item.type">
                {{ item.days }}
                <small>天</small>
              </div>
            </div>
            <div v-if="upcomingCountdowns.length === 0" class="empty-tip">点击 + 添加倒计时</div>
          </div>
        </div>

        <!-- 快捷工具 -->
        <div class="panel-card">
          <div class="card-header">
            <span class="card-title">🛠️ 快捷工具</span>
          </div>
          <div class="quick-tools">
            <button class="tool-btn" @click="showPeriodModal = true">
              <span class="tool-icon">🌙</span>
              <span>记录经期</span>
            </button>
            <button class="tool-btn" @click="showMoodModal = true">
              <span class="tool-icon">😊</span>
              <span>记录心情</span>
            </button>
            <button class="tool-btn" @click="showDiaryModal = true">
              <span class="tool-icon">📝</span>
              <span>写日记</span>
            </button>
            <button class="tool-btn" @click="showSleepModal = true">
              <span class="tool-icon">😴</span>
              <span>睡眠记录</span>
            </button>
            <button class="tool-btn" @click="recordWater">
              <span class="tool-icon">💧</span>
              <span>喝水打卡</span>
            </button>
          </div>
        </div>

        <!-- AI角色绑定 -->
        <div class="panel-card ai-card">
          <div class="card-header">
            <span class="card-title">🤖 AI绑定</span>
            <button class="manage-btn" @click="showAISettings = true">管理</button>
          </div>
          <div class="ai-bound-chars">
            <div v-if="aiBoundChars.length === 0" class="empty-tip">
              绑定AI角色，让它记住你的重要日子
            </div>
            <div v-else class="ai-char-list">
              <div v-for="char in aiBoundChars" :key="char.id" class="ai-char-item">
                <img :src="char.avatar || '/default-avatar.png'" class="ai-char-avatar" />
                <div class="ai-char-info">
                  <span class="ai-char-name">{{ char.name }}</span>
                  <span class="ai-char-access">{{ getAccessText(char.id) }}</span>
                </div>
                <div class="ai-char-status" :class="{ active: isAIActive(char.id) }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗组件 -->
    <EventModal v-if="showEventModal" :event="editingEvent" :date="selectedDateStr" @close="closeEventModal"
      @save="saveEvent" />
    <PeriodModal v-if="showPeriodModal" :date="selectedDateStr" @close="showPeriodModal = false" @save="savePeriod" />
    <MoodModal v-if="showMoodModal" :date="selectedDateStr" :existing="selectedMood" @close="showMoodModal = false"
      @save="saveMood" />
    <CountdownModal v-if="showCountdownModal" @close="showCountdownModal = false" @save="saveCountdown" />
    <CountdownModal v-if="showAnniversaryModal" title="创建纪念日" type="anniversary" @close="showAnniversaryModal = false"
      @save="saveAnniversary" />
    <DiaryModal v-if="showDiaryModal" :date="selectedDateStr" :existing="selectedDiary" @close="showDiaryModal = false"
      @save="saveDiary" />
    <SleepModal v-if="showSleepModal" :date="selectedDateStr" @close="showSleepModal = false" @save="saveSleep" />
    <AISettingsModal v-if="showAISettings" @close="showAISettings = false" />
    <QuickAddModal v-if="showQuickAdd" :date="selectedDateStr" @close="showQuickAdd = false" @add="handleQuickAdd" />
    <ThemeSettingsModal v-if="showThemeSettings" @close="showThemeSettings = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '../../stores/calendarStore'
import { useChatStore } from '../../stores/chatStore'
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

// 弹窗状态
const showEventModal = ref(false)
const showPeriodModal = ref(false)
const showMoodModal = ref(false)
const showCountdownModal = ref(false)
const showAnniversaryModal = ref(false)
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
const isDarkMode = computed(() => calendarStore.themeSettings.isDarkMode)

// 根据视图模式显示不同的日期文本
const currentDateText = computed(() => {
  const d = calendarStore.currentDate
  const y = d.getFullYear()
  const m = d.getMonth() + 1

  if (calendarStore.viewMode === 'month') {
    return `${y}年${m}月`
  } else if (calendarStore.viewMode === 'week') {
    const weekStart = new Date(d.getTime() - d.getDay() * 86400000)
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
    return `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
  } else {
    return `${m}月${d.getDate()}日`
  }
})

// 经期提醒
const periodReminders = computed(() => calendarStore.getPeriodReminders())
const dismissedReminders = ref(false)
const filteredReminders = computed(() => {
  if (dismissedReminders.value) return []
  return periodReminders.value
})

const selectedDateStr = computed(() => calendarStore.formatDateStr(selectedDate.value))
const selectedDateText = computed(() => {
  const d = selectedDate.value
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const selectedLunar = computed(() => calendarStore.getLunarDate(selectedDate.value))
const selectedTerm = computed(() => calendarStore.getSolarTerm(selectedDate.value))
const selectedFestival = computed(() => calendarStore.getFestival(selectedDate.value))
const periodStatus = computed(() => calendarStore.getPeriodStatus(selectedDate.value))
const selectedEvents = computed(() => calendarStore.getEventsForDate(selectedDateStr.value))
const selectedMood = computed(() => calendarStore.getMoodForDate(selectedDateStr.value))
const selectedDiary = computed(() => calendarStore.diaries.find(d => d.date === selectedDateStr.value))

const upcomingCountdowns = computed(() => {
  const today = new Date()
  return calendarStore.countdowns
    .map(c => {
      const target = new Date(c.targetDate)
      const diff = Math.ceil((target - today) / 86400000)
      return {
        ...c,
        days: diff,
        type: diff > 0 ? 'future' : diff === 0 ? 'today' : 'past'
      }
    })
    .filter(c => c.days >= -30)
    .sort((a, b) => Math.abs(a.days) - Math.abs(b.days))
    .slice(0, 5)
})

function getAnniversaryDays(targetDate) {
  const today = new Date()
  const target = new Date(targetDate)
  const thisYearTarget = new Date(today.getFullYear(), target.getMonth(), target.getDate())

  if (thisYearTarget < today) {
    thisYearTarget.setFullYear(today.getFullYear() + 1)
  }

  return Math.ceil((thisYearTarget - today) / 86400000)
}

const aiBoundChars = computed(() => {
  const settings = calendarStore.aiAccessSettings
  return chatStore.contactList.filter(char => settings[char.id] && settings[char.id].enabled)
})

// 方法
function goBack() {
  router.push('/')
}

// 根据视图模式处理导航
function handlePrev() {
  if (calendarStore.viewMode === 'month') {
    calendarStore.prevMonth()
  } else if (calendarStore.viewMode === 'week') {
    calendarStore.prevWeek()
  } else {
    calendarStore.prevDay()
  }
}

function handleNext() {
  if (calendarStore.viewMode === 'month') {
    calendarStore.nextMonth()
  } else if (calendarStore.viewMode === 'week') {
    calendarStore.nextWeek()
  } else {
    calendarStore.nextDay()
  }
}

function dismissReminder() {
  dismissedReminders.value = true
}

function goToToday() {
  calendarStore.goToToday()
}

function prevMonth() {
  calendarStore.prevMonth()
}

function nextMonth() {
  calendarStore.nextMonth()
}

function selectDate(date) {
  calendarStore.selectDate(date)
}

function getMoodEmoji(mood) {
  const map = {
    'happy': '😊',
    'excited': '🤩',
    'calm': '😌',
    'tired': '😴',
    'sad': '😢',
    'angry': '😠',
    'anxious': '😰',
    'loved': '🥰'
  }
  return map[mood] || '😐'
}

function getAccessText(charId) {
  const s = calendarStore.aiAccessSettings[charId] || {}
  const parts = []
  if (s.schedule !== false) parts.push('日程')
  if (s.period) parts.push('经期')
  if (s.mood) parts.push('心情')
  if (s.sleep) parts.push('睡眠')
  return parts.join('·') || '无权限'
}

function isAIActive(charId) {
  const chat = chatStore.chats[charId]
  return chat && chat.isOnline
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
  calendarStore.saveData()
  showCountdownModal.value = false
}

function saveAnniversary(data) {
  calendarStore.addAnniversary(data)
  calendarStore.saveData()
  showAnniversaryModal.value = false
}

function saveDiary(data) {
  calendarStore.saveDiary(selectedDateStr.value, data.content, data.tags)
  showDiaryModal.value = false
}

function saveSleep(data) {
  calendarStore.recordSleep(selectedDateStr.value, data.bedTime, data.wakeTime, data.quality, data.note)
  showSleepModal.value = false
}

function recordWater() {
  calendarStore.recordWater(selectedDateStr.value, 250)
  alert('💧 已记录喝水 250ml！')
}

function handleQuickAdd(type) {
  showQuickAdd.value = false
  if (type === 'event') openEventModal()
  else if (type === 'period') showPeriodModal.value = true
  else if (type === 'mood') showMoodModal.value = true
  else if (type === 'countdown') showCountdownModal.value = true
  else if (type === 'anniversary') showAnniversaryModal.value = true
  else if (type === 'diary') showDiaryModal.value = true
  else if (type === 'sleep') showSleepModal.value = true
}

onMounted(() => {
  // 生成生理期预测
  if (calendarStore.periodData.cycles.length > 0) {
    calendarStore.generatePeriodPredictions()
  }
})
</script>

<style scoped>
.calendar-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: linear-gradient(135deg, #fef9f6 0%, #fff5f7 50%, #f8f9ff 100%);
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

/* 顶部导航 */
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 182, 193, 0.3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 182, 193, 0.2);
  color: #8b7aa8;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover {
  background: rgba(255, 182, 193, 0.4);
  transform: scale(1.1);
}

.current-month {
  font-size: 18px;
  font-weight: 500;
  color: #5a5a7a;
  min-width: 120px;
  text-align: center;
}

.today-btn {
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 182, 193, 0.5);
  background: white;
  color: #8b7aa8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.today-btn:hover {
  background: rgba(255, 182, 193, 0.2);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: rgba(255, 255, 255, 0.6);
  color: #8b7aa8;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: rgba(255, 182, 193, 0.3);
  transform: translateY(-2px);
}

.icon-btn.active {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

/* 主内容区 */
.calendar-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 20px;
  gap: 20px;
}

.calendar-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(139, 122, 168, 0.1);
}

/* 周标题 */
.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  text-align: center;
}

.week-header span {
  font-size: 14px;
  color: #9a8fb8;
  font-weight: 500;
  padding: 8px;
}

.week-header .weekend {
  color: #ff9eb5;
}

/* 日历网格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 8px;
  flex: 1;
}

.day-cell {
  border-radius: 16px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.5);
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.day-cell:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.15);
  background: white;
}

.day-cell.other-month {
  opacity: 0.4;
}

.day-cell.is-today {
  border-color: #ffb7c5;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.2), rgba(197, 201, 255, 0.2));
}

.day-cell.is-selected {
  border-color: #8b7aa8;
  background: white;
}

.day-cell.has-period {
  background: linear-gradient(135deg, rgba(255, 182, 193, 0.3), rgba(255, 218, 224, 0.3));
}

.day-cell.has-prediction {
  background: linear-gradient(135deg, rgba(255, 228, 196, 0.3), rgba(255, 240, 220, 0.3));
}

.day-cell.has-ovulation {
  background: linear-gradient(135deg, rgba(230, 230, 250, 0.3), rgba(240, 230, 255, 0.3));
}

.day-number {
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
  line-height: 1.2;
}

.day-lunar {
  font-size: 11px;
  color: #9a8fb8;
  margin-top: 2px;
}

.day-lunar .festival {
  color: #ff6b9d;
  font-weight: 500;
}

.day-lunar .term {
  color: #7fb069;
  font-weight: 500;
}

.day-events {
  display: flex;
  gap: 3px;
  margin-top: 4px;
}

.event-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.day-mood {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 14px;
}

/* 底部图例 */
.calendar-footer {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(139, 122, 168, 0.1);
}

.footer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8b7aa8;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.period {
  background: linear-gradient(135deg, #ffb7c5, #ff9eb5);
}

.dot.prediction {
  background: linear-gradient(135deg, #ffd8a8, #ffb347);
}

.dot.ovulation {
  background: linear-gradient(135deg, #e6e6fa, #d8bfd8);
}

/* 侧边面板 */
.side-panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 4px;
  padding-bottom: 100px;
}

.side-panel::-webkit-scrollbar {
  width: 4px;
}

.side-panel::-webkit-scrollbar-thumb {
  background: rgba(139, 122, 168, 0.2);
  border-radius: 2px;
}

.panel-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
}

.card-date {
  font-size: 12px;
  color: #9a8fb8;
}

.add-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 183, 197, 0.4);
}

/* 今日概览 */
.today-overview {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.2), rgba(197, 201, 255, 0.2));
}

.lunar-info {
  text-align: center;
}

.lunar-main {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin-bottom: 8px;
}

.lunar-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  font-size: 12px;
  color: #8b7aa8;
}

/* 生理期卡片 */
.period-card {
  border-left: 4px solid #ffb7c5;
}

.period-card.period {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.15), rgba(255, 218, 224, 0.15));
}

.period-card.prediction {
  background: linear-gradient(135deg, rgba(255, 228, 196, 0.15), rgba(255, 240, 220, 0.15));
  border-left-color: #ffd8a8;
}

.period-card.ovulation {
  background: linear-gradient(135deg, rgba(230, 230, 250, 0.15), rgba(240, 230, 255, 0.15));
  border-left-color: #c5c9ff;
}

.period-day {
  font-size: 28px;
  font-weight: 700;
  color: #ff6b9d;
  line-height: 1;
}

.period-text {
  font-size: 13px;
  color: #8b7aa8;
  margin-top: 4px;
}

/* 事件列表 */
.event-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
}

.event-item:hover {
  background: white;
  box-shadow: 0 2px 8px rgba(139, 122, 168, 0.1);
}

.event-item.completed {
  opacity: 0.6;
}

.event-item.completed .event-title {
  text-decoration: line-through;
}

.event-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-time {
  font-size: 11px;
  color: #9a8fb8;
  width: 40px;
  flex-shrink: 0;
}

.event-title {
  flex: 1;
  font-size: 13px;
  color: #5a5a7a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

.empty-tip {
  text-align: center;
  padding: 20px;
  font-size: 13px;
  color: #9a8fb8;
  font-style: italic;
}

/* 倒计时 */
.countdown-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.countdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
}

.countdown-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.countdown-title {
  font-size: 13px;
  color: #5a5a7a;
  font-weight: 500;
}

.countdown-date {
  font-size: 11px;
  color: #9a8fb8;
}

.countdown-days {
  font-size: 20px;
  font-weight: 700;
  color: #ff6b9d;
}

.countdown-days small {
  font-size: 11px;
  font-weight: 400;
}

.countdown-days.today {
  color: #7fb069;
}

.countdown-days.past {
  color: #9a8fb8;
}

/* 快捷工具 */
.quick-tools {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: 12px;
  border: none;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
}

.tool-btn:hover {
  background: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 122, 168, 0.1);
}

.tool-icon {
  font-size: 22px;
  line-height: 1;
}

.tool-btn span:last-child {
  font-size: 11px;
  color: #8b7aa8;
}

/* AI卡片 */
.ai-card {
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.15), rgba(255, 183, 197, 0.15));
}

.manage-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 10px;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  color: #8b7aa8;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manage-btn:hover {
  background: white;
}

.ai-char-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-char-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
}

.ai-char-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid white;
}

.ai-char-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-char-name {
  font-size: 13px;
  font-weight: 500;
  color: #5a5a7a;
}

.ai-char-access {
  font-size: 11px;
  color: #9a8fb8;
}

.ai-char-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.ai-char-status.active {
  background: #7fb069;
  box-shadow: 0 0 8px #7fb069;
}

/* 视图切换按钮 */
.view-switcher {
  display: flex;
  gap: 4px;
  background: rgba(139, 122, 168, 0.1);
  padding: 4px;
  border-radius: 12px;
}

.view-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8b7aa8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.view-btn:hover {
  color: #5a5a7a;
}

.view-btn.active {
  background: white;
  color: #ff6b9d;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(139, 122, 168, 0.15);
}

/* 经期提醒横幅 */
.reminder-banner {
  margin: 0 20px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.3), rgba(255, 218, 224, 0.3));
  border-radius: 12px;
  border-left: 4px solid #ff6b9d;
  display: flex;
  align-items: center;
  gap: 12px;
}

.reminder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.reminder-icon {
  font-size: 24px;
}

.reminder-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reminder-content strong {
  font-size: 14px;
  color: #5a5a7a;
}

.reminder-content span {
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
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.reminder-close:hover {
  background: white;
  color: #ff6b9d;
}

/* 统计数据卡片 */
.stats-card {
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.2), rgba(255, 183, 197, 0.2));
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #5a5a7a;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: #9a8fb8;
  margin-top: 4px;
}

/* 天气显示 */
.weather-card {
  background: linear-gradient(135deg, rgba(168, 216, 234, 0.2), rgba(197, 201, 255, 0.2));
}

.weather-main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
}

.weather-icon {
  font-size: 48px;
}

.weather-info {
  text-align: center;
}

.weather-temp {
  font-size: 32px;
  font-weight: 700;
  color: #5a5a7a;
}

.weather-desc {
  font-size: 13px;
  color: #8b7aa8;
}

.weather-forecast {
  display: flex;
  justify-content: space-around;
  padding-top: 12px;
  border-top: 1px dashed rgba(139, 122, 168, 0.2);
}

.forecast-item {
  text-align: center;
}

.forecast-day {
  font-size: 11px;
  color: #9a8fb8;
}

.forecast-icon {
  font-size: 20px;
  margin: 4px 0;
}

.forecast-temp {
  font-size: 12px;
  color: #5a5a7a;
}

/* 周视图样式 */
.week-view {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  flex: 1;
}

.week-day-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.week-day-header {
  text-align: center;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  font-weight: 500;
  color: #5a5a7a;
}

.week-day-header.today {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.3), rgba(197, 201, 255, 0.3));
  color: #ff6b9d;
}

.week-events {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 日视图样式 */
.day-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  overflow-y: auto;
}

.day-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hour-slot {
  display: flex;
  gap: 12px;
  min-height: 60px;
}

.hour-label {
  width: 50px;
  font-size: 12px;
  color: #9ca3af;
  text-align: right;
  padding-top: 4px;
}

.hour-content {
  flex: 1;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  border-left: 2px solid rgba(139, 122, 168, 0.1);
}

/* 夜间模式样式 */
.dark-mode {
  background: #1f2937;
  color: #f9fafb;
}

.dark-mode .calendar-header {
  background: #111827 !important;
  border-bottom-color: #374151;
}

.dark-mode .app-title {
  color: #f9fafb;
}

.dark-mode .view-btn {
  background: #374151;
  color: #d1d5db;
}

.dark-mode .view-btn.active {
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  color: white;
}

.dark-mode .nav-btn {
  background: #374151;
  color: #d1d5db;
}

.dark-mode .current-month {
  color: #f9fafb;
}

.dark-mode .icon-btn {
  background: #374151;
  color: #d1d5db;
}

.dark-mode .icon-btn.active {
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  color: white;
}

.dark-mode .week-header {
  background: #374151;
  border-bottom-color: #4b5563;
}

.dark-mode .week-header span {
  color: #d1d5db;
}

.dark-mode .week-header span.weekend {
  color: #f87171;
}

.dark-mode .calendar-grid {
  background: #111827;
  border-color: #374151;
}

.dark-mode .day-cell {
  background: #1f2937;
  border-color: #374151;
  color: #d1d5db;
}

.dark-mode .day-cell:hover {
  background: #374151;
}

.dark-mode .day-cell.today {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2));
  border-color: #8b5cf6;
}

.dark-mode .day-cell.selected {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3));
  border-color: #8b5cf6;
}

.dark-mode .day-cell.other-month {
  color: #6b7280;
}

.dark-mode .day-cell.weekend {
  color: #f87171;
}

.dark-mode .week-day-header {
  background: #374151;
  color: #d1d5db;
}

.dark-mode .week-day-header.today {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2));
  color: #f87171;
}

.dark-mode .day-view {
  background: #111827;
}

.dark-mode .day-header {
  color: #f9fafb;
}

.dark-mode .hour-label {
  color: #9ca3af;
}

.dark-mode .hour-slot {
  border-color: #374151;
}

.dark-mode .hour-content {
  background: rgba(55, 65, 81, 0.4);
  border-left-color: rgba(139, 92, 246, 0.2);
}

/* 主题色彩变量 */
.calendar-app {
  --theme-primary: #8b5cf6;
  --theme-secondary: #ec4899;
  --theme-accent: #a855f7;
  --theme-background: #faf5ff;
  --theme-text: #7c3aed;
  --theme-border: #e9d5ff;
}
</style>
