const RECALL_TRIGGERS = /具体说了|哪句话|原话|原文|确切|到底是什么|到底说|一字不差|原原本本|几天前|上次|那天|之前.*聊|那时候|提到过|说过.*什么|关于.*的|原句是什么/

const TIME_PATTERNS = {
  '今天': 0,
  '昨天': 1,
  '前天': 2,
  '三天前': 3,
  '几天前': 3,
  '一周前': 7,
  '上周': 7,
  '半个月': 15,
  '一个月': 30,
  '很久': 90
}

function parseTimeRange(text) {
  for (const [keyword, days] of Object.entries(TIME_PATTERNS)) {
    if (text.includes(keyword)) return { from: Date.now() - days * 86400000, to: Date.now() }
  }
  if (/(\d+)天前/.test(text)) {
    const d = parseInt(RegExp.$1) || 3
    return { from: Date.now() - d * 86400000, to: Date.now() }
  }
  return null
}

function extractKeywords(text) {
  const cleaned = text
    .replace(/具体说了|哪句话|原话|原文|确切|到底是什么|到底说|一字不差|原原本本/g, '')
    .replace(/几天前|上次|那天|之前聊|那时候|提到过|说过什么|关于.*的|原句是什么/g, '')
    .replace(/[？?！!，。、,.\s]+/g, ' ').trim()
  return cleaned.split(/\s+/).filter(w => w.length >= 2).slice(0, 5)
}

export function initMemoryLog(char) {
  if (!char.memoryLog) char.memoryLog = []
  if (!char.memoryFacts) char.memoryFacts = {}
  return char
}

export function appendLog(charId, entry, providedChar = null) {
  const chatStore = !providedChar ? useChatStoreSync() : null
  const char = providedChar || chatStore?.chats?.[charId]
  if (!char) return
  initMemoryLog(char)
  const logEntry = typeof entry === 'string'
    ? `[${formatTime(new Date())}] ${entry}`
    : `[${entry.type || '📝'}${entry.time ? ' ' + formatTime(new Date(entry.time)) : ''}] ${entry.content}`
  char.memoryLog.push(logEntry)
  if (char.memoryLog.length > 2000) char.memoryLog = char.memoryLog.slice(-1500)
}

export async function recallOriginalMessages(charId, userMessage) {
  const chatStore = awaitImportChatStore()
  const char = chatStore?.chats?.[charId]
  if (!char || !RECALL_TRIGGERS.test(userMessage)) return null

  const msgs = char.msgs || []
  if (msgs.length === 0) return null

  const keywords = extractKeywords(userMessage)
  const timeRange = parseTimeRange(userMessage)
  let candidates = msgs.filter(m => m.type !== 'system' && m.type !== 'favorite_card' && m.content)

  if (timeRange) {
    candidates = candidates.filter(m => (m.timestamp || m.createdAt || 0) >= timeRange.from)
  }

  if (keywords.length > 0) {
    const lowerKeywords = keywords.map(k => k.toLowerCase())
    candidates = candidates.filter(m => {
      const content = (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).toLowerCase()
      return lowerKeywords.some(k => content.includes(k))
    })
  }

  if (candidates.length === 0) return null

  const results = candidates.slice(-5).map(m => {
    const ts = m.timestamp || m.createdAt || 0
    const timeStr = ts ? new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    const speaker = m.role === 'user' ? (char?.userName || '你') : (m.role === 'ai' ? char?.name || 'TA' : '系统')
    return `  [${timeStr}] ${speaker}: ${content.substring(0, 150)}${content.length > 150 ? '...' : ''}`
  })

  return `\n\n[🔍 系统检索到相关记忆]\n${results.join('\n')}`
}

export function searchMemoryLog(charId, options = {}) {
  const chatStore = useChatStoreSync()
  const char = chatStore?.chats?.[charId]
  if (!char || !char.memoryLog?.length) return []

  let logs = [...char.memoryLog]

  if (options.keyword) {
    const kw = String(options.keyword).toLowerCase()
    logs = logs.filter(l => l.toLowerCase().includes(kw))
  }

  if (options.source) {
    const src = String(options.source).toLowerCase()
    logs = logs.filter(l => l.toLowerCase().includes(`[${src}`) || l.toLowerCase().includes(src))
  }

  if (options.since) {
    const since = options.since instanceof Date ? options.since.getTime() : options.since
    logs = logs.filter(l => {
      const match = l.match(/\[(\d{4}-\d{2}-\d{2})/)
      return match && new Date(match[1]).getTime() >= since
    })
  }

  const limit = options.limit || 8
  return logs.slice(-limit)
}

export function getMemorySummary(charId, maxLines = 10) {
  const chatStore = useChatStoreSync()
  const char = chatStore?.chats?.[charId]
  if (!char) return ''
  const logs = char.memoryLog || []
  if (logs.length === 0) return ''
  const recent = logs.slice(-maxLines)
  let facts = ''
  if (char.memoryFacts && Object.keys(char.memoryFacts).length > 0) {
    facts = '\n' + Object.entries(char.memoryFacts).map(([k, v]) => `  👤 ${k}: ${v}`).join('\n')
  }
  return `----- 【角色记忆日志】-----\n${recent.join('\n')}${facts}`
}

export function setFact(charId, key, value) {
  const chatStore = useChatStoreSync()
  const char = chatStore?.chats?.[charId]
  if (!char) return
  if (!char.memoryFacts) char.memoryFacts = {}
  char.memoryFacts[key] = String(value)
}

export function getFacts(charId) {
  const chatStore = useChatStoreSync()
  const char = chatStore?.chats?.[charId]
  return char?.memoryFacts || {}
}

export function rebuildMemoryLog(charId) {
  const chatStore = useChatStoreSync()
  const char = chatStore?.chats?.[charId]
  if (!char || !char.msgs?.length) return []
  
  initMemoryLog(char)
  char.memoryLog = [] // Reset
  
  // Extract meaningful content from chat messages
  char.msgs.forEach(m => {
    if (m.role !== 'ai' || !m.content) return
    
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    
    // Skip system messages, placeholders, and very short content
    if (content.length < 5 || content.startsWith('__CARD') || m.type === 'system' || m.type === 'favorite_card') return
    
    // Extract theater/scene content (‖...‖ blocks) — these are the most meaningful
    const theaterMatches = content.match(/‖([\s\S]{10,200}?)‖/g)
    if (theaterMatches) {
      theaterMatches.forEach(t => {
        appendLog(charId, { type: '🎬', content: t.replace(/‖/g, '').trim().substring(0, 150), time: m.timestamp })
      })
      return
    }
    
    // Extract dialogue in parentheses (角色对话/独白)
    const dialogueMatches = content.match(/（([\s\S]{15,250}?）)/g)
    if (dialogueMatches) {
      dialogueMatches.forEach(d => {
        appendLog(charId, { type: '💬', content: d.replace(/[（）]/g, '').trim().substring(0, 150), time: m.timestamp })
      })
      return
    }
    
    // Extract 【location】blocks
    const locMatch = content.match(/【([^】]+)】/)
    if (locMatch && locMatch[1].length > 4) {
      appendLog(charId, { type: '📍', content: locMatch[1].substring(0, 80), time: m.timestamp })
      return
    }
    
    // Fallback: take meaningful text (skip short responses)
    const cleanContent = content
      .replace(/\[(ONLINE|OFFLINE|INNER_VOICE|\/INNER_VOICE|表情包|图片)\][\s]*/gi, '')
      .replace(/__CARD_PLACEHOLDER_\d+__/gi, '[卡片]')
      .trim()
    if (cleanContent.length > 20) {
      appendLog(charId, { type: '📝', content: cleanContent.substring(0, 120), time: m.timestamp })
    }
  })
  
  if (char.memoryLog.length > 2000) char.memoryLog = char.memoryLog.slice(-1500)
  console.log(`[MemoryLog] Rebuilt ${char.memoryLog.length} entries for character ${charId}`)
  return char.memoryLog.slice(-8)
}

function formatTime(d) {
  if (!(d instanceof Date)) return ''
  return `${d.getMonth()+1}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

let _chatStore = null
function useChatStoreSync() {
  if (!_chatStore) {
    try { const { useChatStore } = require('../stores/chatStore'); _chatStore = useChatStore() } catch(e) { try { _chatStore = window.__pinia?._s.get('chat') } catch(e2) {} }
  }
  return _chatStore
}
async function awaitImportChatStore() {
  if (_chatStore) return _chatStore
  try { const mod = await import('../stores/chatStore'); _chatStore = mod.useChatStore(); return _chatStore } catch(e) { return null }
}