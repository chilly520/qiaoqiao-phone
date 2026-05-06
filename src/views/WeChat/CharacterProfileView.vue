<template>
  <div class="h-full flex flex-col bg-[#f8f8f8] serif-container overflow-hidden">
    <!-- Top Bar / Magazine Header -->
    <div
      class="px-6 py-6 pt-10 flex items-end justify-between border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-[110]">
      <div class="flex flex-col">
        <button @click="$router.back()" class="text-gray-400 mb-2 w-fit">
          <i class="fa-solid fa-chevron-left text-sm"></i>
        </button>
        <p class="text-[9px] font-bold tracking-[0.4em] text-gray-400 uppercase">Archive Master v6.0</p>
        <h1 class="serif-title text-2xl mt-1 tracking-tight italic">
          个人档案 <span class="chinese-tag text-lg">THE ARCHIVE.</span>
        </h1>
      </div>
      <button @click="runAnalysis"
        class="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-gray-800 shadow-sm active:scale-95 transition-all"
        :class="{ 'animate-spin': isAnalysisTyping }">
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
          <span class="stat-label">人格 <span class="chinese-tag">MBTI</span><span class="mbti-badge">{{ bio.mbti
          }}</span></span>
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
            <div v-if="!item.image"
              class="w-full aspect-square bg-gray-50 flex items-center justify-center border border-dashed border-gray-200">
              <i class="fa-regular fa-image text-gray-200 text-xl"></i>
            </div>
            <img v-else :src="item.image" :alt="item.name" class="w-full aspect-square object-cover animate-fade-in">
          </div>
          <span class="text-[9px] mt-2 font-bold text-gray-400 uppercase tracking-tighter text-center line-clamp-1">
            {{ item.name || 'ITEM ' + (idx + 1) }}
          </span>
        </div>
      </div>

      <!-- Heartbeat Moment -->
      <div v-if="bio.heartbeatMoment"
        class="mb-10 p-6 bg-pink-50/30 border-t-2 border-pink-200 italic font-light text-[13px] leading-relaxed relative">
        <div class="absolute -top-3 left-4 bg-white px-2 text-pink-400 font-bold text-[10px]">THE MOMENT</div>
        “ {{ bio.heartbeatMoment }} ”
      </div>

      <!-- Footer Quote Area -->
      <div class="mb-20 p-6 bg-gray-50 border-t-2 border-black italic font-light text-[13px] leading-relaxed">
        “ {{ bio.idealType || '我的世界里，你就是唯一的规格。' }} ”
      </div>
    </div>

      <!-- NPC 专属操作按钮 -->
      <div v-if="character.isNewNPC" class="mt-8 space-y-3 border-t border-gray-100 pt-6">
        <button 
          @click="addToFriends"
          class="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
          <i class="fa-solid fa-user-plus"></i>
          <span>添加为好友</span>
        </button>
        
        <button 
          @click="triggerAvatarUpload"
          class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
          <i class="fa-solid fa-image"></i>
          <span>上传自定义头像</span>
        </button>
        
        <input 
          ref="avatarFileInput" 
          type="file" 
          class="hidden" 
          accept="image/*" 
          @change="handleAvatarUpload" 
        />
      </div>

      <!-- Loading Overlay -->
    <Transition name="fade">
      <div v-if="isAnalysisTyping"
        class="absolute inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
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
    <div
      class="absolute bottom-0 left-0 right-0 p-8 pt-4 pb-10 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
      <div class="flex items-center justify-center gap-4">
        <button @click="showMemoryLog = true"
          class="flex-1 h-12 border border-black text-black font-bold text-[10px] tracking-[0.2em] uppercase transition-all flex flex-col items-center justify-center leading-tight active:bg-gray-50">
          <span>🧠 MEMORY</span>
          <span class="text-[9px] font-normal tracking-tight opacity-50">记忆</span>
        </button>
        <button @click="$router.push({ path: '/wechat/moments', query: { author: charId } })"
          class="flex-1 h-12 border border-black text-black font-bold text-[10px] tracking-[0.2em] uppercase transition-all flex flex-col items-center justify-center leading-tight active:bg-gray-50">
          <span>MOMENTS</span>
          <span class="text-[9px] font-normal tracking-tight opacity-50">朋友圈</span>
        </button>
        <button @click="goToChat"
          class="flex-1 h-12 bg-black text-white font-bold text-[10px] tracking-[0.2em] uppercase transition-all shadow-lg flex flex-col items-center justify-center leading-tight active:bg-gray-800">
          <span>MESSAGE</span>
          <span class="text-[9px] font-normal tracking-tight opacity-50">发消息</span>
        </button>
      </div>

    <Teleport to="body">
      <div v-if="showMemoryLog" class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" @click.self="showMemoryLog = false">
        <div class="bg-white w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl animate-fade-in" @click.stop>
          <div class="sticky top-0 bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
            <h3 class="font-bold text-base">🧠 {{ character?.name || '' }}的记忆日志</h3>
            <div class="flex items-center gap-2">
              <button @click="memoryManageMode = !memoryManageMode"
                class="px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all"
                :class="memoryManageMode ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
                {{ memoryManageMode ? '完成' : '管理' }}
              </button>
              <button @click="showMemoryLog = false" class="w-8 h-8 rounded-full bg-white/80 shadow flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all">×</button>
            </div>
          </div>

          <div v-if="memoryManageMode && memoryLogs.length > 0" class="px-6 py-3 bg-purple-50/50 border-b border-gray-100 flex items-center justify-between">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" v-model="memorySelectAll" @change="toggleMemorySelectAll" class="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-400">
              <span class="text-[11px] font-medium text-gray-600">全选 ({{ selectedMemories.length }}/{{ memoryLogs.length }})</span>
            </label>
            <button @click="batchSummarizeMemories"
              :disabled="selectedMemories.length === 0 || isSummarizingMemories"
              class="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[11px] font-bold rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all flex items-center gap-1.5">
              <i class="fa-solid fa-wand-magic-sparkles text-xs" :class="{ 'animate-spin': isSummarizingMemories }"></i>
              {{ isSummarizingMemories ? '总结中...' : `总结选中 (${selectedMemories.length})` }}
            </button>
          </div>

          <div class="p-4 overflow-y-auto max-h-[60vh] space-y-2 text-xs">
            <div v-if="memoryLogs.length === 0" class="text-center py-8">
              <p class="text-gray-400 mb-4">暂无记忆记录</p>
              <button 
                v-if="character.msgs?.length"
                @click="rebuildMemory"
                class="px-4 py-2 border border-purple-200 text-purple-500 rounded-full text-[10px] font-bold tracking-widest hover:bg-purple-50 transition-colors">
                从聊天记录中同步记录
              </button>
            </div>
            <div v-for="(log, i) in memoryLogs" :key="i"
              class="p-2.5 rounded-xl leading-relaxed break-words transition-all relative group"
              :class="memoryManageMode ? 'bg-gray-50/80 hover:bg-purple-50 cursor-pointer' : 'bg-gray-50/80 text-gray-700'"
              @click="memoryManageMode ? toggleMemorySelect(i) : null">
              <div v-if="memoryManageMode" class="absolute top-3 left-3">
                <input type="checkbox" :checked="selectedMemories.includes(i)" @change="toggleMemorySelect(i)" @click.stop class="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-400">
              </div>
              <div :class="[memoryManageMode ? 'pl-8' : '', !memoryManageMode ? 'text-gray-700' : '']">{{ log }}</div>
            </div>
          </div>
          <div v-if="Object.keys(memoryFacts).length > 0" class="px-4 pb-4 border-t border-gray-100 pt-3">
            <h4 class="text-[11px] font-bold text-gray-400 mb-2 tracking-wider">👤 关键事实</h4>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="(v, k) in memoryFacts" :key="k"
                class="px-2 py-1 rounded-full bg-pink-50 text-pink-600 text-[10px] font-medium">{{ k }}: {{ v }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { compressImage } from '@/utils/imageUtils'
import { searchMemoryLog, getFacts, rebuildMemoryLog, appendLog } from '@/utils/memoryLog'
import { generateSummary } from '@/utils/aiService'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const charId = route.params.charId
const isAnalysisTyping = computed(() => !!chatStore.isProfileProcessing[charId])
const avatarFileInput = ref(null)
const showMemoryLog = ref(false)
const memoryLogs = computed(() => searchMemoryLog(charId, { limit: 100 }))
const memoryFacts = computed(() => getFacts(charId))

const memoryManageMode = ref(false)
const selectedMemories = ref([])
const memorySelectAll = ref(false)
const isSummarizingMemories = ref(false)

const toggleMemorySelect = (index) => {
  const idx = selectedMemories.value.indexOf(index)
  if (idx > -1) {
    selectedMemories.value.splice(idx, 1)
  } else {
    selectedMemories.value.push(index)
  }
  memorySelectAll.value = selectedMemories.value.length === memoryLogs.value.length
}

const toggleMemorySelectAll = () => {
  if (memorySelectAll.value) {
    selectedMemories.value = memoryLogs.value.map((_, i) => i)
  } else {
    selectedMemories.value = []
  }
}

const batchSummarizeMemories = async () => {
  if (selectedMemories.value.length === 0 || isSummarizingMemories.value) return

  isSummarizingMemories.value = true

  try {
    const chat = chatStore.chats[charId]
    if (!chat) throw new Error('角色不存在')

    const selectedLogs = selectedMemories.value.map(i => memoryLogs.value[i]).filter(Boolean)
    if (selectedLogs.length === 0) throw new Error('没有选中的记忆')

    const contentToSummarize = selectedLogs.join('\n\n---\n\n')
    const prompt = '请将以下多条记忆碎片整合总结为一条精简的长期记忆，保留关键信息、情感变化和重要事件，去除冗余细节。以第三人称客观描述，控制在150字以内。'

    const summaryContext = [{
      role: 'user',
      content: `【待总结的记忆碎片】\n${contentToSummarize}\n\n【总结要求】\n${prompt}`
    }]

    const systemHelper = '你是一个专业的记忆整理助手。请阅读上方的记忆碎片，并严格按照要求输出整合后的记忆内容。直接输出结果，不要包含任何旁白或解释。'

    const summaryContent = await generateSummary(summaryContext, systemHelper)

    if (!summaryContent || summaryContent.startsWith('总结生成失败')) {
      throw new Error(summaryContent || 'AI返回空内容')
    }

    const sortedIndices = [...selectedMemories.value].sort((a, b) => b - a)
    sortedIndices.forEach(idx => {
      if (chat.memoryLog && idx < chat.memoryLog.length) {
        chat.memoryLog.splice(idx, 1)
      }
    })

    appendLog(charId, { type: '📝', content: `[记忆整合] ${summaryContent.substring(0, 120)}`, time: Date.now() })

    chatStore.triggerToast(`✅ 已整合 ${selectedLogs.length} 条记忆为新记忆`, 'success')
    chatStore.saveChats()

    selectedMemories.value = []
    memorySelectAll.value = false
    memoryManageMode.value = false
  } catch (error) {
    console.error('[批量总结失败]', error)
    chatStore.triggerToast('总结失败: ' + error.message, 'error')
  } finally {
    isSummarizingMemories.value = false
  }
}

const rebuildMemory = () => {
  rebuildMemoryLog(charId)
  chatStore.triggerToast('记忆同步工作已完成', 'success')
  chatStore.saveChats()
}

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
  const charData = chatStore.chats[charId]
  return charData || { name: '未知', avatar: '' }
})

// Bio Data from Store
const bio = computed(() => character.value.bio || {})
const loveItems = computed(() => bio.value.loveItems || [{}, {}, {}])

const itemRotations = ['rotate-[-3deg]', 'rotate-[2deg] z-10', 'rotate-[-1deg]']

const mbtiName = (code) => {
  const mapping = {
    'ENTJ': '指挥官', 'INTJ': '建筑师', 'ENTP': '辩论家', 'INTP': '逻辑学家',
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

// NPC 专属功能：添加为好友
const addToFriends = async () => {
  try {
    // 更新角色状态，标记为已在聊天列表
    await chatStore.updateCharacter(charId, { 
      inChatList: true,
      isNewNPC: false // 移除新 NPC 标记
    })
    
    // 确保 chat 对象存在
    if (!chatStore.chats[charId]) {
      chatStore.chats[charId] = {
        id: charId,
        name: character.value.name,
        avatar: character.value.avatar,
        isNPC: character.value.isNPC,
        bio: character.value.bio || {},
        messages: [],
        inChatList: true
      }
    }
    
    chatStore.triggerToast(`已添加 ${character.value.name} 为好友`, 'success')
    
    // 延迟一下再跳转，让用户看到提示
    setTimeout(() => {
      router.push('/wechat')
    }, 500)
  } catch (error) {
    console.error('添加好友失败:', error)
    chatStore.triggerToast('添加好友失败', 'error')
  }
}

// NPC 专属功能：触发头像上传
const triggerAvatarUpload = () => {
  if (avatarFileInput.value) {
    avatarFileInput.value.click()
  }
}

// NPC 专属功能：处理头像上传
const handleAvatarUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const base64 = await compressImage(file, { maxWidth: 400, quality: 0.7 })

    await chatStore.updateCharacter(charId, { avatar: base64 })

    if (chatStore.chats[charId]) {
      chatStore.chats[charId].avatar = base64
    }

    character.value.avatar = base64

    chatStore.triggerToast('头像已更新', 'success')

    event.target.value = ''
  } catch (error) {
    console.error('上传头像失败:', error)
    chatStore.triggerToast('上传失败', 'error')
  }
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
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
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
