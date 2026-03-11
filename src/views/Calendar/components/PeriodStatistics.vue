<template>
  <div class="period-statistics">
    <!-- Header -->
    <div class="header">
      <button class="back-btn" @click="goBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="title">📊 经期统计</h1>
      <button class="action-btn" @click="showDeleteConfirm = true" title="删除所有记录">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6" />
          <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2" />
        </svg>
      </button>
    </div>

    <!-- Summary Stats -->
    <div class="summary-card">
      <div class="summary-header">
        <div class="avatar">🌸</div>
        <div class="summary-text">
          累计完成经期记录 <strong>{{ cycles.length }}</strong> 次
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ avgDuration }}<span class="unit">天</span></div>
          <div class="stat-label">平均经期</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value">{{ avgCycle }}<span class="unit">天</span></div>
          <div class="stat-label">平均周期</div>
        </div>
      </div>
    </div>

    <!-- Cycle List -->
    <div class="cycles-list">
      <div class="list-header">
        <h2>历史记录</h2>
        <span class="count">共 {{ cycles.length }} 条</span>
      </div>

      <div v-for="(cycle, index) in cycles" :key="cycle.id" class="cycle-item">
        <div class="cycle-timeline">
          <div class="timeline-dot"></div>
          <div class="timeline-line" v-if="index < cycles.length - 1"></div>
        </div>
        
        <div class="cycle-content">
          <div class="cycle-header">
            <div class="cycle-dates">
              <div class="start-date">
                <span class="label">开始于</span>
                <span class="date">{{ formatDate(cycle.startDate) }}</span>
              </div>
              <div class="end-date" v-if="cycle.endDate">
                <span class="label">结束于</span>
                <span class="date">{{ formatDate(cycle.endDate) }}</span>
              </div>
            </div>
            <div class="cycle-stats">
              <span class="duration">{{ cycle.duration }}/{{ cycle.cycleLength }}天</span>
            </div>
          </div>
          
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: (cycle.duration / cycle.cycleLength * 100) + '%' }"></div>
          </div>
        </div>
      </div>

      <div v-if="cycles.length === 0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p>还没有经期记录</p>
        <button class="start-btn" @click="goToRecord">开始记录</button>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-container">
        <h3>确认删除</h3>
        <p>确定要删除所有经期记录吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="btn-delete" @click="deleteAllCycles">删除全部</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '@/stores/calendarStore'

const router = useRouter()
const calendarStore = useCalendarStore()

const showDeleteConfirm = ref(false)

const cycles = computed(() => {
  return calendarStore.periodData.cycles.sort((a, b) => {
    return new Date(b.startDate) - new Date(a.startDate)
  })
})

const avgDuration = computed(() => {
  return calendarStore.periodData.averageDuration
})

const avgCycle = computed(() => {
  return calendarStore.periodData.averageCycle
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day}`
}

function goBack() {
  router.back()
}

function goToRecord() {
  // 打开记录弹窗
  calendarStore.openPeriodModal()
}

function deleteAllCycles() {
  if (confirm('确定要删除所有记录吗？')) {
    calendarStore.clearAllPeriodData()
    showDeleteConfirm.value = false
  }
}
</script>

<style scoped>
.period-statistics {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff5f7 0%, #fff 100%);
  padding: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: white;
  border-bottom: 1px solid rgba(255, 183, 197, 0.2);
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
  font-size: 20px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.summary-card {
  margin: 20px;
  padding: 24px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(255, 183, 197, 0.15);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.summary-text {
  flex: 1;
  font-size: 15px;
  color: #5a5a7a;
  line-height: 1.5;
}

.summary-text strong {
  color: #ff6b9d;
  font-size: 18px;
}

.stats-grid {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 20px;
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #ff6b9d;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-value .unit {
  font-size: 14px;
  font-weight: 500;
  margin-left: 4px;
}

.stat-label {
  font-size: 13px;
  color: #9a8fb8;
  font-weight: 500;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 183, 197, 0.3);
}

.cycles-list {
  padding: 0 20px 20px;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 0 4px;
}

.list-header h2 {
  font-size: 17px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.count {
  font-size: 13px;
  color: #9a8fb8;
  font-weight: 500;
}

.cycle-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
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
}

.timeline-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  background: rgba(255, 183, 197, 0.3);
  margin-top: 8px;
}

.cycle-content {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(255, 183, 197, 0.1);
}

.cycle-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cycle-dates {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.start-date, .end-date {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: #9a8fb8;
  font-weight: 500;
}

.date {
  font-size: 15px;
  font-weight: 600;
  color: #5a5a7a;
}

.duration {
  font-size: 14px;
  font-weight: 600;
  color: #ff6b9d;
  background: rgba(255, 183, 197, 0.1);
  padding: 4px 12px;
  border-radius: 12px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 183, 197, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffb7c5, #ff6b9d);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 20px;
  margin-top: 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 15px;
  color: #9a8fb8;
  margin-bottom: 20px;
}

.start-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #ffb7c5, #ff6b9d);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255, 183, 197, 0.4);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(90, 90, 122, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 20px;
  padding: 24px;
  max-width: 340px;
  width: 90%;
}

.modal-container h3 {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 12px 0;
}

.modal-container p {
  font-size: 14px;
  color: #6b6b8b;
  line-height: 1.6;
  margin: 0 0 20px 0;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.btn-cancel, .btn-delete {
  flex: 1;
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel {
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
}

.btn-cancel:hover {
  background: rgba(139, 122, 168, 0.2);
}

.btn-delete {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
}

.btn-delete:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255, 107, 157, 0.3);
}
</style>
