<script setup>
import { useCallStore } from '../stores/callStore'
import { computed } from 'vue'

const callStore = useCallStore()

const isActive = computed(() => callStore.status === 'active' || callStore.status === 'dialing')
const statusText = computed(() => {
    if (callStore.status === 'dialing') return '正在呼叫...'
    return `正在通话中 ${callStore.durationText}`
})

const handleExpand = () => {
    window.dispatchEvent(new CustomEvent('expand-call-visualizer'))
}
</script>

<template>
  <div v-if="isActive" class="call-status-bar" @click="handleExpand">
    <div class="status-content">
      <div class="icon-pulse">
        <i class="fa-solid" :class="callStore.type === 'video' ? 'fa-video' : 'fa-phone'"></i>
      </div>
      <span class="status-text">{{ statusText }}</span>
    </div>
    <i class="fa-solid fa-chevron-right arrow-icon"></i>
  </div>
</template>

<style scoped>
.call-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: calc(100% - 24px);
  margin: 10px 12px 0;
  padding: 8px 16px;
  background: #07c160;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 25;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.2);
}

.call-status-bar:active {
  background: #06ad56;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-pulse {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  animation: pulse-icon 2s infinite;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.arrow-icon {
  font-size: 12px;
  opacity: 0.7;
}

@keyframes pulse-icon {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
}

i {
  font-size: 12px;
}
</style>

