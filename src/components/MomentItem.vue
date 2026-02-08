<script setup>
import { ref, computed } from 'vue'
import { useMomentsStore } from '../stores/momentsStore'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useRouter } from 'vue-router'
import { useStickerStore } from '../stores/stickerStore'
import { parseWeChatEmojis } from '../utils/emojiParser'

const props = defineProps({
    moment: Object,
    isDetail: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['back', 'edit', 'showProfile', 'show-detail', 'preview-images'])

const momentsStore = useMomentsStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()

const router = useRouter()

const vFocus = {
    mounted: (el) => el.focus()
}

// --- State ---
const showActionMenu = ref(false) // For Moment Menu (...)
const showCommentMenu = ref(false) // For Comment Long-press Menu
const showShareModal = ref(false) // For Sharing Modal
const activeComment = ref(null)
const showCommentInput = ref(false)
const commentText = ref('')
const commentMentions = ref([])
const showCommentMentionList = ref(false)
const deleteConfirmMode = ref(false) // For Moment Delete Confirmation
const replyToComment = ref(null)
let longPressTimer = null
let touchStartX = 0
let touchStartY = 0

// --- Getters ---
const isUser = computed(() => {
    return props.moment?.authorId === 'user' ||
        (settingsStore.personalization.userProfile.wechatId && props.moment?.authorId === settingsStore.personalization.userProfile.wechatId)
})
const author = computed(() => {
    if (isUser.value) return settingsStore.personalization.userProfile
    const authorId = props.moment?.authorId
    if (!authorId) {
        return { name: '神秘人', avatar: '' }
    }
    // 优先尝试通过 chatStore 的 key 查找
    if (chatStore.chats[authorId]) {
        const chat = chatStore.chats[authorId]
        return {
            ...chat,
            name: chat.remark || chat.name // Use Remark Name
        }
    }
    // 尝试通过角色内部 id 属性、wechatId、名称、或备注查找
    const char = Object.values(chatStore.chats).find(c =>
        c.id === authorId ||
        c.wechatId === authorId ||
        c.name === authorId ||
        c.remark === authorId
    )
    if (char) {
        return {
            ...char,
            name: char.remark || char.name
        }
    }
    // 如果是纯数字长串ID，显示为神秘人，避免乱码
    if (/^\d{10,}$/.test(authorId)) {
        return { name: '神秘好友', avatar: '' }
    }
    // 如果都找不到，使用authorId作为名称，确保显示正确的作者名
    return { name: authorId, avatar: '' }
})

// Current User Avatar Context (For commenting on THIS moment)
const currentUserAvatar = computed(() => {
    // If interacting with a Character's post, use the specific user avatar for that character
    if (props.moment?.authorId && chatStore.chats[props.moment.authorId]) {
        return chatStore.chats[props.moment.authorId].userAvatar || settingsStore.personalization.userProfile.avatar
    }
    return settingsStore.personalization.userProfile.avatar
})

const currentUserName = computed(() => {
    // If interacting with a Character's post, use the specific user name for that character
    if (props.moment?.authorId && chatStore.chats[props.moment.authorId]) {
        return chatStore.chats[props.moment.authorId].userName || settingsStore.personalization.userProfile.name
    }
    return settingsStore.personalization.userProfile.name
})

const getDisplayReplyName = (name) => {
    if (!name) return ''
    if (name === 'user' || name === '用户' || name === '我') {
        return currentUserName.value
    }
    return getAuthorName(name)
}

const isLiked = computed(() => (props.moment?.likes || []).includes(settingsStore.personalization.userProfile.name))

const totalLikes = computed(() => {
    const listLen = (props.moment?.likes || []).length
    const base = props.moment?.baseLikeCount || 0
    return listLen + base
})

const likeNames = computed(() => {
    const list = [...(props.moment?.likes || [])]
    const userName = settingsStore.personalization.userProfile.name

    // Ensure current user is at the first position if they liked
    const userIdx = list.findIndex(name => name === 'user' || name === userName)
    if (userIdx > -1) {
        const foundName = list.splice(userIdx, 1)[0]
        list.unshift(foundName === 'user' ? userName : foundName)
    }

    const total = totalLikes.value
    if (total === 0) return ''

    // Show up to 8 names
    const displayList = list.slice(0, 8)

    if (displayList.length === 0) return `${total} 位好友觉得很赞`

    let namesPart = displayList.join('、')
    if (total > displayList.length) {
        namesPart += ` 等 ${total - displayList.length} 位好友`
    }
    return namesPart + '觉得很赞'
})

const getAuthorName = (id) => {
    if (!id) return '神秘好友'
    if (id === 'user' || id === settingsStore.personalization.userProfile.name) return settingsStore.personalization.userProfile.name

    // 1. Direct key lookup
    if (chatStore.chats[id]) {
        return chatStore.chats[id].remark || chatStore.chats[id].name
    }

    // 2. Normalized search (Case-insensitive)
    const nid = String(id).toLowerCase()
    const char = Object.values(chatStore.chats).find(c =>
        (c.id && c.id.toLowerCase() === nid) ||
        (c.wechatId && c.wechatId.toLowerCase() === nid) ||
        (c.name && c.name.toLowerCase() === nid) ||
        (c.remark && c.remark.toLowerCase() === nid)
    )
    if (char) return char.remark || char.name

    // 3. Fallback for pure numeric IDs
    if (/^\d{10,}$/.test(id)) return '神秘好友'

    return id
}

const getAuthorAvatar = (id) => {
    if (id === 'user') return settingsStore.personalization.userProfile.avatar

    const nid = id ? String(id).toLowerCase() : ''
    const char = chatStore.chats[id] || Object.values(chatStore.chats).find(c =>
        (c.id && c.id.toLowerCase() === nid) ||
        (c.wechatId && c.wechatId.toLowerCase() === nid) ||
        (c.name && c.name.toLowerCase() === nid) ||
        (c.remark && c.remark.toLowerCase() === nid)
    )

    if (char && char.avatar) return char.avatar

    // Fallback based on name seed for visual consistency
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${id || 'Anon'}&backgroundColor=b6e3f4,c0aede,d1d4f9`
}

const renderCommentContent = (comment) => {
    if (!comment || !comment.content) return ''
    let content = comment.content

    // Escape HTML
    const div = document.createElement('div')
    div.textContent = content
    content = div.innerHTML

    // 1. Handle Hashtags FIRST (#Topic ) - prevent collision with hex colors in span tags
    content = content.replace(/#([^\s#]+)(\s|$)/g, (match, topic, spacer) => {
        return `<span class="text-[#576b95] font-medium">#${topic}</span>${spacer}`
    })

    // 2. Regex for @Name mentions - convert IDs to names and make them blue
    const mentionRegex = /@([^\s@:：,.!?;，。！？]+)/g
    content = content.replace(mentionRegex, (match, nameOrId) => {
        // Try to resolve ID to actual name
        let displayName = nameOrId

        // If it's a numeric ID, try to find the character name
        if (/^\d+$/.test(nameOrId)) {
            const resolvedName = getAuthorName(nameOrId)
            if (resolvedName && resolvedName !== '神秘人') {
                displayName = resolvedName
            }
        }

        return `<span class="text-[#576b95] font-medium">@${displayName}</span>`
    })

    // 3. Regex for [表情包:名称]
    const stickerRegex = /\[表情包:([^\]]+)\]/g
    const parseStickers = (txt) => {
        return txt.replace(stickerRegex, (match, name) => {
            // Priority: Author's specific emojis > Global sticks
            let sticker = null
            if (props.moment?.authorId) {
                const char = chatStore.chats[props.moment.authorId]
                if (char && char.emojis) {
                    sticker = char.emojis.find(s => s.name === name)
                }
            }
            if (!sticker) {
                sticker = stickerStore?.stickers?.find(s => s.name === name)
            }

            if (sticker) {
                return `<img src="${sticker.url}" class="inline-block w-6 h-6 mx-0.5 align-bottom" title="${name}" />`
            }
            return match
        })
    }

    content = parseStickers(content)

    // 4. Handle WeChat Emojis
    content = parseWeChatEmojis(content)

    return content
}

// --- Content Parsing (Stickers) ---
const parsedContent = computed(() => {
    const rawContent = props.moment?.content
    if (!rawContent) return ''

    let content = rawContent
    // Escape HTML first
    const div = document.createElement('div')
    div.textContent = content
    content = div.innerHTML

    // 1. Handle raw template literals that AI often leaks (e.g. ${user.name})
    if (content.includes('${user.name}')) {
        const uName = settingsStore.personalization.userProfile.name
        content = content.replace(/\$\{user\.name\}/g, uName)
    }

    // 2. Handle Hashtags FIRST (#Topic )
    content = content.replace(/#([^\s#]+)(\s|$)/g, (match, topic, spacer) => {
        return `<span class="text-[#576b95] font-medium">#${topic}</span>${spacer}`
    })

    // 3. Regex for @Name mentions - convert IDs to names and make them blue
    const mentionRegex = /@([^\s@:：,.!?;，。！？]+)/g
    content = content.replace(mentionRegex, (match, nameOrId) => {
        // Try to resolve ID to actual name
        let displayName = nameOrId

        // If it's a numeric ID, try to find the character name
        if (/^\d+$/.test(nameOrId)) {
            const resolvedName = getAuthorName(nameOrId)
            if (resolvedName && resolvedName !== '神秘人') {
                displayName = resolvedName
            }
        }

        return `<span class="text-[#576b95] font-medium">@${displayName}</span>`
    })

    // 4. Regex for [表情包:名称]
    const stickerRegex = /\[表情包:([^\]]+)\]/g
    content = content.replace(stickerRegex, (match, name) => {
        let sticker = null
        if (props.moment?.authorId) {
            const char = chatStore.chats[props.moment.authorId]
            if (char && char.emojis) {
                sticker = char.emojis.find(s => s.name === name)
            }
        }
        if (!sticker) {
            sticker = stickerStore?.stickers?.find(s => s.name === name)
        }

        if (sticker) {
            return `<img src="${sticker.url}" class="inline-block w-10 h-10 mx-0.5 align-top" title="${name}" />`
        }
        return match
    })

    // 5. Handle WeChat Emojis [微笑] [心]
    content = parseWeChatEmojis(content)

    return content
})

const handleImagePreview = (index) => {
    if (!props.moment?.images) return
    emit('preview-images', {
        images: Array.from(props.moment.images),
        index: index
    })
}

// --- Actions ---
const toggleLike = () => {
    if (isLiked.value) {
        momentsStore.removeLike(props.moment.id, 'user')
    } else {
        momentsStore.addLike(props.moment.id, 'user')
        chatStore.triggerToast('已点赞', 'info')
    }
    showActionMenu.value = false
}

const handleComment = () => {
    if (!commentText.value.trim()) return

    momentsStore.addComment(props.moment.id, {
        authorId: 'user',
        content: commentText.value,
        mentions: [...commentMentions.value],
        replyTo: replyToComment.value ? replyToComment.value.authorName : null
    })

    commentText.value = ''
    commentMentions.value = []
    showCommentInput.value = false
    replyToComment.value = null
    showCommentMentionList.value = false
    chatStore.triggerToast('已评论', 'info')
}

const handleCommentMentionSelect = (target) => {
    const name = target.name
    const id = target.id

    if (!commentMentions.value.some(m => m.name === name)) {
        commentMentions.value.push({ id, name })
    }

    if (!commentText.value.includes(`@${name}`)) {
        if (commentText.value && !commentText.value.endsWith(' ')) {
            commentText.value += ' '
        }
        commentText.value += `@${name} `
    }
    showCommentMentionList.value = false
}

const startReplyTo = (comment) => {
    replyToComment.value = comment
    showCommentInput.value = true
    commentText.value = ''
}

// Comment deletion - Long Press & Context Menu
const handleCommentTouchStart = (e, comment) => {
    if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
    }
    longPressTimer = setTimeout(() => {
        activeComment.value = comment
        showCommentMenu.value = true
        if (navigator.vibrate) navigator.vibrate(50)
    }, 500)
}

const handleCommentTouchMove = (e) => {
    if (!longPressTimer) return
    if (e.touches && e.touches.length > 0) {
        const moveX = e.touches[0].clientX
        const moveY = e.touches[0].clientY
        if (Math.abs(moveX - touchStartX) > 10 || Math.abs(moveY - touchStartY) > 10) {
            clearTimeout(longPressTimer)
            longPressTimer = null
        }
    }
}

const handleCommentTouchEnd = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

const handleCommentContextMenu = (event, comment) => {
    event.preventDefault()
    activeComment.value = comment
    showCommentMenu.value = true
}

const canDeleteComment = (comment) => {
    if (!comment) return false
    // God Mode: User can delete any comment on any post
    return true
}

const handleReplyAction = () => {
    if (activeComment.value) {
        startReplyTo(activeComment.value)
        showCommentMenu.value = false
    }
}

const handleCopyComment = async () => {
    if (activeComment.value && activeComment.value.content) {
        try {
            await navigator.clipboard.writeText(activeComment.value.content)
            chatStore.triggerToast('已复制', 'success')
        } catch (e) {
            chatStore.triggerToast('复制失败', 'error')
        }
    }
    showCommentMenu.value = false
}

const handleDeleteCommentAction = () => {
    if (activeComment.value) {
        momentsStore.deleteComment(props.moment.id, activeComment.value.id)
        chatStore.triggerToast('已删除评论', 'success')
        showCommentMenu.value = false
    }
}

const handleCommentClick = (comment) => {
    startReplyTo(comment)
}

const handleEdit = () => {
    emit('edit', props.moment)
    showActionMenu.value = false
}

const handleShare = () => {
    // Open Contact Selector
    showShareModal.value = true
    showActionMenu.value = false
}

const confirmShare = (contact) => {
    if (!contact || !contact.id) return

    chatStore.addMessage(contact.id, {
        role: 'user',
        type: 'moment_card',
        content: JSON.stringify({
            id: props.moment.id,
            author: author.value.name,
            text: props.moment.content,
            image: (props.moment.images || [])[0] || null
        })
    })

    showShareModal.value = false
    chatStore.triggerToast('已分享', 'success')
}

const handleSummon = async () => {
    try {
        await momentsStore.triggerAIInteractions(props.moment.id)
    } catch (e) {
        console.error('[Summon] Failed:', e)
    }
}

const handleToggleTop = () => {
    const isPinned = momentsStore.toggleTopMoment(props.moment.id)
    chatStore.triggerToast(isPinned ? '已置顶' : '已取消置顶', 'success')
    showActionMenu.value = false
}

const handleDeleteClick = () => {
    if (deleteConfirmMode.value) {
        momentsStore.deleteMoment(props.moment.id)
        chatStore.triggerToast('已删除', 'info')
        showActionMenu.value = false
        deleteConfirmMode.value = false
    } else {
        deleteConfirmMode.value = true
        setTimeout(() => {
            deleteConfirmMode.value = false
        }, 3000)
    }
}



const formatTime = (ts) => {
    if (!ts) return ''
    const date = new Date(ts)
    const now = new Date()

    // Helper for zero padding
    const pad = (n) => n.toString().padStart(2, '0')

    const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`

    // If today
    if (date.toDateString() === now.toDateString()) {
        return timeStr
    }

    // If this year
    if (date.getFullYear() === now.getFullYear()) {
        return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${timeStr}`
    }

    return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${timeStr}`
}

const navigateToAuthor = () => {
    if (isUser.value) {
        emit('showProfile', 'user')
    } else {
        // Robust navigation: if numeric ID, try to find the chat key first
        const id = props.moment.authorId
        let finalId = id
        if (!chatStore.chats[id]) {
            const char = Object.values(chatStore.chats).find(c =>
                c.id === id || c.wechatId === id || c.name === id || c.remark === id
            )
            if (char) {
                const key = Object.keys(chatStore.chats).find(k => chatStore.chats[k] === char)
                if (key) finalId = key
            }
        }
        emit('showProfile', finalId)
    }
}
</script>

<template>
    <div class="moment-item flex p-4 border-b border-gray-100 bg-white" :data-moment-id="props.moment?.id"
        @contextmenu.prevent>
        <!-- Avatar -->
        <div class="w-11 h-11 rounded-lg overflow-hidden shrink-0 mr-3 mt-1 bg-gray-100 cursor-pointer active:opacity-70 transition-opacity"
            @click="navigateToAuthor">
            <img :src="author.avatar" class="w-full h-full object-cover">
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
            <!-- Name -->
            <h3 class="text-[#576b95] font-bold text-base mb-1 cursor-pointer hover:underline inline-block"
                @click="navigateToAuthor">{{ author?.name }}</h3>

            <div v-if="momentsStore.topMoments.includes(props.moment.id)"
                class="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded border border-orange-100 uppercase tracking-tighter align-middle">
                <i class="fa-solid fa-thumbtack rotate-45 scale-75"></i>
                置顶
            </div>

            <!-- Text with Parsed Stickers (Clickable to detail) -->
            <div @click="!isDetail && emit('show-detail')">
                <div v-if="!props.moment?.html"
                    class="text-gray-900 text-base mb-3 whitespace-pre-wrap break-words leading-relaxed"
                    v-html="parsedContent"></div>

                <!-- HTML Content -->
                <div v-if="props.moment?.html" class="html-content mb-3 text-gray-900 text-base leading-relaxed"
                    v-html="props.moment?.html"></div>
            </div>

            <!-- Location -->
            <div v-if="props.moment?.location"
                class="flex items-center gap-1 text-[#576b95] text-[13px] mb-3 opacity-90">
                <i class="fa-solid fa-location-dot scale-90"></i>
                <span class="font-medium underline decoration-[#576b95]/30 underline-offset-2">{{ props.moment.location
                    }}</span>
            </div>

            <!-- Images Grid -->
            <div v-if="(props.moment?.images || []).length > 0" class="grid gap-1 mb-3" :class="[
                (props.moment?.images || []).length === 1 ? 'grid-cols-1 max-w-[80%]' :
                    (props.moment?.images || []).length === 2 ? 'grid-cols-2 w-2/3' :
                        (props.moment?.images || []).length === 4 ? 'grid-cols-2 w-2/3' :
                            'grid-cols-3'
            ]">
                <div v-for="(img, idx) in (props.moment?.images || [])" :key="idx"
                    class="bg-gray-50 rounded-sm overflow-hidden flex items-center justify-center border border-gray-100 cursor-zoom-in active:scale-[0.98] transition-all relative z-10"
                    :class="(props.moment?.images || []).length === 1 ? '' : 'aspect-square'"
                    @click.stop="handleImagePreview(idx)">
                    <img :src="img" class="w-full h-full object-cover pointer-events-none">
                </div>
            </div>

            <!-- Stickers -->
            <div v-if="(props.moment?.stickers || []).length > 0" class="flex flex-wrap gap-2 mb-3">
                <div v-for="(stk, idx) in (props.moment?.stickers || [])" :key="idx"
                    class="w-20 h-20 flex items-center justify-center">
                    <img :src="stk" class="w-full h-full object-contain">
                </div>
            </div>

            <!-- Interaction Bar -->
            <div v-if="props.moment?.visibility !== 'private'"
                class="mt-4 pt-3 border-t border-gray-50 flex items-center gap-8 px-1" @click.stop>
                <button class="flex items-center gap-1.5 transition-colors active:scale-95"
                    :class="isLiked ? 'text-red-500' : 'text-gray-500'" @click="toggleLike">
                    <i :class="[isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart']" class="text-sm"></i>
                    <span class="text-xs font-medium">{{ totalLikes || '赞' }}</span>
                </button>

                <button class="flex items-center gap-1.5 text-gray-500 transition-colors active:scale-95"
                    @click="showCommentInput = !showCommentInput">
                    <i class="fa-regular fa-comment text-sm"></i>
                    <span class="text-xs font-medium">{{ (props.moment?.comments || []).length || '评论' }}</span>
                </button>

                <button class="flex items-center gap-1.5 text-gray-500 transition-colors active:scale-95"
                    @click="handleShare">
                    <i class="fa-solid fa-share-nodes text-sm"></i>
                    <span class="text-xs font-medium text-gray-500">分享</span>
                </button>

                <button v-if="props.moment?.visibility !== 'private'"
                    class="flex items-center gap-1.5 text-purple-500 transition-colors active:scale-95 disabled:opacity-50 disabled:grayscale"
                    @click="handleSummon" :disabled="momentsStore.summoningIds.has(props.moment.id)" title="召唤朋友互动">
                    <i class="fa-solid text-sm"
                        :class="momentsStore.summoningIds.has(props.moment.id) ? 'fa-spinner fa-spin' : 'fa-wand-sparkles'"></i>
                    <span class="text-xs font-medium">{{ momentsStore.summoningIds.has(props.moment.id) ? '召唤中' : '召唤'
                    }}</span>
                </button>
            </div>

            <!-- Footer: Time & Management Menu -->
            <div class="flex items-center mt-4" @click.stop>
                <span class="text-xs text-gray-400 mr-2">{{ formatTime(props.moment?.timestamp) }}</span>

                <!-- Visibility Icons (God mode View) -->
                <div v-if="props.moment?.visibility && props.moment?.visibility !== 'public'"
                    class="flex items-center gap-1 text-gray-300">
                    <i v-if="props.moment.visibility === 'private'" class="fa-solid fa-lock text-[10px]" title="私密"></i>
                    <i v-else-if="props.moment.visibility === 'partial'" class="fa-solid fa-user-group text-[10px]"
                        title="部分可见"></i>
                    <i v-else-if="props.moment.visibility === 'exclude'" class="fa-solid fa-user-slash text-[10px]"
                        title="不给谁看"></i>
                </div>

                <div class="flex-1"></div>

                <div class="relative">
                    <div class="w-8 h-8 flex items-center justify-center cursor-pointer active:opacity-60 transition-opacity"
                        @click.stop="showActionMenu = !showActionMenu">
                        <i class="fa-solid fa-ellipsis text-gray-400"></i>
                    </div>

                    <div v-if="showActionMenu"
                        class="absolute bottom-full right-0 mb-2 bg-[#4c4c4c] rounded-lg shadow-xl py-1 min-w-[100px] z-20 animate-scale-up origin-bottom-right"
                        @click.stop>
                        <div class="px-4 py-2 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer text-white text-xs border-b border-[#5f5f5f]"
                            @click="handleEdit">
                            <i class="fa-solid fa-pen-to-square"></i>
                            <span>编辑</span>
                        </div>
                        <div v-if="isUser"
                            class="px-4 py-2 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer text-orange-300 text-xs border-b border-[#5f5f5f]"
                            @click="handleToggleTop">
                            <i class="fa-solid fa-thumbtack"></i>
                            <span>{{ momentsStore.topMoments.includes(props.moment.id) ? '取消置顶' : '置顶动态' }}</span>
                        </div>
                        <div class="px-4 py-2 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer text-xs border-b border-[#5f5f5f]"
                            :class="deleteConfirmMode ? 'text-red-500 font-bold bg-[#5f5f5f]' : 'text-red-400'"
                            @click="handleDeleteClick">
                            <i :class="deleteConfirmMode ? 'fa-solid fa-check' : 'fa-solid fa-trash'"></i>
                            <span>{{ deleteConfirmMode ? '确认删除?' : '删除' }}</span>
                        </div>
                        <div class="px-4 py-2 flex items-center justify-center active:bg-[#5f5f5f] cursor-pointer text-gray-300 text-[10px]"
                            @click="showActionMenu = false">
                            取消
                        </div>
                    </div>
                </div>
            </div>

            <!-- Interactions Area -->
            <div v-if="(props.moment?.likes || []).length > 0 || (props.moment?.comments || []).length > 0"
                class="mt-2 bg-[#f7f7f7] rounded relative interaction-area" @click.stop>
                <div
                    class="absolute -top-1.5 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#f7f7f7]">
                </div>

                <!-- Likes -->
                <div v-if="(props.moment?.likes || []).length > 0"
                    class="px-3 py-1.5 border-b border-gray-200 flex items-start gap-1 text-[#576b95] text-sm font-medium">
                    <i class="fa-regular fa-heart mt-1 mr-1 text-xs"></i>
                    <span class="flex-1 break-all">{{ likeNames }}</span>
                </div>

                <!-- Comments -->
                <div v-if="(props.moment?.comments || []).length > 0" class="px-3 py-1.5 space-y-1">
                    <div v-for="comment in (isDetail ? (props.moment?.comments || []) : (props.moment?.comments || []).slice(0, 4))"
                        :key="comment.id"
                        class="text-sm cursor-pointer px-2 py-1 rounded transition-colors flex justify-between items-start group"
                        :class="activeComment && activeComment.id === comment.id && showCommentMenu ? 'bg-gray-200' : 'hover:bg-gray-100'"
                        @touchstart="handleCommentTouchStart($event, comment)" @touchmove="handleCommentTouchMove"
                        @touchend="handleCommentTouchEnd" @click.stop="handleCommentClick(comment)"
                        @contextmenu="handleCommentContextMenu($event, comment)" title="长按操作">

                        <div class="flex-1">
                            <span class="text-[#576b95] font-bold">{{ comment.authorName ||
                                getAuthorName(comment.authorId) }}</span>
                            <span v-if="comment.replyTo" class="text-gray-900 mx-1">回复</span>
                            <span v-if="comment.replyTo" class="text-[#576b95] font-bold hover:underline">{{
                                getDisplayReplyName(comment.replyTo) }}</span>
                            <span class="text-gray-900">: </span>
                            <span class="text-gray-900" v-html="renderCommentContent(comment)"></span>
                        </div>

                        <!-- Timestamp (Detail View Only) -->
                        <span v-if="isDetail" class="text-[10px] text-gray-400 ml-2 mt-0.5 shrink-0 tabular-nums">
                            {{ formatTime(comment.timestamp).split(' ').pop() }}
                        </span>
                    </div>

                    <!-- View More Hint -->
                    <div v-if="!isDetail && (props.moment?.comments || []).length > 4"
                        class="px-2 py-1 text-xs text-blue-500 font-medium cursor-pointer"
                        @click.stop="emit('show-detail')">
                        共 {{ (props.moment?.comments || []).length }} 条评论...
                    </div>
                </div>
            </div>

            <!-- Comment Input -->
            <div v-if="showCommentInput"
                class="mt-2 bg-gray-50 p-2 rounded flex flex-col gap-2 animate-fade-in border border-gray-100 comment-input-area"
                @click.stop>
                <div v-if="replyToComment" class="flex items-center justify-between text-xs text-gray-600">
                    <span>回复 <span class="text-blue-600 font-medium">{{ getDisplayReplyName(replyToComment.authorName)
                    }}</span></span>
                    <i class="fa-solid fa-xmark cursor-pointer" @click="replyToComment = null"></i>
                </div>
                <div class="flex gap-2">
                    <input v-model="commentText" type="text"
                        class="flex-1 bg-white border border-gray-200 px-3 py-1.5 rounded outline-none text-sm"
                        :placeholder="replyToComment ? '输入回复内容...' : '评论'" @keyup.enter="handleComment" v-focus>
                    <div class="flex items-center gap-1">
                        <i class="fa-solid fa-at text-gray-400 cursor-pointer hover:text-blue-500"
                            @click="showCommentMentionList = !showCommentMentionList"></i>
                        <button class="text-blue-500 font-bold text-sm px-2" @click="handleComment">发布</button>
                    </div>
                </div>

                <!-- Mini Mention List -->
                <div v-if="showCommentMentionList"
                    class="bg-white border border-gray-100 rounded-lg shadow-lg max-h-40 overflow-y-auto p-1 space-y-1 custom-scrollbar">
                    <div
                        class="px-2 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-50 flex justify-between items-center">
                        <span>选择提醒对象</span>
                        <i class="fa-solid fa-xmark cursor-pointer" @click="showCommentMentionList = false"></i>
                    </div>
                    <!-- User themselves -->
                    <div class="flex items-center gap-2 p-1.5 rounded hover:bg-blue-50 cursor-pointer transition-colors"
                        @click="handleCommentMentionSelect({ id: 'user', name: settingsStore.personalization.userProfile.name })">
                        <div class="w-6 h-6 rounded bg-gray-200 shrink-0">
                            <img :src="currentUserAvatar" class="w-full h-full object-cover rounded">
                        </div>
                        <span class="text-xs font-bold text-gray-700">{{ currentUserName }} (我自己)</span>
                    </div>
                    <!-- Contacts -->
                    <div v-for="chat in chatStore.contactList" :key="chat.id"
                        class="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        @click="handleCommentMentionSelect(chat)">
                        <div class="w-6 h-6 rounded bg-gray-200 shrink-0">
                            <img :src="chat.avatar" class="w-full h-full object-cover rounded">
                        </div>
                        <span class="text-xs font-bold text-gray-700">{{ chat.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Comment Action Menu Overlay -->
        <div v-if="showCommentMenu" class="fixed inset-0 z-[150] flex items-center justify-center bg-black/40"
            @click="showCommentMenu = false" @touchmove.prevent>
            <div class="bg-white w-64 rounded-xl overflow-hidden shadow-2xl animate-scale-up" @click.stop>
                <div class="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span class="font-bold text-gray-700 text-sm">评论操作</span>
                    <span class="text-xs text-gray-400 font-normal">
                        {{ activeComment?.authorName || '未知用户' }}
                    </span>
                </div>
                <div class="p-2 space-y-1">
                    <button
                        class="w-full py-3 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-2 text-gray-700 active:bg-gray-100 transition-colors"
                        @click="handleReplyAction">
                        <i class="fa-solid fa-reply"></i>
                        回复
                    </button>
                    <button
                        class="w-full py-3 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-2 text-gray-700 active:bg-gray-100 transition-colors"
                        @click="handleCopyComment">
                        <i class="fa-regular fa-copy"></i>
                        复制
                    </button>
                    <button v-if="canDeleteComment(activeComment)"
                        class="w-full py-3 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2 text-red-500 font-bold active:bg-red-100 transition-colors"
                        @click="handleDeleteCommentAction">
                        <i class="fa-solid fa-trash"></i>
                        删除
                    </button>
                </div>
                <div class="border-t border-gray-100 p-2">
                    <button class="w-full py-2 text-gray-400 text-xs hover:text-gray-600"
                        @click="showCommentMenu = false">取消</button>
                </div>
            </div>
        </div>

        <!-- Contact Selector Modal for Sharing -->
        <div v-if="showShareModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
            @click="showShareModal = false">
            <div class="bg-white w-[90%] max-w-[320px] rounded-xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[80vh]"
                @click.stop>
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <span class="font-bold text-gray-700">选择好友分享</span>
                    <i class="fa-solid fa-xmark text-gray-400 cursor-pointer p-1" @click="showShareModal = false"></i>
                </div>
                <div class="overflow-y-auto flex-1 p-2 space-y-1">
                    <div v-for="chat in chatStore.contactList" :key="chat.id"
                        class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100"
                        @click="confirmShare(chat)">
                        <div class="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-200">
                            <img :src="chat.avatar" class="w-full h-full object-cover">
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-800 text-sm">{{ chat.name }}</span>
                            <span class="text-xs text-gray-400 truncate max-w-[150px]">{{ chat.signature || '暂无签名'
                                }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateX(5px);
    }

    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.animate-fade-in {
    animation: fadeIn 0.15s ease-out;
}

/* --- Dark Mode Adaptation --- */
:deep([data-theme='dark']) .moment-item {
    background-color: #191919;
    border-bottom-color: #252525;
}

:deep([data-theme='dark']) .text-gray-900 {
    color: #e5e5e5;
}

:deep([data-theme='dark']) .text-gray-600 {
    color: #a3a3a3;
}

:deep([data-theme='dark']) .text-gray-500 {
    color: #888;
}

:deep([data-theme='dark']) .text-gray-400 {
    color: #777;
}

:deep([data-theme='dark']) .bg-white {
    background-color: #191919;
}

:deep([data-theme='dark']) .bg-gray-50 {
    background-color: #222;
}

:deep([data-theme='dark']) .bg-gray-100 {
    background-color: #2a2a2a;
}

:deep([data-theme='dark']) .border-gray-50,
:deep([data-theme='dark']) .border-gray-100,
:deep([data-theme='dark']) .border-gray-200 {
    border-color: #2a2a2a;
}

:deep([data-theme='dark']) .bg-\[\#f7f7f7\],
:deep([data-theme='dark']) .interaction-area {
    background-color: #252525 !important;
}

:deep([data-theme='dark']) .comment-input-area {
    background-color: #2a2a2a !important;
    border-color: #333 !important;
}

:deep([data-theme='dark']) .comment-input-area input {
    background-color: #191919 !important;
    border-color: #444 !important;
    color: #eee !important;
}

:deep([data-theme='dark']) .border-b-\[\#f7f7f7\] {
    border-bottom-color: #252525;
}

:deep([data-theme='dark']) .text-\[\#576b95\] {
    color: #7d90a9;
}

:deep([data-theme='dark']) .hover\:bg-gray-100:hover {
    background-color: #2a2a2a;
}

:deep([data-theme='dark']) .bg-blue-50 {
    background-color: #1d3557;
}

:deep([data-theme='dark']) .text-blue-500 {
    color: #4a90e2;
}
</style>
