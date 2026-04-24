import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import localforage from 'localforage'
import { generateReply } from '../utils/aiService'
import {
    WEIBO_COMMENT_PROMPT,
    WEIBO_POST_PROMPT,
    WEIBO_HOT_SEARCH_PROMPT,
    WEIBO_DM_PROMPT,
    WEIBO_TOPIC_POST_PROMPT,
    WEIBO_DM_CHAT_REPLY_PROMPT,
    buildWeiboContext,
    getRandomNetizen
} from '../utils/ai/prompts_weibo.js'
import { useChatStore } from './chatStore'
import { useWorldBookStore } from './worldBookStore'

export const useWeiboStore = defineStore('weibo', () => {
    const user = ref({
        name: 'Chilly',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chilly',
        bio: 'ID: 88888888 | 狮子座 · 成都',
        region: '四川 成都',
        verified: true,
        verifyType: '微博个人认证',
        vipLevel: 6,
        following: 3200,
        fans: 1500000
    })

    const settings = ref({
        boundWorldBooks: [],
        boundCharacters: [],
        timerEnabled: false,
        timerAutoPostChars: [],
        timerFrequency: 30
    })

    const posts = ref([])
    const hotSearch = ref([
        { rank: 1, title: 'Chilly的手机正式上线', tag: '爆', meta: '450万', isTop: true },
        { rank: 2, title: '如何评价 Antigravity 的 UI 设计', tag: '新', meta: '320万', isTop: true },
        { rank: 3, title: '大熊猫成功接机Chilly', tag: '热', meta: '280万', isTop: true },
        { rank: 4, title: '成都今日气温回升', tag: '新', meta: '150万', isTop: false }
    ])

    const dmMessages = ref([
        {
            id: 'dm1',
            sender: '系统通知',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=system',
            content: '您的账号被评为今日"最有才华博主"！',
            time: Date.now() - 3600000,
            isRead: false,
            isSystem: true
        },
        {
            id: 'dm2',
            sender: '小助手',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=helper',
            content: '你有一条新的博文待审核，请点击查看详细信息。',
            time: Date.now() - 86400000,
            isRead: true,
            isSystem: false
        }
    ])

    // 私信对话消息（按联系人分组的聊天记录，持久化到 localforage）
    const dmChatMessages = ref({})

    // 搜索历史（持久化）
    const searchHistory = ref([])

    const isGenerating = ref(false)
    const isGeneratingComments = ref(false)
    const isGeneratingHotSearch = ref(false)
    const isGeneratingDM = ref(false)
    const isGeneratingDMReply = ref(false)
    const isGeneratingTopic = ref(false)

    const myPosts = computed(() => posts.value.filter(p => p.authorId === 'me'))
    const charPosts = computed(() => posts.value.filter(p => p.authorId !== 'me'))
    const unreadDMCount = computed(() => dmMessages.value.filter(m => !m.isRead).length)
    const currentTrendingTopic = computed(() => {
        if (hotSearch.value && hotSearch.value.length > 0) {
            return hotSearch.value[0].title
        }
        return null
    })

    async function saveData() {
        await localforage.setItem('weibo_data', {
            user: JSON.parse(JSON.stringify(user.value)),
            settings: JSON.parse(JSON.stringify(settings.value)),
            posts: JSON.parse(JSON.stringify(posts.value)),
            hotSearch: JSON.parse(JSON.stringify(hotSearch.value)),
            dmMessages: JSON.parse(JSON.stringify(dmMessages.value)),
            dmChatMessages: JSON.parse(JSON.stringify(dmChatMessages.value)),
            searchHistory: JSON.parse(JSON.stringify(searchHistory.value))
        })
    }

    async function initStore() {
        const data = await localforage.getItem('weibo_data')
        if (data) {
            user.value = { ...user.value, ...(data.user || {}) }
            settings.value = { ...settings.value, ...(data.settings || {}) }
            posts.value = data.posts || []
            hotSearch.value = data.hotSearch || hotSearch.value
            dmMessages.value = data.dmMessages || dmMessages.value
            dmChatMessages.value = data.dmChatMessages || {}
            searchHistory.value = data.searchHistory || []
        } else {
            posts.value = [
                {
                    id: 'p1',
                    author: 'Chilly',
                    authorId: 'me',
                    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chilly',
                    isVip: true,
                    time: '15分钟前',
                    device: 'iPhone 16 Pro Max',
                    content: '今天终于把微博组件的初稿做出来啦！大家觉得这个界面怎么样？还缺什么功能尽管提哦~',
                    images: ['https://picsum.photos/seed/wb1/800/500'],
                    stats: { share: 128, comment: 256, like: 1200 },
                    comments: [],
                    isLiked: false
                }
            ]
            await saveData()
        }
    }

    function updateUserProfile(updates) {
        user.value = { ...user.value, ...updates }
        saveData()
    }

    function updateSettings(updates) {
        settings.value = { ...settings.value, ...updates }
        saveData()
    }

    function toggleWorldBook(bookId) {
        const idx = settings.value.boundWorldBooks.indexOf(bookId)
        if (idx > -1) settings.value.boundWorldBooks.splice(idx, 1)
        else settings.value.boundWorldBooks.push(bookId)
        saveData()
    }

    function toggleCharacterBinding(charId) {
        const idx = settings.value.boundCharacters.indexOf(charId)
        if (idx > -1) {
            settings.value.boundCharacters.splice(idx, 1)
            const autoIdx = settings.value.timerAutoPostChars.indexOf(charId)
            if (autoIdx > -1) settings.value.timerAutoPostChars.splice(autoIdx, 1)
        } else {
            settings.value.boundCharacters.push(charId)
        }
        saveData()
    }

    function toggleTimerAutoPostChar(charId) {
        const idx = settings.value.timerAutoPostChars.indexOf(charId)
        if (idx > -1) settings.value.timerAutoPostChars.splice(idx, 1)
        else settings.value.timerAutoPostChars.push(charId)
        saveData()
    }

    function addPost(post) {
        const newPost = {
            id: 'p_' + Date.now(),
            authorId: 'me',
            avatar: user.value.avatar,
            isVip: user.value.vipLevel > 0,
            time: '刚刚',
            device: 'iPhone 16 Pro Max',
            stats: { share: 0, comment: 0, like: 0 },
            comments: [],
            isLiked: false,
            ...post
        }
        posts.value.unshift(newPost)
        saveData()
        return newPost
    }

    function repost(originalPostId, comment = '') {
        const original = posts.value.find(p => p.id === originalPostId)
        if (!original) return null

        const newPost = {
            id: 'rp_' + Date.now(),
            authorId: 'me',
            avatar: user.value.avatar,
            isVip: user.value.vipLevel > 0,
            time: '刚刚',
            device: 'iPhone 16 Pro Max',
            content: comment || '//转发微博',
            repostFrom: {
                id: original.id,
                author: original.author,
                avatar: original.avatar,
                isVip: original.isVip,
                content: original.content,
                images: original.images || []
            },
            stats: { share: 0, comment: 0, like: 0 },
            comments: [],
            isLiked: false
        }
        posts.value.unshift(newPost)
        saveData()

        // 原帖分享数+1
        if (original.stats) original.stats.share++
        saveData()

        return newPost
    }

    function addComment(postId, comment) {
        const post = posts.value.find(p => p.id === postId)
        if (post) {
            if (!post.comments) post.comments = []
            const newComment = {
                id: comment.id || ('c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                time: comment.time || Date.now(),
                likes: comment.likes || 0,
                isLiked: comment.isLiked || false,
                replies: comment.replies || [],
                ...comment
            }
            post.comments.unshift(newComment)
            if (post.stats) post.stats.comment++
            saveData()
            return newComment
        }
        return null
    }

    function toggleLike(postId) {
        const post = posts.value.find(p => p.id === postId)
        if (post) {
            if (!post.stats) post.stats = { like: 0, comment: 0, share: 0 }
            if (typeof post.isLiked === 'undefined') post.isLiked = false

            if (post.isLiked) {
                post.stats.like = Math.max(0, post.stats.like - 1)
                post.isLiked = false
            } else {
                post.stats.like += 1
                post.isLiked = true
            }
            saveData()
        }
    }

    function likeComment(postId, commentIndex) {
        const post = posts.value.find(p => p.id === postId)
        if (post && post.comments && post.comments[commentIndex]) {
            const c = post.comments[commentIndex]
            if (!c.isLiked) {
                c.likes++
                c.isLiked = true
            } else {
                c.likes--
                c.isLiked = false
            }
            saveData()
        }
    }

    function deletePost(postId) {
        const idx = posts.value.findIndex(p => p.id === postId)
        if (idx !== -1) {
            posts.value.splice(idx, 1)
            saveData()
        }
    }

    function deleteComment(postId, commentIndex) {
        const post = posts.value.find(p => p.id === postId)
        if (post && post.comments) {
            post.comments.splice(commentIndex, 1)
            if (post.stats) post.stats.comment--
            saveData()
        }
    }

    function clearPostsByChar(charId) {
        posts.value = posts.value.filter(p => p.authorId !== charId)
        saveData()
    }

    function clearAllPosts() {
        posts.value = []
        saveData()
    }

    function markDMRead(dmId) {
        const dm = dmMessages.value.find(m => m.id === dmId)
        if (dm) {
            dm.isRead = true
            saveData()
        }
    }

    function addDMMessage(dm) {
        const newDM = {
            id: 'dm_' + Date.now(),
            time: Date.now(),
            isRead: false,
            isSystem: false,
            ...dm
        }
        dmMessages.value.unshift(newDM)
        saveData()
        return newDM
    }

    // --- 私信对话消息 CRUD（按联系人分组）---
    function getDMChatMessages(contactName) {
        return dmChatMessages.value[contactName] || []
    }

    function addDMChatMessage(contactName, message) {
        if (!dmChatMessages.value[contactName]) {
            dmChatMessages.value[contactName] = []
        }
        const msg = {
            id: 'dcm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            ...message,
            time: message.time || Date.now()
        }
        dmChatMessages.value[contactName].push(msg)
        // 防抖保存（避免频繁写入）
        debouncedSaveDMChat()
        return msg
    }

    let _saveDMChatTimer = null
    function debouncedSaveDMChat() {
        if (_saveDMChatTimer) clearTimeout(_saveDMChatTimer)
        _saveDMChatTimer = setTimeout(() => { saveData(); _saveDMChatTimer = null }, 500)
    }

    function clearDMChat(contactName) {
        if (dmChatMessages.value[contactName]) {
            delete dmChatMessages.value[contactName]
            saveData()
        }
    }

    // --- 搜索历史 CRUD ---
    function addSearchHistory(term) {
        if (!term || !term.trim()) return
        const t = term.trim()
        const idx = searchHistory.value.indexOf(t)
        if (idx > -1) searchHistory.value.splice(idx, 1)
        searchHistory.value.unshift(t)
        if (searchHistory.value.length > 15) searchHistory.value.pop()
        saveData()
    }

    function clearSearchHistory() {
        searchHistory.value = []
        saveData()
    }

    function formatNumber(num) {
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
        if (num >= 10000) return (num / 10000).toFixed(1) + '万'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
        return num
    }

    function getAIContext() {
        const chatStore = useChatStore()
        const worldBookStore = useWorldBookStore()
        return buildWeiboContext(
            { user: user.value, posts: posts.value, hotSearch: hotSearch.value, settings: settings.value },
            chatStore,
            worldBookStore
        )
    }

    async function generateComments(postId, count = 3) {
        const post = posts.value.find(p => p.id === postId)
        if (!post || isGeneratingComments.value) return []

        isGeneratingComments.value = true
        const chatStore = useChatStore()

        try {
            const context = getAIContext()
            const prompt = WEIBO_COMMENT_PROMPT(post.content, post.author, context)

            const char = { name: '微博评论引擎', prompt: '你只输出符合格式的JSON数组。' }
            const result = await generateReply([{ role: 'user', content: prompt }], char, null, {
                isSimpleTask: true,
                skipProcessing: true
            })

            let cleanJSON = result.content.replace(/```json|```/g, '').trim()
            const listMatch = cleanJSON.match(/\[[\s\S]*\]/)
            if (listMatch) cleanJSON = listMatch[0]

            const comments = JSON.parse(cleanJSON)
            const addedComments = []

            for (const c of comments.slice(0, count)) {
                const randomUser = getRandomNetizen()
                const newComment = addComment(postId, {
                    author: c.authorName || randomUser.name,
                    avatar: randomUser.avatar,
                    content: c.content,
                    likes: c.likes || Math.floor(Math.random() * 50),
                    isVip: c.isVip || Math.random() > 0.8,
                    isChar: c.isChar || false
                })
                if (newComment) addedComments.push(newComment)
            }

            if (post.stats) {
                post.stats.like += Math.floor(Math.random() * 10) + 5
            }

            chatStore.triggerToast(`已生成 ${addedComments.length} 条新互动！`, 'success')
            return addedComments

        } catch (e) {
            console.error('生成评论失败:', e)
            chatStore.triggerToast('生成评论失败，请稍后再试', 'error')
            return []
        } finally {
            isGeneratingComments.value = false
        }
    }

    async function generatePost(context = {}) {
        if (isGenerating.value) return null
        isGenerating.value = true
        const chatStore = useChatStore()

        try {
            const aiContext = getAIContext()
            const prompt = WEIBO_POST_PROMPT(user.value, { ...aiContext, ...context })

            const char = { name: '微博生成引擎', prompt: '你只输出符合格式的JSON数组。' }
            const result = await generateReply([{ role: 'user', content: prompt }], char, null, {
                isSimpleTask: true,
                skipProcessing: true
            })

            let cleanJSON = result.content.replace(/```json|```/g, '').trim()
            const listMatch = cleanJSON.match(/\[[\s\S]*\]/)
            if (listMatch) cleanJSON = listMatch[0]

            const postsList = JSON.parse(cleanJSON)
            const addedPosts = []

            for (const p of postsList) {
                const authorId = p.authorId || 'me'
                let author = p.author || user.value.name
                let avatar = user.value.avatar

                if (authorId !== 'me' && authorId.startsWith('char_')) {
                    const charId = authorId.replace('char_', '')
                    const boundChar = aiContext.boundChars.find(c => c.id === charId)
                    if (boundChar) {
                        const charData = chatStore.chats[charId]
                        if (charData) {
                            author = charData.name
                            avatar = charData.avatar
                        }
                    }
                }

                const newPost = addPost({
                    author,
                    authorId,
                    avatar,
                    content: p.content,
                    images: p.images || [],
                    stats: p.stats || { share: 0, comment: 0, like: Math.floor(Math.random() * 100) },
                    isVip: p.isVip || false
                })
                addedPosts.push(newPost)
            }

            chatStore.triggerToast(`已生成 ${addedPosts.length} 条新微博！`, 'success')
            return addedPosts[0] || null

        } catch (e) {
            console.error('生成微博失败:', e)
            chatStore.triggerToast('生成微博失败，请稍后再试', 'error')
            return null
        } finally {
            isGenerating.value = false
        }
    }

    async function generateHotSearch() {
        if (isGeneratingHotSearch.value) return []
        isGeneratingHotSearch.value = true
        const chatStore = useChatStore()

        try {
            const context = getAIContext()
            const prompt = WEIBO_HOT_SEARCH_PROMPT({
                currentTrends: hotSearch.value,
                worldBookContent: context.worldBookContent
            })

            const char = { name: '热搜引擎', prompt: '你只输出符合格式的JSON数组。' }
            const result = await generateReply([{ role: 'user', content: prompt }], char, null, {
                isSimpleTask: true,
                skipProcessing: true
            })

            let cleanJSON = result.content.replace(/```json|```/g, '').trim()
            const listMatch = cleanJSON.match(/\[[\s\S]*\]/)
            if (listMatch) cleanJSON = listMatch[0]

            const trends = JSON.parse(cleanJSON)

            hotSearch.value = trends.map((t, i) => ({
                rank: t.rank || i + 1,
                title: t.title,
                tag: t.tag || '热',
                meta: t.meta || '100万',
                isTop: t.isTop || i < 3
            }))

            await saveData()
            chatStore.triggerToast('热搜已更新！', 'success')
            return hotSearch.value

        } catch (e) {
            console.error('生成热搜失败:', e)
            chatStore.triggerToast('生成热搜失败，请稍后再试', 'error')
            return []
        } finally {
            isGeneratingHotSearch.value = false
        }
    }

    async function generateDM(dmName) {
        if (isGeneratingDM.value) return []
        isGeneratingDM.value = true
        const chatStore = useChatStore()

        try {
            const prompt = WEIBO_DM_PROMPT(dmName)

            const char = { name: '私信引擎', prompt: '你只输出符合格式的JSON数组。' }
            const result = await generateReply([{ role: 'user', content: prompt }], char, null, {
                isSimpleTask: true,
                skipProcessing: true
            })

            let cleanJSON = result.content.replace(/```json|```/g, '').trim()
            const listMatch = cleanJSON.match(/\[[\s\S]*\]/)
            if (listMatch) cleanJSON = listMatch[0]

            const messages = JSON.parse(cleanJSON)
            const addedMessages = []

            for (const m of messages) {
                const newDM = addDMMessage({
                    sender: m.sender,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.sender}`,
                    content: m.content,
                    isSystem: m.isSystem || false
                })
                addedMessages.push(newDM)
            }

            chatStore.triggerToast(`已生成 ${addedMessages.length} 条新消息！`, 'success')
            return addedMessages

        } catch (e) {
            console.error('生成私信失败:', e)
            chatStore.triggerToast('生成私信失败，请稍后再试', 'error')
            return []
        } finally {
            isGeneratingDM.value = false
        }
    }

    async function generateDMChatReply(contactName, recentMessages = []) {
        if (isGeneratingDMReply.value) return null
        isGeneratingDMReply.value = true

        try {
            const context = getAIContext()
            const prompt = WEIBO_DM_CHAT_REPLY_PROMPT(contactName, recentMessages, context)

            const char = { name: `${contactName}`, prompt: `你是微博用户${contactName}，正在和Chilly私信聊天。自然地回复。` }
            const result = await generateReply([{ role: 'user', content: prompt }], char, null, {
                isSimpleTask: true,
                skipProcessing: true
            })

            let cleanJSON = result.content.replace(/```json|```/g, '').trim()
            const objMatch = cleanJSON.match(/\{[\s\S]*\}/)
            if (objMatch) cleanJSON = objMatch[0]

            const data = JSON.parse(cleanJSON)
            return data.reply || null

        } catch (e) {
            console.error('AI 私信回复失败:', e)
            // 回退到随机预设回复
            const fallbacks = ['收到！稍等一下~', '哈哈哈好的！', '嗯嗯，了解了~', '马上处理！', '好的，我看看~']
            return fallbacks[Math.floor(Math.random() * fallbacks.length)]
        } finally {
            isGeneratingDMReply.value = false
        }
    }

    async function generateTopicPosts(topicTitle) {
        if (isGeneratingTopic.value) return []
        isGeneratingTopic.value = true
        const chatStore = useChatStore()

        try {
            const context = getAIContext()
            const prompt = WEIBO_TOPIC_POST_PROMPT(topicTitle, context)

            const char = { name: '话题引擎', prompt: '你只输出符合格式的JSON数组。' }
            const result = await generateReply([{ role: 'user', content: prompt }], char, null, {
                isSimpleTask: true,
                skipProcessing: true
            })

            let cleanJSON = result.content.replace(/```json|```/g, '').trim()
            const listMatch = cleanJSON.match(/\[[\s\S]*\]/)
            if (listMatch) cleanJSON = listMatch[0]

            const postsList = JSON.parse(cleanJSON)
            const addedPosts = []

            for (const p of postsList) {
                const randomUser = getRandomNetizen()
                const newPost = addPost({
                    author: p.author || randomUser.name,
                    authorId: 'npc_' + Date.now(),
                    avatar: randomUser.avatar,
                    content: p.content,
                    images: p.images || [],
                    stats: p.stats || { share: 0, comment: 0, like: Math.floor(Math.random() * 100) },
                    isVip: Math.random() > 0.7
                })
                addedPosts.push(newPost)
            }

            chatStore.triggerToast(`已生成 ${addedPosts.length} 条话题微博！`, 'success')
            return addedPosts

        } catch (e) {
            console.error('生成话题微博失败:', e)
            chatStore.triggerToast('生成话题微博失败，请稍后再试', 'error')
            return []
        } finally {
            isGeneratingTopic.value = false
        }
    }

    return {
        user,
        settings,
        posts,
        hotSearch,
        dmMessages,
        dmChatMessages,
        searchHistory,
        isGenerating,
        isGeneratingComments,
        isGeneratingHotSearch,
        isGeneratingDM,
        isGeneratingDMReply,
        isGeneratingTopic,
        myPosts,
        charPosts,
        unreadDMCount,
        currentTrendingTopic,
        initStore,
        saveData,
        updateUserProfile,
        updateSettings,
        toggleWorldBook,
        toggleCharacterBinding,
        toggleTimerAutoPostChar,
        addPost,
        repost,
        addComment,
        toggleLike,
        likeComment,
        deletePost,
        deleteComment,
        clearPostsByChar,
        clearAllPosts,
        markDMRead,
        addDMMessage,
        getDMChatMessages,
        addDMChatMessage,
        clearDMChat,
        addSearchHistory,
        clearSearchHistory,
        formatNumber,
        getAIContext,
        generateComments,
        generatePost,
        generateHotSearch,
        generateDM,
        generateDMChatReply,
        generateTopicPosts
    }
})
