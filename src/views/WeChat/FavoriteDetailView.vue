<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useStickerStore } from '../../stores/stickerStore'
import { useChatStore } from '../../stores/chatStore'
import { marked } from 'marked'
import SafeHtmlCard from '../../components/SafeHtmlCard.vue'

const route = useRoute()
const router = useRouter()
const favoritesStore = useFavoritesStore()
const chatStore = useChatStore()
const stickerStore = useStickerStore()

const itemId = computed(() => route.params.id)
const item = computed(() => {
    // Robust comparison converting both to strings
    const id = itemId.value ? String(itemId.value) : null
    if (!id) return null

    // 1. Try Favorites Store First (Standard)
    const fromStore = favoritesStore.favorites.find(f => String(f.id) === id)
    if (fromStore) return fromStore

    // 2. Fallback: Search in Chat History for "Virtual" Favorites (e.g. Call Records)
    // This allows clicking "Favorite" cards in chat that aren't yet saved to the favorites list
    // Iterate all chats
    for (const chatId in chatStore.chats) {
        const chat = chatStore.chats[chatId]
        if (!chat.msgs) continue

        // Find message with matching favoriteId in its content JSON
        for (let i = chat.msgs.length - 1; i >= 0; i--) { // Reverse search is faster for recent
            const msg = chat.msgs[i]
            if (msg.type === 'favorite_card' || msg.content.includes('"favoriteId"')) {
                try {
                    const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
                    if (content && String(content.favoriteId) === id) {
                        return {
                            id: content.favoriteId,
                            type: 'text', // Render as simple text for now since it's a summary
                            source: content.source,
                            author: chat.name,
                            avatar: chat.avatar,
                            savedAt: content.savedAt || msg.timestamp,
                            content: content.fullContent || content.preview // Use full content
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
    }

    return null
})

const forceDelete = () => {
    if (confirm('是否强制删除该无效记录?')) {
        favoritesStore.removeFavorite(itemId.value)
        router.back()
    }
}

// Combined Sticker Search Scope (Computed for efficiency)
const allStickers = computed(() => {
    const global = stickerStore.stickers || []
    const charStickers = Object.values(chatStore.chats).flatMap(c => c.emojis || [])
    return [...global, ...charStickers]
})

// Special Content Parsing (Sticker / Card)
const specialContent = computed(() => {
    if (!item.value) return null
    if (item.value.type === 'chat_record') return null // Handled separately
    if (item.value.type !== 'text' && item.value.type !== 'sticker' && item.value.type !== 'single') return null

    // For 'single' types, content is directly on item. For legacy 'text', same.
    const content = item.value.content || ''

    // 1. HTML Card (Explicit 'html' type or Text with specific markers)
    // Fix: Remove newlines to allow JSON parsing if AI added them for formatting
    if (item.value.type === 'html' || content.startsWith('[CARD]') || (content.trim().startsWith('{') && content.includes('"type"'))) {
        try {
            let jsonStr = content;
            if (content.startsWith('[CARD]')) {
                jsonStr = content.replace('[CARD]', '').trim();
            }

            // Aggressively clean newlines which break JSON.parse
            // We assume the JSON structure doesn't rely on newlines, effectively minifying it.
            jsonStr = jsonStr.replace(/[\r\n]/g, '');

            // Try parsing
            const json = JSON.parse(jsonStr);
            if (json.type === 'html' || json.html) {
                return { type: 'html', html: json.html || json.content };
            }
        } catch (e) {
            // console.error('Invalid Card JSON', e);
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

    // 3. Text that is actually an Image URL (Fix for Issue 1)
    if (item.value.type === 'text' || item.value.type === 'single') {
        const trimmed = content.trim();
        // Check if it's a pure URL (no spaces, starts with http/data)
        if (/^https?:\/\/[^\s]+$/.test(trimmed) || /^data:image\/[^\s]+$/.test(trimmed)) {
            // Highly likely an image
            return { type: 'image_url', url: trimmed }; // New special type
        }
        // Also handle [图片:URL] format if it somehow got saved as text content
        const imgMatch = trimmed.match(/^\[图片:(https?:\/\/[^\]]+)\]$/);
        if (imgMatch) {
            return { type: 'image_url', url: imgMatch[1] };
        }
    }

    // 4. Fallback: If JSON parsing failed but it looks like our JSON HTML wrapper
    // Regex to capture content inside "html": "..." or "html": '...'
    // Handling multiline content specifically.
    if (content.includes('"type": "html"') || content.includes('"type":"html"')) {
        // IMPROVED REGEX: Greedy match until the last quote before the closing brace '}'
        // This handles cases where inner quotes are NOT escaped properly (e.g. onclick="...")
        const htmlMatch = content.match(/"html"\s*:\s*(["'])([\s\S]*)\1\s*\}/);

        if (htmlMatch) {
            const rawStr = htmlMatch[2];
            // Try to unescape by treating it as a JSON string value
            try {
                // If it used single quotes in the match, we might need to be careful, but standard JSON uses double.
                // Re-wrap in double quotes to parse standard JSON string escapes
                const unescaped = JSON.parse(`"${rawStr}"`);
                console.log('[FavoriteDetail] Recovered and Unescaped HTML via Greedy Regex');
                return { type: 'html', html: unescaped };
            } catch (e) {
                // Fallback to raw if unescaping fails (likely due to the bad quotes that required this regex)
                // If we are here, it means JSON.parse failed, so the string probably has raw newlines/quotes.
                // We return the raw string which browsers often tolerate in innerHTML.
                console.log('[FavoriteDetail] Recovered HTML (Raw - Greedy) via Regex');
                return { type: 'html', html: rawStr };
            }
        }
    }

    return null
})

const cleanImageUrl = (content) => {
    if (!content) return '';
    // Strip [图片:URL] format if present
    const match = content.match(/\[图片:(.+?)\]/);
    if (match) return match[1];
    return content;
}

const deleteCurrentItem = () => {
    if (confirm('确认删除这条收藏吗?')) {
        favoritesStore.removeFavorite(itemId)
        router.back()
    }
}

const goBack = () => {
    router.back()
}

// Inner Voice Helper (Reusable)
const extractInnerVoice = (content) => {
    if (!content) return null

    // Check for [INNER_VOICE] tag
    const match = content.match(/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i)
    if (match) {
        try {
            return JSON.parse(match[1])
        } catch (e) {
            console.error('Failed to parse inner voice', e)
            return null
        }
    }
    // Also try direct JSON if it looks like it
    if (content.trim().startsWith('{') && content.includes('"着装"')) {
        try {
            return JSON.parse(content)
        } catch (e) {
            return null
        }
    }
    return null
}

// Clean Message Helper (Reusable)
const cleanMessage = (content) => {
    if (!content) return ''
    if (extractInnerVoice(content)) {
        return content.replace(/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i, '').trim()
    }
    return content
}

// Single Item Computeds (Using Helpers)
const parsedInnerVoice = computed(() => {
    if (!item.value) return null
    if (item.value.type !== 'text' && item.value.type !== 'ai') return null
    return extractInnerVoice(item.value.content)
})

const cleanContent = computed(() => {
    if (!item.value) return ''
    return cleanMessage(item.value.content)
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

const formatDate = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString()
}

// --- Share Logic ---
const showShareModal = ref(false)
const shareToChatId = ref(null)

const shareToChat = (chatId) => {
    if (!item.value) return

    // Prepare card content
    const cardData = {
        favoriteId: item.value.id,
        type: item.value.type,
        source: item.value.source || item.value.author || '未知来源',
        savedAt: item.value.savedAt,
        count: item.value.type === 'chat_record' ? item.value.messages.length : 1
    }

    // For preview, get first message or the single content
    if (item.value.type === 'single') {
        // Truncate preview if too long
        let p = item.value.content || ''
        cardData.fullContent = p // Include full content for AI
        if (p.length > 50) p = p.substring(0, 50) + '...'
        cardData.preview = p
    } else if (item.value.type === 'chat_record' && item.value.messages?.length > 0) {
        // Full content for AI
        cardData.fullContent = item.value.messages.map(m => `${m.author}: ${m.content}`).join('\n')
        // Take first 2 as preview for UI
        cardData.preview = item.value.messages.slice(0, 2).map(m => `${m.author}: ${m.content}`).join('\n')
    }

    chatStore.addMessage(chatId, {
        role: 'user', // Sent by me
        type: 'favorite_card',
        content: JSON.stringify(cardData)
    })

    showShareModal.value = false
    // alert('已分享到聊天')

    // Check if current chat is the target chat, if not, redirect
    if (chatStore.currentChatId !== chatId) {
        chatStore.currentChatId = chatId
        // Clear history modal if open? No, just route.
        // Assuming route pattern is /chat/:id or handled via ChatWindow logic? 
        // Checking router/index.js, there isn't a direct /chat/:id route visible in the 127 lines?
        // Wait, HomeView likely handles it or WeChatApp.vue.
        // Let's assume standard navigation:
        // Actually router shows /wechat/profile/:charId.
        // Let's try to just go back to home or the specific chat if we can find the route.
        // There is no explicit /chat/:id route in the file I viewed. 
        // It seems the chat is usually overlay or part of Home/WeChatApp state?
        // Let's check how 'back' works. 
        // Actually user said "跳转聊天页面".
        // Let's assume navigating to /wechat implies opening the chat if currentChatId is set.
        router.push('/wechat')
    } else {
        router.push('/wechat')
    }
}

const chatsList = computed(() => {
    return Object.keys(chatStore.chats).map(id => ({
        id,
        ...chatStore.chats[id]
    }))
})

const renderMarkdown = (text) => {
    try {
        if (typeof marked.parse === 'function') {
            return marked.parse(text)
        }
        return marked(text)
    } catch (e) {
        console.error('Markdown render error:', e)
        return text
    }
}

// --- Toast Logic ---
const toastMsg = ref('')
const toastType = ref('info') // info, success, warning
let toastTimer = null

const showToast = (msg, type = 'info') => {
    toastMsg.value = msg
    toastType.value = type
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
        toastMsg.value = ''
    }, 3000)
}

// --- Event Listener for HTML Card Alerts ---
import { onMounted, onUnmounted } from 'vue'

const handleMessage = (event) => {
    if (event.data && event.data.type === 'CHAT_ALERT') {
        showToast(event.data.text, 'info')
    }
}

onMounted(() => {
    window.addEventListener('message', handleMessage)
})

onUnmounted(() => {
    window.removeEventListener('message', handleMessage)
    if (toastTimer) clearTimeout(toastTimer)
})
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
            <div class="w-20 flex justify-end gap-3">
                <i class="fa-solid fa-share-nodes text-gray-800 cursor-pointer p-2" @click="showShareModal = true"></i>
                <i class="fa-solid fa-trash text-gray-800 cursor-pointer p-2" @click="deleteCurrentItem"></i>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4" v-if="item">

            <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
                <!-- Meta -->
                <div class="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <img v-if="item.authorAvatar || item.avatar" :src="item.authorAvatar || item.avatar"
                        class="w-10 h-10 rounded-full bg-gray-200 object-cover">
                    <div v-else
                        class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500">
                        {{ item.author?.[0] || '?' }}
                    </div>
                    <div>
                        <div class="font-bold text-gray-900">{{ item.author }}</div>
                        <div class="text-xs text-gray-400">{{ formatDate(item.savedAt) }}</div>
                    </div>
                </div>

                <!-- Render Logic -->

                <!-- Chat Record Type -->
                <div v-if="item.type === 'chat_record'" class="space-y-4">
                    <div class="text-xs text-[#d4af37] font-bold mb-4 flex items-center gap-2">
                        <i class="fa-solid fa-comments"></i> 聊天记录 (共 {{ item.messages.length }} 条)
                    </div>
                    <div v-for="m in item.messages" :key="m.id"
                        class="border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-xs font-bold text-blue-600">{{ m.author }}</span>
                            <span class="text-[10px] text-gray-300">{{ formatDate(m.timestamp) }}</span>
                        </div>

                        <!-- Main Text -->
                        <div class="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
                            v-html="renderMarkdown(cleanMessage(m.content))"></div>

                        <!-- Extracted Inner Voice in List -->
                        <div v-if="extractInnerVoice(m.content)" class="mt-3">
                            <div
                                class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-gray-200 shadow-md border border-gray-700">
                                <div class="text-center text-[#d4af37] text-xs tracking-[0.2em] mb-3 opacity-80">· 内 心 独
                                    白 ·</div>

                                <!-- Thoughts -->
                                <div class="text-sm leading-relaxed mb-4 font-light text-center px-2 italic">
                                    "{{ extractInnerVoice(m.content).心声 || extractInnerVoice(m.content).thoughts ||
                                        '...' }}"
                                </div>

                                <!-- Mini Grid -->
                                <div class="grid grid-cols-1 gap-2 text-[10px]">
                                    <div v-if="extractInnerVoice(m.content).着装"
                                        class="border-t border-white/10 pt-2 text-gray-400">
                                        <span class="text-[#d4af37] mr-2">着装</span>
                                        <span v-if="typeof extractInnerVoice(m.content).着装 === 'string'">{{
                                            extractInnerVoice(m.content).着装 }}</span>
                                    </div>
                                    <div v-if="extractInnerVoice(m.content).环境"
                                        class="border-t border-white/10 pt-2 text-gray-400">
                                        <span class="text-[#d4af37] mr-2">环境</span>{{ extractInnerVoice(m.content).环境 }}
                                    </div>
                                    <div v-if="extractInnerVoice(m.content).行为"
                                        class="border-t border-white/10 pt-2 text-gray-400">
                                        <span class="text-[#d4af37] mr-2">行为</span>{{ extractInnerVoice(m.content).行为 }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Inner Voice Card (Existing) -->
                <div v-else-if="parsedInnerVoice" class="mb-4">
                    <div
                        class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 text-gray-200 shadow-md border border-gray-700">
                        <div class="text-center text-[#d4af37] text-sm tracking-[0.2em] mb-4 opacity-80">· 内 心 独 白 ·
                        </div>

                        <!-- Main Thoughts -->
                        <div class="text-base leading-relaxed mb-6 font-light text-center px-4 italic">
                            <template v-if="formattedThoughts">
                                <div v-for="(val, key) in formattedThoughts" :key="key" class="mb-2">
                                    <span
                                        class="opacity-60 text-xs text-[#d4af37] block mb-1 uppercase tracking-wider">{{
                                            key }}</span>
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
                                <div class="text-gray-400 leading-relaxed whitespace-pre-wrap"
                                    v-if="typeof parsedInnerVoice.着装 === 'object'">
                                    <div v-for="(v, k) in parsedInnerVoice.着装" :key="k">
                                        <span class="opacity-70">{{ k }}:</span> {{ v }}
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

                <!-- Special Content (Card/Sticker/ImageURL) -->
                <div v-if="specialContent">
                    <SafeHtmlCard v-if="specialContent.type === 'html'" :content="specialContent.html" />
                    <img v-else-if="specialContent.type === 'sticker'" :src="specialContent.url"
                        class="max-w-[150px] rounded-lg">
                    <img v-else-if="specialContent.type === 'image_url'" :src="specialContent.url"
                        class="rounded-lg max-w-full border border-gray-100">
                    <div v-else-if="specialContent.type === 'sticker_placeholder'"
                        class="inline-flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-lg text-gray-600 border border-gray-200">
                        <i class="fa-regular fa-image text-lg"></i>
                        <span class="font-medium">{{ specialContent.name }}</span>
                    </div>
                </div>

                <!-- Standard Text Content (if not special) -->
                <div v-else-if="cleanContent" class="text-gray-800 text-base leading-7 whitespace-pre-wrap"
                    v-html="renderMarkdown(cleanContent)"></div>

                <!-- Image Type -->
                <div v-if="item.type === 'image'" class="mt-2">
                    <img :src="cleanImageUrl(item.content)" class="rounded-lg max-w-full border border-gray-100">
                </div>

            </div>


        </div>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
            <span>内容不存在或已被删除</span>
            <div class="text-xs text-gray-300">ID: {{ itemId }}</div>
            <button @click="forceDelete"
                class="text-red-400 text-sm border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50">
                强制清除记录
            </button>
        </div>

        <!-- Share Selection Modal -->
        <div v-if="showShareModal"
            class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            @click="showShareModal = false">
            <div class="bg-white w-[85%] max-w-[320px] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[70%]"
                @click.stop>
                <div class="p-4 border-b border-gray-100 font-bold flex justify-between items-center">
                    <span>发送给...</span>
                    <i class="fa-solid fa-xmark text-gray-400 cursor-pointer" @click="showShareModal = false"></i>
                </div>
                <div class="flex-1 overflow-y-auto p-2">
                    <div v-for="chat in chatsList" :key="chat.id"
                        class="p-3 flex items-center gap-3 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
                        @click="shareToChat(chat.id)">
                        <img :src="chat.avatar || '/avatars/default.png'" class="w-10 h-10 rounded-lg object-cover">
                        <span class="font-bold text-gray-800">{{ chat.name }}</span>
                    </div>
                    <div v-if="chatsList.length === 0" class="text-center py-6 text-gray-400 text-sm">暂无联系人</div>
                </div>
            </div>
        </div>
        <!-- Custom Toast -->
        <div v-if="toastMsg"
            class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[2000] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 backdrop-blur-md border border-white/20"
            :class="toastType === 'success' ? 'bg-green-500/90 text-white' : 'bg-gray-800/90 text-white'">
            <i class="fa-solid" :class="toastType === 'success' ? 'fa-check-circle' : 'fa-circle-info'"></i>
            <span class="font-medium text-sm">{{ toastMsg }}</span>
        </div>
    </div>
</template>
