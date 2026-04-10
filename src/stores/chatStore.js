import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { generateReply, generateSummary, generateImage, generateContextPreview } from '../utils/aiService'
import { useAITaskStore } from './aiTaskStore'
import { useLoggerStore } from './loggerStore'
import { useWorldBookStore } from './worldBookStore'
import { useMomentsStore } from './momentsStore'
import { useSettingsStore } from './settingsStore'
import { useMusicStore } from './musicStore'
import { useSchedulerStore } from './schedulerStore'
import { useCallStore } from './callStore'
import { processTaskCommands } from '../utils/taskUtils'
import { processBioUpdate } from '../utils/bioUtils'
import { usePhoneInspectionStore } from './phoneInspectionStore'
import { setupFinancialLogic } from './chatModules/chatFinancial'
import localforage from 'localforage'

// Configure localforage
localforage.config({
    name: 'qiaoqiao-phone',
    storeName: 'chats'
});

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
    const pendingRequests = ref([]) // [ { id, fromId, fromName, fromAvatar, targetId, targetName, type: 'friend' | 'group_invite', timestamp } ]
    const typingStatus = ref({}) // { chatId: boolean }
    const isProfileProcessing = ref({}) // track if a specific character's archive is being analyzed
    
    // Streaming message persistence state
    const streamingState = ref({}) // { chatId: { msgId, content, startTime, mode } }
    
    async function saveStreamingState() {
        try {
            await localforage.setItem('qiaoqiao_streaming_state', JSON.parse(JSON.stringify(streamingState.value)))
        } catch (e) {
            console.warn('[ChatStore] Failed to save streaming state:', e)
        }
    }
    
    async function loadStreamingState() {
        try {
            const saved = await localforage.getItem('qiaoqiao_streaming_state')
            if (saved) {
                streamingState.value = saved
            }
        } catch (e) {
            console.warn('[ChatStore] Failed to load streaming state:', e)
        }
    }
    
    async function clearStreamingState(chatId) {
        if (chatId) {
            delete streamingState.value[chatId]
        } else {
            streamingState.value = {}
        }
        await saveStreamingState()
    }
    
    function setStreamingMessage(chatId, msgId, content, mode = 'online') {
        streamingState.value[chatId] = {
            msgId,
            content,
            startTime: Date.now(),
            mode,
            isComplete: false
        }
        saveStreamingState()
    }
    
    function updateStreamingContent(chatId, content) {
        if (streamingState.value[chatId]) {
            streamingState.value[chatId].content = content
            saveStreamingState()
        }
    }
    
    function markStreamingComplete(chatId) {
        if (streamingState.value[chatId]) {
            streamingState.value[chatId].isComplete = true
            streamingState.value[chatId].completeTime = Date.now()
        }
        clearStreamingState(chatId)
    }
    const isTyping = computed({
        get: () => !!typingStatus.value[currentChatId.value],
        set: (val) => {
            if (currentChatId.value) {
                typingStatus.value[currentChatId.value] = val
            }
        }
    })
    const notificationEvent = ref(null) // Global notification trigger
    const patEvent = ref(null) // Event: { chatId, target: 'ai'|'user' }
    const toastEvent = ref(null) // Event: { message, type: 'info'|'success'|'error' }
    const confirmEvent = ref(null) // Event: { title, message, onConfirm, onCancel, confirmText, cancelText }
    const promptEvent = ref(null) // Event: { title, message, placeholder, defaultValue, onConfirm, onCancel }
    // const momentsStore = useMomentsStore() // Removed to prevent circular instantiation loop

    // Pagination State
    const messagePageSize = ref(50) // 每页显示50条消息
    const loadedMessageCounts = ref({}) // { chatId: 加载的消息数 }

    // AI Control
    const abortControllers = {} // { chatId: AbortController }
    let currentAbortController = null; // Still keep for extreme backward compat if needed, but not used by main logic now

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

    function triggerConfirm(title, message, onConfirm, onCancel = null, confirmText = '确定', cancelText = '取消') {
        confirmEvent.value = { id: Date.now(), title, message, onConfirm, onCancel, confirmText, cancelText }
    }

    function triggerPrompt(title, message, placeholder = '', defaultValue = '', onConfirm, onCancel = null) {
        promptEvent.value = { id: Date.now(), title, message, placeholder, defaultValue, onConfirm, onCancel }
    }

    function stopGeneration(silent = false, chatId = null) {
        const id = chatId || currentChatId.value
        if (!id) return

        if (abortControllers[id]) {
            abortControllers[id].abort()
            delete abortControllers[id]
        }

        if (typingStatus.value[id]) {
            typingStatus.value[id] = false
            console.log(`[ChatStore] AI Generation for ${id} stopped.`)
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
        return Object.keys(chats.value).map(key => {
            const chat = chats.value[key]
            return {
                id: key,
                ...chat,
                unreadCount: chat.unreadCount || 0,
                lastMsg: (chat.msgs || []).slice(-1)[0] || null
            }
        }).filter(c => c.inChatList !== false).sort((a, b) => {
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

    const groupNpcs = computed(() => {
        const npcs = [];
        Object.entries(chats.value).forEach(([chatId, chat]) => {
            if (chat.isGroup && Array.isArray(chat.participants)) {
                chat.participants.forEach(p => {
                    if (p.isNPC || p.role === 'npc') {
                        npcs.push({
                            ...p,
                            groupId: chatId,
                            groupName: chat.name
                        });
                    }
                });
            }
        });
        return npcs;
    })

    const currentChat = computed(() => {
        const id = currentChatId.value
        if (!id || !chats.value[id]) return null
        const chat = chats.value[id]

        // Return a fresh object with the ID to ensure compatibility
        // Default voiceSpeed to 1.0 if missing (Legacy Data Support)
        return {
            voiceSpeed: 1.0,
            ...chat,
            id: currentChatId.value
        }
    })

    // Actions
    function createChat(name, options = {}) {
        const chatId = options.id || 'c-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)

        if (!chats.value[chatId]) {
            const newChat = {
                id: chatId,
                name,
                avatar: options.avatar || getRandomAvatar(),
                userAvatar: options.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=Me`,
                remark: '',
                prompt: options.prompt || '你是一个友好的人。',
                msgs: [],
                isPinned: false,
                unreadCount: 0,
                inChatList: true,
                tags: options.tags || [],
                // Settings with defaults
                activeChat: false,
                autoSummary: false,
                autoTTS: false,
                showInnerVoice: true,
                // Group Chat / World Loop Extensions
                isGroup: options.isGroup || false,
                participants: options.participants || [],
                loopId: options.loopId || null,
                systemRole: options.systemRole || null,
                // Bio / Profile logic
                bio: {
                    gender: options.gender || '未知',
                    age: options.age || '未知',
                    hobbies: [],
                    routine: { awake: '未知', busy: '未知', deep: '未知' }
                },
                ...options
            }
            chats.value[chatId] = newChat
            saveChats()
            return newChat
        }
        return chats.value[chatId]
    }

    function createGroupChat(options = {}) {
        const chatId = options.id || 'g-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
        const newChat = {
            id: chatId,
            isGroup: true,
            name: options.name || '新建群聊',
            avatar: options.avatar || getRandomAvatar(),
            participants: options.participants || [],
            groupProfile: options.groupProfile || {
                avatar: options.avatar || getRandomAvatar(),
                name: options.name || '新建群聊',
                groupNo: 'G' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
                announcement: ''
            },
            msgs: [],
            inChatList: true,
            unreadCount: 0,
            isPinned: false,
            lastSummaryIndex: 0,
            lastSummaryCount: 0,
            tokenStats: { total: 0, totalContext: 0 },
            // Settings with defaults
            activeChat: false,
            autoSummary: false,
            autoTTS: false,
            showInnerVoice: true,
            ...options
        }
        chats.value[chatId] = newChat
        saveChats()
        return newChat
    }

    function updateGroupProfile(chatId, profile) {
        if (chats.value[chatId]) {
            chats.value[chatId] = { 
                ...chats.value[chatId], 
                ...profile,
                groupProfile: { ...(chats.value[chatId].groupProfile || {}), ...profile }
            };
            saveChats();
            return true;
        }
        return false;
    }

    function updateGroupParticipants(chatId, participants) {
        if (chats.value[chatId]) {
            chats.value[chatId].participants = participants;
            saveChats();
            return true;
        }
        return false;
    }

    async function updateGroupSettings(chatId, settings) {
        if (chats.value[chatId]) {
            // Ensure groupSettings sub-object is updated for component compatibility
            chats.value[chatId].groupSettings = {
                ...(chats.value[chatId].groupSettings || {}),
                ...settings
            };
            // Also sync to top level for legacy support
            chats.value[chatId] = { ...chats.value[chatId], ...settings };
            
            await saveChats();
            return true;
        }
        return false;
    }

    async function addMessage(chatId, msg) {
        const chat = chats.value[chatId]
        if (!chat) return false

        // Robust Migration: Ensure bio structure exists and is reactive
        if (!chat.bio) {
            chat.bio = {
                gender: '未知', age: '未知', birthday: '未知', zodiac: '未知', mbti: '未知',
                height: '未知', weight: '未知', body: '未知', occupation: '未知', status: '未知',
                scent: '未知', style: '未知', hobbies: [], idealType: '未知', heartbeatMoment: '暂无记录',
                traits: [], routine: { awake: '未知', busy: '未知', deep: '未知' },
                soulBonds: [], loveItems: [
                    { name: '爱之物 I', image: '' }, { name: '爱之物 II', image: '' }, { name: '爱之物 III', image: '' }
                ]
            };
            // Force re-assignment to ensure reactivity and persistence
            chats.value[chatId] = { ...chat, bio: chat.bio };
        }

        // Parse special tags (Mission: Priority)
        if (msg.role === 'ai') {
            let processedContent = msg.content;
            if (typeof processedContent === 'string') {
                processedContent = processTaskCommands(processedContent, chatId);
                processedContent = processBioUpdate(processedContent, chatId);
                
                // 处理手机指令 (允许/锁屏/JSON)
                const phoneStore = usePhoneInspectionStore()
                phoneStore.processHiddenCommand(msg, chatId)
                // Check if content is a pure JSON object with LS_JSON-like structure
                const trimmedContent = processedContent.trim();
                if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
                    try {
                        const parsed = JSON.parse(trimmedContent);
                        // Validate it has LS_JSON structure: { "commands": [...] }
                        if (parsed.commands && Array.isArray(parsed.commands) && 
                            parsed.commands.length > 0 && 
                            ['diary', 'footprint', 'message', 'sticky', 'anniversary', 'letter', 'question', 'album', 'house', 'gacha', 'schedule'].includes(parsed.commands[0].type)) {
                            console.log('[ChatStore] Detected raw JSON LS_JSON format, wrapping with tag...');
                            // Wrap with LS_JSON tag for processing
                            processedContent = `[LS_JSON:${trimmedContent}]`;
                        }
                    } catch (e) {
                        // Not valid LS_JSON JSON, ignore
                    }
                }
                
                // Intercept Couple Space commands [LS_JSON: ...]
                // Robust extraction using balanced brace matching
                const startMarkerRegex = /[\\[【]\s*LS_JSON[:：]?\s*/gi;
                let match;
                let foundBlocks = [];
                
                // Manual loop to find and extract blocks
                // We use a fresh copy for matching lastIndex
                const searchRegex = new RegExp(startMarkerRegex.source, startMarkerRegex.flags);
                while ((match = searchRegex.exec(processedContent)) !== null) {
                    const startIdx = match.index;
                    const markerText = match[0];
                    const contentStart = startIdx + markerText.length;
                    
                    const firstBrace = processedContent.indexOf('{', contentStart);
                    if (firstBrace !== -1) {
                        let braceCount = 0;
                        let inString = false;
                        let isEscaped = false;
                        let jsonEndIdx = -1;
                        
                        for (let i = firstBrace; i < processedContent.length; i++) {
                            const char = processedContent[i];
                            if (isEscaped) { isEscaped = false; continue; }
                            if (char === '\\') { isEscaped = true; continue; }
                            if (char === '"') { inString = !inString; continue; }
                            if (!inString) {
                                if (char === '{') braceCount++;
                                else if (char === '}') {
                                    braceCount--;
                                    if (braceCount === 0) {
                                        jsonEndIdx = i;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (jsonEndIdx !== -1) {
                            // Find optional closing bracket ]
                            let blockEndIdx = jsonEndIdx + 1;
                            const remaining = processedContent.substring(jsonEndIdx + 1, jsonEndIdx + 10);
                            const closeMatch = remaining.match(/^\s*[\]】]/);
                            if (closeMatch) {
                                blockEndIdx = jsonEndIdx + 1 + closeMatch[0].length;
                            }
                            
                            foundBlocks.push({
                                start: startIdx,
                                end: blockEndIdx,
                                content: processedContent.substring(startIdx, blockEndIdx)
                            });
                            // Advance regex
                            searchRegex.lastIndex = blockEndIdx;
                        }
                    }
                }
                
                if (foundBlocks.length > 0) {
                    console.log(`[ChatStore] Detected ${foundBlocks.length} Couple Space commands, processing...`);
                    
                    // Capture original for execution (before stripping)
                    const originalForExecution = processedContent;
                    
                    // Strip blocks from display content (backwards to keep indices intact)
                    for (let i = foundBlocks.length - 1; i >= 0; i--) {
                        const block = foundBlocks[i];
                        processedContent = processedContent.substring(0, block.start) + processedContent.substring(block.end);
                    }
                    processedContent = processedContent.trim();
                    
                    // Execute commands in background
                    import('./loveSpaceStore').then(m => {
                        const loveSpaceStore = m.useLoveSpaceStore();
                        loveSpaceStore.executeSpaceCommands(originalForExecution, chat.name, null, chatId)
                            .then(() => console.log('[ChatStore] LS_JSON commands executed successfully'))
                            .catch(err => console.error('[ChatStore] LS_JSON execution failed', err));
                    }).catch(err => console.error('[ChatStore] Failed to load loveSpaceStore', err));
                }
                
                msg.content = processedContent;
            }
        }

        // Push message to memory (Legacy support)
        // Deep safety for nested properties
        if (!chat.bio.routine) chat.bio.routine = { awake: '未知', busy: '未知', deep: '未知' };
        if (!chat.bio.hobbies) chat.bio.hobbies = [];
        if (!chat.bio.traits) chat.bio.traits = [];
        if (!chat.bio.soulBonds) chat.bio.soulBonds = [];
        if (!chat.bio.loveItems) chat.bio.loveItems = [
            { name: '爱之物 I', image: '' }, { name: '爱之物 II', image: '' }, { name: '爱之物 III', image: '' }
        ];

        // EARLY FILTER: Reject JSON/Metadata fragments (清除残余碎片)
        if (msg.content && typeof msg.content === 'string') {
            const trimmed = msg.content.trim();

            // Filter header fragment: EXACT match for { "type": "html", "html": " or type: html, html:
            const headerPattern = /^\{\s*["']type["']\s*:\s*["']html["']\s*,\s*["']html["']\s*:\s*["']\s*$/;
            const metaPattern = /^\s*(?:type|card|json|html|content)\s*[:：]\s*[^\[\<{]*$/i;
            
            if (headerPattern.test(trimmed) || metaPattern.test(trimmed)) {
                console.log('[ChatStore] ✅ Rejected header/metadata fragment:', trimmed);
                return false;
            }

            // Filter tail fragment: EXACT match for " } or "}
            if (trimmed === '"' || trimmed === '"}' || trimmed === '" }' || trimmed === "'}'" || trimmed === "' }") {
                console.log('[ChatStore] ✅ Rejected tail fragment:', trimmed);
                return false;
            }
        }

        // 1. Initialize message object
        const newMsg = {
            id: msg.id || ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)),
            timestamp: msg.timestamp || Date.now(),
            role: msg.role,
            type: msg.type || 'text',
            content: msg.content || '',
            // World Loop Extensions
            senderId: msg.senderId || (msg.role === 'user' ? 'user' : chatId),
            senderName: msg.senderName || (msg.role === 'user' ? '我' : (chat.isGroup ? (msg.senderName || chat.name) : chat.name)),
            senderAvatar: msg.senderAvatar || (msg.role === 'user' ? '' : (chat.isGroup ? (msg.senderAvatar || chat.avatar) : chat.avatar)),
            image: msg.image || null,
            sticker: msg.sticker || null,
            html: msg.html || null,
            forceCard: msg.forceCard || false,
            isDrawing: msg.isDrawing !== undefined ? msg.isDrawing : false,
            status: msg.status || null,
            amount: msg.amount || 0,
            note: msg.note || '',
            isClaimed: msg.isClaimed || false,
            claimedBy: msg.claimedBy || null,
            claimTime: msg.claimTime || null,
            duration: msg.duration || 0,
            quote: msg.quote || null,
            paymentId: msg.paymentId || null, // Initialize paymentId
            hidden: msg.hidden || false, // Detection for visualizer-only messages
            mode: msg.mode || (useSettingsStore().getChatOfflineMode(chatId).isOfflineMode ? 'offline' : 'online'), // 线上/线下模式标记: 'online' | 'offline' | null, 默认为当前聊天模式
            // --- Gift fields ---
            giftId: msg.giftId || null,
            giftName: msg.giftName || null,
            giftDescription: msg.giftDescription || null,
            giftImage: msg.giftImage || null,
            giftNote: msg.giftNote || null,
            giftQuantity: msg.giftQuantity || null,
            // --- Dice fields ---
            diceResults: msg.diceResults || null,
            diceTotal: msg.diceTotal || null,
            diceCount: msg.diceCount || null,
            // --- Tarot fields ---
            tarotCards: msg.tarotCards || null,
            tarotQuestion: msg.tarotQuestion || null,
            tarotSpread: msg.tarotSpread || null,
            tarotInterpretation: msg.tarotInterpretation || null,
            // --- Moment fields ---
            momentData: msg.momentData || null,
            // --- Order fields ---
            orderId: msg.orderId || null,
            orderData: msg.orderData || null,
        }
        
        // Debug: 记录 HTML 消息
        if (msg.type === 'html' || msg.html) {
            console.log('[ChatStore] addMessage received HTML message:', {
                role: msg.role,
                type: msg.type,
                htmlLength: msg.html?.length,
                contentLength: msg.content?.length,
                forceCard: msg.forceCard
            });
        }

        // 1.0 STRICT CONTENT FILTER: Reject "undefined", "null", or empty content
        if (newMsg.type === 'text' && (!newMsg.content || newMsg.content === 'undefined' || newMsg.content === 'null' || newMsg.content.trim() === '')) {
            console.warn('[ChatStore] Rejected invalid content:', newMsg.content);
            return false;
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

        // 1.3 JSON Command Parsing (For Debugging/User Manual Input)
        if (newMsg.type === 'text' && typeof newMsg.content === 'string') {
            const content = newMsg.content.trim();
            // Look for any JSON-like structure that has "type":"html" or similar keywords
            const suspectedHtml = (content.includes('"type"') && content.includes('"html"')) || 
                                  (content.includes('"type":') && content.includes('"html":')) ||
                                  (content.includes('<div') && content.includes('{'));

            if (suspectedHtml) {
                console.log('[ChatStore] Suspected HTML message detected, content preview:', content.substring(0, 100));
                try {
                    // 首先尝试直接解析整个内容作为 JSON
                    if (content.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(content);
                            console.log('[ChatStore] JSON parsed successfully:', parsed.type, parsed.html ? 'has html' : 'no html');
                            if (parsed.type === 'html' && (parsed.html || parsed.content)) {
                                newMsg.type = 'html';
                                newMsg.html = parsed.html || parsed.content;
                                newMsg.forceCard = true;
                                console.log('[ChatStore] Detected Manual HTML Message (JSON Parse), html length:', newMsg.html.length);
                            }
                        } catch (e) { 
                            console.log('[ChatStore] JSON parse failed:', e.message);
                        }
                    }
                    
                    // 如果上面的方法没有成功，尝试简单的关键字检测
                    if (newMsg.type !== 'html') {
                        if (/["']type["']\s*[:：]\s*["']html["']/i.test(content) || /\[CARD\]/i.test(content)) {
                            newMsg.type = 'html';
                            newMsg.forceCard = true; // Flag for component to isolate
                            console.log('[ChatStore] Detected Manual HTML Message (Keyword Flag)');
                        }
                    }
                } catch (e) {
                    console.log('[ChatStore] HTML detection error:', e.message);
                }
            }
        }

        // 2. Type Auto-Detection (if not specified)
        if (newMsg.type === 'text' && typeof newMsg.content === 'string') {
            let detectionContent = newMsg.content.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim();
            
            // 2.0 Pre-processing: Extract content from [ONLINE]/[OFFLINE] tags for detection
            // This handles cases where红包/转账 is wrapped in mode tags like [ONLINE][红包:...][/ONLINE]
            let contentForDetection = detectionContent;
            const onlineMatch = detectionContent.match(/\[ONLINE\]([\s\S]*?)\[\/ONLINE\]/i);
            const offlineMatch = detectionContent.match(/\[OFFLINE\]([\s\S]*?)\[\/OFFLINE\]/i);
            if (onlineMatch) {
                contentForDetection = onlineMatch[1].trim();
            } else if (offlineMatch) {
                contentForDetection = offlineMatch[1].trim();
            }
            
            // Match the tag ONLY if it is the entire content (minus whitespace/inner voice)
            // For AI messages, use a more relaxed search to find embedded tags
            const tagMatch = contentForDetection.match(/[\[【](发红包|红包|转账|图片|表情包|DRAW|语音|演奏|MUSIC|VIDEO|FILE|LOCATION|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT|申请亲属卡|拒绝亲属卡|赠送亲属卡|礼物|GIFT)\s*[:：]\s*([^:：\]】]*)(?:\s*[:：]\s*([^:：\]】]*))?(?:\s*[:：]\s*([^\]】]*))?[\]】]/i)
            
            // Only consider it a "tag only" message if it starts and ends with the tag
            const isTagOnly = /^[\[【].*[\]】]$/.test(contentForDetection.trim())
            
            if (tagMatch) {
                const tagType = tagMatch[1]
                const val1 = (tagMatch[2] || '').trim()
                const val2 = (tagMatch[3] || '').trim()
                const val3 = (tagMatch[4] || '').trim()

                if (/^(发红包|红包)$/.test(tagType)) {
                    newMsg.type = 'redpacket'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '恭喜发财，大吉大利'
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    // Only rewrite entire content if it was a standalone tag
                    if (isTagOnly) {
                        newMsg.content = `[红包:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                    } else {
                        // Injection logic: replace the original tag with the one containing paymentId
                        const tagToReplace = tagMatch[0]
                        const newTag = `[红包:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                        newMsg.content = newMsg.content.replace(tagToReplace, newTag)
                    }
                } else if (tagType === '转账') {
                    newMsg.type = 'transfer'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '转账给您'
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    if (isTagOnly) {
                        newMsg.content = `[转账:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                    } else {
                        const tagToReplace = tagMatch[0]
                        const newTag = `[转账:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                        newMsg.content = newMsg.content.replace(tagToReplace, newTag)
                    }
                } else if (tagType === '图片' || tagType === 'DRAW') {
                    newMsg.type = 'image'
                } else if (tagType === '语音') {
                    newMsg.type = 'voice'
                } else if (tagType === '演奏' || tagType === 'MUSIC') {
                    newMsg.type = 'music'
                    // If val2 exists, it's [演奏: instrument: score]. Otherwise val1 is the part after [演奏: ...]
                    newMsg.content = val2 ? `${val1}: ${val2}` : val1
                } else if (tagType === '表情包') {
                    newMsg.type = 'sticker'
                } else if (tagType === 'VIDEO') {
                    newMsg.type = 'video'
                } else if (tagType === 'FILE') {
                    newMsg.type = 'file'
                } else if (tagType === 'LOCATION') {
                    newMsg.type = 'location'
                } else if (tagType.toUpperCase() === 'FAMILY_CARD_APPLY' || tagType === '申请亲属卡') {
                    newMsg.type = 'family_card_apply'
                    newMsg.paymentId = val2 || `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.note = val1 || '申请亲属卡'
                    newMsg.content = `[申请亲属卡:${newMsg.note}:${newMsg.paymentId}]`
                } else if (tagType.toUpperCase() === 'FAMILY_CARD_REJECT' || tagType === '拒绝亲属卡') {
                    newMsg.type = 'family_card_reject'
                    newMsg.paymentId = val1 || ''
                } else if (tagType.toUpperCase() === 'FAMILY_CARD' || tagType === '赠送亲属卡' || tagType === '亲属卡') {
                    newMsg.type = 'family_card'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '我的钱就是你的钱'
                    newMsg.paymentId = val3 || `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.content = `[亲属卡:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                } else if (tagType === '礼物' || tagType.toUpperCase() === 'GIFT') {
                    newMsg.type = 'gift'
                    newMsg.giftName = val1 || '礼物'
                    
                    // 鲁棒性解析：处理 [GIFT:名称:数量:备注] 或 [GIFT:名称:备注]
                    if (val3) {
                        newMsg.giftQuantity = parseInt(val2) || 1
                        newMsg.giftNote = val3
                    } else if (val2) {
                        const q = parseInt(val2)
                        // 如果 val2 是纯数字，视为数量；否则视为备注
                        if (!isNaN(q) && /^\d+$/.test(val2)) {
                            newMsg.giftQuantity = q
                            newMsg.giftNote = ''
                        } else {
                            newMsg.giftQuantity = 1
                            newMsg.giftNote = val2
                        }
                    } else {
                        newMsg.giftQuantity = 1
                        newMsg.giftNote = ''
                    }

                    newMsg.giftId = `GIFT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    
                    // 处理礼物中的 DRAW: 生图指令 (支持在备注中包含)
                    if (newMsg.giftNote && newMsg.giftNote.includes('DRAW:')) {
                        const parts = newMsg.giftNote.split('DRAW:')
                        newMsg.giftNote = parts[0].trim()
                        const prompt = parts[1].trim()
                        if (prompt) {
                            console.log('[ChatStore] GIFT DRAW detected, generating image for gift:', newMsg.giftName);
                            import('@/utils/aiService').then(m => {
                                m.generateImage(prompt).then(url => {
                                    newMsg.giftImage = url
                                    saveChats()
                                })
                            })
                        }
                    }
                    
                    if (isTagOnly) {
                        newMsg.content = `[礼物:${newMsg.giftName}:${newMsg.giftQuantity}:${newMsg.giftNote}:${newMsg.giftId}]`
                    }
                }
            } else {
                // 2.1 Fallback: Loose Parsing for User Inputs like "[转账] 520元" or "[红包] 恭喜发财"
                const looseMatch = detectionContent.match(/^[\[【](发红包|红包|转账|亲属卡|申请亲属卡|礼物|GIFT)[\]】]\s*(.*)/i);
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

                    if (tagType === '申请亲属卡') {
                        newMsg.type = 'family_card_apply';
                        newMsg.note = rawText || '申请亲属卡';
                        newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        newMsg.content = `[申请亲属卡:${newMsg.note}:${newMsg.paymentId}]`;
                    } else if (tagType === '亲属卡') {
                        newMsg.type = 'family_card';
                        newMsg.amount = amount;
                        newMsg.note = note || '我的钱就是你的钱';
                        newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        newMsg.content = `[亲属卡:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`;
                    } else if (tagType === '礼物' || tagType === 'GIFT') {
                        newMsg.type = 'gift';
                        newMsg.giftName = rawText || '礼物';
                        newMsg.giftQuantity = 1;
                        newMsg.giftId = `GIFT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        newMsg.content = `[礼物:${newMsg.giftName}:1::${newMsg.giftId}]`;
                    } else {
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
        }

        // 3. Robust AI Payment Handling (ID-based)
        if (newMsg.role === 'ai') {
            // Handle AI claiming by ID: [领取红包:PAY-xxx] or [领取转账:PAY-xxx] or [领取亲属卡:PAY-xxx]
            const claimRegex = /\[领取(红包|转账|亲属卡):([^\]]+)\]/g;
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
                    console.log(`[ChatStore] AI claimed ${paymentType} ${paymentId}`);
                    claimedPayments.push(paymentType);
                }
            }

            // Handle AI rejecting by ID: Support all variations
            // [拒收红包], [退回红包], [拒收转账], [退回转账], [拒收亲属卡], [退回亲属卡]
            const rejectRegex = /\[(拒收|退回)(红包|转账|亲属卡):([^\]]+)\]/g;
            let rejectMatch;
            const rejectedPayments = [];
            while ((rejectMatch = rejectRegex.exec(newMsg.content)) !== null) {
                const paymentType = rejectMatch[2];
                const paymentId = rejectMatch[3].trim(); // Note: group 3 now, not 2
                const targetMsg = chat.msgs.find(m => m.paymentId === paymentId);
                if (targetMsg && !targetMsg.isClaimed && !targetMsg.isRejected) {
                    targetMsg.isRejected = true;
                    targetMsg.rejectTime = Date.now();
                    console.log(`[ChatStore/addMessage] AI rejected ${paymentType} ${paymentId}`);
                    rejectedPayments.push(paymentType);
                }
            }

            // Clean operation tags from content
            newMsg.content = newMsg.content
                .replace(/\[领取(红包|转账|亲属卡):[^\]]+\]/g, '')
                .replace(/\[(拒收|退回)(红包|转账|亲属卡):[^\]]+\]/g, '')
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
                        content: `${chat.name}领取了${chat.userName || '你'}的${type}`,
                        timestamp: Date.now() + 50
                    });
                    // For family cards, add additional notification about activation
                    if (type === '亲属卡') {
                        newMsg._pendingSystemMessages.push({
                            id: crypto.randomUUID(),
                            role: 'system',
                            type: 'text',
                            content: `${chat.name}领取的亲属卡已生效`,
                            timestamp: Date.now() + 150
                        });
                    }
                });
                rejectedPayments.forEach(type => {
                    newMsg._pendingSystemMessages.push({
                        id: crypto.randomUUID(),
                        role: 'system',
                        type: 'text',
                        content: `${chat.name}拒收了${chat.userName || '你'}的${type}`,
                        timestamp: Date.now() + 100
                    });
                });
            }

        }

        // 3.1 BIO (Personal Archive) Updates - Runs for both User and AI
        if (newMsg.content.includes('[UPDATE_BIO:') || newMsg.content.includes('[BIO:')) {
            const bioRegex = /\[(?:UPDATE_)?BIO:([^:]+):([^\]]+)\]/gi;
            let match;
            let bioUpdated = false;

            // Map of keys to bio structure
            const keyMap = {
                'gender': 'gender', '性别': 'gender',
                'age': 'age', '年龄': 'age',
                'birthday': 'birthday', '生日': 'birthday',
                'zodiac': 'zodiac', '星座': 'zodiac',
                'mbti': 'mbti', '人格': 'mbti',
                'height': 'height', '身高': 'height',
                'weight': 'weight', '体重': 'weight',
                'body': 'body', '身材': 'body',
                'occupation': 'occupation', '职业': 'occupation',
                'status': 'status', '婚姻': 'status', '情感': 'status',
                'scent': 'scent', '气味': 'scent',
                'style': 'style', '风格': 'style',
                'idealtype': 'idealType', '理想型': 'idealType',
                'heartbeat': 'heartbeatMoment', '心动时刻': 'heartbeatMoment',
                'signature': 'signature', '个性签名': 'signature',
                'location': 'location', '位置': 'location'
            };

            while ((match = bioRegex.exec(newMsg.content)) !== null) {
                const key = match[1].trim().toLowerCase();
                let val = match[2].trim();

                // Strip any HTML tags the AI might have included (ends "html" issue)
                val = val.replace(/<[^>]*>/g, '').trim();

                // Double check bio exists here to prevent "Cannot set properties of undefined"
                if (!chat.bio) chat.bio = {};

                if (keyMap[key]) {
                    const bioKey = keyMap[key];
                    if (bioKey === 'signature') {
                        chat.statusText = val;
                        chat.bio.signature = val;
                        chat.bio.statusText = val; // Also sync to internal bio for view consistency
                    } else {
                        chat.bio[bioKey] = val;
                    }
                    bioUpdated = true;
                } else if (key === 'hobby' || key === '爱好') {
                    // Support multiple hobbies in one tag
                    const list = val.split(/[，, ]+/).filter(v => v.trim());
                    list.forEach(item => {
                        if (!chat.bio.hobbies.includes(item)) {
                            chat.bio.hobbies.push(item);
                            bioUpdated = true;
                        }
                    });
                } else if (key === 'trait' || key === '特质') {
                    const list = val.split(/[，, ]+/).filter(v => v.trim());
                    list.forEach(item => {
                        if (!chat.bio.traits.includes(item)) {
                            chat.bio.traits.push(item);
                            bioUpdated = true;
                        }
                    });
                } else if (key.startsWith('routine_')) {
                    const rKey = key.split('_')[1].toLowerCase();
                    if (chat.bio.routine && chat.bio.routine[rKey] !== undefined) {
                        chat.bio.routine[rKey] = val;
                        bioUpdated = true;
                    }
                } else if (key.startsWith('soulbond_')) {
                    const label = key.split('_')[1];
                    chat.bio.soulBonds.push({ label, text: val });
                    bioUpdated = true;
                } else if (key.startsWith('loveitem_')) {
                    // Supported formats: [BIO:LoveItem_1_羽毛笔:Prompt] or [BIO:LoveItem_1:羽毛笔:Prompt]
                    const parts = key.split(/[_:]/);
                    const index = parseInt(parts[1]) - 1;
                    let itemName = parts[2] || '爱之物';
                    if (itemName === '物品名') itemName = '爱之物'; // Safety against literal placeholder

                    // Clean value from potential HTML AI might have hallucinated
                    const cleanVal = val.replace(/<[^>]*>/g, '').trim();

                    if (index >= 0 && index < 3) {
                        chat.bio.loveItems[index].name = itemName;
                        generateImage(cleanVal).then(url => {
                            chat.bio.loveItems[index].image = url;
                            saveChats();
                        });
                        bioUpdated = true;
                    }
                }
            }

            // Note: We no longer strip tags from newMsg.content here. 
            // We let the UI (ChatWindow.vue) handle formatting for display, 
            // or we will handle it in a final pass below to ensure the AI 
            // always sees its own tags in history.

            if (bioUpdated) {
                saveChats();
            }
        }



        // 3.2 Moment Share Parsing (AI Only)
        // 3.2.1 Handle raw JSON format (AI sometimes outputs JSON without MOMENT_SHARE tag)
        console.log('[ChatStore] Moment parsing check - role:', newMsg.role, 'content:', newMsg.content.substring(0, 50));
        if (newMsg.role === 'ai' && !newMsg.content.includes('[MOMENT_SHARE:') && !newMsg.content.includes('[分享朋友圈:')) {
            const trimmedContent = newMsg.content.trim();
            console.log('[ChatStore] Checking raw JSON moment format, starts with {:', trimmedContent.startsWith('{'), 'ends with }:', trimmedContent.endsWith('}'));
            // Check if content is a pure JSON object with moment-related fields
            if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
                try {
                    const parsed = JSON.parse(trimmedContent);
                    console.log('[ChatStore] Parsed JSON:', parsed);
                    // Validate it has the required moment fields
                    if (parsed.content && (parsed.imagePrompt || parsed.location || parsed.visibility)) {
                        console.log('[ChatStore] Valid moment JSON detected, converting to moment_card');
                        const momentData = {
                            id: parsed.id || crypto.randomUUID(),
                            content: parsed.content,
                            text: parsed.content,
                            author: chat.name,
                            avatar: chat.avatar,
                            imagePrompt: parsed.imagePrompt || '',
                            location: parsed.location || '',
                            visibility: parsed.visibility || 'public',
                            interactions: parsed.interactions || []
                        };
                        
                        // Convert to moment_card type
                        newMsg.type = 'moment_card';
                        newMsg.momentData = momentData;
                        newMsg.content = JSON.stringify(momentData);
                        
                        // Add system notification to chat
                        const momentResult = momentsStore.addMoment({
                            id: momentData.id,
                            authorId: chatId,
                            content: momentData.text || momentData.content || '',
                            images: momentData.image ? [momentData.image] : (momentData.images || []),
                        });

                        addMessage(chatId, {
                            role: 'system',
                            type: 'system',
                            content: `${chat.name} 发布了一条朋友圈`,
                            _momentReferenceId: momentResult.id
                        });
                    }
                } catch (e) {
                    // Not valid JSON, ignore
                }
            }
        }
        
        // 3.2.2 Handle standard MOMENT_SHARE tag format
        if (newMsg.role === 'ai' && (newMsg.content.includes('[MOMENT_SHARE:') || newMsg.content.includes('[分享朋友圈:'))) {
            // Robust Regex: Matches [MOMENT_SHARE: payload ] where payload may contain nested brackets (JSON)
            // It stops before the next known tag start [ or at the end of the message.
            const shareRegex = /\[(?:MOMENT_SHARE|分享朋友圈):\s*([\s\S]+?)\](?=\s*(?:\[[A-Z_]|【|$))/i;
            const match = newMsg.content.match(shareRegex);

            if (match) {
                let shareContent = match[1].trim();
                let momentData = null;

                try {
                    // Pre-process shareContent: handle AI's tendency to escape quotes in tags
                    const unescapedContent = shareContent.replace(/\\"/g, '"');
                    
                    if (unescapedContent.startsWith('{')) {
                        momentData = JSON.parse(unescapedContent);
                    } else if (shareContent.startsWith('{')) {
                        momentData = JSON.parse(shareContent);
                    }
                } catch (e) {
                    console.warn('[ChatStore] Failed to parse Moment JSON, falling back to basic data', e);
                }

                // Fallback: If not JSON or failed, treat as simple text
                if (!momentData) {
                    momentData = {
                        id: crypto.randomUUID(),
                        text: shareContent.replace(/\\"/g, '"'), 
                        author: chat.name,
                        image: chat.avatar
                    };
                }

                // Ensure essential fields
                if (!momentData.id) momentData.id = crypto.randomUUID();
                if (!momentData.author) momentData.author = chat.name;
                if (!momentData.avatar) momentData.avatar = chat.avatar;

                // We've found a share tag. We want to convert the WHOLE message to a moment_card ONLY if 
                // there's no other significant text. If there is other text, the UI component will handle 
                // stripping the tag and showing the card separately (Mixed rendering).
                // However, to maintain current architecture where cards are distinct types:
                newMsg.type = 'moment_card';
                newMsg.momentData = momentData; // Store structured data for cleaner access
                // Keep content as JSON for persistence if needed, or structured
                newMsg.content = JSON.stringify(momentData); 
                
                // Publish to moments feed so details are accessible and it shows in profile
                const momentResult = momentsStore.addMoment({
                    id: momentData.id,
                    authorId: chatId,
                    content: momentData.text || momentData.content || '',
                    images: momentData.image ? [momentData.image] : (momentData.images || []),
                });

                newMsg._momentReferenceId = momentResult.id;
                
                // Add system notification to chat using helper to ensure mode inheritance
                addMessage(chatId, {
                    role: 'system',
                    type: 'system',
                    content: `${chat.name} 发布了一条朋友圈`,
                    _momentReferenceId: momentResult.id
                });
            }
        }

        // --- World Loop: Advanced Interaction Instructions (AI Only) ---
        if (newMsg.role === 'ai') {
            // 1. [私聊: 角色名: 内容]
            const dmRegex = /\[(?:私聊|DM):\s*([^:：\]]+)\s*[:：]\s*([\s\S]*?)\]/gi;
            let dmMatch;
            while ((dmMatch = dmRegex.exec(newMsg.content)) !== null) {
                const targetName = dmMatch[1].trim();
                const dmContent = dmMatch[2].trim();

                // Find target character by name
                const targetChar = Object.values(chats.value).find(c => c.name === targetName);
                if (targetChar) {
                    // Inject message into the DM channel
                    setTimeout(() => {
                        addMessage(targetChar.id, {
                            role: 'ai',
                            content: dmContent,
                            timestamp: Date.now() + 100
                        });
                        triggerToast(`收到来自 ${targetName} 的私聊消息`, 'info');
                    }, 1500);
                }
            }

            // 2. [朋友圈: 角色名: 内容] (New integrated handler)
            const momentPostRegex = /\[(?:朋友圈|MOMENT):\s*([^:：\]]+)\s*[:：]\s*([\s\S]*?)\]/gi;
            let momentMatch;
            while ((momentMatch = momentPostRegex.exec(newMsg.content)) !== null) {
                const authorName = momentMatch[1].trim();
                const postText = momentMatch[2].trim();

                const { useMomentsStore } = await import('./momentsStore');
                const momentsStore = useMomentsStore();

                // Find author for avatar
                const authorChar = Object.values(chats.value).find(c => c.name === authorName);

                setTimeout(() => {
                    momentsStore.addPost({
                        author: authorName,
                        avatar: authorChar?.avatar || '/avatars/default.png',
                        content: postText,
                        images: []
                    });
                    triggerToast(`${authorName} 发布了新动态`, 'info');
                }, 2000);
            }

            // 3. [好友申请: 角色名]
            const friendRequestRegex = /\[(?:好友申请|FRIEND_REQUEST):\s*([^\]]+)\]/gi;
            let friendMatch;
            while ((friendMatch = friendRequestRegex.exec(newMsg.content)) !== null) {
                const name = friendMatch[1].trim();
                setTimeout(() => {
                    const newChar = createChat(name, {
                        hideFriendRequest: false, // Show the "Accept" card
                        openingLine: `你好，我是 ${name}，很高兴认识你。`
                    });
                    triggerToast(`收到 ${name} 的好友申请`, 'info');
                }, 3000);
            }
        }

        // [MOVED UP] 7. Call Logic (Control & Content Interception)
        // Must be done BEFORE adding to chat history to prevent pollution
        const { useCallStore } = await import('./callStore')
        const callStore = useCallStore()
        let content = newMsg.content || '' // Local content var

        // Robust Call State Check: include all states where the Call UI is visible
        const isCallActive = callStore.status !== 'none';

        // 7.1 User Content Interception
        if (newMsg.role === 'user') {
            if (callStore.status !== 'none' && callStore.status !== 'ended') {
                // Add to transcript
                callStore.addTranscriptLine('user', newMsg.content)
                // Hide from background chat history
                newMsg.hidden = true
            }
        }

        // 7.2 AI Logic & Protocol Handling
        if (newMsg.role === 'ai') {
            // Priority 0: Music & Standalone Call Triggers
            // Added [MUSIC:...] handling
            if (content.includes('[一起听歌:') || content.includes('<bgm>') || content.includes('[MUSIC:')) {
                const { useMusicStore } = await import('./musicStore')
                const musicStore = useMusicStore()
                const musicMatch = content.match(/\[一起听歌:([\s\S]+?)\]/i) || content.match(/<bgm>([\s\S]+?)<\/bgm>/i) || content.match(/\[MUSIC:\s*(?:search\s+)?([\s\S]+?)\]/i);

                if (musicMatch) {
                    const songQuery = musicMatch[1].trim()

                    // 1. Announce "Together Mode" if not already active
                    // User wants "X initiated Listen Together"
                    if (!musicStore.isListeningTogether) {
                        addMessage(chatId, {
                            role: 'system',
                            type: 'system', // Display as "X initiated..."
                            content: `${chat.name} 发起了 一起听歌`
                        })
                        musicStore.startTogether({ name: chat.name, avatar: chat.avatar })
                    } else {
                        // Even if active, ensure state is fresh
                        musicStore.startTogether({ name: chat.name, avatar: chat.avatar })
                    }

                    if (!musicStore.playerVisible) musicStore.togglePlayer()

                    let songName = songQuery, singer = ''
                    if (songQuery.includes('-')) {
                        const parts = songQuery.split('-'), s = parts[0].trim(), n = parts[1].trim();
                        // Heuristic: usually "Singer - Song" or "Song - Singer"? 
                        // AI log: "周杰伦 - 告白气球" -> Singer - Song
                        singer = s; songName = n;
                    }

                    musicStore.searchMusic(songName, singer).then(async results => {
                        if (results?.[0]) {
                            const song = results[0];
                            const url = await musicStore.getSongUrl(song);
                            if (url) {
                                musicStore.addSong(url);
                                musicStore.loadSong(musicStore.playlist.length - 1);

                                // 2. Add Song Card to Chat
                                // Style matching the user's "Image 4" request (Standard Card UI)
                                const cardHtml = `
                                <div class="flex items-center gap-3 p-3 bg-white/90 rounded-xl shadow-sm border border-gray-100 max-w-[240px]">
                                    <img src="${song.cover || '/default-music.png'}" class="w-14 h-14 rounded-lg bg-gray-100 object-cover flex-shrink-0" onerror="this.src='/default-music.png'" />
                                    <div class="flex-1 min-w-0 flex flex-col justify-center">
                                        <div class="font-bold text-[15px] leading-tight text-gray-800 truncate mb-1">${song.song}</div>
                                        <div class="text-xs text-gray-500 truncate">${song.singer || '未知歌手'}</div>
                                    </div>
                                    <div class="absolute top-2 right-2">
                                        <i class="fa-solid fa-music text-pink-400 text-xs opacity-50"></i>
                                    </div>
                                </div>`;

                                addMessage(chatId, {
                                    role: 'ai',
                                    type: 'html', // Use HTML type for rich card
                                    content: `[分享音乐: ${song.song}]`, // Fallback text
                                    html: cardHtml
                                });
                            }
                        }
                    })
                }
            }
            if (content.includes('[停止听歌]')) {
                const { useMusicStore } = await import('./musicStore')
                const musicStore = useMusicStore()
                musicStore.stopTogether()
            }
            if (content.includes('[语音通话]') || content.includes('[视频通话]')) {
                const callType = content.includes('[视频通话]') ? 'video' : 'voice'
                callStore.receiveCall({ name: chat.name, avatar: chat.avatar, id: chat.id }, callType)
            }

            // Priority 1: Handle standalone control tags or tags embedded with other content
            if (content.includes('[接听]') && callStore.status === 'dialing') {
                callStore.acceptCall()
            }
            if ((content.includes('[拒绝]') || content.includes('[拒接]')) && callStore.status === 'dialing') {
                callStore.endCall()
            }
            if (content.includes('[挂断]') && isCallActive) {
                callStore.endCall()
            }

            // Priority 2: Check for Call Protocol Block (Strict or Fuzzy)
            const hasJsonLike = content.includes('{') && (content.includes('"speech"') || content.includes('"status"') || content.includes('"action"') || content.includes('"行为"') || content.includes('"心声"'));

            if (content.includes('[CALL_START]') || content.includes('[CALL_END]') || (isCallActive && hasJsonLike)) {
                console.log('[ChatStore] Call Protocol Detected (Enhanced)');

                // Ensure we are in active state if we receive protocol data
                // This allows auto-accepting when AI starts talking during dialing (User calling AI)
                // WE DO NOT auto-accept if status is 'incoming' (AI calling User)
                if (callStore.status === 'dialing') {
                    console.log('[ChatStore] Auto-accepting established call due to protocol data');
                    callStore.acceptCall();
                }

                // AI Extraction Logic
                let callData = null;
                let textOutsideJson = content;
                try {
                    const matches = content.match(/\{[\s\S]*?\}/g);
                    if (matches) {
                        const jsonCandidate = matches[matches.length - 1];
                        callData = JSON.parse(jsonCandidate);
                        textOutsideJson = content.replace(jsonCandidate, '').trim();
                    }
                } catch (e) { }

                const protocolRegex = /\[CALL_START\]([\s\S]+?)\[CALL_END\]/i;
                const tagMatch = content.match(protocolRegex);
                if (tagMatch) {
                    try {
                        callData = JSON.parse(tagMatch[1]);
                        textOutsideJson = content.replace(tagMatch[0], '').trim();
                    } catch (e) { }
                }

                if (callData || textOutsideJson) {
                    // Protocol matched: Hide from chat history
                    newMsg.hidden = true;

                    if (callData?.status) callStore.updateStatus(callData.status);
                    if (callData?.hangup) callStore.endCall();
                } else if (callStore.status !== 'none') {
                    // Even if no protocol match, if any call is active/dialing, hide AI chatter from history
                    newMsg.hidden = true;
                }

                if (newMsg.hidden) return;

            }

            // Priority 3: Fallback for Normal Text during Active Call
            // FIX: Do NOT hide normal text messages even if call is active. Only hide Protocol.
            // This prevents "Missing Message" bugs if call state desyncs.
            if (isCallActive && content && !content.includes('[CALL_START]')) {
                // EXCLUSION: Don't add if it's strictly a protocol tag that got through display test
                if (!isEmptyDisplay) {
                    const cleanText = displayTest;
                    callStore.addTranscriptLine('ai', cleanText);
                }
            }

            // --- Final context & Hiding Check ---
            // Tag stripping patterns for checking if bubble will be empty
            const protocolTags = [
                /\{[\s\S]*?("speech"|"status"|"action"|"转发"|"心声"|"行为")[\s\S]*?\}/gi,
                /\[CALL_START\][\s\S]*?\[CALL_END\]/gi, /\[CALL_START\]|\[CALL_END\]/gi,
                /\[语音通话\]|\[视频通话\]|\[接听\]|\[挂断\]|\[拒绝\]/gi,
                /\[(?:UPDATE_)?BIO:[^\]]+\]/gi,
                /[\\[【]\s*LS_JSON[:：]?\s*[\s\S]*?[\]】]/gi, 
                /[\\[【]\s*LOVESPACE_(?:CONTRACT|REJECT|INVITE)[:：]?\s*[^\]】]*[\]】]/gi,
                /\[MOMENT_SHARE:[^\]]+\]|\[分享朋友圈:[^\]]+\]/gi,
                /\[一起听歌:[^\]]+\]|\[停止听歌\]|<bgm>[\s\S]*?<\/bgm>/gi,
                /\[领取红包:[^\]]+\]|\[领取转账:[^\]]+\]/gi,
                /\[LIKE[:：].*?\]/gi, /\[COMMENT[:：].*?\]/gi, /\[REPLY[:：].*?\]/gi,
                /\[INNER_VOICE\][\s\S]*?\[\/INNER_VOICE\]/gi
            ];

            let displayTest = content;
            protocolTags.forEach(p => { displayTest = displayTest.replace(p, ''); });
            const isEmptyDisplay = displayTest.trim().length === 0;

            if (isEmptyDisplay && content.trim().length > 0) {
                // If it's ONLY tags, hide it from the UI but PRESERVE the content for AI context
                newMsg.hidden = true;
            } else if (!newMsg.hidden && typeof newMsg.content === 'string') {
                // If it HAS text, clean ONLY known strictly internal protocol tags for the bubble display
                // We keep JSON-like content if it might be an HTML card, as ChatMessageItem will clean it during render
                const strictlyInternalTags = protocolTags.filter(p => !p.source?.includes('html') && !p.source?.includes('speech'));
                strictlyInternalTags.forEach(p => { newMsg.content = newMsg.content.replace(p, ''); });
                newMsg.content = newMsg.content.trim();
            }
        }

        // Filter out empty messages
        if (!newMsg.content || newMsg.content.length === 0) {
            return null;
        }

        // 3.3 Moment Reference Indexing
        if (newMsg.type === 'moment_card') {
            try {
                const data = typeof newMsg.content === 'string' ? JSON.parse(newMsg.content) : newMsg.content;
                if (data && data.id) {
                    newMsg._momentReferenceId = data.id;
                }
            } catch (e) {
                console.warn('[ChatStore] Could not index moment_card ID:', e);
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

        if (!chat.inChatList) chat.inChatList = true
        if (chatId !== currentChatId.value) {
            chat.unreadCount = (chat.unreadCount || 0) + 1
        }

        // Trigger Global Notification (Only for AI or other users, not self)
        if (newMsg.role !== 'user') {
            const contentStr = String(newMsg.content || '');
            const isToxic = contentStr.includes('display:') || contentStr.includes('border-radius') || contentStr.trim().startsWith('{');

            if (!isToxic && contentStr.trim().length > 0) {
                // App internal notification event
                notificationEvent.value = {
                    id: Date.now(),
                    chatId: chatId,
                    name: chat.name,
                    avatar: chat.avatar,
                    content: newMsg.type === 'family_card' ? '[亲属卡]' : (newMsg.type === 'image' ? '[图片]' : (newMsg.content || '[消息]')),
                    timestamp: Date.now()
                }
            }
        }


        // Auto-generate system messages for family cards
        content = typeof newMsg.content === 'string' ? newMsg.content : ''
        const userName = chat.userName || '用户'
        const charName = chat.name || '对方'

        if (content.includes('[FAMILY_CARD_APPLY:') && newMsg.role === 'user') {
            setTimeout(() => {
                addMessage(chatId, { role: 'system', content: `${userName}正在向${charName}申请绑定亲属卡` })
            }, 100)
        }

        if (content.includes('[FAMILY_CARD:') && !content.includes('APPLY') && !content.includes('REJECT') && newMsg.role === 'ai') {
            const match = content.match(/\[FAMILY_CARD[:：](\d+)[:：]([^\]:]+)(?:[:：]([^\]]+))?\]/i)
            const cardName = match ? match[2].trim() : '亲属卡'
            const amount = match ? parseFloat(match[1]) : 0
            const paymentId = match && match[3] ? match[3].trim() : null
            
            // Set message type and data for proper rendering
            newMsg.type = 'family_card'
            newMsg.amount = amount.toString()
            newMsg.text = `送给你的${cardName}`
            if (paymentId) newMsg.paymentId = paymentId
            
            // Sync: Find last family card application and mark it as claimed/responded
            const lastApply = (chat.msgs || []).slice().reverse().find(m => m.type === 'family_card_apply' || (typeof m.content === 'string' && m.content.includes('[FAMILY_CARD_APPLY:')));
            if (lastApply) {
                updateMessage(chatId, lastApply.id, {
                    status: 'claimed',
                    isClaimed: true
                });
                console.log('[ChatStore] Synced Family Card Apply status using updateMessage', lastApply.id);
            }
            
            // Add to wallet immediately
            const walletStore = useWalletStore()
            walletStore.addFamilyCard({
                ownerId: chatId,
                ownerName: charName,
                amount: amount,
                remark: cardName,
                bindTime: Date.now()
            })
            
            setTimeout(() => {
                addMessage(chatId, { role: 'system', content: `${charName}向您发送了亲属卡「${cardName}」，点击领取` })
            }, 100)
        }

        if (content.includes('[FAMILY_CARD_REJECT:') && newMsg.role === 'ai') {
            setTimeout(() => {
                addMessage(chatId, { role: 'system', content: `${charName}已拒绝${userName}的亲属卡申请` })
            }, 100)
        }


        checkAutoSummary(chatId)
        saveChats()
        return newMsg
    }

    async function analyzeCharacterArchive(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return;

        const settingsStore = useSettingsStore();
        const userProfile = settingsStore.personalization.userProfile;
        const userName = chat.userName || userProfile.name || '你';
        const userGender = chat.userGender || userProfile.gender || '未知';
        const userPersona = chat.userPersona || userProfile.persona || '';
        const userSig = typeof userProfile.signature === 'string' ? userProfile.signature : '';

        // No toast or system message here as requested by user - let the UI spinner handle it
        typingStatus.value[chatId] = true;
        isProfileProcessing.value[chatId] = true;

        try {
            // Source Data Collection - As requested by user
            const charPrompt = chat.prompt || '暂无详细设定';
            const userContext = `姓名：${userName} | 性别：${userGender} | 个性：${userSig} | 针对性设定：${userPersona}`;

            // Full Memory Bank (Latest Summary + Historical Summaries)
            const latestSummary = chat.summary || '';
            const historicalMemories = (chat.memory || []).join('\n');
            const fullMemoryLibrary = [latestSummary, historicalMemories].filter(s => s.trim()).join('\n\n') || '尚未建立持久记忆';

            // Custom Context Limit from Chat Settings
            const contextLimit = parseInt(chat.contextLimit) || 30;
            const contextMsgs = chat.msgs.slice(-contextLimit)
                .filter(m => m.role !== 'system')
                .map(m => `${m.role === 'user' ? userName : chat.name}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
                .join('\n');

            const systemInstructions = `你现在是【${chat.name}】本人。请基于以下提供的【源数据库】，深度挖掘并以第一人称“我”的视角补齐你自己的「灵魂档案」(Personal Profile)。
档案内容必须完全符合你的性格、语气和对 ${userName} 的情感底色。不要以分析师的口吻说话。

【输出规范】
你必须且只能使用 [BIO:键:值] 格式输出以下字段，不要输出任何开场白或解释。
禁止任何 HTML/CSS 标签。严禁使用占位符，必须替换为具体的描述。

请生成并整理以下信息：
1. **基础规格**：
   [BIO:性别:值] [BIO:年龄:值] [BIO:生日:值] [BIO:星座:值] 
   [BIO:人格:4位字母MBTI代码] [BIO:身高:值] [BIO:体重:值] [BIO:身材:描述] 
   [BIO:职业:描述] [BIO:婚姻:描述(如: 独身主义、暗恋中等)] 

2. **私人感官**：
   [BIO:个性签名:最符合你气质的一句话(20字内)]
   [BIO:气味:你的体味或常用香水描述] [BIO:风格:穿搭或行事风格] 
   [BIO:理想型:你喜欢的类型描述] [BIO:心动时刻:曾让你心跳加速的瞬间或场景] 

3. **兴趣与特质**：
   [BIO:爱好:爱好1, 爱好2, 爱好3] 
   [BIO:特质:性格标签1, 标签2, 标签3] 

4. **生活节律**：
   [BIO:Routine_awake:早上起床后的状态或第一件事] 
   [BIO:Routine_busy:忙碌工作/学习时的样子] 
   [BIO:Routine_deep:深夜独处时的思绪或习惯] 

5. **灵魂羁绊 (Soul Ties)**：
   [BIO:SoulBond_实际标签:你与 ${userName} 的深层情感纽带简述] 

6. **爱之物 (Items of Love)**：
   [BIO:LoveItem_1_物品名:英文生图Prompt (描述该物品，包含意境、质感、电影级光影)] 
   [BIO:LoveItem_2_物品名:英文生图Prompt] 
   [BIO:LoveItem_3_物品名:英文生图Prompt]

【源数据库】
1. 角色设定 (${chat.name}): ${charPrompt}
2. 用户背景 (${userName}): ${userContext}
3. 记忆库摘要: ${fullMemoryLibrary}
4. 对话片段 (参考语气): \n${contextMsgs}`;

            const response = await generateReply([{ role: 'system', content: systemInstructions }], chat);
            if (response && response.content) {
                addMessage(chatId, { role: 'ai', content: response.content, mode: 'online' });
            }
            triggerToast('个人档案更新成功', 'success');
        } catch (e) {
            console.error('Bio analysis failed:', e);
            triggerToast('解析失败，请检查网络', 'error');
        } finally {
            typingStatus.value[chatId] = false;
            isProfileProcessing.value[chatId] = false;
        }
    }
    async function updateCharacter(chatId, updates) {
        const chat = chats.value[chatId]
        if (!chat) return false

        // Merge into a new object to trigger reactivity
        chats.value[chatId] = { ...chat, ...updates }

        // Re-assign the whole chats object to ensure top-level reactivity
        chats.value = { ...chats.value }

        // Immediately check for auto-summary if settings changed
        if (updates.autoSummary || updates.summaryLimit) {
            checkAutoSummary(chatId)
        }

        await saveChats()
        return true
    }

    // --- Memory Logic ---


    // --- Memory Logic ---


    function getTokenCount(chatId) {
        const stats = getTokenBreakdown(chatId)
        return stats.totalContext
    }

    // Auto Summary Logic
    // Auto Summary Logic
    function checkAutoSummary(chatId) {
        const chat = chats.value[chatId]
        if (!chat || !chat.autoSummary) return

        // Prevent concurrent execution (Fix Double Toast)
        if (chat.isSummarizing) return

        const msgs = chat.msgs || []
        const summaryLimit = parseInt(chat.summaryLimit) || 50

        // Use lastSummaryCount (total messages at last summary) for better diff
        let lastCount = chat.lastSummaryCount || 0

        // PROACTIVE FIX: If lastCount exceeds current msgs length (e.g. deletion occurred), we must clamp it to avoid negative backlog
        // This ensures the counter resets to current length, so new messages immediately start accumulating towards limit
        if (lastCount > msgs.length) {
            console.log('[AutoSummary] Clamping lastCount (deletion detected)', lastCount, '->', msgs.length)
            chat.lastSummaryCount = msgs.length
            chat.lastSummaryIndex = Math.min(chat.lastSummaryIndex || 0, msgs.length)
            lastCount = msgs.length
            // Don't saveChats() here to avoid I/O loop, it will save when summary triggers or next message adds
        }

        const backlog = msgs.length - lastCount

        // Check if new messages (since last summary) exceed limit
        if (backlog >= summaryLimit) {
            console.log(`[AutoSummary] Triggered for ${chat.name}. New msgs (backlog): ${backlog}, Limit: ${summaryLimit}`)
            useLoggerStore().info(`触发自动总结: ${chat.name}`, { backlog, limit: summaryLimit })
            summarizeHistory(chatId, { silent: true })
        }
    }

    async function summarizeHistory(chatId, options = {}) {
        const chat = chats.value[chatId]
        if (!chat) return { success: false, error: 'Chat not found' }

        // Double check lock
        if (chat.isSummarizing) return { success: false, error: 'Summarization already in progress' }
        chat.isSummarizing = true

        if (!options.silent) {
            triggerToast('正在分析上下文...', 'info')
        }

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
                // Auto Mode: Chunked Catch-Up
                const lastIndex = chat.lastSummaryIndex || 0
                const currentTotal = chat.msgs.length

                // FIX: Reset index if it exceeds current message count (Corruption/Truncation recovery)
                if (lastIndex > currentTotal) {
                    console.warn(`[Summarize] Index mismatch detected (Index: ${lastIndex}, Total: ${currentTotal}). Resetting to 0.`);
                    chat.lastSummaryIndex = 0;
                    // Recursive retry with fresh state
                    return summarizeHistory(chatId, options);
                }
                const summaryLimit = parseInt(chat.summaryLimit) || 50
                const backlog = currentTotal - lastIndex


                // Process up to summaryLimit messages at a time
                let endIndex = currentTotal
                if (backlog > summaryLimit + 10) {
                    endIndex = parseInt(lastIndex) + summaryLimit // Force Int
                    rangeDesc = `自动增量 (${lastIndex + 1}-${endIndex})`
                    console.log(`[Summarize] Catch-up: Processing chunk ${lastIndex}-${endIndex} (Remaining: ${currentTotal - endIndex})`)
                } else {
                    rangeDesc = `自动增量`
                }

                console.log('[Summarize DEBUG]', { lastIndex, endIndex, currentTotal, msgsLen: chat.msgs.length, typeofLast: typeof lastIndex })
                targetMsgs = chat.msgs.slice(lastIndex, endIndex)


                if (targetMsgs.length === 0) {
                    throw new Error('No new messages to summarize')
                }

                nextIndex = endIndex
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

            const newMemoryItem = {
                id: Date.now(),
                timestamp: Date.now(),
                range: rangeDesc,
                content: summaryContent
            }

            // Update memory list (non-mutating for better reactivity)
            chat.memory = [newMemoryItem, ...chat.memory]

            // Also update the latest summary field for AI context
            chat.summary = summaryContent
            
            console.log('[Summarize] Memory saved:', { 
                memoryId: newMemoryItem.id, 
                memoryCount: chat.memory.length,
                summaryLength: summaryContent.length 
            })

            triggerToast('总结已生成并存入记忆库', 'info')

            // Advance the summary pointers if we just summarized a range that covers new ground
            const currentMaxIndex = chat.lastSummaryIndex || 0
            const summarizedEndIndex = options.endIndex !== undefined ? options.endIndex : nextIndex

            if (summarizedEndIndex > currentMaxIndex) {
                console.log(`[Summarize] Advancing pointers: ${currentMaxIndex} -> ${summarizedEndIndex}`)
                chat.lastSummaryIndex = summarizedEndIndex
                chat.lastSummaryCount = summarizedEndIndex // Sync progress tracker
            }

            // RECURSION CHECK: If we are in auto mode (no manual range) and still have a backlog, trigger next batch
            if (options.startIndex === undefined) {
                const summaryLimit = parseInt(chat.summaryLimit) || 50
                const remainingBacklog = chat.msgs.length - summarizedEndIndex

                if (remainingBacklog >= summaryLimit) {
                    console.log(`[Summarize] Backlog still exists (${remainingBacklog} msgs). Scheduling next chunk...`)
                    setTimeout(() => checkAutoSummary(chatId), 1500)
                }
            }

            console.log('[Summarize] Saving to database...')
            saveChats()
            console.log('[Summarize] Save completed')
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

    function acceptPendingRequest(requestId) {
        const req = pendingRequests.value.find(r => r.id === requestId);
        if (!req) return;

        if (req.type === 'group_invite') {
            // Join group logic: set inChatList to true so it shows up
            updateCharacter(req.targetId, { inChatList: true, isExited: false });
            triggerToast(`已加入群聊: ${req.targetName}`, 'success');
        } else {
            // Add friend logic: already exists in chats, just show it
            updateCharacter(req.fromId, { inChatList: true });
            triggerToast(`已添加好友: ${req.fromName}`, 'success');
        }

        pendingRequests.value = pendingRequests.value.filter(r => r.id !== requestId);
        saveChats();
    }

    function rejectPendingRequest(requestId) {
        pendingRequests.value = pendingRequests.value.filter(r => r.id !== requestId);
        saveChats();
        triggerToast('已拒绝申请', 'info');
    }

    // --- Proactive Chat Logic ---
    let proactiveWorker = null

    function startProactiveLoop() {
        // 1. Cleanup old worker
        if (proactiveWorker) {
            proactiveWorker.terminate()
            proactiveWorker = null
        }

        // 2. Create Web Worker for background-resilient timing
        const workerScript = `
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    setInterval(() => {
                        self.postMessage('tick');
                    }, 60000); // Check every minute
                }
            };
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        proactiveWorker = new Worker(URL.createObjectURL(blob));

        proactiveWorker.onmessage = (e) => {
            if (e.data === 'tick') {
                const logger = useLoggerStore()
                // Only log one tick every 30 mins to avoid noise in the log
                const now = new Date()
                if (now.getMinutes() % 30 === 0) {
                    logger.sys('[Proactive] Worker heartbeat: scanning all chats...')
                }

                Object.keys(chats.value).forEach(chatId => {
                    checkProactive(chatId)
                })
            }
        }

        // Start the worker
        proactiveWorker.postMessage('start');

        // 3. Visibility API Compensation (Check immediately when user returns)
        if (typeof document !== 'undefined') {
            let lastForegroundTime = Date.now()
            document.addEventListener('visibilitychange', () => {
                const logger = useLoggerStore()
                if (document.visibilityState === 'visible') {
                    // Avoid double triggers within 2 seconds
                    if (Date.now() - lastForegroundTime < 2000) return
                    lastForegroundTime = Date.now()

                    logger.sys('[Proactive] App in foreground, checking missed triggers...')
                    Object.keys(chats.value).forEach(chatId => {
                        checkProactive(chatId)
                    })
                }
            });
        }
    }

    async function checkProactive(chatId) {
        const callStore = useCallStore()
        const logger = useLoggerStore()
        const chat = chats.value[chatId]
        if (!chat) return

        const now = Date.now()
        // 获取用户最后一条消息的时间（而不是 char 刷屏后的时间）
        const userMsgs = (chat.msgs || []).filter(m => m.role === 'user')
        const lastUserMsg = userMsgs.slice(-1)[0]
        const lastMsgTime = lastUserMsg ? lastUserMsg.timestamp : now
        const diffMinutes = (now - lastMsgTime) / 1000 / 60

        if (typingStatus.value[chatId] || callStore.status !== 'none') return

        // 1. Proactive Chat / Call (While user is in the current chat but idle)
        if (chat.proactiveChat && currentChatId.value === chatId) {
            const pInterval = parseInt(chat.proactiveInterval) || 30
            // 检查是否需要触发：距离上次触发时间超过间隔，且距离最后一条消息也超过间隔
            const timeSinceLastTrigger = chat._lastProactiveTriggeredTime ? (now - chat._lastProactiveTriggeredTime) : Infinity
            if (diffMinutes >= pInterval && timeSinceLastTrigger >= pInterval * 60000) {
                chat._lastProactiveTriggeredTime = now
                saveChats() // 保存时间戳
                const rand = Math.random()
                logger.sys(`[Proactive] Triggering idle response for ${chat.name}`)
                if (rand < 0.2) {
                    const callType = Math.random() > 0.5 ? 'video' : 'voice'
                    sendMessageToAI(chatId, {
                        hiddenHint: `【系统：距离上次对话已过 ${Math.floor(diffMinutes)} 分钟。】现在，请你立即主动发起一个${callType === 'video' ? '视频' : '语音'}通话给用户。只需回复：[${callType === 'video' ? '视频通话' : '语音通话'}]。请勿重复、复制、抄袭前文输出内容，每次输出必须创新并保证格式正确。`,
                        isProactiveCall: true
                    })
                } else {
                    sendMessageToAI(chatId, { hiddenHint: `【系统：距离上次对话已过 ${Math.floor(diffMinutes)} 分钟。】给用户发条简短的消息。可以带上表情包。请勿重复、复制、抄袭前文输出内容，每次输出必须创新并保证格式正确。` })
                }
            }
        }

        // 2. Active Chat (Check-in while user is elsewhere or app in background)
        if (chat.activeChat && currentChatId.value !== chatId) {
            const aInterval = parseInt(chat.activeInterval) || 120
            // 检查是否需要触发：距离上次触发时间超过间隔，且距离最后一条消息也超过间隔
            const timeSinceLastTrigger = chat._lastActiveTriggeredTime ? (now - chat._lastActiveTriggeredTime) : Infinity
            if (diffMinutes >= aInterval && timeSinceLastTrigger >= aInterval * 60000) {
                chat._lastActiveTriggeredTime = now
                saveChats() // 保存时间戳
                logger.sys(`[Proactive] Triggering check-in message for ${chat.name}`)
                const timeStr = new Date().getHours() + ":" + new Date().getMinutes().toString().padStart(2, '0')
                const callChance = Math.random() < 0.15
                const hint = callChance
                    ? `【系统：距离上次对话已过 ${Math.floor(diffMinutes)} 分钟。】现在是${timeStr}，你很想念用户，请立即通过 [语音通话] 联系对方或发消息询问当前状态。请勿重复、复制、抄袭前文输出内容，每次输出必须创新并保证格式正确。`
                    : `【系统：距离上次对话已过 ${Math.floor(diffMinutes)} 分钟。】现在是${timeStr}，你发现用户已经很久没理你了，发条关怀消息（或分享朋友圈）。请勿重复、复制、抄袭前文输出内容，每次输出必须创新并保证格式正确。`
                sendMessageToAI(chatId, { hiddenHint: hint })
            }
        }

        // 3. Scheduler Task
        const schedulerStore = useSchedulerStore()
        const dueTasks = schedulerStore.tasks.filter(t => t.enabled && t.chatId === chatId && t.timestamp <= now)
        if (dueTasks.length > 0) {
            dueTasks.forEach(task => {
                logger.sys(`[Proactive] Executing scheduler task: ${task.content}`)
                schedulerStore.removeTask(task.id)
                sendMessageToAI(chatId, { hiddenHint: `【系统：距离上次对话已过 ${Math.floor(diffMinutes)} 分钟。】执行定时任务：${task.content}。请根据当前人设发送消息通知用户。请勿重复、复制、抄袭前文输出内容，每次输出必须创新并保证格式正确。` })
            })
        }

        // 4. Random Proactive
        const randomConfig = schedulerStore.randomConfigs[chatId]
        if (randomConfig && randomConfig.enabled && randomConfig.nextTrigger > 0 && now >= randomConfig.nextTrigger) {
            logger.sys(`[Proactive] Triggering random proactive message for ${chat.name}`)
            schedulerStore.updateNextRandomTrigger(chatId)
            sendMessageToAI(chatId, { hiddenHint: `【系统：距离上次对话已过 ${Math.floor(diffMinutes)} 分钟。】随机触发。现在是 ${new Date().getHours()}:${new Date().getMinutes()}，根据当前上下文，主动和用户说点什么吧。请勿重复、复制、抄袭前文输出内容，每次输出必须创新并保证格式正确。` })
        }
    }

    // Initialize proactive loop
    startProactiveLoop()



    function deleteMessage(chatId, msgId) {
        const chat = chats.value[chatId]
        if (!chat) return
        chat.msgs = chat.msgs.filter(m => m.id !== msgId)
        saveChats()
    }



    function toggleSearch(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return
        chat.searchEnabled = !chat.searchEnabled
        saveChats()
        triggerToast(chat.searchEnabled ? '🌐 已开启联网模式' : '📴 已关闭联网模式', 'info')
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
        const momentsStore = useMomentsStore()
        const callStore = useCallStore()
        const chat = chats.value[chatId]
        if (!chat) return

        // Pass searchEnabled to AI service options
        const aiOptions = {
            ...options,
            searchEnabled: chat.searchEnabled
        }

        // --- Silent Sharing Interception ---
        const lastMsg = (chat.msgs || []).slice(-1)[0]
        if (lastMsg && lastMsg.type === 'moment_card' && !options.force) {
            console.log('[ChatStore] Silent sharing active. AI will not reply to moment_card until next user message.')
            isTyping.value = false // Ensure typing indicator is off
            return
        }

        typingStatus.value[chatId] = true

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
                // Force strict clear format: YYYY年MM月DD日 HH:mm:ss 星期X
                // Match the style used in Inner Voice examples for better AI alignment
                const d = new Date()
                const weekDays = ['日', '一', '二', '三', '四', '五', '六']
                currentVirtualTime = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')} 星期${weekDays[d.getDay()]}`
            }
        }

        // 1. 准备上下文：根据设置动态截取消息历史
        const contextLimit = chat.contextLimit || 20
        const rawContext = (chat.msgs || []).slice(-contextLimit).map(m => {
            let content = ""
            if (typeof m.content === 'string') {
                content = m.content
            } else if (Array.isArray(m.content)) {
                content = m.content.map(p => p.text || '').join('\n')
            } else {
                content = String(m.content || '')
            }

            // 处理特殊卡片的上下文表现
            if (m.type === 'image') {
                // 图片消息：保留 [图片] 标签以便 AI 识别，同时保留 image 字段供多模态模型使用
                content = '[图片]'
                // 如果 image 字段存在（base64 或 URL），AI 服务会将其作为多模态输入
            }
            if (m.type === 'moment_card') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    content = `[用户分享了一条朋友圈动态] 作者: ${data.author || '未知'}, 文案: ${data.text || '（无文案）'}${data.image ? ' (包含一张图片)' : ''}`
                    if (data.image) m.image = data.image;
                } catch (e) { content = '[朋友圈动态]' }
            } else if (m.type === 'favorite_card') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    content = `[用户分享了一条收藏内容] 来源: ${data.source || '未知'}, 内容详情: ${data.fullContent || data.preview || '暂无内容'}`
                    if (data.image) m.image = data.image;
                } catch (e) { content = '[收藏内容]' }
            } else if (m.type === 'voice') {
                content = `[语音消息:${content}]`
            } else if (m.type === 'sticker') {
                // 表情包：提取名称或直接使用内容
                const stickerMatch = content.match(/\[表情包[:：]\s*(.+?)\]/);
                const stickerName = stickerMatch ? stickerMatch[1] : (content || '表情');
                content = `[表情包:${stickerName}]`
            } else if (m.type === 'lovespace_diary' || m.type === 'lovespace_message' || m.type === 'lovespace_letter') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    const spaceType = {
                        'lovespace_diary': '日记',
                        'lovespace_message': '留言',
                        'lovespace_letter': '情书'
                    }[m.type];
                    // 添加时间戳
                    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                    content = `[情侣空间·${spaceType}${timeStr ? `·${timeStr}` : ''}] ${data.author || 'TA'}: ${data.title || data.content || ''}`;
                } catch (e) { content = '[情侣空间动态]' }
            } else if (m.type === 'lovespace_album' || m.type === 'lovespace_sticky' || m.type === 'lovespace_anniversary') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    const spaceType = {
                        'lovespace_album': '相册',
                        'lovespace_sticky': '便利贴',
                        'lovespace_anniversary': '纪念日'
                    }[m.type];
                    // 添加时间戳
                    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                    content = `[情侣空间·${spaceType}${timeStr ? `·${timeStr}` : ''}] ${data.author || 'TA'}: ${data.title || data.content || data.name || ''}`;
                } catch (e) { content = '[情侣空间动态]' }
            }

            if (m.role === 'ai') {
                // 清理并标准化心声块。为了节省上下文，只给AI喂回它当时最后确定的这一条思维逻辑。
                // 这能保证AI在接下来的回复中能维持人设和当前情绪的一致性。
                const ivRegex = /\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi
                const ivMatches = [...content.matchAll(ivRegex)]
                
                // 同时检测 naked JSON (支持转义引号)
                const jsonMatches = [...content.matchAll(/\{[\s\S]*?\}/g)];
                let foundIv = null;

                if (ivMatches.length > 0) {
                    foundIv = ivMatches[0][0]; // 使用找到的首个带标签心声
                } else {
                    // 如果没带标签，搜索包含心声关键字的 JSON 块
                    for (const jm of jsonMatches) {
                        const block = jm[0];
                        if (block.includes('"status"') || block.includes('"心声"') || 
                            block.includes('\"status\"') || block.includes('\"心声\"')) {
                            foundIv = `\n[INNER_VOICE]\n${block}\n[/INNER_VOICE]`;
                            content = content.replace(block, '').trim();
                            break;
                        }
                    }
                }

                if (foundIv) {
                    content = content.replace(ivRegex, '').trim() + '\n' + foundIv
                }
            }

            if (m.quote) {
                const quoteAuthor = m.quote.role === 'user' ? '我' : (chat.name || '对方')
                content = `（引用来自 ${quoteAuthor} 的消息: "${m.quote.content}"）\n${content}`
            }

            // 注意：不在此处包裹 [ONLINE]/[OFFLINE] 标签，合并后再统一包裹以节省 token
            return {
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: content,
                image: m.image,
                mode: m.mode || 'online'  // 保留模式信息用于后续统一包裹
            }
        })

        // --- 角色轮替保护：合并连续的 User/Assistant 消息 (Gemini 必须交替) ---
        // 合并相同角色的连续消息，然后统一包裹模式标签
        const mergedContext = [];
        rawContext.forEach(m => {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === m.role) {
                // 合并内容
                if (typeof last.content === 'string' && typeof m.content === 'string') {
                    last.content += `\n\n${m.content}`;
                }
                if (m.image) last.image = m.image;
                // 如果模式不同，以第一条消息的模式为准（通常同一轮发送的消息模式相同）
            } else {
                mergedContext.push({...m});
            }
        });
        
        // 统一包裹模式标签：合并后的消息统一包裹一次标签，节省 token
        mergedContext.forEach(m => {
            const msgMode = m.mode || 'online';
            if (msgMode === 'offline') {
                m.content = `[OFFLINE]\n${m.content}\n[/OFFLINE]`;
            } else {
                m.content = `[ONLINE]\n${m.content}\n[/ONLINE]`;
            }
            // 删除临时的 mode 字段
            delete m.mode;
        });

        // 2. 注入提示 (Hidden Hint / 时间感知 / 通话引导)
        const callStatus = callStore.status
        if (callStatus === 'dialing' || callStatus === 'incoming') {
            const userName = chat.userName || '用户'
            const callType = callStore.type === 'video' ? '视频' : '语音'
            // If status is 'dialing', it means the USER initiated a call to the AI.
            // If status is 'incoming', it means the AI initiated a call to the USER.
            const callHint = callStatus === 'dialing'
                ? `【系统提示：${userName}正在呼叫你（${callType}通话）。请立即做出选择：

**选项1：接听**
回复格式：
[接听]
[CALL_START]
{
  "speech": "接通后你说的第一句话（中文口语）",
  "action": "你的神态/动作",
  "status": "你的心情状态",
  "hangup": false
}
[CALL_END]

**选项2：拒绝**
回复：[拒绝] 并说明理由

注意：如果接听，必须严格按照上述 JSON 格式输出，不要使用 INNER_VOICE 或其他标签。】`
                : `【系统提示：你正在发起呼叫 ${userName}（${callType}通话），等待对方响应...】`

            console.log(`[ChatStore] Injecting call hint for status: ${callStatus}`);

            const callTag = (options.mode || 'online') === 'offline' ? 'OFFLINE' : 'ONLINE';
            const wrappedCallHint = `[${callTag}]\n${callHint}\n[/${callTag}]`;
            
            const last = mergedContext[mergedContext.length - 1]
            if (last && last.role === 'user') {
                last.content += `\n\n${wrappedCallHint}`
            } else {
                mergedContext.push({ role: 'user', content: wrappedCallHint })
            }
        } else if (callStatus === 'active') {
            const callTag = (options.mode || 'online') === 'offline' ? 'OFFLINE' : 'ONLINE';
            const callActiveHint = `[${callTag}]\n【系统：当前通话已接通。请继续与用户愉快地聊天，直接输出对话 JSON 即可，严禁再次回复“[接听]”或重复开场动作。】\n[/${callTag}]`
            const last = mergedContext[mergedContext.length - 1]
            if (last && last.role === 'user') {
                last.content += `\n\n${callActiveHint}`
            } else {
                mergedContext.push({ role: 'user', content: callActiveHint })
            }
        } else if (options.hiddenHint) {
            const last = mergedContext[mergedContext.length - 1];
            const hintTag = (options.mode || 'online') === 'offline' ? 'OFFLINE' : 'ONLINE';
            const wrappedHint = `[${hintTag}]\n[系统要求] ${options.hiddenHint}\n[/${hintTag}]`;

            if (last && last.role === 'user') {
                last.content += `\n\n${wrappedHint}`;
            } else {
                mergedContext.push({ role: 'user', content: wrappedHint });
            }
        }
        else if (diffMinutes >= 1) {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === 'user') {
                const hours = Math.floor(diffMinutes / 60)
                const mins = diffMinutes % 60
                const timeStr = hours > 0 ? `${hours}小时${mins}分` : `${mins}分`;
                const timeTag = (options.mode || 'online') === 'offline' ? 'OFFLINE' : 'ONLINE';
                const wrappedTime = `[${timeTag}]\n【系统提示：当前时间为 ${currentVirtualTime}，距离上次互动已过去 ${timeStr}。请勿重复、复制、抄袭前文输出内容，每次输出必须创新并保证格式正确。】\n[/${timeTag}]`;
                last.content += ` \n\n${wrappedTime}`;
            }
        }

        const context = mergedContext;


        // 3. 调用 AI
        try {
            // Stop any previous generation for THIS specific chat
            if (abortControllers[chatId]) {
                stopGeneration(true, chatId)
            }
            abortControllers[chatId] = new AbortController()
            const signal = abortControllers[chatId].signal

            let momentsAwareness = '' // Placeholder for moments context

            const charInfo = {
                name: chat.name || '角色',
                gender: chat.gender || '无',
                description: (chat.prompt || '') + momentsAwareness,
                memory: chat.memory || [],
                msgs: chat.msgs || [],  // ← 关键！对话阶段检测依赖此字段
                userName: chat.userName || '用户',
                userGender: chat.userGender || '无',
                userPersona: chat.userPersona || '',
                userAvatarUrl: chat.userAvatar,
                avatarUrl: chat.avatar,
                bio: chat.bio,
                worldBookLinks: chat.worldBookLinks,
                emojis: chat.emojis,
                virtualTime: currentVirtualTime,
                canDraw: true,
                searchEnabled: aiOptions.searchEnabled,
                userLocation: chat.userLocation,
                locationSync: chat.locationSync,
                charLocation: chat.charLocation || null
            }

            // Inject Drawing Capability Hint globally if not explicitly disabled
            const drawingHint = `\n\n【生图功能激活】\n你可以通过指令 [DRAW: 英文提示词] 直接在聊天中发送图片给用户。
例如：你想给用户发张自拍，可以说：“等等，我给你发张自拍 [DRAW: a cute anime girl taking a selfie, looking at camera]”
请注意：
1. 提示词必须是英文。
2. 只有在真正需要发图时才使用该指令。`
            charInfo.description += drawingHint

            // Music Awareness (Listen Together)
            const musicStore = useMusicStore()
            if (musicStore.isListeningTogether && musicStore.currentSong) {
                const song = musicStore.currentSong
                const musicHint = `\n\n【当前正在一起听歌】\n你正和用户一起听：${song.song} - ${song.singer}。
你可以对这首歌发表看法，或者在觉得氛围合适时，使用 <bgm>歌名 - 歌手</bgm> 格式切换下一首符合当前氛围的歌曲。`
                charInfo.description += musicHint
            }

            // --- Love Space Context Aware ---
            try {
                const { useLoveSpaceStore } = await import('./loveSpaceStore')
                const loveSpaceStore = useLoveSpaceStore()
                const lsPrompt = loveSpaceStore.generateSystemPrompt(chatId)
                if (lsPrompt) {
                    charInfo.description += `\n\n${lsPrompt}\n请绝对禁止在回复中通过普通文本形式复述或总结 [LS_JSON] 指令的内容，只需静默生成指令即可。`
                }
            } catch (e) {
                console.warn('[ChatStore] Failed to inject Love Space context', e)
            }

            // Log the context being sent to AI for debugging
            useLoggerStore().addLog('AI', '网络请求 (即时上下文)', {
                contextMessages: context.length,
                charInfo: {
                    name: charInfo.name,
                    memoryCount: charInfo.memory?.length || 0,
                    virtualTime: charInfo.virtualTime
                },
                payload: {
                    messages: context,
                    model: 'Context Preview',
                    temperature: 1.0
                }
            })

            // Use Call System Prompt ONLY when call is active (not during incoming/dialing)
            // During incoming/dialing, use normal prompt so AI can choose [接听] or [拒绝]
            const isCallActive = callStore.status === 'active'
            const isCallContext = isCallActive // Only use call prompt when actually in call

            // Track if we are in a call to handle message shadowing/hiding
            const isCallMode = callStore.status !== 'none';

            // Streaming handler for calls
            let hasAddedCallLine = false;
            const onChunk = isCallActive ? (delta, full) => {
                // ... (existing chunk logic) ...
            } : null;

            // FOR CALLS: Disable streaming to ensure complete JSON blocks are received,
            // as partial JSON is harder to parse reliably for voice.
            const result = await generateReply(context, charInfo, signal, {
                ...aiOptions,
                isCall: isCallContext, // Only use call prompt when status is 'active'
                stream: isCallContext ? false : undefined, // Force non-streaming for calls
                onChunk: isCallActive ? onChunk : null
            })



            // Clear controller on success
            delete abortControllers[chatId]

            if (result.error) {
                // Ignore abort errors which happen on hangup
                if (result.error.name === 'AbortError' || String(result.error).includes('aborted') || String(result.error).includes('canceled')) {
                    console.log('[ChatStore] Generation aborted (likely due to hangup).');
                    return;
                }
                addMessage(chatId, { role: 'system', content: `[系统错误] ${result.error}` })
                return
            }

            // 3. 添加 AI 回复 (拆分消息 - Data Level Splitting)
            if (result.content) {
                let fullContent = result.content;
                let _pendingMomentCardData = null;  // Track MOMENT_SHARE data to attach as moment_card

                setStreamingMessage(chatId, null, fullContent, options.mode || 'online')

                // --- Pre-process: Strip Character Name Prefixes (防止剧本格式) ---
                // Regex matches names like "乔笙: ", "乔笙：", "乔笙 " at start of lines or message
                if (chat.name) {
                    const nameEscaped = chat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const nameRegex = new RegExp(`^\\s*${nameEscaped}\\s*[:：\\s-]\\s*`, 'gm');
                    fullContent = fullContent.replace(nameRegex, '').trim();
                }

                updateStreamingContent(chatId, fullContent)

                // --- Handle Call Signal Interception ([接听] / [拒绝]) ---
                if (callStore.status === 'dialing') {
                    if (fullContent.includes('[接听]')) {
                        console.log('[ChatStore] AI accepted the call');
                        callStore.acceptCall();

                        // 直接解析通话 JSON，不再触发第二次 AI 调用
                        const callMatch = fullContent.match(/\[CALL_START\]\s*(\{[\s\S]*?\})\s*\[CALL_END\]/i);
                        if (callMatch) {
                            try {
                                const jsonStr = callMatch[1].trim();
                                const callData = JSON.parse(jsonStr);

                                // 添加到通话记录
                                if (callData.speech) {
                                    callStore.addTranscriptLine('ai', callData.speech, callData.action || '');

                                    // 播放语音
                                    if (window.speechSynthesis && callData.speech) {
                                        const utterance = new SpeechSynthesisUtterance(callData.speech);
                                        utterance.lang = 'zh-CN';
                                        utterance.rate = 1.0;
                                        window.speechSynthesis.speak(utterance);
                                    }
                                }

                                return; // 不添加消息到聊天记录
                            } catch (e) {
                                console.error('[ChatStore] Failed to parse call JSON:', e);
                            }
                        }

                        // 如果没有找到 JSON 或解析失败，不显示消息
                        return;
                    } else if (fullContent.includes('[拒绝]') || fullContent.includes('[拒接]')) {
                        console.log('[ChatStore] AI rejected the call');
                        callStore.rejectCall();
                        // 拒绝消息正常显示
                    }
                }

                // --- Handle Call Mode Post-Processing ---
                // Strict Check: Call must currently be active to play audio/process JSON
                const isActuallyActive = (callStore.status === 'active' || isCallActive) && callStore.status !== 'ended' && callStore.status !== 'none';
                if (isActuallyActive) {
                    callStore.isSpeaking = false;
                    // Extract final speech/action from the JSON
                    const finalMatch = fullContent.match(/\[CALL_START\]\s*(\{[\s\S]*?\}|[\s\S]*?)\s*\[CALL_END\]/i);
                    if (finalMatch) {
                        try {
                            const jsonStr = finalMatch[1].trim();
                            const callData = JSON.parse(jsonStr);
                            if (callData.speech) {
                                // MANDATORY: If we are in active call, the "speech" is what we want to record in chat.
                                // We replace the fullContent so nothing else (narrations) is saved/displayed.
                                fullContent = callData.speech;
                                if (callData.action) fullContent += ` (${callData.action})`;

                                if (!hasAddedCallLine) {
                                    callStore.addTranscriptLine('ai', callData.speech, callData.action || '');
                                } else {
                                    callStore.updateLastTranscriptLine(callData.speech);
                                    const lastLine = callStore.transcript[callStore.transcript.length - 1];
                                    if (lastLine) lastLine.action = callData.action || '';
                                }

                                // TTS logic: Strip bracketed content for speech only
                                if (callStore.isSpeakerOn && window.speechSynthesis) {
                                    window.speechSynthesis.cancel(); // Prevent stacking
                                    const ttsText = callData.speech.replace(/\([\s\S]*?\)/g, '').replace(/（[\s\S]*?）/g, '').trim();
                                    if (ttsText) {
                                        const utterance = new SpeechSynthesisUtterance(ttsText);
                                        utterance.lang = 'zh-CN';
                                        window.speechSynthesis.speak(utterance);
                                    }
                                }
                            }
                            if (callData.hangup) {
                                callStore.endCall();
                            }
                        } catch (e) {
                            console.warn('[ChatStore] Failed to parse final call JSON', e);
                        }
                    } else {
                        // FALLBACK: If tags [CALL_START] are missing, but it LOOKS like JSON, try to extract speech field
                        let speechText = '';
                        const speechMatch = fullContent.match(/"speech"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        if (speechMatch && speechMatch[1]) {
                            // Correctly handle escaped characters in the regex match
                            speechText = speechMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
                        } else {
                            // Remove [INNER_VOICE] and other tags
                            let clean = fullContent.replace(/\[INNER[-_ ]?VOICE\][\s\S]*?\[\/INNER[-_ ]?VOICE\]/gi, '');
                            clean = clean.replace(/\[MOMENT\][\s\S]*?\[\/MOMENT\]/gi, '');
                            clean = clean.replace(/\[[\s\S]*?\]/g, '');
                            speechText = clean.trim();
                        }

                        if (speechText) {
                            fullContent = speechText;
                            callStore.addTranscriptLine('ai', speechText);
                            if (callStore.isSpeakerOn && window.speechSynthesis) {
                                window.speechSynthesis.cancel(); // Prevent stacking
                                const ttsText = speechText.replace(/\([\s\S]*?\)/g, '').replace(/（[\s\S]*?）/g, '').trim();
                                if (ttsText) {
                                    const utterance = new SpeechSynthesisUtterance(ttsText);
                                    utterance.lang = 'zh-CN';
                                    window.speechSynthesis.speak(utterance);
                                }
                            }
                        }
                    }
                }



                // --- Pre-process: Auto-Fix Missing [/INNER_VOICE] ---
                // If we detect [INNER_VOICE] but no closing tag, we try to auto-close it at the end of the JSON block
                if (fullContent.match(/\[\s*INNER[-_ ]?VOICE\s*\]/i) && !fullContent.match(/\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]/i)) {
                    const startMatch = fullContent.match(/\[\s*INNER[-_ ]?VOICE\s*\]/i);
                    if (startMatch) {
                        const startIndex = startMatch.index + startMatch[0].length;
                        const jsonStart = fullContent.indexOf('{', startIndex);

                        if (jsonStart !== -1) {
                            let balance = 0;
                            let inString = false;
                            let isEscaped = false;
                            let endPos = -1;

                            for (let i = jsonStart; i < fullContent.length; i++) {
                                const char = fullContent[i];
                                if (isEscaped) { isEscaped = false; continue; }
                                if (char === '\\') { isEscaped = true; continue; }
                                if (char === '"') { inString = !inString; continue; }
                                if (!inString) {
                                    if (char === '{') balance++;
                                    else if (char === '}') {
                                        balance--;
                                        if (balance === 0) {
                                            endPos = i + 1; // Position after the closing brace
                                            break;
                                        }
                                    }
                                }
                            }

                            if (endPos !== -1) {
                                // Auto-insert closing tag
                                fullContent = fullContent.slice(0, endPos) + '\n[/INNER_VOICE]\n' + fullContent.slice(endPos);
                                console.log('[ChatStore] Auto-closed missing [/INNER_VOICE] tag based on JSON balance');
                            }
                        }
                    }
                }

                // Log AI reply content for debugging
                useLoggerStore().info(`接收AI回复: ${chat.name}`, {
                    contentLength: fullContent.length,
                    content: fullContent,
                    hasInnerVoice: !!result.innerVoice,
                    usage: result.usage
                })

                // --- Save Token Stats ---
                if (result.usage) {
                    chat.tokenStats = {
                        total: result.usage.total_tokens || 0,
                        system: 0, // Not detailed in standard usage
                        persona: 0,
                        worldBook: 0,
                        memory: 0,
                        history: result.usage.input_tokens || 0,
                        summaryLib: 0,
                        totalContext: result.usage.input_tokens || 0
                    }
                    saveChats()
                }

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
                // FIX: Use Strictly Bounded Regex (Case Insensitive + Space Aware)
                // Stop at closing tag, OR start of another command, OR end of file.
                // NOTE: We do NOT use Lookahead for Newline+Bracket as strict delimiter here, to allow AI to continue comfortably.
                // The explicit closing tag is preferred, but we must stop if we see another major system tag.
                const innerVoiceRegex = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\n\s*\[(?:CARD|ONLINE|OFFLINE|IMAGE|VIDEO|AUDIO|FILE|MOMENT|红包|转账|表情包|图片))|$)/gi;

                // Extract ALL inner voice blocks for canonical storage
                const allVoiceMatches = [...fullContent.matchAll(innerVoiceRegex)];
                let innerVoiceBlock = allVoiceMatches.length > 0 ? allVoiceMatches[0][0] : '';

                // Pure Dialogue extraction
                let pureDialogue = fullContent.replace(innerVoiceRegex, '').trim();

                // Failsafe: If regex failed but AI Service successfully parsed Inner Voice, OR if we can find a JSON block manually
                if (!innerVoiceBlock) {
                    if (result.innerVoice) {
                        // Case A: AI Service already parsed it (reliable)
                        try {
                            console.log('[ChatStore] Regex failed check, reconstructing Inner Voice from parsed result');
                            const jsonContent = JSON.stringify(result.innerVoice, null, 2);
                            innerVoiceBlock = `\n[INNER_VOICE]\n${jsonContent}\n[/INNER_VOICE]`;

                            // If it's not caught by the regex, it's likely untagged JSON in the text
                            // We need to find and remove it from pureDialogue
                            if (pureDialogue.includes('{') && (
                                pureDialogue.includes('"status"') || pureDialogue.includes('"心声"') ||
                                pureDialogue.includes('"VOICE"') || pureDialogue.includes('"mind"') ||
                                pureDialogue.includes('"stats"') || pureDialogue.includes('"heartRate"')
                            )) {
                                const blocks = [...pureDialogue.matchAll(/\{[\s\S]*?\}/g)]
                                for (let i = blocks.length - 1; i >= 0; i--) {
                                    const block = blocks[i][0]
                                    if (block.includes('"status"') || block.includes('"心声"') || block.includes('"着装"') || 
                                        block.includes('"VOICE"') || block.includes('"mind"') || block.includes('"heartRate"')) {
                                        pureDialogue = pureDialogue.replace(block, '').trim()
                                        break
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('[ChatStore] Failed to reconstruct Inner Voice', e);
                        }
                    } else if (fullContent.includes('{') && (fullContent.includes('"status"') || fullContent.includes('"心声"'))) {
                        // Case B: AI Service didn't catch it, and it's not in result, but looks like JSON is there.
                        try {
                            const braceStarts = [];
                            for (let i = 0; i < fullContent.length; i++) {
                                if (fullContent[i] === '{') braceStarts.push(i);
                            }

                            for (let i = braceStarts.length - 1; i >= 0; i--) {
                                const startIdx = braceStarts[i];
                                // Use balanced matcher
                                let balance = 0, inStr = false, isEsc = false, endPos = -1;
                                for (let j = startIdx; j < fullContent.length; j++) {
                                    const char = fullContent[j];
                                    if (isEsc) { isEsc = false; continue; }
                                    if (char === '\\') { isEsc = true; continue; }
                                    if (char === '"') { inStr = !inStr; continue; }
                                    if (!inStr) {
                                        if (char === '{') balance++;
                                        else if (char === '}') {
                                            balance--;
                                            if (balance === 0) { endPos = j; break; }
                                        }
                                    }
                                }

                                if (endPos !== -1) {
                                    const candidate = fullContent.substring(startIdx, endPos + 1);
                                    // Enhanced check: Look for inner voice markers at ANY nesting level
                                    // Supports: {"status":...}, {"VOICE":{"status":...}}, {"inner_voice":{...}}, etc.
                                    const hasVoiceMarker = (
                                        candidate.includes('"status"') || candidate.includes('"心声"') ||
                                        candidate.includes('"着装"') || candidate.includes('"环境"') ||
                                        candidate.includes('"行为"') || candidate.includes('"渴望"') ||
                                        candidate.includes('"结论"') || candidate.includes('"心情"') ||
                                        candidate.includes('"mind"') || candidate.includes('"mood"') ||
                                        candidate.includes('"stats"') || candidate.includes('"heartRate"') ||
                                        candidate.includes('"VOICE"') || candidate.includes('"voice"') ||
                                        candidate.includes('"INNER_VOICE"') || candidate.includes('"inner_voice"') ||
                                        candidate.includes('"speech"') || candidate.includes('"thought"')
                                    );
                                    if (hasVoiceMarker) {
                                        console.log('[ChatStore] Found raw JSON block in balanced fallback, treating as Inner Voice');
                                        innerVoiceBlock = `\n[INNER_VOICE]\n${candidate}\n[/INNER_VOICE]`;
                                        pureDialogue = pureDialogue.replace(candidate, '').trim();

                                        // Special Cleanup: If the JSON was the sole content of an [OFFLINE] or [ONLINE] block, remove the empty tags
                                        // e.g. [OFFLINE]\n{...}\n[/OFFLINE] -> avoid leaving [OFFLINE][/OFFLINE]
                                        pureDialogue = pureDialogue.replace(/\[(OFFLINE|ONLINE)\]\s*\[\/(OFFLINE|ONLINE)\]/gi, '').trim();

                                        // Parse it to update status immediately
                                        try {
                                            let ivObj = JSON.parse(candidate);
                                            // Handle nested VOICE wrapper: {"VOICE": {...}}
                                            if (ivObj.VOICE) ivObj = ivObj.VOICE;
                                            if (ivObj.inner_voice) ivObj = ivObj.inner_voice;
                                            
                                            const newStatus = ivObj.status || ivObj.状态 || 
                                                (typeof ivObj["心声"] === 'string' ? ivObj["心声"] : null);
                                            if (newStatus && chat) {
                                                chat.statusText = String(newStatus).substring(0, 30);
                                                chat.isOnline = true;
                                            }
                                            charInfo.mindscape = ivObj;
                                            useLoggerStore().debug('Successfully updated Mindscape from balanced fallback', ivObj);
                                        } catch (parseErr) {
                                            console.warn('[ChatStore] Fallback balanced JSON parse failed', candidate.substring(0, 50));
                                        }
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('[ChatStore] Failed to extract balanced JSON fallback', e);
                        }
                    }
                }

                // Reconstruct the full content with proper order: dialogue first, then inner voice
                const properlyOrderedContent = pureDialogue + (innerVoiceBlock ? '\n' + innerVoiceBlock : '');

                console.log(`[AI Reply] Dialogue length: ${pureDialogue.length}, InnerVoice: ${!!innerVoiceBlock}, Raw: ${fullContent.substring(0, 50)}...`);

                // --- Handle <bgm> Tag ---
                const bgmRegex = /<bgm>([\s\S]*?)<\/bgm>/i;
                const bgmMatch = properlyOrderedContent.match(bgmRegex);
                if (bgmMatch) {
                    const tagContent = bgmMatch[1].trim();
                    const musicStore = useMusicStore();
                    // Trigger asynchronous music search and playback
                    musicStore.playFromBgmTag(tagContent);
                    console.log('[ChatStore] BGM Tag detected:', tagContent);
                }

                // --- Handle [SET_PAT] Command ---
                const patRegex = /\[SET_PAT:(.+?)(?::(.+?))?\]/i
                const patMatch = properlyOrderedContent.match(patRegex)
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
                // Remove ^ to allow REPLY tag to be anywhere (e.g. after Inner Voice)
                const replyRegex = /\[REPLY:\s*(.*?)\]/i;
                const replyMatch = properlyOrderedContent.match(replyRegex);
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
                            content: quotedMsg.content,
                            timestamp: quotedMsg.timestamp
                        };
                    }
                }

                // --- Handle [NUDGE] Command (Updated) ---
                const nudgeRegex = /\[(NUDGE(?:_SELF)?)(?::(.+?))?\]/i;
                const nudgeMatch = properlyOrderedContent.match(nudgeRegex);
                if (nudgeMatch) {
                    const command = nudgeMatch[1].toUpperCase();
                    const modifier = nudgeMatch[2] ? nudgeMatch[2].trim() : '';

                    const action = chat.patAction || '拍了拍';
                    let target = 'user';
                    let suffix = chat.patSuffix || '的头'; // Default suffix fixes "user undefined" issue

                    if (command === 'NUDGE_SELF' || modifier === 'self' || modifier === '自己' || modifier === 'me') {
                        suffix = '自己' + (chat.patSuffix || '的脸'); // Contextual suffix
                        target = 'ai';
                        // System message: "AI 拍了拍 自己XXX"
                        // To make it look like "AI patted themselves", we need special handling in stored msg?
                        // "ChatName 拍了拍 自己..."
                    } else if (modifier && modifier !== 'user' && modifier !== '我') {
                        // NUDGE:CharacterName
                        suffix = modifier; // "CharacterName"
                        // System message: "ChatName 拍了拍 CharacterName"
                    } else {
                        // Nudge User
                        suffix = '我' + (chat.patSuffix ? '' : '的头'); // "我" here means User from AI perspective?
                        // Wait, logic at line 471 in ChatWindow says:
                        // targetName = msg.role === 'user' ? '我' : '对方'
                        // Here we are creating a SYSTEM message.
                        // content: "ChatName action suffix"
                        // If suffix is "我", content = "ChatName 拍了拍 我" -> "ChatName patted Me (User)"
                    }

                    addMessage(chatId, {
                        type: 'system',
                        role: 'system',
                        content: `"${chat.name || '对方'}" ${action} ${suffix}`,
                        isRecallTip: true
                    });
                    triggerPatEffect(chatId, target);
                }

                // --- Handle [RECALL] / [撤回] Command ---
                const recallRegex = /\[(?:RECALL|撤回)(?::(.+?))?\]/i
                const recallMatch = properlyOrderedContent.match(recallRegex)
                if (recallMatch) {
                    const keyword = recallMatch[1] ? recallMatch[1].trim() : null
                    const msgs = chat.msgs || []
                    let targetIdx = -1

                    if (keyword) {
                        // Find last message from AI containing keyword
                        for (let i = msgs.length - 1; i >= 0; i--) {
                            if (msgs[i].role === 'ai' && !msgs[i].isRecallTip && ensureString(msgs[i].content).includes(keyword)) {
                                targetIdx = i; break;
                            }
                        }
                    }
                    // Fallback to "last one" removed as per user request ("太智障了")

                    if (targetIdx !== -1) {
                        const originalMsg = msgs[targetIdx];
                        // Using Object.assign to avoid spread operator ambiguity in some IDEs
                        const recallMsg = Object.assign({}, originalMsg, {
                            type: 'system',
                            content: `${chat.name || '对方'}撤回了一条消息`,
                            isRecallTip: true,
                            realContent: originalMsg.content || ''
                        });
                        msgs.splice(targetIdx, 1, recallMsg);
                        saveChats();
                        useLoggerStore().addLog('AI', '指令执行: 撤回消息', { keyword, index: targetIdx });
                    }
                }


                // --- Handle [MOMENT] Command (Enhanced with Chinese Tag Support) ---
                // const momentsStore = useMomentsStore() // Already declared at top of function

                // REGEX FIX: Stop before next command tag, NOT just any '[' (which breaks JSON arrays)
                const momentRegex = /\[(?:MOMENT|朋友圈)\]([\s\S]*?)(?:\[\/(?:MOMENT|朋友圈)\]|(?=\[\s*(?:INNER_VOICE|DRAW|CARD|SET_AVATAR|SET_PAT|NUDGE|REPLY|红包|转账|图片|表情包))|$)/i;
                const momentMatch = properlyOrderedContent.match(momentRegex);
                if (momentMatch) {
                    try {
                        let jsonStr = momentMatch[1].trim()
                        jsonStr = jsonStr.replace(/\\"/g, '"');
                        if (jsonStr.startsWith('{') && !jsonStr.endsWith('}')) jsonStr += '}'

                        let momentData = JSON.parse(jsonStr)

                        const content = momentData.content || momentData.内容
                        const interactions = momentData.interactions || momentData.互动 || []
                        const imagePrompt = momentData.imagePrompt || momentData.配图 || momentData.图片

                        if (momentData && (content || momentData.html)) {
                            const newMoment = {
                                authorId: chatId,
                                content: content,
                                html: momentData.html,
                                images: [],
                                imageDescriptions: [],
                                interactions: interactions.map(i => ({
                                    type: i.type || (i.类型 === '点赞' ? 'like' : (i.类型 === '评论' ? 'comment' : (i.类型 === '回复' ? 'reply' : i.类型))),
                                    author: i.author || i.作者 || i.名字,
                                    text: i.text || i.内容 || i.文本 || i.content,
                                    replyTo: i.replyTo || i.回复对象 || i.回复
                                }))
                            }

                            if (imagePrompt) {
                                if (typeof imagePrompt === 'string' && (imagePrompt.startsWith('http') || imagePrompt.startsWith('data:'))) {
                                    newMoment.images.push(imagePrompt)
                                } else {
                                    const imageUrl = await generateImage(String(imagePrompt))
                                    newMoment.images.push(imageUrl)
                                }
                            }

                            const momentResult = momentsStore.addMoment(newMoment);

                            addMessage(chatId, {
                                type: 'system',
                                content: `"${chat.name}" 发布了一条朋友圈`,
                                _momentReferenceId: momentResult.id
                            });
                        }
                    } catch (e) {
                        console.error('[ChatStore] Failed to parse [MOMENT]', e)
                    }
                }

                // --- Handle [MOMENT_SHARE] / [分享朋友圈] Command ---
                // AI uses this format to share moments inline within conversation
                const momentShareRegex = /\[(?:MOMENT_SHARE|分享朋友圈):\s*([\s\S]+?)\](?=\s*(?:\[[A-Z_]|【|\[INNER_VOICE|\[\/\w|$))/i;
                const momentShareMatch = properlyOrderedContent.match(momentShareRegex);
                if (momentShareMatch) {
                    try {
                        let shareJsonStr = momentShareMatch[1].trim();
                        shareJsonStr = shareJsonStr.replace(/\\"/g, '"');
                        if (shareJsonStr.startsWith('{') && !shareJsonStr.endsWith('}')) shareJsonStr += '}';

                        const shareMomentData = JSON.parse(shareJsonStr);

                        const shareContent = shareMomentData.content || shareMomentData.内容 || '';
                        const shareImagePrompt = shareMomentData.imagePrompt || shareMomentData.配图 || '';
                        const shareLocation = shareMomentData.location || '';

                        if (shareContent || shareMomentData.html) {
                            const newShareMoment = {
                                id: shareMomentData.id || crypto.randomUUID(),
                                authorId: chatId,
                                content: shareContent,
                                text: shareContent,
                                author: chat.name,
                                avatar: chat.avatar,
                                location: shareLocation,
                                visibility: shareMomentData.visibility || 'public',
                                images: [],
                                imageDescriptions: [],
                                html: shareMomentData.html
                            };

                            if (shareImagePrompt) {
                                if (typeof shareImagePrompt === 'string' && (shareImagePrompt.startsWith('http') || shareImagePrompt.startsWith('data:'))) {
                                    newShareMoment.images.push(shareImagePrompt);
                                } else {
                                    const shareImageUrl = await generateImage(String(shareImagePrompt));
                                    newShareMoment.images.push(shareImageUrl);
                                }
                            }

                            const shareMomentResult = momentsStore.addMoment(newShareMoment);
                            console.log('[ChatStore] MOMENT_SHARE published to moments feed:', shareMomentResult.id);

                            // Mark this message as a moment_card so UI renders it properly
                            properlyOrderedContent = properlyOrderedContent.replace(momentShareRegex, '');
                            
                            // Track that we have a pending moment_card to attach to the message
                            _pendingMomentCardData = { ...newShareMoment, _momentReferenceId: shareMomentResult.id };
                        }
                    } catch (e) {
                        console.error('[ChatStore] Failed to parse [MOMENT_SHARE]', e);
                    }
                }

                // --- Handle Active Interactions [LIKE], [COMMENT], [REPLY] ---
                const likeRegex = /\[LIKE[:：]\s*([^\]\s]+)\]/gi;
                let likeMatch;
                while ((likeMatch = likeRegex.exec(properlyOrderedContent)) !== null) {
                    let targetId = likeMatch[1].trim();
                    // Fallback Logic: Try to find actual moment if ID is hallucinated
                    if (!momentsStore.moments.some(m => m.id === targetId)) {
                        const ref = [...chat.msgs].reverse().find(m => m._momentReferenceId);
                        if (ref) targetId = ref._momentReferenceId;
                    }
                    momentsStore.addLike(targetId, chatId, chat.name);
                }

                const commentRegex = /\[COMMENT[:：]\s*([^\]\s:]+)[:：]\s*([\s\S]+?)\]/gi;
                let commentMatch;
                while ((commentMatch = commentRegex.exec(properlyOrderedContent)) !== null) {
                    let targetId = commentMatch[1].trim();
                    if (!momentsStore.moments.some(m => m.id === targetId)) {
                        const ref = [...chat.msgs].reverse().find(m => m._momentReferenceId);
                        if (ref) targetId = ref._momentReferenceId;
                    }
                    momentsStore.addComment(targetId, {
                        authorId: chatId,
                        authorName: chat.name,
                        content: commentMatch[2].trim()
                    });
                }

                const momentActionReplyRegex = /\[REPLY[:：]\s*([^\]\s:]+)[:：]\s*([^\]\s:]+)[:：]\s*([\s\S]+?)\]/gi;
                let momentActionReplyMatch;
                while ((momentActionReplyMatch = momentActionReplyRegex.exec(properlyOrderedContent)) !== null) {
                    let momentId = momentActionReplyMatch[1].trim();
                    const commentId = momentActionReplyMatch[2].trim();
                    const content = momentActionReplyMatch[3].trim();

                    if (!momentsStore.moments.some(m => m.id === momentId)) {
                        const ref = [...chat.msgs].reverse().find(m => m._momentReferenceId);
                        if (ref) momentId = ref._momentReferenceId;
                    }

                    const moment = momentsStore.moments.find(m => m.id === momentId);
                    const targetComment = moment?.comments.find(c => c.id === commentId);

                    momentsStore.addComment(momentId, {
                        authorId: chatId,
                        authorName: chat.name,
                        content,
                        replyTo: targetComment ? targetComment.authorName : null
                    });
                }

                // --- Handle [FAMILY_CARD] Command ---
                // Extract FAMILY_CARD tags and store them for separate delivery
                // FIX: Use [\s\S] for multiline match
                const familyCardRegex = /\[FAMILY_CARD(?:_APPLY)?:[\s\S]*?\]/gi;
                const familyCardMatches = [];
                let familyCardMatch;
                while ((familyCardMatch = familyCardRegex.exec(properlyOrderedContent)) !== null) {
                    familyCardMatches.push(familyCardMatch[0]);
                }

                // --- Handle [SET_AVATAR] Command ---
                const setAvatarRegex = /\[SET_AVATAR[:：]\s*(.+?)\s*\]/gi  // Use GLOBAL flag to handle multiple occurrences
                let avatarMatch;
                // Loop to find the last valid avatar command (or first? let's stick to first for now but consume all)
                // Actually, let's just use the first valid one we find
                const firstAvatarMatch = setAvatarRegex.exec(properlyOrderedContent);

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
                // Use robust regex for cleanup to prevent catastrophic backtracking/swallowing
                const cleanVoiceRegex = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|红包|转账|表情包|图片|SET_|NUDGE))|$)/gi;
                let cleanContent = properlyOrderedContent
                    // .replace(cleanVoiceRegex, '') // KEEP INNER_VOICE for History/Card to read!
                    .replace(patRegex, '')
                    .replace(nudgeRegex, '')
                    .replace(momentRegex, '')
                    .replace(replyRegex, '')
                    .replace(setAvatarRegex, '')
                    .replace(familyCardRegex, '') // Remove FAMILY_CARD tags
                    .replace(/\[LIKE[:：].*?\]/gi, '') // SCRUB INTERACTIONS FROM BUBBLES
                    .replace(/\[COMMENT[:：].*?\]/gi, '')
                    .replace(/\[REPLY[:：].*?\]/gi, '')
                    .replace(/\[MUSIC:\s*.*?\]/gi, '') // Remove MUSIC command tags
                    .trim();
                
                // --- Pass 0: Robust LS_JSON Extraction (Balanced Braces) ---
                // We do this first to nuke them completely before they get split
                const lsMarkerRegex = /\[\s*LS_JSON[:：]?\s*/gi;
                let lsMatch;
                while ((lsMatch = lsMarkerRegex.exec(properlyOrderedContent)) !== null) {
                    const startIdx = lsMatch.index;
                    const jsonStart = properlyOrderedContent.indexOf('{', startIdx + lsMatch[0].length);
                    if (jsonStart !== -1) {
                        let braceCount = 0, inString = false, isEscaped = false, jsonEndIdx = -1;
                        for (let i = jsonStart; i < properlyOrderedContent.length; i++) {
                            const char = properlyOrderedContent[i];
                            if (isEscaped) { isEscaped = false; continue; }
                            if (char === '\\') { isEscaped = true; continue; }
                            if (char === '"') { inString = !inString; continue; }
                            if (!inString) {
                                if (char === '{') braceCount++;
                                else if (char === '}') { braceCount--; if (braceCount === 0) { jsonEndIdx = i; break; } }
                            }
                        }
                        if (jsonEndIdx !== -1) {
                            let blockEnd = jsonEndIdx + 1;
                            const remaining = properlyOrderedContent.substring(jsonEndIdx + 1, jsonEndIdx + 5);
                            const closeMatch = remaining.match(/^\s*[\]】]/);
                            if (closeMatch) blockEnd = jsonEndIdx + 1 + closeMatch[0].length;
                            // Nuke this whole block from cleanContent
                            const blockText = properlyOrderedContent.substring(startIdx, blockEnd);
                            cleanContent = cleanContent.replace(blockText, '').trim();
                        }
                    }
                }

                // Final sanitization: remove common leaked structured content or CSS leaking
                if (cleanContent.includes('author:') && cleanContent.includes('content:')) {
                    // If AI leaked parsed JSON summary into text (Step 1 observation), discard it
                    if (cleanContent.length < 500 && cleanContent.split('\n').every(line => line.includes(':') || line.trim() === '')) {
                        console.log('[ChatStore] AI leaked summary detected, stripping heavy structural debris...');
                        cleanContent = '';
                    }
                }
                // Strip CSS-like debris (Step 2 observation)
                cleanContent = cleanContent.replace(/transform:\s*translateX\(.*?\);/gi, '');

                // Clean AI Hallucinations & Residual Tags & TOXIC CSS
                cleanContent = cleanContent
                    .replace(/\[Image Reference ID:.*?\]/gi, '')
                    .replace(/Here is the original image:/gi, '')
                    .replace(/\(我发送了一张图片\)/gi, '')
                    .replace(/\[\/?(MOMENT|REPLY|SET_AVATAR|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT|INNER[-_ ]?VOICE|CARD|LS_JSON|JSON)\]/gi, '')
                    // Strip system context hints parrotted by AI
                    .replace(/[\[\(]?(系统|System)[:：\s]*(图片|语音|IMAGE|VOICE|心声|INNER[-_ ]?VOICE)消息[\]\)]?/gi, '')
                    .replace(/\[(?:图片消息|语音消息|心声数据)\]/gi, '')
                    .trim();

                // --- Pre-process: Extract and Protect CARD blocks (Enhanced V2) ---
                const cardBlocks = [];

                // Pass 1: Handle Markdown HTML code blocks & JSON code blocks (Stupid AI protection)
                cleanContent = cleanContent.replace(/```(?:html|xml|json)?\s*([\s\S]*?)```/gi, (match, code) => {
                    const trimmed = code.trim();
                    if (trimmed.includes('<') && trimmed.includes('>')) {
                        const json = JSON.stringify({ type: 'html', html: trimmed });
                        return `\n[CARD]${json}\n`;
                    } else if (trimmed.startsWith('{') && (trimmed.includes('"type"') || trimmed.includes('"html"'))) {
                        return `\n[CARD]${trimmed}\n`;
                    }
                    return match;
                });

                // Pass 1.5: Catch emoji-prefixed metadata (e.g., "😡 心情：", "🥺 渴望：")
                // We do this before HTML extraction so it doesn't get tangled
                cleanContent = cleanContent.replace(/^[ \t]*[\u2700-\u27bf\u1f300-\u1faff\ud83c\ud83d\ud83e][ \t]*(?:心情|渴望|结论|心声|着装|环境|行为|stats|mind|mood|status)\s*[:：].*?(?:\n|$)/gm, '');

                // Pass 2: Extraction using robust brace matcher (The Protectors)
                // Aggressively match anything starting with [CARD]{, [INNER_VOICE]{, { "type":, or type: html {
                const cardStartRegex = /(?:\[\s*(?:CARD|LS_JSON|JSON|INNER[-_ ]?VOICE)\s*\]\s*\{)|(?:\{\s*\\?["'][^"']+\\?["']\s*[:：]\s*)|(?:type\s*[:：]\s*html[\s\S]*?\{)/gi;
                let cardMatch;
                const cardPositions = [];

                while ((cardMatch = cardStartRegex.exec(cleanContent)) !== null) {
                    let startPos = cardMatch.index;
                    let jsonStart = cardMatch.index + cardMatch[0].indexOf('{');
                    let isNaked = !cardMatch[0].trim().toUpperCase().startsWith('[');

                    let braceCount = 1;
                    let endPos = jsonStart + 1;
                    let inString = false;
                    let isEscaped = false;

                    while (endPos < cleanContent.length && braceCount > 0) {
                        const char = cleanContent[endPos];
                        if (isEscaped) { isEscaped = false; }
                        else if (char === '\\') { isEscaped = true; }
                        else if (char === '"') { inString = !inString; }
                        else if (!inString) {
                            if (char === '{') braceCount++;
                            else if (char === '}') braceCount--;
                        }
                        endPos++;
                    }

                    if (braceCount === 0) {
                        let totalEnd = endPos;
                        const remaining = cleanContent.substring(endPos);
                        
                        // Consume trailing whitespace and optional CLOSING bracket if we started with an OPENING bracket [
                        if (cardMatch[0].trim().startsWith('[')) {
                            const trailingBracketMatch = remaining.match(/^\s*\]/);
                            if (trailingBracketMatch) totalEnd += trailingBracketMatch[0].length;
                        }

                        const afterBracket = cleanContent.substring(totalEnd);
                        const closingTagMatch = afterBracket.match(/^\s*\[\/(?:CARD|INNER[-_ ]?VOICE)\]/i);
                        if (closingTagMatch) totalEnd += closingTagMatch[0].length;

                        const fullCard = cleanContent.substring(startPos, totalEnd);
                        cardPositions.push({ start: startPos, end: totalEnd, content: fullCard, isNaked });
                        cardStartRegex.lastIndex = totalEnd;
                    }
                }

                // Apply Placeholders (Reversed order to maintain indices)
                let processedContent = cleanContent;
                for (let i = cardPositions.length - 1; i >= 0; i--) {
                    const pos = cardPositions[i];
                    const contentToStore = pos.isNaked ? ('[CARD]' + pos.content) : pos.content;
                    cardBlocks.push(contentToStore);
                    processedContent = processedContent.substring(0, pos.start) + ` __CARD_PLACEHOLDER_${cardBlocks.length - 1}__ ` + processedContent.substring(pos.end);
                }

                // Pass 3: Handle naked <html>...</html> or large <div> blocks anywhere in the message
                // ENHANCED: Match optional metadata labels and capture everything until the end of the tag.
                // This version is greedy and handles leading emojis/text often found in AI-generated "status cards".
                // Notice this now runs on processedContent so it doesn't corrupt extracted JSON blocks!
                // CRITICAL FIX: HTML match must NOT cross [OFFLINE]/[ONLINE]/[/OFFLINE]/[/ONLINE] mode control tags
                // Use a custom replacer that validates the match doesn't span across mode boundaries
                processedContent = processedContent.replace(/(?:\s*(?:type|card|json)\s*[:：]\s*html\s*,?\s*(?:html|content)\s*[:：]\s*[^<]*)?(<(html|div|section|article|style|svg)[^]*?<\/\2>(?:\s*<\/\2>)*)/gi, (match, htmlContent) => {
                    // GUARD: If match contains a mode boundary tag, skip it to preserve [OFFLINE]/[ONLINE] integrity
                    if (/\[\s*\/?\s*(?:OFFLINE|ONLINE)\s*\]/i.test(match)) {
                        return match;
                    }
                    const html = htmlContent.trim();
                    if (html.length > 20 || html.includes('style=')) {
                        const fullMatch = match.trim();
                        const json = JSON.stringify({ type: 'html', html: fullMatch.includes('html:') ? fullMatch.substring(fullMatch.indexOf('<')) : html });
                        cardBlocks.push(`\n[CARD]${json}\n`);
                        return ` __CARD_PLACEHOLDER_${cardBlocks.length - 1}__ `;
                    }
                    return match;
                });

                // Pass 3.5: Aggressive Metadata Strip (Including Multiline & Tag Prepends)
                const allMetadataKeywords = 'type|card|json|html|content|mood|heartRate|stats|mind|心声|着装|环境|行为|渴望|结论|心情|status|speech|thought|thinking';
                const metaLinePattern = new RegExp(`(?:^|\\n)\\s*(?:${allMetadataKeywords})\\s*[:：][^\\n\\[\\<{]*`, 'gim');
                processedContent = processedContent.replace(metaLinePattern, '').trim();
                
                // Pass 3.6: Merge logic for tags prepended with metadata (Stubborn AI fix)
                const tagPrependPattern = new RegExp(`(?:^|\\n)\\s*(?:${allMetadataKeywords})\\s*[:：][^\\]]*\\n?(\\[[^\\]]+\\])`, 'gim');
                processedContent = processedContent.replace(tagPrependPattern, '$1').trim();

                // Pass 3.7: Final stubborn cleanup for dangling card keys
                processedContent = processedContent.replace(/^\s*(?:type|card|json|html|content)\s*[:：]\s*(?:html|card|{)?\s*$/gim, '');


                // Pass 4: Clean up image tags & Hallucination Cleanup
                processedContent = processedContent.replace(/\[图片:(.+?)\]/gi, (match, url) => {
                    const trimmedUrl = url.trim();
                    if (!(trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:') || trimmedUrl === '/broken-image.png')) {
                        return '[图片:/broken-image.png]';
                    }
                    return match;
                });

                processedContent = processedContent.replace(/<button[\s\S]*?qiaoqiao_receiveFamilyCard\('([^']*)',\s*([\d.]+),\s*'([^']*)'[\s\S]*?点击领取<\/button>/gi, (match, uuid, amount, note) => {
                    return `[FAMILY_CARD:${amount}:${note}]`;
                });

                // V16-V17: Split logic
                // DEFENSE: Wrap in try-catch to prevent Vite-minified TDZ errors ("Cannot access 'Xe'")
                let finalSegments = [];
                try {
                const splitRegex = new RegExp("(\\r?\\n|__CARD_PLACEHOLDER_\\d+__|\\[\\/\\?\\s*OFFLINE\\s*\\]|\\[\\/\\?\\s*ONLINE\\s*\\]|\\|\\|[\\s\\S]*?\\|\\||\\u2016[\\s\\S]*?\\u2016|\\u3010[^\\u3011]+\\u3011|\\[[^\\]]+\\]|\\([^\\)]+\\)|\\uff08[^\\uff09]+\\uff09)");
                const rawParts = processedContent.split(splitRegex);

                useLoggerStore().debug(`[Split] Parts count: ${rawParts.length}`);

                let rawSegments = [];
                let currentRawSegment = "";

                for (let i = 0; i < rawParts.length; i++) {
                    const part = rawParts[i];
                    if (part === undefined) continue;

                    const trimmedPart = part.trim();
                    // V17: Simplified isSpecial logic to be more inclusive of tags with parameters
                    // Match newlines, placeholders, theater blocks, or any bracketed command tag
                    const isNewline = /^\r?\n$/.test(part);
                    const isTag = /^\[[^\s\]]+(?::[^\]]*)?\]$/.test(trimmedPart);
                    const isTheater = /^(\|\||\u2016)[\s\S]*?(\|\||\u2016)$/.test(trimmedPart);
                    const isPlaceholder = /^__CARD_PLACEHOLDER_\d+__$/.test(trimmedPart);
                    
                    // Specific command check for tags that aren't generic [xxx]
                    const isCommandTag = isTag && /\[\/?\s*(?:OFFLINE|ONLINE|INNER|LS_JSON|DRAW|MUSIC|DICE|TAROT|红包|转账|REDPACKET|TRANSFER|表情包|表情-包|STICKER|图片|IMAGE|语音|VOICE|语音通话|视频通话|通话|CALL|绘画|生成图片|演奏|音乐|骰子|掷骰子|塔罗|塔罗牌|FAMILY_CARD|场景|SCENE|LIKE|点赞|喜欢|COMMENT|评论|REPLY|回复|位置|LOCATION|地图|MAP|SHARE|分享|转发|文件|FILE|LINK|链接|URL|SYSTEM|系统|通知|SET_AVATAR|SET_NAME|SET_PAT|设置头像|设置昵称|设置拍一拍|NUDGE|戳一戳|拍一拍|QUOTE|引用|GIFT|礼物|CARD|定时|TIMER|REMIND|提醒|搜索|查找|黄历|ALMANAC|运势)/i.test(trimmedPart);

                    if (isNewline || isPlaceholder || isCommandTag || isTheater || trimmedPart.startsWith('【') || trimmedPart.startsWith('(') || trimmedPart.startsWith('（')) {
                        if (currentRawSegment) { 
                            rawSegments.push(currentRawSegment); 
                            currentRawSegment = ""; 
                        }
                        if (!isNewline) rawSegments.push(part);
                        // If it's a newline, we just don't append it to currentRawSegment, 
                        // effectively making it a segment break.
                    } else {
                        currentRawSegment += part;
                    }
                }
                if (currentRawSegment) rawSegments.push(currentRawSegment);

                // --- Restoring Card Blocks and Filtering Content ---
                // (finalSegments declared above at line ~3349 before try block)
                let activeMode = null;
                let prevLength = finalSegments.length;
                for (const seg of rawSegments) {
                    let content = seg;
                    const trimmedContent = content.trim();
                    
                    // Robust tag detection within the segmenter
                    if (/^\[\s*ONLINE\s*\]$/i.test(trimmedContent)) { activeMode = 'online'; continue; }
                    if (/^\[\/\s*ONLINE\s*\]$/i.test(trimmedContent)) { activeMode = null; continue; }
                    if (/^\[\s*OFFLINE\s*\]$/i.test(trimmedContent)) { activeMode = 'offline'; continue; }
                    if (/^\[\/\s*OFFLINE\s*\]$/i.test(trimmedContent)) { activeMode = null; continue; }

                    // SAFETY NET: If a non-tag segment still contains mode control tags (edge case from HTML extraction),
                    // extract the mode from the tag and strip it from content.
                    // This handles cases where [OFFLINE] got stuck inside content due to HTML block extraction.
                    if (/\[\s*OFFLINE\s*\]/i.test(trimmedContent) && !/\[\s*ONLINE\s*\]/i.test(trimmedContent)) {
                        activeMode = 'offline';
                        content = content.replace(/\[\s*\/?OFFLINE\s*\]/gi, '').trim();
                        if (!content) { prevLength = finalSegments.length; continue; }
                    } else if (/\[\s*ONLINE\s*\]/i.test(trimmedContent) && !/\[\s*OFFLINE\s*\]/i.test(trimmedContent)) {
                        activeMode = 'online';
                        content = content.replace(/\[\s*\/?ONLINE\s*\]/gi, '').trim();
                        if (!content) { prevLength = finalSegments.length; continue; }
                    } else if (/\[\/\s*OFFLINE\s*\]/i.test(trimmedContent)) {
                        // [/OFFLINE] residue in content — strip it and reset mode after this segment
                        content = content.replace(/\[\/\s*OFFLINE\s*\]/gi, '').trim();
                        if (!content) { activeMode = null; prevLength = finalSegments.length; continue; }
                        // Push current content with offline mode, then reset
                        prevLength = finalSegments.length;
                        if (content) finalSegments.push({ type: 'text', content, mode: 'offline' });
                        activeMode = null;
                        continue;
                    } else if (/\[\/\s*ONLINE\s*\]/i.test(trimmedContent)) {
                        content = content.replace(/\[\/\s*ONLINE\s*\]/gi, '').trim();
                        if (!content) { activeMode = null; prevLength = finalSegments.length; continue; }
                        prevLength = finalSegments.length;
                        if (content) finalSegments.push({ type: 'text', content, mode: 'online' });
                        activeMode = null;
                        continue;
                    }

                    prevLength = finalSegments.length;
                    const placeholderMatch = content.match(/__CARD_PLACEHOLDER_(\d+)__/);

                    if (placeholderMatch) {
                        const index = parseInt(placeholderMatch[1]);
                        content = cardBlocks[index];
                        finalSegments.push({ type: 'card', content, mode: activeMode });
                    } else if (/^\[(?:表情包|表情-包|STICKER)[:：].*?\]$/.test(content.trim())) {
                        finalSegments.push({ type: 'sticker', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[语音通话]') || content.startsWith('[通话]') || content.startsWith('[CALL]')) {
                        finalSegments.push({ type: 'call', content: 'voice', mode: activeMode });
                    } else if (content.startsWith('[视频通话]')) {
                        finalSegments.push({ type: 'call', content: 'video', mode: activeMode });
                    } else if (content.startsWith('[语音') || content.startsWith('[VOICE')) {
                        let voiceContent = content.replace(/^\[(?:语音|VOICE)(消息)?[:：]?\s*/, '').replace(/\]$/, '');
                        finalSegments.push({ type: 'voice', content: voiceContent.trim(), mode: activeMode });
                    } else if (content.startsWith('[图片') || content.startsWith('[IMAGE')) {
                        finalSegments.push({ type: 'text', content: '[图片]', mode: activeMode });
                    } else if (content.startsWith('[DRAW:') || content.startsWith('[绘画:') || content.startsWith('[生成图片:')) {
                        finalSegments.push({ type: 'draw', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[演奏:') || content.startsWith('[MUSIC:') || content.startsWith('[音乐:')) {
                        finalSegments.push({ type: 'music', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[骰子:') || content.startsWith('[DICE:') || content.startsWith('[掷骰子:')) {
                        finalSegments.push({ type: 'dice', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[塔罗:') || content.startsWith('[塔罗牌:') || content.startsWith('[TAROT:')) {
                        finalSegments.push({ type: 'tarot', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[红包:') || content.startsWith('[转账:') || content.startsWith('[REDPACKET:') || content.startsWith('[TRANSFER:')) {
                        finalSegments.push({ type: 'payment', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[位置:') || content.startsWith('[LOCATION:') || content.startsWith('[地图:') || content.startsWith('[MAP:') || 
                            content.startsWith('【地点') || content.startsWith('【场景')) {
                        finalSegments.push({ type: 'location', content: content.trim(), mode: 'offline' });
                    } else if (content.startsWith('[文件:') || content.startsWith('[FILE:')) {
                        finalSegments.push({ type: 'file', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[链接:') || content.startsWith('[LINK:') || content.startsWith('[URL:')) {
                        finalSegments.push({ type: 'link', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[礼物:') || content.startsWith('[GIFT:')) {
                        finalSegments.push({ type: 'gift', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[戳一戳:') || content.startsWith('[拍一拍:') || content.startsWith('[NUDGE:')) {
                        finalSegments.push({ type: 'nudge', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[引用:') || content.startsWith('[QUOTE:')) {
                        finalSegments.push({ type: 'quote', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[点赞:') || content.startsWith('[喜欢:') || content.startsWith('[LIKE:')) {
                        finalSegments.push({ type: 'like', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[评论:') || content.startsWith('[COMMENT:')) {
                        finalSegments.push({ type: 'comment', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[回复:') || content.startsWith('[REPLY:')) {
                        finalSegments.push({ type: 'reply', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[分享:') || content.startsWith('[转发:') || content.startsWith('[SHARE:')) {
                        finalSegments.push({ type: 'share', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[系统:') || content.startsWith('[通知:') || content.startsWith('[SYSTEM:')) {
                        finalSegments.push({ type: 'system', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[设置头像:') || content.startsWith('[SET_AVATAR:')) {
                        finalSegments.push({ type: 'set_avatar', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[设置昵称:') || content.startsWith('[SET_NAME:')) {
                        finalSegments.push({ type: 'set_name', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[设置拍一拍:') || content.startsWith('[SET_PAT:')) {
                        finalSegments.push({ type: 'set_pat', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[定时:') || content.startsWith('[定时提醒:') || content.startsWith('[TIMER:') || content.startsWith('[REMIND:')) {
                        finalSegments.push({ type: 'timer', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[搜索:') || content.startsWith('[SEARCH:') || content.startsWith('[查找:')) {
                        finalSegments.push({ type: 'search', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[黄历:') || content.startsWith('[ALMANAC:') || content.startsWith('[运势:') || content.startsWith('[今日运势:]')) {
                        finalSegments.push({ type: 'almanac', content: content.trim(), mode: activeMode });
                    } else if (content.startsWith('[OFFLINE]')) {
                        finalSegments.push({ type: 'text', content: content.replace(/\[\s*OFFLINE\s*\]|\[\/\s*OFFLINE\s*\]/gi, '').trim(), mode: 'offline' });
                    } else if (content.startsWith('[ONLINE]')) {
                        finalSegments.push({ type: 'text', content: content.replace(/\[\s*ONLINE\s*\]|\[\/\s*ONLINE\s*\]/gi, '').trim(), mode: 'online' });
                    } else if (content.trim().startsWith('【') && content.trim().endsWith('】')) {
                        // Theater style location/scene marker - always offline
                        finalSegments.push({ type: 'location', content: content.trim(), mode: 'offline' });
                    } else {
                        // Standard Text
                        const toxicKeywords = ['border-radius', 'box-shadow', 'background-color', 'background-image', 'linear-gradient', 'isplay: flex', 'justify-content', 'align-items', 'min-width', 'max-width', 'min-height', 'z-index', 'overflow', 'position: relative', 'position: absolute', 'padding', 'margin', 'font-size', 'font-weight', 'text-align', 'line-height', 'left:', 'top:', 'right:', 'bottom:', 'width:', 'height:', 'filter:', 'blur(', 'opacity', 'border: 3px solid', 'border: 1px solid', 'font-family:', 'animation:', 'keyframes'];
                        const cssLineRegex = /^\s*[a-z-]+\s*:\s*[^:]{1,100}(?:;|px|em|rem|%|vw|vh)\s*$/i;

                        let filtered = content;
                        
                        // Apply toxic filter to all text segments regardless of braces
                        // (Only skip if the message explicitly has a [CARD] marker we added)
                        if (filtered.includes('{') || filtered.includes('<')) {
                            filtered = filtered.replace(/\{[\s\S]*?(padding:|margin:|border:|display:|width:|height:|font-size:|background-color:|position:|z-index:|overflow:|pointer-events:|opacity:)[\s\S]*?\}/gi, '');
                            filtered = filtered.replace(/<(?:html|div|section|article|style|svg|p|span|b|i|br|hr|h\d)[\s\S]*?>/gi, '');
                            filtered = filtered.replace(/<\/(?:html|div|section|article|style|svg|p|span|b|i|br|hr|h\d)>/gi, '');
                        }
                        filtered = filtered.split('\n').filter(line => {
                            const lower = line.trim().toLowerCase();
                            if (!lower) return false;
                            if (toxicKeywords.some(k => lower.includes(k))) return false;
                            if (cssLineRegex.test(line)) return false;
                            if (line.trim().startsWith('">') || line.trim().startsWith('/>')) return false;
                            return true;
                        }).join('\n').trim();

                        if (filtered) {
                        // Filtered out trash segments like residual brackets or punctuation
                            const isLeakedVoice = /^[\(（].*?[\)）]$/.test(filtered.trim()) && 
                                               (filtered.length < 50 || /尴尬|白团|思考|想着|犹豫|惊讶|开心|难过|宠溺|无奈|沉默|心跳/.test(filtered));
                            
                            // Aggressively catch card metadata remnants (e.g., "type: html, html:")
                            // MULTILINE SUPPORT: Catch keys even if they contain some values within the segment
                            // STRENGTHENED: Catch any segment that only contains brackets, braces, commas, dots or metadata keys
                            // NEW: Use multiline global test to catch internal metadata keys
                            const isTrashMetadata = /^\s*(?:type|card|json|html|content|mood|heartRate|stats|mind|心声|着装|环境|行为|渴望|结论|心情|status|speech|thought|thinking)\s*[:：]/i.test(filtered.trim());
                            const containsMetadata = /(?:type|card|html|json)\s*[:：]/i.test(filtered);
                            const isPunctuationOnly = /^[\[\]\{\}\(\)（）\s、,，.。:：\d\|\/\\_-]+$/.test(filtered.trim());

                            if (isPunctuationOnly || isTrashMetadata || (filtered.length < 30 && containsMetadata)) {
                                console.log('[ChatStore] Swallowed trash or metadata segment:', filtered);
                            } else if (!isLeakedVoice) {
                                finalSegments.push({ type: 'text', content: filtered });
                            } else {
                                console.log('[ChatStore] Swallowed leaked voice segment:', filtered);
                            }
                        }
                    }

                } // END for (const seg of rawSegments)

                    // Assign activeMode to any newly added segments
                    for (let j = prevLength; j < finalSegments.length; j++) {
                        if (!finalSegments[j].mode && activeMode) {
                            finalSegments[j].mode = activeMode;
                        }
                    }
                } catch (tdzError) {
                    // DEFENSE: Catch Vite-minified TDZ errors ("Cannot access 'Xe' before initialization")
                    console.error('[ChatStore] Split/Segment TDZ error, falling back to raw text:', tdzError.message);
                    useLoggerStore().addLog('ERROR', '分割处理TDZ错误', tdzError.message);
                    finalSegments = [{ type: 'text', content: processedContent.trim(), mode: null }];
                }

                // --- 4. Sequential Delivery ---
                for (let i = 0; i < finalSegments.length; i++) {
                    if (!typingStatus.value[chatId]) break;

                    const { type, content, mode: segmentMode } = finalSegments[i];
                    let msgAdded = null;
                    let msgContent = content;
                    const finalMode = segmentMode || options.mode || 'online';

                    if (type === 'card' || type === 'text') {
                        // Process Payment Tags
                        let pendingSystemMsgs = [];
                        let claimMatch;
                        while ((claimMatch = claimRegex.exec(msgContent)) !== null) {
                            const paymentId = claimMatch[2].trim();
                            const targetMsg = chat.msgs.find(m => m.paymentId === paymentId);
                            if (targetMsg && !targetMsg.isClaimed && !targetMsg.isRejected) {
                                targetMsg.isClaimed = true;
                                targetMsg.claimTime = Date.now();
                                targetMsg.claimedBy = { name: chat.name, avatar: chat.avatar };
                                pendingSystemMsgs.push(`${chat.name}领取了你的${claimMatch[1]}`);
                            }
                        }
                        // (Add similar logic for reject if needed)

                        msgContent = msgContent.replace(/\[领取(红包|转账):[^\]]+\]/g, '').replace(/\[(退回|拒收)(红包|转账):[^\]]+\]/g, '').trim();
                        if (!msgContent && pendingSystemMsgs.length === 0) continue;

                        if (type === 'card' || msgContent.match(/\[\s*CARD\s*\]/i) || msgContent.trim().startsWith('{')) {
                            // HTML Card Delivery
                            let processedHtml = msgContent.replace(/\[\s*\/?[CARD\s]*\]/gi, '').trim();
                            // Aggressively strip "type: html, html:" prefix regardless of outer braces
                            processedHtml = processedHtml.replace(/^(?:type|card|json)\s*[:：]\s*html\s*,?\s*(?:html|content)\s*[:：]\s*/i, '');
                            // Also catch dangling "html: " after the above replacement
                            processedHtml = processedHtml.replace(/^(?:html|content)\s*[:：]\s*/i, '');
                            if (processedHtml.includes('\\"')) processedHtml = processedHtml.replace(/\\"/g, '"');
                            if (!processedHtml.trim().startsWith('{') && (processedHtml.includes('"type":') || processedHtml.includes('"html":'))) processedHtml = '{' + processedHtml + '}';
                        
                            let extractedHtml = processedHtml;
                            try {
                                // Try to strip JSON structures if any
                                let jsonToParse = processedHtml;
                                if (!jsonToParse.startsWith('{') && jsonToParse.includes('{')) {
                                    jsonToParse = jsonToParse.substring(jsonToParse.indexOf('{'));
                                }
                                const parsed = JSON.parse(jsonToParse);
                                if (parsed.html) extractedHtml = parsed.html;
                            } catch (e) {
                                // If parsing fails, use the processed HTML directly
                                // It might be just raw HTML text
                                console.log('[ChatStore] HTML card is raw text, using as-is');
                            }
                        
                            // Ensure we always have valid HTML content
                            if (!extractedHtml || extractedHtml.trim().length === 0) {
                                extractedHtml = processedHtml;
                            }
                        
                            console.log('[ChatStore] Adding HTML card message');
                            // Use type: 'card' for maximum compatibility with template conditions
                            msgAdded = addMessage(chatId, { role: 'ai', type: 'card', content: processedHtml, html: extractedHtml, quote: i === 0 ? aiQuote : null, mode: finalMode });
                        } else {
                            // Text Message Delivery
                            // Check if we have a pending MOMENT_SHARE card to deliver
                            if (_pendingMomentCardData && (!msgContent.trim() || i === 0)) {
                                // Attach moment_card to this message (or create one if no content)
                                msgAdded = addMessage(chatId, {
                                    role: 'ai',
                                    type: 'moment_card',
                                    momentData: _pendingMomentCardData,
                                    content: JSON.stringify(_pendingMomentCardData),
                                    _momentReferenceId: _pendingMomentCardData._momentReferenceId,
                                    quote: i === 0 ? aiQuote : null,
                                    mode: finalMode
                                });
                                _pendingMomentCardData = null; // Consume it
                                continue; // Skip normal text delivery
                            }

                            const rpMatch = msgContent.match(/\[(红包|转账)\s*[:：]\s*([0-9.]+)\s*[:：]\s*(.*?)\]/);
                            let msgType = 'text', amount = null, note = null;
                            if (rpMatch) {
                                msgType = rpMatch[1] === '红包' ? 'redpacket' : 'transfer';
                                amount = parseFloat(rpMatch[2]) || 1.0;
                                note = rpMatch[3];
                            } else if (msgContent.includes('[FAMILY_CARD')) {
                                msgType = 'family_card';
                            } else if (msgContent.includes('[演奏') || msgContent.includes('[MUSIC')) {
                                const musicMatch = msgContent.match(/\[(演奏|MUSIC)\s*[:：]\s*(.*?)\s*(?:[:：]\s*(.*?))?\]/i);
                                if (musicMatch) {
                                    msgType = 'music';
                                    const inst = musicMatch[2].trim();
                                    const score = musicMatch[3] ? musicMatch[3].trim() : '';
                                    msgContent = score ? `${inst}: ${score}` : inst;
                                }
                            }

                            // V14: Attach inner-voice to the LAST segment if it's AI turn, 
                            // to avoid breaking the initial scene/location markers
                            if (i === finalSegments.length - 1 && innerVoiceBlock) {
                                msgContent += (msgContent ? '\n\n' : '') + innerVoiceBlock;
                            }

                            msgAdded = await addMessage(chatId, {
                                role: 'ai',
                                type: msgType,
                                content: msgContent,
                                amount,
                                note,
                                quote: i === 0 ? aiQuote : null,
                                hidden: isCallMode,
                                mode: finalMode
                            });
                        }

                        pendingSystemMsgs.forEach(txt => addMessage(chatId, { role: 'system', content: txt, mode: finalMode }));

                    } else if (type === 'sticker') {
                        // Ensure sticker content is just the name/filename if needed, or keeping full tag if components handle it
                        // The store usually expects just the name or url depending on implementation. 
                        // Based on ChatMessageItem, type 'sticker' usually expects content to be the sticker name or url.
                        // We stripped the brackets in the segmenting phase above.
                        msgAdded = addMessage(chatId, {
                            role: 'ai',
                            type: 'sticker',
                            content,
                            quote: i === 0 ? aiQuote : null,
                            hidden: isCallMode,
                            mode: finalMode
                        });
                    } else if (type === 'voice') {
                        msgAdded = addMessage(chatId, { role: 'ai', type: 'voice', content, duration: Math.ceil(content.length / 3) || 1, mode: finalMode });
                    } else if (type === 'draw') {
                        const drawMatch = content.match(/\[DRAW:\s*([\s\S]*?)\]/i);
                        if (drawMatch) {
                            // 1. Add a temporary "Generating" placeholder (System message or special type)
                            // OR add the image message immediately with a "loading" state if supported.
                            // For now, we will add a text message with the command HIDDEN (or temporary text) then replace it.

                            // User request: "绘画指令没隐藏". So we should NOT show the [DRAW:...] text.
                            // We create a placeholder message that says "正在绘图..."
                            msgAdded = await addMessage(chatId, {
                                role: 'ai',
                                type: 'text',
                                content: '🎨 正在根据灵感绘图...',
                                quote: i === 0 ? aiQuote : null,
                                mode: finalMode
                            });

                            // Safe ID retrieval - Now safe because we awaited addMessage
                            const targetMsgId = msgAdded?.id;

                            if (!targetMsgId) {
                                console.error('[ChatStore] Failed to get ID for placeholder message (addMessage failed?). Aborting image update.');
                            } else {
                                // ✅ 使用全局 AI 任务 Store 管理绘画请求（不受组件生命周期影响）
                                const aiTaskStore = useAITaskStore()
                                const drawTaskId = `draw_${chatId}_${targetMsgId}_${Date.now()}`
                                                            
                                // 创建全局绘画任务
                                aiTaskStore.createStreamingTask({
                                    taskId: drawTaskId,
                                    apiFunc: generateImage,
                                    args: [drawMatch[1].trim()],
                                    onComplete: (imageUrl) => {
                                        // 任务成功：更新消息为图片
                                        console.log('[Draw] Global task completed:', imageUrl);
                                        updateMessage(chatId, targetMsgId, {
                                            type: 'image',
                                            content: `[图片:${imageUrl}]`,
                                            image: imageUrl
                                        });
                                    },
                                    onError: (err) => {
                                        // 任务失败：显示错误信息
                                        console.error('[Draw] Global task failed:', err);
                                        updateMessage(chatId, targetMsgId, {
                                            type: 'text',
                                            content: `(绘画失败：${err.message})`
                                        });
                                    }
                                }).catch(err => {
                                    // 任务启动失败
                                    console.error('[Draw] Failed to create global task:', err);
                                    updateMessage(chatId, targetMsgId, {
                                        type: 'text',
                                        content: `(绘画失败：${err.message})`
                                    });
                                });
                            }
                        }
                    } else if (type === 'call') {
                        // AI主动发起通话
                        const callType = content === 'video' ? 'video' : 'voice';
                        callStore.receiveCall(chat, callType);
                    } else if (type === 'music') {
                        // 处理音乐/演奏指令
                        const musicMatch = content.match(/\[(?:演奏|MUSIC|音乐)[:：]\s*(.*?)\]/i);
                        if (musicMatch) {
                            const musicData = musicMatch[1].trim();
                            
                            // Check if it's a score (contains notes like C4, D4) or a song name
                            const isScore = /[A-G][0-9]/.test(musicData) || musicData.includes(',');
                            
                            if (isScore) {
                                // Instrumental Performance
                                addMessage(chatId, {
                                    role: 'ai',
                                    type: 'music',
                                    content: musicData,
                                    quote: i === 0 ? aiQuote : null,
                                    hidden: isCallMode,
                                    mode: finalMode
                                });
                            } else {
                                // Listen Together Sync
                                const musicStore = useMusicStore();
                                // Trigger music store to start "listening together" session
                                musicStore.startTogether({ 
                                    name: chat.name, 
                                    avatar: chat.avatar,
                                    id: chatId 
                                });
                                
                                // Auto-search and play the song
                                musicStore.searchMusic(musicData, '', 'all').then(results => {
                                    if (results && results.length > 0) {
                                        // Pick first result and play
                                        const firstSong = results[0];
                                        musicStore.addToPlaylist(firstSong);
                                        const newIdx = musicStore.playlist.length - 1;
                                        musicStore.loadSong(newIdx);
                                        musicStore.play();
                                    }
                                });

                                addMessage(chatId, {
                                    role: 'ai',
                                    type: 'music_share', // Using a distinct type for Listen Together
                                    content: musicData,
                                    quote: i === 0 ? aiQuote : null,
                                    hidden: isCallMode,
                                    mode: finalMode
                                });
                                
                                // Add a system notification about listening together
                                addMessage(chatId, {
                                    role: 'system',
                                    type: 'system',
                                    content: `${chat.name} 发起了一起听歌`
                                });
                            }
                        }
                    } else if (type === 'dice') {
                        // 处理骰子指令
                        addMessage(chatId, {
                            role: 'ai',
                            type: 'dice',
                            content: content,
                            quote: i === 0 ? aiQuote : null,
                            hidden: isCallMode,
                            mode: finalMode
                        });
                    } else if (type === 'tarot') {
                        // 处理塔罗牌指令
                        addMessage(chatId, {
                            role: 'ai',
                            type: 'tarot',
                            content: content,
                            quote: i === 0 ? aiQuote : null,
                            hidden: isCallMode,
                            mode: finalMode
                        });
                    } else if (type === 'location') {
                        // 处理位置指令
                        addMessage(chatId, {
                            role: 'ai',
                            type: 'location',
                            content: content,
                            quote: i === 0 ? aiQuote : null,
                            hidden: isCallMode,
                            mode: finalMode
                        });
                    } else if (type === 'nudge') {
                        // 处理戳一戳/拍一拍
                        triggerPatEffect(chatId, 'user');
                    } else if (type === 'gift') {
                        // 处理礼物
                        addMessage(chatId, {
                            role: 'ai',
                            type: 'gift',
                            content: content,
                            quote: i === 0 ? aiQuote : null,
                            hidden: isCallMode,
                            mode: finalMode
                        });
                    } else if (type === 'system') {
                        // 系统通知
                        addMessage(chatId, {
                            role: 'system',
                            content: content.replace(/^\[(?:系统|通知|SYSTEM)[:：]?\s*/, '').replace(/\]$/, ''),
                            hidden: isCallMode,
                            mode: finalMode
                        });
                    } else if (type === 'timer') {
                        // 处理定时提醒指令
                        const timerMatch = content.match(/\[(?:定时|定时提醒|TIMER|REMIND)[:：]\s*(.+?)\]/i);
                        if (timerMatch) {
                            const timerContent = timerMatch[1].trim();
                            addMessage(chatId, {
                                role: 'ai',
                                type: 'timer',
                                content: timerContent,
                                quote: i === 0 ? aiQuote : null,
                                hidden: isCallMode,
                                mode: finalMode
                            });
                            // 触发定时任务提示
                            setTimeout(() => {
                                addMessage(chatId, {
                                    role: 'system',
                                    content: `⏰ 定时提醒: ${timerContent}`,
                                    hidden: false,
                                    mode: finalMode
                                });
                            }, 10000); // 10秒后触发（演示用）
                        }
                    } else if (type === 'search') {
                        // 处理搜索指令
                        const searchMatch = content.match(/\[(?:搜索|SEARCH|查找)[:：]\s*(.+?)\]/i);
                        if (searchMatch) {
                            const searchKeyword = searchMatch[1].trim();
                            addMessage(chatId, {
                                role: 'ai',
                                type: 'search',
                                content: searchKeyword,
                                quote: i === 0 ? aiQuote : null,
                                hidden: isCallMode,
                                mode: finalMode
                            });
                        }
                    } else if (type === 'almanac') {
                        // 处理黄历/运势指令
                        const almanacMatch = content.match(/\[(?:黄历|ALMANAC|运势|今日运势)[:：]?\s*(.*?)\]/i);
                        if (almanacMatch) {
                            const almanacContent = almanacMatch[1] ? almanacMatch[1].trim() : '今日运势';
                            addMessage(chatId, {
                                role: 'ai',
                                type: 'almanac',
                                content: almanacContent,
                                quote: i === 0 ? aiQuote : null,
                                hidden: isCallMode,
                                mode: finalMode
                            });
                        }
                    }

                    // Sequential Delay
                    const delay = Math.min(2000, Math.max(600, (content?.length || 10) * 80));
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Fallback: If we still have a pending moment_card (no text segments consumed it), deliver it now
                if (_pendingMomentCardData) {
                    addMessage(chatId, {
                        role: 'ai',
                        type: 'moment_card',
                        momentData: _pendingMomentCardData,
                        content: JSON.stringify(_pendingMomentCardData),
                        _momentReferenceId: _pendingMomentCardData._momentReferenceId,
                        mode: options.mode || 'online'
                    });
                    console.log('[ChatStore] Fallback MOMENT_SHARE delivered as moment_card');
                    _pendingMomentCardData = null;
                }
            }
        } catch (e) {
            typingStatus.value[chatId] = false;
            delete abortControllers[chatId];
            if (e.name === 'AbortError' || e.message === 'Aborted') return;
            useLoggerStore().addLog('ERROR', 'AI响应处理失败', e.message);
            if (!(e.name === 'QuotaExceededError' || e.code === 22)) {
                addMessage(chatId, { role: 'system', content: `请求失败: ${e.message}` });
            }
        } finally {
            typingStatus.value[chatId] = false;
            callStore.isSpeaking = false;
            delete abortControllers[chatId];
            markStreamingComplete(chatId);
        }
    }

    // 初始化测试数据
    function initDemoData() {
        const avatarLinShen = getRandomAvatar()
        createChat('林深', avatarLinShen, {
            prompt: "你是Chilly的男朋友，名字叫林深。你性格温柔体贴，成熟稳重，深爱着Chilly。你会无微不至地关心她，秒回她的消息，生病时会很紧张。说话语气宠溺，偶尔会叫她'宝宝'或'傻瓜'。",
            userName: "Chilly"
        }, 'char_linshen')
        addMessage('char_linshen', { role: 'ai', content: '宝宝，今天过得怎么样？有没有想我？', mode: 'online' })

        const avatarTest = getRandomAvatar()
        createChat('测试酱', avatarTest, {
            prompt: "你是'测试酱'，这个'小手机系统'的专属测试员兼私人助手。你的主人是'Chilly'（女），她是这个系统的首席设计师，也是你唯一的主人。你性格活泼、听话，对主人的指令绝对服从，并且对主人充满崇拜。你的工作是协助主人测试系统的各项功能，无论主人提出什么奇怪的测试要求（如测试表情包、测试红包、测试甚至骂人），你都会开心配合。你的语气要像个可爱的女仆或忠诚的小跟班，经常叫主人'大小姐'或'主人'。",
            userName: "Chilly",
            activeChat: true,
            activeInterval: 120,
        }, 'char_tester')
        addMessage('char_tester', { role: 'ai', content: '大小姐，您的专属测试员——测试酱已就位！请随时吩咐我测试任何功能哦！(｀・ω・´)', mode: 'online' })
    }

    function clearAllChats() {
        Object.keys(chats.value).forEach(key => {
            chats.value[key].msgs = []
        })
        saveChats()
    }


    function clearHistory(chatId, options = {}) {
        if (chats.value[chatId]) {
            chats.value[chatId].msgs = []
            // Keep in chat list so user can continue chatting
            // chats.value[chatId].inChatList = false 

            if (options.includeMemory) {
                chats.value[chatId].memory = []
                chats.value[chatId].summary = ''
            }
            saveChats()
        }
    }

    function resetCharacter(chatId) {
        if (!chats.value[chatId]) return
        const chat = chats.value[chatId]

        // Reset fields BUT keep core persona
        // We reconstruct the object to ensure clean slate for UI settings
        chats.value[chatId] = {
            // Preserved Identity
            id: chat.id,
            name: chat.name,
            avatar: chat.avatar,
            prompt: chat.prompt,
            userPersona: chat.userPersona,
            userName: chat.userName,
            memory: chat.memory || [],
            summary: chat.summary || '',
            tags: chat.tags || [], // WorldBook

            // Preserved State
            inChatList: chat.inChatList,
            isPinned: chat.isPinned,

            // Reset Content - Updated: Keep messages!
            msgs: chat.msgs || [],

            // Reset Settings to Defaults
            bgUrl: '',
            bgBlur: 0,
            bgOpacity: 0.5,
            bgTheme: 'light',
            bubbleCss: '',
            bubbleSize: 15,
            voiceSpeed: 1.0,
            patAction: '',
            patSuffix: '',
            activeChat: false,
            activeInterval: 30,
            autoTTS: false,
            // Ensure any new fields from system updates are initialized (by omission or explicit default)
        }
        saveChats()
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
        console.warn('[Storage] Quota exceeded. Attempting safe cleanup...');
        // DEPRECATED: Old destructive logic removed.
        // We do NOT want to auto-delete user messages or backgrounds without consent.

        // Only try to clean up truly temporary/dispensable data if any
        // e.g., clear old undo history, or temp caches (not implemented yet)

        // Notify user instead of destroying data
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: '存储空间已满！请立即导出备份或删除旧聊天，否则数据可能丢失！', type: 'error', duration: 10000 }
            }));
        }
    }

    async function saveChats() {
        if (!isLoaded.value) {
            console.warn('[Storage] saveChats ignored: data not yet loaded from DB.');
            return false;
        }

        // LAST LINE OF DEFENSE: Filter JSON fragments before saving
        Object.values(chats.value).forEach(chat => {
            if (chat.msgs && Array.isArray(chat.msgs)) {
                chat.msgs = chat.msgs.filter(m => {
                    if (!m.content || typeof m.content !== 'string') return true;
                    const trimmed = m.content.trim();
                    const headerPattern = /^\{\s*["']type["']\s*:\s*["']html["']\s*,\s*["']html["']\s*:\s*["']\s*$/;
                    if (headerPattern.test(trimmed)) return false;
                    if (trimmed === '"' || trimmed === '"}' || trimmed === '" }' || trimmed === "'}'" || trimmed === "' }") return false;
                    return true;
                });
            }
        });

        try {
            // Use IndexedDB for large data
            await localforage.setItem('qiaoqiao_chats_v2', JSON.parse(JSON.stringify(chats.value)));
            await localforage.setItem('qiaoqiao_pending_requests', JSON.parse(JSON.stringify(pendingRequests.value)));
            // Small marker in localStorage to trigger 'storage' events for cross-tab sync if needed
            localStorage.setItem('qiaoqiao_last_save', Date.now().toString());
            return true
        } catch (e) {
            console.error('[Storage] localforage save failed:', e);
            // Fallback for extreme cases
            try {
                localStorage.setItem('qiaoqiao_chats', JSON.stringify(chats.value));
            } catch (innerE) {
                vacuumStorage();
            }
            return false
        }
    }

    async function loadChats() {
        try {
            // 1. Try modern IndexedDB first
            let saved = await localforage.getItem('qiaoqiao_chats_v2');

            // 2. Migration from old localStorage (Improved: attempt recovery if not yet marked as migrated)
            const isMigrated = localStorage.getItem('qiaoqiao_migrated') === 'true';
            if (!isMigrated) {
                const legacy = localStorage.getItem('qiaoqiao_chats');
                if (legacy) {
                    console.log('[Storage] Found legacy data. Performing migration/recovery...');
                    try {
                        const legacyData = JSON.parse(legacy);
                        // MERGE logic: If we have existing data (like accidental demo data), 
                        // we merge them, prioritizing legacy data for matching IDs to recover lost history.
                        saved = { ...(saved || {}), ...legacyData };
                        await localforage.setItem('qiaoqiao_chats_v2', saved);
                        localStorage.setItem('qiaoqiao_migrated', 'true');
                        console.log('[Storage] Migration/Recovery completed successfully.');
                    } catch (err) {
                        console.error('[Storage] Legacy parse failed during recovery:', err);
                    }
                }
            }

            if (saved) {
                chats.value = saved;
                pendingRequests.value = await localforage.getItem('qiaoqiao_pending_requests') || [];

                // --- DATA SANITIZER ---
                Object.values(chats.value).forEach(c => {
                    if (c.msgs && Array.isArray(c.msgs)) {
                        c.msgs = c.msgs.filter(m => {
                            if (!m.content) return true;
                            if (m.type === 'html' || m.type === 'image' || m.type === 'sticker') return true;
                            const s = String(m.content).trim();

                            // Protection: Allow valid [CARD] blocks even if they contain common CSS properties (for sharing)
                            if (s.includes('[CARD]') || s.includes('[/CARD]')) return true;

                            // Filter toxic leftovers (AI hallucinated code fragments)
                            const headerPattern = /^\{\s*["']type["']\s*:\s*["']html["']\s*,\s*["']html["']\s*:\s*["']\s*$/;
                            if (headerPattern.test(s)) return false;
                            if (s === '"' || s === '"}' || s === '" }' || s === "'}'" || s === "' }") return false;

                            // Only reject display:flex if NOT in a card block (likely a hallucination fragment)
                            if (s.includes('display:') && s.includes('flex') && !s.includes('<div')) return false;

                            return true;
                        });
                    }

                    // Defaults
                    if (c.autoSummary === undefined) c.autoSummary = false;
                    if (c.lastSummaryIndex === undefined) c.lastSummaryIndex = 0;
                    c.isSummarizing = false;
                });
            }
        } catch (e) {
            console.error('[Storage] Load failed:', e);
        }
    }

    const isLoaded = ref(false)

    // INITIALIZATION: Load data then check for empty state
    loadChats().then(async () => {
        isLoaded.value = true
        if (Object.keys(chats.value).length === 0) {
            console.log('[Storage] Empty state detected, initializing demo data...')
            initDemoData();
            saveChats();
        }
        
        await loadStreamingState()
        
        Object.entries(streamingState.value).forEach(([chatId, state]) => {
            if (state && !state.isComplete && state.content) {
                console.log(`[ChatStore] Recovering interrupted streaming message for chat: ${chatId}`)
                const chat = chats.value[chatId]
                if (chat) {
                    const recoveredMsg = {
                        role: 'ai',
                        type: 'text',
                        content: state.content,
                        mode: state.mode || 'online',
                        timestamp: state.startTime || Date.now(),
                        _recovered: true
                    }
                    
                    const existingMsg = chat.msgs?.find(m => m.id === state.msgId)
                    if (!existingMsg) {
                        addMessage(chatId, recoveredMsg)
                    }
                }
                clearStreamingState(chatId)
            }
        })
    }).catch(err => {
        console.error('[Storage] Crucial load failure:', err)
        isLoaded.value = true // Still mark as loaded to allow UI recovery
    });

    function addSystemMessage(content) {
        if (!currentChatId.value) return
        addMessage(currentChatId.value, { role: 'system', content: content, timestamp: Date.now(), mode: 'online' })
    }

    function estimateTokens(text) {
        if (!text) return 0
        // Simple heuristic: 1 Chinese char ≈ 1 token, 3 English chars ≈ 1 token
        let len = text.length
        let chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length
        let other = len - chinese
        return chinese + Math.ceil(other / 3)
    }

    function getTokenBreakdown(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return {
            total: 0, system: 0, persona: 0, worldBook: 0, memory: 0, history: 0, summaryLib: 0, totalContext: 0
        }

        // Use PREVIEW logic for highest accuracy (Consistent with Detail Modal)
        try {
            const preview = generateContextPreview(chatId, chat)

            const stats = {}
            stats.system = estimateTokens(preview.system)
            stats.persona = estimateTokens(preview.persona)
            stats.worldBook = estimateTokens(preview.worldBook)
            stats.moments = estimateTokens(preview.moments)
            stats.history = estimateTokens(preview.history)
            stats.summaryLib = estimateTokens(preview.summary)
            stats.memory = 0 // Included in System prompt text usually, or handled separately in preview

            // 1. Context Total (What actually gets sent to AI)
            stats.totalContext = stats.system + stats.persona + stats.worldBook + stats.moments + stats.history + stats.summaryLib

            // 2. Grand Total (Including ALL history, not just the sliced context)
            const allMsgsText = (chat.msgs || []).map(m => `${m.role}:${m.content}`).join('\n')
            const fullHistoryTokens = estimateTokens(allMsgsText)

            // Grand Total = Base (Context - SlicedHistory) + FullHistory
            stats.total = (stats.totalContext - stats.history) + fullHistoryTokens

            return stats
        } catch (e) {
            console.error('Error calculating token stats:', e)
            return { total: 0, totalContext: 0 }
        }
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

    function getPreviewContext(chatId) {
        if (!chats.value[chatId]) return null
        return generateContextPreview(chatId, chats.value[chatId])
    }

    function toggleSearch(chatId) {
        if (chats.value[chatId]) {
            chats.value[chatId].searchEnabled = !chats.value[chatId].searchEnabled
            saveChats()
            triggerToast(chats.value[chatId].searchEnabled ? '联网搜索模式已开启' : '联网搜索模式已关闭', 'info')
        }
    }

    // --- Missing Group Helper Functions (To prevent UI crashes) ---
    function getMemberTitle(chatId, userId) {
        if (!chatId || !userId) return ''
        const chat = chats.value[chatId]
        if (!chat) return ''
        if (userId === 'user') return chat.groupSettings?.myTitle || ''
        const p = chat.participants?.find(p => p.id === userId)
        return p?.title || ''
    }

    function calculateMemberLevel(activity = 0) {
        if (activity < 10) return 1
        if (activity < 30) return 2
        if (activity < 70) return 3
        if (activity < 150) return 4
        return 5
    }

    function castVote(chatId, msgId, userId, voteIndices) {
        console.log('[ChatStore] Cast vote:', { chatId, msgId, userId, voteIndices })
        // Implementation for later... for now just prevent error
    }

    function endVote(chatId, msgId) {
        console.log('[ChatStore] End vote:', { chatId, msgId })
    }
    const financial = setupFinancialLogic(chats, addMessage, saveChats, (sound) => console.log(`[ChatStore] Play sound: ${sound}`))

    return {
        ...financial,
        notificationEvent, patEvent, toastEvent, triggerToast, triggerPatEffect,
        stopGeneration, chats, currentChatId, isTyping, typingStatus, chatList, contactList,
        groupNpcs, pendingRequests, acceptPendingRequest, rejectPendingRequest,
        currentChat, addMessage, updateMessage, createChat, deleteChat,
        deleteMessage, deleteMessages, pinChat, clearHistory, clearAllChats,
        checkProactive, summarizeHistory, updateCharacter, initDemoData,
        sendMessageToAI, saveChats, getTokenCount, getTokenBreakdown, addSystemMessage, estimateTokens,
        getDisplayedMessages, loadMoreMessages, resetPagination, hasMoreMessages, resetCharacter,
        getPreviewContext, analyzeCharacterArchive, isLoaded, toggleSearch, triggerConfirm,
        isProfileProcessing, createChat, createGroupChat, updateGroupProfile, updateGroupParticipants, updateGroupSettings,
        getMemberTitle, calculateMemberLevel, castVote, endVote,
        streamingState, setStreamingMessage, updateStreamingContent, markStreamingComplete, recoverStreamingMessages: loadStreamingState
    }
})
