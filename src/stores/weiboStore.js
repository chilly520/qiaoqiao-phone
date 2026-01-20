import { defineStore } from 'pinia'
import localforage from 'localforage'

export const useWeiboStore = defineStore('weibo', {
    state: () => ({
        user: {
            name: '乔乔酱',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=QiaoQiao',
            bio: 'ID: 88888888 | 狮子座 · 成都',
            region: '四川 成都',
            verified: true,
            verifyType: '微博个人认证',
            vipLevel: 6, // 0 = no VIP, 1-7 = VIP levels
            following: 3200,
            fans: 1500000
        },
        settings: {
            boundWorldBooks: [],
            boundCharacters: [],
            timerEnabled: false,
            timerAutoPostChars: [] // Characters selected for auto-posting
        },
        posts: [], // { id, author, avatar, time, content, images, stats, isMe, authorId }
        hotSearch: [
            { rank: 1, title: '乔乔的小手机正式上线', tag: '爆', meta: '450万', isTop: true },
            { rank: 2, title: '如何评价 Antigravity 的 UI 设计', tag: '新', meta: '320万', isTop: true },
            { rank: 3, title: '大熊猫成功接机乔乔', tag: '热', meta: '280万', isTop: true },
            { rank: 4, title: '成都今日气温回升', tag: '新', meta: '150万', isTop: false }
        ]
    }),

    actions: {
        async initStore() {
            const data = await localforage.getItem('weibo_data')
            if (data) {
                // Merge to ensure new fields are present
                this.user = { ...this.user, ...(data.user || {}) }
                this.settings = { ...this.settings, ...(data.settings || {}) }
                this.posts = data.posts || []
            } else {
                // Initialize default posts
                this.posts = [
                    {
                        id: 'p1',
                        author: '乔乔酱',
                        authorId: 'me',
                        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=QiaoQiao',
                        isVip: true,
                        time: '15分钟前',
                        device: 'iPhone 16 Pro Max',
                        content: '今天终于把微博组件的初稿做出来啦！大家觉得这个界面怎么样？还缺什么功能尽管提哦~',
                        images: ['https://picsum.photos/seed/wb1/800/500'],
                        stats: { share: 128, comment: 256, like: 1200 }
                    }
                ]
                this.saveData()
            }
        },

        async saveData() {
            await localforage.setItem('weibo_data', {
                user: JSON.parse(JSON.stringify(this.user)),
                settings: JSON.parse(JSON.stringify(this.settings)),
                posts: JSON.parse(JSON.stringify(this.posts))
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

        // --- Binding Actions ---
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
                // Also remove from auto-post if unassigned
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

        // --- Post Actions ---
        addPost(post) {
            this.posts.unshift(post)
            this.saveData()
        },

        deletePost(postId) {
            const idx = this.posts.findIndex(p => p.id === postId)
            if (idx !== -1) {
                this.posts.splice(idx, 1)
                this.saveData()
            }
        },

        clearPostsByChar(charId) {
            // charId could be 'me' or a character UUID
            this.posts = this.posts.filter(p => p.authorId !== charId)
            this.saveData()
        },

        clearAllPosts() {
            this.posts = []
            this.saveData()
        },

        formatNumber(num) {
            if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿'
            if (num >= 10000) return (num / 10000).toFixed(1) + '万'
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
            return num
        }
    }
})
