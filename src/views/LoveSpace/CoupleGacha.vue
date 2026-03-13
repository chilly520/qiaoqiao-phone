<template>
  <div class="couple-gacha">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>情侣扭蛋机</h2>
      <div class="gacha-tokens">
        <i class="fa-solid fa-wand-sparkles"></i>
        <span>无限抽取已开启</span>
      </div>
    </div>

    <div class="gacha-machine-container">
      <!-- 扭蛋机视觉 -->
      <div class="machine-wrapper" :class="{ 'shake': isRolling }">
        <div class="machine-glass">
          <div v-for="i in 8" :key="i" class="capsule" :style="getRandomStyle(i)"></div>
        </div>
        <div class="machine-body">
          <div class="handle" @click="handleGacha" :class="{ 'rotating': isRolling }">
            <div class="handle-bar"></div>
          </div>
          <div class="exit">
            <div v-if="showResultBall" class="result-ball animate-pop-in" :style="{ backgroundColor: resultColor }"></div>
          </div>
        </div>
      </div>

      <div class="machine-stand"></div>
    </div>

    <!-- 扭蛋说明 -->
    <div class="gacha-info">
      <h3>每日甜蜜扭蛋</h3>
      <p>每天可免费抽取一次，获得随机的甜蜜奖励或任务哦~</p>
      
      <button class="roll-btn" @click="handleGacha" :disabled="isRolling">
        {{ isRolling ? '扭动中...' : '开始扭蛋' }}
      </button>

      <button @click="showHistory = true" class="history-link">查看扭蛋记录</button>
    </div>

    <!-- 魔法生成按钮 -->
    <button class="magic-btn-floating" @click="generateAiGacha" :disabled="isRolling">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
    </button>

    <!-- 结果展示弹窗 -->
    <div v-if="result" class="result-overlay animate-fade-in" @click="closeResult">
        <div class="result-card" @click.stop>
        <div class="result-header">恭喜获得</div>
        <div class="result-icon" :style="{ color: resultColor }">
          <i :class="result.icon"></i>
        </div>
        <div class="result-name">{{ result.name }}</div>
        <div class="result-desc">“{{ result.desc }}”</div>
        <button class="claim-btn" @click="closeResult">收进盒子里</button>
      </div>
    </div>

    <!-- 记录弹窗 -->
    <div v-if="showHistory" class="modal-overlay" @click.self="showHistory = false">
      <div class="history-modal">
        <h3>🕰️ 扭蛋历史记录</h3>
        <div class="history-list">
          <div v-if="gachaHistory.length === 0" class="empty-history">暂无记录</div>
          <div v-for="item in gachaHistory" :key="item.id" class="history-item">
            <div class="h-info">
              <span class="history-name">{{ item.name }}</span>
              <span class="history-date">{{ formatDate(item.date) }}</span>
            </div>
            <button class="h-delete" @click="deleteHistory(item.id)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
        <button @click="showHistory = false" class="close-history-btn">返回</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useBackpackStore } from '@/stores/backpackStore'
import { useChatStore } from '@/stores/chatStore'

const loveSpaceStore = useLoveSpaceStore()
const backpackStore = useBackpackStore()

const isRolling = ref(false)
const showResultBall = ref(false)
const result = ref(null)
const resultColor = ref('#ff6b9d')
const showHistory = ref(false)

const gachaHistory = computed(() => loveSpaceStore.gachaHistory || [])

async function deleteHistory(id) {
  loveSpaceStore.currentSpace.gachaHistory = loveSpaceStore.currentSpace.gachaHistory.filter(h => h.id !== id)
  await loveSpaceStore.saveToStorage()
}

const rewards = [
  { name: '亲亲卡', desc: '凭借此卡可以获得一个香吻', icon: 'fa-solid fa-kiss-wink-heart', color: '#ff7eb3', category: 'gift' },
  { name: '抱抱券', desc: '随时随地申请一个大大的拥抱', icon: 'fa-solid fa-face-grin-hearts', color: '#ffb7c5', category: 'gift' },
  { name: '电影点播位', desc: '获得下一次看电影的挑片权', icon: 'fa-solid fa-film', color: '#fbc2eb', category: 'other' },
  { name: '神秘惊喜', desc: '对方需在今天为你准备一个小礼物', icon: 'fa-solid fa-gift', color: '#ffd1ff', category: 'gift' },
  { name: '真心话特权', desc: '向对方提一个必须真心回答的问题', icon: 'fa-solid fa-comment-heart', color: '#a18cd1', category: 'other' }
]

function getRandomStyle(i) {
  const colors = ['#ff9a9e', '#fecfef', '#a8edea', '#fed6e3', '#fbc2eb', '#a6c1ee']
  return {
    backgroundColor: colors[i % colors.length],
    left: `${Math.random() * 80 + 10}%`,
    top: `${Math.random() * 60 + 20}%`,
    transform: `rotate(${Math.random() * 360}deg)`
  }
}

async function handleGacha() {
  if (isRolling.value) return
  
  isRolling.value = true
  showResultBall.value = false
  
  // 模拟扭动动画
  setTimeout(async () => {
    isRolling.value = false
    showResultBall.value = true
    
    // 选出随机奖励
    const randomIdx = Math.floor(Math.random() * rewards.length)
    const reward = rewards[randomIdx]
    
    result.value = reward
    resultColor.value = reward.color
    
    // 保存到 Store (历史记录)
    await loveSpaceStore.rollGacha({
      name: reward.name,
      desc: reward.desc,
      icon: reward.icon
    })
  }, 1200)
}

// 模拟 AI 生成扭蛋内容
async function generateAiGacha() {
  await loveSpaceStore.generateMagicContent()
}

function claimReward() {
  try {
    if (result.value) {
      // 存入背包
      backpackStore.addItem({
        title: result.value.name,
        description: result.value.desc,
        category: result.value.category || 'other',
        source: '情侣空间-扭蛋机',
        image: 'https://cdn-icons-png.flaticon.com/128/2926/2926715.png'
      })
    }
  } catch (err) {
    console.error('[Gacha] Claim failed:', err)
  }
  setTimeout(() => {
    result.value = null
    showResultBall.value = false
  }, 300)
}

defineExpose({ generateAiGacha })

function closeResult() {
  claimReward()
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<style scoped>
.couple-gacha {
  min-height: 100vh;
  background: linear-gradient(135deg, #fff5f7 0%, #feeaf0 100%);
  display: flex;
  flex-direction: column;
}

.header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
}

.back-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #ff6b9d;
  cursor: pointer;
}

h2 {
  font-size: 18px;
  color: #5a5a7a;
  margin: 0;
}

.gacha-tokens {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff5f7;
  padding: 4px 12px;
  border-radius: 20px;
  color: #ff6b9d;
  font-size: 12px;
  font-weight: 700;
}

.gacha-machine-container {
  padding: 40px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.machine-wrapper {
  width: 200px;
  height: 300px;
  position: relative;
  z-index: 2;
}

.machine-wrapper.shake {
  animation: shake 0.5s infinite;
}

@keyframes shake {
  0%, 100% { transform: translate(0, 0) rotate(0); }
  25% { transform: translate(2px, -2px) rotate(1deg); }
  50% { transform: translate(-2px, 2px) rotate(-1deg); }
}

.machine-glass {
  height: 180px;
  background: rgba(255, 255, 255, 0.4);
  border: 8px solid #ff9dbd;
  border-radius: 100px 100px 20px 20px;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(2px);
}

.capsule {
  position: absolute;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  box-shadow: inset -3px -3px 5px rgba(0,0,0,0.1);
}

.machine-body {
  height: 120px;
  background: #ff6b9d;
  border-radius: 0 0 40px 40px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 15px;
}

.handle {
  width: 50px;
  height: 50px;
  background: #fff5f7;
  border-radius: 50%;
  border: 4px solid #ff9dbd;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.handle.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}

.handle-bar {
  width: 30px;
  height: 6px;
  background: #ff6b9d;
  border-radius: 10px;
}

.exit {
  width: 60px;
  height: 40px;
  background: #8e44ad20;
  margin-top: 10px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.result-ball {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.animate-pop-in {
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  from { transform: scale(0) rotate(-180deg); }
  to { transform: scale(1) rotate(0); }
}

.machine-stand {
  width: 220px;
  height: 20px;
  background: #fecfef;
  border-radius: 10px;
  margin-top: -10px;
}

.gacha-info {
  flex: 1;
  text-align: center;
  padding: 20px;
}

.gacha-info h3 {
  color: #5a5a7a;
  margin-bottom: 10px;
}

.gacha-info p {
  color: #8b7aa8;
  font-size: 14px;
  margin-bottom: 30px;
}

.roll-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(255, 107, 157, 0.3);
  margin-bottom: 20px;
}

.roll-btn:disabled {
  background: #f0f0f0;
  color: #ccc;
  box-shadow: none;
}

.magic-btn-floating {
  position: fixed;
  bottom: 120px;
  right: 20px;
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #a18cd1, #fbc2eb);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  box-shadow: 0 5px 15px rgba(161, 140, 209, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
}

.magic-btn-floating:disabled {
  opacity: 0.5;
  filter: grayscale(1);
}

.history-link {
  background: none;
  border: none;
  color: #8b7aa8;
  text-decoration: underline;
  font-size: 13px;
  cursor: pointer;
}

/* Result Overlay */
.result-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
}

.result-card {
  background: white;
  width: 90%;
  max-width: 320px;
  border-radius: 30px;
  padding: 40px 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.3);
}

.result-header {
  font-size: 14px;
  color: #a89bb9;
  letter-spacing: 5px;
  margin-bottom: 20px;
  text-transform: uppercase;
}

.result-icon {
  font-size: 80px;
  margin-bottom: 20px;
  filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1));
}

.result-name {
  font-size: 24px;
  font-weight: 900;
  color: #5a5a7a;
  margin-bottom: 12px;
}

.result-desc {
  font-size: 14px;
  color: #8b7aa8;
  font-style: italic;
  margin-bottom: 30px;
}

.claim-btn {
  width: 100%;
  padding: 14px;
  background: #ff6b9d;
  color: white;
  border: none;
  border-radius: 100px;
  font-weight: 700;
  cursor: pointer;
}

/* History Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.history-modal {
  background: white;
  width: 85%;
  max-width: 360px;
  border-radius: 24px;
  padding: 24px;
}

.history-modal h3 {
  text-align: center;
  color: #5a5a7a;
  margin-bottom: 20px;
}

.history-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f8f8f8;
  font-size: 14px;
}

.h-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.h-delete {
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
  padding: 5px;
}

.h-delete:hover { color: #ff4d4f; }

.history-date { color: #a89bb9; font-size: 11px; }
.history-name { color: #ff6b9d; font-weight: 800; }

.empty-history {
  text-align: center;
  color: #ccc;
  padding: 40px 0;
}

.close-history-btn {
  width: 100%;
  padding: 12px;
  background: #f5f5f5;
  border: none;
  border-radius: 12px;
  color: #666;
  font-weight: 600;
  cursor: pointer;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
