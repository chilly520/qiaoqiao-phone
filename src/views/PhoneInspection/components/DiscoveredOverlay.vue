<template>
  <div class="discovered-overlay">
    <div class="scary-bg"></div>
    
    <div class="content">
      <div class="angry-avatar">
        <img :src="charAvatar" />
        <div class="angry-emoji">😠</div>
      </div>
      
      <h2 class="title">被{{ charName }}发现了!</h2>
      <p class="message">
        {{ message }}
      </p>
      
      <div class="countdown">
        <div class="timer">{{ countdown }}</div>
        <div class="label">秒后关闭</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  charName: String,
  charAvatar: String
})

const countdown = ref(3)
const message = '你怎么能这样！我讨厌你！'
let timer = null

onMounted(() => {
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
.discovered-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

.scary-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,59,48,0.3) 0%, rgba(0,0,0,0.9) 100%);
  animation: pulse 1s infinite;
}

.content {
  position: relative;
  text-align: center;
  color: white;
  z-index: 10;
}

.angry-avatar {
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  position: relative;
}

.angry-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4px solid #FF3B30;
  box-shadow: 0 0 40px rgba(255, 59, 48, 0.6);
}

.angry-emoji {
  position: absolute;
  top: -10px;
  right: -10px;
  font-size: 48px;
  animation: bounce 0.5s infinite;
}

.title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
  text-shadow: 0 4px 12px rgba(0,0,0,0.5);
}

.message {
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 32px;
  opacity: 0.9;
}

.countdown {
  margin-top: 20px;
}

.timer {
  font-size: 56px;
  font-weight: 200;
  color: #FF3B30;
  text-shadow: 0 0 20px rgba(255, 59, 48, 0.8);
}

.label {
  font-size: 14px;
  opacity: 0.7;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  50% { transform: translateX(10px); }
  75% { transform: translateX(-10px); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>
