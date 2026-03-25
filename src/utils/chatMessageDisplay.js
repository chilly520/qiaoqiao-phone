const OFFLINE_SCENE_RE = /^\s*\u3010([\s\S]+?)\u3011\s*$/
// 动作：支持 (内容) 或 （内容）格式，也支持未闭合的括号（如内容跨行）
const OFFLINE_ACTION_RE = /^\s*[\(\uFF08]([\s\S]+?)(?:[\)\uFF09]\s*)?$/
const OFFLINE_NARRATION_RE = /^(?:\|\||\u2016)([\s\S]*?)(?:\|\||\u2016)?$/
const OFFLINE_TAGGED_DIALOGUE_RE = /\u300c\s*([^:\uFF1A\u300d]{1,24})\s*[:\uFF1A]\s*([\s\S]+?)\s*\u300d/
const OFFLINE_QUOTED_DIALOGUE_RE = /"(?:\\"|[\s\S])*?"|\u201c[\s\S]*?\u201d/
const OFFLINE_SPEAKER_DIALOGUE_RE = /^([^:：\uFF1A\n‖\u2016“"「\s]{1,8})\s*[:：\uFF1A]\s*([\s\S]+?)$/

const INNER_VOICE_BLOCK_RE = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?VOICE|VOICE)\s*\]|$)/i
const CARD_BLOCK_RE = /\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi
const ONLINE_BLOCK_RE = /\[\s*ONLINE\s*\]([\s\S]*?)\[\/\s*ONLINE\s*\]/i
const OFFLINE_BLOCK_RE = /\[\s*OFFLINE\s*\]([\s\S]*?)\[\/\s*OFFLINE\s*\]/i

// TOKEN_GLOBAL_RE: 用来从整段文字中提取特殊区块（旁白、场景、括号动作、带「」的对话）
const TOKEN_GLOBAL_RE = /(\|\|[\s\S]*?\|\||\u2016[\s\S]*?\u2016|\u3010[\s\S]*?\u3011|[\(\uFF08][\s\S]*?[\)\uFF09]|\u300c[\s\S]*?\u300d)/g

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
  let cleaned = ensureMessageString(content)
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*?\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]/gi, '')
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*?\[\/\s*INNER[-_ ]?VOICE\s*\]/gi, '')
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*$/i, '')
    
  // Balanced brace matcher for raw JSON
  const braceStarts = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceStarts.push(i);
  }
  
  const blocksToRemove = [];
  for (let i = braceStarts.length - 1; i >= 0; i--) {
    const startIdx = braceStarts[i];
    let balance = 0, inStr = false, isEsc = false, endPos = -1;
    for (let j = startIdx; j < cleaned.length; j++) {
      const char = cleaned[j];
      if (isEsc) { isEsc = false; continue; }
      if (char === '\\') { isEsc = true; continue; }
      if (char === '"') { inStr = !inStr; continue; }
      if (!inStr) {
        if (char === '{') balance++;
        else if (char === '}') {
          balance--;
          if (balance === 0) { endPos = j; break; }
        }
      }
    }
    if (endPos !== -1) {
      const candidate = cleaned.substring(startIdx, endPos + 1);
      if (candidate.includes('"status"') || candidate.includes('"心声"') || candidate.includes('"着装"')) {
          blocksToRemove.push(candidate);
      }
    }
  }

  blocksToRemove.forEach(b => {
    cleaned = cleaned.replace(b, '').trim();
  });

  // Cleanup potentially empty mode tags
  cleaned = cleaned.replace(/\[(OFFLINE|ONLINE)\]\s*\[\/(OFFLINE|ONLINE)\]/gi, '').trim();

  return cleaned
}

export function stripCardBlocks(content) {
  return ensureMessageString(content)
    .replace(/\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi, '')
    .replace(/\[\s*CARD\s*\][\s\S]*$/gi, '')
}

export function stripModeWrapperTags(content) {
  return ensureMessageString(content).replace(/\[\s*ONLINE\s*\]|\[\/\s*ONLINE\s*\]|\[\s*OFFLINE\s*\]|\[\/\s*OFFLINE\s*\]/gi, '')
}

/**
 * 将内容按 [ONLINE]/[OFFLINE] 标签分块，并提取目标模式的内容。
 * 支持内联模式继承：如果一段内容没有标签包裹，且前面紧邻一个标签块，则沿用前面的格式。
 */
export function getModePartitionedContent(content, targetMode) {
  const raw = ensureMessageString(content)
  if (!raw) return ''

  // 正则匹配所有模式开关
  const tagRe = /\[(ONLINE|OFFLINE)\]|\[\/(ONLINE|OFFLINE)\]/gi
  let lastIndex = 0
  let currentMode = null // 尚未明确模式
  let result = ''
  
  let match
  while ((match = tagRe.exec(raw)) !== null) {
     const tagIndex = match.index
     const fullTag = match[0]
     const tagName = match[1] || match[2]
     const isClosing = fullTag.startsWith('[/')

     // 处理标签之前的文本
     const prevBlock = raw.substring(lastIndex, tagIndex)
     if (prevBlock) {
        // 如果当前有模式，或者该模式符合目标，则累加
        // 关键逻辑：没有标签的段落，如果是紧跟在某个模式后面，则“沿用”
        if (currentMode === targetMode) {
           result += prevBlock
        } else if (currentMode === null) {
           // 如果是开头的无标签文字，看其内容或默认模式
           // 这里我们暂不轻易判定，或者可以根据 hasOfflineTheaterContent 判定
           const estimated = hasOfflineTheaterContent(prevBlock) ? 'OFFLINE' : 'ONLINE'
           if (estimated.toLowerCase() === targetMode.toLowerCase()) {
              result += prevBlock
           }
        }
     }

     // 更新状态
     if (isClosing) {
        // 标签关闭后，模式恢复为 null（或者可以设计为继续保持，直到下个标签）
        // 用户的要求是“沿用上一段”，所以我们选择“保持当前状态直到遇到变动”？
        // 还是维持 currentMode 并在标签外也采集？
        // 根据“沿用”原则，当标签关闭后，在遇到下一个开始标签前，我们依然认为处于该模式。
        // 所以我们不在这里重置 currentMode。
     } else {
        currentMode = tagName.toUpperCase()
     }
     
     lastIndex = tagIndex + fullTag.length
  }

  // 处理最后剩余的内容
  const remaining = raw.substring(lastIndex)
  if (remaining) {
     if (currentMode === targetMode.toUpperCase()) {
        result += remaining
     } else if (currentMode === null) {
        const estimated = hasOfflineTheaterContent(remaining) ? 'OFFLINE' : 'ONLINE'
        if (estimated.toLowerCase() === targetMode.toLowerCase()) {
           result += remaining
        }
     }
  }

  return result.trim()
}

export function getOfflineRenderableContent(msg) {
  const content = typeof msg === 'string' ? msg : (msg?.content || '');
  const raw = ensureMessageString(content)
  
  // 检查是否有任何包裹标签
  if (!/\[(ONLINE|OFFLINE)\]/i.test(raw)) {
     if (msg?.mode === 'offline') return stripModeWrapperTags(raw).trim()
     if (msg?.mode === 'online') return ''
     return stripModeWrapperTags(raw).trim()
  }

  return getModePartitionedContent(raw, 'OFFLINE')
}

export function getOnlineRenderableContent(msg) {
  const content = typeof msg === 'string' ? msg : (msg?.content || '');
  const raw = ensureMessageString(content)

  if (!/\[(ONLINE|OFFLINE)\]/i.test(raw)) {
     if (msg?.mode === 'online') return stripModeWrapperTags(raw).trim()
     if (msg?.mode === 'offline') return ''
     return stripModeWrapperTags(raw).trim()
  }

  return getModePartitionedContent(raw, 'ONLINE')
}

export function getOfflineTextContent(msg) {
  return stripCardBlocks(stripInnerVoiceBlocks(getOfflineRenderableContent(msg))).trim()
}

export function getOnlineTextContent(msg) {
  return stripCardBlocks(stripInnerVoiceBlocks(getOnlineRenderableContent(msg))).trim()
}

// 解析一行中的混合内容（如：动作+对话）
export function parseOfflineLine(line) {
  let value = ensureMessageString(line).trim()
  if (!value) return null
  
  // 先检查整行是否是特殊格式
  // 1. 旁白
  let match = value.match(OFFLINE_NARRATION_RE)
  if (match) return { type: 'narration', content: (match[1] || match[2] || '').trim() }

  // 2. 场景
  match = value.match(OFFLINE_SCENE_RE)
  if (match) return { type: 'scene', content: match[1].trim() }

  // 3. 整行动作
  match = value.match(OFFLINE_ACTION_RE)
  if (match) return { type: 'action', content: match[1].trim() }

  // 4. 带「标签」的对话
  match = value.match(OFFLINE_TAGGED_DIALOGUE_RE)
  if (match) {
    const content = match[2].trim().replace(/^[""'']+|[""'']+$/g, '')
    return { type: 'dialogue', speaker: match[1].trim(), content, speakerTagged: true }
  }

  // 5. 标准对话（带名字前缀）
  if (!value.startsWith('‖') && !value.startsWith('\u2016')) {
    match = value.match(OFFLINE_SPEAKER_DIALOGUE_RE)
    if (match) {
      const speaker = match[1].trim()
      const content = match[2].trim().replace(/^[""'']+|[""'']+$/g, '')
      
      // 判定是否真的为说话人
      const isClock = /\d$/.test(speaker) && /^\d+/.test(content)
      const hasNarrativeParticles = /[的了是在]/.test(speaker)
      const isNumeric = /^\d+$/.test(speaker)

      if (!isClock && !hasNarrativeParticles && !isNumeric) {
        return { type: 'dialogue', speaker, content, speakerTagged: true }
      }
    }
  }

  // 6. 处理混合内容（如：动作+对话）
  // 按动作括号分割
  const mixedParts = value.split(/([（\(][^）\)]*[）\)])/g).filter(p => p.trim())
  if (mixedParts.length > 1) {
    // 有多个部分，返回数组让调用者处理
    return { type: 'mixed', parts: mixedParts }
  }

  // 7. 普通对话
  const cleanDialogue = value.replace(/^[""'']+|[""'']+$/g, '').trim()
  if (!cleanDialogue) return null

  return { type: 'dialogue', content: cleanDialogue }
}

export function parseOfflineSegments(msg) {
  if (!msg) return []
  const text = getOfflineTextContent(msg)
  if (!text) return []

  // 核心逻辑：按旁白标记进行结构化切分
  // 这能完美处理 A ‖ B ‖ C ‖ D ‖ E 这种复杂交替模式
  const parts = text.split(/(‖|\|\|)/g)
  const segments = []
  let inNarration = false

  for (let p of parts) {
    if (p === '‖' || p === '||') {
      inNarration = !inNarration
      continue
    }

    if (!p.trim()) continue

    if (inNarration) {
      // 处于旁白包裹区间：所有物理段落均强制识别为旁白卡片
      // 这样内部即使包含 07:55 也绝不会被识别为说话人
      p.split('\n').forEach(line => {
        const l = line.trim()
        if (l) segments.push({ type: 'narration', content: l })
      })
    } else {
      // 处于普通区间：按行执行标准解析（场景、动作、对话）
      p.split('\n').forEach(line => {
        const l = line.trim()
        if (l) {
          const parsed = parseOfflineLine(l)
          if (parsed) {
            // 处理混合内容（如：动作+对话）
            if (parsed.type === 'mixed' && parsed.parts) {
              parsed.parts.forEach(part => {
                const partTrimmed = part.trim()
                if (!partTrimmed) return
                
                // 检查这部分是否是动作
                const actionMatch = partTrimmed.match(/^\s*[\(\uFF08]([\s\S]*?)[\)\uFF09]\s*$/)
                if (actionMatch) {
                  segments.push({ type: 'action', content: actionMatch[1].trim() })
                } else {
                  // 普通对话内容
                  const cleanContent = partTrimmed.replace(/^[""'']+|[""'']+$/g, '').trim()
                  if (cleanContent) {
                    segments.push({ type: 'dialogue', content: cleanContent })
                  }
                }
              })
            } else {
              segments.push(parsed)
            }
          }
        }
      })
    }

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

export function shouldShowInOfflineMode(msg) {
  if (!msg || msg.hidden || msg.role === 'system') return false
  if (msg.mode === 'online') return false
  if (msg.mode === 'offline') return true
  if (msg.role === 'user') return false

  const raw = ensureMessageString(msg.content)
  const offlineBlock = getModePartitionedContent(raw, 'OFFLINE')
  if (offlineBlock) return offlineBlock.trim().length > 0

  return hasOfflineTheaterContent(raw)
}

export function shouldShowInOnlineMode(msg) {
  if (!msg || msg.hidden) return false
  if (msg.mode === 'offline') return false
  if (msg.mode === 'online') return true
  if (msg.role === 'system') return true

  const raw = ensureMessageString(msg.content)
  if (getModePartitionedContent(raw, 'ONLINE').length > 0) return true
  if (getModePartitionedContent(raw, 'OFFLINE').length > 0) return false

  return !hasOfflineTheaterContent(raw)
}

export function extractLatestOfflineScene(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index]
    const content = getOfflineTextContent(msg)
    // 直接在文本中查找最新的场景标签
    const sceneMatches = [...content.matchAll(/\u3010([\s\S]+?)\u3011/g)]
    if (sceneMatches.length > 0) {
      // 从后往前找，跳过背景图描述（以"场景："开头的）
      for (let i = sceneMatches.length - 1; i >= 0; i--) {
        const match = sceneMatches[i]
        const sceneContent = match[1].trim()
        // 排除背景图描述（以"场景："开头的是生图描述，不是地点）
        if (!sceneContent.startsWith('场景：')) {
          return {
            raw: match[0],
            location: sceneContent
          }
        }
      }
    }
  }
  return null
}

// 心声相关的字段名（用于识别无标签的JSON）
const INNER_VOICE_FIELDS = [
  'status', '心声', '着装', 'thought', 'mood', 'emotion', 'feeling',
  '想法', '心情', '情绪', '感受', '思考', '内心', 'inner', '心理',
  'state', 'mind', 'mental', 'activity', 'behavior', '行为'
]

export function extractInnerVoiceData(content, msg) {
  const raw = ensureMessageString(content)
  let block = extractTaggedBlock(raw, 'INNER_VOICE') || extractTaggedBlock(raw, 'INNERVOICE')
  
  // 如果严格匹配失败，尝试使用正则匹配（支持未正确闭合的标签）
  if (!block) {
    const match = raw.match(INNER_VOICE_BLOCK_RE)
    if (match) {
      block = match[1].trim()
    }
  }
  
  if (!block) {
    // Balanced brace matcher for raw JSON
    const braceStarts = [];
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '{') braceStarts.push(i);
    }
    for (let i = braceStarts.length - 1; i >= 0; i--) {
        const startIdx = braceStarts[i];
        let balance = 0, inStr = false, isEsc = false, endPos = -1;
        for (let j = startIdx; j < raw.length; j++) {
            const char = raw[j];
            if (isEsc) { isEsc = false; continue; }
            if (char === '\\') { isEsc = true; continue; }
            if (char === '"') { inStr = !inStr; continue; }
            if (!inStr) {
                if (char === '{') balance++;
                else if (char === '}') {
                    balance--;
                    if (balance === 0) { endPos = j; break; }
                }
            }
        }
        if (endPos !== -1) {
            const candidate = raw.substring(startIdx, endPos + 1);
            // 检查是否包含心声相关字段，或尝试解析为有效的短JSON对象（可能是AI忘写标签）
            const hasVoiceField = INNER_VOICE_FIELDS.some(field => 
              candidate.includes(`"${field}"`) || candidate.includes(`'${field}'`)
            );
            // 如果是较小的JSON对象（<500字符），即使没有已知字段也尝试解析
            // 这可能是AI用了新的字段名或忘写标签
            const isSmallObject = candidate.length < 500;
            if (hasVoiceField || isSmallObject) {
                // 额外验证：确保能解析为有效JSON
                try {
                  JSON.parse(candidate);
                  block = candidate;
                  break;
                } catch (e) {
                  // 不是有效JSON，跳过
                }
            }
        }
    }
  }

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
  const raw = ensureMessageString(content)
  if (extractTaggedBlock(raw, 'INNER_VOICE') !== null || extractTaggedBlock(raw, 'INNERVOICE') !== null) {
    return true
  }
  // 检查是否匹配心声正则（支持未正确闭合的标签）
  if (INNER_VOICE_BLOCK_RE.test(raw)) {
    return true
  }
  // 检查是否包含心声相关字段
  const hasVoiceField = INNER_VOICE_FIELDS.some(field => 
    new RegExp(`["']${field}["']\\s*[:：]`).test(raw)
  );
  if (hasVoiceField) return true;
  
  // 检查是否有小的JSON对象（可能是AI忘写标签）
  // 匹配 { ... } 模式，长度小于500，且能解析为有效JSON
  const smallJsonMatches = raw.match(/\{[\s\S]{10,500}\}/g);
  if (smallJsonMatches) {
    for (const match of smallJsonMatches) {
      try {
        const parsed = JSON.parse(match);
        // 如果解析成功且是对象，认为是心声数据
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return true;
        }
      } catch (e) {
        // 不是有效JSON，继续检查下一个
      }
    }
  }
  return false;
}
