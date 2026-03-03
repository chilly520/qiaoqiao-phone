<template>
  <div v-if="show" class="dice-modal fixed inset-0 z-[200] flex items-center justify-center" @click.self="close">
    <!-- 背景模糊效果 -->
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"></div>

    <div
      class="relative bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 rounded-3xl p-1 w-[320px] max-w-[90vw] shadow-2xl animate-bounce-in overflow-hidden border-2 border-white/50">
      <!-- 装饰性背景图案 -->
      <div class="absolute inset-0 opacity-30">
        <div class="absolute top-4 left-4 w-8 h-8 bg-purple-300 rounded-full blur-xl"></div>
        <div class="absolute top-12 right-8 w-6 h-6 bg-pink-300 rounded-full blur-lg"></div>
        <div class="absolute bottom-8 left-12 w-10 h-10 bg-blue-300 rounded-full blur-2xl"></div>
        <div class="absolute bottom-4 right-4 w-7 h-7 bg-purple-200 rounded-full blur-lg"></div>
      </div>

      <!-- 内部白色区域 -->
      <div class="relative bg-white/90 backdrop-blur-sm rounded-2xl p-5">
        <!-- 头部 -->
        <div class="text-center mb-4">
          <div
            class="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full shadow-lg mb-2 animate-float">
            <span class="text-3xl">🎲</span>
          </div>
          <h3 class="text-lg font-bold text-gray-800">摇骰子</h3>
          <p class="text-xs text-gray-500 mt-1">试试你的运气吧~</p>
        </div>

        <!-- 骰子展示区域 -->
        <div class="relative mb-5">
          <!-- 可爱容器 -->
          <div
            class="relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 shadow-inner border-2 border-purple-200/50">
            <!-- 装饰星星 -->
            <div class="absolute top-2 left-2 text-yellow-400 text-xs animate-twinkle">✨</div>
            <div class="absolute top-3 right-3 text-purple-400 text-xs animate-twinkle" style="animation-delay: 0.5s">⭐
            </div>
            <div class="absolute bottom-2 left-4 text-pink-400 text-xs animate-twinkle" style="animation-delay: 1s">✨
            </div>

            <!-- 骰子动画区域 -->
            <div class="relative h-32 flex items-center justify-center">
              <!-- 滚动中的骰子 -->
              <template v-if="isRolling">
                <div v-for="i in selectedCount" :key="i" class="dice-rolling absolute" :style="getDicePosition(i)">
                  <div
                    class="w-12 h-12 bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg flex items-center justify-center dice-shake border-2 border-purple-200">
                    <span class="text-2xl">🎲</span>
                  </div>
                </div>
              </template>

              <!-- 静止的骰子结果 -->
              <template v-else-if="finalResults.length > 0">
                <div class="flex items-center justify-center gap-3">
                  <div v-for="(result, idx) in finalResults" :key="idx"
                    class="dice-result w-14 h-14 bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg flex items-center justify-center border-2 border-purple-200"
                    :style="{ animationDelay: (idx * 0.1) + 's' }">
                    <i class="fa-solid text-purple-600 drop-shadow-sm text-4xl"
                      :class="'fa-dice-' + ['one', 'two', 'three', 'four', 'five', 'six'][result - 1]">
                    </i>
                  </div>
                </div>
              </template>

              <!-- 空状态提示 -->
              <template v-else>
                <div class="text-center">
                  <span class="text-5xl opacity-40 animate-bounce">🎲</span>
                  <p class="text-sm text-gray-400 mt-2">点击开始摇动~</p>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 骰子数量选择 -->
        <div v-if="!isRolling && finalResults.length === 0" class="flex justify-center gap-2 mb-4">
          <button v-for="count in [1, 2, 3]" :key="count" @click="selectedCount = count"
            class="relative px-3 py-2 rounded-xl border-2 transition-all duration-200 flex items-center justify-center"
            :class="selectedCount === count
              ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 text-purple-600 shadow-md scale-105'
              : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50'">
            <span class="text-lg font-bold">{{ count }}</span>
            <span class="text-xs ml-1">颗</span>
            <div v-if="selectedCount === count"
              class="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 rounded-full flex items-center justify-center">
              <i class="fa-solid fa-check text-white text-xs"></i>
            </div>
          </button>
        </div>

        <!-- 结果展示（摇完后） -->
        <div v-if="finalResults.length > 0 && !isRolling" class="mb-4 text-center">
          <div
            class="inline-flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-2 rounded-full border border-purple-100">
            <span class="text-sm text-gray-600">合计</span>
            <span class="text-3xl font-bold text-purple-600">{{ finalTotal }}</span>
            <span class="text-sm text-gray-600">点</span>
            <span v-if="isJackpot"
              class="ml-1 text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">豹子!</span>
            <span v-else-if="isBigWin"
              class="ml-1 text-xs bg-gradient-to-r from-purple-400 to-pink-400 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">大吉!</span>
            <span v-else-if="total <= selectedCount * 2"
              class="ml-1 text-xs bg-gradient-to-r from-blue-400 to-blue-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">加油!</span>
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="flex gap-3">
          <button @click="close"
            class="flex-1 py-2.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-all active:scale-95">
            取消
          </button>

          <!-- 开始/重摇按钮 -->
          <button v-if="finalResults.length === 0" @click="startRoll" :disabled="isRolling"
            class="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-purple-400 to-pink-400 text-white font-medium shadow-lg shadow-purple-200 transition-all active:scale-95 disabled:opacity-70">
            <span v-if="isRolling">
              <i class="fa-solid fa-spinner fa-spin mr-1"></i>摇动中...
            </span>
            <span v-else>
              <i class="fa-solid fa-dice mr-1"></i>开始
            </span>
          </button>

          <!-- 摇完后显示发送和重摇 -->
          <template v-else>
            <button @click="reRoll"
              class="flex-1 py-2.5 rounded-2xl border-2 border-purple-300 text-purple-500 font-medium hover:bg-purple-50 transition-all active:scale-95">
              <i class="fa-solid fa-rotate-right mr-1"></i>重摇
            </button>
            <button @click="sendResult"
              class="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-400 text-white font-medium shadow-lg shadow-green-200 transition-all active:scale-95">
              <i class="fa-solid fa-paper-plane mr-1"></i>发送
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'roll'])

const selectedCount = ref(1)
const isRolling = ref(false)
const finalResults = ref([])
const finalTotal = ref(0)



const isBigWin = computed(() => finalTotal.value >= selectedCount.value * 6 * 0.8)
const isJackpot = computed(() => {
  if (finalResults.value.length === 0) return false
  const first = finalResults.value[0]
  return finalResults.value.every(r => r === first)
})

// 骰子位置（可爱分布）
const getDicePosition = (index) => {
  const positions = [
    { left: '30%', top: '35%', transform: 'rotate(-10deg)' },
    { left: '45%', top: '40%', transform: 'rotate(5deg)' },
    { left: '60%', top: '35%', transform: 'rotate(-5deg)' }
  ]
  return positions[index - 1] || positions[0]
}

// 播放掷骰子音效
const playDiceSound = () => {
  try {
    const audio = new Audio('/sounds/mahjong/掷骰子.MP3')
    audio.volume = 0.6
    audio.play().catch(e => {
      console.log('音效播放失败:', e)
    })
  } catch (e) {
    console.log('音效加载失败:', e)
  }
}

// Reset when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    selectedCount.value = 1
    isRolling.value = false
    finalResults.value = []
    finalTotal.value = 0
  }
})

const close = () => {
  emit('close')
}

const startRoll = () => {
  isRolling.value = true
  finalResults.value = []

  // 播放掷骰子音效
  playDiceSound()

  // Rolling animation duration
  setTimeout(() => {
    const results = []
    for (let i = 0; i < selectedCount.value; i++) {
      results.push(Math.floor(Math.random() * 6) + 1)
    }

    finalResults.value = results
    finalTotal.value = results.reduce((sum, val) => sum + val, 0)
    isRolling.value = false
  }, 2000)
}

const reRoll = () => {
  finalResults.value = []
  finalTotal.value = 0
  startRoll()
}

const sendResult = () => {
  emit('roll', selectedCount.value, finalResults.value, finalTotal.value)
  close()
}
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.8) translateY(30px);
  }

  50% {
    transform: scale(1.02) translateY(-5px);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-8px) rotate(5deg);
  }
}

@keyframes twinkle {

  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 可爱的骰子滚动动画 */
@keyframes cute-shake {

  0%,
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }

  10% {
    transform: translate(-6px, -4px) rotate(-12deg) scale(0.95);
  }

  20% {
    transform: translate(6px, 4px) rotate(12deg) scale(1.05);
  }

  30% {
    transform: translate(-4px, 6px) rotate(-8deg) scale(0.98);
  }

  40% {
    transform: translate(4px, -6px) rotate(8deg) scale(1.02);
  }

  50% {
    transform: translate(-8px, -2px) rotate(-15deg) scale(0.95);
  }

  60% {
    transform: translate(8px, 2px) rotate(15deg) scale(1.05);
  }

  70% {
    transform: translate(-2px, 8px) rotate(-5deg) scale(1);
  }

  80% {
    transform: translate(2px, -8px) rotate(5deg) scale(0.98);
  }

  90% {
    transform: translate(-4px, -4px) rotate(-8deg) scale(1.02);
  }
}

/* 骰子弹出动画 */
@keyframes cute-pop {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(30px);
  }

  50% {
    transform: scale(1.15) translateY(-10px);
  }

  70% {
    transform: scale(0.95) translateY(5px);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 骰子旋转 */
@keyframes dice-spin-cute {
  0% {
    transform: rotate(0deg) scale(1);
    filter: blur(0px);
  }

  50% {
    transform: rotate(360deg) scale(0.9);
    filter: blur(0.5px);
  }

  100% {
    transform: rotate(720deg) scale(1);
    filter: blur(0px);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-bounce-in {
  animation: bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.animate-float {
  animation: float 2s ease-in-out infinite;
}

.animate-twinkle {
  animation: twinkle 1.5s ease-in-out infinite;
}

.dice-rolling {
  animation: cute-shake 0.2s ease-in-out infinite;
}

.dice-rolling .dice-shake {
  animation: dice-spin-cute 0.4s linear infinite;
}

.dice-result {
  animation: cute-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  opacity: 0;
}
</style>
