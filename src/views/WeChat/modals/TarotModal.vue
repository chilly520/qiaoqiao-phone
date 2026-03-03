<template>
  <div v-if="show" class="tarot-modal fixed inset-0 z-[200] flex items-center justify-center" @click.self="close">
    <!-- 背景模糊效果 -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"></div>

    <!-- 主容器 -->
    <div
      class="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-3xl p-1 w-[380px] max-w-[95vw] shadow-2xl animate-bounce-in overflow-hidden border-2 border-purple-400/50 max-h-[90vh] overflow-y-auto">
      <!-- 神秘背景图案 -->
      <div class="absolute inset-0 opacity-20 pointer-events-none">
        <div class="absolute top-4 left-4 w-20 h-20 bg-purple-400 rounded-full blur-3xl"></div>
        <div class="absolute top-20 right-8 w-16 h-16 bg-pink-400 rounded-full blur-2xl"></div>
        <div class="absolute bottom-20 left-12 w-24 h-24 bg-indigo-400 rounded-full blur-3xl"></div>
        <div class="absolute bottom-4 right-4 w-20 h-20 bg-yellow-400 rounded-full blur-2xl"></div>
        <!-- 星星装饰 -->
        <div class="absolute top-10 left-10 text-yellow-300 text-lg animate-twinkle">✨</div>
        <div class="absolute top-20 right-20 text-purple-300 text-sm animate-twinkle" style="animation-delay: 0.5s">⭐</div>
        <div class="absolute bottom-32 left-20 text-pink-300 text-xs animate-twinkle" style="animation-delay: 1s">✨</div>
        <div class="absolute top-1/2 right-10 text-indigo-300 text-sm animate-twinkle" style="animation-delay: 1.5s">🌙</div>
      </div>

      <!-- 内部内容区域 -->
      <div class="relative bg-black/40 backdrop-blur-sm rounded-2xl p-5">
        <!-- 头部 -->
        <div class="text-center mb-5">
          <div
            class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-500 rounded-full shadow-lg mb-2 animate-float border-2 border-white/30">
            <span class="text-3xl">🔮</span>
          </div>
          <h3 class="text-xl font-bold text-white text-shadow">塔罗占卜</h3>
          <p class="text-xs text-purple-200 mt-1">探索命运的指引</p>
        </div>

        <!-- 步骤1: 输入问题和选择牌阵 -->
        <div v-if="step === 'input'" class="space-y-4">
          <!-- 问题输入 -->
          <div class="space-y-2">
            <label class="text-sm text-purple-200 flex items-center gap-2">
              <i class="fa-solid fa-question-circle"></i>
              你想问什么问题？
            </label>
            <textarea
              v-model="question"
              placeholder="例如：我最近的感情运势如何？"
              class="w-full h-20 px-4 py-3 rounded-xl bg-white/10 border border-purple-400/50 text-white placeholder-purple-300/50 resize-none focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all text-sm"
            ></textarea>
          </div>

          <!-- 牌阵选择 -->
          <div class="space-y-2">
            <label class="text-sm text-purple-200 flex items-center gap-2">
              <i class="fa-solid fa-layer-group"></i>
              选择牌阵
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="spread in tarotSpreads"
                :key="spread.id"
                @click="selectedSpread = spread"
                class="relative p-3 rounded-xl border-2 transition-all duration-200 text-left"
                :class="selectedSpread.id === spread.id
                  ? 'border-purple-400 bg-gradient-to-br from-purple-500/30 to-pink-500/30'
                  : 'border-purple-400/30 bg-white/5 hover:bg-white/10'"
              >
                <div class="text-sm font-medium text-white">{{ spread.name }}</div>
                <div class="text-xs text-purple-300 mt-1">{{ spread.cardCount }}张牌</div>
                <div v-if="selectedSpread.id === spread.id"
                  class="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <i class="fa-solid fa-check text-white text-xs"></i>
                </div>
              </button>
            </div>
            <p class="text-xs text-purple-300/70">{{ selectedSpread.description }}</p>
          </div>

          <!-- 按钮 -->
          <div class="flex gap-3 pt-2">
            <button @click="close"
              class="flex-1 py-3 rounded-xl border-2 border-purple-400/50 text-purple-200 font-medium hover:bg-white/10 transition-all active:scale-95">
              取消
            </button>
            <button @click="startDraw"
              class="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/30 transition-all active:scale-95 hover:shadow-purple-500/50">
              <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>开始抽牌
            </button>
          </div>
        </div>

        <!-- 步骤2: 抽牌动画 -->
        <div v-else-if="step === 'drawing'" class="space-y-4">
          <div class="text-center">
            <p class="text-lg font-medium text-white mb-1">正在抽取塔罗牌...</p>
            <p class="text-sm text-purple-300">{{ drawProgress }} / {{ selectedSpread.cardCount }}</p>
          </div>

          <!-- 牌堆和抽牌动画 -->
          <div class="relative h-48 flex items-center justify-center">
            <!-- 牌堆 -->
            <div class="relative">
              <div class="w-20 h-32 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg border-2 border-purple-400/50 shadow-xl flex items-center justify-center">
                <div class="w-16 h-28 border border-purple-400/30 rounded flex items-center justify-center">
                  <span class="text-2xl">🌟</span>
                </div>
              </div>
              <!-- 牌堆阴影层 -->
              <div class="absolute -top-1 left-1 w-20 h-32 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg border-2 border-purple-400/30 opacity-60"></div>
              <div class="absolute -top-2 left-2 w-20 h-32 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg border-2 border-purple-400/20 opacity-40"></div>
            </div>

            <!-- 飞出的牌 -->
            <div
              v-for="(card, index) in drawingCards"
              :key="card.uuid"
              class="absolute w-20 h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg border-2 border-purple-400/50 shadow-xl flex items-center justify-center card-fly"
              :style="getCardFlyStyle(index)"
            >
              <div class="w-16 h-28 border border-purple-400/30 rounded flex items-center justify-center">
                <span class="text-xl">✨</span>
              </div>
            </div>
          </div>

          <!-- 已抽到的牌预览 -->
          <div class="flex justify-center gap-2 flex-wrap">
            <div
              v-for="(card, index) in drawnCards"
              :key="card.uuid"
              class="w-12 h-18 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg border border-white/30 flex items-center justify-center animate-pop-in"
              :style="{ animationDelay: (index * 0.1) + 's' }"
            >
              <span class="text-xs text-white font-medium">{{ index + 1 }}</span>
            </div>
          </div>
        </div>

        <!-- 步骤3: 展示抽到的牌 -->
        <div v-else-if="step === 'revealing'" class="space-y-4">
          <div class="text-center">
            <p class="text-lg font-medium text-white mb-1">塔罗牌已揭示</p>
            <p class="text-sm text-purple-300">{{ selectedSpread.name }}</p>
          </div>

          <!-- 牌阵展示 -->
          <div class="flex justify-center gap-3 flex-wrap py-2">
            <div
              v-for="(card, index) in drawnCards"
              :key="card.uuid"
              class="relative group"
            >
              <!-- 牌面 -->
              <div
                class="w-16 h-24 rounded-lg border-2 shadow-lg transition-all duration-300 cursor-pointer"
                :class="[
                  card.isReversed ? 'rotate-180' : '',
                  'bg-gradient-to-br ' + getCardColorClass(card)
                ]"
                @click="flipCard(index)"
              >
                <div class="w-full h-full flex flex-col items-center justify-center p-1">
                  <span class="text-lg">{{ getCardIcon(card) }}</span>
                  <span class="text-[8px] text-white/90 text-center leading-tight mt-1">{{ card.name }}</span>
                  <span v-if="card.isReversed" class="text-[6px] text-white/70 mt-0.5">逆位</span>
                </div>
              </div>
              <!-- 位置标签 -->
              <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span class="text-[10px] text-purple-300">{{ selectedSpread.positions[index]?.name }}</span>
              </div>
            </div>
          </div>

          <!-- 问题显示 -->
          <div v-if="question" class="bg-white/10 rounded-xl p-3 mt-6">
            <p class="text-xs text-purple-300 mb-1">你的问题：</p>
            <p class="text-sm text-white">{{ question }}</p>
          </div>

          <!-- 按钮组 -->
          <div class="flex gap-2 pt-2">
            <button @click="reset"
              class="flex-1 py-2.5 rounded-xl border-2 border-purple-400/50 text-purple-200 font-medium hover:bg-white/10 transition-all active:scale-95 text-sm">
              <i class="fa-solid fa-rotate-right mr-1"></i>重抽
            </button>
            <button @click="shareCards"
              class="flex-1 py-2.5 rounded-xl border-2 border-pink-400/50 text-pink-200 font-medium hover:bg-pink-500/20 transition-all active:scale-95 text-sm">
              <i class="fa-solid fa-share mr-1"></i>分享牌面
            </button>
            <button @click="startInterpret"
              class="flex-[1.5] py-2.5 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/30 transition-all active:scale-95 hover:shadow-purple-500/50 text-sm">
              <i class="fa-solid fa-sparkles mr-1"></i>智能解牌
            </button>
          </div>
        </div>

        <!-- 步骤4: 解牌中 -->
        <div v-else-if="step === 'interpreting'" class="space-y-4 py-8">
          <div class="text-center">
            <div class="relative inline-flex items-center justify-center mb-4">
              <div class="w-20 h-20 rounded-full border-4 border-purple-400/30 border-t-purple-400 animate-spin"></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-3xl">🔮</span>
              </div>
            </div>
            <p class="text-lg font-medium text-white mb-1">正在解读牌意...</p>
            <p class="text-sm text-purple-300">塔罗师正在为你解析命运的指引</p>
          </div>

          <!-- 闪烁的牌 -->
          <div class="flex justify-center gap-2">
            <div
              v-for="(card, index) in drawnCards"
              :key="card.uuid"
              class="w-12 h-18 rounded-lg border border-purple-400/50 animate-pulse"
              :class="'bg-gradient-to-br ' + getCardColorClass(card)"
              :style="{ animationDelay: (index * 0.2) + 's' }"
            ></div>
          </div>
        </div>

        <!-- 步骤5: 解牌结果 -->
        <div v-else-if="step === 'result'" class="space-y-4">
          <div class="text-center">
            <p class="text-lg font-medium text-white mb-1">✨ 解牌完成 ✨</p>
            <p class="text-sm text-purple-300">{{ selectedSpread.name }}</p>
          </div>

          <!-- 牌面缩略图 -->
          <div class="flex justify-center gap-2">
            <div
              v-for="(card, index) in drawnCards"
              :key="card.uuid"
              class="w-10 h-14 rounded-lg border border-purple-400/30"
              :class="'bg-gradient-to-br ' + getCardColorClass(card)"
            >
              <div class="w-full h-full flex items-center justify-center">
                <span class="text-sm">{{ getCardIcon(card) }}</span>
              </div>
            </div>
          </div>

          <!-- 解牌内容 -->
          <div class="bg-white/10 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar">
            <div class="text-sm text-white leading-relaxed whitespace-pre-wrap">{{ interpretation }}</div>
          </div>

          <!-- 按钮组 -->
          <div class="flex gap-2">
            <button @click="reset"
              class="flex-1 py-2.5 rounded-xl border-2 border-purple-400/50 text-purple-200 font-medium hover:bg-white/10 transition-all active:scale-95 text-sm">
              <i class="fa-solid fa-rotate-right mr-1"></i>再抽一次
            </button>
            <button @click="shareInterpretation"
              class="flex-[1.5] py-2.5 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 text-white font-medium shadow-lg shadow-purple-500/30 transition-all active:scale-95 hover:shadow-purple-500/50 text-sm">
              <i class="fa-solid fa-paper-plane mr-1"></i>分享解牌
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { tarotSpreads, getRandomCards, getSpread, generateTarotPrompt } from '../../../utils/tarotData'
import { useSettingsStore } from '../../../stores/settingsStore'

const props = defineProps({
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'share', 'share-interpretation'])

const settingsStore = useSettingsStore()

// 状态
const step = ref('input') // input, drawing, revealing, interpreting, result
const question = ref('')
const selectedSpread = ref(tarotSpreads[1]) // 默认三张牌
const drawnCards = ref([])
const drawingCards = ref([])
const drawProgress = ref(0)
const interpretation = ref('')

// 监听show变化
watch(() => props.show, (newVal) => {
  if (newVal) {
    reset()
  }
})

// 重置状态
const reset = () => {
  step.value = 'input'
  question.value = ''
  selectedSpread.value = tarotSpreads[1]
  drawnCards.value = []
  drawingCards.value = []
  drawProgress.value = 0
  interpretation.value = ''
}

// 关闭模态框
const close = () => {
  emit('close')
}

// 开始抽牌
const startDraw = () => {
  step.value = 'drawing'
  drawnCards.value = []
  drawingCards.value = []
  drawProgress.value = 0

  // 生成要抽的牌
  const cards = getRandomCards(selectedSpread.value.cardCount)

  // 动画抽牌
  let currentIndex = 0
  const drawInterval = setInterval(() => {
    if (currentIndex >= cards.length) {
      clearInterval(drawInterval)
      setTimeout(() => {
        step.value = 'revealing'
      }, 500)
      return
    }

    const card = {
      ...cards[currentIndex],
      positionName: selectedSpread.value.positions[currentIndex]?.name
    }

    // 添加飞出的牌动画
    drawingCards.value.push({ ...card, flyIndex: currentIndex })

    setTimeout(() => {
      drawnCards.value.push(card)
      drawingCards.value = drawingCards.value.filter(c => c.uuid !== card.uuid)
      drawProgress.value++
    }, 400)

    currentIndex++
  }, 600)
}

// 获取牌飞出的样式
const getCardFlyStyle = (index) => {
  const angles = [-30, -15, 0, 15, 30, -20, 20, -10, 10, 0]
  const angle = angles[index % angles.length]
  const distance = 80 + (index * 10)
  const rad = (angle * Math.PI) / 180
  const x = Math.sin(rad) * distance
  const y = -Math.cos(rad) * distance * 0.5

  return {
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
    opacity: '0',
    animation: `cardFly 0.5s ease-out ${index * 0.1}s forwards`
  }
}

// 获取牌的颜色类
const getCardColorClass = (card) => {
  if (card.id < 22) return 'from-purple-600 to-indigo-700' // 大阿卡纳
  if (card.suit === 'wands') return 'from-red-500 to-orange-600' // 权杖
  if (card.suit === 'cups') return 'from-blue-500 to-cyan-600' // 圣杯
  if (card.suit === 'swords') return 'from-yellow-500 to-amber-600' // 宝剑
  if (card.suit === 'pentacles') return 'from-green-500 to-emerald-600' // 星币
  return 'from-purple-600 to-indigo-700'
}

// 获取牌的图标
const getCardIcon = (card) => {
  if (card.id < 22) return '🔮' // 大阿卡纳
  if (card.suit === 'wands') return '🔥' // 权杖
  if (card.suit === 'cups') return '💧' // 圣杯
  if (card.suit === 'swords') return '⚔️' // 宝剑
  if (card.suit === 'pentacles') return '💰' // 星币
  return '🔮'
}

// 翻转牌（查看详情）
const flipCard = (index) => {
  // 可以添加查看牌详情的逻辑
  console.log('查看牌详情:', drawnCards.value[index])
}

// 分享牌面
const shareCards = () => {
  emit('share', {
    question: question.value,
    spread: selectedSpread.value,
    cards: drawnCards.value
  })
  close()
}

// 开始解牌
const startInterpret = async () => {
  step.value = 'interpreting'

  try {
    // 检查是否有AI配置
    const aiConfig = settingsStore.aiConfig
    if (!aiConfig || !aiConfig.apiKey) {
      // 使用本地解牌
      interpretation.value = generateLocalInterpretation()
      step.value = 'result'
      return
    }

    // 调用AI解牌
    const prompt = generateTarotPrompt(question.value, drawnCards.value, selectedSpread.value.name)

    const response = await fetch(aiConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: '你是一位经验丰富的塔罗牌解牌师，擅长提供专业、温暖且富有洞察力的解牌。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.8
      })
    })

    if (response.ok) {
      const data = await response.json()
      interpretation.value = data.choices?.[0]?.message?.content || generateLocalInterpretation()
    } else {
      interpretation.value = generateLocalInterpretation()
    }
  } catch (error) {
    console.error('解牌失败:', error)
    interpretation.value = generateLocalInterpretation()
  }

  step.value = 'result'
}

// 生成本地解牌（备用）
const generateLocalInterpretation = () => {
  const cardTexts = drawnCards.value.map((card, index) => {
    const position = card.positionName || `第${index + 1}张`
    const meaning = card.isReversed ? card.meaning.reversed : card.meaning.upright
    return `${position}：${card.name}（${card.isReversed ? '逆位' : '正位'}）\n${meaning}`
  }).join('\n\n')

  return `🔮 ${selectedSpread.value.name}解牌

${question.value ? `问题：${question.value}` : ''}

${cardTexts}

💫 整体指引：
塔罗牌显示你正处于一个重要的转折点。保持开放的心态，相信直觉的指引。每张牌都蕴含着深刻的智慧，帮助你更好地理解当前的处境。记住，未来掌握在自己手中，塔罗只是提供参考和启发。`
}

// 分享解牌
const shareInterpretation = () => {
  emit('share-interpretation', {
    question: question.value,
    spread: selectedSpread.value,
    cards: drawnCards.value,
    interpretation: interpretation.value
  })
  close()
}
</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
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
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(3deg);
  }
}

@keyframes twinkle {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes cardFly {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translate(var(--fly-x, 50px), var(--fly-y, -50px)) rotate(var(--fly-rotate, 15deg)) scale(1.1);
  }
  100% {
    opacity: 0;
    transform: translate(var(--fly-x, 100px), var(--fly-y, -100px)) rotate(var(--fly-rotate, 30deg)) scale(0.8);
  }
}

@keyframes pop-in {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  70% {
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
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

.animate-pop-in {
  animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.text-shadow {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.card-fly {
  animation: cardFly 0.5s ease-out forwards;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(168, 85, 247, 0.5);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(168, 85, 247, 0.7);
}
</style>
