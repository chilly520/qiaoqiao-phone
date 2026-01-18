<script setup>
import { useCallStore } from '../stores/callStore'
import { computed } from 'vue'

const callStore = useCallStore()

const isIncoming = computed(() => callStore.status === 'incoming')
const partner = computed(() => callStore.partner)

const handleAccept = () => {
    callStore.acceptCall()
}

const handleReject = () => {
    callStore.rejectCall()
}
</script>

<template>
  <Transition name="slide-down">
    <div v-if="isIncoming" class="call-banner-container">
      <div class="call-banner">
        <div class="banner-content">
          <img :src="partner?.avatar" class="avatar" alt="Partner Avatar">
          <div class="info">
            <div class="name">{{ partner?.name }}</div>
            <div class="status">邀请你进行{{ callStore.type === 'video' ? '视频' : '语音' }}通话...</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-reject" @click="handleReject">
            <i class="fa-solid fa-phone-slash"></i>
          </button>
          <button class="btn btn-accept" @click="handleAccept">
            <i class="fa-solid fa-phone"></i>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.call-banner-container {
  position: fixed;
  top: 10px;
  left: 0;
  right: 0;
  z-index: 30005;
  padding: 0 15px;
  pointer-events: none;
}

.call-banner {
  background: rgba(45, 45, 45, 0.95);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 12px 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
  pointer-events: auto;
  max-width: 500px;
  margin: 0 auto;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
}

.info {
  display: flex;
  flex-direction: column;
}

.name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.status {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.actions {
  display: flex;
  gap: 15px;
}

.btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.btn-reject {
  background: #ff4d4f;
  color: #fff;
}

.btn-accept {
  background: #07c160;
  color: #fff;
}

.btn:active {
  transform: scale(0.9);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>

