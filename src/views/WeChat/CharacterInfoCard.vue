<template>
  <div class="h-full flex flex-col bg-[#f5f5f5] overflow-hidden font-sans">
    <!-- 1. Top Header Area (Dark + Avatar Background) -->
    <div class="relative h-[42%] shrink-0">
      <!-- Background Image -->
      <div class="absolute inset-0">
        <img :src="character.avatar" class="w-full h-full object-cover">
        <!-- Overlay for text readability (Gradient from top-left) -->
        <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
      </div>

      <!-- Navigation Bar (Absolute) -->
      <div class="absolute top-0 left-0 w-full p-2 z-50 flex items-center">
        <button @click="$router.back()" class="w-10 h-10 flex items-center justify-center text-white active:opacity-70">
          <i class="fa-solid fa-chevron-left text-xl"></i>
        </button>
      </div>

      <!-- User Info (Absolute Positioning) -->
      <div class="absolute bottom-[40px] left-6 right-6 z-20">
        <!-- Name -->
        <h1 class="text-[32px] font-bold text-white leading-tight mb-1 shadow-sm tracking-wide">
          {{ character.name }}
        </h1>
        
        <!-- ID & Signature Pill Row -->
        <div class="flex items-center flex-wrap gap-3">
          <span class="text-gray-300 text-sm font-medium tracking-wide opacity-90">微信号: {{ character.id || 'wxid_ai_generated' }}</span>
          
          <!-- Location Pill -->
          <div v-if="virtualCityDisplay" class="px-3 py-1 rounded-full bg-blue-500/30 backdrop-blur-md border border-blue-200/20 text-[11px] text-blue-50 flex items-center gap-1 shadow-sm">
            <i class="fa-solid fa-location-dot text-[10px]"></i>
            {{ virtualCityDisplay }}
          </div>
          
          <!-- Signature Pill (Glassmorphism) -->
          <div class="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-[11px] text-white/90 flex items-center">
            {{ momentsSignature }}
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Floating Action Card (Overlapping Header) -->
    <div class="relative z-30 -mt-6 mx-4 bg-white rounded-[24px] shadow-[0_8px_20px_rgba(0,0,0,0.06)] p-5 flex flex-col gap-6">
      
      <!-- Moments Entry (Styled as a block) -->
      <div @click="goToMoments"
           class="bg-[#f9f9f9] rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer border border-gray-50">
        <div class="flex items-center gap-4">
          <!-- Icon -->
          <div class="w-12 h-12 rounded-[14px] bg-[#ffecd2] flex items-center justify-center shrink-0">
            <i class="fa-solid fa-camera text-[#ff9638] text-xl transform -rotate-6"></i>
          </div>
          <!-- Text -->
          <div class="flex flex-col">
            <span class="text-[#1a1a1a] font-bold text-[17px]">朋友圈</span>
            <span class="text-gray-400 text-xs mt-0.5">查看Ta的历史动态</span>
          </div>
        </div>
        <!-- Arrow -->
        <i class="fa-solid fa-chevron-right text-gray-300 text-sm"></i>
      </div>

      <!-- Send Message Button (WeChat Green) -->
      <button @click="handleSendMessage"
              class="w-full bg-[#07c160] hover:bg-[#06ad56] active:bg-[#05984b] text-white h-[56px] rounded-full flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all">
        <i class="fa-solid fa-comment-dots text-xl transform scale-x-[-1]"></i>
        <span class="text-[17px] font-bold tracking-wide">发消息</span>
      </button>
    </div>

    <!-- 3. Bottom Bio Section -->
    <div class="flex-1 overflow-y-auto px-6 py-6">
      <div class="flex items-center gap-2 mb-3 px-1">
         <span class="text-xs font-bold text-gray-400">简介</span>
         <div class="h-[1px] flex-1 bg-gray-200"></div>
      </div>
      
      <!-- Bio Card -->
      <div class="relative">
        <!-- Quote Icon -->
        <i class="fa-solid fa-quote-left text-gray-200 text-3xl absolute -top-2 -left-2 z-0"></i>
        
        <div class="relative z-10 text-[15px] text-[#4a4a4a] leading-relaxed font-medium pl-3 pt-2">
            {{ characterIntro }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'
import { useMomentsStore } from '@/stores/momentsStore'
import { CITY_MAPPING } from '@/utils/weatherService'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const momentsStore = useMomentsStore()
const settingsStore = useSettingsStore()

const charId = route.params.charId

const character = computed(() => {
    if (charId === 'user') {
        const user = settingsStore.personalization.userProfile
        return {
            id: user.wechatId || 'my_id',
            name: user.name || '我',
            avatar: user.avatar || '/avatars/DefaultUser.jpg',
            gender: 'male',
            prompt: user.bio,
            remark: '我自己',
            locationSync: false // User usually doesn't sync location relative to self here
        }
    }
    return chatStore.chats[charId] || { name: '未知', avatar: '', gender: 'male', prompt: '' }
})

const virtualCityDisplay = computed(() => {
    if (!character.value.locationSync) return null
    
    // Check global weather store
    const w = settingsStore.weather
    if (w.virtualLocation) return w.virtualLocation
    
    // Mapping fallback from realLocation
    const real = w.realLocation 
    if (real) {
        for (const k in CITY_MAPPING) {
            if (real.includes(k)) return CITY_MAPPING[k]
        }
        return real
    }
    return null
})

const momentsSignature = ref('')

onMounted(() => {
    // Fetch moments signature from localStorage
    const savedBio = localStorage.getItem(`char_bio_${charId}`)
    momentsSignature.value = savedBio || '暂无个性签名'
})

// Full Bio for bottom (Intro/Prompt)
const characterIntro = computed(() => {
    const char = character.value
    // Should display the Persona/Prompt
    if (char.prompt) {
        return char.prompt
    }
    return '这个人很神秘,什么都没有留下...'
})

const previewMoments = computed(() => {
    return momentsStore.moments
        .filter(m => m.authorId === charId && m.images && m.images.length > 0)
        .slice(0, 3)
        .map(m => m.images[0])
})

const goToMoments = () => {
    router.push({ name: 'character-profile', params: { charId } })
}

const handleSendMessage = () => {
    if (charId === 'user') {
        router.push('/wechat')
        return
    }
    chatStore.currentChatId = charId
    router.push('/wechat')
}
</script>
