<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>⚙️ 经期周期设置</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="info-card">
          <div class="info-icon">🌙</div>
          <div class="info-text">
            <div class="info-title">个性化经期追踪</div>
            <div class="info-desc">设置符合你生理周期的参数，让预测更准确</div>
          </div>
        </div>

        <div class="form-group">
          <label>
            <span class="label-text">📏 周期长度（间隔天数）</span>
            <span class="label-value">{{ localCycle }} 天</span>
          </label>
          <div class="slider-container">
            <input v-model.number="localCycle" type="range" min="20" max="45" step="1" class="custom-slider" />
            <div class="slider-labels">
              <span>20</span>
              <span>35</span>
              <span>45</span>
            </div>
          </div>
          <p class="help-text">
            <span class="emoji">📊</span> 
            平均周期为 {{ localCycle }} 天，
            <span v-if="localCycle < 21" class="warning">周期较短，建议关注</span>
            <span v-else-if="localCycle > 35" class="warning">周期较长，建议关注</span>
            <span v-else class="normal">在正常范围内 (21-35 天)</span>
          </p>
        </div>
        
        <div class="form-group">
          <label>
            <span class="label-text">💧 经期天数</span>
            <span class="label-value">{{ localDuration }} 天</span>
          </label>
          <div class="slider-container">
            <input v-model.number="localDuration" type="range" min="2" max="10" step="1" class="custom-slider" />
            <div class="slider-labels">
              <span>2</span>
              <span>6</span>
              <span>10</span>
            </div>
          </div>
          <p class="help-text">
            <span class="emoji">📊</span> 
            平均经期为 {{ localDuration }} 天，
            <span v-if="localDuration < 3" class="warning">经期较短</span>
            <span v-else-if="localDuration > 7" class="warning">经期较长</span>
            <span v-else class="normal">在正常范围内 (3-7 天)</span>
          </p>
        </div>

        <div class="stats-card">
          <div class="stat-item">
            <div class="stat-icon">📅</div>
            <div class="stat-content">
              <div class="stat-label">已记录周期</div>
              <div class="stat-value">{{ calendarStore.periodData.cycles.length }} 次</div>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon">🔮</div>
            <div class="stat-content">
              <div class="stat-label">预测周期</div>
              <div class="stat-value">{{ calendarStore.periodData.predictions.length }} 个</div>
            </div>
          </div>
        </div>

        <div class="tips-card">
          <div class="tips-title">💡 温馨提示</div>
          <ul class="tips-list">
            <li>• 周期长度：两次经期第一天之间的天数</li>
            <li>• 经期天数：每次经期持续的天数</li>
            <li>• 系统会根据设置自动预测未来经期</li>
            <li>• 可在记录经期时修正实际数据</li>
          </ul>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="resetToDefaults">恢复默认</button>
        <button class="btn-primary" @click="saveSettings">保存设置</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCalendarStore } from '@/stores/calendarStore'

const emit = defineEmits(['close', 'save'])

const calendarStore = useCalendarStore()

const localCycle = ref(28)
const localDuration = ref(5)

onMounted(() => {
  localCycle.value = calendarStore.periodData.averageCycle
  localDuration.value = calendarStore.periodData.averageDuration
})

function close() {
  emit('close')
}

function saveSettings() {
  calendarStore.updatePeriodSettings({
    averageCycle: localCycle.value,
    averageDuration: localDuration.value
  })
  emit('save', {
    averageCycle: localCycle.value,
    averageDuration: localDuration.value
  })
  close()
}

function resetToDefaults() {
  localCycle.value = 28
  localDuration.value = 5
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
  max-width: 480px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
  display: flex;
  flex-direction: column;
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
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.1), rgba(197, 201, 255, 0.1));
  border-radius: 16px;
  margin-bottom: 20px;
  border: 1px solid rgba(139, 122, 168, 0.1);
}

.info-icon {
  font-size: 32px;
}

.info-text {
  flex: 1;
}

.info-title {
  font-size: 15px;
  font-weight: 600;
  color: #5a5a7a;
  margin-bottom: 4px;
}

.info-desc {
  font-size: 13px;
  color: #9a8fb8;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.label-text {
  font-size: 14px;
  font-weight: 500;
  color: #5a5a7a;
}

.label-value {
  font-size: 16px;
  font-weight: 600;
  color: #ff6b9d;
  min-width: 60px;
  text-align: right;
}

.slider-container {
  margin-bottom: 8px;
}

.custom-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(255, 183, 197, 0.3), rgba(197, 201, 255, 0.3));
  outline: none;
  -webkit-appearance: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.3);
  transition: all 0.3s ease;
}

.custom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.4);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #9a8fb8;
  margin-top: 4px;
}

.help-text {
  margin-top: 8px;
  font-size: 12px;
  color: #9a8fb8;
  line-height: 1.6;
}

.help-text .emoji {
  margin-right: 4px;
}

.help-text .warning {
  color: #ff9eb5;
  font-weight: 500;
}

.help-text .normal {
  color: #7dd3a0;
  font-weight: 500;
}

.stats-card {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.1), rgba(197, 201, 255, 0.1));
  border-radius: 16px;
  border: 1px solid rgba(139, 122, 168, 0.1);
}

.stat-icon {
  font-size: 28px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 12px;
  color: #9a8fb8;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
}

.tips-card {
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 228, 196, 0.1), rgba(255, 240, 220, 0.1));
  border-radius: 16px;
  border: 1px solid rgba(255, 183, 197, 0.2);
}

.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
  margin-bottom: 12px;
}

.tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tips-list li {
  font-size: 13px;
  color: #8b7aa8;
  line-height: 1.8;
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
</style>
