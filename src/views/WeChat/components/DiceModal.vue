<template>
  <div v-if="visible" class="dice-modal-overlay" @click="handleOverlayClick">
    <div class="dice-modal-content" @click.stop>
      <!-- 选择骰子数量 -->
      <div v-if="!isRolling && !showResult" class="dice-selector">
        <h3>🎲 选择骰子数量</h3>
        <div class="dice-count-options">
          <div 
            v-for="n in 3" 
            :key="n"
            class="dice-count-btn"
            :class="{ active: selectedCount === n }"
            @click="selectedCount = n"
          >
            <span class="count-number">{{ n }}</span>
            <span class="count-label">颗</span>
          </div>
        </div>
        <div class="dice-preview">
          <div v-for="i in selectedCount" :key="i" class="preview-dice">
            <i class="fa-solid fa-dice text-3xl text-[#ff6b6b]"></i>
          </div>
        </div>
        <button class="roll-btn" @click="startRoll">开始摇动</button>
        <button class="cancel-btn" @click="close">取消</button>
      </div>

      <!-- 摇动动画 -->
      <div v-if="isRolling" class="dice-rolling">
        <h3>🎲 摇动中...</h3>
        <div class="rolling-dice-container">
          <div 
            v-for="(dice, index) in rollingDice" 
            :key="index"
            class="rolling-dice"
            :class="{ 'dice-animated': isAnimating }"
            :style="getDiceStyle(index)"
          >
            <div class="dice-face" :class="`dice-${dice.currentFace || 1}`">
              <div class="dice-dots">
                <div v-for="dot in getDots(dice.currentFace || 1)" :key="dot" class="dot" :class="`dot-${dot}`"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="rolling-effect">
          <span v-for="n in 5" :key="n" class="effect-particle">✨</span>
        </div>
      </div>

      <!-- 结果展示 -->
      <div v-if="showResult" class="dice-result">
        <h3>🎉 骰子结果</h3>
        <div class="result-dice-container">
          <div 
            v-for="(result, index) in finalResults" 
            :key="index"
            class="result-dice"
            :class="{ 'dice-bounce': showBounce }"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            <div class="dice-face" :class="`dice-${result}`">
              <div class="dice-dots">
                <div v-for="dot in getDots(result)" :key="dot" class="dot" :class="`dot-${dot}`"></div>
              </div>
            </div>
            <div class="dice-number">{{ result }}</div>
          </div>
        </div>
        <div class="total-sum" v-if="finalResults.length > 1">
          <span class="sum-label">总和</span>
          <span class="sum-value">{{ finalResults.reduce((a, b) => a + b, 0) }}</span>
        </div>
        <button class="send-btn" @click="sendResult">发送结果</button>
        <button class="again-btn" @click="reset">再摇一次</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'send'])

// 骰子数量选择
const selectedCount = ref(1)

// 状态
const isRolling = ref(false)
const isAnimating = ref(false)
const showResult = ref(false)
const showBounce = ref(false)

// 摇动中的骰子
const rollingDice = ref([])

// 最终结果
const finalResults = ref([])

// 获取骰子点数布局
function getDots(n) {
  const layouts = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  }
  return layouts[n] || []
}

// 获取骰子动画样式
function getDiceStyle(index) {
  const rotations = [
    { x: 15, y: -20, z: 10 },
    { x: -10, y: 25, z: -15 },
    { x: 20, y: 10, z: -20 }
  ]
  const r = rotations[index % 3]
  return {
    transform: `rotateX(${r.x}deg) rotateY(${r.y}deg) rotateZ(${r.z}deg)`
  }
}

// 开始摇动
function startRoll() {
  // 初始化骰子
  rollingDice.value = Array(selectedCount.value).fill(0).map(() => ({
    currentFace: 1
  }))
  
  isRolling.value = true
  isAnimating.value = true
  
  // 动画期间快速切换点数
  let rollCount = 0
  const maxRolls = 20
  const interval = setInterval(() => {
    rollingDice.value = rollingDice.value.map(() => ({
      currentFace: Math.floor(Math.random() * 6) + 1
    }))
    rollCount++
    
    if (rollCount >= maxRolls) {
      clearInterval(interval)
      finishRoll()
    }
  }, 100)
}

// 完成摇动
function finishRoll() {
  isAnimating.value = false
  
  // 生成最终结果
  finalResults.value = Array(selectedCount.value).fill(0).map(() => 
    Math.floor(Math.random() * 6) + 1
  )
  
  // 显示结果
  setTimeout(() => {
    isRolling.value = false
    showResult.value = true
    showBounce.value = true
    
    setTimeout(() => {
      showBounce.value = false
    }, 800)
  }, 300)
}

// 发送结果
function sendResult() {
  const diceText = finalResults.value.map((r, i) => `骰子${i + 1}: ${r}点`).join(' ')
  const totalText = finalResults.value.length > 1 ? ` (总和: ${finalResults.value.reduce((a, b) => a + b, 0)})` : ''
  
  emit('send', {
    type: 'dice',
    count: selectedCount.value,
    results: finalResults.value,
    text: `[掷出了 ${selectedCount.value}颗骰子] ${diceText}${totalText}`
  })
  close()
}

// 重置
function reset() {
  showResult.value = false
  finalResults.value = []
  selectedCount.value = 1
}

// 关闭
function close() {
  reset()
  emit('close')
}

// 点击遮罩关闭
function handleOverlayClick() {
  if (!isRolling.value) {
    close()
  }
}
</script>

<style scoped>
.dice-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.dice-modal-content {
  background: white;
  border-radius: 24px;
  padding: 28px;
  width: 90%;
  max-width: 340px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: scaleIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to { 
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 选择骰子数量 */
.dice-selector h3 {
  text-align: center;
  font-size: 18px;
  color: #333;
  margin: 0 0 24px 0;
}

.dice-count-options {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
}

.dice-count-btn {
  width: 70px;
  height: 70px;
  border-radius: 16px;
  border: 2px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f8f8f8;
}

.dice-count-btn.active {
  border-color: #ff6b6b;
  background: linear-gradient(135deg, #fff0f0, #ffe8e8);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.count-number {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.count-label {
  font-size: 12px;
  color: #999;
}

.dice-preview {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 28px;
  min-height: 50px;
}

.preview-dice {
  animation: pulse 1.5s ease infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* 按钮样式 */
.roll-btn, .send-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.roll-btn:active, .send-btn:active {
  transform: scale(0.98);
}

.cancel-btn, .again-btn {
  width: 100%;
  padding: 14px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  background: white;
  color: #666;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel-btn:hover, .again-btn:hover {
  background: #f5f5f5;
}

/* 摇动动画 */
.dice-rolling {
  text-align: center;
}

.dice-rolling h3 {
  font-size: 18px;
  color: #333;
  margin: 0 0 20px 0;
}

.rolling-dice-container {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  min-height: 80px;
}

.rolling-dice {
  width: 60px;
  height: 60px;
  transition: transform 0.1s;
}

.dice-animated {
  animation: diceShake 0.1s ease infinite;
}

@keyframes diceShake {
  0%, 100% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  25% { transform: rotateX(180deg) rotateY(90deg) rotateZ(45deg); }
  50% { transform: rotateX(360deg) rotateY(180deg) rotateZ(90deg); }
  75% { transform: rotateX(540deg) rotateY(270deg) rotateZ(135deg); }
}

.rolling-effect {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.effect-particle {
  font-size: 20px;
  animation: particleFloat 0.6s ease infinite;
}

.effect-particle:nth-child(1) { animation-delay: 0s; }
.effect-particle:nth-child(2) { animation-delay: 0.1s; }
.effect-particle:nth-child(3) { animation-delay: 0.2s; }
.effect-particle:nth-child(4) { animation-delay: 0.3s; }
.effect-particle:nth-child(5) { animation-delay: 0.4s; }

@keyframes particleFloat {
  0%, 100% { 
    transform: translateY(0) scale(0.5); 
    opacity: 0;
  }
  50% { 
    transform: translateY(-20px) scale(1); 
    opacity: 1;
  }
}

/* 结果展示 */
.dice-result {
  text-align: center;
}

.dice-result h3 {
  font-size: 18px;
  color: #333;
  margin: 0 0 20px 0;
}

.result-dice-container {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
}

.result-dice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.dice-bounce {
  animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(-50px);
  }
  50% {
    transform: scale(1.05) translateY(-10px);
  }
  70% {
    transform: scale(0.9) translateY(5px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dice-number {
  font-size: 14px;
  font-weight: bold;
  color: #ff6b6b;
}

.total-sum {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #fff0f0, #ffe8e8);
  border-radius: 12px;
}

.sum-label {
  font-size: 14px;
  color: #666;
}

.sum-value {
  font-size: 24px;
  font-weight: bold;
  color: #ff6b6b;
}

/* 3D骰子样式 */
.dice-face {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #fff, #f0f0f0);
  border-radius: 12px;
  box-shadow: 
    inset 0 2px 4px rgba(255,255,255,0.8),
    inset 0 -2px 4px rgba(0,0,0,0.1),
    0 4px 8px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.dice-dots {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 40px;
  height: 40px;
  gap: 2px;
}

.dot {
  width: 10px;
  height: 10px;
  background: linear-gradient(135deg, #333, #111);
  border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.3);
  align-self: center;
  justify-self: center;
}

/* 点数位置 */
.dot-1 { grid-area: 1 / 1; }
.dot-2 { grid-area: 1 / 2; }
.dot-3 { grid-area: 1 / 3; }
.dot-4 { grid-area: 2 / 1; }
.dot-5 { grid-area: 2 / 2; }
.dot-6 { grid-area: 2 / 3; }
.dot-7 { grid-area: 3 / 1; }
.dot-8 { grid-area: 3 / 2; }
.dot-9 { grid-area: 3 / 3; }
</style>
