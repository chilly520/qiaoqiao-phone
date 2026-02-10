import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import { useWorldBookStore } from './worldBookStore'
import { useLoggerStore } from './loggerStore'
import localforage from 'localforage'

// Configure localforage for moments
const momentsDB = localforage.createInstance({
    name: 'qiaoqiao-phone',
    storeName: 'moments'
});

export const useMomentsStore = defineStore('moments', () => {
    // Moved useStore calls inside functions to avoid circular instantiation

    // --- State ---
    const moments = ref([])
    const lastGenerateTime = ref(parseInt(localStorage.getItem('wechat_moments_last_gen') || '0'))
    const notifications = ref(JSON.parse(localStorage.getItem('wechat_moments_notifications') || '[]'))
    const topMoments = ref(JSON.parse(localStorage.getItem('wechat_moments_top') || '[]'))
    const summoningIds = ref(new Set())

    // Async Initialization
    const isInitialized = ref(false)
    async function initStore() {
        try {
            const savedMoments = await momentsDB.getItem('all_moments')
            if (savedMoments && Array.isArray(savedMoments)) {
                // Merge persisted moments with any added during the async initialization window
                const currentCount = moments.value.length
                moments.value = [...savedMoments, ...moments.value]
                console.log(`[MomentsStore] DB Loaded ${savedMoments.length} items. Merged with ${currentCount} new items.`)
            }
            isInitialized.value = true
        } catch (e) {
            console.error('[MomentsStore] DB Init failed', e)
            moments.value = JSON.parse(localStorage.getItem('wechat_moments') || '[]')
            isInitialized.value = true
        }
    }
    initStore()

    const config = ref({
        autoGenerateInterval: 30,
        enabledCharacters: [],
        enabledWorldBookEntries: [],
        customPrompt: ''
    })

    const backgroundUrl = ref(localStorage.getItem('moments_background') || '/默认背景图/橙玫瑰.png')

    // Load static configs from localStorage (they are small)
    try {
        const savedConfig = JSON.parse(localStorage.getItem('wechat_moments_config') || '{}')
        if (savedConfig.autoGenerateInterval !== undefined) config.value.autoGenerateInterval = savedConfig.autoGenerateInterval
        config.value.enabledCharacters = savedConfig.enabledCharacters || []
        config.value.enabledWorldBookEntries = savedConfig.enabledWorldBookEntries || []
        config.value.customPrompt = savedConfig.customPrompt || ''
    } catch (e) { }

    // Persistence
    watch(moments, async (val) => {
        if (!isInitialized.value) return
        await momentsDB.setItem('all_moments', JSON.parse(JSON.stringify(val)))
    }, { deep: true })

    watch(notifications, (val) => {
        localStorage.setItem('wechat_moments_notifications', JSON.stringify(val))
    }, { deep: true })

    watch(topMoments, (val) => {
        localStorage.setItem('wechat_moments_top', JSON.stringify(val))
    }, { deep: true })

    watch(config, (val) => {
        localStorage.setItem('wechat_moments_config', JSON.stringify(val))
    }, { deep: true })

    watch(backgroundUrl, (val) => {
        localStorage.setItem('moments_background', val)
    })

    // --- Getters ---
    const sortedMoments = computed(() => {
        const all = [...moments.value]
        // Global feed sorts strictly by Timestamp
        return all.sort((a, b) => b.timestamp - a.timestamp)
    })

    // --- Actions ---

    function addMoment(data, options = {}) {
        const id = 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
        const moment = {
            id,
            authorId: data.authorId,
            content: data.content,
            images: data.images || [],
            imageDescriptions: data.imageDescriptions || [],
            stickers: data.stickers || [],
            location: data.location || '',
            html: data.html || null,
            timestamp: Date.now(),
            likes: [], // Store display names
            comments: [],
            visibility: data.visibility || 'public',
            visibleIds: data.visibleIds || [],
            mentions: data.mentions || [], // Array of { id: string|null, name: string }
            baseLikeCount: Math.floor(Math.random() * 5000) + 10 // Simulating popularity
        }

        moments.value = [...moments.value, moment]

        // Notification Logic: Mentioned in post
        if (data.authorId !== 'user') {
            const chatStore = useChatStore()
            const settingsStore = useSettingsStore()
            const userName = settingsStore.personalization.userProfile.name
            const userWechatId = settingsStore.personalization.userProfile.wechatId

            // Improve Mention Detection: support string array and object array
            const isMentioned = (data.mentions || []).some(m => {
                if (typeof m === 'string') {
                    return m === userName || (userWechatId && m === userWechatId) || m === 'user'
                }
                return m.id === 'user' || m.name === userName
            })

            if (isMentioned) {
                // Robust character lookup for notification source
                const lookupId = data.authorId
                let char = chatStore.chats[lookupId]
                if (!char) {
                    char = Object.values(chatStore.chats).find(c =>
                        c.id === lookupId || c.wechatId === lookupId || c.name === lookupId || c.remark === lookupId
                    )
                }

                addNotification({
                    type: 'mention',
                    actorName: char ? (char.remark || char.name) : '神秘好友',
                    actorAvatar: char ? char.avatar : '/avatars/default.png',
                    content: '提到了你',
                    momentId: moment.id,
                    momentImage: moment.images[0] || null,
                    timestamp: moment.timestamp
                })
            }
        }

        // Handle pre-defined interactions (from AI)
        if (data.interactions && Array.isArray(data.interactions)) {
            data.interactions.forEach(inter => {
                const authorId = inter.authorId || null
                const authorName = inter.authorName || inter.author || inter.authorName // Unified
                const text = inter.content || inter.text

                if (inter.type === 'like') {
                    addLike(id, authorId || authorName, authorName)
                } else if ((inter.type === 'comment' || inter.type === 'reply') && text) {
                    addComment(id, {
                        authorName: authorName,
                        authorId: authorId,
                        content: text,
                        replyTo: inter.replyTo || null,
                        isVirtual: inter.isVirtual || !authorId
                    })
                }
            })
        }

        if (!options.skipAutoInteraction && (!data.interactions || data.interactions.length === 0)) {
            // New post triggers AI thinking/interactions (only if AI didn't pre-define them)
            // This applies to both User posts and AI Character posts
            triggerAIInteractions(id)
        }

        return moment
    }

    function updateMoment(id, updates) {
        const idx = moments.value.findIndex(m => m.id === id)
        if (idx > -1) {
            moments.value[idx] = { ...moments.value[idx], ...updates }
        }
    }

    function deleteMoment(id) {
        moments.value = moments.value.filter(m => m.id !== id)
        topMoments.value = topMoments.value.filter(tid => tid !== id)
    }

    function toggleTopMoment(id) {
        if (topMoments.value.includes(id)) {
            topMoments.value = topMoments.value.filter(tid => tid !== id)
            return false // Unpinned
        } else {
            // Pin limit: 3. FIFO if exceeded.
            if (topMoments.value.length >= 3) {
                topMoments.value.shift()
            }
            topMoments.value.push(id)
            return true // Pinned
        }
    }

    function clearAllMoments() {
        moments.value = []
    }

    function clearCharacterMoments(charId) {
        moments.value = moments.value.filter(m => m.authorId !== charId)
    }

    function clearMyMoments() {
        moments.value = moments.value.filter(m => m.authorId !== 'user')
    }

    function canInteractWithMoment(moment, authorNameOrId) {
        if (!moment) return false
        const settingsStore = useSettingsStore()
        const chatStore = useChatStore()
        const userName = settingsStore.personalization.userProfile.name
        const isUser = authorNameOrId === 'user' || authorNameOrId === userName

        // Private: No one can interact
        if (moment.visibility === 'private') return false
        // Public: Everyone can interact
        if (moment.visibility === 'public') return true
        // For Partial/Exclude, find the character ID
        if (isUser) return true // Author can always interact with their own non-private post

        const char = Object.values(chatStore.chats).find(c => c.name === authorNameOrId || c.id === authorNameOrId)
        if (!char) return true // Virtual NPCs are generally allowed unless we strictly define them

        if (moment.visibility === 'partial') {
            return moment.visibleIds.includes(char.id)
        }
        if (moment.visibility === 'exclude') {
            return !moment.visibleIds.includes(char.id)
        }
        return true
    }

    function addLike(momentId, authorNameOrId, fallbackName = null) {
        const moment = moments.value.find(m => m.id === momentId)
        if (!moment) return

        const chatStore = useChatStore()
        const settingsStore = useSettingsStore()

        if (!canInteractWithMoment(moment, authorNameOrId)) return

        let displayName = ''
        let realChar = null

        if (authorNameOrId === 'user') {
            displayName = settingsStore.personalization.userProfile.name
        } else {
            // Priority 1: Direct ID lookup
            if (chatStore.chats[authorNameOrId]) {
                realChar = chatStore.chats[authorNameOrId]
            }
            // Priority 2: Fuzzy lookup by other ID-like fields if not found
            if (!realChar) {
                realChar = Object.values(chatStore.chats).find(c =>
                    c.id === authorNameOrId ||
                    c.wechatId === authorNameOrId ||
                    c.name === authorNameOrId ||
                    (c.remark && c.remark === authorNameOrId)
                )
            }

            if (!realChar && fallbackName) {
                // Priority 3: Lookup by name if authorId failed
                realChar = Object.values(chatStore.chats).find(c =>
                    c.name === fallbackName ||
                    c.remark === fallbackName ||
                    (c.wechatId && c.wechatId === fallbackName)
                )
            }

            if (realChar) {
                displayName = realChar.remark || realChar.name
            } else {
                // If still not found, check if it looks like an ID
                const isIdLike = (str) => str && (str.startsWith('char_') || str.startsWith('virtual-') || /^[a-z0-9-]{20,}$/.test(str))
                if (isIdLike(authorNameOrId)) {
                    displayName = (fallbackName && !isIdLike(fallbackName)) ? fallbackName : '神秘好友'
                } else {
                    displayName = authorNameOrId || fallbackName || '神秘好友'
                }
            }
        }

        if (!moment.likes) moment.likes = []
        if (!moment.likes.includes(displayName)) {
            moment.likes.push(displayName)

            // Notify User if it's their moment
            const userName = settingsStore.personalization.userProfile.name
            if (moment.authorId === 'user' && authorNameOrId !== 'user' && authorNameOrId !== userName) {
                addNotification({
                    type: 'like',
                    actorName: displayName,
                    actorAvatar: realChar ? (realChar.avatar || '/avatars/default.png') : `https://api.dicebear.com/7.x/notionists/svg?seed=${displayName}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
                    content: '赞了你的动态',
                    momentId: moment.id,
                    momentImage: moment.images[0] || null,
                    timestamp: Date.now()
                })
            }
        }

        // Force reactivity to ensure computed properties update
        moments.value = [...moments.value]
    }

    function removeLike(momentId, authorId) {
        const moment = moments.value.find(m => m.id === momentId)
        const settingsStore = useSettingsStore()
        const userName = settingsStore.personalization.userProfile.name
        const target = authorId === 'user' ? userName : authorId
        if (moment && moment.likes) {
            moment.likes = moment.likes.filter(n => n !== target)
        }
    }

    function addComment(momentId, comment) {
        const moment = moments.value.find(m => m.id === momentId)
        if (!moment) return

        // Duplicate check: prevent identical comments in the same moment
        const isDuplicate = moment.comments.some(c => c.content.trim() === comment.content.trim())
        if (isDuplicate) return

        const settingsStore = useSettingsStore()
        const chatStore = useChatStore()

        // Resolve real contact info
        let realChar = null
        let finalAuthorName = ''
        let finalAuthorAvatar = ''

        const userName = settingsStore.personalization.userProfile.name
        const userAvatar = settingsStore.personalization.userProfile.avatar

        if (comment.authorId === 'user' || comment.authorName === 'user' || comment.authorName === userName) {
            finalAuthorName = userName
            finalAuthorAvatar = userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=Me`
        } else {
            // Priority 1: Try to find real char by chatStore key (direct lookup)
            if (comment.authorId && chatStore.chats[comment.authorId]) {
                realChar = chatStore.chats[comment.authorId]
            }
            // Priority 2: Try to find by internal id property, wechatId, name, or remark
            if (!realChar && comment.authorId) {
                realChar = Object.values(chatStore.chats).find(c =>
                    c.id === comment.authorId ||
                    c.wechatId === comment.authorId ||
                    c.name === comment.authorId ||
                    c.remark === comment.authorId
                )
            }
            // Priority 3: Try to find by Name (Case-insensitive)
            if (!realChar && comment.authorName) {
                const searchName = String(comment.authorName).toLowerCase()
                realChar = Object.values(chatStore.chats).find(c =>
                    (c.name && c.name.toLowerCase() === searchName) ||
                    (c.remark && c.remark.toLowerCase() === searchName)
                )
            }

            if (realChar) {
                finalAuthorName = realChar.remark || realChar.name
                finalAuthorAvatar = realChar.avatar || '/avatars/default.png'
            }
        }

        // Fallback for Virtual characters (NPCs) or failed lookups
        if (!finalAuthorName) {
            const isIdLike = (str) => str && (str.startsWith('char_') || str.startsWith('virtual-') || /^[a-z0-9-]{20,}$/.test(str) || /^\d{10,}$/.test(str))
            if (isIdLike(comment.authorName)) {
                finalAuthorName = '神秘好友'
            } else {
                finalAuthorName = comment.authorName || '神秘好友'
            }
        }
        if (!finalAuthorAvatar) finalAuthorAvatar = comment.authorAvatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${finalAuthorName}&backgroundColor=b6e3f4,c0aede,d1d4f9`

        // Auto-extract mentions if not provided
        const finalMentions = [...(comment.mentions || [])]
        if (finalMentions.length === 0 && comment.content && comment.content.includes('@')) {
            const userName = settingsStore.personalization.userProfile.name
            // Match @name or @name followed by space/punc
            const possibleNames = [userName, ...chatStore.contactList.map(c => c.name)]
            possibleNames.forEach(name => {
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                const mentionRegex = new RegExp(`@${escapedName}\\b|@${escapedName}(?!\\w)`, 'g')
                if (mentionRegex.test(comment.content)) {
                    const char = chatStore.contactList.find(c => c.name === name)
                    if (!finalMentions.some(m => m.name === name)) {
                        finalMentions.push({ id: char ? char.id : (name === userName ? 'user' : null), name })
                    }
                }
            })
        }

        moment.comments.push({
            id: 'c-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            authorId: realChar ? realChar.id : (comment.authorId || 'virtual-' + Date.now()),
            authorName: finalAuthorName,
            authorAvatar: finalAuthorAvatar,
            content: comment.content,
            mentions: finalMentions,
            timestamp: Date.now(),
            replyTo: comment.replyTo || null,
            isVirtual: !realChar && (comment.isVirtual || false)
        })

        // Notification Logic
        if (comment.authorId !== 'user') {
            const isReplyToUser = comment.replyTo === 'user' || comment.replyTo === settingsStore.personalization.userProfile.name
            const isUserMoment = moment.authorId === 'user'
            const userInteracted = (moment.likes || []).includes(settingsStore.personalization.userProfile.name) ||
                moment.comments.some(c => c.authorId === 'user')

            const isMentioned = finalMentions.some(m => m.id === 'user' || m.name === userName)

            if (isMentioned && !isReplyToUser && !(isUserMoment && !comment.replyTo)) {
                // Mentioned specifically (and not already notified by reply/moment logic)
                addNotification({
                    type: 'mention_comment',
                    actorName: finalAuthorName,
                    actorAvatar: finalAuthorAvatar,
                    content: `在评论中提到了你: ${comment.content}`,
                    momentId: moment.id,
                    momentImage: moment.images[0] || null,
                    timestamp: Date.now()
                })
            } else if (isReplyToUser || (isUserMoment && !comment.replyTo)) {
                addNotification({
                    type: 'comment',
                    actorName: finalAuthorName,
                    actorAvatar: finalAuthorAvatar, // Consistent Avatar
                    content: comment.content,
                    momentId: moment.id,
                    momentImage: moment.images[0] || null,
                    timestamp: Date.now()
                })
            } else if (userInteracted && !isUserMoment) {
                addNotification({
                    type: 'related_comment',
                    actorName: finalAuthorName,
                    actorAvatar: finalAuthorAvatar,
                    content: `也评论了 ${moment.authorId === 'user' ? '你' : (chatStore.chats[moment.authorId]?.name || '好友')} 的动态: ${comment.content}`,
                    momentId: moment.id,
                    momentImage: moment.images[0] || null,
                    timestamp: Date.now()
                })
            }
        }

        // Trigger AI Reply
        if (comment.authorId === 'user') {
            triggerCommentReply(moment.id, comment)
        }

        // Force reactivity for UI update
        moments.value = [...moments.value]
    }

    function deleteComment(momentId, commentId) {
        const moment = moments.value.find(m => m.id === momentId)
        if (moment && moment.comments) {
            moment.comments = moment.comments.filter(c => c.id !== commentId)
        }
    }

    async function triggerAIInteractions(momentId) {
        const moment = moments.value.find(m => m.id === momentId)
        if (!moment) return

        if (summoningIds.value.has(momentId)) return
        summoningIds.value.add(momentId)

        const chatStore = useChatStore()
        const settingsStore = useSettingsStore()

        chatStore.triggerToast('正在召唤朋友前来互动...', 'info')

        const allCharIds = chatStore.chats ? Object.keys(chatStore.chats) : []
        if (allCharIds.length === 0) {
            summoningIds.value.delete(momentId)
            return
        }

        const historicalMoments = sortedMoments.value.slice(0, 30).map(m => ({
            id: m.id,
            authorName: m.authorId === 'user' ? settingsStore.personalization.userProfile.name : (chatStore.chats[m.authorId]?.name || '神秘人'),
            content: m.content
        }))

        const charInfos = allCharIds.map(id => {
            const chat = chatStore.chats[id]
            if (!chat) return null
            return {
                id,
                name: chat.name,
                persona: chat.prompt,
                recentChats: (chat.msgs || []).slice(-20).map(m => `${m.role === 'user' ? '用户' : chat.name}: ${m.content}`).join('\n'),
                worldContext: (chat.tags || []).join(', '),
                // 传递用户对该角色的设定
                userName: chat.userName,
                userPersona: chat.userPersona
            }
        }).filter(char => char && canInteractWithMoment(moment, char.id))

        const userProfile = {
            name: settingsStore.personalization.userProfile.name,
            signature: settingsStore.personalization.userProfile.signature,
            persona: settingsStore.personalization.userProfile.persona || '一位普通的用户',
            pinnedMoments: moments.value.filter(m => topMoments.value.includes(m.id)).slice(0, 3)
        }

        const currentContext = {
            authorName: moment.authorId === 'user' ? userProfile.name : (chatStore.chats[moment.authorId]?.name || '神秘人'),
            content: moment.content,
            location: moment.location || '',
            visualContext: moment.imageDescriptions.join('; '),
            existingComments: moment.comments.map(c => ({ authorName: c.authorName, content: c.content, replyTo: c.replyTo }))
        }

        try {
            moment.baseLikeCount += Math.floor(Math.random() * 30) + 5
            const { generateBatchInteractions } = await import('../utils/aiService')
            const interactions = await generateBatchInteractions(currentContext, charInfos, historicalMoments, userProfile)

            for (const interaction of interactions) {
                await new Promise(r => setTimeout(r, 300 + Math.random() * 800))

                let avatarUrl = interaction.authorAvatar || ''
                if (interaction.isVirtual) {
                    const catAvatars = ['/avatars/小猫举爪.jpg', '/avatars/小猫星星眼.jpg', '/avatars/小猫开心.jpg', '/avatars/小猫挥手.jpg']
                    avatarUrl = catAvatars[Math.floor(Math.random() * catAvatars.length)]
                }

                if (interaction.type === 'like') {
                    addLike(momentId, interaction.authorId || interaction.authorName, interaction.authorName)
                } else if ((interaction.type === 'comment' || interaction.type === 'reply') && interaction.content) {
                    addComment(momentId, {
                        authorId: interaction.authorId,
                        authorName: interaction.authorName,
                        authorAvatar: avatarUrl,
                        content: interaction.content,
                        mentions: interaction.mentions || [],
                        replyTo: interaction.replyTo || null,
                        isVirtual: interaction.isVirtual
                    })
                }
            }
            if (interactions && interactions.length > 0) {
                chatStore.triggerToast(`召功成功！收到 ${interactions.length} 条互动`, 'success')
            } else {
                chatStore.triggerToast('大家都还在忙，暂时没人回复...', 'warning')
            }
        } catch (e) {
            console.error('[MomentsStore] Summon failed', e)
            chatStore.triggerToast(`召唤失败: ${e.message || '未知错误'}`, 'error')
        } finally {
            summoningIds.value.delete(momentId)
        }
    }

    async function triggerCommentReply(momentId, userComment) {
        const moment = moments.value.find(m => m.id === momentId)
        if (!moment) return

        const chatStore = useChatStore()
        const settingsStore = useSettingsStore()

        const potentialRepliers = []
        if (moment.authorId !== 'user' && chatStore.chats[moment.authorId]) {
            potentialRepliers.push({ id: moment.authorId, priority: 'high', char: chatStore.chats[moment.authorId] })
        }

        if (potentialRepliers.length === 0) return

        const replier = potentialRepliers[0]
        if (Math.random() > 0.8) return

        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))

        try {
            const ai = await import('../utils/aiService')
            const reply = await ai.generateReplyToComment({
                name: replier.char.name,
                persona: replier.char.prompt,
                worldContext: (replier.char.tags || []).join(', ')
            }, {
                authorName: moment.authorId === 'user' ? settingsStore.personalization.userProfile.name : (chatStore.chats[moment.authorId]?.name || '神秘人'),
                content: moment.content,
                visualContext: moment.imageDescriptions.join('; ')
            }, {
                authorName: settingsStore.personalization.userProfile.name,
                content: userComment.content
            })

            if (reply) {
                addComment(momentId, {
                    authorId: replier.id,
                    authorName: replier.char.name,
                    content: reply,
                    replyTo: userComment.authorName || '用户'
                })
            }
        } catch (e) { /* silent */ }
    }



    async function batchGenerateAIMoments(count = 1, specificCharacters = null) {
        const chatStore = useChatStore()
        const settingsStore = useSettingsStore()
        const worldBookStore = useWorldBookStore()

        const candidates = specificCharacters || (chatStore.chats ? Object.keys(chatStore.chats).filter(id => config.value.enabledCharacters.includes(id)) : [])
        if (candidates.length === 0) return

        // 1. Gather Rich Character Context (Last 50 chats + personal moments history)
        const chars = candidates.map(id => {
            const chat = chatStore.chats[id]
            if (!chat) return null

            const lastMsgs = (chat.msgs || []).slice(-50).map(m => `${m.role === 'user' ? '用户' : chat.name}: ${m.content}`).join(' | ')

            // Get last 3 personal moments for this character
            const personalHistory = moments.value
                .filter(m => m.authorId === id)
                .slice(-3)
                .map(m => m.content)
                .join(' || ')

            return {
                id,
                name: chat.name,
                persona: chat.prompt,
                recentChats: lastMsgs,
                personalHistory: personalHistory,
                // 重要：传递特定的人设信息
                userName: chat.userName,
                userPersona: chat.userPersona
            }
        }).filter(Boolean) // Remove null entries

        // 2. Gather Recent Moments Context (Last 20 moments) with details for ecosystem interactions
        const recentMomentsContext = moments.value.slice(-20).map(m => ({
            id: m.id,
            authorName: m.authorName,
            content: m.content,
            timestamp: m.timestamp,
            likes: m.likes || [],
            comments: (m.comments || []).map(c => ({
                authorName: c.authorName,
                content: c.content
            }))
        }))

        try {
            // 3. Get custom prompt from config
            const customPrompt = config.value.customPrompt

            // 4. Get active world book content
            let worldContext = ''
            if (config.value.enabledWorldBookEntries.length > 0) {
                const books = worldBookStore.books || []
                const allEntries = books.flatMap(b => b.entries || [])
                const activeEntries = allEntries.filter(e => config.value.enabledWorldBookEntries.includes(e.id))
                worldContext = activeEntries.map(e => `[${e.name}]: ${e.content}`).join('\n')
            }

            const ai = await import('../utils/aiService')
            const result = await ai.generateBatchMomentsWithInteractions({
                characters: chars,
                worldContext: worldContext,
                customPrompt: customPrompt,
                userProfile: {
                    name: settingsStore.personalization.userProfile.name,
                    signature: settingsStore.personalization.userProfile.signature,
                    persona: settingsStore.personalization.userProfile.persona
                },
                historicalMoments: recentMomentsContext,
                count
            })

            const { newMoments = [], ecosystemUpdates = [] } = result || {}

            // Process New Moments
            if (Array.isArray(newMoments)) {
                for (const data of newMoments) {
                    if (!isInitialized.value) return

                    let finalAuthorId = data.authorId
                    if (!chatStore.chats[finalAuthorId]) {
                        const mappedChar = Object.values(chatStore.chats)
                            .find(c => c.id === data.authorId || c.wechatId === data.authorId || c.name === data.authorId || c.remark === data.authorId)
                        if (mappedChar) {
                            const key = Object.keys(chatStore.chats).find(k => chatStore.chats[k] === mappedChar)
                            if (key) finalAuthorId = key
                        }
                    }

                    const moment = addMoment({
                        authorId: finalAuthorId,
                        content: data.content,
                        location: data.location,
                        images: data.images,
                        mentions: data.mentions || []
                    }, { skipAutoInteraction: true })

                    if (data.interactions) {
                        for (const inter of data.interactions) {
                            if (inter.type === 'like') addLike(moment.id, inter.authorName)
                            else if (inter.type === 'comment') addComment(moment.id, {
                                authorId: inter.authorId,
                                authorName: inter.authorName,
                                content: inter.content,
                                mentions: inter.mentions || [],
                                replyTo: inter.replyTo || null,
                                isVirtual: inter.isVirtual
                            })
                        }
                    }
                }
            }

            // Process Ecosystem Updates (Interactions for old moments)
            if (Array.isArray(ecosystemUpdates)) {
                for (const update of ecosystemUpdates) {
                    if (!isInitialized.value) return
                    const targetMoment = moments.value.find(m => m.id === update.momentId)
                    if (!targetMoment) continue

                    if (update.newInteractions) {
                        for (const inter of update.newInteractions) {
                            if (inter.type === 'like') {
                                // Only add if not already liked
                                if (!targetMoment.likes.includes(inter.authorName)) {
                                    addLike(targetMoment.id, inter.authorName)
                                }
                            } else if (inter.type === 'comment' || inter.type === 'reply') {
                                addComment(targetMoment.id, {
                                    authorId: inter.authorId,
                                    authorName: inter.authorName,
                                    content: inter.content,
                                    mentions: inter.mentions || [],
                                    replyTo: inter.replyTo || null,
                                    isVirtual: inter.isVirtual
                                })
                            }
                        }
                    }
                }
            }

        } catch (e) {
            console.error('[MomentsStore] Batch generation failed:', e)
        } finally {
            // Update last generate time regardless of success to prevent spam loops on error
            if (isInitialized.value) {
                lastGenerateTime.value = Date.now()
                localStorage.setItem('wechat_moments_last_gen', lastGenerateTime.value)
            }
        }
    }

    // Auto Gen Loop
    // --- Background Loop (Web Worker based for resilience) ---
    let autoGenWorker = null

    function startAutoGeneration() {
        if (autoGenWorker) {
            autoGenWorker.terminate()
            autoGenWorker = null
        }

        const intervalMs = config.value.autoGenerateInterval * 60 * 1000
        if (intervalMs <= 0) return

        // 1. Initial Check: Catch up if missed while closed/backgrounded
        const now = Date.now()
        const elapsed = now - lastGenerateTime.value
        if (elapsed > intervalMs) {
            console.log('[MomentsStore] Auto-gen overdue, triggering catch-up...')
            batchGenerateAIMoments(1)
        }

        // 2. Start Worker for background timing
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
        autoGenWorker = new Worker(URL.createObjectURL(blob));

        autoGenWorker.onmessage = (e) => {
            if (e.data === 'tick') {
                const logger = useLoggerStore()
                const now = new Date()
                if (now.getMinutes() % 30 === 0) {
                    logger.sys('[MomentsStore] Worker heartbeat: checking auto-generation status...')
                }

                const currentElapsed = Date.now() - lastGenerateTime.value
                if (currentElapsed >= intervalMs) {
                    logger.sys('[MomentsStore] Worker triggering batch AI generation')
                    batchGenerateAIMoments(1)
                }
            }
        }

        autoGenWorker.postMessage('start');

        // 3. Foreground Compensation
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    const catchupElapsed = Date.now() - lastGenerateTime.value
                    if (catchupElapsed >= intervalMs) {
                        console.log('[MomentsStore] Foreground return: triggering catch-up...')
                        batchGenerateAIMoments(1)
                    }
                }
            })
        }
    }

    function addNotification(payload) {
        notifications.value.unshift({ id: 'n-' + Date.now(), isRead: false, ...payload })
    }

    function markNotificationsRead() {
        notifications.value.forEach(n => n.isRead = true)
    }

    async function generateAndApplyCharacterProfile(charId, options = { includeMoments: true, includeSocial: true, includeArchive: true }) {
        const chatStore = useChatStore()
        const settingsStore = useSettingsStore()
        const worldBookStore = useWorldBookStore()

        const char = chatStore.chats[charId]
        if (!char) return

        const userProfile = {
            name: settingsStore.personalization.userProfile.name
        }

        try {
            // Get custom prompt from config
            const customPrompt = config.value.customPrompt

            // Get active world book content
            let worldContext = ''
            if (config.value.enabledWorldBookEntries.length > 0) {
                const books = worldBookStore.books || []
                const allEntries = books.flatMap(b => b.entries || [])
                const activeEntries = allEntries.filter(e => config.value.enabledWorldBookEntries.includes(e.id))
                worldContext = activeEntries.map(e => `[${e.name}]: ${e.content}`).join('\n')
            }

            const ai = await import('../utils/aiService')
            const profileData = await ai.generateCharacterProfile(char, userProfile, { customPrompt, worldContext }, options)

            // 1. Update Character Info (Signature & Background & Bio Fields)
            if (chatStore.chats[charId]) {
                const updates = {}
                if (options.includeSocial) {
                    if (profileData.signature) updates.statusText = profileData.signature
                    if (profileData.backgroundUrl) updates.momentsBackground = profileData.backgroundUrl
                }

                if (options.includeArchive && profileData.bioFields) {
                    updates.bio = {
                        ...(chatStore.chats[charId].bio || {}),
                        ...profileData.bioFields
                    }
                }

                if (Object.keys(updates).length > 0) {
                    chatStore.updateCharacter(charId, updates)
                }
            }

            // 2. Add New Moments
            if (options.includeMoments && profileData.pinnedMoments) {
                const newMomentIds = []
                for (const mData of profileData.pinnedMoments) {
                    const moment = addMoment({
                        authorId: charId,
                        content: mData.content,
                        images: mData.images,
                        visibility: 'public'
                    }, { skipAutoInteraction: true })

                    // Add AI interactions (likes/comments) if provided
                    if (mData.interactions) {
                        for (const inter of mData.interactions) {
                            if (inter.type === 'like') addLike(moment.id, inter.authorName)
                            else if (inter.type === 'comment') addComment(moment.id, {
                                authorName: inter.authorName,
                                content: inter.content,
                                isVirtual: true
                            })
                        }
                    }
                    newMomentIds.push(moment.id)
                }

                // 3. Pin Logic
                topMoments.value = topMoments.value.filter(pinnedId => {
                    const m = moments.value.find(xm => xm.id === pinnedId)
                    return m && m.authorId !== charId
                })
                topMoments.value.unshift(...newMomentIds)
                if (topMoments.value.length > 9) { // Max 9 global pins
                    topMoments.value = topMoments.value.slice(0, 9)
                }
            }

            return true
        } catch (e) {
            console.error('Failed to generate profile', e)
            throw e
        }
    }

    startAutoGeneration()

    return {
        moments, notifications, topMoments, summoningIds,
        unreadCount: computed(() => notifications.value.filter(n => !n.isRead).length),
        config, sortedMoments,
        addMoment, updateMoment, deleteMoment, toggleTopMoment,
        clearAllMoments, clearCharacterMoments,
        addLike, removeLike, addComment, deleteComment,
        triggerAIInteractions, markNotificationsRead,
        clearMyMoments, startAutoGeneration, batchGenerateAIMoments,
        generateAndApplyCharacterProfile,
        backgroundUrl
    }
})
