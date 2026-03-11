<template>
  <div class="status-bar">
    <div class="left-side">
      <div class="time-bubble">
        <span class="time">{{ currentTime }}</span>
      </div>
    </div>
    <div class="right-side">
      <div class="status-indicators">
        <i class="fa-solid fa-signal"></i>
        <i class="fa-solid fa-wifi"></i>
        <div class="battery-wrapper">
          <div class="battery-icon" :class="{ charging: batteryCharging }">
            <div class="battery-level" :style="{ width: batteryLevel + '%' }"></div>
            <div class="battery-sparkle"></div>
          </div>
          <span class="battery-percent" :class="{ 'charging-text': batteryCharging }">{{ batteryLevel }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { batteryMonitor } from '@/utils/batteryMonitor'

const currentTime = ref('')
const batteryLevel = ref(100)
const batteryCharging = ref(false)

function updateTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

onMounted(async () => {
  updateTime()
  const timer = setInterval(updateTime, 1000)
  
  // 初始化电池监控
  const initialized = await batteryMonitor.init()
  if (initialized) {
    const info = batteryMonitor.getBatteryInfo()
    batteryLevel.value = info.level
    batteryCharging.value = info.charging
    
    // 监听电池状态变化
    batteryMonitor.onChange((info) => {
      batteryLevel.value = info.level
      batteryCharging.value = info.charging
    })
  }
  
  onUnmounted(() => {
    clearInterval(timer)
    batteryMonitor.destroy()
  })
})
</script>

<style scoped>
.status-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: #5a5a7a;
  z-index: 1000;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.left-side,
.right-side {
  pointer-events: auto;
}

.time-bubble {
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 12px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.time {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #5a5a7a;
}

.right-side .status-indicators {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 10px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.right-side .status-indicators i {
  color: #5a5a7a;
  font-size: 12px;
}

.battery-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.battery-icon {
  width: 24px;
  height: 12px;
  background: #e0e0e0;
  border-radius: 3px;
  padding: 2px;
  position: relative;
  overflow: hidden;
  border: 1px solid #ccc;
}

.battery-icon::after {
  content: '';
  position: absolute;
  right: -2px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 6px;
  background: #ccc;
  border-radius: 0 2px 2px 0;
}

.battery-icon.charging::after {
  background: #10b981;
}

.battery-level {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  border-radius: 1px;
  transition: width 0.3s ease;
}

.battery-icon.charging .battery-level {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.battery-percent {
  font-size: 12px;
  font-weight: 700;
  color: #10b981;
}

.battery-percent.charging-text {
  color: #10b981;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.battery-sparkle {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  30% {
    left: 100%;
  }
  100% {
    left: 100%;
  }
}
</style>
