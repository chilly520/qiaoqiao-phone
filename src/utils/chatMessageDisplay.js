const OFFLINE_SCENE_RE = /\u3010([\s\S]+?)\u3011/
const OFFLINE_ACTION_RE = /[\(\uFF08]([\s\S]+?)[\)\uFF09]/
const OFFLINE_NARRATION_RE = /\|\|([\s\S]+?)\|\||\u2016([\s\S]+?)\u2016/
const OFFLINE_TAGGED_DIALOGUE_RE = /\u300c\s*([^:\uFF1A\u300d]{1,24})\s*[:\uFF1A]\s*([\s\S]+?)\s*\u300d/
const OFFLINE_QUOTED_DIALOGUE_RE = /"(?:\\"|[\s\S])*?"|\u201c[\s\S]*?\u201d/
const OFFLINE_SPEAKER_DIALOGUE_RE = /^([^:\uFF1A\n]{1,24})\s*[:\uFF1A]\s*([\s\S]+?)$/

const INNER_VOICE_BLOCK_RE = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?VOICE|VOICE)\s*\]|$)/i
const CARD_BLOCK_RE = /\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi
const ONLINE_BLOCK_RE = /\[\s*ONLINE\s*\]([\s\S]*?)\[\/\s*ONLINE\s*\]/i
const OFFLINE_BLOCK_RE = /\[\s*OFFLINE\s*\]([\s\S]*?)\[\/\s*OFFLINE\s*\]/i

// TOKEN_GLOBAL_RE: 用来从整段文字中提取特殊区块（旁白、场景、括号动作、带「」的对话）
const TOKEN_GLOBAL_RE = /(\|\|[\s\S]+?\|\||\u2016[\s\S]+?\u2016|\u3010[\s\S]+?\u3011|[\(\uFF08][\s\S]+?[\)\uFF09]|\u300c[\s\S]+?\u300d)/g

export function looksLikeHtmlCard(content) {
  const text = ensureMessageString(content)
  if (!text) return false
  return (
    /\[\s*CARD\s*\]/i.test(text)
    || (/"type"\s*:\s*"html"/i.test(text) && /"html"\s*:/i.test(text))
    || (/\\"type\\"\s*:\s*\\"html\\"/i.test(text) && /\\"html\\"\s*:/i.test(text))
    || /<(div|section|article|table|ul|ol|p|h[1-6]|svg)\b/i.test(text)
  )
}

export function ensureMessageString(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') return part.text || part.content || ''
      return ''
    }).join('')
  }
  if (value && typeof value === 'object') return value.text || value.content || JSON.stringify(value)
  return String(value || '')
}

export function stripInnerVoiceBlocks(content) {
  return ensureMessageString(content)
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*?\[\/\s*VOICE\s*\]/gi, '')
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*?\[\/\s*INNER[-_ ]?VOICE\s*\]/gi, '')
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*$/i, '')
}

export function stripCardBlocks(content) {
  return ensureMessageString(content)
    .replace(/\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi, '')
    .replace(/\[\s*CARD\s*\][\s\S]*$/gi, '')
}

export function stripModeWrapperTags(content) {
  return ensureMessageString(content).replace(/\[\s*ONLINE\s*\]|\[\/\s*ONLINE\s*\]|\[\s*OFFLINE\s*\]|\[\/\s*OFFLINE\s*\]/gi, '')
}

export function getOfflineRenderableContent(msg) {
  const content = typeof msg === 'string' ? msg : (msg?.content || '');
  const raw = ensureMessageString(content)
  const offline = extractTaggedBlock(raw, 'OFFLINE')
  if (offline !== null) return offline
  const online = extractTaggedBlock(raw, 'ONLINE')
  if (online !== null) return ''
  
  if (msg?.mode === 'offline') return stripModeWrapperTags(raw).trim()
  if (msg?.mode === 'online') return ''

  return stripModeWrapperTags(raw).trim()
}

export function getOnlineRenderableContent(msg) {
  const content = typeof msg === 'string' ? msg : (msg?.content || '');
  const raw = ensureMessageString(content)
  const online = extractTaggedBlock(raw, 'ONLINE')
  if (online !== null) return online
  const offline = extractTaggedBlock(raw, 'OFFLINE')
  if (offline !== null) return ''
  
  if (msg?.mode === 'online') return stripModeWrapperTags(raw).trim()
  if (msg?.mode === 'offline') return ''

  return stripModeWrapperTags(raw).trim()
}

export function getOfflineTextContent(msg) {
  return stripCardBlocks(stripInnerVoiceBlocks(getOfflineRenderableContent(msg))).trim()
}

export function getOnlineTextContent(msg) {
  return stripCardBlocks(stripInnerVoiceBlocks(getOnlineRenderableContent(msg))).trim()
}

export function extractTaggedBlock(content, tag) {
  const raw = ensureMessageString(content)
  const startTag = `[${tag}]`
  const endTag = `[/${tag}]`
  const startIdx = raw.indexOf(startTag)
  if (startIdx === -1) return null
  const contentStart = startIdx + startTag.length
  const endIdx = raw.indexOf(endTag, contentStart)
  if (endIdx === -1) return raw.substring(contentStart)
  return raw.substring(contentStart, endIdx)
}

export function parseOfflineLine(line) {
  let value = ensureMessageString(line).trim()
  if (!value) return null
  
  // 1. 旁白
  let match = value.match(OFFLINE_NARRATION_RE)
  if (match) return { type: 'narration', content: (match[1] || match[2] || '').trim() }

  // 2. 场景
  match = value.match(OFFLINE_SCENE_RE)
  if (match) return { type: 'scene', content: match[1].trim() }

  // 3. 动作
  match = value.match(OFFLINE_ACTION_RE)
  if (match) return { type: 'action', content: match[1].trim() }

  // 4. 带「标签」的对话
  match = value.match(OFFLINE_TAGGED_DIALOGUE_RE)
  if (match) {
    const content = match[2].trim().replace(/^[""'']+|[""'']+$/g, '')
    return { type: 'dialogue', speaker: match[1].trim(), content, speakerTagged: true }
  }

  // 5. 标准对话（带名字前缀）
  match = value.match(OFFLINE_SPEAKER_DIALOGUE_RE)
  if (match) {
    const content = match[2].trim().replace(/^[""'']+|[""'']+$/g, '')
    return { type: 'dialogue', speaker: match[1].trim(), content, speakerTagged: true }
  }

  // 6. 普通对话
  const cleanDialogue = value.replace(/^[""'']+|[""'']+$/g, '').trim()
  if (!cleanDialogue || /^[‖\u2016|【】()（）]+$/.test(cleanDialogue)) return null

  return { type: 'dialogue', content: cleanDialogue }
}

export function parseOfflineSegments(msg) {
  if (!msg) return []
  const text = getOfflineTextContent(msg)
  if (!text) return []

  const segments = []
  let lastIndex = 0
  TOKEN_GLOBAL_RE.lastIndex = 0

  const matches = [...text.matchAll(TOKEN_GLOBAL_RE)]
  
  for (const match of matches) {
    const index = match.index
    const token = match[0]

    // 处理标记之前的内容
    const beforeText = text.slice(lastIndex, index).trim()
    if (beforeText) {
      beforeText.split(/\n+/).forEach(line => {
        if (line.trim()) {
          const parsed = parseOfflineLine(line.trim())
          if (parsed) segments.push(parsed)
        }
      })
    }

    // 处理标记内容
    const parsedToken = parseOfflineLine(token)
    if (parsedToken && parsedToken.content && parsedToken.content.trim()) {
       segments.push(parsedToken)
    }

    lastIndex = index + token.length
  }

  // 处理剩余内容
  const afterText = text.slice(lastIndex).trim()
  if (afterText) {
    afterText.split(/\n+/).forEach(line => {
      if (line.trim()) {
        const parsed = parseOfflineLine(line.trim())
        if (parsed) segments.push(parsed)
      }
    })
  }

  return segments
}

export function hasOfflineTheaterContent(content) {
  const text = getOfflineTextContent(content)
  if (!text) return false
  return parseOfflineSegments(text).length > 0
}

export function isOfflineTextMessage(msg) {
  if (!msg || msg.hidden) return false
  if (msg.type && msg.type !== 'text') return false
  if (msg.role === 'system') return false
  if (looksLikeHtmlCard(msg.content)) return false
  return getOfflineTextContent(msg.content).length > 0
}

export function shouldShowInOfflineMode(msg) {
  if (!msg || msg.hidden || msg.role === 'system') return false
  if (msg.mode === 'online') return false
  if (msg.mode === 'offline') return true
  if (msg.role === 'user') return false

  const raw = ensureMessageString(msg.content)
  const offlineBlock = extractTaggedBlock(raw, 'OFFLINE')
  if (offlineBlock !== null) return offlineBlock.trim().length > 0

  return hasOfflineTheaterContent(raw)
}

export function shouldShowInOnlineMode(msg) {
  if (!msg || msg.hidden) return false
  if (msg.mode === 'offline') return false
  if (msg.mode === 'online') return true
  if (msg.role === 'system') return true

  const raw = ensureMessageString(msg.content)
  if (extractTaggedBlock(raw, 'ONLINE') !== null) return true
  if (extractTaggedBlock(raw, 'OFFLINE') !== null) return false

  return !hasOfflineTheaterContent(raw)
}

export function extractLatestOfflineScene(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index]
    const content = getOfflineTextContent(msg)
    // 直接在文本中查找最新的场景标签
    const sceneMatches = [...content.matchAll(/\u3010([\s\S]+?)\u3011/g)]
    if (sceneMatches.length > 0) {
      const lastMatch = sceneMatches[sceneMatches.length - 1]
      return {
        raw: lastMatch[0],
        location: lastMatch[1].trim()
      }
    }
  }
  return null
}

export function extractInnerVoiceData(content, msg) {
  const raw = ensureMessageString(content)
  const block = extractTaggedBlock(raw, 'INNER_VOICE')
  if (!block) return null
  
  try {
    // 尝试解析为 JSON
    const jsonStr = block.trim().replace(/^[^\{]*/, '').replace(/[^\}]*$/, '')
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr)
      return parsed
    }
  } catch (e) {
    // 降级：按行解析键值对
    const data = {}
    block.split(/\n+/).forEach(line => {
      const kv = line.split(/[:：]/)
      if (kv.length >= 2) {
        data[kv[0].trim()] = kv.slice(1).join(':').trim()
      }
    })
    return Object.keys(data).length ? data : { content: block.trim() }
  }
  return { content: block.trim() }
}

export function hasInnerVoice(content) {
  return extractTaggedBlock(content, 'INNER_VOICE') !== null
}
