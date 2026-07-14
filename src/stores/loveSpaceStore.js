import { defineStore } from 'pinia'
import localforage from 'localforage'
import { LOVE_SPACE_GENERATOR_PROMPT } from '@/utils/ai/prompts_love'
import { useChatStore } from './chatStore.js'
import { getLastNTurns } from '@/utils/common'

const loveSpaceDB = localforage.createInstance({
  name: 'qiaoqiao-phone',
  storeName: 'love_space'
});

const DEFAULT_SPACE = () => ({
  initialized: false,
  partner: null,
  startDate: null,
  loveDays: 0,
  diary: [],
  messages: [],
  anniversaries: [],
  footprints: [],
  stickies: [],
  letters: [],
  house: {
    comfortLevel: 100,
    items: [],
    lastAction: '在这里开启你们的生活吧',
    lastActionTime: new Date().toISOString()
  },
  questions: [],
  album: [],
  gachaHistory: [],
  applyToDesktop: false,
  schedules: [],  // 新增：日程表数据
  // v1.10.90: 定时魔法生成配置
  //   enabled: 是否启用
  //   mode: 'daily' = 每天固定时间 / 'interval' = 间隔 N 小时
  //   dailyTime: 'HH:mm',仅 mode='daily' 用
  //   intervalHours: 间隔小时数,仅 mode='interval' 用
  //   lastRunAt: 上次运行时间戳 (ISO string)
  //   nextRunAt: 下次运行时间戳 (ISO string),null 表示未计算
  scheduledGeneration: {
    enabled: false,
    mode: 'daily',
    dailyTime: '09:00',
    intervalHours: 6,
    lastRunAt: null,
    nextRunAt: null
  },
  // v1.10.91: 生成上下文记忆配置
  //   mode: 'turns' = 按自定义轮数(最近 N 轮聊天)
  //         'daily' = 按当天(只取今天 00:00 之后的消息)
  //   turns: mode='turns' 时使用,默认 30 轮
  //   injectDays: 注入到微信情侣空间记忆的天数
  //     设置 N 就是把最近 N 天内的日记/留言/信件/足迹/便利贴/纪念日/日程注入到 system prompt
  //     0 = 不限制(全部历史)
  contextMemory: {
    mode: 'turns',
    turns: 30,
    injectDays: 7
  }
})

export const useLoveSpaceStore = defineStore('loveSpace', {
  state: () => ({
    spaces: {}, // { [charId]: spaceData }
    currentPartnerId: null,
    isLoaded: false,
    isMagicGenerating: false // 全局生成状态
  }),
  
  getters: {
    currentSpace(state) {
      if (!state.currentPartnerId) return DEFAULT_SPACE()
      return state.spaces[state.currentPartnerId] || DEFAULT_SPACE()
    },
    initialized() { return this.currentSpace.initialized },
    partner() { 
      const chatStore = useChatStore();
      return chatStore.chats[this.currentPartnerId] || this.currentSpace.partner;
    },
    startDate() { return this.currentSpace.startDate },
    loveDays() { return this.currentSpace.loveDays },
    diary() { return this.currentSpace.diary || [] },
    messages() { return this.currentSpace.messages || [] },
    anniversaries() { return this.currentSpace.anniversaries || [] },
    footprints() { return this.currentSpace.footprints || [] },
    stickies() { 
      // 倒序排列，最新的在上面
      return [...(this.currentSpace.stickies || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
    letters() { return this.currentSpace.letters || [] },
    house() { return this.currentSpace.house || DEFAULT_SPACE().house },
    questions() { return this.currentSpace.questions || [] },
    album() { return this.currentSpace.album || [] },
    gachaHistory() { return this.currentSpace.gachaHistory || [] },
    applyToDesktop() { return this.currentSpace.applyToDesktop || false },
    schedules() { return this.currentSpace.schedules || [] }  // 新增 getter
  },
  
  actions: {
    generateSystemPrompt(charId) {
      if (!this.spaces[charId] || !this.spaces[charId].initialized) return ""
      
      const space = this.spaces[charId]
      const partnerName = space.partner?.name || 'TA'
      
      // Calculate days
      let loveDays = 0
      if (space.startDate) {
        const start = new Date(space.startDate)
        const now = new Date()
        const diff = now - start
        loveDays = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
      }

      const diaryCount = space.diary?.length || 0
      const photoCount = space.album?.length || 0
      const houseStatus = space.house?.desc || '充满了温馨的气息'
      
      // 辅助函数：格式化时间戳
      const formatDateTime = (timestamp) => {
        if (!timestamp) return ''
        const date = new Date(timestamp)
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        const hour = date.getHours().toString().padStart(2, '0')
        const minute = date.getMinutes().toString().padStart(2, '0')
        return `${month}.${day} ${hour}:${minute}`
      }
      
      // 详细内容展示
      let contentDetails = ""
      
      // 最近日记（最新3条，完整内容）
      if (space.diary && space.diary.length > 0) {
        const recentDiaries = space.diary.slice(-3).reverse()
        contentDetails += `\n\n【最近日记】`
        recentDiaries.forEach(d => {
          const timeStr = formatDateTime(d.createdAt || d.date)
          contentDetails += `\n- [${timeStr}] ${d.authorName || (d.author === 'user' ? '用户' : '你')}《${d.title}》：${d.content || ''}`
        })
      }
      
      // 最近留言（最新5条，完整内容）
      if (space.messages && space.messages.length > 0) {
        const recentMessages = space.messages.slice(-5).reverse()
        contentDetails += `\n\n【最近留言】`
        recentMessages.forEach(m => {
          const timeStr = formatDateTime(m.createdAt || m.timestamp)
          contentDetails += `\n- [${timeStr}] ${m.senderName || (m.senderId === 'user' ? '用户' : '你')}："${m.content || ''}"`
        })
      }
      
      // 最近情书（最新3条，完整内容）
      if (space.letters && space.letters.length > 0) {
        const recentLetters = space.letters.slice(-3).reverse()
        contentDetails += `\n\n【最近情书】`
        recentLetters.forEach(l => {
          const timeStr = formatDateTime(l.createdAt || l.date)
          contentDetails += `\n- [${timeStr}] ${l.authorName || (l.author === 'user' ? '用户' : '你')}《${l.title}》：${l.content || ''}`
        })
      }
      
      // 最近足迹（最新5条）
      if (space.footprints && space.footprints.length > 0) {
        const recentFootprints = space.footprints.slice(-5).reverse()
        contentDetails += `\n\n【最近足迹】`
        recentFootprints.forEach(f => {
          const timeStr = formatDateTime(f.createdAt || f.date)
          contentDetails += `\n- [${timeStr}] ${f.location || f.place}：${f.note || f.memory || ''}`
        })
      }
      
      // 便利贴（最新5条）
      if (space.stickies && space.stickies.length > 0) {
        const recentStickies = space.stickies.slice(-5).reverse()
        contentDetails += `\n\n【便利贴】`
        recentStickies.forEach(s => {
          const timeStr = formatDateTime(s.createdAt)
          contentDetails += `\n- [${timeStr}] ${s.authorName || s.author}："${s.content}"`
        })
      }
      
      // 纪念日（最新5条）
      if (space.anniversaries && space.anniversaries.length > 0) {
        const recentAnniversaries = space.anniversaries.slice(-5).reverse()
        contentDetails += `\n\n【纪念日】`
        recentAnniversaries.forEach(a => {
          contentDetails += `\n- ${a.title}：${a.date}`
        })
      }
      
      // 日程（最近2天）
      if (space.schedules && space.schedules.length > 0) {
        const now = new Date()
        const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
        const recentSchedules = space.schedules.filter(s => {
          const scheduleDate = new Date(s.date)
          return scheduleDate >= now && scheduleDate <= twoDaysLater
        })
        if (recentSchedules.length > 0) {
          contentDetails += `\n\n【最近日程】`
          recentSchedules.forEach(s => {
            contentDetails += `\n- ${s.date} ${s.time || ''}：${s.title}${s.note ? `（${s.note}）` : ''}`
          })
        }
      }

      return `【情侣空间状态】
- 与 ${partnerName} 的恋爱天数：${loveDays} 天
- 共同日记：${diaryCount} 篇
- 纪念相册：${photoCount} 张照片
- 两人小屋动态：${houseStatus}${contentDetails}

- 功能提示：你可以在回复中随时包含 [LS_JSON: ...] 指令来更新空间内容（如日记、留言、足迹、扭蛋等）。指令应静默通过 JSON 执行。`
    },

    gatherContextHistoryForSpace(charId) {
      const space = this.spaces[charId]
      if (!space) return { recentDiary: [], recentMessages: [], recentLetters: [] }
      return {
        recentDiary: (space.diary || []).slice(-3).map(d => `${d.authorName || (d.author === 'user' ? '用户' : '你')}: 《${d.title}》`),
        recentMessages: (space.messages || []).slice(-3).map(m => `${m.senderName || (m.senderId === 'user' ? '用户' : '你')}: "${m.content}"`),
        recentLetters: (space.letters || []).slice(-2).map(l => `${l.authorName || (l.author === 'user' ? '用户' : '你')}: 《${l.title}》`)
      }
    },

    async selectSpace(charId) {
      this.currentPartnerId = charId
      if (!this.spaces[charId]) {
         this.spaces[charId] = DEFAULT_SPACE()
      }
      // Ensure space is initialized for command execution
      if (!this.spaces[charId].initialized) {
        this.spaces[charId].initialized = true
      }
      this.updateLoveDays()
      await this.saveToStorage()
    },

    exitSpace() {
      this.currentPartnerId = null
    },

    async initSpace(partner) {
      const charId = partner.id
      this.currentPartnerId = charId
      this.spaces[charId] = {
        ...DEFAULT_SPACE(),
        initialized: true,
        partner: JSON.parse(JSON.stringify(partner)),
        startDate: new Date().toISOString(),
        loveDays: 1
      }
      await this.saveToStorage()
    },
    
    async updateStartDate(dateStr) {
      if (!this.currentPartnerId) return
      this.currentSpace.startDate = dateStr
      this.updateLoveDays()
      await this.saveToStorage()
    },
    
    async resetSpace() {
      if (!this.currentPartnerId) return
      delete this.spaces[this.currentPartnerId]
      this.currentPartnerId = null
      await this.saveToStorage()
      this.isLoaded = false
      await this.loadFromStorage()
    },
    
    async saveToStorage() {
      const data = JSON.parse(JSON.stringify({
        spaces: this.spaces,
        currentPartnerId: this.currentPartnerId
      }))
      await loveSpaceDB.setItem('all_spaces_v2', data)
      
      // 已禁用：不再同步到微信聊天上下文，情侣空间内容只在提示词中展示
      // await this.syncToWeChat()
    },
    
    async syncToWeChat() {
      // 同步最近的 5 条各模块内容到微信聊天上下文
      const chatStore = (await import('./chatStore.js')).useChatStore()
      const chat = chatStore.chats[this.currentPartnerId]
      if (!chat) return
      
      const syncMessages = []
      
      // 日记
      const recentDiary = (this.currentSpace.diary || []).slice(0, 5)
      recentDiary.forEach(d => {
        syncMessages.push({
          role: 'system',
          type: 'lovespace_diary',
          content: JSON.stringify({ author: d.authorName || d.author, title: d.title, content: d.content }),
          timestamp: Date.now()
        })
      })
      
      // 留言
      const recentMessages = (this.currentSpace.messages || []).slice(0, 5)
      recentMessages.forEach(m => {
        syncMessages.push({
          role: 'system',
          type: 'lovespace_message',
          content: JSON.stringify({ author: m.senderName || m.senderId, content: m.content }),
          timestamp: Date.now()
        })
      })
      
      // 情书
      const recentLetters = (this.currentSpace.letters || []).slice(0, 5)
      recentLetters.forEach(l => {
        syncMessages.push({
          role: 'system',
          type: 'lovespace_letter',
          content: JSON.stringify({ author: l.authorName || l.author, title: l.title, content: l.content }),
          timestamp: Date.now()
        })
      })
      
      // 相册
      const recentAlbum = (this.currentSpace.album || []).slice(0, 5)
      recentAlbum.forEach(a => {
        syncMessages.push({
          role: 'system',
          type: 'lovespace_album',
          content: JSON.stringify({ author: a.author, title: a.title, desc: a.desc, imageUrl: a.url }),
          timestamp: Date.now()
        })
      })
      
      // 便利贴
      const recentStickies = (this.currentSpace.stickies || []).slice(0, 5)
      recentStickies.forEach(s => {
        syncMessages.push({
          role: 'system',
          type: 'lovespace_sticky',
          content: JSON.stringify({ author: s.author, content: s.content }),
          timestamp: Date.now()
        })
      })
      
      // 纪念日
      const recentAnniversaries = (this.currentSpace.anniversaries || []).slice(0, 5)
      recentAnniversaries.forEach(a => {
        syncMessages.push({
          role: 'system',
          type: 'lovespace_anniversary',
          content: JSON.stringify({ name: a.name, date: a.date }),
          timestamp: Date.now()
        })
      })
      
      // 日程表
      const recentSchedules = (this.currentSpace.schedules || []).slice(0, 5)
      recentSchedules.forEach(s => {
        syncMessages.push({
          role: 'system',
          type: 'lovespace_schedule',
          content: JSON.stringify({ 
            date: s.date, 
            time: s.time, 
            title: s.title, 
            description: s.description,
            type: s.type,
            location: s.location,
            mood: s.mood
          }),
          timestamp: Date.now()
        })
      })
      
      // 添加到聊天消息（去重）
      syncMessages.forEach(msg => {
        const exists = chat.msgs.some(m => m.content === msg.content)
        if (!exists) {
          chat.msgs.push(msg)
        }
      })
      
      console.log(`[LoveSpaceStore] Synced ${syncMessages.length} items to WeChat context`)
    },
    
    async loadFromStorage() {
      this.isMagicGenerating = false
      try {
        let data = await loveSpaceDB.getItem('all_spaces_v2')
        if (!data) {
           const oldData = await loveSpaceDB.getItem('all_data')
           if (oldData && oldData.partner) {
              const charId = oldData.partner.id
              data = {
                spaces: { [charId]: oldData },
                currentPartnerId: charId
              }
           }
        }
        if (data) {
          this.spaces = data.spaces || {}
          this.currentPartnerId = data.currentPartnerId || null
          
          // 兼容旧数据：给问题添加 authorId 和 authorName
          Object.values(this.spaces).forEach(space => {
            if (space.questions && Array.isArray(space.questions)) {
              space.questions.forEach(q => {
                if (!q.authorId) {
                  // 旧数据默认是 partner 提问
                  q.authorId = 'partner'
                  q.authorName = this.spaces[Object.keys(this.spaces)[0]]?.partner?.name || 'TA'
                }
              })
            }
            // v1.10.90: 老空间补上 scheduledGeneration 字段
            if (!space.scheduledGeneration) {
              space.scheduledGeneration = { ...DEFAULT_SPACE().scheduledGeneration }
            } else {
              // 补全缺失的子字段
              space.scheduledGeneration = {
                ...DEFAULT_SPACE().scheduledGeneration,
                ...space.scheduledGeneration
              }
            }
            // v1.10.91: 老空间补上 contextMemory 字段
            if (!space.contextMemory) {
              space.contextMemory = { ...DEFAULT_SPACE().contextMemory }
            } else {
              space.contextMemory = {
                ...DEFAULT_SPACE().contextMemory,
                ...space.contextMemory
              }
            }
          })
          
          this.updateLoveDays()
        }
        this.isLoaded = true
        // v1.10.90: 加载完启动全局定时检查器
        this._startScheduledGenerationChecker()
      } catch (e) {
        console.error('[LoveSpaceStore] Load failed', e)
        this.isLoaded = true
      }
    },

    async addDiary(entry) {
      if (!this.currentPartnerId) return
      this.currentSpace.diary.push({ id: Date.now(), ...entry, createdAt: new Date().toISOString() })
      await this.saveToStorage()
    },
    
    async addMessage(message) {
      if (!this.currentPartnerId) return
      this.currentSpace.messages.push({ 
        id: Date.now(), 
        ...message, 
        createdAt: new Date().toISOString() 
      })
      await this.saveToStorage()
    },

    async addAnniversary(anniversary) {
      if (!this.currentPartnerId) return
      this.currentSpace.anniversaries.push({ 
        id: Date.now(), 
        name: anniversary.name,
        date: anniversary.date || new Date().toISOString(),
        createdAt: new Date().toISOString() 
      })
      await this.saveToStorage()
    },

    async updateLoveDays() {
      if (this.currentPartnerId && this.currentSpace.startDate) {
        const start = new Date(this.currentSpace.startDate)
        const now = new Date()
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
        this.currentSpace.loveDays = diff
      }
    },

    async addFootprint(footprint) {
      if (!this.currentPartnerId) return
      // CRITICAL FIX: Ensure we use the provided createdAt if it exists (for bulk generation/history)
      // If none provided, check for 'time' string, else fall back to now.
      const timeVal = footprint.createdAt || 
                      (footprint.time ? new Date(new Date().toDateString() + ' ' + footprint.time).toISOString() : new Date().toISOString())
      
      this.currentSpace.footprints.unshift({ 
        id: Date.now() + Math.floor(Math.random() * 1000), // Add jitter to avoid ID collisions in bulk
        ...footprint, 
        createdAt: timeVal
      })
      await this.saveToStorage()
    },

    async addSticky(sticky) {
      if (!this.currentPartnerId) return
      this.currentSpace.stickies.push({ 
        id: Date.now(), 
        ...sticky, 
        createdAt: new Date().toISOString() 
      })
      await this.saveToStorage()
    },

    async deleteSticky(id) {
      if (!this.currentPartnerId) return
      this.currentSpace.stickies = this.currentSpace.stickies.filter(s => s.id !== id)
      await this.saveToStorage()
    },

    async addLetter(letter) {
      if (!this.currentPartnerId) return
      this.currentSpace.letters.unshift({ 
        id: Date.now(), 
        ...letter, 
        isRead: letter.isRead !== undefined ? letter.isRead : (letter.author === 'partner' ? false : true),
        comments: [],
        paperIndex: letter.paperIndex !== undefined ? letter.paperIndex : Math.floor(Math.random() * 13),
        createdAt: new Date().toISOString() 
      })
      await this.saveToStorage()
    },

    async deleteLetter(id) {
      if (!this.currentPartnerId) return
      this.currentSpace.letters = this.currentSpace.letters.filter(l => l.id !== id)
      await this.saveToStorage()
    },

    async addToAlbum(photo) {
      if (!this.currentPartnerId) return
      this.currentSpace.album.unshift({ 
        id: Date.now(), 
        ...photo, 
        createdAt: new Date().toISOString() 
      })
      await this.saveToStorage()
    },

    async addQuestion(question) {
      if (!this.currentPartnerId) return
      const newQuestion = { 
        id: Date.now(), 
        text: question.text,
        authorId: question.authorId || 'partner',
        authorName: question.authorName || (this.partner?.name || 'TA'),
        userAnswer: question.userAnswer || '',
        partnerAnswer: question.partnerAnswer || '',
        replies: [], // New: Store a list of replies for dialogue
        createdAt: new Date().toISOString() 
      }
      this.currentSpace.questions.unshift(newQuestion)
      await this.saveToStorage()
    },

    async updateHouse(update) {
      if (!this.currentPartnerId) return
      if (!this.currentSpace.house) this.currentSpace.house = DEFAULT_SPACE().house
      
      const house = this.currentSpace.house
      house.comfortLevel = (house.comfortLevel || 100) + (update.comfortIncrease || 0)
      house.lastAction = update.action || '简单打理了一下'
      house.lastActionTime = new Date().toISOString()
      
      if (update.item) {
        if (!house.items) house.items = []
        house.items.push({ id: Date.now(), ...update.item })
      }
      
      await this.saveToStorage()
    },

    async answerQuestion(id, content, isUser = true) {
      if (!this.currentPartnerId) return
      const q = this.currentSpace.questions.find(q => q.id === id)
      if (q) {
        const now = new Date().toISOString()
        const newReply = {
          role: isUser ? 'user' : 'partner',
          content: content,
          createdAt: now
        }
        
        if (!q.replies) q.replies = []
        q.replies.push(newReply)

        if (isUser) {
          q.userAnswer = content
          q.userAnswerAt = now
          // 用户提交之后触发 AI
          this.generateQuestionReply(q)
        } else {
          q.partnerAnswer = content
          q.partnerAnswerAt = now
        }
        await this.saveToStorage()
      }
    },

    // 单独为灵魂提问生成回应
    async generateQuestionReply(questionData) {
      if (!this.currentPartnerId) return
      const charId = this.currentPartnerId
      
      console.log('[LoveSpaceStore] generateQuestionReply starting for question:', questionData.id, 'text:', questionData.text?.substring(0, 50))
      
      const chatStore = (await import('./chatStore.js')).useChatStore()
      const settingsStore = (await import('./settingsStore.js')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService.js')
      const { generateQuestionReplyPrompt } = await import('../utils/ai/prompts_love_single.js')
      
      const chat = chatStore.chats[charId]
      if (!chat) { console.error('[LoveSpaceStore] generateQuestionReply: no chat found for', charId); return }

      const userProfile = settingsStore.personalization.userProfile
      const recentChats = getLastNTurns(chat.msgs || [], 8).map(m => ({ 
        role: m.role === 'ai' ? 'assistant' : 'user', 
        content: m.content 
      }))

      const prompt = generateQuestionReplyPrompt(
        this.partner?.name || 'TA',
        userProfile.name || '我',
        userProfile,
        recentChats,
        questionData
      )

      const messages = [
        { role: 'system', content: prompt }
      ]

      try {
        const aiResponse = await generateReply(messages, charId, null, { isCommandTask: true })
        console.log('[LoveSpaceStore] generateQuestionReply AI response:', aiResponse?.content?.substring(0, 200))
        if (aiResponse && aiResponse.content) {
          await this.executeSpaceCommands(aiResponse.content)
        } else {
          console.warn('[LoveSpaceStore] generateQuestionReply: empty AI response')
        }
      } catch (err) {
        console.error('[LoveSpaceStore] generateQuestionReply error:', err)
        // Fallback: set a generic partnerAnswer so UI doesn't hang
        try {
          const q = this.currentSpace.questions.find(q => q.id === questionData.id)
          if (q && !q.partnerAnswer) {
            q.partnerAnswer = '(TA似乎陷入了沉思，暂时没有回应...)'
            q.partnerAnswerAt = new Date().toISOString()
            await this.saveToStorage()
          }
        } catch (e2) {
          console.error('[LoveSpaceStore] generateQuestionReply fallback failed:', e2)
        }
      }
    },

    // 单独为信件评论生成 AI 回复
    async generateLetterComment(letterData) {
      if (!this.currentPartnerId) return
      const charId = this.currentPartnerId
      
      console.log('[LoveSpaceStore] generateLetterComment starting for letter:', letterData.id, 'title:', letterData.title)
      
      // 检查是否已有 partner 的回复（防止重复）
      const existingPartnerComment = (letterData.comments || []).find(c => c.authorId === 'partner' || c.author === 'partner')
      if (existingPartnerComment) {
        console.log('[LoveSpaceStore] generateLetterComment: partner already commented, skipping')
        return
      }
      
      const chatStore = (await import('./chatStore.js')).useChatStore()
      const settingsStore = (await import('./settingsStore.js')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService.js')
      const { generateLetterCommentPrompt } = await import('../utils/ai/prompts_love_single.js')
      
      const chat = chatStore.chats[charId]
      if (!chat) { console.error('[LoveSpaceStore] generateLetterComment: no chat found for', charId); return }

      const userProfile = settingsStore.personalization.userProfile
      const recentChats = getLastNTurns(chat.msgs || [], 8).map(m => ({ 
        role: m.role === 'ai' ? 'assistant' : 'user', 
        content: m.content 
      }))

      // 构建包含当前评论的 letterData（确保 prompt 能看到最新留言）
      const letterWithComments = {
        ...letterData,
        comments: letterData.comments || []
      }

      const prompt = generateLetterCommentPrompt(
        this.partner?.name || 'TA',
        userProfile.name || '我',
        userProfile,
        recentChats,
        letterWithComments
      )

      const messages = [
        { role: 'system', content: prompt }
      ]

      try {
        const aiResponse = await generateReply(messages, charId, null, { isCommandTask: true })
        console.log('[LoveSpaceStore] generateLetterComment AI response:', aiResponse?.content?.substring(0, 200))
        if (aiResponse && aiResponse.content) {
          await this.executeSpaceCommands(aiResponse.content)
        } else {
          console.warn('[LoveSpaceStore] generateLetterComment: empty AI response')
        }
      } catch (err) {
        console.error('[LoveSpaceStore] generateLetterComment error:', err)
        // Fallback: 添加一条默认回复，不让评论区空着
        try {
          await this.addLetterComment(letterData.id, { 
            content: '(读完你的留言，TA的心里暖暖的，一时不知该如何回应...)', 
            author: 'partner' 
          })
        } catch (e2) {
          console.error('[LoveSpaceStore] generateLetterComment fallback failed:', e2)
        }
      }
    },

    // 日记评论区：用户留言后 AI 回复
    async generateDiaryComment(diaryData) {
      if (!this.currentPartnerId || !diaryData) return

      const charId = this.currentPartnerId
      
      const chatStore = (await import('./chatStore.js')).useChatStore()
      const settingsStore = (await import('./settingsStore.js')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService.js')

      const chat = chatStore.chats[charId]
      if (!chat) {
        console.warn('[LoveSpaceStore] generateDiaryComment: no chat found for', charId)
        return
      }

      const userProfile = settingsStore.personalization.userProfile
      const partnerName = this.partner?.name || 'TA'
      const userName = userProfile.name || '我'
      const recentChats = getLastNTurns(chat.msgs || [], 5).map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content || ''
      }))

      console.log('[LoveSpaceStore] generateDiaryComment for diary:', diaryData.id)

      const { generateDiaryCommentPrompt } = await import('../utils/ai/prompts_love_single.js')

      const prompt = generateDiaryCommentPrompt(partnerName, userName, userProfile, recentChats, diaryData)

      const messages = [
        { role: 'system', content: prompt }
      ]

      try {
        const aiResponse = await generateReply(messages, this.currentPartnerId, null, { isCommandTask: true })
        console.log('[LoveSpaceStore] generateDiaryComment AI response:', aiResponse?.content?.substring(0, 200))
        if (aiResponse && aiResponse.content) {
          await this.executeSpaceCommands(aiResponse.content)
        } else {
          console.warn('[LoveSpaceStore] generateDiaryComment: empty AI response')
        }
      } catch (err) {
        console.error('[LoveSpaceStore] generateDiaryComment error:', err)
        try {
          await this.addDiaryComment(diaryData.id, { 
            content: '(看完你的留言，TA嘴角微微上扬，似乎有很多话想说...)', 
            author: 'partner',
            authorName: partnerName 
          })
        } catch (e2) {
          console.error('[LoveSpaceStore] generateDiaryComment fallback failed:', e2)
        }
      }
    },

    async addLetterComment(letterId, comment) {
      if (!this.currentPartnerId) return
      const letter = this.currentSpace.letters.find(l => l.id === letterId)
      if (letter) {
        if (!letter.comments) letter.comments = []
        letter.comments.push({
          id: Date.now(),
          ...comment,
          createdAt: new Date().toISOString()
        })
        await this.saveToStorage()
      }
    },

    async addAlbumComment(photoId, comment) {
      if (!this.currentPartnerId) return
      const photo = this.currentSpace.album.find(p => p.id === photoId)
      if (photo) {
        if (!photo.comments) photo.comments = []
        photo.comments.push({
          id: Date.now(),
          ...comment,
          createdAt: new Date().toISOString()
        })
        await this.saveToStorage()
      }
    },

    async addDiaryComment(diaryId, comment) {
      if (!this.currentPartnerId) return
      const diary = this.currentSpace.diary.find(d => d.id === diaryId)
      if (diary) {
        if (!diary.comments) diary.comments = []
        diary.comments.push({
          id: Date.now(),
          ...comment,
          createdAt: new Date().toISOString()
        })
        await this.saveToStorage()
      }
    },

    async rollGacha(reward) {
      if (!this.currentPartnerId) return
      
      // 如果提供了 sourceId，说明是从现有蛋池里消耗掉的
      if (reward.sourceId) {
          // Use Number conversion to ensure match regardless of storage type
          const targetId = Number(reward.sourceId)
          const index = this.currentSpace.gachaHistory.findIndex(h => Number(h.id) === targetId)
          if (index !== -1) {
              // Mark as consumed by AI (turning off the ai-generated flag so it's not in the 'pool')
              this.currentSpace.gachaHistory[index].isAiGenerated = false
          }
      }

      this.currentSpace.gachaHistory.unshift({
        id: Date.now(),
        ...reward,
        date: new Date().toISOString()
      })
      await this.saveToStorage()
    },

    // 新增：日程表相关方法
    async addSchedule(schedule) {
      if (!this.currentPartnerId) {
        console.error('[LoveSpaceStore] addSchedule: No currentPartnerId')
        return
      }
      console.log('[LoveSpaceStore] addSchedule:', schedule)
      if (!this.currentSpace.schedules) {
        this.currentSpace.schedules = []
      }
      this.currentSpace.schedules.push({ 
        id: Date.now(), 
        ...schedule, 
        createdAt: new Date().toISOString() 
      })
      // 按日期排序
      this.currentSpace.schedules.sort((a, b) => new Date(b.date) - new Date(a.date))
      console.log('[LoveSpaceStore] addSchedule: After push, total schedules:', this.currentSpace.schedules.length)
      await this.saveToStorage()
      console.log('[LoveSpaceStore] addSchedule: Saved to storage')
    },

    async updateSchedule(id, updates) {
      if (!this.currentPartnerId) return
      const schedule = this.currentSpace.schedules.find(s => s.id === id)
      if (schedule) {
        Object.assign(schedule, updates)
        await this.saveToStorage()
      }
    },

    async deleteSchedule(id) {
      if (!this.currentPartnerId) return
      this.currentSpace.schedules = this.currentSpace.schedules.filter(s => s.id !== id)
      await this.saveToStorage()
    },

    getSchedulesByDate(dateStr) {
      if (!this.currentPartnerId) {
        console.warn('[LoveSpaceStore] getSchedulesByDate: No currentPartnerId')
        return []
      }
      const schedules = this.currentSpace.schedules || []
      console.log(`[LoveSpaceStore] getSchedulesByDate(${dateStr}): total=${schedules.length}, found=`, schedules.filter(s => s.date === dateStr))
      return schedules.filter(s => s.date === dateStr)
    },

    getSchedulesByMonth(year, month) {
      if (!this.currentPartnerId) return []
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
      const schedules = this.currentSpace.schedules || []
      return schedules.filter(s => s.date.startsWith(monthStr))
    },

    // ========== v1.10.90: 定时魔法生成 ==========
    // 计算给定 space 的下次运行时间(纯函数,无副作用)
    _computeNextRunAt(scheduled, fromTs = Date.now()) {
      if (!scheduled || !scheduled.enabled) return null
      if (scheduled.mode === 'daily') {
        // 解析 HH:mm
        const m = String(scheduled.dailyTime || '09:00').match(/^(\d{1,2}):(\d{1,2})$/)
        if (!m) return null
        const hh = parseInt(m[1], 10)
        const mm = parseInt(m[2], 10)
        const next = new Date(fromTs)
        next.setHours(hh, mm, 0, 0)
        // 如果今天的 HH:mm 已经过了,推到明天
        if (next.getTime() <= fromTs) {
          next.setDate(next.getDate() + 1)
        }
        return next.toISOString()
      } else if (scheduled.mode === 'interval') {
        const hours = Math.max(1, parseInt(scheduled.intervalHours) || 6)
        // 如果有上次运行时间,从 lastRunAt + hours 计算;否则从现在 + hours
        const base = scheduled.lastRunAt
          ? new Date(scheduled.lastRunAt).getTime()
          : fromTs
        const next = new Date(base + hours * 60 * 60 * 1000)
        return next.toISOString()
      }
      return null
    },

    // 设置 / 更新当前空间的定时配置
    async setScheduledGeneration(config) {
      if (!this.currentPartnerId) return
      const space = this.spaces[this.currentPartnerId]
      if (!space) return
      const prev = space.scheduledGeneration || DEFAULT_SPACE().scheduledGeneration
      const merged = {
        ...prev,
        ...config
      }
      // 计算 nextRunAt
      merged.nextRunAt = this._computeNextRunAt(merged)
      merged.lastRunAt = prev.lastRunAt || null
      space.scheduledGeneration = merged
      console.log('[LoveSpaceStore] setScheduledGeneration:', merged)
      await this.saveToStorage()
    },

    // 关闭定时生成
    async clearScheduledGeneration() {
      if (!this.currentPartnerId) return
      const space = this.spaces[this.currentPartnerId]
      if (!space) return
      space.scheduledGeneration = {
        ...DEFAULT_SPACE().scheduledGeneration,
        lastRunAt: space.scheduledGeneration?.lastRunAt || null
      }
      await this.saveToStorage()
    },

    // 全局扫描所有空间,如果到点就执行一次魔法生成
    async checkAndRunScheduledGeneration() {
      if (this.isMagicGenerating) return // 全局锁
      const now = Date.now()
      const charIds = Object.keys(this.spaces || {})
      if (charIds.length === 0) return
      for (const charId of charIds) {
        const space = this.spaces[charId]
        if (!space || !space.initialized) continue
        const sched = space.scheduledGeneration
        if (!sched || !sched.enabled) continue
        if (!sched.nextRunAt) {
          // 还没计算过 nextRunAt(老数据/刚启用),补一下
          sched.nextRunAt = this._computeNextRunAt(sched)
          continue
        }
        if (new Date(sched.nextRunAt).getTime() <= now) {
          // 到点了,执行
          console.log(`[LoveSpaceStore] Scheduled generation triggered for ${charId}`)
          try {
            // 先切到对应空间(generateMagicContent 依赖 currentPartnerId)
            const prevId = this.currentPartnerId
            await this.selectSpace(charId)
            await this.generateMagicContent()
            // 更新 lastRunAt + 重算 nextRunAt
            space.scheduledGeneration.lastRunAt = new Date().toISOString()
            space.scheduledGeneration.nextRunAt = this._computeNextRunAt(space.scheduledGeneration)
            await this.saveToStorage()
            // 还原之前的空间(如果有)
            if (prevId && prevId !== charId) {
              await this.selectSpace(prevId)
            }
          } catch (e) {
            console.error(`[LoveSpaceStore] Scheduled generation failed for ${charId}:`, e)
          }
        }
      }
    },

    // 启动全局定时检查器(由 App.vue 调用一次)
    _startScheduledGenerationChecker() {
      if (this._scheduledCheckTimer) return
      this._scheduledCheckTimer = setInterval(() => {
        this.checkAndRunScheduledGeneration().catch(() => {})
      }, 60 * 1000) // 每 60s 检查一次
      // 启动后立即跑一次,补上因 app 关闭漏掉的运行
      setTimeout(() => {
        this.checkAndRunScheduledGeneration().catch(() => {})
      }, 5000)
    },

    // ========== v1.10.91: 上下文记忆设置 ==========
    // 根据当前空间的 contextMemory 配置,获取最近聊天上下文
    // 返回 [{ role, content }] 数组(已格式化,直接用于 prompt)
    _getRecentChats(charId, opts = {}) {
      const chatStore = useChatStore()
      const cfg = (opts.contextMemory
        || this.spaces[charId]?.contextMemory
        || DEFAULT_SPACE().contextMemory)
      const msgs = chatStore.chats[charId]?.msgs || []
      if (!cfg) return []
      if (cfg.mode === 'daily') {
        // 取今天 00:00 之后的所有消息
        const now = new Date()
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
        const filtered = msgs.filter(m => {
          const t = m.timestamp || m.time || m.createTime || 0
          // time 可能是 ISO 字符串,归一化
          const tNum = typeof t === 'string' ? new Date(t).getTime() : t
          return tNum >= dayStart
        })
        // 仍然套用 getLastNTurns(防止某天消息爆炸)
        const turns = Math.max(1, parseInt(cfg.turns) || 30)
        return getLastNTurns(filtered, turns).map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.content
        }))
      } else {
        // turns 模式(默认)
        const turns = Math.max(1, parseInt(cfg.turns) || 30)
        return getLastNTurns(msgs, turns).map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.content
        }))
      }
    },

    // 按 injectDays 过滤数组(取最近 N 天内的项目)
    // arr: 数组
    // days: 天数,0 = 不限制
    // dateField: 日期字段名(默认 'time')
    _filterByDays(arr, days, dateField = 'time') {
      if (!Array.isArray(arr) || arr.length === 0) return []
      if (!days || days <= 0) return arr
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      return arr.filter(item => {
        const t = item?.[dateField]
        if (!t) return false
        const tNum = typeof t === 'string' ? new Date(t).getTime() : t
        return tNum >= cutoff
      })
    },

    // 更新当前空间的 contextMemory 配置
    async setContextMemory(config) {
      if (!this.currentPartnerId) return
      const space = this.spaces[this.currentPartnerId]
      if (!space) return
      const prev = space.contextMemory || DEFAULT_SPACE().contextMemory
      space.contextMemory = {
        ...prev,
        ...config
      }
      console.log('[LoveSpaceStore] setContextMemory:', space.contextMemory)
      await this.saveToStorage()
    },

    async generateMagicContent(targetDate = null) {
      if (!this.currentPartnerId) {
        console.warn('[LoveSpaceStore] generateMagicContent: No currentPartnerId')
        return
      }
      if (this.isMagicGenerating) {
        console.warn('[LoveSpaceStore] generateMagicContent: Already generating')
        return
      }
      
      console.log('[LoveSpaceStore] === Starting Magic Magic generation ===')
      this.isMagicGenerating = true
      const charId = this.currentPartnerId
      
      const chatStore = (await import('./chatStore.js')).useChatStore()
      const settingsStore = (await import('./settingsStore.js')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService.js')
      const { LOVE_SPACE_GENERATOR_PROMPT } = await import('../utils/ai/prompts_love.js')
      
      const chat = chatStore.chats[charId]
      if (!chat) return

      const userProfile = settingsStore.personalization.userProfile
      const dateToUse = targetDate || new Date().toISOString().split('T')[0]
      // v1.10.91: 注入记忆天数(只把最近 N 天内的内容灌到 system prompt)
      const injectDays = this.currentSpace?.contextMemory?.injectDays ?? 7
      // 辅助:过滤+按时间倒序
      const _recentByDays = (arr, dateField = 'time') => {
        const filtered = this._filterByDays(arr, injectDays, dateField)
        // 倒序(最新在前)
        return filtered.slice().sort((a, b) => {
          const ta = typeof a[dateField] === 'string' ? new Date(a[dateField]).getTime() : (a[dateField] || 0)
          const tb = typeof b[dateField] === 'string' ? new Date(b[dateField]).getTime() : (b[dateField] || 0)
          return tb - ta
        })
      }
      const spaceHistory = {
        targetDate: dateToUse,
        injectDays: injectDays,  // 透传给 prompt 模板方便 AI 知晓
        recentDiary: _recentByDays(this.currentSpace.diary || [], 'createdAt').slice(0, 5).map(d => `${d.authorName || '我'}: 《${d.title}》(${d.mood})\n${d.content || '无内容'}`),
        todayFootprints: (this.currentSpace.footprints || [])
          .filter(f => f.createdAt?.startsWith(dateToUse))
          .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(f => `${new Date(f.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}: ${f.content} (@${f.location})`)
          .join(' -> ') || '今日暂无足迹',
        unansweredQuestions: (this.currentSpace.questions || [])
          .filter(q => !q.partnerAnswer)
          .map(q => `(ID:${q.id}) ${q.text} ${q.userAnswer ? `[用户已答：${q.userAnswer}]` : '[等待提问]'}`),
        recentUserMessages: _recentByDays(
          (this.currentSpace.messages || []).filter(m => m.senderId === 'user'),
          'createdAt'
        ).slice(0, 5)
          .map(m => `【用户留言】ID:${m.id} ${m.senderName}: ${m.content}`)
          .join('\n'),
        recentPartnerMessages: _recentByDays(
          (this.currentSpace.messages || []).filter(m => m.senderId !== 'user'),
          'createdAt'
        ).slice(0, 3)
          .map(m => `【我的留言】ID:${m.id} ${m.senderName}: ${m.content}`)
          .join('\n'),
        // 用户来信（未回复的）
        unansweredLetters: _recentByDays(
          (this.currentSpace.letters || []).filter(l => l.author === 'user' && !l.comments?.length),
          'createdAt'
        ).slice(0, 3)
          .map(l => `【用户来信】《${l.title}》(ID:${l.id}): ${l.content}`)
          .join('\n---\n') || '暂无',
        // 有用户评论但AI尚未回复的信件
        uncommentedLetters: _recentByDays(
          (this.currentSpace.letters || []).filter(l => {
            const hasUserComment = (l.comments || []).some(c => c.authorId === 'user' || c.author === 'user')
            const hasPartnerComment = (l.comments || []).some(c => c.authorId === 'partner' || c.author === 'partner')
            return hasUserComment && !hasPartnerComment
          }),
          'createdAt'
        ).slice(0, 3)
          .map(l => {
            const userComments = (l.comments || [])
              .filter(c => c.authorId === 'user' || c.author === 'user')
              .map(c => `${c.authorName || '?'}: ${c.text || c.content}`).join(' | ')
            return `【信件《${l.title}》(ID:${l.id})】用户留言: ${userComments}`
          })
          .join('\n') || '暂无',
        // 最近的相册
        recentAlbum: _recentByDays(this.currentSpace.album || [], 'createdAt').slice(0, 5)
          .map(a => `${a.title}${a.desc ? ': ' + a.desc : ''}`),
        // 便利贴(最近 N 天内)
        recentStickies: _recentByDays(this.currentSpace.stickies || [], 'createdAt').slice(0, 5)
          .map(s => `《${s.title || s.content?.slice(0, 20)}》: ${s.content || ''}`),
        // 纪念日(只看未来 30 天内 + 最近 N 天内的)
        recentAnniversaries: _recentByDays(this.currentSpace.anniversaries || [], 'createdAt').slice(0, 5)
          .map(a => `${a.title} (${a.date})`)
      }

      // v1.10.91: 用 contextMemory 配置(turns/daily)取上下文,默认 30 轮
      const charHistory = this._getRecentChats(charId)

      const msgWarning = spaceHistory.recentUserMessages ? "" : "\n【重要】甜蜜留言板当前是空的，不要尝试回复任何不存在的消息（replyToId 也要为空）。";
      const systemPrompt = `你现在是 ${chat.name}。你正在与 ${userProfile.name} 经营专属情侣空间。
${LOVE_SPACE_GENERATOR_PROMPT(chat.name, userProfile.name, this.loveDays, spaceHistory, charHistory)}${msgWarning}
严禁输出任何多余内容，只需输出以 [LS_JSON: ...] 格式包裹的指令集。`;

      try {
        const result = await generateReply([
          { role: 'system', content: systemPrompt }
          // [FIX] 不再重复传递 charHistory，因为 systemPrompt 中已经包含了
        ], { name: chat.name, id: chat.id, prompt: systemPrompt }, null, { 
          isCommandTask: true, 
          isSimpleTask: true 
        })

        if (result.content) {
          console.log('[LoveSpaceStore] Calling executeSpaceCommands with result.content:', result.content.substring(0, 300))
          const execRes = await this.executeSpaceCommands(result.content, chat.name, targetDate, charId)
          if (execRes && execRes.executedCount > 0) {
            chatStore.triggerToast('💖 恋爱空间已同步更新！', 'success')
          } else {
            // [FIX] 内容回来了但 0 个命令被执行,说明 LS_JSON 解析失败
            // AI 对 [LS_JSON: ...] 包装格式的遵循非确定 (temperature 0.7 默认值偏高),
            // 自动重试一次,加更严格的格式约束
            console.warn('[LoveSpaceStore] No commands executed. Retrying with stronger format constraint. Content preview:', result.content.substring(0, 500))
            const retryResult = await generateReply([
              { role: 'system', content: systemPrompt + '\n\n【上一轮格式不合规！重试提醒】你上次的输出没有正确遵守 [LS_JSON: {...}] 格式。本次必须严格遵守,只输出一个 [LS_JSON: {...}] 块,不要任何解释、思考、换行或多余的 Markdown 包裹。' }
            ], { name: chat.name, id: chat.id, prompt: systemPrompt }, null, {
              isCommandTask: true,
              isSimpleTask: true
            })
            if (retryResult.content) {
              const retryExec = await this.executeSpaceCommands(retryResult.content, chat.name, targetDate, charId)
              if (retryExec && retryExec.executedCount > 0) {
                chatStore.triggerToast('💖 恋爱空间已同步更新！', 'success')
              } else {
                console.error('[LoveSpaceStore] Retry also failed. Retry content:', retryResult.content.substring(0, 500))
                chatStore.triggerToast('AI 输出格式异常，请重试或换个模型', 'error')
              }
            } else {
              chatStore.triggerToast('AI 重试仍为空，请稍后再试', 'error')
            }
          }
        } else if (result.error) {
          // [FIX] 把 AI 真实错误透传给用户,避免静默失败
          console.error('[LoveSpaceStore] generateMagicContent AI error:', result.error)
          chatStore.triggerToast(`AI 报错: ${result.error}`, 'error')
        } else {
          console.warn('[LoveSpaceStore] generateMagicContent: Empty result. Raw:', result)
        }
      } catch (err) {
        console.error('[LoveSpaceStore] generateMagicContent failed:', err)
        chatStore.triggerToast('魔法施放失败，稍后再试一次吧~', 'error')
      } finally {
        this.isMagicGenerating = false
      }
    },

    // 单独生成某个功能
    async generateSingleFeature(featureType) {
      if (!this.currentPartnerId) {
        console.warn('[LoveSpaceStore] generateSingleFeature: No currentPartnerId')
        return
      }
      const charId = this.currentPartnerId
      if (this.isMagicGenerating) {
        console.warn('[LoveSpaceStore] generateSingleFeature: Already generating')
        return
      }
      
      console.log(`[LoveSpaceStore] === Starting generation for ${featureType} ===`)
      this.isMagicGenerating = true
      
      const chatStore = (await import('./chatStore.js')).useChatStore()
      const settingsStore = (await import('./settingsStore.js')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService.js')
      
      // 导入对应的提示词函数
      console.log(`[LoveSpaceStore] === Importing prompts for ${featureType} ===`)
      const prompts = await import('../utils/ai/prompts_love_single.js')
      console.log(`[LoveSpaceStore] Imported prompts_love_single, available functions:`, Object.keys(prompts))
      
      const promptFunctionName = `generate${featureType.charAt(0).toUpperCase() + featureType.slice(1)}Prompt`
      console.log(`[LoveSpaceStore] Looking for function: ${promptFunctionName}`)
      
      const promptFunction = prompts[promptFunctionName]
      if (!promptFunction) {
        console.error(`[LoveSpaceStore] Function ${promptFunctionName} not found!`)
        chatStore.triggerToast(`不支持的功能类型：${featureType}`, 'error')
        return
      }
      console.log(`[LoveSpaceStore] Found function ${promptFunctionName}, preparing to call...`)
      
      // 获取功能名称用于显示
      const getFeatureName = (type) => {
        const names = {
          diary: '日记',
          message: '留言',
          footprint: '足迹',
          question: '问题',
          letter: '信件',
          gacha: '扭蛋机',
          album: '相册',
          anniversary: '纪念日',
          house: '爱巢',
          sticky: '便利贴',
          schedule: '日程',
          letterComment: '信件评论'
        }
        return names[type] || type
      }
      
      const chat = chatStore.chats[charId]
      if (!chat) return

      const userProfile = settingsStore.personalization.userProfile

      // v1.10.91: 用 contextMemory 配置(turns/daily)取上下文
      const recentChats = this._getRecentChats(charId)
      
      // 获取该功能最近 5 条历史记录
      let featureHistory = []
      switch(featureType) {
        case 'diary':
          featureHistory = (this.currentSpace.diary || []).slice(-5)
          break
        case 'message':
          featureHistory = (this.currentSpace.messages || []).slice(-5)
          break
        case 'footprint':
          featureHistory = (this.currentSpace.footprints || []).slice(-5)
          break
        case 'question':
          featureHistory = (this.currentSpace.questions || []).slice(-5)  // 所有问题，不只是未回答的
          break
        case 'letter':
          featureHistory = (this.currentSpace.letters || []).slice(-5)  // 所有信件，包括用户和角色的
          break
        case 'gacha':
          featureHistory = (this.currentSpace.gachaHistory || []).slice(-5)
          break
        case 'album':
          featureHistory = (this.currentSpace.album || []).slice(-5)
          break
        case 'anniversary':
          featureHistory = (this.currentSpace.anniversaries || []).slice(-5)
          break
        case 'house':
          featureHistory = [this.currentSpace.house || {}]
          break
        case 'sticky':
          featureHistory = (this.currentSpace.stickies || []).slice(-5)
          break
        case 'schedule':
          featureHistory = (this.currentSpace.schedules || []).slice(-5)
          break
        case 'letterComment':
          // 获取有用户评论但AI尚未回复的信件
          featureHistory = (this.currentSpace.letters || [])
            .filter(l => {
              const hasUserComment = (l.comments || []).some(c => c.authorId === 'user' || c.author === 'user')
              const hasPartnerComment = (l.comments || []).some(c => c.authorId === 'partner' || c.author === 'partner')
              return hasUserComment && !hasPartnerComment
            })
            .slice(-5)
          break
      }
      
      // 生成提示词
      // 修复：传递正确的人设和用户设定到提示词构建器
      const systemPrompt = promptFunction(
        chat.name,
        userProfile.name,
        { 
          ...userProfile, 
          characterName: chat.prompt || chat.description || '未知', 
          userName: chat.userPersona || '未知' 
        },
        recentChats,
        featureHistory
      )
      
      console.log(`[LoveSpaceStore] === ${featureType} Prompt Start ===`)
      console.log(`[LoveSpaceStore] Prompt function name: generate${featureType.charAt(0).toUpperCase() + featureType.slice(1)}Prompt`)
      console.log(`[LoveSpaceStore] Prompt length: ${systemPrompt.length}`)
      console.log(`[LoveSpaceStore] Prompt preview:`, systemPrompt.substring(0, 500))
      console.log(`[LoveSpaceStore] === ${featureType} Prompt End ===`)
      
      try {
        const result = await generateReply([
          { role: 'system', content: systemPrompt }
          // [FIX] 不再重复传递 recentChats，因为 systemPrompt 中已经包含了
        ], { 
          name: chat.name, 
          id: chat.id,
          prompt: systemPrompt  // 传入完整的提示词，确保 isSimpleTask 模式使用正确的 prompt
        }, null, { 
          isCommandTask: true, 
          isSimpleTask: true 
        })

        if (result.content) {
          console.log(`[LoveSpaceStore] Single feature ${featureType} generated:`, result.content.substring(0, 300))
          const execRes = await this.executeSpaceCommands(result.content, chat.name, null, charId)
          if (execRes && execRes.executedCount > 0) {
            // 成功
          } else {
            // [FIX] AI 对 [LS_JSON: ...] 包装格式的遵循非确定 (temperature 0.7 默认值偏高),
            // 自动重试一次,加更严格的格式约束
            console.warn(`[LoveSpaceStore] ${featureType} first attempt: 0 commands. Retrying with stronger format constraint.`)
            const retryResult = await generateReply([
              { role: 'system', content: systemPrompt + '\n\n【上一轮格式不合规！重试提醒】你上次的输出没有正确遵守 [LS_JSON: {...}] 格式。本次必须严格遵守,只输出一个 [LS_JSON: {...}] 块,不要任何解释、思考、换行或多余的 Markdown 包裹。' }
            ], {
              name: chat.name,
              id: chat.id,
              prompt: systemPrompt
            }, null, {
              isCommandTask: true,
              isSimpleTask: true
            })
            if (retryResult.content) {
              const retryExec = await this.executeSpaceCommands(retryResult.content, chat.name, null, charId)
              if (!retryExec || retryExec.executedCount === 0) {
                console.error(`[LoveSpaceStore] ${featureType} retry also failed. Content:`, retryResult.content.substring(0, 500))
                chatStore.triggerToast('AI 输出格式异常，请重试或换个模型', 'error')
              }
            } else if (retryResult.error) {
              chatStore.triggerToast(`AI 重试报错: ${retryResult.error}`, 'error')
            } else {
              chatStore.triggerToast('AI 重试仍为空，请稍后再试', 'error')
            }
          }
        } else if (result.error) {
          // [FIX] 把 AI 真实错误透传给用户,避免静默失败
          console.error(`[LoveSpaceStore] AI returned error for ${featureType}:`, result.error)
          chatStore.triggerToast(`AI 报错: ${result.error}`, 'error')
        } else {
          // [FIX] 既没 content 也没 error,记下原始 response 方便排查
          console.warn(`[LoveSpaceStore] Empty result for ${featureType}. Raw:`, result)
        }
      } catch (err) {
        console.error(`[LoveSpaceStore] Single feature ${featureType} generation failed`, err)
        chatStore.triggerToast('魔法施放失败，稍后再试一次吧~', 'error')
      } finally {
        this.isMagicGenerating = false
      }
    },

    async executeSpaceCommands(text, partnerName, targetDate = null, forcedCharId = null) {
      if (!text) return { success: false, reason: 'No text' }
      const chatStore = (await import('./chatStore.js')).useChatStore()
      
      // 关键修复：如果当前没有选择空间，或者强制指定了空间ID，则先进行选择
      if (forcedCharId && this.currentPartnerId !== forcedCharId) {
          console.log('[LoveSpaceStore] Switching/Setting partner for command execution:', forcedCharId)
          await this.selectSpace(forcedCharId)
      }
      
      if (!this.currentPartnerId) {
          console.error('[LoveSpaceStore] Critical error: executeSpaceCommands called without currentPartnerId and no forcedCharId provided.')
          return { success: false, reason: 'No partner selected' }
      }
      
      const blocks = []
      const startMarkerRegex = /[\\[【]\s*(?:LS_JSON|LS|情侣空间)[:：]?\s*/gi
      
      // Robust extraction using balanced brace matching (Manual loop to avoid regex lastIndex issues)
      let match;
      const searchRegex = new RegExp(startMarkerRegex.source, startMarkerRegex.flags);
      
      while ((match = searchRegex.exec(text)) !== null) {
        const startIdx = match.index;
        const markerText = match[0];
        const contentStart = startIdx + markerText.length;
        
        console.log('[LoveSpaceStore] Found LS_JSON marker at index:', startIdx);
        
        const firstBrace = text.indexOf('{', contentStart);
        if (firstBrace === -1) continue;

        let braceCount = 0;
        let inString = false;
        let isEscaped = false;
        let jsonEndIdx = -1;

        for (let i = firstBrace; i < text.length; i++) {
          const char = text[i];
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

        if (jsonEndIdx === -1) {
          // Attempt repair for unfinished JSON (e.g. interrupted stream)
          console.warn('[LoveSpaceStore] LS_JSON block appears unfinished, attempting repair...');
          const remaining = text.substring(contentStart).trim();
          if (remaining.startsWith('{')) {
            let patched = remaining;
            for (let j = 0; j < 8; j++) {
              try {
                JSON.parse(patched);
                blocks.push(patched);
                jsonEndIdx = text.length; 
                console.log('[LoveSpaceStore] Successfully repaired interrupted JSON');
                break;
              } catch(e) {
                const openB = (patched.match(/{/g) || []).length;
                const closeB = (patched.match(/}/g) || []).length;
                const openA = (patched.match(/\[/g) || []).length;
                const closeA = (patched.match(/\]/g) || []).length;
                
                if (openB > closeB) patched += '}';
                else if (openA > closeA) patched += ']';
                else patched += '"}'; 
              }
            }
          }
          if (jsonEndIdx === -1) break; // Failed repair
          searchRegex.lastIndex = text.length; // Stop searching
        } else {
          // Successfully found the end of the JSON object
          // Include the closing bracket ] or 】 if present
          let finalEndIdx = jsonEndIdx + 1;
          const afterJson = text.substring(jsonEndIdx + 1, jsonEndIdx + 10);
          const bracketMatch = afterJson.match(/^\s*[\]】]/);
          if (bracketMatch) {
            finalEndIdx = jsonEndIdx + 1 + bracketMatch[0].length;
          }
          
          const rawBlock = text.substring(contentStart, finalEndIdx).trim();
          // Extract only the part between { and } if needed, but parser handles it
          blocks.push(rawBlock);
          
          // Move regex index forward
          searchRegex.lastIndex = finalEndIdx;
        }
      }
      
      console.log('[LoveSpaceStore] Total LS_JSON blocks found:', blocks.length)
      console.log('[LoveSpaceStore] Input text sample:', text.substring(0, 200))
      
      // AI 容错：如果没有找到 [LS_JSON: 标记，但内容看起来是完整的 JSON，也进行尝试
      if (blocks.length === 0) {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          console.log('[LoveSpaceStore] No [LS_JSON: found, but found raw JSON block, using it.')
          blocks.push(jsonMatch[0])
        }
      }

      let totalExecutedCount = 0
      
      for (let jsonStr of blocks) {
        try {
          // 极致容错预处理
          const startBrace = jsonStr.indexOf('{')
          const endBrace = jsonStr.lastIndexOf('}')
          if (startBrace !== -1 && endBrace !== -1) {
            jsonStr = jsonStr.substring(startBrace, endBrace + 1)
          }

          // Fix common AI JSON errors
          jsonStr = jsonStr
            .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // remove control characters
            .replace(/\\n/g, ' ') // treat escaped newlines as spaces for easier parsing
          
          console.log('[LoveSpaceStore] Parsing cleaned JSON:', jsonStr.substring(0, 100) + '...')
          
          const data = JSON.parse(jsonStr)
          let commands = Array.isArray(data.commands) ? data.commands : []
          
          // AI 容错：如果 commands 缺失但根节点有具体的业务字段，则手动拾取
          if (commands.length === 0) {
            // 1. 检查根节点是否有 type 字段 (AI 经常直接返回单个指令对象)
            if (data.type && typeof data.type === 'string') {
                commands.push(data);
            } else {
                // 2. 检查是否有业务名称命名的字段
                const knownTypes = ['diary', 'footprint', 'message', 'question', 'letter', 'gacha', 'album', 'anniversary', 'house', 'sticky', 'answer', 'schedule'];
                let foundDirectField = false;
                knownTypes.forEach(t => {
                    // 支持单数和复数形式 (如 sticky 和 stickies, message 和 messages)
                    const pluralKey = t === 'diary' ? 'diaries' : (t === 'sticky' ? 'stickies' : t + 's');
                    const key = data[t] ? t : (data[pluralKey] ? pluralKey : null);

                    if (key) {
                        foundDirectField = true;
                        const val = data[key];
                        if (Array.isArray(val)) {
                            val.forEach(item => commands.push({ type: t, ...item }));
                        } else if (typeof val === 'object') {
                            commands.push({ type: t, ...val });
                        }
                    }
                });

                // 3. 终极容错：如果还没找到，看看有没有 content 字段，如果有，大概率是个 message
                if (!foundDirectField && data.content && !data.type) {
                  commands.push({ type: 'message', ...data });
                }
            }
          }
          
          console.log('[LoveSpaceStore] Parsed successfully, commands:', commands.length)
          console.log('[LoveSpaceStore] Command types:', commands.map(c => c.type))
          
          console.log('[LoveSpaceStore] Executing command tasks sequentially to ensure image generation...')
          
          // Toast 队列，用于延迟显示
          const toastQueue = []
          
          // 串行执行，确保图片生成不被阻塞
          for (const cmd of commands) {
            const type = cmd.type?.toLowerCase()
            console.log('[LoveSpaceStore] Executing command:', type)
            
            if (type === 'bind') {
              const startDate = cmd.startDate || new Date().toISOString()
              await this.selectSpace(chatStore.currentChatId)
              await this.updateStartDate(startDate)
              toastQueue.push({ message: '💕 情侣空间正式开通！', type: 'success' })
            } else if (type === 'footprint') {
              // Support both single footprint and footprints array
              const footprintItems = cmd.footprints ? cmd.footprints : [cmd]
              
              for (const fpCmd of footprintItems) {
                // Duplicate check for footprint
                const isDup = (this.currentSpace.footprints || []).some(f => f.content === fpCmd.content && f.location === fpCmd.location)
                if (isDup) {
                  console.log('[LoveSpaceStore] Skipping duplicate footprint:', fpCmd.content)
                } else {
                const baseTime = targetDate ? new Date(targetDate) : new Date()
                let createdAt = baseTime.toISOString()
                if (cmd.time) {
                  const [h, m] = cmd.time.split(':')
                  const d = new Date(baseTime)
                  d.setHours(parseInt(h) || 0)
                  d.setMinutes(parseInt(m) || 0)
                  createdAt = d.toISOString()
                } else if (commands.filter(c => c.type === 'footprint').length > 1) {
                  // 如果 AI 给了多条足迹但没给时间，按顺序往前倒推分布
                  const fpIndex = commands.filter(c => c.type === 'footprint').indexOf(cmd)
                  const totalFp = commands.filter(c => c.type === 'footprint').length
                  const jitterMinutes = (totalFp - 1 - fpIndex) * 45 // 往前倒推，每隔 45 分钟左右
                  const d = new Date(baseTime)
                  d.setMinutes(d.getMinutes() - jitterMinutes)
                  createdAt = d.toISOString()
                }
                await this.addFootprint({ content: fpCmd.content, location: fpCmd.location || '未知', createdAt })
                toastQueue.push({ message: '👣 足迹已生成', type: 'success' })
                }
              } // end for footprintItems
            } else if (type === 'diary') {
              // Duplicate check for diary
              const isDup = (this.currentSpace.diary || []).some(d => d.title === cmd.title && d.content === cmd.content)
              if (isDup) {
                console.log('[LoveSpaceStore] Skipping duplicate diary:', cmd.title)
              } else {
                // Heuristic: If AI didn't use newlines but used double spaces for paragraphs, fix it
                let finalContent = cmd.content || ''
                if (!finalContent.includes('\n') && finalContent.includes('  ')) {
                    finalContent = finalContent.replace(/\s\s+/g, '\n\n')
                }
                
                await this.addDiary({ 
                  title: cmd.title, content: finalContent, 
                  weather: cmd.weather, mood: cmd.mood,
                  author: 'partner', authorName: partnerName
                })
                toastQueue.push({ message: '📔 日记已生成', type: 'success' })
              }
            } else if (type === 'message') {
              console.log('[LoveSpaceStore] Processing message command:', cmd)
              // 修复：检查 content 是否为空或无效
              const messageContent = cmd.content?.trim?.() || cmd.text?.trim?.() || '';
              if (!messageContent) {
                console.warn('[LoveSpaceStore] Skipping empty message command:', cmd);
                continue;
              }
              // Duplicate check for space messages
              const isDup = (this.currentSpace.messages || []).some(m => m.content === messageContent)
              if (isDup) {
                console.log('[LoveSpaceStore] Skipping duplicate space message:', messageContent)
              } else {
                console.log('[LoveSpaceStore] Adding message:', messageContent)
                await this.addMessage({ 
                  content: messageContent, senderId: 'partner',
                  senderName: partnerName, replyToId: cmd.replyToId
                })
                console.log('[LoveSpaceStore] Message added successfully')
                toastQueue.push({ message: '💬 留言已生成', type: 'success' })
              }
            } else if (type === 'gacha') {
              await this.rollGacha({ 
                name: cmd.name, 
                desc: cmd.desc, 
                icon: cmd.icon,
                isAiGenerated: true  // 标记为 AI 生成
              })
              toastQueue.push({ message: '🎁 获得一份神秘礼物，快去看看吧~', type: 'success' })
            } else if (type === 'letter') {
              console.log('[LoveSpaceStore] Parsing letter command:', cmd.title)
              
              // Heuristic: Newline fix for letters too
              let finalContent = cmd.content || ''
              if (!finalContent.includes('\n') && finalContent.includes('  ')) {
                  finalContent = finalContent.replace(/\s\s+/g, '\n\n')
              }

              await this.addLetter({ 
                title: cmd.title, 
                content: finalContent, 
                author: 'partner',
                isRead: false,
                paperIndex: cmd.paperIndex !== undefined ? cmd.paperIndex : Math.floor(Math.random() * 13)
              })
              toastQueue.push({ message: '💌 信件已收到', type: 'success' })
            } else if (type === 'question') {
              // Duplicate question check
              const isDup = (this.currentSpace.questions || []).some(q => q.text === cmd.text)
              if (isDup) {
                console.log('[LoveSpaceStore] Skipping duplicate question:', cmd.text)
              } else {
                await this.addQuestion({ text: cmd.text, authorId: 'partner' })
                chatStore.triggerToast('❓ 问题已生成', 'success')
              }
            } else if (type === 'answer') {
              if (cmd.qId) await this.answerQuestion(cmd.qId, cmd.content, false)
            } else if (type === 'letterComment') {
              if (cmd.letterId) {
                await this.addLetterComment(cmd.letterId, { content: cmd.content, author: 'partner' })
                chatStore.triggerToast('💬 评论已发布', 'success')
              }
            } else if (type === 'albumComment') {
              if (cmd.photoId) {
                await this.addAlbumComment(cmd.photoId, { content: cmd.content, author: 'partner' })
                chatStore.triggerToast('💬 评论已发布', 'success')
              }
            } else if (type === 'diaryComment') {
              if (cmd.diaryId) {
                await this.addDiaryComment(cmd.diaryId, { content: cmd.content, author: 'partner' })
                chatStore.triggerToast('💬 评论已发布', 'success')
              }
            } else if (type === 'sticky') {
              await this.addSticky({ content: cmd.content || cmd.text, color: cmd.color, author: 'partner' })
              chatStore.triggerToast('📝 便利贴已生成', 'success')
            } else if (type === 'anniversary') {
              await this.addAnniversary({ name: cmd.name || cmd.title, date: cmd.date })
              chatStore.triggerToast('🎉 纪念日已生成', 'success')
            } else if (type === 'album') {
              // 立即保存，不等待图片生成
              let imageUrl = cmd.imageUrl || cmd.image
              if (!imageUrl && cmd.draw_cmd) {
                // 先保存占位符，后台生成图片
                const tempId = Date.now()
                await this.addToAlbum({ 
                  title: cmd.title, 
                  url: '', // 占位符
                  desc: cmd.desc, 
                  draw_cmd: cmd.draw_cmd, 
                  author: 'partner',
                  tempId: tempId
                })
                chatStore.triggerToast('🖼️ 相册已生成 (图片生成中...)', 'success')
                // 后台异步生成图片，不阻塞
                const { generateImage } = await import('../utils/aiService.js')
                const prompt = cmd.draw_cmd.replace(/\[DRAW:\s*(.*?)\s*\]/i, '$1')
                generateImage(prompt, { chatId: this.currentPartnerId })
                  .then(url => {
                    // 图片生成完成后更新
                    const album = this.currentSpace.album.find(a => a.tempId === tempId)
                    if (album) {
                      album.url = url
                      delete album.tempId
                      this.saveToStorage()
                    }
                  })
                  .catch(e => console.error('[LoveSpaceStore] Album image generation failed', e))
              } else {
                await this.addToAlbum({ 
                  title: cmd.title, url: imageUrl, 
                  desc: cmd.desc, draw_cmd: cmd.draw_cmd, author: 'partner' 
                })
                chatStore.triggerToast('🖼️ 相册已生成', 'success')
              }
            } else if (type === 'house') {
              await this.updateHouse({ 
                action: cmd.action, comfortIncrease: cmd.comfortIncrease, item: cmd.item 
              })
              chatStore.triggerToast('🏠 小屋已更新', 'success')
            } else if (type === 'schedule') {
              console.log('[LoveSpaceStore] Processing schedule command:', cmd)
              console.log('[LoveSpaceStore] currentPartnerId:', this.currentPartnerId)
              console.log('[LoveSpaceStore] currentSpace:', this.currentSpace ? 'exists' : 'null')
              await this.addSchedule({
                date: cmd.date,
                time: cmd.time,
                title: cmd.title,
                description: cmd.description,
                type: cmd.eventType || 'daily',
                location: cmd.location || '',
                mood: cmd.mood || 'normal'
              })
              console.log('[LoveSpaceStore] Schedule added successfully, total schedules:', this.currentSpace.schedules.length)
              toastQueue.push({ message: '📅 日程已生成', type: 'success' })
            }
          }
          
          // 执行完成后，延迟显示 Toast 队列
          if (toastQueue.length > 0) {
            console.log('[LoveSpaceStore] Toast queue created:', toastQueue.length)
            // 延迟 500ms 后开始显示，每个间隔 2 秒
            toastQueue.forEach((toast, index) => {
              setTimeout(() => {
                chatStore.triggerToast(toast.message, toast.type)
              }, 500 + index * 2000)
            })
          }
          
          // 执行完成后显示提示
          const executedCount = commands.length
          totalExecutedCount += executedCount
          console.log(`[LoveSpaceStore] Successfully executed ${executedCount} commands in this block`)
          
        } catch (e) {
          console.error('[LoveSpaceStore] Command execution error for block:', e)
          // Continue to next block instead of throwing
        }
      }
      
      // 执行完成后全局保存一次
      await this.saveToStorage()
      
      // 返回执行结果
      return { success: true, executedCount: totalExecutedCount }
    }
  }
})
