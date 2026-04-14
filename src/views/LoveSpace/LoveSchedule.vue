<template>
  <div class="love-schedule">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>角色日程</h2>
      <button @click="generateSchedule" class="magic-btn" :disabled="isGenerating">
        <i class="fa-solid fa-wand-magic-sparkles" :class="{ 'spinning': isGenerating }"></i>
      </button>
    </div>

    <!-- 日历组件 -->
    <div class="calendar-section">
      <div class="calendar-header">
        <button @click="previousMonth" class="nav-btn">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <h3>{{ currentYear }}年 {{ currentMonth + 1 }}月</h3>
        <button @click="nextMonth" class="nav-btn">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>

      <div class="calendar-grid">
        <div class="calendar-weekday" v-for="day in weekdays" :key="day">{{ day }}</div>
        <div 
          v-for="day in calendarDays" 
          :key="day.date"
          :class="['calendar-day', { 
            'other-month': day.otherMonth,
            'today': day.isToday,
            'has-schedule': day.hasSchedule,
            'selected': day.isSelected
          }]"
          @click="selectDate(day)"
        >
          <span class="day-number">{{ day.day }}</span>
          <div class="schedule-dots" v-if="day.scheduleCount > 0">
            <span class="dot" v-for="i in Math.min(3, day.scheduleCount)" :key="i"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 选中的日期详情 -->
    <div class="schedule-details" v-if="selectedDate">
      <div class="details-header">
        <h3>{{ selectedDateLabel }}</h3>
        <button @click="showAddModal = true" class="add-btn">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>

      <div class="schedule-list" v-if="selectedSchedules.length > 0">
        <div 
          v-for="schedule in selectedSchedules" 
          :key="schedule.id"
          :class="['schedule-item', `type-${schedule.type}`]"
        >
          <div class="schedule-time">
            <i :class="getEventIcon(schedule.type)"></i>
            <span>{{ schedule.time }}</span>
          </div>
          <div class="schedule-content">
            <h4>{{ schedule.title }}</h4>
            <p>{{ schedule.description }}</p>
            <div class="schedule-meta" v-if="schedule.location || schedule.mood">
              <span class="location" v-if="schedule.location">
                <i class="fa-solid fa-location-dot"></i> {{ schedule.location }}
              </span>
              <span class="mood-tag" :class="schedule.mood" v-if="schedule.mood">
                {{ getMoodLabel(schedule.mood) }}
              </span>
            </div>
          </div>
          <div class="schedule-actions">
            <button @click="editSchedule(schedule)" class="action-btn">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button @click="confirmDelete(schedule)" class="action-btn delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <i class="fa-regular fa-calendar-xmark"></i>
        <p>这一天还没有日程安排</p>
        <button @click="showAddModal = true" class="add-schedule-btn">
          添加第一个日程
        </button>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div class="modal-overlay" v-if="showAddModal || editingSchedule" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ editingSchedule ? '编辑日程' : '添加日程' }}</h3>
          <button @click="closeModal" class="close-btn">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="formData.date" />
          </div>
          
          <div class="form-group">
            <label>时间</label>
            <input type="time" v-model="formData.time" />
          </div>
          
          <div class="form-group">
            <label>标题</label>
            <input type="text" v-model="formData.title" placeholder="例如：晨间会议、约会..." />
          </div>
          
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="formData.description" placeholder="详细描述..." rows="3"></textarea>
          </div>
          
          <div class="form-group">
            <label>类型</label>
            <select v-model="formData.type">
              <option value="daily">日常</option>
              <option value="work">工作/学习</option>
              <option value="romantic">浪漫约会</option>
              <option value="special">特殊事件</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>地点</label>
            <input type="text" v-model="formData.location" placeholder="可选" />
          </div>
          
          <div class="form-group">
            <label>心情</label>
            <select v-model="formData.mood">
              <option value="normal">普通</option>
              <option value="happy">开心</option>
              <option value="busy">忙碌</option>
              <option value="romantic">浪漫</option>
            </select>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeModal" class="cancel-btn">取消</button>
          <button @click="saveSchedule" class="save-btn">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useChatStore } from '@/stores/chatStore'

const loveSpaceStore = useLoveSpaceStore()
const chatStore = useChatStore()

// 确保 store 已初始化
if (!loveSpaceStore || !chatStore) {
  console.error('[LoveSchedule] Store initialization failed')
}

// 日历状态
const currentDate = new Date()
const currentYear = ref(currentDate.getFullYear())
const currentMonth = ref(currentDate.getMonth())
const selectedDate = ref(null)

// 日历数据
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const prevMonthLastDay = new Date(year, month, 0)
  
  const startWeekday = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  
  const days = []
  const today = new Date().toISOString().split('T')[0]
  const selected = selectedDate.value
  
  // 上月日期
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthLastDay.getDate() - i
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({
      day,
      date: dateStr,
      otherMonth: true,
      isToday: dateStr === today,
      isSelected: dateStr === selected,
      hasSchedule: hasSchedulesOnDate(dateStr),
      scheduleCount: getSchedulesCount(dateStr)
    })
  }
  
  // 当月日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({
      day,
      date: dateStr,
      otherMonth: false,
      isToday: dateStr === today,
      isSelected: dateStr === selected,
      hasSchedule: hasSchedulesOnDate(dateStr),
      scheduleCount: getSchedulesCount(dateStr)
    })
  }
  
  // 下月日期
  const remainingDays = 42 - days.length
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    days.push({
      day,
      date: dateStr,
      otherMonth: true,
      isToday: dateStr === today,
      isSelected: dateStr === selected,
      hasSchedule: hasSchedulesOnDate(dateStr),
      scheduleCount: getSchedulesCount(dateStr)
    })
  }
  
  return days
})

// 辅助函数
const hasSchedulesOnDate = (dateStr) => {
  const schedules = loveSpaceStore.getSchedulesByDate(dateStr) || []
  console.log(`[LoveSchedule] hasSchedulesOnDate(${dateStr}):`, schedules.length, schedules)
  return schedules.length > 0
}

const getSchedulesCount = (dateStr) => {
  const schedules = loveSpaceStore.getSchedulesByDate(dateStr) || []
  return schedules.length
}

const selectedSchedules = computed(() => {
  if (!selectedDate.value) return []
  const schedules = loveSpaceStore.getSchedulesByDate(selectedDate.value) || []
  console.log(`[LoveSchedule] selectedSchedules(${selectedDate.value}):`, schedules.length, schedules)
  return schedules
})

const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  const date = new Date(selectedDate.value)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = weekdays[date.getDay()]
  return `${month}月${day}日 周${weekday}`
})

// 导航
function previousMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function selectDate(day) {
  selectedDate.value = day.otherMonth ? null : day.date
}

// 日程操作
const isGenerating = ref(false)
const showAddModal = ref(false)
const editingSchedule = ref(null)
const formData = ref({
  date: '',
  time: '',
  title: '',
  description: '',
  type: 'daily',
  location: '',
  mood: 'normal'
})

async function generateSchedule() {
  if (isGenerating.value) return
  
  isGenerating.value = true
  try {
    await loveSpaceStore.generateSingleFeature('schedule')
    if (chatStore && chatStore.triggerToast) {
      chatStore.triggerToast('日程生成成功!✨', 'success')
    }
  } catch (error) {
    console.error('生成日程失败:', error)
    if (chatStore && chatStore.triggerToast) {
      chatStore.triggerToast('生成失败，请重试', 'error')
    }
  } finally {
    isGenerating.value = false
  }
}

function editSchedule(schedule) {
  editingSchedule.value = schedule
  formData.value = {
    date: schedule.date,
    time: schedule.time,
    title: schedule.title,
    description: schedule.description || '',
    type: schedule.type || 'daily',
    location: schedule.location || '',
    mood: schedule.mood || 'normal'
  }
}

function saveSchedule() {
  if (!formData.value.date || !formData.value.title) {
    if (chatStore && chatStore.triggerToast) {
      chatStore.triggerToast('请填写必填项', 'error')
    }
    return
  }

  if (editingSchedule.value) {
    loveSpaceStore.updateSchedule(editingSchedule.value.id, {
      ...formData.value
    })
    if (chatStore && chatStore.triggerToast) {
      chatStore.triggerToast('日程已更新', 'success')
    }
  } else {
    loveSpaceStore.addSchedule({
      ...formData.value
    })
    if (chatStore && chatStore.triggerToast) {
      chatStore.triggerToast('日程已添加', 'success')
    }
  }
  
  closeModal()
}

function confirmDelete(schedule) {
  const confirmed = window.confirm(`确定要删除"${schedule.title}"吗？`)
  if (confirmed) {
    loveSpaceStore.deleteSchedule(schedule.id)
    if (chatStore && chatStore.triggerToast) {
      chatStore.triggerToast('日程已删除', 'success')
    }
  }
}

function closeModal() {
  showAddModal.value = false
  editingSchedule.value = null
  resetForm()
}

function resetForm() {
  formData.value = {
    date: selectedDate.value || new Date().toISOString().split('T')[0],
    time: '09:00',
    title: '',
    description: '',
    type: 'daily',
    location: '',
    mood: 'normal'
  }
}

function getEventIcon(type) {
  const icons = {
    daily: 'fa-solid fa-house',
    work: 'fa-solid fa-briefcase',
    romantic: 'fa-solid fa-heart',
    special: 'fa-solid fa-star'
  }
  return icons[type] || 'fa-solid fa-calendar'
}

function getMoodLabel(mood) {
  const labels = {
    normal: '普通',
    happy: '开心',
    busy: '忙碌',
    romantic: '浪漫'
  }
  return labels[mood] || mood
}

// 初始化
onMounted(() => {
  resetForm()
  // 默认选中今天
  const today = new Date().toISOString().split('T')[0]
  selectedDate.value = today
})
</script>

<style scoped>
.love-schedule {
  height: 100vh;
  background: linear-gradient(135deg, #fdf2f8 0%, #fef3c7 100%);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 日程详情区 - 确保可滚动且不被日历挤占 */
.schedule-details {
  background: white;
  margin: 0 8px 8px;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  min-height: 120px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.header {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn, .magic-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #ff6b9d;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s;
}

.back-btn:hover, .magic-btn:hover {
  background: #fdf2f8;
}

.magic-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.magic-btn .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

h2 {
  font-size: 18px;
  color: #5a5a7a;
  margin: 0;
}

/* 日历部分 */
.calendar-section {
  background: white;
  margin: 8px;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.nav-btn {
  background: none;
  border: none;
  font-size: 14px;
  color: #ff6b9d;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.3s;
}

.nav-btn:hover {
  background: #fdf2f8;
}

.calendar-header h3 {
  font-size: 13px;
  color: #5a5a7a;
  margin: 0;
  font-weight: 600;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.calendar-weekday {
  text-align: center;
  font-size: 9px;
  color: #999;
  padding: 4px 0;
  font-weight: 500;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  font-size: 11px;
  color: #333;
}

.calendar-day:hover {
  background: #fdf2f8;
}

.calendar-day.other-month {
  color: #ccc;
}

.calendar-day.today {
  background: linear-gradient(135deg, #ff8fb3, #ffb6c1);
  color: white;
  font-weight: bold;
  border: 2px solid #ff6b9d;
}

.calendar-day.has-schedule {
  border: 2px solid #ff6b9d;
}

.calendar-day.selected {
  background: linear-gradient(135deg, #ff6b9d, #ff8fb3);
  color: white;
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.4);
}

.schedule-dots {
  display: flex;
  gap: 1px;
  margin-top: 2px;
}

.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ff6b9d;
}

.calendar-day.today .dot,
.calendar-day.selected .dot {
  background: white;
}

/* 日程详情 */
.schedule-details {
  background: white;
  margin: 0 8px 8px;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  min-height: 150px;
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.details-header h3 {
  font-size: 13px;
  color: #5a5a7a;
  margin: 0;
  font-weight: 600;
}

.add-btn {
  background: #ff6b9d;
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.add-btn:hover {
  background: #ff8fb3;
  transform: scale(1.1);
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schedule-item {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #ff6b9d;
  transition: all 0.3s;
}

.schedule-item:hover {
  background: #fdf2f8;
  transform: translateX(4px);
}

.schedule-item.type-work {
  border-left-color: #4a90e2;
}

.schedule-item.type-romantic {
  border-left-color: #ff6b9d;
}

.schedule-item.type-special {
  border-left-color: #f5a623;
}

.schedule-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: #666;
  font-size: 10px;
  min-width: 40px;
}

.schedule-time i {
  font-size: 12px;
  color: #ff6b9d;
}

.schedule-content {
  flex: 1;
}

.schedule-content h4 {
  font-size: 12px;
  color: #333;
  margin: 0 0 3px;
  font-weight: 600;
}

.schedule-content p {
  font-size: 10px;
  color: #666;
  margin: 0 0 4px;
  line-height: 1.3;
}

.schedule-meta {
  display: flex;
  gap: 6px;
  font-size: 9px;
  color: #999;
}

.location {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mood-tag {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  background: #e0e0e0;
}

.mood-tag.happy {
  background: #d4edda;
  color: #155724;
}

.mood-tag.busy {
  background: #fff3cd;
  color: #856404;
}

.mood-tag.romantic {
  background: #f8d7da;
  color: #721c24;
}

.schedule-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s;
  font-size: 10px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #e0e0e0;
  color: #666;
}

.action-btn.delete:hover {
  background: #f8d7da;
  color: #dc3545;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-state i {
  font-size: 60px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0 0 20px;
  font-size: 14px;
}

.add-schedule-btn {
  background: #ff6b9d;
  border: none;
  color: white;
  padding: 12px 24px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.add-schedule-btn:hover {
  background: #ff8fb3;
  transform: scale(1.05);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #5a5a7a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: all 0.3s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: #ff6b9d;
  outline: none;
  box-shadow: 0 0 0 3px rgba(255,107,157,0.1);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #eee;
}

.cancel-btn,
.save-btn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.cancel-btn {
  background: #f0f0f0;
  border: none;
  color: #666;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.save-btn {
  background: #ff6b9d;
  border: none;
  color: white;
}

.save-btn:hover {
  background: #ff8fb3;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .header {
    padding: 10px 12px;
  }
  
  .header h2 {
    font-size: 15px;
  }
  
  .calendar-section {
    margin: 6px;
    padding: 8px;
  }
  
  .calendar-header {
    margin-bottom: 4px;
  }
  
  .calendar-header h3 {
    font-size: 12px;
  }
  
  .nav-btn {
    padding: 2px 6px;
    font-size: 12px;
  }
  
  .calendar-grid {
    gap: 0;
  }
  
  .calendar-weekday {
    font-size: 8px;
    padding: 2px 0;
  }
  
  .calendar-day {
    font-size: 10px;
    border-radius: 4px;
  }
  
  .day-number {
    font-size: 10px;
  }
  
  .schedule-dots {
    gap: 0;
    margin-top: 1px;
  }
  
  .dot {
    width: 2px;
    height: 2px;
  }
  
  .schedule-details {
    margin: 0 6px 6px;
    padding: 8px;
    min-height: 120px;
  }
  
  .details-header h3 {
    font-size: 12px;
  }
  
  .add-btn {
    width: 24px;
    height: 24px;
  }
  
  .schedule-list {
    gap: 4px;
  }
  
  .schedule-item {
    padding: 8px;
    gap: 6px;
  }
  
  .schedule-time {
    min-width: 35px;
    font-size: 9px;
  }
  
  .schedule-time i {
    font-size: 10px;
  }
  
  .schedule-content h4 {
    font-size: 11px;
  }
  
  .schedule-content p {
    font-size: 9px;
    margin: 0 0 2px;
  }
  
  .schedule-meta {
    font-size: 8px;
    gap: 4px;
  }
  
  .action-btn {
    width: 20px;
    height: 20px;
    font-size: 9px;
  }
}
</style>
