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

    // Configs
    const config = ref({
        autoGenerateInterval: 30, // minutes
        enabledCharacters: [], // Array of char IDs allowed to post
        enabledWorldBookEntries: [], // Array of world book entries allowed to affect moments
        customPrompt: ''
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
            baseLikeCount: Math.floor(Math.random() * 5000) + 10 // Simulating popularity
        }

        moments.value.push(moment)

        if (!options.skipAutoInteraction && data.authorId === 'user') {
            // New user post triggers AI thinking/interactions
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
            realChar = Object.values(chatStore.chats).find(c => c.id === authorNameOrId || c.name === authorNameOrId || (c.remark && c.remark === authorNameOrId))
        }

        let displayName = fallbackName || authorNameOrId
        if (realChar) {
            displayName = realChar.remark || realChar.name
        } else if (typeof authorNameOrId === 'string' && (authorNameOrId.startsWith('virtual') || authorNameOrId.includes('-') || /^[a-z0-9]{15,}$/.test(authorNameOrId))) {
            // Strictly detect/filter out garbage IDs like virtual-123 or technical hashes
            displayName = (fallbackName && !fallbackName.includes('-')) ? fallbackName : '神秘好友'
        } else if (authorNameOrId === 'user') {
            displayName = settingsStore.personalization.userProfile.name
        }

        // Final safety check: if displayName still looks like garbage, fallback to '神秘好友'
        if (displayName && (displayName.startsWith('virtual') || /^[a-zA-Z0-9-]{15,}$/.test(displayName))) {
            displayName = '神秘好友'
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
                    actorAvatar: realChar ? realChar.avatar : `https://api.dicebear.com/7.x/notionists/svg?seed=${authorNameOrId}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
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
        let realChar = Object.values(chatStore.chats).find(c => c.id === comment.authorId || c.name === comment.authorName)
        const finalAuthorName = realChar ? (realChar.remark || realChar.name) : (comment.authorName || '神秘好友')
        const finalAuthorAvatar = realChar ? realChar.avatar : (comment.authorAvatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${comment.authorName}&backgroundColor=b6e3f4,c0aede,d1d4f9`)

        moment.comments.push({
            id: 'c-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            authorId: realChar ? realChar.id : (comment.authorId || 'virtual-' + Date.now()),
            authorName: finalAuthorName,
            authorAvatar: finalAuthorAvatar,
            content: comment.content,
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
                    actorAvatar: finalAuthorAvatar,
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
                recentChats: (chat.msgs || []).slice(-10).map(m => m.content).join(' '),
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
                await new Promise(r => setTimeout(r, 800 + Math.random() * 1500))

                let avatarUrl = interaction.authorAvatar || ''
                if (interaction.isVirtual) {
                    const catAvatars = ['/avatars/小猫举爪.jpg', '/avatars/小猫星星眼.jpg', '/avatars/小猫开心.jpg', '/avatars/小猫挥手.jpg']
                    avatarUrl = catAvatars[Math.floor(Math.random() * catAvatars.length)]
                }

                if (interaction.type === 'like') {
                    addLike(momentId, interaction.authorId || interaction.authorName, interaction.authorName)
                } else if (interaction.type === 'comment' && interaction.content) {
                    addComment(momentId, {
                        authorId: interaction.authorId,
                        authorName: interaction.authorName,
                        authorAvatar: avatarUrl,
                        content: interaction.content,
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
        const candidates = specificCharacters || Object.keys(chatStore.chats).filter(id => config.value.enabledCharacters.length === 0 || config.value.enabledCharacters.includes(id))
        if (candidates.length === 0) return

        const chars = candidates.map(id => ({ id, name: chatStore.chats[id].name, persona: chatStore.chats[id].prompt, recentChats: '' }))
        try {
            const momentsData = await generateBatchMomentsWithInteractions({
                characters: chars,
                worldContext: '',
                userProfile: { name: settingsStore.personalization.userProfile.name, signature: settingsStore.personalization.userProfile.signature },
                count
            })

            for (const data of momentsData) {
                const moment = addMoment({ authorId: data.authorId, content: data.content, location: data.location, images: data.images }, { skipAutoInteraction: true })
                if (data.interactions) {
                    for (const inter of data.interactions) {
                        if (inter.type === 'like') addLike(moment.id, inter.authorName)
                        else if (inter.type === 'comment') addComment(moment.id, { authorName: inter.authorName, content: inter.content, isVirtual: inter.isVirtual })
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
        clearMyMoments, startAutoGeneration
    }
})
