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
  applyToDesktop: false
})

export const useLoveSpaceStore = defineStore('loveSpace', {
  state: () => ({
    spaces: {}, // { [charId]: spaceData }
    currentPartnerId: null,
    isLoaded: false
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
    stickies() { return this.currentSpace.stickies || [] },
    letters() { return this.currentSpace.letters || [] },
    house() { return this.currentSpace.house || DEFAULT_SPACE().house },
    questions() { return this.currentSpace.questions || [] },
    album() { return this.currentSpace.album || [] },
    gachaHistory() { return this.currentSpace.gachaHistory || [] },
    applyToDesktop() { return this.currentSpace.applyToDesktop || false }
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
    },
    
    async loadFromStorage() {
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
        comments: [],
        createdAt: new Date().toISOString() 
      })
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
        if (isUser) q.userAnswer = content
        else q.partnerAnswer = content
        await this.saveToStorage()
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

    async rollGacha(reward) {
      if (!this.currentPartnerId) return
      this.currentSpace.gachaHistory.unshift({
        id: Date.now(),
        ...reward,
        date: new Date().toISOString()
      })
      await this.saveToStorage()
    },

    async generateMagicContent(targetDate = null) {
      if (!this.currentPartnerId) return
      const charId = this.currentPartnerId
      
      const chatStore = (await import('./chatStore')).useChatStore()
      const settingsStore = (await import('./settingsStore')).useSettingsStore()
      const { generateReply } = await import('../utils/aiService')
      
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
          .map(q => `(ID:${q.id}) ${q.text} ${q.userAnswer ? `[用户已答: ${q.userAnswer}]` : '[等待提问]'}`),
        recentUserMessages: (this.currentSpace.messages || [])
          .filter(m => m.senderId === 'user')
          .slice(-5)
          .map(m => `ID:${m.id} ${m.senderName}: ${m.content}`)
          .join('; '),
        recentPartnerMessages: (this.currentSpace.messages || [])
          .filter(m => m.senderId !== 'user')
          .slice(-3)
          .map(m => `ID:${m.id} ${m.senderName}: ${m.content}`)
          .join('; ')
      }

      const charHistory = (chat.msgs || []).slice(-30).map(m => ({ 
        role: m.role === 'ai' ? 'assistant' : 'user', 
        content: m.content 
      }))

      const systemPrompt = `你现在是 ${chat.name}。你正在与 ${userProfile.name} 经营专属情侣空间。
${LOVE_SPACE_GENERATOR_PROMPT(chat.name, userProfile.name, this.loveDays, spaceHistory, charHistory)}
严禁输出任何多余内容，只需输出以 [LS_JSON: ...] 格式包裹的指令集。`;

      try {
        const result = await generateReply([
          { role: 'system', content: systemPrompt },
          ...charHistory
        ], { name: chat.name, id: chat.id }, null, { 
          isCommandTask: true, 
          isSimpleTask: true 
        })

        if (result.content) {
          await this.executeSpaceCommands(result.content, chat.name, targetDate)
        }
      } catch (err) {
        console.error('[LoveSpaceStore] Magic generation failed', err)
        chatStore.triggerToast('魔法施放失败，稍后再试一次吧~', 'error')
      }
    },

    async executeSpaceCommands(text, partnerName, targetDate = null) {
      if (!text) return
      const chatStore = (await import('./chatStore')).useChatStore()
      
      // 改进的块提取逻辑：支持跨行、支持内容中包含 }
      const blocks = []
      let searchIdx = 0
      while (true) {
        const startMarker = '[LS_JSON:'
        const startIdx = text.indexOf(startMarker, searchIdx)
        if (startIdx === -1) break

        const contentStart = startIdx + startMarker.length
        // 寻找匹配的闭合 ] (从最后往前找，因为通常整个返回就是一个 LS_JSON 块)
        const endIdx = text.lastIndexOf(']')
        if (endIdx <= contentStart) break

        const rawBlock = text.substring(contentStart, endIdx).trim()
        blocks.push(rawBlock)
        searchIdx = endIdx + 1
        break // 强关联：目前 prompt 要求只输出一个指令集，直接处理最大的块
      }

      for (let jsonStr of blocks) {
        try {
          // 极致容错预处理
          // 1. 尝试定位真正的 {} 范围（防止标签内有多余的前导或尾随文字）
          const startBrace = jsonStr.indexOf('{')
          const endBrace = jsonStr.lastIndexOf('}')
          if (startBrace !== -1 && endBrace !== -1) {
            jsonStr = jsonStr.substring(startBrace, endBrace + 1)
          }

          // 2. 修复 AI 常见的 JSON 瑕疵
          jsonStr = jsonStr
            .replace(/,\s*([\]}])/g, '$1') // 移除对象/数组末尾多余逗号
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // 将物理换行等控制字符替换为空格（关键：不能转义为 \\n，那会破坏结构）
          
          console.log('[LoveSpaceStore] Parsing cleaned JSON:', jsonStr)
          
          const data = JSON.parse(jsonStr)
          const commands = data.commands || []
          
          for (const cmd of commands) {
            const type = cmd.type?.toLowerCase()
            if (type === 'bind') {
              // 绑定情侣空间
              const startDate = cmd.startDate || new Date().toISOString()
              await this.selectSpace(chatStore.currentChatId)
              await this.updateStartDate(startDate)
              chatStore.triggerToast('💕 情侣空间正式开通！', 'success')
            } else if (type === 'footprint') {
              // 如果指定了生成日期，足迹也应该属于那一天
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
            } else if (type === 'diary') {
              await this.addDiary({ 
                title: cmd.title, content: cmd.content, 
                weather: cmd.weather, mood: cmd.mood,
                author: 'partner', authorName: partnerName
              })
            } else if (type === 'message') {
              await this.addMessage({ 
                content: cmd.content, senderId: 'partner',
                senderName: partnerName, replyToId: cmd.replyToId
              })
            } else if (type === 'gacha') {
              await this.rollGacha({ name: cmd.name, desc: cmd.desc, icon: cmd.icon })
            } else if (type === 'letter') {
              await this.addLetter({ 
                title: cmd.title, 
                content: cmd.content, 
                author: 'partner',
                paperIndex: cmd.paperIndex || cmd.paperId // Support both naming variants 
              })
            } else if (type === 'question') {
              await this.addQuestion({ text: cmd.text, authorId: 'partner' })
            } else if (type === 'answer') {
              if (cmd.qId) await this.answerQuestion(cmd.qId, cmd.content, false)
            } else if (type === 'sticky') {
              await this.addSticky({ content: cmd.content, color: cmd.color, author: 'partner' })
            } else if (type === 'anniversary') {
              await this.addAnniversary({ name: cmd.name, date: cmd.date })
            } else if (type === 'album') {
              let imageUrl = cmd.imageUrl || cmd.image
              if (!imageUrl && cmd.draw_cmd) {
                const { generateImage } = await import('../utils/aiService')
                try {
                  // Extract prompt from [DRAW: ...] or use as is
                  const prompt = cmd.draw_cmd.replace(/\[DRAW:\s*(.*?)\s*\]/i, '$1')
                  imageUrl = await generateImage(prompt)
                } catch (e) {
                  console.error('[LoveSpaceStore] Album image generation failed', e)
                }
              }
              await this.addToAlbum({ 
                title: cmd.title, url: imageUrl, 
                desc: cmd.desc, draw_cmd: cmd.draw_cmd, author: 'partner' 
              })
            } else if (type === 'house') {
              await this.updateHouse({ 
                action: cmd.action, comfortIncrease: cmd.comfortIncrease, item: cmd.item 
              })
            }
          }
        } catch (e) {
          console.error('[LoveSpaceStore] Command execution error', e)
        }
      }
    }
  }
})
