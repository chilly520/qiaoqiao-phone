<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '../../stores/chatStore'
import { useWalletStore } from '../../stores/walletStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useStickerStore } from '../../stores/stickerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useMusicStore } from '../../stores/musicStore'

import ChatActionPanel from './ChatActionPanel.vue'
import ChatDetailSettings from './ChatDetailSettings.vue'
import MusicPlayer from '../../components/MusicPlayer.vue'
import EmojiPicker from './EmojiPicker.vue'
import ChatEditModal from './ChatEditModal.vue'
import ChatHistoryModal from './ChatHistoryModal.vue'

import SafeHtmlCard from '../../components/SafeHtmlCard.vue'
import MomentShareCard from '../../components/MomentShareCard.vue'
import { marked } from 'marked'
import { compressImage } from '../../utils/imageUtils'
import { generateImage } from '../../utils/aiService'

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

const route = useRoute()

// Input and Voice Mode
const inputVal = ref('')
const textareaRef = ref(null)
const isVoiceMode = ref(false)

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
onMounted(() => {
    window.addEventListener('popstate', handleSettingsPopState)
})
onUnmounted(() => {
    window.removeEventListener('popstate', handleSettingsPopState)
    // Abort AI if leaving the chat to save resources and prevent background errors
    // Use silent=true to avoid showing "已中断生成" toast when navigating away
    chatStore.stopGeneration(true)
})

// ===== 优化后的分页逻辑 =====
// 使用 chatStore 的全局分页管理

const displayedMsgs = computed(() => {
    if (!chatStore.currentChatId) return []
    return chatStore.getDisplayedMessages(chatStore.currentChatId)
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
    alert('已收藏')
}

// Multi-select State
const isMultiSelectMode = ref(false)
const selectedMsgIds = ref(new Set())

const toggleMessageSelection = (msgId) => {
    if (selectedMsgIds.value.has(msgId)) {
        selectedMsgIds.value.delete(msgId)
    } else {
        selectedMsgIds.value.add(msgId)
    }
}

const exitMultiSelectMode = () => {
    isMultiSelectMode.value = false
    selectedMsgIds.value.clear()
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
    msgs.value.forEach(msg => {
        if (selectedMsgIds.value.has(msg.id)) {
            const avatarUrl = msg.role === 'user'
                ? (settingsStore.personalization.userProfile.avatar || '/avatars/user.png')
                : (chatData.value.avatar || '/avatars/default.png')
            favoritesStore.addFavorite(msg, chatName, avatarUrl)
        }
    })

    alert(`成功收藏 ${selectedMsgIds.value.size} 条消息`)
    exitMultiSelectMode()
}

const showSystemMsgDetail = (msg) => {
    if (msg.realContent) {
        // Show as Toast or temporary overlay
        alert(`撤回的内容:\n\n${msg.realContent}`)
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
    if (data && data.type === 'QIAOQIAO_CARD_ACTION') {
        console.log('[Card Action]', data)

        if (data.action === 'SEND_TEXT') {
            // Validating inputs
            if (!data.content || typeof data.content !== 'string') return

            // Send as User
            chatStore.addMessage(chatData.value.id, {
                role: 'user',
                content: data.content
            })

            // Trigger AI processing if requested
            if (data.autoReply) {
                setTimeout(() => {
                    generateAIResponse()
                }, 500)
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
        }
    }
})

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

const handlePat = (msg) => {
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

const handlePanelAction = (type) => {
    if (type === 'album') {
        imgUploadInput.value.click()
    } else if (type === 'camera') {
        alert('暂不支持拍摄')
    } else if (type === 'redpacket') {
        openSendDialog('redpacket')
    } else if (type === 'transfer') {
        openSendDialog('transfer')
    }
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
    if (!sendAmount.value) return alert('请输入金额')

    const isRP = sendType.value === 'redpacket'
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: sendType.value,
        content: `[${isRP ? '红包' : '转账'}] ${isRP ? (sendNote.value || '恭喜发财') : (sendAmount.value + '元')}`,
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
        alert('图片太大 (限制10MB)')
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

// TTS Helper
const ttsQueue = ref([]);
const isSpeaking = ref(false);

// Toast System
const toastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref('info');
let toastTimer = null;

const showToast = (msg, type = 'info') => {
    toastMessage.value = msg;
    toastType.value = type;
    toastVisible.value = true;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastVisible.value = false;
    }, 3000);
};

watch(() => chatStore.toastEvent, (newVal) => {
    if (newVal) {
        showToast(newVal.message, newVal.type);
    }
});

const processQueue = () => {
    if (isSpeaking.value || ttsQueue.value.length === 0) return;

    isSpeaking.value = true;
    const text = ttsQueue.value.shift();

    speakOne(text, () => {
        isSpeaking.value = false;
        // Pause slightly between bubbles
        setTimeout(processQueue, 500);
    });
};

const speakOne = (text, onEnd) => {
    if (!text) return onEnd?.();
    if (!window.speechSynthesis) return onEnd?.();

    // Clean text: remove inner voice, claim tags
    let cleanText = getCleanContent(text);
    // Filter out content in parentheses (actions, environments)
    cleanText = cleanText.replace(/[（(][^）)]*[）)]/g, '').trim();

    if (!cleanText) return onEnd?.();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-CN';

    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
};

const speakMessage = (text) => {
    if (!text) return;
    ttsQueue.value.push(text);
    processQueue();
}

watch(() => chatStore.isTyping, (newVal) => {
    if (newVal) {
        // Give it a tiny delay for the "Typing..." div to render
        setTimeout(() => scrollToBottom(), 50);
    }
})

watch(msgs, (newVal, oldVal) => {
    if (newVal.length > (oldVal?.length || 0)) {
        scrollToBottom()
    }

    // Auto TTS Logic
    if (chatData.value?.autoTTS) {
        // Find NEW messages from AI
        const oldMsgIds = new Set(oldVal?.map(m => m.id) || []);
        const newAiMsgs = newVal.filter(m => m.role === 'ai' && !oldMsgIds.has(m.id));

        if (newAiMsgs.length > 0) {
            // Sort by timestamp just in case
            newAiMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            newAiMsgs.forEach(msg => {
                speakMessage(msg.content);
            });
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
        // Relaxed regex matches up to [/INNER_VOICE] or end of string
        const match = content.match(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/i);
        if (match && match[1]) {
            let jsonStr = match[1].trim();
            // Fix Markdown blocks
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
            // Fix Chinese quotes for keys and values (Crucial Fix)
            jsonStr = jsonStr.replace(/[“”]/g, '"');

            // Try Parsing
            rawObj = JSON.parse(jsonStr);
        }
    } catch (e) {
        // Fallback: Regex extraction
        try {
            const match = content.match(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/i);
            if (match && match[1]) {
                const innerText = match[1];
                const cleanText = (regexp) => {
                    const m = innerText.match(regexp);
                    // m[1] is the key, m[2] is the value
                    return m ? m[2] : null;
                }

                // Regex extracting Chinese or English keys
                const mind = cleanText(/"(mind|thoughts|想法|心声)"\s*[:：]\s*["“]([^"”]*)[”"]/i);
                const outfit = cleanText(/"(outfit|clothes|着装)"\s*[:：]\s*["“]([^"”]*)[”"]/i);
                const scene = cleanText(/"(scene|environment|环境)"\s*[:：]\s*["“]([^"”]*)[”"]/i);
                const action = cleanText(/"(action|behavior|行为)"\s*[:：]\s*["“]([^"”]*)[”"]/i);

                if (mind || outfit || scene) {
                    rawObj = { mind, outfit, scene, action };
                }
            }
        } catch (err) { }
    }

    if (rawObj) {
        // Normalize Chinese Keys to English for Template AND Clean format
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

const getCleanContent = (contentRaw) => {
    if (!contentRaw) return '';
    const content = ensureString(contentRaw);

    // CRITICAL: Performance shortcut for massive image/base64 data
    if (content.length > 300) {
        // If it's a data URL or blob, it's definitely an image, don't regex it
        if (content.includes('data:image/') || content.includes('blob:')) return '';
        // If it's just long text, still skip heavy regex if no voice marker
        if (!content.includes('[INNER_VOICE]')) return content.trim();
    }

    // Remove Inner Voice block
    let clean = content.replace(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi, '').trim();
    // Remove Claim Tags
    clean = clean.replace(/\[(领取红包|RECEIVE_RED_PACKET)\]/gi, '').trim();
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
    console.log('[DEBUG] Opening Inner Voice Modal');
    // Reset view state
    showHistoryList.value = false;

    // Find the last AI message with Inner Voice (Scan backwards)
    const reversedMsgs = [...msgs.value].reverse();
    const lastAiMsg = reversedMsgs.find(m => m.role === 'ai' && parseInnerVoice(m.content));

    if (lastAiMsg) {
        const data = parseInnerVoice(lastAiMsg.content);
        if (data) {
            currentInnerVoice.value = { ...data, id: lastAiMsg.id };
        }
    } else {
        // Retry: Look deeper or check raw content
        currentInnerVoice.value = null;
    }

    // Initialize Effects (Randomize)
    const randomIdx = Math.floor(Math.random() * effectTypes.length);
    currentEffectIndex.value = randomIdx;
    currentEffect.value = effectTypes[randomIdx];

    showInnerVoiceModal.value = true

    // Initialize Canvas
    nextTick(() => {
        initVoiceCanvas();
    });
}

const closeInnerVoiceModal = () => {
    showInnerVoiceModal.value = false
}

const handleAutoResize = () => {
    if (!textareaRef.value) return
    textareaRef.value.style.height = 'auto'
    const scrollHeight = textareaRef.value.scrollHeight
    textareaRef.value.style.height = Math.min(scrollHeight, 66) + 'px'
}

const sendUserMessage = async () => {
    if (!inputVal.value.trim() && !imgUploadInput.value?.files?.length) return

    // Send Message
    const chatId = chatStore.currentChatId
    if (inputVal.value.trim()) {
        const content = inputVal.value.trim()

        if (isVoiceMode.value) {
            // Send as Voice
            chatStore.addMessage(chatId, {
                role: 'user',
                type: 'voice',
                content: content,
                duration: Math.ceil(content.length / 3) || 1,
                quote: currentQuote.value
            })
        } else {
            // Send as Text
            let content = inputVal.value.trim()

            // INTERCEPT: Draw Command
            if (content.toLowerCase().startsWith('/draw ')) {
                const prompt = content.substring(6).trim()
                content = `[DRAW: ${prompt}]`
            }

            chatStore.addMessage(chatId, {
                role: 'user',
                content: content,
                quote: currentQuote.value
            })
        }

        currentQuote.value = null
        inputVal.value = ''
        nextTick(() => {
            if (textareaRef.value) {
                textareaRef.value.style.height = 'auto'
            }
            scrollToBottom()
        })

        // Manual Trigger Only
    }
}

// Toggle Voice Mode
const toggleVoiceMode = () => {
    isVoiceMode.value = !isVoiceMode.value
    showToast(isVoiceMode.value ? '已切换到语音模式' : '已切换到文字模式', 'info')
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
const showRedPacketModal = ref(false)
const showTransferModal = ref(false)
const currentRedPacket = ref(null)
const isOpening = ref(false)
const showResult = ref(false)
const resultAmount = ref(0)

const handlePayClick = (msg) => {
    currentRedPacket.value = msg

    // User Sent Message: View Details Only
    if (msg.role === 'user') {
        if (msg.type === 'transfer' || msg.content.includes('[转账]')) {
            // For transfer, usually just show "Transferred" state. 
            // We can reuse transfer modal but hide "Confirm" button? 
            // Or simpler: Reuse Red Packet Result view for "Details"
            showRedPacketModal.value = true
            showResult.value = true
            resultAmount.value = msg.amount
            isOpening.value = false
        } else {
            // Red Packet
            showRedPacketModal.value = true
            showResult.value = true
            resultAmount.value = msg.amount
            isOpening.value = false
        }
        return
    }

    // Unified check
    if (msg.isClaimed || msg.isRejected) {
        // Already processed -> Show Details
        if (msg.type === 'transfer' || msg.content.includes('转账')) {
            showTransferModal.value = true // Reuse transfer modal for details
        } else {
            showRedPacketModal.value = true
            showResult.value = true
            isOpening.value = false
            resultAmount.value = msg.amount
        }
        return
    }

    // New AI Message -> Open Logic
    // Only parse if specific type or content match
    const isRedPacket = msg.type === 'redpacket' || msg.content.includes('[发红包')
    const isTransfer = msg.type === 'transfer' || msg.content.includes('[转账')

    if (isRedPacket) {
        showRedPacketModal.value = true
        showResult.value = false
        isOpening.value = false
        resultAmount.value = msg.amount
    } else if (isTransfer) {
        showTransferModal.value = true
    }
}

const updateMessageState = (updates) => {
    if (!currentRedPacket.value) return
    const newMsg = { ...currentRedPacket.value, ...updates }
    chatStore.updateMessage(chatStore.currentChatId, currentRedPacket.value.id, newMsg) // Ensure updateMessage supports object
    // Or direct mutation if store allows reference (store usually reactive deep)
    currentRedPacket.value = newMsg
}

// Confirm Transfer Receipt
const confirmTransfer = () => {
    const amount = parseFloat(currentRedPacket.value.amount || 0)
    walletStore.addBalance(amount, `收到转账: ${currentRedPacket.value.note || ''}`)

    // Update State
    currentRedPacket.value.isClaimed = true
    currentRedPacket.value.claimTime = Date.now()
    currentRedPacket.value.claimedBy = { name: '我', avatar: '' }

    // Sync to original message in chatStore
    const chat = chatStore.chats[chatStore.currentChatId]
    const msg = chat.msgs.find(m => m.id === currentRedPacket.value.id)
    if (msg) {
        msg.isClaimed = true
        msg.claimTime = Date.now()

        // Add System Message: "UserName confirmed receipt of xx's transfer"
        const senderName = chat.remark || chat.name || '对方'
        const userName = chat.userName || '你'
        chatStore.addMessage(chat.id, {
            role: 'system',
            content: `${userName}已领取了${senderName}的转账`
        })

        chatStore.saveChats()
    }

    // Close modal
    showTransferModal.value = false
}


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

const formatTimelineTime = (timestamp) => {
    const now = new Date()
    const date = new Date(timestamp)

    // Modern display for timeline
    const isToday = now.toDateString() === date.toDateString()
    const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString()

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    if (isToday) return timeStr
    if (isYesterday) return `昨天 ${timeStr}`

    const isThisYear = now.getFullYear() === date.getFullYear()
    if (isThisYear) {
        return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
    }

    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${timeStr}`
}

const handleVoiceClick = (msg) => {
    // 1. Toggle Transcript
    msg.showTranscript = !msg.showTranscript

    // 2. Play Animation Logic
    msg.isPlaying = true
    const duration = getDuration(msg) * 1000

    // 3. TTS if AI
    if (msg.role === 'ai' && chatData.value.autoTTS) {
        speakMessage(msg.content)
        msg.isPlayed = true
    }

    // Auto stop animation
    setTimeout(() => {
        msg.isPlaying = false
    }, duration)
}

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
            inputVal.value = transcript
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
        walletStore.addBalance(amount, `领取红包: ${currentRedPacket.value.note || ''}`)

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



// Helper methods for Rich Messages
const shouldShowTimeDivider = (currentMsg, prevMsg) => {
    if (!prevMsg) return true // First message in list should show time
    const diff = currentMsg.timestamp - prevMsg.timestamp
    return diff > 5 * 60 * 1000 // 5 minutes in ms
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
    return /\[(?:图片|IMAGE|表情包|STICKER)[:：].*?\]/i.test(clean)
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
    const match = clean.match(/\[(?:图片|IMAGE|表情包|STICKER)[:：](.*?)\]/i)
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
        .replace(/\[Image Reference ID:.*?\]/g, '') // Remove ID tags
        .replace(/Here is the original image:/gi, '') // Remove AI parroting
        .trim();

    // 2. Render [DRAW:...] as loading indicator
    // IF the message is explicitly marked as drawing, show the loader.
    // IF it's finished (isDrawing === false), hide the loader even if tag remains.
    if (msg.isDrawing !== false && text.toLowerCase().includes('[draw:')) {
        text = text.replace(/\[DRAW:\s*([\s\S]*?)\]/gi, (match, prompt) => {
            const truncated = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt
            return `<div class="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 my-1">
                <i class="fa-solid fa-spinner fa-spin text-blue-500"></i>
                <span class="text-sm text-blue-700">正在绘制: ${truncated}</span>
            </div>`
        })
    }

    // ... (rest of implementation)
    text = text.replace(/\[表情包[:：](.*?)\]/g, (match, name) => {
        const n = name.trim()
        const charStickers = chatData.value?.emojis || []
        const charMatch = charStickers.find(s => s.name === n)
        if (charMatch) return `<img src="${charMatch.url}" class="w-16 h-16 inline-block mx-1 align-middle" alt="${n}" />`
        const globalStickers = stickerStore.getStickers('global')
        const globalMatch = globalStickers.find(s => s.name === n)
        if (globalMatch) return `<img src="${globalMatch.url}" class="w-16 h-16 inline-block mx-1 align-middle" alt="${n}" />`
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

const getPayTitle = (msg) => {
    if (!msg) return ''
    const content = ensureString(msg.content)
    if (msg.type === 'transfer' || content.includes('[转账]')) return `¥${msg.amount || '520.00'}`
    return msg.note || '恭喜发财，大吉大利'
}

const getPayDesc = (msg) => {
    if (!msg) return ''
    const content = ensureString(msg.content)
    if (msg.type === 'transfer' || content.includes('[转账]')) return msg.note || '转账给您'
    return '领取红包'
}

const getPayStatusText = (msg) => {
    if (msg.isRejected) return '已拒收'
    const content = ensureString(msg.content)
    if (msg.isClaimed || msg.status === 'received') {
        const isTransfer = msg.type === 'transfer' || content.includes('[转账]')
        return isTransfer ? '已收款' : '已领取'
    }
    if (msg.type === 'transfer' || content.includes('[转账]')) return '微信转账'
    return '微信红包'
}


const parseBubbleCss = (cssString) => {
    if (!cssString || typeof cssString !== 'string') return {}
    const style = {}
    cssString.split(';').forEach(rule => {
        const trimmed = rule.trim()
        if (!trimmed) return
        const parts = trimmed.split(':')
        if (parts.length >= 2) {
            // Convert kebab-case to camelCase
            const key = parts[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase())
            const value = parts.slice(1).join(':').trim()
            if (key && value) style[key] = value
        }
    })
    return style
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
    // Prevent browser menu
    // Debug
    // console.log('Context Menu Triggered', msg.id)

    // Position
    let x = event.clientX
    let y = event.clientY

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
    longPressTimer = setTimeout(() => {
        // Trigger generic handler
        const touch = event.touches ? event.touches[0] : event;
        handleContextMenu(msg, touch)

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
    inputVal.value += emoji;
    // Keep picker open or close? Typically keep open for multiple
    // Focus back
    nextTick(() => {
        const el = document.querySelector('textarea');
        if (el) el.focus();
    });
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
let animationFrameId = null;

// Original 10 Effect Types (Moved to top)
// const effectTypes = [...];
// const currentEffect = ...;
// const currentEffectIndex = ...;

const initVoiceCanvas = () => {
    voiceCanvas = voiceCanvasRef.value;
    if (!voiceCanvas) {
        voiceCanvas = document.getElementById('voice-effect-canvas');
        if (!voiceCanvas) return;
    }
    voiceCtx = voiceCanvas.getContext('2d');

    const resize = () => {
        if (voiceCanvas && voiceCanvas.parentElement) {
            voiceCanvas.width = voiceCanvas.parentElement.clientWidth;
            voiceCanvas.height = voiceCanvas.parentElement.clientHeight;
        }
    };
    window.removeEventListener('resize', resize);
    window.addEventListener('resize', resize);
    resize();

    startAnimation();
};

const startAnimation = () => {
    if (!voiceCanvas || !voiceCtx) return;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    const width = voiceCanvas.width;
    const height = voiceCanvas.height;
    let particles = [];
    let lastLaunch = 0;

    class Particle {
        constructor(typeOverride, startX, startY) {
            this.init(typeOverride, startX, startY);
        }
        init(typeOverride, startX, startY) {
            const effect = currentEffect.value;
            if (typeOverride === 'burst') {
                this.isBurst = true;
                this.x = startX; this.y = startY;
                this.prevX = this.x; this.prevY = this.y;
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 1.5 + 0.5;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.gravity = 0.03; this.drag = 0.96;
                this.alpha = 1; this.decay = Math.random() * 0.01 + 0.005;
                this.size = Math.random() * 1.5 + 0.5;
                return;
            }
            this.isBurst = false;
            this.x = Math.random() * width;
            this.alpha = Math.random() * 0.5 + 0.2;

            if (effect.type === 'sway_fall') {
                this.y = -10;
                this.vy = Math.random() * 0.5 + 0.3;
                this.vx = 0;
                this.size = Math.random() * 4 + 2;
                this.sway = Math.random() * Math.PI * 2;
                this.swaySpeed = Math.random() * 0.02 + 0.01;
                this.rotation = Math.random() * 360;
                this.rotSpeed = Math.random() - 0.5;
            } else if (effect.type.includes('rain')) {
                this.y = Math.random() * height;
                this.vx = -0.5; this.vy = Math.random() * 10 + 15;
                this.size = Math.random() * 20 + 10;
                this.alpha = 0.2;
            } else if (effect.type === 'meteor') {
                this.x = Math.random() * width * 1.5 - width * 0.25;
                this.y = -100;
                this.vx = -4 - Math.random() * 4; this.vy = 4 + Math.random() * 4;
                this.size = Math.random() * 30 + 20;
                this.alpha = 0; this.delay = Math.random() * 100;
            } else if (effect.type === 'float_up_fade' || effect.type === 'flow_up') {
                this.y = height + 10;
                this.vx = Math.random() * 0.5 - 0.25;
                this.vy = -(Math.random() * 1 + 0.5);
                this.size = Math.random() * 2 + 1;
                if (effect.type === 'float_up_fade') { this.alpha = 1; this.decay = 0.01; }
            } else {
                this.y = Math.random() * height;
                this.vx = Math.random() - 0.5; this.vy = Math.random() - 0.5;
                this.size = 2;
            }
            this.prevX = this.x; this.prevY = this.y;
        }
        update() {
            this.prevX = this.x; this.prevY = this.y;
            const effect = currentEffect.value;

            if (this.isBurst) {
                this.vx *= this.drag; this.vy *= this.drag; this.vy += this.gravity;
                this.x += this.vx; this.y += this.vy; this.alpha -= this.decay;
            } else if (effect.type === 'sway_fall') {
                this.y += this.vy;
                this.sway += this.swaySpeed;
                this.x += Math.sin(this.sway) * 0.5;
                this.rotation += this.rotSpeed;
                if (this.y > height + 20) this.init();
            } else if (effect.type === 'meteor') {
                if (this.delay > 0) { this.delay--; return; }
                this.x += this.vx; this.y += this.vy;
                if (this.y < height / 2) this.alpha += 0.05; else this.alpha -= 0.05;
                if (this.alpha > 1) this.alpha = 1;
                if (this.y > height + 100) this.init(null, null, null);
            } else {
                this.x += this.vx; this.y += this.vy;
                if (effect.type === 'float_up_fade') {
                    this.alpha -= 0.005; if (this.alpha <= 0) this.init();
                }
                if (this.y > height + 20 && this.vy > 0) this.init();
                if (this.y < -20 && this.vy < 0) this.init();
            }
        }
        draw() {
            if (this.alpha <= 0) return;
            voiceCtx.save();
            const effect = currentEffect.value;

            if (effect.type === 'sway_fall') {
                voiceCtx.translate(this.x, this.y);
                voiceCtx.rotate(this.rotation * Math.PI / 180);
                voiceCtx.fillStyle = `rgba(${effect.color}, ${this.alpha})`;
                voiceCtx.beginPath();
                if (effect.id === 'bamboo') voiceCtx.ellipse(0, 0, this.size / 3, this.size, 0, 0, Math.PI * 2);
                else if (effect.id === 'sakura') { voiceCtx.moveTo(0, 0); voiceCtx.bezierCurveTo(this.size / 2, -this.size / 2, this.size, 0, 0, this.size); voiceCtx.bezierCurveTo(-this.size, 0, -this.size / 2, -this.size / 2, 0, 0); }
                else voiceCtx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
                voiceCtx.fill();
            } else if (this.isBurst || effect.type === 'flow_up' || effect.type.includes('rain') || effect.type === 'meteor') {
                voiceCtx.strokeStyle = `rgba(${effect.color}, ${this.alpha})`;
                voiceCtx.lineWidth = this.isBurst ? this.size : 1;
                if (effect.type === 'meteor') voiceCtx.lineWidth = 2;
                voiceCtx.beginPath();
                voiceCtx.moveTo(this.prevX, this.prevY);
                let endX = this.x; let endY = this.y;
                if (effect.type.includes('rain')) { endX = this.x + this.vx * 2; endY = this.y + this.size; }
                else if (effect.type === 'meteor') { voiceCtx.moveTo(this.x, this.y); endX = this.x - this.vx * 8; endY = this.y - this.vy * 8; }
                voiceCtx.lineTo(endX, endY);
                voiceCtx.stroke();
            } else {
                voiceCtx.translate(this.x, this.y);
                voiceCtx.fillStyle = `rgba(${effect.color}, ${this.alpha})`;
                if (effect.id === 'firefly') { voiceCtx.shadowBlur = 5; voiceCtx.shadowColor = `rgba(${effect.color}, 1)`; }
                voiceCtx.beginPath(); voiceCtx.arc(0, 0, this.size, 0, Math.PI * 2); voiceCtx.fill();
            }
            voiceCtx.restore();
        }
    }

    if (currentEffect.value.type !== 'burst') {
        let count = 40;
        if (currentEffect.value.type.includes('rain')) count = 100;
        if (currentEffect.value.type === 'meteor') count = 5;
        for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    const drawLightning = () => {
        if (currentEffect.value.id !== 'storm') return;
        if (Math.random() < 0.008) {
            voiceCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            voiceCtx.fillRect(0, 0, width, height);
            voiceCtx.beginPath();
            let lx = Math.random() * width; let ly = 0;
            voiceCtx.moveTo(lx, ly);
            while (ly < height) { lx += (Math.random() - 0.5) * 80; ly += Math.random() * 50 + 20; voiceCtx.lineTo(lx, ly); }
            voiceCtx.strokeStyle = 'rgba(255,255,255,0.6)'; voiceCtx.lineWidth = 2; voiceCtx.stroke();
        }
    };

    const loop = (timestamp) => {
        if (!showInnerVoiceModal.value) return;

        // Trail Effect: Fade out previous frame instead of clearing
        voiceCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        voiceCtx.fillRect(0, 0, width, height);
        voiceCtx.globalCompositeOperation = 'lighter';

        drawLightning();

        if (currentEffect.value.type === 'burst') {
            if (timestamp - lastLaunch > Math.random() * 2000 + 1500) {
                const x = Math.random() * width * 0.6 + width * 0.2;
                const y = Math.random() * height * 0.4 + height * 0.1;
                for (let i = 0; i < 50; i++) particles.push(new Particle('burst', x, y));
                lastLaunch = timestamp;
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].isBurst && particles[i].alpha <= 0) particles.splice(i, 1);
        }

        voiceCtx.globalCompositeOperation = 'source-over';
        animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
};

const cleanupCanvas = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
};

const handleImageError = (e) => {
    e.target.src = '/broken-image.png';
    e.target.onerror = null; // Prevent infinite loop if placeholder fails
};

const getHtmlContent = (content) => {
    if (!content) return ''
    try {
        // Try parsing as JSON first (if it's the [CARD] format)
        if (content.trim().startsWith('{')) {
            const data = JSON.parse(content)
            if (data.html) return data.html
        }
    } catch (e) {
        // Not JSON, treat as raw HTML string
    }
    return content
}

// UI Methods
// (Methods moved to 'Modal Logic' section above)
const toggleVoiceEffect = () => {
    // Increment index
    let nextIndex = currentEffectIndex.value + 1;
    if (nextIndex >= effectTypes.length) nextIndex = 0;

    currentEffectIndex.value = nextIndex;
    currentEffect.value = effectTypes[nextIndex];

    // Restart animation with new effect
    startAnimation();
};

const toggleManageMode = () => {
    alert('历史记录功能暂未实装');
};

const deleteCurrent = () => {
    if (!currentInnerVoice.value || !currentInnerVoice.value.id) return;
    showDeleteConfirm.value = true;
};

const executeDelete = () => {
    const msgId = currentInnerVoice.value.id;
    const msg = msgs.value.find(m => m.id === msgId);

    if (msg) {
        // Remove Inner Voice block
        const newContent = msg.content.replace(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi, '').trim();
        chatStore.updateMessage(chatStore.currentChatId, msgId, newContent);

        showDeleteConfirm.value = false;
        closeInnerVoiceModal();
    }
};
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
                class="absolute top-16 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 min-w-[200px] justify-center backdrop-blur-md"
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
                        <div class="w-2 h-2 rounded-full shadow-[0_0_4px_rgba(0,223,108,0.5)]"
                            :class="chatData?.isOnline ? 'bg-[#00df6c]' : 'bg-gray-400'"></div>
                        <span class="text-[10px] text-gray-500 truncate max-w-[150px] font-medium">{{
                            chatData?.statusText || '在线' }}</span>
                    </div>
                </div>
                <div class="absolute right-1.5 flex items-center gap-0.5 text-black z-20">
                    <!-- Auto TTS Button -->
                    <div class="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-black/5"
                        @click="toggleAutoTTS" :title="chatData?.autoTTS ? '关闭朗读' : '开启朗读'">
                        <i class="fa-solid"
                            :class="chatData?.autoTTS ? 'fa-volume-high text-green-600' : 'fa-volume-xmark text-gray-400'"></i>
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


                <div v-for="(msg, index) in displayedMsgs" :key="msg.id" v-show="isMsgVisible(msg)" class="w-full z-10">
                    <!-- Center Time Divider (WeChat Style) -->
                    <div v-if="shouldShowTimeDivider(msg, displayedMsgs[index - 1])"
                        class="flex justify-center my-4 animate-fade-in relative">
                        <span
                            class="text-[10px] px-2 py-0.5 rounded shadow-sm select-none transition-colors duration-300"
                            :class="chatData?.bgTheme === 'dark' ? 'text-white/60 bg-white/10' : 'text-gray-400 bg-gray-100/60'">
                            {{ formatTimelineTime(msg.timestamp) }}
                        </span>
                    </div>

                    <!-- Multi-select Layer Wrapper -->
                    <div class="flex items-center gap-3 transition-all duration-300 relative"
                        :class="isMultiSelectMode ? 'pl-10' : ''">
                        <!-- Selection Circle (Visible in Multi-select Mode) -->
                        <div v-if="isMultiSelectMode"
                            class="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all shrink-0"
                            :class="selectedMsgIds.has(msg.id) ? 'bg-[#07c160] border-[#07c160]' : 'border-gray-300 bg-white/10'"
                            @click.stop="toggleMessageSelection(msg.id)">
                            <i v-if="selectedMsgIds.has(msg.id)" class="fa-solid fa-check text-white text-[10px]"></i>
                        </div>

                        <div class="flex-1 overflow-hidden"
                            @click="isMultiSelectMode ? toggleMessageSelection(msg.id) : null">

                            <!-- CASE 1: System / Recall Message (Standalone) -->
                            <div v-if="msg.type === 'system' || msg.role === 'system'"
                                class="flex flex-col items-center my-2 w-full animate-fade-in"
                                @contextmenu.prevent="handleContextMenu(msg, $event)">
                                <!-- Main Tip -->
                                <span
                                    class="text-[11px] px-3 py-1 rounded font-songti select-none transition-colors duration-300"
                                    :class="[
                                        msg.isRecallTip ? 'cursor-pointer hover:bg-opacity-80 transition-colors' : '',
                                        chatData?.bgTheme === 'dark' ? 'bg-white/10 text-white/40' : 'bg-gray-200/50 text-gray-400'
                                    ]" @click="msg.isRecallTip && (msg.showDetail = !msg.showDetail)">
                                    {{ msg.content }}
                                </span>

                                <!-- Foldable Content -->
                                <div v-if="msg.showDetail && msg.realContent"
                                    class="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 max-w-[80%] break-all shadow-sm animate-fade-in-down">
                                    <div class="mb-0.5 text-gray-400 text-[10px]">原内容:</div>
                                    {{ msg.realContent }}
                                </div>
                            </div>

                            <!-- CASE 2: Regular Message (Avatar + Inner Content) -->
                            <div v-else class="flex gap-2 w-full"
                                :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
                                <!-- Avatar Container -->
                                <div class="relative w-10 h-10 shrink-0 cursor-pointer" @dblclick="handlePat(msg)">
                                    <!-- Inner Avatar (Resized to 80% if frame exists) -->
                                    <div class="absolute overflow-hidden bg-white shadow-sm transition-all duration-300"
                                        :class="[
                                            (msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame) || chatData?.avatarShape === 'circle' ? 'rounded-full' : 'rounded',
                                            { 'animate-shake': shakingAvatars.has(msg.id) }
                                        ]" :style="{
                                            inset: (msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame)
                                                ? ((1 - ((msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame)?.scale || 1)) / 2 * 100) + '%'
                                                : '0',
                                            transform: (msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame)
                                                ? `translate(${((msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame)?.offsetX || 0)}px, ${((msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame)?.offsetY || 0)}px)`
                                                : 'none'
                                        }">
                                        <img :src="msg.role === 'user'
                                            ? (chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me')
                                            : (chatData?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${chatData?.name || 'AI'}`)"
                                            class="w-full h-full object-cover">
                                    </div>
                                    <!-- Frame Overlay (100%) -->
                                    <img v-if="msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame"
                                        :src="msg.role === 'user' ? chatData?.userAvatarFrame?.url : chatData?.avatarFrame?.url"
                                        class="absolute inset-0 w-full h-full pointer-events-none z-10">
                                </div>

                                <div class="flex flex-col max-w-[80%]"
                                    :class="msg.role === 'user' ? 'items-end' : 'items-start'">

                                    <!-- Pay Card (Red Packet / Transfer) -->
                                    <div v-if="msg.type === 'redpacket' || msg.type === 'transfer' || (typeof msg.content === 'string' && (msg.content.includes('[红包]') || msg.content.includes('[转账]')))"
                                        class="pay-card"
                                        :class="{ 'received': msg.isClaimed || msg.status === 'received', 'rejected': msg.isRejected }"
                                        @click="handlePayClick(msg)"
                                        @contextmenu.prevent="handleContextMenu(msg, $event)">
                                        <div class="pay-top">
                                            <div class="pay-icon"
                                                :class="{ 'bg-[#ea5f39]': !msg.type || msg.type === 'redpacket', 'bg-[#eda338]': msg.type === 'transfer', 'opacity-70': msg.isClaimed }">
                                                <i v-if="msg.type === 'transfer'"
                                                    :class="msg.isClaimed ? 'fa-solid fa-check' : 'fa-solid fa-right-left'"></i>
                                                <i v-else
                                                    :class="msg.isClaimed ? 'fa-regular fa-envelope-open' : 'fa-regular fa-envelope'"></i>
                                            </div>
                                            <div class="pay-info">
                                                <div class="pay-title">{{ getPayTitle(msg) }}</div>
                                                <div class="pay-desc">{{ getPayDesc(msg) }}</div>
                                            </div>
                                        </div>
                                        <div class="pay-bottom">
                                            {{ getPayStatusText(msg) }}
                                        </div>
                                    </div>

                                    <!-- Image / Emoji -->
                                    <div v-else-if="msg.type === 'image' || isImageMsg(msg)"
                                        class="msg-image bg-transparent"
                                        @contextmenu.prevent="handleContextMenu(msg, $event)">
                                        <img :src="getImageSrc(msg)"
                                            class="max-w-[150px] max-h-[150px] rounded-lg cursor-pointer"
                                            @click="previewImage(getImageSrc(msg))" @error="handleImageError">
                                    </div>

                                    <!-- Voice Message Branch (Unified) -->
                                    <div v-else-if="msg.type === 'voice'" class="flex flex-col w-full"
                                        :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                                        <div class="flex items-center gap-2"
                                            :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
                                            <!-- Bubble -->
                                            <div class="h-10 rounded-lg flex items-center px-4 cursor-pointer relative shadow-sm min-w-[80px]"
                                                :class="[
                                                    msg.role === 'user' ? 'bg-[#2e2e2e] text-white flex-row-reverse' : 'bg-black text-[#d4af37]',
                                                    msg.isPlaying ? 'voice-playing-effect' : ''
                                                ]"
                                                :style="{ width: Math.max(80, 40 + getDuration(msg) * 5) + 'px', maxWidth: '200px' }"
                                                @click="handleVoiceClick(msg)"
                                                @contextmenu.prevent="handleContextMenu(msg, $event)">
                                                <!-- Wave Icon -->
                                                <div class="voice-wave"
                                                    :class="[msg.isPlaying ? 'playing' : '', msg.role === 'user' ? 'wave-right' : 'wave-left']">
                                                    <div class="bar bar1"
                                                        :class="msg.role === 'user' ? 'bg-white' : 'bg-[#d4af37]'">
                                                    </div>
                                                    <div class="bar bar2"
                                                        :class="msg.role === 'user' ? 'bg-white' : 'bg-[#d4af37]'">
                                                    </div>
                                                    <div class="bar bar3"
                                                        :class="msg.role === 'user' ? 'bg-white' : 'bg-[#d4af37]'">
                                                    </div>
                                                </div>

                                                <!-- Arrow -->
                                                <div class="absolute top-3 w-0 h-0 border-y-[6px] border-y-transparent"
                                                    :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px] border-l-[#2e2e2e]' : 'left-[-6px] border-r-[6px] border-r-black'">
                                                </div>

                                                <!-- Duration (Inside) -->
                                                <span class="text-[10px] font-bold opacity-70"
                                                    :class="msg.role === 'user' ? 'mr-0 ml-1' : 'ml-1 mr-0'">{{
                                                        getDuration(msg) }}"</span>
                                            </div>

                                            <!-- Red Dot for Unplayed AI Voice -->
                                            <div v-if="msg.role === 'ai' && !msg.isPlayed"
                                                class="w-2 h-2 bg-red-500 rounded-full"></div>
                                        </div>

                                        <!-- Transcript Box (White Bubble Style) -->
                                        <div v-if="msg.showTranscript" class="mt-2 max-w-full animate-fade-in-down">
                                            <div class="bg-white border border-gray-200 p-3 rounded-lg text-[14.5px] text-gray-800 font-songti leading-relaxed shadow-sm whitespace-pre-wrap relative overflow-hidden"
                                                :class="msg.role === 'user' ? 'mr-0 ml-auto' : ''"
                                                style="max-width: 280px;">
                                                <!-- Subtle Gloss Effect -->
                                                <div
                                                    class="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none">
                                                </div>
                                                {{ msg.content }}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- HTML Card (Interactive Iframe) -->
                                    <!-- HTML Card (Interactive Iframe) -->
                                    <div v-else-if="msg.type === 'html'" class="w-full mt-1"
                                        @contextmenu.prevent="handleContextMenu(msg, $event)"
                                        @touchstart="startLongPress(msg, $event)" @touchend="cancelLongPress"
                                        @touchmove="cancelLongPress" @mousedown="startLongPress(msg, $event)"
                                        @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                                        <SafeHtmlCard :content="getHtmlContent(msg.content)" />
                                    </div>

                                    <!-- Moments Share Card -->
                                    <div v-else-if="msg.type === 'moment_card'" class="w-full mt-1"
                                        @contextmenu.prevent="handleContextMenu(msg, $event)">
                                        <MomentShareCard :data="msg.content" />
                                    </div>



                                    <!-- Default Text Bubble -->
                                    <div v-else v-show="getCleanContent(msg.content)"
                                        @contextmenu.prevent="handleContextMenu(msg, $event)"
                                        @touchstart="startLongPress(msg, $event)" @touchend="cancelLongPress"
                                        @touchmove="cancelLongPress" @mousedown="startLongPress(msg, $event)"
                                        @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                                        class="px-3 py-2 rounded-lg text-[15px] leading-relaxed break-words shadow-sm relative transition-all"
                                        :class="[
                                            msg.role === 'user' ? 'chat-bubble-right' : 'chat-bubble-left',
                                        ]" :style="{
                                            fontSize: (chatData?.bubbleSize || 15) + 'px',
                                            ...(chatData?.bubbleCss ? parseBubbleCss(chatData.bubbleCss) : {})
                                        }">
                                        <!-- Arrow -->
                                        <div class="absolute top-3 w-0 h-0 border-y-[6px] border-y-transparent"
                                            :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px] border-l-[#1f2937]' : 'left-[-6px] border-r-[6px] border-r-[#1a1a1a]'">
                                        </div>

                                        <!-- Quote Reply -->
                                        <div v-if="msg.quote"
                                            class="mb-1.5 pb-1.5 border-b border-white/10 opacity-70 text-[11px] leading-tight flex flex-col gap-0.5">
                                            <div class="font-bold">{{ msg.quote.role === 'user' ? '我' : (chatData.name
                                                || '对方') }}</div>
                                            <div class="truncate max-w-[200px]">{{ msg.quote.content }}</div>
                                        </div>

                                        <span v-html="formatMessageContent(msg)"></span>
                                    </div>

                                    <!-- Timestamp below bubble -->
                                    <div v-if="msg.timestamp" class="text-[10px] text-gray-400 mt-0.5 px-1">
                                        {{ new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

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

            <!-- Input Area (Two Rows: Toolbar Top, Input Bottom) -->
            <div v-if="!isMultiSelectMode" class="bg-[#f7f7f7] border-t border-[#dcdcdc] relative z-20"
                @contextmenu.prevent>

                <!-- Reply Bar Overlay -->
                <div v-if="currentQuote"
                    class="absolute bottom-full left-0 right-0 mb-0 bg-white shadow-sm border-t border-gray-100 p-3 flex justify-between items-center z-30">
                    <div class="text-sm text-gray-700 truncate max-w-[85%] border-l-4 border-gray-300 pl-2">
                        <span class="font-medium text-gray-900">{{ currentQuote.role === 'user' ? '我' : (chatData.name
                            || '对方') }}:</span>
                        {{ currentQuote.content }}
                    </div>
                    <button @click="cancelQuote" class="text-gray-400 hover:text-gray-600">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Row 1: Function Toolbar (Above Input) -->
                <div
                    class="flex items-center px-4 pt-2 pb-1 gap-4 text-[#4a4a4a] text-[18px] select-none overflow-x-auto no-scrollbar">
                    <!-- Plus (Panel Toggle) -->
                    <i class="fa-solid fa-circle-plus cursor-pointer hover:text-gray-800 transition-colors"
                        @click="toggleActionPanel" title="更多功能"></i>

                    <!-- Emoji -->
                    <i class="fa-regular fa-face-smile cursor-pointer hover:text-gray-800 transition-colors"
                        @click.stop="toggleEmojiPicker" title="表情"></i>

                    <!-- Call (Phone) -->
                    <div class="relative group">
                        <i class="fa-solid fa-phone-volume cursor-pointer hover:text-gray-800 transition-colors"
                            title="通话"></i>
                    </div>

                    <!-- Regenerate -->
                    <i class="fa-solid fa-rotate-right cursor-pointer hover:text-blue-500 transition-colors"
                        @click="regenerateLastMessage" title="重新生成"></i>

                    <!-- Music -->
                    <i class="fa-solid fa-music cursor-pointer hover:text-yellow-600 transition-colors"
                        :class="{ 'text-yellow-500': musicStore.playerVisible }" @click="musicStore.togglePlayer"
                        title="音乐 (一起听歌)"></i>
                </div>

                <!-- Row 2: Input Box + Actions (Bottom) -->
                <div class="flex items-end px-3 pb-3 pt-1 gap-2">
                    <!-- Voice Toggle -->
                    <button
                        class="mb-1 text-[#2e2e2e] text-[22px] hover:text-gray-600 transition-colors w-[28px] flex justify-center"
                        @click="toggleVoiceMode" :title="isVoiceMode ? '切换到文字模式' : '切换到语音模式'">
                        <i class="fa-solid transition-all"
                            :class="isVoiceMode ? 'fa-keyboard text-blue-500' : 'fa-microphone'"></i>
                    </button>

                    <!-- Input Wrapper -->
                    <div class="flex-1 bg-white rounded-lg border border-gray-300 flex items-center min-h-[38px] px-3 py-2 shadow-sm"
                        :class="isVoiceMode ? 'border-blue-400' : ''">
                        <textarea v-model="inputVal"
                            class="w-full bg-transparent border-none focus:ring-0 resize-none outline-none text-[15px] leading-[22px] text-gray-800 placeholder-gray-400"
                            rows="1" :placeholder="isVoiceMode ? '输入文字，发送后将以语音形式显示...' : '发送消息...'"
                            @keydown.enter.prevent="sendUserMessage" @input="handleAutoResize" ref="textareaRef"
                            style="max-height: 66px; overflow-y: auto;"></textarea>
                    </div>

                    <!-- Stop Btn (When Typing) -->
                    <button v-if="chatStore.isTyping"
                        class="mb-1 text-white bg-red-500 rounded-full w-[34px] h-[34px] flex items-center justify-center hover:bg-red-600 transition-all active:scale-95 shadow-sm"
                        @click="chatStore.stopGeneration" title="停止生成">
                        <i class="fa-solid fa-square text-[10px]"></i>
                    </button>

                    <!-- Generate Btn -->
                    <button v-else-if="!inputVal.trim()"
                        class="mb-1 text-white bg-[#07c160] rounded-full w-[34px] h-[34px] flex items-center justify-center hover:bg-[#06ad56] transition-all active:scale-95 shadow-sm"
                        @click="generateAIResponse">
                        <i class="fa-solid fa-wand-magic-sparkles text-[13px]"></i>
                    </button>

                    <!-- Send Btn -->
                    <button v-else
                        class="mb-1 text-white bg-[#07c160] rounded-full w-[34px] h-[34px] flex items-center justify-center hover:bg-[#06ad56] transition-all active:scale-95 shadow-sm"
                        @click="sendUserMessage">
                        <i class="fa-solid fa-paper-plane text-[13px]"></i>
                    </button>
                </div>
            </div>



            <!-- Multi-select Action Bar (Bottom Overlay) -->
            <div v-if="isMultiSelectMode"
                class="h-[60px] bg-[#f7f7f7] border-t border-[#dcdcdc] flex items-center justify-between px-8 relative z-30 animate-fade-in-up">
                <button @click="exitMultiSelectMode"
                    class="flex flex-col items-center justify-center text-gray-600 hover:text-gray-800 transition-colors">
                    <i class="fa-solid fa-xmark text-lg"></i>
                    <span class="text-[10px] mt-0.5">取消</span>
                </button>

                <div class="flex gap-12">
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

            <!-- Hidden Input -->
            <input type="file" ref="imgUploadInput" class="hidden" accept="image/*" @change="handleImgUpload">

        </div><!-- End of Main Chat Content -->

        <!-- Settings Overlay -->
        <ChatDetailSettings v-if="showSettings" :chatData="chatData" @close="showSettings = false"
            @show-profile="handleProfileNavigation" />



        <!-- Red Packet Modal (QQ Style) -->
        <div v-if="showRedPacketModal"
            class="fixed inset-0 bg-black/85 z-[150] flex flex-col items-center justify-center animate-fade-in"
            @click.self="closeRedPacketModal">
            <!-- The Card -->
            <div class="w-[320px] h-[500px] rounded-[12px] relative overflow-hidden shadow-2xl transition-all duration-500"
                :class="showResult ? 'bg-[#f5f5f5]' : 'bg-[#D04035]'">

                <!-- 1. Unopened View -->
                <div v-if="!showResult" class="w-full h-full flex flex-col items-center relative">
                    <!-- Top Arc Decoration -->
                    <div
                        class="absolute -top-[150px] -left-[10%] w-[120%] h-[350px] bg-[#E35447] rounded-[50%] shadow-lg z-0">
                    </div>

                    <!-- User Info -->
                    <div class="z-10 mt-[80px] flex flex-col items-center">
                        <div class="flex items-center gap-2 mb-4">
                            <img :src="currentRedPacket?.role === 'user' ? (chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User') : chatData?.avatar"
                                class="w-12 h-12 rounded-full border-2 border-[#FFE2B1] shadow-sm">
                            <span class="text-[#FFE2B1] font-medium text-lg">{{ currentRedPacket?.role === 'user' ?
                                '我的红包' : chatData?.name }}</span>
                        </div>
                        <div class="text-[#FFE2B1] text-xl font-medium px-8 text-center leading-relaxed">
                            {{ currentRedPacket?.note || "恭喜发财，大吉大利" }}
                        </div>
                    </div>

                    <!-- Open Button -->
                    <div class="z-10 mt-auto mb-[100px] flex flex-col items-center">
                        <div class="w-24 h-24 bg-[#EBC88E] rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform active:scale-90 border-4 border-[#E35447]"
                            :class="{ 'animate-spin-slow': isOpening }" @click="openRedPacket">
                            <span class="text-[#333] font-bold text-3xl font-serif">開</span>
                        </div>
                        <!-- Reject Link -->
                        <div v-if="currentRedPacket?.role === 'ai'"
                            class="mt-6 text-[#FFE2B1]/70 text-sm cursor-pointer hover:text-white transition-colors"
                            @click="rejectPayment">
                            退回红包
                        </div>
                    </div>
                </div>

                <!-- 2. Result View (Half Red / Half White) -->
                <div v-else class="w-full h-full flex flex-col items-center relative animate-fade-in">
                    <!-- Top Red Section -->
                    <div class="absolute top-0 left-0 w-full h-[160px] bg-[#D04035]">
                        <!-- Curved Bottom -->
                        <div
                            class="absolute -bottom-[40px] left-0 w-full h-[80px] bg-[#D04035] rounded-b-[50%] shadow-none z-0">
                        </div>
                    </div>

                    <!-- Avatar (Overlapping) -->
                    <div class="z-10 mt-[120px] relative">
                        <div class="w-20 h-20 rounded-full p-1 bg-white shadow-md">
                            <!-- Show claimer's avatar if claimed, or sender's if looking at details -->
                            <img :src="currentRedPacket?.isClaimed
                                ? (chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User')
                                : (currentRedPacket?.role === 'user' ? (chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User') : chatData?.avatar)"
                                class="w-full h-full rounded-full object-cover">
                        </div>
                    </div>

                    <!-- Content (White Area) -->
                    <div class="z-10 mt-4 flex flex-col items-center text-gray-800">
                        <!-- Status -->
                        <div class="font-medium text-lg mb-1">
                            {{ currentRedPacket?.claimedBy?.name || (currentRedPacket?.isRejected ? '已退回' :
                                (currentRedPacket?.role === 'user' ? '我的红包' : chatData?.name)) }}
                        </div>
                        <div class="text-gray-400 text-sm mb-6">{{ currentRedPacket?.isRejected ? '资金已原路退回' : '已存入零钱' }}
                        </div>

                        <!-- Amount -->
                        <div class="flex items-baseline font-bold text-[#D04035] mb-8">
                            <span class="text-3xl mr-1">¥</span>
                            <span class="text-5xl border-b border-transparent">{{ resultAmount }}</span>
                        </div>

                        <div class="text-[#576b95] text-sm cursor-pointer" @click="closeRedPacketModal">查看我的钱包</div>
                    </div>

                    <!-- Bottom Decoration -->
                    <div class="mt-auto mb-4 text-gray-300 text-xs">
                        微信红包
                    </div>
                </div>
            </div>

            <!-- Bottom Close Button (Outside Card) -->
            <button
                class="mt-8 w-10 h-10 rounded-full border border-white/40 flex items-center justify-center text-white/80 hover:bg-white/10 hover:border-white hover:text-white active:scale-95 transition-all backdrop-blur-sm"
                @click="closeRedPacketModal">
                <i class="fa-solid fa-xmark text-xl"></i>
            </button>
        </div>

        <!-- Transfer Modal -->
        <div v-if="showTransferModal"
            class="fixed inset-0 bg-black/60 z-[160] flex flex-col items-center justify-center p-4 animate-fade-in"
            @click.self="showTransferModal = false">
            <div class="bg-white w-[280px] rounded-[12px] overflow-hidden shadow-xl relative">
                <div class="p-8 flex flex-col items-center text-center">
                    <div v-if="currentRedPacket?.isRejected">
                        <i class="fa-solid fa-ban text-red-500 text-5xl mb-4"></i>
                        <div class="text-xl font-medium text-black mb-1">已拒收</div>
                        <div class="text-3xl font-bold text-black mb-6">¥{{ currentRedPacket?.amount || '0.00' }}</div>
                        <div class="text-gray-400 text-sm">资金已退回对方账户</div>
                    </div>
                    <div v-else-if="currentRedPacket?.isClaimed">
                        <i class="fa-solid fa-check-circle text-[#07c160] text-5xl mb-4"></i>
                        <div class="text-xl font-medium text-black mb-1">已收款</div>
                        <div class="text-3xl font-bold text-black mb-6">¥{{ currentRedPacket?.amount || '0.00' }}</div>
                        <div class="text-gray-400 text-sm">已存入零钱</div>
                    </div>
                    <div v-else>
                        <i class="fa-solid fa-circle-check text-[#07c160] text-5xl mb-4"></i>
                        <div class="text-xl font-medium text-black mb-1">收到转账</div>
                        <div class="text-3xl font-bold text-black mb-6">¥{{ currentRedPacket?.amount || '0.00' }}</div>
                        <div class="text-gray-400 text-sm mb-6">确认收款后资金将存入零钱</div>

                        <div class="flex flex-col gap-3 w-full">
                            <button
                                class="w-full bg-[#07c160] hover:bg-[#06ad56] text-white py-3 rounded-lg font-medium transition-colors"
                                @click="confirmTransfer">确认收款</button>
                            <button
                                class="w-full text-[#576b95] text-sm py-2 hover:bg-gray-50 rounded-lg transition-colors"
                                @click="rejectPayment">立即退还</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bottom Close Button (Outside Card) -->
            <button
                class="mt-8 w-10 h-10 rounded-full border border-white/40 flex items-center justify-center text-white/80 hover:bg-white/10 hover:border-white hover:text-white active:scale-95 transition-all backdrop-blur-sm"
                @click="showTransferModal = false">
                <i class="fa-solid fa-xmark text-xl"></i>
            </button>
        </div>

        <!-- Inner Voice Modal (Mindscape) -->
        <div v-if="showInnerVoiceModal"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            @click="closeInnerVoiceModal">
            <div class="voice-modal-content" @click.stop>
                <canvas id="voice-effect-canvas" ref="voiceCanvasRef"></canvas>
                <!-- Header -->
                <div class="voice-modal-header">
                    <button class="voice-modal-header-btn" @click="closeInnerVoiceModal">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <div class="header-title">Mindscape</div>
                    <div class="flex gap-2">
                        <button class="voice-modal-header-btn" title="历史记录" @click="toggleVoiceHistory">
                            <i class="fa-solid"
                                :class="showHistoryList ? 'fa-rotate-left' : 'fa-clock-rotate-left'"></i>
                        </button>
                        <button class="voice-modal-header-btn" title="删除当前" @click="deleteCurrent"><i
                                class="fa-solid fa-trash-can" style="font-size: 14px;"></i></button>
                    </div>
                </div>

                <!-- Body -->
                <!-- Character View (Main Card) -->
                <div class="voice-modal-body flex flex-col items-center" v-if="!showHistoryList">
                    <!-- Avatar & Meta -->
                    <div class="voice-header-group">
                        <div class="voice-char-avatar-box relative w-16 h-16">
                            <!-- Inner Avatar -->
                            <div class="absolute inset-0 overflow-hidden rounded-full transition-all duration-300"
                                :style="{ padding: chatData?.avatarFrame ? '10%' : '0' }">
                                <img :src="chatData?.avatar"
                                    class="voice-char-avatar w-full h-full object-cover rounded-full">
                            </div>
                            <!-- Frame Overlay -->
                            <img v-if="chatData?.avatarFrame" :src="chatData?.avatarFrame?.url"
                                class="absolute inset-0 w-full h-full pointer-events-none z-10">
                        </div>
                        <div class="voice-char-name">{{ chatData?.name }}</div>
                        <div class="voice-char-meta">{{ currentInnerVoice?.mood || 'Current Mood / ...' }}</div>
                    </div>

                    <!-- Main Card (Thoughts) -->
                    <div class="voice-card-inner w-full" v-if="currentInnerVoice">
                        <span class="voice-label-center">· 内 心 独 白 ·</span>
                        <div class="voice-text-inner">
                            {{ currentInnerVoice.thoughts || currentInnerVoice.thought || '暂无心声数据' }}
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div class="voice-card-inner w-full flex items-center justify-center min-h-[200px]" v-else>
                        <div class="text-[#8c7e63] text-sm tracking-widest opacity-50">暂无法读取心声数据</div>
                    </div>

                    <!-- Details Grid -->
                    <div class="voice-row mt-6 w-full" v-if="currentInnerVoice">
                        <div class="voice-info-block">
                            <div class="voice-label">OUTFIT 穿搭</div>
                            <div class="voice-text-content">{{ currentInnerVoice.outfit || '...' }}</div>
                        </div>
                        <div class="voice-info-block">
                            <div class="voice-label">SCENE 环境</div>
                            <div class="voice-text-content">{{ currentInnerVoice.scene || '...' }}</div>
                        </div>
                    </div>

                    <!-- Action (Full Width) -->
                    <div class="w-full" v-if="currentInnerVoice">
                        <div class="voice-info-block mt-6">
                            <div class="voice-label">ACTION 姿态</div>
                            <div class="voice-text-content">{{ currentInnerVoice.action || '...' }}</div>
                        </div>
                    </div>
                </div>

                <!-- History List View -->
                <div class="voice-modal-body" v-else>
                    <div class="text-[#8c7e63] text-xs text-center mb-6 tracking-widest uppercase opacity-80">·
                        Mindscape History ·</div>

                    <div v-if="voiceHistoryList.length === 0"
                        class="text-center text-[#8c7e63] mt-10 text-xs opacity-50">暂无历史记录</div>

                    <div v-else class="voice-history-list">
                        <div v-for="(item, index) in voiceHistoryList" :key="item.id"
                            class="voice-history-card animate-fade-in" :style="{ animationDelay: index * 50 + 'ms' }"
                            @click="loadHistoryItem(item)">
                            <div class="voice-history-time">{{ new Date(item.timestamp).toLocaleString() }}</div>
                            <div class="voice-history-preview">{{ item.preview }}</div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="voice-modal-footer">
                    <span class="footer-count" id="voice-index-indicator">NO. {{ currentVoiceIndex }}</span>
                    <div class="effect-badge" @click="toggleVoiceEffect">{{ currentEffect.name }}</div>
                </div>

            </div>
        </div>

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
    width: 230px;
    background-color: #fa9d3b;
    /* Orange */
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    user-select: none;
    margin: 2px 0;
    position: relative;
    transition: opacity 0.2s;
}

.pay-card:active {
    opacity: 0.9;
}

.pay-card.received,
.pay-card.rejected {
    background-color: #fab46e;
    /* Desaturated version of orange */
    opacity: 0.9;
}

.pay-top {
    display: flex;
    align-items: center;
    padding: 15px 12px;
}

.pay-icon {
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    color: white;
    margin-right: 10px;
}

.pay-info {
    flex: 1;
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.pay-title {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.2;
}

.pay-desc {
    font-size: 12px;
    opacity: 0.8;
    margin-top: 2px;
}

.pay-bottom {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 4px 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
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

/* Voice Wave Animation */
.voice-wave {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 14px;
}

.voice-wave .bar {
    width: 2.5px;
    border-radius: 1px;
    background-color: currentColor;
    transition: height 0.2s;
}

.voice-wave .bar1 {
    height: 6px;
}

.voice-wave .bar2 {
    height: 10px;
}

.voice-wave .bar3 {
    height: 14px;
}

.voice-wave.playing .bar {
    animation: voice-wave-anim 0.8s infinite ease-in-out;
}

.voice-wave.playing .bar1 {
    animation-delay: 0s;
}

.voice-wave.playing .bar2 {
    animation-delay: 0.1s;
}

.voice-wave.playing .bar3 {
    animation-delay: 0.2s;
}

@keyframes voice-wave-anim {

    0%,
    100% {
        height: 6px;
        opacity: 0.5;
    }

    50% {
        height: 14px;
        opacity: 1;
    }
}

.voice-playing-effect {
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
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
