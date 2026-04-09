<template>
  <div class="muttering-bubble">
    <TransitionGroup name="mutter">
      <div v-for="mutter in mutteringList" :key="mutter.id" class="mutter-item">
        <div class="avatar">
          <img :src="charAvatar" />
        </div>
        <div class="bubble">
          {{ mutter.text }}
          <div class="tip">想对你说...</div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'

const phoneStore = usePhoneInspectionStore()
const mutteringList = computed(() => phoneStore.mutteringList)
const charAvatar = computed(() => phoneStore.currentChar?.avatar || '')
</script>

<style scoped>
.muttering-bubble {
  position: fixed;
  /* top: 100px; Moved to bottom to avoid blocking top headers */
  bottom: 120px;
  left: 20px;
  right: 20px;
  z-index: 2000;
  pointer-events: none;
}

.mutter-item {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 12px;
  pointer-events: auto;
}

.avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.bubble {
  position: relative;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: 12px 16px;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  font-size: 14px;
  line-height: 1.5;
  color: #1D1D1F;
  max-width: calc(100% - 60px);
  animation: bubblePop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.tip {
  font-size: 10px;
  color: #FD70A1;
  font-weight: bold;
  margin-top: 4px;
  opacity: 0.6;
}

.bubble::before {
  content: '';
  position: absolute;
  left: -8px;
  bottom: 12px;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 8px solid rgba(255, 255, 255, 0.95);
}

/* Transitions */
.mutter-enter-active {
  animation: mutterIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.mutter-leave-active {
  animation: mutterOut 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes mutterIn {
  from { opacity: 0; transform: translateX(-20px) scale(0.9); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}

@keyframes mutterOut {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.9); }
}

@keyframes bubblePop {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
