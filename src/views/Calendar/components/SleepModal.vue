<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>😴 睡眠记录</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="sleep-emoji">😴 🛏️ 💤</div>
        
        <div class="form-row">
          <div class="form-group">
            <label>入睡时间</label>
            <input v-model="form.bedTime" type="datetime-local" />
          </div>
          <div class="form-group">
            <label>醒来时间</label>
            <input v-model="form.wakeTime" type="datetime-local" />
          </div>
        </div>
        
        <div class="sleep-duration" v-if="duration">
          <span class="duration-value">{{ duration }}</span>
          <span class="duration-label">小时睡眠</span>
        </div>
        
        <div class="form-group">
          <label>睡眠质量</label>
          <div class="quality-options">
            <button
              v-for="q in qualities"
              :key="q.value"
              class="quality-btn"
              :class="{ active: form.quality === q.value }"
              @click="form.quality = q.value"
            >
              <span class="quality-emoji">{{ q.emoji }}</span>
              <span class="quality-label">{{ q.label }}</span>
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>睡眠标签 (多选)</label>
          <div class="sleep-tags">
            <button
              v-for="tag in sleepTags"
              :key="tag"
              class="tag-btn"
              :class="{ active: form.tags.includes(tag) }"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>梦境记录 / 备注</label>
          <textarea v-model="form.note" rows="2" placeholder="昨晚做了什么梦？睡眠质量如何？" />
        </div>
        
        <div class="sleep-tips" v-if="durationNum < 6">
          <span class="tip-icon">⚠️</span>
          <span>睡眠时间较少，建议今晚早点休息哦～</span>
        </div>
        
        <div class="sleep-tips good" v-if="durationNum >= 7 && durationNum <= 9">
          <span class="tip-icon">✨</span>
          <span>完美睡眠时长！继续保持～</span>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button class="btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  date: String
})

const emit = defineEmits(['close', 'save'])

const qualities = [
  { value: 'poor', label: '很差', emoji: '😫' },
  { value: 'fair', label: '一般', emoji: '😐' },
  { value: 'good', label: '良好', emoji: '😊' },
  { value: 'excellent', label: '完美', emoji: '🤩' }
]

const sleepTags = [
  '快速入睡', '多梦', '起夜', '打鼾', '噩梦',
  '自然醒', '闹钟叫醒', '午睡', '熬夜', '规律作息'
]

const now = new Date()
const defaultWake = new Date(now)
defaultWake.setHours(7, 0, 0, 0)
const defaultBed = new Date(defaultWake)
defaultBed.setHours(23, 0, 0, 0)
defaultBed.setDate(defaultBed.getDate() - 1)

const form = ref({
  bedTime: defaultBed.toISOString().slice(0, 16),
  wakeTime: defaultWake.toISOString().slice(0, 16),
  quality: 'good',
  tags: [],
  note: ''
})

const durationNum = computed(() => {
  const bed = new Date(form.value.bedTime)
  const wake = new Date(form.value.wakeTime)
  let hours = (wake - bed) / 3600000
  if (hours < 0) hours += 24
  return hours
})

const duration = computed(() => {
  const hours = durationNum.value
  const whole = Math.floor(hours)
  const frac = Math.round((hours - whole) * 60)
  return `${whole}小时${frac}分钟`
})

function toggleTag(tag) {
  const idx = form.value.tags.indexOf(tag)
  if (idx > -1) {
    form.value.tags.splice(idx, 1)
  } else {
    form.value.tags.push(tag)
  }
}

function close() {
  emit('close')
}

function save() {
  emit('save', {
    bedTime: form.value.bedTime,
    wakeTime: form.value.wakeTime,
    quality: form.value.quality,
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
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.3), rgba(255, 183, 197, 0.2));
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

.sleep-emoji {
  text-align: center;
  font-size: 32px;
  margin-bottom: 20px;
  letter-spacing: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5a5a7a;
  margin-bottom: 6px;
}

.form-group input[type="datetime-local"],
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  font-size: 13px;
  color: #5a5a7a;
  background: rgba(255, 255, 255, 0.8);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #c5c9ff;
  box-shadow: 0 0 0 3px rgba(197, 201, 255, 0.2);
}

.sleep-duration {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.2), rgba(255, 183, 197, 0.2));
  border-radius: 14px;
  margin-bottom: 16px;
}

.duration-value {
  font-size: 32px;
  font-weight: 700;
  color: #8b7aa8;
  line-height: 1.2;
}

.duration-label {
  font-size: 13px;
  color: #9a8fb8;
  margin-top: 4px;
}

.quality-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.quality-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.quality-btn:hover {
  border-color: #c5c9ff;
}

.quality-btn.active {
  border-color: #c5c9ff;
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.3), rgba(255, 183, 197, 0.2));
}

.quality-emoji {
  font-size: 24px;
  line-height: 1;
}

.quality-label {
  font-size: 11px;
  color: #5a5a7a;
}

.sleep-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-btn {
  padding: 6px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 16px;
  background: white;
  font-size: 12px;
  color: #5a5a7a;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tag-btn:hover {
  border-color: #c5c9ff;
}

.tag-btn.active {
  border-color: #c5c9ff;
  background: linear-gradient(135deg, #c5c9ff, #e6e6fa);
  color: white;
}

.sleep-tips {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(255, 200, 100, 0.2);
  border-radius: 10px;
  font-size: 13px;
  color: #c98a2f;
}

.sleep-tips.good {
  background: rgba(127, 176, 105, 0.2);
  color: #5a9a4a;
}

.tip-icon {
  font-size: 16px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(139, 122, 168, 0.1);
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 10px 24px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #c5c9ff, #e6e6fa);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(197, 201, 255, 0.4);
}

.btn-secondary {
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
}

.btn-secondary:hover {
  background: rgba(139, 122, 168, 0.2);
}
</style>
