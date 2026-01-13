import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { generateReply, generateSummary, generateImage } from '../utils/aiService'
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

    // Pagination State
    const messagePageSize = ref(50) // 每页显示50条消息
    const loadedMessageCounts = ref({}) // { chatId: 加载的消息数 }

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

    function stopGeneration(silent = false) {
        if (currentAbortController) {
            currentAbortController.abort()
            currentAbortController = null
            isTyping.value = false
            console.log('[ChatStore] AI Generation stopped by user.')
            if (!silent) {
                triggerToast('已中断生成', 'info')
            }
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
            id: msg.id || ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)),
            timestamp: msg.timestamp || Date.now(),
            role: msg.role,
            type: msg.type || 'text',
            content: msg.content || '',
            amount: msg.amount || 0,
            note: msg.note || '',
            isClaimed: msg.isClaimed || false,
            claimedBy: msg.claimedBy || null,
            claimTime: msg.claimTime || null,
            duration: msg.duration || 0,
            quote: msg.quote || null,
            paymentId: msg.paymentId || null // Initialize paymentId
        }

        // 1.1 Critical: Ensure all payment messages have paymentId and standardized content
        if ((newMsg.type === 'redpacket' || newMsg.type === 'transfer') && !newMsg.paymentId) {
            newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
        }

        // 1.2 Rewrite content to canonical format [类型:金额:备注:ID] for AI context
        if (newMsg.type === 'redpacket' && newMsg.paymentId) {
            newMsg.content = `[红包:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
        } else if (newMsg.type === 'transfer' && newMsg.paymentId) {
            newMsg.content = `[转账:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
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
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '恭喜发财，大吉大利'
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    // Rewrite content with ID for AI context
                    newMsg.content = `[红包:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                } else if (tagType === '转账') {
                    newMsg.type = 'transfer'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '转账给您'
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.content = `[转账:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
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
            } else {
                // 2.1 Fallback: Loose Parsing for User Inputs like "[转账] 520元" or "[红包] 恭喜发财"
                const looseMatch = detectionContent.match(/^[\[【](发红包|红包|转账)[\]】]\s*(.*)/i);
                if (looseMatch) {
                    const tagType = looseMatch[1];
                    const rawText = looseMatch[2].trim();

                    // Attempt to extract amount (first number found)
                    const amountMatch = rawText.match(/(\d+(?:\.\d+)?)/);
                    const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;

                    // Note is the rest of the text, or default
                    let note = rawText;
                    if (amountMatch) {
                        // Remove amount and common currency suffixes from note
                        note = rawText.replace(amountMatch[0], '').replace(/(元|块|CNY)/gi, '').trim();
                    }
                    if (!note) note = tagType === '转账' ? '转账给您' : '恭喜发财';

                    newMsg.type = (tagType === '发红包' || tagType === '红包') ? 'redpacket' : 'transfer';
                    newMsg.amount = amount;
                    newMsg.note = note;
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                    // Rewrite content with ID
                    const typeLabel = newMsg.type === 'redpacket' ? '红包' : '转账';
                    newMsg.content = `[${typeLabel}:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`;
                }
            }
        }

        // 3. Robust AI Payment Handling (ID-based)
        if (newMsg.role === 'ai') {
            // Handle AI claiming by ID: [领取红包:PAY-xxx] or [领取转账:PAY-xxx]
            const claimRegex = /\[领取(红包|转账):([^\]]+)\]/g;
            let claimMatch;
            const claimedPayments = [];
            while ((claimMatch = claimRegex.exec(newMsg.content)) !== null) {
                const paymentType = claimMatch[1];
                const paymentId = claimMatch[2].trim();
                const targetMsg = chat.msgs.find(m => m.paymentId === paymentId);
                if (targetMsg && !targetMsg.isClaimed && !targetMsg.isRejected) {
                    targetMsg.isClaimed = true;
                    targetMsg.claimTime = Date.now();
                    targetMsg.claimedBy = { name: chat.name, avatar: chat.avatar };
                    console.log(`[ChatStore] AI claimed payment ${paymentId}`);
                    claimedPayments.push(paymentType);
                }
            }

            // Handle AI rejecting by ID: Support all variations
            // [拒收红包], [退回红包], [拒收转账], [退回转账]
            const rejectRegex = /\[(拒收|退回)(红包|转账):([^\]]+)\]/g;
            let rejectMatch;
            const rejectedPayments = [];
            while ((rejectMatch = rejectRegex.exec(newMsg.content)) !== null) {
                const paymentType = rejectMatch[2];
                const paymentId = rejectMatch[3].trim(); // Note: group 3 now, not 2
                const targetMsg = chat.msgs.find(m => m.paymentId === paymentId);
                if (targetMsg && !targetMsg.isClaimed && !targetMsg.isRejected) {
                    targetMsg.isRejected = true;
                    targetMsg.rejectTime = Date.now();
                    console.log(`[ChatStore/addMessage] AI rejected ${paymentId}`);
                    rejectedPayments.push(paymentType);
                }
            }

            // Clean operation tags from content
            newMsg.content = newMsg.content
                .replace(/\[领取(红包|转账):[^\]]+\]/g, '')
                .replace(/\[(拒收|退回)(红包|转账):[^\]]+\]/g, '')
                .trim();

            if (!newMsg.content && (claimMatch || rejectMatch)) return saveChats(); // Pure operation

            // Add system messages for claims/rejects (AFTER AI's message is added)
            if (claimedPayments.length > 0 || rejectedPayments.length > 0) {
                // We'll add these after pushing newMsg
                newMsg._pendingSystemMessages = [];
                claimedPayments.forEach(type => {
                    newMsg._pendingSystemMessages.push({
                        id: crypto.randomUUID(),
                        role: 'system',
                        type: 'text',
                        content: `${chat.name}领取了你的${type}`,
                        timestamp: Date.now() + 50
                    });
                });
                rejectedPayments.forEach(type => {
                    newMsg._pendingSystemMessages.push({
                        id: crypto.randomUUID(),
                        role: 'system',
                        type: 'text',
                        content: `${chat.name}拒收了你的${type}`,
                        timestamp: Date.now() + 100
                    });
                });
            }

            // Handle AI Sending [发红包:100:祝福语]
            // Handle AI Sending [发红包:100:祝福语]
            // [FIX] Only parse if type is text. If it is already redpacket/transfer (from sendMessageToAI), DO NOT re-parse, 
            // because content already contains ID which this regex would incorrectly include in the note.
            if (newMsg.type === 'text') {
                const pRegex = /\[(发红包|转账)[:：](\d+(?:\.\d{1,2})?)[:：]?(.*?)\]/i
                const pMatch = newMsg.content.match(pRegex)
                if (pMatch) {
                    const action = pMatch[1]
                    newMsg.type = action === '发红包' ? 'redpacket' : 'transfer'
                    newMsg.amount = parseFloat(pMatch[2])
                    if (isNaN(newMsg.amount) || newMsg.amount <= 0.01) newMsg.amount = (Math.random() * 100 + 1).toFixed(2); // Fallback for invalid/zero amount
                    newMsg.note = pMatch[3] || (action === '发红包' ? '恭喜发财，大吉大利' : '转账给您')
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.isClaimed = false
                    newMsg.isRejected = false
                    newMsg.content = ''
                }
            }
        }

        // 4. Persistence
        if (!chat.msgs) chat.msgs = []
        chat.msgs.push(newMsg)

        // 4.1 Insert pending system messages (if any)
        if (newMsg._pendingSystemMessages && newMsg._pendingSystemMessages.length > 0) {
            chat.msgs.push(...newMsg._pendingSystemMessages)
            delete newMsg._pendingSystemMessages // Clean up
        }

        // Log message action
        const logger = useLoggerStore()
        const logContent = typeof newMsg.content === 'string'
            ? newMsg.content
            : (Array.isArray(newMsg.content) ? '[多媒体消息]' : String(newMsg.content || ''))

        logger.info(`${newMsg.role === 'user' ? '发送' : '接收'}消息: ${chat.name}`, {
            type: newMsg.type,
            content: logContent.substring(0, 50) + (logContent.length > 50 ? '...' : '')
        })

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
        saveChats()
        return newMsg
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
                summaryPrompt: '以第一人称（我）的视角，写一段简短的日记，记录刚才发生了什么，重点记录对方的情绪和我自己的感受。',
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
                momentsMemoryLimit: 5,
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
                timeAware: options.timeAware !== undefined ? options.timeAware : false,
                avatarShape: options.avatarShape || 'square',
                avatarFrame: options.avatarFrame || null,
                userAvatarFrame: options.userAvatarFrame || null
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

        // 5. History (Context Window - Optimized Estimate)
        const limit = chat.contextLimit || 20
        const historyMsgs = (chat.msgs || []).slice(-limit)

        // Estimate token usage based on "Optimization Strategy":
        // Base64 images are NOT sent, only IDs are sent (~50 chars).
        let historyToken = 0
        historyMsgs.forEach(m => {
            let contentLen = 0
            if (typeof m.content === 'string') {
                if (m.content.startsWith('data:image')) {
                    contentLen = 50 // ID ref
                } else if (m.content.length > 500 && /data:image\/[^;]+;base64/.test(m.content)) {
                    // Embedded
                    contentLen = m.content.replace(/\[图片:data:image\/[^\]]+\]/g, '[IMG_REF]').length
                } else {
                    contentLen = m.content.length
                }
            } else {
                contentLen = JSON.stringify(m.content).length
            }
            historyToken += Math.floor(contentLen * 1.2)
        })

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

        // Prevent concurrent execution (Fix Double Toast)
        if (chat.isSummarizing) return

        const msgs = chat.msgs || []
        const summaryLimit = parseInt(chat.summaryLimit) || 50
        const lastSummaryIndex = chat.lastSummaryIndex || 0

        // Check if new messages exceed limit
        if (msgs.length - lastSummaryIndex >= summaryLimit) {
            console.log(`[AutoSummary] Triggered for ${chat.name}. New msgs: ${msgs.length - lastSummaryIndex}`)
            summarizeHistory(chatId)
        }
    }

    async function summarizeHistory(chatId, options = {}) {
        const chat = chats.value[chatId]
        if (!chat) return { success: false, error: 'Chat not found' }

        // Double check lock
        if (chat.isSummarizing) return { success: false, error: 'Summarization already in progress' }
        chat.isSummarizing = true

        triggerToast('正在分析上下文...', 'info')

        // Determine range
        let targetMsgs = []
        let rangeDesc = ''
        let nextIndex = chat.lastSummaryIndex || 0

        try {
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

                if (targetMsgs.length === 0) {
                    throw new Error('No new messages to summarize')
                }

                rangeDesc = `自动增量`
                nextIndex = chat.msgs.length // Prepare for update
            }

            // --- REPLICATED FROM OLD HTML (Transcript Mode) ---
            const transcript = targetMsgs.map(m => {
                const roleName = m.role === 'ai' ? (chat.name || 'AI') : (chat.userName || '用户')
                let content = ""
                if (typeof m.content === 'string') {
                    content = m.content
                } else if (Array.isArray(m.content)) {
                    content = m.content.map(p => p.text || '').join('\n')
                } else {
                    content = String(m.content || '')
                }

                // Clean up internal tags for the transcript
                content = content.replace(/\[Image Reference ID:.*?\]/g, '[图片]')

                // Handle special types
                if (m.type === 'image') content = '[图片]'
                if (m.type === 'voice') content = '[语音]'
                if (m.type === 'redpacket') content = '[红包]'
                if (m.type === 'transfer') content = '[转账]'
                if (m.type === 'moment_card') content = '[分享了朋友圈]'

                return `${roleName}: ${content}`
            }).filter(line => line.trim().length > 0).join('\n')

            if (!transcript.trim()) {
                throw new Error('Empty context (selected messages contain no valid text)')
            }

            const prompt = chat.summaryPrompt || '以第一人称（我）的视角，写一段简短的日记，记录刚才发生了什么，重点记录对方的情绪和我自己的感受。'

            // Pack into a single User message with the Instruction at the end (Best for LLMs)
            const summaryContext = [
                {
                    role: 'user',
                    content: `【对话记录】\n${transcript}\n\n【总结要求】\n${prompt}`
                }
            ]

            let summaryContent = ''
            const systemHelper = '你是一个专业的对话总结助手。请阅读上方记录，并严格按照总结要求输出内容。直接输出总结，不要包含任何旁白。'

            // Log for context review tab (Matches standard chat log format)
            useLoggerStore().addLog('AI', '网络请求 (生成总结)', {
                provider: 'summarize-helper',
                endpoint: 'Internal -> AI Service',
                payload: {
                    model: 'Summarize Mode',
                    messages: [
                        { role: 'system', content: systemHelper },
                        ...summaryContext
                    ],
                    prompt: prompt
                }
            })

            summaryContent = await generateSummary(summaryContext, systemHelper)

            if (!summaryContent || summaryContent.startsWith('总结生成失败')) {
                throw new Error(summaryContent || 'AI returned empty content')
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
            return { success: true }

        } catch (e) {
            console.error('Summary Generation Failed or Aborted', e)
            triggerToast('总结失败: ' + e.message, 'error')
            return { success: false, error: e.message }
        } finally {
            // Always release lock
            chat.isSummarizing = false
        }
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

    function updateMessage(chatId, msgId, updates) {
        console.log('[ChatStore updateMessage] START:', { chatId, msgId, updates })
        const chat = chats.value[chatId]
        if (!chat) {
            console.error('[ChatStore] Chat not found:', chatId)
            return
        }

        // Find message index
        const idx = chat.msgs.findIndex(m => m.id === msgId)
        if (idx === -1) {
            console.error('[ChatStore] Message not found:', msgId)
            return
        }

        // Create completely new message object
        const oldMsg = chat.msgs[idx]
        const newMsg = {
            ...oldMsg,
            ...(typeof updates === 'string' ? { content: updates } : updates)
        }

        console.log('[ChatStore] Old message:', oldMsg)
        console.log('[ChatStore] New message:', newMsg)

        // NUCLEAR OPTION: Completely rebuild the array
        const newMsgs = [
            ...chat.msgs.slice(0, idx),
            newMsg,
            ...chat.msgs.slice(idx + 1)
        ]

        // Triple-layer reactivity flush
        chat.msgs = newMsgs
        chats.value[chatId] = { ...chat, msgs: newMsgs }
        chats.value = { ...chats.value }

        saveChats()
        console.log('[ChatStore updateMessage] COMPLETE. State flushed 3x.')
    }

    function deleteMessages(chatId, msgIds) {
        const chat = chats.value[chatId]
        if (!chat) return

        const originalCount = chat.msgs.length
        // Convert strict Set/Array to Set for lookup
        const idsToRemove = new Set(msgIds)

        chat.msgs = chat.msgs.filter(m => !idsToRemove.has(m.id))

        if (chat.msgs.length !== originalCount) {
            saveChats()
            return true
        }
        return false
    }

    // 调用 AI 逻辑
    async function sendMessageToAI(chatId, options = {}) {
        const chat = chats.value[chatId]
        if (!chat) return

        // --- Silent Sharing Interception ---
        const lastMsg = (chat.msgs || []).slice(-1)[0]
        if (lastMsg && lastMsg.type === 'moment_card' && !options.force) {
            console.log('[ChatStore] Silent sharing active. AI will not reply to moment_card until next user message.')
            isTyping.value = false // Ensure typing indicator is off
            return
        }

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
                currentVirtualTime = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')} 星期${weekDays[d.getDay()]}`
            }
            // Debug Log
            console.log('[DEBUG] Virtual Time sent to AI:', currentVirtualTime)
        }

        // 1. 准备上下文：根据设置动态截取消息历史
        const contextLimit = chat.contextLimit || 20
        const context = (chat.msgs || []).slice(-contextLimit).map(m => {
            // Ensure content is a string for processing (handles multimodal messages)
            let content = ""
            if (typeof m.content === 'string') {
                content = m.content
            } else if (Array.isArray(m.content)) {
                // If multimodal, extract text parts for history cleaning logic
                content = m.content.map(p => p.text || '').join('\n')
            } else {
                content = String(m.content || '')
            }

            // Format Moment Card for AI perception
            if (m.type === 'moment_card') {
                try {
                    const data = JSON.parse(content)
                    content = `[用户分享了一条朋友圈动态] 作者: ${data.author}, 文案: ${data.text}${data.image ? ' (包含一张图片)' : ''}`
                } catch (e) {
                    content = '[朋友圈动态]'
                }
            }

            if (m.role === 'ai') {
                // Clean up history to prevent "Double Voice" pollution
                const ivMatch = content.match(/^\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/i)
                if (ivMatch) {
                    const ivBlock = ivMatch[0]
                    let rest = content.substring(ivBlock.length)
                    rest = rest.replace(/\[INNER_VOICE\][\s\S]*?(\[\/INNER_VOICE\]|$)/gi, '')
                        .replace(/\[\/?INNER_VOICE\]/gi, '')
                        .trim()
                    content = ivBlock + '\n' + rest
                }
            }
            if (m.quote) {
                const quoteAuthor = m.quote.role === 'user' ? '我' : (chat.name || '对方')
                const quoteContent = typeof m.quote.content === 'string'
                    ? m.quote.content
                    : (Array.isArray(m.quote.content) ? m.quote.content.map(p => p.text || '').join(' ') : String(m.quote.content || ''))
                content = `（引用来自 ${quoteAuthor} 的消息: "${quoteContent}"）\n${content}`
            }

            return {
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: content,
                type: m.type || 'text'
            }
        })

        // 2. 注入提示 (Hidden Hint)
        // 修正逻辑：必须确保 User/Assistant 角色交替，否则部分模型（如 Gemini）会返回空响应
        if (options.hiddenHint) {
            const lastMsg = context.length > 0 ? context[context.length - 1] : null
            if (lastMsg && lastMsg.role === 'user') {
                // 如果最后一条是用户发的，直接追加在末尾 (STRICT CHECK: Text Only)
                if (lastMsg.type === 'text' && !lastMsg.content.includes('data:image/')) {
                    lastMsg.content += ` ${options.hiddenHint}`
                }
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
                const lastUserMsg = userMessages[userMessages.length - 1]
                // STRICT CHECK: Only append to text messages
                if (lastUserMsg.type === 'text' && !lastUserMsg.content.includes('data:image/')) {
                    lastUserMsg.content += ` （对方间隔 ${diffMinutes} 分钟才回复您的消息）`
                }
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

            let momentsAwareness = '' // Placeholder for moments context

            const charInfo = {
                name: chat.name || '角色',
                description: (chat.prompt || '') + momentsAwareness,
                memory: chat.memory || [],
                userName: chat.userName || '用户',
                userPersona: chat.userPersona || '',
                worldBookLinks: chat.worldBookLinks,
                emojis: chat.emojis,
                virtualTime: currentVirtualTime,
                canDraw: true
            }

            // Inject Drawing Capability Hint globally if not explicitly disabled
            const drawingHint = `\n\n【生图功能激活】\n你可以通过指令 [DRAW: 英文提示词] 直接在聊天中发送图片给用户。
例如：你想给用户发张自拍，可以说：“等等，我给你发张自拍 [DRAW: a cute anime girl taking a selfie, looking at camera]”
请注意：
1. 提示词必须是英文。
2. 只有在真正需要发图时才使用该指令。`
            charInfo.description += drawingHint

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

                // --- Handle Quote (REPLY) ---
                const replyRegex = /^\[REPLY:\s*(.*?)\]/i;
                const replyMatch = fullContent.match(replyRegex);
                let aiQuote = null;
                if (replyMatch && chat.msgs) {
                    const keyword = replyMatch[1].trim();
                    const quotedMsg = chat.msgs.findLast(m =>
                        m.role === 'user' &&
                        (m.content?.includes(keyword) || (m.type === 'text' && m.content === keyword))
                    );
                    if (quotedMsg) {
                        aiQuote = {
                            id: quotedMsg.id,
                            name: '我',
                            text: quotedMsg.content,
                            timestamp: quotedMsg.timestamp
                        };
                    }
                }

                // --- Handle [NUDGE] Command ---
                const nudgeRegex = /\[NUDGE(?::(.+?))?\]/i;
                const nudgeMatch = fullContent.match(nudgeRegex);
                if (nudgeMatch) {
                    const modifier = nudgeMatch[1] ? nudgeMatch[1].trim() : '';
                    const action = chat.patAction || '拍了拍';
                    let target = 'user';
                    let suffix = chat.patSuffix || '我';

                    if (modifier === 'self' || modifier === '自己' || modifier === 'me') {
                        suffix = '自己';
                        target = 'ai';
                    } else if (modifier && modifier !== 'user' && modifier !== '我') {
                        suffix = modifier;
                    }

                    if (suffix.startsWith('的')) suffix = '我' + suffix;

                    addMessage(chatId, {
                        type: 'system',
                        role: 'system',
                        content: `"${chat.name || '对方'}" ${action} ${suffix}`,
                        isRecallTip: true
                    });
                    triggerPatEffect(chatId, target);
                }

                // --- Handle [MOMENT] Command ---
                const momentRegex = /\[MOMENT\]([\s\S]*?)\[\/MOMENT\]/i;
                const momentMatch = fullContent.match(momentRegex);
                if (momentMatch) {
                    try {
                        const jsonStr = momentMatch[1]
                        const momentData = JSON.parse(jsonStr)

                        if (momentData && momentData.content) {
                            // Call Moments Store to add
                            // We need to import aiService to generate images if needed? 
                            // Actually momentsStore.addMoment mainly takes raw data.
                            // If imagePrompt exists, we might need to resolve it.
                            // But for simplicity, we let momentsStore handle or we do it here.
                            // Let's assume we pass it to addMoment and let it handle or we enhance it here.
                            // Wait, momentsStore.addMoment expects { content, images: [] }

                            const newMoment = {
                                authorId: chatId, // The character ID
                                content: momentData.content,
                                images: [],
                                imageDescriptions: []
                            }

                            if (momentData.imagePrompt) {
                                // Use the centralized generateImage service instead of hardcoded URLs
                                const imageUrl = await generateImage(momentData.imagePrompt)
                                newMoment.images.push(imageUrl)
                                if (momentData.imageDescription) {
                                    newMoment.imageDescriptions.push(momentData.imageDescription)
                                }
                            }

                            momentsStore.addMoment(newMoment)

                            // Feedback in Chat
                            addMessage(chatId, {
                                type: 'system',
                                content: `"${chat.name}" 发布了一条朋友圈`,
                                isRecallTip: true
                            })
                        }
                    } catch (e) {
                        console.error('[ChatStore] Failed to parse [MOMENT]', e)
                    }
                }

                // --- Handle [SET_AVATAR] Command ---
                const setAvatarRegex = /\[SET_AVATAR[:：]\s*(.+?)\s*\]/gi  // Use GLOBAL flag to handle multiple occurrences
                let avatarMatch;
                // Loop to find the last valid avatar command (or first? let's stick to first for now but consume all)
                // Actually, let's just use the first valid one we find
                const firstAvatarMatch = setAvatarRegex.exec(fullContent);

                if (firstAvatarMatch) {
                    try {
                        let rawContent = firstAvatarMatch[1].trim();
                        let newAvatarUrl = '';

                        // Helper to find most recent valid image
                        const findLastImage = () => {
                            const reversed = [...chat.msgs].reverse();
                            const imgMsg = reversed.find(m => {
                                // Check message type image OR text with [图片:...]
                                if (m.type === 'image' && m.content && (m.content.startsWith('http') || m.content.startsWith('data:image'))) return true;
                                if (typeof m.content === 'string' && /\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]/i.test(m.content)) return true;
                                return false;
                            });
                            if (imgMsg) {
                                if (imgMsg.type === 'image') return imgMsg.content;
                                const match = imgMsg.content.match(/\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]/i);
                                return match ? match[1] : null;
                            }
                            return null;
                        };

                        // 1. Try URL extraction
                        let urlMatch = rawContent.match(/(https?:\/\/[^\s"'\)）]+|data:image\/[^\s"'\)）]+)/);

                        // Smart Logic: Verify URL existence to prevent Hallucination
                        if (urlMatch) {
                            const extractedUrl = urlMatch[0];
                            // Check if this URL actually exists in history (User input or AI generation)
                            const existsInHistory = chat.msgs.some(m => m.content && typeof m.content === 'string' && m.content.includes(extractedUrl));

                            if (existsInHistory) {
                                newAvatarUrl = extractedUrl;
                            } else {
                                console.warn('[ChatStore] AI provided a URL not found in history (Hallucination?):', extractedUrl);
                                // Fallback: Use the most recent image
                                newAvatarUrl = findLastImage();
                                if (newAvatarUrl) console.log('[ChatStore] Fallback to most recent image:', newAvatarUrl);
                            }
                        } else {
                            // 2. Try ID Lookup
                            const possibleId = rawContent.replace(/^["'\[\(]|["'\]\)]$/g, '').trim();
                            // Specific check for keywords
                            if (['curr', 'current', 'this', 'latest', 'image', 'undefined'].includes(possibleId.toLowerCase())) {
                                newAvatarUrl = findLastImage();
                            } else {
                                const targetMsg = chat.msgs.find(m => m.id === possibleId || (m.id && possibleId.includes(m.id)));
                                if (targetMsg) {
                                    if (targetMsg.type === 'image' && targetMsg.content && (targetMsg.content.startsWith('http') || targetMsg.content.startsWith('data:image'))) {
                                        newAvatarUrl = targetMsg.content;
                                    } else {
                                        const embeddedMatch = targetMsg.content?.match(/\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]/i);
                                        if (embeddedMatch) newAvatarUrl = embeddedMatch[1];
                                    }
                                } else {
                                    // ID not found, fallback to most recent image if input is short/ambiguous
                                    if (rawContent.length < 50) newAvatarUrl = findLastImage();
                                }
                            }
                        }

                        // Apply
                        if (newAvatarUrl && (newAvatarUrl.startsWith('http') || newAvatarUrl.startsWith('data:image'))) {
                            if (chat.avatar !== newAvatarUrl) {
                                console.log('[ChatStore] Updating Avatar:', newAvatarUrl);
                                chat.avatar = newAvatarUrl
                                saveChats()
                                triggerToast('对方更换了头像', 'info')
                            } else {
                                console.log('[ChatStore] Avatar is already set to this URL, skipping toast.');
                            }
                        } else {
                            console.warn('[ChatStore] Invalid Avatar URL ignored:', rawContent)
                        }
                    } catch (e) {
                        console.error('[ChatStore] Error processing SET_AVATAR:', e);
                    }
                }



                // --- Handle Payment Operations (ID-based) ---
                const claimRegex = /\[领取(红包|转账):([^\]]+)\]/g;
                const rejectRegex = /\[(拒收|退回)(红包|转账):([^\]]+)\]/g;

                // --- Improved Content Cleaning ---
                let cleanContent = fullContent.replace(innerVoiceRegex, '')
                    .replace(patRegex, '')
                    .replace(nudgeRegex, '')
                    .replace(momentRegex, '')
                    .replace(replyRegex, '')
                    .replace(setAvatarRegex, '')
                    // Aggressively clean AI's manual quote explanations like "引用来自 我 的消息..."
                    .replace(/[（\(]引用来自.*?[）\)]/gi, '')
                    .replace(/引用[^：:。^！]*[：:。^！]/gi, '')
                    .trim();

                // Clean AI Hallucinations & Residual Tags
                cleanContent = cleanContent
                    .replace(/\[Image Reference ID:.*?\]/gi, '')
                    .replace(/Here is the original image:/gi, '')
                    .replace(/\(我发送了一张图片\)/gi, '')
                    .replace(/\[\/?(INNER_VOICE|MOMENT|REPLY|SET_AVATAR)\]/gi, '')
                    .trim();

                // --- Handle Image Security & Validation ---
                cleanContent = cleanContent.replace(/\[图片:(.+?)\]/gi, (match, url) => {
                    const trimmedUrl = url.trim();
                    const isValid = trimmedUrl.startsWith('http') ||
                        trimmedUrl.startsWith('data:') ||
                        trimmedUrl === '/broken-image.png';

                    if (!isValid) return '[图片:/broken-image.png]';
                    return match;
                });

                // --- Pre-process: Extract and Protect CARD blocks ---
                const cardBlocks = [];
                let processedContent = cleanContent;
                const cardStartRegex = /\[CARD\]\s*\{/g;
                let match;
                const cardPositions = [];

                while ((match = cardStartRegex.exec(cleanContent)) !== null) {
                    const startPos = match.index;
                    const jsonStart = match.index + match[0].length - 1;
                    let braceCount = 1;
                    let endPos = jsonStart + 1;
                    while (endPos < cleanContent.length && braceCount > 0) {
                        if (cleanContent[endPos] === '{') braceCount++;
                        else if (cleanContent[endPos] === '}') braceCount--;
                        endPos++;
                    }
                    if (braceCount === 0) {
                        const fullCard = cleanContent.substring(startPos, endPos);
                        cardPositions.push({ start: startPos, end: endPos, content: fullCard });
                    }
                }

                for (let i = cardPositions.length - 1; i >= 0; i--) {
                    const pos = cardPositions[i];
                    const placeholder = `__CARD_PLACEHOLDER_${i}__`;
                    cardBlocks.push(pos.content);
                    processedContent = processedContent.substring(0, pos.start) + placeholder + processedContent.substring(pos.end);
                }

                // --- Improved Splitting Logic (V6) ---
                const splitRegex = /(__CARD_PLACEHOLDER_\d+__|\[DRAW:.*?\]|\[表情包:.*?\]|\([^\)]+\)|（[^）]+）|\[[^\]]+\]|[!?;。！？；…\n]+)/;
                const rawParts = processedContent.split(splitRegex);

                let segments = [];
                let currentSegment = "";

                for (let i = 0; i < rawParts.length; i++) {
                    const part = rawParts[i];
                    if (part === undefined) continue;

                    const isCardPlaceholder = /^__CARD_PLACEHOLDER_\d+__$/.test(part);
                    const isDraw = /^\[DRAW:/.test(part);
                    const isSticker = /^\[表情包:/.test(part);
                    const isPunctuation = /^[!?;。！？；…\n]+$/.test(part);
                    const isParenthesis = /^[\(（].*[\)）]$/.test(part);
                    const isBracket = /^\[[^\]]+\]$/.test(part);

                    if (isCardPlaceholder || isSticker || isDraw) {
                        if (currentSegment) { segments.push(currentSegment); currentSegment = ""; }
                        segments.push(part);
                    } else if (isPunctuation) {
                        currentSegment += part;
                        segments.push(currentSegment);
                        currentSegment = "";
                    } else if (isParenthesis || isBracket) {
                        currentSegment += part;
                    } else {
                        currentSegment += part;
                    }
                }
                if (currentSegment) segments.push(currentSegment);

                // Restore CARD blocks
                segments = segments.map(seg => {
                    const placeholderMatch = seg.match(/__CARD_PLACEHOLDER_(\d+)__/);
                    if (placeholderMatch) {
                        const index = parseInt(placeholderMatch[1]);
                        return cardBlocks[cardBlocks.length - 1 - index];
                    }
                    return seg;
                });

                const finalSegments = segments.filter(s => s.trim());
                if (finalSegments.length === 0 && cleanContent) finalSegments.push(cleanContent);

                // --- 4. Sequential Delivery & Real-time Operations ---
                for (let i = 0; i < finalSegments.length; i++) {
                    const seg = finalSegments[i];
                    let msgContent = seg;
                    const isFirstTextMessage = segments.findIndex(s => !s.startsWith('[CARD]')) === i;

                    if (isFirstTextMessage && innerVoiceBlock) {
                        msgContent = innerVoiceBlock + '\n' + seg;
                    }

                    // 4.1 Process Payment Tags in THIS segment
                    let pendingSystemMsgs = [];
                    let claimMatch;
                    while ((claimMatch = claimRegex.exec(msgContent)) !== null) {
                        const type = claimMatch[1];
                        const paymentId = claimMatch[2].trim();
                        const targetMsg = chat.msgs.find(m => m.paymentId === paymentId);
                        if (targetMsg && !targetMsg.isClaimed && !targetMsg.isRejected) {
                            targetMsg.isClaimed = true;
                            targetMsg.claimTime = Date.now();
                            targetMsg.claimedBy = { name: chat.name, avatar: chat.avatar };
                            pendingSystemMsgs.push(`${chat.name}领取了你的${type}`);
                        }
                    }
                    let rejectMatch;
                    while ((rejectMatch = rejectRegex.exec(msgContent)) !== null) {
                        const type = rejectMatch[2];
                        const paymentId = rejectMatch[3].trim();
                        const targetMsg = chat.msgs.find(m => m.paymentId === paymentId);
                        if (targetMsg && !targetMsg.isClaimed && !targetMsg.isRejected) {
                            targetMsg.isRejected = true;
                            targetMsg.rejectTime = Date.now();
                            pendingSystemMsgs.push(`${chat.name}拒收了你的${type}`);
                        }
                    }

                    // Clean the tags from the bubble before displaying
                    msgContent = msgContent
                        .replace(/\[领取(红包|转账):[^\]]+\]/g, '')
                        .replace(/\[(退回|拒收)(红包|转账):[^\]]+\]/g, '')
                        .trim();

                    if (!msgContent && pendingSystemMsgs.length === 0) continue;

                    // 4.2 Send the actual bubble
                    let msgAdded = null;
                    if (msgContent) {
                        if (msgContent.startsWith('[CARD]')) {
                            const jsonStr = msgContent.replace('[CARD]', '').trim();
                            msgAdded = addMessage(chatId, { role: 'ai', type: 'html', content: jsonStr, quote: i === 0 ? aiQuote : null });
                        } else if (msgContent.startsWith('[表情包:')) {
                            msgAdded = addMessage(chatId, { role: 'ai', content: msgContent, quote: i === 0 ? aiQuote : null });
                        } else {
                            // Standard Text / Drawing
                            // Allow spaces and Chinese colons
                            const rpMatch = msgContent.match(/\[(红包|转账)\s*[:：]\s*([0-9.]+)\s*[:：]\s*(.*?)\]/);
                            let msgType = 'text';
                            let amount = null;
                            let note = null;

                            if (rpMatch) {
                                const typeStr = rpMatch[1];
                                amount = parseFloat(rpMatch[2]);
                                note = rpMatch[3];

                                // Fix 0 amount issue: If AI generates 0, force a random amount
                                if (!amount || amount <= 0) {
                                    amount = (Math.random() * 100 + 5.20).toFixed(2);
                                    console.warn('[ChatStore] Adjusted invalid red packet amount to:', amount);
                                    msgContent = msgContent.replace(rpMatch[0], `[${typeStr}:${amount}:${note}]`);
                                }
                                msgType = typeStr === '红包' ? 'redpacket' : 'transfer';
                            }

                            msgAdded = addMessage(chatId, {
                                role: 'ai',
                                content: msgContent,
                                type: msgType,
                                amount: amount,
                                note: note,
                                quote: i === 0 ? aiQuote : null
                            });

                            // Async Drawing Handler
                            if (msgContent.includes('[DRAW:')) {
                                const drawMatch = msgContent.match(/\[DRAW:\s*([\s\S]*?)\]/i);
                                if (drawMatch && msgAdded) {
                                    const prompt = drawMatch[1].trim();
                                    const targetMsgId = msgAdded.id;
                                    (async () => {
                                        try {
                                            const imageUrl = await generateImage(prompt);
                                            updateMessage(chatId, targetMsgId, { content: msgContent.replace(drawMatch[0], `[图片:${imageUrl}]`) });
                                        } catch (err) {
                                            updateMessage(chatId, targetMsgId, { content: msgContent.replace(drawMatch[0], '(绘画失败)') });
                                        }
                                    })();
                                }
                            }
                        }
                    }

                    // 4.3 Insert system messages immediately after the bubble
                    pendingSystemMsgs.forEach(txt => {
                        addMessage(chatId, { role: 'system', type: 'text', content: txt, timestamp: Date.now() + 1 });
                    });

                    // Sequential Delay
                    const delay = Math.min(2000, Math.max(600, seg.length * 80));
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        } catch (e) {
            isTyping.value = false;
            currentAbortController = null;
            if (e.name === 'AbortError' || e.message === 'Aborted') return;
            useLoggerStore().addLog('ERROR', 'AI响应处理失败', e.message);
            if (!(e.name === 'QuotaExceededError' || e.code === 22)) {
                addMessage(chatId, { role: 'system', content: `请求失败: ${e.message}` });
            }
        } finally {
            isTyping.value = false;
        }
    }

    // 初始化测试数据
    function initDemoData() {
        const avatarLinShen = getRandomAvatar()
        createChat('林深', avatarLinShen, {
            prompt: "你是乔乔的男朋友，名字叫林深。你性格温柔体贴，成熟稳重，深爱着乔乔。你会无微不至地关心她，秒回她的消息，生病时会很紧张。说话语气宠溺，偶尔会叫她'宝宝'或'傻瓜'。",
            userName: "乔乔"
        }, 'char_linshen')
        addMessage('char_linshen', { role: 'ai', content: '宝宝，今天过得怎么样？有没有想我？' })

        const avatarTest = getRandomAvatar()
        createChat('测试酱', avatarTest, {
            prompt: "你是'测试酱'，这个'小手机系统'的专属测试员兼私人助手。你的主人是'乔乔'（女），她是这个系统的首席设计师，也是你唯一的主人。你性格活泼、听话，对主人的指令绝对服从，并且对主人充满崇拜。你的工作是协助主人测试系统的各项功能，无论主人提出什么奇怪的测试要求（如测试表情包、测试红包、测试甚至骂人），你都会开心配合。你的语气要像个可爱的女仆或忠诚的小跟班，经常叫主人'大小姐'或'主人'。",
            userName: "乔乔",
            activeChat: true,
            activeInterval: 120,
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
            chats.value[chatId].inChatList = false
            saveChats()
        }
    }

    function deleteChat(chatId) {
        if (chats.value[chatId]) {
            delete chats.value[chatId]
            if (currentChatId.value === chatId) currentChatId.value = null
            saveChats()
        }
    }

    function pinChat(chatId) {
        if (chats.value[chatId]) {
            chats.value[chatId].isPinned = !chats.value[chatId].isPinned
            saveChats()
        }
    }

    function vacuumStorage() {
        Object.keys(chats.value).forEach(chatId => {
            const chat = chats.value[chatId]
            if (chat.msgs && chat.msgs.length > 10) chat.msgs = chat.msgs.slice(-10)
            const LargeLimit = 100000
            if (chat.avatar && chat.avatar.length > LargeLimit) chat.avatar = ''
            if (chat.userAvatar && chat.userAvatar.length > LargeLimit) chat.userAvatar = ''
            if (chat.bgUrl && chat.bgUrl.length > LargeLimit) chat.bgUrl = ''
            if (chat.memory && chat.memory.length > 5) chat.memory = chat.memory.slice(0, 5)
        })
    }

    function saveChats() {
        try {
            localStorage.setItem('qiaoqiao_chats', JSON.stringify(chats.value))
            return true
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                vacuumStorage()
                try {
                    localStorage.setItem('qiaoqiao_chats', JSON.stringify(chats.value))
                    return true
                } catch (retryErr) {
                    Object.keys(chats.value).forEach(id => chats.value[id].msgs = [])
                    localStorage.setItem('qiaoqiao_chats', JSON.stringify(chats.value))
                }
            }
            return false
        }
    }

    function loadChats() {
        const saved = localStorage.getItem('qiaoqiao_chats')
        if (saved) {
            try {
                chats.value = JSON.parse(saved)
                Object.keys(chats.value).forEach(key => {
                    const c = chats.value[key]
                    if (c.activeChat === undefined) c.activeChat = false
                    if (c.showInnerVoice === undefined) c.showInnerVoice = true
                    if (c.bgUrl === undefined) c.bgUrl = ''
                    c.isSummarizing = false
                })
            } catch (e) { console.error(e) }
        }
    }

    loadChats()
    if (Object.keys(chats.value).length === 0) {
        initDemoData()
        saveChats()
    }

    function addSystemMessage(content) {
        if (!currentChatId.value) return
        addMessage(currentChatId.value, { role: 'system', content: content, timestamp: Date.now() })
    }

    function getDisplayedMessages(chatId) {
        const chat = chats.value[chatId]
        if (!chat || !chat.msgs) return []
        const totalMsgs = chat.msgs.length
        const loadedCount = loadedMessageCounts.value[chatId] || messagePageSize.value
        return chat.msgs.slice(Math.max(0, totalMsgs - loadedCount))
    }

    function loadMoreMessages(chatId) {
        const totalMsgs = chats.value[chatId]?.msgs.length || 0
        const currentLoaded = loadedMessageCounts.value[chatId] || messagePageSize.value
        const newLoaded = Math.min(totalMsgs, currentLoaded + messagePageSize.value)
        loadedMessageCounts.value[chatId] = newLoaded
        return newLoaded < totalMsgs
    }

    function resetPagination(chatId) { loadedMessageCounts.value[chatId] = messagePageSize.value }

    function hasMoreMessages(chatId) {
        const totalMsgs = chats.value[chatId]?.msgs.length || 0
        const loadedCount = loadedMessageCounts.value[chatId] || messagePageSize.value
        return totalMsgs > loadedCount
    }

    return {
        notificationEvent, patEvent, toastEvent, triggerToast, triggerPatEffect,
        stopGeneration, chats, currentChatId, isTyping, chatList, contactList,
        currentChat, addMessage, updateMessage, createChat, deleteChat,
        deleteMessage, deleteMessages, pinChat, clearHistory, clearAllChats,
        checkProactive, summarizeHistory, updateCharacter, initDemoData,
        sendMessageToAI, saveChats, getTokenCount, getTokenBreakdown, addSystemMessage,
        getDisplayedMessages, loadMoreMessages, resetPagination, hasMoreMessages
    }
})
