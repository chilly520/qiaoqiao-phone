<script setup>
import { ref, computed } from 'vue'
import { useMomentsStore } from '../stores/momentsStore'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useRouter } from 'vue-router'
import { useStickerStore } from '../stores/stickerStore'

const props = defineProps({
    moment: Object
})

const emit = defineEmits(['back', 'edit', 'showProfile'])

const momentsStore = useMomentsStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()

const router = useRouter()

// --- State ---
const showActionMenu = ref(false)
const showCommentInput = ref(false)
const commentText = ref('')
const deleteConfirmMode = ref(false) // For inline confirmation
const replyToComment = ref(null) // Comment being replied to
const commentToDelete = ref(null) // Comment pending deletion
let longPressTimer = null

// --- Getters ---
const isUser = computed(() => props.moment.authorId === 'user')
const author = computed(() => {
    if (isUser.value) return settingsStore.personalization.userProfile
    return chatStore.chats[props.moment.authorId] || { name: '神秘人', avatar: '' }
})

const isLiked = computed(() => props.moment.likes.includes(settingsStore.personalization.userProfile.name))

const likeNames = computed(() => {
    // likes array already contains names, not IDs
    return props.moment.likes.join(', ')
})

const getAuthorName = (id) => {
    if (id === 'user') return settingsStore.personalization.userProfile.name
    return chatStore.chats[id]?.name || '神秘人'
}

const getAuthorAvatar = (id) => {
    if (id === 'user') return settingsStore.personalization.userProfile.avatar
    return chatStore.chats[id]?.avatar || ''
}

// --- Content Parsing (Stickers) ---
const parsedContent = computed(() => {
    let content = props.moment.content || ''
    // Escape HTML first
    const div = document.createElement('div')
    div.textContent = content
    content = div.innerHTML

    // Regex for [表情包:名称]
    const stickerRegex = /\[表情包:([^\]]+)\]/g
    return content.replace(stickerRegex, (match, name) => {
        // 1. Try to find in global stickers
        let sticker = stickerStore.customStickers.find(s => s.name === name)
        
        // 2. If not found, try character-specific stickers if it's not the user
        if (!sticker && !isUser.value) {
            const char = chatStore.chats[props.moment.authorId]
            if (char && char.emojis) {
                sticker = char.emojis.find(s => s.name === name)
            }
        }
        
        if (sticker) {
            return `<img src="${sticker.url}" class="inline-block w-6 h-6 mx-0.5 align-bottom" title="${name}" />`
        }
        return match // Return original if not found
    })
})

// --- Actions ---
const toggleLike = () => {
    if (isLiked.value) {
        momentsStore.removeLike(props.moment.id, 'user')
    } else {
        momentsStore.addLike(props.moment.id, 'user')
        chatStore.triggerToast('已点赞', 'info')
    }
    showActionMenu.value = false
    
    // Trigger AI reaction if user likes
    if (!isLiked.value) {
        momentsStore.triggerAIInteractions(props.moment.id)
    }
}

const handleComment = () => {
    if (!commentText.value.trim()) return
    momentsStore.addComment(props.moment.id, {
        authorId: 'user',
        content: commentText.value,
        replyTo: replyToComment.value ? replyToComment.value.authorName : null
    })
    commentText.value = ''
    showCommentInput.value = false
    replyToComment.value = null
    chatStore.triggerToast('已评论', 'info')
    
    // Note: Do NOT trigger AI automatically, wait for user to click summon
}

const startReplyTo = (comment) => {
    replyToComment.value = comment
    showCommentInput.value = true
    commentText.value = ''
}

// Comment deletion - supports both long-press (mobile) and right-click (desktop)
const handleCommentLongPressStart = (comment) => {
    longPressTimer = setTimeout(() => {
        if (!commentToDelete.value || commentToDelete.value.id !== comment.id) {
            commentToDelete.value = comment
            chatStore.triggerToast('再次点击评论删除，或右键取消', 'info')
        }
    }, 500) // 500ms long press
}

const handleCommentLongPressEnd = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

const handleCommentContextMenu = (event, comment) => {
    event.preventDefault()
    // Toggle selection
    if (commentToDelete.value && commentToDelete.value.id === comment.id) {
        commentToDelete.value = null
    } else {
        commentToDelete.value = comment
        chatStore.triggerToast('再次点击评论删除，或右键取消', 'info')
    }
}

const handleCommentClick = (comment) => {
    // If this comment is pending deletion, delete it
    if (commentToDelete.value && commentToDelete.value.id === comment.id) {
        momentsStore.deleteComment(props.moment.id, comment.id)
        chatStore.triggerToast('已删除评论', 'success')
        commentToDelete.value = null
    } else {
        // Otherwise, start reply
        startReplyTo(comment)
    }
}

const handleEdit = () => {
    emit('edit', props.moment)
    showActionMenu.value = false
}

const handleShare = () => {
    // Share as a card to current active chat or prompt to choose?
    // For now, let's share to the current active chat if available, or just log
    if (chatStore.currentChatId) {
        chatStore.addMessage(chatStore.currentChatId, {
            role: 'user',
            type: 'moment_card',
            content: JSON.stringify({
                id: props.moment.id,
                author: author.value.name,
                text: props.moment.content,
                image: props.moment.images[0] || null
            })
        })
        chatStore.triggerToast('已分享到聊天', 'success')
        emit('back') // Go back to chat
    } else {
        chatStore.triggerToast('请先打开一个聊天窗口', 'info')
    }
    showActionMenu.value = false
}

const handleSummon = async () => {
    try {
        await momentsStore.triggerAIInteractions(props.moment.id)
    } catch (e) {
        console.error('[Summon] Failed:', e)
    }
}

const handleDeleteClick = () => {
    if (deleteConfirmMode.value) {
        // Confirmed
        momentsStore.deleteMoment(props.moment.id)
        chatStore.triggerToast('已删除', 'info')
        showActionMenu.value = false
        deleteConfirmMode.value = false
    } else {
        // First click
        deleteConfirmMode.value = true
        // Auto reset if no action
        setTimeout(() => {
            deleteConfirmMode.value = false
        }, 3000)
    }
}

const formatTime = (ts) => {
    const now = Date.now()
    const diff = (now - ts) / 1000
    if (diff < 60) return '刚刚'
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
    return new Date(ts).toLocaleDateString()
}

const navigateToAuthor = () => {
    if (!isUser.value) {
        router.push(`/moments/profile/${props.moment.authorId}`)
    }
}

</script>

<template>
  <div class="moment-item flex p-4 border-b border-gray-100 bg-white" :data-moment-id="props.moment.id">
    <!-- Avatar -->
    <div class="w-11 h-11 rounded-lg overflow-hidden shrink-0 mr-3 mt-1 bg-gray-100 cursor-pointer active:opacity-70 transition-opacity" @click="navigateToAuthor">
        <img :src="author.avatar" class="w-full h-full object-cover">
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
        <!-- Name -->
        <h3 class="text-[#576b95] font-bold text-base mb-1 cursor-pointer hover:underline inline-block" @click="navigateToAuthor">{{ author.name }}</h3>
        
        <!-- Text with Parsed Stickers -->
        <div v-if="!props.moment.html" class="text-gray-900 text-base mb-3 whitespace-pre-wrap break-words leading-relaxed" v-html="parsedContent"></div>
        
        <!-- HTML Content (for special formatting like poems) -->
        <div v-if="props.moment.html" class="html-content mb-3 text-gray-900 text-base leading-relaxed" v-html="props.moment.html"></div>
        
        <!-- Images Grid (WeChat Style) -->
        <div v-if="props.moment.images && props.moment.images.length > 0" 
             class="grid gap-1 mb-3"
             :class="[
                props.moment.images.length === 1 ? 'grid-cols-1 max-w-[80%]' : 
                props.moment.images.length === 2 ? 'grid-cols-2 w-2/3' : 
                props.moment.images.length === 4 ? 'grid-cols-2 w-2/3' : 
                'grid-cols-3'
             ]"
        >
            <div 
                v-for="(img, idx) in props.moment.images" 
                :key="idx"
                class="bg-gray-50 rounded-sm overflow-hidden flex items-center justify-center border border-gray-100"
                :class="props.moment.images.length === 1 ? '' : 'aspect-square'"
            >
                <img :src="img" class="w-full h-full object-cover">
            </div>
        </div>

        <!-- Stickers -->
        <div v-if="props.moment.stickers && props.moment.stickers.length > 0" class="flex flex-wrap gap-2 mb-3">
            <div 
                v-for="(stk, idx) in props.moment.stickers" 
                :key="idx"
                class="w-20 h-20 flex items-center justify-center"
            >
                <img :src="stk" class="w-full h-full object-contain">
            </div>
        </div>

        <!-- QQ Space Style Interaction Bar (Directly below content) -->
        <div class="mt-4 pt-3 border-t border-gray-50 flex items-center gap-8 px-1">
            <button 
                class="flex items-center gap-1.5 transition-colors active:scale-95"
                :class="isLiked ? 'text-red-500' : 'text-gray-500'"
                @click="toggleLike"
            >
                <i :class="[isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart']" class="text-sm"></i>
                <span class="text-xs font-medium">{{ props.moment.likes.length || '赞' }}</span>
            </button>
            
            <button 
                class="flex items-center gap-1.5 text-gray-500 transition-colors active:scale-95"
                @click="showCommentInput = !showCommentInput"
            >
                <i class="fa-regular fa-comment text-sm"></i>
                <span class="text-xs font-medium">{{ props.moment.comments.length || '评论' }}</span>
            </button>
            
            <button 
                class="flex items-center gap-1.5 text-gray-500 transition-colors active:scale-95"
                @click="handleShare"
            >
                <i class="fa-solid fa-share-nodes text-sm"></i>
                <span class="text-xs font-medium text-gray-500">分享</span>
            </button>
            
            <button 
                v-if="!isUser"
                class="flex items-center gap-1.5 text-purple-500 transition-colors active:scale-95"
                @click="handleSummon"
                title="召唤朋友互动"
            >
                <i class="fa-solid fa-wand-sparkles text-sm"></i>
                <span class="text-xs font-medium">召唤</span>
            </button>
        </div>

        <!-- Footer: Time & Management Menu -->
        <div class="flex items-center justify-between mt-4">
            <span class="text-xs text-gray-400">{{ formatTime(props.moment.timestamp) }}</span>
            
            <div class="relative">
                <!-- Management Button (...) -->
                <div 
                    class="w-8 h-8 flex items-center justify-center cursor-pointer active:opacity-60 transition-opacity"
                    @click.stop="showActionMenu = !showActionMenu; deleteConfirmMode = false"
                >
                    <i class="fa-solid fa-ellipsis text-gray-400"></i>
                </div>

                <!-- Management Popover -->
                <div 
                    v-if="showActionMenu" 
                    class="absolute bottom-full right-0 mb-2 bg-[#4c4c4c] rounded-lg shadow-xl py-1 min-w-[100px] z-20 animate-scale-up origin-bottom-right"
                    @click.stop
                >
                    <div class="px-4 py-2 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer text-white text-xs border-b border-[#5f5f5f]" @click="handleEdit">
                        <i class="fa-solid fa-pen-to-square"></i>
                        <span>编辑</span>
                    </div>
                    <div class="px-4 py-2 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer text-xs border-b border-[#5f5f5f]" 
                        :class="deleteConfirmMode ? 'text-red-500 font-bold bg-[#5f5f5f]' : 'text-red-400'"
                        @click="handleDeleteClick"
                    >
                        <i :class="deleteConfirmMode ? 'fa-solid fa-check' : 'fa-solid fa-trash'"></i>
                        <span>{{ deleteConfirmMode ? '确认删除?' : '删除' }}</span>
                    </div>
                    <div class="px-4 py-2 flex items-center justify-center active:bg-[#5f5f5f] cursor-pointer text-gray-300 text-[10px]" @click="showActionMenu = false">
                        取消
                    </div>
                </div>
            </div>
        </div>

        <!-- Interactions Area -->
        <div v-if="props.moment.likes.length > 0 || props.moment.comments.length > 0" class="mt-2 bg-[#f7f7f7] rounded relative">
            <div class="absolute -top-1.5 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#f7f7f7]"></div>
            
            <!-- Likes List -->
            <div v-if="props.moment.likes.length > 0" class="px-3 py-1.5 border-b border-gray-200 flex items-start gap-1 text-[#576b95] text-sm font-medium">
                <i class="fa-regular fa-heart mt-1 mr-1 text-xs"></i>
                <span class="flex-1 break-all">{{ likeNames }}</span>
            </div>

            <!-- Comments List -->
            <div v-if="props.moment.comments.length > 0" class="px-3 py-1.5 space-y-1">
                <div 
                    v-for="comment in props.moment.comments" 
                    :key="comment.id" 
                    class="text-sm cursor-pointer px-2 py-1 rounded transition-colors"
                    :class="commentToDelete && commentToDelete.id === comment.id ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-100'"
                    @touchstart.prevent="handleCommentLongPressStart(comment)"
                    @touchend="handleCommentLongPressEnd()"
                    @click="handleCommentClick(comment)"
                    @contextmenu="handleCommentContextMenu($event, comment)"
                    title="长按或右键删除"
                >
                    <span class="text-[#576b95] font-bold">{{ comment.authorName || getAuthorName(comment.authorId) }}</span>
                    <span v-if="comment.replyTo" class="text-gray-900 mx-1">回复</span>
                    <span v-if="comment.replyTo" class="text-[#576b95] font-bold">{{ comment.replyTo }}</span>
                    <span class="text-gray-900">: {{ comment.content }}</span>
                    <i v-if="commentToDelete && commentToDelete.id === comment.id" class="fa-solid fa-trash text-red-500 ml-2 text-xs"></i>
                </div>
            </div>
        </div>

        <!-- Comment Input (Inline) -->
        <div v-if="showCommentInput" class="mt-2 bg-gray-50 p-2 rounded flex flex-col gap-2 animate-fade-in border border-gray-100">
            <div v-if="replyToComment" class="flex items-center justify-between text-xs text-gray-600">
                <span>回复 <span class="text-blue-600 font-medium">{{ replyToComment.authorName }}</span></span>
                <i class="fa-solid fa-xmark cursor-pointer" @click="replyToComment = null"></i>
            </div>
            <div class="flex gap-2">
                <input 
                    v-model="commentText"
                    type="text" 
                    class="flex-1 bg-white border border-gray-200 px-3 py-1.5 rounded outline-none text-sm"
                    :placeholder="replyToComment ? '输入回复内容...' : '评论'"
                    @keyup.enter="handleComment"
                    autoFocus
                >
                <button class="text-blue-500 font-bold text-sm px-2" @click="handleComment">发布</button>
                <button class="text-gray-400 text-sm px-1" @click="showCommentInput = false; replyToComment = null">取消</button>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
    from { opacity: 0; transform: translateX(5px); }
    to { opacity: 1; transform: translateX(0); }
}
.animate-fade-in {
    animation: fadeIn 0.15s ease-out;
}
</style>
