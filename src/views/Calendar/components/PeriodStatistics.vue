<template>
  <div class="period-statistics">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" @click="goBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="title">📊 经期统计 & 预测</h1>
      <button class="action-btn" @click="showDeleteConfirm = true" title="清空所有记录">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6" />
          <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2" />
        </svg>
      </button>
    </div>

    <!-- v1.10.92: 当前状态卡 -->
    <div v-if="stats.hasData" class="status-card" :class="statusClass">
      <div class="status-icon">{{ statusIcon }}</div>
      <div class="status-text">
        <div class="status-title">{{ statusTitle }}</div>
        <div class="status-sub">{{ statusSub }}</div>
      </div>
    </div>

    <!-- 关键统计 -->
    <div v-if="stats.hasData" class="summary-card">
      <h3 class="card-title">📈 关键指标</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ stats.avgCycle }}<span class="unit">天</span></div>
          <div class="stat-label">平均周期</div>
          <div class="stat-trend">±{{ stats.stdDev }}天</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.avgDuration }}<span class="unit">天</span></div>
          <div class="stat-label">平均经期</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value" :class="regularityClass">{{ stats.regularityLabel }}</div>
          <div class="stat-label">规律性</div>
        </div>
      </div>
      <div class="sample-info">
        基于最近 {{ stats.intervalCount }} 个周期(共 {{ stats.totalCycles }} 条记录)
      </div>
    </div>

    <!-- 智能预测 -->
    <div v-if="stats.hasData" class="summary-card">
      <h3 class="card-title">🔮 智能预测</h3>
      <div class="prediction-list">
        <div class="prediction-item">
          <div class="pred-icon">🩸</div>
          <div class="pred-content">
            <div class="pred-label">下次经期</div>
            <div class="pred-value">
              <span v-if="stats.nextPrediction">{{ formatDateStr(stats.nextPrediction.startDate) }}</span>
              <span v-else class="pred-empty">数据不足</span>
            </div>
            <div v-if="stats.nextPrediction" class="pred-meta">
              预计持续 {{ stats.nextPrediction.duration }} 天 ·
              置信度 <strong>{{ stats.nextPrediction.confidence }}%</strong>
            </div>
          </div>
        </div>
        <div class="prediction-item">
          <div class="pred-icon">🥚</div>
          <div class="pred-content">
            <div class="pred-label">排卵日</div>
            <div class="pred-value">
              <span v-if="stats.nextOvulation">{{ formatDateStr(stats.nextOvulation) }}</span>
              <span v-else class="pred-empty">—</span>
            </div>
            <div v-if="stats.nextOvulation" class="pred-meta">下次经期前 14 天</div>
          </div>
        </div>
        <div class="prediction-item">
          <div class="pred-icon">💗</div>
          <div class="pred-content">
            <div class="pred-label">易孕期</div>
            <div class="pred-value">
              <span v-if="stats.nextFertileWindow">
                {{ formatDateStr(stats.nextFertileWindow.start) }} ~ {{ formatDateStr(stats.nextFertileWindow.end) }}
              </span>
              <span v-else class="pred-empty">—</span>
            </div>
            <div v-if="stats.nextFertileWindow" class="pred-meta">
              排卵高峰:{{ formatDateStr(stats.nextFertileWindow.peak) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 一键操作 -->
    <div v-if="stats.hasData" class="summary-card">
      <h3 class="card-title">⚡ 快速操作</h3>
      <div v-if="stats.currentPeriod" class="quick-current">
        <div class="qc-banner">
          <i class="fa-solid fa-droplet"></i>
          正在经期 · 第 <strong>{{ stats.currentPeriod.currentDay }}</strong> 天
        </div>
        <button class="quick-btn end-btn" @click="onEndPeriod">
          <i class="fa-solid fa-stop"></i> 结束今天
        </button>
      </div>
      <div v-else class="quick-start">
        <button class="quick-btn start-btn" @click="onStartPeriod">
          <i class="fa-solid fa-play"></i> 今天开始经期
        </button>
        <p class="quick-hint">默认 5 天,可在历史记录里修改结束日</p>
      </div>
    </div>

    <!-- 历史记录 -->
    <div class="cycles-list">
      <div class="list-header">
        <h2>历史记录</h2>
        <span class="count">共 {{ stats.recentCycles.length }} 条</span>
      </div>

      <div v-for="(cycle, index) in sortedCycles" :key="cycle.id" class="cycle-item">
        <div class="cycle-timeline">
          <div class="timeline-dot" :class="{ 'is-current': isCurrent(cycle) }"></div>
          <div class="timeline-line" v-if="index < sortedCycles.length - 1"></div>
        </div>

        <div class="cycle-content">
          <div class="cycle-header">
            <div class="cycle-dates">
              <div class="start-date">
                <span class="label">开始</span>
                <span class="date">{{ formatDate(cycle.startDate) }}</span>
                <span v-if="isCurrent(cycle)" class="current-tag">进行中</span>
              </div>
              <div v-if="cycle.endDate" class="end-date">
                <span class="label">结束</span>
                <span class="date">{{ formatDate(cycle.endDate) }}</span>
              </div>
            </div>
            <div class="cycle-stats">
              <span class="duration">经期 {{ cycle.duration }} 天</span>
              <span v-if="cycle.cycleLength" class="cycle-length">周期 {{ cycle.cycleLength }} 天</span>
            </div>
          </div>

          <div v-if="cycle.symptoms && cycle.symptoms.length" class="cycle-symptoms">
            <span v-for="s in cycle.symptoms" :key="s" class="symptom-tag">{{ s }}</span>
          </div>

          <div v-if="cycle.note" class="cycle-note">{{ cycle.note }}</div>

          <button class="delete-cycle-btn" @click="onDeleteCycle(cycle.id)">删除</button>
        </div>
      </div>

      <div v-if="sortedCycles.length === 0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p>还没有经期记录</p>
        <button class="start-btn" @click="onStartPeriod">
          <i class="fa-solid fa-play"></i> 开始记录
        </button>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-container">
        <h3>确认清空</h3>
        <p>确定要清空所有经期记录吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="btn-delete" @click="deleteAllCycles">清空全部</button>
        </div>
      </div>
    </div>

    <!-- 状态消息提示 -->
    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '@/stores/calendarStore'

const router = useRouter()
const calendarStore = useCalendarStore()

const showDeleteConfirm = ref(false)
const toast = reactive({ show: false, message: '', type: 'info' })

// v1.10.92: 用新 API 取完整统计
const stats = computed(() => calendarStore.getFullPeriodStats())

// 历史记录(按开始日倒序)
const sortedCycles = computed(() => {
  return [...(stats.value.recentCycles || [])].sort((a, b) => {
    return new Date(b.startDate) - new Date(a.startDate)
  })
})

// 计算相邻周期间隔(展示在历史里)
function withCycleLength(cycles) {
  const sorted = [...cycles].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
  return sorted.map((c, i) => {
    if (i === 0) return { ...c, cycleLength: null }
    const prev = sorted[i - 1]
    const diff = Math.round((new Date(c.startDate) - new Date(prev.startDate)) / 86400000)
    return { ...c, cycleLength: diff }
  })
}

const cyclesWithLength = computed(() => {
  return withCycleLength(stats.value.recentCycles || []).sort((a, b) => {
    return new Date(b.startDate) - new Date(a.startDate)
  })
})

// 当前状态卡
const statusClass = computed(() => {
  if (stats.value.currentPeriod) return 'is-period'
  if (stats.value.nextPrediction) {
    const days = Math.round((new Date(stats.value.nextPrediction.startDate) - new Date()) / 86400000)
    if (days <= 3) return 'is-soon'
  }
  return 'is-normal'
})
const statusIcon = computed(() => {
  if (stats.value.currentPeriod) return '🩸'
  const days = stats.value.nextPrediction
    ? Math.round((new Date(stats.value.nextPrediction.startDate) - new Date()) / 86400000)
    : null
  if (days !== null && days <= 3) return '⚠️'
  return '🌸'
})
const statusTitle = computed(() => {
  if (stats.value.currentPeriod) return `经期进行中 · 第 ${stats.value.currentPeriod.currentDay} 天`
  if (stats.value.nextPrediction) {
    const days = Math.round((new Date(stats.value.nextPrediction.startDate) - new Date()) / 86400000)
    if (days <= 0) return '经期将至'
    if (days <= 3) return `距下次经期 ${days} 天`
    return `下次经期 ${days} 天后`
  }
  return '暂无预测'
})
const statusSub = computed(() => {
  if (stats.value.currentPeriod) {
    return `预计还有 ${Math.max(0, stats.value.avgDuration - stats.value.currentPeriod.currentDay)} 天`
  }
  if (stats.value.nextOvulation) {
    return `排卵日:${formatDateStr(stats.value.nextOvulation)}`
  }
  return ''
})

const regularityClass = computed(() => {
  return {
    'reg-regular': stats.value.regularity === 'regular',
    'reg-mild': stats.value.regularity === 'mild_irregular',
    'reg-irregular': stats.value.regularity === 'irregular'
  }
})

function isCurrent(cycle) {
  if (!cycle.endDate) {
    const today = new Date()
    const start = new Date(cycle.startDate)
    return today >= start && today <= new Date(start.getTime() + (cycle.duration - 1) * 86400000)
  }
  return false
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDateStr(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekdays[date.getDay()]}`
}

function goBack() {
  router.back()
}

function showToast(message, type = 'info', duration = 2500) {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => { toast.show = false }, duration)
}

function onStartPeriod() {
  const result = calendarStore.startPeriod()
  showToast(result.message, result.success ? 'success' : 'error')
}

function onEndPeriod() {
  const result = calendarStore.endPeriod()
  showToast(result.message, result.success ? 'success' : 'error')
}

function onDeleteCycle(cycleId) {
  if (confirm('确定删除这条记录?')) {
    calendarStore.deletePeriodRecord(cycleId)
    showToast('已删除', 'success')
  }
}

function deleteAllCycles() {
  calendarStore.clearAllPeriodData()
  showDeleteConfirm.value = false
  showToast('已清空所有记录', 'success')
}
</script>

<style scoped>
.period-statistics {
  /* v1.10.99: 主内容区(App.vue 的 main-content)固定高度且 overflow:hidden,
     这里必须 height:100% + overflow-y:auto 才能在长内容时正常滚动,
     否则底部"易孕期/历史记录"被剪掉、用户也划不动 */
  height: 100%;
  overflow-y: auto;
  background: linear-gradient(180deg, #fff5f7 0%, #fff 100%);
  padding: 0 0 40px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: white;
  border-bottom: 1px solid rgba(255, 183, 197, 0.2);
  position: sticky;
  top: 0;
  z-index: 10;
}

.back-btn, .action-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 183, 197, 0.1);
  color: #ff6b9d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.back-btn:hover, .action-btn:hover {
  background: rgba(255, 183, 197, 0.2);
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

/* v1.10.92: 状态卡 */
.status-card {
  margin: 16px 20px 0;
  padding: 18px 20px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: white;
  background: linear-gradient(135deg, #ffb7c5, #ff6b9d);
  box-shadow: 0 4px 16px rgba(255, 107, 157, 0.25);
}
.status-card.is-soon {
  background: linear-gradient(135deg, #ffd86f, #fc8e3a);
  box-shadow: 0 4px 16px rgba(252, 142, 58, 0.3);
}
.status-card.is-normal {
  background: linear-gradient(135deg, #b8c5ff, #8b7fcf);
  box-shadow: 0 4px 16px rgba(139, 127, 207, 0.3);
}
.status-icon {
  font-size: 36px;
}
.status-text { flex: 1; }
.status-title { font-size: 17px; font-weight: 700; }
.status-sub { font-size: 12px; opacity: 0.9; margin-top: 4px; }

.summary-card {
  margin: 16px 20px 0;
  padding: 20px;
  background: white;
  border-radius: 18px;
  box-shadow: 0 2px 12px rgba(255, 183, 197, 0.1);
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 16px;
  letter-spacing: 0.5px;
}

.stats-grid {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 12px;
}
.stat-item {
  text-align: center;
  flex: 1;
}
.stat-value {
  font-size: 30px;
  font-weight: 700;
  color: #ff6b9d;
  line-height: 1;
  margin-bottom: 6px;
}
.stat-value .unit {
  font-size: 13px;
  font-weight: 500;
  margin-left: 3px;
}
.stat-label {
  font-size: 12px;
  color: #9a8fb8;
  font-weight: 500;
}
.stat-trend {
  font-size: 10px;
  color: #b8a8c8;
  margin-top: 4px;
}
.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 183, 197, 0.3);
}
.sample-info {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed #ffe4d6;
  font-size: 11px;
  color: #b8a8c8;
  text-align: center;
}

/* 规律性颜色 */
.reg-regular { color: #67c23a; }
.reg-mild { color: #e6a23c; }
.reg-irregular { color: #f56c6c; }

/* 预测列表 */
.prediction-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.prediction-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #fff8f0 0%, #fff0f5 100%);
  border-radius: 14px;
  border: 1px solid #ffe4d6;
}
.pred-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 12px;
  flex-shrink: 0;
}
.pred-content { flex: 1; min-width: 0; }
.pred-label { font-size: 11px; color: #9a8fb8; }
.pred-value {
  font-size: 15px;
  font-weight: 700;
  color: #ff6b9d;
  margin-top: 2px;
}
.pred-empty { color: #ccc; font-weight: 500; }
.pred-meta { font-size: 10px; color: #b8a8c8; margin-top: 2px; }
.pred-meta strong { color: #ff6b9d; }

/* 快速操作 */
.quick-current {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.qc-banner {
  padding: 14px;
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border-radius: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
}
.qc-banner i { margin-right: 6px; }
.qc-banner strong { font-size: 18px; }
.quick-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.start-btn {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
}
.start-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255, 107, 157, 0.3); }
.end-btn {
  background: white;
  color: #ff6b9d;
  border: 2px solid #ff6b9d !important;
}
.end-btn:hover { background: #fff0f5; }
.quick-hint { font-size: 11px; color: #b8a8c8; text-align: center; margin: 4px 0 0; }

/* 历史记录 */
.cycles-list {
  margin-top: 20px;
  padding: 0 20px;
}
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 0 4px;
}
.list-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}
.count { font-size: 12px; color: #9a8fb8; }

.cycle-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.cycle-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb7c5, #ff6b9d);
  flex-shrink: 0;
  margin-top: 18px;
}
.timeline-dot.is-current {
  background: linear-gradient(135deg, #ff6b9d, #ff3b6e);
  box-shadow: 0 0 0 4px rgba(255, 107, 157, 0.2);
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(255, 107, 157, 0.2); }
  50% { box-shadow: 0 0 0 8px rgba(255, 107, 157, 0.05); }
}
.timeline-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  background: rgba(255, 183, 197, 0.3);
  margin-top: 6px;
}
.cycle-content {
  flex: 1;
  background: white;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 2px 10px rgba(255, 183, 197, 0.1);
  position: relative;
}
.cycle-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.cycle-dates {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.start-date, .end-date {
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  font-size: 11px;
  color: #9a8fb8;
  font-weight: 500;
  min-width: 30px;
}
.date {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
}
.current-tag {
  background: linear-gradient(135deg, #ff6b9d, #ff3b6e);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 6px;
}
.cycle-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}
.duration, .cycle-length {
  font-size: 12px;
  font-weight: 600;
  color: #ff6b9d;
  background: rgba(255, 183, 197, 0.12);
  padding: 3px 10px;
  border-radius: 10px;
  white-space: nowrap;
}
.cycle-length {
  color: #8b7aa8;
  background: rgba(139, 122, 168, 0.1);
}
.cycle-symptoms {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.symptom-tag {
  font-size: 10px;
  padding: 2px 8px;
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
  border-radius: 8px;
}
.cycle-note {
  margin-top: 8px;
  font-size: 12px;
  color: #6b6b8b;
  background: #f8f6fc;
  padding: 6px 10px;
  border-radius: 8px;
  font-style: italic;
}
.delete-cycle-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  color: #b8a8c8;
  font-size: 10px;
  cursor: pointer;
  padding: 2px 6px;
  opacity: 0;
  transition: opacity 0.2s;
}
.cycle-content:hover .delete-cycle-btn { opacity: 1; }
.delete-cycle-btn:hover { color: #f56c6c; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 18px;
  margin-top: 20px;
}
.empty-icon { font-size: 60px; margin-bottom: 12px; }
.empty-state p { font-size: 14px; color: #9a8fb8; margin-bottom: 18px; }
.start-btn {
  padding: 12px 28px;
  background: linear-gradient(135deg, #ffb7c5, #ff6b9d);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(90, 90, 122, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal-container {
  background: white;
  border-radius: 18px;
  padding: 24px;
  max-width: 340px;
  width: 100%;
}
.modal-container h3 { font-size: 17px; font-weight: 600; color: #5a5a7a; margin: 0 0 10px; }
.modal-container p { font-size: 13px; color: #6b6b8b; line-height: 1.6; margin: 0 0 20px; }
.modal-actions { display: flex; gap: 10px; }
.btn-cancel, .btn-delete {
  flex: 1;
  padding: 11px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel { background: rgba(139, 122, 168, 0.1); color: #8b7aa8; }
.btn-delete {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  z-index: 2000;
  background: linear-gradient(135deg, #67c23a, #5daf34);
  color: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}
.toast.error { background: linear-gradient(135deg, #f56c6c, #e64545); }
.toast.info { background: linear-gradient(135deg, #909399, #73767a); }
@keyframes slideUp {
  from { transform: translate(-50%, 20px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
</style>
