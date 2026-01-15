<template>
  <div class="h-full flex flex-col bg-[#f2f2f2]">
    <!-- Top Bar -->
    <div class="h-[72px] pt-7 flex items-center px-4 absolute top-0 left-0 right-0 z-10">
      <button @click="$router.back()" class="text-gray-700 mr-auto">
        <i class="fa-solid fa-chevron-left text-xl"></i>
      </button>
      <button @click="generateProfile" class="text-gray-700 ml-auto" title="AI生成置顶和背景">
        <i class="fa-solid fa-wand-sparkles text-xl text-purple-500"></i>
      </button>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar">
      <!-- Background Image -->
      <div class="relative w-full h-[280px] bg-gray-300" @click="showBackgroundModal = true">
        <img :src="characterBackground" class="w-full h-full object-cover">
        
        <!-- Character Avatar & Name -->
        <div class="absolute -bottom-12 left-4 flex items-end gap-3">
          <div class="relative w-20 h-20">
            <!-- Avatar Container (Forced Square, No Frame) -->
            <div class="absolute overflow-hidden bg-white transition-all duration-300 rounded-lg border-4 border-white shadow-lg w-full h-full top-0 left-0">
              <img :src="character.avatar" class="w-full h-full object-cover">
            </div>
          </div>
        </div>
      </div>
      
      <!-- Character Info -->
      <div class="mt-14 px-4">
        <div class="text-xl font-bold text-gray-800">{{ character.name }}</div>
        
        <!-- Location Display -->
        <div v-if="virtualCityDisplay" class="flex items-center gap-1 mt-1 text-xs text-gray-500 font-medium">
            <i class="fa-solid fa-location-dot text-blue-400"></i>
            <span>{{ virtualCityDisplay }}</span>
        </div>
        <div 
          class="text-sm text-gray-500 mt-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors active:bg-gray-200" 
          @click="editBio"
          :class="!characterBio ? 'italic' : ''"
        >
          {{ characterBio || '此人还没有个性签名。' }}
        </div>
      </div>

      <!-- Pinned Moments Section -->
      <div v-if="pinnedMoments.length > 0" class="mt-6 px-4">
        <div class="flex items-center mb-3">
          <span class="text-sm font-bold text-gray-600">置顶</span>
          <i class="fa-solid fa-thumbtack text-xs text-gray-400 ml-1"></i>
        </div>
        
        <div class="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          <div 
            v-for="moment in pinnedMoments" 
            :key="moment.id"
            class="flex-shrink-0 w-32 h-32 bg-white rounded-xl overflow-hidden cursor-pointer shadow-sm active:scale-95 transition-transform"
            @click="viewMomentDetail(moment)"
          >
            <!-- Image preview if available -->
            <img v-if="moment.images && moment.images[0]" 
                 :src="moment.images[0]" 
                 class="w-full h-full object-cover">
            <!-- Text preview if no image -->
            <div v-else class="p-2 text-xs text-gray-600 line-clamp-6">{{ moment.content }}</div>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="mt-6">
        <div class="px-4 mb-3">
          <span class="text-sm font-bold text-gray-600">朋友圈</span>
        </div>
        
        <!-- Moments List -->
        <div v-if="characterMoments.length > 0" class="space-y-0">
          <MomentItem 
            v-for="moment in characterMoments" 
            :key="moment.id" 
            :moment="moment"
          />
        </div>
        <div v-else class="py-12 text-center text-gray-400 text-sm">
          <i class="fa-regular fa-image block mb-2 text-2xl"></i>
          暂无朋友圈
        </div>
      </div>
    </div>
    
    <!-- Background Modal -->
    <div v-if="showBackgroundModal" class="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-6" @click.self="showBackgroundModal = false">
        <div class="bg-white w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            <div class="p-5 pt-8">
                <div class="text-center font-bold text-gray-800 mb-6 text-lg">自定义背景图</div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">图片URL</label>
                        <input 
                            v-model="backgroundInput"
                            type="text"
                            placeholder="https://example.com/image.jpg"
                            class="w-full bg-gray-50 px-4 py-3 rounded-xl outline-none border border-gray-100"
                        >
                        <button 
                            class="w-full mt-2 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm active:bg-blue-600"
                            @click="setBackgroundFromUrl"
                        >
                            使用此URL
                        </button>
                    </div>
                    
                    <div class="text-center text-xs text-gray-400">或</div>
                    
                    <div>
                        <label class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">本地上传</label>
                        <input 
                            type="file" 
                            ref="backgroundFileInput" 
                            class="hidden" 
                            accept="image/*" 
                            @change="handleBackgroundFileUpload"
                        >
                        <button 
                            class="w-full py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-gray-600 active:bg-gray-100"
                            @click="backgroundFileInput.click()"
                        >
                            <i class="fa-solid fa-upload"></i>
                            <span class="text-sm font-bold">选择图片文件</span>
                        </button>
                    </div>
                </div>
                
                <button 
                    class="w-full mt-6 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
                    @click="showBackgroundModal = false"
                >
                    取消
                </button>
            </div>
        </div>
    </div>
    
    <!-- Edit Bio Modal -->
    <div v-if="showBioModal" class="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-6" @click.self="showBioModal = false">
        <div class="bg-white w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            <div class="p-5 pt-8">
                <div class="text-center font-bold text-gray-800 mb-6 text-lg">个性签名</div>
                
                <textarea 
                    v-model="bioInput"
                    class="w-full bg-gray-50 px-4 py-3 rounded-xl outline-none border border-gray-100 min-h-[100px] resize-none"
                    placeholder="写下你的个性签名..."
                    maxlength="100"
                ></textarea>
                
                <div class="text-xs text-gray-400 text-right mt-1">{{ bioInput.length }}/100</div>
                
                <div class="flex gap-2 mt-4">
                    <button 
                        class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
                        @click="showBioModal = false"
                    >
                        取消
                    </button>
                    <button 
                        class="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold active:bg-blue-600"
                        @click="saveBio"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { useMomentsStore } from '@/stores/momentsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { CITY_MAPPING } from '@/utils/weatherService'
import MomentItem from '@/components/MomentItem.vue'
import { generateCompleteProfile } from '@/utils/aiService'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const momentsStore = useMomentsStore()
const settingsStore = useSettingsStore()

const charId = route.params.charId
const character = computed(() => chatStore.chats[charId] || { name: '未知', avatar: '' })

// Virtual Location Logic
const virtualCityDisplay = computed(() => {
    if (!character.value.locationSync) return null
    
    const w = settingsStore.weather
    if (w.virtualLocation) return w.virtualLocation
    
    // Mapping fallback
    const real = w.realLocation // Assuming realLocation stores "深圳" etc.
    if (real) {
        // Try exact match or match first 2 chars (e.g. 深圳市 -> 深圳)
        for (const k in CITY_MAPPING) {
            if (real.includes(k)) return CITY_MAPPING[k]
        }
        return real
    }
    return null
})

// Default backgrounds from local folder
const defaultBackgrounds = [
    '/默认背景图/橙玫瑰.png',
    '/默认背景图/粉玫瑰.png',
    '/默认背景图/紫玫瑰.png',
    '/默认背景图/红玫瑰.png'
]

// Get initial background - use saved or random default
const getInitialBg = () => {
    const saved = localStorage.getItem(`char_bg_${charId}`)
    if (saved) return saved
    return defaultBackgrounds[Math.floor(Math.random() * defaultBackgrounds.length)]
}

// Character-specific data
const characterBackground = ref(getInitialBg())
const characterBio = ref(localStorage.getItem(`char_bio_${charId}`) || '')
const pinnedMomentIds = ref(JSON.parse(localStorage.getItem(`char_pinned_${charId}`) || '[]'))

// Background modal
const showBackgroundModal = ref(false)
const backgroundInput = ref('')
const backgroundFileInput = ref(null)

// Bio edit modal
const showBioModal = ref(false)
const bioInput = ref('')

const editBio = () => {
    bioInput.value = characterBio.value || ''
    showBioModal.value = true
}

const saveBio = () => {
    characterBio.value = bioInput.value.trim()
    localStorage.setItem(`char_bio_${charId}`, characterBio.value)
    
    // Add to chat context if it's user's bio
    if (charId === 'user') {
        const timestamp = new Date().toLocaleString('zh-CN')
        chatStore.addSystemMessage(`用户的个性签名为：${characterBio.value || '[空]'}，更改时间为 ${timestamp}`)
    }
    
    showBioModal.value = false
    chatStore.triggerToast('已保存个性签名', 'success')
}

// Computed
const pinnedMoments = computed(() => {
  return pinnedMomentIds.value
    .map(id => momentsStore.moments.find(m => m.id === id))
    .filter(m => m)
})

const characterMoments = computed(() => {
  return momentsStore.moments
    .filter(m => m.authorId === charId)
    .sort((a, b) => b.timestamp - a.timestamp)
})

// Generate profile content (merged single API call)
const generateProfile = async () => {
  chatStore.triggerToast('正在生成角色主页（置顶+背景）...', 'info')
  
  try {
    // Call AI service to generate EVERYTHING in one request
    const { pinnedMoments: pinned, backgroundUrl, bio } = await generateCompleteProfile(character.value)
    
    // Update background
    if (backgroundUrl) {
      characterBackground.value = backgroundUrl
      localStorage.setItem(`char_bg_${charId}`, backgroundUrl)
    }
    
    // Add pinned moments to store
    const pinnedIds = []
    for (const momentData of pinned) {
      const moment = momentsStore.addMoment({
        authorId: charId,
        content: momentData.content,
        images: momentData.images || [],
        imageDescriptions: momentData.imageDescriptions || [],
        html: momentData.html || null,
        isPinned: true
      })
      pinnedIds.push(moment.id)
    }
    
    pinnedMomentIds.value = pinnedIds
    localStorage.setItem(`char_pinned_${charId}`, JSON.stringify(pinnedIds))
    
    // Update bio if provided
    if (bio) {
      characterBio.value = bio
      localStorage.setItem(`char_bio_${charId}`, bio)
    }
    
    chatStore.triggerToast('✨ 角色主页生成成功！', 'success')
  } catch (e) {
    console.error('[Profile] Generation failed:', e)
    chatStore.triggerToast('❌ 生成失败: ' + e.message, 'error')
  }
}

// Background customization
const setBackgroundFromUrl = () => {
  if (backgroundInput.value.trim()) {
    characterBackground.value = backgroundInput.value.trim()
    localStorage.setItem(`char_bg_${charId}`, characterBackground.value)
    showBackgroundModal.value = false
    chatStore.triggerToast('背景图已更新', 'success')
  }
}

const handleBackgroundFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  if (file.size > 10 * 1024 * 1024) {
    chatStore.triggerToast('图片太大 (限制10MB)', 'error')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    characterBackground.value = e.target.result
    localStorage.setItem(`char_bg_${charId}`, characterBackground.value)
    showBackgroundModal.value = false
    chatStore.triggerToast('背景图已更新', 'success')
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

const viewMomentDetail = (moment) => {
  // Navigate to moment detail or open in modal
  // For now, just scroll to it in the list
  const element = document.querySelector(`[data-moment-id="${moment.id}"]`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
</script>
