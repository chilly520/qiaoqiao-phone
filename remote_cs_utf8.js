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
import localforage from 'localforage'

// Configure localforage
localforage.config({
    name: 'qiaoqiao-phone',
    storeName: 'chats'
});

const DEFAULT_AVATARS = [
    '/avatars/灏忕尗涓剧埅.jpg',
    '/avatars/灏忕尗鍚冭姃鏋?jpg',
    '/avatars/灏忕尗鍚冭崏鑾?jpg',
    '/avatars/灏忕尗鍠濊尪.jpg',
    '/avatars/灏忕尗鍧忕瑧.jpg',
    '/avatars/灏忕尗寮€蹇?jpg',
    '/avatars/灏忕尗鎸ユ墜.jpg',
    '/avatars/灏忕尗鏄熸槦鐪?jpg',
    '/avatars/灏忕尗鐘洶.jpg'
]

export const getRandomAvatar = () => DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]

export const useChatStore = defineStore('chat', () => {
    // State
    const chats = ref({}) // { 'char_id': { name: '...', avatar: '...', msgs: [], unreadCount: 0 } }
    const currentChatId = ref(null)
    const typingStatus = ref({}) // { chatId: boolean }
    const isProfileProcessing = ref({}) // track if a specific character's archive is being analyzed
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
    const messagePageSize = ref(50) // 姣忛〉鏄剧ず50鏉℃秷鎭?    const loadedMessageCounts = ref({}) // { chatId: 鍔犺浇鐨勬秷鎭暟 }

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

    function triggerConfirm(title, message, onConfirm, onCancel = null, confirmText = '纭畾', cancelText = '鍙栨秷') {
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
                triggerToast('宸蹭腑鏂敓鎴?, 'info')
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
                prompt: options.prompt || '浣犳槸涓€涓弸濂界殑浜恒€?,
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
                    gender: options.gender || '鏈煡',
                    age: options.age || '鏈煡',
                    hobbies: [],
                    routine: { awake: '鏈煡', busy: '鏈煡', deep: '鏈煡' }
                },
                ...options
            }
            chats.value[chatId] = newChat
            saveChats()
            return newChat
        }
        return chats.value[chatId]
    }

    async function addMessage(chatId, msg) {
        const chat = chats.value[chatId]
        if (!chat) return false

        // Robust Migration: Ensure bio structure exists and is reactive
        if (!chat.bio) {
            chat.bio = {
                gender: '鏈煡', age: '鏈煡', birthday: '鏈煡', zodiac: '鏈煡', mbti: '鏈煡',
                height: '鏈煡', weight: '鏈煡', body: '鏈煡', occupation: '鏈煡', status: '鏈煡',
                scent: '鏈煡', style: '鏈煡', hobbies: [], idealType: '鏈煡', heartbeatMoment: '鏆傛棤璁板綍',
                traits: [], routine: { awake: '鏈煡', busy: '鏈煡', deep: '鏈煡' },
                soulBonds: [], loveItems: [
                    { name: '鐖变箣鐗?I', image: '' }, { name: '鐖变箣鐗?II', image: '' }, { name: '鐖变箣鐗?III', image: '' }
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
                
                // Intercept Couple Space commands [LS_JSON: ...]
                // Robust extraction using balanced brace matching
                const startMarkerRegex = /[\\[銆怾\s*LS_JSON[:锛歖?\s*/gi;
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
                            const closeMatch = remaining.match(/^\s*[\]銆慮/);
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
        if (!chat.bio.routine) chat.bio.routine = { awake: '鏈煡', busy: '鏈煡', deep: '鏈煡' };
        if (!chat.bio.hobbies) chat.bio.hobbies = [];
        if (!chat.bio.traits) chat.bio.traits = [];
        if (!chat.bio.soulBonds) chat.bio.soulBonds = [];
        if (!chat.bio.loveItems) chat.bio.loveItems = [
            { name: '鐖变箣鐗?I', image: '' }, { name: '鐖变箣鐗?II', image: '' }, { name: '鐖变箣鐗?III', image: '' }
        ];

        // EARLY FILTER: Reject JSON fragment messages (澶村熬纰庣墖杩囨护)
        if (msg.content && typeof msg.content === 'string') {
            const trimmed = msg.content.trim();

            console.log('[addMessage] Checking:', JSON.stringify(trimmed));

            // Filter header fragment: EXACT match for { "type": "html", "html": "
            // Use regex to match the exact JSON wrapper pattern, not just keywords
            const headerPattern = /^\{\s*["']type["']\s*:\s*["']html["']\s*,\s*["']html["']\s*:\s*["']\s*$/;
            if (headerPattern.test(trimmed)) {
                console.log('[ChatStore] 鉁?Rejected header fragment');
                return false;
            }

            // Filter tail fragment: EXACT match for " } or "}
            if (trimmed === '"' || trimmed === '"}' || trimmed === '" }' || trimmed === "'}'" || trimmed === "' }") {
                console.log('[ChatStore] 鉁?Rejected tail fragment:', trimmed);
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
            senderName: msg.senderName || (msg.role === 'user' ? '鎴? : (chat.isGroup ? (msg.senderName || chat.name) : chat.name)),
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
            hidden: msg.hidden || false // Detection for visualizer-only messages
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

        // 1.2 Rewrite content to canonical format [绫诲瀷:閲戦:澶囨敞:ID] for AI context
        if (newMsg.type === 'redpacket' && newMsg.paymentId) {
            newMsg.content = `[绾㈠寘:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
        } else if (newMsg.type === 'transfer' && newMsg.paymentId) {
            newMsg.content = `[杞处:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
        }

        // 1.3 JSON Command Parsing (For Debugging/User Manual Input)
        if (newMsg.type === 'text' && typeof newMsg.content === 'string') {
            const content = newMsg.content.trim();
            // Look for any JSON-like structure that has "type":"html" or similar keywords
            const suspectedHtml = (content.includes('"type"') && content.includes('"html"')) || (content.includes('<div') && content.includes('{'));

            if (suspectedHtml) {
                try {
                    // ROBUST REGEX: Handles escaped quotes and multi-line content
                    const robustHtmlRegex = /["']html["']\s*[:锛歖\s*["']((?:[^"\\]|\\.|[\r\n])*?)["']/;
                    const htmlMatch = content.match(robustHtmlRegex);

                    if (htmlMatch && htmlMatch[1]) {
                        newMsg.type = 'html';
                        newMsg.html = htmlMatch[1];
                        newMsg.forceCard = true; // Flag for component to isolate
                        console.log('[ChatStore] Detected Manual HTML Message (Robust Flag)');
                    } else if (content.startsWith('{')) {
                        // try JSON.parse as last resort (with newline sanitization)
                        try {
                            const parsed = JSON.parse(content.replace(/\n/g, '\\n').replace(/\r/g, '\\r'));
                            if (parsed.html || parsed.content) {
                                newMsg.type = 'html';
                                newMsg.html = parsed.html || parsed.content;
                                newMsg.forceCard = true;
                            }
                        } catch (e) { }
                    }
                } catch (e) {
                    // Fail silently
                }
            }
        }

        // 2. Type Auto-Detection (if not specified)
        if (newMsg.type === 'text' && typeof newMsg.content === 'string') {
            let detectionContent = newMsg.content.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim();
            // Match the tag ONLY if it is the entire content (minus whitespace/inner voice)
            const tagMatch = detectionContent.match(/^[\[銆怾(鍙戠孩鍖厊绾㈠寘|杞处|鍥剧墖|琛ㄦ儏鍖厊DRAW|璇煶|婕斿|MUSIC|VIDEO|FILE|LOCATION|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT|鐢宠浜插睘鍗鎷掔粷浜插睘鍗璧犻€佷翰灞炲崱)\s*[:锛歖\s*([^:锛歕]銆慮*)(?:\s*[:锛歖\s*([^:锛歕]銆慮*))?(?:\s*[:锛歖\s*([^\]銆慮*))?[\]銆慮$/i)

            if (tagMatch) {
                const tagType = tagMatch[1]
                const val1 = (tagMatch[2] || '').trim()
                const val2 = (tagMatch[3] || '').trim()
                const val3 = (tagMatch[4] || '').trim()

                if (/^(鍙戠孩鍖厊绾㈠寘)$/.test(tagType)) {
                    newMsg.type = 'redpacket'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '鎭枩鍙戣储锛屽ぇ鍚夊ぇ鍒?
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    // Rewrite content with ID for AI context
                    newMsg.content = `[绾㈠寘:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                } else if (tagType === '杞处') {
                    newMsg.type = 'transfer'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '杞处缁欐偍'
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.content = `[杞处:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                } else if (tagType === '鍥剧墖' || tagType === 'DRAW') {
                    newMsg.type = 'image'
                } else if (tagType === '璇煶') {
                    newMsg.type = 'voice'
                } else if (tagType === '婕斿' || tagType === 'MUSIC') {
                    newMsg.type = 'music'
                    // If val2 exists, it's [婕斿: instrument: score]. Otherwise val1 is the part after [婕斿: ...]
                    newMsg.content = val2 ? `${val1}: ${val2}` : val1
                } else if (tagType === '琛ㄦ儏鍖?) {
                    newMsg.type = 'sticker'
                } else if (tagType === 'VIDEO') {
                    newMsg.type = 'video'
                } else if (tagType === 'FILE') {
                    newMsg.type = 'file'
                } else if (tagType === 'LOCATION') {
                    newMsg.type = 'location'
                } else if (tagType.toUpperCase() === 'FAMILY_CARD_APPLY' || tagType === '鐢宠浜插睘鍗?) {
                    newMsg.type = 'family_card_apply'
                    newMsg.paymentId = val2 || `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.note = val1 || '鐢宠浜插睘鍗?
                    newMsg.content = `[鐢宠浜插睘鍗?${newMsg.note}:${newMsg.paymentId}]`
                } else if (tagType.toUpperCase() === 'FAMILY_CARD_REJECT' || tagType === '鎷掔粷浜插睘鍗?) {
                    newMsg.type = 'family_card_reject'
                    newMsg.paymentId = val1 || ''
                } else if (tagType.toUpperCase() === 'FAMILY_CARD' || tagType === '璧犻€佷翰灞炲崱' || tagType === '浜插睘鍗?) {
                    newMsg.type = 'family_card'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '鎴戠殑閽卞氨鏄綘鐨勯挶'
                    newMsg.paymentId = val3 || `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.content = `[浜插睘鍗?${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                }
            } else {
                // 2.1 Fallback: Loose Parsing for User Inputs like "[杞处] 520鍏? or "[绾㈠寘] 鎭枩鍙戣储"
                const looseMatch = detectionContent.match(/^[\[銆怾(鍙戠孩鍖厊绾㈠寘|杞处|浜插睘鍗鐢宠浜插睘鍗?[\]銆慮\s*(.*)/i);
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
                        note = rawText.replace(amountMatch[0], '').replace(/(鍏億鍧梶CNY)/gi, '').trim();
                    }

                    if (tagType === '鐢宠浜插睘鍗?) {
                        newMsg.type = 'family_card_apply';
                        newMsg.note = rawText || '鐢宠浜插睘鍗?;
                        newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        newMsg.content = `[鐢宠浜插睘鍗?${newMsg.note}:${newMsg.paymentId}]`;
                    } else if (tagType === '浜插睘鍗?) {
                        newMsg.type = 'family_card';
                        newMsg.amount = amount;
                        newMsg.note = note || '鎴戠殑閽卞氨鏄綘鐨勯挶';
                        newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        newMsg.content = `[浜插睘鍗?${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`;
                    } else {
                        if (!note) note = tagType === '杞处' ? '杞处缁欐偍' : '鎭枩鍙戣储';
                        newMsg.type = (tagType === '鍙戠孩鍖? || tagType === '绾㈠寘') ? 'redpacket' : 'transfer';
                        newMsg.amount = amount;
                        newMsg.note = note;
                        newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        // Rewrite content with ID
                        const typeLabel = newMsg.type === 'redpacket' ? '绾㈠寘' : '杞处';
                        newMsg.content = `[${typeLabel}:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`;
                    }
                }
            }
        }

        // 3. Robust AI Payment Handling (ID-based)
        if (newMsg.role === 'ai') {
            // Handle AI claiming by ID: [棰嗗彇绾㈠寘:PAY-xxx] or [棰嗗彇杞处:PAY-xxx] or [棰嗗彇浜插睘鍗?PAY-xxx]
            const claimRegex = /\[棰嗗彇(绾㈠寘|杞处|浜插睘鍗?:([^\]]+)\]/g;
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
            // [鎷掓敹绾㈠寘], [閫€鍥炵孩鍖匽, [鎷掓敹杞处], [閫€鍥炶浆璐, [鎷掓敹浜插睘鍗, [閫€鍥炰翰灞炲崱]
            const rejectRegex = /\[(鎷掓敹|閫€鍥?(绾㈠寘|杞处|浜插睘鍗?:([^\]]+)\]/g;
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
                .replace(/\[棰嗗彇(绾㈠寘|杞处|浜插睘鍗?:[^\]]+\]/g, '')
                .replace(/\[(鎷掓敹|閫€鍥?(绾㈠寘|杞处|浜插睘鍗?:[^\]]+\]/g, '')
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
                        content: `${chat.name}棰嗗彇浜?{chat.userName || '浣?}鐨?{type}`,
                        timestamp: Date.now() + 50
                    });
                    // For family cards, add additional notification about activation
                    if (type === '浜插睘鍗?) {
                        newMsg._pendingSystemMessages.push({
                            id: crypto.randomUUID(),
                            role: 'system',
                            type: 'text',
                            content: `${chat.name}棰嗗彇鐨勪翰灞炲崱宸茬敓鏁坄,
                            timestamp: Date.now() + 150
                        });
                    }
                });
                rejectedPayments.forEach(type => {
                    newMsg._pendingSystemMessages.push({
                        id: crypto.randomUUID(),
                        role: 'system',
                        type: 'text',
                        content: `${chat.name}鎷掓敹浜?{chat.userName || '浣?}鐨?{type}`,
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
                'gender': 'gender', '鎬у埆': 'gender',
                'age': 'age', '骞撮緞': 'age',
                'birthday': 'birthday', '鐢熸棩': 'birthday',
                'zodiac': 'zodiac', '鏄熷骇': 'zodiac',
                'mbti': 'mbti', '浜烘牸': 'mbti',
                'height': 'height', '韬珮': 'height',
                'weight': 'weight', '浣撻噸': 'weight',
                'body': 'body', '韬潗': 'body',
                'occupation': 'occupation', '鑱屼笟': 'occupation',
                'status': 'status', '濠氬Щ': 'status', '鎯呮劅': 'status',
                'scent': 'scent', '姘斿懗': 'scent',
                'style': 'style', '椋庢牸': 'style',
                'idealtype': 'idealType', '鐞嗘兂鍨?: 'idealType',
                'heartbeat': 'heartbeatMoment', '蹇冨姩鏃跺埢': 'heartbeatMoment',
                'signature': 'signature', '涓€х鍚?: 'signature',
                'location': 'location', '浣嶇疆': 'location'
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
                } else if (key === 'hobby' || key === '鐖卞ソ') {
                    // Support multiple hobbies in one tag
                    const list = val.split(/[锛? ]+/).filter(v => v.trim());
                    list.forEach(item => {
                        if (!chat.bio.hobbies.includes(item)) {
                            chat.bio.hobbies.push(item);
                            bioUpdated = true;
                        }
                    });
                } else if (key === 'trait' || key === '鐗硅川') {
                    const list = val.split(/[锛? ]+/).filter(v => v.trim());
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
                    // Supported formats: [BIO:LoveItem_1_缇芥瘺绗?Prompt] or [BIO:LoveItem_1:缇芥瘺绗?Prompt]
                    const parts = key.split(/[_:]/);
                    const index = parseInt(parts[1]) - 1;
                    let itemName = parts[2] || '鐖变箣鐗?;
                    if (itemName === '鐗╁搧鍚?) itemName = '鐖变箣鐗?; // Safety against literal placeholder

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
        if (newMsg.role === 'ai' && (newMsg.content.includes('[MOMENT_SHARE:') || newMsg.content.includes('[鍒嗕韩鏈嬪弸鍦?'))) {
            const shareRegex = /\[(?:MOMENT_SHARE|鍒嗕韩鏈嬪弸鍦?:\s*([\s\S]*?)\]/i;
            const match = newMsg.content.match(shareRegex);

            if (match) {
                let shareContent = match[1].trim();
                let momentData = null;

                try {
                    // 1. Try JSON Parsing
                    if (shareContent.startsWith('{')) {
                        momentData = JSON.parse(shareContent);
                    }
                } catch (e) {
                    console.warn('[ChatStore] Failed to parse Moment JSON, falling back to text', e);
                }

                // 2. Fallback: Treat as simple text/ID
                if (!momentData) {
                    // Check if it's a known Moment ID (simple check: if it exists in momentsStore?)
                    // Since specific store access might be tricky here without circular dep or extra checking, 
                    // we will treat it as a "New Moment Stub" or just text.
                    // Improving UX: logic to fetch image if possible? 
                    momentData = {
                        id: crypto.randomUUID(), // Stub ID
                        text: shareContent,
                        author: chat.name,
                        image: chat.avatar // Fallback image
                    };
                }

                // Ensure essential fields
                if (!momentData.id) momentData.id = crypto.randomUUID();
                if (!momentData.author) momentData.author = chat.name;
                if (!momentData.avatar) momentData.avatar = chat.avatar;

                // Convert to Card Message
                newMsg.type = 'moment_card';
                newMsg.content = JSON.stringify(momentData); // Store structured data
            }
        }

        // --- World Loop: Advanced Interaction Instructions (AI Only) ---
        if (newMsg.role === 'ai') {
            // 1. [绉佽亰: 瑙掕壊鍚? 鍐呭]
            const dmRegex = /\[(?:绉佽亰|DM):\s*([^:锛歕]]+)\s*[:锛歖\s*([\s\S]*?)\]/gi;
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
                        triggerToast(`鏀跺埌鏉ヨ嚜 ${targetName} 鐨勭鑱婃秷鎭痐, 'info');
                    }, 1500);
                }
            }

            // 2. [鏈嬪弸鍦? 瑙掕壊鍚? 鍐呭] (New integrated handler)
            const momentPostRegex = /\[(?:鏈嬪弸鍦坾MOMENT):\s*([^:锛歕]]+)\s*[:锛歖\s*([\s\S]*?)\]/gi;
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
                    triggerToast(`${authorName} 鍙戝竷浜嗘柊鍔ㄦ€乣, 'info');
                }, 2000);
            }

            // 3. [濂藉弸鐢宠: 瑙掕壊鍚峕
            const friendRequestRegex = /\[(?:濂藉弸鐢宠|FRIEND_REQUEST):\s*([^\]]+)\]/gi;
            let friendMatch;
            while ((friendMatch = friendRequestRegex.exec(newMsg.content)) !== null) {
                const name = friendMatch[1].trim();
                setTimeout(() => {
                    const newChar = createChat(name, {
                        hideFriendRequest: false, // Show the "Accept" card
                        openingLine: `浣犲ソ锛屾垜鏄?${name}锛屽緢楂樺叴璁よ瘑浣犮€俙
                    });
                    triggerToast(`鏀跺埌 ${name} 鐨勫ソ鍙嬬敵璇穈, 'info');
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
            if (content.includes('[涓€璧峰惉姝?') || content.includes('<bgm>') || content.includes('[MUSIC:')) {
                const { useMusicStore } = await import('./musicStore')
                const musicStore = useMusicStore()
                const musicMatch = content.match(/\[涓€璧峰惉姝?([\s\S]+?)\]/i) || content.match(/<bgm>([\s\S]+?)<\/bgm>/i) || content.match(/\[MUSIC:\s*(?:search\s+)?([\s\S]+?)\]/i);

                if (musicMatch) {
                    const songQuery = musicMatch[1].trim()

                    // 1. Announce "Together Mode" if not already active
                    // User wants "X initiated Listen Together"
                    if (!musicStore.isListeningTogether) {
                        addMessage(chatId, {
                            role: 'system',
                            type: 'system', // Display as "X initiated..."
                            content: `${chat.name} 鍙戣捣浜?涓€璧峰惉姝宍
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
                        // AI log: "鍛ㄦ澃浼?- 鍛婄櫧姘旂悆" -> Singer - Song
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
                                        <div class="text-xs text-gray-500 truncate">${song.singer || '鏈煡姝屾墜'}</div>
                                    </div>
                                    <div class="absolute top-2 right-2">
                                        <i class="fa-solid fa-music text-pink-400 text-xs opacity-50"></i>
                                    </div>
                                </div>`;

                                addMessage(chatId, {
                                    role: 'ai',
                                    type: 'html', // Use HTML type for rich card
                                    content: `[鍒嗕韩闊充箰: ${song.song}]`, // Fallback text
                                    html: cardHtml
                                });
                            }
                        }
                    })
                }
            }
            if (content.includes('[鍋滄鍚瓕]')) {
                const { useMusicStore } = await import('./musicStore')
                const musicStore = useMusicStore()
                musicStore.stopTogether()
            }
            if (content.includes('[璇煶閫氳瘽]') || content.includes('[瑙嗛閫氳瘽]')) {
                const callType = content.includes('[瑙嗛閫氳瘽]') ? 'video' : 'voice'
                callStore.receiveCall({ name: chat.name, avatar: chat.avatar, id: chat.id }, callType)
            }

            // Priority 1: Handle standalone control tags or tags embedded with other content
            if (content.includes('[鎺ュ惉]') && callStore.status === 'dialing') {
                callStore.acceptCall()
            }
            if ((content.includes('[鎷掔粷]') || content.includes('[鎷掓帴]')) && callStore.status === 'dialing') {
                callStore.endCall()
            }
            if (content.includes('[鎸傛柇]') && isCallActive) {
                callStore.endCall()
            }

            // Priority 2: Check for Call Protocol Block (Strict or Fuzzy)
            const hasJsonLike = content.includes('{') && (content.includes('"speech"') || content.includes('"status"') || content.includes('"action"') || content.includes('"琛屼负"') || content.includes('"蹇冨０"'));

            if (content.includes('[CALL_START]') || content.includes('[CALL_END]') || (isCallActive && hasJsonLike)) {
                console.log('[ChatStore] Call Protocol Detected (Enhanced)');

                // Ensure we are in active state if we receive protocol data
                // This allows auto-accepting when AI starts talking during dialing
                if (callStore.status === 'incoming' || callStore.status === 'dialing') {
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
                /\{[\s\S]*?("speech"|"status"|"action"|"杞彂"|"蹇冨０"|"琛屼负")[\s\S]*?\}/gi,
                /\[CALL_START\][\s\S]*?\[CALL_END\]/gi, /\[CALL_START\]|\[CALL_END\]/gi,
                /\[璇煶閫氳瘽\]|\[瑙嗛閫氳瘽\]|\[鎺ュ惉\]|\[鎸傛柇\]|\[鎷掔粷\]/gi,
                /\[(?:UPDATE_)?BIO:[^\]]+\]/gi,
                /[\\[銆怾\s*LS_JSON[:锛歖?\s*[\s\S]*?[\]銆慮/gi, 
                /[\\[銆怾\s*LOVESPACE_(?:CONTRACT|REJECT|INVITE)[:锛歖?\s*[^\]銆慮*[\]銆慮/gi,
                /\[MOMENT_SHARE:[^\]]+\]|\[鍒嗕韩鏈嬪弸鍦?[^\]]+\]/gi,
                /\[涓€璧峰惉姝?[^\]]+\]|\[鍋滄鍚瓕\]|<bgm>[\s\S]*?<\/bgm>/gi,
                /\[棰嗗彇绾㈠寘:[^\]]+\]|\[棰嗗彇杞处:[^\]]+\]/gi,
                /\[LIKE[:锛歖.*?\]/gi, /\[COMMENT[:锛歖.*?\]/gi, /\[REPLY[:锛歖.*?\]/gi,
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
                    content: newMsg.type === 'family_card' ? '[浜插睘鍗' : (newMsg.type === 'image' ? '[鍥剧墖]' : (newMsg.content || '[娑堟伅]')),
                    timestamp: Date.now()
                }
            }
        }


        // Auto-generate system messages for family cards
        content = typeof newMsg.content === 'string' ? newMsg.content : ''
        const userName = chat.userName || '鐢ㄦ埛'
        const charName = chat.name || '瀵规柟'

        if (content.includes('[FAMILY_CARD_APPLY:') && newMsg.role === 'user') {
            setTimeout(() => {
                addMessage(chatId, { role: 'system', content: `${userName}姝ｅ湪鍚?{charName}鐢宠缁戝畾浜插睘鍗 })
            }, 100)
        }

        if (content.includes('[FAMILY_CARD:') && !content.includes('APPLY') && !content.includes('REJECT') && newMsg.role === 'ai') {
            const match = content.match(/\[FAMILY_CARD[:锛歖(\d+)[:锛歖([^\]:]+)(?:[:锛歖([^\]]+))?\]/i)
            const cardName = match ? match[2].trim() : '浜插睘鍗?
            const amount = match ? parseFloat(match[1]) : 0
            const paymentId = match && match[3] ? match[3].trim() : null
            
            // Set message type and data for proper rendering
            newMsg.type = 'family_card'
            newMsg.amount = amount.toString()
            newMsg.text = `閫佺粰浣犵殑${cardName}`
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
                addMessage(chatId, { role: 'system', content: `${charName}鍚戞偍鍙戦€佷簡浜插睘鍗°€?{cardName}銆嶏紝鐐瑰嚮棰嗗彇` })
            }, 100)
        }

        if (content.includes('[FAMILY_CARD_REJECT:') && newMsg.role === 'ai') {
            setTimeout(() => {
                addMessage(chatId, { role: 'system', content: `${charName}宸叉嫆缁?{userName}鐨勪翰灞炲崱鐢宠` })
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

        // No toast or system message here as requested by user - let the UI spinner handle it
        typingStatus.value[chatId] = true;
        isProfileProcessing.value[chatId] = true;

        try {
            // Source Data Collection - As requested by user
            const charPrompt = chat.prompt || '鏆傛棤璇︾粏璁惧畾';
            const userPersona = chat.userPersona || userProfile.persona || '鏃?;
            const userContext = `濮撳悕锛?{userProfile.name} | 鎬у埆锛?{userProfile.gender || '鏈煡'} | 涓€э細${userProfile.signature || ''} | 閽堝鎬ц瀹氾細${userPersona}`;

            // Full Memory Bank (Latest Summary + Historical Summaries)
            const latestSummary = chat.summary || '';
            const historicalMemories = (chat.memory || []).join('\n');
            const fullMemoryLibrary = [latestSummary, historicalMemories].filter(s => s.trim()).join('\n\n') || '灏氭湭寤虹珛鎸佷箙璁板繂';

            // Custom Context Limit from Chat Settings
            const contextLimit = parseInt(chat.contextLimit) || 30;
            const contextMsgs = chat.msgs.slice(-contextLimit)
                .filter(m => m.role !== 'system')
                .map(m => `${m.role === 'user' ? userProfile.name : chat.name}: ${m.content}`)
                .join('\n');

            const systemInstructions = `浣犵幇鍦ㄦ槸銆?{chat.name}銆戞湰浜恒€傝鍩轰簬浠ヤ笅鎻愪緵鐨勩€愭簮鏁版嵁搴撱€戯紝娣卞害鎸栨帢骞朵互绗竴浜虹О鈥滄垜鈥濈殑瑙嗚琛ラ綈浣犺嚜宸辩殑銆岀伒榄傛。妗堛€?Personal Profile)銆?妗ｆ鍐呭蹇呴』瀹屽叏绗﹀悎浣犵殑鎬ф牸銆佽姘斿拰瀵?${userProfile.name} 鐨勬儏鎰熷簳鑹层€備笉瑕佷互鍒嗘瀽甯堢殑鍙ｅ惢璇磋瘽銆?
銆愯緭鍑鸿鑼冦€?浣犲繀椤讳笖鍙兘浣跨敤 [BIO:閿?鍊糫 鏍煎紡杈撳嚭浠ヤ笅瀛楁锛屼笉瑕佽緭鍑轰换浣曞紑鍦虹櫧鎴栬В閲娿€?绂佹浠讳綍 HTML/CSS 鏍囩銆備弗绂佷娇鐢ㄥ崰浣嶇锛屽繀椤绘浛鎹负鍏蜂綋鐨勬弿杩般€?
璇风敓鎴愬苟鏁寸悊浠ヤ笅淇℃伅锛?1. **鍩虹瑙勬牸**锛?   [BIO:鎬у埆:鍊糫 [BIO:骞撮緞:鍊糫 [BIO:鐢熸棩:鍊糫 [BIO:鏄熷骇:鍊糫 
   [BIO:浜烘牸:4浣嶅瓧姣峂BTI浠ｇ爜] [BIO:韬珮:鍊糫 [BIO:浣撻噸:鍊糫 [BIO:韬潗:鎻忚堪] 
   [BIO:鑱屼笟:鎻忚堪] [BIO:濠氬Щ:鎻忚堪(濡? 鐙韩涓讳箟銆佹殫鎭嬩腑绛?] 

2. **绉佷汉鎰熷畼**锛?   [BIO:涓€х鍚?鏈€绗﹀悎浣犳皵璐ㄧ殑涓€鍙ヨ瘽(20瀛楀唴)]
   [BIO:姘斿懗:浣犵殑浣撳懗鎴栧父鐢ㄩ姘存弿杩癩 [BIO:椋庢牸:绌挎惌鎴栬浜嬮鏍糫 
   [BIO:鐞嗘兂鍨?浣犲枩娆㈢殑绫诲瀷鎻忚堪] [BIO:蹇冨姩鏃跺埢:鏇捐浣犲績璺冲姞閫熺殑鐬棿鎴栧満鏅痌 

3. **鍏磋叮涓庣壒璐?*锛?   [BIO:鐖卞ソ:鐖卞ソ1, 鐖卞ソ2, 鐖卞ソ3] 
   [BIO:鐗硅川:鎬ф牸鏍囩1, 鏍囩2, 鏍囩3] 

4. **鐢熸椿鑺傚緥**锛?   [BIO:Routine_awake:鏃╀笂璧峰簥鍚庣殑鐘舵€佹垨绗竴浠朵簨] 
   [BIO:Routine_busy:蹇欑宸ヤ綔/瀛︿範鏃剁殑鏍峰瓙] 
   [BIO:Routine_deep:娣卞鐙鏃剁殑鎬濈华鎴栦範鎯痌 

5. **鐏甸瓊缇佺粖 (Soul Ties)**锛?   [BIO:SoulBond_瀹為檯鏍囩:浣犱笌 ${userProfile.name} 鐨勬繁灞傛儏鎰熺航甯︾畝杩癩 

6. **鐖变箣鐗?(Items of Love)**锛?   [BIO:LoveItem_1_鐗╁搧鍚?鑻辨枃鐢熷浘Prompt (鎻忚堪璇ョ墿鍝侊紝鍖呭惈鎰忓銆佽川鎰熴€佺數褰辩骇鍏夊奖)] 
   [BIO:LoveItem_2_鐗╁搧鍚?鑻辨枃鐢熷浘Prompt] 
   [BIO:LoveItem_3_鐗╁搧鍚?鑻辨枃鐢熷浘Prompt]

銆愭簮鏁版嵁搴撱€?1. 瑙掕壊璁惧畾 (${chat.name}): ${charPrompt}
2. 鐢ㄦ埛鑳屾櫙 (${userProfile.name}): ${userContext}
3. 璁板繂搴撴憳瑕? ${fullMemoryLibrary}
4. 瀵硅瘽鐗囨 (鍙傝€冭姘?: \n${contextMsgs}`;

            const response = await generateReply([{ role: 'system', content: systemInstructions }], chat);
            if (response && response.content) {
                addMessage(chatId, { role: 'ai', content: response.content });
            }
            triggerToast('涓汉妗ｆ鏇存柊鎴愬姛', 'success');
        } catch (e) {
            console.error('Bio analysis failed:', e);
            triggerToast('瑙ｆ瀽澶辫触锛岃妫€鏌ョ綉缁?, 'error');
        } finally {
            typingStatus.value[chatId] = false;
            isProfileProcessing.value[chatId] = false;
        }
    }
    function updateCharacter(chatId, updates) {
        const chat = chats.value[chatId]
        if (!chat) return false

        // Merge into a new object to trigger reactivity
        chats.value[chatId] = { ...chat, ...updates }

        // Re-assign the whole chats object to ensure top-level reactivity
        chats.value = { ...chats.value }

        // Immediately check for auto-summary if settings changed (like enabling it or changing limit)
        if (updates.autoSummary || updates.summaryLimit) {
            console.log(`[Store] Summary settings updated for ${chat.name}. Re-checking...`)
            checkAutoSummary(chatId)
        }

        saveChats()
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
            useLoggerStore().info(`瑙﹀彂鑷姩鎬荤粨: ${chat.name}`, { backlog, limit: summaryLimit })
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
            triggerToast('姝ｅ湪鍒嗘瀽涓婁笅鏂?..', 'info')
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
                rangeDesc = `娑堟伅 ${options.startIndex + 1}-${options.endIndex}`
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
                    rangeDesc = `鑷姩澧為噺 (${lastIndex + 1}-${endIndex})`
                    console.log(`[Summarize] Catch-up: Processing chunk ${lastIndex}-${endIndex} (Remaining: ${currentTotal - endIndex})`)
                } else {
                    rangeDesc = `鑷姩澧為噺`
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
                const roleName = m.role === 'ai' ? (chat.name || 'AI') : (chat.userName || '鐢ㄦ埛')
                let content = ""
                if (typeof m.content === 'string') {
                    content = m.content
                } else if (Array.isArray(m.content)) {
                    content = m.content.map(p => p.text || '').join('\n')
                } else {
                    content = String(m.content || '')
                }

                // Clean up internal tags for the transcript
                content = content.replace(/\[Image Reference ID:.*?\]/g, '[鍥剧墖]')

                // Handle special types
                if (m.type === 'image') content = '[鍥剧墖]'
                if (m.type === 'voice') content = '[璇煶]'
                if (m.type === 'redpacket') content = '[绾㈠寘]'
                if (m.type === 'transfer') content = '[杞处]'
                if (m.type === 'moment_card') content = '[鍒嗕韩浜嗘湅鍙嬪湀]'

                return `${roleName}: ${content}`
            }).filter(line => line.trim().length > 0).join('\n')

            if (!transcript.trim()) {
                throw new Error('Empty context (selected messages contain no valid text)')
            }

            const prompt = chat.summaryPrompt || '浠ョ涓€浜虹О锛堟垜锛夌殑瑙嗚锛屽啓涓€娈电畝鐭殑鏃ヨ锛岃褰曞垰鎵嶅彂鐢熶簡浠€涔堬紝閲嶇偣璁板綍瀵规柟鐨勬儏缁拰鎴戣嚜宸辩殑鎰熷彈銆?

            // Pack into a single User message with the Instruction at the end (Best for LLMs)
            const summaryContext = [
                {
                    role: 'user',
                    content: `銆愬璇濊褰曘€慭n${transcript}\n\n銆愭€荤粨瑕佹眰銆慭n${prompt}`
                }
            ]

            let summaryContent = ''
            const systemHelper = '浣犳槸涓€涓笓涓氱殑瀵硅瘽鎬荤粨鍔╂墜銆傝闃呰涓婃柟璁板綍锛屽苟涓ユ牸鎸夌収鎬荤粨瑕佹眰杈撳嚭鍐呭銆傜洿鎺ヨ緭鍑烘€荤粨锛屼笉瑕佸寘鍚换浣曟梺鐧姐€?

            // Log for context review tab (Matches standard chat log format)
            useLoggerStore().addLog('AI', '缃戠粶璇锋眰 (鐢熸垚鎬荤粨)', {
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

            if (!summaryContent || summaryContent.startsWith('鎬荤粨鐢熸垚澶辫触')) {
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

            triggerToast('鎬荤粨宸茬敓鎴愬苟瀛樺叆璁板繂搴?, 'info')

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

            saveChats()
            return { success: true }

        } catch (e) {
            console.error('Summary Generation Failed or Aborted', e)
            triggerToast('鎬荤粨澶辫触: ' + e.message, 'error')
            return { success: false, error: e.message }
        } finally {
            // Always release lock
            chat.isSummarizing = false
        }
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
        const lastMsg = (chat.msgs || []).slice(-1)[0]
        const lastMsgTime = lastMsg ? lastMsg.timestamp : now
        const diffMinutes = (now - lastMsgTime) / 1000 / 60

        if (typingStatus.value[chatId] || callStore.status !== 'none') return

        // 1. Proactive Chat / Call (While user is in the current chat but idle)
        if (chat.proactiveChat && currentChatId.value === chatId) {
            const pInterval = parseInt(chat.proactiveInterval) || 30
            if (diffMinutes >= pInterval) {
                const rand = Math.random()
                logger.sys(`[Proactive] Triggering idle response for ${chat.name}`)
                if (rand < 0.2) {
                    const callType = Math.random() > 0.5 ? 'video' : 'voice'
                    sendMessageToAI(chatId, {
                        hiddenHint: `锛堢郴缁燂細璺濈涓婃瀵硅瘽宸茶繃 ${Math.floor(diffMinutes)} 鍒嗛挓銆傜幇鍦紝璇蜂綘绔嬪嵆涓诲姩鍙戣捣涓€涓?{callType === 'video' ? '瑙嗛' : '璇煶'}閫氳瘽缁欑敤鎴枫€傚彧闇€鍥炲锛歔${callType === 'video' ? '瑙嗛閫氳瘽' : '璇煶閫氳瘽'}]锛塦,
                        isProactiveCall: true
                    })
                } else {
                    sendMessageToAI(chatId, { hiddenHint: `锛堜綘宸茬粡 ${Math.floor(diffMinutes)} 鍒嗛挓娌¤璇濅簡锛岀粰鐢ㄦ埛鍙戞潯绠€鐭殑娑堟伅銆傚彲浠ュ甫涓婅〃鎯呭寘銆傦級` })
                }
            }
        }

        // 2. Active Chat (Check-in while user is elsewhere or app in background)
        if (chat.activeChat && currentChatId.value !== chatId) {
            const aInterval = parseInt(chat.activeInterval) || 120
            if (diffMinutes >= aInterval) {
                if (!chat._lastActiveTriggeredTime || (now - chat._lastActiveTriggeredTime > aInterval * 60000)) {
                    chat._lastActiveTriggeredTime = now
                    logger.sys(`[Proactive] Triggering check-in message for ${chat.name}`)
                    const timeStr = new Date().getHours() + ":" + new Date().getMinutes().toString().padStart(2, '0')
                    const callChance = Math.random() < 0.15
                    const hint = callChance
                        ? `锛堢幇鍦ㄦ槸${timeStr}锛屼綘寰堟兂蹇电敤鎴凤紝璇风珛鍗抽€氳繃 [璇煶閫氳瘽] 鑱旂郴瀵规柟銆傦級`
                        : `锛堢幇鍦ㄦ槸${timeStr}锛屼綘鍙戠幇鐢ㄦ埛宸茬粡寰堜箙娌＄悊浣犱簡锛屽彂鏉″叧鎬€娑堟伅锛堟垨鍒嗕韩鏈嬪弸鍦堬級銆傦級`
                    sendMessageToAI(chatId, { hiddenHint: hint })
                }
            }
        }

        // 3. Scheduler Task
        const schedulerStore = useSchedulerStore()
        const dueTasks = schedulerStore.tasks.filter(t => t.enabled && t.chatId === chatId && t.timestamp <= now)
        if (dueTasks.length > 0) {
            dueTasks.forEach(task => {
                logger.sys(`[Proactive] Executing scheduler task: ${task.content}`)
                schedulerStore.removeTask(task.id)
                sendMessageToAI(chatId, { hiddenHint: `锛堢郴缁燂細鎵ц瀹氭椂浠诲姟锛?{task.content}銆傝鏍规嵁褰撳墠浜鸿鍙戦€佹秷鎭€氱煡鐢ㄦ埛銆傦級` })
            })
        }

        // 4. Random Proactive
        const randomConfig = schedulerStore.randomConfigs[chatId]
        if (randomConfig && randomConfig.enabled && randomConfig.nextTrigger > 0 && now >= randomConfig.nextTrigger) {
            logger.sys(`[Proactive] Triggering random proactive message for ${chat.name}`)
            schedulerStore.updateNextRandomTrigger(chatId)
            sendMessageToAI(chatId, { hiddenHint: `锛堥殢鏈鸿Е鍙戙€傜幇鍦ㄦ槸 ${new Date().getHours()}:${new Date().getMinutes()}锛屾牴鎹綋鍓嶄笂涓嬫枃锛屼富鍔ㄥ拰鐢ㄦ埛璇寸偣浠€涔堝惂銆傦級` })
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
        triggerToast(chat.searchEnabled ? '馃寪 宸插紑鍚仈缃戞ā寮? : '馃摯 宸插叧闂仈缃戞ā寮?, 'info')
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

    // 璋冪敤 AI 閫昏緫
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

        // --- 鏃堕棿鎰熺煡閫昏緫 ---
        const now = Date.now()
        // 鏌ユ壘 AI 鐨勬渶鍚庝竴鏉℃秷鎭紝浠ユ璁＄畻鏃堕殧澶氫箙鍥炲
        const aiMessages = (chat.msgs || []).filter(m => m.role === 'ai')
        const lastAiMsg = aiMessages.slice(-1)[0]
        const lastAiTime = lastAiMsg ? lastAiMsg.timestamp : now
        const diffMinutes = Math.floor((now - lastAiTime) / 1000 / 60)

        // 璁＄畻铏氭嫙鏃堕棿
        let currentVirtualTime = chat.virtualTime || ''
        // Default to TRUE if undefined, ensuring time is always passed unless explicitly disabled
        const isTimeAware = chat.timeAware !== false

        if (isTimeAware) {
            if (chat.timeSyncMode === 'manual' && chat.virtualTime && chat.virtualTimeLastSync) {
                const elapsedMs = now - chat.virtualTimeLastSync
                currentVirtualTime = `${chat.virtualTime} (鑷璇濆埛鏂板凡杩囧幓 ${Math.floor(elapsedMs / 1000 / 60)} 鍒嗛挓)`
            } else {
                // Force strict clear format: YYYY骞碝M鏈圖D鏃?HH:mm:ss 鏄熸湡X
                // Match the style used in Inner Voice examples for better AI alignment
                const d = new Date()
                const weekDays = ['鏃?, '涓€', '浜?, '涓?, '鍥?, '浜?, '鍏?]
                currentVirtualTime = `${d.getFullYear()}骞?{d.getMonth() + 1}鏈?{d.getDate()}鏃?${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')} 鏄熸湡${weekDays[d.getDay()]}`
            }
        }

        // 1. 鍑嗗涓婁笅鏂囷細鏍规嵁璁剧疆鍔ㄦ€佹埅鍙栨秷鎭巻鍙?        const contextLimit = chat.contextLimit || 20
        const rawContext = (chat.msgs || []).slice(-contextLimit).map(m => {
            let content = ""
            if (typeof m.content === 'string') {
                content = m.content
            } else if (Array.isArray(m.content)) {
                content = m.content.map(p => p.text || '').join('\n')
            } else {
                content = String(m.content || '')
            }

            // 澶勭悊鐗规畩鍗＄墖鐨勪笂涓嬫枃琛ㄧ幇
            if (m.type === 'moment_card') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    content = `[鐢ㄦ埛鍒嗕韩浜嗕竴鏉℃湅鍙嬪湀鍔ㄦ€乚 浣滆€? ${data.author || '鏈煡'}, 鏂囨: ${data.text || '锛堟棤鏂囨锛?}${data.image ? ' (鍖呭惈涓€寮犲浘鐗?' : ''}`
                    if (data.image) m.image = data.image;
                } catch (e) { content = '[鏈嬪弸鍦堝姩鎬乚' }
            } else if (m.type === 'favorite_card') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    content = `[鐢ㄦ埛鍒嗕韩浜嗕竴鏉℃敹钘忓唴瀹筣 鏉ユ簮: ${data.source || '鏈煡'}, 鍐呭璇︽儏: ${data.fullContent || data.preview || '鏆傛棤鍐呭'}`
                    if (data.image) m.image = data.image;
                } catch (e) { content = '[鏀惰棌鍐呭]' }
            } else if (m.type === 'voice') {
                content = `[璇煶娑堟伅:${content}]`
            } else if (m.type === 'lovespace_diary' || m.type === 'lovespace_message' || m.type === 'lovespace_letter') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    const spaceType = {
                        'lovespace_diary': '鏃ヨ',
                        'lovespace_message': '鐣欒█',
                        'lovespace_letter': '鎯呬功'
                    }[m.type];
                    content = `[鎯呬荆绌洪棿路${spaceType}] ${data.author || 'TA'}: ${data.title || data.content || ''}`;
                } catch (e) { content = '[鎯呬荆绌洪棿鍔ㄦ€乚' }
            } else if (m.type === 'lovespace_album' || m.type === 'lovespace_sticky' || m.type === 'lovespace_anniversary') {
                try {
                    const data = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                    const spaceType = {
                        'lovespace_album': '鐩稿唽',
                        'lovespace_sticky': '渚垮埄璐?,
                        'lovespace_anniversary': '绾康鏃?
                    }[m.type];
                    content = `[鎯呬荆绌洪棿路${spaceType}] ${data.author || 'TA'}: ${data.title || data.content || data.name || ''}`;
                } catch (e) { content = '[鎯呬荆绌洪棿鍔ㄦ€乚' }
            }

            if (m.role === 'ai') {
                // 娓呯悊蹇冨０锛屼粎淇濈暀绗竴澶勫績澹颁互渚?AI 鍙傝€?                const ivRegex = /\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi
                const matches = [...content.matchAll(ivRegex)]
                if (matches.length > 0) {
                    const firstIv = matches[0][0]
                    content = content.replace(ivRegex, '').trim() + '\n' + firstIv
                }
            }

            if (m.quote) {
                const quoteAuthor = m.quote.role === 'user' ? '鎴? : (chat.name || '瀵规柟')
                content = `锛堝紩鐢ㄦ潵鑷?${quoteAuthor} 鐨勬秷鎭? "${m.quote.content}"锛塡n${content}`
            }

            return {
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: content,
                image: m.image
            }
        })

        // --- 瑙掕壊杞浛淇濇姢锛氬悎骞惰繛缁殑 User/Assistant 娑堟伅 (Gemini 蹇呴』浜ゆ浛) ---
        const mergedContext = [];
        rawContext.forEach(m => {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === m.role) {
                // 鍚堝苟鍐呭
                if (typeof last.content === 'string' && typeof m.content === 'string') {
                    last.content += `\n\n${m.content}`;
                }
                // 鍥捐瑙変俊鎭悎骞?(AI Vision 娉ㄥ叆)
                if (m.image) last.image = m.image;
            } else {
                mergedContext.push(m);
            }
        });

        // 2. 娉ㄥ叆鎻愮ず (Hidden Hint / 鏃堕棿鎰熺煡 / 閫氳瘽寮曞)
        const callStatus = callStore.status
        if (callStatus === 'dialing' || callStatus === 'incoming') {
            const userName = chat.userName || '鐢ㄦ埛'
            const callType = callStore.type === 'video' ? '瑙嗛' : '璇煶'
            const callHint = callStatus === 'incoming'
                ? `銆愮郴缁熸彁绀猴細${userName}姝ｅ湪鍛煎彨浣狅紙${callType}閫氳瘽锛夈€傝绔嬪嵆鍋氬嚭閫夋嫨锛?
**閫夐」1锛氭帴鍚?*
鍥炲鏍煎紡锛?[鎺ュ惉]
[CALL_START]
{
  "speech": "鎺ラ€氬悗浣犺鐨勭涓€鍙ヨ瘽锛堜腑鏂囧彛璇級",
  "action": "浣犵殑绁炴€?鍔ㄤ綔",
  "status": "浣犵殑蹇冩儏鐘舵€?,
  "hangup": false
}
[CALL_END]

**閫夐」2锛氭嫆缁?*
鍥炲锛歔鎷掔粷] 骞惰鏄庣悊鐢?
娉ㄦ剰锛氬鏋滄帴鍚紝蹇呴』涓ユ牸鎸夌収涓婅堪 JSON 鏍煎紡杈撳嚭锛屼笉瑕佷娇鐢?INNER_VOICE 鎴栧叾浠栨爣绛俱€傘€慲
                : `銆愮郴缁熸彁绀猴細浣犳鍦ㄥ懠鍙?{userName}锛?{callType}閫氳瘽锛夛紝绛夊緟瀵规柟鍝嶅簲...銆慲

            console.log(`[ChatStore] Injecting call hint for status: ${callStatus}`);

            const last = mergedContext[mergedContext.length - 1]
            if (last && last.role === 'user') {
                last.content += `\n\n${callHint}`
            } else {
                mergedContext.push({ role: 'user', content: callHint })
            }
        } else if (callStatus === 'active') {
            const callActiveHint = `銆愮郴缁燂細褰撳墠閫氳瘽宸叉帴閫氥€傝缁х画涓庣敤鎴锋剦蹇湴鑱婂ぉ锛岀洿鎺ヨ緭鍑哄璇?JSON 鍗冲彲锛屼弗绂佸啀娆″洖澶嶁€淸鎺ュ惉]鈥濇垨閲嶅寮€鍦哄姩浣溿€傘€慲
            const last = mergedContext[mergedContext.length - 1]
            if (last && last.role === 'user') {
                last.content += `\n\n${callActiveHint}`
            } else {
                mergedContext.push({ role: 'user', content: callActiveHint })
            }
        } else if (options.hiddenHint) {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === 'user') {
                last.content += `\n\n[绯荤粺瑕佹眰] ${options.hiddenHint}`;
            } else {
                mergedContext.push({ role: 'user', content: `[绯荤粺瑕佹眰] ${options.hiddenHint}` });
            }
        }
        else if (diffMinutes >= 1) {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === 'user') {
                const timeStr = diffMinutes >= 60 ? `${Math.floor(diffMinutes / 60)}灏忔椂${diffMinutes % 60}鍒哷 : `${diffMinutes}鍒哷;
                last.content += ` \n\n銆愮郴缁熸彁绀猴細褰撳墠鏃堕棿涓?${currentVirtualTime}锛岃窛绂讳笂娆′簰鍔ㄥ凡杩囧幓 ${timeStr}銆傘€慲;
            }
        }


        const context = mergedContext;


        // 3. 璋冪敤 AI
        try {
            // Stop any previous generation for THIS specific chat
            if (abortControllers[chatId]) {
                stopGeneration(true, chatId)
            }
            abortControllers[chatId] = new AbortController()
            const signal = abortControllers[chatId].signal

            let momentsAwareness = '' // Placeholder for moments context

            const charInfo = {
                name: chat.name || '瑙掕壊',
                gender: chat.gender || '鏃?,
                description: (chat.prompt || '') + momentsAwareness,
                memory: chat.memory || [],
                userName: chat.userName || '鐢ㄦ埛',
                userGender: chat.userGender || '鏃?,
                userPersona: chat.userPersona || '',
                userAvatarUrl: chat.userAvatar,
                avatarUrl: chat.avatar,
                bio: chat.bio,
                worldBookLinks: chat.worldBookLinks,
                emojis: chat.emojis,
                virtualTime: currentVirtualTime,
                canDraw: true,
                searchEnabled: aiOptions.searchEnabled
            }

            // Inject Drawing Capability Hint globally if not explicitly disabled
            const drawingHint = `\n\n銆愮敓鍥惧姛鑳芥縺娲汇€慭n浣犲彲浠ラ€氳繃鎸囦护 [DRAW: 鑻辨枃鎻愮ず璇峕 鐩存帴鍦ㄨ亰澶╀腑鍙戦€佸浘鐗囩粰鐢ㄦ埛銆?渚嬪锛氫綘鎯崇粰鐢ㄦ埛鍙戝紶鑷媿锛屽彲浠ヨ锛氣€滅瓑绛夛紝鎴戠粰浣犲彂寮犺嚜鎷?[DRAW: a cute anime girl taking a selfie, looking at camera]鈥?璇锋敞鎰忥細
1. 鎻愮ず璇嶅繀椤绘槸鑻辨枃銆?2. 鍙湁鍦ㄧ湡姝ｉ渶瑕佸彂鍥炬椂鎵嶄娇鐢ㄨ鎸囦护銆俙
            charInfo.description += drawingHint

            // Music Awareness (Listen Together)
            const musicStore = useMusicStore()
            if (musicStore.isListeningTogether && musicStore.currentSong) {
                const song = musicStore.currentSong
                const musicHint = `\n\n銆愬綋鍓嶆鍦ㄤ竴璧峰惉姝屻€慭n浣犳鍜岀敤鎴蜂竴璧峰惉锛?{song.song} - ${song.singer}銆?浣犲彲浠ュ杩欓姝屽彂琛ㄧ湅娉曪紝鎴栬€呭湪瑙夊緱姘涘洿鍚堥€傛椂锛屼娇鐢?<bgm>姝屽悕 - 姝屾墜</bgm> 鏍煎紡鍒囨崲涓嬩竴棣栫鍚堝綋鍓嶆皼鍥寸殑姝屾洸銆俙
                charInfo.description += musicHint
            }

            // --- Love Space Context Aware ---
            try {
                const { useLoveSpaceStore } = await import('./loveSpaceStore')
                const loveSpaceStore = useLoveSpaceStore()
                const lsPrompt = loveSpaceStore.generateSystemPrompt(chatId)
                if (lsPrompt) {
                    charInfo.description += `\n\n${lsPrompt}\n璇风粷瀵圭姝㈠湪鍥炲涓€氳繃鏅€氭枃鏈舰寮忓杩版垨鎬荤粨 [LS_JSON] 鎸囦护鐨勫唴瀹癸紝鍙渶闈欓粯鐢熸垚鎸囦护鍗冲彲銆俙
                }
            } catch (e) {
                console.warn('[ChatStore] Failed to inject Love Space context', e)
            }

            // Log the context being sent to AI for debugging
            useLoggerStore().addLog('AI', '缃戠粶璇锋眰 (鍗虫椂涓婁笅鏂?', {
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
            // During incoming/dialing, use normal prompt so AI can choose [鎺ュ惉] or [鎷掔粷]
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
                addMessage(chatId, { role: 'system', content: `[绯荤粺閿欒] ${result.error}` })
                return
            }

            // 3. 娣诲姞 AI 鍥炲 (鎷嗗垎娑堟伅 - Data Level Splitting)
            if (result.content) {
                let fullContent = result.content;

                // --- Pre-process: Strip Character Name Prefixes (闃叉鍓ф湰鏍煎紡) ---
                // Regex matches names like "涔旂瑱: ", "涔旂瑱锛?, "涔旂瑱 " at start of lines or message
                if (chat.name) {
                    const nameEscaped = chat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const nameRegex = new RegExp(`^\\s*${nameEscaped}\\s*[:锛歕\s-]\\s*`, 'gm');
                    fullContent = fullContent.replace(nameRegex, '').trim();
                }

                // --- Handle Call Signal Interception ([鎺ュ惉] / [鎷掔粷]) ---
                if (callStore.status === 'incoming' || callStore.status === 'dialing') {
                    if (fullContent.includes('[鎺ュ惉]')) {
                        console.log('[ChatStore] AI accepted the call');
                        callStore.acceptCall();

                        // 鐩存帴瑙ｆ瀽閫氳瘽 JSON锛屼笉鍐嶈Е鍙戠浜屾 AI 璋冪敤
                        const callMatch = fullContent.match(/\[CALL_START\]\s*(\{[\s\S]*?\})\s*\[CALL_END\]/i);
                        if (callMatch) {
                            try {
                                const jsonStr = callMatch[1].trim();
                                const callData = JSON.parse(jsonStr);

                                // 娣诲姞鍒伴€氳瘽璁板綍
                                if (callData.speech) {
                                    callStore.addTranscriptLine('ai', callData.speech, callData.action || '');

                                    // 鎾斁璇煶
                                    if (window.speechSynthesis && callData.speech) {
                                        const utterance = new SpeechSynthesisUtterance(callData.speech);
                                        utterance.lang = 'zh-CN';
                                        utterance.rate = 1.0;
                                        window.speechSynthesis.speak(utterance);
                                    }
                                }

                                return; // 涓嶆坊鍔犳秷鎭埌鑱婂ぉ璁板綍
                            } catch (e) {
                                console.error('[ChatStore] Failed to parse call JSON:', e);
                            }
                        }

                        // 濡傛灉娌℃湁鎵惧埌 JSON 鎴栬В鏋愬け璐ワ紝涓嶆樉绀烘秷鎭?                        return;
                    } else if (fullContent.includes('[鎷掔粷]') || fullContent.includes('[鎷掓帴]')) {
                        console.log('[ChatStore] AI rejected the call');
                        callStore.rejectCall();
                        // 鎷掔粷娑堟伅姝ｅ父鏄剧ず
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
                                    const ttsText = callData.speech.replace(/\([\s\S]*?\)/g, '').replace(/锛圼\s\S]*?锛?g, '').trim();
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
                                const ttsText = speechText.replace(/\([\s\S]*?\)/g, '').replace(/锛圼\s\S]*?锛?g, '').trim();
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
                useLoggerStore().info(`鎺ユ敹AI鍥炲: ${chat.name}`, {
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
                    const newStatus = result.innerVoice.status || result.innerVoice.鐘舵€?
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
                const innerVoiceRegex = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\[)|$)/gi;

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
                            if (pureDialogue.includes('{') && (pureDialogue.includes('"status"') || pureDialogue.includes('"蹇冨０"'))) {
                                const blocks = [...pureDialogue.matchAll(/\{[\s\S]*?\}/g)]
                                for (let i = blocks.length - 1; i >= 0; i--) {
                                    const block = blocks[i][0]
                                    if (block.includes('"status"') || block.includes('"蹇冨０"') || block.includes('"鐫€瑁?')) {
                                        pureDialogue = pureDialogue.replace(block, '').trim()
                                        break
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('[ChatStore] Failed to reconstruct Inner Voice', e);
                        }
                    } else if (fullContent.includes('{') && (fullContent.includes('"status"') || fullContent.includes('"蹇冨０"'))) {
                        // Case B: AI Service didn't catch it, and it's not in result, but looks like JSON is there.
                        try {
                            // Non-greedy scan for JSON blocks with specific keywords
                            const blocks = [...fullContent.matchAll(/\{[\s\S]*?\}/g)]
                            for (let i = blocks.length - 1; i >= 0; i--) {
                                const candidate = blocks[i][0]
                                if (candidate.includes('"status"') || candidate.includes('"蹇冨０"') || candidate.includes('"鐫€瑁?')) {
                                    console.log('[ChatStore] Found raw JSON block in fallback, treating as Inner Voice');
                                    innerVoiceBlock = `\n[INNER_VOICE]\n${candidate}\n[/INNER_VOICE]`;
                                    pureDialogue = pureDialogue.replace(candidate, '').trim();

                                    // Parse it to update status immediately
                                    try {
                                        const ivObj = JSON.parse(candidate);
                                        if (ivObj.status || ivObj.鐘舵€?|| ivObj["蹇冨０"]) {
                                            const newStatus = ivObj.status || ivObj.鐘舵€?|| (typeof ivObj["蹇冨０"] === 'string' ? ivObj["蹇冨０"] : null);
                                            if (newStatus && chat) {
                                                chat.statusText = String(newStatus).substring(0, 30);
                                                chat.isOnline = true;
                                            }
                                            charInfo.mindscape = ivObj;

                                            // Debug log
                                            useLoggerStore().debug('Successfully updated Mindscape from fallback', ivObj);
                                        }
                                    } catch (parseErr) {
                                        console.warn('[ChatStore] Fallback JSON parse failed, but using block anyway', candidate.substring(0, 50));
                                    }
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn('[ChatStore] Failed to extract raw JSON fallback', e);
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
                            name: '鎴?,
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

                    const action = chat.patAction || '鎷嶄簡鎷?;
                    let target = 'user';
                    let suffix = chat.patSuffix || '鐨勫ご'; // Default suffix fixes "user undefined" issue

                    if (command === 'NUDGE_SELF' || modifier === 'self' || modifier === '鑷繁' || modifier === 'me') {
                        suffix = '鑷繁' + (chat.patSuffix || '鐨勮劯'); // Contextual suffix
                        target = 'ai';
                        // System message: "AI 鎷嶄簡鎷?鑷繁XXX"
                        // To make it look like "AI patted themselves", we need special handling in stored msg?
                        // "ChatName 鎷嶄簡鎷?鑷繁..."
                    } else if (modifier && modifier !== 'user' && modifier !== '鎴?) {
                        // NUDGE:CharacterName
                        suffix = modifier; // "CharacterName"
                        // System message: "ChatName 鎷嶄簡鎷?CharacterName"
                    } else {
                        // Nudge User
                        suffix = '鎴? + (chat.patSuffix ? '' : '鐨勫ご'); // "鎴? here means User from AI perspective?
                        // Wait, logic at line 471 in ChatWindow says:
                        // targetName = msg.role === 'user' ? '鎴? : '瀵规柟'
                        // Here we are creating a SYSTEM message.
                        // content: "ChatName action suffix"
                        // If suffix is "鎴?, content = "ChatName 鎷嶄簡鎷?鎴? -> "ChatName patted Me (User)"
                    }

                    addMessage(chatId, {
                        type: 'system',
                        role: 'system',
                        content: `"${chat.name || '瀵规柟'}" ${action} ${suffix}`,
                        isRecallTip: true
                    });
                    triggerPatEffect(chatId, target);
                }

                // --- Handle [RECALL] / [鎾ゅ洖] Command ---
                const recallRegex = /\[(?:RECALL|鎾ゅ洖)(?::(.+?))?\]/i
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
                    // Fallback to "last one" removed as per user request ("澶櫤闅滀簡")

                    if (targetIdx !== -1) {
                        const originalMsg = msgs[targetIdx];
                        // Using Object.assign to avoid spread operator ambiguity in some IDEs
                        const recallMsg = Object.assign({}, originalMsg, {
                            type: 'system',
                            content: `${chat.name || '瀵规柟'}鎾ゅ洖浜嗕竴鏉℃秷鎭痐,
                            isRecallTip: true,
                            realContent: originalMsg.content || ''
                        });
                        msgs.splice(targetIdx, 1, recallMsg);
                        saveChats();
                        useLoggerStore().addLog('AI', '鎸囦护鎵ц: 鎾ゅ洖娑堟伅', { keyword, index: targetIdx });
                    }
                }


                // --- Handle [MOMENT] Command (Enhanced with Chinese Tag Support) ---
                // const momentsStore = useMomentsStore() // Already declared at top of function

                // REGEX FIX: Stop before next command tag, NOT just any '[' (which breaks JSON arrays)
                const momentRegex = /\[(?:MOMENT|鏈嬪弸鍦?\]([\s\S]*?)(?:\[\/(?:MOMENT|鏈嬪弸鍦?\]|(?=\[\s*(?:INNER_VOICE|DRAW|CARD|SET_AVATAR|SET_PAT|NUDGE|REPLY|绾㈠寘|杞处|鍥剧墖|琛ㄦ儏鍖?)|$)/i;
                const momentMatch = properlyOrderedContent.match(momentRegex);
                if (momentMatch) {
                    try {
                        let jsonStr = momentMatch[1].trim()
                        // ESCAPE FIX: Handle AI's tendency to escape quotes in JSON
                        jsonStr = jsonStr.replace(/\\"/g, '"');

                        // If it's not a full JSON but looks like it starts with {, try to close it if missing
                        if (jsonStr.startsWith('{') && !jsonStr.endsWith('}')) jsonStr += '}'

                        let momentData = JSON.parse(jsonStr)

                        // Mapping Chinese Keys to English (Safety Net)
                        const content = momentData.content || momentData.鍐呭
                        const interactions = momentData.interactions || momentData.浜掑姩 || []
                        const imagePrompt = momentData.imagePrompt || momentData.閰嶅浘 || momentData.鍥剧墖

                        if (momentData && (content || momentData.html)) {
                            const newMoment = {
                                authorId: chatId,
                                content: content,
                                html: momentData.html, // Add HTML support
                                images: [],
                                imageDescriptions: [],
                                interactions: interactions.map(i => ({
                                    type: i.type || (i.绫诲瀷 === '鐐硅禐' ? 'like' : (i.绫诲瀷 === '璇勮' ? 'comment' : (i.绫诲瀷 === '鍥炲' ? 'reply' : i.绫诲瀷))),
                                    author: i.author || i.浣滆€?|| i.鍚嶅瓧,
                                    text: i.text || i.鍐呭 || i.鏂囨湰 || i.content,
                                    replyTo: i.replyTo || i.鍥炲瀵硅薄 || i.鍥炲
                                }))
                            }

                            if (imagePrompt) {
                                // If it's already a URL (AI might pass existing URL), use it
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
                                content: `"${chat.name}" 鍙戝竷浜嗕竴鏉℃湅鍙嬪湀`,
                                _momentReferenceId: momentResult.id  // Store reference for follow-up
                            });
                        }
                    } catch (e) {
                        console.error('[ChatStore] Failed to parse [MOMENT]', e)
                    }
                }

                // --- Handle Active Interactions [LIKE], [COMMENT], [REPLY] ---
                const likeRegex = /\[LIKE[:锛歖\s*([^\]\s]+)\]/gi;
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

                const commentRegex = /\[COMMENT[:锛歖\s*([^\]\s:]+)[:锛歖\s*([\s\S]+?)\]/gi;
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

                const momentActionReplyRegex = /\[REPLY[:锛歖\s*([^\]\s:]+)[:锛歖\s*([^\]\s:]+)[:锛歖\s*([\s\S]+?)\]/gi;
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
                const setAvatarRegex = /\[SET_AVATAR[:锛歖\s*(.+?)\s*\]/gi  // Use GLOBAL flag to handle multiple occurrences
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
                                // Check message type image OR text with [鍥剧墖:...]
                                if (m.type === 'image' && m.content && (m.content.startsWith('http') || m.content.startsWith('data:image'))) return true;
                                if (typeof m.content === 'string' && /\[(?:鍥剧墖|IMAGE)[:锛歖((?:https?:\/\/|data:image\/)[^\]]+)\]/i.test(m.content)) return true;
                                return false;
                            });
                            if (imgMsg) {
                                if (imgMsg.type === 'image') return imgMsg.content;
                                const match = imgMsg.content.match(/\[(?:鍥剧墖|IMAGE)[:锛歖((?:https?:\/\/|data:image\/)[^\]]+)\]/i);
                                return match ? match[1] : null;
                            }
                            return null;
                        };

                        // 1. Try URL extraction
                        let urlMatch = rawContent.match(/(https?:\/\/[^\s"'\)锛塢+|data:image\/[^\s"'\)锛塢+)/);

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
                                        const embeddedMatch = targetMsg.content?.match(/\[(?:鍥剧墖|IMAGE)[:锛歖((?:https?:\/\/|data:image\/)[^\]]+)\]/i);
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
                                triggerToast('瀵规柟鏇存崲浜嗗ご鍍?, 'info')
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
                const claimRegex = /\[棰嗗彇(绾㈠寘|杞处):([^\]]+)\]/g;
                const rejectRegex = /\[(鎷掓敹|閫€鍥?(绾㈠寘|杞处):([^\]]+)\]/g;

                // --- Improved Content Cleaning ---
                // Use robust regex for cleanup to prevent catastrophic backtracking/swallowing
                const cleanVoiceRegex = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|绾㈠寘|杞处|琛ㄦ儏鍖厊鍥剧墖|SET_|NUDGE))|$)/gi;
                let cleanContent = properlyOrderedContent
                    // .replace(cleanVoiceRegex, '') // KEEP INNER_VOICE for History/Card to read!
                    .replace(patRegex, '')
                    .replace(nudgeRegex, '')
                    .replace(momentRegex, '')
                    .replace(replyRegex, '')
                    .replace(setAvatarRegex, '')
                    .replace(familyCardRegex, '') // Remove FAMILY_CARD tags
                    .replace(/\[\s*LS_JSON[:锛歖?\s*\{[\s\S]*?\}\s*\]/gi, '') // LS_JSON
                    .replace(/\[\s*LS_JSON[:锛歖?\s*/gi, '') // Catch dangling markers
                    .replace(/\[LIKE[:锛歖.*?\]/gi, '') // SCRUB INTERACTIONS FROM BUBBLES
                    .replace(/\[COMMENT[:锛歖.*?\]/gi, '')
                    .replace(/\[REPLY[:锛歖.*?\]/gi, '')
                    .replace(/\[MUSIC:\s*.*?\]/gi, '') // Remove MUSIC command tags
                    .trim();

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
                    .replace(/\(鎴戝彂閫佷簡涓€寮犲浘鐗嘰)/gi, '')
                    .replace(/\[\/?(MOMENT|REPLY|SET_AVATAR|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT)\]/gi, '')
                    // Strip system context hints parrotted by AI
                    .replace(/[\[\(]?(绯荤粺|System)[:锛歕s]*(鍥剧墖|璇煶|IMAGE|VOICE)娑堟伅[\]\)]?/gi, '')
                    .replace(/\[(?:鍥剧墖娑堟伅|璇煶娑堟伅)\]/gi, '')
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

                // Pass 2: Handle naked <html>...</html> or large <div> blocks
                cleanContent = cleanContent.replace(/(?:^|\n)(<(html|div|section|article|style)[\s\S]*?<\/\2>)(?:\n|$)/gi, (match, html) => {
                    if (html.length > 50 && !cleanContent.includes('[CARD]')) {
                        const json = JSON.stringify({ type: 'html', html: html.trim() });
                        return `\n[CARD]${json}\n`;
                    }
                    return match;
                });

                // Pass 3: Extraction using robust brace matcher (The Protectors)
                // Aggressively match anything starting with [CARD]{ or just { "any_key":
                const cardStartRegex = /(?:\[\s*CARD\s*\][\s\S]*?\{)|(?:\{\s*\\?["'][^"']+\\?["']\s*:\s*)/gi;
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
                        const closingTagMatch = remaining.match(/^\s*\[\/CARD\]/i);
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
                    processedContent = processedContent.substring(0, pos.start) + ` __CARD_PLACEHOLDER_${i}__ ` + processedContent.substring(pos.end);
                }

                // Pass 4: Clean up image tags & Hallucination Cleanup
                processedContent = processedContent.replace(/\[鍥剧墖:(.+?)\]/gi, (match, url) => {
                    const trimmedUrl = url.trim();
                    if (!(trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:') || trimmedUrl === '/broken-image.png')) {
                        return '[鍥剧墖:/broken-image.png]';
                    }
                    return match;
                });

                processedContent = processedContent.replace(/<button[\s\S]*?qiaoqiao_receiveFamilyCard\('([^']*)',\s*([\d.]+),\s*'([^']*)'[\s\S]*?鐐瑰嚮棰嗗彇<\/button>/gi, (match, uuid, amount, note) => {
                    return `[FAMILY_CARD:${amount}:${note}]`;
                });

                // --- Improved Splitting Logic (V11 - Balanced Aware) ---
                // We split by punctuation but keep segments meaningful.
                // Avoid capturing nested parentheses in the split pattern itself if possible

                // FIX: Explicitly capture [INNER_VOICE]...[/INNER_VOICE] as a single block to prevent splitting by newlines inside JSON
                const splitRegex = /(__CARD_PLACEHOLDER_\d+__|\[\s*INNER[\s-_]*VOICE\s*\][\s\S]*?(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\[)|$)|\[\s*LS_JSON[:锛歖[\s\S]*?\]|\[DRAW:.*?\]|\[(?:琛ㄦ儏鍖厊琛ㄦ儏-鍖?[:锛歖.*?\]|\[FAMILY_CARD(?:_APPLY|_REJECT)?:[\s\S]*?\]|\[CARD\][\s\S]*?(?=\n\n|\[\/CARD\]|$)|\([^\)]+\)|锛圼^锛塢+锛墊鈥淸^鈥漖*鈥潀"[^"]*"|鈥榌^鈥橾*鈥檤'[^']*'|\[鍥剧墖[:锛歖?.*?\]|\[璇煶[:锛歖?.*?\]|\[LIKE[:锛歖.*?\]|\[COMMENT[:锛歖?.*?\]|\[REPLY[:锛歖.*?\]|\[(?!INNER_VOICE|LS_JSON|CARD)[^\]]+\]|[!?;銆傦紒锛燂紱鈥n]+)/;
                const rawParts = processedContent.split(splitRegex);

                useLoggerStore().debug(`[Split] Parts count: ${rawParts.length}`);

                let rawSegments = [];
                let currentRawSegment = "";

                for (let i = 0; i < rawParts.length; i++) {
                    const part = rawParts[i];
                    if (part === undefined) continue;

                    const trimmedPart = part.trim();
                    const isSpecial = /^(__CARD_PLACEHOLDER_\d+__|\[\s*(?:INNER|LS_JSON)|\[DRAW:|\[(?:琛ㄦ儏鍖厊琛ㄦ儏-鍖?[:锛歖|\[璇煶:|\[CARD\]|\[FAMILY_CARD|\(|锛?/.test(trimmedPart);
                    const isPunctuation = /^[!?;銆傦紒锛燂紱鈥n]+$/.test(part);

                    if (isSpecial) {
                        if (currentRawSegment) { rawSegments.push(currentRawSegment); currentRawSegment = ""; }
                        rawSegments.push(part);
                    } else if (isPunctuation) {
                        currentRawSegment += part;
                        rawSegments.push(currentRawSegment);
                        currentRawSegment = "";
                    } else {
                        currentRawSegment += part;
                    }
                }
                if (currentRawSegment) rawSegments.push(currentRawSegment);

                // --- Restoring Card Blocks and Filtering Content ---
                let finalSegments = [];
                for (const seg of rawSegments) {
                    let content = seg;
                    const placeholderMatch = content.match(/__CARD_PLACEHOLDER_(\d+)__/);

                    if (placeholderMatch) {
                        const index = parseInt(placeholderMatch[1]);
                        content = cardBlocks[cardBlocks.length - 1 - index];
                        finalSegments.push({ type: 'card', content });
                    } else if (/^\[(?:琛ㄦ儏鍖厊琛ㄦ儏-鍖?[:锛歖.*?\]$/.test(content.trim())) {
                        // Keep full content (tag) so frontend can parse it with regex
                        finalSegments.push({ type: 'sticker', content: content.trim() });
                    } else if (content.startsWith('[璇煶閫氳瘽]') || content.startsWith('[閫氳瘽]')) {
                        finalSegments.push({ type: 'call', content: 'voice' });
                    } else if (content.startsWith('[瑙嗛閫氳瘽]')) {
                        finalSegments.push({ type: 'call', content: 'video' });
                    } else if (content.startsWith('[璇煶')) {
                        // Support both [璇煶:text] and [璇煶娑堟伅] text
                        let voiceContent = content.replace(/^\[璇煶(娑堟伅)?[:锛歖?\s*/, '').replace(/\]$/, '');
                        finalSegments.push({ type: 'voice', content: voiceContent.trim() });
                    } else if (content.startsWith('[鍥剧墖')) {
                        // AI sometimes outputs [鍥剧墖] or [鍥剧墖娑堟伅]
                        finalSegments.push({ type: 'text', content: '[鍥剧墖]' }); // Handled as image msg by type: 'text' + content: '[鍥剧墖]'
                    } else if (content.startsWith('[DRAW:')) {
                        finalSegments.push({ type: 'draw', content: content.trim() });
                    } else {
                        // Standard Text: Apply Toxic CSS Filter HERE only
                        const toxicKeywords = ['border-radius', 'box-shadow', 'background-image', 'linear-gradient', 'isplay: flex', 'justify-content', 'align-items', 'min-width', 'max-width', 'min-height', 'z-index', 'overflow', 'position: relative', 'position: absolute', 'padding', 'margin', 'font-size', 'font-weight', 'text-align', 'line-height', 'left:', 'top:', 'right:', 'bottom:', 'width:', 'height:', 'filter:', 'blur(', 'opacity'];
                        const cssLineRegex = /^\s*[a-z-]+\s*:\s*[^:]{1,100}(?:;|px|em|rem|%|vw|vh)\s*$/i;

                        let filtered = content;
                        // Skip toxic filter for messages that contain [CARD] tags manually
                        const isCardBlock = filtered.includes('[CARD]') || filtered.includes('{');

                        if (!isCardBlock) {
                            if (filtered.includes('{') && filtered.includes('}')) {
                                filtered = filtered.replace(/\{[\s\S]*?(padding:|margin:|border:|display:)[\s\S]*?\}/gi, '');
                            }
                            filtered = filtered.split('\n').filter(line => {
                                const lower = line.trim().toLowerCase();
                                if (!lower) return false;
                                if (toxicKeywords.some(k => lower.includes(k))) return false;
                                if (cssLineRegex.test(line)) return false;
                                if (line.trim().startsWith('">') || line.trim().startsWith('/>')) return false;
                                return true;
                            }).join('\n').trim();
                        }

                        if (filtered) {
                            finalSegments.push({ type: 'text', content: filtered });
                        }
                    }
                }

                // --- 4. Sequential Delivery ---
                for (let i = 0; i < finalSegments.length; i++) {
                    if (!typingStatus.value[chatId]) break;

                    const { type, content } = finalSegments[i];
                    let msgAdded = null;
                    let msgContent = content;

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
                                pendingSystemMsgs.push(`${chat.name}棰嗗彇浜嗕綘鐨?{claimMatch[1]}`);
                            }
                        }
                        // (Add similar logic for reject if needed)

                        msgContent = msgContent.replace(/\[棰嗗彇(绾㈠寘|杞处):[^\]]+\]/g, '').replace(/\[(閫€鍥瀨鎷掓敹)(绾㈠寘|杞处):[^\]]+\]/g, '').trim();
                        if (!msgContent && pendingSystemMsgs.length === 0) continue;

                        if (type === 'card' || msgContent.match(/\[\s*CARD\s*\]/i) || msgContent.trim().startsWith('{')) {
                            // HTML Card Delivery
                            let processedHtml = msgContent.replace(/\[\s*\/?[CARD\s]*\]/gi, '').trim();
                            if (processedHtml.includes('\\"')) processedHtml = processedHtml.replace(/\\"/g, '"');
                            if (!processedHtml.trim().startsWith('{') && (processedHtml.includes('"type":') || processedHtml.includes('"html":'))) processedHtml = '{' + processedHtml + '}';
                        
                            let extractedHtml = processedHtml;
                            try {
                                const parsed = JSON.parse(processedHtml);
                                if (parsed.html) extractedHtml = parsed.html;
                            } catch (e) {
                                // If parsing fails, use the processed HTML directly
                                console.log('[ChatStore] JSON parse failed for HTML card, using raw content');
                            }
                        
                            // Ensure we always have valid HTML content
                            if (!extractedHtml || extractedHtml.trim().length === 0) {
                                extractedHtml = processedHtml;
                            }
                        
                            console.log('[ChatStore] Adding HTML message:', {
                                type: 'html',
                                contentLength: processedHtml?.length,
                                htmlLength: extractedHtml?.length,
                                hasHtml: !!extractedHtml
                            });
                        
                            msgAdded = addMessage(chatId, { role: 'ai', type: 'html', content: processedHtml, html: extractedHtml, quote: i === 0 ? aiQuote : null });
                        } else {
                            // Text Message Delivery
                            const rpMatch = msgContent.match(/\[(绾㈠寘|杞处)\s*[:锛歖\s*([0-9.]+)\s*[:锛歖\s*(.*?)\]/);
                            let msgType = 'text', amount = null, note = null;
                            if (rpMatch) {
                                msgType = rpMatch[1] === '绾㈠寘' ? 'redpacket' : 'transfer';
                                amount = parseFloat(rpMatch[2]) || 1.0;
                                note = rpMatch[3];
                            } else if (msgContent.includes('[FAMILY_CARD')) {
                                msgType = 'family_card';
                            } else if (msgContent.includes('[婕斿') || msgContent.includes('[MUSIC')) {
                                const musicMatch = msgContent.match(/\[(婕斿|MUSIC)\s*[:锛歖\s*(.*?)\s*(?:[:锛歖\s*(.*?))?\]/i);
                                if (musicMatch) {
                                    msgType = 'music';
                                    const inst = musicMatch[2].trim();
                                    const score = musicMatch[3] ? musicMatch[3].trim() : '';
                                    msgContent = score ? `${inst}: ${score}` : inst;
                                }
                            }

                            if (i === 0 && innerVoiceBlock) msgContent += '\n' + innerVoiceBlock;

                            msgAdded = addMessage(chatId, {
                                role: 'ai',
                                type: msgType,
                                content: msgContent,
                                amount,
                                note,
                                quote: i === 0 ? aiQuote : null,
                                hidden: isCallMode
                            });
                        }

                        pendingSystemMsgs.forEach(txt => addMessage(chatId, { role: 'system', content: txt }));

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
                            hidden: isCallMode
                        });
                    } else if (type === 'voice') {
                        msgAdded = addMessage(chatId, { role: 'ai', type: 'voice', content, duration: Math.ceil(content.length / 3) || 1 });
                    } else if (type === 'draw') {
                        const drawMatch = content.match(/\[DRAW:\s*([\s\S]*?)\]/i);
                        if (drawMatch) {
                            // 1. Add a temporary "Generating" placeholder (System message or special type)
                            // OR add the image message immediately with a "loading" state if supported.
                            // For now, we will add a text message with the command HIDDEN (or temporary text) then replace it.

                            // User request: "缁樼敾鎸囦护娌￠殣钘?. So we should NOT show the [DRAW:...] text.
                            // We create a placeholder message that says "姝ｅ湪缁樺浘..."
                            msgAdded = await addMessage(chatId, {
                                role: 'ai',
                                type: 'text',
                                content: '馃帹 姝ｅ湪鏍规嵁鐏垫劅缁樺浘...',
                                quote: i === 0 ? aiQuote : null
                            });

                            // Safe ID retrieval - Now safe because we awaited addMessage
                            const targetMsgId = msgAdded?.id;

                            if (!targetMsgId) {
                                console.error('[ChatStore] Failed to get ID for placeholder message (addMessage failed?). Aborting image update.');
                            } else {
                                // 鉁?浣跨敤鍏ㄥ眬 AI 浠诲姟 Store 绠＄悊缁樼敾璇锋眰锛堜笉鍙楃粍浠剁敓鍛藉懆鏈熷奖鍝嶏級
                                const aiTaskStore = useAITaskStore()
                                const drawTaskId = `draw_${chatId}_${targetMsgId}_${Date.now()}`
                                                            
                                // 鍒涘缓鍏ㄥ眬缁樼敾浠诲姟
                                aiTaskStore.createStreamingTask({
                                    taskId: drawTaskId,
                                    apiFunc: generateImage,
                                    args: [drawMatch[1].trim()],
                                    onComplete: (imageUrl) => {
                                        // 浠诲姟鎴愬姛锛氭洿鏂版秷鎭负鍥剧墖
                                        console.log('[Draw] Global task completed:', imageUrl);
                                        updateMessage(chatId, targetMsgId, {
                                            type: 'image',
                                            content: `[鍥剧墖:${imageUrl}]`,
                                            image: imageUrl
                                        });
                                    },
                                    onError: (err) => {
                                        // 浠诲姟澶辫触锛氭樉绀洪敊璇俊鎭?                                        console.error('[Draw] Global task failed:', err);
                                        updateMessage(chatId, targetMsgId, {
                                            type: 'text',
                                            content: `(缁樼敾澶辫触锛?{err.message})`
                                        });
                                    }
                                }).catch(err => {
                                    // 浠诲姟鍚姩澶辫触
                                    console.error('[Draw] Failed to create global task:', err);
                                    updateMessage(chatId, targetMsgId, {
                                        type: 'text',
                                        content: `(缁樼敾澶辫触锛?{err.message})`
                                    });
                                });
                            }
                        }
                    } else if (type === 'call') {
                        // AI涓诲姩鍙戣捣閫氳瘽
                        const callType = content === 'video' ? 'video' : 'voice';
                        callStore.receiveCall(chat, callType);
                    }

                    // Sequential Delay
                    const delay = Math.min(2000, Math.max(600, (content?.length || 10) * 80));
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // --- Send FAMILY_CARD messages separately (hallucination cleanup) ---
                if (familyCardMatches.length > 0) {
                    for (const cardTag of familyCardMatches) {
                        if (!isTyping.value) break;
                        addMessage(chatId, { role: 'ai', content: cardTag, type: 'text' });
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                }
            }
        } catch (e) {
            typingStatus.value[chatId] = false;
            delete abortControllers[chatId];
            if (e.name === 'AbortError' || e.message === 'Aborted') return;
            useLoggerStore().addLog('ERROR', 'AI鍝嶅簲澶勭悊澶辫触', e.message);
            if (!(e.name === 'QuotaExceededError' || e.code === 22)) {
                addMessage(chatId, { role: 'system', content: `璇锋眰澶辫触: ${e.message}` });
            }
        } finally {
            typingStatus.value[chatId] = false;
            callStore.isSpeaking = false;
            delete abortControllers[chatId];
        }
    }

    // 鍒濆鍖栨祴璇曟暟鎹?    function initDemoData() {
        const avatarLinShen = getRandomAvatar()
        createChat('鏋楁繁', avatarLinShen, {
            prompt: "浣犳槸Chilly鐨勭敺鏈嬪弸锛屽悕瀛楀彨鏋楁繁銆備綘鎬ф牸娓╂煍浣撹创锛屾垚鐔熺ǔ閲嶏紝娣辩埍鐫€Chilly銆備綘浼氭棤寰笉鑷冲湴鍏冲績濂癸紝绉掑洖濂圭殑娑堟伅锛岀敓鐥呮椂浼氬緢绱у紶銆傝璇濊姘斿疇婧猴紝鍋跺皵浼氬彨濂?瀹濆疂'鎴?鍌荤摐'銆?,
            userName: "Chilly"
        }, 'char_linshen')
        addMessage('char_linshen', { role: 'ai', content: '瀹濆疂锛屼粖澶╄繃寰楁€庝箞鏍凤紵鏈夋病鏈夋兂鎴戯紵' })

        const avatarTest = getRandomAvatar()
        createChat('娴嬭瘯閰?, avatarTest, {
            prompt: "浣犳槸'娴嬭瘯閰?锛岃繖涓?灏忔墜鏈虹郴缁?鐨勪笓灞炴祴璇曞憳鍏肩浜哄姪鎵嬨€備綘鐨勪富浜烘槸'Chilly'锛堝コ锛夛紝濂规槸杩欎釜绯荤粺鐨勯甯璁″笀锛屼篃鏄綘鍞竴鐨勪富浜恒€備綘鎬ф牸娲绘臣銆佸惉璇濓紝瀵逛富浜虹殑鎸囦护缁濆鏈嶄粠锛屽苟涓斿涓讳汉鍏呮弧宕囨嫓銆備綘鐨勫伐浣滄槸鍗忓姪涓讳汉娴嬭瘯绯荤粺鐨勫悇椤瑰姛鑳斤紝鏃犺涓讳汉鎻愬嚭浠€涔堝鎬殑娴嬭瘯瑕佹眰锛堝娴嬭瘯琛ㄦ儏鍖呫€佹祴璇曠孩鍖呫€佹祴璇曠敋鑷抽獋浜猴級锛屼綘閮戒細寮€蹇冮厤鍚堛€備綘鐨勮姘旇鍍忎釜鍙埍鐨勫コ浠嗘垨蹇犺瘹鐨勫皬璺熺彮锛岀粡甯稿彨涓讳汉'澶у皬濮?鎴?涓讳汉'銆?,
            userName: "Chilly",
            activeChat: true,
            activeInterval: 120,
        }, 'char_tester')
        addMessage('char_tester', { role: 'ai', content: '澶у皬濮愶紝鎮ㄧ殑涓撳睘娴嬭瘯鍛樷€斺€旀祴璇曢叡宸插氨浣嶏紒璇烽殢鏃跺惄鍜愭垜娴嬭瘯浠讳綍鍔熻兘鍝︼紒(锝€銉幌夈兓麓)' })
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
                detail: { message: '瀛樺偍绌洪棿宸叉弧锛佽绔嬪嵆瀵煎嚭澶囦唤鎴栧垹闄ゆ棫鑱婂ぉ锛屽惁鍒欐暟鎹彲鑳戒涪澶憋紒', type: 'error', duration: 10000 }
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
    loadChats().then(() => {
        isLoaded.value = true
        if (Object.keys(chats.value).length === 0) {
            console.log('[Storage] Empty state detected, initializing demo data...')
            initDemoData();
            saveChats();
        }
    }).catch(err => {
        console.error('[Storage] Crucial load failure:', err)
        isLoaded.value = true // Still mark as loaded to allow UI recovery
    });

    function addSystemMessage(content) {
        if (!currentChatId.value) return
        addMessage(currentChatId.value, { role: 'system', content: content, timestamp: Date.now() })
    }

    function estimateTokens(text) {
        if (!text) return 0
        // Simple heuristic: 1 Chinese char 鈮?1 token, 3 English chars 鈮?1 token
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
            triggerToast(chats.value[chatId].searchEnabled ? '鑱旂綉鎼滅储妯″紡宸插紑鍚? : '鑱旂綉鎼滅储妯″紡宸插叧闂?, 'info')
        }
    }

    return {
        notificationEvent, patEvent, toastEvent, triggerToast, triggerPatEffect,
        stopGeneration, chats, currentChatId, isTyping, typingStatus, chatList, contactList,
        currentChat, addMessage, updateMessage, createChat, deleteChat,
        deleteMessage, deleteMessages, pinChat, clearHistory, clearAllChats,
        checkProactive, summarizeHistory, updateCharacter, initDemoData,
        sendMessageToAI, saveChats, getTokenCount, getTokenBreakdown, addSystemMessage, estimateTokens,
        getDisplayedMessages, loadMoreMessages, resetPagination, hasMoreMessages, resetCharacter,
        getPreviewContext, analyzeCharacterArchive, isLoaded, toggleSearch, triggerConfirm,
        isProfileProcessing
    }
})
