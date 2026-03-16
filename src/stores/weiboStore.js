import { defineStore } from 'pinia'
import localforage from 'localforage'
import { generateReply } from '../utils/aiService'
import { 
    WEIBO_COMMENT_PROMPT, 
    WEIBO_POST_PROMPT, 
    WEIBO_HOT_SEARCH_PROMPT,
    WEIBO_DM_PROMPT,
    WEIBO_TOPIC_POST_PROMPT,
    buildWeiboContext,
    getRandomNetizen
} from '../utils/ai/prompts_weibo'
import { useChatStore } from './chatStore'
import { useWorldBookStore } from './worldBookStore'

export const useWeiboStore = defineStore('weibo', {
    state: () => ({
        user: {
            name: 'Chilly',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chilly',
            bio: 'ID: 88888888 | 狮子座 · 成都',
            region: '四川 成都',
            verified: true,
            verifyType: '微博个人认证',
            vipLevel: 6,
            following: 3200,
            fans: 1500000
        },
        settings: {
            boundWorldBooks: [],
            boundCharacters: [],
            timerEnabled: false,
            timerAutoPostChars: [],
            timerFrequency: 30
        },
        posts: [],
        hotSearch: [
            { rank: 1, title: 'Chilly的手机正式上线', tag: '爆', meta: '450万', isTop: true },
            { rank: 2, title: '如何评价 Antigravity 的 UI 设计', tag: '新', meta: '320万', isTop: true },
            { rank: 3, title: '大熊猫成功接机Chilly', tag: '热', meta: '280万', isTop: true },
            { rank: 4, title: '成都今日气温回升', tag: '新', meta: '150万', isTop: false }
        ],
        dmMessages: [
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
        ],
        isGenerating: false,
        isGeneratingComments: false,
        isGeneratingHotSearch: false,
        isGeneratingDM: false,
        isGeneratingTopic: false
    }),

    getters: {
        myPosts: (state) => state.posts.filter(p => p.authorId === 'me'),
        charPosts: (state) => state.posts.filter(p => p.authorId !== 'me'),
        unreadDMCount: (state) => state.dmMessages.filter(m => !m.isRead).length,
        currentTrendingTopic: (state) => {
            if (state.hotSearch && state.hotSearch.length > 0) {
                return state.hotSearch[0].title
            }
            return null
        }
    },

    actions: {
        async initStore() {
            const data = await localforage.getItem('weibo_data')
            if (data) {
                this.user = { ...this.user, ...(data.user || {}) }
                this.settings = { ...this.settings, ...(data.settings || {}) }
                this.posts = data.posts || []
                this.hotSearch = data.hotSearch || this.hotSearch
                this.dmMessages = data.dmMessages || this.dmMessages
            } else {
                this.posts = [
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
                this.saveData()
            }
        },

        async saveData() {
            await localforage.setItem('weibo_data', {
                user: JSON.parse(JSON.stringify(this.user)),
                settings: JSON.parse(JSON.stringify(this.settings)),
                posts: JSON.parse(JSON.stringify(this.posts)),
                hotSearch: JSON.parse(JSON.stringify(this.hotSearch)),
                dmMessages: JSON.parse(JSON.stringify(this.dmMessages))
            })
        },

        updateUserProfile(updates) {
            this.user = { ...this.user, ...updates }
            this.saveData()
        },

        updateSettings(updates) {
            this.settings = { ...this.settings, ...updates }
            this.saveData()
        },

        toggleWorldBook(bookId) {
            const idx = this.settings.boundWorldBooks.indexOf(bookId)
            if (idx > -1) this.settings.boundWorldBooks.splice(idx, 1)
            else this.settings.boundWorldBooks.push(bookId)
            this.saveData()
        },

        toggleCharacterBinding(charId) {
            const idx = this.settings.boundCharacters.indexOf(charId)
            if (idx > -1) {
                this.settings.boundCharacters.splice(idx, 1)
                const autoIdx = this.settings.timerAutoPostChars.indexOf(charId)
                if (autoIdx > -1) this.settings.timerAutoPostChars.splice(autoIdx, 1)
            } else {
                this.settings.boundCharacters.push(charId)
            }
            this.saveData()
        },

        toggleTimerAutoPostChar(charId) {
            const idx = this.settings.timerAutoPostChars.indexOf(charId)
            if (idx > -1) this.settings.timerAutoPostChars.splice(idx, 1)
            else this.settings.timerAutoPostChars.push(charId)
            this.saveData()
        },

        addPost(post) {
            const newPost = {
                id: 'p_' + Date.now(),
                authorId: 'me',
                avatar: this.user.avatar,
                isVip: this.user.vipLevel > 0,
                time: '刚刚',
                device: 'iPhone 16 Pro Max',
                stats: { share: 0, comment: 0, like: 0 },
                comments: [],
                isLiked: false,
                ...post
            }
            this.posts.unshift(newPost)
            this.saveData()
            return newPost
        },

        addComment(postId, comment) {
            const post = this.posts.find(p => p.id === postId)
            if (post) {
                if (!post.comments) post.comments = []
                const newComment = {
                    id: 'c_' + Date.now(),
                    time: Date.now(),
                    likes: 0,
                    isLiked: false,
                    replies: [],
                    ...comment
                }
                post.comments.unshift(newComment)
                if (post.stats) post.stats.comment++
                this.saveData()
                return newComment
            }
            return null
        },

        toggleLike(postId) {
            const post = this.posts.find(p => p.id === postId)
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
                this.saveData()
            }
        },

        likeComment(postId, commentIndex) {
            const post = this.posts.find(p => p.id === postId)
            if (post && post.comments && post.comments[commentIndex]) {
                const c = post.comments[commentIndex]
                if (!c.isLiked) {
                    c.likes++
                    c.isLiked = true
                } else {
                    c.likes--
                    c.isLiked = false
                }
                this.saveData()
            }
        },

        deletePost(postId) {
            const idx = this.posts.findIndex(p => p.id === postId)
            if (idx !== -1) {
                this.posts.splice(idx, 1)
                this.saveData()
            }
        },

        deleteComment(postId, commentIndex) {
            const post = this.posts.find(p => p.id === postId)
            if (post && post.comments) {
                post.comments.splice(commentIndex, 1)
                if (post.stats) post.stats.comment--
                this.saveData()
            }
        },

        clearPostsByChar(charId) {
            this.posts = this.posts.filter(p => p.authorId !== charId)
            this.saveData()
        },

        clearAllPosts() {
            this.posts = []
            this.saveData()
        },

        markDMRead(dmId) {
            const dm = this.dmMessages.find(m => m.id === dmId)
            if (dm) {
                dm.isRead = true
                this.saveData()
            }
        },

        addDMMessage(dm) {
            const newDM = {
                id: 'dm_' + Date.now(),
                time: Date.now(),
                isRead: false,
                isSystem: false,
                ...dm
            }
            this.dmMessages.unshift(newDM)
            this.saveData()
            return newDM
        },

        formatNumber(num) {
            if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
            if (num >= 10000) return (num / 10000).toFixed(1) + '万'
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
            return num
        },

        getAIContext() {
            const chatStore = useChatStore()
            const worldBookStore = useWorldBookStore()
            return buildWeiboContext(this, chatStore, worldBookStore)
        },

        async generateComments(postId, count = 3) {
            const post = this.posts.find(p => p.id === postId)
            if (!post || this.isGeneratingComments) return []

            this.isGeneratingComments = true
            const chatStore = useChatStore()

            try {
                const context = this.getAIContext()
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
                    const newComment = this.addComment(postId, {
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
                this.isGeneratingComments = false
            }
        },

        async generatePost(context = {}) {
            if (this.isGenerating) return null
            this.isGenerating = true
            const chatStore = useChatStore()

            try {
                const aiContext = this.getAIContext()
                const prompt = WEIBO_POST_PROMPT(this.user, { ...aiContext, ...context })
                
                const char = { name: '微博生成引擎', prompt: '你只输出符合格式的JSON数组。' }
                const result = await generateReply([{ role: 'user', content: prompt }], char, null, { 
                    isSimpleTask: true, 
                    skipProcessing: true 
                })

                let cleanJSON = result.content.replace(/```json|```/g, '').trim()
                const listMatch = cleanJSON.match(/\[[\s\S]*\]/)
                if (listMatch) cleanJSON = listMatch[0]

                const posts = JSON.parse(cleanJSON)
                const addedPosts = []

                for (const p of posts) {
                    const authorId = p.authorId || 'me'
                    let author = p.author || this.user.name
                    let avatar = this.user.avatar

                    if (authorId !== 'me' && authorId.startsWith('char_')) {
                        const charId = authorId.replace('char_', '')
                        const boundChar = aiContext.boundChars.find(c => c.id === charId)
                        if (boundChar) {
                            const chatStore = useChatStore()
                            const charData = chatStore.chats[charId]
                            if (charData) {
                                author = charData.name
                                avatar = charData.avatar
                            }
                        }
                    }

                    const newPost = this.addPost({
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
                this.isGenerating = false
            }
        },

        async generateHotSearch() {
            if (this.isGeneratingHotSearch) return []
            this.isGeneratingHotSearch = true
            const chatStore = useChatStore()

            try {
                const context = this.getAIContext()
                const prompt = WEIBO_HOT_SEARCH_PROMPT({
                    currentTrends: this.hotSearch,
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
                
                this.hotSearch = trends.map((t, i) => ({
                    rank: t.rank || i + 1,
                    title: t.title,
                    tag: t.tag || '热',
                    meta: t.meta || '100万',
                    isTop: t.isTop || i < 3
                }))

                this.saveData()
                chatStore.triggerToast('热搜已更新！', 'success')
                return this.hotSearch

            } catch (e) {
                console.error('生成热搜失败:', e)
                chatStore.triggerToast('生成热搜失败，请稍后再试', 'error')
                return []
            } finally {
                this.isGeneratingHotSearch = false
            }
        },

        async generateDM(dmName) {
            if (this.isGeneratingDM) return []
            this.isGeneratingDM = true
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
                    const newDM = this.addDMMessage({
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
                this.isGeneratingDM = false
            }
        },

        async generateTopicPosts(topicTitle) {
            if (this.isGeneratingTopic) return []
            this.isGeneratingTopic = true
            const chatStore = useChatStore()

            try {
                const context = this.getAIContext()
                const prompt = WEIBO_TOPIC_POST_PROMPT(topicTitle, context)
                
                const char = { name: '话题引擎', prompt: '你只输出符合格式的JSON数组。' }
                const result = await generateReply([{ role: 'user', content: prompt }], char, null, { 
                    isSimpleTask: true, 
                    skipProcessing: true 
                })

                let cleanJSON = result.content.replace(/```json|```/g, '').trim()
                const listMatch = cleanJSON.match(/\[[\s\S]*\]/)
                if (listMatch) cleanJSON = listMatch[0]

                const posts = JSON.parse(cleanJSON)
                const addedPosts = []

                for (const p of posts) {
                    const randomUser = getRandomNetizen()
                    const newPost = this.addPost({
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
                this.isGeneratingTopic = false
            }
        }
    }
})
