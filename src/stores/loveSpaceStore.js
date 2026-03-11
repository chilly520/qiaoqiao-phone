// 情侣空间状态管理
// Love Space Store

import { defineStore } from 'pinia'

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
    currentModule: null
  }),
  
  getters: {
    // 获取最新日记
    latestDiary(state) {
      return state.diary[state.diary.length - 1] || null
    },
    
    // 获取即将到来的纪念日
    nextAnniversary(state) {
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
      return state.footprints.filter(f => f.date.startsWith(today))
    },
    
    // 获取未回答的问题
    unansweredQuestions(state) {
      return state.questions.filter(q => !q.userAnswer || !q.partnerAnswer)
    },
    
    // 获取扭蛋结果
    todayGacha(state) {
      const today = new Date().toISOString().split('T')[0]
      return state.gachaHistory.find(g => g.date.startsWith(today))
    }
  },
  
  actions: {
    // 初始化情侣空间
    initSpace(partner) {
      this.initialized = true
      this.partner = partner
      this.startDate = new Date().toISOString()
      this.loveDays = 0
      
      this.saveToLocalStorage()
    },
    
    // 添加日记
    addDiary(entry) {
      this.diary.push({
        id: Date.now(),
        ...entry,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 添加留言
    addMessage(message) {
      this.messages.push({
        id: Date.now(),
        ...message,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 添加纪念日
    addAnniversary(anniversary) {
      this.anniversaries.push({
        id: Date.now(),
        ...anniversary,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 添加足迹
    addFootprint(footprint) {
      this.footprints.push({
        id: Date.now(),
        ...footprint,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 添加便利贴
    addSticky(sticky) {
      this.stickies.push({
        id: Date.now(),
        ...sticky,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 添加信件
    addLetter(letter) {
      this.letters.push({
        id: Date.now(),
        ...letter,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 更新小屋
    updateHouse(houseData) {
      this.house = {
        ...this.house,
        ...houseData,
        updatedAt: new Date().toISOString()
      }
      this.saveToLocalStorage()
    },
    
    // 添加问题
    addQuestion(question) {
      this.questions.push({
        id: Date.now(),
        ...question,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 回答问题
    answerQuestion(questionId, answer, isUser = true) {
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
      this.saveToLocalStorage()
    },
    
    // 添加相册照片
    addToAlbum(photo) {
      this.album.push({
        id: Date.now(),
        ...photo,
        createdAt: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 扭蛋
    rollGacha(result) {
      this.gachaHistory.push({
        id: Date.now(),
        ...result,
        date: new Date().toISOString()
      })
      this.saveToLocalStorage()
    },
    
    // 更新相恋天数
    updateLoveDays() {
      if (this.startDate) {
        const start = new Date(this.startDate)
        const now = new Date()
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24))
        this.loveDays = diff
        this.saveToLocalStorage()
      }
    },
    
    // 保存到本地存储
    saveToLocalStorage() {
      localStorage.setItem('loveSpace', JSON.stringify(this.$state))
    },
    
    // 从本地存储加载
    loadFromLocalStorage() {
      const data = localStorage.getItem('loveSpace')
      if (data) {
        const parsed = JSON.parse(data)
        Object.assign(this.$state, parsed)
        this.updateLoveDays()
      }
    },
    
    // 导出数据
    exportData() {
      return JSON.parse(JSON.stringify(this.$state))
    },
    
    // 导入数据
    importData(data) {
      Object.assign(this.$state, data)
      this.saveToLocalStorage()
    },
    
    // 清空数据
    clearData() {
      this.$reset()
      localStorage.removeItem('loveSpace')
    },
    
    // 生成系统提示词注入
    generateSystemPrompt() {
      const prompts = []
      
      if (this.initialized && this.partner) {
        prompts.push(`[情侣空间记忆]`)
        prompts.push(`你和用户已绑定情侣空间。`)
        prompts.push(`今天是你们相识的第 ${this.loveDays} 天。`)
        
        if (this.partner.name) {
          prompts.push(`你的角色是：${this.partner.name}`)
        }
        
        // 最新日记
        if (this.latestDiary) {
          prompts.push(`用户最新日记：${this.latestDiary.content}`)
        }
        
        // 即将到来的纪念日
        if (this.nextAnniversary) {
          prompts.push(`距离${this.nextAnniversary.name}还有${this.nextAnniversary.days}天。`)
        }
        
        // 今日足迹
        if (this.todayFootprints.length > 0) {
          const footprintsText = this.todayFootprints
            .map(f => `${f.time} ${f.content}`)
            .join('，')
          prompts.push(`你今天做了：${footprintsText}`)
        }
        
        // 小屋状态
        if (this.house.description) {
          prompts.push(`你们的小屋是：${this.house.description}`)
        }
      }
      
      return prompts.join(' ')
    }
  }
})
