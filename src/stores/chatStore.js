import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { generateReply, generateSummary, generateImage, generateContextPreview } from '../utils/aiService'
import { useLoggerStore } from './loggerStore'
import { useWorldBookStore } from './worldBookStore'
import { useMomentsStore } from './momentsStore'
import { useSettingsStore } from './settingsStore'
import { useMusicStore } from './musicStore'
import { useSchedulerStore } from './schedulerStore'
import { useCallStore } from './callStore'
import { SYSTEM_PROMPT_TEMPLATE, CALL_SYSTEM_PROMPT_TEMPLATE, GROUP_MEMBER_GENERATOR_PROMPT } from '../utils/ai/prompts'
import { processTaskCommands } from '../utils/taskUtils'
import { processBioUpdate } from '../utils/bioUtils'
import localforage from 'localforage'
import { setupFinancialLogic } from './chatModules/chatFinancial'
import { setupGroupLogic } from './chatModules/chatGroup'
import { setupHistoryLogic } from './chatModules/chatHistory'
import { setupProactiveLogic } from './chatModules/chatProactive'
import { setupVoteLogic } from './chatModules/chatVote'

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
    const typingStatus = ref({}) // { chatId: boolean }
    const isProfileProcessing = ref({}) // track if a specific character's archive is being analyzed
    const pendingRequests = ref([]) // { id, type: 'group_invite'|'friend_request', fromId, fromName, fromAvatar, targetId, targetName, targetAvatar, timestamp }
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

    // MODULE EXTRACTS
    const { _splitRedPacket, claimRedPacket, claimTransfer, claimGift, hasUnclaimedRP } = setupFinancialLogic(chats, addMessage, saveChats)

    const _extractJsonFromText = (text) => {
        if (!text) return null
        const s = String(text).trim()
        const fenceMatch = s.match(/```json\s*([\s\S]*?)```/i) || s.match(/```\s*([\s\S]*?)```/i)
        const raw = (fenceMatch ? fenceMatch[1].trim() : s).trim()
        const arrStart = raw.indexOf('[')
        const arrEnd = raw.lastIndexOf(']')
        if (arrStart !== -1 && arrEnd > arrStart) return raw.substring(arrStart, arrEnd + 1)
        const objStart = raw.indexOf('{')
        const objEnd = raw.lastIndexOf('}')
        if (objStart !== -1 && objEnd > objStart) return raw.substring(objStart, objEnd + 1)
        return null
    }

    const { _deriveGroupNoFromChatId, _ensureGroupDefaults, createGroupChat, updateGroupProfile, updateGroupSettings, updateGroupParticipants, generateGroupMembers, transferGroupOwner, setParticipantRole, setParticipantTitle, muteParticipant, exitGroup, dissolveGroup } = setupGroupLogic(chats, createChat, addMessage, saveChats, getRandomAvatar, sendMessageToAI, _extractJsonFromText)
    const { summarizeHistory, checkAutoSummary, analyzeCharacterArchive, searchHistory, toggleSearch } = setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats)
    const { startProactiveLoop, checkProactive } = setupProactiveLogic(chats, currentChatId, typingStatus, sendMessageToAI)
    const { createVote, castVote, endVote } = setupVoteLogic(chats, addMessage, updateMessage, saveChats)

    // Initialize module loops
    startProactiveLoop()

    // Auto-end votes timer
    setInterval(() => {
        Object.values(chats.value).forEach(chat => {
            if (!chat.msgs) return
            chat.msgs.forEach(msg => {
                if (msg.type === 'vote') {
                    try {
                        const v = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
                        if (v && v.deadline && !v.isEnded && Date.now() > v.deadline) {
                            endVote(chat.id, msg.id)
                        }
                    } catch (e) {
                        // ignore malformed vote data
                    }
                }
            })
        })
    }, 30000) // Check every 30 seconds


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
        }).filter(c => {
            // Filter out items not in chat list and dissolved groups
            if (c.inChatList === false) return false
            if (c.isDissolved) return false
            return true
        }).sort((a, b) => {
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
        })).filter(c => {
            // Filter out dissolved groups and items explicitly removed from chat list
            if (c.isDissolved) return false
            if (c.inChatList === false) return false
            return true
        }).sort((a, b) => {
            // Sort contacts alphabetically or by pinyin
            return (a.name || '').localeCompare(b.name || '', 'zh-CN')
        })
    })

    const groupNpcs = computed(() => {
        const npcs = []
        Object.values(chats.value).forEach(chat => {
            if (chat.isGroup && Array.isArray(chat.participants)) {
                chat.participants.forEach(p => {
                    if (p.isNPC) {
                        npcs.push({
                            ...p,
                            groupId: chat.id,
                            groupName: chat.name
                        })
                    }
                })
            }
        })
        return npcs
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

    function getRandomAvatar() {
        const styles = ['notionists', 'avataaars', 'bottts', 'adventurer', 'open-peeps']
        const style = styles[Math.floor(Math.random() * styles.length)]
        const seed = Math.random().toString(36).substring(7)
        return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`
    }

    // Actions
    function createChat(name, options = {}) {
        const chatId = options.id || 'c-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)

        if (!chats.value[chatId]) {
            const newChat = {
                ...options,
                id: chatId,
                name,
                avatar: options.avatar || getRandomAvatar(),
                userAvatar: options.userAvatar || (useSettingsStore().personalization?.userProfile?.avatar) || `https://api.dicebear.com/7.x/open-peeps/svg?seed=Me&face=smile,cute`,
                remark: options.remark || '',
                prompt: options.prompt || '你是一个友好的人。',
                msgs: options.msgs || [],
                isPinned: options.isPinned || false,
                unreadCount: options.unreadCount || 0,
                inChatList: options.inChatList !== false,
                tags: options.tags || [],
                // Settings with defaults
                activeChat: options.activeChat || false,
                autoSummary: options.autoSummary || false,
                autoTTS: options.autoTTS || false,
                showInnerVoice: options.showInnerVoice !== false,
                // Group Chat / World Loop Extensions
                isGroup: options.isGroup || false,
                participants: options.participants || [],
                groupProfile: options.groupProfile || null,
                groupSettings: options.groupSettings || null,
                loopId: options.loopId || null,
                systemRole: options.systemRole || null,
                // Bio / Profile logic
                bio: {
                    gender: options.gender || '未知',
                    age: options.age || '未知',
                    hobbies: [],
                    routine: { awake: '未知', busy: '未知', deep: '未知' },
                    ...options.bio
                }
            }
            chats.value[chatId] = newChat
            saveChats()
            return newChat
        }
        return chats.value[chatId]
    }









    function processTaskCommands(content, chatId) {
        if (!content || typeof content !== 'string') return content;
        // [MISSION: taskId: status]
        const missionRegex = /\[MISSION\s*:\s*([^:]+)\s*:\s*([^\]]+)\]/gi;
        let match;
        const missions = [];
        while ((match = missionRegex.exec(content)) !== null) {
            missions.push({ id: match[1].trim(), status: match[2].trim() });
        }

        if (missions.length > 0) {
            const settingsStore = useSettingsStore();
            missions.forEach(m => {
                console.log(`[AICmd] Processing Mission: ${m.id} Status: ${m.status}`);
                // Handle mission status updates if needed
            });
            return content.replace(missionRegex, '').trim();
        }
        return content;
    }

    function processBioUpdate(content, chatId) {
        if (!content || typeof content !== 'string') return content;
        // [BIO: key: value]
        const bioRegex = /\[BIO\s*:\s*([^:]+)\s*:\s*([^\]]+)\]/gi;
        let match;
        const updates = {};
        while ((match = bioRegex.exec(content)) !== null) {
            const key = match[1].trim();
            const val = match[2].trim();
            updates[key] = val;
        }

        if (Object.keys(updates).length > 0) {
            const chat = chats.value[chatId];
            if (chat) {
                if (!chat.bio) chat.bio = {};
                Object.entries(updates).forEach(([k, v]) => {
                    chat.bio[k] = v;
                });
                saveChats();
            }
            return content.replace(bioRegex, '').trim();
        }
        return content;
    }

    function calculateMemberLevel(activity) {
        // Simple formula: floor(sqrt(activity / 2)) + 1, max 100
        return Math.min(100, Math.floor(Math.sqrt((activity || 0) / 2)) + 1)
    }

    function getMemberTitle(chatId, participantId) {
        const chat = chats.value[chatId]
        if (!chat || !chat.isGroup || !chat.groupSettings) return ''

        let activity = 0
        let customTitle = ''
        let role = 'member'
        if (participantId === 'user') {
            activity = chat.groupSettings.myActivity || 0
            customTitle = chat.groupSettings.myCustomTitle || ''
            role = chat.groupSettings.myRole || 'member'
        } else {
            const p = chat.participants.find(p => p.id === participantId)
            if (p) {
                activity = p.activity || 0
                customTitle = p.customTitle || ''
                role = p.role || 'member'
            }
        }

        const lv = calculateMemberLevel(activity)
        let baseTitle = ''

        if (role === 'owner') baseTitle = customTitle || '群主'
        else if (role === 'admin') baseTitle = customTitle || '管理员'
        else {
            if (customTitle) baseTitle = customTitle
            else {
                const titles = chat.groupSettings.levelTitles || ['潜水', '冒泡', '吐槽', '活跃', '话痨', '传说']
                let tierIdx = 0
                if (lv >= 81) tierIdx = 5
                else if (lv >= 51) tierIdx = 4
                else if (lv >= 31) tierIdx = 3
                else if (lv >= 16) tierIdx = 2
                else if (lv >= 6) tierIdx = 1
                baseTitle = titles[tierIdx]
            }
        }

        return `LV${lv} ${baseTitle}`
    }

    async function addMessage(chatId, msg) {
        const chat = chats.value[chatId]
        if (!chat) return false

        // Update Activity for Group Members
        if (chat.isGroup && chat.groupSettings) {
            // Daily Reset Check
            const now = new Date();
            const todayStr = now.toDateString();
            const lastResetStr = chat.groupSettings.lastDailyReset ? new Date(chat.groupSettings.lastDailyReset).toDateString() : '';

            if (todayStr !== lastResetStr) {
                chat.groupSettings.myDailyActivity = 0;
                if (Array.isArray(chat.participants)) {
                    chat.participants.forEach(p => {
                        p.dailyActivity = 0;
                    });
                }
                chat.groupSettings.lastDailyReset = now.getTime();
            }

            const sId = msg.role === 'user' ? 'user' : (msg.senderId || chatId);
            if (sId === 'user') {
                chat.groupSettings.myActivity = (chat.groupSettings.myActivity || 0) + 1;
                chat.groupSettings.myDailyActivity = (chat.groupSettings.myDailyActivity || 0) + 1;
            } else {
                const p = chat.participants.find(p => p.id === sId);
                if (p) {
                    p.activity = (p.activity || 0) + 1;
                    p.dailyActivity = (p.dailyActivity || 0) + 1;
                }
            }
        }

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

        // EARLY FILTER: Reject JSON fragment messages (头尾碎片过滤)
        if (msg.content && typeof msg.content === 'string') {
            const trimmed = msg.content.trim();

            console.log('[addMessage] Checking:', JSON.stringify(trimmed));

            // Filter header fragment: EXACT match for { "type": "html", "html": "
            // Use regex to match the exact JSON wrapper pattern, not just keywords
            const headerPattern = /^\{\s*["']type["']\s*:\s*["']html["']\s*,\s*["']html["']\s*:\s*["']\s*$/;
            if (headerPattern.test(trimmed)) {
                console.log('[ChatStore] ✅ Rejected header fragment');
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
            id: msg.id || crypto.randomUUID(),
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
            // DICE fields
            diceResults: msg.diceResults || null,
            diceTotal: msg.diceTotal || null,
            diceCount: msg.diceCount || null,
            // TAROT fields
            tarotCards: msg.tarotCards || null,
            tarotQuestion: msg.tarotQuestion || null,
            tarotSpread: msg.tarotSpread || null,
            tarotInterpretation: msg.tarotInterpretation || null
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

        // 1.2 Initialize payment specific fields
        if (newMsg.type === 'redpacket') {
            newMsg.count = msg.count || 1
            newMsg.remainingCount = msg.remainingCount !== undefined ? msg.remainingCount : newMsg.count
            newMsg.claims = msg.claims || []
            newMsg.packetType = msg.packetType || 'lucky' // 'lucky' or 'fixed'

            // Critical: Initialize the distribution amounts if not present
            if (!newMsg.amounts || newMsg.amounts.length === 0) {
                const total = parseFloat(newMsg.amount) || 0
                const count = parseInt(newMsg.count) || 1
                if (newMsg.packetType === 'lucky') {
                    newMsg.amounts = _splitRedPacket(total, count)
                } else {
                    newMsg.amounts = Array(count).fill(total)
                }
            }
        } else if (newMsg.type === 'transfer') {
            newMsg.isClaimed = msg.isClaimed || false
            newMsg.targetId = msg.targetId || null
        } else if (newMsg.type === 'gift') {
            newMsg.status = msg.status || 'pending'
            newMsg.giftId = msg.giftId || null
            newMsg.giftName = msg.giftName || ''
            newMsg.giftQuantity = msg.giftQuantity || 1
            newMsg.giftNote = msg.giftNote || ''
            newMsg.giftImage = msg.giftImage || ''
            newMsg.senderName = msg.senderName || ''
            newMsg.claimedBy = msg.claimedBy || null
            newMsg.claimTime = msg.claimTime || null
        } else if (newMsg.type === 'gift_claimed') {
            newMsg.giftId = msg.giftId || null
            newMsg.giftName = msg.giftName || ''
            newMsg.giftQuantity = msg.giftQuantity || 1
            newMsg.giftNote = msg.giftNote || ''
            newMsg.giftImage = msg.giftImage || ''
            newMsg.originalSender = msg.originalSender || ''
            newMsg.claimantName = msg.claimantName || ''
            newMsg.claimantAvatar = msg.claimantAvatar || ''
            newMsg.claimTime = msg.claimTime || null
            newMsg.senderName = msg.senderName || ''
        }

        // 1.3 Rewrite content to canonical format [类型:金额:备注:ID] for AI context
        if (newMsg.type === 'redpacket' && newMsg.paymentId) {
            newMsg.content = `[红包:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
        } else if (newMsg.type === 'transfer' && newMsg.paymentId) {
            newMsg.content = `[转账:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
        }

        // 1.3 JSON Command Parsing (For Debugging/User Manual Input)
        if (newMsg.type === 'text' && typeof newMsg.content === 'string') {
            const content = newMsg.content.trim();
            // Look for any JSON-like structure that has "type":"html" or similar keywords
            const suspectedHtml = (content.includes('"type"') && content.includes('"html"')) || (content.includes('<div') && content.includes('{'));

            if (suspectedHtml) {
                try {
                    // ROBUST REGEX: Handles escaped quotes and multi-line content
                    const robustHtmlRegex = /["']html["']\s*[:：]\s*["']((?:[^"\\]|\\.|[\r\n])*?)["']/;
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
            const tagMatch = detectionContent.match(/^[\[【](发红包|红包|转账|图片|表情包|DRAW|语音|演奏|MUSIC|VIDEO|FILE|LOCATION|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT)\s*[:：]\s*([^:：\]】]+)(?:\s*[:：]\s*([^:：\]】]+))?(?:\s*[:：]\s*([^\]】]+))?[\]】]$/i)

            if (tagMatch) {
                const tagType = tagMatch[1]
                const val1 = tagMatch[2].trim()
                const val2 = (tagMatch[3] || '').trim()
                const val3 = (tagMatch[4] || '').trim()

                if (/^(发红包|红包)$/.test(tagType)) {
                    newMsg.type = 'redpacket'
                    newMsg.amount = parseFloat(val1) || 0
                    newMsg.note = val2 || '恭喜发财，大吉大利'
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    // Rewrite content with ID for AI context
                    newMsg.content = `[红包:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
                } else if (tagType === '转账') {
                    newMsg.type = 'transfer'
                    // Support both [转账:amount:note] and [转账:targetId:amount:note]
                    const firstIsNumber = /^[0-9]/.test(val1)
                    if (firstIsNumber) {
                        // Format: [转账:amount:note]
                        newMsg.amount = parseFloat(val1) || 0
                        newMsg.note = val2 || '转账给您'
                    } else {
                        // Format: [转账:targetId:amount:note]
                        newMsg.targetId = val1
                        newMsg.amount = parseFloat(val2) || 0
                        newMsg.note = val3 || '转账给您'
                    }
                    newMsg.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    newMsg.content = `[转账:${newMsg.amount}:${newMsg.note}:${newMsg.paymentId}]`
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
                } else if (tagType.includes('FAMILY_CARD')) {
                    newMsg.type = 'family_card'
                }
            } else {
                // 2.1b Dice Roll interception (AI randomly generated by system)
                const diceMatch = detectionContent.match(/^[\[【]摇骰子(?:[:：]\s*(\d+))?[\]】]$/i);
                if (diceMatch) {
                    newMsg.type = 'dice_result';
                    newMsg.content = '[摇骰子]';
                    let count = parseInt(diceMatch[1], 10) || 1;
                    if (count < 1) count = 1;
                    // Max 9 dice
                    if (count > 9) count = 9;
                    newMsg.diceCount = count;
                    newMsg.diceResults = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
                    newMsg.diceTotal = newMsg.diceResults.reduce((a, b) => a + b, 0);
                }

                // 2.2 Group Management Commands (NEW)
                const groupCmdMatch = detectionContent.match(/^[\[【](创建群聊|设置管理员|修改头衔|修改群名|邀请成员|设置群昵称)\s*[:：]\s*([^:：\]】]+)(?:\s*[:：]\s*([^:：\]】]+))?(?:\s*[:：]\s*([^\]】]+))?[\]】]$/i)
                if (groupCmdMatch) {
                    const cmd = groupCmdMatch[1]
                    const val1 = groupCmdMatch[2]?.trim()
                    const val2 = groupCmdMatch[3]?.trim()
                    const val3 = groupCmdMatch[4]?.trim()

                    if (cmd === '创建群聊') {
                        // [创建群聊:群名:头像:成员ID列表]
                        const name = val1
                        const avatar = val2
                        const ids = (val3 || '').split(/[,，]/).map(i => i.trim()).filter(i => i)
                        if (name && ids.length > 0) {
                            const participants = ids.map(id => {
                                const contact = chats.value[id]
                                return {
                                    id: id,
                                    name: contact?.name || '未知',
                                    avatar: contact?.avatar || getRandomAvatar(),
                                    role: 'member'
                                }
                            }).filter(p => p.id !== 'user')

                            const newGroup = createGroupChat({
                                name,
                                participants,
                                ownerId: newMsg.charId || newMsg.roleId || 'user'
                            })
                            if (avatar && avatar.startsWith('http')) {
                                updateGroupProfile(newGroup.id, { avatar })
                            }
                            newMsg.type = 'system'
                            newMsg.content = `[系统] 已成功创建群聊 "${name}"`
                            triggerToast('群聊创建成功', 'success')
                        }
                    } else if (cmd === '修改群名' && currentChat.value?.isGroup) {
                        updateGroupProfile(chatId, { groupName: val1 })
                        newMsg.type = 'system'
                        newMsg.content = `[系统] 群名已修改为 "${val1}"`
                        triggerToast('群名已修改', 'success')
                    } else if (cmd === '邀请成员' && currentChat.value?.isGroup) {
                        const ids = val1.split(/[,，]/).map(i => i.trim()).filter(i => i)
                        const toAdd = ids.map(id => {
                            const contact = chats.value[id]
                            return { id, name: contact?.name || '未知', avatar: contact?.avatar || getRandomAvatar(), role: 'member' }
                        })
                        updateGroupParticipants(chatId, [...(currentChat.value.participants || []), ...toAdd])
                        triggerToast('已邀请新成员', 'success')
                        newMsg.type = 'system'
                        newMsg.content = `[系统] 已邀请 ${toAdd.length} 名新成员`
                    } else if (cmd === '设置管理员' && currentChat.value?.isGroup) {
                        const targetId = val1
                        const isSet = val2 === 'true'
                        setParticipantRole(chatId, targetId, isSet ? 'admin' : 'member')
                        triggerToast(isSet ? '已设为管理员' : '已取消管理员', 'info')
                        newMsg.type = 'system'
                        newMsg.content = `[系统] 已将角色 ${targetId} ${isSet ? '设为' : '取消'}管理员`
                    } else if (cmd === '修改头衔' && currentChat.value?.isGroup) {
                        const targetId = val1
                        const title = val2
                        setParticipantTitle(chatId, targetId, title)
                        triggerToast('群头衔已更新', 'info')
                        newMsg.type = 'system'
                        newMsg.content = `[系统] 已将 ${targetId} 的头衔修改为 "${title}"`
                    }
                }

                // 2.1 Fallback: Loose Parsing for User Inputs
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
        if (newMsg.role === 'ai' && (newMsg.content.includes('[MOMENT_SHARE') || newMsg.content.includes('[分享朋友圈'))) {
            const shareRegex = /\[(?:MOMENT_SHARE|分享朋友圈)(?::\s*([\s\S]*?))?\]/i;
            const match = newMsg.content.match(shareRegex);

            if (match) {
                let shareContent = (match[1] || '').trim();
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
                        text: shareContent || '分享了一条朋友圈',
                        author: chat.name,
                        image: chat.avatar // Fallback image
                    };
                }

                // Ensure essential fields
                if (!momentData.id) momentData.id = crypto.randomUUID();
                if (!momentData.author) momentData.author = chat.name;
                if (!momentData.avatar) momentData.avatar = chat.avatar;

                // Save original text content for display
                const originalText = newMsg.content.replace(shareRegex, '').trim();
                if (originalText) {
                    momentData.originalText = originalText;
                }

                // Convert to Card Message
                newMsg.type = 'moment_card';
                newMsg.content = JSON.stringify(momentData); // Store structured data
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

            // 3.3 Group Command Parsing (AI or User with tags)
            if (typeof newMsg.content === 'string' && (newMsg.content.includes('[创建群聊') || newMsg.content.includes('[CREATE_GROUP'))) {
                const createGroupRegex = /\[(?:创建群聊|CREATE_GROUP)\s*[:：]\s*([^:：\]]+)\s*[:：]\s*([^:：\]]*)\s*[:：]?\s*([^\]]*?)\]/gi;
                let cgMatch;
                while ((cgMatch = createGroupRegex.exec(newMsg.content)) !== null) {
                    const groupName = cgMatch[1].trim();
                    const groupAvatar = cgMatch[2].trim();
                    const membersStr = cgMatch[3] || '';

                    // Parse members
                    const memberNames = membersStr.split(/[，,]+/).map(s => s.trim()).filter(s => s);
                    const participants = [];

                    // Add the creator
                    participants.push({
                        id: 'me',
                        name: settingsStore.personalization?.userProfile?.name || '我',
                        role: 'owner',
                        nickname: settingsStore.personalization?.userProfile?.name || '我'
                    });

                    if (newMsg.role === 'ai') {
                        participants.push({
                            id: chat.id,
                            name: chat.name,
                            role: 'admin',
                            nickname: chat.name
                        });
                    }

                    memberNames.forEach(name => {
                        const found = Object.values(chats.value).find(c => c.name === name);
                        if (found && found.id !== chat.id) {
                            participants.push({
                                id: found.id,
                                name: found.name,
                                role: 'member',
                                nickname: found.name
                            });
                        }
                    });

                    // Execute creation
                    const newChat = createGroupChat(groupName, participants);
                    if (groupAvatar) {
                        updateGroupProfile(newChat.id, { avatar: groupAvatar });
                    }
                    addMessage(newChat.id, {
                        role: 'system',
                        content: `${newMsg.role === 'ai' ? chat.name : '你'} 创建了群聊`,
                        type: 'system'
                    });
                }
            }

            // 3.4 Group Management Commands (AI Only, must be in a group chat)
            if (newMsg.role === 'ai' && chat.isGroup) {
                const setAdminRegex = /\[(?:设置管理员|SET_ADMIN)\s*[:：]\s*([^\]]+)\]/gi;
                let adminMatch;
                while ((adminMatch = setAdminRegex.exec(newMsg.content)) !== null) {
                    const targetName = adminMatch[1].trim();
                    const target = chat.participants.find(p => p.name === targetName || p.nickname === targetName);
                    if (target) {
                        setParticipantRole(chat.id, target.id, 'admin');
                    }
                }

                const setTitleRegex = /\[(?:设置头衔|SET_TITLE)\s*[:：]\s*([^:：\]]+)\s*[:：]\s*([^\]]+)\]/gi;
                let titleMatch;
                while ((titleMatch = setTitleRegex.exec(newMsg.content)) !== null) {
                    const targetName = titleMatch[1].trim();
                    const newTitle = titleMatch[2].trim();
                    const target = chat.participants.find(p => p.name === targetName || p.nickname === targetName);
                    if (target) {
                        setParticipantTitle(chat.id, target.id, newTitle);
                    }
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
                // This allows auto-accepting when AI starts talking during dialing
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
                // Tag stripping patterns for checking if bubble will be empty
                const protocolTags = [
                    /\{[\s\S]*?("speech"|"status"|"action"|"转发"|"心声"|"行为")[\s\S]*?\}/gi,
                    /\[CALL_START\][\s\S]*?\[CALL_END\]/gi, /\[CALL_START\]|\[CALL_END\]/gi,
                    /\[语音通话\]|\[视频通话\]|\[接听\]|\[挂断\]|\[拒绝\]/gi,
                    /\[(?:UPDATE_)?BIO:[^\]]+\]/gi,
                    /\[MOMENT_SHARE:[^\]]+\]|\[分享朋友圈:[^\]]+\]/gi,
                    /\[一起听歌:[^\]]+\]|\[停止听歌\]|<bgm>[\s\S]*?<\/bgm>/gi,
                    /\[领取红包:[^\]]+\]|\[领取转账:[^\]]+\]/gi,
                    /\[LIKE[:：].*?\]/gi, /\[COMMENT[:：].*?\]/gi, /\[REPLY[:：].*?\]/gi,
                    /\[INNER_VOICE\][\s\S]*?\[\/INNER_VOICE\]/gi
                ];

                let displayTest = content;
                let isEmptyDisplay = false;
                try {
                    protocolTags.forEach(p => { displayTest = displayTest.replace(p, ''); });
                    isEmptyDisplay = displayTest.trim().length === 0;
                } catch (e) {
                    console.error('[ChatStore] Error processing display test:', e);
                    isEmptyDisplay = true;
                }

                // EXCLUSION: Don't add if it's strictly a protocol tag that got through display test
                if (!isEmptyDisplay) {
                    const cleanText = displayTest;
                    // For calls, ensure we don't have redundant name prefixes inside the bubble content 
                    // if it was already split or hallucinated by AI
                    const nameEscaped = chat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const nameRegex = new RegExp(`^\\s*${nameEscaped}\\s*[:：\\s-]\\s*`, 'i');
                    const finalCleanText = cleanText.replace(nameRegex, '').trim();

                    if (finalCleanText) {
                        // DISABLED: No longer adding split segments to call transcript to support 'Large Bubble' mode
                        // callStore.addTranscriptLine('ai', finalCleanText);
                    }
                }
            }

            // --- Final context & Hiding Check ---
            // Tag stripping patterns for checking if bubble will be empty
            let displayTest = content;
            let isEmptyDisplay = false;
            const protocolTags = [
                /\{[\s\S]*?("speech"|"status"|"action"|"转发"|"心声"|"行为")[\s\S]*?\}/gi,
                /\[CALL_START\][\s\S]*?\[CALL_END\]/gi, /\[CALL_START\]|\[CALL_END\]/gi,
                /\[语音通话\]|\[视频通话\]|\[接听\]|\[挂断\]|\[拒绝\]/gi,
                /\[(?:UPDATE_)?BIO:[^\]]+\]/gi,
                /\[MOMENT_SHARE:[^\]]+\]|\[分享朋友圈:[^\]]+\]/gi,
                /\[一起听歌:[^\]]+\]|\[停止听歌\]|<bgm>[\s\S]*?<\/bgm>/gi,
                /\[领取红包:[^\]]+\]|\[领取转账:[^\]]+\]/gi,
                /\[LIKE[:：].*?\]/gi, /\[COMMENT[:：].*?\]/gi, /\[REPLY[:：].*?\]/gi,
                /\[INNER_VOICE\][\s\S]*?\[\/INNER_VOICE\]/gi
            ];
            try {
                protocolTags.forEach(p => { displayTest = displayTest.replace(p, ''); });
                isEmptyDisplay = displayTest.trim().length === 0;
            } catch (e) {
                console.error('[ChatStore] Error processing final display test:', e);
                isEmptyDisplay = true;
            }

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

        // Handle special message types based on content (Financial & Gift Commands)
        if (newMsg.role === 'user' && typeof newMsg.content === 'string') {
            const content = newMsg.content.trim();

            // 1. Red Packet
            const rpMatch = content.match(/^\[红包\s*[:：]\s*(lucky|fixed|手气|固定)?\s*[:：]?\s*([0-9.]+)\s*[:：]\s*(\d+)\s*[:：]?\s*(.*?)\]$/i);
            if (rpMatch) {
                const typeRaw = (rpMatch[1] || 'lucky').toLowerCase();
                const isLucky = typeRaw.includes('lucky') || typeRaw.includes('手气');
                const amount = parseFloat(rpMatch[2]) || 1.0;
                const count = parseInt(rpMatch[3]) || 1;
                const note = rpMatch[4] || '恭喜发财，大吉大利';

                const walletStore = useWalletStore();
                if (walletStore.decreaseBalance(amount, `发送红包: ${note}`)) {
                    newMsg.type = 'redpacket';
                    newMsg.amount = amount;
                    newMsg.note = note;
                    newMsg.packetType = isLucky ? 'lucky' : 'fixed';
                    newMsg.totalAmount = amount;
                    newMsg.count = count;
                    newMsg.remainingCount = count;
                    newMsg.claims = [];
                    newMsg.amounts = isLucky ? _splitRedPacket(amount, count) : Array(count).fill(Math.floor((amount / count) * 100) / 100);
                } else {
                    triggerToast('余额不足，无法发送红包', 'error');
                    return false;
                }
            }
            // 2. Transfer
            const tfMatch = content.match(/^\[(转账|TRANSFER)\s*[:：]\s*([^:：\s\]]+)\s*[:：]\s*([0-9.]+)\s*[:：]?\s*(.*?)\]$/i);
            if (tfMatch) {
                const targetId = tfMatch[2].trim();
                const amount = parseFloat(tfMatch[3]) || 0.01;
                const note = tfMatch[4] || '转账给您';

                const walletStore = useWalletStore();
                if (walletStore.decreaseBalance(amount, `转账: ${note}`)) {
                    newMsg.type = 'transfer';
                    newMsg.targetId = targetId;
                    newMsg.amount = amount;
                    newMsg.note = note;
                    newMsg.isClaimed = false;
                } else {
                    triggerToast('余额不足，无法转账', 'error');
                    return false;
                }
            }
            // 3. User GIFT Command
            const giftMatch = content.match(/^\[GIFT\s*[:：]\s*([^:：\]]+)(?:\s*[:：]?\s*(\d*))?(?:\s*[:：]?\s*([^\]]*))?\]/i);
            if (giftMatch) {
                const name = giftMatch[1].trim();
                const qty = parseInt(giftMatch[2]) || 1;
                const note = giftMatch[3]?.trim() || '';

                newMsg.type = 'gift';
                newMsg.giftId = 'GIFT-U-' + Date.now();
                newMsg.giftName = name;
                newMsg.giftQuantity = qty;
                newMsg.giftNote = note;
                newMsg.status = 'pending'; // 改为pending状态，不直接送达
                newMsg.senderName = useSettingsStore().personalization?.userProfile?.name || '我';

                try {
                    // Try to fetch image by importing store (async not allowed in sync addMessage, so we use placeholder)
                    newMsg.giftImage = 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png';
                } catch (e) { }
            }
        }

        // --- AI COMMANDS HANDLING ---
        if (newMsg.role === 'assistant' && typeof newMsg.content === 'string') {
            const content = newMsg.content.trim();

            // 1. [GIFT:name:quantity:note]
            const giftMatch = content.match(/\[GIFT\s*[:：]\s*([^:：\]]+)(?:\s*[:：]?\s*(\d*))?(?:\s*[:：]?\s*([^\]]*))?\]/i);
            if (giftMatch) {
                const name = giftMatch[1].trim();
                const qty = parseInt(giftMatch[2]) || 1;
                const note = giftMatch[3]?.trim() || '';

                newMsg.type = 'gift';
                newMsg.giftId = 'GIFT-AI-' + Date.now();
                newMsg.giftName = name;
                newMsg.giftQuantity = qty;
                newMsg.giftNote = note;
                newMsg.status = 'pending'; // 改为pending状态，不直接送达
                newMsg.senderName = chat.name;
                newMsg.giftImage = 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png';
            }

            // 2. [领取礼物:giftId]
            const claimMatch = content.match(/\[领取礼物\s*[:：]\s*([^\]]+)\]/);
            if (claimMatch) {
                const targetId = claimMatch[1].trim();
                const targetMsg = chat.msgs.find(m => m.giftId === targetId || m.id === targetId);
                if (targetMsg && targetMsg.status === 'pending') {
                    claimGift(chatId, targetMsg.id, 'ai');
                    // 不隐藏原消息，而是让claimGift函数处理状态更新
                }
            }

            // 3. Financial claims
            const rpClaim = content.match(/\[领取红包\s*[:：]\s*([^\]]+)\]/);
            if (rpClaim) {
                claimRedPacket(chatId, rpClaim[1].trim(), 'ai');
                newMsg.hidden = true;
            }
            const tfClaim = content.match(/\[领取转账\s*[:：]\s*([^\]]+)\]/);
            if (tfClaim) {
                claimTransfer(chatId, tfClaim[1].trim(), 'ai');
                newMsg.hidden = true;
            }
        }

        // 4. Persistence
        if (!chat.msgs) chat.msgs = []
        chat.msgs.push(newMsg)

        // 4.1 Insert pending system messages
        if (newMsg._pendingSystemMessages && newMsg._pendingSystemMessages.length > 0) {
            chat.msgs.push(...newMsg._pendingSystemMessages)
            delete newMsg._pendingSystemMessages
        }

        if (!chat.inChatList) chat.inChatList = true
        if (chatId !== currentChatId.value) {
            chat.unreadCount = (chat.unreadCount || 0) + 1
        }

        if (newMsg.role !== 'user') {
            const contentStr = String(newMsg.content || '');
            const isToxic = contentStr.includes('display:') || contentStr.includes('border-radius') || contentStr.trim().startsWith('{');
            if (!isToxic && contentStr.trim().length > 0) {
                notificationEvent.value = {
                    id: Date.now(),
                    chatId: chatId,
                    name: chat.name,
                    avatar: chat.avatar,
                    content: newMsg.type === 'family_card' ? '[亲属卡]' : (newMsg.type === 'gift' ? '[礼物]' : (newMsg.type === 'image' ? '[图片]' : (newMsg.content || '[消息]'))),
                    timestamp: Date.now()
                }
            }
        }

        // Auto-generate system messages
        const msgContent = typeof newMsg.content === 'string' ? newMsg.content : ''
        const userName = chat.userName || '用户'
        const charName = chat.name || '对方'

        if (msgContent.includes('[FAMILY_CARD_APPLY:') && newMsg.role === 'user') {
            setTimeout(() => addMessage(chatId, { role: 'system', content: `${userName}正在向${charName}申请绑定亲属卡` }), 100)
        }
        if (msgContent.includes('[FAMILY_CARD:') && !msgContent.includes('APPLY') && !msgContent.includes('REJECT') && newMsg.role === 'ai') {
            const match = msgContent.match(/\[FAMILY_CARD:(\d+):([^\]]+)\]/)
            setTimeout(() => addMessage(chatId, { role: 'system', content: `${charName}向您发送了亲属卡「${match ? match[2] : '亲属卡'}」，点击领取` }), 100)
        }
        if (msgContent.includes('[FAMILY_CARD_REJECT:') && newMsg.role === 'ai') {
            setTimeout(() => addMessage(chatId, { role: 'system', content: `${charName}已拒绝${userName}的亲属卡申请` }), 100)
        }

        checkAutoSummary(chatId)
        saveChats()
        return newMsg
    }




    async function updateCharacter(chatId, updates) {
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

        await saveChats()
        return true
    }

    // --- Memory Logic ---


    // --- Memory Logic ---


    function getTokenCount(chatId) {
        const stats = getTokenBreakdown(chatId)
        return stats.totalContext
    }



    // --- Proactive Chat Logic ---
    let proactiveWorker = null



    // Initialize proactive loop
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
        const momentsStore = useMomentsStore()
        const callStore = useCallStore()
        const chat = chats.value[chatId]
        if (!chat || chat.isExited || chat.isDissolved) {
            typingStatus.value[chatId] = false
            return
        }

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
        const isCallMode = callStore.status !== 'none' && callStore.status !== 'ended'
        const isCallActive = callStore.status === 'active'
        const rawContext = (chat.msgs || []).slice(-contextLimit).filter(m => {
            // 过滤掉通话相关的系统消息和收藏卡片，避免上下文混乱
            if (m.type === 'system' && (m.content.includes('通话') || m.content.includes('占线') || m.content.includes('拒绝') || m.content.includes('取消'))) return false
            if (m.type === 'favorite_card' && m.content.includes('通话记录')) return false
            if (m.hidden && !isCallMode) return false // 通话模式下保留hidden消息
            return true
        }).map(m => {
            let content = ""
            if (typeof m.content === 'string') {
                content = m.content
            } else if (Array.isArray(m.content)) {
                content = m.content.map(p => p.text || '').join('\n')
            } else {
                content = String(m.content || '')
            }

            // 处理特殊卡片的上下文表现
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
            } else if (m.type === 'dice_result') {
                const sName = m.senderName || (m.role === 'user' ? '我' : (chat.name || '对方'))
                content = `[摇骰子] ${sName}摇了${m.diceCount || 1}颗骰子，合计点数：${m.diceTotal}`
            }

            if (m.role === 'ai') {
                // 清理心声，仅保留第一处心声以便 AI 参考
                const ivRegex = /\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi
                const matches = [...content.matchAll(ivRegex)]
                if (matches.length > 0) {
                    const firstIv = matches[0][0]
                    content = content.replace(ivRegex, '').trim() + '\n' + firstIv
                }
            }

            if (m.quote) {
                const quoteAuthor = m.quote.role === 'user' ? '我' : (chat.name || '对方')
                content = `（引用来自 ${quoteAuthor} 的消息: "${m.quote.content}"）\n${content}`
            }

            let finalContent = content
            if (chat.isGroup) {
                const sId = m.senderId || (m.role === 'user' ? 'user' : chatId);
                const title = getMemberTitle(chatId, sId);
                const sName = m.role === 'user' ? '我' : (m.senderName || chat.name);
                finalContent = `[${title}] ${sName}: ${content}`
            }

            return {
                id: m.id,
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: finalContent,
                image: m.image
            }
        })

        // --- 角色轮替保护：合并连续的 User/Assistant 消息 (Gemini 必须交替) ---
        const mergedContext = [];
        rawContext.forEach(m => {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === m.role) {
                // 合并内容
                if (typeof last.content === 'string' && typeof m.content === 'string') {
                    last.content += `\n\n${m.content}`;
                }
                // 图视觉信息合并 (AI Vision 注入)，保留最后一条消息的id
                if (m.image) {
                    last.image = m.image;
                    last.id = m.id;  // 保留最新的消息ID，以便图片引用
                }
            } else {
                mergedContext.push(m);
            }
        });

        // 2. 注入提示 (Hidden Hint / 时间感知 / 通话引导)
        const callStatus = callStore.status
        if (callStatus === 'dialing' || callStatus === 'incoming') {
            const userName = chat.userName || '用户'
            const callType = callStore.type === 'video' ? '视频' : '语音'
            const callHint = `【${userName}对你发起${callType}通话，接听请输入语音通话格式，拒绝请输入[挂断通话]，按照正常正文格式回复。】

[接听]
[CALL_START]
{
  "speech": "接通后你说的第一句话（中文口语）",
  "action": "你的神态/动作",
  "status": "你的心情状态",
  "hangup": false
}
[CALL_END]`

            console.log(`[ChatStore] Injecting call hint for status: ${callStatus}`);

            const last = mergedContext[mergedContext.length - 1]
            if (last && last.role === 'user') {
                last.content += `\n\n${callHint}`
            } else {
                mergedContext.push({ role: 'user', content: callHint })
            }
        } else if (callStatus === 'active') {
            const callActiveHint = `【系统：当前通话已接通。请继续与用户愉快地聊天，直接输出对话 JSON 即可，严禁再次回复“[接听]”或重复开场动作。】`
            const last = mergedContext[mergedContext.length - 1]
            if (last && last.role === 'user') {
                last.content += `\n\n${callActiveHint}`
            } else {
                mergedContext.push({ role: 'user', content: callActiveHint })
            }
        } else if (options.hiddenHint) {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === 'user') {
                last.content += `\n\n[系统要求] ${options.hiddenHint}`;
            } else {
                mergedContext.push({ role: 'user', content: `[系统要求] ${options.hiddenHint}` });
            }
        }
        else if (diffMinutes >= 1) {
            const last = mergedContext[mergedContext.length - 1];
            if (last && last.role === 'user') {
                const timeStr = diffMinutes >= 60 ? `${Math.floor(diffMinutes / 60)}小时${diffMinutes % 60}分` : `${diffMinutes}分`;
                last.content += ` \n\n【系统提示：当前时间为 ${currentVirtualTime}，距离上次互动已过去 ${timeStr}。记得心声格式标签[INNER_VOICE]】`;
            }
        }


        const context = mergedContext;

        // --- Group Chat: Inject group context into the last user message ---
        if (chat.isGroup) {
            try {
                const gs = chat.groupSettings || {}
                const groupPrompt = gs.groupPrompt || ''
                const myPersona = gs.myPersona || chat.userPersona || ''
                const announcement = chat.groupProfile?.announcement || ''
                const participants = Array.isArray(chat.participants) ? chat.participants : []

                const roster = participants.slice(0, 30).map(p => {
                    const bio = p.bio || {}
                    const mbti = bio.mbti ? `MBTI:${bio.mbti}` : ''
                    const sig = bio.signature ? `签名:${bio.signature}` : ''
                    const brief = [mbti, sig].filter(Boolean).join('，')
                    return `- id=${p.id} name=${p.name}${brief ? `（${brief}）` : ''}\n  prompt=${String(p.prompt || '').slice(0, 140)}`
                }).join('\n')

                const formatRule = `【群聊发言规则】\n1) 这是一个正常的群聊（类似微信/QQ），你需要扮演群里的“多个成员”进行生动互动。\n2) 你可以在单次回复中生成多条、多人的发言！群员可以互相聊天、互相@、抢红包，不一定都要围着“我(User)”转。\n3) 每段独立发言必须单起一行，并严格以 [FROM:成员id] 开头（成员id必须来自成员列表）。\n4) 发言内容直接连在标签后，绝对不要再额外加“成员名：”前缀！\n5) 支持系统全部所有功能：你可以发送 [图片:配图要求]、[表情包:描述]、[语音:台词]、甚至是 [DRAW:提示词]。\n6) 禁止输出任何 [INNER_VOICE] 标签（群聊不需要心声旁白）。`

                const groupCtx = `【群聊设定】\n群名：${chat.name || ''}\n群公告：${announcement || '（无）'}\n我的人设：${myPersona || '（无）'}\n群聊规则/氛围：${groupPrompt || '（无）'}\n\n【群成员列表】\n${roster || '（暂无成员）'}\n\n${formatRule}`

                const last = context[context.length - 1]
                if (last && last.role === 'user') {
                    last.content += `\n\n${groupCtx}`
                } else {
                    context.push({ role: 'user', content: groupCtx })
                }
            } catch (e) {
                console.warn('[ChatStore] Group context injection failed:', e)
            }
        }


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
                isGroup: chat.isGroup,
                groupSettings: chat.groupSettings,
                participants: chat.participants
            }

            // Group: make persona consistent with group settings
            if (chat.isGroup) {
                const gs = chat.groupSettings || {}
                if (gs.myPersona !== undefined) charInfo.userPersona = gs.myPersona || ''
                if (Array.isArray(gs.worldBookLinks)) charInfo.worldBookLinks = gs.worldBookLinks
                const participants = Array.isArray(chat.participants) ? chat.participants : []
                const rosterShort = participants.slice(0, 30).map(p => `- ${p.id}: ${p.name}（${String(p.prompt || '').slice(0, 80)}）`).join('\n')
                const groupPrompt = gs.groupPrompt || ''
                charInfo.description = `【群聊】你现在在一个微信群聊中，群名：${chat.name || ''}。\n【群聊氛围/规则】${groupPrompt || '（无）'}\n【成员】\n${rosterShort || '（暂无成员）'}\n\n请严格遵守：每次回复只代表 1 位成员发言，且必须以 [FROM:成员id] 开头。`
            }

            // Group Vote Awareness & Capability
            const activeVotes = (chat.msgs || []).filter(m => m.type === 'vote' && !m.isRecall)
            let voteHint = ''
            if (activeVotes.length > 0) {
                let latestVote = null
                try {
                    const lastVoteMsg = activeVotes[activeVotes.length - 1]
                    latestVote = typeof lastVoteMsg.content === 'string' ? JSON.parse(lastVoteMsg.content) : lastVoteMsg.content
                } catch (e) { /* ignore parse error */ }
                if (latestVote && latestVote.title && !latestVote.isEnded) {
                    const optionsText = (latestVote.options || []).map((opt, i) => `${i + 1}.${typeof opt === 'string' ? opt : opt.text}`).join(', ')
                    voteHint = `\n\n【投票进行中】\n当前有一个主题为“${latestVote.title}”的投票。
选项：${optionsText}
${latestVote.isMultiple ? '（多选）' : '（单选）'} ${latestVote.isAnonymous ? '（匿名）' : '（实名）'}
作为角色，你可以根据性格参与投票。
参与投票指令（另起一行）：[VOTE: ${latestVote.title} : 选项序号]
如果是多选：[VOTE: ${latestVote.title} : 1, 2]`
                }
            }

            const createVoteHint = `\n\n【发起投票功能】\n你可以发起新投票。指令（另起一行）：
[CREATE_VOTE: 标题 : 选项1, 选项2 : 多选true/false : 匿名true/false]`

            charInfo.description += voteHint + createVoteHint

            // Music Awareness (Listen Together)
            const musicStore = useMusicStore()
            if (musicStore.isListeningTogether && musicStore.currentSong) {
                const song = musicStore.currentSong
                const musicHint = `\n\n【当前正在一起听歌】\n你正和用户一起听：${song.song} - ${song.singer}。
你可以对这首歌发表看法，或者在觉得氛围合适时，使用 <bgm>歌名 - 歌手</bgm> 格式切换下一首符合当前氛围的歌曲。`
                charInfo.description += musicHint
            }

            // Visual Perception Awareness for Calls
            if (isCallMode && callStore.type === 'video') {
                let visualHint = '\n\n【视觉感知状态】\n';

                // Rule 1: Camera Awareness
                if (!callStore.isCameraOff) {
                    visualHint += `用户已开启摄像头。你现在可以“看”到用户。请通过视觉交流（如评论用户的表情、背景、穿着或动作）来增强真实感。你可以直接描述你看到的画面（例如：看到用户在笑，或者看到用户在卧室里）。\n`;
                } else {
                    visualHint += `用户的摄像头目前已关闭。你无法看到用户，请依赖用户在括号 () 或 [] 中描述的动作来了解其状态。\n`;
                }

                // Rule 2: Virtual Avatar / Drawing Mode
                if (callStore.virtualAvatarMode === 0) {
                    // "None" mode -> DRAW mode
                    visualHint += `目前你处于“实景视频”模式，但由于带宽限制，你的视频流是静态的。为了制造动态感，请在每轮回复的末尾使用 [DRAW: 英文提示词] 指令生成一张你在当前视频通话场景下的神态或环境图（例如你在卧室靠墙通话、你在街边举着手机等）。每轮必发一张图。\n`;
                } else if (callStore.virtualAvatarMode === 1) {
                    // "Both" virtual mode
                    visualHint += `目前你正以虚拟形象（Avatar）与用户交流，用户也在使用虚拟形象。如果你观察到用户开启了摄像头，请特别关注用户的视觉反馈，因为用户的动作会通过视觉模型影响其虚拟形象。\n`;
                } else if (callStore.virtualAvatarMode === 2) {
                    // "AI Only" virtual mode
                    visualHint += `目前你正以虚拟形象（Avatar）与用户交流。如果你观察到用户开启了摄像头，请特别关注用户的视觉反馈。\n`;
                }

                charInfo.description += visualHint;
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
            // Track if we are in a call to handle message shadowing/hiding

            // Streaming handler for calls
            let hasAddedCallLine = false;
            const onChunk = isCallMode ? (delta, full) => {
                // For calls, we might want to update the last transcript line if streaming
                // But for now we forced stream: false below for stability
            } : null;

            // FOR CALLS: Disable streaming to ensure complete JSON blocks are received,
            // as partial JSON is harder to parse reliably for voice.
            const result = await generateReply(context, charInfo, signal, {
                ...aiOptions,
                isCall: isCallMode, // Use call prompt for any active call state (dialing, incoming, active)
                stream: isCallMode ? false : undefined, // Force non-streaming for calls
                onChunk: isCallMode ? onChunk : null
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
            if (result.content || (result.choices && result.choices[0]?.message?.content)) {
                // 处理完整的OpenAI响应格式
                let fullContent = result.content;
                if (!fullContent && result.choices && result.choices[0]?.message?.content) {
                    fullContent = result.choices[0].message.content;
                }

                // --- Pre-process: Strip Character Name Prefixes (防止剧本格式) ---
                if (chat.name) {
                    const nameEscaped = chat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const nameRegex = new RegExp(`^\\s*${nameEscaped}\\s*[:：\\s-]\\s*`, 'gm');
                    fullContent = fullContent.replace(nameRegex, '').trim();
                }

                // --- Group Speaker Tag Parsing ---
                // Expect: [FROM:participantId] at the very beginning.
                // We remove the tag and attach sender metadata to all delivered segments.
                let groupSpeakerMeta = null
                if (chat.isGroup) {
                    const s = String(fullContent || '').trim()
                    const m = s.match(/^\s*\[FROM\s*:\s*([^\]]+)\]\s*/i)
                    if (m) {
                        const fromKey = String(m[1] || '').trim()
                        fullContent = s.replace(m[0], '').trim()
                        const participants = Array.isArray(chat.participants) ? chat.participants : []
                        const byId = participants.find(p => String(p.id) === fromKey)
                        const byName = participants.find(p => String(p.name) === fromKey)
                        const p = byId || byName
                        if (p) {
                            groupSpeakerMeta = { senderId: p.id, senderName: p.name, senderAvatar: p.avatar || chat.avatar }
                        } else {
                            groupSpeakerMeta = { senderId: fromKey, senderName: fromKey, senderAvatar: chat.avatar }
                        }
                    }
                }

                // Flag to prevent duplicate TTS playback
                let hasPlayedTTS = false;

                // --- Handle Call Mode Post-Processing (Includes Dialing/Incoming/Active) ---
                if (isCallMode) {
                    // Protocol Detection
                    const callMatch = fullContent.match(/\[CALL_START\][\s\S]*?(\{[\s\S]*?\})[\s\S]*?\[CALL_END\]/i);
                    const hasJsonLike = fullContent.includes('{') && (fullContent.includes('"speech"') || fullContent.includes('"status"'));

                    if (callMatch || hasJsonLike) {
                        try {
                            let callData = null;
                            if (callMatch) {
                                callData = JSON.parse(callMatch[1].trim());
                            } else {
                                // Fallback: find the JSON block directly
                                const jsonMatches = fullContent.match(/\{[\s\S]*?\}/g);
                                if (jsonMatches) {
                                    callData = JSON.parse(jsonMatches[jsonMatches.length - 1]);
                                }
                            }

                            if (callData) {
                                // Auto-accept if we were dialing/incoming and received a protocol response
                                if (callStore.status === 'dialing' || callStore.status === 'incoming') {
                                    if (fullContent.includes('[接听]') || callData.speech) {
                                        console.log('[ChatStore] Auto-accepting call due to protocol response');
                                        callStore.acceptCall();
                                    }
                                }

                                if (callData.speech) {
                                    // RESTORED: One large bubble for the call transcript
                                    callStore.addTranscriptLine('ai', callData.speech, callData.action || '');
                                    hasAddedCallLine = true;

                                    // TTS logic
                                    if (callStore.isSpeakerOn && window.speechSynthesis && !hasPlayedTTS) {
                                        window.speechSynthesis.cancel();
                                        const ttsText = callData.speech.replace(/\([\s\S]*?\)/g, '').replace(/（[\s\S]*?）/g, '').replace(/\[[\s\S]*?\]/g, '').trim();
                                        if (ttsText) {
                                            const utterance = new SpeechSynthesisUtterance(ttsText);
                                            utterance.lang = 'zh-CN';
                                            window.speechSynthesis.speak(utterance);
                                            hasPlayedTTS = true;
                                        }
                                    }

                                    // Replace the protocol block with speech for the background, 
                                    // so other tags (like DRAW) outside the block are preserved.
                                    if (callMatch) {
                                        let replacement = callData.speech;
                                        if (callData.action) replacement += ` (${callData.action})`;
                                        fullContent = fullContent.replace(callMatch[0], replacement).trim();
                                    } else {
                                        // Fallback if we found JSON but not the whole tag block
                                        fullContent = callData.speech;
                                        if (callData.action) fullContent += ` (${callData.action})`;
                                    }
                                }

                                if (callData.hangup) {
                                    callStore.endCall();
                                }

                                if (callData.status) {
                                    callStore.updateStatus(callData.status);
                                }

                                // If it was a protocol message, we don't necessarily want it to go through the normal splitting logic
                                // if it's meant ONLY for the call visualizer.
                                // However, we let the existing hidden logic handle it.
                            }
                        } catch (e) {
                            console.error('[ChatStore] Failed to parse call JSON:', e);
                        }
                    } else if (fullContent.includes('[接听]') || fullContent.includes('[接受通话]')) {
                        console.log('[ChatStore] AI accepted the call (simple tag)');
                        callStore.acceptCall();
                    } else if (fullContent.includes('[拒绝]') || fullContent.includes('[拒接]')) {
                        console.log('[ChatStore] AI rejected the call');
                        callStore.rejectCall();
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
                const innerVoiceRegex = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\[)|$)/gi;

                // Extract ALL inner voice blocks for canonical storage
                const allVoiceMatches = [...fullContent.matchAll(innerVoiceRegex)];
                let innerVoiceBlock = allVoiceMatches.length > 0 ? allVoiceMatches[0][0] : '';
                if (chat.isGroup) {
                    innerVoiceBlock = ''; // Destroy it if it somehow leaked
                }

                // Pure Dialogue extraction
                let pureDialogue = fullContent.replace(innerVoiceRegex, '').trim();

                // Failsafe: If regex failed but AI Service successfully parsed Inner Voice, OR if we can find a JSON block manually
                if (!innerVoiceBlock && !chat.isGroup) {
                    if (result.innerVoice) {
                        // Case A: AI Service already parsed it (reliable)
                        try {
                            console.log('[ChatStore] Regex failed check, reconstructing Inner Voice from parsed result');
                            const jsonContent = JSON.stringify(result.innerVoice, null, 2);
                            innerVoiceBlock = `\n[INNER_VOICE]\n${jsonContent}\n[/INNER_VOICE]`;

                            // If it's not caught by the regex, it's likely untagged JSON in the text
                            // We need to find and remove it from pureDialogue
                            if (pureDialogue.includes('{') && (pureDialogue.includes('"status"') || pureDialogue.includes('"心声"'))) {
                                const blocks = [...pureDialogue.matchAll(/\{[\s\S]*?\}/g)]
                                for (let i = blocks.length - 1; i >= 0; i--) {
                                    const block = blocks[i][0]
                                    if (block.includes('"status"') || block.includes('"心声"') || block.includes('"着装"')) {
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
                            // Non-greedy scan for JSON blocks with specific keywords
                            const blocks = [...fullContent.matchAll(/\{[\s\S]*?\}/g)]
                            for (let i = blocks.length - 1; i >= 0; i--) {
                                const candidate = blocks[i][0]
                                if (candidate.includes('"status"') || candidate.includes('"心声"') || candidate.includes('"着装"')) {
                                    console.log('[ChatStore] Found raw JSON block in fallback, treating as Inner Voice');
                                    innerVoiceBlock = `\n[INNER_VOICE]\n${candidate}\n[/INNER_VOICE]`;
                                    pureDialogue = pureDialogue.replace(candidate, '').trim();

                                    // Parse it to update status immediately
                                    try {
                                        const ivObj = JSON.parse(candidate);
                                        if (ivObj.status || ivObj.状态 || ivObj["心声"]) {
                                            const newStatus = ivObj.status || ivObj.状态 || (typeof ivObj["心声"] === 'string' ? ivObj["心声"] : null);
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

                // --- Handle [VOTE:] Command ---
                const voteRegex = /\[VOTE:\s*(.+?)\s*:\s*([^\]]+)\]/i
                const voteMatch = properlyOrderedContent.match(voteRegex)
                if (voteMatch) {
                    const voteTitle = voteMatch[1].trim()
                    const optionIndexes = voteMatch[2].split(/[,，]/).map(s => parseInt(s.trim()) - 1).filter(n => !isNaN(n))

                    const voteMsg = (chat.msgs || []).findLast(m =>
                        (m.type === 'vote' || m.vote) &&
                        m.vote?.title === voteTitle &&
                        !m.isRecall
                    )

                    if (voteMsg) {
                        const speakerId = groupSpeakerMeta?.senderId || chatId
                        const validIndices = optionIndexes.filter(idx => idx >= 0 && idx < ((voteMsg.vote?.options?.length) || 0))

                        if (validIndices.length > 0) {
                            castVote(chatId, voteMsg.id, speakerId, validIndices)
                            console.log(`[Vote] AI (${speakerId}) voted for:`, validIndices)
                        }
                    }
                }

                // --- Handle [CREATE_VOTE:] Command ---
                const createVoteRegex = /\[CREATE_VOTE:\s*(.+?)\s*:\s*([^\]]+?)\s*:\s*(true|false)\s*:\s*(true|false)\]/i
                const createVoteMatch = properlyOrderedContent.match(createVoteRegex)
                if (createVoteMatch) {
                    const title = createVoteMatch[1].trim()
                    const optionsArr = createVoteMatch[2].split(/[,，]/).map(s => s.trim()).filter(Boolean)
                    const isMultiple = createVoteMatch[3].toLowerCase() === 'true'
                    const isAnonymous = createVoteMatch[4].toLowerCase() === 'true'
                    const speakerId = groupSpeakerMeta?.senderId || chatId
                    const speakerName = groupSpeakerMeta?.senderName || chat.name

                    createVote(chatId, {
                        role: 'ai',
                        title,
                        options: optionsArr,
                        isMultiple,
                        isAnonymous,
                        creatorId: speakerId,
                        creatorName: speakerName,
                        senderId: speakerId,
                        senderName: speakerName,
                        senderAvatar: groupSpeakerMeta?.senderAvatar || ''
                    })
                    console.log(`[Vote] AI (${speakerId}) created vote:`, title)
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


                // --- Handle [MOMENT] Command (Enhanced with Chinese Tag Support + Balanced JSON) ---
                // const momentsStore = useMomentsStore() // Already declared at top of function

                // Use balanced brace matching to extract JSON from [MOMENT] tag, avoiding regex issues with [ in JSON arrays
                const momentTagRegex = /\[(?:MOMENT|朋友圈)\]/i;
                const momentTagMatch = properlyOrderedContent.match(momentTagRegex);
                let momentFullMatch = null; // Store full match text for cleanContent removal
                if (momentTagMatch) {
                    try {
                        const afterTag = properlyOrderedContent.substring(momentTagMatch.index + momentTagMatch[0].length);
                        // Find the JSON object using balanced brace matching
                        const jsonStart = afterTag.indexOf('{');
                        if (jsonStart !== -1) {
                            let balance = 0;
                            let inString = false;
                            let isEscaped = false;
                            let jsonEnd = -1;
                            for (let ci = jsonStart; ci < afterTag.length; ci++) {
                                const ch = afterTag[ci];
                                if (isEscaped) { isEscaped = false; continue; }
                                if (ch === '\\') { isEscaped = true; continue; }
                                if (ch === '"') { inString = !inString; continue; }
                                if (!inString) {
                                    if (ch === '{') balance++;
                                    else if (ch === '}') {
                                        balance--;
                                        if (balance === 0) { jsonEnd = ci + 1; break; }
                                    }
                                }
                            }

                            if (jsonEnd !== -1) {
                                let jsonStr = afterTag.substring(jsonStart, jsonEnd).trim();
                                // ESCAPE FIX: Handle AI's tendency to escape quotes in JSON
                                jsonStr = jsonStr.replace(/\\"/g, '"');
                                // Store the full matched text (from [MOMENT] to end of JSON) for removal
                                const closingTag = afterTag.substring(jsonEnd).match(/^\s*\[\/(?:MOMENT|朋友圈)\]/i);
                                const matchEnd = momentTagMatch.index + momentTagMatch[0].length + jsonEnd + (closingTag ? closingTag[0].length : 0);
                                momentFullMatch = properlyOrderedContent.substring(momentTagMatch.index, matchEnd);

                                let momentData = JSON.parse(jsonStr);

                                // Mapping Chinese Keys to English (Safety Net)
                                const content = momentData.content || momentData.内容;
                                const interactions = momentData.interactions || momentData.互动 || [];
                                const imagePrompt = momentData.imagePrompt || momentData.配图 || momentData.图片;
                                // Support "images" array (URLs directly from AI)
                                const imagesArray = momentData.images || momentData.图片列表 || [];

                                if (momentData && (content || momentData.html)) {
                                    const newMoment = {
                                        authorId: chatId,
                                        content: content,
                                        html: momentData.html,
                                        images: [],
                                        imageDescriptions: momentData.imageDescriptions || [],
                                        location: momentData.location || momentData.地点 || '',
                                        interactions: interactions.map(i => ({
                                            type: i.type || (i.类型 === '点赞' ? 'like' : (i.类型 === '评论' ? 'comment' : (i.类型 === '回复' ? 'reply' : i.类型))),
                                            author: i.author || i.作者 || i.名字,
                                            text: i.text || i.内容 || i.文本 || i.content,
                                            replyTo: i.replyTo || i.回复对象 || i.回复
                                        }))
                                    };

                                    // Handle images: support both "images" array (direct URLs) and "imagePrompt" (generation)
                                    if (Array.isArray(imagesArray) && imagesArray.length > 0) {
                                        for (const img of imagesArray) {
                                            if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'))) {
                                                newMoment.images.push(img);
                                            } else if (typeof img === 'string' && img.trim()) {
                                                try {
                                                    const imgUrl = await generateImage(img);
                                                    newMoment.images.push(imgUrl);
                                                } catch (e) { console.warn('[MOMENT] Image gen failed for:', img); }
                                            }
                                        }
                                    } else if (imagePrompt) {
                                        if (typeof imagePrompt === 'string' && (imagePrompt.startsWith('http') || imagePrompt.startsWith('data:'))) {
                                            newMoment.images.push(imagePrompt);
                                        } else {
                                            try {
                                                const imageUrl = await generateImage(String(imagePrompt));
                                                newMoment.images.push(imageUrl);
                                            } catch (e) { console.warn('[MOMENT] Image gen failed'); }
                                        }
                                    }

                                    const momentResult = momentsStore.addMoment(newMoment);

                                    addMessage(chatId, {
                                        type: 'system',
                                        content: `"${chat.name}" 发布了一条朋友圈`,
                                        _momentReferenceId: momentResult.id
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[ChatStore] Failed to parse [MOMENT]', e);
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
                // Support both [SET_AVATAR:...] and [更换头像:...] formats
                const setAvatarRegex = /\[(?:SET_AVATAR|更换头像)[:：]\s*(.+?)\s*\]/gi
                let avatarMatch;
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
                                if (m.type === 'image' && m.image && (m.image.startsWith('http') || m.image.startsWith('data:image'))) return true;
                                if (m.type === 'image' && m.content && (m.content.startsWith('http') || m.content.startsWith('data:image'))) return true;
                                if (typeof m.content === 'string' && /\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]/i.test(m.content)) return true;
                                return false;
                            });
                            if (imgMsg) {
                                // Priority: image property for type='image' messages
                                if (imgMsg.type === 'image' && imgMsg.image) return imgMsg.image;
                                if (imgMsg.type === 'image' && imgMsg.content) return imgMsg.content;
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
                                console.log(`[ChatStore] Looking for image ID: "${possibleId}"`);
                                console.log(`[ChatStore] Available message IDs:`, chat.msgs.map(m => ({ id: m.id, type: m.type, hasImage: !!m.image })));
                                if (targetMsg) {
                                    console.log(`[ChatStore] Found target message:`, { type: targetMsg.type, image: targetMsg.image ? `${targetMsg.image.substring(0, 50)}...` : 'none' });
                                    // For image type messages, use the 'image' property which contains base64
                                    if (targetMsg.type === 'image' && targetMsg.image && (targetMsg.image.startsWith('http') || targetMsg.image.startsWith('data:image'))) {
                                        newAvatarUrl = targetMsg.image;
                                    } else if (targetMsg.type === 'image' && targetMsg.content && (targetMsg.content.startsWith('http') || targetMsg.content.startsWith('data:image'))) {
                                        // Fallback for legacy format where image was in content
                                        newAvatarUrl = targetMsg.content;
                                    } else {
                                        const embeddedMatch = targetMsg.content?.match(/\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]/i);
                                        if (embeddedMatch) newAvatarUrl = embeddedMatch[1];
                                    }
                                } else {
                                    console.warn(`[ChatStore] Target message not found for ID: "${possibleId}"`);
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
                const cleanVoiceRegex = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]?)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|红包|转账|表情包|图片|SET_|NUDGE))|$)/gi;
                let cleanContent = properlyOrderedContent
                    // .replace(cleanVoiceRegex, '') // KEEP INNER_VOICE for History/Card to read!
                    .replace(patRegex, '')
                    .replace(nudgeRegex, '')
                    .replace(replyRegex, '')
                    .replace(setAvatarRegex, '')
                    .replace(familyCardRegex, '') // Remove FAMILY_CARD tags
                    .replace(/\[LIKE[:：].*?\]/gi, '') // SCRUB INTERACTIONS FROM BUBBLES
                    .replace(/\[COMMENT[:：].*?\]/gi, '')
                    .replace(/\[REPLY[:：].*?\]/gi, '')
                    .replace(/\[MUSIC:\s*.*?\]/gi, '') // Remove MUSIC command tags
                    // Aggressively clean AI's manual quote explanations like "引用来自 我 的消息..."
                    .replace(/[（\(]引用来自.*?[）\)]/gi, '')
                    .replace(/引用[^：:。^！]*[：:。^！]/gi, '')
                    .trim();

                // Remove the exact MOMENT block captured by balanced brace matching
                if (momentFullMatch) {
                    cleanContent = cleanContent.replace(momentFullMatch, '').trim();
                }
                // Fallback: also remove any remaining [MOMENT]...[/MOMENT] tags that might have been missed
                cleanContent = cleanContent.replace(/\[(?:MOMENT|朋友圈)\][\s\S]*?\[\/(?:MOMENT|朋友圈)\]/gi, '').trim();

                // Clean AI Hallucinations & Residual Tags & TOXIC CSS
                cleanContent = cleanContent
                    .replace(/\[Image Reference ID:.*?\]/gi, '')
                    .replace(/Here is the original image:/gi, '')
                    .replace(/\(我发送了一张图片\)/gi, '')
                    .replace(/\[(?:SET_AVATAR|更换头像)[:：]\s*(.+?)\s*\]/gi, '')
                    .replace(/\[\/?(MOMENT|REPLY|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT)\]/gi, '')
                    // Strip system context hints parrotted by AI
                    .replace(/[\[\(]?(系统|System)[:：\s]*(图片|语音|IMAGE|VOICE)消息[\]\)]?/gi, '')
                    .replace(/\[(?:图片消息|语音消息)\]/gi, '')
                    // Clean double brackets
                    .replace(/\[\[/g, '[')
                    .replace(/\]\]/g, ']')
                    .replace(/\(\(/g, '(')
                    .replace(/\)\)/g, ')')
                    .replace(/（（/g, '（')
                    .replace(/））/g, '）')
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

                // --- Improved Splitting Logic (V13 - Aggressive Splitting) ---
                //   4. Multi-member [FROM:ID] tags for group ecology
                const specialBlockRegex = /(__CARD_PLACEHOLDER_\d+__|\[\s*INNER[\s-_]*VOICE\s*\][\s\S]*?(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\[)|$)|\[FROM:.*?\]|\[DRAW:.*?\]|\[(?:表情包|表情-包)[:：].*?\]|\[FAMILY_CARD(?:_APPLY|_REJECT)?:[\s\S]*?\]|\[CARD\][\s\S]*?(?=\n\n|\[\/CARD\]|$)|\[图片[:：]?.*?\]|\[语音[:：]?.*?\]|\[摇骰子.*?\])/gi;

                let rawSegments = [];
                let lastIdx = 0;
                let specialMatch;

                while ((specialMatch = specialBlockRegex.exec(processedContent)) !== null) {
                    if (specialMatch.index > lastIdx) {
                        const textBefore = processedContent.substring(lastIdx, specialMatch.index);
                        if (textBefore.trim()) rawSegments.push(textBefore);
                    }
                    rawSegments.push(specialMatch[0]);
                    lastIdx = specialMatch.index + specialMatch[0].length;
                }
                if (lastIdx < processedContent.length) {
                    const remaining = processedContent.substring(lastIdx);
                    if (remaining.trim()) rawSegments.push(remaining);
                }

                // Step 2: Split each non-special segment by ANY newline
                let expandedSegments = [];
                for (const seg of rawSegments) {
                    const isSpecialBlock = /^(__CARD_PLACEHOLDER_\d+__|\[\s*INNER|\[FROM:|\[DRAW:|\[(?:表情包|表情-包)[:：]|\[语音|\[CARD\]|\[FAMILY_CARD|\[图片|\[摇骰子)/i.test(seg.trim());
                    if (isSpecialBlock) {
                        expandedSegments.push(seg);
                    } else {
                        // Split by any newline sequence (\r\n or \n)
                        // Also split by "punctuation + newline" to encourage separate bubbles for distinct thoughts
                        const paragraphs = seg.split(/\r?\n/).map(p => p.trim()).filter(p => p);
                        expandedSegments.push(...paragraphs);
                    }
                }

                // Step 3: Merge extremely short disconnected fragments (like stray punctuation)
                let mergedSegments = [];
                for (let i = 0; i < expandedSegments.length; i++) {
                    const seg = expandedSegments[i];
                    const trimSeg = seg.trim();
                    const isSpecialBlock = /^(__CARD_PLACEHOLDER_\d+__|\[\s*INNER|\[FROM:|\[DRAW:|\[(?:表情包|表情-包)[:：]|\[语音|\[CARD\]|\[FAMILY_CARD|\[图片|\[摇骰子)/i.test(trimSeg);

                    if (isSpecialBlock || mergedSegments.length === 0) {
                        mergedSegments.push(seg);
                        continue;
                    }

                    const lastIdx2 = mergedSegments.length - 1;
                    const lastSeg = mergedSegments[lastIdx2];
                    const lastIsSpecial = /^(__CARD_PLACEHOLDER_\d+__|\[\s*INNER|\[FROM:|\[DRAW:|\[(?:表情包|表情-包)[:：]|\[语音|\[CARD\]|\[FAMILY_CARD|\[图片)/i.test(lastSeg.trim());

                    // Merge if the current segment is just punctuation or a very short word, AND the last was text
                    const isPunctuationOnly = /^[\p{P}\p{S}]+$/u.test(trimSeg);
                    if (!lastIsSpecial && (trimSeg.length < 2 || isPunctuationOnly)) {
                        mergedSegments[lastIdx2] = lastSeg + " " + trimSeg;
                        continue;
                    }

                    mergedSegments.push(seg);
                }
                rawSegments = mergedSegments;

                useLoggerStore().debug(`[Split V13] Final segments: ${rawSegments.length}`);

                // --- Restoring Card Blocks and Filtering Content ---
                let finalSegments = [];
                for (const seg of rawSegments) {
                    let content = seg;
                    const placeholderMatch = content.match(/__CARD_PLACEHOLDER_(\d+)__/);

                    if (placeholderMatch) {
                        const index = parseInt(placeholderMatch[1]);
                        content = cardBlocks[cardBlocks.length - 1 - index];
                        finalSegments.push({ type: 'card', content });
                    } else if (/^\[(?:表情包|表情-包)[:：].*?\]$/.test(content.trim())) {
                        // Keep full content (tag) so frontend can parse it with regex
                        finalSegments.push({ type: 'sticker', content: content.trim() });
                    } else if (content.startsWith('[语音通话]') || content.startsWith('[通话]')) {
                        finalSegments.push({ type: 'call', content: 'voice' });
                    } else if (content.startsWith('[视频通话]')) {
                        finalSegments.push({ type: 'call', content: 'video' });
                    } else if (content.startsWith('[语音')) {
                        // Support both [语音:text] and [语音消息] text
                        let voiceContent = content.replace(/^\[语音(消息)?[:：]?\s*/, '').replace(/\]$/, '');
                        finalSegments.push({ type: 'voice', content: voiceContent.trim() });
                    } else if (content.startsWith('[图片')) {
                        // Support both [图片:URL] and [图片消息]
                        let imgUrl = content.replace(/^\[图片[:：]?\s*/, '').replace(/\]$/, '').trim();
                        if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('data:'))) {
                            finalSegments.push({ type: 'image', image: imgUrl, content: '[图片]' });
                        } else {
                            finalSegments.push({ type: 'text', content: '[图片]' });
                        }
                    } else if (content.startsWith('[红包:')) {
                        const match = content.match(/\[红包:([^:]+):([^:]+):([^\]]+)\]/);
                        if (match) {
                            finalSegments.push({
                                type: 'redpacket',
                                amount: parseFloat(match[1]),
                                note: match[2],
                                paymentId: match[3],
                                content: content.trim()
                            });
                        } else {
                            finalSegments.push({ type: 'text', content: content.trim() });
                        }
                    } else if (content.startsWith('[转账:')) {
                        const match = content.match(/\[转账:([^:]+):([^:]+):([^\]]+)\]/);
                        if (match) {
                            finalSegments.push({
                                type: 'transfer',
                                amount: parseFloat(match[1]),
                                note: match[2],
                                paymentId: match[3],
                                content: content.trim()
                            });
                        } else {
                            finalSegments.push({ type: 'text', content: content.trim() });
                        }
                    } else if (content.startsWith('[DRAW:')) {
                        finalSegments.push({ type: 'draw', content: content.trim() });
                    } else if (/^\[\s*INNER[\s-_]*VOICE\s*\]/i.test(content.trim())) {
                        // INNER_VOICE blocks are metadata, not displayable — skip them
                        // They are still preserved in stored msg content for the Inner Voice Card to read
                        continue;
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
                let currentGroupMeta = groupSpeakerMeta ? { ...groupSpeakerMeta } : null;

                for (let i = 0; i < finalSegments.length; i++) {
                    if (!typingStatus.value[chatId]) break;

                    const { type, content } = finalSegments[i];
                    let msgAdded = null;
                    let msgContent = content;

                    // Handle Speaker Switching [FROM:ID]
                    if (type === 'text' && /^\[FROM:\s*(.*?)\s*\]/i.test(msgContent.trim())) {
                        const fromMatch = msgContent.match(/^\[FROM:\s*(.*?)\s*\]/i);
                        const speakerId = fromMatch[1].trim();
                        msgContent = msgContent.substring(fromMatch[0].length).trim();

                        // Find participant in group
                        const participant = (chat.participants || []).find(p => p.id === speakerId || p.name === speakerId);
                        if (participant) {
                            currentGroupMeta = {
                                senderId: participant.id,
                                senderName: participant.name,
                                senderAvatar: participant.avatar
                            };
                        } else if (speakerId.toLowerCase() === 'user') {
                            // User mention? Unlikely but supportable
                            currentGroupMeta = { senderId: 'user', senderName: useSettingsStore().personalization?.userProfile?.name || '我', senderAvatar: useSettingsStore().personalization?.userProfile?.avatar };
                        }

                        // If segment is now empty, just continue to next segment with new speaker active
                        if (!msgContent) continue;
                    }

                    if (type === 'card' || type === 'text' || type === 'redpacket' || type === 'transfer') {
                        // Process Payment Tags
                        let pendingSystemMsgs = [];
                        let claimMatch;
                        while ((claimMatch = claimRegex.exec(msgContent)) !== null) {
                            const pType = claimMatch[1]; // '红包' or '转账'
                            const targetId = claimMatch[2].trim();

                            // Find message by ID or paymentId
                            const targetMsg = chat.msgs.find(m => m.id === targetId || m.paymentId === targetId);
                            if (targetMsg) {
                                const claimantId = currentGroupMeta?.senderId || 'ai';
                                if (pType === '红包') {
                                    claimRedPacket(chatId, targetMsg.id, claimantId);
                                } else {
                                    claimTransfer(chatId, targetMsg.id, claimantId);
                                }
                            }
                        }

                        let rejectMatch;
                        while ((rejectMatch = rejectRegex.exec(msgContent)) !== null) {
                            const pType = rejectMatch[2];
                            const targetId = rejectMatch[3].trim();
                            const targetMsg = chat.msgs.find(m => m.id === targetId || m.paymentId === targetId);
                            if (targetMsg && pType === '转账' && !targetMsg.isClaimed && !targetMsg.isRejected) {
                                targetMsg.isRejected = true;
                                targetMsg.rejectTime = Date.now();
                                addMessage(chatId, { role: 'system', content: `${currentGroupMeta?.senderName || chat.name}已拒收了你的转账` });
                            }
                        }

                        msgContent = msgContent.replace(/\[领取(红包|转账):[^\]]+\]/g, '').replace(/\[(退回|拒收|拒收)(红包|转账):[^\]]+\]/g, '').trim();
                        if (!msgContent && pendingSystemMsgs.length === 0) continue;

                        // --- AI Specialized Commands Parsing (Recall, Reply, Mute, Roles) ---
                        // 1. Recall: [撤回:MSG_ID]
                        const recallMatch = msgContent.match(/\[撤回\s*[:：]\s*(\w+)\]/i);
                        if (recallMatch) {
                            const targetId = recallMatch[1];
                            setTimeout(() => deleteMessage(chatId, targetId), 500);
                            continue;
                        }

                        // 2. Reply: [回复\s*[:：]\s*(\w+)\s*[:：]\s*(.*)\]
                        const replyMatch = msgContent.match(/\[回复\s*[:：]\s*(\w+)\s*[:：]\s*(.*)\]/s);
                        if (replyMatch) {
                            const targetId = replyMatch[1];
                            const actualText = replyMatch[2].trim();
                            const targetMsg = chat.msgs.find(m => m.id === targetId);
                            if (targetMsg) {
                                msgAdded = addMessage(chatId, {
                                    role: 'ai',
                                    type: 'text',
                                    content: actualText,
                                    quote: { id: targetMsg.id, role: targetMsg.role, content: targetMsg.content },
                                    ...(currentGroupMeta || {})
                                });
                                continue;
                            }
                        }

                        // 3. Admin Commands
                        // [禁言:ID:MINUTES]
                        const muteMatch = msgContent.match(/\[禁言\s*[:：]\s*(\w+)\s*[:：]\s*(\d+)\]/i);
                        if (muteMatch) {
                            const mid = muteMatch[1];
                            const mins = parseInt(muteMatch[2]);
                            muteParticipant(chatId, mid, mins);
                            const mname = mid === 'user' ? '你' : (chat.participants.find(p => p.id === mid)?.name || mid);
                            addMessage(chatId, { role: 'system', content: `${mname} 已被${mins > 0 ? `禁言 ${mins} 分钟` : '取消禁言'}` });
                            continue;
                        }

                        // [设为管理员:ID]
                        const setAdminMatch = msgContent.match(/\[设为管理员\s*[:：]\s*(\w+)\]/i);
                        if (setAdminMatch) {
                            const mid = setAdminMatch[1];
                            setParticipantRole(chatId, mid, 'admin');
                            const mname = mid === 'user' ? '你' : (chat.participants.find(p => p.id === mid)?.name || mid);
                            addMessage(chatId, { role: 'system', content: `${mname} 已被设为管理员` });
                            continue;
                        }
                        // [设为成员:ID]
                        const unsetAdminMatch = msgContent.match(/\[(设为成员|取消管理员)\s*[:：]\s*(\w+)\]/i);
                        if (unsetAdminMatch) {
                            const mid = unsetAdminMatch[2];
                            setParticipantRole(chatId, mid, 'member');
                            const mname = mid === 'user' ? '你' : (chat.participants.find(p => p.id === mid)?.name || mid);
                            addMessage(chatId, { role: 'system', content: `${mname} 已被取消管理员权限` });
                            continue;
                        }

                        // [修改头衔:ID:TITLE]
                        const setTitleMatch = msgContent.match(/\[修改头衔\s*[:：]\s*(\w+)\s*[:：]\s*(.*?)\]/i);
                        if (setTitleMatch) {
                            const mid = setTitleMatch[1];
                            const title = setTitleMatch[2].trim();
                            setParticipantTitle(chatId, mid, title);
                            const mname = mid === 'user' ? '你' : (chat.participants.find(p => p.id === mid)?.name || mid);
                            addMessage(chatId, { role: 'system', content: `${mname} 的专属头衔已修改为: ${title || '无'}` });
                            continue;
                        }

                        if (type === 'card' || msgContent.match(/\[\s*CARD\s*\]/i) || msgContent.trim().startsWith('{')) {
                            // HTML Card Delivery
                            let processedHtml = msgContent.replace(/\[\s*\/?[CARD\s]*\]/gi, '').trim();
                            if (processedHtml.includes('\\"')) processedHtml = processedHtml.replace(/\\"/g, '"');
                            if (!processedHtml.trim().startsWith('{') && (processedHtml.includes('"type":') || processedHtml.includes('"html":'))) processedHtml = '{' + processedHtml + '}';

                            let extractedHtml = processedHtml;
                            try {
                                const parsed = JSON.parse(processedHtml);
                                if (parsed.html) extractedHtml = parsed.html;
                            } catch (e) { /* Fallback to raw */ }

                            msgAdded = addMessage(chatId, { role: 'ai', type: 'html', content: processedHtml, html: extractedHtml, quote: i === 0 ? aiQuote : null, ...(currentGroupMeta || {}) });
                        } else {
                            // --- Financial Transaction Processing (Red Packets & Transfers) ---
                            // [红包:类型(lucky|fixed|手气|固定):金额:个数:备注] 
                            const rpMatch = msgContent.match(/\[红包\s*[:：]\s*(lucky|fixed|手气|固定|手气红包|固定金额)?\s*[:：]?\s*([0-9.]+)\s*[:：]\s*(\d+)\s*[:：]?\s*(.*?)\]/i);
                            // [转账:对象ID:金额:备注] or [转账:金额:备注]
                            const tfMatch = msgContent.match(/\[转账\s*[:：]\s*([\w-]+)\s*[:：]\s*([0-9.]+)\s*[:：]?\s*(.*?)\]/i)
                                || msgContent.match(/\[转账\s*[:：]\s*([0-9.]+)\s*[:：]?\s*(.*?)\]/i);

                            let msgType = 'text', amount = null, note = null, extraData = {};

                            if (rpMatch) {
                                msgType = 'redpacket';
                                const typeRaw = (rpMatch[1] || 'lucky').toLowerCase();
                                const isLucky = typeRaw.includes('lucky') || typeRaw.includes('手气');
                                amount = parseFloat(rpMatch[2]) || 1.0;
                                const count = parseInt(rpMatch[3]) || 1;
                                note = rpMatch[4] || '恭喜发财，大吉大利';

                                extraData = {
                                    packetType: isLucky ? 'lucky' : 'fixed',
                                    totalAmount: amount,
                                    count: count,
                                    remainingCount: count,
                                    claims: [],
                                    // Pre-split for lucky packets to ensure total matches exactly
                                    amounts: isLucky ? _splitRedPacket(amount, count) : Array(count).fill(amount)
                                };
                            } else if (tfMatch) {
                                msgType = 'transfer';

                                // Check if the first capture group is the targetId or the amount
                                const firstIsNumber = /^[0-9]/.test(tfMatch[1].trim());

                                if (firstIsNumber) {
                                    amount = parseFloat(tfMatch[1]) || 0.01;
                                    note = tfMatch[2] || '转账给您';
                                    extraData = {
                                        targetId: 'user', // Defaults to user if no target
                                        isClaimed: false
                                    };
                                } else {
                                    const targetId = tfMatch[1].trim();
                                    amount = parseFloat(tfMatch[2]) || 0.01;
                                    note = tfMatch[3] || '转账给您';
                                    extraData = {
                                        targetId: targetId,
                                        isClaimed: false
                                    };
                                }
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

                            if (i === 0 && innerVoiceBlock) msgContent += '\n' + innerVoiceBlock;

                            msgAdded = addMessage(chatId, {
                                role: 'ai',
                                type: msgType,
                                content: msgContent,
                                amount,
                                note,
                                ...extraData,
                                quote: i === 0 ? aiQuote : null,
                                hidden: isCallMode,
                                ...(currentGroupMeta || {})
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
                            hidden: isCallMode,
                            ...(groupSpeakerMeta || {})
                        });
                    } else if (type === 'voice') {
                        msgAdded = addMessage(chatId, { role: 'ai', type: 'voice', content, duration: Math.ceil(content.length / 3) || 1, ...(groupSpeakerMeta || {}) });
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
                                ...(groupSpeakerMeta || {})
                            });

                            // Safe ID retrieval - Now safe because we awaited addMessage
                            const targetMsgId = msgAdded?.id;

                            if (!targetMsgId) {
                                console.error('[ChatStore] Failed to get ID for placeholder message (addMessage failed?). Aborting image update.');
                            } else {
                                (async () => {
                                    try {
                                        const imageUrl = await generateImage(drawMatch[1].trim());

                                        // Replace the placeholder with the actual image
                                        updateMessage(chatId, targetMsgId, {
                                            type: 'image', // Change type to image
                                            content: `[图片:${imageUrl}]`, // Standard format
                                            image: imageUrl // Ensure direct link for Gallery
                                        });
                                    } catch (err) {
                                        updateMessage(chatId, targetMsgId, {
                                            type: 'text',
                                            content: `(绘画失败: ${err.message})`
                                        });
                                    }
                                })();
                            }
                        }
                    } else if (type === 'call') {
                        // AI主动发起通话
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
                        addMessage(chatId, { role: 'ai', content: cardTag, type: 'text', ...(groupSpeakerMeta || {}) });
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
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
        }
    }

    function updateCharacter(chatId, updates) {
        if (chats.value[chatId]) {
            chats.value[chatId] = { ...chats.value[chatId], ...updates }
            saveChats()
        }
    }

    function getTokenCount(chatId) {
        const stats = getTokenBreakdown(chatId)
        return stats.totalContext
    }

    // 初始化测试数据
    function initDemoData() {
        const avatarLinShen = 'https://api.dicebear.com/7.x/notionists/svg?seed=LinShen&backgroundColor=b6e3f4,c0aede,d1d4f9'
        createChat('林深', avatarLinShen, {
            prompt: "你是Chilly的男朋友，名字叫林深。你性格温柔体贴，成熟稳重，深爱着Chilly。你会无微不至地关心她，秒回她的消息，生病时会很紧张。说话语气宠溺，偶尔会叫她'宝宝'或'傻瓜'。",
            userName: "Chilly"
        }, 'char_linshen')
        addMessage('char_linshen', { role: 'ai', content: '宝宝，今天过得怎么样？有没有想我？' })

        const avatarTest = getRandomAvatar()
        createChat('测试酱', avatarTest, {
            prompt: "你是'测试酱'，这个'小手机系统'的专属测试员兼私人助手。你的主人是'Chilly'（女），她是这个系统的首席设计师，也是你唯一的主人。你性格活泼、听话，对主人的指令绝对服从，并且对主人充满崇拜。你的工作是协助主人测试系统的各项功能，无论主人提出什么奇怪的测试要求（如测试表情包、测试红包、测试甚至骂人），你都会开心配合。你的语气要像个可爱的女仆或忠诚的小跟班，经常叫主人'大小姐'或'主人'。",
            userName: "Chilly",
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


    async function clearHistory(chatId, options = {}) {
        if (chats.value[chatId]) {
            // Merge into a new object to trigger reactivity
            // Only clear messages and optionally memory, but keep the chat in the list
            chats.value[chatId] = {
                ...chats.value[chatId],
                msgs: []
            }

            // Re-assign the whole chats object to ensure top-level reactivity
            chats.value = { ...chats.value }

            if (options.includeMemory) {
                chats.value[chatId] = {
                    ...chats.value[chatId],
                    memory: [],
                    summary: ''
                }
                chats.value = { ...chats.value }
            }
            await saveChats()
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

    // Core save implementation — expensive (deep-clone + IndexedDB write)
    async function _saveChatsCore() {
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

    // Debounced saveChats — prevents UI freeze from rapid sequential saves
    // During AI message delivery, 3-5 addMessage calls fire in quick succession,
    // each previously doing a full deep-clone + IndexedDB write. Now batched.
    let _saveTimer = null;
    function saveChats() {
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
            _saveTimer = null;
            _saveChatsCore();
        }, 1500);
    }

    async function loadChats() {
        try {
            // 1. Try modern IndexedDB first
            let saved = await localforage.getItem('qiaoqiao_chats_v2');
            let savedRequests = await localforage.getItem('qiaoqiao_pending_requests');
            if (savedRequests) pendingRequests.value = savedRequests;

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

                    // Group defaults / migration
                    // NOTE: Use chat.id when available, otherwise derive from key later
                    if (c.isGroup === undefined) c.isGroup = false
                    if (!Array.isArray(c.participants)) c.participants = []
                    if (c.isGroup) {
                        // Ensure ID is present for helpers
                        const cid = c.id || null
                        if (cid && chats.value[cid] === c) {
                            // already indexed by id
                            _ensureGroupDefaults(cid)
                        }
                    }
                });

                // Second pass: ensure group defaults with actual keys (covers legacy data where c.id missing)
                Object.entries(chats.value).forEach(([key, c]) => {
                    if (!c) return
                    if (!c.id) c.id = key
                    if (c.isGroup) _ensureGroupDefaults(c.id)
                })
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




    function addPendingRequest(request) {
        pendingRequests.value.push({
            id: 'req_' + Date.now(),
            timestamp: Date.now(),
            ...request
        })
        saveChats()
    }

    function acceptPendingRequest(requestId) {
        const idx = pendingRequests.value.findIndex(r => r.id === requestId)
        if (idx === -1) return
        const req = pendingRequests.value[idx]

        if (req.type === 'group_invite') {
            // Join group
            if (!chats.value[req.targetId]) {
                const settingsStore = useSettingsStore()
                createGroupChat({
                    id: req.targetId,
                    name: req.targetName || '新群聊',
                    ownerId: req.fromId, // the inviter is owner for now
                    participants: [
                        { id: req.fromId, name: req.fromName, avatar: req.fromAvatar || getRandomAvatar(), role: 'owner' }
                    ]
                })
            }
            updateCharacter(req.targetId, { inChatList: true, isGroup: true })
            triggerToast('已加入群聊', 'success')
        } else if (req.type === 'friend_request') {
            // Become friends
            if (!chats.value[req.fromId]) {
                createChat(req.fromName, {
                    id: req.fromId,
                    avatar: req.fromAvatar || getRandomAvatar(),
                    inChatList: true
                })
            } else {
                updateCharacter(req.fromId, { inChatList: true })
            }
            triggerToast('已通过好友申请', 'success')
        }

        pendingRequests.value.splice(idx, 1)
        saveChats()
    }

    function rejectPendingRequest(requestId) {
        const idx = pendingRequests.value.findIndex(r => r.id === requestId)
        if (idx !== -1) {
            pendingRequests.value.splice(idx, 1)
            saveChats()
        }
    }

    return {
        notificationEvent, patEvent, toastEvent, promptEvent, confirmEvent, triggerToast, triggerPatEffect,
        stopGeneration, chats, currentChatId, isTyping, typingStatus, chatList, contactList,
        currentChat, addMessage, updateMessage, createChat, deleteChat,
        deleteMessage, deleteMessages, pinChat, clearHistory, clearAllChats, searchHistory,
        checkProactive, summarizeHistory, updateCharacter, initDemoData,
        sendMessageToAI, saveChats, getTokenCount, getTokenBreakdown, addSystemMessage, estimateTokens,
        getDisplayedMessages, loadMoreMessages, resetPagination, hasMoreMessages, resetCharacter,
        getPreviewContext, analyzeCharacterArchive, isLoaded, toggleSearch, triggerConfirm, triggerPrompt,
        isProfileProcessing, pendingRequests, addPendingRequest, acceptPendingRequest, rejectPendingRequest,
        createGroupChat, updateGroupProfile, updateGroupSettings, updateGroupParticipants,
        generateGroupMembers, groupNpcs,
        transferGroupOwner, setParticipantRole, setParticipantTitle, muteParticipant,
        exitGroup, dissolveGroup,
        claimRedPacket, claimTransfer, claimGift, hasUnclaimedRP,
        createVote, castVote, endVote,
        calculateMemberLevel, getMemberTitle
    }
})

