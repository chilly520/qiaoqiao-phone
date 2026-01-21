import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { generateReply, generateSummary, generateImage, generateContextPreview } from '../utils/aiService'
import { useLoggerStore } from './loggerStore'
import { useWorldBookStore } from './worldBookStore'
import { useMomentsStore } from './momentsStore'
import { useSettingsStore } from './settingsStore'
import { useMusicStore } from './musicStore'
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
    const typingStatus = ref({}) // { chatId: boolean }
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
    const momentsStore = useMomentsStore()

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

    const currentChat = computed(() => {
        if (!currentChatId.value || !chats.value[currentChatId.value]) return null

        const chat = chats.value[currentChatId.value];

        // REAL-TIME FILTER: Remove JSON fragments from display
        if (chat.msgs && Array.isArray(chat.msgs)) {
            const headerPattern = /^\{\s*["']type["']\s*:\s*["']html["']\s*,\s*["']html["']\s*:\s*["']\s*$/;

            chat.msgs = chat.msgs.filter(m => {
                // Filter out undefined/null/empty content for non-special types
                if (m.type !== 'image' && m.type !== 'sticker' && m.type !== 'voice' && m.type !== 'redpacket' && m.type !== 'transfer' && m.type !== 'family_card' && m.type !== 'moment_card') {
                    const s = String(m.content || '').trim();
                    // Strict check: if it's literally "undefined" or empty
                    if (!s || s === 'undefined' || s === 'null') {
                        // Check if there is specialized type data (like HTML)
                        if (!m.html && !m.forceCard) {
                            return false; // Don't display garbage bubbles
                        }
                    }
                }

                if (!m.content || typeof m.content !== 'string') return true;
                const trimmed = m.content.trim();

                // Filter header fragment
                if (headerPattern.test(trimmed)) {
                    console.log('[CurrentChat] Hiding header fragment in real-time');
                    return false;
                }

                // Filter tail fragment
                if (trimmed === '"' || trimmed === '"}' || trimmed === '" }' || trimmed === "'}'" || trimmed === "' }") {
                    console.log('[CurrentChat] Hiding tail fragment in real-time:', trimmed);
                    return false;
                }

                return true;
            });
        }

        return {
            id: currentChatId.value,
            ...chat
        }
    })

    // Actions
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
            const tagMatch = detectionContent.match(/^[\[【](发红包|红包|转账|图片|表情包|DRAW|语音|VIDEO|FILE|LOCATION|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT)\s*[:：]\s*([^:：\]】]+)(?:\s*[:：]\s*([^\]】]+))?[\]】]$/i)

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
                } else if (tagType === '图片' || tagType === 'DRAW') {
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
                } else if (tagType.includes('FAMILY_CARD')) {
                    newMsg.type = 'family_card'
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
                'heartbeat': 'heartbeatMoment', '心动时刻': 'heartbeatMoment'
            };

            while ((match = bioRegex.exec(newMsg.content)) !== null) {
                const key = match[1].trim().toLowerCase();
                let val = match[2].trim();

                // Strip any HTML tags the AI might have included (ends "html" issue)
                val = val.replace(/<[^>]*>/g, '').trim();

                // Double check bio exists here to prevent "Cannot set properties of undefined"
                if (!chat.bio) chat.bio = {};

                if (keyMap[key]) {
                    chat.bio[keyMap[key]] = val;
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
        if (newMsg.role === 'ai' && (newMsg.content.includes('[MOMENT_SHARE:') || newMsg.content.includes('[分享朋友圈:'))) {
            const shareRegex = /\[(?:MOMENT_SHARE|分享朋友圈):\s*([\s\S]*?)\]/i;
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

        // [MOVED UP] 7. Call Logic (Control & Content Interception)
        // Must be done BEFORE adding to chat history to prevent pollution
        const { useCallStore } = await import('./callStore')
        const callStore = useCallStore()
        let content = newMsg.content || '' // Local content var
        const isCallActive = callStore.status === 'active';

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
                // BUGFIX: Do NOT revive if status is 'ended' or 'none'. Only accept if dialing/incoming.
                // This prevents "Zombie Calls" where user hangs up but AI sends one last packet.
                if (callStore.status === 'incoming' || callStore.status === 'dialing') {
                    console.log('[ChatStore] Auto-accepting established call due to protocol data');
                    callStore.acceptCall();
                }

                // If user hung up (none) but AI is still sending frames, we should probably output text fallback
                // but for now, let's just process it if active, otherwise ignore protocol logic to avoid hidden ghosts
                if (callStore.status !== 'active') {
                    // Fallback: If not active, do NOT hide. Let it fall through to normal text processing (if any)
                    // or if it strictly matches protocol, we might want to just show the speech part as text.
                    // IMPORTANT: Returning control here treats it as normal text below?
                    // Verify flow. If we don't set newMsg.hidden=true, it shows as text.
                } else {
                    // Extraction Logic (Only if Active)
                    let callData = null;
                    let textOutsideJson = content;
                    try {
                        const matches = content.match(/\{[\s\S]*?\}/g);
                        if (matches) {
                            const jsonCandidate = matches[matches.length - 1];
                            callData = JSON.parse(jsonCandidate);
                            textOutsideJson = content.replace(jsonCandidate, '').trim();
                        }
                    } catch (e) { console.warn('[ChatStore] Enhanced JSON parse failed fallback', e); }

                    const protocolRegex = /\[CALL_START\]([\s\S]+?)\[CALL_END\]/i;
                    const tagMatch = content.match(protocolRegex);
                    if (tagMatch) {
                        try {
                            callData = JSON.parse(tagMatch[1]);
                            textOutsideJson = content.replace(tagMatch[0], '').trim();
                        } catch (e) { }
                    }

                    if (callData || textOutsideJson) {
                        let speech = callData?.speech || callData?.["通话内容"] || callData?.text || textOutsideJson || '';
                        const action = callData?.action || callData?.["行为"] || callData?.["动作"] || '';
                        const statusVal = callData?.status || callData?.["状态"] || '';

                        // CLEAN TTS: Remove parentheses from speech
                        if (speech) {
                            speech = speech.replace(/[\(（][^\)）]*[\)）]/g, '').trim();
                        }

                        if (speech || action) callStore.addTranscriptLine('ai', speech, action);
                        if (statusVal) callStore.updateStatus(statusVal);
                        if (callData?.hangup) callStore.endCall();
                    }
                    newMsg.hidden = true; // Stay in history for context, but out of chat bubbles
                    return; // Stop processing this message as text
                }
            }

            // Priority 3: Fallback for Normal Text during Active Call
            // FIX: Do NOT hide normal text messages even if call is active. Only hide Protocol.
            // This prevents "Missing Message" bugs if call state desyncs.
            if (isCallActive && content && !content.includes('[CALL_START]')) {
                // REVERT: User explicitly requested TO KEEP parentheses if AI outputs them.
                // let cleanText = content.replace(/\[.*?\]/g, '').trim();
                // if (/^[\(（].*[\)）]$/.test(cleanText)) {
                //    cleanText = cleanText.substring(1, cleanText.length - 1).trim();
                // }

                // If we have content, we should SHOW it, not hide it.
                // callStore.addTranscriptLine('ai', cleanText); 
                // newMsg.hidden = true; // DISABLED HIDING
            }

            // --- Final context & Hiding Check ---
            // Tag stripping patterns for checking if bubble will be empty
            const protocolTags = [
                /\{[\s\S]*?("speech"|"status"|"action"|"转发"|"心声"|"行为")[\s\S]*?\}/gi,
                /\[CALL_START\][\s\S]*?\[CALL_END\]/gi, /\[CALL_START\]|\[CALL_END\]/gi,
                /\[语音通话\]|\[视频通话\]|\[接听\]|\[挂断\]|\[拒绝\]/gi,
                /\[(?:UPDATE_)?BIO:[^\]]+\]/gi,
                /\[MOMENT_SHARE:[^\]]+\]|\[分享朋友圈:[^\]]+\]/gi,
                /\[一起听歌:[^\]]+\]|\[停止听歌\]|<bgm>[\s\S]*?<\/bgm>/gi,
                /\[领取红包:[^\]]+\]|\[领取转账:[^\]]+\]/gi,
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
            const match = content.match(/\[FAMILY_CARD:(\d+):([^\]]+)\]/)
            const cardName = match ? match[2] : '亲属卡'
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

        // No toast or system message here as requested by user - let the UI spinner handle it
        typingStatus.value[chatId] = true;

        try {
            // Source Data Collection - As requested by user
            const charPrompt = chat.prompt || '暂无详细设定';
            const userPersona = chat.userPersona || userProfile.persona || '无';
            const userContext = `姓名：${userProfile.name} | 性别：${userProfile.gender || '未知'} | 个性：${userProfile.signature || ''} | 针对性设定：${userPersona}`;

            // Full Memory Bank (Latest Summary + Historical Summaries)
            const latestSummary = chat.summary || '';
            const historicalMemories = (chat.memory || []).join('\n');
            const fullMemoryLibrary = [latestSummary, historicalMemories].filter(s => s.trim()).join('\n\n') || '尚未建立持久记忆';

            // Custom Context Limit from Chat Settings
            const contextLimit = parseInt(chat.contextLimit) || 30;
            const contextMsgs = chat.msgs.slice(-contextLimit)
                .filter(m => m.role !== 'system')
                .map(m => `${m.role === 'user' ? userProfile.name : chat.name}: ${m.content}`)
                .join('\n');

            const systemInstructions = `你现在是【${chat.name}】本人。请基于以下提供的【源数据库】，深度挖掘并以第一人称“我”的视角补全你自己的“灵魂档案”。
档案内容必须完全符合你的性格、语气和对 ${userProfile.name} 的情感底色。不要以分析师的口吻说话。

必须且只能使用 [BIO:键:值] 格式输出以下字段，不要输出任何开场白或解释。
禁止在键或值中包含任何 HTML 代码、CSS 或其他编程语言（禁止任何 <div> 等标签）。
严禁将键名作为占位符原样输出（严禁输出“物品名”，必须替换为真实的物品名）。

【源数据库】
1. 角色人设 (${chat.name}):
${charPrompt}

2. 用户人设 (${userProfile.name}):
${userContext}

3. 总结记忆库内容:
${fullMemoryLibrary}

4. 近期 ${contextLimit} 条真实对话片段 (用于捕捉语气与情感现状):
${contextMsgs}
---

【输出规范】
[BIO:性别:值] [BIO:年龄:值] [BIO:生日:值] [BIO:星座:值] [BIO:人格:MBTI] 
[BIO:身高:值] [BIO:体重:值] [BIO:身材:描述] [BIO:职业:描述] [BIO:婚姻:描述] 
[BIO:气味:描述] [BIO:风格:描述] [BIO:理想型:描述] [BIO:心动时刻:描述] 
[BIO:爱好:值] (可多个) [BIO:特质:值] (可多个) 
[BIO:Routine_awake:描述] [BIO:Routine_busy:描述] [BIO:Routine_deep:描述] 
[BIO:SoulBond_实际标签名称:描述内容] 
[BIO:LoveItem_1_实际物品名称:用于生图的英文Prompt] 
[BIO:LoveItem_2_实际物品名称:用于生图的英文Prompt] 
[BIO:LoveItem_3_实际物品名称:用于生图的英文Prompt]`;

            const response = await generateReply([{ role: 'system', content: systemInstructions }], chat);
            if (response && response.content) {
                addMessage(chatId, { role: 'ai', content: response.content });
            }
            triggerToast('个人档案更新成功', 'success');
        } catch (e) {
            console.error('Bio analysis failed:', e);
            triggerToast('解析失败，请检查网络', 'error');
        } finally {
            typingStatus.value[chatId] = false;
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
                // Gender Settings
                gender: options.gender || '无',
                userGender: options.userGender || '无',
                // Logic State
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
                userAvatarFrame: options.userAvatarFrame || null,
                // Personal Archive (Bio) - V6 Magazine System
                bio: {
                    gender: options.gender || '未知',
                    age: options.age || '未知',
                    birthday: options.birthday || '未知',
                    zodiac: options.zodiac || '未知',
                    mbti: options.mbti || '未知',
                    height: options.height || '未知',
                    weight: options.weight || '未知',
                    body: options.body || '未知',
                    occupation: options.occupation || '未知',
                    status: options.status || '未知',
                    scent: options.scent || '未知',
                    style: options.style || '未知',
                    hobbies: [],
                    idealType: '未知',
                    heartbeatMoment: '暂无记录',
                    traits: [],
                    routine: {
                        awake: '未知',
                        busy: '未知',
                        deep: '未知'
                    },
                    soulBonds: [],
                    loveItems: [
                        { name: '爱之物 I', image: '' },
                        { name: '爱之物 II', image: '' },
                        { name: '爱之物 III', image: '' }
                    ]
                },
                // Summary State
                summaryLimit: options.summaryLimit || 50,
                lastSummaryCount: 0,
                lastSummaryIndex: 0
            }
            saveChats()
        }
        return { id: chatId, ...chats.value[chatId] }
    }


    // --- Memory Logic ---


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

        // Use lastSummaryCount (total messages at last summary) for better diff
        const lastCount = chat.lastSummaryCount || 0
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
                if (document.visibilityState === 'visible') {
                    // Avoid double triggers within 2 seconds
                    if (Date.now() - lastForegroundTime < 2000) return
                    lastForegroundTime = Date.now()

                    console.log('[Proactive] App in foreground, checking missed triggers...');
                    Object.keys(chats.value).forEach(chatId => {
                        checkProactive(chatId)
                    })
                }
            });
        }
    }

    function checkProactive(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return

        const now = Date.now()
        const lastMsg = (chat.msgs || []).slice(-1)[0]
        const lastMsgTime = lastMsg ? lastMsg.timestamp : now
        const diffMinutes = (now - lastMsgTime) / 1000 / 60

        // Skip if already typing or waiting for reply to avoid duplicate parallel requests
        if (typingStatus.value[chatId]) return

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
                sendMessageToAI(chatId, { hiddenHint: `（你已经 ${Math.floor(diffMinutes)} 分钟没和用户互动了，要不要主动说点什么？）` })
            }
        }

        // 2. Active Chat (查岗: 离开界面后触发)
        if (chat.activeChat && currentChatId.value !== chatId) {
            if (diffMinutes >= chat.activeInterval) {
                // Here we might need a "Last Active Triggered" flag to avoid spamming
                // But for now, simple 1-time trigger logic
                if (!chat._lastActiveTriggeredTime || (now - chat._lastActiveTriggeredTime > chat.activeInterval * 60000)) {
                    chat._lastActiveTriggeredTime = now
                    const d = new Date()
                    const timeStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
                    sendMessageToAI(chatId, { hiddenHint: `（现在是${timeStr}，你已经 ${Math.floor(diffMinutes)} 分钟没和用户互动了，要不要给点反应呢？）` })
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

            // Format Special Cards for AI perception
            if (m.type === 'moment_card') {
                try {
                    const data = JSON.parse(content)
                    content = `[用户分享了一条朋友圈动态] 作者: ${data.author}, 文案: ${data.text}${data.image ? ' (包含一张图片)' : ''}`
                } catch (e) {
                    content = '[朋友圈动态]'
                }
                try {
                    const data = JSON.parse(content)
                    content = `[用户分享了一条收藏内容] 来源: ${data.source || '未知'}, 内容详情: \n${data.fullContent || data.preview || '暂无内容'}`
                } catch (e) {
                    content = '[收藏内容]'
                }
            } else if (m.type === 'voice') {
                content = `(系统:语音消息) ${content}`
            } else if (m.type === 'image' || m.type === 'sticker') {
                content = `(系统:图片消息) ${content}`
            }

            if (m.role === 'ai') {
                // Clean up history to prevent "Double Voice" pollution (Global match)
                // Relaxed to catch INNER_VOICE anywhere, not just at start
                const ivMatch = content.match(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/i)
                if (ivMatch) {
                    const ivBlock = ivMatch[0]
                    // Remove ALL Inner Voice blocks from content for history context
                    content = content.replace(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi, '').trim()

                    // Re-append the FIRST inner voice block at the end (standard format for LLM context)
                    // This ensures LLM sees: "Text content... [INNER_VOICE]...[/INNER_VOICE]"
                    // regardless of where it was originally.
                    content = content + '\n' + ivBlock
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
                id: m.id,
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: content,
                type: m.type || 'text',
                image: m.image
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
                    // 转换为小时和分钟格式
                    const hours = Math.floor(diffMinutes / 60);
                    const mins = diffMinutes % 60;
                    const timeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;
                    // More explicit system tag to ensure AI doesn't miss it
                    lastUserMsg.content += ` \n\n【系统提示：当前时间为 ${currentVirtualTime}，距离双方上一次互动时间为 ${timeStr}。请根据时长和当前时间段，在回复中表现出合理的反应（如：打招呼方式、困倦、正忙等状态）。】`
                }
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

            const result = await generateReply(context, charInfo, signal)

            // Clear controller on success
            delete abortControllers[chatId]

            if (result.error) {
                addMessage(chatId, { role: 'system', content: `[系统错误] ${result.error}` })
                return
            }

            // 3. 添加 AI 回复 (拆分消息 - Data Level Splitting)
            if (result.content) {
                // Keep FULL content (with Inner Voice) for history context
                // The UI (ChatWindow) handles hiding it via getCleanContent
                let fullContent = result.content;

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
                    } else {
                        // Recall the last AI message
                        for (let i = msgs.length - 1; i >= 0; i--) {
                            if (msgs[i].role === 'ai' && !msgs[i].isRecallTip) {
                                targetIdx = i; break;
                            }
                        }
                    }

                    if (targetIdx !== -1) {
                        const originalMsg = msgs[targetIdx]
                        const recallMsg = {
                            ...originalMsg,
                            type: 'system',
                            content: `${chat.name || '对方'}撤回了一条消息`,
                            isRecallTip: true,
                            isRecallTip: true,
                            realContent: originalMsg.content
                        }
                        msgs.splice(targetIdx, 1, recallMsg)
                        saveChats()
                        useLoggerStore().addLog('AI', '指令执行: 撤回消息', { keyword, index: targetIdx })
                    }
                }


                // --- Handle [MOMENT] Command (Enhanced with Chinese Tag Support) ---
                // REGEX FIX: Stop before next command tag, NOT just any '[' (which breaks JSON arrays)
                const momentRegex = /\[(?:MOMENT|朋友圈)\]([\s\S]*?)(?:\[\/(?:MOMENT|朋友圈)\]|(?=\[\s*(?:INNER_VOICE|DRAW|CARD|SET_AVATAR|SET_PAT|NUDGE|REPLY|红包|转账|图片|表情包))|$)/i;
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
                        const content = momentData.content || momentData.内容
                        const interactions = momentData.interactions || momentData.互动 || []
                        const imagePrompt = momentData.imagePrompt || momentData.配图 || momentData.图片

                        if (momentData && (content || momentData.html)) {
                            const newMoment = {
                                authorId: chatId,
                                content: content,
                                html: momentData.html, // Add HTML support
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
                                // If it's already a URL (AI might pass existing URL), use it
                                if (typeof imagePrompt === 'string' && (imagePrompt.startsWith('http') || imagePrompt.startsWith('data:'))) {
                                    newMoment.images.push(imagePrompt)
                                } else {
                                    const imageUrl = await generateImage(String(imagePrompt))
                                    newMoment.images.push(imageUrl)
                                }
                            }

                            momentsStore.addMoment(newMoment)

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

                // --- Handle Active Interactions [LIKE], [COMMENT], [REPLY] ---
                const likeRegex = /\[LIKE[:：]\s*(m-[^\]]+)\]/gi;
                let likeMatch;
                while ((likeMatch = likeRegex.exec(properlyOrderedContent)) !== null) {
                    momentsStore.addLike(likeMatch[1], chatId, chat.name);
                }

                const commentRegex = /\[COMMENT[:：]\s*(m-[^\]]+)[:：]\s*([\s\S]+?)\]/gi;
                let commentMatch;
                while ((commentMatch = commentRegex.exec(properlyOrderedContent)) !== null) {
                    momentsStore.addComment(commentMatch[1], {
                        authorId: chatId,
                        authorName: chat.name,
                        content: commentMatch[2].trim()
                    });
                }

                const momentActionReplyRegex = /\[REPLY[:：]\s*(m-[^\]]+)[:：]\s*(c-[^\]]+)[:：]\s*([\s\S]+?)\]/gi;
                let momentActionReplyMatch;
                while ((momentActionReplyMatch = momentActionReplyRegex.exec(properlyOrderedContent)) !== null) {
                    const momentId = momentActionReplyMatch[1];
                    const commentId = momentActionReplyMatch[2];
                    const content = momentActionReplyMatch[3].trim();

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
                    .replace(/\[MUSIC:\s*.*?\]/gi, '') // Remove MUSIC command tags
                    // Aggressively clean AI's manual quote explanations like "引用来自 我 的消息..."
                    .replace(/[（\(]引用来自.*?[）\)]/gi, '')
                    .replace(/引用[^：:。^！]*[：:。^！]/gi, '')
                    .trim();

                // Clean AI Hallucinations & Residual Tags & TOXIC CSS
                cleanContent = cleanContent
                    .replace(/\[Image Reference ID:.*?\]/gi, '')
                    .replace(/Here is the original image:/gi, '')
                    .replace(/\(我发送了一张图片\)/gi, '')
                    .replace(/\[\/?(MOMENT|REPLY|SET_AVATAR|FAMILY_CARD|FAMILY_CARD_APPLY|FAMILY_CARD_REJECT)\]/gi, '')
                    // Strip system context hints parrotted by AI
                    .replace(/[\[\(]?(系统|System)[:：\s]*(图片|语音|IMAGE|VOICE)消息[\]\)]?/gi, '')
                    .replace(/\[(?:图片消息|语音消息)\]/gi, '')
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

                // --- Improved Splitting Logic (V11 - Balanced Aware) ---
                // We split by punctuation but keep segments meaningful.
                // Avoid capturing nested parentheses in the split pattern itself if possible

                // FIX: Explicitly capture [INNER_VOICE]...[/INNER_VOICE] as a single block to prevent splitting by newlines inside JSON
                const splitRegex = /(__CARD_PLACEHOLDER_\d+__|\[\s*INNER[\s-_]*VOICE\s*\][\s\S]*?(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\[)|$)|\[DRAW:.*?\]|\[(?:表情包|表情-包)[:：].*?\]|\[FAMILY_CARD(?:_APPLY|_REJECT)?:[\s\S]*?\]|\[CARD\][\s\S]*?(?=\n\n|\[\/CARD\]|$)|\([^\)]+\)|（[^）]+）|“[^”]*”|"[^"]*"|‘[^’]*’|'[^']*'|\[图片[:：]?.*?\]|\[语音[:：]?.*?\]|\[(?!INNER_VOICE|CARD)[^\]]+\]|[!?;。！？；…\n]+)/;
                const rawParts = processedContent.split(splitRegex);

                useLoggerStore().debug(`[Split] Parts count: ${rawParts.length}`);

                let rawSegments = [];
                let currentRawSegment = "";

                for (let i = 0; i < rawParts.length; i++) {
                    const part = rawParts[i];
                    if (part === undefined) continue;

                    const trimmedPart = part.trim();
                    const isSpecial = /^(__CARD_PLACEHOLDER_\d+__|\[\s*INNER|\[DRAW:|\[(?:表情包|表情-包)[:：]|\[语音:|\[CARD\]|\[FAMILY_CARD|\(|（)/.test(trimmedPart);
                    const isPunctuation = /^[!?;。！？；…\n]+$/.test(part);

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
                    } else if (/^\[(?:表情包|表情-包)[:：].*?\]$/.test(content.trim())) {
                        // Keep full content (tag) so frontend can parse it with regex
                        finalSegments.push({ type: 'sticker', content: content.trim() });
                    } else if (content.startsWith('[语音')) {
                        // Support both [语音:text] and [语音消息] text
                        let voiceContent = content.replace(/^\[语音(消息)?[:：]?\s*/, '').replace(/\]$/, '');
                        finalSegments.push({ type: 'voice', content: voiceContent.trim() });
                    } else if (content.startsWith('[图片')) {
                        // AI sometimes outputs [图片] or [图片消息]
                        finalSegments.push({ type: 'text', content: '[图片]' }); // Handled as image msg by type: 'text' + content: '[图片]'
                    } else if (content.startsWith('[DRAW:')) {
                        finalSegments.push({ type: 'draw', content: content.trim() });
                    } else {
                        // Standard Text: Apply Toxic CSS Filter HERE only
                        const toxicKeywords = ['border-radius', 'box-shadow', 'background', 'background-image', 'linear-gradient', 'isplay: flex', 'display: flex', 'justify-content', 'align-items', 'min-width', 'max-width', 'min-height', 'z-index', 'overflow', 'position: relative', 'position: absolute', 'padding', 'margin', 'font-size', 'font-weight', 'text-align', 'line-height', 'left:', 'top:', 'right:', 'bottom:', 'width:', 'height:', 'filter:', 'blur(', 'opacity'];
                        const cssLineRegex = /^\s*[a-z-]+\s*:\s*[^:]{1,100}(?:;|px|em|rem|%|vw|vh)\s*$/i;

                        let filtered = content;
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
                                pendingSystemMsgs.push(`${chat.name}领取了你的${claimMatch[1]}`);
                            }
                        }
                        // (Add similar logic for reject if needed)

                        msgContent = msgContent.replace(/\[领取(红包|转账):[^\]]+\]/g, '').replace(/\[(退回|拒收)(红包|转账):[^\]]+\]/g, '').trim();
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
                            } catch (e) { /* Fallback to raw */ }

                            msgAdded = addMessage(chatId, { role: 'ai', type: 'html', content: processedHtml, html: extractedHtml, quote: i === 0 ? aiQuote : null });
                        } else {
                            // Text Message Delivery
                            const rpMatch = msgContent.match(/\[(红包|转账)\s*[:：]\s*([0-9.]+)\s*[:：]\s*(.*?)\]/);
                            let msgType = 'text', amount = null, note = null;
                            if (rpMatch) {
                                msgType = rpMatch[1] === '红包' ? 'redpacket' : 'transfer';
                                amount = parseFloat(rpMatch[2]) || 1.0;
                                note = rpMatch[3];
                            } else if (msgContent.includes('[FAMILY_CARD')) {
                                msgType = 'family_card';
                            }

                            if (i === 0 && innerVoiceBlock) msgContent += '\n' + innerVoiceBlock;

                            msgAdded = addMessage(chatId, { role: 'ai', type: msgType, content: msgContent, amount, note, quote: i === 0 ? aiQuote : null });
                        }

                        pendingSystemMsgs.forEach(txt => addMessage(chatId, { role: 'system', content: txt }));

                    } else if (type === 'sticker') {
                        // Ensure sticker content is just the name/filename if needed, or keeping full tag if components handle it
                        // The store usually expects just the name or url depending on implementation. 
                        // Based on ChatMessageItem, type 'sticker' usually expects content to be the sticker name or url.
                        // We stripped the brackets in the segmenting phase above.
                        msgAdded = addMessage(chatId, { role: 'ai', type: 'sticker', content, quote: i === 0 ? aiQuote : null });
                    } else if (type === 'voice') {
                        msgAdded = addMessage(chatId, { role: 'ai', type: 'voice', content, duration: Math.ceil(content.length / 3) || 1 });
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
                                quote: i === 0 ? aiQuote : null
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
            useLoggerStore().addLog('ERROR', 'AI响应处理失败', e.message);
            if (!(e.name === 'QuotaExceededError' || e.code === 22)) {
                addMessage(chatId, { role: 'system', content: `请求失败: ${e.message}` });
            }
        } finally {
            typingStatus.value[chatId] = false;
            delete abortControllers[chatId];
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
                            if (m.type === 'html') return true;
                            const s = String(m.content).trim();
                            // Filter toxic leftovers
                            const headerPattern = /^\{\s*["']type["']\s*:\s*["']html["']\s*,\s*["']html["']\s*:\s*["']\s*$/;
                            if (headerPattern.test(s)) return false;
                            if (s === '"' || s === '"}' || s === '" }' || s === "'}'" || s === "' }") return false;
                            if (s.includes('display:') && s.includes('flex')) return false;
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

    return {
        notificationEvent, patEvent, toastEvent, triggerToast, triggerPatEffect,
        stopGeneration, chats, currentChatId, isTyping, typingStatus, chatList, contactList,
        currentChat, addMessage, updateMessage, createChat, deleteChat,
        deleteMessage, deleteMessages, pinChat, clearHistory, clearAllChats,
        checkProactive, summarizeHistory, updateCharacter, initDemoData,
        sendMessageToAI, saveChats, getTokenCount, getTokenBreakdown, addSystemMessage, estimateTokens,
        getDisplayedMessages, loadMoreMessages, resetPagination, hasMoreMessages, resetCharacter,
        getPreviewContext, analyzeCharacterArchive, isLoaded
    }
})
