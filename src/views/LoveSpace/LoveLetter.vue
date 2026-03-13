<template>
  <div class="love-letter">
    <!-- 信箱主页 -->
    <div v-if="!showLetterList" class="mailbox-home" :class="[`season-${season}`, { 'is-night': isNight }]">
      <!-- 四季背景 -->
      <div class="season-background">
        <img :src="backgroundImage" class="season-bg-image" alt="背景">
        <!-- 日夜叠加层 -->
        <div class="night-overlay" v-if="isNight"></div>
        <!-- 萤火虫效果（夏季夜晚） -->
        <div class="fireflies" v-if="season === 'summer' && isNight">
          <div class="firefly" v-for="n in 20" :key="n" :style="getFireflyStyle(n)"></div>
        </div>
        <!-- 花瓣飘落（春季） -->
        <div class="petals" v-if="season === 'spring'">
          <div class="petal" v-for="n in 25" :key="n" :style="getPetalStyle(n)"></div>
        </div>
        <!-- 落叶飘落（秋季） -->
        <div class="leaves" v-if="season === 'autumn'">
          <div class="leaf" v-for="n in 25" :key="n" :style="getLeafStyle(n)"></div>
        </div>
        <!-- 飘雪效果（冬季） -->
        <div class="snowflakes" v-if="season === 'winter'">
          <div class="snowflake" v-for="n in 50" :key="n" :style="getSnowflakeStyle(n)"></div>
        </div>
      </div>
      
      <!-- 四季邮箱 - 显示在最上层 -->
      <div class="season-mailbox" @click="enterMailbox">
        <img :src="mailboxImage" class="mailbox-image" alt="邮箱">
        <!-- 未读徽章 -->
        <div class="unread-badge-floating" v-if="unreadCount > 0">
          {{ unreadCount }}
        </div>
      </div>
      
      <button @click="$router.push('/couple')" class="mailbox-back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      
      <!-- 季节切换器 -->
      <div class="season-selector">
        <button @click="() => { console.log('点击春天'); setSeason('spring') }" :class="['season-btn', { active: season === 'spring' }]" title="春天">
          🌸
        </button>
        <button @click="() => { console.log('点击夏天'); setSeason('summer') }" :class="['season-btn', { active: season === 'summer' }]" title="夏天">
          🌿
        </button>
        <button @click="() => { console.log('点击秋天'); setSeason('autumn') }" :class="['season-btn', { active: season === 'autumn' }]" title="秋天">
          🍂
        </button>
        <button @click="() => { console.log('点击冬天'); setSeason('winter') }" :class="['season-btn', { active: season === 'winter' }]" title="冬天">
          ❄️
        </button>
      </div>
      
      <!-- 文字区域 - 邮箱上方 -->
      <div class="mailbox-title-area">
        <h2 class="main-title">纸短情长</h2>
        <p class="sub-title">{{ unreadCount > 0 ? `有${unreadCount}封新信件待收取` : '今日无新信件' }}</p>
        <div class="time-badge">{{ currentTimeDisplay }}</div>
      </div>

      <!-- 装饰性网格粒子 -->
      <div class="decor-cloud cloud-1">☁️</div>
      <div class="decor-cloud cloud-2">☁️</div>
    </div>

    <!-- 信件列表页 -->
    <div v-else class="letter-list-page">
      <div class="header">
        <button @click="$router.push('/couple/mailbox')" class="back-btn">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <h2>纸短情长</h2>
        <button @click="showWriteModal = true" class="write-btn">
          <i class="fa-solid fa-pen-nib"></i>
        </button>
      </div>

      <!-- 信件列表 -->
      <div class="letter-list">
        <div v-if="letters.length === 0" class="empty-state">
          <div class="letter-icon-bg">✉️</div>
          <p>山海有你，信件无声。</p>
          <p class="sub">给 TA 写一封值得珍藏的长信吧</p>
        </div>

        <div 
          v-for="letter in sortedLetters" 
          :key="letter.id" 
          class="envelope-card"
          :class="getEnvelopeStyleClass(letter)"
          @click="openLetter(letter)"
        >
          <!-- 信封底层 -->
          <div class="envelope-body">
            <div class="inner-border"></div>
            <!-- 金属护角 -->
            <div class="corner-decor top-left"></div>
            <div class="corner-decor top-right"></div>
            <div class="corner-decor bottom-left"></div>
            <div class="corner-decor bottom-right"></div>
            
            <!-- 背景网格/纹理已在 CSS 中 -->
          </div>

          <!-- 翻盖层 (双层) -->
          <div class="envelope-flap flap-secondary"></div>
          <div class="envelope-flap flap-main"></div>
          
          <!-- 装饰丝带 (特定款式) -->
          <div class="ribbon"></div>

          <!-- 火漆印章 -->
          <div class="wax-seal"></div>

          <!-- 标题内容 (信笺正面文字) -->
          <div class="letter-content-overlay">
            <h4 class="letter-title">{{ letter.title || '无题的信' }}</h4>
            <span class="letter-date">{{ formatDateShort(letter.createdAt) }}</span>
          </div>

          <!-- 系列标签 -->
          <div class="series-tag">{{ getEnvelopeSeriesName(letter) }}</div>
          
          <!-- 身份标签 -->
          <div class="author-tag-chic">
            <i :class="letter.author === 'user' ? 'fa-solid fa-pen-nib' : 'fa-solid fa-crown'"></i>
            {{ letter.author === 'user' ? '我写的信' : (loveSpaceStore.partner?.name || 'TA') + ' 的来信' }}
          </div>

          <!-- 未读标记 -->
          <div class="unread-pill" v-if="!letter.isRead">未读</div>
        </div>
      </div>
    </div>

    <!-- 写信弹窗 -->
    <div v-if="showWriteModal" class="modal-overlay" @click.self="showWriteModal = false">
      <div class="modal">
        <h3>书写信笺</h3>
        <input v-model="newTitle" type="text" placeholder="信件标题..." class="title-input">
        <textarea 
          v-model="newContent" 
          placeholder="见字如面，此致敬礼..." 
          class="content-textarea"
        ></textarea>

        <!-- 信纸选择 -->
        <div class="paper-selector">
          <p class="selector-label">选择信纸：</p>
          <div class="paper-grid-container">
            <div class="paper-grid">
              <div 
                v-for="(p, idx) in randomLetterPapers" 
                :key="idx"
                class="paper-item"
                :class="{ active: selectedPaperIndex === idx }"
                @click="selectedPaperIndex = idx"
              >
                <img :src="p" class="paper-thumb">
                <div class="check-mark" v-if="selectedPaperIndex === idx">
                  <i class="fa-solid fa-check"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="showWriteModal = false" class="cancel-btn">收起</button>
          <button @click="saveLetter" :disabled="!newContent.trim()" class="save-btn">封信</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'

const router = useRouter()
const route = useRoute()
const loveSpaceStore = useLoveSpaceStore()

const letters = computed(() => loveSpaceStore.letters || [])
// 根据路由路径判断是否显示列表
const showLetterList = computed(() => route.path === '/couple/letter')
const showWriteModal = ref(false)
const newTitle = ref('')
const newContent = ref('')
const selectedPaperIndex = ref(0)


// 四季和日夜轮换
const season = ref('spring') // spring, summer, autumn, winter
const isNight = ref(false)
const currentTimeDisplay = ref('')

// 背景图片映射
const backgroundImages = {
  spring: '/images/mailbox/spring.jpg',
  summer: '/images/mailbox/summer.jpg',
  autumn: '/images/mailbox/autumn.jpg',
  winter: '/images/mailbox/winter.jpg'
}

// 邮箱图片映射
const mailboxImages = {
  spring: '/images/mailbox/spring-box.png',
  summer: '/images/mailbox/summer-box.png',
  autumn: '/images/mailbox/autumn-box.png',
  winter: '/images/mailbox/winter-box.png'
}

// 随机信纸池 (13 张)
const randomLetterPapers = [
  '/images/mailbox/信纸 (1).jpg',
  '/images/mailbox/信纸 (2).jpg',
  '/images/mailbox/信纸 (3).jpg',
  '/images/mailbox/信纸 (4).jpg',
  '/images/mailbox/信纸 (5).jpg',
  '/images/mailbox/信纸 (6).jpg',
  '/images/mailbox/信纸 (7).jpg',
  '/images/mailbox/信纸 (8).jpg',
  '/images/mailbox/信纸 (9).jpg',
  '/images/mailbox/信纸 (10).jpg',
  '/images/mailbox/信纸 (11).jpg',
  '/images/mailbox/信纸 (12).jpg',
  '/images/mailbox/信纸 (13).jpg'
]

// 为每封信分配信纸（优先使用显式选择的 paperIndex）
const getLetterPaper = (letter) => {
  if (!letter) return randomLetterPapers[0]
  if (letter.paperIndex !== undefined) {
    return encodeURI(randomLetterPapers[letter.paperIndex % randomLetterPapers.length])
  }
  const idStr = String(letter.id || '')
  const hash = Math.abs(idStr.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0) | 0
  }, 0))
  const paper = randomLetterPapers[hash % randomLetterPapers.length]
  return encodeURI(paper)
}

const backgroundImage = computed(() => {
  console.log('背景图变化:', season.value, backgroundImages[season.value])
  return backgroundImages[season.value]
})
const mailboxImage = computed(() => {
  console.log('邮箱图片变化:', season.value, mailboxImages[season.value])
  return mailboxImages[season.value]
})

// 是否首次加载季节
const isFirstLoad = ref(true)

// 更新时间显示和日夜判断
function updateTime() {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  
  // 时间显示
  currentTimeDisplay.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  
  // 日夜判断：6-18 点为白天，其他为夜晚
  isNight.value = hours < 6 || hours >= 18
  
  // 只在首次加载时根据月份设置季节
  if (isFirstLoad.value) {
    const month = now.getMonth() + 1
    if (month >= 3 && month <= 5) {
      season.value = 'spring'
    } else if (month >= 6 && month <= 8) {
      season.value = 'summer'
    } else if (month >= 9 && month <= 11) {
      season.value = 'autumn'
    } else {
      season.value = 'winter'
    }
    isFirstLoad.value = false
  }
}

function setSeason(newSeason) {
  console.log('切换季节:', newSeason)
  season.value = newSeason
  console.log('当前季节:', season.value)
}

// 四季动画效果
function getSnowflakeStyle(index) {
  const left = Math.random() * 100
  const delay = Math.random() * 5
  const duration = Math.random() * 4 + 5 // 5-9 秒
  const size = Math.random() * 4 + 4 // 4-8px（更小）
  const wind = Math.random() * 60 - 30 // 增强风感
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    fontSize: `${size}px`,
    '--wind-offset': `${wind}px`
  }
}

function getFireflyStyle(index) {
  const left = Math.random() * 100
  const top = Math.random() * 100
  const delay = Math.random() * 5
  const duration = Math.random() * 5 + 8 // 8-13 秒
  const size = Math.random() * 6 + 4 // 4-10px
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    width: `${size}px`,
    height: `${size}px`
  }
}

function getPetalStyle(index) {
  const left = Math.random() * 100
  const delay = Math.random() * 5
  const duration = Math.random() * 5 + 8 // 8-13 秒
  const rotation = Math.random() * 360
  const wind = Math.random() * 60 - 30 // 风感左右飘动
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    transform: `rotate(${rotation}deg)`,
    '--wind-offset': `${wind}px`
  }
}

function getLeafStyle(index) {
  const left = Math.random() * 100
  const delay = Math.random() * 5
  const duration = Math.random() * 5 + 8 // 8-13 秒
  const rotation = Math.random() * 360
  const wind = Math.random() * 80 - 40 // 风感左右飘动更大
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    transform: `rotate(${rotation}deg)`,
    '--wind-offset': `${wind}px`
  }
}

const unreadCount = computed(() => {
  return letters.value.filter(l => !l.isRead).length
})

const sortedLetters = computed(() => {
  return [...letters.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

function getParticleStyle(index) {
  const size = Math.random() * 8 + 4
  const left = Math.random() * 100
  const delay = Math.random() * 5
  const duration = Math.random() * 10 + 10
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`
  }
}

function formatDateShort(dateStr) {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function getEnvelopeStyleClass(letter) {
  const styles = ['style-rose', 'style-snow', 'style-iris', 'style-mint', 'style-sun', 'style-pearl']
  // 如果有明确保存的索引则使用；否则按 ID 取模实现随机
  if (letter.styleIndex !== undefined) {
    return styles[letter.styleIndex % 6]
  }
  const idStr = String(letter.id || '')
  const hash = idStr.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)
  return styles[Math.abs(hash) % 6]
}

function getEnvelopeSeriesName(letter) {
  const names = ['SWEET ROSE', 'CRYSTAL PROMISE', 'STARRY IRIS', 'MINT WHISPER', 'WARM SUN', 'HOLY PEARL']
  const index = letter.styleIndex !== undefined ? letter.styleIndex : (String(letter.id || '').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))
  return names[Math.abs(index) % 6]
}

function openLetter(letter) {
  // 标记为已读
  letter.isRead = true
  router.push({ name: 'couple-letter-detail', params: { id: letter.id } })
}

function enterMailbox() {
  router.push('/couple/letter')
}

async function saveLetter() {
  if (!newContent.value.trim()) return

  // Removed random styleIndex assignment here to allow ID hash logic to take over if styleIndex is not explicitly set elsewhere.
  // If a specific style is desired for new letters, it should be set here.
  
  await loveSpaceStore.addLetter({
    title: newTitle.value || '无题的信',
    content: newContent.value,
    author: 'user',
    isRead: false,
    paperIndex: selectedPaperIndex.value
  })

  newTitle.value = ''
  newContent.value = ''
  showWriteModal.value = false
}

async function deleteLetter(id) {
  loveSpaceStore.currentSpace.letters = loveSpaceStore.currentSpace.letters.filter(l => l.id !== id)
  await loveSpaceStore.saveToStorage()
}

onMounted(() => {
  // 初始化时间和季节
  updateTime()
  setInterval(updateTime, 1000) // 每秒更新时间
})
</script>

<style scoped>
@import url("https://fontsapi.zeoseven.com/223/main/result.css");

.love-letter {
  min-height: 100vh;
  background: linear-gradient(135deg, #fff5f7 0%, #fdf5e6 50%, #f0f4ff 100%);
  position: relative;
  overflow: hidden;
}

/* ===== 信箱主页 ===== */
.mailbox-home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 40px 20px;
  overflow: hidden;
}

/* 四季背景 */
.season-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  transition: all 1s ease;
}

.season-bg-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.8s ease;
}

/* 日夜叠加层 */
.night-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 50% 30%, 
    rgba(30, 30, 60, 0.15) 0%, 
    rgba(20, 20, 50, 0.25) 40%, 
    rgba(10, 10, 30, 0.4) 100%);
  z-index: 10;
  animation: nightShift 3s ease-in-out;
}

@keyframes nightShift {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 飘雪效果 */
.snowflakes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  pointer-events: none;
}

.snowflake {
  position: absolute;
  width: 6px;
  height: 6px;
  background: radial-gradient(circle, #ffffff 0%, rgba(255, 255, 255, 0.8) 50%, transparent 70%);
  border-radius: 50%;
  opacity: 1;
  box-shadow: 
    0 0 8px rgba(255, 255, 255, 0.6),
    0 0 15px rgba(255, 255, 255, 0.3);
  animation: snowfall linear infinite;
  filter: brightness(1.1);
}

@keyframes snowfall {
  0% {
    transform: translateY(-10vh) translateX(calc(-60px + var(--wind-offset, 0px))) scale(0.8);
    opacity: 0;
  }
  20% {
    opacity: 1;
    transform: translateY(15vh) translateX(calc(-20px + var(--wind-offset, 0px))) scale(1);
  }
  50% {
    transform: translateY(50vh) translateX(calc(40px + var(--wind-offset, 0px))) scale(0.9) rotate(45deg);
  }
  80% {
    transform: translateY(85vh) translateX(calc(-20px + var(--wind-offset, 0px))) scale(1);
  }
  100% {
    transform: translateY(115vh) translateX(calc(60px + var(--wind-offset, 0px))) scale(0.8) rotate(90deg);
    opacity: 0.3;
  }
}

/* 萤火虫效果 */
.fireflies {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  pointer-events: none;
}

.firefly {
  position: absolute;
  width: 8px;
  height: 8px;
  background: radial-gradient(circle, #ffff99 0%, transparent 70%);
  border-radius: 50%;
  animation: fireflyFloat linear infinite;
  box-shadow: 0 0 10px #ffff99;
}

@keyframes fireflyFloat {
  0%, 100% {
    transform: translate(0, 0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  50% {
    transform: translate(30px, -30px);
  }
}

/* 花瓣飘落 */
.petals {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  pointer-events: none;
}

.petal {
  position: absolute;
  width: 15px;
  height: 15px;
  background: radial-gradient(circle, rgba(255, 182, 193, 0.8) 0%, rgba(255, 182, 193, 0.2) 100%);
  border-radius: 15px 0;
  animation: petalFall linear infinite;
}

@keyframes petalFall {
  0% {
    transform: translateY(-15vh) translateX(calc(-80px + var(--wind-offset, 0px))) rotate(0deg) scale(0.8);
    opacity: 0;
  }
  15% {
    opacity: 1;
    transform: translateY(10vh) translateX(calc(-30px + var(--wind-offset, 0px))) rotate(45deg) scale(1);
  }
  50% {
    transform: translateY(50vh) translateX(calc(80px + var(--wind-offset, 0px))) rotate(180deg) scale(0.9);
  }
  85% {
    transform: translateY(90vh) translateX(calc(-30px + var(--wind-offset, 0px))) rotate(270deg) scale(1);
  }
  100% {
    transform: translateY(115vh) translateX(calc(80px + var(--wind-offset, 0px))) rotate(450deg) scale(0.8);
    opacity: 0.2;
  }
}

/* 落叶飘落 */
.leaves {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  pointer-events: none;
}

.leaf {
  position: absolute;
  width: 18px;
  height: 18px;
  background: radial-gradient(circle, rgba(255, 165, 0, 0.8) 0%, rgba(255, 165, 0, 0.2) 100%);
  border-radius: 0 50%;
  animation: leafFall linear infinite;
}

@keyframes leafFall {
  0% {
    transform: translateY(-15vh) translateX(calc(-100px + var(--wind-offset, 0px))) rotate(0deg) scale(0.7);
    opacity: 0;
  }
  15% {
    opacity: 1;
    transform: translateY(10vh) translateX(calc(-40px + var(--wind-offset, 0px))) rotate(60deg) scale(1);
  }
  50% {
    transform: translateY(50vh) translateX(calc(100px + var(--wind-offset, 0px))) rotate(180deg) scale(0.8);
  }
  85% {
    transform: translateY(90vh) translateX(calc(-40px + var(--wind-offset, 0px))) rotate(300deg) scale(1);
  }
  100% {
    transform: translateY(115vh) translateX(calc(100px + var(--wind-offset, 0px))) rotate(540deg) scale(0.7);
    opacity: 0.1;
  }
}

/* 季节切换器 */
.season-selector {
  position: absolute;
  top: 20px;
  right: 80px;
  display: flex;
  gap: 8px;
  z-index: 50;
}

.season-btn {
  width: 45px;
  height: 45px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  font-size: 22px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.season-btn:hover {
  transform: scale(1.15);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.season-btn.active {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fa3 100%);
  transform: scale(1.2);
  box-shadow: 0 6px 16px rgba(255, 107, 157, 0.4);
}

/* 时间显示 */
.time-display {
  margin-top: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  background: rgba(0, 0, 0, 0.25);
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
}

.mailbox-back-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(255, 182, 193, 0.4);
  color: #ff6b9d;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(255, 182, 193, 0.25);
  z-index: 100;
}

.mailbox-back-btn:hover {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fa3 100%);
  border-color: #ff6b9d;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 6px 18px rgba(255, 182, 193, 0.45);
}

/* 装饰元素 */
.mailbox-decorations {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

/* 网格粒子 */
.grid-particle {
  position: absolute;
  background: linear-gradient(135deg, rgba(255, 182, 193, 0.6) 0%, rgba(255, 107, 157, 0.4) 100%);
  border-radius: 50%;
  animation: particleFloat linear infinite;
  box-shadow: 0 2px 8px rgba(255, 182, 193, 0.3);
}

@keyframes particleFloat {
  0% {
    transform: translateY(100vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) rotate(720deg);
    opacity: 0;
  }
}
/* 花朵装饰 */
.decor-flower {
  position: absolute;
  font-size: 40px;
  animation: flowerFloat 4s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px rgba(255, 182, 193, 0.3));
}

.flower-1 {
  top: 10%;
  left: 8%;
  animation-delay: 0s;
}

.flower-2 {
  top: 15%;
  right: 10%;
  animation-delay: 1s;
}

.decor-leaf {
  position: absolute;
  font-size: 30px;
  animation: leafFloat 5s ease-in-out infinite;
  opacity: 0.7;
}

.leaf-1 {
  bottom: 20%;
  left: 12%;
  animation-delay: 0.5s;
}

.leaf-2 {
  bottom: 25%;
  right: 15%;
  animation-delay: 1.5s;
}

@keyframes flowerFloat {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-15px) rotate(10deg);
  }
}

@keyframes leafFloat {
  0%, 100% {
    transform: translateY(0) translateX(0) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) translateX(8px) rotate(-10deg);
  }
}

/* 云朵装饰 */
.decor-cloud {
  position: absolute;
  font-size: 60px;
  opacity: 0.15;
  animation: cloudDrift 20s linear infinite;
}

.cloud-1 {
  top: 15%;
  left: -10%;
}

.cloud-2 {
  top: 25%;
  right: -10%;
  animation-delay: -10s;
}

@keyframes cloudDrift {
  from {
    transform: translateX(-50px);
  }
  to {
    transform: translateX(calc(100vw + 50px));
  }
}

/* 四季邮箱 - 显示在最上层 */
.season-mailbox {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 30;
  cursor: pointer;
  pointer-events: none;
  /* 限定可点击区域为邮箱主体范围 */
  clip-path: polygon(25% 40%, 75% 40%, 80% 55%, 80% 100%, 20% 100%, 20% 55%);
}

.mailbox-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: auto;
}

.unread-badge-floating {
  position: absolute;
  top: 48%;
  right: 25%;
  background: linear-gradient(135deg, #ff4757 0%, #ff6b81 100%);
  color: white;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 20px;
  box-shadow: 0 4px 15px rgba(255, 71, 87, 0.4);
  border: 3.5px solid white;
  z-index: 100;
  pointer-events: none;
}

@keyframes badgeBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.1); }
}

.mailbox-3d {
  display: none;
}

.mailbox-3d-lid {
  display: none;
}

.mailbox-3d-body {
  display: none;
}

.mailbox-3d-slot {
  display: none;
}

.mailbox-3d-flag {
  display: none;
}

.flag-paper {
  display: none;
}

.unread-badge-3d {
  display: none;
}

.mailbox-3d-post {
  display: none;
}

.mailbox-3d-base {
  display: none;
}

/* 邮箱标题区域 - 邮箱上方 */
.mailbox-title-area {
  position: absolute;
  top: 180px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 25;
  width: 100%;
  max-width: 400px;
}

.main-title {
  font-size: 46px;
  color: #ffffff;
  font-weight: 900;
  margin: 0 0 16px 0;
  font-family: "huangkaihuaLawyerfont", cursive;
  letter-spacing: 6px;
  position: relative;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  animation: titleGlow 4s ease-in-out infinite;
}

@keyframes titleGlow {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.95;
  }
}

/* 春季标题特效 - 增强粉色多层光晕 */
.season-spring .main-title {
  color: #fff5fa !important;
  text-shadow: 
    2px 4px 8px rgba(0, 0, 0, 0.3),
    0 0 25px rgba(255, 182, 193, 1),
    0 0 50px rgba(255, 107, 157, 0.9),
    0 0 80px rgba(255, 182, 193, 0.7) !important;
  filter: drop-shadow(0 0 20px rgba(255, 182, 193, 0.9)) !important;
}

/* 夏季标题特效 - 增强蓝色多层光晕 */
.season-summer .main-title {
  color: #f5faff !important;
  text-shadow: 
    2px 4px 8px rgba(0, 0, 0, 0.3),
    0 0 25px rgba(135, 206, 250, 1),
    0 0 50px rgba(0, 191, 255, 0.9),
    0 0 80px rgba(135, 206, 250, 0.7) !important;
  filter: drop-shadow(0 0 20px rgba(135, 206, 250, 0.9)) !important;
}

/* 秋季标题特效 - 增强金色多层光晕 */
.season-autumn .main-title {
  color: #fffdf5 !important;
  text-shadow: 
    2px 4px 8px rgba(0, 0, 0, 0.3),
    0 0 25px rgba(255, 215, 0, 1),
    0 0 55px rgba(255, 165, 0, 0.9),
    0 0 90px rgba(255, 215, 0, 0.7) !important;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.9)) !important;
}

/* 冬季标题特效 - 增强冰蓝/白色多层光晕 */
.season-winter .main-title {
  color: #ffffff !important;
  text-shadow: 
    2px 4px 8px rgba(0, 0, 0, 0.3),
    0 0 30px rgba(255, 255, 255, 1),
    0 0 60px rgba(173, 216, 230, 0.9),
    0 0 100px rgba(255, 255, 255, 0.7),
    0 0 140px rgba(173, 216, 230, 0.6) !important;
  filter: drop-shadow(0 0 25px rgba(255, 255, 255, 1)) !important;
}

.sub-title {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 16px 0;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  font-weight: 600;
  letter-spacing: 1px;
}

.time-badge {
  display: inline-block;
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.9) 0%, rgba(255, 182, 193, 0.8) 100%);
  color: white;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 
    0 4px 15px rgba(255, 107, 157, 0.5),
    0 0 20px rgba(255, 182, 193, 0.4);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  letter-spacing: 1px;
}

/* 旧样式已删除 */

/* ===== 信件列表页 ===== */
.letter-list-page {
  min-height: 100vh;
  background: radial-gradient(circle at 50% 50%, #fef8f8 0%, #f5f7fa 100%);
  padding-bottom: 40px;
}

.header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.85);
  border-bottom: 2px solid rgba(255, 182, 193, 0.3);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(255, 182, 193, 0.15);
}

.back-btn, .write-btn {
  background: linear-gradient(135deg, #fff 0%, #fff5f7 100%);
  border: 2px solid rgba(255, 182, 193, 0.4);
  font-size: 20px;
  color: #ff6b9d;
  cursor: pointer;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(255, 182, 193, 0.25);
}

.back-btn:hover, .write-btn:hover {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fa3 100%);
  border-color: #ff6b9d;
  color: white;
  transform: scale(1.12) rotate(-10deg);
  box-shadow: 0 6px 18px rgba(255, 182, 193, 0.45);
}

.back-btn:active, .write-btn:active {
  transform: scale(0.95);
}

h2 {
  font-size: 24px;
  color: #5d4037;
  font-weight: 900;
  letter-spacing: 3px;
  text-shadow: 1px 1px 3px rgba(255, 182, 193, 0.2);
  font-family: "huangkaihuaLawyerfont", cursive;
}

.letter-list {
  padding: 25px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  position: relative;
  z-index: 1;
}

/* 信封基础样式 */
.letter-envelope {
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: envelopeFloat 3s ease-in-out infinite;
}

@keyframes envelopeFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.letter-envelope:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

/* 信件列表容器适配重工信封 */
.letter-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.letter-preview {
  padding: 20px 25px 15px 25px;
  position: relative;
  z-index: 20;
}

.letter-preview .title {
  font-size: 17px;
  font-weight: 900;
  color: #5d4037;
  margin-bottom: 8px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
  font-family: "huangkaihuaLawyerfont", cursive;
  transition: all 0.3s ease;
  position: relative;
  z-index: 10;
}

.letter-envelope:hover .letter-preview .title {
  color: #ff6b9d;
  transform: translateX(5px);
}

.unread-mark {
  display: inline-block;
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fa3 100%);
  color: white;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  margin-top: 6px;
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.35);
  animation: unreadPulse 2s ease-in-out infinite;
  position: relative;
  z-index: 10;
}

.author-tag {
  display: inline-block;
  background: linear-gradient(135deg, #ffd700 0%, #ffec8b 100%);
  color: #8b4513;
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 700;
  margin-top: 6px;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
  font-family: "huangkaihuaLawyerfont", cursive;
  position: relative;
  z-index: 10;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.author-tag i {
  margin-right: 4px;
  color: #ff8c00;
}

@keyframes unreadPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.9;
  }
}

.letter-preview .date {
  font-size: 12px;
  color: #b8a5b4;
  font-weight: 600;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 10;
}

.delete-letter-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(255, 182, 193, 0.4);
  color: #ffb6c1;
  font-size: 16px;
  cursor: pointer;
  padding: 10px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
}

.delete-letter-btn:hover {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fa3 100%);
  border-color: #ff6b9d;
  color: white;
  transform: rotate(15deg) scale(1.1);
  box-shadow: 0 4px 15px rgba(255, 107, 157, 0.4);
}

.wax-seal {
  font-size: 40px;
  background: radial-gradient(circle, #ff6b9d, #ff8fa3);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 
    0 4px 15px rgba(255, 107, 157, 0.45),
    0 2px 8px rgba(255, 107, 157, 0.25),
    inset 0 -3px 8px rgba(0,0,0,0.15);
  border: 5px double rgba(255, 255, 255, 0.6);
  position: relative;
  transition: all 0.3s ease;
  animation: sealPulse 2.5s ease-in-out infinite;
  z-index: 10;
}

@keyframes sealPulse {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.08) rotate(8deg);
  }
}

.letter-envelope:hover .wax-seal {
  animation: none;
  transform: scale(1.2) rotate(15deg);
  box-shadow: 
    0 6px 20px rgba(255, 107, 157, 0.6),
    0 4px 12px rgba(255, 107, 157, 0.45),
    inset 0 -3px 8px rgba(0,0,0,0.2);
}

.empty-state {
  text-align: center;
  padding: 120px 20px;
  position: relative;
  z-index: 1;
}

.letter-icon-bg { 
  font-size: 70px; 
  opacity: 0.25; 
  margin-bottom: 25px;
  animation: iconFloat 3s ease-in-out infinite;
}

@keyframes iconFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}

.empty-state p {
  font-size: 16px;
  color: #8b7355;
  font-weight: 600;
  font-family: "huangkaihuaLawyerfont", cursive;
  margin: 8px 0;
}

.empty-state .sub { 
  font-size: 13px; 
  color: #b8a5b4; 
  margin-top: 12px;
  letter-spacing: 1px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeInOverlay 0.3s ease;
}

@keyframes fadeInOverlay {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: linear-gradient(135deg, #fff 0%, #fdfaf5 100%);
  border-radius: 20px;
  padding: 30px;
  width: 90%;
  max-width: 450px;
  box-shadow: 
    0 20px 60px rgba(166, 124, 82, 0.3),
    0 10px 30px rgba(166, 124, 82, 0.2),
    inset 0 0 40px rgba(233, 224, 209, 0.3);
  border: 2px solid rgba(233, 224, 209, 0.5);
  animation: slideUpModal 0.4s ease;
}

@keyframes slideUpModal {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.title-input {
  width: 100%;
  padding: 15px;
  border: none;
  border-bottom: 3px solid rgba(233, 224, 209, 0.6);
  margin-bottom: 25px;
  font-weight: 700;
  outline: none;
  font-size: 18px;
  font-family: "huangkaihuaLawyerfont", cursive;
  background: rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
}

.title-input:focus {
  border-bottom-color: #ffb6c1;
  background: rgba(255, 182, 193, 0.05);
  box-shadow: 0 4px 15px rgba(255, 182, 193, 0.1);
}

.content-textarea {
  width: 100%;
  height: 300px;
  border: 2px solid rgba(233, 224, 209, 0.6);
  outline: none;
  font-family: "huangkaihuaLawyerfont", cursive;
  font-size: 17px;
  resize: none;
  line-height: 2;
  padding: 15px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  transition: all 0.3s ease;
  color: #4e342e;
}

.content-textarea:focus {
  border-color: #ffb6c1;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 20px rgba(255, 182, 193, 0.15);
}

.modal-actions {
  display: flex;
  gap: 15px;
  margin-top: 25px;
}

.cancel-btn, .save-btn {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  border: none;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: "huangkaihuaLawyerfont", cursive;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.cancel-btn {
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  color: #666;
}

.cancel-btn:hover {
  background: linear-gradient(135deg, #e0e0e0 0%, #d0d0d0 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}

.save-btn { 
  background: linear-gradient(135deg, #ffb6c1 0%, #ff69b4 100%);
  color: white;
  text-shadow: 1px 1px 2px rgba(255, 105, 180, 0.3);
}

.save-btn:hover {
  background: linear-gradient(135deg, #ff69b4 0%, #ff1493 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 25px rgba(255, 182, 193, 0.5);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ==========================================================================
   心动空间 - 乙游高级定制信封 (小清新 + 重工繁杂版)
   ========================================================================== */

/* ========== 1. 基础容器：绝对统一的基准尺寸 ========== */
.envelope-card {
  position: relative;
  width: 320px;
  height: 200px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 12px 35px rgba(100, 110, 140, 0.1);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.envelope-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 45px rgba(100, 110, 140, 0.15);
}

/* ========== 2. 通用结构组件 ========== */
/* 信封底层材质 */
.envelope-body {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
  border-radius: 4px;
  overflow: hidden;
  background: linear-gradient(135deg, #fdf6e8 0%, #f5e6d3 100%);
}

/* 内部繁杂边框 (双重边框感) */
.inner-border {
  position: absolute;
  top: 8px; left: 8px; right: 8px; bottom: 8px;
  z-index: 2;
  pointer-events: none;
}

/* 高级金属护角 (重工精髓) */
.corner-decor {
  position: absolute;
  width: 12px; height: 12px;
  z-index: 3;
  pointer-events: none;
}
.top-left { top: 4px; left: 4px; border-top: 2px solid; border-left: 2px solid; }
.top-right { top: 4px; right: 4px; border-top: 2px solid; border-right: 2px solid; }
.bottom-left { bottom: 4px; left: 4px; border-bottom: 2px solid; border-left: 2px solid; }
.bottom-right { bottom: 4px; right: 4px; border-bottom: 2px solid; border-right: 2px solid; }

/* 翻盖与双层滚边 */
.envelope-flap {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  z-index: 4;
  transform-origin: top;
}
.flap-secondary { z-index: 3; }

/* 装饰丝带 */
.ribbon { position: absolute; z-index: 3; }

/* 重工火漆印章底座 */
.wax-seal {
  position: absolute;
  z-index: 6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08), inset 0 0 0 4px #fff;
}
.wax-seal svg { width: 60%; height: 60%; }

/* 系列标签 (角标) */
.series-tag {
  position: absolute; 
  z-index: 15; 
  font-size: 10px; 
  letter-spacing: 2px;
  text-transform: uppercase; 
  font-weight: 900; 
  background: rgba(255,255,255,0.85);
  padding: 4px 10px; 
  backdrop-filter: blur(4px); 
  border-radius: 2px;
  pointer-events: none;
}

/* 信件来源身份标签 */
.author-tag-chic {
  position: absolute;
  z-index: 20;
  bottom: -15px; /* 移出信封底部边缘 */
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 900;
  color: #5d4037;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  border: 1px solid rgba(0,0,0,0.05);
}
.author-tag-chic i {
  font-size: 11px;
}
.author-tag-chic.user-badge {
  background: rgba(230, 230, 230, 0.9);
  color: #666;
}
.author-tag-chic.from-character {
  background: rgba(255, 248, 225, 0.9);
  color: #d4a017;
}

/* 信件内文字叠加层 */
.letter-content-overlay {
  position: absolute;
  top: 42px; /* 稍微下移到翻盖上方的空白区 */
  left: 0;
  width: 100%;
  text-align: center;
  z-index: 15; /* 确保在翻盖上方 */
  padding: 0 20px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.letter-content-overlay .letter-title {
  font-size: 16px;
  font-weight: 900;
  color: #5d4037;
  margin: 0;
  width: 100%;
  text-align: center;
  font-family: "huangkaihuaLawyerfont", cursive;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 未读气泡 (右上) */
.unread-pill {
  position: absolute;
  top: -10px;
  right: -10px;
  background: linear-gradient(135deg, #ff4757 0%, #ff6b81 100%);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 900;
  z-index: 50;
  box-shadow: 0 6px 15px rgba(255, 71, 87, 0.4);
  display: flex;
  align-items: center;
  gap: 4px;
}
.unread-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
}

/* ==========================================================================
   主题 1：晨曦蔷薇 (浅粉 + 玫瑰金)
   特色：交织网格暗纹，深 V 双层翻盖，蔷薇徽章
   ========================================================================== */
.style-rose  { --flap-point: 65%; }
.style-rose .envelope-body {
  background-color: #fff4f6;
  border: 2px solid #e2a8b9;
  background-image: repeating-linear-gradient(45deg, rgba(226, 168, 185, 0.1) 0, rgba(226, 168, 185, 0.1) 1px, transparent 1px, transparent 15px),
                    repeating-linear-gradient(-45deg, rgba(226, 168, 185, 0.1) 0, rgba(226, 168, 185, 0.1) 1px, transparent 1px, transparent 15px);
}
.style-rose .inner-border { border: 1px dashed #e2a8b9; }
.style-rose .corner-decor { border-color: #e2a8b9; }

.style-rose .envelope-flap { height: 65%; background-color: #fff9fa; border-bottom: 2px solid #e2a8b9; clip-path: polygon(0 0, 100% 0, 100% 40%, 50% 100%, 0 40%); }
.style-rose .flap-secondary { height: 72%; background-color: #fce8ed; clip-path: polygon(0 0, 100% 0, 100% 40%, 50% 100%, 0 40%); }

/* 通用火漆印章底座，确保 translate 居中基准存在 */
.wax-seal {
  position: absolute; 
  z-index: 6; 
  border-radius: 50%;
  display: flex; 
  align-items: center; 
  justify-content: center;
  background-color: #ffffff; 
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08), inset 0 0 0 4px #fff; 
}

/* 主题 1：晨曦蔷薇 - 翻盖高度是 65%，印章必须是 65% */
.style-rose .wax-seal {
  width: 52px; height: 52px; 
  top: var(--flap-point); left: 50%; 
  transform: translate(-50%, -50%); /* 绝对不能漏 */
  border: 1px solid #e2a8b9;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d6879e'%3E%3Cpath d='M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z' /%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 65%;
}

/* 主题 2：极光冰蓝 - 翻盖高度 55%，非居中排版 */
.style-snow .wax-seal {
  width: 48px; height: 48px; 
  top: var(--flap-point); right: 34px; 
  transform: translateY(-50%); /* 只需垂直居中 */
  border: 1px solid #a8c0d8;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2382a5c9'%3E%3Cpath d='M5,16L3,5L8.5,10L12,4L15.5,10L21,5L19,16H5M19,19A1,1 0 0,1 18,20H6A1,1 0 0,1 5,19V18H19V19Z' /%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 60%;
}

/* 主题 3：鸢尾浅紫 - 翻盖高度 50% */
.style-iris .wax-seal {
  width: 50px; height: 50px; 
  top: var(--flap-point); left: 50%; 
  transform: translate(-50%, -50%); 
  border: 1px solid #d4c4a8;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23bca0d3'%3E%3Cpath d='M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C17.16,16.36 15.31,15.5 14.39,13.97C13.47,12.44 13.7,10.47 14.93,9.17C11.33,9.17 8.17,11.9 8.17,15.67C8.17,19.44 11.33,22.17 14.93,22.17C17.53,22.17 19.82,20.73 21.03,18.57C19.61,19.33 17.16,19.33 18.97,15.95Z' /%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 65%;
}

/* 主题 4：琉璃薄荷 - 翻盖高度 50% */
.style-mint .wax-seal {
  width: 56px; height: 56px; 
  top: var(--flap-point); left: 50%; 
  transform: translate(-50%, -50%); 
  border: 1px solid #a3c9b3;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238bb893'%3E%3Cpath d='M11,2V7H6V11H11V22H13V11H18V7H13V2H11M12,4.5L14.5,7L12,9.5L9.5,7L12,4.5M7.5,12L10,14.5L7.5,17L5,14.5L7.5,12M16.5,12L19,14.5L16.5,17L14,14.5L16.5,12Z' /%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 65%;
}

/* 主题 5：暖阳洋甘菊 - 翻盖高度 70% */
.style-sun .wax-seal {
  width: 48px; height: 48px; 
  top: var(--flap-point); left: 50%; 
  transform: translate(-50%, -50%); 
  border: 1px dashed #e6c887;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d6ad4b'%3E%3Cpath d='M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,8.28C7.15,8.95 6.9,9.68 6.74,10.45L2,9.15L3.34,7M2.04,15.25L6.75,13.94C6.9,14.7 7.15,15.42 7.5,16.08L3.35,17.35L2.04,15.25M12,22L9.61,18.58C10.35,18.85 11.16,19 12,19C12.84,19 13.65,18.85 14.39,18.58L12,22M20.66,17.35L16.5,16.08C16.85,15.42 17.1,14.7 17.26,13.94L21.96,15.25L20.66,17.35M22,9.15L17.26,10.45C17.1,9.68 16.85,8.95 16.5,8.28L20.65,7L22,9.15Z' /%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 75%;
}

/* 主题 6：珍珠月光 - 翻盖高度 60% */
.style-pearl .wax-seal {
  width: 44px; height: 44px; 
  top: var(--flap-point); left: 50%; 
  transform: translate(-50%, -50%); 
  border: 1px solid #d1d9e6;
  z-index: 7;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a8b5c9'%3E%3Cpath d='M11.25,2L9,5.5L5,6L8,9L7.5,13L11.25,11.5L15,13L14.5,9L17.5,6L13.5,5.5L11.25,2M11.25,14.5L9,18L5,18.5L8,21.5L7.5,25.5L11.25,24L15,25.5L14.5,21.5L17.5,18.5L13.5,18L11.25,14.5Z' /%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: center; background-size: 60%;
}

/* ==========================================================================
   主题 2：极光冰蓝 (浅蓝 + 亮银)
   特色：不对称几何切割，纵向丝带，王冠徽章
   ========================================================================== */
.style-snow  { --flap-point: 55%; }
.style-snow .envelope-body {
  background-color: #f0f8ff;
  border: 2px solid #a8c0d8;
  background-image: radial-gradient(#a8c0d8 1px, transparent 1px);
  background-size: 12px 12px;
}
.style-snow .inner-border { border: 2px solid rgba(168, 192, 216, 0.4); top: 12px; left: 12px; right: 12px; bottom: 12px; }
.style-snow .corner-decor { border-color: #a8c0d8; width: 16px; height: 16px; }

.style-snow .ribbon { width: 36px; height: 100%; top: 0; right: 40px; background: rgba(255,255,255,0.6); border-left: 1px solid #a8c0d8; border-right: 1px solid #a8c0d8; }

.style-snow .envelope-flap { height: 55%; background-color: #ffffff; border-bottom: 2px solid #a8c0d8; clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 70%); }
.style-snow .flap-secondary { height: 60%; background-color: #e3f0fc; clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 70%); }

.style-snow .series-tag { position: absolute; top: 20px; left: 20px; color: #7597b9; font-size: 11px; z-index: 5; font-weight: 900; }

/* ==========================================================================
   主题 3：鸢尾浅紫 (淡紫 + 香槟金)
   特色：阶梯式翻盖，中央粗绶带，星月徽章
   ========================================================================== */
.style-iris  { --flap-point: 50%; }
.style-iris .envelope-body {
  background-color: #f8f4ff;
  border: 2px solid #d4c4a8;
  background-image: repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(212, 196, 168, 0.15) 4px, rgba(212, 196, 168, 0.15) 8px);
}
.style-iris .inner-border { border-top: 1px solid #d4c4a8; border-bottom: 1px solid #d4c4a8; left: 0; right: 0; }
.style-iris .corner-decor { display: none; }

.style-iris .ribbon { width: 100px; height: 100%; top: 0; left: 50%; transform: translateX(-50%); background: #ffffff; border-left: 1px dashed #d4c4a8; border-right: 1px dashed #d4c4a8; }

.style-iris .envelope-flap { height: 50%; background-color: #ffffff; border-bottom: 2px solid #d4c4a8; clip-path: polygon(0 0, 100% 0, 100% 60%, 75% 60%, 50% 100%, 25% 60%, 0 60%); }
.style-iris .flap-secondary { height: 55%; background-color: #f0e6f5; clip-path: polygon(0 0, 100% 0, 100% 60%, 75% 60%, 50% 100%, 25% 60%, 0 60%); }

.style-iris .series-tag { position: absolute; bottom: 20px; left: 20px; color: #a98cb8; font-size: 11px; z-index: 5; font-weight: 900; }

/* ==========================================================================
   主题 4：琉璃薄荷 (浅绿 + 白金)
   特色：横向贯穿丝带，大斜角翻盖，芒星十字徽章
   ========================================================================== */
.style-mint  { --flap-point: 50%; }
.style-mint .envelope-body {
  background-color: #f0fff4;
  border: 2px solid #a3c9b3;
}
.style-mint .inner-border { border: 1px solid #a3c9b3; top: 10px; left: 10px; right: 10px; bottom: 10px; }
.style-mint .corner-decor { border-color: #a3c9b3; border-width: 3px; }

.style-mint .ribbon { width: 100%; height: 36px; top: 50%; left: 0; background: #e3f5e7; border-top: 1px solid #a3c9b3; border-bottom: 1px solid #a3c9b3; }

.style-mint .envelope-flap { height: 50%; background-color: #ffffff; border-bottom: 2px solid #a3c9b3; clip-path: polygon(0 0, 100% 0, 100% 10%, 50% 100%, 0 10%); }

.style-mint .series-tag { position: absolute; top: 15px; right: 15px; color: #8bb893; font-size: 11px; z-index: 5; border-right: 3px solid #a3c9b3; padding-right: 8px; font-weight: 900; }

/* ==========================================================================
   主题 5：暖阳洋甘菊 (奶黄 + 暖金)
   特色：格纹暗纹，经典深信封排版，曜日徽章
   ========================================================================== */
.style-sun  { --flap-point: 70%; }
.style-sun .envelope-body {
  background-color: #fffbf0;
  border: 2px solid #e6c887;
  background-image: linear-gradient(90deg, transparent 95%, rgba(230, 200, 135, 0.2) 95%), linear-gradient(transparent 95%, rgba(230, 200, 135, 0.2) 95%);
  background-size: 15px 15px;
}
.style-sun .inner-border { border: 2px solid #e6c887; top: 4px; left: 4px; right: 4px; bottom: 4px; }
.style-sun .corner-decor { display: none; }

.style-sun .envelope-flap { height: 70%; background-color: #ffffff; border-bottom: 2px solid #e6c887; clip-path: polygon(0 0, 100% 0, 100% 30%, 50% 100%, 0 30%); }
.style-sun .flap-secondary { height: 75%; background-color: #fdf5df; clip-path: polygon(0 0, 100% 0, 100% 30%, 50% 100%, 0 30%); }

.style-sun .series-tag { position: absolute; bottom: 15px; left: 15px; color: #d6ad4b; font-size: 11px; z-index: 5; font-weight: 900; }

/* ==========================================================================
   主题 6：珍珠月光 (纯白 + 银灰蓝)
   特色：极简纯净但极其锋利的折纸切割感，宝石徽章
   ========================================================================== */
.style-pearl { --flap-point: 60%; }
.style-pearl .envelope-body { background-color: #ffffff; border: 2px solid #d1d9e6; }
.style-pearl .inner-border { border: 1px solid #d1d9e6; top: 6px; left: 6px; right: 6px; bottom: 6px; }
.style-pearl .corner-decor { border-color: #d1d9e6; border-width: 2px; }

.style-pearl .ribbon { width: 100%; height: 42px; top: 50%; transform: translateY(-50%); background: linear-gradient(90deg, rgba(209, 217, 230, 0.2), rgba(209, 217, 230, 0.4), rgba(209, 217, 230, 0.2)); border-top: 1px solid #d1d9e6; border-bottom: 1px solid #d1d9e6; }

.style-pearl .envelope-flap { height: 45%; background-color: #f8f9fc; border-bottom: 2px solid #d1d9e6; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 40%); }
.style-pearl .flap-secondary { height: 50%; background-color: #f0f2f8; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 40%); }

.style-pearl .envelope-label { top: 12px; right: 12px; color: #8a9ab0; }

/* 强制修复印章垂直偏移的终极代码 */
.wax-seal {
  /* 强制将印章的物理中心拉回坐标点，用 !important 碾压一切旧代码 */
  transform: translate(-50%, -50%) !important;
}

/* 如果你用了“极光冰蓝”主题，它的印章在右边，只需垂直向上拉一半 */
.style-snow .wax-seal {
  transform: translateY(-50%) !important;
}

/* 信件标题显示在信封上 */
.letter-title-on-envelope {
  position: absolute;
  z-index: 5;
  top: 25%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #4a4a4a;
  width: 80%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 2px;
  font-family: "huangkaihuaLawyerfont", cursive;
}

/* 调整来源标识位置 */
.source-badge {
  position: absolute;
  z-index: 10;
  bottom: 0px;
  left: 50%;
  transform: translate(-50%, 50%);
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 20px;
  font-size: 11px;
  font-weight: bold;
  color: #5c4b4b;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.source-badge i {
  font-size: 12px;
}
/* 角色来信特殊颜色标识 */
.source-badge i.fa-crown {
  color: #d6ad4b;
}
/* 我写的信特殊颜色标识 */
.source-badge.user-badge i.fa-pen-nib {
  color: #a8c0d8;
}

/* 适配到信件列表项 */
.letter-envelope .envelope-body {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 130px;
}

/* 信纸选择器样式 */
.paper-selector {
  margin: 15px 0;
  text-align: left;
}

.selector-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 600;
}

.paper-grid-container {
  overflow-x: auto;
  padding-bottom: 10px;
  margin-bottom: 5px;
}

/* 隐藏滚动条但保留功能 */
.paper-grid-container::-webkit-scrollbar {
  height: 4px;
}
.paper-grid-container::-webkit-scrollbar-thumb {
  background: rgba(255, 107, 157, 0.2);
  border-radius: 10px;
}

.paper-grid {
  display: flex;
  gap: 10px;
  padding: 5px;
  width: max-content;
}

.paper-item {
  width: 60px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid #eee;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
  background: #fdfdfd;
}

.paper-item.active {
  border-color: #ff6b9d;
  transform: scale(1.05);
  box-shadow: 0 4px 10px rgba(255, 107, 157, 0.3);
}

.paper-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.8;
}

.paper-item.active .paper-thumb {
  opacity: 1;
}

.check-mark {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #ff6b9d;
  color: white;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style>
