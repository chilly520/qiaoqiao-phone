<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useStickerStore } from '../../stores/stickerStore'
import { useChatStore } from '../../stores/chatStore'
import { marked } from 'marked'
import SafeHtmlCard from '../../components/SafeHtmlCard.vue'

const route = useRoute()
const router = useRouter()
const favoritesStore = useFavoritesStore()

const itemId = route.params.id
const item = computed(() => {
    return favoritesStore.favorites.find(f => f.id == itemId)
})
const stickerStore = useStickerStore()
const chatStore = useChatStore()

// Combined Sticker Search Scope (Computed for efficiency)
const allStickers = computed(() => {
    const global = stickerStore.customStickers || []
    const charStickers = Object.values(chatStore.chats).flatMap(c => c.emojis || [])
    return [...global, ...charStickers]
})

// Special Content Parsing (Sticker / Card)
const specialContent = computed(() => {
    if (!item.value) return null
    if (item.value.type !== 'text' && item.value.type !== 'sticker') return null
    const content = item.value.content || ''

    // 1. HTML Card
    if (content.startsWith('[CARD]')) {
        try {
            const json = JSON.parse(content.replace('[CARD]', '').trim())
            if (json.type === 'html') {
                 return { type: 'html', html: json.html }
            }
        } catch (e) {
            console.error('Invalid Card JSON', e)
        }
    }

    // 2. Sticker
    const stickerMatch = content.match(/\[(表情包|Sticker)\s*[:：]\s*([^\]]+)\]/i)
    if (stickerMatch) {
         const val = stickerMatch[2].trim()
         if (val.startsWith('http') || val.startsWith('data:')) {
             return { type: 'sticker', url: val }
         }
         // Name Lookup
         const found = allStickers.value.find(s => s.name === val)
         if (found) return { type: 'sticker', url: found.url }
         
         // Fallback
         return { type: 'sticker_placeholder', name: val }
    }
    
    return null
})

const deleteCurrentItem = () => {
    if (confirm('确认删除这条收藏吗?')) {
        favoritesStore.removeFavorite(itemId)
        router.back()
    }
}

const goBack = () => {
    router.back()
}

// Inner Voice Parsing
const parsedInnerVoice = computed(() => {
    if (!item.value) return null
    if (item.value.type !== 'text' && item.value.type !== 'ai') return null
    
    // Check for [INNER_VOICE] tag
    const match = item.value.content.match(/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i)
    if (match) {
        try {
            return JSON.parse(match[1])
        } catch (e) {
            console.error('Failed to parse inner voice', e)
            return null
        }
    }
    // Also try direct JSON if it looks like it
    if (item.value.content.trim().startsWith('{') && item.value.content.includes('"着装"')) {
         try {
            return JSON.parse(item.value.content)
        } catch (e) {
            return null
        }
    }
    return null
})

// Helper to safely parse potentially double-encoded JSON in specific fields
const safeJsonParse = (str) => {
    if (typeof str !== 'string') return null
    try {
        return JSON.parse(str)
    } catch {
        return null
    }
}

const formattedThoughts = computed(() => {
    if (!parsedInnerVoice.value) return null
    
    // Check if '心声' is a JSON string
    const thoughtsRaw = parsedInnerVoice.value.心声 || parsedInnerVoice.value.thoughts
    const parsed = safeJsonParse(thoughtsRaw)
    
    if (parsed && typeof parsed === 'object') {
        return parsed // { "心情": "...", "情绪": "...", ... }
    }
    return null // Return null if it's just a text string, handled by fallback
})

// Clean Content (Remove Inner Voice tag if parsed)
const cleanContent = computed(() => {
    if (!item.value) return ''
    if (parsedInnerVoice.value) {
        return item.value.content.replace(/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i, '').trim()
    }
    return item.value.content
})

const formatDate = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString()
}
</script>

<template>
    <div class="h-full bg-gray-100 flex flex-col">
        <!-- Header -->
        <div class="h-[44px] bg-white flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
             <div class="flex items-center gap-1 cursor-pointer w-20" @click="goBack">
                <i class="fa-solid fa-chevron-left text-black"></i>
                <span class="font-bold text-base text-black">返回</span>
            </div>
            <div class="font-bold text-base">详情</div>
            <div class="w-20 flex justify-end">
                <i class="fa-solid fa-trash text-gray-800 cursor-pointer p-2" @click="deleteCurrentItem"></i>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4" v-if="item">
            
            <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
                 <!-- Meta -->
                 <div class="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                     <img v-if="item.authorAvatar || item.avatar" :src="item.authorAvatar || item.avatar" class="w-10 h-10 rounded-full bg-gray-200 object-cover">
                     <div v-else class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500">
                         {{ item.author?.[0] || '?' }}
                     </div>
                     <div>
                         <div class="font-bold text-gray-900">{{ item.author }}</div>
                         <div class="text-xs text-gray-400">{{ formatDate(item.savedAt) }}</div>
                     </div>
                 </div>

                 <!-- Render Logic -->
                 
                 <!-- Inner Voice Card -->
                 <div v-if="parsedInnerVoice" class="mb-4">
                     <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 text-gray-200 shadow-md border border-gray-700">
                         <div class="text-center text-[#d4af37] text-sm tracking-[0.2em] mb-4 opacity-80">· 内 心 独 白 ·</div>
                         
                         <!-- Main Thoughts -->
                         <div class="text-base leading-relaxed mb-6 font-light text-center px-4 italic">
                             <template v-if="formattedThoughts">
                                 <div v-for="(val, key) in formattedThoughts" :key="key" class="mb-2">
                                     <span class="opacity-60 text-xs text-[#d4af37] block mb-1 uppercase tracking-wider">{{key}}</span>
                                     <span>"{{ val }}"</span>
                                 </div>
                             </template>
                             <template v-else>
                                 "{{ parsedInnerVoice.心声 || parsedInnerVoice.thoughts || '...' }}"
                             </template>
                         </div>
                         
                         <!-- Grid Info -->
                         <div class="grid grid-cols-1 gap-4 text-xs">
                             <div v-if="parsedInnerVoice.着装" class="bg-white/5 p-3 rounded-lg border border-white/5">
                                 <div class="text-[#d4af37] mb-1">着装 OUTFIT</div>
                                 <div class="text-gray-400 leading-relaxed whitespace-pre-wrap" v-if="typeof parsedInnerVoice.着装 === 'object'">
                                     <div v-for="(v, k) in parsedInnerVoice.着装" :key="k">
                                         <span class="opacity-70">{{k}}:</span> {{v}}
                                     </div>
                                 </div>
                                 <div class="text-gray-400 leading-relaxed" v-else>{{ parsedInnerVoice.着装 }}</div>
                             </div>
                             
                             <div v-if="parsedInnerVoice.环境" class="bg-white/5 p-3 rounded-lg border border-white/5">
                                 <div class="text-[#d4af37] mb-1">环境 SCENE</div>
                                 <div class="text-gray-400 leading-relaxed">{{ parsedInnerVoice.环境 }}</div>
                             </div>

                             <div v-if="parsedInnerVoice.行为" class="bg-white/5 p-3 rounded-lg border border-white/5">
                                 <div class="text-[#d4af37] mb-1">行为 ACTION</div>
                                 <div class="text-gray-400 leading-relaxed">{{ parsedInnerVoice.行为 }}</div>
                             </div>
                         </div>
                     </div>
                 </div>

                 <!-- Special Content (Card/Sticker) -->
                 <div v-if="specialContent">
                     <SafeHtmlCard v-if="specialContent.type === 'html'" :htmlContent="specialContent.html" />
                     <img v-else-if="specialContent.type === 'sticker'" :src="specialContent.url" class="max-w-[150px] rounded-lg">
                     <div v-else-if="specialContent.type === 'sticker_placeholder'" class="inline-flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-lg text-gray-600 border border-gray-200">
                         <i class="fa-regular fa-image text-lg"></i>
                         <span class="font-medium">{{ specialContent.name }}</span>
                     </div>
                 </div>

                 <!-- Standard Text Content (if not special) -->
                 <div v-else-if="cleanContent" class="text-gray-800 text-base leading-7 whitespace-pre-wrap" v-html="marked(cleanContent)"></div>

                 <!-- Image Type -->
                 <div v-if="item.type === 'image'" class="mt-2">
                     <img :src="item.content" class="rounded-lg max-w-full border border-gray-100">
                 </div>

            </div>

        </div>

        <div v-else class="flex-1 flex items-center justify-center text-gray-400">
            内容不存在
        </div>
    </div>
</template>
