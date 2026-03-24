import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useChatStore } from './chatStore'

// 农历数据
const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0
]

const solarMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const Gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const Zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const Animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
const solarTerm = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']
const lunarMonth = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const lunarDay = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
const festivals = {
  '1-1': '元旦',
  '2-14': '情人节',
  '3-8': '妇女节',
  '3-12': '植树节',
  '4-1': '愚人节',
  '5-1': '劳动节',
  '5-4': '青年节',
  '6-1': '儿童节',
  '7-1': '建党节',
  '8-1': '建军节',
  '9-10': '教师节',
  '10-1': '国庆节',
  '10-31': '万圣夜',
  '11-1': '万圣节',
  '12-24': '平安夜',
  '12-25': '圣诞节'
}

const lunarFestivals = {
  '1-1': '春节',
  '1-15': '元宵节',
  '5-5': '端午节',
  '7-7': '七夕',
  '7-15': '中元节',
  '8-15': '中秋节',
  '9-9': '重阳节',
  '12-8': '腊八节',
  '12-23': '小年',
  '12-30': '除夕'
}

// 计算农历
export function getLunarDate(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  const baseDate = new Date(1900, 0, 31)
  const targetDate = new Date(year, month - 1, day)
  let offset = Math.floor((targetDate - baseDate) / 86400000)

  let lunarYear = 1900
  let daysInYear = 0

  for (; lunarYear < 2100 && offset > 0; lunarYear++) {
    daysInYear = lYearDays(lunarYear)
    offset -= daysInYear
  }

  if (offset < 0) {
    offset += daysInYear
    lunarYear--
  }

  const isLeap = leapMonth(lunarYear) > 0
  let lunarMonthIndex = 1
  let lunarDayIndex = offset + 1
  let isLeapMonth = false

  for (let i = 1; i < 13 && lunarDayIndex > 0; i++) {
    let daysInMonth = 0
    if (isLeap && i === leapMonth(lunarYear) + 1) {
      daysInMonth = leapDays(lunarYear)
      if (lunarDayIndex > daysInMonth) {
        lunarDayIndex -= daysInMonth
      } else {
        isLeapMonth = true
        lunarMonthIndex = i - 1
        break
      }
    } else {
      daysInMonth = monthDays(lunarYear, i)
      if (lunarDayIndex > daysInMonth) {
        lunarDayIndex -= daysInMonth
      } else {
        lunarMonthIndex = i
        break
      }
    }
  }

  return {
    year: lunarYear,
    month: lunarMonthIndex,
    day: lunarDayIndex,
    isLeap: isLeapMonth,
    monthName: lunarMonth[lunarMonthIndex - 1] + '月',
    dayName: lunarDay[lunarDayIndex - 1],
    yearName: ganZhiYear(lunarYear) + '年',
    zodiac: Animals[(lunarYear - 4) % 12],
    festival: lunarFestivals[`${lunarMonthIndex}-${lunarDayIndex}`] || ''
  }
}

function lYearDays(y) {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (lunarInfo[y - 1900] & i) ? 1 : 0
  }
  return sum + leapDays(y)
}

function leapDays(y) {
  if (leapMonth(y)) {
    return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29
  }
  return 0
}

function leapMonth(y) {
  return lunarInfo[y - 1900] & 0xf
}

function monthDays(y, m) {
  return (lunarInfo[y - 1900] & (0x10000 >> (m - 1))) ? 30 : 29
}

function ganZhiYear(year) {
  return Gan[(year - 4) % 10] + Zhi[(year - 4) % 12]
}

// 获取节气
export function getSolarTerm(date) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()

  const termInfo = [
    6, 20, 4, 19, 6, 21, 5, 20, 6, 21, 6, 22, 7, 23, 8, 23, 8, 23, 9, 24, 8, 23, 7, 22
  ]

  const index = m * 2
  if (d === termInfo[index]) return solarTerm[index]
  if (d === termInfo[index + 1]) return solarTerm[index + 1]
  return ''
}

// 生成唯一ID
function generateId() {
  return 'cal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

export const useCalendarStore = defineStore('calendar', () => {
  // 当前选中日期
  const currentDate = ref(new Date())
  const selectedDate = ref(new Date())

  // 视图模式: month, week, day, agenda
  const viewMode = ref('month')

  // 用户信息
  const userProfile = ref({
    name: '',
    avatar: ''
  })

  // 主题设置
  const themeSettings = ref({
    currentTheme: 'default',
    isDarkMode: false,
    customThemes: []
  })

  // 预设主题
  const presetThemes = ref([
    {
      id: 'default',
      name: '默认粉紫',
      type: 'preset',
      colors: {
        primary: 'from-purple-400 to-pink-400',
        secondary: 'from-purple-100 to-pink-100',
        accent: 'from-purple-500 to-pink-500',
        background: 'bg-gradient-to-br from-purple-50 to-pink-50',
        text: 'text-purple-600',
        border: 'border-purple-200'
      }
    },
    {
      id: 'nature',
      name: '自然绿蓝',
      type: 'preset',
      colors: {
        primary: 'from-green-400 to-blue-400',
        secondary: 'from-green-100 to-blue-100',
        accent: 'from-green-500 to-blue-500',
        background: 'bg-gradient-to-br from-green-50 to-blue-50',
        text: 'text-green-600',
        border: 'border-green-200'
      }
    },
    {
      id: 'ocean',
      name: '海洋蓝',
      type: 'preset',
      colors: {
        primary: 'from-blue-400 to-cyan-400',
        secondary: 'from-blue-100 to-cyan-100',
        accent: 'from-blue-500 to-cyan-500',
        background: 'bg-gradient-to-br from-blue-50 to-cyan-50',
        text: 'text-blue-600',
        border: 'border-blue-200'
      }
    },
    {
      id: 'sunset',
      name: '夕阳橙',
      type: 'preset',
      colors: {
        primary: 'from-orange-400 to-red-400',
        secondary: 'from-orange-100 to-red-100',
        accent: 'from-orange-500 to-red-500',
        background: 'bg-gradient-to-br from-orange-50 to-red-50',
        text: 'text-orange-600',
        border: 'border-orange-200'
      }
    },
    {
      id: 'lavender',
      name: '薰衣草',
      type: 'preset',
      colors: {
        primary: 'from-purple-300 to-purple-500',
        secondary: 'from-purple-100 to-purple-200',
        accent: 'from-purple-400 to-purple-600',
        background: 'bg-gradient-to-br from-purple-50 to-purple-100',
        text: 'text-purple-500',
        border: 'border-purple-200'
      }
    },
    {
      id: 'rose',
      name: '玫瑰粉',
      type: 'preset',
      colors: {
        primary: 'from-pink-400 to-rose-400',
        secondary: 'from-pink-100 to-rose-100',
        accent: 'from-pink-500 to-rose-500',
        background: 'bg-gradient-to-br from-pink-50 to-rose-50',
        text: 'text-pink-600',
        border: 'border-pink-200'
      }
    },
    {
      id: 'mint',
      name: '薄荷绿',
      type: 'preset',
      colors: {
        primary: 'from-teal-400 to-green-400',
        secondary: 'from-teal-100 to-green-100',
        accent: 'from-teal-500 to-green-500',
        background: 'bg-gradient-to-br from-teal-50 to-green-50',
        text: 'text-teal-600',
        border: 'border-teal-200'
      }
    }
  ])

  // 事件/日程数据
  const events = ref([])

  // 生理期数据
  const periodData = ref({
    cycles: [], // { startDate, endDate, duration }
    averageCycle: 28, // 平均周期长度（间隔天数）
    averageDuration: 5, // 平均经期天数
    lastPeriod: null,
    predictions: []
  })

  // 心情记录
  const moodRecords = ref([])

  // 倒计时
  const countdowns = ref([])

  // 纪念日
  const anniversaries = ref([])

  // 周期性任务
  const recurringTasks = ref([])

  // 睡眠记录
  const sleepRecords = ref([])

  // 饮水记录
  const waterRecords = ref([])

  // 每日日记
  const diaries = ref([])

  // AI角色绑定权限
  const aiAccessSettings = ref({
    // key: charId, value: { schedule: true, period: false, mood: true, ... }
  })

  // 天气数据
  const weatherData = ref({
    current: null,
    forecast: []
  })

  // 经期提醒设置
  const periodReminders = ref({
    enabled: true,
    remindBefore: 2, // 提前2天提醒
    remindAt: '09:00',
    lastReminded: null
  })

  // 从localStorage加载数据
  function loadData() {
    try {
      const saved = localStorage.getItem('calendar_data')
      if (saved) {
        const data = JSON.parse(saved)
        events.value = data.events || []
        periodData.value = data.periodData || { cycles: [], averageCycle: 28, averageDuration: 5, lastPeriod: null, predictions: [] }
        moodRecords.value = data.moodRecords || []
        countdowns.value = data.countdowns || []
        recurringTasks.value = data.recurringTasks || []
        sleepRecords.value = data.sleepRecords || []
        waterRecords.value = data.waterRecords || []
        diaries.value = data.diaries || []
        anniversaries.value = data.anniversaries || []
        aiAccessSettings.value = data.aiAccessSettings || {}
        periodReminders.value = data.periodReminders || { enabled: true, remindBefore: 2, remindAt: '09:00', lastReminded: null }

        // Handle User Profile migration/loading
        if (data.userProfile) {
          userProfile.value = { ...userProfile.value, ...data.userProfile }
        }
      }

      // Always try loading legacy profile if name/avatar are still empty
      if (!userProfile.value.name || !userProfile.value.avatar) {
        const legacyProfile = localStorage.getItem('calendar_user_profile')
        if (legacyProfile) {
          try {
            const parsed = JSON.parse(legacyProfile)
            if (parsed) {
              if (!userProfile.value.name) userProfile.value.name = parsed.name || ''
              if (!userProfile.value.avatar) userProfile.value.avatar = parsed.avatar || ''
            }
          } catch (e) { }
        }
      }
    } catch (e) {
      console.error('[CalendarStore] Load failed:', e)
    }
  }

  // 保存到localStorage
  function saveData() {
    try {
      const data = {
        events: events.value,
        periodData: periodData.value,
        moodRecords: moodRecords.value,
        countdowns: countdowns.value,
        recurringTasks: recurringTasks.value,
        sleepRecords: sleepRecords.value,
        waterRecords: waterRecords.value,
        diaries: diaries.value,
        anniversaries: anniversaries.value,
        aiAccessSettings: aiAccessSettings.value,
        periodReminders: periodReminders.value,
        userProfile: userProfile.value
      }
      localStorage.setItem('calendar_data', JSON.stringify(data))
      // Also save profile separately for extra safety
      localStorage.setItem('calendar_user_profile', JSON.stringify(userProfile.value))
    } catch (e) {
      console.error('[CalendarStore] Save failed:', e)
    }
  }

  // Watch for changes and auto-save (Use a getter for the array to ensure better reactivity)
  // Watch for changes and auto-save
  watch([
    events, periodData, moodRecords, countdowns,
    recurringTasks, sleepRecords, waterRecords,
    diaries, anniversaries, aiAccessSettings,
    periodReminders, userProfile
  ], () => {
    saveData()
  }, { deep: true })

  // 统计概览数据
  const statsOverview = computed(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000)

    // 近30天数据
    const recentMoods = moodRecords.value.filter(m => new Date(m.date) >= thirtyDaysAgo)
    const recentSleep = sleepRecords.value.filter(s => new Date(s.date) >= thirtyDaysAgo)
    const recentWater = waterRecords.value.filter(w => new Date(w.date) >= thirtyDaysAgo)

    // 心情统计
    const moodCounts = {}
    recentMoods.forEach(m => {
      moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1
    })
    const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'calm'

    // 睡眠平均
    const avgSleep = recentSleep.length > 0
      ? recentSleep.reduce((sum, s) => sum + s.duration, 0) / recentSleep.length
      : 0

    // 饮水平均
    const avgWater = recentWater.length > 0
      ? recentWater.reduce((sum, w) => sum + w.amount, 0) / recentWater.length
      : 0

    return {
      totalEvents: events.value.length,
      completedEvents: events.value.filter(e => e.completed).length,
      periodCycles: periodData.value.cycles.length,
      moodCount: moodRecords.value.length,
      sleepCount: sleepRecords.value.length,
      diaryCount: diaries.value.length,
      dominantMood,
      avgSleep: Math.round(avgSleep * 10) / 10,
      avgWater: Math.round(avgWater),
      recentMoods,
      recentSleep,
      recentWater
    }
  })

  // 计算属性：当前月份的所有日期
  const currentMonthDays = computed(() => {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days = []

    // 上月日期
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        lunar: getLunarDate(new Date(year, month - 1, prevMonthLastDay - i)),
        term: getSolarTerm(new Date(year, month - 1, prevMonthLastDay - i))
      })
    }

    // 当月日期
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i)
      const dateStr = formatDateStr(date)
      days.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, new Date()),
        isSelected: isSameDay(date, selectedDate.value),
        lunar: getLunarDate(date),
        term: getSolarTerm(date),
        festival: getFestival(date),
        events: getEventsForDate(dateStr),
        period: getPeriodStatus(date),
        mood: getMoodForDate(dateStr),
        anniversaries: getAnniversariesForDate(dateStr)
      })
    }

    // 下月日期
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        lunar: getLunarDate(new Date(year, month + 1, i)),
        term: getSolarTerm(new Date(year, month + 1, i))
      })
    }

    return days
  })

  // 获取指定日期的事件
  function getEventsForDate(dateStr) {
    return events.value.filter(e => {
      if (e.date === dateStr) return true
      if (e.isRecurring) {
        return checkRecurringEvent(e, dateStr)
      }
      return false
    }).sort((a, b) => {
      if (a.allDay && !b.allDay) return -1
      if (!a.allDay && b.allDay) return 1
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
  }

  // 获取指定日期的纪念日
  function getAnniversariesForDate(dateStr) {
    return anniversaries.value.filter(a => {
      if (!a.targetDate) return false
      const anniversaryDate = a.targetDate.split('T')[0]
      if (anniversaryDate === dateStr) return true
      // 如果是每年重复的纪念日，检查月和日
      if (a.isRecurring) {
        const target = new Date(a.targetDate)
        const current = new Date(dateStr)
        return target.getMonth() === current.getMonth() && target.getDate() === current.getDate()
      }
      return false
    })
  }

  // 检查周期性事件
  function checkRecurringEvent(event, dateStr) {
    const date = parseDateStr(dateStr)
    const eventDate = parseDateStr(event.date)
    if (date < eventDate) return false

    const diffDays = Math.floor((date - eventDate) / 86400000)

    switch (event.recurringType) {
      case 'daily':
        return diffDays % (event.recurringInterval || 1) === 0
      case 'weekly':
        return diffDays % (7 * (event.recurringInterval || 1)) === 0
      case 'monthly':
        return date.getDate() === eventDate.getDate()
      case 'yearly':
        return date.getDate() === eventDate.getDate() && date.getMonth() === eventDate.getMonth()
      default:
        return false
    }
  }

  // 获取节日
  function getFestival(date) {
    const key = `${date.getMonth() + 1}-${date.getDate()}`
    return festivals[key] || ''
  }

  // 获取生理期状态
  function getPeriodStatus(date) {
    const dateStr = formatDateStr(date)

    // 检查是否在记录周期内
    for (const cycle of periodData.value.cycles) {
      const start = new Date(cycle.startDate)
      const end = new Date(cycle.endDate)
      if (date >= start && date <= end) {
        return { type: 'period', day: Math.floor((date - start) / 86400000) + 1 }
      }
    }

    // 检查预测
    for (const pred of periodData.value.predictions) {
      const start = new Date(pred.startDate)
      const end = new Date(pred.endDate)
      if (date >= start && date <= end) {
        return { type: 'prediction', day: Math.floor((date - start) / 86400000) + 1 }
      }
    }

    // 排卵期预测
    if (periodData.value.lastPeriod) {
      const lastStart = new Date(periodData.value.lastPeriod.startDate)
      const ovulationStart = new Date(lastStart.getTime() + 11 * 86400000)
      const ovulationEnd = new Date(lastStart.getTime() + 16 * 86400000)
      if (date >= ovulationStart && date <= ovulationEnd) {
        return { type: 'ovulation' }
      }
    }

    return null
  }

  // 获取心情记录
  function getMoodForDate(dateStr) {
    return moodRecords.value.find(m => m.date === dateStr)
  }

  // 辅助函数
  function formatDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function parseDateStr(str) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
  }

  // 添加事件
  function addEvent(event) {
    const newEvent = {
      id: generateId(),
      ...event,
      createdAt: new Date().toISOString()
    }
    events.value.push(newEvent)
    saveData()
    return newEvent
  }

  // 更新事件
  function updateEvent(id, updates) {
    const idx = events.value.findIndex(e => e.id === id)
    if (idx !== -1) {
      events.value[idx] = { ...events.value[idx], ...updates, updatedAt: new Date().toISOString() }
    }
  }

  // 删除事件
  function deleteEvent(id) {
    events.value = events.value.filter(e => e.id !== id)
    saveData()
  }

  // 生成生理期预测
  function generatePeriodPredictions() {
    if (!periodData.value.lastPeriod) return

    const predictions = []
    const lastStart = new Date(periodData.value.lastPeriod.startDate)

    for (let i = 1; i <= 6; i++) {
      const predStart = new Date(lastStart.getTime() + periodData.value.averageCycle * i * 86400000)
      const predEnd = new Date(predStart.getTime() + (periodData.value.averageDuration - 1) * 86400000)
      predictions.push({
        startDate: formatDateStr(predStart),
        endDate: formatDateStr(predEnd),
        isPrediction: true
      })
    }

    periodData.value.predictions = predictions
  }

  // 记录生理期
  function recordPeriod(startDate, endDate, symptoms = []) {
    const cycle = {
      id: generateId(),
      startDate,
      endDate,
      duration: Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1,
      symptoms
    }
    periodData.value.cycles.push(cycle)
    periodData.value.lastPeriod = cycle

    // 重新计算平均值
    if (periodData.value.cycles.length >= 2) {
      let totalCycle = 0
      let totalDuration = 0
      for (let i = 1; i < periodData.value.cycles.length; i++) {
        const prev = new Date(periodData.value.cycles[i - 1].startDate)
        const curr = new Date(periodData.value.cycles[i].startDate)
        totalCycle += Math.floor((curr - prev) / 86400000)
        totalDuration += periodData.value.cycles[i].duration
      }
      periodData.value.averageCycle = Math.round(totalCycle / (periodData.value.cycles.length - 1))
      periodData.value.averageDuration = Math.round(totalDuration / (periodData.value.cycles.length - 1))
    }

    // 生成预测
    if (typeof generatePeriodPredictions === 'function') {
      generatePeriodPredictions()
    }
  }

  // 清除所有经期数据
  function clearAllPeriodData() {
    periodData.value.cycles = []
    periodData.value.lastPeriod = null
    periodData.value.averageCycle = 28
    periodData.value.averageDuration = 5
    periodData.value.predictions = []
  }

  // 记录心情
  function recordMood(date, mood, note = '', tags = []) {
    const existing = moodRecords.value.findIndex(m => m.date === date)
    const record = { date, mood, note, tags, timestamp: new Date().toISOString() }
    if (existing !== -1) {
      moodRecords.value[existing] = record
    } else {
      moodRecords.value.push(record)
    }
  }

  // 添加倒计时/纪念日
  function addCountdown(data) {
    const countdown = {
      id: generateId(),
      ...data,
      createdAt: new Date().toISOString()
    }
    countdowns.value.push(countdown)
    saveData()
    return countdown
  }

  // 添加纪念日
  function addAnniversary(data) {
    const anniversary = {
      id: generateId(),
      ...data,
      createdAt: new Date().toISOString()
    }
    anniversaries.value.push(anniversary)
    saveData()
    return anniversary
  }

  // 删除纪念日
  function deleteAnniversary(id) {
    anniversaries.value = anniversaries.value.filter(a => a.id !== id)
  }

  // 记录睡眠
  function recordSleep(date, bedTime, wakeTime, quality, note = '') {
    const bed = new Date(bedTime)
    const wake = new Date(wakeTime)
    let duration = (wake - bed) / 3600000
    if (duration < 0) duration += 24

    const record = {
      id: generateId(),
      date,
      bedTime,
      wakeTime,
      duration: Math.round(duration * 10) / 10,
      quality,
      note,
      timestamp: new Date().toISOString()
    }

    const existing = sleepRecords.value.findIndex(s => s.date === date)
    if (existing !== -1) {
      sleepRecords.value[existing] = record
    } else {
      sleepRecords.value.push(record)
    }
  }

  // 记录饮水
  function recordWater(date, amount) {
    const existing = waterRecords.value.find(w => w.date === date)
    if (existing) {
      existing.amount += amount
      existing.records.push({ time: new Date().toISOString(), amount })
    } else {
      waterRecords.value.push({
        date,
        amount,
        records: [{ time: new Date().toISOString(), amount }]
      })
    }
  }

  // 保存日记
  function saveDiary(date, content, tags = []) {
    const existing = diaries.value.findIndex(d => d.date === date)
    const diary = {
      date,
      content,
      tags,
      updatedAt: new Date().toISOString()
    }
    if (existing !== -1) {
      diaries.value[existing] = { ...diaries.value[existing], ...diary }
    } else {
      diaries.value.push({ ...diary, createdAt: new Date().toISOString() })
    }
  }

  // 设置AI角色访问权限
  function setAIAccess(charId, permissions) {
    aiAccessSettings.value[charId] = {
      ...aiAccessSettings.value[charId],
      ...permissions
    }
  }

  // 获取AI可访问的数据
  function getAIAvailableData(charId) {
    const settings = aiAccessSettings.value[charId] || {}
    const data = {}

    if (settings.schedule !== false) {
      data.events = events.value
    }
    if (settings.period) {
      data.period = periodData.value
    }
    if (settings.mood) {
      data.mood = moodRecords.value
    }
    if (settings.sleep) {
      data.sleep = sleepRecords.value
    }
    if (settings.countdowns !== false) {
      data.countdowns = countdowns.value
    }

    return data
  }

  // 获取AI可用的日历提示
  function getAIContextPrompt(charId) {
    const settings = aiAccessSettings.value[charId] || {}
    const today = formatDateStr(new Date())
    const todayLunar = getLunarDate(new Date())
    const now = new Date()

    let prompt = `【日历信息】\n今天是 ${today} (${todayLunar.yearName} ${todayLunar.monthName}${todayLunar.dayName})\n`

    if (settings.schedule !== false) {
      const todayEvents = events.value.filter(e => e.date === today || checkRecurringEvent(e, today))
      if (todayEvents.length > 0) {
        prompt += `今日日程：\n${todayEvents.map(e => `- ${e.title} ${e.startTime || ''} ${e.allDay ? '(全天)' : ''}`).join('\n')}\n`
      }
    }

    // 经期信息：默认开启（settings.period !== false）
    if (settings.period !== false) {
      const status = getPeriodStatus(now)
      if (status) {
        if (status.type === 'period') {
          prompt += `生理期第${status.day}天\n`
        } else if (status.type === 'prediction') {
          prompt += `预计生理期第${status.day}天\n`
        } else if (status.type === 'ovulation') {
          prompt += `排卵期\n`
        }
      }
      // 添加经期记录状态提示
      if (periodData.value.cycles.length === 0 && periodData.value.predictions.length === 0) {
        prompt += `(暂无经期记录)\n`
      }
    }

    const upcoming = events.value
      .filter(e => e.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)

    if (upcoming.length > 0) {
      prompt += `\n即将到来：\n${upcoming.map(e => `- ${e.date} ${e.title}`).join('\n')}\n`
    }

    return prompt
  }

  // 导航方法
  function prevMonth() {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
  }

  function nextMonth() {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
  }

  // 周视图导航
  function prevWeek() {
    currentDate.value = new Date(currentDate.value.getTime() - 7 * 86400000)
  }

  function nextWeek() {
    currentDate.value = new Date(currentDate.value.getTime() + 7 * 86400000)
  }

  // 日视图导航
  function prevDay() {
    currentDate.value = new Date(currentDate.value.getTime() - 86400000)
    selectedDate.value = new Date(currentDate.value)
  }

  function nextDay() {
    currentDate.value = new Date(currentDate.value.getTime() + 86400000)
    selectedDate.value = new Date(currentDate.value)
  }

  function goToToday() {
    currentDate.value = new Date()
    selectedDate.value = new Date()
  }

  function selectDate(date) {
    selectedDate.value = date
  }

  function setViewMode(mode) {
    viewMode.value = mode
  }

  // 设置天气数据
  function setWeatherData(current, forecast) {
    weatherData.value.current = current
    weatherData.value.forecast = forecast
  }

  // 获取经期提醒
  function getPeriodReminders() {
    if (!periodReminders.value.enabled || periodData.value.predictions.length === 0) {
      return []
    }

    const today = new Date()
    const reminders = []

    // 检查即将到来的经期
    const nextPeriod = periodData.value.predictions[0]
    if (nextPeriod) {
      const startDate = new Date(nextPeriod.startDate)
      const daysUntil = Math.ceil((startDate - today) / 86400000)

      if (daysUntil > 0 && daysUntil <= periodReminders.value.remindBefore) {
        reminders.push({
          type: 'period_coming',
          title: '经期即将到来',
          message: `预计${daysUntil}天后进入生理期，请提前准备`,
          date: nextPeriod.startDate,
          daysUntil
        })
      }
    }

    // 检查当前是否在经期
    const currentStatus = getPeriodStatus(today)
    if (currentStatus?.type === 'period') {
      reminders.push({
        type: 'period_active',
        title: '生理期第' + currentStatus.day + '天',
        message: '注意保暖，多喝热水，避免剧烈运动',
        day: currentStatus.day
      })
    }

    return reminders
  }

  // 更新提醒设置
  function updatePeriodReminderSettings(settings) {
    periodReminders.value = { ...periodReminders.value, ...settings }
  }

  // 更新周期设置
  function updatePeriodSettings({ averageCycle, averageDuration }) {
    if (averageCycle !== undefined) {
      periodData.value.averageCycle = averageCycle
    }
    if (averageDuration !== undefined) {
      periodData.value.averageDuration = averageDuration
    }
    // 重新生成预测
    generatePeriodPredictions()
  }

  // 初始化
  loadData()
  if (periodData.value.cycles.length > 0) {
    generatePeriodPredictions()
  }

  // 主题相关方法
  const currentTheme = computed(() => {
    const allThemes = [...presetThemes.value, ...themeSettings.value.customThemes]
    return allThemes.find(theme => theme.id === themeSettings.value.currentTheme) || presetThemes.value[0]
  })

  function setTheme(themeId) {
    themeSettings.value.currentTheme = themeId
    saveThemeSettings()
  }

  function toggleDarkMode() {
    themeSettings.value.isDarkMode = !themeSettings.value.isDarkMode
    saveThemeSettings()
  }

  function addCustomTheme(theme) {
    themeSettings.value.customThemes.push(theme)
    saveThemeSettings()
  }

  function removeCustomTheme(themeId) {
    themeSettings.value.customThemes = themeSettings.value.customThemes.filter(t => t.id !== themeId)
    if (themeSettings.value.currentTheme === themeId) {
      themeSettings.value.currentTheme = 'default'
    }
    saveThemeSettings()
  }

  function saveThemeSettings() {
    localStorage.setItem('calendar-theme-settings', JSON.stringify(themeSettings.value))
  }

  function loadThemeSettings() {
    const saved = localStorage.getItem('calendar-theme-settings')
    if (saved) {
      themeSettings.value = JSON.parse(saved)
    }
  }

  // 初始化时加载主题设置
  loadThemeSettings()

  return {
    // 基础状态
    currentDate,
    selectedDate,
    viewMode,
    events,
    periodData,
    moodRecords,
    countdowns,
    sleepRecords,
    waterRecords,
    diaries,
    anniversaries,
    aiAccessSettings,
    userProfile, // Exported
    weatherData,
    periodReminders,
    currentMonthDays,
    statsOverview,

    // 主题相关
    themeSettings,
    presetThemes,
    currentTheme,
    setTheme,
    toggleDarkMode,
    addCustomTheme,
    removeCustomTheme,

    // 方法
    getLunarDate,
    getSolarTerm,
    getFestival,
    addEvent,
    updateEvent,
    deleteEvent,
    recordPeriod,
    recordMood,
    addCountdown,
    recordSleep,
    recordWater,
    saveDiary,
    setAIAccess,
    getAIAvailableData,
    getAIContextPrompt,
    prevMonth,
    nextMonth,
    prevWeek,
    nextWeek,
    prevDay,
    nextDay,
    goToToday,
    selectDate,
    setViewMode,
    setWeatherData,
    getPeriodReminders,
    updatePeriodReminderSettings,
    updatePeriodSettings,
    formatDateStr,
    getEventsForDate,
    getPeriodStatus,
    clearAllPeriodData,
    generatePeriodPredictions,
    addAnniversary,
    deleteAnniversary,
    saveData,
    getAnniversariesForDate
  }
})
