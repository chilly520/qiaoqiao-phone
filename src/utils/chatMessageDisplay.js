const OFFLINE_SCENE_RE = /^\s*\u3010([\s\S]+?)\u3011\s*$/
// \u52a8\u4f5c\uff1a\u652f\u6301 (\u5185\u5bb9) \u6216 \uff08\u5185\u5bb9\uff09\u683c\u5f0f\uff0c\u4e5f\u652f\u6301\u672a\u95ed\u5408\u7684\u62ec\u53f7\uff08\u5982\u5185\u5bb9\u8de8\u884c\uff09
const OFFLINE_ACTION_RE = /^\s*[\(\uFF08]([\s\S]+?)(?:[\)\uFF09]\s*)?$/
const OFFLINE_NARRATION_RE = /^(?:\|\||\u2016)([\s\S]*?)(?:\|\||\u2016)?$/
const OFFLINE_TAGGED_DIALOGUE_RE = /\u300c\s*([^:\uFF1A\u300d]{1,24})\s*[:\uFF1A]\s*([\s\S]+?)\s*\u300d/
const OFFLINE_QUOTED_DIALOGUE_RE = /^\s*(?:"(?:\\"|[\s\S])*?"|\u201c[\s\S]*?\u201d)\s*$/
const OFFLINE_SPEAKER_DIALOGUE_RE = /^([^:\uff1a\uFF1A\n\u2016\u2016\u201c"\u300c\s]{1,24})\s*[:\uff1a\uFF1A]\s*([\s\S]+?)$/

const INNER_VOICE_BLOCK_RE = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?VOICE|VOICE)\s*\]|$)/i
const CARD_BLOCK_RE = /\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi
const ONLINE_BLOCK_RE = /\[\s*ONLINE\s*\]([\s\S]*?)\[\/\s*ONLINE\s*\]/i
const OFFLINE_BLOCK_RE = /\[\s*OFFLINE\s*\]([\s\S]*?)\[\/\s*OFFLINE\s*\]/i

// TOKEN_GLOBAL_RE: \u7528\u6765\u4ece\u6574\u6bb5\u6587\u5b57\u4e2d\u63d0\u53d6\u7279\u6b8a\u533a\u5757\uff08\u65c1\u767d\u3001\u573a\u666f\u3001\u62ec\u53f7\u52a8\u4f5c\u3001\u5e26\u300c\u300d\u7684\u5bf9\u8bdd\uff09
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
      // ENHANCED CHECK: Support escaped quotes (AI tend to use them sometimes)
      const hasVoiceKey = INNER_VOICE_FIELDS.some(f => 
        candidate.includes(`"${f}"`) || candidate.includes(`'${f}'`) || candidate.includes(`\\"${f}\\"`)
      );
      if (hasVoiceKey) {
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
 * \u5c06\u5185\u5bb9\u6309 [ONLINE]/[OFFLINE] \u6807\u7b7e\u5206\u5757\uff0c\u5e76\u63d0\u53d6\u76ee\u6807\u6a21\u5f0f\u7684\u5185\u5bb9\u3002
 * \u652f\u6301\u5185\u8054\u6a21\u5f0f\u7ee7\u627f\uff1a\u5982\u679c\u4e00\u6bb5\u5185\u5bb9\u6ca1\u6709\u6807\u7b7e\u5305\u88f9\uff0c\u4e14\u524d\u9762\u7d27\u90bb\u4e00\u4e2a\u6807\u7b7e\u5757\uff0c\u5219\u6cbf\u7528\u524d\u9762\u7684\u683c\u5f0f\u3002
 */
export function getModePartitionedContent(content, targetMode) {
  const raw = ensureMessageString(content)
  if (!raw) return ''

  // \u6b63\u5219\u5339\u914d\u6240\u6709\u6a21\u5f0f\u5f00\u5173
  const tagRe = /\[(ONLINE|OFFLINE)\]|\[\/(ONLINE|OFFLINE)\]/gi
  let lastIndex = 0
  let currentMode = null // \u5c1a\u672a\u660e\u786e\u6a21\u5f0f
  let result = ''
  
  let match
  while ((match = tagRe.exec(raw)) !== null) {
     const tagIndex = match.index
     const fullTag = match[0]
     const tagName = match[1] || match[2]
     const isClosing = fullTag.startsWith('[/')

     // \u5904\u7406\u6807\u7b7e\u4e4b\u524d\u7684\u6587\u672c
     const prevBlock = raw.substring(lastIndex, tagIndex)
     if (prevBlock) {
        // \u5982\u679c\u5f53\u524d\u6709\u6a21\u5f0f\uff0c\u6216\u8005\u8be5\u6a21\u5f0f\u7b26\u5408\u76ee\u6807\uff0c\u5219\u7d2f\u52a0
        // \u5173\u952e\u903b\u8f91\uff1a\u6ca1\u6709\u6807\u7b7e\u7684\u6bb5\u843d\uff0c\u5982\u679c\u662f\u7d27\u8ddf\u5728\u67d0\u4e2a\u6a21\u5f0f\u540e\u9762\uff0c\u5219\u201c\u6cbf\u7528\u201d
        if (currentMode === targetMode) {
           result += prevBlock
        } else if (currentMode === null) {
           // \u5982\u679c\u662f\u5f00\u5934\u7684\u65e0\u6807\u7b7e\u6587\u5b57\uff0c\u770b\u5176\u5185\u5bb9\u6216\u9ed8\u8ba4\u6a21\u5f0f
           // \u8fd9\u91cc\u6211\u4eec\u6682\u4e0d\u8f7b\u6613\u5224\u5b9a\uff0c\u6216\u8005\u53ef\u4ee5\u6839\u636e hasOfflineTheaterContent \u5224\u5b9a
           const estimated = hasOfflineTheaterContent(prevBlock) ? 'OFFLINE' : 'ONLINE'
           if (estimated.toLowerCase() === targetMode.toLowerCase()) {
              result += prevBlock
           }
        }
     }

     // \u66f4\u65b0\u72b6\u6001
     if (isClosing) {
        // \u6807\u7b7e\u5173\u95ed\u540e\uff0c\u6a21\u5f0f\u6062\u590d\u4e3a null\uff08\u6216\u8005\u53ef\u4ee5\u8bbe\u8ba1\u4e3a\u7ee7\u7eed\u4fdd\u6301\uff0c\u76f4\u5230\u4e0b\u4e2a\u6807\u7b7e\uff09
        // \u7528\u6237\u7684\u8981\u6c42\u662f\u201c\u6cbf\u7528\u4e0a\u4e00\u6bb5\u201d\uff0c\u6240\u4ee5\u6211\u4eec\u9009\u62e9\u201c\u4fdd\u6301\u5f53\u524d\u72b6\u6001\u76f4\u5230\u9047\u5230\u53d8\u52a8\u201d\uff1f
        // \u8fd8\u662f\u7ef4\u6301 currentMode \u5e76\u5728\u6807\u7b7e\u5916\u4e5f\u91c7\u96c6\uff1f
        // \u6839\u636e\u201c\u6cbf\u7528\u201d\u539f\u5219\uff0c\u5f53\u6807\u7b7e\u5173\u95ed\u540e\uff0c\u5728\u9047\u5230\u4e0b\u4e00\u4e2a\u5f00\u59cb\u6807\u7b7e\u524d\uff0c\u6211\u4eec\u4f9d\u7136\u8ba4\u4e3a\u5904\u4e8e\u8be5\u6a21\u5f0f\u3002
        // \u6240\u4ee5\u6211\u4eec\u4e0d\u5728\u8fd9\u91cc\u91cd\u7f6e currentMode\u3002
     } else {
        currentMode = tagName.toUpperCase()
     }
     
     lastIndex = tagIndex + fullTag.length
  }

  // \u5904\u7406\u6700\u540e\u5269\u4f59\u7684\u5185\u5bb9
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
  
  // \u68c0\u67e5\u662f\u5426\u6709\u4efb\u4f55\u5305\u88f9\u6807\u7b7e
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

// \u89e3\u6790\u4e00\u884c\u4e2d\u7684\u6df7\u5408\u5185\u5bb9\uff08\u5982\uff1a\u52a8\u4f5c+\u5bf9\u8bdd\uff09
export function parseOfflineLine(line) {
  let value = ensureMessageString(line).trim()
  if (!value) return null
  
  // \u5148\u68c0\u67e5\u6574\u884c\u662f\u5426\u662f\u7279\u6b8a\u683c\u5f0f
  // 1. \u65c1\u767d
  let match = value.match(OFFLINE_NARRATION_RE)
  if (match) return { type: 'narration', content: (match[1] || match[2] || '').trim() }

  // 2. \u573a\u666f
  match = value.match(OFFLINE_SCENE_RE)
  if (match) return { type: 'scene', content: match[1].trim() }

  // 3. \u6574\u884c\u52a8\u4f5c
  match = value.match(OFFLINE_ACTION_RE)
  if (match) return { type: 'action', content: match[1].trim() }

  // 4. \u5e26\u300c\u6807\u7b7e\u300d\u7684\u5bf9\u8bdd
  match = value.match(OFFLINE_TAGGED_DIALOGUE_RE)
  if (match) {
    const content = match[2].trim().replace(/^[\s"\u201c'\u2018\u201c\u2018]+|[\s"\u201d'\u2019\u201d\u2019]+$/g, '')
    return { type: 'dialogue', speaker: match[1].trim(), content, speakerTagged: true }
  }

  // 4b. \u7eaf\u53cc\u5f15\u53f7\u5bf9\u8bdd
  match = value.match(OFFLINE_QUOTED_DIALOGUE_RE)
  if (match) {
    const content = value.trim().replace(/^[\s"\u201c'\u2018\u201c\u2018]+|[\s"\u201d'\u2019\u201d\u2019]+$/g, '')
    if (content) return { type: 'dialogue', content }
  }

  // 5. \u6807\u51c6\u5bf9\u8bdd\uff08\u5e26\u540d\u5b57\u524d\u7f00\uff09
  if (!value.startsWith('\u2016') && !value.startsWith('\u2016')) {
    match = value.match(OFFLINE_SPEAKER_DIALOGUE_RE)
    if (match) {
      const speaker = match[1].trim()
      const content = match[2].trim().replace(/^[""'']+|[""'']+$/g, '')
      
      // \u5224\u5b9a\u662f\u5426\u771f\u7684\u4e3a\u8bf4\u8bdd\u4eba
      const isUrl = /^(https?|ftp|file):\/\//i.test(value)
      const isClock = /\d$/.test(speaker) && /^\d+/.test(content)
      const hasNarrativeParticles = /[\u7684\u4e86\u662f\u5728]/.test(speaker)
      const isNumeric = /^\d+$/.test(speaker)

      if (!isUrl && !isClock && !hasNarrativeParticles && !isNumeric) {
        return { type: 'dialogue', speaker, content, speakerTagged: true }
      }
    }
  }

  // 6. \u5904\u7406\u6df7\u5408\u5185\u5bb9\uff08\u5982\uff1a\u52a8\u4f5c+\u5bf9\u8bdd\uff09
  // \u6309\u52a8\u4f5c\u62ec\u53f7\u5206\u5272
  const mixedParts = value.split(/([\uff08\(][^\uff09\)]*[\uff09\)])/g).filter(p => p.trim())
  if (mixedParts.length > 1) {
    // \u6709\u591a\u4e2a\u90e8\u5206\uff0c\u8fd4\u56de\u6570\u7ec4\u8ba9\u8c03\u7528\u8005\u5904\u7406
    return { type: 'mixed', parts: mixedParts }
  }

  // 7. \u7cfb\u7edf\u63d0\u793a
  if (value.startsWith('[\u7cfb\u7edf:') || value.startsWith('[\u901a\u77e5:') || value.startsWith('[SYSTEM:')) {
    const content = value.replace(/^\[(?:\u7cfb\u7edf|\u901a\u77e5|SYSTEM)[:\uff1a]?\s*/, '').replace(/\]$/, '').trim()
    return { type: 'system', content }
  }

  // 8. \u5982\u679c\u90fd\u4e0d\u5339\u914d\uff0c\u5c31\u4e0d\u8fd4\u56de\u4efb\u4f55\u7ebf\u4e0b\u7279\u5b9a\u7c7b\u578b\uff0c\u800c\u662f null\uff0c\u8fd9\u6837\u5b83\u4e0d\u4f1a\u88ab\u5355\u7eaf\u5730\u7b97\u4f5c\u5f3a\u7ebf\u4e0b\u5185\u5bb9
  return null
}

export function parseOfflineSegments(msg) {
  if (!msg) return []
  const role = (typeof msg === 'object') ? msg.role : null
  const type = (typeof msg === 'object') ? msg.type : null
  const text = getOfflineTextContent(msg)
  if (!text) return []

  // Handle system messages or special interactive types by returning them as system segments
  const systemTypes = ['system', 'payment', 'redpacket', 'transfer', 'gift', 'gift_claimed', 'family_card']
  if (role === 'system' || systemTypes.includes(type)) {
     return text.split('\n').filter(l => l.trim()).map(l => ({ type: 'system', content: l.trim() }))
  }

  // Core logic: structural split by narration markers || or ‖
  const parts = text.split(/(\u2016|\|\|)/g)
  const segments = []
  let inNarration = false

  for (let p of parts) {
    if (p === '\u2016' || p === '||') {
      inNarration = !inNarration
      continue
    }

    if (!p.trim()) continue

    if (inNarration) {
      // \u5904\u4e8e\u65c1\u767d\u5305\u88f9\u533a\u95f4\uff1a\u6240\u6709\u7269\u7406\u6bb5\u843d\u5747\u5f3a\u5236\u8bc6\u522b\u4e3a\u65c1\u767d\u5361\u7247
      // \u8fd9\u6837\u5185\u90e8\u5373\u4f7f\u5305\u542b 07:55 \u4e5f\u7edd\u4e0d\u4f1a\u88ab\u8bc6\u522b\u4e3a\u8bf4\u8bdd\u4eba
      p.split('\n').forEach(line => {
        const l = line.trim()
        if (l) segments.push({ type: 'narration', content: l })
      })
    } else {
      // \u5904\u4e8e\u666e\u901a\u533a\u95f4\uff1a\u6309\u884c\u6267\u884c\u6807\u51c6\u89e3\u6790\uff08\u573a\u666f\u3001\u52a8\u4f5c\u3001\u5bf9\u8bdd\uff09
      p.split('\n').forEach(line => {
        const l = line.trim()
        if (l) {
          const parsed = parseOfflineLine(l)
          if (parsed) {
            // \u5904\u7406\u6df7\u5408\u5185\u5bb9\uff08\u5982\uff1a\u52a8\u4f5c+\u5bf9\u8bdd\uff09
            if (parsed.type === 'mixed' && parsed.parts) {
              parsed.parts.forEach(part => {
                const partTrimmed = part.trim()
                if (!partTrimmed) return
                
                // \u68c0\u67e5\u8fd9\u90e8\u5206\u662f\u5426\u662f\u52a8\u4f5c
                const actionMatch = partTrimmed.match(/^\s*[\(\uFF08]([\s\S]*?)[\)\uFF09]\s*$/)
                if (actionMatch) {
                  segments.push({ type: 'action', content: actionMatch[1].trim() })
                } else {
                  // \u666e\u901a\u5bf9\u8bdd\u5185\u5bb9
                  const cleanContent = partTrimmed.replace(/^[""'']+|[""'']+$/g, '').trim()
                  if (cleanContent) {
                    segments.push({ type: 'dialogue', content: cleanContent })
                  }
                }
              })
            } else {
              segments.push(parsed)
            }
          } else {
            // FALLBACK: If a line doesn't match any theater pattern, keep it as a dialogue/system segment
            // This prevents plain text from being swallowed when it occurs between theater blocks
            if (msg?.role === 'system' || msg?.type === 'system') {
                segments.push({ type: 'system', content: l })
            } else {
                segments.push({ type: 'dialogue', content: l })
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
  
  // Quick explicit regex checks for robust identification without relying entirely on parser
  return OFFLINE_SCENE_RE.test(text) || 
         OFFLINE_ACTION_RE.test(text) || 
         OFFLINE_NARRATION_RE.test(text) || 
         OFFLINE_TAGGED_DIALOGUE_RE.test(text) || 
         OFFLINE_QUOTED_DIALOGUE_RE.test(text) ||
         OFFLINE_SPEAKER_DIALOGUE_RE.test(text) ||
         (text.includes('\uff08') && text.includes('\uff09')) || 
         (text.includes('(') && text.includes(')')) ||
         /^\s*(\|\||\u2016)/.test(text) ||
         parseOfflineSegments(text).length > 0
}

export function isOfflineTextMessage(msg) {
  if (!msg || msg.hidden) return false
  if (msg.role === 'system' || msg.type === 'system') return true
  if (msg.type && msg.type !== 'text') return false
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
  if (!msg || msg.hidden) return false
  
  const raw = ensureMessageString(msg.content)

  // 1. If explicitly tagged for offline exclusively, show it
  if (/\[\s*OFFLINE\s*\]/i.test(raw)) return true
  
  // 2. If explicitly tagged for online exclusively, hide it
  if (/\[\s*ONLINE\s*\]/i.test(raw) && !/\[\s*OFFLINE\s*\]/i.test(raw)) return false

  // 3. Obey explicit mode flag from data structure (Highest Priority)
  if (msg.mode === 'offline') return true
  if (msg.mode === 'online') return false

  // 4. For user messages, if mode not set, return false (online by default)
  if (msg.role === 'user') return false

  // 5. System messages: Show unless explicit mode says otherwise
  if (msg.role === 'system') {
    // Whitelist payment/gift notifications even if they might be tagged online
    if (/[\u9886\u53d6\u9000\u56de]|[\u8f6c\u8d26\u5df2\u6536\u6536]|[\u4ed8\u6b3e]|[\u793c\u7269]/.test(raw)) return true
    return true
  }

  // 6. Whitelist: Show interactive cards IF mode is undetermined
  const isSpecialCard =  msg.type === 'gift' || msg.type === 'tarot' || msg.type === 'dice' || 
                         msg.type === 'tarot_card' || msg.type === 'tarot_interpretation' ||
                         msg.type === 'html' || msg.type === 'redpacket' || msg.type === 'transfer' ||
                         msg.type === 'family_card' || msg.type === 'gift_claimed';
  if (isSpecialCard) return true;

  // 7. Check partitioned content
  const offlineBlock = getModePartitionedContent(raw, 'OFFLINE')
  if (offlineBlock) return offlineBlock.trim().length > 0

  return hasOfflineTheaterContent(raw)
}

export function shouldShowInOnlineMode(msg) {
  if (!msg || msg.hidden) return false
  
  const raw = ensureMessageString(msg.content)

  // 1. If explicitly tagged for online, show it
  if (/\[\s*ONLINE\s*\]/i.test(raw)) return true
  
  // 2. If explicitly tagged for offline exclusively, hide it
  if (/\[\s*OFFLINE\s*\]/i.test(raw) && !/\[\s*ONLINE\s*\]/i.test(raw)) return false

  // 3. Obey explicit mode flag (Highest Priority)
  if (msg.mode === 'online') return true
  if (msg.mode === 'offline') return false

  // 4. For user messages, default to true
  if (msg.role === 'user') return true

  // 5. System messages
  if (msg.role === 'system') return true
  
  // 6. Whitelist: Always show interactive cards IF mode is undetermined
  const isSpecialCard =  msg.type === 'gift' || msg.type === 'tarot' || msg.type === 'dice' || 
                         msg.type === 'tarot_card' || msg.type === 'tarot_interpretation' ||
                         msg.type === 'html' || msg.type === 'redpacket' || msg.type === 'transfer';
  if (isSpecialCard) return true;

  if (getModePartitionedContent(raw, 'ONLINE').length > 0) return true
  if (getModePartitionedContent(raw, 'OFFLINE').length > 0) return false

  return !hasOfflineTheaterContent(raw)
}

export function extractLatestOfflineScene(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index]
    const content = getOfflineTextContent(msg)
    // \u76f4\u63a5\u5728\u6587\u672c\u4e2d\u67e5\u627e\u6700\u65b0\u7684\u573a\u666f\u6807\u7b7e
    const sceneMatches = [...content.matchAll(/\u3010([\s\S]+?)\u3011/g)]
    if (sceneMatches.length > 0) {
      // \u53ea\u63d0\u53d6\u7b2c\u4e00\u4e2a\u3010\u3011\u4f5c\u4e3a\u5730\u70b9\uff0c\u907f\u514d HTML \u6807\u9898\u7b49\u540e\u7eed\u5185\u5bb9\u5e72\u6270
      const match = sceneMatches[0]
      const sceneContent = match[1].trim()
      // \u6392\u9664\u80cc\u666f\u56fe\u63cf\u8ff0\uff08\u4ee5"\u573a\u666f\uff1a"\u5f00\u5934\u7684\u662f\u751f\u56fe\u63cf\u8ff0\uff0c\u4e0d\u662f\u5730\u70b9\uff09
      if (!sceneContent.startsWith('\u573a\u666f\uff1a')) {
        return {
          raw: match[0],
          location: sceneContent
        }
      }
    }
  }
  return null
}

// \u5fc3\u58f0\u76f8\u5173\u7684\u5b57\u6bb5\u540d\uff08\u7528\u4e8e\u8bc6\u522b\u65e0\u6807\u7b7e\u7684JSON\uff09
const INNER_VOICE_FIELDS = [
  'status', '\u5fc3\u58f0', '\u7740\u88c5', 'thought', 'mood', 'emotion', 'feeling',
  '\u60f3\u6cd5', '\u5fc3\u60c5', '\u60c5\u7eea', '\u611f\u53d7', '\u601d\u8003', '\u5185\u5fc3', 'inner', '\u5fc3\u7406',
  'state', 'mind', 'mental', 'activity', 'behavior', '\u884c\u4e3a'
]

export function extractInnerVoiceData(content, msg) {
  const raw = ensureMessageString(content)
  let block = extractTaggedBlock(raw, 'INNER_VOICE') || extractTaggedBlock(raw, 'INNERVOICE')
  
  // \u5982\u679c\u4e25\u683c\u5339\u914d\u5931\u8d25\uff0c\u5c1d\u8bd5\u4f7f\u7528\u6b63\u5219\u5339\u914d\uff08\u652f\u6301\u672a\u6b63\u786e\u95ed\u5408\u7684\u6807\u7b7e\uff09
  if (!block) {
    const match = raw.match(INNER_VOICE_BLOCK_RE)
    if (match) {
      block = match[1].trim()
    }
  }
  
  if (!block) {
    const braceStarts = [];
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '{') braceStarts.push(i);
    }
    
    // Check from the back to find the most complete JSON block
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
            // Check for voice fields
            const hasVoiceField = INNER_VOICE_FIELDS.some(field => 
              candidate.includes(`"${field}"`) || candidate.includes(`'${field}'`) || candidate.includes(`\\"${field}\\"`)
            );
            // If it's a small JSON object, try to parse it anyway
            if (hasVoiceField || candidate.length < 600) {
                try {
                  JSON.parse(candidate);
                  block = candidate;
                  break;
                } catch (e) {
                  // Not valid JSON, keep looking
                }
            }
        }
    }
  }

  // If still no block, check for simple key-value pairs at the start or end
  if (!block) {
     const metaKeys = INNER_VOICE_FIELDS.join('|');
     const metaRegex = new RegExp(`(?:^|\\n)\\s*(?:${metaKeys})\\s*[:\uff1a]`, 'i');
     if (metaRegex.test(raw)) {
        // Find the range of meta lines
        const lines = raw.split('\n');
        const metaLines = lines.filter(l => new RegExp(`^\\s*(?:${metaKeys})\\s*[:\uff1a]`, 'i').test(l));
        if (metaLines.length > 0) block = metaLines.join('\n');
     }
  }

  if (!block) return null
  
  try {
    // \u5c1d\u8bd5\u89e3\u6790\u4e3a JSON
    const jsonStr = block.trim().replace(/^[^\{]*/, '').replace(/[^\}]*$/, '')
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr)
      return parsed
    }
  } catch (e) {
    // \u964d\u7ea7\uff1a\u6309\u884c\u89e3\u6790\u952e\u503c\u5bf9
    const data = {}
    block.split(/\n+/).forEach(line => {
      const kv = line.split(/[:\uff1a]/)
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
  // \u68c0\u67e5\u662f\u5426\u5339\u914d\u5fc3\u58f0\u6b63\u5219\uff08\u652f\u6301\u672a\u6b63\u786e\u95ed\u5408\u7684\u6807\u7b7e\uff09
  if (INNER_VOICE_BLOCK_RE.test(raw)) {
    return true
  }
  // \u68c0\u67e5\u662f\u5426\u5305\u542b\u5fc3\u58f0\u76f8\u5173\u5b57\u6bb5
  const hasVoiceField = INNER_VOICE_FIELDS.some(field => 
    new RegExp(`["'\\\\]+${field}["'\\\\]+\\s*[:\uff1a]`).test(raw)
  );
  if (hasVoiceField) return true;
  
  // \u68c0\u67e5\u662f\u5426\u6709\u5c0f\u7684JSON\u5bf9\u8c61\uff08\u53ef\u80fd\u662fAI\u5fd8\u5199\u6807\u7b7e\uff09
  // \u5339\u914d { ... } \u6a21\u5f0f\uff0c\u957f\u5ea6\u5c0f\u4e8e500\uff0c\u4e14\u80fd\u89e3\u6790\u4e3a\u6709\u6548JSON
  const smallJsonMatches = raw.match(/\{[\s\S]{10,500}\}/g);
  if (smallJsonMatches) {
    for (const match of smallJsonMatches) {
      try {
        const parsed = JSON.parse(match);
        // \u5982\u679c\u89e3\u6790\u6210\u529f\u4e14\u662f\u5bf9\u8c61\uff0c\u8ba4\u4e3a\u662f\u5fc3\u58f0\u6570\u636e
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return true;
        }
      } catch (e) {
        // \u4e0d\u662f\u6709\u6548JSON\uff0c\u7ee7\u7eed\u68c0\u67e5\u4e0b\u4e00\u4e2a
      }
    }
  }
  return false;
}
