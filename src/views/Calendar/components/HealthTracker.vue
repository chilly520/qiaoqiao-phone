<template>
  <div class="health-tracker">
    <!-- 生理期卡片 -->
    <div class="health-card period-card">
      <div class="card-header">
        <h3>🌙 生理周期</h3>
        <button class="add-btn" @click="showPeriodModal = true">+ 记录</button>
      </div>
      
      <div v-if="calendarStore.periodData.cycles.length === 0" class="empty-state">
        <div class="empty-icon">🌙</div>
        <p>还没有记录生理周期</p>
        <button class="action-btn" @click="showPeriodModal = true">开始记录</button>
      </div>
      
      <div v-else class="period-content">
        <div class="period-status" :class="currentPeriodStatus?.type">
          <div class="status-icon">{{ getStatusIcon }}</div>
          <div class="status-text">
            <div class="status-title">{{ getStatusTitle }}</div>
            <div class="status-desc">{{ getStatusDesc }}</div>
          </div>
        </div>
              
        <div class="period-stats">
          <div class="stat-box">
            <div class="stat-value">{{ calendarStore.periodData.cycles.length }}</div>
            <div class="stat-label">记录周期</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">{{ calendarStore.periodData.averageCycle }}</div>
            <div class="stat-label">平均周期 (天)</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">{{ calendarStore.periodData.averageDuration }}</div>
            <div class="stat-label">平均经期 (天)</div>
          </div>
        </div>
              
        <div class="next-prediction" v-if="nextPeriod">
          <div class="prediction-title">📅 下次预测</div>
          <div class="prediction-date">{{ nextPeriod.startDate }}</div>
          <div class="prediction-countdown">还有 {{ daysUntilNext }} 天</div>
        </div>
              
        <button class="action-btn-link statistics-btn" @click="goToStatistics">
          <span>统计详情</span>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- 心情记录 -->
    <div class="health-card mood-card">
      <div class="card-header">
        <h3>😊 心情记录</h3>
        <button class="add-btn" @click="showMoodModal = true">+ 记录</button>
      </div>
      
      <div class="mood-chart">
        <div class="mood-distribution">
          <div 
            v-for="(count, mood) in moodDistribution" 
            :key="mood"
            class="mood-bar"
            :style="{ height: maxCount > 0 ? (count / maxCount * 100) + '%' : '0%' }"
          >
            <div class="bar" :class="mood"></div>
            <div class="mood-emoji">{{ getMoodEmoji(mood) }}</div>
            <div class="mood-count">{{ count }}</div>
          </div>
        </div>
      </div>
      
      <div class="recent-moods">
        <div class="section-title">最近记录</div>
        <div 
          v-for="mood in recentMoods" 
          :key="mood.date"
          class="mood-item"
        >
          <span class="mood-emoji">{{ getMoodEmoji(mood.mood) }}</span>
          <div class="mood-info">
            <div class="mood-date">{{ mood.date }}</div>
            <div class="mood-note" v-if="mood.note">{{ mood.note }}</div>
          </div>
        </div>
        <div v-if="recentMoods.length === 0" class="empty">暂无心情记录</div>
      </div>
    </div>

    <!-- 睡眠记录 -->
    <div class="health-card sleep-card">
      <div class="card-header">
        <h3>😴 睡眠追踪</h3>
        <button class="add-btn" @click="showSleepModal = true">+ 记录</button>
      </div>
      
      <div class="sleep-stats" v-if="sleepStats.avgDuration > 0">
        <div class="sleep-main">
          <div class="sleep-value">{{ sleepStats.avgDuration }}</div>
          <div class="sleep-unit">小时</div>
          <div class="sleep-label">平均睡眠</div>
        </div>
        <div class="sleep-detail">
          <div class="sleep-quality">
            <span>优质睡眠</span>
            <span class="quality-value">{{ sleepStats.goodSleep }}天</span>
          </div>
          <div class="sleep-quality">
            <span>一般睡眠</span>
            <span class="quality-value">{{ sleepStats.normalSleep }}天</span>
          </div>
          <div class="sleep-quality">
            <span>睡眠不足</span>
            <span class="quality-value">{{ sleepStats.poorSleep }}天</span>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <div class="empty-icon">😴</div>
        <p>还没有记录睡眠数据</p>
        <button class="action-btn" @click="showSleepModal = true">记录睡眠</button>
      </div>
    </div>

    <!-- 喝水记录 -->
    <div class="health-card water-card">
      <div class="card-header">
        <h3>💧 喝水打卡</h3>
        <button class="add-btn" @click="recordWater">+ 打卡</button>
      </div>
      
      <div class="water-tracker">
        <div class="water-progress">
          <div class="water-ring">
            <div class="water-value">{{ todayWater }}</div>
            <div class="water-target">/ 2000ml</div>
          </div>
        </div>
        <div class="water-percent">{{ waterPercent }}%</div>
        <div class="water-encourage">{{ waterEncourage }}</div>
      </div>
    </div>

    <!-- 弹窗 -->
    <PeriodModal v-if="showPeriodModal" :date="todayStr" @close="showPeriodModal = false" @save="savePeriod" />
    <MoodModal v-if="showMoodModal" :date="todayStr" @close="showMoodModal = false" @save="saveMood" />
    <SleepModal v-if="showSleepModal" :date="todayStr" @close="showSleepModal = false" @save="saveSleep" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '../../../stores/calendarStore'
import PeriodModal from './PeriodModal.vue'
import MoodModal from './MoodModal.vue'
import SleepModal from './SleepModal.vue'

const router = useRouter()
const calendarStore = useCalendarStore()

const showPeriodModal = ref(false)
const showMoodModal = ref(false)
const showSleepModal = ref(false)

const todayStr = computed(() => calendarStore.formatDateStr(new Date()))

// 生理期
const currentPeriodStatus = computed(() => {
  return calendarStore.getPeriodStatus(new Date())
})

const getStatusIcon = computed(() => {
  const status = currentPeriodStatus.value?.type
  if (status === 'period') return '🩸'
  if (status === 'prediction') return '📅'
  if (status === 'ovulation') return '🌸'
  return '✨'
})

const getStatusTitle = computed(() => {
  const status = currentPeriodStatus.value
  if (status?.type === 'period') return `生理期第 ${status.day} 天`
  if (status?.type === 'prediction') return `预计经期第 ${status.day} 天`
  if (status?.type === 'ovulation') return '排卵期'
  return '安全期'
})

const getStatusDesc = computed(() => {
  const status = currentPeriodStatus.value?.type
  if (status === 'period') return '注意休息，多喝热水'
  if (status === 'prediction') return '准备好生理用品'
  if (status === 'ovulation') return '注意身体变化'
  return '保持良好的生活习惯'
})

const nextPeriod = computed(() => {
  return calendarStore.periodData.predictions[0] || null
})

const daysUntilNext = computed(() => {
  if (!nextPeriod.value) return 0
  const next = new Date(nextPeriod.value.startDate)
  const today = new Date()
  return Math.ceil((next - today) / 86400000)
})

// 心情
const moodEmojis = {
  'happy': '😊',
  'excited': '🤩',
  'calm': '😌',
  'tired': '😴',
  'sad': '😢',
  'angry': '😠',
  'anxious': '😰',
  'loved': '🥰'
}

const moodDistribution = computed(() => {
  const counts = {}
  calendarStore.moodRecords.forEach(m => {
    counts[m.mood] = (counts[m.mood] || 0) + 1
  })
  return {
    'happy': counts['happy'] || 0,
    'excited': counts['excited'] || 0,
    'calm': counts['calm'] || 0,
    'tired': counts['tired'] || 0,
    'sad': counts['sad'] || 0,
    'loved': counts['loved'] || 0
  }
})

const maxCount = computed(() => {
  return Math.max(...Object.values(moodDistribution.value))
})

const recentMoods = computed(() => {
  return calendarStore.moodRecords.slice(-5).reverse()
})

function getMoodEmoji(mood) {
  return moodEmojis[mood] || '😐'
}

// 睡眠
const sleepStats = computed(() => {
  const records = calendarStore.sleepRecords.slice(-30)
  if (records.length === 0) return { avgDuration: 0, goodSleep: 0, normalSleep: 0, poorSleep: 0 }
  
  const avg = records.reduce((sum, r) => sum + r.duration, 0) / records.length
  const good = records.filter(r => r.duration >= 7 && r.quality === 'good').length
  const normal = records.filter(r => r.duration >= 6 && r.duration < 8).length
  const poor = records.filter(r => r.duration < 6 || r.quality === 'poor').length
  
  return {
    avgDuration: Math.round(avg * 10) / 10,
    goodSleep: good,
    normalSleep: normal,
    poorSleep: poor
  }
})

// 喝水
const todayWater = computed(() => {
  const today = calendarStore.waterRecords.find(w => w.date === todayStr.value)
  return today?.amount || 0
})

const waterPercent = computed(() => {
  return Math.min(100, Math.round((todayWater.value / 2000) * 100))
})

const waterEncourage = computed(() => {
  if (todayWater.value >= 2000) return '太棒了！今日目标达成 🎉'
  if (todayWater.value >= 1500) return '加油！马上就达标了 💪'
  if (todayWater.value >= 1000) return '继续保持，多喝点水 😊'
  return '记得多喝水哦 💧'
})

function recordWater() {
  calendarStore.recordWater(todayStr.value, 250)
}

function goToStatistics() {
  router.push('/calendar/statistics')
}

// 保存方法
function savePeriod(data) {
  calendarStore.recordPeriod(data.startDate, data.endDate, data.symptoms)
  showPeriodModal.value = false
}

function saveMood(data) {
  calendarStore.recordMood(todayStr.value, data.mood, data.note, data.tags)
  showMoodModal.value = false
}

function saveSleep(data) {
  calendarStore.recordSleep(todayStr.value, data.bedTime, data.wakeTime, data.quality, data.note)
  showSleepModal.value = false
}
</script>

<style scoped>
.health-tracker {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.health-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(139, 122, 168, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.add-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 12px;
  cursor: pointer;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 32px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-state p {
  font-size: 14px;
  color: #8b7aa8;
  margin: 0 0 16px 0;
}

.action-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 14px;
  cursor: pointer;
}

/* 生理期 */
.period-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 16px;
}

.period-status.period {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.3), rgba(255, 218, 224, 0.3));
}

.period-status.prediction {
  background: linear-gradient(135deg, rgba(255, 228, 196, 0.3), rgba(255, 240, 220, 0.3));
}

.period-status .status-icon {
  font-size: 36px;
}

.status-title {
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
}

.status-desc {
  font-size: 12px;
  color: #8b7aa8;
  margin-top: 4px;
}

.period-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-box {
  text-align: center;
  padding: 12px;
  background: rgba(139, 122, 168, 0.05);
  border-radius: 10px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #5a5a7a;
}

.stat-label {
  font-size: 10px;
  color: #9a8fb8;
  margin-top: 4px;
}

.next-prediction {
  padding: 16px;
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.2), rgba(255, 218, 224, 0.2));
  border-radius: 12px;
  text-align: center;
}

.prediction-title {
  font-size: 13px;
  color: #8b7aa8;
  margin-bottom: 8px;
}

.prediction-date {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
}

.prediction-countdown {
  font-size: 14px;
  color: #ff6b9d;
  margin-top: 4px;
}

/* 统计详情按钮 */
.statistics-btn {
  width: 100%;
  margin-top: 20px;
  padding: 14px 20px;
  background: rgba(197, 201, 255, 0.2);
  border: 1px solid rgba(197, 201, 255, 0.3);
  border-radius: 12px;
  font-size: 15px;
  color: #8b7aa8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
}

.statistics-btn:hover {
  background: rgba(197, 201, 255, 0.3);
  transform: translateY(-2px);
}

.action-btn-link {
  width: 100%;
  padding: 12px 20px;
  background: rgba(255, 183, 197, 0.1);
  color: #ff6b9d;
  border: 1px solid rgba(255, 183, 197, 0.3);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.action-btn-link:hover {
  background: rgba(255, 183, 197, 0.2);
  border-color: rgba(255, 183, 197, 0.5);
}

.action-btn-link i {
  font-size: 12px;
  margin-left: 4px;
}

.btn-icon {
  font-size: 18px;
}

/* 心情图表 */
.mood-chart {
  margin-bottom: 16px;
}

.mood-distribution {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 120px;
  padding: 16px;
  background: rgba(139, 122, 168, 0.05);
  border-radius: 12px;
}

.mood-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 40px;
}

.mood-bar .bar {
  width: 24px;
  border-radius: 12px;
  transition: height 0.3s ease;
}

.mood-bar .bar.happy { background: linear-gradient(180deg, #ffd93d, #ffb347); height: 100%; }
.mood-bar .bar.excited { background: linear-gradient(180deg, #ff9eb5, #ff6b9d); height: 80%; }
.mood-bar .bar.calm { background: linear-gradient(180deg, #a8d8ea, #7fb069); height: 60%; }
.mood-bar .bar.tired { background: linear-gradient(180deg, #c5c9ff, #9ec4bb); height: 40%; }
.mood-bar .bar.sad { background: linear-gradient(180deg, #d4a5a5, #b4a7d6); height: 30%; }
.mood-bar .bar.loved { background: linear-gradient(180deg, #ffb7c5, #ffd8a8); height: 90%; }

.mood-emoji {
  font-size: 16px;
}

.mood-count {
  font-size: 10px;
  color: #9a8fb8;
}

.recent-moods {
  margin-top: 16px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #5a5a7a;
  margin-bottom: 12px;
}

.mood-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.mood-item:last-child {
  border-bottom: none;
}

.mood-item .mood-emoji {
  font-size: 24px;
}

.mood-info {
  flex: 1;
}

.mood-date {
  font-size: 12px;
  color: #9a8fb8;
}

.mood-note {
  font-size: 13px;
  color: #5a5a7a;
  margin-top: 2px;
}

.empty {
  text-align: center;
  padding: 20px;
  color: #9a8fb8;
  font-size: 13px;
}

/* 睡眠 */
.sleep-stats {
  text-align: center;
}

.sleep-main {
  margin-bottom: 20px;
}

.sleep-value {
  font-size: 48px;
  font-weight: 700;
  color: #5a5a7a;
  line-height: 1;
}

.sleep-unit {
  font-size: 14px;
  color: #8b7aa8;
}

.sleep-label {
  font-size: 12px;
  color: #9a8fb8;
  margin-top: 4px;
}

.sleep-detail {
  display: flex;
  justify-content: space-around;
}

.sleep-quality {
  text-align: center;
}

.sleep-quality span:first-child {
  display: block;
  font-size: 11px;
  color: #9a8fb8;
}

.quality-value {
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
  margin-top: 4px;
}

/* 喝水 */
.water-tracker {
  text-align: center;
  padding: 20px;
}

.water-progress {
  margin-bottom: 16px;
}

.water-ring {
  width: 140px;
  height: 140px;
  margin: 0 auto;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #a8d8ea 0deg,
    #a8d8ea calc(v-bind(waterPercent) * 3.6deg),
    rgba(168, 216, 234, 0.2) calc(v-bind(waterPercent) * 3.6deg)
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.water-ring::before {
  content: '';
  position: absolute;
  width: 110px;
  height: 110px;
  background: white;
  border-radius: 50%;
}

.water-value {
  font-size: 36px;
  font-weight: 700;
  color: #5a5a7a;
  z-index: 1;
}

.water-target {
  font-size: 12px;
  color: #9a8fb8;
  z-index: 1;
}

.water-percent {
  font-size: 24px;
  font-weight: 600;
  color: #7fb069;
}

.water-encourage {
  font-size: 13px;
  color: #8b7aa8;
  margin-top: 8px;
}
</style>
