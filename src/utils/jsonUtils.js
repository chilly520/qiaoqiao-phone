/**
 * AI 响应 JSON 解析与容错工具
 * 处理 AI 模型返回的不规范 JSON（未转义引号、换行、中文引号等）
 */

/**
 * 修复 JSON 字符串中不合法的引号、换行等字符
 * 仅在字符串值内部修复
 */
export function fixJsonStringValues(jsonStr) {
    let result = '', inStr = false, strChar = '', escaped = false
    for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i]
        if (escaped) { result += ch; escaped = false; continue }
        if (ch === '\\' && inStr) { result += ch; escaped = true; continue }
        if ((ch === '"' || ch === "'") && !escaped) {
            if (inStr && ch === strChar) { inStr = false }
            else if (!inStr) { inStr = true; strChar = ch }
            result += ch
            continue
        }
        if (inStr) {
            if (ch === '\n') result += '\\n'
            else if (ch === '\r') result += '\\r'
            else if (ch === '\t') result += '\\t'
            else if (ch === '"') result += '\\"'
            else if (ch === "'") result += "\\'"
            else result += ch
        } else {
            result += ch
        }
    }
    return result
}

/**
 * 智能修复 AI 输出的 JSON 字符串值中的常见语法错误
 * AI 模型常在 content/imagePrompts 等字段中输出未转义的引号、换行等，导致 JSON.parse 失败
 * 核心策略：逐字符遍历 JSON，仅在字符串值内部修复问题字符
 */
export function _repairJsonStrings(jsonStr) {
    let result = ''
    let inString = false
    let escaped = false
    let stringStartChar = ''

    for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i]

        if (escaped) {
            result += ch
            escaped = false
            continue
        }

        if (ch === '\\') {
            result += ch
            escaped = true
            continue
        }

        if (ch === '"') {
            if (!inString) {
                inString = true
                stringStartChar = ch
                result += ch
            } else if (ch === stringStartChar) {
                const nextChar = jsonStr[i + 1]
                if (/[\s,:}\]]/.test(nextChar) || nextChar === undefined) {
                    result += ch
                    inString = false
                } else {
                    result += '\\' + ch
                }
            } else {
                result += '\\' + ch
            }
            continue
        }

        if (inString) {
            if (ch === '\n') { result += '\\n'; continue }
            if (ch === '\r') { result += '\\r'; continue }
            if (ch === '\t') { result += '\\t'; continue }
        }

        result += ch
    }

    result = result.replace(/"content"\s*:\s*"((?:[^"\\]|\\.|\u201c|\u201d|\n|\r|\t)*)"/gi, (match, content) => {
        const fixed = content.replace(/\u201c/g, '\u300A').replace(/\u201d/g, '\u300B')
        return `"content": "${fixed}"`
    })

    return result
}

/**
 * 从原始 AI 文本中提取并重建朋友圈动态结构
 * @returns {string|null} 序列化后的 { newMoments, ecosystemUpdates }，失败时返回 null
 */
export function reconstructMomentsJSON(rawText) {
    if (!rawText) return null
    // 先做一次智能修复,确保 AI 常见的"内容中含未转义中文引号/换行"问题被处理
    const repaired = _repairJsonStrings(rawText)
    const clean = repaired.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
        .replace(/[\[【][^\]]*?[\]】]/g, '')
    const moments = []
    // 允许 content 内部出现中文/英文双引号、换行、制表符、转义序列(但不能是未转义的英文 " 或 \)
    const contentRegex = /"content"\s*[:：]\s*"((?:[^"\\]|\\.|\u201c|\u201d|\n|\r|\t)*)"/gi
    const authorRegex = /"authorId"\s*[:：]\s*"((?:[^"\\]|\\.)*)"/gi
    const typeRegex = /"type"\s*[:：]\s*"(comment|reply|like)"/gi

    let match, idx = 0
    let lastAuthorPos = -1
    const typePositions = []
    const typeRegexGlobal = new RegExp('"type"\\s*[:：]\\s*"(comment|reply|like)"', 'gi')
    let tMatch
    while ((tMatch = typeRegexGlobal.exec(clean)) !== null) {
        typePositions.push(tMatch.index)
    }

    while ((match = contentRegex.exec(clean)) !== null && idx < 10) {
        const contentStart = match.index
        const isInInteraction = typePositions.some(tp => tp < contentStart && contentStart - tp < 300)
        if (isInInteraction) continue

        let foundAuthor = null
        const authorRegexLocal = new RegExp('"authorId"\\s*[:：]\\s*"', 'gi')
        authorRegexLocal.lastIndex = 0
        let aMatch
        while ((aMatch = authorRegexLocal.exec(clean)) !== null) {
            if (aMatch.index < contentStart && aMatch.index > lastAuthorPos) {
                const afterQuote = clean.substring(aMatch.index + aMatch[0].length)
                const endQuote = afterQuote.indexOf('"')
                if (endQuote > 0) {
                    foundAuthor = afterQuote.substring(0, endQuote).trim()
                    lastAuthorPos = aMatch.index
                }
            }
        }

        const contentText = match[1].replace(/\\n/g, ' ').substring(0, 500)
        if (!foundAuthor || contentText.length < 10) continue

        moments.push({
            authorId: foundAuthor,
            content: contentText,
            location: '',
            images: [],
            mentions: [],
            interactions: []
        })
        idx++
    }

    if (moments.length === 0) {
        authorRegex.lastIndex = 0
        contentRegex.lastIndex = 0
        while ((match = contentRegex.exec(clean)) !== null && idx < 5) {
            moments.push({
                authorId: (authorRegex.exec(clean)?.[1] || 'unknown').trim(),
                content: match[1].replace(/\\n/g, ' ').substring(0, 500),
                location: '',
                images: [],
                mentions: [],
                interactions: []
            })
            idx++
        }
    }

    if (moments.length === 0) return null
    return JSON.stringify({ newMoments: moments, ecosystemUpdates: [] })
}

/**
 * 从内容中提取 INNER_VOICE 的 JSON 对象
 * 支持多种格式：
 * 1. [INNER_VOICE]{...}
 * 2. 嵌套的 [OFFLINE]...[INNER_VOICE]{...}[/OFFLINE]
 * 3. 转义的 JSON 字符串
 * 4. 直接的 JSON 对象 {...}
 */
export function extractInnerVoiceJson(content) {
    if (!content) return null

    // 尝试 1: [INNER_VOICE] 标签后跟随 JSON
    const innerVoiceMatch = content.match(/\[INNER_VOICE\]\s*/i)
    if (innerVoiceMatch) {
        const afterTag = content.substring(innerVoiceMatch[0].length)
        const jsonStart = afterTag.indexOf('{')
        if (jsonStart === -1) return null
        let depth = 0, inStr = false, escaped = false, jsonEnd = -1
        for (let i = jsonStart; i < afterTag.length; i++) {
            const ch = afterTag[i]
            if (escaped) { escaped = false; continue }
            if (ch === '\\') { escaped = true; continue }
            if (ch === '"') { inStr = !inStr; continue }
            if (!inStr) {
                if (ch === '{') depth++
                else if (ch === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break } }
            }
        }
        if (jsonEnd !== -1) return afterTag.substring(jsonStart, jsonEnd)
    }

    // 尝试 2: 转义的 JSON（AI 经常生成）
    const escapedJsonMatch = content.match(/"status"[\s\S]*?"distance"/i)
    if (escapedJsonMatch) {
        const jsonStart = content.lastIndexOf('{', escapedJsonMatch.index - 50)
        const jsonEnd = content.indexOf('}', escapedJsonMatch.index + 50)
        if (jsonStart !== -1 && jsonEnd !== -1) {
            let jsonStr = content.substring(jsonStart, jsonEnd + 1)
            jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
            return jsonStr
        }
    }

    // 尝试 3: 直接匹配 JSON 对象
    const directJsonMatch = content.match(/\{[^{}]*"(?:status|type|footprint|diary|commands)"[^{}]*\}/i)
    if (directJsonMatch) {
        return directJsonMatch[0]
    }

    return null
}
