import { defineStore } from 'pinia'
import localforage from 'localforage'
import { LOVE_SPACE_GENERATOR_PROMPT } from '@/utils/ai/prompts_love'

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
  schedules: []  // 新增：日程表数据
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
    partner() { return this.currentSpace.partner },
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
      if (!this.spaces[charId] || !this.spaces[charId].initialized) return null
      
      const space = this.spaces[charId]
      const loveDays = space.loveDays || 0
      const diaryCount = (space.diary || []).length
      const photoCount = (space.album || []).length
      const partnerName = space.partner?.name || 'TA'
      const houseStatus = space.house?.lastAction || '在这里开启你们的生活吧'
      
      return `【情侣空间状态】
- 与 ${partnerName} 的恋爱天数：${loveDays} 天
- 共同日记：${diaryCount} 篇
- 纪念相册：${photoCount} 张照片
- 两人小屋动态：${houseStatus}
- 功能提示：你们正在经营专属的情侣空间。你可以在回复中随时包含 [LS_JSON: ...] 指令来更新空间内容（如日记、留言、足迹、扭蛋等）。`
    },

    async selectSpace(charId) {
      this.currentPartnerId = charId
      if (!this.spaces[charId]) {
         this.spaces[charId] = DEFAULT_SPACE()
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
      
      // 同步最近 5 条各模块内容到微信聊天上下文
      await this.syncToWeChat()
    },
    
    async syncToWeChat() {
      // 同步最近的 5 条各模块内容到微信聊天上下文
      const chatStore = (await import('./chatStore')).useChatStore()
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
          this.updateLoveDays()
        }
        this.isLoaded = true
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
      this.currentSpace.footprints.unshift({ 
        id: Date.now(), 
        ...footprint, 
        createdAt: footprint.time ? new Date(new Date().toDateString() + ' ' + footprint.time).toISOString() : new Date().toISOString()
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
        if (isUser) {
          q.userAnswer = content
          // 用户提交心声后，自动触发 AI 回应
          this.generateQuestionReply(q)
        } else {
          q.partnerAnswer = content
        }
        await this.saveToStorage()
      }
    },

    // 单独为灵魂提问生成回应
    async generateQuestionReply(questionData) {
      if (!this.currentPartnerId) return
      const charId = this.currentPartnerId
      
      const chatStore = (await import('./chatStore')).useChatStore()
      const settingsStore = (await import('./settingsStore')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService')
      const { generateQuestionReplyPrompt } = await import('../utils/ai/prompts_love_single')
      
      const chat = chatStore.chats[charId]
      if (!chat) return

      const userProfile = settingsStore.personalization.userProfile
      const recentChats = (chat.msgs || []).slice(-15).map(m => ({ 
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

      try {
        const aiResponse = await generateReply(prompt, charId)
        if (aiResponse) {
          await this.executeSpaceCommands(aiResponse)
        }
      } catch (err) {
        console.error('[LoveSpaceStore] generateQuestionReply error:', err)
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
      
      const chatStore = (await import('./chatStore')).useChatStore()
      const settingsStore = (await import('./settingsStore')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService')
      const { LOVE_SPACE_GENERATOR_PROMPT } = await import('../utils/ai/prompts_love')
      
      const chat = chatStore.chats[charId]
      if (!chat) return

      const userProfile = settingsStore.personalization.userProfile
      const dateToUse = targetDate || new Date().toISOString().split('T')[0]
      const spaceHistory = {
        targetDate: dateToUse,
        recentDiary: (this.currentSpace.diary || []).slice(-3).map(d => `${d.authorName || '我'}: ${d.title} (${d.mood})`),
        todayFootprints: (this.currentSpace.footprints || [])
          .filter(f => f.createdAt?.startsWith(dateToUse))
          .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(f => `${new Date(f.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}: ${f.content} (@${f.location})`)
          .join(' -> ') || '今日暂无足迹',
        unansweredQuestions: (this.currentSpace.questions || [])
          .filter(q => !q.partnerAnswer)
          .map(q => `(ID:${q.id}) ${q.text} ${q.userAnswer ? `[用户已答：${q.userAnswer}]` : '[等待提问]'}`),
        recentUserMessages: (this.currentSpace.messages || [])
          .filter(m => m.senderId === 'user')
          .slice(-5)
          .map(m => `ID:${m.id} ${m.senderName}: ${m.content}`)
          .join('; '),
        recentPartnerMessages: (this.currentSpace.messages || [])
          .filter(m => m.senderId !== 'user')
          .slice(-3)
          .map(m => `ID:${m.id} ${m.senderName}: ${m.content}`)
          .join('; '),
        // 用户来信（未回复的）
        unansweredLetters: (this.currentSpace.letters || [])
          .filter(l => l.author === 'user' && !l.comments?.length)
          .slice(-3)
          .map(l => `《${l.title}》: ${l.content.substring(0, 50)}...`)
          .join('; ') || '暂无',
        // 最近的相册
        recentAlbum: (this.currentSpace.album || []).slice(-5).map(a => `${a.title}${a.desc ? ': ' + a.desc : ''}`)
      }

      const charHistory = (chatStore.chats[charId]?.msgs || []).slice(-30).map(m => ({ 
        role: m.role === 'ai' ? 'assistant' : 'user', 
        content: m.content 
      }))

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
          await this.executeSpaceCommands(result.content, chat.name, targetDate)
        }
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
      if (this.isMagicGenerating) {
        console.warn('[LoveSpaceStore] generateSingleFeature: Already generating')
        return
      }
      
      console.log(`[LoveSpaceStore] === Starting generation for ${featureType} ===`)
      this.isMagicGenerating = true
      
      const chatStore = (await import('./chatStore')).useChatStore()
      const settingsStore = (await import('./settingsStore')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService')
      
      // 导入对应的提示词函数
      console.log(`[LoveSpaceStore] === Importing prompts for ${featureType} ===`)
      const prompts = await import('../utils/ai/prompts_love_single')
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
          schedule: '日程'
        }
        return names[type] || type
      }
      
      const chat = chatStore.chats[charId]
      if (!chat) return

      const userProfile = settingsStore.personalization.userProfile
      
      // 获取最近 30 条聊天记录
      const recentChats = (chatStore.chats[charId]?.msgs || []).slice(-30).map(m => ({ 
        role: m.role === 'ai' ? 'assistant' : 'user', 
        content: m.content 
      }))
      
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
          await this.executeSpaceCommands(result.content, chat.name)
        }
      } catch (err) {
        console.error(`[LoveSpaceStore] Single feature ${featureType} generation failed`, err)
        chatStore.triggerToast('魔法施放失败，稍后再试一次吧~', 'error')
      } finally {
        this.isMagicGenerating = false
      }
    },

    async executeSpaceCommands(text, partnerName, targetDate = null) {
      if (!text) return
      const chatStore = (await import('./chatStore')).useChatStore()
      
      const blocks = []
      const startMarkerRegex = /[\\[【]\s*LS_JSON[:：]?\s*/gi
      
      let match
      while ((match = startMarkerRegex.exec(text)) !== -1) {
        const startIdx = match.index
        const markerText = match[0]
        console.log('[LoveSpaceStore] Found LS_JSON at index:', startIdx, 'marker:', markerText)

        const contentStart = startIdx + markerText.length
        
        // Improved: Find the matching closing bracket for this specific [LS_JSON: block
        const firstBrace = text.indexOf('{', contentStart)
        if (firstBrace === -1) {
          continue
        }

        // Find matching closing brace
        let braceCount = 0
        let inString = false
        let isEscaped = false
        let jsonEndIdx = -1

        for (let i = firstBrace; i < text.length; i++) {
          const char = text[i]
          if (isEscaped) { isEscaped = false; continue; }
          if (char === '\\') { isEscaped = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
            if (char === '{') braceCount++
            else if (char === '}') {
              braceCount--
              if (braceCount === 0) {
                jsonEndIdx = i
                break
              }
            }
          }
        }

        if (jsonEndIdx === -1) {
          // 容错处理：可能是 AI 输出中断（如返回桌面导致连接断开），尝试修复剩余文本
          console.warn('[LoveSpaceStore] LS_JSON block appears unfinished, attempting repair...')
          const remaining = text.substring(contentStart).trim();
          if (remaining.startsWith('{')) {
            let patched = remaining;
            // 启发式修复：尝试闭合未完成的 JSON
            for (let j = 0; j < 6; j++) {
              try {
                JSON.parse(patched);
                blocks.push(patched);
                jsonEndIdx = text.length; // 标记处理完毕
                console.log('[LoveSpaceStore] Successfully repaired interrupted JSON');
                break;
              } catch(e) {
                // 根据缺失情况补齐
                const openB = (patched.match(/{/g) || []).length;
                const closeB = (patched.match(/}/g) || []).length;
                const openA = (patched.match(/\[/g) || []).length;
                const closeA = (patched.match(/\]/g) || []).length;
                
                if (openB > closeB) patched += '}';
                else if (openA > closeA) patched += ']';
                else patched += '"}'; // 尝试闭合可能的字符串并结束对象
              }
            }
          }
          if (jsonEndIdx === -1) break; // 修复失败
        }

        const afterJson = text.substring(jsonEndIdx)
        const nextBracketMatch = afterJson.match(/[\]】]/)
        const finalEndIdx = nextBracketMatch ? jsonEndIdx + nextBracketMatch.index : text.length

        const rawBlock = text.substring(contentStart, finalEndIdx).trim()
        blocks.push(rawBlock)
        
        // Update regex lastIndex to continue after this block
        startMarkerRegex.lastIndex = finalEndIdx
      }
      
      // AI 容错：如果没有找到 [LS_JSON: 标记，但内容看起来是完整的 JSON，也进行尝试
      if (blocks.length === 0) {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          console.log('[LoveSpaceStore] No [LS_JSON: found, but found raw JSON block, using it.')
          blocks.push(jsonMatch[0])
        }
      }

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
              // Duplicate check for footprint
              const isDup = (this.currentSpace.footprints || []).some(f => f.content === cmd.content && f.location === cmd.location)
              if (isDup) {
                console.log('[LoveSpaceStore] Skipping duplicate footprint:', cmd.content)
              } else {
                const baseTime = targetDate ? new Date(targetDate) : new Date()
                let createdAt = baseTime.toISOString()
                if (cmd.time) {
                  const [h, m] = cmd.time.split(':')
                  const d = new Date(baseTime)
                  d.setHours(parseInt(h) || 0)
                  d.setMinutes(parseInt(m) || 0)
                  createdAt = d.toISOString()
                }
                await this.addFootprint({ content: cmd.content, location: cmd.location || '未知', createdAt })
                toastQueue.push({ message: '👣 足迹已生成', type: 'success' })
              }
            } else if (type === 'diary') {
              // Duplicate check for diary
              const isDup = (this.currentSpace.diary || []).some(d => d.title === cmd.title && d.content === cmd.content)
              if (isDup) {
                console.log('[LoveSpaceStore] Skipping duplicate diary:', cmd.title)
              } else {
                await this.addDiary({ 
                  title: cmd.title, content: cmd.content, 
                  weather: cmd.weather, mood: cmd.mood,
                  author: 'partner', authorName: partnerName
                })
                toastQueue.push({ message: '📔 日记已生成', type: 'success' })
              }
            } else if (type === 'message') {
              console.log('[LoveSpaceStore] Processing message command:', cmd)
              // Duplicate check for space messages
              const isDup = (this.currentSpace.messages || []).some(m => m.content === cmd.content)
              if (isDup) {
                console.log('[LoveSpaceStore] Skipping duplicate space message:', cmd.content)
              } else {
                console.log('[LoveSpaceStore] Adding message:', cmd.content)
                await this.addMessage({ 
                  content: cmd.content, senderId: 'partner',
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
              await this.addLetter({ 
                title: cmd.title, 
                content: cmd.content, 
                author: 'partner',
                isRead: false,  // 新生成的信件标记为未读
                paperIndex: cmd.paperIndex || cmd.paperId || 0
              })
              toastQueue.push({ message: '💌 信件已生成', type: 'success' })
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
                const { generateImage } = await import('../utils/aiService')
                const prompt = cmd.draw_cmd.replace(/\[DRAW:\s*(.*?)\s*\]/i, '$1')
                generateImage(prompt)
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
          console.log(`[LoveSpaceStore] Successfully executed ${executedCount} commands`)
          
        } catch (e) {
          console.error('[LoveSpaceStore] Command execution error', e)
          throw e // 重新抛出错误，让上层捕获
        }
      }
      
      // 返回执行结果
      return { success: true, executedCount: blocks.length }
    }
  }
})
