<template>
  <div class="h-full flex flex-col bg-[#f8f8f8] serif-container overflow-hidden">
    <!-- Top Bar / Magazine Header -->
    <div class="px-6 py-6 pt-10 flex items-end justify-between border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-[110]">
      <div class="flex flex-col">
        <button @click="$router.back()" class="text-gray-400 mb-2 w-fit">
          <i class="fa-solid fa-chevron-left text-sm"></i>
        </button>
        <p class="text-[9px] font-bold tracking-[0.4em] text-gray-400 uppercase">Archive Master v6.0</p>
        <h1 class="serif-title text-2xl mt-1 tracking-tight italic">
          个人档案 <span class="chinese-tag text-lg">THE ARCHIVE.</span>
        </h1>
      </div>
      <button 
        @click="runAnalysis"
        class="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-gray-800 shadow-sm active:scale-95 transition-all"
        :class="{ 'animate-spin': isAnalysisTyping }"
      >
        <i class="fa-solid fa-wand-magic-sparkles text-sm" :class="{ 'text-purple-500': !isAnalysisTyping }"></i>
      </button>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto px-6 pb-48 scroll-hide text-[13px] bg-white">
      <!-- Hero Layout -->
      <div class="mt-10 flex gap-6 relative">
        <div class="magazine-number top-0 -left-2">BIO</div>
        <div class="w-2/3 relative z-10">
          <div class="photo-frame">
            <img :src="character.avatar" alt="Avatar" class="w-full aspect-square object-cover bg-gray-50">
          </div>
        </div>
        <div class="w-1/3 flex flex-col justify-end pb-12">
          <div class="label-pill w-fit mb-2">FULL SCOPE</div>
          <div class="rotated text-[10px] font-bold tracking-[0.3em] text-gray-200 uppercase"
            style="writing-mode: vertical-rl; transform: rotate(180deg);">OFFICIAL DATA ARCHIVE</div>
        </div>
      </div>

      <div class="mt-8 text-left">
        <h2 class="serif-title text-5xl mb-2 tracking-tighter">{{ character.name }}</h2>
        <div class="flex items-center gap-2">
          <div class="h-[1.5px] bg-black w-10"></div>
          <p class="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em]">{{ bio.occupation || 'Personal Identity' }}</p>
        </div>
      </div>

      <!-- Identity: Basic Stats -->
      <div class="section-header">
        <h3 class="serif-title text-xl">身份规格 <span class="chinese-tag">Identity Specs</span></h3>
      </div>
      <div class="grid grid-cols-2 gap-y-6 gap-x-10 px-1">
        <div>
          <span class="stat-label">性别 <span class="chinese-tag">Gender</span></span>
          <span class="stat-value">{{ bio.gender }}</span>
        </div>
        <div>
          <span class="stat-label">人格 <span class="chinese-tag">MBTI</span><span class="mbti-badge">{{ bio.mbti }}</span></span>
          <span class="stat-value">{{ mbtiName(bio.mbti) }}</span>
        </div>
        <div>
          <span class="stat-label">生辰 <span class="chinese-tag">Birth</span></span>
          <span class="stat-value">{{ bio.birthday }}</span>
        </div>
        <div>
          <span class="stat-label">星座 <span class="chinese-tag">Zodiac</span></span>
          <span class="stat-value">{{ bio.zodiac }}</span>
        </div>
        <div>
          <span class="stat-label">身高 <span class="chinese-tag">Height</span></span>
          <span class="stat-value">{{ bio.height }}</span>
        </div>
        <div>
          <span class="stat-label">体重 <span class="chinese-tag">Weight</span></span>
          <span class="stat-value">{{ bio.weight }}</span>
        </div>
        <div>
          <span class="stat-label">身材 <span class="chinese-tag">Body</span></span>
          <span class="stat-value">{{ bio.body }}</span>
        </div>
        <div>
          <span class="stat-label">婚姻状况 <span class="chinese-tag">Status</span></span>
          <span class="stat-value text-pink-500">{{ bio.status }}</span>
        </div>
      </div>

      <!-- Lifestyle Tags -->
      <div class="section-header">
        <h3 class="serif-title text-xl">生活标签 <span class="chinese-tag">Lifestyle Labels</span></h3>
      </div>
      <div class="grid grid-cols-2 gap-y-6 gap-x-10 px-1">
        <div>
          <span class="stat-label">气味 <span class="chinese-tag">Scent</span></span>
          <span class="stat-value">{{ bio.scent }}</span>
        </div>
        <div>
          <span class="stat-label">风格 <span class="chinese-tag">Style</span></span>
          <span class="stat-value">{{ bio.style }}</span>
        </div>
      </div>

      <!-- Hobbies -->
      <div class="section-header">
        <h3 class="serif-title text-xl">兴趣爱好 <span class="chinese-tag">Hobbies & Passion</span></h3>
      </div>
      <div class="flex flex-wrap gap-2">
        <span v-for="hobby in bio.hobbies" :key="hobby" class="label-pill">{{ hobby }}</span>
        <span v-if="!bio.hobbies?.length" class="text-gray-300 italic">尚未解析兴趣...</span>
      </div>

      <!-- Routine -->
      <div class="section-header">
        <h3 class="serif-title text-xl">日常习惯 <span class="chinese-tag">Routine Diary</span></h3>
      </div>
      <div class="space-y-4">
        <div class="dot-line">
          <span class="stat-label uppercase tracking-widest text-[9px]">晨起 / Morning</span>
          <p class="mt-1 font-serif italic">{{ bio.routine?.awake }}</p>
        </div>
        <div class="dot-line border-gray-400">
          <span class="stat-label uppercase tracking-widest text-[9px]">忙碌 / Working</span>
          <p class="mt-1 font-serif italic">{{ bio.routine?.busy }}</p>
        </div>
        <div class="dot-line border-gray-200">
          <span class="stat-label uppercase tracking-widest text-[9px]">深夜 / Midnight</span>
          <p class="mt-1 font-serif italic">{{ bio.routine?.deep }}</p>
        </div>
      </div>

      <!-- Soul Ties -->
      <div v-if="bio.soulBonds?.length" class="section-header">
        <h3 class="serif-title text-xl">灵魂羁绊 <span class="chinese-tag">Soul Ties</span></h3>
      </div>
      <div v-for="bond in bio.soulBonds" :key="bond.label" class="dot-line border-black">
        <span class="stat-label">{{ bond.label }}</span>
        <p class="text-[13px] font-medium italic mt-1 font-serif">“{{ bond.text }}”</p>
      </div>

      <!-- Items of Love -->
      <div class="section-header">
        <h3 class="serif-title text-xl">爱之物 <span class="chinese-tag">Items of Love</span></h3>
      </div>
      <div class="grid grid-cols-3 gap-3 px-1 mb-10">
        <div v-for="(item, idx) in loveItems" :key="idx" class="flex flex-col items-center">
          <div class="love-photo-frame" :class="itemRotations[idx]">
             <div v-if="!item.image" class="w-full aspect-square bg-gray-50 flex items-center justify-center border border-dashed border-gray-200">
                <i class="fa-regular fa-image text-gray-200 text-xl"></i>
             </div>
             <img v-else :src="item.image" :alt="item.name" class="w-full aspect-square object-cover animate-fade-in">
          </div>
          <span class="text-[9px] mt-2 font-bold text-gray-400 uppercase tracking-tighter text-center line-clamp-1">
            {{ item.name || 'ITEM ' + (idx+1) }}
          </span>
        </div>
      </div>

      <!-- Heartbeat Moment -->
      <div v-if="bio.heartbeatMoment" class="mb-10 p-6 bg-pink-50/30 border-t-2 border-pink-200 italic font-light text-[13px] leading-relaxed relative">
        <div class="absolute -top-3 left-4 bg-white px-2 text-pink-400 font-bold text-[10px]">THE MOMENT</div>
        “ {{ bio.heartbeatMoment }} ”
      </div>

      <!-- Footer Quote Area -->
      <div class="mb-20 p-6 bg-gray-50 border-t-2 border-black italic font-light text-[13px] leading-relaxed">
        “ {{ bio.idealType || '我的世界里，你就是唯一的规格。' }} ”
      </div>
    </div>

    <!-- Loading Overlay -->
    <Transition name="fade">
      <div v-if="isAnalysisTyping" class="absolute inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
        <div class="relative">
          <div class="w-16 h-16 border-2 border-gray-100 border-t-purple-500 rounded-full animate-spin"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <i class="fa-solid fa-wand-magic-sparkles text-purple-500 animate-pulse"></i>
          </div>
        </div>
        <p class="mt-4 serif-title italic text-gray-500 tracking-widest text-sm animate-pulse">SOUL SEARCHING...</p>
        <p class="mt-1 text-[10px] text-gray-400 uppercase tracking-[0.2em]">正在深度检索灵魂档案</p>
      </div>
    </Transition>

    <!-- Footer Actions -->
    <div class="absolute bottom-0 left-0 right-0 p-8 pt-4 pb-10 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
      <div class="flex items-center justify-center gap-4">
        <button
          @click="$router.push({ path: '/wechat/moments', query: { author: charId } })"
          class="flex-1 h-12 border border-black text-black font-bold text-[10px] tracking-[0.2em] uppercase transition-all flex flex-col items-center justify-center leading-tight active:bg-gray-50"
        >
          <span>MOMENTS</span>
          <span class="text-[9px] font-normal tracking-tight opacity-50">朋友圈</span>
        </button>
        <button
          @click="goToChat"
          class="flex-1 h-12 bg-black text-white font-bold text-[10px] tracking-[0.2em] uppercase transition-all shadow-lg flex flex-col items-center justify-center leading-tight active:bg-gray-800"
        >
          <span>MESSAGE</span>
          <span class="text-[9px] font-normal tracking-tight opacity-50">发消息</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const charId = route.params.charId
const isAnalysisTyping = computed(() => !!chatStore.typingStatus[charId])

const character = computed(() => {
  if (charId === 'user') {
    const user = settingsStore.personalization.userProfile
    return {
      name: user.name || '我',
      avatar: user.avatar || '/avatars/user.png',
      bio: {
        gender: '未知',
        mbti: 'INTJ',
        birthday: '未知',
        zodiac: '未知',
        height: '未知',
        weight: '未知',
        body: '未知',
        status: '空闲',
        occupation: '小手机主理人',
        scent: '清淡',
        style: '简约',
        hobbies: ['编程', '设计', '由于'],
        routine: { awake: '8:00', busy: '10:00-18:00', deep: '23:00' },
        soulBonds: [],
        loveItems: [
          { name: '代码', image: '' },
          { name: '咖啡', image: '' },
          { name: '深夜', image: '' }
        ],
        idealType: '那个理解我的人',
        heartbeatMoment: '完成一次完美的发布'
      }
    }
  }
  return chatStore.chats[charId] || { name: '未知', avatar: '' }
})

// Bio Data from Store
const bio = computed(() => character.value.bio || {})
const loveItems = computed(() => bio.value.loveItems || [{}, {}, {}])

const itemRotations = ['rotate-[-3deg]', 'rotate-[2deg] z-10', 'rotate-[-1deg]']

const mbtiName = (code) => {
  const mapping = {
    'ENTJ': '指挥官', 'INTJ': '建筑师', 'ENPJ': '辩论家', 'INTP': '逻辑学家',
    'ENFJ': '主人公', 'INFJ': '提倡者', 'ENFP': '竞选者', 'INFP': '调解员',
    'ESTJ': '总经理', 'ISTJ': '物流师', 'ESFJ': '执政官', 'ISFJ': '守卫者',
    'ESTP': '企业家', 'ISTP': '鉴赏家', 'ESFP': '表演者', 'ISFP': '探险家'
  }
  return mapping[code?.toUpperCase()] || '未知人格'
}

const runAnalysis = () => {
  if (charId === 'user') {
    chatStore.triggerToast('个人档案无法对主理人进行灵魂检索', 'info')
    return
  }
  chatStore.analyzeCharacterArchive(charId)
}

const goToChat = () => {
  if (charId === 'user') {
    router.push('/wechat')
    return
  }
  chatStore.currentChatId = charId
  chatStore.updateCharacter(charId, { inChatList: true })
  router.push('/wechat')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Outfit:wght@300;400;600&family=Noto+Serif+SC:wght@400;700&family=Noto+Sans+SC:wght@300;400;500&display=swap');

.serif-container {
  font-family: 'Outfit', 'Noto Sans SC', sans-serif;
}

.serif-title {
  font-family: 'Playfair Display', 'Noto Serif SC', serif;
}

.magazine-number {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 5.5rem;
  color: rgba(0, 0, 0, 0.04);
  position: absolute;
  z-index: 0;
  line-height: 0.8;
}

.stat-label {
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #aaa;
  font-weight: 600;
  display: block;
  margin-bottom: 2px;
}

.stat-value {
  font-family: 'Playfair Display', 'Noto Serif SC', serif;
  font-size: 15px;
  font-weight: 700;
  color: #1a1a1a;
  display: block;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 3px;
  min-height: 24px;
}

.section-header {
  border-bottom: 2.5px solid #1a1a1a;
  padding-bottom: 4px;
  margin-top: 35px;
  margin-bottom: 20px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.chinese-tag {
  font-size: 11px;
  color: #b0b0b0;
  font-weight: 400;
  margin-left: 6px;
}

.photo-frame {
  position: relative;
  padding: 10px;
  background: white;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
  transform: rotate(-1.5deg);
  border: 1px solid #f0f0f0;
}

.love-photo-frame {
  position: relative;
  padding: 6px;
  background: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  border: 1px solid #f0f0f0;
  transition: transform 0.3s ease;
  width: 100%;
}

.love-photo-frame img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.dot-line {
  position: relative;
  padding-left: 20px;
  border-left: 1px solid #1a1a1a;
  margin-bottom: 20px;
}

.dot-line::before {
  content: '';
  position: absolute;
  left: -4.5px;
  top: 6px;
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 50%;
}

.scroll-hide::-webkit-scrollbar {
  display: none;
}

.label-pill {
  border: 1px solid #1a1a1a;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: bold;
  background: white;
  color: #000;
}

.mbti-badge {
  background: #000;
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 9px;
  margin-left: 6px;
  font-family: 'Outfit', sans-serif;
}

.animate-fade-in {
  animation: fadeIn 0.8s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.rotated {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
