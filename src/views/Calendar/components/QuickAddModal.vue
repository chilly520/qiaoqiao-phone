<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>✨ 快速添加</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="quick-grid">
          <button class="quick-item" @click="select('event')">
            <span class="item-icon">📅</span>
            <span class="item-label">日程</span>
            <span class="item-desc">添加新的日程安排</span>
          </button>
          
          <button class="quick-item" @click="select('period')">
            <span class="item-icon">🌙</span>
            <span class="item-label">记录经期</span>
            <span class="item-desc">记录生理周期</span>
          </button>
          
          <button class="quick-item" @click="select('mood')">
            <span class="item-icon">😊</span>
            <span class="item-label">记录心情</span>
            <span class="item-desc">记录今天的心情</span>
          </button>
          
          <button class="quick-item" @click="select('countdown')">
            <span class="item-icon">⏰</span>
            <span class="item-label">倒计时</span>
            <span class="item-desc">创建纪念日提醒</span>
          </button>
          
          <button class="quick-item" @click="select('diary')">
            <span class="item-icon">📝</span>
            <span class="item-label">写日记</span>
            <span class="item-desc">记录今日点滴</span>
          </button>
          
          <button class="quick-item" @click="select('sleep')">
            <span class="item-icon">😴</span>
            <span class="item-label">睡眠记录</span>
            <span class="item-desc">记录昨晚睡眠</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['close', 'add'])

function close() {
  emit('close')
}

function select(type) {
  emit('add', type)
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
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 360px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.modal-header h3 {
  font-size: 17px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 107, 157, 0.2);
  color: #ff6b9d;
}

.modal-body {
  padding: 16px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s ease;
}

.quick-item:hover {
  background: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.15);
}

.item-icon {
  font-size: 28px;
  line-height: 1;
  margin-bottom: 4px;
}

.item-label {
  font-size: 14px;
  font-weight: 500;
  color: #5a5a7a;
}

.item-desc {
  font-size: 11px;
  color: #9a8fb8;
  text-align: center;
}
</style>
