<template>
  <div class="status-bar px-6">
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
          <span class="battery-percent">{{ batteryLevel }}%</span>
        </div>
        <!-- Power Off / Exit Button -->
        <button class="exit-btn" @click="handleExit" title="退出查手机">
          <i class="fa-solid fa-power-off"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'
import { batteryMonitor } from '@/utils/batteryMonitor'

const router = useRouter()
const phoneStore = usePhoneInspectionStore()
const currentTime = ref('')
const batteryLevel = ref(100)
const batteryCharging = ref(false)
let timer = null
let cleanupBatteryListener = null

function updateTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

function handleExit() {
  phoneStore.closeInspection()
  router.push({ name: 'search' })
}

onMounted(async () => {
  updateTime()
  timer = setInterval(updateTime, 1000)
  
  // 初始化电池监控
  try {
    const initialized = await batteryMonitor.init()
    if (initialized) {
      const info = batteryMonitor.getBatteryInfo()
      batteryLevel.value = info.level
      batteryCharging.value = info.charging
      
      // 监听电池状态变化
      cleanupBatteryListener = batteryMonitor.onChange((info) => {
        batteryLevel.value = info.level
        batteryCharging.value = info.charging
      })
    }
  } catch (error) {
    console.warn('[StatusBar] Battery monitor init failed:', error)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (cleanupBatteryListener) cleanupBatteryListener()
})
</script>

<style scoped>
.status-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #A66D7A;
  /* Softer brown-pink */
  z-index: 1000;
  pointer-events: auto;
  font-family: 'Outfit', sans-serif;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent);
}

.left-side,
.right-side {
  pointer-events: auto;
}

.time-bubble {
  background: rgba(255, 255, 255, 0.6);
  padding: 2px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(166, 109, 122, 0.1);
}

.time {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.right-side .status-indicators {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.battery-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.6);
  padding: 2px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(166, 109, 122, 0.1);
}

.battery-percent {
  font-size: 11px;
  font-weight: 800;
}

.battery-icon {
  width: 22px;
  height: 12px;
  background: #EEE;
  border-radius: 4px;
  padding: 1.5px;
  position: relative;
  overflow: hidden;
}

.battery-icon.charging {
  background: #E3F2FD;
}

.battery-icon.charging .battery-level {
  background: #4CAF50;
}

.battery-level {
  height: 100%;
  background: #BDECB6;
  /* Mint pastel green */
  border-radius: 2px;
}

.exit-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FFB7CE;
  color: white;
  border-radius: 50%;
  border: 2px solid white;
  cursor: pointer;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-left: 4px;
}

.exit-btn:hover {
  transform: scale(1.1);
}

.exit-btn:active {
  transform: scale(0.9);
}

.battery-sparkle {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
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
