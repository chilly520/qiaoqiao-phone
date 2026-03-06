
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../../stores/chatStore'
import { useWalletStore } from '../../stores/walletStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useStickerStore } from '../../stores/stickerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useMusicStore } from '../../stores/musicStore'
import { useCallStore } from '../../stores/callStore'
import { useWorldLoopStore } from '../../stores/worldLoopStore'
import { useBackpackStore } from '../../stores/backpackStore'


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
import FamilyCardDetailModal from './FamilyCardDetailModal.vue'
import GroupAnnouncementModal from './modals/GroupAnnouncementModal.vue'
import ChatSendMoneyModal from './modals/ChatSendMoneyModal.vue'
import FamilyCardActionModal from './modals/FamilyCardActionModal.vue'
import FamilyCardSendModal from './modals/FamilyCardSendModal.vue'
import FamilyCardApplyModal from './modals/FamilyCardApplyModal.vue'
import StatusEditModal from './modals/StatusEditModal.vue'
import CallStatusBar from '../../components/CallStatusBar.vue'
import WorldLoopGMPanel from './modals/WorldLoopGMPanel.vue'
import WorldLoopSettings from './modals/WorldLoopSettings.vue'
import WorldLoopOfflineOverlay from './modals/WorldLoopOfflineOverlay.vue'
import MissionSchedulerModal from './modals/MissionSchedulerModal.vue'
import GroupVoteModal from './modals/GroupVoteModal.vue'
import GroupRankModal from './modals/GroupRankModal.vue'
import DiceModal from './modals/DiceModal.vue'
import TarotModal from './modals/TarotModal.vue'
import BackpackModal from './modals/BackpackModal.vue'
import GiftDetailModal from './modals/GiftDetailModal.vue'

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

const props = defineProps({
    initialUnreadCount: {
        type: Number,
        default: 0
    }
})
const emit = defineEmits(['back', 'show-profile'])

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()
const walletStore = useWalletStore()
const favoritesStore = useFavoritesStore()
const musicStore = useMusicStore()
const callStore = useCallStore()
const worldLoopStore = useWorldLoopStore()
const backpackStore = useBackpackStore()

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

    // Precompile regex patterns for better performance
    const voiceBlockRegex = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]/gi;
    const voiceUnclosedRegex = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?=\s*\n\s*\[(?!\/)|$)/gi;
    const voiceClosingRegex = /\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]/gi;
    const protocolTagsRegex = /\[(?:LIKE|COMMENT|REPLY|VOTE|RECALL|撤回|NUDGE|拍一拍|SET_PAT|UPDATE_BIO|BIO|MOMENT|朋友�?[:：]\s*[^\]]+\]/gi;
    const jsonBlocksRegex = /\{[\s\n]*"(?:着装|环境|status|心声|心心声|行为|mind|outfit|scene|action|thoughts|mood|state|stats|spirit)"[\s\S]*?\}/gi;
    const systemTagRegex = /\[System:[\s\S]+?\]/gi;
    const claimTagsRegex = /\[(领取红包|RECEIVE_RED_PACKET)\]/gi;
    const avatarChangeRegex = /\[(?:更换头像|SET_AVATAR)[:：]\s*[^\]]*\]/gi;
    const zeroWidthRegex = /[\u200b\u200c\u200d\ufeff]/g;

    // Remove Inner Voice block (Standard)
    let clean = content.replace(voiceBlockRegex, '');
    clean = clean.replace(voiceUnclosedRegex, '');
    clean = clean.replace(voiceClosingRegex, ''); // Scrub stray closing tags

    // Removal of strictly internal protocol tags
    clean = clean.replace(protocolTagsRegex, '');

    // Remove Naked JSON blocks (Fallback) - Only if they contain specific Inner Voice keys
    clean = clean.replace(jsonBlocksRegex, '');

    // NEW: Remove HTML Card JSON blocks (Greedy & Robust)
    if (clean.includes('"type"') && clean.includes('"html"')) {
        // Find first { and last } to remove the entire block
        // This prevents regex from stopping early on } inside CSS or HTML content
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            // Double check it's likely the card
            const snippet = clean.substring(start, end + 1);
            if (snippet.includes('"type"') && snippet.includes('"html"')) {
                clean = clean.substring(0, start) + clean.substring(end + 1);
            }
        } else {
            // Fallback regex if structure is complex
            clean = clean.replace(/\{[\s\S]*?"type"\s*:\s*"html"[\s\S]*\}\s*\}?/gi, '');
        }
    }

    clean = clean.replace(systemTagRegex, '');
    clean = clean.trim();
    // Remove Claim Tags
    clean = clean.replace(claimTagsRegex, '').trim();
    // Remove Avatar Change Commands
    clean = clean.replace(avatarChangeRegex, '').trim();

    // Filter out zero-width characters
    clean = clean.replace(zeroWidthRegex, '');

    return clean;
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

    // Tag check: contains [图片:...] or [表情�?...]
    // We use a more relaxed regex without strict ^ $ to handle potential surrounding chars/newlines
    return /\[(?:图片|IMAGE|表情包|表情-包|STICKER)[:：].*?\]/i.test(clean)
}

const chatData = computed(() => chatStore.currentChat)
const msgs = computed(() => chatData.value?.msgs || [])
const loopData = computed(() => {
    if (!chatData.value?.loopId) return null
    return worldLoopStore.loops[chatData.value.loopId]
})
const route = useRoute()
const router = useRouter()
const chatInputBarRef = ref(null)
const showSettings = ref(false)

const showGMMenu = ref(false)
const showMissionScheduler = ref(false)
const showVoteModal = ref(false)
const showDiceModal = ref(false)
const showTarotModal = ref(false)
const showBackpackModal = ref(false)
const showScrollToBottom = ref(false)
const showRankModal = ref(false)
const rankChatId = ref('')
const msgContainer = ref(null)
const virtualListContainer = ref(null)

const isMsgVisible = (msg) => {
    if (msg.hidden) return false

    // 1. Priority check for media/special types
    const content = ensureString(msg.content)
    if (msg.type === 'redpacket' || msg.type === 'transfer' || content.includes('[红包]') || content.includes('[转账]')) return true
    if (msg.type === 'gift' || msg.type === 'gift_claimed') return true
    if (msg.type === 'image' || isImageMsg(msg)) return true

    // 2. Role-based text filtering
    if (['ai', 'assistant', 'user'].includes(msg.role)) {
        const cleanContent = getCleanContent(content);
        if (!cleanContent.trim()) return false;
        return true;
    }

    // 3. System/Other fallback
    const clean = getCleanContent(content)
    return clean && clean.length > 0
}

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

// Filter messages for display once to avoid repeated filtering in template
const filteredDisplayMsgs = computed(() => {
    return (displayedMsgs.value || []).filter(msg => isMsgVisible(msg))
})

const backpackModal = ref(null)
const giftDetailModal = ref(null)



const handleScroll = () => {
    if (!msgContainer.value) return
    const { scrollTop, scrollHeight, clientHeight } = msgContainer.value
    // Show button if we are more than 500px from the bottom AND have enough messages
    // The user requested "more than 10 messages", checking length is a proxy.
    const isFarFromBottom = (scrollHeight - scrollTop - clientHeight) > 500
    showScrollToBottom.value = isFarFromBottom && displayedMsgs.value.length > 10
}


watch(msgContainer, (el) => {
    if (el) {
        el.addEventListener('scroll', handleScroll)
    }
}, { immediate: true })

onUnmounted(() => {
    if (msgContainer.value) {
        msgContainer.value.removeEventListener('scroll', handleScroll)
    }
})

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
    // World Loop never shows friend request
    if (chatData.value.loopId) return false
    // Hide for group chats
    if (chatData.value.isGroup) return false
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
        content: '你已添加�? + chatData.value.name + '，现在可以开始聊天了�? // Standard WeChat Text
    })

    // 3. User Auto Reply (My side)
    chatStore.addMessage(chatData.value.id, {
        role: 'user',
        content: '我们已经是好友了，快来聊天吧�?
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
            // For World Loop, the Welcome Card is enough. Don't auto-open settings/GM Panel.
            if (!chatData.value.loopId) {
                showSettings.value = true
            }
            // Clear isNew flag
            chatStore.updateCharacter(chatData.value.id, { isNew: false })
        }

        // Check World Loop Welcome Logic:
        if (chatData.value?.loopId && chatData.value.msgs?.length === 0) {
            const loop = worldLoopStore.loops[chatData.value.loopId]
            if (loop) {
                chatStore.addMessage(chatData.value.id, {
                    role: 'system',
                    type: 'html',
                    content: `[CARD]
<div class="p-4 bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-xl shadow-inner border border-purple-500/30">
    <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-400/30">
            <i class="fa-solid fa-earth-asia text-purple-300"></i>
        </div>
        <div>
            <div class="text-[10px] text-purple-300 font-bold uppercase tracking-widest">世界观加载完�?/div>
            <div class="text-sm font-bold">${loop.name}</div>
        </div>
    </div>
    <div class="text-xs text-purple-100/80 leading-relaxed italic border-l-2 border-purple-500/50 pl-3">
        ${loop.description || '开启一段未知的冒险...'}
    </div>
    <div class="mt-4 pt-3 border-t border-purple-500/20 flex justify-between items-center">
        <div class="text-[9px] text-purple-400">上帝视角：已开�?/div>
        <div class="flex -space-x-2">
            ${chatData.value.participants.slice(0, 3).map(pId => `<div class="w-5 h-5 rounded-full border border-purple-900 bg-gray-800"></div>`).join('')}
        </div>
    </div>
</div>`
                })
            }
        }

        // Check Opening Line Logic:
        if (chatData.value?.openingLine && chatData.value.msgs?.length === 0 && !chatData.value.loopId) {
            chatStore.addMessage(chatData.value.id, {
                role: 'ai',
                content: chatData.value.openingLine
            })
        }
    } catch (error) {
        console.error('[ChatWindow] checkNewChat error:', error)
        showToast('聊天初始化失�? ' + error.message, 'error')
    }
}

// Global Popstate listener for Settings in Window
const handleSettingsPopState = (event) => {
    const state = event.state || {}
    // If we're at a state that doesn't have settingsOpen, but it WAS open, close it
    if (!state.settingsOpen) {
        if (showSettings.value) showSettings.value = false
        if (showGMMenu.value) showGMMenu.value = false
    }
}

const openSettings = () => {
    if (chatData.value?.isGroup) {
        openGroupSettings()
        return
    }
    showSettings.value = true
    const currentState = window.history.state || {}
    if (!currentState.settingsOpen) {
        window.history.pushState({ ...currentState, settingsOpen: true }, '', '')
    }
}

const openPhoneInspection = () => {
    if (!chatData.value || chatData.value.isGroup) return

    // Navigate to phone inspection page
    router.push({
        name: 'phone-inspection',
        params: { charId: chatData.value.id }
    })
}

const openGroupSettings = (showAnnouncements = false) => {
    if (!chatData.value?.isGroup) return
    if (showAnnouncements && groupAnnouncementModal.value) {
        groupAnnouncementModal.value.open()
        return
    }
    router.push({ name: 'wechat-group-settings', params: { chatId: chatData.value.id } })
}

const openGMMenu = () => {
    showGMMenu.value = true
    const currentState = window.history.state || {}
    if (!currentState.settingsOpen) {
        window.history.pushState({ ...currentState, settingsOpen: true }, '')
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

const handleShowRank = (chatId) => {
    rankChatId.value = chatId || chatData.value?.id
    showRankModal.value = true
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

let resizeObserver = null
onMounted(async () => {
    window.addEventListener('popstate', handleSettingsPopState)

    // Initial scroll setup
    scrollToBottom(true)
    setTimeout(() => scrollToBottom(true), 50)
    setTimeout(() => scrollToBottom(true), 200)

    // Robust Scroll-on-Resize logic (Handles AI streaming, images, etc.)
    if (window.ResizeObserver && msgContainer.value) {
        resizeObserver = new ResizeObserver(() => {
            const el = msgContainer.value
            if (!el) return
            const threshold = 150
            const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
            if (isNearBottom) {
                scrollToBottom(false)
            }
        })
        resizeObserver.observe(msgContainer.value)
    }

    // Battery Initialization
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
                content: `[系统提醒] 当前设备电量�?${info.level}%，建议尽快充电。`,
                timestamp: Date.now(),
                type: 'system'
            }
            chatStore.addMessage(chatData.value.id, systemMsg)
        })
    }
})

onUnmounted(() => {
    window.removeEventListener('popstate', handleSettingsPopState)
    if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
    }
    if (batteryInitialized.value) {
        batteryMonitor.destroy()
    }
    delete window.qiaoqiao_receiveFamilyCard
})



// 监听聊天切换，重置分�?// 监听聊天切换，重置分页并瞬间滚动到底�?watch(() => chatStore.currentChatId, (newId) => {
    if (newId) {
        selectedMsgIds.value.clear()
        isMultiSelectMode.value = false
        showScrollToBottom.value = false // Reset button state
        chatStore.resetPagination(newId)

        // Wait for DOM update
        setTimeout(() => {
            if (!scrollToUnread()) {
                scrollToBottom(true)
            }
        }, 100)
    }
})

const addToFavorites = (msg) => {
    // Determine author name for context
    const chatName = chatData.value.name
    const avatarUrl = msg.role === 'user'
        ? (settingsStore.personalization.userProfile.avatar || '/avatars/user.png')
        : (chatData.value.avatar || '/avatars/default.png')

    // FIX: Handle Generated Images (which are type='text' but have 'image' prop)
    const msgToSave = { ...msg }
    if (msg.image) {
        msgToSave.type = 'image'
        msgToSave.content = msg.image
    }

    favoritesStore.addFavorite(msgToSave, chatName, avatarUrl)
    showToast('已收�?, 'success')
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
        showToast('内容已撤�?, 'info')
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

onMounted(async () => {
    // 1. Initialize world loops from storage
    await worldLoopStore.initStore()
    backpackStore.initStore()

    // NEW: Kickstart message consumption for the current chat if segments are pending
    if (chatData.value?.id) {
        chatStore.consumePendingSegments(chatData.value.id);
    }

    // 2. Add event listeners
    window.addEventListener('message', handleIframeMessage)
    window.addEventListener('popstate', handleSettingsPopState)

    // 3. Run new chat/loop logic
    checkNewChat()

    // 4. UI Polish
    // Try to scroll to first unread, otherwise bottom
    setTimeout(() => {
        if (!scrollToUnread()) {
            scrollToBottom(true)
        }
    }, 100)
})

onUnmounted(() => {
    window.removeEventListener('message', handleIframeMessage)
    window.removeEventListener('popstate', handleSettingsPopState)
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

            // 3. 修改拍一拍文�?            const patMatch = contentStr.match(/\[修改拍一�?\s*([^\s]+)\s+([^\]]+)\]/i)
            if (patMatch) {
                const action = patMatch[1].trim()
                const text = patMatch[2].trim()
                handleModifyPatText(action, text)
            }

            // 4. 更换头像
            // 更宽松的正则表达式，处理可能被截断的URL，支持跨行匹�?            const avatarMatch = contentStr.match(/\[更换头像:\s*([\s\S]*?)\]/i)
            if (avatarMatch) {
                let url = avatarMatch[1].trim()
                // 处理可能被截断的URL，确保是有效的URL格式
                if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                    console.log('更换头像指令被触�?', url)
                    handleChangeAvatar(url)
                } else {
                    console.log('无效的头像URL:', url)
                    showToast('无效的头像URL格式', 'error')
                }
            } else {
                // 尝试从消息内容中提取URL，即使没有[更换头像:]标签
                const urlMatch = contentStr.match(/(https?:\/\/[^\s\]]+)/i)
                if (urlMatch) {
                    let url = urlMatch[1].trim()
                    console.log('从消息中提取到URL:', url)
                    // 这里可以添加逻辑，比如询问用户是否要将此URL设置为头�?                }
            }

            // 5. Family Card Status Logic
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
                speakMessage(contentStr, lastMsg.id);
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

// msgContainer defined in setup top

const scrollToUnread = () => {
    if (props.initialUnreadCount > 0 && displayedMsgs.value.length > 0) {
        // Calculate index of the first unread message
        // If unread=5, length=50, index=45 (50-5)
        const unreadStartIndex = Math.max(0, displayedMsgs.value.length - props.initialUnreadCount)
        const targetMsg = displayedMsgs.value[unreadStartIndex]

        if (targetMsg) {
            nextTick(() => {
                const el = document.getElementById(`msg-${targetMsg.id}`)
                if (el) {
                    el.scrollIntoView({ behavior: 'auto', block: 'center' })
                    // Add a temporary highlight maybe?
                    showToast(`${props.initialUnreadCount}条未读消息`, 'info')
                } else {
                    scrollToBottom(true)
                }
            })
            return true
        }
    }
    return false
}

// Robust Scroll to Bottom
const scrollToBottom = (instant = false) => {
    nextTick(() => {
        const el = msgContainer.value
        if (!el) return

        // Use a slightly larger target to ensure we hit bottom despite sub-pixel rendering
        const target = el.scrollHeight + 100

        el.scrollTo({
            top: target,
            behavior: instant ? 'auto' : 'smooth'
        })
    })
}



const currentQuote = ref(null) // New State
const showActionPanel = ref(false)
const isPressing = ref(false)
const pressTimer = ref(null)
const groupAnnouncementModal = ref(null)

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

const latestMessage = computed(() => {
    if (msgs.value.length === 0) return null
    return msgs.value[msgs.value.length - 1]
})
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
        showToast('已开启自动朗�?, 'success')
        return
    }

    // If capability is ON, toggle the active state
    // Default of autoRead is effectively TRUE (if undefined), so we treat undefined as true.
    const currentActive = chatData.value.autoRead !== false
    const newState = !currentActive

    chatStore.updateCharacter(chatData.value.id, { autoRead: newState })

    if (newState) {
        showToast('自动朗读已开�?, 'success')
    } else {
        showToast('自动朗读已暂�?, 'info')
        if (window.speechSynthesis) window.speechSynthesis.cancel()
    }
}

// Status Editing
const showStatusModal = ref(false)
const openStatusEditor = () => {
    showStatusModal.value = true
}

// ... (rest of imports)

// Template Injection (will handle in next chunk for template)
// But wait, replace tool replaces LINES. I need to be careful.
// I will just add the imports and ref definitions here.


// Nudge / Pat Logic
const shakingAvatars = ref(new Set())
let avatarClickTimer = null

// 处理修改拍一拍文�?const handleModifyPatText = (action, text) => {
    if (!chatData.value) return
    chatStore.updateCharacter(chatData.value.id, {
        patAction: action,
        patSuffix: text
    })
    showToast('拍一拍文字已修改', 'success')
}

// 处理更换头像
const handleChangeAvatar = (url) => {
    if (!chatData.value) return
    if (!url || typeof url !== 'string') {
        showToast('无效的头像URL', 'error')
        return
    }

    // 验证图片URL是否有效
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
        let finalUrl = url;
        try {
            if (img.width !== img.height) {
                let s = Math.min(img.width, img.height);
                let c = document.createElement('canvas');
                c.width = s; c.height = s;
                c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, s, s);
                finalUrl = c.toDataURL('image/png');
            }
        } catch (e) { }
        chatStore.updateCharacter(chatData.value.id, { avatar: finalUrl })
        showToast('头像已更�?, 'success')
    }
    img.onerror = () => {
        // 图片加载失败，显示错误提�?        console.error('头像图片加载失败:', url)
        showToast('头像图片加载失败，请尝试其他图片', 'error')
    }
    img.src = url
}

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
    const targetName = msg.role === 'user' ? '�? : (chatData.value.name || '对方')
    const sourceName = '�?
    const suffix = chatData.value.patSuffix || '的头'
    const action = chatData.value.patAction || '拍了�?

    chatStore.addMessage(chatData.value.id, {
        role: 'system',
        content: `"${sourceName}" ${action} "${targetName}" ${suffix}`
    })

    // 3. Trigger AI Response (Disabled by user request)
    // if (msg.role === 'ai') {
    //     chatStore.sendMessageToAI(chatData.value.id, { hiddenHint: '[System: 拍一拍]' })
    // }
}

// Handle Avatar Long Press (@ feature in group chats)
const handleAvatarLongPress = (msg) => {
    // Only allow in group chats
    if (!chatData.value?.isGroup) return
    // Don't @ yourself
    if (msg.role === 'user') return

    // Find the member's name
    const memberId = msg.senderId || msg.userId || msg.id
    const member = chatData.value?.participants?.find(p => p.id === memberId)
    const senderName = msg.senderName || member?.name || '未知'

    // Insert into input bar
    if (chatInputBarRef.value) {
        chatInputBarRef.value.insertText(`@${senderName} `)
        chatInputBarRef.value.focus()
    }

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50)
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
const showFamilyCardSendModal = ref(false)
const showFamilyCardApplyModal = ref(false)

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
                content: `【收到来�?${chatStore.userName || '用户'} 的语音通话邀�?..】`,
                hidden: true // Keep protocol hint out of chat UI
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
                content: `【收到来�?${chatStore.userName || '用户'} 的视频通话邀�?..】`,
                hidden: true // Keep protocol hint out of chat UI
            })
            // Manually trigger the generation
            chatStore.sendMessageToAI(chatData.value.id)
        }
    } else if (type === 'timer') {
        showMissionScheduler.value = true
        showActionPanel.value = false
    } else if (type === 'vote') {
        showVoteModal.value = true
        showActionPanel.value = false
    } else if (type === 'dice') {
        showDiceModal.value = true
        showActionPanel.value = false
    } else if (type === 'tarot') {
        showTarotModal.value = true
        showActionPanel.value = false
    } else if (type === 'backpack') {
        showBackpackModal.value = true
        showActionPanel.value = false
    }
}

// Handle Dice Roll
const handleDiceRoll = (diceCount, results, total) => {
    const diceEmojis = {
        1: '⚀', 2: '�?, 3: '�?, 4: '�?, 5: '�?, 6: '�?
    }

    // 判断是否为大吉或豹子
    const maxPossible = diceCount * 6
    const isJackpot = results.every(r => r === results[0])
    const isBigWin = total >= maxPossible * 0.8

    // 根据分数确定标签和颜�?    let badge = ''
    let badgeColor = ''
    if (isJackpot) {
        badge = '豹子!'
        badgeColor = 'from-yellow-400 to-orange-400'
    } else if (isBigWin) {
        badge = '大吉!'
        badgeColor = 'from-purple-400 to-pink-400'
    } else if (total <= diceCount * 2) {
        badge = '加油!'
        badgeColor = 'from-blue-400 to-blue-500'
    }

    // Add message to chat with dice_result type
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: 'dice_result',
        content: '[摇骰子]',
        diceResults: results,
        diceTotal: total,
        diceCount: diceCount
    })

    // Scroll to bottom
    scrollToBottom(true)
    setTimeout(() => scrollToBottom(false), 100)
}

// Handle Backpack Send Card
const handleBackpackSendCard = (payload) => {
    // 1. 发送消�?    if (payload.type === 'gift') {
        const giftContent = `[GIFT:${payload.giftName}:${payload.giftQuantity}:${payload.giftNote || ''}]`
        chatStore.addMessage(chatStore.currentChatId, {
            role: 'user',
            type: 'gift',
            content: giftContent,
            giftId: payload.giftId,
            giftName: payload.giftName,
            giftImage: payload.giftImage,
            giftNote: payload.giftNote,
            giftQuantity: payload.giftQuantity,
            status: 'pending',
            senderName: settingsStore?.personalization?.userProfile?.name || '�?
        })
    } else {
        chatStore.addMessage(chatStore.currentChatId, {
            role: 'user',
            type: 'html',
            content: payload.content
        })
    }

    // 2. 从背包移除物�?    backpackStore.removeItem(payload.itemId, 1)
}

// Handle Tarot Share
const handleTarotShare = (data) => {
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: 'tarot_card',
        content: '[塔罗占卜]',
        tarotQuestion: data.question,
        tarotSpread: data.spread,
        tarotCards: data.cards
    })
    scrollToBottom(true)
}

const handleTarotInterpretationShare = (data) => {
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: 'tarot_interpretation',
        content: '[塔罗解牌]',
        tarotQuestion: data.question,
        tarotSpread: data.spread,
        tarotCards: data.cards,
        tarotInterpretation: data.interpretation
    })
    scrollToBottom(true)
}

// Handle Family Card Action Selection

const handleFamilyCardAction = (actionType) => {
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
        console.log('开始生成图�?', seeImagePrompt.value)
        // 模拟生成图片（不调用API�?        // 这里我们只是模拟生成过程，实际项目中可以替换为真实的文生图API调用
        await new Promise(resolve => setTimeout(resolve, 1000))

        // 将中文提示词转义成英文关键词
        const prompt = seeImagePrompt.value.trim()
        let englishPrompt = prompt
        // 简单的中文关键词转英文（实际项目中可使用更复杂的翻译服务）
        const chineseToEnglish = {
            '�?: 'flower',
            '玫瑰': 'rose',
            '�?: 'mountain',
            '�?: 'water',
            '天空': 'sky',
            '�?: 'tree',
            '�?: 'person',
            '�?: 'dog',
            '�?: 'cat',
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

        // 将中文提示词翻译为英�?        const translatedPrompt = await translateToEnglish(prompt)
        console.log('中文提示�?', prompt)
        console.log('翻译后的英文提示�?', translatedPrompt)

        // 使用真实的生图API生成图片
        const generatedImageUrl = await generateImage(translatedPrompt)
        console.log('生成的图片URL:', generatedImageUrl)

        // 添加到历史记�?        seeImageHistory.value.push(generatedImageUrl)
        currentHistoryIndex.value = seeImageHistory.value.length - 1
        seeImageResult.value = generatedImageUrl
        console.log('图片生成成功，历史记录长�?', seeImageHistory.value.length)

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

    // 添加图片消息到聊天界�?    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: 'image',
        content: `[图片: ${seeImagePrompt.value || '手绘�?}]`,
        image: seeImageResult.value
    })

    // 自动触发 AI 回复，让角色对图片做出评�?    setTimeout(() => {
        chatStore.sendMessageToAI(chatStore.currentChatId)
    }, 500)

    // 关闭模态框
    showSeeImageModal.value = false
    // 清空状�?    seeImagePrompt.value = ''
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
    // 清空状�?    seeImagePrompt.value = ''
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
        content: `[FAMILY_CARD:${familyCardAmount.value}:${familyCardNote.value || '亲属�?}]`
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
        showToast('请输入申请备�?, 'error')
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
const sendCount = ref(1)
const packetType = ref('lucky') // 'lucky' or 'fixed'
const coverImage = ref(null) // Local Base64
const coverImageUrl = ref('') // Remote URL

const openSendDialog = (type) => {
    sendType.value = type
    sendAmount.value = type === 'redpacket' ? '8.88' : '520'
    sendNote.value = type === 'redpacket' ? '恭喜发财，大吉大�? : '转账给您'
    coverImage.value = null
    coverImageUrl.value = ''

    // 强制单聊红包�?个普通红�?    if (!chatData.value?.isGroup && type === 'redpacket') {
        sendCount.value = 1
        packetType.value = 'fixed'
    } else {
        sendCount.value = 1
        packetType.value = 'lucky'
    }

    showSendModal.value = true
    showActionPanel.value = false
}

const confirmSend = () => {
    if (!sendAmount.value) return showToast('请输入金�?, 'warning')

    const amount = parseFloat(sendAmount.value)
    if (isNaN(amount) || amount <= 0) return showToast('请输入有效的金额', 'warning')

    // 1. Check if payment method is set
    if (!walletStore.paymentSettings?.defaultMethod) {
        return showToast('温馨提示：您尚未设置支付方式，请前往钱包设置', 'warning')
    }

    const isRP = sendType.value === 'redpacket'
    const title = isRP ? '发红�? : '转账'

    // Calculate actual total to deduct
    const actualTotalAmount = (isRP && packetType.value === 'fixed')
        ? amount * (parseInt(sendCount.value) || 1)
        : amount;

    // 2. Try to deduct
    // Currently defaults to Balance logic (can be expanded to check specific methods)
    const success = walletStore.decreaseBalance(actualTotalAmount, title)

    if (!success) {
        // Balance insufficient
        return showToast(`支付失败：余额不�?(当前余额 ¥${walletStore.balance.toFixed(2)})`, 'error')
    }

    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: sendType.value,
        content: `[${isRP ? '红包' : '转账'}] ${isRP ? (sendNote.value || '恭喜发财') : (amount + '�?)}`,
        amount: amount,
        count: isRP ? parseInt(sendCount.value) || 1 : 1,
        packetType: isRP ? packetType.value : null,
        note: sendNote.value || (isRP ? '恭喜发财，大吉大�? : '转账给您'),
        coverImage: isRP ? (coverImageUrl.value || coverImage.value) : null,
        status: 'sent' // Initial status
    })

    // Reset fields
    coverImage.value = null
    coverImageUrl.value = ''
    showSendModal.value = false
}

const applyCoverUrl = () => {
    if (!coverImageUrl.value) return
    showToast('红包封面已设�?(URL)', 'success')
}

const triggerCoverUpload = () => {
    chatStore.triggerConfirm(
        '设置红包封面',
        '请选择封面上传方式',
        () => {
            // Option: Local
            const input = document.getElementById('cover-upload-input')
            if (input) input.click()
        },
        () => {
            // Option: URL
            chatStore.triggerPrompt('输入封面URL', '请输入图片的超链接地址', 'https://...', '', (url) => {
                if (url) {
                    coverImageUrl.value = url
                    showToast('红包封面已设�?(URL)', 'success')
                }
            })
        },
        '本地图片',
        '网络URL'
    )
}

const handleCoverUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return
    compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.7 })
        .then(base64 => {
            coverImage.value = base64
            showToast('红包封面已设�?, 'success')
        })
}

const handleGiftClick = (msg) => {
    if (!chatData.value) return

    // 为弹窗添加发送者名称信�?    const displayMsg = {
        ...msg,
        senderName: msg.senderName || (msg.role === 'user' ? '�? : chatData.value.name),
        _isSender: msg.role === 'user' || msg.senderId === 'user'
    }

    giftDetailModal.value?.open(displayMsg, async () => {
        // Confirm claim logic (for AI gifts)
        const success = await chatStore.claimGift(chatData.value.id, msg.id, 'user')
        if (success) {
            showToast('�?领取成功！已存入背包', 'success')
        }
    })
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
                content: '[图片]',
                image: base64
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
                    content: '[图片]',
                    image: e.target.result
                })
                showActionPanel.value = false
                scrollToBottom()
            }
            reader.readAsDataURL(file)
        })

    // Reset input
    event.target.value = ''
}


// Old scrollToBottom removed to resolve conflict
// The robust implementation is now at the top of the file.

const closePanels = () => {
    showActionPanel.value = false
    showEmojiPicker.value = false
}

// Inner Voice Parsing
// (Function definitions moved below)

// TTS Helper - 按照气泡顺序朗读
const ttsQueue = ref([]);
const isSpeaking = ref(false);
const spokenMsgIds = new Set(); // 已朗读的消息ID，避免重复朗�?
// Sync with callStore for animations
watch(isSpeaking, (val) => {
    if (callStore.status !== 'none') {
        callStore.isSpeaking = val
    }
})

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

// --- TTS Engine Core ---  
const speakOne = async (text, onEnd, interrupt = false) => {
    if (!text) {
        if (onEnd) onEnd();
        return;
    }

    // 检查是否正在通话中，如果是则不播放TTS（避免双重语音）
    if (callStore.status === 'active' || callStore.status === 'dialing') {
        if (onEnd) onEnd();
        return;
    }

    const engine = settingsStore.voice?.engine || 'browser';

    if (engine === 'doubao') {
        const doubao = settingsStore.voice.doubao;
        // 如果没有配置 cookie，则尝试使用，但其实 volc 通道在某些环境下可能不需�?cookie
        // 这里我们优先尝试使用代理访问火山接口
        try {
            const speaker = doubao.speaker || 'tts.other.BV008_streaming';
            const response = await fetch('/volc/crx/tts/v1/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, speaker })
            });

            // 尝试解析JSON响应
            try {
                const res = await response.json();
                if (res.audio?.data) {
                    const audio = new Audio(`data:audio/mp3;base64,${res.audio.data}`);
                    audio.onended = () => {
                        isSpeaking.value = false;
                        if (onEnd) onEnd();
                    };
                    audio.onerror = () => {
                        isSpeaking.value = false;
                        if (onEnd) onEnd();
                    };
                    audio.play();
                    return;
                } else {
                    console.warn('[TTS] Doubao/Volc returned no data, falling back to browser');
                }
            } catch (jsonError) {
                // 如果返回的是HTML而不是JSON，说明需要登录豆�?                console.warn('[TTS] Doubao/Volc returned non-JSON response, falling back to browser');
            }
        } catch (e) {
            console.error('[TTS] Doubao/Volc failed:', e);
        }
    }

    // --- Browser Fallback ---
    if (!window.speechSynthesis) {
        if (onEnd) onEnd();
        return;
    }

    // Only cancel if explicitly requested (e.g. user manually clicked a new bubble)
    if (interrupt) {
        window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';

    // Choose Chinese voice if available
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.includes('zh-CN') || v.lang.includes('zh-SG'));
    if (zhVoice) utterance.voice = zhVoice;

    // Use character specific voice speed if modified, otherwise use global default (1.0)
    const charSpeed = chatStore.currentChat?.voiceSpeed
    const globalSpeed = settingsStore.voice?.speed || 1.0
    let rate = (charSpeed && charSpeed !== 1.0) ? charSpeed : globalSpeed;
    rate = parseFloat(rate);
    if (isNaN(rate) || !rate) rate = 1.0;

    utterance.rate = Math.min(Math.max(rate, 0.1), 3.0);
    utterance.pitch = 1.0;

    utterance.onend = () => {
        isSpeaking.value = false;
        if (onEnd) onEnd();
    };

    utterance.onerror = (event) => {
        if (event.error !== 'interrupted') {
            console.error('[TTS] Browser TTS Error:', event);
        }
        isSpeaking.value = false;
        if (onEnd) onEnd();
    };

    setTimeout(() => {
        window.speechSynthesis.speak(utterance);
    }, interrupt ? 50 : 0);
};

const speakMessage = (text, msgId = null, force = false) => {
    if (!text) return;
    const cleanText = getCleanSpeechText(text);
    if (!cleanText) return;

    // 检查是否正在通话中，如果是则不播放TTS（避免双重语音）
    if (callStore.status === 'active' || callStore.status === 'dialing') {
        return;
    }

    // Prevent duplicate reading of the same message in auto-mode
    if (!force && msgId && spokenMsgIds.has(msgId)) return;

    // If waiting strictly for auto-read, check queue
    console.log('[TTS] Queueing:', cleanText.substring(0, 20) + '...');
    ttsQueue.value.push({ text: cleanText, msgId });
    processQueue();
};

const processQueue = () => {
    // Only stop explicitly if call ENDED (allow 'none' for normal chat AutoTTS)
    if (callStore.status === 'ended') {
        ttsQueue.value = [];
        isSpeaking.value = false;
        return;
    }

    if (isSpeaking.value || ttsQueue.value.length === 0) return;

    isSpeaking.value = true;
    const queueItem = ttsQueue.value.shift();
    const { text, msgId } = queueItem;

    // Auto-process queue should NOT interrupt previous (queue logic handles order)
    speakOne(text, () => {
        // 标记消息为已朗读
        if (msgId) {
            spokenMsgIds.add(msgId);
        }

        // Re-check call status explicitly
        if (callStore.status === 'ended') {
            isSpeaking.value = false;
            ttsQueue.value = [];
            return;
        }

        isSpeaking.value = false;
        // Pause slightly between bubbles for natural pacing
        setTimeout(processQueue, 300);
    }, false); // interrupt = false
};

// ... (skipping context)

// MONITORING REMOVED: chatStore.js now handles call-specific TTS directly
// to avoid double-reading and ensure correct JSON extraction.




const getCleanSpeechText = (text) => {
    if (!text) return '';
    let clean = ensureString(text);

    // Precompile regex patterns for better performance
    const voiceProtocolRegex = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]|(?=\s*\n\s*\[(?!\/))|(?=\s*\n\s*\{)|$)/gi;
    const voiceClosingRegex = /\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]/gi;
    const voiceTagRegex = /\[语音(?:消息)?[:：]?\s*(.*?)\]/gi;
    const drawTagRegex = /\[DRAW:[\s\S]*?\]/gi;
    const protocolTagsRegex = /\[(图片|表情|表情包|红包|转账|CARD|MOMENT|SET_|NUDGE|HTML卡片|领取红包|RECEIVE_RED_PACKET)[:：]?.*?\]/gi;
    const momentTagsRegex = /\[(LIKE|COMMENT|REPLY)[:：]\s*[^\]]+\]/gi;
    const jsonBlocksRegex = /\{[\s\n]*"(?:type|着装|环境|status|心声|心心声|行为|mind|outfit|scene|action|thoughts|mood|state|stats|reasoning_content|metadata|html)"[\s\S]*?\}/gi;
    const statsTextRegex = /stats[:：]?\s*\{[\s\S]*?\}/gi;
    const statsCardRegex = /stats[:：]?\s*[\d.km\s]+心声卡片/gi;
    const drawErrorRegex = /\(绘画失败[:：].*?\)/gi;
    const drawingRegex = /🎨\s*正在.*?(绘图|成图�?.*/gi;
    const markdownHeadersRegex = /#+\s/g;
    const markdownFormattingRegex = /[*_~`]/g;
    const markdownLinksRegex = /\[(.*?)\]\(.*?\)/g;
    const htmlTagsRegex = /<[^>]*>/g;
    const parenthesesRegex = /[\(（][^\)）]*[\)）]/g;
    const zeroWidthRegex = /[\u200b\u200c\u200d\ufeff]/g;

    // 1. Remove Inner Voice Protocol
    clean = clean.replace(voiceProtocolRegex, '');
    clean = clean.replace(voiceClosingRegex, ''); // Scrub stray closing tags too

    // 2. Extract content from voice tags instead of deleting them entirely
    clean = clean.replace(voiceTagRegex, '$1');

    // 3. Remove other non-speech Protocol Tags
    clean = clean.replace(drawTagRegex, ''); // Distinctly remove DRAW tags first
    clean = clean.replace(protocolTagsRegex, '');

    // 5. Remove Moment Interaction tags
    clean = clean.replace(momentTagsRegex, '');

    // 6. Remove JSON blocks (robust match for metadata)
    clean = clean.replace(jsonBlocksRegex, '');

    // 6.5 Remove system status / stats text (fallback)
    clean = clean.replace(statsTextRegex, '');
    clean = clean.replace(statsCardRegex, '');
    clean = clean.replace(drawErrorRegex, '');
    clean = clean.replace(drawingRegex, '');

    // 7. Remove Markdown Formatting
    clean = clean.replace(markdownHeadersRegex, ''); // Headers
    clean = clean.replace(markdownFormattingRegex, ''); // Bold, italic, etc.
    clean = clean.replace(markdownLinksRegex, '$1'); // Links [text](url) -> text

    // 9. Remove HTML tags
    clean = clean.replace(htmlTagsRegex, '');

    // 8. Remove content in parentheses (CN/EN) - e.g. (laughs), （笑�?    // Using non-greedy match for content inside
    clean = clean.replace(parenthesesRegex, '');

    // 9. Final Clean up
    clean = clean.replace(zeroWidthRegex, ''); // Zero-width characters
    // Decode HTML entities (basic ones) to avoid reading "&nbsp;" literally
    clean = clean.replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');

    return clean.trim();

}



// --- Action Handlers ---


// --- Effects Configuration (Moved to top) ---
const effectTypes = [
    { id: 'bamboo', name: '🎋 听竹', color: '120, 160, 120', type: 'sway_fall' },
    { id: 'sakura', name: '🌸 落樱', color: '255, 200, 210', type: 'sway_fall' },
    { id: 'snow', name: '❄️ 寒雪', color: '220, 220, 230', type: 'sway_fall' },
    { id: 'rain', name: '🌧�?潇潇夜雨', color: '150, 180, 210', type: 'rain' },
    { id: 'storm', name: '�?深夜惊雷', color: '180, 200, 220', type: 'rain_storm' },
    { id: 'fireworks', name: '🎆 线香花火', color: '255, 215, 0', type: 'burst' },
    { id: 'meteor', name: '🌠 星陨', color: '255, 255, 255', type: 'meteor' },
    { id: 'embers', name: '🔥 余烬', color: '255, 100, 50', type: 'float_up_fade' },
    { id: 'gold', name: '�?流金', color: '212, 175, 55', type: 'flow_up' },
    { id: 'firefly', name: '🦋 流萤', color: '160, 255, 160', type: 'wander' }
];
const currentEffect = ref(effectTypes[8]);
const currentEffectIndex = ref(8);

// --- Modal Logic ---
const parseInnerVoice = (text) => {
    if (!text) return null
    let content = text
    const voiceRegex = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|红包|转账|表情包|图片|SET_|NUDGE))|$)/i
    const match = String(text).match(voiceRegex)
    if (match) {
        content = match[1]
    }

    try {
        let jsonStr = String(content).replace(/```json/gi, '').replace(/```/g, '').trim()
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) jsonStr = jsonMatch[0]

        let result = null
        try {
            result = JSON.parse(jsonStr)
        } catch (e) {
            let fixed = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
            fixed = fixed.replace(/[“”]/g, '"')
            try { result = JSON.parse(fixed) } catch (e2) { }
        }

        if (result) {
            const getString = (val) => {
                if (!val) return ''
                if (typeof val === 'string') return val.trim()
                return (val.想法 || val.content || val.thought || val.mind || JSON.stringify(val)).trim()
            }
            let target = result
            if (result.content && typeof result.content === 'object') target = result.content
            if (target["心声"]) {
                const inner = target["心声"]
                return {
                    clothes: getString(target["着�?] || target.outfit || inner.着�?,
                    scene: getString(target["环境"] || target.scene || inner.环境),
                    mind: getString(inner.想法 || inner.心情 || inner.content || inner.thought),
                    action: getString(inner.行为 || target["行为"] || target.action)
                }
            }
            return {
                clothes: getString(target["着�?] || target.clothes || target.outfit),
                scene: getString(target["环境"] || target.scene || target.environment),
                mind: getString(target["心声"] || target.mind || target.thought || target.thoughts),
                action: getString(target["行为"] || target.action || target.behavior)
            }
        }
    } catch (e) { }
    return null
}

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
                    timestamp: msg.timestamp || Date.now(),
                    data: voiceData,
                    preview: voiceData.mind || '...'
                });
            }
        }
    });
    return list.reverse();
});

const toggleVoiceHistory = () => {
    showHistoryList.value = !showHistoryList.value;
}

const loadHistoryItem = (item) => {
    currentInnerVoice.value = { ...item.data, id: item.id };
    const randomIdx = Math.floor(Math.random() * effectTypes.length);
    currentEffectIndex.value = randomIdx;
    currentEffect.value = effectTypes[randomIdx];
    showHistoryList.value = false;
}

const openInnerVoiceModal = () => {
    showHistoryList.value = false;
    const randomIdx = Math.floor(Math.random() * effectTypes.length);
    currentEffectIndex.value = randomIdx;
    currentEffect.value = effectTypes[randomIdx];

    const rawMsgs = msgs.value
    let foundMsg = null
    const voiceTagRegex = /\[\s*INNER[\s-_]*VOICE\s*\]/i;

    for (let i = rawMsgs.length - 1; i >= 0; i--) {
        const m = rawMsgs[i]
        if (m.role === 'ai' && m.content) {
            const hasTag = voiceTagRegex.test(m.content);
            const hasJson = m.content.includes('{') && (m.content.includes('"status"') || m.content.includes('"心声"'));
            if (hasTag || hasJson) {
                foundMsg = m
                break
            }
        }
    }

    if (foundMsg) {
        const data = parseInnerVoice(foundMsg.content);
        currentInnerVoiceMsgId.value = foundMsg.id;
        if (data) {
            currentInnerVoice.value = { ...data, id: foundMsg.id };
        } else {
            currentInnerVoice.value = { id: foundMsg.id };
        }
    } else {
        currentInnerVoice.value = null;
        currentInnerVoiceMsgId.value = null;
    }
    showInnerVoiceModal.value = true
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

// NEW: Unified Draw Command Handler for Chat
const handleDrawCommandInChat = async (msgId, prompt) => {
    console.log('[ChatWindow] DRAW command triggered:', prompt);
    const chatId = chatStore.currentChatId;
    if (!chatId) return;

    try {
        // 1. Generate Image
        const imageUrl = await generateImage(prompt);
        if (!imageUrl) throw new Error('生图返回为空');

        // 2. Update message content in Store (Standard UI Update)
        chatStore.updateMessage(chatId, msgId, {
            type: 'image',
            image: imageUrl,
            content: `[图片: ${prompt}]`
        });

        // 3. WORLD LOOP SYNC: If this chat belongs to a Loop, update the Loop background!
        if (chatData.value?.loopId) {
            console.log('[WorldLoop] Updating scene background for loop:', chatData.value.loopId);
            worldLoopStore.updateLoop(chatData.value.loopId, {
                currentScene: {
                    image: imageUrl,
                    description: prompt
                }
            });
        }
    } catch (err) {
        console.error('[ChatWindow] DRAW failed:', err);
        chatStore.updateMessage(chatId, msgId, {
            type: 'text',
            content: `(绘画失败: ${err.message})`
        });
    }
};

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
    // Use true for instant scroll when sending, providing immediate feedback
    scrollToBottom(true)
    // Double check after a short delay for any rendering shifts
    setTimeout(() => scrollToBottom(false), 100)
}




const generateAIResponse = () => {
    // Manually trigger AI generation based on current context.
    // If the chat is empty or the last message already comes from the AI,
    // we want to keep the conversation going even though the user didn't
    // send a new message.  Pass a hiddenHint so the model treats it as a
    // continuation request rather than ending the story.
    const options = {}
    const chat = chatStore.chats[chatStore.currentChatId]
    if (chat) {
        const last = (chat.msgs || []).slice(-1)[0]
        // no user message yet or last was AI message -> continue
        if (!last || last.role === 'ai') {
            options.hiddenHint = '（用户未输入，继续剧情…）'
        }
    }
    chatStore.sendMessageToAI(chatStore.currentChatId, options)
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

    const shichenList = ['�?, '�?, '�?, '�?, '�?, '�?, '�?, '�?, '�?, '�?, '�?, '�?]
    let scIdx = Math.floor(((hours + 1) % 24) / 2)
    const shichen = shichenList[scIdx]

    let minsIntoSc = ((hours % 2 === 0 ? 1 : 0) * 60 + minutes + 60) % 120
    let ke = Math.floor(minsIntoSc / 15) + 1
    const keChinese = ['', '一', '�?, '�?, '�?, '�?, '�?, '�?, '�?]
    return `${shichen}�?{keChinese[ke]}刻`
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
    if (isOpening.value || !currentRedPacket.value) return

    currentRedPacket.value.isRejected = true
    showResult.value = true

    const chat = chatStore.chats[chatStore.currentChatId]
    const msg = chat.msgs.find(m => m.id === currentRedPacket.value.id)
    if (msg) {
        msg.isRejected = true
        msg.rejectTime = Date.now()
        // In group chats, use the sender info from the message itself
        const senderName = msg.senderName || chat.remark || chat.name || '对方'
        const typeStr = (msg.type === 'transfer' || msg.content.includes('转账')) ? '转账' : '红包'
        chatStore.addMessage(chat.id, {
            role: 'system',
            content: `你拒收了${senderName}�?{typeStr}`
        })
        chatStore.saveChats()
    }
}

const openRedPacket = async () => {
    if (isOpening.value || !currentRedPacket.value) return
    isOpening.value = true

    const result = await chatStore.claimRedPacket(chatStore.currentChatId, currentRedPacket.value.id, 'user')

    setTimeout(() => {
        isOpening.value = false
        if (result && result.claimed) {
            showResult.value = true
            resultAmount.value = result.amount
        } else if (result && result.already) {
            showResult.value = true
            resultAmount.value = result.item.amount
        } else if (result && result.empty) {
            showToast('手慢了，红包派完�?, 'info')
            showResult.value = true
        } else {
            showToast('领取失败', 'error')
        }
    }, 1200)
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
        // 展开时开始朗�?        msg.isPlaying = true
        const duration = (msg.duration || Math.ceil(ensureString(msg.content).length / 3) || 1) * 1000

        if (msg.role === 'ai') {
            const text = getCleanSpeechText(msg.content)
            // Force play -> This will now respect the logic in speakOne to optionally cancel
            // For manual click, we generally WANT to interrupt whatever is auto-playing.
            // So we can clear the queue and force this one.
            window.speechSynthesis.cancel();
            ttsQueue.value = []; // Clear auto queue

            // Re-queue this specific message
            console.log('[TTS] Manual Trigger:', msg.id);
            speakOne(text, () => {
                msg.isPlaying = false;
            }, true); // interrupt = true

            // 确保设置isPlayed为true并更新到聊天存储
            msg.isPlayed = true;
            chatStore.updateMessage(chatData.value.id, msg.id, { isPlayed: true });
        } else {
            // User voice fallback
            showToast('暂不支持播放用户语音', 'info')
        }
    } else {
        // 关闭时停止朗�?        msg.isPlaying = false
        // 取消当前的TTS播放
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel()
        }
    }
}

const handlePayClick = (msg) => {
    const content = ensureString(msg.content)

    // Determine initial view state
    const isRedPacket = msg.type === 'redpacket'
    const hasMyClaim = msg.claims?.some(c => c.id === 'user')
    const isFinished = isRedPacket ? (msg.remainingCount === 0) : msg.isClaimed

    let shouldShowDetail = isFinished || msg.isRejected || msg.status === 'received' || hasMyClaim

    // Special Check: If it's a group chat and I haven't claimed it yet, I should see the "Open" view
    // even if others have claimed some (as long as remainingCount > 0)
    if (chatData.value?.isGroup && isRedPacket && !hasMyClaim && msg.remainingCount > 0) {
        shouldShowDetail = false
    }

    // For private chat, if I am the sender, show detail view (to see status)
    if (!chatData.value?.isGroup && (msg.role === 'user' || msg.senderId === 'user')) {
        shouldShowDetail = true
    }

    showResult.value = !!shouldShowDetail

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

    // 4. Extraction from tag [图片:URL] or [表情�?名称]
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
        .replace(/\[MOMENT_SHARE:[^\]]+\]|\[分享朋友�?[^\]]+\]/gi, '') // Remove Moment Tags
        .replace(/\[一起听�?[^\]]+\]|\[停止听歌\]|<bgm>[\s\S]*?<\/bgm>/gi, '') // Remove Music Tags
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
            .replace(/[�?�?�?�?\-\s\(\)（）]/g, '')
            .toLowerCase()
            .trim();

        const nClean = normalize(n);
        if (!nClean && !n) return match;

        // FIX: Prevent sentences or system logs like [正在通话...] from being matched as stickers
        if (nClean.length > 15) return match;

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
            return `<img src="${found.url}" onerror="this.src='/broken-image.png'" class="w-16 h-16 inline-block mx-1 align-middle" alt="${found.name}" />`
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

const playMessageTTS = (text) => {
    if (!text) return

    // 检查是否正在通话中，如果是则不播放TTS（避免双重语音）
    if (callStore.status === 'active' || callStore.status === 'dialing') {
        return;
    }

    const cleanText = getCleanSpeechText(text).replace(/\[.*?\]/g, '')
    if (!cleanText.trim()) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanText)

    // Antigravity Fix: Apply character speed with global fallback
    const charSpeed = chatStore.currentChat?.voiceSpeed
    const globalSpeed = settingsStore.voice?.speed || 1.0
    let rate = (charSpeed && charSpeed !== 1.0) ? charSpeed : globalSpeed;
    rate = parseFloat(rate);
    if (isNaN(rate) || !rate) rate = 1.0;
    utterance.rate = Math.min(Math.max(rate, 0.1), 3.0);

    console.log('[TTS] playMessageTTS rate:', utterance.rate, 'Origin:', charSpeed);

    utterance.lang = 'zh-CN'
    window.speechSynthesis.speak(utterance)
}

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
            playMessageTTS(selectedMsg.value.content)
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
                const senderName = msgs.value[idx].role === 'user' ? '�? : (chatData.value.name || '对方')
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
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '​​​​​​�?, '😩', '🤯', '😬', '​​​​​​�?, '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🤠', '🤡', '🥳', '🥴', '🥺', '🤥', '🤫', '🤭', '🧐', '🤓'
];

const handleEmojiSelect = (emoji) => {
    chatInputBarRef.value?.insertText(emoji)
};

const handleStickerSelect = (sticker) => {
    // Send as Sticker Tag (Same as AI)
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: 'sticker',
        content: `[表情�? ${sticker.name || '表情'}]`,
        image: sticker.url
    });
    showEmojiPicker.value = false;
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
        remark: cardName || '亲属�?,
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

// Family Card Global Handler
window.qiaoqiao_receiveFamilyCard = (uuid, amount, note, fromCharId) => {
    const charName = chatStore.chats[fromCharId]?.name || '亲属'
    claimModalRef.value?.open({ uuid, amount, note, fromCharId }, `${charName}的亲属卡`)
}

