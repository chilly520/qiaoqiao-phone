<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../../stores/chatStore'
import { useWalletStore } from '../../stores/walletStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useStickerStore } from '../../stores/stickerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useMusicStore } from '../../stores/musicStore'
import { useCallStore } from '../../stores/callStore'

import ChatActionPanel from './ChatActionPanel.vue'
import ChatDetailSettings from './ChatDetailSettings.vue'
import MusicPlayer from '../../components/MusicPlayer.vue'
import EmojiPicker from './EmojiPicker.vue'
import ChatEditModal from './ChatEditModal.vue'
import ChatHistoryModal from './ChatHistoryModal.vue'
import ChatInnerVoiceCard from './modals/ChatInnerVoiceCard.vue'
import ChatRedPacketModal from './modals/ChatRedPacketModal.vue'
import ChatTransferModal from './modals/ChatTransferModal.vue'
import ChatInputBar from './components/ChatInputBar.vue'
import ChatMessageItem from './components/ChatMessageItem.vue'
import FamilyCardClaimModal from './FamilyCardClaimModal.vue'
import CallStatusBar from '../../components/CallStatusBar.vue'

import SafeHtmlCard from '../../components/SafeHtmlCard.vue'
import MomentShareCard from '../../components/MomentShareCard.vue'
import { marked } from 'marked'
import { compressImage } from '../../utils/imageUtils'
import { generateImage, translateToEnglish } from '../../utils/aiService'
import { batteryMonitor } from '../../utils/batteryMonitor'
import { useChatTransaction } from '../../composables/chat/useChatTransaction'

const ensureString = (val) => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
        return val.map(part => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object') {
                return part.text || part.content || '';
            }
            return '';
        }).join('');
    }
    if (val && typeof val === 'object') {
        return val.text || val.content || JSON.stringify(val);
    }
    return String(val || '');
}

// Configure Marked
marked.setOptions({
    breaks: true, // Convert \n to <br>
    gfm: true     // GitHub Flavored Markdown
})

const props = defineProps({})
const emit = defineEmits(['back', 'show-profile'])

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()
const walletStore = useWalletStore()
const favoritesStore = useFavoritesStore()
const musicStore = useMusicStore()
const callStore = useCallStore()

const route = useRoute()
const router = useRouter()

// Input and Voice Mode
const chatInputBarRef = ref(null)

const chatData = computed(() => chatStore.currentChat)
const msgs = computed(() => chatData.value?.msgs || [])

// Status Bar Time
const currentTime = ref('12:00')
const updateTime = () => {
    const now = new Date()
    currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
setInterval(updateTime, 1000)
updateTime()

// Battery Status
const batteryLevel = ref(100)
const batteryCharging = ref(false)
const batteryInitialized = ref(false)

const showFriendRequest = computed(() => {
    if (!chatData.value || !chatData.value.msgs) return false
    // Show if: No messages AND Not hidden AND No Opening Line was set
    return chatData.value.msgs.length === 0 && !chatData.value.hideFriendRequest && !chatData.value.openingLine
})

const handleAcceptFriend = () => {
    if (!chatData.value) return
    // 1. Hide Request
    chatStore.updateCharacter(chatData.value.id, { hideFriendRequest: true })

    // 2. System Message
    chatStore.addMessage(chatData.value.id, {
        role: 'system',
        content: '你已添加了' + chatData.value.name + '，现在可以开始聊天了。' // Standard WeChat Text
    })

    // 3. User Auto Reply (My side)
    chatStore.addMessage(chatData.value.id, {
        role: 'user',
        content: '我们已经是好友了，快来聊天吧。'
    })

    // DO NOT trigger AI reply
}

const handleIgnoreFriend = () => {
    chatStore.updateCharacter(chatData.value.id, { hideFriendRequest: true })
}

const checkNewChat = () => {
    try {
        // Validate chatData exists
        if (!chatData.value) {
            console.error('[ChatWindow] chatData is null')
            showToast('聊天数据加载失败', 'error')
            return
        }

        // Validate msgs array
        if (!chatData.value.msgs) {
            console.warn('[ChatWindow] msgs array missing, initializing')
            chatData.value.msgs = []
        }

        if (!Array.isArray(chatData.value.msgs)) {
            console.error('[ChatWindow] msgs is not an array, fixing')
            chatData.value.msgs = []
        }

        if (chatData.value?.isNew) {
            showSettings.value = true
            // Clear isNew flag
            chatStore.updateCharacter(chatData.value.id, { isNew: false })
        }

        // Check Opening Line Logic:
        if (chatData.value?.openingLine && chatData.value.msgs?.length === 0) {
            chatStore.addMessage(chatData.value.id, {
                role: 'ai',
                content: chatData.value.openingLine
            })
            // Once sent, openingLine remains in settings but messages are not empty.
        }
    } catch (error) {
        console.error('[ChatWindow] checkNewChat error:', error)
        showToast('聊天初始化失败: ' + error.message, 'error')
    }
}

// Global Popstate listener for Settings in Window
const handleSettingsPopState = (event) => {
    const state = event.state || {}
    // If we're at a state that doesn't have settingsOpen, but it WAS open, close it
    if (!state.settingsOpen && showSettings.value) {
        showSettings.value = false
    }
}

const closeSettings = () => {
    if (history.state?.settingsOpen) {
        history.back()
    } else {
        showSettings.value = false
    }
}

const handleProfileNavigation = (id) => {
    showSettings.value = false
    setTimeout(() => {
        emit('show-profile', id)
    }, 300)
}
// Watch for call transcripts to trigger TTS
watch(() => callStore.transcript.length, (newLen, oldLen) => {
    if (newLen > oldLen && callStore.status === 'active') {
        const lastLine = callStore.transcript[newLen - 1]
        if (lastLine.role === 'ai' && chatData.value?.autoRead !== false) {
            // Trigger TTS for call speech
            ttsQueue.value.push({ 
                text: lastLine.content, 
                msgId: `call_tr_${newLen}_${Date.now()}` 
            })
            processQueue()
        }
    }
})

onMounted(() => {
    window.addEventListener('popstate', handleSettingsPopState)
})
onUnmounted(() => {
    window.removeEventListener('popstate', handleSettingsPopState)
    // Abort AI if leaving the chat?
    // User requested to KEEP generating even if they leave (e.g. go to home screen).
    // So we comment this out.
    // chatStore.stopGeneration(true) 
})

// ===== 优化后的分页逻辑 =====
// 使用 chatStore 的全局分页管理

const displayedMsgs = computed(() => {
    if (!chatStore.currentChatId) return []
    // Filter out hidden messages (e.g. call transcript lines)
    return chatStore.getDisplayedMessages(chatStore.currentChatId).filter(m => !m.hidden)
})

const hasMoreMessages = computed(() => {
    if (!chatStore.currentChatId) return false
    return chatStore.hasMoreMessages(chatStore.currentChatId)
})

const hiddenMessageCount = computed(() => {
    const total = msgs.value.length
    const displayed = displayedMsgs.value.length
    return Math.max(0, total - displayed)
})

const loadMoreMessages = () => {
    if (!chatStore.currentChatId) return
    chatStore.loadMoreMessages(chatStore.currentChatId)
    console.log('[ChatWindow] Loaded more messages, total displayed:', displayedMsgs.value.length)
}

// 监听聊天切换，重置分页
watch(() => chatStore.currentChatId, (newId) => {
    if (newId) {
        chatStore.resetPagination(newId)
    }
})

const addToFavorites = (msg) => {
    // Determine author name for context
    const chatName = chatData.value.name
    const avatarUrl = msg.role === 'user'
        ? (settingsStore.personalization.userProfile.avatar || '/avatars/user.png')
        : (chatData.value.avatar || '/avatars/default.png')

    favoritesStore.addFavorite(msg, chatName, avatarUrl)
    showToast('已收藏', 'success')
}

// Multi-select State
const isMultiSelectMode = ref(false)
const selectedMsgIds = ref(new Set())
const lastSelectedId = ref(null)

const toggleMessageSelection = (msgId) => {
    if (selectedMsgIds.value.has(msgId)) {
        selectedMsgIds.value.delete(msgId)
        if (lastSelectedId.value === msgId) {
            // If the anchor is deselected, we could find another one or just clear
            // For simplicity, we just keep it or clear if empty
            if (selectedMsgIds.value.size === 0) lastSelectedId.value = null
        }
    } else {
        selectedMsgIds.value.add(msgId)
        lastSelectedId.value = msgId
    }
}

const selectToBottom = () => {
    if (selectedMsgIds.value.size === 0) return

    // Use displayedMsgs (the current paginated view) instead of the full store history.
    // This ensures we only select messages that are currently visible on the screen.
    const visibleMsgs = displayedMsgs.value
    
    // Find the earliest message index in the visible selection
    let minIdx = -1
    for (let i = 0; i < visibleMsgs.length; i++) {
        if (selectedMsgIds.value.has(visibleMsgs[i].id)) {
            minIdx = i
            break
        }
    }

    if (minIdx === -1) return

    // Select everything from the earliest selection to the end of the visible list
    for (let i = minIdx; i < visibleMsgs.length; i++) {
        selectedMsgIds.value.add(visibleMsgs[i].id)
    }
}

const exitMultiSelectMode = () => {
    isMultiSelectMode.value = false
    selectedMsgIds.value.clear()
    lastSelectedId.value = null
}

const deleteSelectedMessages = () => {
    if (selectedMsgIds.value.size === 0) return

    // Direct delete without confirmation as requested
    const chatId = chatStore.currentChatId
    if (chatId) {
        chatStore.deleteMessages(chatId, selectedMsgIds.value)
    }
    exitMultiSelectMode()
}

const favoriteSelectedMessages = () => {
    if (selectedMsgIds.value.size === 0) return

    const chatName = chatData.value.name
    const selectedMsgs = msgs.value.filter(m => selectedMsgIds.value.has(m.id))

    const chatAvatar = chatData.value.avatar || '/avatars/default.png'
    if (selectedMsgs.length > 1) {
        // Multi-select: add as batch
        favoritesStore.addBatchFavorite(selectedMsgs, chatName, chatAvatar)
    } else if (selectedMsgs.length === 1) {
        // Single message: add as single
        const msg = selectedMsgs[0]
        const avatarUrl = msg.role === 'user'
            ? (settingsStore.personalization.userProfile.avatar || '/avatars/user.png')
            : chatAvatar
        favoritesStore.addFavorite(msg, chatName, avatarUrl)
    }

    showToast(`成功收藏 ${selectedMsgIds.value.size} 条消息`, 'success')
    exitMultiSelectMode()
}

const showSystemMsgDetail = (msg) => {
    if (msg.realContent) {
        // Show as Toast or temporary overlay
        // For debug mostly
        showToast('内容已撤回', 'info')
        console.log('Recall Content:', msg.realContent)
    }
}

// Watchers
watch(() => chatData.value, (newVal) => {
    // This watch block is empty in the instruction, I will keep it empty.
})

// AI Music Command Integration
const processMusicCommand = async (text) => {
    const match = text.match(/\[MUSIC:\s*(.*?)\s*\]/)
    if (!match) return

    const commandStr = match[1].trim()
    const parts = commandStr.split(/\s+/)
    const action = parts[0].toLowerCase()

    console.log('Music Command:', action, parts.slice(1))

    if (action === 'open') {
        if (!musicStore.playerVisible) musicStore.togglePlayer()
    } else if (action === 'close') {
        if (musicStore.playerVisible) musicStore.togglePlayer()
    } else if (action === 'play') {
        musicStore.play()
        if (!musicStore.playerVisible) musicStore.togglePlayer()
    } else if (action === 'pause') {
        musicStore.pause()
    } else if (action === 'next') {
        musicStore.next()
    } else if (action === 'prev') {
        musicStore.prev()
    } else if (action === 'search') {
        const query = parts.slice(1).join(' ')
        if (query) {
            const res = await musicStore.searchMusic(query)
            if (res && res.length > 0) {
                const fullSong = await musicStore.getSongUrl(res[0])
                if (fullSong) {
                    musicStore.addSong(fullSong)
                    musicStore.loadSong(musicStore.playlist.length - 1)
                    if (!musicStore.playerVisible) musicStore.togglePlayer()
                }
            }
        }
    }
}



// --- Iframe / Card Communication Handler ---
const handleIframeMessage = (event) => {
    const data = event.data
    if (!data) return

    // 1. Handle Alerts/Toasts from Card
    if (data.type === 'CHAT_ALERT') {
        showToast(data.text || '提醒', 'info')
    }

    // 2. Handle Actions (New Standard)
    if (data.type === 'QIAOQIAO_CARD_ACTION' || data.type === 'CHAT_SEND') {
        console.log('[Card Action]', data)
        const action = data.action || (data.type === 'CHAT_SEND' ? 'SEND_TEXT' : null)
        const content = data.content || data.text

        if (action === 'SEND_TEXT') {
            if (!content || typeof content !== 'string') return

            chatStore.addMessage(chatData.value.id, {
                role: 'user',
                content: content
            })

            if (data.autoReply) {
                setTimeout(() => generateAIResponse(), 500)
            }
        }
    }
}

onMounted(() => {
    window.addEventListener('message', handleIframeMessage)
})

onUnmounted(() => {
    window.removeEventListener('message', handleIframeMessage)
})

watch(() => msgs.value.length, (newLen, oldLen) => {
    if (newLen > oldLen && newLen > 0) {
        const lastMsg = msgs.value[newLen - 1]

        if (lastMsg.role === 'ai' || lastMsg.role === 'user') {
            const contentStr = ensureString(lastMsg.content)

            // 1. Music Command (AI Only)
            if (lastMsg.role === 'ai') processMusicCommand(contentStr)

            // 2. Draw Command (Unified)
            const drawMatch = contentStr.match(/\[DRAW:\s*([\s\S]*?)\]/i)
            if (drawMatch) {
                handleDrawCommandInChat(lastMsg.id, drawMatch[1].trim())
            }

            // 3. Family Card Status Logic
            if (lastMsg.role === 'ai') {
                if (contentStr.includes('FAMILY_CARD_REJECT') || (contentStr.includes('"type":"html"') && contentStr.includes('拒绝'))) {
                    const applyMsg = [...msgs.value].reverse().find(m => m.role === 'user' && ensureString(m.content).includes('FAMILY_CARD_APPLY'))
                    if (applyMsg) chatStore.updateMessage(chatData.value.id, applyMsg.id, { status: 'rejected' })
                }
                else if (contentStr.includes('FAMILY_CARD') && !contentStr.includes('APPLY')) {
                    const applyMsg = [...msgs.value].reverse().find(m => m.role === 'user' && ensureString(m.content).includes('FAMILY_CARD_APPLY'))
                    if (applyMsg && !applyMsg.status) chatStore.updateMessage(chatData.value.id, applyMsg.id, { status: 'accepted' })
                }
            }

            // 4. Auto TTS (AI Only)
            if (lastMsg.role === 'ai' && chatData.value?.autoRead !== false && chatData.value?.autoTTS) {
                const textToSpeak = getCleanSpeechText(contentStr);
                if (textToSpeak && !spokenMsgIds.has(lastMsg.id)) {
                    console.log('[TTS] Auto-queueing message:', lastMsg.id);
                    ttsQueue.value.push({ text: textToSpeak, msgId: lastMsg.id });
                    processQueue();
                }
            }
        }
    }
});

const computedBgStyle = computed(() => {
    if (!chatData.value) return {}
    const theme = chatData.value.bgTheme
    const url = chatData.value.bgUrl
    const blur = chatData.value.bgBlur || 0
    const opacity = chatData.value.bgOpacity !== undefined ? chatData.value.bgOpacity : 1

    // Background color: Black for dark theme, otherwise transparent (showing parent gray) or light gray
    let bgColor = '#f5f5f5'
    if (theme === 'dark') bgColor = '#000000'
    else if (url) bgColor = 'transparent'

    return {
        backgroundImage: url ? `url("${url}")` : 'none',
        backgroundColor: bgColor,
        filter: `blur(${blur}px) opacity(${opacity})`
    }
})

const msgContainer = ref(null)

const currentQuote = ref(null) // New State
const showActionPanel = ref(false)
const showSettings = ref(false)
const imgUploadInput = ref(null)

// Settings History Sync
watch(showSettings, (newVal) => {
    if (newVal) {
        // Essential: Settings is always inside a Chat in this app's current flow
        // Guard: Only push if we aren't already in settings state
        if (!history.state?.settingsOpen) {
            history.pushState({ ...history.state, settingsOpen: true }, '')
        }
    } else {
        // Fix: Scroll to bottom when settings are closed to prevent jumping to top
        setTimeout(() => {
            scrollToBottom()
        }, 100)
    }
})

// Modal States
const showEditModal = ref(false)
const showHistoryModal = ref(false)
const editTargetId = ref(null)

const toggleActionPanel = () => {
    showActionPanel.value = !showActionPanel.value
    showEmojiPicker.value = false // Mutually exclusive
    scrollToBottom()
}

const toggleEmojiPicker = () => {
    showEmojiPicker.value = !showEmojiPicker.value
    showActionPanel.value = false
    scrollToBottom()
}

const cancelQuote = () => {
    currentQuote.value = null
}

const toggleAutoRead = () => {
    if (!chatData.value) return

    // If global capability is OFF, turn it ON (and ensure autoRead is ON)
    if (!chatData.value.autoTTS) {
        chatStore.updateCharacter(chatData.value.id, { autoTTS: true, autoRead: true })
        showToast('已开启自动朗读', 'success')
        return
    }

    // If capability is ON, toggle the active state
    // Default of autoRead is effectively TRUE (if undefined), so we treat undefined as true.
    const currentActive = chatData.value.autoRead !== false
    const newState = !currentActive
    
    chatStore.updateCharacter(chatData.value.id, { autoRead: newState })
    
    if (newState) {
        showToast('自动朗读已开启', 'success')
    } else {
        showToast('自动朗读已暂停', 'info')
        if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
}

// Status Editing
const showStatusModal = ref(false)
const statusEditInput = ref('')
const statusIsOnline = ref(true)
const openStatusEditor = () => {
    statusEditInput.value = chatData.value?.statusText || '在线'
    statusIsOnline.value = chatData.value?.isOnline !== false
    showStatusModal.value = true
}
const saveStatus = () => {
    chatStore.updateCharacter(chatData.value.id, {
        statusText: statusEditInput.value,
        isOnline: statusIsOnline.value
    })
    showStatusModal.value = false
}
// ... (rest of imports)

// Template Injection (will handle in next chunk for template)
// But wait, replace tool replaces LINES. I need to be careful.
// I will just add the imports and ref definitions here.


// Nudge / Pat Logic
const shakingAvatars = ref(new Set())
let avatarClickTimer = null

const handlePat = (msg) => {
    // Cancel any pending single click
    if (avatarClickTimer) {
        clearTimeout(avatarClickTimer)
        avatarClickTimer = null
    }

    // 1. Visual Response
    shakingAvatars.value.add(msg.id)
    setTimeout(() => shakingAvatars.value.delete(msg.id), 500)

    if (navigator.vibrate) navigator.vibrate(50)

    // 2. Logic Response
    const targetName = msg.role === 'user' ? '我' : (chatData.value.name || '对方')
    const sourceName = '我'
    const suffix = chatData.value.patSuffix || '的头'
    const action = chatData.value.patAction || '拍了拍'

    chatStore.addMessage(chatData.value.id, {
        role: 'system',
        content: `"${sourceName}" ${action} "${targetName}" ${suffix}`
    })

    // 3. Trigger AI Response (Disabled by user request)
    // if (msg.role === 'ai') {
    //     chatStore.sendMessageToAI(chatData.value.id, { hiddenHint: '[System: 拍一拍]' })
    // }
}

// Handle Avatar Click with double-click prevention
const handleAvatarClick = (msg) => {
    // Cancel any existing timer
    if (avatarClickTimer) {
        clearTimeout(avatarClickTimer)
        avatarClickTimer = null
    }

    // Set a timer to handle the single click after a short delay
    avatarClickTimer = setTimeout(() => {
        // If it's a friend request or system message, ignore
        if (msg.isSystem || msg.type === 'system') return;

        // Navigate to Character Info Card
        // If user, go to user profile (using 'user' ID or whatever logic you prefer)
        // Here we assume 'user' is a valid ID for the user profile, or we handle it.
        emit('show-profile', msg.role === 'user' ? 'user' : chatStore.currentChatId);

        // Clear the timer reference
        avatarClickTimer = null
    }, 300) // 300ms delay - typical double-click timeout
}

// Visual Feedback for Command Nudges
watch(() => chatStore.patEvent, (evt) => {
    if (!evt || evt.chatId !== chatStore.currentChatId) return

    // Find valid targets in displayed messages
    const targetRole = evt.target === 'ai' ? 'ai' : 'user'

    // Shake ALL visible avatars of that role? Or just the last one?
    // Let's shake the last 3 to be safe/visible but not overwhelming? 
    // Or just all. "All" is simpler and clearly indicates "The person is shaking".
    displayedMsgs.value.forEach(m => {
        if (m.role === targetRole) {
            shakingAvatars.value.add(m.id)
        }
    })

    // Duration
    setTimeout(() => {
        displayedMsgs.value.forEach(m => {
            if (m.role === targetRole) {
                shakingAvatars.value.delete(m.id)
            }
        })
    }, 500)

    // Haptic
    if (navigator.vibrate) navigator.vibrate(50)
})

// Family Card Modal State
const showFamilyCardModal = ref(false)
const familyCardActionType = ref('') // 'apply' or 'send'
const showFamilyCardSendModal = ref(false)
const showFamilyCardApplyModal = ref(false)
const familyCardAmount = ref('5200')
const familyCardNote = ref('我的钱就是你的钱')
const familyCardApplyNote = ref('送我一张亲属卡好不好？以后你来管家~')

// See Image (Text to Image) Modal
const showSeeImageModal = ref(false)
const seeImagePrompt = ref('')
const seeImageLoading = ref(false)
const seeImageResult = ref('')
const seeImageHistory = ref([])
const currentHistoryIndex = ref(-1)

// Touch slide variables for image preview
let touchStartX = 0
let touchEndX = 0

const handlePanelAction = (type) => {
    if (type === 'album') {
        imgUploadInput.value.click()
    } else if (type === 'camera') {
        showToast('暂不支持拍摄', 'info')
    } else if (type === 'redpacket') {
        openSendDialog('redpacket')
    } else if (type === 'transfer') {
        openSendDialog('transfer')
    } else if (type === 'family-card') {
        // Show family card action selection modal
        showFamilyCardModal.value = true
    } else if (type === 'see-image') {
        // Show see image modal
        showSeeImageModal.value = true
    } else if (type === 'voice-call') {
        const char = chatData.value
        if (char) {
            callStore.startCall({ name: char.name, avatar: char.avatar, id: char.id }, 'voice')
            // Trigger AI to respond to call
            chatStore.addMessage(chatData.value.id, { 
                role: 'system', 
                content: `[System: ${chatStore.userName || '用户'} 正在给你打语音电话... 请决定是否接听。接听回复[接听]，拒绝/忙线回复[拒绝]]` 
            })
            // Manually trigger the generation
            chatStore.sendMessageToAI(chatData.value.id)
        }
    } else if (type === 'video-call') {
        const char = chatData.value
        if (char) {
            callStore.startCall({ name: char.name, avatar: char.avatar, id: char.id }, 'video')
            // Trigger AI to respond to call
            chatStore.addMessage(chatData.value.id, { 
                role: 'system', 
                content: `[System: ${chatStore.userName || '用户'} 正在给你打视频电话... 请决定是否接听。接听回复[接听]，拒绝/忙线回复[拒绝]]` 
            })
            // Manually trigger the generation
            chatStore.sendMessageToAI(chatData.value.id)
        }
    }
}

// Handle Family Card Action Selection
const handleFamilyCardAction = (actionType) => {
    familyCardActionType.value = actionType
    if (actionType === 'apply') {
        // Show family card apply modal
        showFamilyCardModal.value = false
        showFamilyCardApplyModal.value = true
    } else if (actionType === 'send') {
        // Show family card send modal
        showFamilyCardModal.value = false
        showFamilyCardSendModal.value = true
    }
}

// See Image (Text to Image) Methods
const generateSeeImage = async () => {
    if (!seeImagePrompt.value.trim()) {
        showToast('请输入生图提示词', 'info')
        return
    }

    seeImageLoading.value = true
    try {
        console.log('开始生成图片:', seeImagePrompt.value)
        // 模拟生成图片（不调用API）
        // 这里我们只是模拟生成过程，实际项目中可以替换为真实的文生图API调用
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 将中文提示词转义成英文关键词
        const prompt = seeImagePrompt.value.trim()
        let englishPrompt = prompt
        // 简单的中文关键词转英文（实际项目中可使用更复杂的翻译服务）
        const chineseToEnglish = {
            '花': 'flower',
            '玫瑰': 'rose',
            '山': 'mountain',
            '水': 'water',
            '天空': 'sky',
            '树': 'tree',
            '人': 'person',
            '狗': 'dog',
            '猫': 'cat',
            '太阳': 'sun',
            '月亮': 'moon',
            '星星': 'star'
        }
        for (const [chinese, english] of Object.entries(chineseToEnglish)) {
            if (prompt.includes(chinese)) {
                englishPrompt = english
                break
            }
        }

        // 将中文提示词翻译为英文
        const translatedPrompt = await translateToEnglish(prompt)
        console.log('中文提示词:', prompt)
        console.log('翻译后的英文提示词:', translatedPrompt)

        // 使用真实的生图API生成图片
        const generatedImageUrl = await generateImage(translatedPrompt)
        console.log('生成的图片URL:', generatedImageUrl)

        // 添加到历史记录
        seeImageHistory.value.push(generatedImageUrl)
        currentHistoryIndex.value = seeImageHistory.value.length - 1
        seeImageResult.value = generatedImageUrl
        console.log('图片生成成功，历史记录长度:', seeImageHistory.value.length)

        showToast('图片生成成功', 'success')
    } catch (error) {
        console.error('生成图片失败:', error)
        showToast('生成图片失败，请重试', 'error')
    } finally {
        seeImageLoading.value = false
        console.log('生成图片过程结束')
    }
}

const sendSeeImage = () => {
    if (!seeImageResult.value) {
        showToast('请先生成图片', 'info')
        return
    }

    // 添加图片消息到聊天界面（挂载，不发送）
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: 'image',
        content: seeImageResult.value
    })

    // 关闭模态框
    showSeeImageModal.value = false
    // 清空状态
    seeImagePrompt.value = ''
    seeImageResult.value = ''
    seeImageHistory.value = []
    currentHistoryIndex.value = -1
}

const regenerateSeeImage = () => {
    generateSeeImage()
}

const prevHistoryImage = () => {
    if (currentHistoryIndex.value > 0) {
        currentHistoryIndex.value--
        seeImageResult.value = seeImageHistory.value[currentHistoryIndex.value]
    }
}

const nextHistoryImage = () => {
    if (currentHistoryIndex.value < seeImageHistory.value.length - 1) {
        currentHistoryIndex.value++
        seeImageResult.value = seeImageHistory.value[currentHistoryIndex.value]
    }
}

// Touch slide handlers for image preview
const touchStart = (e) => {
    touchStartX = e.changedTouches[0].screenX
}

const touchMove = (e) => {
    touchEndX = e.changedTouches[0].screenX
}

const touchEnd = () => {
    const swipeThreshold = 50
    if (touchEndX < touchStartX - swipeThreshold) {
        // Swipe left - next image
        nextHistoryImage()
    } else if (touchEndX > touchStartX + swipeThreshold) {
        // Swipe right - previous image
        prevHistoryImage()
    }
}

const closeSeeImageModal = () => {
    showSeeImageModal.value = false
    // 清空状态
    seeImagePrompt.value = ''
    seeImageResult.value = ''
    seeImageHistory.value = []
    currentHistoryIndex.value = -1
}

// Handle sending family card after user fills form
const confirmSendFamilyCard = () => {
    if (!familyCardAmount.value || parseFloat(familyCardAmount.value) <= 0) {
        showToast('请输入有效的额度', 'error')
        return
    }

    // Send family card message
    chatStore.addMessage(chatData.value.id, {
        role: 'user',
        type: 'text',
        content: `[FAMILY_CARD:${familyCardAmount.value}:${familyCardNote.value || '亲属卡'}]`
    })

    // Close modal
    showFamilyCardSendModal.value = false

    // Clear form fields
    familyCardAmount.value = '5200'
    familyCardNote.value = '我的钱就是你的钱'

    // DO NOT auto-call API - remove the timeout generateAIResponse call
    // User requested that card is just mounted on message without auto API call
}

// Handle applying for family card after user fills form
const confirmApplyFamilyCard = () => {
    if (!familyCardApplyNote.value.trim()) {
        showToast('请输入申请备注', 'error')
        return
    }

    // Send family card apply message
    chatStore.addMessage(chatData.value.id, {
        role: 'user',
        type: 'text',
        content: `[FAMILY_CARD_APPLY:${familyCardApplyNote.value}]`
    })

    // Close modal
    showFamilyCardApplyModal.value = false

    // Clear form fields
    familyCardApplyNote.value = '送我一张亲属卡好不好？以后你来管家~'

    // DO NOT auto-call API - remove the timeout generateAIResponse call
    // User requested that card is just mounted on message without auto API call
}

// --- Send Modal Logic ---
const showSendModal = ref(false)
const sendType = ref('redpacket') // 'redpacket' | 'transfer'
const sendAmount = ref('')
const sendNote = ref('')

const openSendDialog = (type) => {
    sendType.value = type
    sendAmount.value = type === 'redpacket' ? '88' : '520'
    sendNote.value = type === 'redpacket' ? '恭喜发财，大吉大利' : '转账给您'
    showSendModal.value = true
    showActionPanel.value = false
}

const confirmSend = () => {
    if (!sendAmount.value) return showToast('请输入金额', 'warning')

    const amount = parseFloat(sendAmount.value)
    if (isNaN(amount) || amount <= 0) return showToast('请输入有效的金额', 'warning')

    // 1. Check if payment method is set
    if (!walletStore.paymentSettings?.defaultMethod) {
        return showToast('温馨提示：您尚未设置支付方式，请前往钱包设置', 'warning')
    }

    const isRP = sendType.value === 'redpacket'
    const title = isRP ? '发红包' : '转账'

    // 2. Try to deduct
    // Currently defaults to Balance logic (can be expanded to check specific methods)
    const success = walletStore.decreaseBalance(amount, title)

    if (!success) {
        // Balance insufficient
        return showToast(`支付失败：余额不足 (当前余额 ¥${walletStore.balance})`, 'error')
    }

    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: sendType.value,
        content: `[${isRP ? '红包' : '转账'}] ${isRP ? (sendNote.value || '恭喜发财') : (amount + '元')}`,
        amount: sendAmount.value,
        note: sendNote.value || (isRP ? '恭喜发财，大吉大利' : '转账给您'),
        status: 'sent' // Initial status
    })

    showSendModal.value = false
}

const handleImgUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // 1. Validate
    if (file.size > 10 * 1024 * 1024) {
        showToast('图片太大 (限制10MB)', 'warning')
        return
    }

    // 2. Compress & Send
    compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8 })
        .then(base64 => {
            chatStore.addMessage(chatStore.currentChatId, {
                role: 'user',
                type: 'image',
                // Explicitly sanitize base64 to prevent any appended text issues at source
                content: base64.replace(/[^A-Za-z0-9+/=:,;]/g, '')
            })
            showActionPanel.value = false
            scrollToBottom()
            // REMOVED: Trigger AI (Manual Send Only)
        })
        .catch(err => {
            console.error('Compression failed', err)
            const reader = new FileReader()
            reader.onload = (e) => {
                chatStore.addMessage(chatStore.currentChatId, {
                    role: 'user',
                    type: 'image',
                    content: e.target.result
                })
                showActionPanel.value = false
                scrollToBottom()
            }
            reader.readAsDataURL(file)
        })

    // Reset input
    event.target.value = ''
}


const scrollToBottom = () => {
    nextTick(() => {
        if (msgContainer.value) {
            msgContainer.value.scrollTop = msgContainer.value.scrollHeight
        }
    })
}

const closePanels = () => {
    showActionPanel.value = false
    showEmojiPicker.value = false
}

// Inner Voice Parsing
// (Function definitions moved below)

// TTS Helper - 按照气泡顺序朗读
const ttsQueue = ref([]);
const isSpeaking = ref(false);
const spokenMsgIds = new Set(); // 已朗读的消息ID，避免重复朗读

// Toast System
const toastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref('info');
let toastTimer = null;

// Toast System removed local watch because App.vue handles global toastEvent
const showToast = (msg, type = 'info') => {
    toastMessage.value = msg;
    toastType.value = type;
    toastVisible.value = true;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastVisible.value = false;
    }, 3000);
};

const processQueue = () => {
    // Stop if call ended
    if (callStore.status === 'ended' || callStore.status === 'none') {
        ttsQueue.value = [];
        isSpeaking.value = false;
        return;
    }

    if (isSpeaking.value || ttsQueue.value.length === 0) return;

    isSpeaking.value = true;
    const queueItem = ttsQueue.value.shift();
    const { text, msgId } = queueItem;

    speakOne(text, () => {
        // 标记消息为已朗读
        if (msgId) {
            spokenMsgIds.add(msgId);
        }

        // Re-check call status before continuing
        if (callStore.status === 'ended' || callStore.status === 'none') {
             isSpeaking.value = false;
             ttsQueue.value = [];
             return;
        }

        isSpeaking.value = false;
        // Pause slightly between bubbles
        setTimeout(processQueue, 500);
    });
};

// Enhanced text cleaner for TTS
const getCleanSpeechText = (textRaw) => {
    if (!textRaw) return '';
    let text = ensureString(textRaw);
    
    // 1. Remove HTML Card JSON blocks FIRST (Critical for TTS)
    if (text.includes('"type"') && text.includes('"html"')) {
        // Greedy match until the LAST } to handle internal CSS { }
        text = text.replace(/\{[\s\S]*?"type"\s*:\s*"html"[\s\S]*\}\s*\}?/gi, '');
    }

    let clean = text;

    // Remove INNER_VOICE blocks completely
    clean = clean.replace(/\[INNER_VOICE\][\s\S]*?\[\/INNER_VOICE\]/g, '');
    clean = clean.replace(/\[INNER_VOICE\][\s\S]*?$/g, ''); // Handle unclosed at end

    // Remove Tags like [图片], [转账]
    clean = clean.replace(/\[[^\]]+\]/g, '');

    // Remove Parentheses content (Action descriptions) e.g. (笑着说)
    // Support standard () and full-width （）
    clean = clean.replace(/\([^\)]*\)/g, '');
    clean = clean.replace(/（[^）]*）/g, '');
    
    // Final cleanup of any remaining HTML-like bits
    clean = clean.replace(/<\/?[^>]+(>|$)/g, "");

    return clean.trim();
}

const speakOne = async (text, onEnd) => {
    if (!text) return onEnd?.();

    // Use enhanced cleaner
    const cleanText = getCleanSpeechText(text);
    if (!cleanText || cleanText.length < 1) return onEnd?.();

    // Check Engine
    const engine = settingsStore.voice.engine;

    if (engine === 'minimax') {
        const config = settingsStore.voice.minimax;
        if (!config.apiKey || !config.groupId) {
            console.warn('MiniMax config missing');
            // Fallback to browser
        } else {
            try {
                // Determine model and voice from config
                const modelId = config.modelId || 'speech-01-turbo';
                const voiceId = config.voiceId || 'male-qn-qingse';

                // Using T2A Pro Endpoint
                const res = await fetch(`https://api.minimax.chat/v1/t2a_pro?GroupId=${config.groupId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + config.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: modelId,
                        text: cleanText,
                        stream: false,
                        voice_setting: {
                            voice_id: voiceId,
                            speed: 1.0,
                            vol: 1.0,
                            pitch: 0
                        },
                        audio_setting: {
                            sample_rate: 32000,
                            bitrate: 128000,
                            format: 'mp3',
                            channel: 1
                        }
                    })
                });

                if (res.ok) {
                    const blob = await res.blob();
                    // Cleanup old URL if needed, but for now just create new
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);

                    audio.onended = () => {
                        URL.revokeObjectURL(url);
                        onEnd?.();
                    };
                    audio.onerror = (e) => {
                        console.error('Audio Playback Error', e);
                        URL.revokeObjectURL(url);
                        onEnd?.();
                    }
                    audio.play().catch(e => {
                        console.error('Playback failed', e);
                        onEnd?.();
                    });
                    return; // Handled by MiniMax
                } else {
                    const errText = await res.text();
                    console.error('MiniMax API Error', errText);
                    if (errText.includes('401') || errText.includes('auth')) {
                        showToast('MiniMax 鉴权失败，请检查设置', 'error');
                    }
                    // Fallback to browser
                }
            } catch (e) {
                console.error('MiniMax Network Error', e);
                // Fallback to browser
            }
        }
    }

    // Browser Fallback / Default
    if (!window.speechSynthesis) return onEnd?.();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-CN';

    // Attempt to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Xiaoxiao') || v.name.includes('Female'));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
        onEnd?.();
    };
    utterance.onerror = (e) => {
        console.warn('TTS Error:', e);
        onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
};

const speakMessage = (text, msgId = null) => {
    if (!text) return;

    // 如果提供了消息ID，检查是否已经朗读过
    if (msgId && spokenMsgIds.has(msgId)) {
        return;
    }

    ttsQueue.value.push({ text, msgId });
    processQueue();
}

watch(() => chatStore.isTyping, (isTyping) => {
    if (isTyping) {
        // AI is generating... scroll to bottom
        setTimeout(() => scrollToBottom(), 50);
    }
})

watch(msgs, (newVal, oldVal) => {
    if (newVal.length > (oldVal?.length || 0)) {
        scrollToBottom()

        // AI finished generating. Check for unread messages if Auto Read is ON.
        // Logic fix: Allow reading if autoTTS is ON, and autoRead is NOT explicitly FALSE.
        // This handles the case where autoRead is undefined (default).
        const shouldRead = chatData.value?.autoTTS && (chatData.value?.autoRead !== false);

        if (shouldRead) {
            // 只处理新添加的消息
            const newMsgCount = newVal.length - (oldVal?.length || 0);
            if (newMsgCount > 0) {
                // 获取新添加的消息，按照顺序处理
                const newlyAddedMsgs = newVal.slice(-newMsgCount);

                // 等待DOM更新完成，确保气泡已经渲染在界面上
                nextTick(() => {
                    newlyAddedMsgs.forEach(msg => {
                        if (
                            msg.role === 'ai' &&
                            msg.content &&
                            msg.id !== undefined &&
                            !spokenMsgIds.has(msg.id)
                        ) {
                            // 清理文本内容，只保留需要朗读的部分
                            const cleanText = getCleanSpeechText(msg.content);
                            if (cleanText) {
                                speakMessage(cleanText, msg.id);
                            }
                        }
                    });
                });
            }
        }
    }
}, { deep: true })

const handleDrawCommandInChat = async (msgId, prompt) => {
    console.log('[Draw Command] Triggered:', msgId, prompt)
    showToast('正在绘制: ' + prompt.substring(0, 10) + '...', 'info')

    const chatId = chatStore.currentChatId
    const chat = chatStore.chats[chatId]
    const msg = chat?.msgs.find(m => m.id === msgId)

    try {
        if (!chat) throw new Error('聊天窗口已关闭或不存在')
        if (!msg) throw new Error('找不到对应的消息占位符')

        const currentDrawingConfig = settingsStore.drawing?.value || settingsStore.drawing || { provider: 'pollinations' }
        console.log('[Draw Command] Calling generateImage with provider:', currentDrawingConfig.provider)

        const imageUrl = await generateImage(prompt)

        console.log('[Draw Command] Image generated successfully. URL:', imageUrl)
        console.log('[Draw Command] Updating with chatId:', chatId, 'msgId:', msgId)

        chatStore.updateMessage(chatId, msgId, {
            content: imageUrl,
            type: 'image',
            isDrawing: false
        })
        showToast('绘图完成', 'success')

    } catch (e) {
        console.error('[Draw Command] Failed:', e)
        showToast('绘图失败: ' + e.message, 'error')

        if (msg && chat) {
            chatStore.updateMessage(chatId, msgId, {
                content: `(绘图失败: ${e.message})`,
                type: 'text',
                isDrawing: false
            })
        }
    }
}

onMounted(() => {
    try {
        scrollToBottom()
        checkNewChat()
    } catch (error) {
        console.error('[ChatWindow] Mount error:', error)
        showToast('聊天加载出错,请刷新重试', 'error')
    }
})


// --- Inner Voice & Content Logic ---
// --- Inner Voice & Content Logic ---
// Helper to flatten nested JSON/Objects into readable string
const cleanVoiceText = (val) => {
    if (!val) return null;

    // 1. If it's already an object, flatten it
    if (typeof val === 'object') {
        return Object.entries(val)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
    }

    // 2. If it's a string, checking if it's a JSON string
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                return Object.entries(parsed)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n');
            } catch (e) {
                // Not valid JSON, return as is (but maybe strip braces?)
                return trimmed.replace(/^\{|\}$|"/g, '');
            }
        }
    }

    return String(val);
}



const parseInnerVoice = (contentRaw) => {
    if (!contentRaw) return null;
    const content = ensureString(contentRaw);
    let rawObj = null;

    try {
        // 1. Tag Extraction [INNER_VOICE]...[/INNER_VOICE]
        const match = content.match(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/i);

        if (match && match[1]) {
            let jsonStr = match[1].trim();
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

            // Attempt standard parse first
            try {
                // Try fixing outer quotes if Chinese
                rawObj = JSON.parse(jsonStr.replace(/[“”]/g, '"'));
            } catch (jsonErr) {
                // FALLBACK REGEX for broken JSON
                const cleanText = (regex) => {
                    const m = jsonStr.match(regex);
                    return m ? m[2] : null;
                }

                // Non-greedy capture until quote + separator
                const mind = cleanText(/"(mind|thoughts|想法|心声)"\s*[:：]\s*["“]([\s\S]*?)["”]\s*(?:,|}|$)/i);
                const outfit = cleanText(/"(outfit|clothes|着装)"\s*[:：]\s*["“]([\s\S]*?)["”]\s*(?:,|}|$)/i);
                const scene = cleanText(/"(scene|environment|环境)"\s*[:：]\s*["“]([\s\S]*?)["”]\s*(?:,|}|$)/i);
                const action = cleanText(/"(action|behavior|行为)"\s*[:：]\s*["“]([\s\S]*?)["”]\s*(?:,|}|$)/i);

                if (mind || action || outfit || scene) {
                    rawObj = { mind, outfit, scene, action };
                } else {
                    if (!jsonStr.trim().startsWith('{')) rawObj = { mind: jsonStr };
                }
            }
        } else {
            // 2. Naked JSON extraction (fallback)
            const jsonMatch = content.match(/\{[\s\n]*"(?:着装|环境|status|心声|行为|mind|outfit|scene|action|thoughts|mood|state)"[\s\S]*?\}/i);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0].trim();
                try {
                    rawObj = JSON.parse(jsonStr.replace(/[“”]/g, '"'));
                } catch (e) { /* Ignore */ }
            }
        }
    } catch (e) {
        console.error('Inner Voice Parse Error', e);
    }

    if (rawObj) {
        return {
            outfit: cleanVoiceText(rawObj.着装 || rawObj.outfit || rawObj.clothes) || '...',
            scene: cleanVoiceText(rawObj.环境 || rawObj.scene || rawObj.environment) || '...',
            thoughts: cleanVoiceText(rawObj.心声 || rawObj.mind || rawObj.thoughts || rawObj.thought) || '暂无心声',
            action: cleanVoiceText(rawObj.行为 || rawObj.action || rawObj.behavior) || '...',
            mood: cleanVoiceText(rawObj.mood || rawObj.emotion) || 'neutral'
        };
    }
    return null;
}

// Monitor Call Transcript for TTS (Since intercepted messages don't hit msgs list)
watch(() => callStore.transcript.length, (newLen, oldLen) => {
    if (newLen > oldLen) {
        const lastLine = callStore.transcript[newLen - 1];
        if (lastLine && lastLine.role === 'ai' && lastLine.content) {
            addToQueue(lastLine.content);
        }
    }
});

const getCleanContent = (contentRaw) => {
    if (!contentRaw) return '';
    const content = ensureString(contentRaw);

    // CRITICAL: Performance shortcut for massive image/base64 data
    if (content.length > 300) {
        // If it's a data URL or blob, it's definitely an image, don't regex it
        if (content.includes('data:image/') || content.includes('blob:')) return '';
        // If it's just long text, still skip heavy regex if no voice marker
        if (!content.includes('[INNER_VOICE]') && !content.includes('"type"')) return content.trim();
    }

    // Remove Inner Voice block (Standard)
    let clean = content.replace(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi, '');

    // Remove Naked JSON blocks (Fallback) - Only if they contain specific Inner Voice keys
    clean = clean.replace(/\{[\s\n]*"(?:着装|环境|status|心声|行为|mind|outfit|scene|action|thoughts|mood|state)"[\s\S]*?\}/gi, '');

    // NEW: Remove HTML Card JSON blocks (Greedy)
    if (clean.includes('"type"') && clean.includes('"html"')) {
        clean = clean.replace(/\{[\s\S]*?"type"\s*:\s*"html"[\s\S]*\}\s*\}?/gi, '');
    }

    clean = clean.replace(/\[System:[\s\S]+?\]/gi, '');
    clean = clean.trim();
    // Remove Claim Tags
    clean = clean.replace(/\[(领取红包|RECEIVE_RED_PACKET)\]/gi, '').trim();
    
    // Filter out zero-width characters
    clean = clean.replace(/[\u200b\u200c\u200d\ufeff]/g, '');
    
    return clean;
}



// --- Action Handlers ---


// --- Effects Configuration (Moved to top) ---
const effectTypes = [
    { id: 'bamboo', name: '🎋 听竹', color: '120, 160, 120', type: 'sway_fall' },
    { id: 'sakura', name: '🌸 落樱', color: '255, 200, 210', type: 'sway_fall' },
    { id: 'snow', name: '❄️ 寒雪', color: '220, 220, 230', type: 'sway_fall' },
    { id: 'rain', name: '🌧️ 潇潇夜雨', color: '150, 180, 210', type: 'rain' },
    { id: 'storm', name: '⚡ 深夜惊雷', color: '180, 200, 220', type: 'rain_storm' },
    { id: 'fireworks', name: '🎆 线香花火', color: '255, 215, 0', type: 'burst' },
    { id: 'meteor', name: '🌠 星陨', color: '255, 255, 255', type: 'meteor' },
    { id: 'embers', name: '🔥 余烬', color: '255, 100, 50', type: 'float_up_fade' },
    { id: 'gold', name: '✨ 流金', color: '212, 175, 55', type: 'flow_up' },
    { id: 'firefly', name: '🦋 流萤', color: '160, 255, 160', type: 'wander' }
];
const currentEffect = ref(effectTypes[8]);
const currentEffectIndex = ref(8);

// --- Modal Logic ---
const showInnerVoiceModal = ref(false)
const showHistoryList = ref(false)
const showDeleteConfirm = ref(false)
const currentInnerVoice = ref(null)
const currentInnerVoiceMsgId = ref(null)

// Computed History List
const voiceHistoryList = computed(() => {
    const list = [];
    msgs.value.forEach((msg) => {
        if (msg.role === 'ai') {
            const voiceData = parseInnerVoice(msg.content);
            if (voiceData) {
                list.push({
                    id: msg.id,
                    timestamp: msg.timestamp || Date.now(), // Ensure timestamp exists
                    data: voiceData,
                    preview: voiceData.thoughts || voiceData.mind || '...'
                });
            }
        }
    });
    return list.reverse(); // Newest first
});

const toggleVoiceHistory = () => {
    showHistoryList.value = !showHistoryList.value;
}

const loadHistoryItem = (item) => {
    currentInnerVoice.value = { ...item.data, id: item.id };
    // Randomize effect for "fresh" feel
    const randomIdx = Math.floor(Math.random() * effectTypes.length);
    currentEffectIndex.value = randomIdx;
    currentEffect.value = effectTypes[randomIdx];

    showHistoryList.value = false;
}

const openInnerVoiceModal = () => {
    // Reset view state
    showHistoryList.value = false;

    // Initialize Effects (Randomize)
    const randomIdx = Math.floor(Math.random() * effectTypes.length);
    currentEffectIndex.value = randomIdx;
    currentEffect.value = effectTypes[randomIdx];

    // Find the last AI message with Inner Voice (Scan backwards efficiently)
    // Optimization: Do NOT copy/reverse the entire array.
    const rawMsgs = msgs.value
    let foundMsg = null

    for (let i = rawMsgs.length - 1; i >= 0; i--) {
        const m = rawMsgs[i]
        if (m.role === 'ai' && m.content && m.content.includes('INNER_VOICE')) {
            // Only parse if potential tag exists to save Regex time
            if (parseInnerVoice(m.content)) {
                foundMsg = m
                break
            }
        }
    }

    if (foundMsg) {
        const data = parseInnerVoice(foundMsg.content);
        if (data) {
            currentInnerVoice.value = { ...data, id: foundMsg.id };
            currentInnerVoiceMsgId.value = foundMsg.id;
        }
    } else {
        currentInnerVoice.value = null;
        currentInnerVoiceMsgId.value = null;
    }

    showInnerVoiceModal.value = true

    // Initialize Canvas
    nextTick(() => {
        initVoiceCanvas();
    });
}

const closeInnerVoiceModal = () => {
    showInnerVoiceModal.value = false
}

// Visualizer for Inner Voice (Placeholder to fix ReferenceError)
function initVoiceCanvas() {
    console.log('[ChatWindow] Initializing voice visualizer canvas...');
    const canvas = document.querySelector('.voice-visualizer-canvas');
    if (!canvas) return;
    // Basic setup if needed in future
}

const handleSendMessage = (payload) => {
    const { type, content } = payload
    const chatId = chatStore.currentChatId

    if (type === 'voice') {
        chatStore.addMessage(chatId, {
            role: 'user',
            type: 'voice',
            content: content,
            duration: Math.ceil(content.length / 3) || 1,
            quote: currentQuote.value
        })
    } else {
        chatStore.addMessage(chatId, {
            role: 'user',
            content: content,
            quote: currentQuote.value
        })
    }

    currentQuote.value = null
    nextTick(() => {
        scrollToBottom()
    })
}




const generateAIResponse = () => {
    // Manually trigger AI generation based on current context
    chatStore.sendMessageToAI(chatStore.currentChatId)
}

const regenerateLastMessage = () => {
    const chat = chatStore.chats[chatStore.currentChatId]
    if (!chat || !chat.msgs || !chat.msgs.length) {
        return
    }

    const msgs = chat.msgs
    const lastMsg = msgs[msgs.length - 1]

    // If last message is AI, remove it (and any consecutive AI messages) to regenerate
    if (lastMsg.role === 'ai') {
        let count = 0
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'ai') count++
            else break
        }
        chat.msgs.splice(msgs.length - count, count)
        chatStore.saveChats()
    }

    // Trigger AI response (Reply to the new last message, which should be User's)
    chatStore.sendMessageToAI(chatStore.currentChatId)
}
// Red Packet & Wallet Logic
const {
    showRedPacketModal,
    showTransferModal,
    currentRedPacket,
    isOpening,
    showResult,
    resultAmount,
    confirmTransfer,
    closeModals
} = useChatTransaction()


// Voice Logic
const getDuration = (msg) => {
    if (msg.duration) return msg.duration
    const content = ensureString(msg.content)
    const len = content.length
    return Math.min(60, Math.max(1, Math.ceil(len / 3)))
}

const formatAncientTime = (timestamp) => {
    // Short format for bubbles: always just time (ancient or modern)
    const date = new Date(timestamp)
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    if (chatData.value?.timeAware || !chatData.value?.virtualTime) {
        return timeStr
    }

    const isAncient = /([0-1][0-9][0-9][0-9])|乾隆|康熙|宣统|庆丰|大清/.test(chatData.value.virtualTime)
    if (!isAncient) return timeStr

    const shichenList = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    let scIdx = Math.floor(((hours + 1) % 24) / 2)
    const shichen = shichenList[scIdx]

    let minsIntoSc = ((hours % 2 === 0 ? 1 : 0) * 60 + minutes + 60) % 120
    let ke = Math.floor(minsIntoSc / 15) + 1
    const keChinese = ['', '一', '二', '三', '四', '五', '六', '七', '八']
    return `${shichen}时${keChinese[ke]}刻`
}

// [Deleted formatTimelineTime and handleVoiceClick - Moved to Component/Refactored]

// --- Explicit Voice Logic (Force Manual Trigger) ---
const recognition = ref(null)

const voiceStart = () => {
    // console.log('Voice Start')
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        recognition.value = new SpeechRecognition()
        recognition.value.lang = 'zh-CN'
        recognition.value.continuous = false
        recognition.value.interimResults = true

        recognition.value.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('')
            if (chatInputBarRef.value) {
                chatInputBarRef.value.setInput(transcript)
            }
        }

        recognition.value.start()
    }
}

const voiceEnd = () => {
    // console.log('Voice End')
    if (recognition.value) {
        recognition.value.stop()
        recognition.value = null
    }

    // CRITICAL: DO NOT AUTO SEND
    // logic: User speaks -> Text appears in input -> User clicks Generate
}

// Reject Payment
const rejectPayment = () => {
    // Prevent double action if opening
    if (isOpening.value) return

    // Update State
    if (currentRedPacket.value) {
        currentRedPacket.value.isRejected = true
    }
    showResult.value = true // [FIX] Switch to result view immediately

    const chat = chatStore.chats[chatStore.currentChatId]
    const msg = chat.msgs.find(m => m.id === currentRedPacket.value.id)
    if (msg) {
        msg.isRejected = true
        msg.rejectTime = Date.now()

        // [FIX] Add System Message
        const senderName = chat.remark || chat.name || '对方'
        const typeStr = (msg.type === 'transfer' || msg.content.includes('转账')) ? '转账' : '红包'

        chatStore.addMessage(chat.id, {
            role: 'system',
            type: 'system',
            content: `你拒收了${senderName}的${typeStr}`
        })
        chatStore.saveChats()
    }
}

const openRedPacket = () => {
    if (isOpening.value) return
    isOpening.value = true

    setTimeout(() => {
        // [FIX] Race condition check: If rejected during wait, abort
        if (!currentRedPacket.value || currentRedPacket.value.isRejected) {
            isOpening.value = false
            return
        }

        isOpening.value = false
        showResult.value = true

        const amount = parseFloat(currentRedPacket.value.amount || (Math.random() * 100).toFixed(2))
        resultAmount.value = amount

        // Add to Wallet
        walletStore.increaseBalance(amount, '微信红包', `领取红包: ${currentRedPacket.value.note || ''}`)

        // Update State
        const chat = chatStore.chats[chatStore.currentChatId]
        const msg = chat.msgs.find(m => m.id === currentRedPacket.value.id)
        if (msg) {
            msg.isClaimed = true
            msg.claimTime = Date.now()

            // Add System Message: "UserName claimed xx's red packet"
            const senderName = chat.remark || chat.name
            const userName = chat.userName || '你'
            chatStore.addMessage(chat.id, {
                role: 'system',
                type: 'system',
                content: `${userName}领取了${senderName}的红包`
            })

            chatStore.saveChats()
        }
        if (currentRedPacket.value) currentRedPacket.value.isClaimed = true

    }, 1000)
}

const closeRedPacketModal = () => {
    showRedPacketModal.value = false
    currentRedPacket.value = null
}

const navigateToWallet = () => {
    closeRedPacketModal()
    showTransferModal.value = false
    router.push('/wallet')
}



// Helper methods for Rich Messages
// (shakingAvatars etc defined above)

const handleVoiceClick = ({ msg, showTranscript }) => {
    // 1. Update transcript visibility from child component
    msg.showTranscript = showTranscript

    // 2. Handle TTS based on transcript visibility
    if (showTranscript) {
        // 展开时开始朗读
        msg.isPlaying = true
        const duration = (msg.duration || Math.ceil(ensureString(msg.content).length / 3) || 1) * 1000

        if (msg.role === 'ai') {
            const text = getCleanSpeechText(msg.content)
            // 移除spokenMsgIds检查，允许重复朗读
            ttsQueue.value.push({ text, msgId: msg.id });
            processQueue();
            // 确保设置isPlayed为true并更新到聊天存储
            msg.isPlayed = true
            chatStore.updateMessage(chatData.value.id, msg.id, { isPlayed: true })
        } else {
            // User voice fallback
            showToast('暂不支持播放用户语音', 'info')
        }

        setTimeout(() => {
            msg.isPlaying = false
        }, duration)
    } else {
        // 关闭时停止朗读
        msg.isPlaying = false
        // 取消当前的TTS播放
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel()
        }
    }
}

const handlePayClick = (msg) => {
    const content = ensureString(msg.content)

    // Determine initial view state
    // Show result/detail if:
    // 1. User sent it (viewing own packet)
    // 2. Already claimed or rejected
    // 3. Status is received
    const shouldShowDetail = msg.role === 'user' || msg.isClaimed || msg.isRejected || msg.status === 'received'

    showResult.value = shouldShowDetail

    // Ensure amount is displayed for detail view
    if (shouldShowDetail) {
        resultAmount.value = msg.amount || '0.00'
    } else {
        // Reset for new open
        resultAmount.value = '0.00'
    }

    if (msg.type === 'redpacket' || content.includes('[红包]')) {
        currentRedPacket.value = msg
        showRedPacketModal.value = true
    } else if (msg.type === 'transfer' || content.includes('[转账]')) {
        currentRedPacket.value = msg
        showTransferModal.value = true
    }
}

const isMsgVisible = (msg) => {
    // Always show Pay/Image
    const content = ensureString(msg.content)
    if (msg.type === 'redpacket' || msg.type === 'transfer' || content.includes('[红包]') || content.includes('[转账]')) return true
    if (msg.type === 'image' || isImageMsg(msg)) return true

    // Check Text
    const clean = getCleanContent(msg.content)
    return clean && clean.length > 0
}

const isImageMsg = (msg) => {
    if (!msg) return false
    // Priority 1: Explicit Type
    if (msg.type === 'image') return true

    // Convert to string and clean it
    const content = ensureString(msg.content)
    if (!content.trim()) return false

    // Priority 2: Blob/Data URL presence (very fast)
    if (content.includes('blob:') || content.includes('data:image/')) return true

    const clean = getCleanContent(content).trim()

    // Priority 3: URL lookalikes
    if (clean.startsWith('http')) {
        const urlPart = clean.split('?')[0].toLowerCase()
        if (urlPart.endsWith('.jpg') || urlPart.endsWith('.png') || urlPart.endsWith('.gif') || urlPart.endsWith('.jpeg')) {
            return true
        }
    }

    // Tag check: contains [图片:...] or [表情包:...]
    // We use a more relaxed regex without strict ^ $ to handle potential surrounding chars/newlines
    return /\[(?:图片|IMAGE|表情包|表情-包|STICKER)[:：].*?\]/i.test(clean)
}

const getImageSrc = (msg) => {
    const content = ensureString(msg.content).trim()

    // 1. Direct Base64
    if (content.startsWith('data:image/')) return content

    const clean = getCleanContent(content).trim()

    // 2. Base64 hidden in tag
    if (clean.includes('data:image/')) {
        const dataMatch = clean.match(/data:image\/[^\]\s]+/);
        if (dataMatch) return dataMatch[0];
    }

    // 3. Direct URL (including blob:)
    if (clean.startsWith('http') || clean.startsWith('blob:')) return clean

    // 4. Extraction from tag [图片:URL] or [表情包:名称]
    const match = clean.match(/\[(?:图片|IMAGE|表情包|表情-包|STICKER)[:：](.*?)\]/i)
    if (match) {
        const content = match[1].trim()

        // If it's a URL (http/https/blob/data), return it directly
        if (content.startsWith('http') || content.startsWith('blob:') || content.startsWith('data:')) {
            return content
        }

        // Otherwise, treat as sticker name
        const stickerStore = useStickerStore()

        // 1. Try Character Specific
        const charStickers = chatData.value?.emojis || []
        const charMatch = charStickers.find(s => s.name === content)
        if (charMatch) return charMatch.url

        // 2. Try Global
        const globalStickers = stickerStore.getStickers('global')
        const globalMatch = globalStickers.find(s => s.name === content)
        if (globalMatch) return globalMatch.url

        // Fallback: Show initials if not found
        return `https://api.dicebear.com/7.x/initials/svg?seed=${content}`
    }

    return clean
}


const formatMessageContent = (msg) => {
    if (!msg) return ''
    const textRaw = ensureString(msg.content)

    // 0. Performance: Don't parse massive image strings or blob URLs as markdown
    if (textRaw.length > 500 && (textRaw.includes('data:image/') || textRaw.includes('blob:'))) {
        return '';
    }

    // 1. Clean Internal System Tags (Fix for visual leakage)
    let text = getCleanContent(textRaw)
        .replace(/\{[\s\S]*?("speech"|"status"|"action"|"转发"|"心声"|"行为")[\s\S]*?\}/gi, '') // Remove Call JSON
        .replace(/\[CALL_START\][\s\S]*?\[CALL_END\]/gi, '') // Remove Call Blocks
        .replace(/\[CALL_START\]|\[CALL_END\]/gi, '') // Remove Stray Tags
        .replace(/\[(?:UPDATE_)?BIO:[^\]]+\]/gi, '') // Remove BIO Updates
        .replace(/\[MOMENT_SHARE:[^\]]+\]|\[分享朋友圈:[^\]]+\]/gi, '') // Remove Moment Tags
        .replace(/\[一起听歌:[^\]]+\]|\[停止听歌\]|<bgm>[\s\S]*?<\/bgm>/gi, '') // Remove Music Tags
        .replace(/\[领取红包:[^\]]+\]|\[领取转账:[^\]]+\]/gi, '') // Remove Payment Logic Tags
        .replace(/\[语音通话\]|\[视频通话\]|\[接听\]|\[挂断\]|\[拒绝\]/gi, '') // Remove Basic Call Triggers
        .replace(/\[Image Reference ID:.*?\]/g, '') // Remove ID tags
        .replace(/Here is the original image:/gi, '') // Remove AI parroting
        .trim();

    // 2. Render [DRAW:...] as loading indicator
    if (msg.isDrawing !== false && text.toLowerCase().includes('[draw:')) {
        text = text.replace(/\[DRAW:\s*([\s\S]*?)\]/gi, (match, prompt) => {
            const truncated = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt
            return `<div class="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 my-1">
                <i class="fa-solid fa-spinner fa-spin text-blue-500"></i>
                <span class="text-sm text-blue-700">正在绘制: ${truncated}</span>
            </div>`
        })
    }

    // 3. Remove/Clean Specialized Tags from normal text bubble rendering
    const familyCardRegex = /\\\\?\[\\s*FAMILY_CARD(?:_APPLY|_REJECT)?\\s*[:：][\\s\\S]*?\]/gi;
    text = text.replace(familyCardRegex, '');

    // 4. Sticker inline replacer (Standardized fuzzy matching)
    text = text.replace(/\[(.*?)\]/g, (match, name) => {
        let n = name.trim()
        
        // Strip prefixes
        const prefixMatch = n.match(/^(?:表情包|表情|STICKER|IMAGE|图片)[:：\-\s]\s*(.*)/i);
        if (prefixMatch) n = prefixMatch[1].trim();

        const charStickers = chatData.value?.emojis || []
        const globalStickers = stickerStore.getStickers('global') || []
        const allAvailable = [...charStickers, ...globalStickers]

        const normalize = (s) => (s || '')
            .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .replace(/[。.，,！!？?\-\s\(\)（）]/g, '')
            .toLowerCase()
            .trim();

        const nClean = normalize(n);
        if (!nClean && !n) return match;

        // Precise
        let found = allAvailable.find(s => s.name === n || normalize(s.name) === nClean);
        
        // Fuzzy
        if (!found && nClean.length >= 2) {
            found = allAvailable.find(s => {
                const sClean = normalize(s.name);
                if (!sClean || sClean.length < 1) return false;
                return sClean.includes(nClean);
            });
        }

        if (found) {
            return `<img src="${found.url}" class="w-16 h-16 inline-block mx-1 align-middle" alt="${found.name}" />`
        }
        return match
    })

    try {
        return marked.parse(text)
    } catch (e) {
        return text
    }
}

const currentVoiceIndex = computed(() => {
    if (!currentInnerVoice.value) return '--'
    const idx = voiceHistoryList.value.findIndex(v => v.id === currentInnerVoice.value.id)
    // voiceHistoryList is reversed (Newest First), so idx 0 is the newest.
    // User wants New = Large Number, Old = Small Number.
    // So Newest (idx 0) should be Length. Oldest (idx Max) should be 1.
    return idx === -1 ? '--' : (voiceHistoryList.value.length - idx).toString().padStart(2, '0')
})

const previewImage = (src) => {
    window.open(src, '_blank')
}


// Header Toggles
const toggleAutoTTS = () => {
    if (!chatData.value) return
    // Create a copy to trigger reactivity if needed, or directly mutate if store handles it
    // Pinia store state is reactive, direct mutation works but better to use store action if available.
    // Assuming direct mutation for now as chatData is computed from store
    chatData.value.autoTTS = !chatData.value.autoTTS
    chatStore.updateCharacter(chatData.value.id, { autoTTS: chatData.value.autoTTS })
}




// --- Context Menu Logic ---
const showContextMenu = ref(false)
const menuPosition = ref({ x: 0, y: 0 })
const selectedMsg = ref(null)

const menuLock = ref(false)
let longPressTimer = null

// Use native contextmenu event (Desktop Right Click / Mobile Long Press)
const handleContextMenu = (msg, event) => {
    // Defensive check to prevent crashes if event is missing
    if (!event) {
        console.warn('[ContextMenu] Triggered without event data');
        // Fallback to center of screen or previous known position
        menuPosition.value = { x: window.innerWidth / 2 - 70, y: window.innerHeight / 2 - 230 };
        selectedMsg.value = msg;
        showContextMenu.value = true;
        return;
    }

    // Position - Handle both MouseEvent and Touch (clientX exists on both Touch and Event normally)
    let x = event.clientX || (event.touches && event.touches.length > 0 ? event.touches[0].clientX : 0)
    let y = event.clientY || (event.touches && event.touches.length > 0 ? event.touches[0].clientY : 0)

    // Boundary checks (Menu is approx 140x460 now with multi-select and favorites)
    const menuWidth = 140
    const menuHeight = 460

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
    if (y + menuHeight > window.innerHeight) {
        // If it overflows bottom, try to show it upwards from the touch point
        y = y - menuHeight
        // If still negative, pin to top
        if (y < 10) y = 10
    }

    menuPosition.value = { x, y }
    selectedMsg.value = msg
    showContextMenu.value = true

    // Fix: Lock menu to prevent immediate closing (e.g. from subsequent click/touchend)
    menuLock.value = true
    setTimeout(() => {
        menuLock.value = false
    }, 400)

    // Haptic
    if (navigator.vibrate) navigator.vibrate(50);
}

// Manual Long Press (For Mouse "Click and Hold" or legacy Touch support)
const startLongPress = (msg, event) => {
    // Capture coordinates immediately
    const touch = event.touches && event.touches.length > 0 ? event.touches[0] : event;
    const capturedEvent = {
        clientX: touch.clientX || 0,
        clientY: touch.clientY || 0
    };

    longPressTimer = setTimeout(() => {
        handleContextMenu(msg, capturedEvent)

        // LOCK the menu closure for a short time to prevent "Release" from closing it
        menuLock.value = true
        setTimeout(() => {
            menuLock.value = false
        }, 500)

    }, 500) // 500ms hold
}

const cancelLongPress = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

const closeContextMenu = () => {
    if (menuLock.value) return // Ignore close requests if locked (e.g. mouseup release)
    showContextMenu.value = false
    selectedMsg.value = null
}

const handleMenuAction = (action) => {
    if (!selectedMsg.value) return
    const content = getCleanContent(selectedMsg.value.content)
    const idx = msgs.value.findIndex(m => m.id === selectedMsg.value.id)

    switch (action) {
        case 'copy':
            navigator.clipboard.writeText(content).catch(err => {
                console.error('Copy failed', err)
            })
            break
        case 'edit':
            if (selectedMsg.value) {
                editTargetId.value = selectedMsg.value.id
                showEditModal.value = true
            }
            break
        case 'quote':
            if (selectedMsg.value) {
                currentQuote.value = {
                    id: selectedMsg.value.id,
                    content: getCleanContent(selectedMsg.value.content),
                    role: selectedMsg.value.role
                }
                nextTick(() => {
                    const el = document.querySelector('textarea')
                    if (el) el.focus()
                })
            }
            break
        case 'listen':
            speakMessage(selectedMsg.value.content)
            break
        case 'delete':
            if (idx !== -1) {
                msgs.value.splice(idx, 1)
                chatStore.saveChats()
            }
            break
        case 'recall':
            if (idx !== -1) {
                // Replace with system message
                const senderName = msgs.value[idx].role === 'user' ? '你' : (chatData.value.name || '对方')
                const recallMsg = {
                    ...msgs.value[idx],
                    type: 'system',
                    content: `${senderName}撤回了一条消息`, // Display Text
                    isRecallTip: true, // Flag for styling
                    realContent: msgs.value[idx].content // Keep for click-to-view
                }
                msgs.value.splice(idx, 1, recallMsg)
                chatStore.saveChats()
            }
            break
        case 'fav':
            if (selectedMsg.value) {
                addToFavorites(selectedMsg.value)
            }
            break
        case 'history':
            if (selectedMsg.value) {
                editTargetId.value = selectedMsg.value.id
                showHistoryModal.value = true
            }
            break
        case 'multi':
            isMultiSelectMode.value = true
            selectedMsgIds.value.add(selectedMsg.value.id)
            break
    }
    closeContextMenu()
}

// --- Toolbar & UI Logic ---
const showEmojiPicker = ref(false);


const emojiList = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '​​​​​​😨', '😩', '🤯', '😬', '​​​​​​😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🤠', '🤡', '🥳', '🥴', '🥺', '🤥', '🤫', '🤭', '🧐', '🤓'
];

const handleEmojiSelect = (emoji) => {
    chatInputBarRef.value?.insertText(emoji)
};

const handleStickerSelect = (sticker) => {
    // Send as Image Message
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: 'image',
        content: sticker.url
    });
    showEmojiPicker.value = false; // Close after sending sticker
    nextTick(() => scrollToBottom());
}



// --- Inner Voice & Effect Logic (Ported from Original) ---
// (Declarations moved to 'Modal Logic' section above)
// const showInnerVoiceModal = ref(false);
// const currentVoiceData = ref({ ... });

const voiceCanvasRef = ref(null);
let voiceCanvas = null;
let voiceCtx = null;
// Inner Voice Logic (Refactored to Component)


const cleanupCanvas = () => {
    // No-op (Moved to component)
}

const handleImageError = (e) => {
    e.target.src = '/broken-image.png';
    e.target.onerror = null; // Prevent infinite loop if placeholder fails
};

const getHtmlContent = (content) => {
    if (!content) return ''
    try {
        let cleaned = content.trim()
        // Removed manual unescape that corrupts valid JSON

        // Try parsing as JSON first (if it's the [CARD] format)
        if (cleaned.startsWith('{')) {
            const data = JSON.parse(cleaned)
            if (data.html) return data.html
        }
    } catch (e) {
        // Not JSON or parse failed, treat as raw HTML string
    }
    return content
}



// UI Methods
const handleToggleMusic = () => {
    if (!musicStore.playerVisible) {
        // Automatically start 'Together' mode when opening the player in Chat
        if (chatData.value) {
            musicStore.startTogether({
                name: chatData.value.name,
                avatar: chatData.value.avatar
            })
        }
    }
    musicStore.togglePlayer()
}
// Deprecated Inner Voice methods removed



// Family Card Logic
const claimModalRef = ref(null)

const handleClaimConfirm = (data) => {
    // data: { uuid, amount, note, fromCharId, cardName, number, theme }
    const { uuid, amount, fromCharId, cardName, number, theme } = data

    const charName = chatStore.chats[fromCharId]?.name || '对方'
    const walletStore = useWalletStore()

    // Add to wallet (Standardized names)
    walletStore.addFamilyCard({
        ownerId: fromCharId,
        ownerName: charName,
        amount: parseFloat(amount) || 0,
        remark: cardName || '亲属卡',
        theme: theme || 'pink',
        number: number
    })

    // Update Message UI Status
    const chatId = chatStore.currentChatId
    const messages = chatStore.messages[chatId] || []

    // Find target message: either by legacy UUID in content or by direct ID match
    const msg = messages.find(m =>
        (m.id === uuid) ||
        (m.content && m.content.includes(uuid))
    )

    if (msg) {
        chatStore.updateMessage(chatId, msg.id, {
            isClaimed: true,
            status: 'claimed',
            claimTime: Date.now()
        })
    }

    showToast('领取成功！已存入钱包', 'success')
}

// Battery Monitoring Lifecycle
onMounted(async () => {
    /* ... battery init ... */
    const initialized = await batteryMonitor.init()
    if (initialized) {
        batteryInitialized.value = true
        const info = batteryMonitor.getBatteryInfo()
        batteryLevel.value = info.level
        batteryCharging.value = info.charging
        batteryMonitor.onChange((info) => {
            batteryLevel.value = info.level
            batteryCharging.value = info.charging
        })
        batteryMonitor.onLowBattery((info) => {
            if (!chatData.value || info.charging) return
            const systemMsg = {
                id: `sys_battery_${Date.now()}`,
                role: 'system',
                content: `[系统提醒] 当前设备电量为 ${info.level}%，建议尽快充电。`,
                timestamp: Date.now(),
                type: 'system'
            }
            chatStore.addMessage(chatData.value.id, systemMsg)
        })
    }

    // Family Card Global Handler
    window.qiaoqiao_receiveFamilyCard = (uuid, amount, note, fromCharId) => {
        const charName = chatStore.chats[fromCharId]?.name || '亲属'
        claimModalRef.value?.open({ uuid, amount, note, fromCharId }, `${charName}的亲属卡`)
    }
})

onUnmounted(() => {
    // Clean up battery monitor
    if (batteryInitialized.value) {
        batteryMonitor.destroy()
    }
    delete window.qiaoqiao_receiveFamilyCard
})
</script>

<template>
    <div v-if="!chatData" class="w-full h-full flex items-center justify-center bg-gray-100">
        <div class="text-center">
            <i class="fa-solid fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
            <p class="text-gray-500">加载中...</p>
        </div>
    </div>

    <div v-else class="chat-window w-full h-full flex flex-col overflow-hidden relative">
        <!-- Global Toast Notifier -->
        <Transition name="fade">
            <div v-if="toastVisible"
                class="absolute top-16 left-1/2 transform -translate-x-1/2 z-[200] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 min-w-[200px] justify-center backdrop-blur-md"
                :class="{
                    'bg-gradient-to-r from-blue-500/90 to-indigo-600/90 text-white': toastType === 'info',
                    'bg-gradient-to-r from-green-500/90 to-emerald-600/90 text-white': toastType === 'success',
                    'bg-gradient-to-r from-red-500/90 to-pink-600/90 text-white': toastType === 'error'
                }">
                <i v-if="toastType === 'info'" class="fa-solid fa-circle-info italic"></i>
                <i v-if="toastType === 'success'" class="fa-solid fa-circle-check"></i>
                <i v-if="toastType === 'error'" class="fa-solid fa-circle-exclamation"></i>
                <span class="text-xs font-medium tracking-wide">{{ toastMessage }}</span>
            </div>
        </Transition>

        <!-- Main Chat Content (hidden when settings is open) -->
        <div v-if="!showSettings" class="flex flex-col h-full">
            <!-- Combined Background Layer -->
            <div class="absolute inset-0 bg-cover bg-center z-[-1] transition-all duration-300 pointer-events-none"
                :style="computedBgStyle"></div>

            <!-- Header -->
            <div
                class="h-[50px] bg-[#ededed] flex items-center justify-between px-3 border-b border-[#dcdcdc] shadow-sm z-10 relative">
                <div class="absolute left-3 flex items-center gap-1 cursor-pointer z-30 h-full w-14"
                    @click.stop="() => { console.log('[ChatWindow] Back button clicked'); $emit('back') }">
                    <i class="fa-solid fa-chevron-left text-black text-lg"></i>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center z-10 overflow-hidden cursor-pointer mx-[70px] h-full"
                    @click="openStatusEditor">
                    <div class="w-full text-center font-bold text-[16px] truncate text-black leading-tight px-4">
                        {{ chatData?.remark || chatData?.name }}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5">

                        
                        <!-- Other Statuses (Only show if no active call) -->
                        <template v-if="callStore.status === 'none'">
                            <template v-if="musicStore.isListeningTogether">
                                <i class="fa-solid fa-music text-[10px] text-green-500 animate-pulse"></i>
                                <span class="text-[10px] text-green-600 font-bold">正在和你一起听歌</span>
                            </template>
                            <template v-else>
                                <div class="w-2 h-2 rounded-full shadow-[0_0_4px_rgba(0,223,108,0.5)]"
                                    :class="chatData?.isOnline ? 'bg-[#00df6c]' : 'bg-gray-400'"></div>
                                <span class="text-[10px] text-gray-500 truncate max-w-[150px] font-medium">{{
                                    chatData?.statusText || '在线' }}</span>
                            </template>
                        </template>
                    </div>
                </div>
                <div class="absolute right-1.5 flex items-center gap-0.5 text-black z-20">
                    <!-- Auto TTS Button (Controls Automatic Reading, dependent on Capability Switch) -->
                    <div class="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-black/5"
                        :class="{ 'opacity-30': !chatData?.autoTTS }" @click="toggleAutoRead"
                        :title="chatData?.autoTTS ? (chatData?.autoRead ? '关闭自动朗读' : '开启自动朗读') : 'TTS功能未启用'">
                        <i class="fa-solid"
                            :class="chatData?.autoRead ? 'fa-volume-high text-green-600' : 'fa-volume-xmark text-gray-400'"></i>
                    </div>

                    <!-- Inner Voice Button -->
                    <div class="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-black/5 relative"
                        @click="openInnerVoiceModal" title="心声">
                        <i class="fa-solid fa-heart transition-all duration-300 text-pink-500 animate-heartbeat"></i>
                    </div>


                    <!-- Settings -->
                    <div class="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-black/5"
                        @click="showSettings = true">
                        <i class="fa-solid fa-gear text-gray-500"></i>
                    </div>
                </div>
            </div>

            <!-- Call Status (New Location: Top of Chat) -->
            <CallStatusBar />

            <!-- Messages Area -->
            <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative z-10" ref="msgContainer"
                @click="closePanels">
                <!-- Message Content Area -->

                <!-- Friend Request Card -->
                <div v-if="showFriendRequest" class="w-full flex justify-center py-4 z-10">
                    <div
                        class="bg-blue-50/80 backdrop-blur-md border border-white/40 p-5 w-[90%] max-w-[340px] rounded-xl shadow-lg">
                        <div class="flex items-center gap-4 mb-4">
                            <img :src="chatData.avatar"
                                class="w-14 h-14 rounded-lg bg-gray-200 object-cover border border-white/50 shadow-sm">
                            <div>
                                <div class="font-bold text-lg text-gray-800">{{ chatData.name }}</div>
                                <div class="text-xs text-gray-500 mt-1">请求添加你为朋友</div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-600 mb-6 bg-white/40 p-3 rounded-lg border border-white/20">
                            我是{{ chatData.name }}
                        </div>
                        <div class="flex gap-3">
                            <button
                                class="flex-1 bg-white/60 hover:bg-white/80 text-gray-600 text-sm py-2.5 rounded-lg font-medium transition-colors border border-white/40"
                                @click="handleIgnoreFriend">忽略</button>
                            <button
                                class="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm py-2.5 rounded-lg font-medium shadow-md active:scale-95 transition-transform"
                                @click="handleAcceptFriend">同意</button>
                        </div>
                    </div>
                </div>

                <!-- Load More (Pagination) -->
                <div v-if="hasMoreMessages" class="w-full flex justify-center py-3 z-10 animate-fade-in">
                    <button @click="loadMoreMessages"
                        class="group px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-300/30 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-2">
                        <i
                            class="fa-solid fa-clock-rotate-left text-blue-500 group-hover:rotate-[-15deg] transition-transform"></i>
                        <span
                            class="text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            加载更早的记录
                        </span>
                        <span class="text-xs text-gray-500">({{ hiddenMessageCount }}条未显示)</span>
                    </button>
                </div>

                <div v-if="msgs.length === 0 && !showFriendRequest"
                    class="text-center text-gray-400 text-xs py-4 flex flex-col items-center gap-2 z-10">
                    <span>现在可以开始聊天了</span>
                    <span class="text-[10px] text-gray-300">系统加密传输</span>
                </div>


                <ChatMessageItem v-for="(msg, index) in displayedMsgs" :key="msg.id" v-show="isMsgVisible(msg)"
                    :msg="msg" :prevMsg="displayedMsgs[index - 1]" :chatData="chatData"
                    :isMultiSelectMode="isMultiSelectMode" :isSelected="selectedMsgIds.has(msg.id)"
                    :shakingAvatars="shakingAvatars" @click-avatar="handleAvatarClick" @dblclick-avatar="handlePat"
                    @context-menu="(e) => handleContextMenu(e.msg, e.event)" @toggle-select="toggleMessageSelection"
                    @click-pay="handlePayClick" @play-voice="handleVoiceClick" />

                <!-- Typing Indicator -->
                <div v-if="chatStore.isTyping" class="flex gap-2 w-full z-10 mb-2">
                    <img :src="chatData?.avatar" class="w-10 h-10 rounded shadow-sm bg-white object-cover">
                    <div class="chat-bubble-left px-4 py-3 rounded-lg flex items-center gap-1">
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                </div>
            </div>

            <!-- Input Area (Extracted) -->
            <ChatInputBar v-if="!isMultiSelectMode && callStore.status !== 'active'" ref="chatInputBarRef" :currentQuote="currentQuote"
                :chatData="chatData" :isTyping="chatStore.isTyping" :musicVisible="musicStore.playerVisible"
                @send="handleSendMessage" @generate="generateAIResponse" @stop-generate="chatStore.stopGeneration"
                @toggle-panel="toggleActionPanel" @toggle-emoji="toggleEmojiPicker"
                @toggle-music="handleToggleMusic" @regenerate="regenerateLastMessage"
                @cancel-quote="cancelQuote" />

            <!-- Multi-select Action Bar (Bottom Overlay) -->
            <div v-if="isMultiSelectMode"
                class="h-[60px] bg-[#f7f7f7] border-t border-[#dcdcdc] flex items-center justify-between px-8 relative z-30 animate-fade-in-up">
                <button @click="exitMultiSelectMode"
                    class="flex flex-col items-center justify-center text-gray-600 hover:text-gray-800 transition-colors">
                    <i class="fa-solid fa-xmark text-lg"></i>
                    <span class="text-[10px] mt-0.5">取消</span>
                </button>

                <div class="flex gap-10">
                    <button @click="selectToBottom"
                        class="flex flex-col items-center justify-center text-gray-600 hover:text-[#07c160] transition-colors"
                        :class="{ 'opacity-30': selectedMsgIds.size === 0 }">
                        <i class="fa-solid fa-list-check text-lg"></i>
                        <span class="text-[10px] mt-0.5">勾选到这</span>
                    </button>
                    <button @click="favoriteSelectedMessages"
                        class="flex flex-col items-center justify-center text-gray-600 hover:text-[#07c160] transition-colors"
                        :class="{ 'opacity-30': selectedMsgIds.size === 0 }">
                        <i class="fa-regular fa-star text-lg"></i>
                        <span class="text-[10px] mt-0.5">收藏</span>
                    </button>
                    <button @click="deleteSelectedMessages"
                        class="flex flex-col items-center justify-center text-red-500 hover:text-red-600 transition-colors"
                        :class="{ 'opacity-30': selectedMsgIds.size === 0 }">
                        <i class="fa-regular fa-trash-can text-lg"></i>
                        <span class="text-[10px] mt-0.5">删除</span>
                    </button>
                </div>
                <div class="w-8"></div> <!-- Spacer -->
            </div>

            <!-- Action Panel (Drawer) -->
            <ChatActionPanel v-if="showActionPanel" :show="showActionPanel"
                class="h-[200px] border-t border-[#dcdcdc] bg-[#f7f7f7] relative z-20" @action="handlePanelAction" />

            <!-- Emoji Picker -->
            <EmojiPicker v-if="showEmojiPicker" @select-emoji="handleEmojiSelect" @select-sticker="handleStickerSelect"
                class="relative z-30 shadow-2xl" />

            <!-- Call Visualizer (Global Overlay) -->
            <CallVisualizer v-if="callStore.status !== 'none'" />

            <!-- Media Previews -->
            <ImagePreview v-if="previewImage" :src="previewImage" @close="previewImage = null" />
            <VideoPreview v-if="previewVideo" :src="previewVideo" @close="previewVideo = null" />

            <!-- Hidden Input -->
            <input type="file" ref="imgUploadInput" class="hidden" accept="image/*" @change="handleImgUpload">

        </div><!-- End of Main Chat Content -->

        <!-- Settings Overlay -->
        <ChatDetailSettings v-if="showSettings" :chatData="chatData" @close="showSettings = false"
            @show-profile="handleProfileNavigation" />



        <!-- Red Packet Modal (QQ Style) -->
        <ChatRedPacketModal :visible="showRedPacketModal" :packet="currentRedPacket" :chatData="chatData"
            :isOpening="isOpening" :showResult="showResult" :resultAmount="resultAmount" @close="closeModals"
            @open="openRedPacket" @reject="rejectPayment" @view-wallet="navigateToWallet" />

        <!-- Transfer Modal -->
        <ChatTransferModal :visible="showTransferModal" :packet="currentRedPacket" :chatData="chatData"
            @close="closeModals" @confirm="confirmTransfer" @reject="rejectPayment" />

        <!-- Family Card Action Selection Modal -->
        <div v-if="showFamilyCardModal"
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
                <h3 class="text-lg font-bold text-center mb-6">亲属卡</h3>

                <div class="space-y-4">
                    <!-- Apply for Family Card -->
                    <button @click="handleFamilyCardAction('apply')"
                        class="w-full bg-gradient-to-r from-[#ff9a9e] to-[#fecfef] text-white py-4 rounded-xl font-bold shadow-md hover:shadow-lg transition-all">
                        <div class="flex items-center justify-center gap-2">
                            <i class="fa-solid fa-hand-holding-heart"></i>
                            <span>申请亲属卡</span>
                        </div>
                    </button>

                    <!-- Send Family Card -->
                    <button @click="handleFamilyCardAction('send')"
                        class="w-full bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-white py-4 rounded-xl font-bold shadow-md hover:shadow-lg transition-all">
                        <div class="flex items-center justify-center gap-2">
                            <i class="fa-solid fa-gift"></i>
                            <span>赠送亲属卡</span>
                        </div>
                    </button>
                </div>

                <!-- Cancel Button -->
                <button @click="showFamilyCardModal = false"
                    class="w-full mt-4 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                    取消
                </button>
            </div>
        </div>

        <!-- Send Family Card Form Modal -->
        <div v-if="showFamilyCardSendModal"
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
                <h3 class="text-lg font-bold text-center mb-6">赠送亲属卡</h3>

                <div class="space-y-5">
                    <!-- Amount Input -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">设置额度</label>
                        <div class="relative">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">¥
                            </div>
                            <input type="number" v-model="familyCardAmount"
                                class="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0.00" step="0.01" min="0.01">
                        </div>
                        <div class="text-xs text-gray-500 mt-1">请输入亲属卡额度，最低0.01元</div>
                    </div>

                    <!-- Note Input -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">备注</label>
                        <input type="text" v-model="familyCardNote"
                            class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="例如：我的钱就是你的钱">
                        <div class="text-xs text-gray-500 mt-1">给亲属卡起个温馨的名字吧</div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-3 pt-2">
                        <button @click="showFamilyCardSendModal = false"
                            class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                            取消
                        </button>
                        <button @click="confirmSendFamilyCard"
                            class="flex-1 bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                            :disabled="!familyCardAmount || parseFloat(familyCardAmount) <= 0">
                            发送
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Apply Family Card Form Modal -->
        <div v-if="showFamilyCardApplyModal"
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
                <h3 class="text-lg font-bold text-center mb-6">申请亲属卡</h3>

                <div class="space-y-5">
                    <!-- Note Input -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">申请留言</label>
                        <textarea v-model="familyCardApplyNote"
                            class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="例如：送我一张亲属卡好不好？以后你来管家~" rows="3" maxlength="100"></textarea>
                        <div class="text-xs text-gray-500 mt-1">写下你想要申请亲属卡的理由吧</div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-3 pt-2">
                        <button @click="showFamilyCardApplyModal = false"
                            class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                            取消
                        </button>
                        <button @click="confirmApplyFamilyCard"
                            class="flex-1 bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                            :disabled="!familyCardApplyNote.trim()">
                            发送申请
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Family Card Claim Modal (Extracted) -->
        <FamilyCardClaimModal ref="claimModalRef" @confirm="handleClaimConfirm" />

        <!-- Inner Voice Modal (Mindscape) -->
        <ChatInnerVoiceCard :visible="showInnerVoiceModal" :chatId="chatData?.id" :initialMsgId="currentInnerVoiceMsgId"
            :chatData="chatData" @close="showInnerVoiceModal = false" />

        <!-- Send Money Modal (Redesigned) -->
        <div v-if="showSendModal"
            class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div class="bg-white w-[85%] max-w-[340px] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                @click.stop>
                <!-- Header with Gradient -->
                <div :class="sendType === 'redpacket'
                    ? 'bg-gradient-to-br from-red-500 via-red-600 to-orange-600'
                    : 'bg-gradient-to-br from-orange-400 via-yellow-500 to-orange-600'"
                    class="h-16 relative flex items-center justify-center shrink-0">
                    <span class="font-bold text-white text-xl tracking-wide drop-shadow-md">
                        {{ sendType === 'redpacket' ? '发红包' : '转账' }}
                    </span>
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-pointer rounded-full hover:bg-white/20 transition-colors"
                        @click="showSendModal = false">
                        <i class="fa-solid fa-xmark text-white text-xl drop-shadow"></i>
                    </div>

                    <!-- Decorative Elements -->
                    <div v-if="sendType === 'redpacket'" class="absolute inset-0 overflow-hidden pointer-events-none">
                        <div class="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                        <div class="absolute -bottom-6 -left-6 w-32 h-32 bg-yellow-300/20 rounded-full blur-3xl"></div>
                    </div>
                </div>

                <div class="p-6 flex flex-col gap-5 bg-gradient-to-b from-white to-gray-50">
                    <!-- Recipient Info (Transfer Mode) -->
                    <div v-if="sendType === 'transfer'" class="flex flex-col items-center gap-3 -mt-2">
                        <div class="relative">
                            <img :src="chatData?.avatar"
                                class="w-16 h-16 rounded-2xl bg-gray-200 object-cover shadow-lg ring-4 ring-white">
                            <div
                                class="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center shadow-md">
                                <i class="fa-solid fa-coins text-white text-xs"></i>
                            </div>
                        </div>
                        <div class="text-gray-700 text-sm">转账给 <span class="font-bold text-gray-900">{{ chatData?.name
                        }}</span></div>
                    </div>

                    <!-- Red Packet Icon (Red Packet Mode) -->
                    <div v-if="sendType === 'redpacket'" class="flex justify-center -mt-2">
                        <div
                            class="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl transform rotate-3">
                            <i class="fa-solid fa-gift text-white text-4xl drop-shadow-lg"></i>
                        </div>
                    </div>

                    <!-- Amount Input -->
                    <div class="flex flex-col gap-3">
                        <div class="text-gray-600 font-medium text-sm ml-1" v-if="sendType === 'transfer'">转账金额</div>
                        <div class="flex items-center gap-2 border-b-2 pb-2 pt-1 transition-colors min-h-[80px]"
                            :class="sendAmount ? 'border-red-500' : 'border-gray-300'">
                            <span class="text-gray-900 font-bold text-4xl">¥</span>
                            <input type="text" inputmode="decimal" v-model="sendAmount" placeholder="0.00"
                                class="flex-1 min-w-0 bg-transparent border-none outline-none text-5xl font-bold text-gray-900 placeholder-gray-300"
                                style="font-family: 'SF Pro Display', -apple-system, sans-serif;">
                        </div>
                    </div>

                    <!-- Note Input -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-medium ml-1"
                            :class="sendType === 'redpacket' ? 'text-red-600' : 'text-orange-600'">
                            {{ sendType === 'redpacket' ? '💌 寄语' : '📝 添加备注' }}
                        </label>
                        <input type="text" v-model="sendNote"
                            :placeholder="sendType === 'redpacket' ? '恭喜发财，大吉大利' : '转账给您'"
                            class="w-full bg-white rounded-xl px-4 py-3 border-2 border-gray-200 text-sm outline-none placeholder-gray-400 focus:border-red-400 focus:ring-4 focus:ring-red-100 transition-all">
                    </div>

                    <button @click="confirmSend"
                        class="w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        :class="sendType === 'redpacket'
                            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                            : 'bg-gradient-to-r from-orange-400 to-yellow-500 hover:from-orange-500 hover:to-yellow-600 text-white'"
                        :disabled="!sendAmount">
                        <i class="fa-solid mr-2" :class="sendType === 'redpacket' ? 'fa-gift' : 'fa-paper-plane'"></i>
                        {{ sendType === 'redpacket' ? '塞钱进红包' : '确认转账' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Status Edit Modal -->
        <div v-if="showStatusModal"
            class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 animate-fade-in"
            @click="showStatusModal = false">
            <div class="bg-white w-full max-w-[300px] rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
                @click.stop>
                <div class="p-6">
                    <div class="text-center font-bold text-lg text-gray-800 mb-4">编辑对方状态</div>
                    <div class="relative mb-6">
                        <input v-model="statusEditInput" type="text"
                            class="w-full bg-gray-100 border-none rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#07c160] transition-all"
                            placeholder="想写啥写啥..." @keyup.enter="saveStatus">
                        <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                            {{ statusEditInput.length }}/30
                        </div>
                    </div>
                    <div class="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded-xl">
                        <span class="text-sm text-gray-500 ml-2">在线状态</span>
                        <div class="flex bg-gray-200 rounded-lg p-1">
                            <button @click="statusIsOnline = true"
                                class="px-3 py-1 rounded-md text-xs font-bold transition-all"
                                :class="statusIsOnline ? 'bg-[#00df6c] text-white shadow-sm' : 'text-gray-500'">在线</button>
                            <button @click="statusIsOnline = false"
                                class="px-3 py-1 rounded-md text-xs font-bold transition-all"
                                :class="!statusIsOnline ? 'bg-gray-400 text-white shadow-sm' : 'text-gray-500'">离线</button>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button @click="showStatusModal = false"
                            class="flex-1 py-3 rounded-xl font-medium text-gray-500 bg-gray-100 active:bg-gray-200 transition-colors">取消</button>
                        <button @click="saveStatus"
                            class="flex-1 py-3 rounded-xl font-medium text-white bg-[#07c160] active:bg-[#06ad56] shadow-sm transition-colors">确定</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modals -->
        <ChatEditModal v-model="showEditModal" :targetMsgId="editTargetId" />
        <ChatHistoryModal v-model="showHistoryModal" :targetMsgId="editTargetId" />
        <MusicPlayer />

        <!-- See Image (Text to Image) Modal -->
        <div v-if="showSeeImageModal"
            class="fixed inset-0 bg-gradient-to-br from-gray-900/80 to-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
            @click="closeSeeImageModal">
            <div class="bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
                @click.stop>
                <!-- Header -->
                <div class="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white">
                    <h3 class="font-bold text-xl text-gray-800">见图</h3>
                    <button @click="closeSeeImageModal" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6">
                    <!-- Prompt Input -->
                    <div class="mb-5">
                        <label class="block text-sm font-medium text-gray-600 mb-3">生图提示词</label>
                        <textarea v-model="seeImagePrompt"
                            class="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none text-gray-800"
                            rows="3" placeholder="请输入你想要生成的图片描述..."></textarea>
                    </div>

                    <!-- Generate Button -->
                    <button @click="generateSeeImage"
                        class="w-full bg-gradient-to-r from-blue-400 to-blue-500 text-white font-medium py-3 px-4 rounded-lg hover:from-blue-500 hover:to-blue-600 transition-all mb-5 shadow-sm hover:shadow-md"
                        :disabled="seeImageLoading">
                        <span v-if="seeImageLoading">
                            <i class="fa-solid fa-spinner fa-spin mr-2"></i>生成中...
                        </span>
                        <span v-else>
                            <i class="fa-solid fa-magic mr-2"></i>生成图片
                        </span>
                    </button>

                    <!-- Image Preview (if generated) -->
                    <div v-if="seeImageResult" class="mb-5">
                        <div class="flex items-center justify-between mb-3">
                            <label class="block text-sm font-medium text-gray-600">预览</label>
                            <div class="text-xs text-gray-400">
                                {{ currentHistoryIndex + 1 }}/{{ seeImageHistory.length }}
                            </div>
                        </div>
                        <div class="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white p-2"
                            @touchstart="touchStart" @touchmove="touchMove" @touchend="touchEnd">
                            <img :src="seeImageResult" class="w-full h-auto rounded">
                        </div>
                    </div>

                    <!-- Image History Navigation -->
                    <div v-if="seeImageHistory.length > 0" class="mb-5">
                        <div class="flex items-center justify-center gap-3">
                            <button @click="prevHistoryImage"
                                class="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
                                :disabled="currentHistoryIndex <= 0">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <button @click="regenerateSeeImage"
                                class="flex-1 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all shadow-sm"
                                :disabled="seeImageLoading">
                                <i class="fa-solid fa-rotate-right mr-2"></i>重新生成
                            </button>
                            <button @click="nextHistoryImage"
                                class="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
                                :disabled="currentHistoryIndex >= seeImageHistory.length - 1">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Send Button -->
                    <button @click="sendSeeImage"
                        class="w-full bg-gradient-to-r from-green-400 to-green-500 text-white font-medium py-3 px-4 rounded-lg hover:from-green-500 hover:to-green-600 transition-all shadow-sm hover:shadow-md"
                        :disabled="!seeImageResult || seeImageLoading">
                        <i class="fa-solid fa-paper-plane mr-2"></i>发送到聊天
                    </button>
                </div>
            </div>
        </div>

        <!-- Context Menu -->
        <div v-if="showContextMenu" class="fixed inset-0 z-[100]" @click="closeContextMenu"
            @touchstart.stop="closeContextMenu">
            <div class="fixed bg-[#2b2b2b] text-white rounded-lg shadow-xl py-2 w-[140px] border border-[#333] transition-opacity duration-200"
                :style="{ top: (menuPosition.y + 5) + 'px', left: (menuPosition.x + 5) + 'px' }" @click.stop
                @touchstart.stop>
                <div class="flex flex-col select-none">
                    <!-- Debug click -->
                    <div class="ctx-item" @click.stop="handleMenuAction('edit')"
                        @touchstart.stop.prevent="handleMenuAction('edit')"><i class="fa-solid fa-pen w-5"></i> 编辑</div>
                    <div class="ctx-item" @click.stop="handleMenuAction('history')"
                        @touchstart.stop.prevent="handleMenuAction('history')"><i
                            class="fa-solid fa-clock-rotate-left w-5"></i> 编辑历史</div>
                    <div class="ctx-item" @click.stop="handleMenuAction('copy')"
                        @touchstart.stop.prevent="handleMenuAction('copy')"><i class="fa-regular fa-copy w-5"></i> 复制
                    </div>
                    <div class="ctx-item" @click.stop="handleMenuAction('quote')"
                        @touchstart.stop.prevent="handleMenuAction('quote')"><i class="fa-solid fa-quote-left w-5"></i>
                        引用</div>
                    <div class="ctx-item" @click.stop="handleMenuAction('recall')"
                        @touchstart.stop.prevent="handleMenuAction('recall')"><i
                            class="fa-solid fa-rotate-left w-5"></i> 撤回</div>
                    <div class="ctx-item" @click.stop="handleMenuAction('fav')"
                        @touchstart.stop.prevent="handleMenuAction('fav')"><i class="fa-regular fa-star w-5"></i> 收藏
                    </div>
                    <div class="ctx-item" @click.stop="handleMenuAction('listen')"
                        @touchstart.stop.prevent="handleMenuAction('listen')"><i
                            class="fa-solid fa-volume-high w-5"></i> 听音</div>
                    <div class="ctx-divider my-1 border-t border-white/10"></div>
                    <div class="ctx-item" @click.stop="handleMenuAction('multi')"
                        @touchstart.stop.prevent="handleMenuAction('multi')"><i class="fa-solid fa-list-check w-5"></i>
                        多选</div>
                    <div class="ctx-item text-red-400" @click.stop="handleMenuAction('delete')"
                        @touchstart.stop.prevent="handleMenuAction('delete')"><i class="fa-solid fa-trash w-5"></i> 删除
                    </div>
                </div>
            </div>
        </div>
    </div><!-- End of v-else chat-window -->
</template>



<style scoped>
.ctx-item {
    padding: 10px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    font-size: 14px;
    transition: background 0.1s;
    color: #e0e0e0;
}

.ctx-item:active,
.ctx-item:hover {
    background: rgba(255, 255, 255, 0.1);
}

.ctx-item i {
    text-align: center;
    margin-right: 8px;
    opacity: 0.8;
}

@keyframes spin-slow {
    to {
        transform: rotate(360deg);
    }
}

.animate-spin-slow {
    animation: spin-slow 0.8s linear infinite;
}

.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}

.animate-scale-in {
    animation: scaleIn 0.3s ease-out cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Markdown Styles in Chat Bubble */
.chat-bubble-left :deep(p),
.chat-bubble-right :deep(p) {
    margin: 0;
    line-height: 1.6;
}

.chat-bubble-left :deep(p + p),
.chat-bubble-right :deep(p + p) {
    margin-top: 0.5em;
}

.chat-bubble-left :deep(ul),
.chat-bubble-right :deep(ul) {
    list-style-type: disc;
    padding-left: 1.5em;
    margin: 0.5em 0;
}

.chat-bubble-left :deep(ol),
.chat-bubble-right :deep(ol) {
    list-style-type: decimal;
    padding-left: 1.5em;
    margin: 0.5em 0;
}

.chat-bubble-left :deep(li),
.chat-bubble-right :deep(li) {
    margin: 0.2em 0;
}

.chat-bubble-left :deep(code),
.chat-bubble-right :deep(code) {
    background: rgba(0, 0, 0, 0.1);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
}

.chat-bubble-left :deep(pre),
.chat-bubble-right :deep(pre) {
    background: rgba(0, 0, 0, 0.05);
    padding: 8px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.5em 0;
}

.chat-bubble-left :deep(pre code),
.chat-bubble-right :deep(pre code) {
    background: transparent;
    padding: 0;
}

.chat-bubble-left :deep(a),
.chat-bubble-right :deep(a) {
    color: #0066cc;
    text-decoration: underline;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes scaleIn {
    from {
        transform: scale(0.8);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes heartbeat {
    0% {
        transform: scale(1);
    }

    14% {
        transform: scale(1.1);
    }

    28% {
        transform: scale(1);
    }

    42% {
        transform: scale(1.1);
    }

    70% {
        transform: scale(1);
    }
}

.animate-heartbeat {
    animation: heartbeat 1.5s infinite ease-in-out;
}


/* Inner Voice Card Styles */
.inner-voice-card {
    background: linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(10, 10, 10, 0.98));
    border: 1px solid rgba(255, 215, 0, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 6px;
    width: 260px;
    /* Constrained width */
}

/* --- Mindscape (Inner Voice) Modal CSS --- */

.voice-modal-content {
    width: 90%;
    max-width: 380px;
    max-height: 85vh;
    height: auto;
    /* Dark Radial Gradient + Noise Texture Overlay */
    background: radial-gradient(circle at 50% 0%, #2a2520 0%, #0a0a0c 85%);
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.06'/%3E%3C/svg%3E"),
        radial-gradient(circle at 50% 0%, #2a2520 0%, #0a0a0c 85%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.95), inset 0 0 40px rgba(0, 0, 0, 0.6);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}

#voice-effect-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    mix-blend-mode: screen;
    /* Crucial for the glowing effect */
}

.voice-modal-header {
    padding: 20px 24px;
    z-index: 10;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(10, 10, 12, 0.8);
}

.header-title {
    font-family: serif;
    /* Fallback since we might not have 'Cormorant Garamond' */
    font-size: 16px;
    letter-spacing: 6px;
    color: #e6dcc0;
    text-transform: uppercase;
}

.voice-modal-header-btn {
    background: transparent;
    border: none;
    color: #8c7e63;
    font-size: 16px;
    cursor: pointer;
    transition: 0.3s;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.voice-modal-header-btn:hover {
    color: #e6dcc0;
    text-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
}

.voice-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.voice-header-group {
    text-align: center;
    margin-bottom: 5px;
}

.voice-char-avatar-box {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    margin: 0 auto 12px;
    padding: 3px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    outline: 1px solid rgba(212, 175, 55, 0.4);
    outline-offset: 4px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
}

.voice-char-name {
    font-size: 24px;
    color: #e6dcc0;
    letter-spacing: 3px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    font-family: serif;
}

.voice-char-meta {
    font-size: 12px;
    color: #8c7e63;
    letter-spacing: 2px;
    margin-top: 6px;
    font-style: italic;
}

.voice-card-inner {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 24px 20px;
    text-align: center;
    position: relative;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.voice-card-inner::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 20px;
    background: linear-gradient(to bottom, #d4af37, transparent);
}

.voice-label-center {
    font-size: 11px;
    color: #8c7e63;
    letter-spacing: 4px;
    margin-bottom: 12px;
    display: block;
}

.voice-text-inner {
    font-size: 15px;
    color: #dcdcdc;
    line-height: 1.9;
    font-weight: 300;
}

.voice-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.voice-info-block {
    position: relative;
    padding-left: 10px;
    border-left: 2px solid rgba(255, 255, 255, 0.05);
}

.voice-label {
    font-size: 10px;
    color: #8c7e63;
    margin-bottom: 6px;
    letter-spacing: 2px;
}

.voice-text-content {
    font-size: 13px;
    color: #a0a0a0;
    line-height: 1.6;
    text-align: justify;
    font-weight: 300;
}

.voice-modal-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(10, 10, 12, 0.8);
    z-index: 10;
    flex-shrink: 0;
}

.footer-count {
    font-size: 10px;
    color: #555;
    letter-spacing: 2px;
}

.effect-badge {
    font-size: 10px;
    color: #8c7e63;
    opacity: 0.8;
    letter-spacing: 1px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
}

.effect-badge:hover {
    color: #e6dcc0;
    border-color: #8c7e63;
}


.inner-voice-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.3), transparent);
}

.iv-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}

.iv-item {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    padding: 4px 6px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.iv-label {
    color: #888;
    margin-bottom: 2px;
    font-size: 10px;
}

.iv-value {
    color: #e0e0e0;
    font-family: 'Songti SC', serif;
}

/* Chat Bubbles - Black Gold for AI */
.chat-bubble-left {
    background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
    color: #f0e6d2 !important;
    /* Champagne Gold Text */
    border: 1px solid rgba(240, 230, 210, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: "SimSun", "Songti SC", "Noto Serif SC", serif;
}

.chat-bubble-left::after {
    border-color: transparent #1a1a1a transparent transparent;
}

/* Chat Bubbles - Dark Gray for User (Right) */
.chat-bubble-right {
    background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
    color: #f3f4f6;
    /* Off-white text */
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: "SimSun", "Songti SC", "Noto Serif SC", serif;
}

/* Pay Card Styles */
.pay-card {
    width: 245px;
    background-color: white;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    user-select: none;
    transition: opacity 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.pay-card:active {
    opacity: 0.9;
}

.pay-card.received,
.pay-card.rejected {
    opacity: 0.8;
}

/* Specific background styles handled in template or tailored here if possible, 
   but since dynamic classes are used (bg-[#...]), we focus on layout. */

.pay-top {
    display: flex;
    align-items: center;
    padding: 16px 12px;
    gap: 12px;
}

.pay-icon {
    width: 38px;
    height: 38px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    color: white;
    /* The background color is set dynamically in the template */
    border-radius: 50%;
    /* Slightly lighter background for the icon circle to simulate the visual */
    background-color: rgba(255, 255, 255, 0.2) !important;
}

.pay-info {
    flex: 1;
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
}

.pay-title {
    font-size: 16px;
    font-weight: 500;
    line-height: 1.2;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pay-desc {
    font-size: 12px;
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pay-bottom {
    background-color: white;
    padding: 4px 12px;
    font-size: 11px;
    color: #999;
    border-top: 1px solid #f0f0f0;
}

/* Voice Message Styles */
.voice-container {
    display: flex;
    align-items: center;
}

.voice-bubble {
    min-height: 40px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    min-width: 80px;
}

.voice-icon {
    font-size: 16px;
}

.voice-duration {
    font-weight: bold;
    font-size: 14px;
}

.voice-history-preview {
    font-size: 12px;
    color: #aaa;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* Mindscape Modal Styles */
.voice-modal-content {
    width: 90%;
    max-width: 380px;
    max-height: 85vh;
    height: auto;
    background: radial-gradient(circle at 50% 0%, #2a2520 0%, #0a0a0c 85%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.95), inset 0 0 40px rgba(0, 0, 0, 0.6);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    font-family: 'Noto Serif SC', serif;
}

.voice-modal-header {
    padding: 20px 24px;
    z-index: 10;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(10, 10, 12, 0.8);
}

.header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 16px;
    letter-spacing: 6px;
    color: #e6dcc0;
    text-transform: uppercase;
}

.voice-modal-header-btn {
    background: transparent;
    border: none;
    color: #8c7e63;
    font-size: 16px;
    cursor: pointer;
    transition: 0.3s;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.voice-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.voice-header-group {
    text-align: center;
    margin-bottom: 5px;
}

.voice-char-avatar-box {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    margin: 0 auto 12px;
    padding: 3px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    outline: 1px solid rgba(212, 175, 55, 0.4);
    outline-offset: 4px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
}

.voice-char-name {
    font-size: 24px;
    color: #e6dcc0;
    letter-spacing: 3px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

.voice-char-meta {
    font-size: 12px;
    color: #8c7e63;
    letter-spacing: 2px;
    margin-top: 6px;
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
}

.voice-card-inner {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 24px 20px;
    text-align: center;
    position: relative;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.voice-card-inner::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 20px;
    background: linear-gradient(to bottom, #d4af37, transparent);
}

#voice-effect-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
    /* Boosted from 0 */
    /* mix-blend-mode: screen; */
    /* Temporarily disabled for visibility check */
}

.voice-label-center {
    font-size: 11px;
    color: #8c7e63;
    letter-spacing: 4px;
    margin-bottom: 12px;
    display: block;
}

.voice-text-inner {
    font-size: 15px;
    color: #dcdcdc;
    line-height: 1.9;
    font-weight: 300;
    white-space: pre-line;
}

.voice-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.voice-info-block {
    position: relative;
    padding-left: 10px;
    border-left: 2px solid rgba(255, 255, 255, 0.05);
}

.voice-label {
    font-size: 10px;
    color: #8c7e63;
    margin-bottom: 6px;
    letter-spacing: 2px;
}

.voice-text-content {
    font-size: 13px;
    color: #a0a0a0;
    line-height: 1.6;
    text-align: justify;
    font-weight: 300;
    white-space: pre-line;
}

.voice-modal-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(10, 10, 12, 0.8);
    z-index: 10;
    flex-shrink: 0;
}

.footer-count {
    font-size: 10px;
    color: #555;
    letter-spacing: 2px;
}

.effect-badge {
    font-size: 10px;
    color: #8c7e63;
    opacity: 0.8;
    letter-spacing: 1px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
}


/* History List Styles */
.voice-history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 20px;
}

.voice-history-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 16px;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    position: relative;
    overflow: hidden;
}

.voice-history-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 2px;
    height: 100%;
    background: #d4af37;
    opacity: 0;
    transition: opacity 0.2s;
}

.voice-history-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.voice-history-card:hover::before {
    opacity: 1;
}

.voice-history-time {
    font-size: 10px;
    color: #8c7e63;
    margin-bottom: 6px;
    letter-spacing: 1px;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 4px;
}

.voice-history-time::before {
    content: '';
    display: block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #8c7e63;
    opacity: 0.5;
}

.voice-history-preview {
    font-size: 13px;
    color: #dcdcdc;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-weight: 300;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Font */
.font-songti {
    font-family: "Songti SC", "SimSun", serif;
}

/* Voice Wave Animation - Improved Sound Wave Effect */
.voice-wave {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 16px;
}

.voice-wave .bar {
    width: 3px;
    border-radius: 2px;
    background-color: currentColor;
    /* 声纹颜色与气泡文字颜色一致 */
    transition: height 0.2s, opacity 0.2s;
    opacity: 0.8;
}

/* Static wave heights - More natural distribution */
.voice-wave .bar1 {
    height: 5px;
    animation-delay: 0s;
}

.voice-wave .bar2 {
    height: 12px;
    animation-delay: 0.1s;
}

.voice-wave .bar3 {
    height: 16px;
    animation-delay: 0.2s;
}

.voice-wave .bar4 {
    height: 9px;
    animation-delay: 0.3s;
}

.voice-wave .bar5 {
    height: 14px;
    animation-delay: 0.4s;
}

/* Playing animation - More realistic sound wave effect */
.voice-wave.playing .bar {
    animation: voice-wave-anim 0.6s infinite ease-in-out;
}

@keyframes voice-wave-anim {

    0%,
    100% {
        height: 5px;
        opacity: 0.5;
    }

    10% {
        height: 10px;
        opacity: 0.7;
    }

    20% {
        height: 16px;
        opacity: 0.9;
    }

    30% {
        height: 12px;
        opacity: 0.8;
    }

    40% {
        height: 8px;
        opacity: 0.7;
    }

    50% {
        height: 14px;
        opacity: 1;
    }

    60% {
        height: 6px;
        opacity: 0.6;
    }

    70% {
        height: 11px;
        opacity: 0.8;
    }

    80% {
        height: 7px;
        opacity: 0.7;
    }

    90% {
        height: 13px;
        opacity: 0.9;
    }
}

/* Enhanced playing effect */
.voice-playing-effect {
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
    transform: scale(1.02);
    transition: all 0.3s ease;
}

.voice-wave.wave-left {
    flex-direction: row;
}

.voice-wave.wave-right {
    flex-direction: row-reverse;
}

/* Toast Transitions */
.fade-enter-active,
.fade-leave-active {
    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translate(-50%, -20px);
}

.fade-enter-to,
.fade-leave-from {
    opacity: 1;
    transform: translate(-50%, 0);
}
</style>
