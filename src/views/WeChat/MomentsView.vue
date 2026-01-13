<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMomentsStore } from '../../stores/momentsStore'
import MomentsNotifications from './MomentsNotifications.vue'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import MomentItem from '../../components/MomentItem.vue'
import EmojiPicker from './EmojiPicker.vue'
import { useStickerStore } from '../../stores/stickerStore'
import { useWorldBookStore } from '../../stores/worldBookStore'
import { generateImage, translateToEnglish } from '../../utils/aiService'

const router = useRouter()
const props = defineProps({
    initialProfileId: {
        type: String,
        default: null
    }
})

const emit = defineEmits(['back', 'closeProfile'])
const isCharacterMode = ref(!!props.initialProfileId) // New: track if opened for a specific character
const momentsStore = useMomentsStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()
const worldBookStore = useWorldBookStore()

// Custom focus directive
const vFocus = {
    mounted: (el) => el.focus()
}

// Keep isCharacterMode in sync with prop for robust behavior
watch(() => props.initialProfileId, (newId) => {
    isCharacterMode.value = !!newId
}, { immediate: true })

const userProfile = computed(() => settingsStore.personalization.userProfile)

// --- State ---
const showPostModal = ref(false)
const showSettingsModal = ref(false)
const isGenerating = ref(false)
const fileInput = ref(null)
const showEmojiPicker = ref(false)
const editingId = ref(null)
const showingProfileCharId = ref(null)
const filterAuthorId = ref(null)
const showNotifications = ref(false)
const profileContextId = ref(null) // New: preserve profile context when viewing individual feed

// Post Form
const postForm = ref({
    content: '',
    images: [],
    stickers: [],
    imageDescription: '',
    location: '',
    visibility: 'public', // public, private, partial, exclude
    visibleIds: []
})

const showVisibilityPicker = ref(false)
const showLocationPicker = ref(false)
const tempLocation = ref('')
const isAIImageLoading = ref(false)
const aiImagePreview = ref(null)
const showAIImageConfirm = ref(false)
const showSignatureModal = ref(false)
const signatureInput = ref('')
const showGenChoiceModal = ref(false)
const genChoiceForm = ref({
    selectedIds: [],
    count: 1
})
const clearMyConfirmMode = ref(false)
const clearConfirmMode = ref(false)
const confirmClearCharId = ref(null)

const openSignatureModal = () => {
    signatureInput.value = userProfile.value.signature || ''
    showSignatureModal.value = true
}

const confirmSignature = () => {
    settingsStore.updateUserProfile({ signature: signatureInput.value.trim() })
    showSignatureModal.value = false
    chatStore.triggerToast('签名已更新', 'success')
}

const openLocationPicker = () => {
    tempLocation.value = postForm.value.location
    showLocationPicker.value = true
}

const confirmLocation = () => {
    postForm.value.location = tempLocation.value
    showLocationPicker.value = false
}
const getVisibilityLabel = (v) => {
    switch (v) {
        case 'public': return '公开'
        case 'private': return '私密 (仅自己可见)'
        case 'partial': return '部分人可见'
        case 'exclude': return '不给谁看'
        default: return '公开'
    }
}

// Settings Form
const settingsForm = ref({
    autoGenerateInterval: momentsStore.config.autoGenerateInterval,
    enabledCharacters: [...momentsStore.config.enabledCharacters],
    enabledWorldBookEntries: [...momentsStore.config.enabledWorldBookEntries],
    customPrompt: momentsStore.config.customPrompt
})

// Default backgrounds from local folder
const defaultBackgrounds = [
    '/默认背景图/橙玫瑰.png',
    '/默认背景图/粉玫瑰.png',
    '/默认背景图/紫玫瑰.png',
    '/默认背景图/红玫瑰.png'
]

// Background customization - use random default if not set
const getInitialBackground = () => {
    const saved = localStorage.getItem('moments_background')
    if (saved) return saved
    return defaultBackgrounds[Math.floor(Math.random() * defaultBackgrounds.length)]
}

const backgroundUrl = ref(getInitialBackground())
const showBackgroundModal = ref(false)
const backgroundInput = ref('')
const backgroundFileInput = ref(null)

// Flatten all entries from all books for selection
const allWorldBookEntries = computed(() => {
    const entries = []

    // Safety check for books
    const books = stickerStore?.worldBookSync?.books || worldBookStore?.books || []

    books.forEach(book => {
        book.entries?.forEach(entry => {
            entries.push({
                ...entry,
                bookName: book.name
            })
        })
    })
    return entries
})

// Filtered moments based on authorId
const filteredMoments = computed(() => {
    if (!momentsStore || !momentsStore.sortedMoments) return []
    const all = momentsStore.sortedMoments.filter(m => m && typeof m === 'object' && m.id)
    if (!filterAuthorId.value) return all
    return all.filter(m => m.authorId === filterAuthorId.value)
})

const currentProfileChar = computed(() => {
    if (!showingProfileCharId.value) return null
    if (!chatStore?.chats) return { name: '神秘人', avatar: '', statusText: '对方很懒，什么都没有留下' }
    return chatStore.chats[showingProfileCharId.value] || { name: '神秘人', avatar: '', statusText: '对方很懒，什么都没有留下' }
})

// --- Actions ---
const goBack = () => {
    emit('back')
}

const handleProfileBack = () => {
    if (filterAuthorId.value === 'user') {
        filterAuthorId.value = null
    } else if (isCharacterMode.value) {
        // If we opened as a character profile view, closing profile means closing the whole moments view
        goBack()
    } else {
        showingProfileCharId.value = null
    }
}

const handlePost = () => {
    if (!postForm.value.content && postForm.value.images.length === 0) return

    if (editingId.value) {
        // Update existing
        momentsStore.updateMoment(editingId.value, {
            content: postForm.value.content,
            images: [...postForm.value.images],
            stickers: [...postForm.value.stickers],
            imageDescriptions: [postForm.value.imageDescription],
            location: postForm.value.location,
            visibility: postForm.value.visibility,
            visibleIds: [...postForm.value.visibleIds]
        })
        chatStore.triggerToast('修改成功', 'success')
    } else {
        // Add new
        momentsStore.addMoment({
            authorId: 'user',
            content: postForm.value.content,
            images: [...postForm.value.images],
            stickers: [...postForm.value.stickers],
            imageDescriptions: [postForm.value.imageDescription],
            location: postForm.value.location,
            visibility: postForm.value.visibility,
            visibleIds: [...postForm.value.visibleIds]
        })
        chatStore.triggerToast('发布成功', 'success')
    }

    // Reset form
    postForm.value = {
        content: '',
        images: [],
        stickers: [],
        imageDescription: '',
        location: '',
        visibility: 'public',
        visibleIds: []
    }
    editingId.value = null
    showPostModal.value = false
    aiImagePreview.value = null
    showAIImageConfirm.value = false
}

const handleAIImageGenerate = async () => {
    if (!postForm.value.imageDescription.trim()) {
        chatStore.triggerToast('请先输入描述', 'info')
        return
    }

    isAIImageLoading.value = true
    chatStore.triggerToast('正在构思画面...', 'info')

    try {
        // 1. Translate / Expand
        const englishPrompt = await translateToEnglish(postForm.value.imageDescription)
        console.log('[AI Image] Translated Prompt:', englishPrompt)

        // 2. Generate
        const imageUrl = await generateImage(englishPrompt)

        // 3. Show Preview
        aiImagePreview.value = imageUrl
        showAIImageConfirm.value = true
        chatStore.triggerToast('生成成功', 'success')
    } catch (e) {
        console.error('[AI Image] Error:', e)
        chatStore.triggerToast(`生成失败: ${e.message}`, 'error')
    } finally {
        isAIImageLoading.value = true // Wait, should be false
        isAIImageLoading.value = false
    }
}

const useAIImage = () => {
    if (aiImagePreview.value) {
        if (postForm.value.images.length < 9) {
            postForm.value.images.push(aiImagePreview.value)
            aiImagePreview.value = null
            showAIImageConfirm.value = false
            chatStore.triggerToast('已添加至动态', 'success')
        } else {
            chatStore.triggerToast('最多上传 9 张图片', 'error')
        }
    }
}

const handleEditMoment = (moment) => {
    editingId.value = moment.id
    postForm.value = {
        content: moment.content,
        images: [...moment.images],
        stickers: [...moment.stickers],
        imageDescription: moment.imageDescriptions[0] || '',
        location: moment.location || '',
        visibility: moment.visibility || 'public',
        visibleIds: [...(moment.visibleIds || [])]
    }
    showPostModal.value = true
}

const viewCharacterMoments = (charId) => {
    filterAuthorId.value = charId
    profileContextId.value = showingProfileCharId.value // Store the profile we came from
    showingProfileCharId.value = null
}

const clearFilter = () => {
    filterAuthorId.value = null
    // If we came from a profile, restore it
    if (profileContextId.value) {
        showingProfileCharId.value = profileContextId.value
        profileContextId.value = null
    }
}

const openChatFromProfile = () => {
    if (!showingProfileCharId.value) return
    chatStore.currentChatId = showingProfileCharId.value
    showingProfileCharId.value = null
    emit('back')
}

const handleLocalImageUpload = (event) => {
    const files = Array.from(event.target.files)
    if (!files.length) return

    files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
            chatStore.triggerToast('文件太大 (限制10MB)', 'error')
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            if (postForm.value.images.length < 9) {
                postForm.value.images.push(e.target.result)
            }
        }
        reader.readAsDataURL(file)
    })
    event.target.value = '' // Reset
}

const handleStickerSelect = (sticker) => {
    if (postForm.value.stickers.length < 9) {
        postForm.value.stickers.push(sticker.url)
        showEmojiPicker.value = false
    }
}

const handleEmojiSelect = (emoji) => {
    postForm.value.content += emoji
}

const triggerBatchGenerate = () => {
    // Open selection modal instead of immediate generation
    genChoiceForm.value = {
        selectedIds: chatStore.contactList.map(c => c.id), // Default: Select all
        count: 1
    }
    showGenChoiceModal.value = true
}

const handleGenChoiceConfirm = async () => {
    if (isGenerating.value) return
    isGenerating.value = true
    showGenChoiceModal.value = false
    chatStore.triggerToast('正在生成中...', 'info')

    try {
        await momentsStore.batchGenerateAIMoments(
            genChoiceForm.value.count,
            genChoiceForm.value.selectedIds
        )
        chatStore.triggerToast('生成成功', 'success')
    } catch (e) {
        chatStore.triggerToast('生成失败', 'error')
    } finally {
        isGenerating.value = false
    }
}

const openSettings = () => {
    settingsForm.value = {
        autoGenerateInterval: momentsStore.config.autoGenerateInterval,
        enabledCharacters: [...momentsStore.config.enabledCharacters],
        enabledWorldBookEntries: [...momentsStore.config.enabledWorldBookEntries],
        customPrompt: momentsStore.config.customPrompt
    }
    showSettingsModal.value = true
}

const saveSettings = () => {
    momentsStore.config.autoGenerateInterval = settingsForm.value.autoGenerateInterval
    momentsStore.config.enabledCharacters = settingsForm.value.enabledCharacters
    momentsStore.config.customPrompt = settingsForm.value.customPrompt

    momentsStore.startAutoGeneration() // Restart loop with new interval
    showSettingsModal.value = false
    chatStore.triggerToast('设置已保存', 'success')
}

const handleClearAll = () => {
    if (clearConfirmMode.value) {
        momentsStore.clearAllMoments()
        chatStore.triggerToast('已清空所有动态', 'info')
        clearConfirmMode.value = false
    } else {
        clearConfirmMode.value = true
        setTimeout(() => {
            clearConfirmMode.value = false
        }, 3000)
    }
}

const handleClearMyMoments = () => {
    if (clearMyConfirmMode.value) {
        momentsStore.clearMyMoments()
        chatStore.triggerToast('已清空我的动态', 'info')
        clearMyConfirmMode.value = false
    } else {
        clearMyConfirmMode.value = true
        setTimeout(() => {
            clearMyConfirmMode.value = false
        }, 3000)
    }
}

const handleClearCharacterMoments = (charId) => {
    if (confirmClearCharId.value === charId) {
        momentsStore.clearCharacterMoments(charId)
        chatStore.triggerToast('已清空该角色动态', 'success')
        confirmClearCharId.value = null
    } else {
        confirmClearCharId.value = charId
        setTimeout(() => {
            if (confirmClearCharId.value === charId) confirmClearCharId.value = null
        }, 3000)
    }
}

// Background Image Customization
const openBackgroundModal = () => {
    backgroundInput.value = backgroundUrl.value
    showBackgroundModal.value = true
}

const setBackgroundFromUrl = () => {
    if (backgroundInput.value.trim()) {
        backgroundUrl.value = backgroundInput.value.trim()
        localStorage.setItem('moments_background', backgroundUrl.value)
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
        backgroundUrl.value = e.target.result
        localStorage.setItem('moments_background', backgroundUrl.value)
        showBackgroundModal.value = false
        chatStore.triggerToast('背景图已更新', 'success')
    }
    reader.readAsDataURL(file)
    event.target.value = '' // Reset
}



const handleUserAvatarClick = () => {
    filterAuthorId.value = 'user'
}

const editUserSignature = () => {
    openSignatureModal()
}

const scrollContainer = ref(null)

const handleNotificationJump = (momentId) => {
    showNotifications.value = false
    // Small delay to ensure the notification modal is closed before scrolling
    setTimeout(() => {
        const el = document.getElementById(momentId)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Visual feedback: briefly highlight the target moment
            el.classList.add('bg-blue-50/30')
            setTimeout(() => el.classList.remove('bg-blue-50/30'), 2000)
        }
    }, 400)
}

onMounted(() => {
    momentsStore.startAutoGeneration()
    if (props.initialProfileId) {
        showingProfileCharId.value = props.initialProfileId
    }
})
</script>

<template>
    <div class="moments-view w-full h-full bg-[#ededed] flex flex-col relative overflow-hidden" @contextmenu.prevent>
        <!-- Notifications Page (Overlay) -->
        <div v-if="showNotifications" class="absolute inset-0 z-50 bg-white">
            <MomentsNotifications @back="showNotifications = false" @jump="handleNotificationJump" />
        </div>

        <!-- Header -->
        <div class="h-[72px] pt-7 shrink-0 flex items-center justify-between px-4 bg-transparent absolute top-0 left-0 right-0 z-20 text-white transition-colors duration-300 overflow-hidden"
            :class="{ 'bg-[#ededed] !text-black': filterAuthorId }">
            <i class="fa-solid fa-chevron-left text-xl cursor-pointer drop-shadow-md"
                @click="filterAuthorId ? clearFilter() : (showingProfileCharId ? handleProfileBack() : goBack())"></i>
            <div v-if="filterAuthorId" class="flex-1 text-center font-bold text-lg truncate px-8">{{
                filterAuthorId === 'user' ? '我的相册' : chatStore.chats[filterAuthorId]?.name }}的相册</div>
            <div v-else-if="showingProfileCharId" class="flex-1 text-center font-bold text-lg truncate px-8">详细资料</div>
            <div class="flex gap-5 items-center">
                <!-- Notification Bell (Only show when not filtering individual) -->
                <div v-if="!filterAuthorId" class="relative cursor-pointer" @click="showNotifications = true">
                    <i class="fa-regular fa-bell text-xl drop-shadow-md text-white"></i>
                    <div v-if="momentsStore.unreadCount > 0"
                        class="absolute -top-1 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full px-1 border border-white">
                        {{ momentsStore.unreadCount > 99 ? '99+' : momentsStore.unreadCount }}
                    </div>
                </div>

                <!-- Magic Wand for AI Generation -->
                <div v-if="!filterAuthorId" class="relative group">
                    <i class="fa-solid fa-wand-magic-sparkles text-xl cursor-pointer drop-shadow-md transition-all active:scale-90"
                        :class="isGenerating ? 'text-yellow-300 animate-spin' : 'text-white'"
                        @click="triggerBatchGenerate"></i>
                </div>

                <i v-if="!filterAuthorId" class="fa-solid fa-gear text-xl cursor-pointer drop-shadow-md"
                    @click="openSettings"></i>
                <i v-if="!filterAuthorId" class="fa-solid fa-camera text-xl cursor-pointer drop-shadow-md"
                    @click="showPostModal = true"></i>
            </div>
        </div>

        <!-- Scrollable Content -->
        <div ref="scrollContainer" class="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
            <!-- Hero Section -->
            <div class="relative w-full h-[280px] bg-gray-300 cursor-pointer" @click="openBackgroundModal">
                <img :src="backgroundUrl" class="w-full h-full object-cover">

                <!-- User Profile Section -->
                <div class="absolute -bottom-14 right-4 flex flex-col items-end z-30 group">
                    <!-- Name & Avatar Row -->
                    <div class="flex items-center gap-4 mb-2.5">
                        <span class="text-white font-bold text-xl drop-shadow-2xl tracking-tight leading-none mb-1">{{
                            userProfile.name }}</span>
                        <div class="w-20 h-20 rounded-2xl overflow-hidden border-[4px] border-white shadow-2xl bg-white relative group active:scale-95 transition-all duration-200"
                            @click.stop="handleUserAvatarClick">
                            <img :src="userProfile.avatar" class="w-full h-full object-cover">
                            <div
                                class="absolute inset-0 bg-black/5 opacity-0 group-active:opacity-100 transition-opacity">
                            </div>
                        </div>
                    </div>

                    <!-- Signature Row (Below Avatar) -->
                    <div class="mr-1 max-w-[220px] bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl cursor-pointer hover:bg-black/40 transition-all border border-white/10 active:scale-95 shadow-lg group-hover:border-white/20"
                        @click.stop="editUserSignature">
                        <span
                            class="text-white/90 text-[12px] font-medium leading-normal text-right block line-clamp-2">
                            {{ userProfile.signature || '添加个性签名...' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Interaction Notification Bar (Premium Design) -->
            <div v-if="momentsStore.unreadCount > 0 && !filterAuthorId"
                class="flex justify-center mt-24 mb-4 relative z-10 animate-notification-pop">
                <div class="bg-[#3e3e3e]/95 backdrop-blur-md text-white px-3 py-1.5 rounded-lg flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.3)] cursor-pointer active:scale-95 transition-all border border-white/10 group"
                    @click="showNotifications = true">
                    <div class="w-7 h-7 rounded-md overflow-hidden ring-1 ring-white/20">
                        <img :src="momentsStore.notifications[0]?.actorAvatar" class="w-full h-full object-cover">
                    </div>
                    <span class="text-[13px] font-bold tracking-wide">{{ momentsStore.unreadCount }} 条新消息</span>
                    <i
                        class="fa-solid fa-chevron-right text-[10px] opacity-40 group-hover:translate-x-0.5 transition-transform"></i>
                </div>
            </div>

            <!-- Moments Feed -->
            <div class="px-0 pb-10"
                :class="[filterAuthorId ? 'pt-[72px]' : (momentsStore.unreadCount > 0 ? 'pt-6' : 'pt-12')]">
                <div v-if="filteredMoments.length === 0"
                    class="flex flex-col items-center justify-center py-20 opacity-30">
                    <i class="fa-solid fa-earth-asia text-5xl mb-4"></i>
                    <p>{{ filterAuthorId ? '由于该角色暂时没有动态' : '暂无动态，快去发布或点击一键生成吧' }}</p>
                </div>

                <MomentItem v-for="moment in filteredMoments" :key="moment.id" :id="moment.id" :moment="moment"
                    @back="goBack" @edit="handleEditMoment"
                    @show-profile="id => id === 'user' ? handleUserAvatarClick() : (showingProfileCharId = id)" />
            </div>

            <!-- One-Click Generate Button (Floating or Bottom) -->
            <div class="px-4 py-8 flex justify-center">
                <button
                    class="px-8 py-3 rounded-full bg-white/80 backdrop-blur-md text-blue-500 font-bold shadow-sm active:scale-95 transition-all flex items-center gap-2 border border-blue-100"
                    @click="triggerBatchGenerate" :disabled="isGenerating">
                    <i :class="['fa-solid', isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles']"></i>
                    {{ isGenerating ? '正在穿越平行时空...' : '一键生成朋友圈' }}
                </button>
            </div>
        </div>

        <!-- Post Modal -->
        <div v-if="showPostModal" class="fixed inset-0 z-[100] bg-white animate-slide-up flex flex-col">
            <div class="h-[72px] pt-7 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
                <span class="text-gray-600" @click="showPostModal = false; editingId = null">取消</span>
                <span class="font-bold">{{ editingId ? '编辑动态' : '发布动态' }}</span>
                <button class="bg-[#07c160] text-white px-4 py-1.5 rounded text-sm font-bold disabled:opacity-50"
                    @click="handlePost" :disabled="!postForm.content && postForm.images.length === 0">
                    {{ editingId ? '保存' : '发表' }}
                </button>
            </div>
            <div class="p-6 flex-1 overflow-y-auto">
                <textarea v-model="postForm.content"
                    class="w-full h-32 text-lg outline-none resize-none placeholder-gray-300"
                    placeholder="这一刻的想法..."></textarea>

                <!-- Image/Sticker Upload -->
                <div class="flex flex-wrap gap-2 mt-4">
                    <!-- Images -->
                    <div v-for="(img, idx) in postForm.images" :key="'img-' + idx"
                        class="w-20 h-20 bg-gray-100 rounded relative group">
                        <img :src="img" class="w-full h-full object-cover rounded">
                        <div
                            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                            <i class="fa-solid fa-trash text-white cursor-pointer"
                                @click="postForm.images.splice(idx, 1)"></i>
                        </div>
                    </div>

                    <!-- Stickers -->
                    <div v-for="(sticker, idx) in postForm.stickers" :key="'stk-' + idx"
                        class="w-20 h-20 bg-gray-100 rounded relative group">
                        <img :src="sticker" class="w-full h-full object-contain rounded p-1">
                        <div
                            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                            <i class="fa-solid fa-trash text-white cursor-pointer"
                                @click="postForm.stickers.splice(idx, 1)"></i>
                        </div>
                    </div>

                    <!-- Add Button -->
                    <div v-if="postForm.images.length + postForm.stickers.length < 9"
                        class="w-20 h-20 bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200 rounded text-gray-400 cursor-pointer active:bg-gray-100"
                        @click="fileInput.click()">
                        <i class="fa-solid fa-plus text-2xl"></i>
                    </div>
                </div>

                <!-- Toolbar -->
                <div class="flex gap-4 mt-6 text-xl text-gray-500">
                    <i class="fa-regular fa-face-smile cursor-pointer hover:text-gray-800"
                        @click="showEmojiPicker = true"></i>
                    <i class="fa-solid fa-link cursor-pointer hover:text-gray-800"
                        @click="postForm.images.push(prompt('请输入图片URL'))"></i>
                </div>

                <input type="file" ref="fileInput" class="hidden" accept="image/*" multiple
                    @change="handleLocalImageUpload">

                <div class="mt-8 border-t border-gray-100 pt-4">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 text-sm text-gray-500">
                            <i class="fa-solid fa-wand-magic-sparkles text-blue-400"></i>
                            <span>AI 画面灵感（支持中文描述出图）</span>
                        </div>
                        <button @click="handleAIImageGenerate"
                            :disabled="isAIImageLoading || !postForm.imageDescription.trim()"
                            class="text-[10px] bg-blue-50 text-blue-500 px-3 py-1 rounded-full border border-blue-100 font-bold active:scale-95 transition-all disabled:opacity-50">
                            <i :class="['fa-solid', isAIImageLoading ? 'fa-spinner fa-spin' : 'fa-paint-brush']"
                                class="mr-1"></i>
                            {{ isAIImageLoading ? '正在创作...' : '绘制图片' }}
                        </button>
                    </div>
                    <textarea v-model="postForm.imageDescription" placeholder="描述你想要生成的画面内容，例如：一个在樱花树下喝下午茶的少女..."
                        class="w-full bg-gray-50 px-3 py-3 rounded-xl outline-none text-sm h-20 resize-none border border-gray-100 focus:border-blue-200 transition-colors"></textarea>
                </div>

                <!-- AI Generated Image Preview / Satisfaction Check -->
                <div v-if="showAIImageConfirm"
                    class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6"
                    @click.self="showAIImageConfirm = false">
                    <div
                        class="bg-white w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up flex flex-col">
                        <div class="relative aspect-square bg-gray-900">
                            <img :src="aiImagePreview" class="w-full h-full object-contain">
                            <div v-if="isAIImageLoading"
                                class="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-xs gap-3">
                                <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
                                <span>重绘中...</span>
                            </div>
                        </div>
                        <div class="p-5">
                            <div class="font-bold text-gray-800 text-center mb-1">这就是你想要的画面吗？</div>
                            <div class="text-[10px] text-gray-400 text-center mb-6">不满意可以点击重绘哦</div>

                            <div class="flex gap-3">
                                <button
                                    class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                                    @click="handleAIImageGenerate" :disabled="isAIImageLoading">
                                    <i class="fa-solid fa-rotate-right"></i>
                                    重绘一张
                                </button>
                                <button
                                    class="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-200 active:scale-95 transition-all"
                                    @click="useAIImage">
                                    满意，使用它
                                </button>
                            </div>
                            <button class="w-full mt-4 text-xs text-gray-400 py-1"
                                @click="showAIImageConfirm = false">取消</button>
                        </div>
                    </div>
                </div>

                <!-- Location & Visibility Picker -->
                <div class="mt-6 space-y-4 pt-4 border-t border-gray-50">
                    <!-- Location Row -->
                    <div class="flex items-center justify-between py-3 cursor-pointer active:bg-gray-50 transition-colors px-1"
                        @click="openLocationPicker">
                        <div class="flex items-center gap-3 text-gray-700">
                            <i class="fa-solid fa-location-dot w-5 text-gray-400"></i>
                            <span class="text-base font-medium">所在位置</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-blue-500 truncate max-w-[120px]">{{ postForm.location || '选择位置'
                            }}</span>
                            <i class="fa-solid fa-chevron-right text-gray-300 text-[10px]"></i>
                        </div>
                    </div>

                    <!-- Visibility Row -->
                    <div class="flex items-center justify-between py-3 cursor-pointer active:bg-gray-50 transition-colors px-1"
                        @click="showVisibilityPicker = true">
                        <div class="flex items-center gap-3 text-gray-700">
                            <i class="fa-solid fa-user-group w-5 text-gray-400"></i>
                            <span class="text-base font-medium">谁可以看</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-gray-400">{{ getVisibilityLabel(postForm.visibility) }}</span>
                            <i class="fa-solid fa-chevron-right text-gray-300 text-[10px]"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Settings Modal -->
        <div v-if="showSettingsModal" class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6"
            @click.self="showSettingsModal = false">
            <div class="bg-white w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
                <div class="p-5 pt-8">
                    <div class="text-center font-bold text-gray-800 mb-2 text-lg">朋友圈实验室</div>
                    <div
                        class="text-center text-[10px] text-blue-500 bg-blue-50 py-1.5 px-3 rounded-full inline-block mx-auto mb-6 flex items-center justify-center gap-1.5 border border-blue-100">
                        <i class="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                        已自动绑定世界书：智能感知背景设定
                    </div>

                    <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                        <!-- Auto Frequency -->
                        <div>
                            <label class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">自动生成频率
                                (分钟)</label>
                            <div class="flex items-center gap-2">
                                <input v-model="settingsForm.autoGenerateInterval" type="number" min="0"
                                    class="flex-1 bg-gray-50 px-4 py-3 rounded-xl outline-none border border-gray-100 text-sm"
                                    placeholder="输入分钟... (0 为关闭)">
                                <span class="text-xs text-gray-400 font-bold">分钟</span>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-2">* 设置为 0 即关闭自动轮询生成朋友圈</p>
                        </div>

                        <!-- Characters -->
                        <div>
                            <label
                                class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">活跃角色筛选</label>
                            <div class="max-h-[150px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                <div v-for="chat in chatStore.contactList" :key="chat.id"
                                    class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group"
                                    @click="settingsForm.enabledCharacters.includes(chat.id) ? settingsForm.enabledCharacters = settingsForm.enabledCharacters.filter(id => id !== chat.id) : settingsForm.enabledCharacters.push(chat.id)">
                                    <input type="checkbox"
                                        :checked="settingsForm.enabledCharacters.length === 0 || settingsForm.enabledCharacters.includes(chat.id)"
                                        class="accent-green-500">
                                    <img :src="chat.avatar" class="w-6 h-6 rounded">
                                    <span class="text-sm flex-1">{{ chat.name }}</span>
                                    <i class="fa-solid transition-all p-1 active:scale-75 cursor-pointer"
                                        :class="confirmClearCharId === chat.id ? 'fa-check text-red-600 font-bold scale-110' : 'fa-trash-can text-red-400 hover:text-red-600'"
                                        @click.stop="handleClearCharacterMoments(chat.id)"
                                        :title="confirmClearCharId === chat.id ? '点击确认清空' : '清空此角色动态'"></i>
                                </div>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-2">* 不勾选默认为全部角色可用</p>
                        </div>

                        <!-- World Book Entries Selection -->
                        <div>
                            <label class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">世界书内容联动
                                (手动勾选)</label>
                            <div v-if="allWorldBookEntries.length > 0"
                                class="max-h-[150px] overflow-y-auto space-y-2 pr-2 custom-scrollbar bg-blue-50/30 p-2 rounded-xl border border-blue-100/50">
                                <div v-for="entry in allWorldBookEntries" :key="entry.id"
                                    class="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                                    @click="settingsForm.enabledWorldBookEntries.includes(entry.id) ? settingsForm.enabledWorldBookEntries = settingsForm.enabledWorldBookEntries.filter(id => id !== entry.id) : settingsForm.enabledWorldBookEntries.push(entry.id)">
                                    <input type="checkbox"
                                        :checked="settingsForm.enabledWorldBookEntries.includes(entry.id)"
                                        class="accent-blue-500">
                                    <div class="flex-1">
                                        <div class="text-sm font-medium text-gray-700">{{ entry.name }}</div>
                                        <div class="text-[10px] text-gray-400 truncate w-40">{{ entry.bookName }} | {{
                                            entry.content }}</div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="py-4 text-center border-2 border-dashed border-gray-100 rounded-xl">
                                <i class="fa-solid fa-book-open text-gray-200 block mb-1"></i>
                                <span class="text-[10px] text-gray-400">去世界书添加一些设定吧</span>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-2">* 勾选后，AI 生成动态将参考选中词条</p>
                        </div>

                        <!-- Prompt -->
                        <div>
                            <label
                                class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">朋友圈自定义提示词</label>
                            <textarea v-model="settingsForm.customPrompt" placeholder="例如：让他们多发一些关于学习和生活的动态"
                                class="w-full bg-gray-50 px-4 py-3 rounded-xl outline-none h-20 text-sm border border-gray-100"></textarea>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 mt-8">
                        <div class="flex gap-2">
                            <button
                                class="flex-1 py-3 rounded-xl bg-orange-50 text-orange-500 font-bold active:bg-orange-100 transition-all text-xs border border-orange-100/50"
                                :class="clearMyConfirmMode ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : ''"
                                @click="handleClearMyMoments">
                                {{ clearMyConfirmMode ? '确认清空我的动态' : '清空我的动态' }}
                            </button>
                            <button
                                class="flex-1 py-3 rounded-xl bg-red-50 text-red-500 font-bold active:bg-red-100 transition-all text-xs border border-red-100/50"
                                :class="clearConfirmMode ? 'bg-red-500 text-white shadow-lg shadow-red-200' : ''"
                                @click="handleClearAll">
                                {{ clearConfirmMode ? '再次点击确认清空' : '清空朋友圈' }}
                            </button>
                        </div>
                        <button
                            class="w-full py-4 rounded-xl bg-[#07c160] text-white font-bold active:bg-[#06ad56] shadow-md shadow-green-100 mt-2 flex items-center justify-center gap-2"
                            @click="saveSettings">
                            <i class="fa-solid fa-check"></i>
                            保存配置
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Visibility Picker Modal -->
        <div v-if="showVisibilityPicker" class="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-6"
            @click.self="showVisibilityPicker = false">
            <div
                class="bg-white w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[80vh]">
                <div class="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <span class="text-sm text-gray-500" @click="showVisibilityPicker = false">取消</span>
                    <span class="font-bold">谁可以看</span>
                    <span class="text-sm text-green-500 font-bold" @click="showVisibilityPicker = false">确定</span>
                </div>

                <div class="overflow-y-auto flex-1 p-2">
                    <!-- Option: Public -->
                    <div class="flex items-center gap-3 p-4 border-b border-gray-50 cursor-pointer active:bg-gray-50"
                        @click="postForm.visibility = 'public'; postForm.visibleIds = []">
                        <div class="flex-1">
                            <div class="font-bold text-gray-800">公开</div>
                            <div class="text-xs text-gray-400">所有好友可见</div>
                        </div>
                        <i v-if="postForm.visibility === 'public'" class="fa-solid fa-check text-green-500"></i>
                    </div>

                    <!-- Option: Private -->
                    <div class="flex items-center gap-3 p-4 border-b border-gray-50 cursor-pointer active:bg-gray-50"
                        @click="postForm.visibility = 'private'; postForm.visibleIds = []">
                        <div class="flex-1">
                            <div class="font-bold text-gray-800">私密</div>
                            <div class="text-xs text-gray-400">仅自己可见</div>
                        </div>
                        <i v-if="postForm.visibility === 'private'" class="fa-solid fa-check text-green-500"></i>
                    </div>

                    <!-- Option: Partial -->
                    <div class="flex items-center gap-3 p-4 border-b border-gray-50 cursor-pointer active:bg-gray-50"
                        @click="postForm.visibility = 'partial'">
                        <div class="flex-1">
                            <div class="font-bold text-gray-800">部分可见</div>
                            <div class="text-xs text-gray-400">选中的人可见</div>
                        </div>
                        <i v-if="postForm.visibility === 'partial'" class="fa-solid fa-check text-green-500"></i>
                    </div>

                    <!-- Option: Exclude -->
                    <div class="flex items-center gap-3 p-4 border-b border-gray-50 cursor-pointer active:bg-gray-50"
                        @click="postForm.visibility = 'exclude'">
                        <div class="flex-1">
                            <div class="font-bold text-gray-800">不给谁看</div>
                            <div class="text-xs text-gray-400">选中的人不可见</div>
                        </div>
                        <i v-if="postForm.visibility === 'exclude'" class="fa-solid fa-check text-green-500"></i>
                    </div>

                    <!-- Character Selector for Partial/Exclude -->
                    <div v-if="['partial', 'exclude'].includes(postForm.visibility)" class="mt-4 p-2 space-y-2">
                        <div class="text-xs font-bold text-gray-400 mb-2 uppercase tracking-tight">选择角色 ({{
                            postForm.visibleIds.length }})</div>
                        <div v-for="chat in chatStore.contactList" :key="chat.id"
                            class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            @click="postForm.visibleIds.includes(chat.id) ? postForm.visibleIds = postForm.visibleIds.filter(id => id !== chat.id) : postForm.visibleIds.push(chat.id)">
                            <img :src="chat.avatar" class="w-8 h-8 rounded-lg object-cover">
                            <span class="flex-1 text-sm">{{ chat.name }}</span>
                            <div class="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center transition-colors"
                                :class="{ 'bg-green-500 border-green-500': postForm.visibleIds.includes(chat.id) }">
                                <i v-if="postForm.visibleIds.includes(chat.id)"
                                    class="fa-solid fa-check text-white text-[10px]"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Location Picker Modal -->
        <div v-if="showLocationPicker" class="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-6"
            @click.self="showLocationPicker = false">
            <div class="bg-white w-full max-w-[340px] rounded-2xl shadow-2xl animate-scale-up p-5">
                <div class="font-bold text-center mb-4">所在位置</div>
                <input v-model="tempLocation" type="text" placeholder="输入位置名称" @keyup.enter="confirmLocation"
                    class="w-full bg-gray-50 px-4 py-3 rounded-xl outline-none border border-gray-100 mb-6 text-sm">
                <div class="flex gap-3">
                    <button class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold"
                        @click="showLocationPicker = false">取消</button>
                    <button class="flex-1 py-3 rounded-xl bg-[#07c160] text-white font-bold"
                        @click="confirmLocation">确定</button>
                </div>
            </div>
        </div>

        <!-- Emoji Picker Overlay -->
        <div v-if="showEmojiPicker" class="absolute inset-0 z-[110] flex items-end justify-center bg-black/20"
            @click="showEmojiPicker = false">
            <div class="w-full max-w-[500px] mb-4 mx-4 animate-slide-up" @click.stop>
                <EmojiPicker @select-emoji="handleEmojiSelect" @select-sticker="handleStickerSelect" />
            </div>
        </div>

        <!-- Background Customization Modal -->
        <div v-if="showBackgroundModal"
            class="absolute inset-0 z-[110] bg-black/60 flex items-center justify-center p-6"
            @click.self="showBackgroundModal = false">
            <div class="bg-white w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
                <div class="p-5 pt-8">
                    <div class="text-center font-bold text-gray-800 mb-6 text-lg">自定义背景图</div>

                    <div class="space-y-4">
                        <!-- URL Input -->
                        <div>
                            <label
                                class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">图片URL</label>
                            <input v-model="backgroundInput" type="text" placeholder="https://example.com/image.jpg"
                                class="w-full bg-gray-50 px-4 py-3 rounded-xl outline-none border border-gray-100">
                            <button
                                class="w-full mt-2 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm active:bg-blue-600"
                                @click="setBackgroundFromUrl">
                                使用此URL
                            </button>
                        </div>

                        <div class="text-center text-xs text-gray-400">或</div>

                        <!-- File Upload -->
                        <div>
                            <label
                                class="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">本地上传</label>
                            <input type="file" ref="backgroundFileInput" class="hidden" accept="image/*"
                                @change="handleBackgroundFileUpload">
                            <button
                                class="w-full py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-gray-600 active:bg-gray-100"
                                @click="backgroundFileInput.click()">
                                <i class="fa-solid fa-upload"></i>
                                <span class="text-sm font-bold">选择图片文件</span>
                            </button>
                            <p class="text-[10px] text-gray-400 mt-2">支持 JPG、PNG，最大 10MB</p>
                        </div>
                    </div>

                    <button class="w-full mt-6 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
                        @click="showBackgroundModal = false">
                        取消
                    </button>
                </div>
            </div>
        </div>
        <!-- Individual Character Profile Modal -->
        <div v-if="showingProfileCharId" class="absolute inset-0 z-[120] bg-[#f2f2f2] animate-fade-in flex flex-col">
            <div class="h-[72px] pt-7 flex items-center px-4 absolute top-0 left-0 right-0 z-10">
                <i class="fa-solid fa-chevron-left text-xl text-white drop-shadow-md cursor-pointer"
                    @click="handleProfileBack"></i>
            </div>

            <div class="flex-1 overflow-y-auto bg-[#f2f2f2]">
                <!-- Cover / Info Header -->
                <div class="relative h-[48vh] bg-gray-200">
                    <img :src="currentProfileChar.avatar" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>

                    <div class="absolute bottom-10 left-6 right-6 text-white">
                        <div class="flex items-end justify-between mb-2">
                            <div>
                                <h2 class="text-3xl font-bold mb-1 drop-shadow-lg">{{ currentProfileChar.name }}</h2>
                                <p class="text-xs opacity-70 tracking-wider">微信号：{{ currentProfileChar.wechatId ||
                                    'wxid_unknown' }}</p>
                            </div>
                            <div class="text-xs bg-white/20 backdrop-blur px-2 py-0.5 rounded border border-white/20">
                                {{ currentProfileChar.statusText || '在线' }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Actions Card -->
                <div class="px-4 -mt-6 relative z-10">
                    <div class="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                        <button
                            class="w-full py-4 bg-gray-50/50 rounded-xl flex items-center justify-between px-4 group active:bg-gray-100 transition-all border border-gray-100/50"
                            @click="viewCharacterMoments(showingProfileCharId)">
                            <div class="flex items-center gap-4">
                                <div
                                    class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-500">
                                    <i class="fa-solid fa-camera-retro text-lg"></i>
                                </div>
                                <div class="text-left">
                                    <div class="font-bold text-gray-800">朋友圈</div>
                                    <div class="text-[10px] text-gray-400">查看Ta的历史动态</div>
                                </div>
                            </div>
                            <i
                                class="fa-solid fa-chevron-right text-gray-300 text-sm group-hover:translate-x-1 transition-transform"></i>
                        </button>

                        <div class="flex gap-3">
                            <button
                                class="flex-1 py-4 bg-[#07c160] text-white rounded-xl shadow-lg shadow-green-100 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all"
                                @click="openChatFromProfile">
                                <i class="fa-solid fa-comment-dots"></i>
                                发消息
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Bio Secion -->
                <div class="p-6 pt-8">
                    <div class="mb-6">
                        <label class="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-3">个性签名 /
                            设定</label>
                        <div class="bg-white/60 p-4 rounded-xl border border-white border-b-gray-200/50">
                            <p class="text-sm text-gray-600 leading-relaxed italic relative">
                                <i class="fa-solid fa-quote-left absolute -top-2 -left-2 text-gray-200 text-xl"></i>
                                {{ currentProfileChar.prompt?.substring(0, 200) || '对方很忙，没有留下任何设定...' }}
                                <span v-if="currentProfileChar.prompt?.length > 200">...</span>
                            </p>
                        </div>
                    </div>

                    <div v-if="currentProfileChar.tags && currentProfileChar.tags.length > 0"
                        class="flex flex-wrap gap-2">
                        <span v-for="tag in currentProfileChar.tags" :key="tag"
                            class="text-[10px] bg-white px-2 py-0.5 rounded text-gray-400 border border-gray-100">
                            #{{ tag }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Generation Choice Modal -->
        <div v-if="showGenChoiceModal" class="absolute inset-0 z-[120] bg-black/60 flex items-center justify-center p-6"
            @click.self="showGenChoiceModal = false">
            <div
                class="bg-white w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[70vh]">
                <div class="p-5 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                    <h3 class="font-black text-lg text-gray-800">选择生成角色</h3>
                    <div class="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-400 font-bold">
                        选中 {{ genChoiceForm.selectedIds.length }} 人
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    <div class="bg-blue-50/50 p-4 rounded-2xl mb-4 border border-blue-100/50">
                        <label
                            class="text-[10px] text-blue-400 font-black uppercase tracking-widest block mb-2">生成数量</label>
                        <div class="flex items-center gap-4">
                            <input v-model="genChoiceForm.count" type="range" min="1" max="10"
                                class="flex-1 accent-blue-500">
                            <span class="font-black text-blue-600 w-6">{{ genChoiceForm.count }}</span>
                        </div>
                    </div>

                    <div v-for="chat in chatStore.contactList" :key="chat.id"
                        class="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 cursor-pointer transition-all border border-transparent active:scale-[0.98]"
                        :class="{ 'bg-green-50/40 border-green-100': genChoiceForm.selectedIds.includes(chat.id) }"
                        @click="genChoiceForm.selectedIds.includes(chat.id) ? genChoiceForm.selectedIds = genChoiceForm.selectedIds.filter(id => id !== chat.id) : genChoiceForm.selectedIds.push(chat.id)">
                        <div class="relative">
                            <img :src="chat.avatar" class="w-10 h-10 rounded-xl object-cover shadow-sm">
                            <div v-if="genChoiceForm.selectedIds.includes(chat.id)"
                                class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                <i class="fa-solid fa-check text-white text-[8px]"></i>
                            </div>
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-bold text-gray-700">{{ chat.name }}</div>
                            <div class="text-[9px] text-gray-400 truncate opacity-60">{{ chat.remark || '普通好友' }}</div>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-gray-50/80 backdrop-blur-md border-t border-gray-100 flex gap-3">
                    <button class="flex-1 py-3 text-sm font-bold text-gray-400 active:text-gray-600 transition-colors"
                        @click="showGenChoiceModal = false">取消</button>
                    <button
                        class="flex-[2] py-3 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-100 font-bold active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                        :disabled="genChoiceForm.selectedIds.length === 0" @click="handleGenChoiceConfirm">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        立即生成
                    </button>
                </div>
            </div>
        </div>

        <!-- Signature Edit Modal -->
        <div v-if="showSignatureModal"
            class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-up">
                <div class="p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">修改个性签名</h3>
                    <textarea v-model="signatureInput"
                        class="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-[#07c160] focus:border-transparent outline-none transition-all resize-none"
                        placeholder="那年今日，你是谁的..." maxlength="50" v-focus></textarea>
                    <div class="flex justify-end mt-2">
                        <span class="text-[10px] text-gray-400">{{ signatureInput.length }}/50</span>
                    </div>
                </div>
                <div class="flex border-t border-gray-100">
                    <button class="flex-1 py-4 text-gray-500 font-medium active:bg-gray-50 transition-colors"
                        @click="showSignatureModal = false">取消</button>
                    <button
                        class="flex-1 py-4 text-[#07c160] font-bold active:bg-gray-50 transition-colors border-l border-gray-100"
                        @click="confirmSignature">确定</button>
                </div>
            </div>
        </div>
    </div>
</template>



<style scoped>
.no-scrollbar::-webkit-scrollbar {
    display: none;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e0e0e0;
    border-radius: 10px;
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}

.animate-slide-up {
    animation: slideUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@keyframes scaleUp {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>

<style>
@keyframes notification-pop {
    0% {
        transform: translateY(20px) scale(0.9);
        opacity: 0;
    }

    70% {
        transform: translateY(-2px) scale(1.02);
    }

    100% {
        transform: translateY(0) scale(1);
        opacity: 1;
    }
}

.animate-notification-pop {
    animation: notification-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.highlight-moment {
    animation: highlight-fade 2s ease-out;
}

@keyframes highlight-fade {
    0% {
        background-color: rgba(59, 130, 246, 0.1);
    }

    100% {
        background-color: transparent;
    }
}
</style>
