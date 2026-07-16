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
    // AI 常见的无效转义序列（JSON只支持: \" \\ \/ \b \f \n \r \t \uXXXX）
    const validEscapes = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])

    for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i]

        if (escaped) {
            if (inString && !validEscapes.has(ch)) {
                // 字符串内的无效转义：去掉反斜杠，保留字符本身
                result += ch
            } else {
                result += ch
            }
            escaped = false
            continue
        }

        if (ch === '\\') {
            result += ch
            escaped = true
            continue
        }

        if (ch === '"' || ch === "'") {
            if (!inString) {
                inString = true
                stringStartChar = ch
                result += ch
            } else if (ch === stringStartChar) {
                inString = false
                result += ch
            } else {
                // v1.10.126: 字符串内的"另一种引号"是普通字符,直接输出。
                // 旧代码加 \\ 转义(如双引号串内的单引号变成 \'),
                // 但 \' 在 JSON 标准里是非法转义序列,JSON.parse 直接报错,
                // 导致任何含撇号的内容(如 "it's fine")都被破坏。
                result += ch
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

    // 二次修复：处理 content 值中的未转义中文引号（AI 常用 "" 包裹对话）
    // 注意:正则允许 content 内部包含 中文/英文/转义序列/换行/制表符,只要不出现未转义的 " 或 \
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
    // [BUG FIX] 原正则 `/[\[【][^\]]*?[\]】]/g` 会把 JSON 数组 `[{...}]` 整个删掉,
    // 导致标准 JSON 输入解析失败。改为状态机版本,只在 JSON 字符串外(且不在 JSON
    // 对象/数组结构内)删除看起来像元数据的方括号对(如 `[心情:好]`、`【备注】`)。
    const stripped = stripMetaBrackets(clean)
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
    while ((tMatch = typeRegexGlobal.exec(stripped)) !== null) {
        typePositions.push(tMatch.index)
    }

    while ((match = contentRegex.exec(stripped)) !== null && idx < 10) {
        const contentStart = match.index
        const isInInteraction = typePositions.some(tp => tp < contentStart && contentStart - tp < 300)
        if (isInInteraction) continue

        let foundAuthor = null
        const authorRegexLocal = new RegExp('"authorId"\\s*[:：]\\s*"', 'gi')
        authorRegexLocal.lastIndex = 0
        let aMatch
        while ((aMatch = authorRegexLocal.exec(stripped)) !== null) {
            if (aMatch.index < contentStart && aMatch.index > lastAuthorPos) {
                const afterQuote = stripped.substring(aMatch.index + aMatch[0].length)
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
        // [FIX] 终极兜底: 这里之前的逻辑是"凡是 content 字段就当 moment", 导致评论/回复被误判成新动态,
        // 同时 imagePrompts/interactions 全部丢失, 生图无效。
        // 修复: 用 brace-counting 跟踪 JSON 结构, 只在 newMoments 数组块内的 content 才算 moment;
        //       遇到 ecosystemUpdates 块或 interactions 块直接跳过。
        //       如果实在无法定位 newMoments 块, 返回 null 而不是制造错数据。
        try {
            const newMomentsStart = stripped.indexOf('"newMoments"')
            const ecosystemStart = stripped.indexOf('"ecosystemUpdates"')
            if (newMomentsStart !== -1) {
                // 找到 newMoments 数组的范围
                const arrStart = stripped.indexOf('[', newMomentsStart)
                let arrEnd = -1, depth = 0, inStr = false, esc = false
                for (let i = arrStart; i < stripped.length; i++) {
                    const ch = stripped[i]
                    if (esc) { esc = false; continue }
                    if (ch === '\\') { esc = true; continue }
                    if (ch === '"') { inStr = !inStr; continue }
                    if (inStr) continue
                    if (ch === '[') depth++
                    else if (ch === ']') { depth--; if (depth === 0) { arrEnd = i; break } }
                }
                if (arrEnd !== -1) {
                    const newMomentsBlock = stripped.substring(arrStart, arrEnd + 1)
                    // 在 newMoments 块内找每个 authorId + content 对
                    const itemRegex = /\{\s*"authorId"\s*:\s*"([^"]+)"[\s\S]*?"content"\s*:\s*"([^"]*)"[\s\S]*?(?:"imagePrompts"\s*:\s*\[([\s\S]*?)\])?/g
                    let m
                    while ((m = itemRegex.exec(newMomentsBlock)) !== null && idx < 5) {
                        const authorId = m[1]
                        const content = m[2].replace(/\\n/g, ' ').substring(0, 500)
                        if (content.length < 10) continue
                        const imagePromptsStr = m[3] || ''
                        const imagePrompts = imagePromptsStr
                            ? imagePromptsStr.match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) || []
                            : []
                        moments.push({
                            authorId,
                            content,
                            location: '',
                            images: [],
                            imagePrompts,
                            mentions: [],
                            interactions: []
                        })
                        idx++
                    }
                }
            }
        } catch (e) {
            console.warn('[reconstructMomentsJSON] structured fallback failed:', e.message)
        }

        if (moments.length === 0) {
            console.warn('[reconstructMomentsJSON] 无法可靠恢复,返回 null 避免制造错数据')
            return null
        }
    }

    if (moments.length === 0) return null
    return JSON.stringify({ newMoments: moments, ecosystemUpdates: [] })
}

/**
 * 删除 AI 输出中的"元数据方括号" (如 [心情:好] / 【备注】),
 * 但不破坏 JSON 结构内的 `[]` / `{}` / 字符串内的方括号。
 */
function stripMetaBrackets(text) {
    let out = ''
    let inStr = false
    let escaped = false
    // 用 brace 跟踪 JSON 结构深度 (遇到 `[{` 或 `}]` 我们视为在 JSON 内)
    let jsonDepth = 0
    // 当前是否在 [..] 方括号对中(可能是 JSON 数组也可能是元数据)
    let bracketContent = ''
    // 记录每个 [ 的"是否为元数据"判断: 看内部是否像 JSON (含 { , : " 等)
    let bracketStartIsJson = false
    let bracketStart = -1
    const brackets = [] // 栈,每个元素: { start, isJson }

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]

        if (escaped) {
            if (bracketStart !== -1) bracketContent += ch
            else out += ch
            escaped = false
            continue
        }

        // 字符串状态
        if (ch === '\\') {
            if (bracketStart !== -1) bracketContent += ch
            else out += ch
            escaped = true
            continue
        }

        if (ch === '"') {
            inStr = !inStr
            if (bracketStart !== -1) bracketContent += ch
            else out += ch
            continue
        }

        if (inStr) {
            if (bracketStart !== -1) bracketContent += ch
            else out += ch
            continue
        }

        // [ 或 【 - 开始一个方括号块
        if (ch === '[' || ch === '【') {
            if (bracketStart === -1) {
                bracketStart = i
                bracketContent = ''
                // 窥探下一个非空字符: 如果是 `{` 或 `"` 则是 JSON 数组
                let j = i + 1
                while (j < text.length && /\s/.test(text[j])) j++
                bracketStartIsJson = text[j] === '{' || text[j] === '"'
            } else {
                // 嵌套的方括号,继续累积内容
                bracketContent += ch
            }
            continue
        }

        // ] 或 】 - 结束方括号
        if (ch === ']' || ch === '】') {
            if (bracketStart !== -1) {
                // 结束当前方括号块
                if (!bracketStartIsJson) {
                    // 元数据,丢弃
                    // 不写入 out
                } else {
                    // JSON 数组,保留
                    out += text.substring(bracketStart, i + 1)
                }
                bracketStart = -1
                bracketContent = ''
                bracketStartIsJson = false
            } else {
                // 孤立的 ],保留
                out += ch
            }
            continue
        }

        // 普通字符
        if (bracketStart !== -1) {
            bracketContent += ch
        } else {
            out += ch
        }
    }

    // 如果字符串以未闭合的 [ 结尾,丢弃它
    return out
}

/**
 * v1.10.127: 从原始 AI 文本中提取并重建互动数据(like/comment/reply)
 * 专门用于 generateBatchInteractions 的兜底,返回扁平的互动数组。
 * 与 reconstructMomentsJSON 区分:后者重建的是动态结构,不能用于互动。
 * @returns {string|null} 序列化后的互动数组 JSON,失败时返回 null
 */
export function reconstructInteractionsJSON(rawText) {
    if (!rawText) return null
    const repaired = _repairJsonStrings(rawText)
    const clean = repaired.replace(/```json\s*/gi, '').replace(/```\s*/g, '')

    const interactions = []
    // 匹配每个包含 type 字段的对象块
    // 用 brace-counting 提取每个 {...} 对象
    let i = 0
    while (i < clean.length) {
        if (clean[i] !== '{') { i++; continue }
        // 提取一个完整的 {...} 对象
        let depth = 0, inStr = false, esc = false, end = -1
        for (let j = i; j < clean.length; j++) {
            const ch = clean[j]
            if (esc) { esc = false; continue }
            if (ch === '\\') { esc = true; continue }
            if (ch === '"') { inStr = !inStr; continue }
            if (inStr) continue
            if (ch === '{') depth++
            else if (ch === '}') { depth--; if (depth === 0) { end = j; break } }
        }
        if (end === -1) break
        const objStr = clean.substring(i, end + 1)
        // 只接受有 type 字段且值为 like/comment/reply 的对象
        const typeMatch = objStr.match(/"type"\s*[:：]\s*"(comment|reply|like)"/i)
        if (typeMatch) {
            try {
                const obj = JSON.parse(objStr)
                if (obj.type && ['like', 'comment', 'reply'].includes(String(obj.type).toLowerCase())) {
                    interactions.push(obj)
                }
            } catch (e) {
                // 单个对象 parse 失败,尝试用正则提取关键字段
                const authorName = objStr.match(/"authorName"\s*[:：]\s*"([^"]*)"/)?.[1] || ''
                const authorId = objStr.match(/"authorId"\s*[:：]\s*"([^"]*)"/)?.[1] || ''
                const content = objStr.match(/"content"\s*[:：]\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, ' ') || ''
                const replyTo = objStr.match(/"replyTo"\s*[:：]\s*"([^"]*)"/)?.[1] || null
                const isVirtual = /"isVirtual"\s*[:：]\s*true/i.test(objStr)
                const type = String(typeMatch[1]).toLowerCase()
                if (authorName || authorId) {
                    interactions.push({ type, authorName, authorId, content, replyTo, isVirtual })
                }
            }
        }
        i = end + 1
    }

    if (interactions.length === 0) return null
    return JSON.stringify(interactions)
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
