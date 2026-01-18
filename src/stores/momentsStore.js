import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import { useWorldBookStore } from './worldBookStore'
import { generateMomentContent, generateBatchMomentsWithInteractions, generateBatchInteractions, generateReplyToComment } from '../utils/aiService'

export const useMomentsStore = defineStore('moments', () => {
    const chatStore = useChatStore()
    const settingsStore = useSettingsStore()
    const worldBookStore = useWorldBookStore()

    // --- State ---
    const moments = ref(JSON.parse(localStorage.getItem('wechat_moments') || '[]'))
    const lastGenerateTime = ref(parseInt(localStorage.getItem('wechat_moments_last_gen') || '0'))
    const notifications = ref(JSON.parse(localStorage.getItem('wechat_moments_notifications') || '[]'))
    const topMoments = ref(JSON.parse(localStorage.getItem('wechat_moments_top') || '[]')) // IDs of pinned moments (max 3)
    const summoningIds = ref(new Set()) // Track moments currently being interacted by AI

    // Configs - Initialize from LocalStorage
    const savedConfig = JSON.parse(localStorage.getItem('wechat_moments_config') || '{}')
    const config = ref({
        autoGenerateInterval: savedConfig.autoGenerateInterval !== undefined ? savedConfig.autoGenerateInterval : 30,
        enabledCharacters: savedConfig.enabledCharacters || [],
        enabledWorldBookEntries: savedConfig.enabledWorldBookEntries || [],
        customPrompt: savedConfig.customPrompt || ''
    })

    // Persistence
    watch(moments, (val) => {
        localStorage.setItem('wechat_moments', JSON.stringify(val))
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

    // --- Getters ---
    const sortedMoments = computed(() => {
        const all = [...moments.value]
        // Sort by Pinned First, then by Timestamp
        return all.sort((a, b) => {
            const aPinned = topMoments.value.includes(a.id)
            const bPinned = topMoments.value.includes(b.id)
            if (aPinned && !bPinned) return -1
            if (!aPinned && bPinned) return 1
            return b.timestamp - a.timestamp
        })
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

        moments.value.push(moment)

        // Handle pre-defined interactions (from AI)
        if (data.interactions && Array.isArray(data.interactions)) {
            data.interactions.forEach(inter => {
                if (inter.type === 'like') {
                    addLike(id, inter.authorId || null, inter.author || '神秘人')
                } else if ((inter.type === 'comment' || inter.type === 'reply') && inter.text) {
                    addComment(id, {
                        authorName: inter.author,
                        authorId: inter.authorId || null,
                        content: inter.text,
                        replyTo: inter.replyTo || null,
                        isVirtual: !inter.authorId
                    })
                }
            })
        }

        if (!options.skipAutoInteraction && !data.interactions) {
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

        if (!canInteractWithMoment(moment, authorNameOrId)) return

        let realChar = null
        if (authorNameOrId !== 'user') {
            // Try explicit lookup if it looks like an ID
            if (chatStore.chats[authorNameOrId]) {
                realChar = chatStore.chats[authorNameOrId]
            } else {
                // Fuzzy lookup
                realChar = Object.values(chatStore.chats).find(c => c.id === authorNameOrId || c.name === authorNameOrId || (c.remark && c.remark === authorNameOrId))
            }

            // Double check with fallbackName if explicit lookup failed but we have a name
            if (!realChar && fallbackName) {
                realChar = Object.values(chatStore.chats).find(c => c.name === fallbackName || c.remark === fallbackName)
            }
        }

        let displayName = fallbackName || authorNameOrId
        if (realChar) {
            displayName = realChar.remark || realChar.name
        } else {
            // Heuristic to detect garbage IDs/technical strings, but allow hyphens for valid names like "A-Small-Wang"
            const isGarbageId = (str) => {
                if (!str) return false
                // If it starts with 'virtual-', it's an ID
                if (str.startsWith('virtual-')) return true
                // If it's a long alphanumeric string (UUID-like)
                if (/^[a-z0-9-]{20,}$/.test(str)) return true
                return false
            }

            if (isGarbageId(authorNameOrId)) {
                // If the primary ID is garbage, fallback to the provided name
                // If fallback name is ALSO garbage or missing, then it's Mysterious
                if (!fallbackName || isGarbageId(fallbackName)) {
                    displayName = '神秘好友'
                } else {
                    displayName = fallbackName
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
                    // Fix: Use Real Char Avatar if available, otherwise generated one based on NAME (stable), not ID (which might change or be null)
                    actorAvatar: realChar ? (realChar.avatar || '/avatars/default.png') : `https://api.dicebear.com/7.x/notionists/svg?seed=${displayName}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
                    content: '赞了你的动态',
                    momentId: moment.id,
                    momentImage: moment.images[0] || null,
                    timestamp: Date.now()
                })
            }
        }
    }

    function removeLike(momentId, authorId) {
        const moment = moments.value.find(m => m.id === momentId)
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
            // Priority 1: Try to find real char by ID
            if (comment.authorId && chatStore.chats[comment.authorId]) {
                realChar = chatStore.chats[comment.authorId]
            }
            // Priority 2: Try to find by Name
            else if (comment.authorName) {
                realChar = Object.values(chatStore.chats).find(c => c.name === comment.authorName || c.remark === comment.authorName)
            }

            if (realChar) {
                finalAuthorName = realChar.remark || realChar.name
                finalAuthorAvatar = realChar.avatar || '/avatars/default.png'
            }
        }

        // Fallback for Virtual characters (NPCs) or failed lookups
        if (!finalAuthorName) finalAuthorName = comment.authorName || '神秘好友'
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
            const userInteracted = moment.likes.includes(settingsStore.personalization.userProfile.name) ||
                moment.comments.some(c => c.authorId === 'user')

            if (isReplyToUser || (isUserMoment && !comment.replyTo)) {
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

        chatStore.triggerToast('正在召唤朋友前来互动...', 'info')

        const allCharIds = Object.keys(chatStore.chats)
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
            return {
                id,
                name: chat.name,
                persona: chat.prompt,
                recentChats: (chat.msgs || []).slice(-20).map(m => `${m.role === 'user' ? '用户' : chat.name}: ${m.content}`).join('\n'),
                worldContext: (chat.tags || []).join(', ')
            }
        }).filter(char => canInteractWithMoment(moment, char.id))

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
            chatStore.triggerToast('召唤成功！', 'success')
        } catch (e) {
            console.error('[MomentsStore] Summon failed', e)
        } finally {
            summoningIds.value.delete(momentId)
        }
    }

    async function triggerCommentReply(momentId, userComment) {
        const moment = moments.value.find(m => m.id === momentId)
        if (!moment) return

        const potentialRepliers = []
        if (moment.authorId !== 'user' && chatStore.chats[moment.authorId]) {
            potentialRepliers.push({ id: moment.authorId, priority: 'high', char: chatStore.chats[moment.authorId] })
        }

        if (potentialRepliers.length === 0) return

        const replier = potentialRepliers[0]
        if (Math.random() > 0.8) return

        await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))

        try {
            const reply = await generateReplyToComment({
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

    // Auto Gen Loop
    let autoGenTimer = null
    function startAutoGeneration() {
        if (autoGenTimer) clearInterval(autoGenTimer)
        const intervalMs = config.value.autoGenerateInterval * 60 * 1000
        if (intervalMs <= 0) return
        autoGenTimer = setInterval(() => {
            if (Math.random() > 0.6) batchGenerateAIMoments(1)
        }, intervalMs)
    }

    async function batchGenerateAIMoments(count = 1, specificCharacters = null) {
        const candidates = specificCharacters || Object.keys(chatStore.chats).filter(id => config.value.enabledCharacters.includes(id))
        if (candidates.length === 0) return

        const chars = candidates.map(id => ({ id, name: chatStore.chats[id].name, persona: chatStore.chats[id].prompt, recentChats: '' }))
        try {
            // 1. Get custom prompt from config
            const customPrompt = config.value.customPrompt

            // 2. Get active world book content
            let worldContext = ''
            if (config.value.enabledWorldBookEntries.length > 0) {
                const books = worldBookStore.books || []
                const allEntries = books.flatMap(b => b.entries || [])
                const activeEntries = allEntries.filter(e => config.value.enabledWorldBookEntries.includes(e.id))
                worldContext = activeEntries.map(e => `[${e.name}]: ${e.content}`).join('\n')
            }

            const momentsData = await generateBatchMomentsWithInteractions({
                characters: chars,
                worldContext: worldContext,
                customPrompt: customPrompt,
                userProfile: { name: settingsStore.personalization.userProfile.name, signature: settingsStore.personalization.userProfile.signature },
                count
            })

            for (const data of momentsData) {
                const moment = addMoment({
                    authorId: data.authorId,
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
        } catch (e) { console.error(e) }
    }

    function addNotification(payload) {
        notifications.value.unshift({ id: 'n-' + Date.now(), isRead: false, ...payload })
    }

    function markNotificationsRead() {
        notifications.value.forEach(n => n.isRead = true)
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
        clearMyMoments, startAutoGeneration, batchGenerateAIMoments
    }
})
