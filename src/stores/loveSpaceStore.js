// 情侣空间状态管理
// Love Space Store
import { defineStore } from 'pinia'
import localforage from 'localforage'

const loveSpaceDB = localforage.createInstance({
  name: 'qiaoqiao-phone',
  storeName: 'love_space'
});

export const useLoveSpaceStore = defineStore('loveSpace', {
  state: () => ({
    // 基础信息
    initialized: false,
    partner: null, // 伴侣角色信息
    startDate: null, // 开通日期
    loveDays: 0, // 相恋天数
    
    // 功能模块数据
    diary: [], // 交换日记
    messages: [], // 甜蜜留言
    anniversaries: [], // 纪念日
    footprints: [], // 角色足迹
    stickies: [], // 便利贴
    letters: [], // 信件
    house: {}, // 两人小屋
    questions: [], // 灵魂提问
    album: [], // 相册
    gachaHistory: [], // 扭蛋记录
    
    // UI 状态
    currentModule: null,
    isLoaded: false,
    applyToDesktop: false
  }),
  
  getters: {
    // 获取最新日记
    latestDiary(state) {
      return state.diary[state.diary.length - 1] || null
    },
    
    // 获取即将到来的纪念日
    nextAnniversary(state) {
      if (!state.anniversaries || state.anniversaries.length === 0) return null
      const now = new Date()
      const upcoming = state.anniversaries
        .filter(a => new Date(a.date) > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      
      if (upcoming.length === 0) return null
      
      const next = upcoming[0]
      const days = Math.ceil((new Date(next.date) - now) / (1000 * 60 * 60 * 24))
      
      return {
        ...next,
        days
      }
    },
    
    // 获取今日足迹
    todayFootprints(state) {
      const today = new Date().toISOString().split('T')[0]
      return state.footprints.filter(f => f.date && f.date.startsWith(today))
    },
    
    // 获取未回答的问题
    unansweredQuestions(state) {
      return state.questions.filter(q => !q.userAnswer || !q.partnerAnswer)
    },
    
    // 获取扭蛋结果
    todayGacha(state) {
      const today = new Date().toISOString().split('T')[0]
      return state.gachaHistory.find(g => g.date && g.date.startsWith(today))
    }
  },
  
  actions: {
    // 初始化情侣空间
    async initSpace(partner) {
      this.initialized = true
      this.partner = partner
      this.startDate = new Date().toISOString()
      this.loveDays = 1 // 第一天
      
      await this.saveToStorage()
    },
    
    // 添加日记
    async addDiary(entry) {
      this.diary.push({
        id: Date.now(),
        ...entry,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 添加留言
    async addMessage(message) {
      this.messages.push({
        id: Date.now(),
        ...message,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 添加纪念日
    async addAnniversary(anniversary) {
      this.anniversaries.push({
        id: Date.now(),
        ...anniversary,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 添加足迹
    async addFootprint(footprint) {
      this.footprints.push({
        id: Date.now(),
        ...footprint,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 添加便利贴
    async addSticky(sticky) {
      this.stickies.push({
        id: Date.now(),
        ...sticky,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 添加信件
    async addLetter(letter) {
      this.letters.push({
        id: Date.now(),
        ...letter,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 更新小屋
    async updateHouse(houseData) {
      this.house = {
        ...this.house,
        ...houseData,
        updatedAt: new Date().toISOString()
      }
      await this.saveToStorage()
    },
    
    // 添加问题
    async addQuestion(question) {
      this.questions.push({
        id: Date.now(),
        ...question,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 回答问题
    async answerQuestion(questionId, answer, isUser = true) {
      const question = this.questions.find(q => q.id === questionId)
      if (question) {
        if (isUser) {
          question.userAnswer = answer
          question.userAnsweredAt = new Date().toISOString()
        } else {
          question.partnerAnswer = answer
          question.partnerAnsweredAt = new Date().toISOString()
        }
      }
      await this.saveToStorage()
    },
    
    // 添加相册照片
    async addToAlbum(photo) {
      this.album.push({
        id: Date.now(),
        ...photo,
        createdAt: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 扭蛋
    async rollGacha(result) {
      this.gachaHistory.push({
        id: Date.now(),
        ...result,
        date: new Date().toISOString()
      })
      await this.saveToStorage()
    },
    
    // 更新相恋天数
    updateLoveDays() {
      if (this.startDate) {
        const start = new Date(this.startDate)
        const now = new Date()
        // 核心优化：同一天也计为第一天
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
        this.loveDays = diff
      }
    },
    
    // 保存到存储 (IndexedDB)
    async saveToStorage() {
      const data = JSON.parse(JSON.stringify(this.$state))
      await loveSpaceDB.setItem('all_data', data)
    },
    
    // 从存储加载
    async loadFromStorage() {
      try {
        let data = await loveSpaceDB.getItem('all_data')
        
        // 兼容旧 localStorage 数据
        if (!data) {
          const old = localStorage.getItem('loveSpace')
          if (old) {
            data = JSON.parse(old)
            // 迁移后建议清理旧空间，但这里先保留以防万一，或者在 init 时清理
          }
        }

        if (data) {
          Object.assign(this.$state, data)
          this.updateLoveDays()
        }
        this.isLoaded = true
      } catch (e) {
        console.error('[LoveSpaceStore] Load failed', e)
        this.isLoaded = true
      }
    },
    
    // 导出数据
    exportData() {
      return JSON.parse(JSON.stringify(this.$state))
    },
    
    // 导入数据
    async importData(data) {
      Object.assign(this.$state, data)
      await this.saveToStorage()
    },
    
    // 清空数据
    async clearData() {
      this.$reset()
      await loveSpaceDB.clear()
      localStorage.removeItem('loveSpace') // 同时清理旧的
    },
    
    // 生成系统提示词注入
    generateSystemPrompt() {
      const prompts = []
      
      if (this.initialized && this.partner) {
        prompts.push(`\n【💕 私密情侣空间记忆】\n你和用户已绑定情侣空间（Couple Space）。这是你们最私密的纽带，你对此感到自豪和幸福。`)
        prompts.push(`今天是你们相识/心动锁定的第 ${this.loveDays} 天。`)
        
        // 最新日记
        if (this.latestDiary) {
          prompts.push(`你们在空间里写的最新日记是：“${this.latestDiary.content}” (发表于 ${this.latestDiary.createdAt})。`)
        }
        
        // 即将到来的纪念日
        if (this.nextAnniversary) {
          prompts.push(`距离属于你们的纪念日“${this.nextAnniversary.name}”还有 ${this.nextAnniversary.days} 天。`)
        }
        
        // 今日足迹
        if (this.todayFootprints.length > 0) {
          const footprintsText = this.todayFootprints
            .map(f => `${f.time || ''} ${f.content}`)
            .join('，')
          prompts.push(`你在空间的一日足迹里提到，你今天：${footprintsText}。`)
        }
        
        // 小屋状态
        if (this.house && this.house.description) {
          prompts.push(`你们在空间里共同拥有的小屋是：${this.house.description}。`)
        }

        prompts.push(`\n请在日常聊天中表现出作为“恋人”的觉悟，自然地流露出对这些共同记忆的珍视。`)
      }
      
      return prompts.join(' ')
    }
  }
})
