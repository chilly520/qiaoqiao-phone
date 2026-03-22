const OFFLINE_SCENE_RE = /^\s*\u3010([^\u3011]+)\u3011\s*$/
const OFFLINE_ACTION_RE = /^\s*[\(\uFF08]([\s\S]+?)[\)\uFF09]\s*$/
const OFFLINE_NARRATION_RE = /^\s*(?:\|\|([\s\S]+?)\|\||\u2016([\s\S]+?)\u2016)\s*$/
const OFFLINE_TAGGED_DIALOGUE_RE = /^\s*\u300c\s*([^:\uFF1A\u300d]{1,24})\s*[:\uFF1A]\s*([\s\S]+?)\s*\u300d\s*$/
const OFFLINE_QUOTED_DIALOGUE_RE = /^\s*(?:\"([\s\S]+?)\"|\u201c([\s\S]+?)\u201d)\s*$/
const OFFLINE_SPEAKER_DIALOGUE_RE = /^\s*([^:\uFF1A\n]{1,24})\s*[:\uFF1A]\s*([\s\S]+?)\s*$/
const INNER_VOICE_BLOCK_RE = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?VOICE|VOICE)\s*\]|$)/i
// 匹配 [CARD]...[/CARD] 或 [CARD]...（到字符串末尾）
const CARD_BLOCK_RE = /\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi
const ONLINE_BLOCK_RE = /\[\s*ONLINE\s*\]([\s\S]*?)\[\/\s*ONLINE\s*\]/i
const OFFLINE_BLOCK_RE = /\[\s*OFFLINE\s*\]([\s\S]*?)\[\/\s*OFFLINE\s*\]/i
// TOKEN_LINE_RE: 用于分割一行中的多个标记
// 注意：不包含引号匹配，避免将带引号的对话分割开
const TOKEN_LINE_RE = /(\|\|[\s\S]+?\|\||\u2016[\s\S]+?\u2016|\u3010[^\u3011]+\u3011|[\(\uFF08][^()\uFF08\uFF09]+[\)\uFF09])/g

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
  // 匹配 [INNER_VOICE]...[/VOICE] 或 [INNER_VOICE]...[/INNER_VOICE]
  // 注意：使用非贪婪匹配，并确保正确匹配结束标签
  return ensureMessageString(content)
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*?\[\/\s*VOICE\s*\]/gi, '')
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*?\[\/\s*INNER[-_ ]?VOICE\s*\]/gi, '')
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*$/i, '') // 匹配没有结束标签的情况
}

export function stripCardBlocks(content) {
  // 先匹配有结束标签的 [CARD]...[/CARD]
  // 再匹配没有结束标签的 [CARD]...（到字符串末尾）
  return ensureMessageString(content)
    .replace(/\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi, '')
    .replace(/\[\s*CARD\s*\][\s\S]*$/gi, '')
}

export function stripModeWrapperTags(content) {
  return ensureMessageString(content).replace(/\[\s*ONLINE\s*\]|\[\/\s*ONLINE\s*\]|\[\s*OFFLINE\s*\]|\[\/\s*OFFLINE\s*\]/gi, '')
}

export function extractTaggedBlock(content, tag) {
  const source = ensureMessageString(content)
  const regex = tag.toUpperCase() === 'ONLINE' ? ONLINE_BLOCK_RE : OFFLINE_BLOCK_RE
  const match = source.match(regex)
  return match ? match[1].trim() : null
}

export function hasInnerVoice(content, msgData = null) {
  // 优先从消息数据参数中检查
  if (msgData && (msgData.innerVoice || msgData.mindData || msgData.inner_voice)) {
    return true
  }
  // 兼容旧版：从内容中检查标签
  return INNER_VOICE_BLOCK_RE.test(ensureMessageString(content))
}

export function extractInnerVoiceData(content, msgData = null) {
  const tryParse = (value) => {
    if (!value) return null
    if (typeof value === 'object') return value
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  // 优先从消息数据参数中提取
  if (msgData) {
    const voiceData = msgData.innerVoice || msgData.mindData || msgData.inner_voice
    if (voiceData) {
      const parsed = tryParse(voiceData)
      if (parsed) return parsed
    }
  }

  // 兼容旧版：从内容中解析标签
  const raw = ensureMessageString(content)
  const match = raw.match(INNER_VOICE_BLOCK_RE)
  if (!match) return null

  let payload = match[1].trim()
  payload = payload.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()

  let parsed = tryParse(payload)
  if (parsed) return parsed

  const firstBrace = payload.indexOf('{')
  const lastBrace = payload.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    parsed = tryParse(payload.slice(firstBrace, lastBrace + 1))
    if (parsed) return parsed
  }

  return null
}

export function getOfflineRenderableContent(content) {
  const raw = ensureMessageString(content)
  const offline = extractTaggedBlock(raw, 'OFFLINE')
  if (offline !== null) return offline
  if (extractTaggedBlock(raw, 'ONLINE') !== null) return ''
  return stripModeWrapperTags(raw).trim()
}

export function getOnlineRenderableContent(content) {
  const raw = ensureMessageString(content)
  const online = extractTaggedBlock(raw, 'ONLINE')
  if (online !== null) return online
  if (extractTaggedBlock(raw, 'OFFLINE') !== null) return ''
  return stripModeWrapperTags(raw).trim()
}

export function getOfflineTextContent(content) {
  return stripCardBlocks(stripInnerVoiceBlocks(getOfflineRenderableContent(content))).trim()
}

export function getOnlineTextContent(content) {
  return stripCardBlocks(stripInnerVoiceBlocks(getOnlineRenderableContent(content))).trim()
}

export function parseOfflineLine(line) {
  let value = ensureMessageString(line).trim()
  if (!value) return null
  
  // 清理内容中的引号
  value = value.replace(/^[""'']+|[""'']+$/g, '').trim()

  let match = value.match(OFFLINE_NARRATION_RE)
  if (match) return { type: 'narration', content: (match[1] || match[2] || '').trim() }

  match = value.match(OFFLINE_SCENE_RE)
  if (match) return { type: 'scene', content: match[1].trim() }

  match = value.match(OFFLINE_ACTION_RE)
  if (match) return { type: 'action', content: match[1].trim() }

  match = value.match(OFFLINE_TAGGED_DIALOGUE_RE)
  if (match) {
    // 清理对话内容中的引号
    const content = match[2].trim().replace(/^[""'']+|[""'']+$/g, '')
    return { type: 'dialogue', speaker: match[1].trim(), content, speakerTagged: true }
  }

  match = value.match(OFFLINE_QUOTED_DIALOGUE_RE)
  if (match) {
    const content = (match[1] || match[2] || '').trim().replace(/^[""'']+|[""'']+$/g, '')
    return { type: 'dialogue', content, quoted: true }
  }

  match = value.match(OFFLINE_SPEAKER_DIALOGUE_RE)
  if (match) {
    const content = match[2].trim().replace(/^[""'']+|[""'']+$/g, '')
    return { type: 'dialogue', speaker: match[1].trim(), content, speakerTagged: true }
  }

  return { type: 'dialogue', content: value }
}

export function splitOfflineLine(line) {
  const value = ensureMessageString(line).trim()
  if (!value) return []

  const parts = []
  let lastIndex = 0
  TOKEN_LINE_RE.lastIndex = 0

  for (const match of value.matchAll(TOKEN_LINE_RE)) {
    const index = match.index ?? 0
    const token = match[0]

    const before = value.slice(lastIndex, index).trim()
    if (before) parts.push(before)

    if (token.trim()) parts.push(token.trim())
    lastIndex = index + token.length
  }

  const after = value.slice(lastIndex).trim()
  if (after) parts.push(after)

  return parts.length ? parts : [value]
}

export function parseOfflineSegments(content) {
  const text = getOfflineTextContent(content)
  if (!text) return []

  const segments = []
  const lines = text.replace(/\r/g, '').split(/\n+/)
  
  // 智能合并：将连续的对话行合并成一个segment
  let dialogueBuffer = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // 使用 splitOfflineLine 分割当前行（处理一行中有多个标记的情况）
    const parts = splitOfflineLine(line)
    
    for (const part of parts) {
      // 尝试解析当前部分
      const parsed = parseOfflineLine(part)
      if (!parsed) continue
      
      // 如果是特殊类型（场景、旁白、动作），直接添加并清空对话缓冲
      if (parsed.type !== 'dialogue') {
        if (dialogueBuffer) {
          segments.push(dialogueBuffer)
          dialogueBuffer = null
        }
        segments.push(parsed)
        continue
      }
      
      // 处理对话类型
      // 如果当前行是带标签的对话（如 林深: xxx）
      if (parsed.speakerTagged) {
        // 如果有缓冲区，先保存
        if (dialogueBuffer) {
          segments.push(dialogueBuffer)
        }
        // 将当前带标签的对话放入缓冲区，等待可能的合并
        dialogueBuffer = parsed
        continue
      }
      
      // 如果当前行是纯对话内容（无标签）
      if (!parsed.speakerTagged) {
        // 如果有对话缓冲，合并内容
        if (dialogueBuffer) {
          // 检查是否应该合并到带标签的对话中
          const bufferContent = dialogueBuffer.content || ''
          const hasEndPunctuation = /[。！？；~\-…。]$/.test(bufferContent)
          
          // 更积极的合并策略：
          // - 如果缓冲区内容没有结束标点，合并
          // - 如果当前行很短（<20字），合并
          // - 如果缓冲区内容很短（<25字），合并
          const shouldMerge = !hasEndPunctuation 
            || parsed.content.length < 20 
            || bufferContent.length < 25
          
          if (shouldMerge) {
            // 合并到缓冲区
            dialogueBuffer.content = bufferContent + parsed.content
          } else {
            // 不合并，先保存缓冲区，再创建新的
            segments.push(dialogueBuffer)
            dialogueBuffer = parsed
          }
        } else {
          // 没有缓冲区，创建新的
          dialogueBuffer = parsed
        }
      }
    }
  }
  
  // 处理剩余的缓冲区
  if (dialogueBuffer) {
    segments.push(dialogueBuffer)
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
  // 特殊类型消息（红包、转账、贴纸、图片等）不是纯文本消息
  if (msg.type && msg.type !== 'text') return false
  // 系统消息使用 ChatMessageItem 显示
  if (msg.role === 'system') return false
  if (looksLikeHtmlCard(msg.content)) return false
  return getOfflineTextContent(msg.content).length > 0
}

export function shouldShowInOfflineMode(msg) {
  if (!msg || msg.hidden || msg.role === 'system') return false
  // 关键：明确标记为线上模式的消息不显示
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
  // 关键：明确标记为线下模式的消息不显示
  if (msg.mode === 'offline') return false
  // 明确标记为线上模式的消息显示
  if (msg.mode === 'online') return true
  if (msg.role === 'system') return true

  const raw = ensureMessageString(msg.content)
  if (extractTaggedBlock(raw, 'ONLINE') !== null) return true
  if (extractTaggedBlock(raw, 'OFFLINE') !== null) return false

  return !hasOfflineTheaterContent(raw)
}

export function extractLatestOfflineScene(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const segments = parseOfflineSegments(messages[index]?.content)
    const scene = [...segments].reverse().find((segment) => segment.type === 'scene')
    if (scene?.content) {
      return {
        raw: scene.content,
        // 这里直接用完整的内容，不根据·分割
        location: scene.content.trim()
      }
    }
  }

  return null
}
