<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>🌙 记录生理期</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>开始日期</label>
          <input v-model="form.startDate" type="date" />
        </div>
        
        <div class="form-group">
          <label>结束日期</label>
          <input v-model="form.endDate" @input="userModifiedEndDate = true" type="date" />
        </div>
        
        <div class="form-group">
          <label>周期长度: {{ cycleDays }} 天</label>
          <div class="cycle-preview">
            <div class="cycle-bar">
              <div
                v-for="i in cycleDays"
                :key="i"
                class="day-bar"
                :class="{ 'flow-day': i <= 3, 'normal-day': i > 3 }"
              />
            </div>
            <div class="cycle-labels">
              <span>第1天</span>
              <span>第{{ cycleDays }}天</span>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label>症状记录 (多选)</label>
          <div class="symptoms-grid">
            <button
              v-for="symptom in symptoms"
              :key="symptom"
              class="symptom-btn"
              :class="{ active: form.symptoms.includes(symptom) }"
              @click="toggleSymptom(symptom)"
            >
              {{ symptom }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>流量程度</label>
          <div class="flow-level">
            <button
              v-for="level in flowLevels"
              :key="level.value"
              class="level-btn"
              :class="{ active: form.flowLevel === level.value }"
              @click="form.flowLevel = level.value"
            >
              {{ level.emoji }} {{ level.label }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>心情</label>
          <div class="mood-level">
            <button
              v-for="mood in periodMoods"
              :key="mood.value"
              class="mood-btn"
              :class="{ active: form.mood === mood.value }"
              @click="form.mood = mood.value"
            >
              {{ mood.emoji }} {{ mood.label }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>备注</label>
          <textarea v-model="form.note" rows="2" placeholder="添加备注..." />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button class="btn-settings" @click="showSettings = true">⚙️ 周期设置</button>
        <button class="btn-primary" @click="save">保存记录</button>
      </div>
    </div>

    <!-- 周期设置弹窗 -->
    <div v-if="showSettings" class="modal-overlay" @click.self="showSettings = false">
      <div class="modal-container">
        <div class="modal-header">
          <h3>⚙️ 经期周期设置</h3>
          <button class="close-btn" @click="showSettings = false">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>周期长度（间隔天数）</label>
            <div class="number-input-group">
              <button @click="decrementCycle">-</button>
              <input v-model.number="localCycle" type="number" min="20" max="45" />
              <button @click="incrementCycle">+</button>
            </div>
            <p class="help-text">两次经期第一天之间的天数，通常为 21-35 天</p>
          </div>
          
          <div class="form-group">
            <label>经期天数</label>
            <div class="number-input-group">
              <button @click="decrementDuration">-</button>
              <input v-model.number="localDuration" type="number" min="2" max="10" />
              <button @click="incrementDuration">+</button>
            </div>
            <p class="help-text">每次经期持续的天数，通常为 3-7 天</p>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" @click="showSettings = false">取消</button>
          <button class="btn-primary" @click="saveSettings">保存设置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useCalendarStore } from '@/stores/calendarStore'

const props = defineProps({
  date: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close', 'save'])

const calendarStore = useCalendarStore()

const symptoms = [
  '痛经', '腰酸', '乳房胀痛', '头痛', '疲劳',
  '情绪波动', '食欲增加', '失眠', '痘痘', '腹胀'
]

const flowLevels = [
  { value: 'light', label: '少量', emoji: '💧' },
  { value: 'medium', label: '中等', emoji: '💧💧' },
  { value: 'heavy', label: '大量', emoji: '💧💧' }
]

const periodMoods = [
  { value: 'calm', label: '平静', emoji: '😌' },
  { value: 'irritable', label: '易怒', emoji: '😤' },
  { value: 'sad', label: '低落', emoji: '😢' },
  { value: 'tired', label: '疲惫', emoji: '😴' },
  { value: 'anxious', label: '焦虑', emoji: '😰' }
]

const form = ref({
  startDate: props.date,
  endDate: '',
  symptoms: [],
  flowLevel: 'medium',
  mood: 'calm',
  note: ''
})

// 当 startDate 变化时，自动更新 endDate（仅在用户未修改过时）
const userModifiedEndDate = ref(false)

watch(() => form.value.startDate, (newStart) => {
  if (!userModifiedEndDate.value) {
    const start = new Date(newStart)
    const end = new Date(start)
    end.setDate(start.getDate() + 4)
    form.value.endDate = end.toISOString().split('T')[0]
  }
}, { immediate: true })

// 初始化 endDate
if (!form.value.endDate) {
  const start = new Date(form.value.startDate)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  form.value.endDate = end.toISOString().split('T')[0]
}

const showSettings = ref(false)
const localCycle = ref(28)
const localDuration = ref(5)

// 加载当前设置
onMounted(() => {
  localCycle.value = calendarStore.periodData.averageCycle
  localDuration.value = calendarStore.periodData.averageDuration
})

const cycleDays = computed(() => {
  if (!form.value.startDate || !form.value.endDate) return 0
  const start = new Date(form.value.startDate)
  const end = new Date(form.value.endDate)
  return Math.max(1, Math.floor((end - start) / 86400000) + 1)
})

function toggleSymptom(symptom) {
  const idx = form.value.symptoms.indexOf(symptom)
  if (idx > -1) {
    form.value.symptoms.splice(idx, 1)
  } else {
    form.value.symptoms.push(symptom)
  }
}

function incrementCycle() {
  if (localCycle.value < 45) localCycle.value++
}

function decrementCycle() {
  if (localCycle.value > 20) localCycle.value--
}

function incrementDuration() {
  if (localDuration.value < 10) localDuration.value++
}

function decrementDuration() {
  if (localDuration.value > 2) localDuration.value--
}

function saveSettings() {
  calendarStore.updatePeriodSettings({
    averageCycle: localCycle.value,
    averageDuration: localDuration.value
  })
  showSettings.value = false
}

function close() {
  emit('close')
}

function save() {
  emit('save', {
    startDate: form.value.startDate,
    endDate: form.value.endDate,
    symptoms: form.value.symptoms,
    flowLevel: form.value.flowLevel,
    mood: form.value.mood,
    note: form.value.note
  })
}
</script>

<style scoped>
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
  width: 90%;
  max-width: 420px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.2), rgba(197, 201, 255, 0.2));
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 107, 157, 0.2);
  color: #ff6b9d;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  max-height: calc(85vh - 140px);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5a5a7a;
  margin-bottom: 8px;
}

.form-group input[type="date"],
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  font-size: 14px;
  color: #5a5a7a;
  background: rgba(255, 255, 255, 0.8);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #ffb7c5;
  box-shadow: 0 0 0 3px rgba(255, 183, 197, 0.2);
}

.cycle-preview {
  margin-top: 8px;
}

.cycle-bar {
  display: flex;
  gap: 2px;
  height: 24px;
  margin-bottom: 6px;
}

.day-bar {
  flex: 1;
  border-radius: 4px;
  background: rgba(139, 122, 168, 0.1);
}

.day-bar.flow-day {
  background: linear-gradient(135deg, #ffb7c5, #ff9eb5);
}

.day-bar.normal-day {
  background: linear-gradient(135deg, #ffd8a8, #ffe4c4);
}

.cycle-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #9a8fb8;
}

.symptoms-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.symptom-btn {
  padding: 8px 4px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 8px;
  background: white;
  font-size: 12px;
  color: #5a5a7a;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.symptom-btn:hover {
  border-color: #ffb7c5;
}

.symptom-btn.active {
  border-color: #ff9eb5;
  background: linear-gradient(135deg, rgba(255, 158, 181, 0.2), rgba(255, 218, 224, 0.3));
  color: #ff6b9d;
}

.flow-level,
.mood-level {
  display: flex;
  gap: 8px;
}

.level-btn,
.mood-btn {
  flex: 1;
  padding: 10px 8px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 10px;
  background: white;
  font-size: 12px;
  color: #5a5a7a;
  cursor: pointer;
  transition: all 0.3s ease;
}

.level-btn:hover,
.mood-btn:hover {
  border-color: #ffb7c5;
}

.level-btn.active,
.mood-btn.active {
  border-color: #ff9eb5;
  background: linear-gradient(135deg, rgba(255, 158, 181, 0.2), rgba(197, 201, 255, 0.2));
  color: #ff6b9d;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 12px 24px;
  border-top: 1px solid rgba(139, 122, 168, 0.1);
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 8px 20px;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-settings {
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid rgba(139, 122, 168, 0.3);
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-settings:hover {
  background: rgba(139, 122, 168, 0.2);
  border-color: #8b7aa8;
}

.btn-primary {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255, 183, 197, 0.4);
}

.btn-secondary {
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
}

.btn-secondary:hover {
  background: rgba(139, 122, 168, 0.2);
}

.number-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.number-input-group button {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(139, 122, 168, 0.3);
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.number-input-group button:hover {
  background: rgba(139, 122, 168, 0.2);
  border-color: #8b7aa8;
  transform: scale(1.05);
}

.number-input-group input {
  flex: 1;
  text-align: center;
  padding: 10px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
  background: rgba(255, 255, 255, 0.8);
}

.number-input-group input:focus {
  outline: none;
  border-color: #ffb7c5;
  box-shadow: 0 0 0 3px rgba(255, 183, 197, 0.2);
}

.help-text {
  margin-top: 8px;
  font-size: 12px;
  color: #9a8fb8;
  line-height: 1.5;
}
</style>
