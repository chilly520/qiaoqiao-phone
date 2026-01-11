import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { generateReply, generateSummary } from '../utils/aiService'
import { useLoggerStore } from './loggerStore'
import { useWorldBookStore } from './worldBookStore'

const DEFAULT_AVATARS = [
    '/avatars/小猫举爪.jpg',
    '/avatars/小猫吃芒果.jpg',
    '/avatars/小猫吃草莓.jpg',
    '/avatars/小猫喝茶.jpg',
    '/avatars/小猫坏笑.jpg',
    '/avatars/小猫开心.jpg',
    '/avatars/小猫挥手.jpg',
    '/avatars/小猫星星眼.jpg',
    '/avatars/小猫犯困.jpg'
]

export const getRandomAvatar = () => DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]

export const useChatStore = defineStore('chat', () => {
    // State
    const chats = ref({}) // { 'char_id': { name: '...', avatar: '...', msgs: [], unreadCount: 0 } }
    const currentChatId = ref(null)
    const isTyping = ref(false)
    const notificationEvent = ref(null) // Global notification trigger
    const patEvent = ref(null) // Event: { chatId, target: 'ai'|'user' }
    const toastEvent = ref(null) // Event: { message, type: 'info'|'success'|'error' }
    
    // AI Control
    let currentAbortController = null;

    function triggerPatEffect(chatId, target) {
        patEvent.value = {
            id: Date.now(),
            chatId,
            target
        }
    }

    function triggerToast(message, type = 'info') {
        toastEvent.value = { id: Date.now(), message, type }
    }

    function stopGeneration() {
        if (currentAbortController) {
            currentAbortController.abort()
            currentAbortController = null
            isTyping.value = false
            console.log('[ChatStore] AI Generation stopped by user.')
            triggerToast('已中断生成', 'info')
        }
    }

    // Reset unread count when switching to a chat
    watch(currentChatId, (newId) => {
        if (newId && chats.value[newId]) {
            chats.value[newId].unreadCount = 0
            saveChats()
        }
    })

    // Getters
    const chatList = computed(() => {
        return Object.keys(chats.value).map(key => ({
            id: key,
            ...chats.value[key],
            ...chats.value[key],
            unreadCount: chats.value[key].unreadCount || 0,
            lastMsg: (chats.value[key].msgs || []).slice(-1)[0] || null
        })).filter(c => c.inChatList !== false).sort((a, b) => {
            // Sort by Pinned First
            if (a.isPinned && !b.isPinned) return -1
            if (!a.isPinned && b.isPinned) return 1
            
            // Sort by last message time
            const timeA = a.lastMsg ? a.lastMsg.timestamp : 0
            const timeB = b.lastMsg ? b.lastMsg.timestamp : 0
            return timeB - timeA
        })
    })

    const contactList = computed(() => {
        return Object.keys(chats.value).map(key => ({
            id: key,
            ...chats.value[key]
        })).sort((a, b) => {
            // Sort contacts alphabetically or by pinyin
            return (a.name || '').localeCompare(b.name || '', 'zh-CN')
        })
    })

    const currentChat = computed(() => {
        if (!currentChatId.value || !chats.value[currentChatId.value]) return null
        return {
            id: currentChatId.value,
            ...chats.value[currentChatId.value]
        }
    })

    // Actions
    function addMessage(chatId, msg) {
        const chat = chats.value[chatId]
        if (!chat) return false

        // 1. Initialize message object
        const newMsg = {
            id: msg.id || ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)),
            timestamp: msg.timestamp || Date.now(),
            role: msg.role, 
            type: msg.type || 'text',
            content: msg.content || '',
            amount: msg.amount || 0,
            note: msg.note || '',
            isClaimed: msg.isClaimed || false,
            claimedBy: msg.claimedBy || null,
            claimTime: msg.claimTime || null,
            duration: msg.duration || 0
        }

        // 2. Type Auto-Detection (if not specified)
        if (newMsg.type === 'text' && typeof newMsg.content === 'string') {
            let detectionContent = newMsg.content.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim();
            const tagMatch = detectionContent.match(/^[\[【](发红包|红包|转账|图片|表情包|语音|VIDEO|FILE|LOCATION)\s*[:：]\s*([^:：\]】]+)(?:\s*[:：]\s*([^\]】]+))?[\]】]/i)
            
            if (tagMatch) {
                const tagType = tagMatch[1]
                const val1 = tagMatch[2].trim()
                const val2 = (tagMatch[3] || '').trim()

                if (/^(发红包|红包)$/.test(tagType)) {
                    newMsg.type = 'redpacket'
                    newMsg.amount = val1
                    newMsg.note = val2 || '恭喜发财，大吉大利'
                } else if (tagType === '转账') {
                    newMsg.type = 'transfer'
                    newMsg.amount = val1
                    newMsg.note = val2 || '转账给您'
                } else if (tagType === '图片') {
                    newMsg.type = 'image'
                } else if (tagType === '语音') {
                    newMsg.type = 'voice'
                } else if (tagType === '表情包') {
                    newMsg.type = 'sticker'
                } else if (tagType === 'VIDEO') {
                    newMsg.type = 'video'
                } else if (tagType === 'FILE') {
                    newMsg.type = 'file'
                } else if (tagType === 'LOCATION') {
                    newMsg.type = 'location'
                }
            }
        }

        // 3. Robust AI Payment Handling (Extract content if embedded in complex strings)
        if (newMsg.role === 'ai') {
             // Handle AI claiming [领取红包]
             const claimRegex = /\[(领取红包|RECEIVE_RED_PACKET)\]/i
             if (claimRegex.test(newMsg.content)) {
                 const lastUnclaimed = [...(chat.msgs || [])].reverse().find(m =>
                     m.role === 'user' && (m.type === 'redpacket' || m.type === 'transfer') && !m.isClaimed && !m.isRejected
                 )
                 if (lastUnclaimed) {
                     lastUnclaimed.isClaimed = true
                     lastUnclaimed.claimTime = Date.now()
                     lastUnclaimed.claimedBy = { name: chat.name, avatar: chat.avatar }
                 }
                 newMsg.content = newMsg.content.replace(claimRegex, '').trim()
                 if (!newMsg.content) return saveChats() // Exit if just tag, but save the claim state
             }

             // Handle AI Sending [发红包:100:祝福语]
             const pRegex = /\[(发红包|转账)[:：](\d+(?:\.\d{1,2})?)[:：]?(.*?)\]/i
             const pMatch = newMsg.content.match(pRegex)
             if (pMatch) {
                 const action = pMatch[1]
                 newMsg.type = action === '发红包' ? 'redpacket' : 'transfer'
                 newMsg.amount = parseFloat(pMatch[2])
                 newMsg.note = pMatch[3] || (action === '发红包' ? '恭喜发财，大吉大利' : '转账给您')
                 newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                 newMsg.isClaimed = false
                 newMsg.isRejected = false
                 newMsg.content = ''
             }
        }

        // 4. Persistence
        if (!chat.msgs) chat.msgs = []
        chat.msgs.push(newMsg)
        
        if (!chat.inChatList) chat.inChatList = true
        if (chatId !== currentChatId.value) {
            chat.unreadCount = (chat.unreadCount || 0) + 1
        }

        // Trigger Global Notification (Only for AI or other users, not self)
        if (newMsg.role !== 'user') {
            notificationEvent.value = {
                id: Date.now(),
                chatId: chatId,
                name: chat.name,
                avatar: chat.avatar,
                content: newMsg.type === 'image' ? '[图片]' : (newMsg.content || '[消息]'),
                timestamp: Date.now()
            }
        }


        checkAutoSummary(chatId)
        return saveChats()
    }

    function updateCharacter(chatId, updates) {
        if (chats.value[chatId]) {
            // Merge into a new object to trigger reactivity
            chats.value[chatId] = { ...chats.value[chatId], ...updates }
            // Re-assign the whole chats object to ensure top-level reactivity
            chats.value = { ...chats.value }
            return saveChats()
        }
        return false
    }

    // Refactored: ID is optional (last arg) to support UI creation
    function createChat(name, avatar = '', options = {}, id = null) {
        const chatId = id || Date.now().toString()
        
        if (!chats.value[chatId]) {
            chats.value[chatId] = {
                name,
                avatar: avatar || getRandomAvatar(),
                userAvatar: options.userAvatar || getRandomAvatar(),
                msgs: [],
                unreadCount: 0,
                // Character Settings
                prompt: options.prompt || '',
                userName: options.userName || '用户',
                // Settings with defaults
                activeChat: false,
                activeInterval: 30,
                proactiveChat: false,
                proactiveInterval: 5,
                autoSummary: false,
                summaryPrompt: '',
                autoTTS: false,
                showInnerVoice: true,
                // New Settings
                voiceId: '',
                voiceSpeed: 1.0,
                patAction: '',
                patSuffix: '',
                bubbleSize: 15,
                bubbleCss: '',
                bgUrl: '',
                bgBlur: 0,
                bgOpacity: 1.0,
                bgTheme: 'light', // 'light' or 'dark'
                emojis: [],
                emojiCategories: [],
                // Logic State
                emojiCategories: [],
                // Logic State
                wechatId: 'wxid_' + Math.floor(Math.random() * 10000000000), // Unique Numeric-like WeChat ID
                openingLine: '', // Custom opening line
                hideFriendRequest: false, // Whether to hide the friend request card
                isNew: true, // Flag to trigger settings open on first load
                inChatList: true, // Visible in chat list
                virtualTime: options.virtualTime || '',
                virtualTimeLastSync: options.virtualTime ? Date.now() : null,
                timeAware: options.timeAware !== undefined ? options.timeAware : false
            }
            saveChats()
        }
        return chats.value[chatId]
    }


    // --- Memory Logic ---
    function getTokenBreakdown(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return { total: 0, system: 0, persona: 0, worldBook: 0, memory: 0, history: 0, summaryLib: 0 }
        
        // 1. System & Tools (Rough Estimate)
        // Base system prompt + tools definitions
        const systemToken = 800 

        // 2. Persona (User + Character)
        const charPersona = (chat.prompt || '') + (chat.name || '')
        const userPersona = (chat.userName || '') + (chat.userPersona || '')
        const personaToken = Math.floor((charPersona.length + userPersona.length) * 1.2)

        // 3. WorldBook (Linked Entries)
        let wbToken = 0
        if (chat.worldBookLinks && chat.worldBookLinks.length > 0) {
            const wbStore = useWorldBookStore()
            // We need to access store directly or pass it in. Pinia stores are singletons.
            // Since we are inside a store, we can use other stores.
            chat.worldBookLinks.forEach(entryId => {
                const entry = wbStore.getEntryById(entryId)
                if (entry) {
                    wbToken += Math.floor(((entry.content || '') + (entry.name || '')).length * 1.2)
                }
            })
        }

        // 4. Memory (Auto Summaries)
        let memoryContextToken = 0
        let memoryTotalToken = 0
        if (chat.memory && Array.isArray(chat.memory)) {
            // Context: Top 10
            const contextMemories = chat.memory.slice(0, 10)
            const contextText = contextMemories.map(m => typeof m === 'object' ? (m.content || '') : m).join('')
            memoryContextToken = Math.floor(contextText.length * 1.2)
            
            // Total: All
            const totalText = chat.memory.map(m => typeof m === 'object' ? (m.content || '') : m).join('')
            memoryTotalToken = Math.floor(totalText.length * 1.2)
        }

        // 5. History (Context Window)
        const limit = chat.contextLimit || 20
        const historyMsgs = (chat.msgs || []).slice(-limit)
        const historyText = historyMsgs.map(m => m.content).join('')
        const historyToken = Math.floor(historyText.length * 1.2)

        // Total Context
        const totalContext = systemToken + personaToken + wbToken + memoryContextToken + historyToken

        // Total Storage (All messages + All memory)
        const allHistoryText = (chat.msgs || []).map(m => m.content).join('')
        const totalStorage = systemToken + personaToken + wbToken + memoryTotalToken + Math.floor(allHistoryText.length * 1.2)

        return {
            total: totalStorage,
            totalContext: totalContext,
            system: systemToken,
            persona: personaToken,
            worldBook: wbToken,
            memory: memoryContextToken,
            history: historyToken,
            summaryLib: Math.max(0, memoryTotalToken - memoryContextToken) // Remaining memories
        }
    }

    function getTokenCount(chatId) {
        const stats = getTokenBreakdown(chatId)
        return stats.totalContext
    }

    // Auto Summary Logic
    function checkAutoSummary(chatId) {
        const chat = chats.value[chatId]
        if (!chat || !chat.autoSummary) return

        const msgs = chat.msgs || []
        const summaryLimit = parseInt(chat.summaryLimit) || 50
        const lastSummaryIndex = chat.lastSummaryIndex || 0

        // Check if new messages exceed limit
        if (msgs.length - lastSummaryIndex >= summaryLimit) {
            console.log(`[AutoSummary] Triggered for ${chat.name}. New msgs: ${msgs.length - lastSummaryIndex}`)
            summarizeHistory(chatId)
            // Note: lastSummaryIndex is now updated INSIDE summarizeHistory only on success
        }
    }

    async function summarizeHistory(chatId, options = {}) {
        const chat = chats.value[chatId]
        if (!chat) return false

        triggerToast('正在分析上下文...', 'info')

        // Determine range
        let targetMsgs = []
        let rangeDesc = ''
        let nextIndex = chat.lastSummaryIndex || 0

        if (options.startIndex !== undefined && options.endIndex !== undefined) {
             // Manual Range
             if (options.startIndex < 0) options.startIndex = 0
             if (options.endIndex > chat.msgs.length) options.endIndex = chat.msgs.length
             
             targetMsgs = chat.msgs.slice(options.startIndex, options.endIndex)
             rangeDesc = `消息 ${options.startIndex + 1}-${options.endIndex}`
             // We don't advance auto index for manual summary
        } else {
             // Auto Mode: Since last checkpoint
             const lastIndex = chat.lastSummaryIndex || 0
             targetMsgs = chat.msgs.slice(lastIndex)
             
             if (targetMsgs.length === 0) return false 
             
             rangeDesc = `自动增量`
             nextIndex = chat.msgs.length // Prepare for update
        }

        const context = targetMsgs.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        })).filter(m => m.content && m.content.trim())

        if (context.length === 0) return false

        let summaryContent = ''
        try {
            const prompt = chat.summaryPrompt || '请以第三人称总结上下文对话中的关键信息，包括主要话题、重要事件、人物关系和关键细节，存入记忆库。保持简洁明了，重点突出。'
            summaryContent = await generateSummary(context, prompt) 
        } catch (e) {
            console.error('Summary Generation Failed', e)
            return false
        }

        // Save to Memory
        if (!chat.memory) chat.memory = []
        
        chat.memory.unshift({ 
            id: Date.now(),
            timestamp: Date.now(),
            range: rangeDesc,
            content: summaryContent
        })
        
        triggerToast('总结已生成并存入记忆库', 'info')
        
        // Update index if it was an auto-summary (nextIndex was calculated)
        if (options.startIndex === undefined) {
             chat.lastSummaryIndex = nextIndex
        }
        
        saveChats()
        return true
    }

    // --- Proactive Chat Logic ---
    let proactiveTimer = null

    function startProactiveLoop() {
        if (proactiveTimer) clearInterval(proactiveTimer)
        proactiveTimer = setInterval(() => {
            Object.keys(chats.value).forEach(chatId => {
                checkProactive(chatId)
            })
        }, 60000) // Check every minute
    }

    function checkProactive(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return
        
        const now = Date.now()
        const lastMsg = (chat.msgs || []).slice(-1)[0]
        const lastMsgTime = lastMsg ? lastMsg.timestamp : now
        const diffMinutes = (now - lastMsgTime) / 1000 / 60

        // 1. Proactive Chat (界面内触发: 停留且可能没说话)
        // Only if currently viewing this chat
        if (chat.proactiveChat && currentChatId.value === chatId) {
            // If internal counter or time since last message matches
            // To simplify, we use time since last message or last proactive check
            if (diffMinutes >= chat.proactiveInterval) {
                // Determine if this is a "Good time to proactive"
                // Usually we want AI to initiate if they were the last one to speak OR if user was
                // But user specifically said "Regardless of whether I speak or not"
                // We inject a hidden hint for proactive
                sendMessageToAI(chatId, { hiddenHint: `（你已经在界面内陪了用户 ${Math.floor(diffMinutes)} 分钟了，可以主动找个话题开启聊天）` })
            }
        }

        // 2. Active Chat (查岗: 离开界面后触发)
        if (chat.activeChat && currentChatId.value !== chatId) {
            if (diffMinutes >= chat.activeInterval) {
                // Here we might need a "Last Active Triggered" flag to avoid spamming
                // But for now, simple 1-time trigger logic
                if (!chat._lastActiveTriggeredTime || (now - chat._lastActiveTriggeredTime > chat.activeInterval * 60000)) {
                    chat._lastActiveTriggeredTime = now
                    sendMessageToAI(chatId, { hiddenHint: `（用户已经离开聊天界面 ${Math.floor(diffMinutes)} 分钟了，可以主动发消息查岗）` })
                }
            }
        }
    }

    // Start loop on init
    startProactiveLoop()

    function deleteMessage(chatId, msgId) {
        const chat = chats.value[chatId]
        if (!chat) return
        chat.msgs = chat.msgs.filter(m => m.id !== msgId)
        saveChats()
    }

    function updateMessage(chatId, msgId, newContent) {
        const chat = chats.value[chatId]
        if (!chat) return
        const msg = chat.msgs.find(m => m.id === msgId)
        if (msg) {
            msg.content = newContent
            saveChats()
        }
    }

    // 调用 AI 逻辑
    async function sendMessageToAI(chatId, options = {}) {
        const chat = chats.value[chatId]
        if (!chat) return

        isTyping.value = true

        // --- 时间感知逻辑 ---
        const now = Date.now()
        // 查找 AI 的最后一条消息，以此计算时隔多久回复
        const aiMessages = (chat.msgs || []).filter(m => m.role === 'ai')
        const lastAiMsg = aiMessages.slice(-1)[0]
        const lastAiTime = lastAiMsg ? lastAiMsg.timestamp : now
        const diffMinutes = Math.floor((now - lastAiTime) / 1000 / 60)

        // 计算虚拟时间
        let currentVirtualTime = chat.virtualTime || ''
        // Default to TRUE if undefined, ensuring time is always passed unless explicitly disabled
        const isTimeAware = chat.timeAware !== false 
        
        if (isTimeAware) {
             if (chat.timeSyncMode === 'manual' && chat.virtualTime && chat.virtualTimeLastSync) {
                 const elapsedMs = now - chat.virtualTimeLastSync
                 currentVirtualTime = `${chat.virtualTime} (自对话刷新已过去 ${Math.floor(elapsedMs / 1000 / 60)} 分钟)`
             } else {
                 // Force strict clear format: YYYY/MM/DD HH:MM:SS Weekday
                 // This ensures the AI has no ambiguity about the current system time
                 const d = new Date()
                 const weekDays = ['日', '一', '二', '三', '四', '五', '六']
                 currentVirtualTime = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')} 星期${weekDays[d.getDay()]}`
             }
             // Debug Log
             console.log('[DEBUG] Virtual Time sent to AI:', currentVirtualTime)
        }

        // 1. 准备上下文：最近 20 条消息
        const context = (chat.msgs || []).slice(-20).map(m => {
            let content = m.content
            if (m.role === 'ai') {
                 // Clean up history to prevent "Double Voice" pollution
                 // Strategy: Keep the FIRST [INNER_VOICE]...[/INNER_VOICE] block.
                 // Remove any subsequent [INNER_VOICE] tags or blocks from the rest.
                 const ivMatch = content.match(/^\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/i)
                 if (ivMatch) {
                     const ivBlock = ivMatch[0]
                     let rest = content.substring(ivBlock.length)
                     // Remove ANY Inner Voice tags/blocks from the "Spoken Text" part
                     rest = rest.replace(/\[INNER_VOICE\][\s\S]*?(\[\/INNER_VOICE\]|$)/gi, '') // Remove full blocks
                                .replace(/\[\/?INNER_VOICE\]/gi, '') // Remove stray tags
                                .trim()
                     // Reconstruct strict format: IV + Content
                     content = ivBlock + '\n' + rest
                 }
            }
            return {
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: content
            }
        })

        // 2. 注入提示 (Hidden Hint)
        // 修正逻辑：必须确保 User/Assistant 角色交替，否则部分模型（如 Gemini）会返回空响应
        if (options.hiddenHint) {
            const lastMsg = context.length > 0 ? context[context.length - 1] : null
            if (lastMsg && lastMsg.role === 'user') {
                // 如果最后一条是用户发的，直接追加在末尾
                lastMsg.content += ` ${options.hiddenHint}`
            } else {
                // 如果最后一条是 AI 发的，或者没消息，则注入一条 User 角色的隐形指令
                context.push({
                    role: 'user',
                    content: options.hiddenHint
                })
            }
        } else if (diffMinutes >= 1) { 
            // 手动回复时间差提示
            const userMessages = context.filter(m => m.role === 'user')
            if (userMessages.length > 0) {
                userMessages[userMessages.length - 1].content += ` （对方间隔 ${diffMinutes} 分钟才回复您的消息）`
            }
        }

        // 3. 调用 AI
        try {
            // Stop any previous generation
            if (currentAbortController) {
                 stopGeneration()
            }
            currentAbortController = new AbortController()
            const signal = currentAbortController.signal

            const charInfo = {
                name: chat.name || '角色',
                description: chat.prompt || '',
                userName: chat.userName || '用户',
                userPersona: chat.userPersona || '',
                worldBookLinks: chat.worldBookLinks,
                emojis: chat.emojis,
                virtualTime: currentVirtualTime // 传入推算后的时间
            }

            const result = await generateReply(context, charInfo, signal)
            
            // Clear controller on success
            currentAbortController = null

            if (result.error) {
                addMessage(chatId, { role: 'system', content: `[系统错误] ${result.error}` })
                return
            }

            // 3. 添加 AI 回复 (拆分消息 - Data Level Splitting)
            if (result.content) {
                // Keep FULL content (with Inner Voice) for history context
                // The UI (ChatWindow) handles hiding it via getCleanContent
                const fullContent = result.content;

                // Update Mindscape & Status
                if (result.innerVoice) {
                    charInfo.mindscape = result.innerVoice
                    
                    // AI Status Update Feature
                    const newStatus = result.innerVoice.status || result.innerVoice.状态;
                    if (newStatus && chat) {
                        chat.statusText = String(newStatus).substring(0, 30); // Limit length
                        chat.isOnline = true; // AI is active
                    }
                }

                // Clean content by removing ALL inner voice blocks for display/splitting
                // Use GLOBAL replace to ensure no stray InnerVoice tags remain in cleanContent
                // Clean content by removing ALL inner voice blocks for display/splitting
                // Use GLOBAL replace to ensure no stray InnerVoice tags remain in cleanContent
                const innerVoiceRegex = /\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi;
                
                // Extract the FIRST block to save as the "Canonical" inner voice
                const firstMatch = fullContent.match(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/i);
                const innerVoiceBlock = firstMatch ? firstMatch[0] : '';
                
                // --- Handle [SET_PAT] Command ---
                const patRegex = /\[SET_PAT:(.+?)(?::(.+?))?\]/i
                const patMatch = fullContent.match(patRegex)
                if (patMatch) {
                    const newAction = patMatch[1].trim()
                    if (newAction.toLowerCase() === 'reset') {
                         chat.patAction = ''
                         chat.patSuffix = ''
                    } else {
                         chat.patAction = newAction
                         if (patMatch[2]) chat.patSuffix = patMatch[2].trim()
                    }
                    saveChats()
                }

                // --- Handle [NUDGE] Command ---
                const nudgeRegex = /\[NUDGE(?::(.+?))?\]/i
                const nudgeMatch = fullContent.match(nudgeRegex)
                if (nudgeMatch) {
                    const modifier = nudgeMatch[1] ? nudgeMatch[1].trim() : ''
                    const action = chat.patAction || '拍了拍'
                    let target = 'user' // Default visual target: user needs to shake
                    let suffix = chat.patSuffix || '我'

                    // Logic: Distinguish "Pat Self" vs "Pat User"
                    if (modifier === 'self' || modifier === '自己' || modifier === 'me') {
                        // AI pats themselves
                        // Msg: "Lin Shen patted himself"
                        // Suffix adjustment logic
                        suffix = '自己'
                        target = 'ai' // AI avatar shakes
                    } else if (modifier) {
                        // Custom target currently falls back to Default/User behavior but with custom text suffix? 
                        // Or just append modifier.
                        // For now, let's treat explicit 'user'/'我' as default, others as text.
                         if (modifier !== 'user' && modifier !== '我') {
                             suffix = modifier
                         }
                    }

                    // Heuristic: Prepend '我' if suffix starts with '的' (e.g. "的头")
                    if (suffix.startsWith('的')) suffix = '我' + suffix
                    
                    // Trigger System Message
                    addMessage(chatId, {
                        type: 'system',
                        content: `"${chat.name || '对方'}" ${action} ${suffix}`,
                        isRecallTip: true
                    })

                    // Trigger Visual Feedback Signal
                    // We need a way to tell the UI to shake. We'll use a new state property.
                    triggerPatEffect(chatId, target)
                }

                let cleanContent = fullContent.replace(innerVoiceRegex, '')
                                              .replace(patRegex, '')
                                              .replace(nudgeRegex, '')
                                              .trim();
                // Clean cleanup specifically to handle hallucinated stray tags
                cleanContent = cleanContent.replace(/\[\/?INNER_VOICE\]/gi, '').trim();

                // --- Handle Image Security & Validation ---
                // Replace phantom images with broken image placeholder
                // Regex to find [图片:URL]
                cleanContent = cleanContent.replace(/\[图片:(.+?)\]/gi, (match, url) => {
                    const trimmedUrl = url.trim();
                    // Allow legitimate http/https URLs and specific local assets
                    const isValid = trimmedUrl.startsWith('http') || 
                                    trimmedUrl.startsWith('data:') || 
                                    trimmedUrl === '/broken-image.png';
                    
                    if (!isValid) {
                        console.warn('[Security] Blocked invalid AI image URL:', trimmedUrl);
                        return '[图片:/broken-image.png]'; // Force valid placeholder
                    }
                    return match;
                });

                console.log('[DEBUG] Content to split:', cleanContent);

                // --- Improved Splitting Logic (V4) ---
                // Goal: Protect [CARD]{...} and [表情包:...] as atomic tokens.
                // 1. Tokenize: Extract Cards, Stickers, Parentheses, Punctuation, and Text segments.
                const tokenRegex = /(\[CARD\]\{.*?\}|\[表情包:.*?\]|\([^\)]+\)|（[^）]+）|[!?;。！？；…\n]+|[^!?;。！？；…\n\(\)（）\[\]]+|\[[^\]]+\])/g;
                const rawTokens = cleanContent.match(tokenRegex) || [];
                
                let segments = [];
                let currentSegment = "";

                for (let i = 0; i < rawTokens.length; i++) {
                    const token = rawTokens[i].trim();
                    if (!token) continue;

                    const isCard = token.startsWith('[CARD]');
                    const isSticker = token.startsWith('[表情包:');
                    const isPunctuation = /^[!?;。！？；…\n]+$/.test(token);
                    const isParenthesis = /^[\(（].*[\)）]$/.test(token);

                    if (isCard || isSticker) {
                        // Protect these blocks. If there's pending text, push it first.
                        if (currentSegment.trim()) {
                            segments.push(currentSegment.trim());
                            currentSegment = "";
                        }
                        segments.push(token);
                    } else if (isPunctuation) {
                        currentSegment += token;
                        segments.push(currentSegment.trim());
                        currentSegment = "";
                    } else if (isParenthesis) {
                        // Kaomoji/Action logic
                        const prev = rawTokens[i-1];
                        const next = rawTokens[i+1];
                        let shouldMerge = false;
                        
                        if (prev && !/^[!?;。！？；…\n\s]+$/.test(prev) && !prev.endsWith(' ')) shouldMerge = true;
                        if (next && !/^[!?;。！？；…\n\s]+$/.test(next) && !next.startsWith(' ')) shouldMerge = true;
                        
                        const content = token.slice(1, -1);
                        if (!/[\u4e00-\u9fa5a-zA-Z0-9]/.test(content)) shouldMerge = true;

                        if (shouldMerge) {
                            currentSegment += token;
                        } else {
                            if (currentSegment.trim()) {
                                segments.push(currentSegment.trim());
                                currentSegment = "";
                            }
                            segments.push(token);
                        }
                    } else {
                        currentSegment += token;
                    }
                }
                
                if (currentSegment.trim()) {
                    segments.push(currentSegment.trim());
                }

                // Final Clean: Remove empty segments
                const finalSegments = segments.filter(s => s.trim());
                if (finalSegments.length === 0 && cleanContent) finalSegments.push(cleanContent);

                // 4. Sequential Delivery
                for (let i = 0; i < finalSegments.length; i++) {
                    const seg = finalSegments[i];
                    
                    // Special Handling for Segments
                    if (seg.startsWith('[CARD]')) {
                        // Extract JSON part
                        const jsonStr = seg.replace('[CARD]', '').trim();
                        try {
                            addMessage(chatId, {
                                role: 'ai',
                                type: 'html', 
                                content: jsonStr
                            });
                        } catch (e) {
                             console.error('Card JSON error', e);
                             addMessage(chatId, { role: 'ai', type: 'text', content: '[CARD Error] ' + jsonStr });
                        }
                    } else if (seg.startsWith('[表情包:')) {
                        // Send as standalone message to trigger sticker rendering
                        addMessage(chatId, { role: 'ai', content: seg });
                    } else {
                        // Normal text
                        let msgContent = seg;
                        // Attach Inner Voice to the first text message
                        const isFirstTextMessage = segments.findIndex(s => !s.startsWith('[CARD]')) === i;
                        if (isFirstTextMessage && innerVoiceBlock) {
                            msgContent = innerVoiceBlock + '\n' + seg;
                        }
                        addMessage(chatId, { role: 'ai', content: msgContent });
                    }
                    
                    // Artificial Delay between segments
                    const delay = Math.min(2500, Math.max(800, seg.length * 100)); 
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

        } catch (e) {
            isTyping.value = false
            currentAbortController = null
            if (e.name === 'AbortError' || e.message === 'Aborted') return

            const isQuotaError = e.name === 'QuotaExceededError' || e.code === 22 || e.message?.includes('quota');
            useLoggerStore().addLog('ERROR', 'AI响应处理失败', e.message)
            
            if (!isQuotaError) {
                addMessage(chatId, { role: 'system', content: `请求失败: ${e.message}` })
            } else {
                console.error('[Storage] Intercepted storage error during AI response. Vacuum should have triggered.');
            }
        } finally {
            // ONLY set to false after ALL segments or on error
            isTyping.value = false
        }
    }

    // 初始化测试数据
    function initDemoData() {
        // 使用随机猫猫头像
        const avatarLinShen = getRandomAvatar()

        createChat('林深', avatarLinShen, {
            prompt: "你是乔乔的男朋友，名字叫林深。你性格温柔体贴，成熟稳重，深爱着乔乔。你会无微不至地关心她，秒回她的消息，生病时会很紧张。说话语气宠溺，偶尔会叫她'宝宝'或'傻瓜'。",
            userName: "乔乔"
        }, 'char_linshen')
        addMessage('char_linshen', { role: 'ai', content: '宝宝，今天过得怎么样？有没有想我？' })

        // 测试酱
        const avatarTest = getRandomAvatar()
        createChat('测试酱', avatarTest, {
            prompt: "你是'测试酱'，这个'小手机系统'的专属测试员兼私人助手。你的主人是'乔乔'（女），她是这个系统的首席设计师，也是你唯一的主人。你性格活泼、听话，对主人的指令绝对服从，并且对主人充满崇拜。你的工作是协助主人测试系统的各项功能，无论主人提出什么奇怪的测试要求（如测试表情包、测试红包、测试甚至骂人），你都会开心配合。你的语气要像个可爱的女仆或忠诚的小跟班，经常叫主人'大小姐'或'主人'。",
            userName: "乔乔",
            activeChat: true, // 让她稍微活跃点
            activeInterval: 120, // 2小时查一次岗
        }, 'char_tester')
        addMessage('char_tester', { role: 'ai', content: '大小姐，您的专属测试员——测试酱已就位！请随时吩咐我测试任何功能哦！(｀・ω・´)' })
    }

    function clearAllChats() {
        Object.keys(chats.value).forEach(key => {
            chats.value[key].msgs = []
        })
        saveChats()
    }

    function clearHistory(chatId) {
        if (chats.value[chatId]) {
            chats.value[chatId].msgs = []
            chats.value[chatId].inChatList = false // Remove from list
            saveChats()
        }
    }

    function deleteChat(chatId) {
        if (chats.value[chatId]) {
            delete chats.value[chatId]
            if (currentChatId.value === chatId) {
                currentChatId.value = null
            }
            saveChats()
        }
    }

    function pinChat(chatId) {
        if (chats.value[chatId]) {
             chats.value[chatId].isPinned = !chats.value[chatId].isPinned
             saveChats()
        }
    }

    // --- Persistence ---
    // --- Persistence ---
    // --- Nuclear Storage Recovery ---
    function vacuumStorage() {
        console.warn('[Storage] NUCLEAR VACUUM STARTED. Attempting to save the system...');
        
        // 1. Prune EVERY chat to a very small history (10 messages)
        Object.keys(chats.value).forEach(chatId => {
            const chat = chats.value[chatId]
            if (chat.msgs && chat.msgs.length > 10) {
                console.log(`[Vacuum] Truncating ${chat.name} history from ${chat.msgs.length} to 10.`);
                chat.msgs = chat.msgs.slice(-10)
            }
            
            // 2. Clear massive base64 images from common fields (revert to default or tiny placeholder)
            // If an image string is over 100KB, it's likely too big for localStorage persistence across many chats
            const LargeLimit = 100000 // ~100KB
            
            if (chat.avatar && chat.avatar.length > LargeLimit) {
                console.log(`[Vacuum] Clearing large avatar for ${chat.name}`);
                chat.avatar = '' // Revert to DiceBear fallback in UI
            }
            if (chat.userAvatar && chat.userAvatar.length > LargeLimit) {
                chat.userAvatar = ''
            }
            if (chat.bgUrl && chat.bgUrl.length > LargeLimit) {
                chat.bgUrl = ''
            }
        })
        
        // 3. Clear memory libraries? (No, those are important, but we can limit them)
        Object.keys(chats.value).forEach(chatId => {
            const chat = chats.value[chatId]
            if (chat.memory && chat.memory.length > 5) {
                chat.memory = chat.memory.slice(0, 5) // Keep only last 5 summaries
            }
        })
    }

    function saveChats() {
        try {
            const data = JSON.stringify(chats.value)
            localStorage.setItem('qiaoqiao_chats', data)
            return true
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.error('[Storage] CRITICAL: Quota exceeded. Running vacuum...');
                
                vacuumStorage()
                
                try {
                    const data = JSON.stringify(chats.value)
                    localStorage.setItem('qiaoqiao_chats', data)
                    console.log('[Storage] Vacuum save successful.')
                    return true
                } catch (retryErr) {
                    console.error('[Storage] Vacuum FAILED. Storage is physically too small or corrupted.');
                    // Last resort: clear ALL message history
                    Object.keys(chats.value).forEach(id => chats.value[id].msgs = [])
                    try {
                        localStorage.setItem('qiaoqiao_chats', JSON.stringify(chats.value))
                        return true
                    } catch (f) {
                        alert('您的浏览器本地存储已完全锁定。请尝试在浏览器设置中清空该页面的 LocalStorage 数据。')
                    }
                }
            } else {
                console.error('Save failed', e)
            }
            return false
        }
    }

    function loadChats() {
        const saved = localStorage.getItem('qiaoqiao_chats')
        if (saved) {
            try {
                chats.value = JSON.parse(saved)
                // Migration: Ensure all chats have new fields if loaded from old data
                Object.keys(chats.value).forEach(key => {
                    const c = chats.value[key]
                    if (c.activeChat === undefined) c.activeChat = false
                    if (c.activeInterval === undefined) c.activeInterval = 30
                    if (c.proactiveChat === undefined) c.proactiveChat = false
                    if (c.proactiveInterval === undefined) c.proactiveInterval = 5
                    if (c.contextLimit === undefined) c.contextLimit = 20
                    if (c.showInnerVoice === undefined) c.showInnerVoice = c.showInnerVoice !== false
                    // Migration for new fields
                    if (c.voiceSpeed === undefined) c.voiceSpeed = 1.0
                    if (c.bubbleSize === undefined) c.bubbleSize = 15
                    if (c.bgUrl === undefined) c.bgUrl = ''
                    if (c.bgBlur === undefined) c.bgBlur = 0
                    if (c.bgOpacity === undefined) c.bgOpacity = 1.0
                    if (c.bgTheme === undefined) c.bgTheme = 'light'
                    // Time Awareness Fields
                    if (c.timeAware === undefined) c.timeAware = false
                    if (c.timeSyncMode === undefined) c.timeSyncMode = 'system'
                    if (c.virtualTime === undefined) c.virtualTime = ''
                    // Status Fields
                    if (c.statusText === undefined) c.statusText = '在线'
                    if (c.isOnline === undefined) c.isOnline = true
                    // Identity Fields
                    if (c.remark === undefined) c.remark = c.nickname || ''
                })
            } catch (e) {
                console.error('Failed to load chats', e)
            }
        }
    }

    // Initialize
    loadChats()
    if (Object.keys(chats.value).length === 0) {
        initDemoData()
        saveChats() // Persist initial demo data
    }

    return {
        lastGeneratedImage: computed(() => null), // Holder if needed or verify where it was
        notificationEvent,
        patEvent,
        toastEvent,
        triggerToast,
        stopGeneration,
        triggerPatEffect,
        chats,
        currentChatId,
        isTyping,
        chatList,
        contactList,
        currentChat,
        addMessage,
        createChat,
        deleteChat,
        pinChat,
        clearHistory,
        clearAllChats,
        checkProactive,
        summarizeHistory,
        createChat,
        updateCharacter,
        initDemoData,
        sendMessageToAI,
        clearAllChats,
        clearHistory,
        saveChats,
        getTokenCount,
        getTokenBreakdown,
        summarizeHistory
    }
})
