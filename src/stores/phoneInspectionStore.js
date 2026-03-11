import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import { useWalletStore } from './walletStore'
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
    // 优先使用已有的碎碎念
    const appData = phoneData.value?.apps?.[appName]
    const muttering = appData?.muttering

    if (muttering) {
      mutteringQueue.value.push({
        app: appName,
        text: muttering,
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
    if (!currentChar.value?.phoneData?.apps) return

    const chatStore = useChatStore()
    const apps = currentChar.value.phoneData.apps
    const ids = Array.isArray(appIds) ? appIds : [appIds]

    ids.forEach(appId => {
      if (appId === 'wechat') apps.wechat.conversations = []
      else if (appId === 'photos') apps.photos.photos = []
      else if (appId === 'wallet') {
        apps.wallet.transactions = []
        apps.wallet.balance = 888.5
      }
      else if (appId === 'calls') apps.calls.history = []
      else if (appId === 'messages') apps.messages.items = []
      else if (appId === 'shopping') apps.shopping.orders = []
      else if (appId === 'notes') apps.notes.items = []
      else if (appId === 'reminders') apps.reminders.items = []
      else if (appId === 'browser') apps.browser.history = []
      else if (appId === 'history') apps.history.items = []
      else if (appId === 'music') apps.music.items = []
      else if (appId === 'forum') apps.forum.items = []
      else if (appId === 'recorder') apps.recorder.items = []
      else if (appId === 'calendar') apps.calendar.items = []
      else if (appId === 'files') apps.files.items = []
      else if (appId === 'meituan') apps.meituan.orders = []
      else if (appId === 'footprints') apps.footprints.items = []
      else if (appId === 'backpack') apps.backpack.items = []
    })

    // 标记为需要重新同步
    if (currentChar.value.phoneData.generationStatus) {
      currentChar.value.phoneData.generationStatus.needsRegen = true
    }

    await chatStore.saveChats()
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
    const callHistory = msgs.filter(m => m.type === 'voice' || m.type === 'call').map(m => ({
      id: m.id,
      name: m.role === 'user' ? (chatStore.userProfile?.name || '你') : '我',
      type: m.role === 'user' ? 'incoming' : 'outgoing',
      time: formatDate(m.timestamp),
      duration: m.duration ? formatDuration(m.duration) : '通话完成',
      phone: '138****8816'
    }))

    // 4. 钱包交易同步 (红包、转账)
    const walletTransactions = []
    msgs.filter(m => ['redpacket', 'transfer'].includes(m.type)).forEach(m => {
      walletTransactions.push({
        id: m.id,
        title: m.type === 'redpacket' ? '发出的红包' : '转账给 TA',
        amount: -Math.abs(m.amount || 0),
        time: formatDate(m.timestamp),
        detail: m.note || '恭喜发财'
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
   * AI 智能播种：根据性格生成初始“足迹”、“便签”和“浏览记录”
   */
  async function seedAIAppData(charId, apps) {
    const chatStore = useChatStore()
    const char = chatStore.chats[charId]
    if (!char) return

    const prompt = `你正在为角色 ${char.name} 生成手机初始数据。
      TA 的性格设定是：${char.prompt || '温柔'}${char.tags ? '，标签：' + char.tags.join(',') : ''}。
      请生成以下 JSON 数据：
      1. footprints: 2条旅行或出没地记录（包含 title, location, content, image[空]）
      2. notes: 2条私人便签（包含 title, content）
      3. browser: 2条搜索历史（包含 title, url[空]）
      4. forum: 1条社区发帖（包含 title, content, category, likes, comments）
      5. moments: 2条朋友圈动态（包含 day, month[数字], content, images[空数组]）
      
      要求：内容必须极度符合 TA 的设定口吻，文字生动细腻。返回纯 JSON。`

    try {
      const result = await generateReply([{ role: 'user', content: prompt }], char, null, { isSimpleTask: true })
      const seedData = JSON.parse(fixCommonJsonErrors(result.content))

      if (seedData.footprints) apps.footprints.items = seedData.footprints
      if (seedData.notes) apps.notes.items = seedData.notes
      if (seedData.browser) apps.browser.history = seedData.browser
      if (seedData.forum) apps.forum.items = seedData.forum
      if (seedData.moments) apps.moments.posts = seedData.moments

      console.log('[PhoneInspection] AI Seeding Completed for:', char.name)
    } catch (e) {
      console.error('[PhoneInspection] AI Seeding Failed:', e)
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

    // A. 基础联系人
    const settingsStore = useSettingsStore()
    const contacts = [
      {
        id: 'user',
        name: settingsStore.personalization?.userProfile?.name || '你',
        avatar: settingsStore.personalization?.userProfile?.avatar || '/avatars/user.png',
        remark: char.phoneData?.apps?.wechat?.remark || '笨蛋',
        isTop: true
      }
    ]

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
          else from = m.senderId

          return {
            id: m.id,
            from: from,
            senderId: m.senderId,
            senderName: m.senderName || chatStore.chats[m.senderId]?.name || '陌生人',
            senderAvatar: m.senderAvatar || chatStore.chats[m.senderId]?.avatar || '/avatars/default.png',
            content: m.content,
            time: formatDate(m.timestamp),
            timestamp: m.timestamp,
            type: m.type || 'text'
          }
        })
      }
    })

    // D. 注入虚拟数据 (让手机显得更真实)
    const virtualContacts = [
      { id: 'mom', name: '妈妈', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mom', remark: '老妈', isTop: false },
      { id: 'bestie', name: '闺蜜喵', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bestie', remark: '臭宝', isTop: false }
    ]

    // 如果没有真实群聊，注入一个虚拟的
    if (groupConvs.length === 0) {
      groupConvs.push({
        id: 'v_group_1',
        isGroup: true,
        name: '相亲相爱一家人',
        ownerNickname: char.name,
        lastMsg: '记得回来吃晚饭喵！',
        time: '昨天',
        history: [
          { id: 'v_m1', from: 'mom', senderName: '妈', senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mom', content: '明晚回来吃饭不？', time: '昨天', type: 'text' },
          { id: 'v_m2', from: 'char', content: '周末再说喵~', time: '昨天', type: 'text' }
        ]
      })
    }

    return {
      currentUserId: 'me',
      contacts: [...contacts, ...virtualContacts],
      conversations: [userConversation, ...groupConvs]
    }
  }

  /**
   * 模版 1：日常/温馨风
   */
  function getMockDailyTemplate(name) {
    return {
      password: { enabled: true, code: "1234", hint: "我的生日(?) 试试1234" },
      wallpaper: { url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1471", type: "static" },
      inspectionPermission: { granted: true },
      riskSystem: { currentRisk: 0, triggers: { stayTooLong: 5 }, charAttention: 'away' },
      apps: {
        wechat: {
          currentUserId: 'me',
          contacts: [
            { id: 'user', name: '你', avatar: '/avatars/default.png', remark: '笨蛋', isTop: true },
            { id: 'mom', name: '妈妈', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mom', isTop: false },
            { id: 'boss', name: '老板', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=boss', isTop: false }
          ],
          conversations: [
            {
              id: 'user',
              lastMsg: '笨蛋，万一下午下雨了呢。',
              time: '09:06',
              unread: 0,
              history: [
                { from: "char", content: "今天天气真好，记得带伞哦~", time: "09:00" },
                { from: "user", content: "天气好为什么要带伞？", time: "09:05" },
                { from: "char", content: "笨蛋，万一下午下雨了呢。", time: "09:06" }
              ]
            },
            {
              id: 'mom',
              lastMsg: '记得按时吃饭。',
              time: '昨天',
              unread: 2,
              history: [
                { from: "char", content: "知道了啦。", time: "18:00" },
                { from: "user", content: "记得按时吃饭。", time: "17:30" }
              ]
            }
          ]
        },
        photos: {
          photos: [
            { id: "p1", url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=1000", note: "路边遇到的小橘猫。", location: "公园", date: "昨天", generated: true }
          ]
        },
        calls: {
          history: [
            { name: '妈妈', type: 'incoming', time: '今天 10:30', duration: '05:20' },
            { name: '顺丰快递', type: 'outgoing', time: '昨天 15:45', duration: '00:45' }
          ]
        },
        shopping: {
          orders: [
            { id: 'O1', item: '可爱猫耳耳机', status: '待收货', price: 199.0 },
            { id: 'O2', item: '抹茶味巧克力', status: '已完成', price: 45.0 }
          ]
        }
      }
    }
  }

  /**
   * 模版 2：有点小秘密/神秘感
   */
  function getMockSecretTemplate(name) {
    return {
      password: { enabled: true, code: "1234", hint: "通用测试密码: 1234" },
      wallpaper: { url: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1471", type: "static" },
      inspectionPermission: { granted: false },
      riskSystem: { currentRisk: 20, triggers: { enterSensitiveApp: 20 }, charAttention: 'nearby' },
      apps: {
        wechat: {
          currentUserId: 'me',
          contacts: [
            { id: 'user', name: '那个人', avatar: '/avatars/default.png', remark: '那个家伙' },
            { id: 'admin', name: '系统管理员', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin' }
          ],
          conversations: [
            {
              id: 'user',
              lastMsg: '你在写什么小说吗？',
              time: '10:00',
              history: [
                { from: "char", content: "..计划顺利吗？", time: "昨天 23:59" },
                { from: "user", content: "你在写什么小说吗？", time: "今天 10:00" }
              ]
            }
          ]
        },
        calls: {
          history: [
            { name: '未知号码', type: 'missed', time: '凌晨 02:15', duration: '0' }
          ]
        },
        browser: {
          history: [
            { title: '如何消失得无影无踪', url: 'https://example.com' },
            { title: '加密通讯工具推荐', url: 'https://example.com' }
          ]
        }
      }
    }
  }

  /**
   * 模版 3：暧昧
   */
  function getMockRomanticTemplate(name) {
    return {
      password: { enabled: true, code: "1234", hint: "想你就写 1234" },
      wallpaper: { url: "https://images.unsplash.com/photo-1516589174184-c6852651428a?q=80&w=1287", type: "static" },
      inspectionPermission: { granted: true },
      apps: {
        wechat: {
          currentUserId: 'me',
          contacts: [
            { id: 'user', name: '亲爱的', avatar: '/avatars/default.png', remark: '❤ 亲爱的', isTop: true }
          ],
          conversations: [
            {
              id: 'user',
              lastMsg: '不告诉你，反正脸红了。',
              time: '08:15',
              history: [
                { from: "char", content: "梦到你了。", time: "01:20" },
                { from: "user", content: "梦到我什么了？", time: "08:10" },
                { from: "char", content: "不告诉你，反正脸红了。", time: "08:15" }
              ]
            }
          ]
        },
        photos: {
          photos: [
            { id: "r1", url: "https://images.unsplash.com/photo-1471897488648-5eae4ac6686b?q=80&w=1000", note: "和你一起看过的夕阳。", location: "海边", date: "上周末", generated: true }
          ]
        }
      }
    }
  }

  /**
   * 创建默认手机数据（当 AI 生成失败时）
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
        granted: true,
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
        url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1470&auto=format&fit=crop',
        type: 'static',
        description: '默认壁纸',
        lastChanged: null
      },
      apps: {
        wechat: {
          conversations: [
            { id: 'user', lastMsg: '睡了吗喵？', time: '22:30', unread: 1, isTop: true, history: [] }
          ],
          contacts: [
            { id: 'user', name: '你', remark: '⭐ 笨蛋 (置顶)', isTop: true }
          ]
        },
        photos: {
          photos: [
            { id: 'm1', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=300', note: '路边偶遇', date: '2026-03-05' },
            { id: 'm2', url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=300', note: '今天的心情', date: '2026-03-06' }
          ]
        },
        wallet: {
          balance: 1314.52,
          bankCards: [{ id: 'bank1', name: '招商银行', lastFour: '8816', type: 'credit' }],
          transactions: [
            { id: 't1', title: '星巴克', amount: -32.0, time: '今天 09:30' },
            { id: 't2', title: '工资收入', amount: 8000.0, time: '3月1日' }
          ],
          familyCards: [{ id: 'f1', name: '亲属卡-给笨蛋', limit: 1000 }]
        },
        calls: {
          history: [
            { id: 'c1', name: '妈妈', type: 'incoming', time: '10:00', duration: '12:05' },
            { id: 'c2', name: '顺丰快递', type: 'outgoing', time: '昨天', duration: '00:45' },
            { id: 'c3', name: '138****8888', type: 'missed', time: '周三', duration: '0' }
          ]
        },
        messages: {
          items: [
            { id: 'm1', sender: '10086', content: '您本月话费余额为：15.5元。', time: '今天' },
            { id: 'm2', sender: '工银信使', content: '您尾号8816卡片入账 8000.00元。', time: '3月1日' }
          ]
        },
        shopping: {
          orders: [
            { id: 'O1', item: '可爱猫耳耳机', status: '待收货', price: 199.0, time: '03-06', icon: 'https://api.dicebear.com/7.x/icons/svg?seed=headset' },
            { id: 'O2', item: '抹茶味巧克力', status: '已完成', price: 45.0, time: '03-05', icon: 'https://api.dicebear.com/7.x/icons/svg?seed=food' }
          ]
        },
        meituan: {
          orders: [
            { id: 'mt1', item: '芝士厚乳拿铁', status: '已送达', price: 21.0, time: '14:20' },
            { id: 'mt2', item: '麻辣香锅', status: '已送达', price: 35.5, time: '昨天' }
          ]
        },
        footprints: {
          items: [
            { title: '打卡了这家猫咖', location: '朝阳区', time: '2026-03-04', image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400', content: '小猫们太可爱了！' },
            { title: '在海边看日落', location: '海滨大道', time: '2026-02-14', image: 'https://images.unsplash.com/photo-1516589174184-c6852651428a?q=80&w=400', content: '浪漫的一天~' }
          ]
        },
        backpack: {
          items: [
            { id: 'i1', name: '心形锁扣', count: 1, description: 'TA 送我的第一个小礼物喵。' },
            { id: 'i2', name: '治愈药水', count: 5, description: '生病的时候 TA 叮嘱我喝的。' }
          ]
        },
        notes: {
          items: [
            { title: '待办清单', content: '1. 买猫粮 2. 给 TA 发早安 3. 洗衣服', time: '刚刚' },
            { title: '想要去的远方', content: '冰岛、芬兰、还有你的心里喵~', time: '昨天' }
          ]
        },
        reminders: {
          items: [
            { title: '记得喝水', detail: '每小时喝一次喵', time: '14:00' },
            { title: '晚上 8 点视频', detail: '要穿那件漂亮的裙子', time: '20:00' }
          ]
        },
        browser: {
          history: [
            { title: '如何搭配衣服更好看', url: 'https://style.com', time: '10:15' },
            { title: '双人马代旅游攻略', url: 'https://travel.com', time: '昨天' }
          ]
        },
        music: {
          items: [
            { title: '告白气球', detail: '周杰伦', time: '03:35', icon: 'fa-solid fa-music' },
            { title: '恋爱循环', detail: '花泽香菜', time: '04:12', icon: 'fa-solid fa-compact-disc' }
          ]
        },
        forum: {
          items: [
            { title: '救命！怎么跟喜欢的人开口？', content: '在线等，挺急的喵...', category: '情感天地', likes: 102, comments: 24 },
            { title: '分享一下今天的穿搭', content: '尝试了小清新风格', category: '日常', likes: 55, comments: 12 }
          ]
        },
        recorder: {
          items: [
            { title: '偷偷唱给 TA 的歌', duration: '02:45', time: '凌晨 01:20' },
            { title: '灵感片段', duration: '00:30', time: '周一' }
          ]
        },
        calendar: {
          items: [
            { title: '我们的纪念日', detail: '记得买花！', time: '3月20日' },
            { title: 'Char 手机大扫除', detail: '清理多余垃圾', time: '每月末' }
          ]
        },
        files: {
          items: [
            { fileName: '秘密小说.docx', size: '2.4MB', time: '昨天' },
            { fileName: '合照压缩包.zip', size: '150MB', time: '2026-02-14' }
          ]
        },
        history: {
          items: [
            { title: '微信', detail: '使用了 125 分钟', time: '今天' },
            { title: '画廊', detail: '使用了 45 分钟', time: '今天' }
          ]
        },
        settings: { theme: 'kawaii', notification: true }
      },
      desktopFrames: [
        { id: 'f1', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300', note: '心动瞬间' },
        { id: 'f2', url: null, note: '虚位以待' }
      ],
      anniversary: {
        title: '在一起',
        date: '2026-02-14',
        unit: '天',
        desc: '心跳加速的频率，从来没有变过喵~'
      },
      generationStatus: {
        lastGenerated: Date.now(),
        version: 'MOCK-1.0',
        needsRegen: false
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
    // 4. 修复由于引号嵌套导致的转义问题
    cleaned = cleaned.replace(/\\"/g, '"').replace(/\\n/g, ' ')
    return cleaned
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
      footprints: "2条最近去过的地方或旅行记录（包含 title, location, content, image[随机unsplash链接]）",
      notes: "3条私密便签内容（包含 title, content, time）",
      browser: "5条搜索记录（包含 title, url, time）",
      forum: "2条社区发帖或评论（包含 title, content, category, likes, comments）",
      moments: "3条朋友圈动态（包含 day, month[数字], content, images[图片链接数组]）",
      shopping: "3条最近的购物记录（包含 item, status[已收货], price, time, icon）",
      meituan: "2条美团外卖记录（包含 item, status[已送达], price, time）",
      recorder: "2条录音文件记录（包含 title, duration, time）",
      files: "2个文件名及大小（包含 fileName, size, time）"
    }

    const selectedPrompts = appIds.map(id => `- ${id}: ${appPrompts[id] || '生成 2 条相关内容'}`).join('\n')

    // 强制包含所有被选应用的碎碎念生成
    const prompt = `你正在为角色 ${char.name} 模型化手机数据。
      TA 的性格设定是：${char.prompt || char.bio?.description || '普通'}
      
      请一次性生成以下应用的数据：
      ${selectedPrompts}
      
      此外，请为以下每个应用分别生成一句 ${char.name} 的“碎碎念”：
      ${appIds.join(', ')}
      碎碎念是用户点开该应用时 TA 的心理活动或口头禅（如：哎呀别乱看、那是给你的惊喜等），20字以内。
      
      请严格返回以下 JSON 格式：
      {
        "apps": {
          "appId": { "items": [...], "muttering": "..." },
          "wechat": { "remark": "...", "muttering": "..." }
        }
      }
      不要包含 markdown 代码块。返回最简洁的 JSON。`

    try {
      const result = await generateReply([{ role: 'user', content: prompt }], char, null, { isSimpleTask: true })
      let content = fixCommonJsonErrors(result.content)
      const data = JSON.parse(content)

      if (data.apps) {
        Object.keys(data.apps).forEach(appId => {
          const appData = data.apps[appId]
          if (!char.phoneData.apps[appId]) char.phoneData.apps[appId] = {}
          const target = char.phoneData.apps[appId]

          if (appId === 'wechat' && appData.remark) target.remark = appData.remark

          // 通用字段合并
          if (appData.items) target.items = appData.items
          if (appData.posts) target.posts = appData.posts
          if (appData.orders) target.orders = appData.orders
          if (appData.photos) target.photos = appData.photos
          if (appData.history) target.history = appData.history

          // ！！核心：同步存入碎碎念！！
          if (appData.muttering) target.muttering = appData.muttering
        })
      }

      await chatStore.saveChats()
      return true
    } catch (e) {
      console.error('[PhoneInspection] Batch Generation Error:', e)
      return false
    }
  }

  function triggerToast(message, type = 'info') {
    chatStore.triggerToast(message, type)
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
    triggerToast
  }
})
