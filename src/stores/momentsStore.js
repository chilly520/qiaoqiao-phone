import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import { useWorldBookStore } from './worldBookStore'
import { 
    generateMomentContent, 
    generateMomentComment, 
    generateBatchInteractions,
    generateReplyToComment,
    generateBatchMomentsWithInteractions
} from '../utils/aiService'

export const useMomentsStore = defineStore('moments', () => {
    const chatStore = useChatStore()
    const settingsStore = useSettingsStore()
    const worldBookStore = useWorldBookStore()

    // --- State ---
    const moments = ref(JSON.parse(localStorage.getItem('wechat_moments') || '[]'))
    const lastGenerateTime = ref(parseInt(localStorage.getItem('wechat_moments_last_gen') || '0'))
    const notifications = ref(JSON.parse(localStorage.getItem('wechat_moments_notifications') || '[]'))
    
    // Configs
    const config = ref({
        enabledCharacters: [], // 允许发布角色的ID列表
        enabledWorldBookEntries: [], // 选中的世界书词条ID列表
        autoGenerateInterval: 0, // 默认为0 (关闭)，避免API额度超标
        customPrompt: '', // 自定义提示词
        lastSyncProfile: { name: '', avatar: '' }
    })

    // Load initial config
    const savedConfig = localStorage.getItem('wechat_moments_config')
    if (savedConfig) {
        config.value = { ...config.value, ...JSON.parse(savedConfig) }
    }

    // --- Persistence ---
    watch(moments, (val) => {
        localStorage.setItem('wechat_moments', JSON.stringify(val))
    }, { deep: true })

    watch(notifications, (val) => {
        localStorage.setItem('wechat_moments_notifications', JSON.stringify(val))
    }, { deep: true })

    watch(config, (val) => {
        localStorage.setItem('wechat_moments_config', JSON.stringify(val))
    }, { deep: true })

    // --- Getters ---
    const sortedMoments = computed(() => {
        return [...moments.value].sort((a, b) => b.timestamp - a.timestamp)
    })

    // --- Actions ---
    function addMoment(momentData) {
        const newMoment = {
            id: momentData.id || 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            authorId: momentData.authorId || 'user',
            content: momentData.content || '',
            images: momentData.images || [],
            stickers: momentData.stickers || [],
            imageDescriptions: momentData.imageDescriptions || [],
            html: momentData.html || null,
            timestamp: momentData.timestamp || Date.now(),
            likes: [],
            comments: []
        }
        moments.value.push(newMoment)
        
        // Auto-trigger AI interactions for any new moment
        setTimeout(() => {
            triggerAIInteractions(newMoment.id)
        }, 3000 + Math.random() * 5000) // Random delay for natural feel

        return newMoment
    }

    function updateMoment(id, updates) {
        const index = moments.value.findIndex(m => m.id === id)
        if (index !== -1) {
            moments.value[index] = { ...moments.value[index], ...updates, timestamp: Date.now() } // Refresh timestamp on edit? Or keep?
            // Usually, editing might refresh the order if it's based on timestamp, but WeChat keeps it.
            // Let's NOT refresh timestamp to keep position in feed, but maybe add an 'edited' flag?
            // Actually, user might want it to jump up. Let's keep original timestamp but update content.
            moments.value[index] = { ...moments.value[index], ...updates }
        }
    }

    function deleteMoment(id) {
        moments.value = moments.value.filter(m => m.id !== id)
    }

    function clearAllMoments() {
        moments.value = []
    }

    function clearCharacterMoments(charId) {
        moments.value = moments.value.filter(m => m.authorId !== charId)
    }

    function addLike(momentId, authorName) {
        const moment = moments.value.find(m => m.id === momentId)
        if (moment && !moment.likes.includes(authorName)) {
            moment.likes.push(authorName)
            
            // Notify User if it's their moment
            if (moment.authorId === 'user' && authorName !== settingsStore.personalization.userProfile.name) {
                // Determine Actor info
                let actorAvatar = ''
                const msgStore = chatStore.chats
                const realChar = Object.values(msgStore).find(c => c.name === authorName)
                if (realChar) {
                    actorAvatar = realChar.avatar
                } else {
                     const hash = authorName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
                     actorAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${authorName}&backgroundColor=b6e3f4,c0aede,d1d4f9`
                }

                addNotification({
                    type: 'like',
                    actorName: authorName,
                    actorAvatar: actorAvatar,
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
        if (moment) {
            moment.likes = moment.likes.filter(id => id !== authorId)
        }
    }

    function addComment(momentId, comment) {
        const moment = moments.value.find(m => m.id === momentId)
        if (moment) {
            moment.comments.push({
                id: 'c-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                authorId: comment.authorId,
                authorName: comment.authorName || (comment.authorId === 'user' ? settingsStore.personalization.userProfile.name : ''),
                authorAvatar: comment.authorAvatar || '', // Store avatar
                content: comment.content,
                timestamp: Date.now(),
                replyTo: comment.replyTo || null,
                isVirtual: comment.isVirtual || false
            })

            // Notification Logic using authorAvatar directly
            const isReplyToUser = comment.replyTo === 'user'
            const isUserMoment = moment.authorId === 'user'
            
            // If someone other than user is commenting
            if (comment.authorId !== 'user') {
                if (isReplyToUser || (isUserMoment && !comment.replyTo)) {
                    addNotification({
                        type: 'comment',
                        actorName: comment.authorName,
                        content: comment.content,
                        momentId: moment.id,
                        momentImage: moment.images[0] || null,
                        timestamp: Date.now()
                    })
                }
            }

            // 如果是用户发的评论，触发 AI 回复 (AI Reply Logic)
            if (comment.authorId === 'user') {
                 triggerCommentReply(moment.id, comment)
            }
        }
    }

    function deleteComment(momentId, commentId) {
        const moment = moments.value.find(m => m.id === momentId)
        if (moment) {
            moment.comments = moment.comments.filter(c => c.id !== commentId)
        }
    }

    // New: Trigger AI Reply to User Comment
    async function triggerCommentReply(momentId, userComment) {
        const moment = moments.value.find(m => m.id === momentId)
        if (!moment) return

        // 1. Determine who should reply
        // Implementation:
        // - If moment author is AI, they should reply with high probability (80%)
        // - Other characters (friends) might pile on (20% specific, or 1 random friend)
        
        const potentialRepliers = []
        
        // A. Moment Author (if not user)
        if (moment.authorId !== 'user' && chatStore.chats[moment.authorId]) {
             potentialRepliers.push({
                 id: moment.authorId,
                 priority: 'high', // Author is most likely to reply
                 char: chatStore.chats[moment.authorId]
             })
        }

        // B. Other characters (Random Friends)
        const otherChars = Object.keys(chatStore.chats).filter(id => id !== moment.authorId && id !== 'user')
        if (otherChars.length > 0) {
            // Pick 1 random friend to potentially reply
            const randomFriendId = otherChars[Math.floor(Math.random() * otherChars.length)]
            potentialRepliers.push({
                id: randomFriendId,
                priority: 'low',
                char: chatStore.chats[randomFriendId]
            })
        }

        // 2. Process Repliers (Serialized to prevent API spike)
        // Sort by priority to ensure high priority replies first
        potentialRepliers.sort((a, b) => (a.priority === 'high' ? -1 : 1))

        // Create a detached async process
        ;(async () => {
            for (const replier of potentialRepliers) {
                // Chance check
                const chance = replier.priority === 'high' ? 0.8 : 0.3
                if (Math.random() > chance) continue

                // Delay for realism AND rate limiting spacing
                const delay = 2000 + Math.random() * 3000
                await new Promise(r => setTimeout(r, delay))

                try {
                    const char = replier.char
                    const reply = await generateReplyToComment({
                        name: char.name,
                        persona: char.prompt,
                        worldContext: (char.tags || []).join(', ')
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
                            authorName: char.name,
                            content: reply,
                            replyTo: userComment.authorName || '用户'
                        })
                    }
                } catch (e) {
                    console.error('[Moments] Reply generation failed', e)
                }
            }
        })()
    }

    // --- AI Integration ---
    async function triggerSingleCharacterMoment(charId) {
        const chat = chatStore.chats[charId]
        if (!chat) return

        try {
            // Check WorldBook for custom prompts/logic
            // Automatic World Book Sensing Logic
            let worldContext = ''
            const charName = chat.name
            
            // Search criteria: Tags include charName or '朋友圈', or title/content includes charName
            const matchedEntries = []
            worldBookStore.books.forEach(book => {
                book.entries.forEach(entry => {
                    const tags = entry.tags || []
                    const isMentioned = entry.name.includes(charName) || entry.content.includes(charName)
                    const isTagged = tags.includes(charName) || tags.includes('朋友圈')
                    
                    if (isMentioned || isTagged) {
                        matchedEntries.push(`${entry.name}: ${entry.content}`)
                    }
                })
            })
            
            // Also include manually selected ones if any (fallback/additive)
            if (config.value.enabledWorldBookEntries.length > 0) {
                worldBookStore.books.forEach(book => {
                    book.entries.forEach(entry => {
                        if (config.value.enabledWorldBookEntries.includes(entry.id) && !matchedEntries.includes(`${entry.name}: ${entry.content}`)) {
                            matchedEntries.push(`${entry.name}: ${entry.content}`)
                        }
                    })
                })
            }
            
            worldContext = matchedEntries.join('\n')

            const result = await generateMomentContent({
                name: chat.name,
                persona: chat.prompt,
                worldContext,
                customPrompt: config.value.customPrompt
            })

            if (result && result.content) {
                const moment = addMoment({
                    authorId: charId,
                    content: result.content,
                    images: result.images || [],
                    imageDescriptions: result.imageDescriptions || []
                })
                return moment
            }
        } catch (e) {
            console.error('[MomentsStore] AI Moment Generation Failed', e)
        }
    }

    async function batchGenerateAIMoments(count = 2) {
        const candidates = Object.keys(chatStore.chats).filter(id => 
            config.value.enabledCharacters.length === 0 || config.value.enabledCharacters.includes(id)
        )
        
        if (candidates.length === 0) {
            chatStore.triggerToast('没有可用的角色', 'error')
            return
        }

        // Toast: Start
        chatStore.triggerToast(`开始生成 ${count} 条朋友圈...`, 'info')
        
        try {
            // Build character array with full info
            const characters = candidates.map(id => ({
                id,
                name: chatStore.chats[id].name,
                persona: chatStore.chats[id].prompt
            }))
            
            // Gather world context
            let worldContext = ''
            if (config.value.enabledWorldBookEntries.length > 0) {
                const matchedEntries = []
                worldBookStore.books.forEach(book => {
                    book.entries.forEach(entry => {
                        if (config.value.enabledWorldBookEntries.includes(entry.id)) {
                            matchedEntries.push(`${entry.name}: ${entry.content}`)
                        }
                    })
                })
                worldContext = matchedEntries.join('\n')
            }
            
            // Call new batch API
            const momentsData = await generateBatchMomentsWithInteractions({
                characters,
                worldContext,
                customPrompt: config.value.customPrompt,
                count
            })
            
            // Add moments and apply interactions
            let successCount = 0
            for (const data of momentsData) {
                try {
                    // Add the moment first
                    const moment = addMoment({
                        authorId: data.authorId,
                        content: data.content,
                        images: data.images || [],
                        imageDescriptions: data.imageDescriptions || []
                    })
                    
                    // Apply interactions directly (no more separate AI call)
                    if (data.interactions && data.interactions.length > 0) {
                        // Add delay for realism
                        await new Promise(r => setTimeout(r, 500))
                        
                        for (const interaction of data.interactions) {
                            // Small delays between interactions
                            await new Promise(r => setTimeout(r, 300 + Math.random() * 500))
                            
                            if (interaction.type === 'like') {
                                addLike(moment.id, interaction.authorName)
                            } else if (interaction.type === 'comment' && interaction.content) {
                                // Find authorId by name
                                const authorChar = Object.values(chatStore.chats).find(c => c.name === interaction.authorName)
                                const authorId = authorChar ? authorChar.id :  'virtual-' + Date.now()
                                
                                addComment(moment.id, {
                                    authorId,
                                    authorName: interaction.authorName,
                                    content: interaction.content,
                                    replyTo: interaction.replyTo || null,
                                    isVirtual: !authorChar
                                })
                            }
                        }
                    }
                    
                    successCount++
                } catch (e) {
                    console.error('[Moments] Failed to add moment:', e)
                }
            }
            
            // Toast: Complete
            chatStore.triggerToast(`生成完成！成功创建 ${successCount} 条朋友圈`, 'success')
            
        } catch (e) {
            console.error('[Moments] Batch generation failed:', e)
            chatStore.triggerToast('生成失败: ' + e.message, 'error')
        }
    }

    async function triggerAIInteractions(momentId) {
        const moment = moments.value.find(m => m.id === momentId)
        if (!moment) return

        // Toast: Start
        chatStore.triggerToast('正在召唤朋友前来互动...', 'info')

        // Include ALL characters (including author for replying to existing comments)
        const allCharIds = Object.keys(chatStore.chats)
        if (allCharIds.length === 0) {
            chatStore.triggerToast('没有可用的角色', 'error')
            return
        }

        // 获取历史记录作为上下文 (最近50个动态，包括完整的评论区)
        const historicalMoments = sortedMoments.value
            .slice(0, 50)
            .map(m => ({
                id: m.id,
                authorName: m.authorId === 'user' ? (settingsStore.personalization.userProfile.name || '我') : (chatStore.chats[m.authorId]?.name || '神秘人'),
                content: m.content,
                likes: m.likes.join(', '),
                comments: m.comments.map(c => `${c.authorName}: ${c.content}`).join('; ')
            }))

        // 构造角色信息列表（使用完整人设，包括作者本人）
        const charInfos = allCharIds.map(id => {
            const chat = chatStore.chats[id]
            return {
                id,
                name: chat.name,
                persona: chat.prompt, // Full persona from chatStore
                worldContext: (chat.tags || []).join(', ')
            }
        })
        
        // Add user's persona so AI knows who the user is
        const userProfile = settingsStore.personalization.userProfile
        charInfos.push({
            id: 'user',
            name: userProfile.name || '我',
            persona: settingsStore.personalization.userPersona || `我的名字是${userProfile.name}`,
            worldContext: ''
        })

        // 构造当前朋友圈的上下文（包括已有的评论）
        const currentMomentContext = {
            authorName: moment.authorId === 'user' ? settingsStore.personalization.userProfile.name : (chatStore.chats[moment.authorId]?.name || '神秘人'),
            content: moment.content,
            visualContext: moment.imageDescriptions.join('; '),
            existingComments: moment.comments.map(c => ({
                authorName: c.authorName,
                content: c.content,
                replyTo: c.replyTo
            }))
        }

        try {
            // 生成批量互动（包含现有角色 + 虚拟NPC）
            const interactions = await generateBatchInteractions(
                currentMomentContext,
                charInfos,
                historicalMoments
            )
            
            for (const interaction of interactions) {
                // 模拟人类交互的随机延迟
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
                
                // 处理虚拟NPC头像 (Virtual Avatar)
                let avatarUrl = ''
                if (interaction.isVirtual) {
                    avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${interaction.authorName}&backgroundColor=b6e3f4,c0aede,d1d4f9`
                }

                if (interaction.type === 'like') {
                    addLike(momentId, interaction.authorName)
                } else if (interaction.type === 'comment' && interaction.content) {
                    addComment(momentId, {
                        authorId: interaction.authorId || 'virtual-' + Date.now(),
                        authorName: interaction.authorName,
                        authorAvatar: avatarUrl,
                        content: interaction.content,
                        replyTo: interaction.replyTo || null,
                        isVirtual: interaction.isVirtual
                    })
                }
            }
            
            // Toast: Success
            chatStore.triggerToast('召唤成功！', 'success')
        } catch (e) {
            console.error('[MomentsStore] Batch interactions failed', e)
            chatStore.triggerToast('召唤失败: ' + e.message, 'error')
        }
    }

    function saveConfig(newConfig) {
        config.value = { ...config.value, ...newConfig }
        localStorage.setItem('wechat_moments_config', JSON.stringify(config.value))
        
        // Restart timer if interval changed
        startAutoGeneration()
    }

    // --- Auto Generate Loop ---
    // (Managed by startAutoGeneration below)

    // --- Lifecycle / Persistence ---
    let autoGenTimer = null
    function startAutoGeneration() {
        if (autoGenTimer) clearInterval(autoGenTimer)
        
        const intervalMs = config.value.autoGenerateInterval * 60 * 1000
        if (intervalMs <= 0) return

        autoGenTimer = setInterval(() => {
            console.log('[Moments] Triggering scheduled AI check...')
            if (Math.random() > 0.5) { // Chance-based to feel more natural
                batchGenerateAIMoments(1)
            }
        }, intervalMs)
    }

    // Start on store init
    startAutoGeneration()

    // --- Notifications Helper ---
    function addNotification(payload) {
        notifications.value.unshift({
            id: 'n-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            isRead: false,
            ...payload
        })
    }

    function markNotificationsRead() {
        notifications.value.forEach(n => n.isRead = true)
    }

    return {
        moments,
        notifications,
        unreadCount: computed(() => notifications.value.filter(n => !n.isRead).length),
        config,
        sortedMoments,
        addMoment,
        updateMoment,
        deleteMoment,
        clearAllMoments,
        clearCharacterMoments,
        addLike,
        removeLike,
        addComment,
        deleteComment,
        triggerSingleCharacterMoment,
        batchGenerateAIMoments,
        triggerAIInteractions,
        saveConfig,
        startAutoGeneration,
        addNotification,
        markNotificationsRead
    }
})
