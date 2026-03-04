<template>
  <div class="muttering-bubble">
    <transition-group name="mutter-list">
      <div 
        v-for="(mutter, index) in queue.slice(0, 3)" 
        :key="mutter.timestamp"
        class="mutter-item"
        :style="{ 
          opacity: 1 - (index * 0.3)
        }"
      >
        <div class="avatar">
          <img :src="charAvatar" :alt="charName" />
        </div>
        <div class="bubble">
          {{ mutter.text }}
          <div class="arrow"></div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
const props = defineProps({
  queue: {
    type: Array,
    default: () => []
  },
  charAvatar: String
})

const charName = 'Char'
</script>

<style scoped>
.muttering-bubble {
  position: fixed;
  bottom: 140px;
  left: 20px;
  right: 20px;
  z-index: 99;
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
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.arrow {
  position: absolute;
  bottom: 6px;
  left: -6px;
  width: 12px;
  height: 12px;
  background: inherit;
  transform: rotate(45deg);
  clip-path: polygon(0 0, 50% 50%, 100% 0);
}

@keyframes bubblePop {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.mutter-list-enter-active,
.mutter-list-leave-active {
  transition: all 0.5s ease;
}

.mutter-list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.mutter-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
