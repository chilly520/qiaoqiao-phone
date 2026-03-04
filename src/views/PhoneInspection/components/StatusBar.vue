<template>
  <div class="status-bar">
    <div class="left">
      <span class="time">{{ currentTime }}</span>
    </div>
    <div class="right">
      <i class="fa-solid fa-signal"></i>
      <i class="fa-solid fa-wifi"></i>
      <i class="fa-solid fa-battery-full"></i>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref('')

function updateTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

onMounted(() => {
  updateTime()
  const timer = setInterval(updateTime, 1000)
  onUnmounted(() => clearInterval(timer))
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
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  color: white;
  font-size: 14px;
  z-index: 100;
}

.left {
  font-weight: 600;
}

.right {
  display: flex;
  gap: 6px;
  align-items: center;
}

.right i {
  font-size: 12px;
}
</style>
