const OFFLINE_SCENE_RE = /^\s*\u3010([\s\S]{8,}?)\u3011\s*$/
// \u52a8\u4f5c\uff1a\u652f\u6301 (\u5185\u5bb9) \u6216 \uff08\u5185\u5bb9\uff09\u683c\u5f0f\uff0c\u4e5f\u652f\u6301\u672a\u95ed\u5408\u7684\u62ec\u53f7\uff08\u5982\u5185\u5bb9\u8de8\u884c\uff09
const OFFLINE_ACTION_RE = /^\s*[\(\uFF08]([\s\S]+?)(?:[\)\uFF09]\s*)?$/
const OFFLINE_NARRATION_RE = /^\s*(?:\|\||\u2016)([\s\S]+?)(?:\|\||\u2016)?\s*$/
const OFFLINE_TAGGED_DIALOGUE_RE = /\u300c\s*([^:\uFF1A\u300d\u3010\[]+)\s*[:\uFF1A]\s*([\s\S]+?)\s*\u300d/
const OFFLINE_QUOTED_DIALOGUE_RE = /^\s*(?:"(?:\\"|[\s\S])*?"|\u201c[\s\S]*?\u201d|\"[\s\S]*?\")\s*$/
const OFFLINE_SPEAKER_DIALOGUE_RE = /^([^:\uff1a\uFF1A\n\u2016\u2016\u201c"\u300c\u3010\[\s]{1,16})\s*[:\uff1a\uFF1A]\s*([\s\S]+?)$/

const INNER_VOICE_BLOCK_RE = /\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?VOICE|VOICE)\s*\]|$)/i
const CARD_BLOCK_RE = /\[\s*CARD\s*\][\s\S]*?\[\/\s*CARD\s*\]/gi
const ONLINE_BLOCK_RE = /\[\s*\/?\s*ONLINE\s*\]/gi
const OFFLINE_BLOCK_RE = /\[\s*\/?\s*OFFLINE\s*\]/gi

// Robust Tag Regex for partitioning: Matches [ONLINE], [/ONLINE], [OFFLINE], [/OFFLINE] with optional spaces
const MODE_TAG_RE = /\[\s*(\/?)\s*(ONLINE|OFFLINE)\s*\]/gi

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
    .replace(/\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]/gi, '') // Proactive closing tag cleanup
    .replace(/\[\s*INNER[-_ ]?VOICE\s*\]/gi, '')
    
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

  // Aggressively remove metadata lines that might have been leaked
  const metaLinesRegex = new RegExp(`^\\s*(?:${INNER_VOICE_FIELDS.join('|')})\\s*[:\uff1a][^\\n]*$`, 'gim')
  cleaned = cleaned.replace(metaLinesRegex, '').trim()

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
/**
 * Splits content by [ONLINE]/[OFFLINE] tags and extracts the target mode's content.
 * Supports mode persistence: text following a tag belongs to that mode until changed.
 */
export function getModePartitionedContent(content, targetMode) {
  const raw = ensureMessageString(content)
  if (!raw) return ''

  // Use the robust regex defined above
  const tagRe = /\[\s*(\/?)\s*(ONLINE|OFFLINE)\s*\]/gi
  let lastIndex = 0
  let currentMode = null 
  let result = ''
  
  let match
  while ((match = tagRe.exec(raw)) !== null) {
     const tagIndex = match.index
     const isClosing = match[1] === '/'
     const tagName = match[2].toUpperCase()

     // Content before this tag
     const prevBlock = raw.substring(lastIndex, tagIndex)
     if (prevBlock) {
        // Apply logic to the previous block
        if (currentMode === targetMode.toUpperCase()) {
           result += prevBlock
        } else if (currentMode === null) {
           // Heuristic for untagged initial text:
           // If target is ONLINE, we include it if it's NOT theater. 
           // If target is OFFLINE, we include it if it DOES have theater markers.
           const estimated = hasOfflineTheaterContent({ content: prevBlock }) ? 'OFFLINE' : 'ONLINE'
           if (estimated === targetMode.toUpperCase()) {
              result += prevBlock
           }
        }
     }

     // Update mode: Opening tags change mode. Closing tags reset to null? 
     // The user wants "沿用" (Inherit/Persist).
     // Decision: Opening tags SET mode. Closing tags CLEAR it to null.
     if (isClosing) {
        currentMode = null
     } else {
        currentMode = tagName
     }
     
     lastIndex = tagIndex + match[0].length
  }

  // Handle remaining tail text
  const remaining = raw.substring(lastIndex)
  if (remaining) {
     if (currentMode === targetMode.toUpperCase()) {
        result += remaining
     } else if (currentMode === null) {
        const estimated = hasOfflineTheaterContent({ content: remaining }) ? 'OFFLINE' : 'ONLINE'
        if (estimated === targetMode.toUpperCase()) {
           result += remaining
        }
     }
  }

  return result.trim()
}

export function getOfflineRenderableContent(msg) {
  const content = typeof msg === 'string' ? msg : (msg?.content || '');
  const raw = ensureMessageString(content)
  
  // Detection with robust tags
  if (/\[\s*OFFLINE\s*\]/i.test(raw)) return true
  if (/\[\s*ONLINE\s*\]/i.test(raw)) {
     // If it has BOTH, it's mixed, so we can't just return false.
     // But usually this function is used to decide if the WHOLE message is theater.
     // If it's mixed, we rely on partitioning.
     if (!/\[\s*OFFLINE\s*\]/i.test(raw)) return false 
  }

  const partitioned = getModePartitionedContent(raw, 'OFFLINE')
  if (partitioned) return partitioned

  const msgObj = typeof msg === 'string' ? { content: msg } : msg
  if (msgObj?.role === 'user' || !/\[\s*ONLINE\s*\]/i.test(raw)) return raw

  return partitioned
}

export function getOnlineRenderableContent(msg) {
  const content = typeof msg === 'string' ? msg : (msg?.content || '');
  const raw = ensureMessageString(content)

  if (/\[\s*ONLINE\s*\]/i.test(raw)) return true
  if (/\[\s*OFFLINE\s*\]/i.test(raw)) {
     if (!/\[\s*ONLINE\s*\]/i.test(raw)) return false
  }

  return getModePartitionedContent(raw, 'ONLINE')
}

export function getOfflineTextContent(msg) {
  return stripModeWrapperTags(stripCardBlocks(stripInnerVoiceBlocks(getOfflineRenderableContent(msg)))).trim()
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

  // 4b. \u7eaf\u53cc\u5f15\u53f7\u5bf9\u8bdd \u2014 \u4fdd\u7559\u539f\u59cb\u5f15\u53f7
  match = value.match(OFFLINE_QUOTED_DIALOGUE_RE)
  if (match) {
    const content = value.trim()
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
      // 处于旁白包裹区间：所有内容（包含换行）均作为一各旁白卡片
      // V15: 不再按 \n 切分旁白，而是以 || 为准
      const content = p.trim()
      if (content) segments.push({ type: 'narration', content })
    } else {
      // 处于普通区间：按行识别场景、动作、对话
      // 但不要因为空行而断开
      p.split('\n').forEach(line => {
        const l = line.trim()
        if (l) {
          // V16: If this line is ONLY punctuation and we have a previous segment that is narration or dialogue, 
          // merge it back instead of creating a new card.
          const isPunctuationOnly = /^[!?;.\u3002\uff01\uff1f\uff1b\u2026\u2014\u3001\uff0c,]+$/.test(l)
          if (isPunctuationOnly && segments.length > 0) {
            const last = segments[segments.length - 1]
            if (last.type === 'narration' || last.type === 'dialogue') {
               last.content += l
               return
            }
          }

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
          } else {
            // FALLBACK: If a line doesn't match any theater pattern, we decide between dialogue and narration
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

export function hasOfflineTheaterContent(msg) {
  if (!msg) return false
  
  // Explicit Mode Check
  if (msg.mode === 'offline') return true
  if (msg.mode === 'online') return false

  const raw = ensureMessageString(msg.content)

  // Detection with robust tags
  if (/\[\s*OFFLINE\s*\]/i.test(raw)) return true
  if (/\[\s*ONLINE\s*\]/i.test(raw)) {
     // If it has both, we check if there are theater markers in the offline portion
     // but for simplicity, we return false here as it's primarily a "should I use the theater renderer" check.
     if (!/\[\s*OFFLINE\s*\]/i.test(raw)) return false
  }

  // Detect theater markers
  // Important: We check the RAW text here to catch messages before they are processed/split
  return OFFLINE_SCENE_RE.test(raw) || 
         OFFLINE_NARRATION_RE.test(raw) || 
         OFFLINE_ACTION_RE.test(raw) ||
         OFFLINE_QUOTED_DIALOGUE_RE.test(raw) ||
         raw.includes('\u2016') || 
         raw.includes('||') ||
         msg.type === 'location'
}

export function isOfflineTextMessage(msg) {
  if (!msg) return false
  const type = msg.type || 'text'
  const role = msg.role || 'ai'

  // Explicit mode check - online messages should never be treated as offline
  if (msg.mode === 'online') return false
  if (msg.mode === 'offline') return true

  // These types are always rendered as theater/offline components if they have valid theater content
  const theaterTypes = ['text', 'location', 'scene', 'system']
  if (!theaterTypes.includes(type)) return false

  // User messages in offline are always bubbles? Or also theater?
  // User messages are typically bubbles unless they are part of a theater script
  if (role === 'user') return true

  const content = ensureMessageString(msg.content)
  // If it's a location message or has theater markers, it's theater
  if (type === 'location' || OFFLINE_SCENE_RE.test(content) || OFFLINE_NARRATION_RE.test(content) || OFFLINE_ACTION_RE.test(content) || OFFLINE_QUOTED_DIALOGUE_RE.test(content)) {
    return true
  }

  // Fallback: only treat as offline if has actual theater markers, NOT all text
  return false
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
  if (!msg) return false
  const raw = ensureMessageString(msg.content)

  // 1. Check for explicit tags
  if (/\[OFFLINE\]/i.test(raw)) return true
  if (/\[ONLINE\]/i.test(raw) && !/\[OFFLINE\]/i.test(raw)) return false

  // 2. Check for theater markers
  if (hasOfflineTheaterContent(msg)) return true

  // 3. Obey explicit mode flag
  if (msg.mode === 'offline') return true
  if (msg.mode === 'online') return false
  
  // Default: show in both if no indicators (or customize based on project preference)
  return true
}

export function shouldShowInOnlineMode(msg) {
  if (!msg) return false
  const raw = ensureMessageString(msg.content)

  // 1. Check for explicit tags (These are the ultimate authority)
  if (/\[\s*ONLINE\s*\]/i.test(raw)) return true
  if (/\[\s*OFFLINE\s*\]/i.test(raw) && !/\[\s*ONLINE\s*\]/i.test(raw)) return false

  // 2. Check for theater markers (These imply offline mode)
  if (hasOfflineTheaterContent(msg)) return false

  // 3. Obey explicit mode flag
  if (msg.mode === 'online') return true
  if (msg.mode === 'offline') return false

  const isSpecialCard =  msg.type === 'gift' || msg.type === 'tarot' || msg.type === 'dice' || 
                         msg.type === 'tarot_card' || msg.type === 'tarot_interpretation' ||
                         msg.type === 'html' || msg.type === 'redpacket' || msg.type === 'transfer';
  if (isSpecialCard) return true;

  if (getModePartitionedContent(raw, 'ONLINE').length > 0) return true
  if (getModePartitionedContent(raw, 'OFFLINE').length > 0) return false

  return !hasOfflineTheaterContent(msg)
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
  'status', '\u5fc3\u58f0', '\u7740\u88c5', 'thought', 'mood', 'emotion', 'feeling', 'spirit',
  '\u60f3\u6cd5', '\u5fc3\u60c5', '\u60c5\u7eea', '\u611f\u53d7', '\u601d\u8003', '\u5185\u5fc3', 'inner', '\u5fc3\u7406',
  'state', 'mind', 'mental', 'activity', 'behavior', '\u884c\u4e3a', 'heartRate', 'location', 'distance', 'stats',
  'outfit', 'scene', 'action', 'thoughts', 'date', 'time', 'emotion', 'label', 'value', 'heart'
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
      // Extract nested fields if they exist (stats -> heartRate, etc)
      const flattened = { ...parsed }
      if (parsed.stats) Object.assign(flattened, parsed.stats)
      if (parsed.emotion) Object.assign(flattened, parsed.emotion)
      return flattened
    }
  } catch (e) {
    // \u964d\u7ea7\uff1a\u6309\u884c\u89e3\u6790\u952e\u503c\u5bf9
    const data = {}
    // Support "spirit:xxx", "mood:yyy" or quoted JSON fragments
    block.split(/\n|,/).forEach(line => {
      const cleanLine = line.trim().replace(/^"|",?$/g, '')
      const kv = cleanLine.split(/[:\uff1a]/)
      if (kv.length >= 2) {
        const key = kv[0].trim().replace(/^["']|["']$/g, '')
        const val = kv.slice(1).join(':').trim().replace(/^["']|["']$/g, '')
        if (key && val) data[key] = val
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

/**
 * Common cleaning logic to strip all metadata, protocol tags, and structured debris from AI responses.
 * Used to get "human readable" text for chat bubbles.
 */
export function getUnifiedCleanContent(content, isHtml = false, role = 'ai') {
  let clean = ensureMessageString(content)
  if (!clean) return ''

  // 1. Strip Mode Tags [ONLINE]/[OFFLINE]
  clean = clean.replace(/\[\s*\/?\s*(?:ONLINE|OFFLINE)\s*\]/gi, '')

  // 2. Strip Metadata Blocks (JSON heartRate, stats, etc.)
  clean = clean.replace(/\[\s*INNER[-_ ]?VOICE\s*\][\s\S]*?(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|$)/gi, '')
  
  // 2b. Catch-all for isolated/dangling mode or protocol tags
  clean = clean.replace(/\[\s*\/?\s*(?:ONLINE|OFFLINE|INNER[-_ ]?VOICE|CARD|LS_JSON|JSON)\s*\]/gi, '')
  
  // 3. Strip common protocol tags
  const protocols = [
    'LIKE', 'COMMENT', 'REPLY', 'VOTE', 'CREATE_VOTE', 'RECALL', '撤回', 'NUDGE', '拍一拍', 
    'SET_PAT', 'UPDATE_BIO', 'BIO', '更换头像', 'SET_AVATAR', 'MOMENT', '朋友圈', 
    'SEARCH', 'ALMANAC', '定时', '在一起', '分手', '情侣空间', '摇骰子', '掷骰子', 
    'DICE', 'TAROT', '塔罗牌', '塔罗占卜', '塔罗解牌'
  ]
  const protocolRe = new RegExp(`\\[(?:${protocols.join('|')})[:：]\\s*[^\\]]+\\]`, 'gi')
  clean = clean.replace(protocolRe, '')
  
  clean = clean.replace(/\[TIMESTAMP:[^\]]+\]/gi, '')
  clean = clean.replace(/\[(?:红包|转账|发红包)[:：][^\]]+\]/gi, '')
  clean = clean.replace(/\[领取(?:红包|转账|亲属卡):[^\]]+\]/gi, '')
  clean = clean.replace(/\[(?:拒收|退回|拒绝)(?:红包|转账|亲属卡):[^\]]+\]/gi, '')
  clean = clean.replace(/\[\s*(?:FAMILY_CARD|亲属卡|申请亲属卡|拒绝亲属卡|赠送亲属卡)(?:_APPLY|_REJECT)?\s*[:：][^\]]*\]/gi, '')
  clean = clean.replace(/[\\[【]\s*LOVESPACE_(?:INVITE|CONTRACT|REJECT)[:：]?\s*[^\]】]*[\]】]/gi, '')
  clean = clean.replace(/[\\[【]\s*LS_JSON[:：]?\s*[\s\S]*?[\]】]/gi, '')
  clean = clean.replace(/\[一起听歌:[^\]]+\]|\[停止听歌\]|<bgm>[\s\S]*?<\/bgm>/gi, '')
  clean = clean.replace(/\[(?:MOMENT_SHARE|分享朋友圈)[:：][^\]]+\]/gi, '')
  
  // Strip 【系统提示】 prefix
  clean = clean.replace(/^[【\[]?\s*系统提示\s*[】\]]?\s*[:：]?\s*/gi, '')
  
  // 4. Strip CARD blocks
  clean = clean.replace(/\[CARD\][\s\S]*?(?:\[\/CARD\]|$)/gi, '')
  
  // 5. If AI, aggressively strip any JSON-like hanging braces/logic/CSS
  if (role !== 'user') {
      // Strip style blocks
      clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '')
      // Strip common containers if they start/end with tags
      clean = clean.replace(/<(html|div|section|article|style|svg)[\s\S]*?<\/\1>/gi, '') 
      clean = clean.replace(/<[^>]+>/g, '')
      
      // Strip naked JSON blocks containing specific keywords (e.g. status cards)
      const removeJsonWithKeywords = (str) => {
          let result = ''
          let i = 0
          while (i < str.length) {
              if (str[i] === '{') {
                  let depth = 0
                  let start = i
                  while (i < str.length) {
                      if (str[i] === '{') depth++
                      else if (str[i] === '}') depth--
                      i++
                      if (depth === 0) break
                  }
                  const block = str.substring(start, i)
                  if (/"(?:status|stats|heartRate|着装|环境|心声|行为|mind|outfit|scene|action|thoughts|mood|spirit)"/i.test(block)) {
                      // Skip
                  } else {
                      result += block
                  }
              } else {
                  result += str[i]
                  i++
              }
          }
          return result
      }
      clean = removeJsonWithKeywords(clean)
      
      // Remove loose lines like "spirit: calm"
      const looseMetaRegex = new RegExp(`^\\s*(?:${INNER_VOICE_FIELDS.join('|')})\\s*[:\uff1a][^\\n]*$`, 'gim')
      clean = clean.replace(looseMetaRegex, '').trim()

      // Final cosmetic cleanup
      clean = clean.replace(/[\u200b\uFEFF]/g, '') // Zero width spaces
      clean = clean.replace(/[\}\{"]+/g, (m) => m.trim().length === 0 ? '' : m) // Remove dangling JSON chars
  }

  return clean.trim()
}


export function looksLikeMojibake(str) {
  if (!str) return false
  // Check for common mojibake patterns (random special chars, no real characters if it's supposed to be meaningful text)
  const hasMeaningfulChar = /[\u4e00-\u9fa5a-zA-Z0-9]/.test(str)
  if (!hasMeaningfulChar && str.length > 0) return true
  
  // Also check for common corrupted JSON fragments
  if (str.includes('{') && (str.includes('\\"') || str.includes('":'))) {
    try {
      JSON.parse(str)
      return false // Valid JSON is not mojibake
    } catch (e) {
      return true // Broken JSON segments are garbage
    }
  }
  
  return false
}

export function getMessageThumbnail(msg) {
  return ensureMessageString(msg.content).substring(0, 30) + '...'
}

