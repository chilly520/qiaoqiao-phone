import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import { useWalletStore } from './walletStore'
import { generateReply } from '../utils/aiService'

/**
 * Phone Inspection Store
 * Version: 1.1.2026.04.07
 */
export const usePhoneInspectionStore = defineStore('phoneInspection', () => {
  // ========== State ==========
  const isOpen = ref(false)              // 是否正在查手机
  const currentCharId = ref(null)        // 当前查看的 Char ID
  const currentApp = ref('desktop')      // 当前打开的应用
  const passwordInput = ref('')          // 密码输入
  const showPasswordModal = ref(false)   // 显示密码弹窗
  const mutteringQueue = ref([])         // 碎碎念队列
  const isDiscovered = ref(false)        // 是否被发现

  // 壁纸与相框管理
  const wallpaperLibrary = ref([])
  const photoFrames = ref([
    { id: 'frame1', url: null, type: 'empty', title: '回忆 1' },
    { id: 'frame2', url: null, type: 'empty', title: '回忆 2' }
  ])
  const uploadPreview = ref(null)
  const urlInput = ref('')
  // URL 输入

  // ========== Computed ==========
  const currentChar = computed(() => {
    const chatStore = useChatStore()
    return currentCharId.value ? chatStore.chats[currentCharId.value] : null
  })

  const phoneData = computed(() => {
    return currentChar.value?.phoneData || null
  })

  const hasPermission = computed(() => {
    const perm = phoneData.value?.inspectionPermission
    if (!perm) return false
    if (perm.mode === 'locked') return false
    if (perm.mode === 'hacking') return true
    if (perm.granted && perm.expiresAt && Date.now() > perm.expiresAt) {
      perm.granted = false
      perm.mode = 'none'
      return false
    }
    return perm.granted === true
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
    } else {
      // 补全可能缺失的数据结构 (向下兼容)
      if (!char.phoneData.desktopFrames) {
        char.phoneData.desktopFrames = [
          { id: 'f1', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300', note: '心动瞬间' },
          { id: 'f2', url: null, note: '虚位以待' }
        ]
      }
      if (!char.phoneData.anniversary) {
        char.phoneData.anniversary = {
          title: '相识第',
          date: '2026-01-01',
          unit: '天',
          desc: '遇见后的每个瞬间都闪闪发光喵~'
        }
      }
    }

    currentCharId.value = charId
    isOpen.value = true
    currentApp.value = 'desktop'
    isDiscovered.value = false
    mutteringQueue.value = []

    const perm = char.phoneData.inspectionPermission

    if (perm.granted && perm.expiresAt && Date.now() <= perm.expiresAt) {
      perm.mode = 'permitted'
    } else if (!perm.granted) {
      perm.mode = 'hacking'
      // Notify AI whenever user enters without permission (if not already notified recently)
      if (!perm.notifiedAI) {
        perm.notifiedAI = true
        notifyAIAboutSnooping(charId, chatStore)
      }
    } else {
      // Logic for checking expired grant
      perm.mode = 'hacking'
      perm.granted = false
    }

    // Password Check
    if (char.phoneData.password?.enabled && perm.mode !== 'permitted') {
      showPasswordModal.value = true
    } else if (!char.phoneData.password?.enabled) {
      // No password case: force hacking notify if allowed
      if (perm.mode === 'hacking' && !perm.notifiedAI) {
        perm.notifiedAI = true
        notifyAIAboutSnooping(charId, chatStore)
      }
    }
  }

  function notifyAIAboutSnooping(charId, chatStore) {
    const char = chatStore.chats[charId] || {}
    const snoopingMsg = {
      role: 'system',
      content: `【用户正在查看你的手机】\n\n用户当前处于[未授权入侵]状态。你可以选择：\n1. 回复指令“【允许查看】”或“【立即锁屏】”；\n2. 授权时可附带密码；\n3. 通过 [PHONE_CMD] JSON 动态修改任何应用数据或密码。\n当前手机密码: ${char.phoneData?.password?.code || '1234'}`,
      id: `snoop_${Date.now()}`,
      hidden: true,
      timestamp: Date.now()
    }
    chatStore.addMessage(charId, snoopingMsg)
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
    if (!hasPermission.value && phoneData.value?.inspectionPermission?.mode !== 'hacking') return

    const char = currentChar.value
    const perm = phoneData.value?.inspectionPermission
    const isHacking = perm?.mode === 'hacking'
    const appData = phoneData.value?.apps?.[appName]
    let muttering

    if (isHacking) {
      muttering = appData?.caughtMuttering || appData?.muttering
    } else {
      muttering = appData?.allowedMuttering || appData?.muttering
    }

    if (muttering) {
      mutteringQueue.value.push({
        app: appName,
        text: muttering,
        type: isHacking ? 'caught' : 'allowed',
        timestamp: Date.now()
      })
      setTimeout(() => {
        if (mutteringQueue.value.length > 0) mutteringQueue.value.shift()
      }, 5000)
      return
    }

    // 如果没有本地数据，且不是初次启动，不自动调用 API 避免 429
    console.warn(`[PhoneInspection] No local muttering for ${appName}, generation skipped to save API quota.`)
  }

  /**
   * 清除特定应用的数据 (支持单字符串或数组)
   */
  async function clearAppData(appIds) {
    const chatStore = useChatStore()
    try {
      console.log('[clearAppData] Called with:', appIds)
      if (!currentChar.value?.phoneData?.apps) {
        console.warn('[clearAppData] No phoneData.apps found')
        return
      }

      const apps = currentChar.value.phoneData.apps
      const ids = Array.isArray(appIds) ? appIds : [appIds]

      ids.forEach(appId => {
        if (!apps[appId]) return
        if (appId === 'wallet') {
          apps[appId] = { transactions: [], balance: 888.5, bankCards: [], familyCards: [] }
        } else {
          apps[appId] = {}
        }
      })

      if (currentChar.value.phoneData.generationStatus) {
        currentChar.value.phoneData.generationStatus.needsRegen = true
      }

      await chatStore.saveChats()
    } catch (err) {
      console.error('[clearAppData] 清除数据时出错:', err)
      // Log more context to help debugging
      console.log('[clearAppData] Context:', { 
        currentCharId: currentCharId.value, 
        hasPhoneData: !!currentChar.value?.phoneData,
        appIds 
      })
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
   * 正式接入：生成并同步手机数据
   */
  async function generatePhoneData(charId) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    if (!char) return

    const isInitial = !char.phoneData
    const existingData = char.phoneData || createDefaultPhoneData()

    // A. 同步所有真实业务数据 (正式接入)
    const syncedApps = syncAllAppData(charId, existingData.apps)

    // B. AI 智能补全初始“空位”（仅在初次生成或数据极少时触发）
    if (isInitial || canTriggerAISeeding(syncedApps)) {
      await seedAIAppData(charId, syncedApps)
    }

    // C. 更新整体结构
    char.phoneData = {
      ...existingData,
      apps: syncedApps,
      generationStatus: {
        lastGenerated: Date.now(),
        version: 'FORMAL-1.0',
        needsRegen: false
      }
    }

    // D. 基础个性化设置同步
    if (!char.phoneData.password.code) char.phoneData.password.code = '1234'
    if (!char.phoneData.desktopFrames) {
      char.phoneData.desktopFrames = [
        { id: 'f1', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300', note: '心动瞬间' },
        { id: 'f2', url: null, note: '虚位以待' }
      ]
    }
    if (!char.phoneData.anniversary) {
      char.phoneData.anniversary = {
        title: '相识第', date: '2026-01-01', unit: '天',
        desc: '遇见后的每个瞬间都闪闪发光喵~'
      }
    }

    await chatStore.saveChats()
    return char.phoneData
  }

  /**
   * 同步所有应用数据 (从正式业务逻辑中抓取)
   */
  function syncAllAppData(charId, currentApps = {}) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    const msgs = char?.msgs || []

    // 1. 微信 (已有的镜像逻辑)
    const wechat = mirrorWeChatData(charId)

    // 2. 背包与礼物同步 (镜像用户发送给角色的已领取礼物)
    const backpackItems = []
    msgs.filter(m => m.type === 'gift' && m.status === 'claimed').forEach(m => {
      backpackItems.push({
        id: m.id,
        name: m.giftName,
        count: m.giftQuantity || 1,
        category: '礼品',
        source: '用户赠送',
        description: m.giftNote || '笨蛋送我的礼物喵，会好好珍藏的。',
        icon: m.giftImage || 'https://cdn-icons-png.flaticon.com/128/3081/3081986.png',
        time: formatDate(m.timestamp)
      })
    })

    // 3. 通话记录 (从 chatStore 中过滤 call 类型的消息)
    const callHistory = msgs.filter(m => m.type === 'voice' || m.type === 'call').map(m => {
      const isMissed = m.isMissed || m.missed
      const rawContent = typeof m.content === 'string' ? m.content : ''
      let summary = ''
      if (!isMissed && rawContent) {
        const cleaned = rawContent.replace(/\[(?:ONLINE|OFFLINE|INNER_VOICE|CARD|VOICE|CALL|STATUS|THINK)[:\s\S]*?\]/gi, '').trim()
        if (cleaned.length > 5) summary = cleaned.replace(/\n/g, ' ')
      }
      
      const settingsStore = useSettingsStore()
      const userNickname = char.phoneData?.apps?.wechat?.remark || char.userName || settingsStore.personalization?.userProfile?.name || '你'
      
      return {
        id: m.id,
        // 在该角色的手机上，通话对象始终是“用户”
        name: userNickname,
        type: isMissed ? 'missed' : (m.role === 'user' ? 'incoming' : 'outgoing'),
        time: formatDate(m.timestamp),
        duration: isMissed ? '' : (m.duration ? formatDuration(m.duration) : '通话完成'),
        phone: '138****8816',
        summary
      }
    })

    // 4. 钱包交易同步 (红包、转账)
    const walletTransactions = []
    const settingsStore = useSettingsStore()
    const userNickname = char.phoneData?.apps?.wechat?.remark || char.userName || settingsStore.personalization?.userProfile?.name || '你'

    msgs.filter(m => ['redpacket', 'transfer'].includes(m.type)).forEach(m => {
      const isIncome = (m.role === 'user') // 用户发给角色，对角色来说是收入
      walletTransactions.push({
        id: m.id,
        title: isIncome 
          ? (m.type === 'redpacket' ? `收到${userNickname}的红包` : `来自${userNickname}的转账`)
          : (m.type === 'redpacket' ? `发给${userNickname}的红包` : `转账给${userNickname}`),
        amount: isIncome ? Math.abs(m.amount || 0) : -Math.abs(m.amount || 0),
        time: formatDate(m.timestamp),
        detail: m.note || '恭喜发财',
        type: isIncome ? 'income' : 'expense'
      })
    })

    // 5. 市集订单 (同步 shopping 类型的消息)
    const shoppingOrders = msgs.filter(m => m.type === 'shopping' || (m.content && m.content.includes('[购买]'))).map(m => ({
      id: m.id,
      item: m.itemName || '神秘商品',
      status: '已完成',
      price: m.amount || 0,
      time: formatDate(m.timestamp),
      icon: m.image
    }))

    // 合并应用数据
    return {
      wechat,
      backpack: { items: backpackItems.length > 0 ? backpackItems : (currentApps.backpack?.items || []) },
      calls: { history: callHistory.length > 0 ? callHistory : (currentApps.calls?.history || []) },
      wallet: {
        ...currentApps.wallet,
        transactions: walletTransactions.length > 0 ? walletTransactions : (currentApps.wallet?.transactions || []),
        familyCards: mirrorFamilyCards(charId),
        balance: currentApps.wallet?.balance || 1314.52
      },
      shopping: { orders: shoppingOrders.length > 0 ? shoppingOrders : (currentApps.shopping?.orders || []) },
      // 以下暂时保留现有数据或等待 AI Seeding
      photos: currentApps.photos || { photos: [] },
      messages: currentApps.messages || { items: [] },
      footprints: currentApps.footprints || { items: [] },
      notes: currentApps.notes || { items: [] },
      reminders: currentApps.reminders || { items: [] },
      browser: currentApps.browser || { history: [] },
      history: currentApps.history || { items: [] },
      music: currentApps.music || { items: [] },
      calendar: currentApps.calendar || { items: [] },
      meituan: currentApps.meituan || { orders: [] },
      email: currentApps.email || { mails: [] },
      forum: currentApps.forum || { items: [] },
      recorder: currentApps.recorder || { items: [] },
      files: currentApps.files || { items: [] },
      settings: currentApps.settings || { theme: 'kawaii' },
      moments: currentApps.moments || { posts: [] }
    }
  }

  /**
   * 判断是否需要 AI 补全数据
   */
  function canTriggerAISeeding(apps) {
    const itemsCount = (apps.footprints?.items?.length || 0) + (apps.notes?.items?.length || 0)
    return itemsCount === 0
  }

  /**
   * AI 全量生成：根据角色性格生成所有手机应用数据
   */
  async function seedAIAppData(charId, apps) {
    let chatStore
    try {
      chatStore = useChatStore()
    } catch (e) {
      console.warn('[PhoneInspection] chatStore not available, skipping AI generation')
      return
    }

    const char = chatStore.chats[charId]
    if (!char) return

    const settingsStore = useSettingsStore()
    const userName = settingsStore.personalization?.userProfile?.name || '你'

    const systemPrompt = `你是手机数据生成助手。请根据角色档案和参考数据生成真实的手机应用数据。直接返回 JSON 格式，不要 markdown 代码块。`

    // 获取近期20条聊天记录作为上下文
    const recentMessages = (char.msgs || []).slice(-20).map(m => {
      const roleLabel = m.role === 'assistant' ? char.name : userName
      const contentPreview = (m.content || '').substring(0, 100)
      return `${roleLabel}: ${contentPreview}`
    }).join('\n')

    // 获取当前已有的手机数据作为历史参考（近5次生成的内容）
    const existingApps = char.phoneData?.apps || {}
    const historyDataSnapshot = {}
    const appKeysToInclude = ['photos', 'messages', 'footprints', 'notes', 'reminders', 'browser', 'music', 'forum', 'moments', 'email', 'wallet']
    appKeysToInclude.forEach(key => {
      if (existingApps[key] && Object.keys(existingApps[key]).length > 0) {
        const items = existingApps[key].items || existingApps[key].photos || existingApps[key].history || existingApps[key].posts || existingApps[key].transactions || existingApps[key].mails || []
        if (items.length > 0) {
          historyDataSnapshot[key] = items.slice(-5)
        }
      }
    })

    const userPrompt = `【角色档案】
- 名称：${char.name}
- 真名：${char.userName || char.name}
- 身份设定：${char.bio || char.description || '未知'}
- 性格：${char.prompt || '温柔'}
- 标签：${char.tags ? char.tags.join('、') : '无'}
- 与用户关系：用户叫"${userName}"

【近期聊天记录（最近20条）】
${recentMessages || '暂无聊天记录'}

【该角色手机中已存在的数据（作为时间线续写参考）】
${Object.keys(historyDataSnapshot).length > 0 ? JSON.stringify(historyDataSnapshot, null, 2) : '暂无历史数据'}

请根据以上角色档案、聊天记录和已有数据，为该角色生成新鲜且连贯的手机应用数据：
{
  "photos": [{"id": "p1", "url": "Unsplash图片URL", "note": "照片备注", "location": "地点", "date": "日期"}],
  "messages": [{"sender": "发送者", "content": "内容", "time": "时间", "role": "sent 或 received (sent由机主本人视角发出)"}],
  "footprints": [{"title": "地点", "location": "地址", "content": "心情", "image": "图片URL", "time": "日期"}],
  "notes": [{"title": "标题", "content": "内容", "time": "时间"}],
  "reminders": [{"title": "标题", "detail": "详情", "time": "时间"}],
  "browser": [{"title": "搜索内容", "url": "", "time": "时间"}],
  "music": [{"title": "歌名", "detail": "歌手", "time": "时长"}],
  "forum": [{"title": "标题", "content": "内容", "category": "分类", "likes": 0, "comments": 0}],
  "recorder": [{"title": "名称", "duration": "时长", "time": "时间"}],
  "calendar": [{"title": "标题", "detail": "详情", "time": "日期"}],
  "files": [{"fileName": "文件名", "size": "大小", "time": "时间"}],
  "history": [{"title": "应用名", "detail": "使用时长", "time": "今天/昨天"}],
  "shopping": [{"item": "商品", "status": "状态", "price": 0, "time": "时间", "icon": ""}],
  "meituan": [{"item": "外卖", "status": "已送达", "price": 0, "time": "时间"}],
  "email": [{"sender": "发件人", "subject": "邮件主题", "preview": "预览内容", "content": "完整正文", "time": "时间", "read": false, "avatarColor": "#87CEEB", "tags": []}],
  "wallet": {"balance": 1314.52, "transactions": [{"merchant": "具体商户名(如:全家便利店、星巴克、由于项目分红)", "amount": 数字(正数), "type": "expense或income", "category": "餐饮|购物|娱乐|交通|红包|转账|亲属卡|生活|充值", "time": "MM/DD HH:MM", "detail": "详细且具体的描述(买了什么、在哪家店、什么品牌)", "note": "备注"}], "bankCards": [{"bank": "银行名称", "cardLevel": "Platinum|Gold|Diamond|普通", "number": "16位卡号", "creditLimit": 数字, "validThru": "MM/YY", "transactions": [{"merchant": "具体商户", "amount": 数字, "type": "expense或income", "category": "分类", "time": "MM/DD HH:MM", "detail": "详情描述"}]}]},
  "moments": [{"day": 1, "month": 1, "content": "文案", "images": []}]
}

要求：
1. 内容符合角色性格和近期聊天情境，与已有数据保持连贯。
2. 有个性，有故事感。不要生成重复单一的行为。
3. **Wallet（重要）**：
   - balance（余额）：根据角色财富值生成一个合理的数字。**严禁**使用复读机式数字（如88888.88、99999等占位符）。
   - 每笔账单必须详细，merchant 应该具体到品牌或店名。
   - 必须严格区分 type：如果是收到红包、工资、分红、奖励等，必须设为 "income"；购物、转账、支出则为 "expense"。
   - amount 一律用正数，加减号由前端根据 type 决定。
4. **bankCards**：生成1-3张卡，信用卡额度设置合理。卡内的 transactions 应与该角色消费习惯相符。`

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
      const result = await generateReply(messages, char, null, { isSimpleTask: true })
      
      if (!result || !result.content) {
        console.warn('[PhoneInspection] AI returned empty response')
        return
      }
      
      // 清理可能的 markdown 包装
      let content = result.content.trim()
      if (content.startsWith('```json')) content = content.slice(7)
      if (content.startsWith('```')) content = content.slice(3)
      if (content.endsWith('```')) content = content.slice(0, -3)
      
      const seedData = JSON.parse(fixCommonJsonErrors(content))

      if (seedData.photos) apps.photos = { photos: seedData.photos }
      if (seedData.messages) apps.messages = { items: seedData.messages }
      if (seedData.footprints) apps.footprints = { items: seedData.footprints }
      if (seedData.notes) apps.notes = { items: seedData.notes }
      if (seedData.reminders) apps.reminders = { items: seedData.reminders }
      if (seedData.browser) apps.browser = { history: seedData.browser }
      if (seedData.music) apps.music = { items: seedData.music }
      if (seedData.forum) apps.forum = { items: seedData.forum }
      if (seedData.recorder) apps.recorder = { items: seedData.recorder }
      if (seedData.calendar) apps.calendar = { items: seedData.calendar }
      if (seedData.files) apps.files = { items: seedData.files }
      if (seedData.history) apps.history = { items: seedData.history }
      if (seedData.shopping) apps.shopping = { orders: seedData.shopping }
      if (seedData.meituan) apps.meituan = { orders: seedData.meituan }
      if (seedData.email) apps.email = { mails: seedData.email }
      if (seedData.wallet) {
        if (seedData.wallet.balance !== undefined) apps.wallet = { ...apps.wallet, balance: seedData.wallet.balance }
        if (seedData.wallet.transactions?.length) {
          const existingTx = apps.wallet?.transactions || []
          apps.wallet = { ...apps.wallet, transactions: [...existingTx, ...seedData.wallet.transactions] }
        }
        if (seedData.wallet.bankCards?.length) {
          const existingCards = apps.wallet?.bankCards || []
          apps.wallet = { ...apps.wallet, bankCards: [...existingCards, ...seedData.wallet.bankCards] }
        }
      }
      if (seedData.moments) apps.moments = { posts: seedData.moments }

      console.log('[PhoneInspection] AI Full Generation Completed for:', char.name)
    } catch (e) {
      console.error('[PhoneInspection] AI Full Generation Failed:', e.message || e)
    }
  }



  function formatDate(ts) {
    if (!ts) return '现在'
    const d = new Date(ts)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  function formatDuration(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  /**
   * 镜像微信数据：将 ChatStore 的真实聊天记录同步到查手机的微信中
   */
  function mirrorWeChatData(charId) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    if (!char) return {}

    // A. 基础联系人: 用户 (该手机的主人认为的用户)
    const settingsStore = useSettingsStore()
    const userRemark = char.phoneData?.apps?.wechat?.remark || '笨蛋'
    const userName = settingsStore.personalization?.userProfile?.name || '你'
    
    const userContact = {
      id: 'user',
      name: userName,
      avatar: settingsStore.personalization?.userProfile?.avatar || '/avatars/user.png',
      remark: userRemark,
      isTop: true
    }
    
    // 仅保留用户自己作为联系人，不再抓取其他真实角色（避免串号感）
    const otherContacts = [] 

    const contacts = [userContact, ...otherContacts]

    // B. 私聊记录镜像
    const userConversation = {
      id: 'user',
      lastMsg: (char.msgs?.slice(-1)[0]?.content || '最近没有聊天喵').substring(0, 30),
      time: '现在',
      unread: 0,
      history: (char.msgs || []).map(m => ({
        id: m.id,
        from: m.role === 'user' ? 'user' : 'char',
        content: m.content,
        time: formatDate(m.timestamp),
        timestamp: m.timestamp,
        type: m.type || 'text'
      }))
    }

    // C. 寻找共同群聊
    const sharedGroups = Object.values(chatStore.chats).filter(c =>
      c.isGroup &&
      c.participants?.some(p => p.id === charId)
    )

    const groupConvs = sharedGroups.map(g => {
      const myInGroup = g.participants?.find(p => p.id === charId)
      const myNameInGroup = myInGroup?.nickname || myInGroup?.name || char.name

      return {
        id: g.id,
        isGroup: true,
        name: g.name,
        ownerNickname: myNameInGroup,
        lastMsg: (g.msgs?.slice(-1)[0]?.content || '群里很安静').substring(0, 30),
        time: '最近',
        history: (g.msgs || []).map(m => {
          let from = 'other'
          if (m.role === 'user') from = 'user'
          else if (m.senderId === charId) from = 'char'
          else {
            // 尝试识别群里的其他联系人
            const isKnownContact = contacts.find(c => c.id === m.senderId)
            from = isKnownContact ? m.senderId : 'other'
          }

          return {
            id: m.id,
            from: from,
            senderId: m.senderId,
            senderName: m.senderName || chatStore.chats[m.senderId]?.name || '陌生人',
            senderAvatar: m.senderAvatar || chatStore.chats[m.senderId]?.avatar || '/avatars/default.png',
            content: m.content,
            time: formatDate(m.timestamp || Date.now()),
            timestamp: m.timestamp || Date.now(),
            type: m.type || 'text'
          }
        })
      }
    })

    // B2. 虚拟私聊会话（不再使用真实角色作为镜像）
    const otherConvs = []

    // D. 注入虚拟数据 (让手机显得更真实)
    const bioText = String(char.bio || char.description || char.prompt || char.tags?.join?.(' ') || '').toLowerCase()
    const isOrphan = bioText.includes('孤儿') || bioText.includes('orphan') || bioText.includes('没有亲人') || bioText.includes('个人生活') || bioText.includes('独居')
    
    const virtualContacts = isOrphan ? [
      { id: 'friend_1', name: '损友', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=friend1', remark: '坑货', isTop: false },
      { id: 'work_1', name: '房东', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=landlord', remark: '房东(催租中)', isTop: false }
    ] : [
      { id: 'mom', name: '妈妈', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mom', remark: '老妈', isTop: false },
      { id: 'bestie', name: '闺蜜喵', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bestie', remark: '臭宝', isTop: false }
    ]

    // 如果没有真实群聊，注入一个虚拟的
    const now = Date.now()
    if (groupConvs.length === 0) {
      if (isOrphan) {
        groupConvs.push({
          id: 'v_group_1',
          isGroup: true,
          name: '深夜emo互助群',
          ownerNickname: char.name,
          lastMsg: '谁还没睡？出来聊两句。',
          time: '1小时前',
          history: [
            { id: 'v_m1', from: 'other', senderId: 'friend_1', senderName: '损友', senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=friend1', content: '今天打游戏又不带我？', timestamp: now - 3600000, type: 'text' },
            { id: 'v_m2', from: 'char', content: '下次一定喵。', timestamp: now - 1800000, type: 'text' }
          ]
        })
      } else {
        groupConvs.push({
          id: 'v_group_1',
          isGroup: true,
          name: '相亲相爱一家人',
          ownerNickname: char.name,
          lastMsg: '记得回来吃晚饭喵！',
          time: '昨天',
          history: [
            { id: 'v_m1', from: 'mom', senderName: '妈', senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mom', content: '明晚回来吃饭不？', timestamp: now - 86400000, type: 'text' },
            { id: 'v_m2', from: 'char', content: '周末再说喵~', timestamp: now - 43200000, type: 'text' }
          ]
        })
      }
    }

    return {
      currentUserId: 'me',
      ownerName: char.userName || char.name, // 手机主人的真名
      contacts: [...contacts, ...virtualContacts],
      conversations: [userConversation, ...groupConvs, ...otherConvs]
    }
  }

/**
   * 创建默认手机数据（最小化结构，内容由 AI 生成）
   */
  function createDefaultPhoneData() {
    return {
      password: {
        enabled: true,
        code: '1234',
        hint: '默认测试密码: 1234',
        failedAttempts: 0,
        lockedUntil: null
      },
      inspectionPermission: {
        granted: false,
        grantedAt: null,
        expiresAt: null,
        askedByAI: false,
        discoveryMode: false,
        mode: 'none',           // 'permitted'(申请同意) | 'hacking'(破解) | 'locked'(被锁屏)
        passwordShared: false,   // AI是否已通过卡片分享密码
        notifiedAI: false        // 是否已通知AI用户正在查看
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
        url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1470&auto=format&fit=crop',
        type: 'static',
        description: '默认壁纸',
        lastChanged: null
      },
      apps: {},
      desktopFrames: [
        { id: 'f1', url: null, note: '左侧相框' },
        { id: 'f2', url: null, note: '右侧相框' }
      ],
      anniversary: null,
      generationStatus: {
        lastGenerated: null,
        version: 'EMPTY-1.0',
        needsRegen: true
      }
    }
  }

  /**
   * 修复常见 JSON 错误并提取内容
   */
  function fixCommonJsonErrors(json) {
    if (!json) return '{}'
    // 1. 剥离 Markdown 代码块
    let cleaned = json.replace(/```json/gi, '').replace(/```/g, '').trim()
    // 2. 移除开头和结尾的非 JSON 字符
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1)
    }
    // 3. 修复末尾逗号
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
    return cleaned
  }

  /**
   * 请求查手机权限（在聊天中触发）
   */
  async function requestPermission(charId) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]

    if (!char) return { allowed: false, response: '角色不存在' }

    const prompt = `${char.name}，用户问："我可以看看你的手机吗？"。请根据你对用户的信任和当前心情，决定是否允许。
如果同意，请：
1. 先用自然语言回复（傲娇/害羞/大方等性格）
2. 然后发送一个手机访问卡片，格式如下：
【查手机卡片】
📱 手机访问权限已授权
🔑 密码：${char.phoneData?.password?.value || '0817'}
⏰ 有效期：60分钟内可随时查看
💡 提示：点击"查手机"输入密码即可进入
3. 最后标注【允许】

如果不同意：
1. 用自然语言拒绝（找个理由）
2. 标注【拒绝】`

    try {
      const result = await generateReply(
        [{ role: 'user', content: prompt }],
        char,
        null
      )

      let response = result.content
      const isAllowed = response.includes('【允许】') || response.includes('[允许]')

      if (isAllowed && response.includes('【查手机卡片】')) {
        const cardMatch = response.match(/【查手机卡片】[\s\S]*?((?=【)|$)/)
        if (cardMatch) {
          const cardContent = cardMatch[0].replace('【查手机卡片】', '').trim()
          chatStore.addMessage(charId, {
            role: 'assistant',
            content: response.replace(/【查手机卡片】[\s\S]*?((?=【)|$)/, '').replace(/[\u3010\u3011\[\]]/g, ''),
            id: `msg_${Date.now()}`,
            type: 'card',
            cardType: 'phone_access',
            cardData: {
              password: char.phoneData?.password?.code || '1234',
              expiresIn: '60',
              title: '手机访问授权'
            }
          })
          char.phoneData.inspectionPermission.passwordShared = true
          return { allowed: true, response }
        }
      }

      chatStore.addMessage(charId, {
        role: 'assistant',
        content: response.replace(/[\u3010\u3011\[\]]/g, ''),
        id: `msg_${Date.now()}`
      })

      if (isAllowed) {
        char.phoneData.inspectionPermission.granted = true
        char.phoneData.inspectionPermission.grantedAt = Date.now()
        char.phoneData.inspectionPermission.expiresAt = Date.now() + 60 * 60 * 1000
        char.phoneData.inspectionPermission.askedByAI = true
        char.phoneData.inspectionPermission.mode = 'permitted'
        char.phoneData.inspectionPermission.passwordShared = true
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

  async function processHiddenCommand(message, charId) {
    const chatStore = useChatStore()
    const text = message.content || ''
    const perm = phoneData.value?.inspectionPermission

    if (text.includes('【允许查看】') || text.includes('[允许查看]')) {
      const pwMatch = text.match(/(?:密码|password|密码[：:]\s*)(\S+)/i)
      const newPwd = pwMatch ? pwMatch[1] : (phoneData.value?.password?.code || '1234')
      if (perm) {
        perm.granted = true
        perm.grantedAt = Date.now()
        perm.expiresAt = Date.now() + 60 * 60 * 1000
        perm.mode = 'permitted'
        perm.passwordShared = true
        perm.notifiedAI = false
        if (newPwd && phoneData.value?.password) {
          phoneData.value.password.code = newPwd
        }
        chatStore.triggerToast('AI 已授权查看权限 🔓 (60 分钟内有效)')
      }
    }

    if (text.includes('【立即锁屏】') || text.includes('[立即锁屏]') || text.includes('【锁屏】') || text.includes('[锁屏]')) {
      if (perm) {
        perm.mode = 'locked'
        perm.granted = false
        isOpen.value = false
        currentCharId.value = null
        chatStore.triggerToast('手机已被 AI 远程锁屏 🔒')
      }
    }

    // 处理 [PHONE_CMD] JSON 指令
    const cmdMatch = text.match(/\[PHONE_CMD\]\s*({[\s\S]*?})\s*(?:\[\/PHONE_CMD\]|$)/i)
    if (cmdMatch) {
      try {
        const cmdData = JSON.parse(cmdMatch[1])
        const char = chatStore.chats[charId]
        if (!char || !char.phoneData) return

        // 1. 修改密码
        if (cmdData.password) {
           char.phoneData.password.code = String(cmdData.password)
           console.log('[PhoneInspection] AI 修改了手机密码:', cmdData.password)
        }

        // 2. 更新应用数据 (注入/修改)
        if (cmdData.apps) {
           const appIds = Object.keys(cmdData.apps)
           appIds.forEach(id => {
              if (!char.phoneData.apps[id]) char.phoneData.apps[id] = {}
              const target = char.phoneData.apps[id]
              const data = cmdData.apps[id]

              // 通用列表处理
              const listKey = getAppListKey(id)
              const listData = data[listKey] || data.items || data.list

              if (Array.isArray(listData)) {
                // 如果 AI 提供了列表，则追加或替换
                if (data.mode === 'append') {
                  target[listKey] = [...(target[listKey] || []), ...listData]
                } else {
                  target[listKey] = listData
                }
              }

              // 处理碎碎念
              if (data.allowedMuttering) target.allowedMuttering = data.allowedMuttering
              if (data.caughtMuttering) target.caughtMuttering = data.caughtMuttering

              // 处理其他字段 (如余额、余额等)
              Object.keys(data).forEach(k => {
                if (!['items', 'list', listKey, 'mode', 'allowedMuttering', 'caughtMuttering'].includes(k)) {
                   target[k] = data[k]
                }
              })
           })
        }
        await chatStore.saveChats()
      } catch (e) {
        console.error('[PhoneInspection] Failed to process PHONE_CMD:', e)
      }
    }
  }

  /**
   * 生成 AI 系统提示词中的手机数据概要
   */
  function getAIPhoneContext(charId) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    if (!char || !char.phoneData) return ''

    const phone = char.phoneData
    const perm = phone.inspectionPermission
    const pwd = phone.password

    let ctx = `【${char.name} 的手机状态】\n`
    ctx += `- 当前密码: ${pwd.code || '1234'}\n`
    ctx += `- 访问模式: ${perm.mode || 'none'} (permitted=已授权, hacking=入侵, locked=锁死)\n`
    
    if (perm.expiresAt && Date.now() < perm.expiresAt) {
      const remaining = Math.round((perm.expiresAt - Date.now()) / 60000)
      ctx += `- 剩余授权时间: ${remaining} 分钟\n`
    }

    ctx += `- 应用数据摘要 (仅展示最近5条):\n`
    Object.keys(phone.apps).forEach(appId => {
      const appData = phone.apps[appId]
      const listKey = getAppListKey(appId)
      const list = appData[listKey] || []
      const displayName = getAppDisplayName(appId)
      
      if (Array.isArray(list) && list.length > 0) {
        const summary = list.slice(-5).map(item => {
           if (typeof item === 'string') return item.substring(0, 30)
           return item.title || item.content || item.item || item.subject || item.fileName || '条目'
        }).join(', ')
        ctx += `  * ${displayName} (${appId}): [${summary}]\n`
      }
    })

    ctx += `\n【重要】AI可以通过回复 \`[PHONE_CMD] {"password": "新密码", "apps": {"appId": {"items": [...], "mode": "append/replace"}}} [/PHONE_CMD]\` 来动态修改手机。`

    return ctx
  }

  function getAppListKey(appId) {
    const map = {
      calls: 'history',
      browser: 'history',
      shopping: 'orders',
      meituan: 'orders',
      photos: 'photos',
      email: 'mails',
      moments: 'posts',
      wallet: 'transactions',
      calendar: 'items'
    }
    return map[appId] || 'items'
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

  /**
   * 设置桌面相框图片
   */
  async function setFrameImage(frameId, url) {
    if (!currentChar.value?.phoneData) return

    // Ensure array exists
    if (!currentChar.value.phoneData.desktopFrames || currentChar.value.phoneData.desktopFrames.length === 0) {
      currentChar.value.phoneData.desktopFrames = [
        { id: 'f1', url: null, note: '左侧相框' },
        { id: 'f2', url: null, note: '右侧相框' }
      ]
    }

    const frame = currentChar.value.phoneData.desktopFrames.find(f => f.id === frameId)
    if (frame) {
      frame.url = url
    }
    const chatStore = useChatStore()
    await chatStore.saveChats()
  }

  /**
   * 镜像亲属卡数据 (从真实钱包同步)
   */
  function mirrorFamilyCards(charId) {
    const walletStore = useWalletStore()
    // 过滤出与当前角色相关的亲属卡
    const cards = (walletStore.familyCards || []).filter(c => c.ownerId === charId)

    return cards.map(c => ({
      id: c.id || Math.random().toString(36).substr(2, 9),
      name: c.remark || '亲属卡',
      limit: c.amount || 2000,
      number: c.number,
      theme: c.theme || 'black-gold'
    }))
  }

  /**
   * 更新纪念日数据
   */
  async function updateAnniversary(data) {
    if (!currentChar.value?.phoneData) return
    currentChar.value.phoneData.anniversary = {
      ...currentChar.value.phoneData.anniversary,
      ...data
    }
    const chatStore = useChatStore()
    await chatStore.saveChats()
  }

  /**
   * 批量生成应用数据
   */
  async function batchGenerateAppData(charId, appIds) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    if (!char || !char.phoneData) return

    const appPrompts = {
      wechat: "生成一份针对用户的微信备注（一个词，如：笨蛋、主人、亲爱的）",
      calls: "5条通话记录，混合呼入/呼出/未接（包含 name, type[incoming/outgoing/missed], time, duration[如03:25], summary[仅已接通通话写通话概要描述，未接的不写此字段]）",
      messages: "3条短信记录（包含 sender[发件人], content[完整内容], time, isRead[true/false]）",
      wallet: "钱包数据（balance[余额数字], transactions[3条收支记录含type收入/支出,amount,category,time], bankCards[1张银行卡含bankName,lastFour,cardType,color]）",
      shopping: "3条最近的购物记录（包含 item, status[已收货], price, time, icon）",
      photos: "6张相册照片描述（包含 image[随机unsplash图片链接], description[照片内容描述20字内], time, location[地点]）",
      backpack: "背包物品列表（3个物品，包含 name, description[物品描述], icon[emoji], rarity[普通/稀有/史诗]）",
      footprints: "2条最近去过的地方或旅行记录（包含 title, location, content[完整描述], image[随机unsplash链接]）",
      notes: "3条私密便签内容（包含 title, content[完整内容], time）",
      reminders: "2条备忘录提醒事项（包含 title, content[提醒详情], time, done[true/false]）",
      browser: "5条搜索记录（包含 title, url, time）",
      history: "3条浏览历史记录（包含 title, url, time, favicon）",
      music: "4首最近播放的音乐（包含 title, artist, album, duration[如03:45], cover[随机unsplash图片链接]）",
      calendar: "3条日历日程安排（包含 title, startTime, endTime, location[可选], type[工作/生活/社交]）",
      meituan: "2条外卖记录（包含 item, status[已送达], price, time）",
      forum: "2条社区发帖或评论（包含 title, content[完整正文], category, likes, comments）",
      recorder: "2条录音文件记录（包含 title, duration, time）",
      email: "5条邮件记录，混合收件和发件（包含 subject[主题], sender[发件人], receiver[收件人], body[完整邮件正文], time, isRead[true/false], isUnread[true/false]）",
      files: "2个文件名及大小（包含 fileName, size, time）"
    }

    const appPromptHints = {
      wechat: "{\"remark\": \"...\"}",
      calls: "{\"history\": [{\"name\": \"...\", \"type\": \"incoming\", \"time\": \"HH:MM\", \"duration\": \"...\", \"summary\": \"...\"}]}",
      messages: "{\"items\": [{\"sender\": \"...\", \"content\": \"...\", \"time\": \"...\", \"isRead\": true}]}",
      wallet: "{\"balance\": 888.5, \"transactions\": [{\"type\": \"收入/支出\", \"amount\": 0, \"category\": \"...\", \"time\": \"...\", \"detail\": \"...\"}]}",
      shopping: "{\"orders\": [{\"item\": \"...\", \"status\": \"已收货\", \"price\": 0, \"time\": \"...\", \"icon\": \"...\"}]}",
      photos: "{\"photos\": [{\"image\": \"...\", \"description\": \"...\", \"time\": \"...\", \"location\": \"...\"}]}",
      backpack: "{\"items\": [{\"name\": \"...\", \"description\": \"...\", \"icon\": \"...\", \"rarity\": \"...\"}]}",
      footprints: "{\"items\": [{\"title\": \"...\", \"location\": \"...\", \"content\": \"...\", \"image\": \"...\", \"time\": \"...\"}]}",
      notes: "{\"items\": [{\"title\": \"...\", \"content\": \"...\", \"time\": \"...\"}]}",
      reminders: "{\"items\": [{\"title\": \"...\", \"content\": \"...\", \"time\": \"...\", \"done\": false}]}",
      browser: "{\"history\": [{\"title\": \"...\", \"url\": \"...\", \"time\": \"...\"}]}",
      history: "{\"items\": [{\"title\": \"...\", \"url\": \"...\", \"time\": \"...\", \"favicon\": \"...\"}]}",
      music: "{\"items\": [{\"title\": \"...\", \"artist\": \"...\", \"album\": \"...\", \"duration\": \"...\", \"cover\": \"...\"}]}",
      calendar: "{\"items\": [{\"title\": \"...\", \"startTime\": \"...\", \"endTime\": \"...\", \"location\": \"...\", \"type\": \"...\"}]}",
      meituan: "{\"orders\": [{\"item\": \"...\", \"status\": \"已送达\", \"price\": 0, \"time\": \"...\"}]}",
      forum: "{\"items\": [{\"title\": \"...\", \"content\": \"...\", \"category\": \"...\", \"likes\": 0, \"comments\": 0}]}",
      recorder: "{\"items\": [{\"title\": \"...\", \"duration\": \"...\", \"time\": \"...\"}]}",
      email: "{\"mails\": [{\"subject\": \"...\", \"sender\": \"...\", \"receiver\": \"...\", \"body\": \"...\", \"time\": \"...\", \"isRead\": true}]}",
      files: "{\"items\": [{\"fileName\": \"...\", \"size\": \"...\", \"time\": \"...\"}]}"
    }

    const selectedPrompts = appIds.map(id => `- ${id}: ${appPrompts[id] || '生成相关内容'}。结构示例：${appPromptHints[id] || '{"items": []}'}`).join('\n')

    const settingsStore = useSettingsStore()
    const userProfile = settingsStore.personalization?.userProfile || {}
    const userName = char.userName || userProfile.name || '你'
    const userPersona = char.userPersona || ''
    const userGender = char.userGender || '未知'
    const userSig = userProfile.signature || ''

    const recentMessages = (char.msgs || []).slice(-20).map(m => {
      const roleLabel = m.role === 'assistant' ? char.name : userName
      return `${roleLabel}: ${(m.content || '').substring(0, 80)}`
    }).join('\n')

    const existingApps = char.phoneData?.apps || {}
    const historySnapshot = {}
    appIds.forEach(key => {
      if (existingApps[key]) {
        const items = existingApps[key].items || existingApps[key].photos ||
          existingApps[key].history || existingApps[key].posts ||
          existingApps[key].transactions || existingApps[key].mails ||
          existingApps[key].orders || existingApps[key].records || []
        if (Array.isArray(items) && items.length > 0) {
          historySnapshot[key] = items.slice(-3)
        }
      }
    })

    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    const weekday = ['日','一','二','三','四','五','六'][now.getDay()]

    const prompt = `【系统时间】今天是 ${todayStr} 星期${weekday}，当前时间约 ${timeStr}。生成数据时请以此时间为基准。

【角色信息】名称：${char.name}
【用户（你）的信息】名字：${userName}，性别：${userGender}${userPersona ? '，性格/设定：' + userPersona : ''}${userSig ? '，签名：' + userSig : ''}

【近期微信聊天记录（最近20条）】
${recentMessages || '暂无'}

【该角色手机中已有的数据（作为参考保持连贯性）】
${Object.keys(historySnapshot).length > 0 ? JSON.stringify(historySnapshot, null, 2) : '暂无历史数据'}

【生成任务】为以下${appIds.length}个应用生成完整的手机数据。每个应用的数据条目内容请精简（单条20-60字即可），确保所有应用都能生成完整。
${selectedPrompts}

【时间戳规范（必须严格遵守）】
基准日期：${todayStr}
- 今天的数据用 "HH:MM" 格式（如 "${timeStr}"、"09:30"）
- 昨天的数据用 "昨天 HH:MM" 格式（如 "昨天 14:20"）
- 更早的日期用 "MM-DD HH:MM" 格式（如 "${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()-2).padStart(2,'0')} 10:00"）
- 时间应自然分布在最近7天内，符合该角色的生活作息
- 每一条数据都必须 have time 字段！

【碎碎念（每个应用必填）】
- allowedMuttering: 允许查看时的反应（傲娇/害羞/得意等，15字内）
- caughtMuttering: 被偷看发现的反应（震惊/愤怒/慌张等，15字内）

【输出格式要求】返回纯JSON对象（不要markdown代码块\`\`\`），结构如下：
{"apps":{"应用ID":{"数据字段":"值", "allowedMuttering":"...", "caughtMuttering":"..."}}}
注意：如果是包含列表的应用，列表必须放在对应的键下（如 calls 用 history，messages 用 items 等，详见结构示例）。
绝对保证：上述${appIds.length}个应用每一个都要有数据，一个都不能少！`

    try {
      const result = await generateReply([{ role: 'user', content: prompt }], char, null, { isSimpleTask: true })
      const rawContent = result.content || ''
      console.log('[BatchGenerate] Raw AI response length:', rawContent.length)
      console.log('[BatchGenerate] Raw preview (first 300 chars):', rawContent.substring(0, 300))

      let data = tryParseWithBraceCounting(rawContent, appIds)

      if (!data || !data.apps) {
        console.error('[BatchGenerate] All parse attempts failed. Raw (first 1000 chars):', rawContent.substring(0, 1000))
        return false
      }

      const parsedAppIds = Object.keys(data.apps)
      const missingApps = appIds.filter(id => !parsedAppIds.includes(id))
      if (missingApps.length > 0) {
        console.warn('[BatchGenerate] Missing apps:', missingApps, 'Attempting deep rescue...')
        const rescued = deepPerAppRescue(rawContent, missingApps)
        if (rescued) {
          Object.assign(data.apps, rescued)
          console.log('[BatchGenerate] Rescued apps:', Object.keys(rescued))
        }
      }

      console.log('[BatchGenerate] ✅ Final apps:', Object.keys(data.apps),
        'counts:', Object.fromEntries(
          Object.entries(data.apps).map(([k,v]) => {
            if (!v) return [k, 0]
            const arr = v.items||v.posts||v.transactions||v.mails||v.orders||v.records||v.photos||v.history||v.events||v.conversations
            return [k, Array.isArray(v) ? v.length : (Array.isArray(arr) ? arr.length : Object.keys(v||{}).length)]
          })
        )
      )

      if (data.apps) {
        const appToKeyMap = {
          calls: 'history',
          browser: 'history',
          shopping: 'orders',
          meituan: 'orders',
          photos: 'photos',
          email: 'mails',
          moments: 'posts',
          wallet: 'transactions',
          calendar: 'items'
        }

        Object.keys(data.apps).forEach(appId => {
          let appData = data.apps[appId]
          if (!char.phoneData.apps[appId]) char.phoneData.apps[appId] = {}
          const target = char.phoneData.apps[appId]

          // 1. 如果 AI 直接返回了数组，我们需要根据类型将其归位
          if (Array.isArray(appData)) {
             const key = appToKeyMap[appId] || 'items'
             target[key] = appData
             return
          }

          // 2. 如果是对象，处理特殊字段和列表归位
          if (appId === 'wechat' && appData.remark) target.remark = appData.remark
          
          const listKey = appToKeyMap[appId] || 'items'
          const possibleArr = appData[listKey] || appData.items || appData.list || appData.data
          if (Array.isArray(possibleArr)) {
             target[listKey] = possibleArr
          }

          Object.keys(appData).forEach(key => {
            if (['remark', 'muttering', 'allowedMuttering', 'caughtMuttering', listKey, 'items', 'list', 'data'].includes(key)) return
            if (appData[key] != null) target[key] = appData[key]
          })

          if (appData.allowedMuttering) target.allowedMuttering = appData.allowedMuttering
          if (appData.caughtMuttering) target.caughtMuttering = appData.caughtMuttering
          if (appData.muttering && !target.allowedMuttering) target.allowedMuttering = appData.muttering
        })
      }
      await chatStore.saveChats()
      return true
    } catch (e) {
      console.error('[PhoneInspection] Batch Generation Error:', e)
      return false
    }
  }

  function fixCommonJsonErrors(raw) {
    let s = raw.trim()
    // 移除可能的 markdown 代码标记
    s = s.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    // 如果 AI 混入了一些像 "正在思考中..." 这样的语句，尝试定位真正的 JSON 开始位置
    const firstBrace = s.indexOf('{')
    if (firstBrace > 0) {
      const prefix = s.substring(0, firstBrace)
      if (prefix.includes('思考') || prefix.includes('解析') || prefix.includes('生成')) {
        s = s.substring(firstBrace)
      }
    }
    // 移除末尾多余逗号 (简单的行末修复)
    s = s.replace(/,(\s*[}\]])/g, '$1')
    return s
  }

  function tryParseWithBraceCounting(raw, appIds = []) {
    const cleaned = fixCommonJsonErrors(raw)

    try {
      const parsed = JSON.parse(cleaned)
      if (parsed && parsed.apps) {
        console.log('[BatchGenerate] ✅ Direct JSON.parse succeeded')
        return parsed
      }
    } catch(e) {
      console.warn('[BatchGenerate] Direct parse failed:', e.message.substring(0, 80))
    }

    const appsObj = extractObjectByKey(cleaned, 'apps')
    if (appsObj) {
      try {
        const result = { apps: JSON.parse(appsObj) }
        console.log('[BatchGenerate] ✅ Extracted apps object via brace counting')
        return result
      } catch(e2) {
        console.warn('[BatchGenerate] apps object JSON.parse failed, attempting fix:', e2.message.substring(0, 80))
        const fixed = attemptFixTruncatedJson(appsObj)
        if (fixed) {
          try { return { apps: JSON.parse(fixed) } } catch(e3) {}
        }
      }
    }

    const topObj = extractTopLevelObject(cleaned)
    if (topObj) {
      try {
        const d = JSON.parse(topObj)
        if (d && d.apps) { console.log('[BatchGenerate] ✅ Top-level object has apps'); return d }
      } catch(e4) {}
    }

    const allApps = {}
    for (const appId of appIds) {
      const appObj = extractObjectByKey(raw, appId)
      if (appObj) {
        try {
          allApps[appId] = JSON.parse(appObj)
          console.log(`[BatchGenerate] ✅ Direct extract: ${appId}`)
        } catch(e5) {
          const fixed = attemptFixTruncatedJson(appObj)
          if (fixed) {
            try { allApps[appId] = JSON.parse(fixed); console.log(`[BatchGenerate] ✅ Fixed extract: ${appId}`) } catch(e6) {}
          }
        }
      }
    }
    if (Object.keys(allApps).length > 0) return { apps: allApps }

    return null
  }

  function extractObjectByKey(text, key) {
    const searchStr = '"' + key + '"'
    let idx = text.indexOf(searchStr)
    while (idx !== -1) {
      const afterKey = text.substring(idx + searchStr.length)
      const colonMatch = afterKey.match(/^\s*:\s*/)
      if (!colonMatch) { idx = text.indexOf(searchStr, idx + 1); continue }

      const objStart = idx + searchStr.length + colonMatch[0].length
      const obj = extractJsonObject(text, objStart)
      if (obj) return obj.content

      idx = text.indexOf(searchStr, idx + 1)
    }
    return null
  }

  function extractJsonObject(text, startFrom) {
    let i = startFrom
    while (i < text.length && text[i] !== '{') i++
    if (i >= text.length) return null

    let depth = 0, inString = false, escapeNext = false, j = i
    while (j < text.length) {
      const ch = text[j]
      if (escapeNext) { escapeNext = false; j++; continue }
      if (ch === '\\') { escapeNext = true; j++; continue }
      if (ch === '"') { inString = !inString; j++; continue }
      if (!inString) {
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) return { start: i, end: j + 1, content: text.substring(i, j + 1) }
        }
      }
      j++
    }
    return null
  }

  function extractTopLevelObject(text) {
    const obj = extractJsonObject(text, text.indexOf('{'))
    return obj ? obj.content : null
  }

  function attemptFixTruncatedJson(jsonStr) {
    let fixed = jsonStr
    const obs = (fixed.match(/\{/g)||[]).length
    const cbs = (fixed.match(/\}/g)||[]).length
    if (cbs < obs) fixed += '}'.repeat(obs - cbs)
    fixed = fixed.replace(/,(\s*[}\]])/g,'$1')
    fixed = fixed.replace(/,\s*$/,'')
    fixed = fixed.replace(/["'\\]*$/, '')
    const reTryObs = (fixed.match(/\{/g)||[]).length
    const reTryCbs = (fixed.match(/\}/g)||[]).length
    if (reTryObs === reTryCbs) return fixed
    return null
  }

  function deepPerAppRescue(rawContent, targetAppIds) {
    const rescued = {}
    for (const appId of targetAppIds) {
      const appObj = extractObjectByKey(rawContent, appId)
      if (appObj) {
        try {
          rescued[appId] = JSON.parse(appObj)
          console.log(`[DeepRescue] ✅ ${appId}`)
        } catch(e) {
          const fixed = attemptFixTruncatedJson(appObj)
          if (fixed) {
            try { rescued[appId] = JSON.parse(fixed); console.log(`[DeepRescue] ✅ ${appId} (fixed)`) } catch(e2) {}
          }
        }
      }
      if (!rescued[appId]) {
        const looseIdx = rawContent.indexOf('"' + appId + '"')
        if (looseIdx !== -1) {
          const afterColon = rawContent.substring(looseIdx).replace(/^[^:]*:/, '').trim()
          if (afterColon.startsWith('{')) {
            const partial = extractJsonObject(afterColon, 0)
            if (partial) {
              try { rescued[appId] = JSON.parse(partial.content); console.log(`[DeepRescue] ✅ ${appId} (loose)`) } catch(e3) {}
            }
          }
        }
      }
    }
    return Object.keys(rescued).length > 0 ? rescued : null
  }

  function triggerToast(message, type = 'info') {
    const chatStore = useChatStore()
    chatStore.triggerToast(message, type)
  }

  function getAppDisplayName(appId) {
     const names = {
       calls: '最近通话',
       browser: '浏览器',
       shopping: '购物商城',
       meituan: '外卖记录',
       photos: '相册内容',
       email: '邮件往来',
       moments: '朋友圈',
       wallet: '我的钱包',
       calendar: '日程表',
       muttering: '碎碎念'
     }
     return names[appId] || appId
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
    photoFrames,

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
    generatePhoneData,
    setFrameImage,
    updateAnniversary,
    batchGenerateAppData,
    clearAppData,
    triggerToast,
    processHiddenCommand
  }
})
