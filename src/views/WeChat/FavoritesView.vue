<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useStickerStore } from '../../stores/stickerStore'
import { useChatStore } from '../../stores/chatStore'

const router = useRouter()
const favoritesStore = useFavoritesStore()
const stickerStore = useStickerStore()
const chatStore = useChatStore()

// Tab state
const activeTab = ref('all') // 'all', 'call', 'normal'

// Combined Sticker Search Scope
const allStickers = computed(() => {
    const global = stickerStore.stickers || []
    const charStickers = Object.values(chatStore.chats).flatMap(c => c.emojis || [])
    return [...global, ...charStickers]
})

const goBack = () => {
    router.back()
}

const searchQuery = ref('')
const showSearch = ref(false)

const favorites = computed(() => {
    let list = favoritesStore.favorites
    
    // 1. Tab Filtering
    if (activeTab.value === 'call') {
        list = list.filter(item => item.isCallRecord || item.source === '通话记录' || (item.content && item.content.includes('[通话记录]')))
    } else if (activeTab.value === 'normal') {
        list = list.filter(item => !item.isCallRecord && item.source !== '通话记录' && !(item.content && item.content.includes('[通话记录]')))
    }

    // 2. Search Filtering
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        list = list.filter(item =>
            (item.content && item.content.toLowerCase().includes(q)) ||
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.author && item.author.toLowerCase().includes(q)) ||
            (item.source && item.source.toLowerCase().includes(q))
        )
    }

    // Sort by savedAt descending (Newest First)
    return list.slice().sort((a, b) => b.savedAt - a.savedAt)
})

const formatDate = (ts) => {
    if (!ts) return ''
    const date = new Date(ts)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    return date.toLocaleDateString()
}

const getPreviewContent = (item) => {
    if (item.preview) return { type: 'text', content: item.preview }
    
    // 1. Check for Sticker
    if (item.role === 'user' || item.type === 'text' || item.type === 'sticker') {
        const contentStr = String(item.content || '')
        const stickerMatch = contentStr.match(/\[(表情包|Sticker|图片)\s*[:：]\s*([^\]]+)\]/i)
        if (stickerMatch) {
            const val = stickerMatch[2].trim()
            if (val.startsWith('http') || val.startsWith('data:')) return { type: 'sticker', url: val }
            const found = allStickers.value.find(s => s.name === val)
            if (found) return { type: 'sticker', url: found.url }
            return { type: 'sticker_placeholder', name: val }
        }
    }

    // 2. Other Types
    if (item.type === 'image' || item.image) return { type: 'preview', text: '[图片]' }
    if (item.type === 'redpacket') return { type: 'preview', text: '[红包]' }
    if (item.type === 'transfer') return { type: 'preview', text: '[转账]' }
    if (item.type === 'chat_record') return { type: 'preview', text: `[聊天记录] ${item.source || '...'} 的聊天记录` }

    // 3. Just Text
    return { type: 'text', content: item.content }
}

const openDetail = (item) => {
    router.push(`/favorites/${item.id}`)
}

const deleteItem = (id) => {
    chatStore.triggerConfirm('删除收藏', '确定要删除这条收藏记录吗？', () => {
        const success = favoritesStore.removeFavorite(id)
        if (success) {
            chatStore.triggerToast('已删除', 'success')
        }
    })
}
</script>

<template>
    <div class="h-full bg-gray-50 flex flex-col font-sans">
        <!-- Header -->
        <div class="h-[44px] bg-white flex items-center justify-between px-4 border-b border-gray-100 shrink-0 z-20">
            <div class="flex items-center gap-1 cursor-pointer w-20" @click="goBack">
                <i class="fa-solid fa-chevron-left text-gray-800"></i>
                <span class="font-medium text-base text-gray-800">返回</span>
            </div>
            <div class="font-bold text-gray-900 text-base">我的收藏</div>
            <div class="w-20 flex justify-end">
                <i class="fa-solid fa-magnifying-glass text-gray-800 cursor-pointer p-2 opacity-80"
                    @click="showSearch = !showSearch"></i>
            </div>
        </div>

        <!-- Search Bar -->
        <Transition name="slide-down">
            <div v-if="showSearch" class="bg-white px-4 pb-3 pt-1 border-b border-gray-100">
                <div class="bg-gray-100 rounded-full flex items-center px-4 py-2">
                    <i class="fa-solid fa-magnifying-glass text-gray-400 text-sm mr-2"></i>
                    <input v-model="searchQuery" type="text" placeholder="搜索内容、作者或来源..."
                        class="bg-transparent border-none outline-none text-sm w-full text-gray-700 placeholder-gray-400">
                    <i v-if="searchQuery" class="fa-solid fa-circle-xmark text-gray-300 ml-2 cursor-pointer hover:text-gray-400"
                        @click="searchQuery = ''"></i>
                </div>
            </div>
        </Transition>

        <!-- Category Tabs -->
        <div class="bg-white flex items-center px-2 py-1 border-b border-gray-100 shrink-0">
            <div 
                v-for="tab in [{id:'all', name:'全部'}, {id:'call', name:'通话记录'}, {id:'normal', name:'普通收藏'}]" 
                :key="tab.id"
                class="flex-1 py-1.5 text-center relative cursor-pointer"
                @click="activeTab = tab.id"
            >
                <div :class="['text-[13px] py-1 rounded-md transition-all duration-300', activeTab === tab.id ? 'text-green-600 bg-green-50 font-bold' : 'text-gray-500']">
                    {{ tab.name }}
                </div>
            </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-[#f7f7f7]">
            <div v-if="favorites.length === 0" class="flex flex-col items-center justify-center mt-32 text-gray-400 opacity-60">
                <i class="fa-solid fa-box-open text-5xl mb-4"></i>
                <p>暂无相关收藏内容</p>
            </div>

            <div v-for="item in favorites" :key="item.id" 
                class="group bg-white p-3 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-white hover:border-green-100 hover:shadow-md transition-all duration-300 active:scale-[0.98]">
                
                <div class="flex flex-col gap-3 cursor-pointer" @click="openDetail(item)">
                    <!-- Meta Header -->
                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <img v-if="item.avatar" :src="item.avatar" class="w-8 h-8 rounded-lg object-cover shadow-sm">
                            <div v-else class="bg-gradient-to-br from-gray-100 to-gray-200 w-8 h-8 rounded-lg flex items-center justify-center text-xs text-gray-500 font-bold border border-gray-100">
                                {{ item.author?.[0] || '?' }}
                            </div>
                            <!-- Call Icon Badge -->
                            <div v-if="item.isCallRecord || item.source === '通话记录'" class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                                <i class="fa-solid fa-phone text-[8px] text-white"></i>
                            </div>
                        </div>
                        
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-gray-800 truncate">{{ item.author || '未知' }}</span>
                            <span class="text-[10px] text-gray-400">{{ formatDate(item.savedAt) }}</span>
                        </div>
                        
                        <div v-if="item.source" class="ml-auto px-1.5 py-0.5 bg-gray-50 rounded text-[10px] text-gray-400 border border-gray-100 flex items-center gap-1">
                            <i v-if="item.isCallRecord || item.source === '通话记录'" class="fa-solid fa-headset text-green-500/50"></i>
                            <span>{{ item.source }}</span>
                        </div>
                    </div>

                    <!-- Content Preview -->
                    <div class="text-[15px] leading-relaxed text-gray-700">
                        <div v-if="item.title" class="font-bold text-gray-900 mb-1 line-clamp-1">{{ item.title }}</div>
                        
                        <template v-if="getPreviewContent(item).type === 'sticker'">
                            <img :src="getPreviewContent(item).url" class="h-20 w-20 rounded-lg object-contain bg-gray-50 p-1">
                        </template>
                        <template v-else-if="getPreviewContent(item).type === 'sticker_placeholder'">
                            <div class="inline-flex items-center gap-1.5 bg-gray-50 px-2 py-1.5 rounded-lg text-gray-400 text-xs border border-gray-100">
                                <i class="fa-regular fa-image shrink-0"></i>
                                <span class="truncate">{{ getPreviewContent(item).name }}</span>
                            </div>
                        </template>
                        <template v-else-if="getPreviewContent(item).type === 'preview'">
                            <span class="text-gray-400 italic bg-gray-50 px-2 py-1 rounded text-sm">{{ getPreviewContent(item).text }}</span>
                        </template>
                        <template v-else>
                            <div class="line-clamp-3 whitespace-pre-wrap">{{ getPreviewContent(item).content || '...' }}</div>
                        </template>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center px-1">
                    <span class="text-[10px] text-gray-300 italic">收藏于 {{ formatDate(item.savedAt) }}</span>
                    <button class="text-[11px] font-bold text-red-300 hover:text-red-500 transition-colors py-1 px-3 rounded-lg hover:bg-red-50"
                        @click.stop="deleteItem(item.id)">
                        删除
                    </button>
                </div>
            </div>
            
            <div class="h-10"></div> <!-- Bottom Spacer -->
        </div>
    </div>
</template>

<style scoped>
.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.slide-down-enter-active, .slide-down-leave-active {
    transition: all 0.3s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
    transform: translateY(-20px);
    opacity: 0;
}
</style>
