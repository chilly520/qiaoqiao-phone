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

// Combined Sticker Search Scope
const allStickers = computed(() => {
    const global = stickerStore.customStickers || []
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
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        list = list.filter(item =>
            (item.content && item.content.toLowerCase().includes(q)) ||
            (item.author && item.author.toLowerCase().includes(q))
        )
    }
    // Optional: Sort by newer first if not already
    return list.slice().reverse()
})

const formatDate = (ts) => {
    return new Date(ts).toLocaleString()
}

const getPreviewContent = (item) => {
    // 1. Check for Sticker
    if (item.type === 'text' || item.type === 'sticker') {
        // Relaxed Regex: Handles Chinese colon, spaces, and no start/end anchors
        const stickerMatch = item.content.match(/\[(表情包|Sticker)\s*[:：]\s*([^\]]+)\]/i)
        if (stickerMatch) {
            const val = stickerMatch[2].trim()
            if (val.startsWith('http') || val.startsWith('data:')) return { type: 'sticker', url: val }

            // Search Global + All Characters
            const found = allStickers.value.find(s => s.name === val)

            if (found) return { type: 'sticker', url: found.url }
            // Fallback: Return placeholder instead of text
            return { type: 'sticker_placeholder', name: val }
        }
    }

    // 2. Other Types
    if (item.type === 'image') return { type: 'preview', text: '[图片]' }
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
    // Debug Alert to prove click
    // alert(`Trying to delete ID: ${id}`)
    const success = favoritesStore.removeFavorite(id)
    if (success) {
        // alert('Deleted successfully')
    } else {
        // alert('Delete failed - ID not found?')
    }
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
            <div class="font-bold text-base">我的收藏</div>
            <div class="w-20 flex justify-end">
                <i class="fa-solid fa-magnifying-glass text-black cursor-pointer p-2"
                    @click="showSearch = !showSearch"></i>
            </div>
        </div>

        <!-- Search Bar -->
        <div v-if="showSearch" class="bg-white px-4 pb-2 -mt-1 border-b border-gray-100">
            <div class="bg-gray-100 rounded-lg flex items-center px-3 py-1.5">
                <i class="fa-solid fa-magnifying-glass text-gray-400 text-sm mr-2"></i>
                <input v-model="searchQuery" type="text" placeholder="搜索收藏内容..."
                    class="bg-transparent border-none outline-none text-sm w-full text-gray-700 placeholder-gray-400">
                <i v-if="searchQuery" class="fa-solid fa-xmark text-gray-400 ml-2 cursor-pointer"
                    @click="searchQuery = ''"></i>
            </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-if="favorites.length === 0" class="text-center text-gray-400 mt-20">
                暂无收藏内容
            </div>

            <div v-for="item in favorites" :key="item.id" class="bg-white p-2 rounded-lg shadow-sm mb-3 flex flex-col">
                <!-- Clickable Main Content Area -->
                <div class="active:bg-gray-50 transition-colors p-2 rounded cursor-pointer" @click="openDetail(item)">
                    <div class="flex items-center gap-2 mb-2">
                        <img v-if="item.avatar" :src="item.avatar" class="w-8 h-8 rounded-full object-cover">
                        <div v-else
                            class="bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center text-xs text-gray-500 font-bold">
                            {{ item.author?.[0] || '?' }}
                        </div>
                        <span class="text-xs text-gray-500">{{ item.author || '未知' }}</span>
                        <span class="text-xs text-gray-300 ml-auto">{{ formatDate(item.savedAt) }}</span>
                    </div>

                    <div class="text-sm text-gray-800 line-clamp-3">
                        <template v-if="getPreviewContent(item).type === 'sticker'">
                            <img :src="getPreviewContent(item).url" class="h-16 rounded-lg object-contain">
                        </template>
                        <template v-else-if="getPreviewContent(item).type === 'sticker_placeholder'">
                            <div
                                class="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-gray-500 text-xs text-ellipsis overflow-hidden whitespace-nowrap max-w-full">
                                <i class="fa-regular fa-image shrink-0"></i>
                                <span class="truncate">{{ getPreviewContent(item).name }}</span>
                            </div>
                        </template>
                        <template v-else-if="getPreviewContent(item).type === 'preview'">
                            <span class="text-gray-500">{{ getPreviewContent(item).text }}</span>
                        </template>
                        <template v-else>
                            {{ getPreviewContent(item).content || '...' }}
                        </template>
                    </div>
                </div>

                <!-- Footer Actions (Separated from Click Area) -->
                <div class="mt-1 flex justify-end px-2 pb-1 relative z-10 pointer-events-auto">
                    <button class="px-4 py-2 bg-red-50 text-red-500 rounded active:bg-red-200 font-bold text-xs"
                        @click.stop="deleteItem(item.id)">
                        删除
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
