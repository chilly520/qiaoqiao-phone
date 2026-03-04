import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChatStore } from './chatStore'
import { generateReply } from '../utils/aiService'

export const usePhoneInspectionStore = defineStore('phoneInspection', () => {
  // ========== State ==========
  const isOpen = ref(false)              // 是否正在查手机
  const currentCharId = ref(null)        // 当前查看的 Char ID
  const currentApp = ref('desktop')      // 当前打开的应用
  const passwordInput = ref('')          // 密码输入
  const showPasswordModal = ref(false)   // 显示密码弹窗
  const mutteringQueue = ref([])         // 碎碎念队列
  const isDiscovered = ref(false)        // 是否被发现
  
  // 壁纸管理相关
  const wallpaperLibrary = ref([])       // 壁纸库
  const uploadPreview = ref(null)        // 上传预览
  const urlInput = ref('')               // URL 输入
  
  // ========== Computed ==========
  const currentChar = computed(() => {
    const chatStore = useChatStore()
    return currentCharId.value ? chatStore.chats[currentCharId.value] : null
  })
  
  const phoneData = computed(() => {
    return currentChar.value?.phoneData || null
  })
  
  const hasPermission = computed(() => {
    return phoneData.value?.inspectionPermission?.granted === true
  })
  
  const riskLevel = computed(() => {
    const risk = phoneData.value?.riskSystem?.currentRisk || 0
    if (risk > 80) return 'critical'
    if (risk > 60) return 'high'
    if (risk > 40) return 'medium'
    return 'low'
  })
  
  const currentWallpaper = computed(() => {
    return phoneData.value?.wallpaper || {
      url: '/wallpapers/default.svg',
      type: 'static',
      description: '默认壁纸'
    }
  })
  
  // ========== Actions ==========
  
  /**
   * 开启查手机
   */
  async function startInspection(charId) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    
    if (!char) {
      console.error('[PhoneInspection] Char not found:', charId)
      return
    }
    
    // 如果没有手机数据，生成一份
    if (!char.phoneData) {
      await generatePhoneData(charId)
    }
    
    currentCharId.value = charId
    isOpen.value = true
    currentApp.value = 'desktop'
    isDiscovered.value = false
    mutteringQueue.value = []
    
    // 检查是否有密码
    if (char.phoneData.password?.enabled) {
      showPasswordModal.value = true
    }
  }
  
  /**
   * 验证密码
   */
  function verifyPassword(code) {
    const char = currentChar.value
    if (!char || !char.phoneData?.password) return false
    
    if (code === char.phoneData.password.code) {
      showPasswordModal.value = false
      passwordInput.value = ''
      return true
    } else {
      // 增加失败次数
      char.phoneData.password.failedAttempts++
      if (char.phoneData.password.failedAttempts >= 3) {
        // 锁定 5 分钟
        char.phoneData.password.lockedUntil = Date.now() + 5 * 60 * 1000
      }
      return false
    }
  }
  
  /**
   * 打开应用
   */
  function openApp(appName) {
    currentApp.value = appName
    increaseRisk('enterSensitiveApp')
    
    // 触发碎碎念
    triggerMuttering(appName)
  }
  
  /**
   * 返回桌面
   */
  function backToDesktop() {
    currentApp.value = 'desktop'
  }
  
  /**
   * 关闭查手机
   */
  function closeInspection() {
    isOpen.value = false
    currentCharId.value = null
    currentApp.value = 'desktop'
    isDiscovered.value = false
    mutteringQueue.value = []
    
    // 重置风险值（每次退出后刷新）
    if (currentChar.value?.phoneData) {
      currentChar.value.phoneData.riskSystem.currentRisk = 0
    }
  }
  
  /**
   * 增加风险值
   */
  function increaseRisk(triggerType) {
    if (!currentChar.value?.phoneData) return
    
    const riskSystem = currentChar.value.phoneData.riskSystem
    const increment = riskSystem.triggers[triggerType] || 5
    
    riskSystem.currentRisk = Math.min(100, riskSystem.currentRisk + increment)
    
    // 检查是否超过阈值
    if (riskSystem.currentRisk > 85 && !hasPermission.value) {
      discoverUser()
    }
    
    // 更新 Char 注意力状态
    updateCharAttention()
  }
  
  /**
   * 更新 Char 注意力状态
   */
  function updateCharAttention() {
    const risk = phoneData.value?.riskSystem?.currentRisk || 0
    if (phoneData.value?.riskSystem) {
      if (risk > 80) {
        phoneData.value.riskSystem.charAttention = 'watching'
      } else if (risk > 60) {
        phoneData.value.riskSystem.charAttention = 'suspicious'
      } else if (risk > 30) {
        phoneData.value.riskSystem.charAttention = 'nearby'
      } else {
        phoneData.value.riskSystem.charAttention = 'away'
      }
    }
  }
  
  /**
   * 发现用户
   */
  function discoverUser() {
    isDiscovered.value = true
    
    // 延迟关闭页面
    setTimeout(() => {
      closeInspection()
      // 触发 ChatStore 的警告消息
      const chatStore = useChatStore()
      chatStore.triggerToast(`被${currentChar.value.name}发现了！`, 'error')
    }, 2000)
  }
  
  /**
   * 触发碎碎念
   */
  async function triggerMuttering(appName) {
    if (!hasPermission.value) return
    
    const char = currentChar.value
    const app = getAppDisplayName(appName)
    
    // AI 生成碎碎念内容
    const prompt = `${char.name}看到你在看 TA 的${app}应用，TA 会有什么反应？说一句话（20 字以内），要符合 TA 的性格：${char.prompt || char.bio?.description || '普通'}`
    
    try {
      const result = await generateReply(
        [{ role: 'user', content: prompt }],
        char,
        null,
        { isSimpleTask: true }
      )
      
      mutteringQueue.value.push({
        app: appName,
        text: result.content,
        timestamp: Date.now()
      })
      
      // 自动移除旧的碎碎念
      setTimeout(() => {
        mutteringQueue.value.shift()
      }, 5000)
    } catch (e) {
      console.error('生成碎碎念失败:', e)
    }
  }
  
  /**
   * 获取应用显示名称
   */
  function getAppDisplayName(appKey) {
    const names = {
      calls: '通话记录',
      messages: '短信',
      wechat: '微信',
      wallet: '钱包',
      shopping: '购物',
      footprints: '足迹',
      backpack: '背包',
      notes: '便签',
      reminders: '备忘录',
      browser: '浏览器',
      history: '使用记录',
      photos: '相册',
      music: '歌单',
      calendar: '日程',
      meituan: '美团',
      forum: '论坛',
      recorder: '录音',
      files: '文件夹',
      settings: '设置'
    }
    return names[appKey] || appKey
  }
  
  /**
   * AI 生成完整手机数据
   */
  async function generatePhoneData(charId) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    
    if (!char) return
    
    const prompt = buildGeneratePhoneDataPrompt(char)
    
    try {
      const result = await generateReply(
        [{ role: 'user', content: prompt }],
        { 
          name: '手机数据生成器', 
          prompt: '你只输出符合要求的 JSON 对象，不要任何文字废话和代码 格式。' 
        },
        null,
        { isSimpleTask: true }
      )
      
      // 清理 JSON
      const cleanContent = result.content.replace(/```json|```/g, '').trim()
      let phoneDataObj
      
      try {
        phoneDataObj = JSON.parse(cleanContent)
      } catch (e) {
        console.error('JSON 解析失败，尝试修复:', e)
        const fixed = fixCommonJsonErrors(cleanContent)
        phoneDataObj = JSON.parse(fixed)
      }
      
      // 保存到 char
      char.phoneData = {
        ...phoneDataObj,
        generationStatus: {
          lastGenerated: Date.now(),
          version: '1.0',
          needsRegen: false
        }
      }
      
      await chatStore.saveChats()
      
      return phoneDataObj
    } catch (e) {
      console.error('生成手机数据失败:', e)
      // 使用默认数据
      char.phoneData = createDefaultPhoneData()
      await chatStore.saveChats()
    }
  }
  
  /**
   * 构建 AI 生成 Prompt
   */
  function buildGeneratePhoneDataPrompt(char) {
    return `为角色"${char.name}"生成完整的手机数据 JSON 对象。

【角色设定】
- 性格：${char.prompt || '普通'}
- 性别：${char.bio?.gender || '未知'}
- 年龄：${char.bio?.age || '未知'}
- 爱好：${char.bio?.hobbies?.join('、') || '无'}
- 与 user 关系：${char.bio?.relationship || '陌生人'}
- 日常作息：${JSON.stringify(char.bio?.routine) || '未知'}

【生成要求】
1. 所有应用数据一次性生成，统一 JSON 格式
2. 数据要符合角色性格和背景故事
3. 必须包含与 user 的互动记录（微信聊天记录、通话记录等）
4. 设置合理的 4-6 位数字密码（对角色有纪念意义）
5. 提供密码提示（暗示性描述）
6. 壁纸描述要体现角色审美和当前心境
7. 相册包含 3-5 张照片的 AI 生图指令（带备注小字）
8. 至少 3 个应用要有敏感/秘密内容（增加剧情张力）
9. 微信中要给 user 设置一个有趣的备注名

【返回 JSON 结构】
{
  "password": {
    "enabled": true/false,
    "code": "4 位数字",
    "hint": "提示语",
    "failedAttempts": 0,
    "lockedUntil": null
  },
  "inspectionPermission": {
    "granted": false,
    "grantedAt": null,
    "expiresAt": null,
    "askedByAI": false,
    "discoveryMode": false
  },
  "riskSystem": {
    "currentRisk": 0,
    "triggers": {
      "enterSensitiveApp": 15,
      "viewSensitiveContent": 25,
      "stayTooLong": 10,
      "rapidSwitching": 5,
      "depthDrill": 20
    },
    "charAttention": "away"
  },
  "wallpaper": {
    "url": "",
    "type": "static|dynamic|ai_generated",
    "description": "壁纸描述",
    "lastChanged": null
  },
  "apps": {
    "calls": { "records": [...] },
    "messages": { "conversations": [...] },
    "wechat": { 
      "userRemark": "给 user 的备注",
      "isTop": true/false,
      "doNotDisturb": true/false,
      "backgroundImage": "聊天背景描述",
      "chatHistory": [...] 
    },
    "wallet": { "balance": 0, "transactions": [...] },
    "shopping": { "orders": [...] },
    "footprints": { "locations": [...] },
    "backpack": { "items": [...] },
    "notes": { "notes": [...] },
    "reminders": { "memos": [...] },
    "browser": { "history": [...], "bookmarks": [...] },
    "history": { "appUsage": [...] },
    "photos": { "albums": {...}, "photos": [...] },
    "music": { "playlists": [...], "recentlyPlayed": [...] },
    "calendar": { "events": [...] },
    "meituan": { "orders": [...] },
    "forum": { "posts": [...], "privateMessages": [...] },
    "recorder": { "recordings": [...] },
    "files": { "folders": [...], "files": [...] }
  },
  "generationStatus": {
    "lastGenerated": null,
    "version": "1.0",
    "needsRegen": false
  }
}

请严格按照上述结构返回完整的 JSON 对象。`;
  }
  
  /**
   * 创建默认手机数据（当 AI 生成失败时）
   */
  function createDefaultPhoneData() {
    return {
      password: {
        enabled: false,
        code: '0000',
        hint: '默认密码',
        failedAttempts: 0,
        lockedUntil: null
      },
      inspectionPermission: {
        granted: false,
        grantedAt: null,
        expiresAt: null,
        askedByAI: false,
        discoveryMode: false
      },
      riskSystem: {
        currentRisk: 0,
        triggers: {
          enterSensitiveApp: 15,
          viewSensitiveContent: 25,
          stayTooLong: 10,
          rapidSwitching: 5,
          depthDrill: 20
        },
        charAttention: 'away'
      },
      wallpaper: {
        url: '/wallpapers/default.svg',
        type: 'static',
        description: '默认壁纸',
        lastChanged: null
      },
      apps: {},
      generationStatus: {
        lastGenerated: Date.now(),
        version: '1.0',
        needsRegen: false
      }
    }
  }
  
  /**
   * 修复常见 JSON 错误
   */
  function fixCommonJsonErrors(json) {
    // 移除末尾逗号
    json = json.replace(/,(\s*[}\]])/g, '$1')
    // 补充缺失的引号
    json = json.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
    return json
  }
  
  /**
   * 请求查手机权限（在聊天中触发）
   */
  async function requestPermission(charId) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    
    if (!char) return { allowed: false, response: '角色不存在' }
    
    // AI 决定是否允许
    const prompt = `${char.name}，用户问："我可以看看你的手机吗？"。请根据你对用户的信任和当前心情，决定是否允许。如果允许，回复温暖的同意；如果不允许，找个合理的借口拒绝。（先回复，然后在最后用【】标注决定，例如【允许】或【拒绝】）`
    
    try {
      const result = await generateReply(
        [{ role: 'user', content: prompt }],
        char,
        null
      )
      
      const response = result.content
      const isAllowed = response.includes('【允许】') || response.includes('[允许]')
      
      // 发送回复到聊天
      chatStore.addMessage(charId, {
        role: 'assistant',
        content: response.replace(/[\u3010\u3011\[\]]/g, ''),
        id: `msg_${Date.now()}`
      })
      
      // 更新权限状态
      if (isAllowed) {
        char.phoneData.inspectionPermission.granted = true
        char.phoneData.inspectionPermission.grantedAt = Date.now()
        char.phoneData.inspectionPermission.expiresAt = Date.now() + 5 * 60 * 1000 // 5 分钟有效期
        char.phoneData.inspectionPermission.askedByAI = true
      }
      
      await chatStore.saveChats()
      
      return {
        allowed: isAllowed,
        response: response
      }
    } catch (e) {
      console.error('请求权限失败:', e)
      return {
        allowed: false,
        response: '现在不太方便呢...'
      }
    }
  }
  
  // ========== 壁纸管理相关 Actions ==========
  
  /**
   * 设置壁纸
   */
  async function setWallpaper(wallpaperData) {
    if (!currentChar.value?.phoneData) return
    
    currentChar.value.phoneData.wallpaper = {
      ...currentChar.value.phoneData.wallpaper,
      ...wallpaperData,
      lastChanged: Date.now()
    }
    
    const chatStore = useChatStore()
    await chatStore.saveChats()
  }
  
  /**
   * 上传本地图片
   */
  async function uploadLocalImage(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('请选择图片文件')
    }
    
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('图片大小不能超过 2MB')
    }
    
    const base64 = await fileToBase64(file)
    
    await setWallpaper({
      url: base64,
      type: 'uploaded',
      source: 'local',
      description: '本地上传'
    })
    
    return base64
  }
  
  /**
   * AI 生成壁纸
   */
  async function generateAIWallpaper(description, style = 'photography') {
    if (!description.trim()) {
      throw new Error('请输入描述')
    }
    
    // TODO: 调用 AI 生图服务
    // const imageUrl = await generateImage(`draw: ${style} style, ${description}, mobile wallpaper, high quality, 4K`)
    
    // 临时模拟
    const imageUrl = '/wallpapers/ai_temp.jpg'
    
    await setWallpaper({
      url: imageUrl,
      type: 'ai_generated',
      source: 'ai',
      description: description,
      style: style
    })
    
    return imageUrl
  }
  
  /**
   * 从 URL 设置壁纸
   */
  async function setWallpaperFromUrl(url) {
    if (!isValidUrl(url)) {
      throw new Error('无效的 URL 格式')
    }
    
    // 预加载验证
    try {
      await preloadImage(url)
    } catch (e) {
      throw new Error('无法加载该图片，请检查链接是否有效')
    }
    
    await setWallpaper({
      url: url,
      type: 'url',
      source: 'url',
      description: '网络图片'
    })
    
    return url
  }
  
  // Helper functions
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  
  function isValidUrl(string) {
    try {
      new URL(string)
      return true
    } catch (_) {
      return false
    }
  }
  
  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = resolve
      img.onerror = reject
      img.src = url
    })
  }
  
  return {
    // State
    isOpen,
    currentCharId,
    currentApp,
    passwordInput,
    showPasswordModal,
    mutteringQueue,
    isDiscovered,
    wallpaperLibrary,
    uploadPreview,
    urlInput,
    
    // Computed
    currentChar,
    phoneData,
    hasPermission,
    riskLevel,
    currentWallpaper,
    
    // Actions
    startInspection,
    verifyPassword,
    openApp,
    backToDesktop,
    closeInspection,
    increaseRisk,
    triggerMuttering,
    updateWallpaper: setWallpaper,
    uploadLocalImage,
    generateAIWallpaper,
    setWallpaperFromUrl,
    requestPermission,
    generatePhoneData
  }
})
