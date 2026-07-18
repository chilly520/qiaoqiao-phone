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
 * 深度移除JSON中的尾逗号 (trailing commas)
 * 使用状态机逐字符遍历，只在非字符串区域移除逗号后紧跟的 } 或 ]
 * 能处理任意深度的嵌套结构，比简单正则更可靠
 */
export function deepRemoveTrailingCommas(jsonStr) {
    let result = ''
    let inString = false
    let escaped = false
    let stringChar = ''
    let commaResultPos = -1
    let pendingComma = false

    for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i]

        if (escaped) {
            result += ch
            escaped = false
            if (pendingComma && !/\s/.test(ch)) {
                pendingComma = false
            }
            continue
        }

        if (ch === '\\' && inString) {
            result += ch
            escaped = true
            continue
        }

        if ((ch === '"' || ch === "'") && !escaped) {
            if (!inString) {
                inString = true
                stringChar = ch
            } else if (ch === stringChar) {
                inString = false
            }
            result += ch
            pendingComma = false
            continue
        }

        if (inString) {
            result += ch
            continue
        }

        // 不在字符串内
        if (ch === ',') {
            if (pendingComma) {
                // 之前已经有一个待处理的逗号了，说明那个逗号后面不是}或]，保留它
                pendingComma = false
            }
            pendingComma = true
            commaResultPos = result.length
            result += ch
            continue
        }

        if (ch === '}' || ch === ']') {
            if (pendingComma) {
                // 回溯移除逗号
                result = result.substring(0, commaResultPos)
                pendingComma = false
            }
            result += ch
            continue
        }

        if (!/\s/.test(ch)) {
            pendingComma = false
        }

        result += ch
    }

    return result
}

/**
 * 从原始 AI 文本中提取并重建朋友圈动态结构
 * 使用 brace-counting 状态机可靠地识别 JSON 结构，确保 interactions 内的
 * comment/like/reply 不会被误判为独立动态。
 * @returns {string|null} 序列化后的 { newMoments, ecosystemUpdates }，失败时返回 null
 */
export function reconstructMomentsJSON(rawText) {
    if (!rawText) return null
    // 先做一次智能修复,确保 AI 常见的"内容中含未转义中文引号/换行"问题被处理
    const repaired = _repairJsonStrings(rawText)
    let clean = repaired.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    clean = deepRemoveTrailingCommas(clean)

    const moments = []

    try {
        // 策略1: 优先寻找 "newMoments" 数组，用 brace-counting 精确定位
        const newMomentsKeyPos = findKeyPosition(clean, 'newMoments')
        if (newMomentsKeyPos !== -1) {
            const arrStart = clean.indexOf('[', newMomentsKeyPos)
            if (arrStart !== -1) {
                const arrRange = findMatchingBracket(clean, arrStart)
                if (arrRange) {
                    const [arrStartIdx, arrEndIdx] = arrRange
                    const newMomentsBlock = clean.substring(arrStartIdx + 1, arrEndIdx)
                    extractMomentsFromBlock(newMomentsBlock, moments)
                }
            }
        }

        // 策略2: 如果没找到newMoments，尝试找顶级数组（旧格式）
        if (moments.length === 0) {
            // 找到第一个顶级 [ 位置
            let firstTopLevelBracket = -1
            let braceDepth = 0, bracketDepth = 0, inStr = false, esc = false
            for (let i = 0; i < clean.length; i++) {
                const ch = clean[i]
                if (esc) { esc = false; continue }
                if (ch === '\\') { esc = true; continue }
                if (ch === '"') { inStr = !inStr; continue }
                if (inStr) continue
                if (ch === '{') braceDepth++
                else if (ch === '}') braceDepth--
                else if (ch === '[' && braceDepth === 0) {
                    firstTopLevelBracket = i
                    break
                }
            }
            if (firstTopLevelBracket !== -1) {
                const arrRange = findMatchingBracket(clean, firstTopLevelBracket)
                if (arrRange) {
                    const blockContent = clean.substring(arrRange[0] + 1, arrRange[1])
                    extractMomentsFromBlock(blockContent, moments)
                }
            }
        }
    } catch (e) {
        console.warn('[reconstructMomentsJSON] parse failed:', e.message)
    }

    if (moments.length === 0) {
        console.warn('[reconstructMomentsJSON] 无法可靠恢复,返回 null 避免制造错数据')
        return null
    }
    return JSON.stringify({ newMoments: moments, ecosystemUpdates: [] })
}

/**
 * 在文本中查找JSON key的位置（考虑字符串状态）
 * @returns {number} 返回key冒号后的位置（即value开始位置），-1表示没找到
 */
function findKeyPosition(text, key) {
    const keyStr = `"${key}"`
    let inStr = false, esc = false, strChar = ''

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (esc) { esc = false; continue }
        if (ch === '\\' && inStr) { esc = true; continue }
        if ((ch === '"' || ch === "'") && !esc) {
            if (!inStr) { inStr = true; strChar = ch }
            else if (ch === strChar) { inStr = false }
            continue
        }
        if (inStr) continue

        // 不在字符串中，检查是否匹配key
        if (text.substring(i, i + keyStr.length) === keyStr) {
            // 找到key，跳过空白和冒号
            let j = i + keyStr.length
            while (j < text.length && /\s/.test(text[j])) j++
            if (text[j] === ':') {
                j++
                while (j < text.length && /\s/.test(text[j])) j++
                return j
            }
        }
    }
    return -1
}

/**
 * 找到匹配的括号位置（[ 对应 ]，{ 对应 }），考虑字符串和转义
 * @returns {[number, number]|null} [start, end] 位置
 */
function findMatchingBracket(text, startPos) {
    const openCh = text[startPos]
    const closeCh = openCh === '[' ? ']' : openCh === '{' ? '}' : null
    if (!closeCh) return null

    let depth = 0, inStr = false, esc = false, strChar = ''
    for (let i = startPos; i < text.length; i++) {
        const ch = text[i]
        if (esc) { esc = false; continue }
        if (ch === '\\' && inStr) { esc = true; continue }
        if ((ch === '"' || ch === "'") && !esc) {
            if (!inStr) { inStr = true; strChar = ch }
            else if (ch === strChar) { inStr = false }
            continue
        }
        if (inStr) continue
        if (ch === openCh) depth++
        else if (ch === closeCh) {
            depth--
            if (depth === 0) return [startPos, i]
        }
    }
    return null
}

/**
 * 从一个数组块（不含外层[]）中提取moment对象
 * 关键：每个moment是一个顶级对象{}，在对象内部遇到"interactions"字段时
 * 跳过整个interactions数组，不解析里面的like/comment为独立moment
 */
function extractMomentsFromBlock(blockContent, momentsOut) {
    let i = 0
    let maxMoments = 10

    while (i < blockContent.length && momentsOut.length < maxMoments) {
        // 找下一个 { 开始一个对象
        while (i < blockContent.length && blockContent[i] !== '{') i++
        if (i >= blockContent.length) break

        const objRange = findMatchingBracket(blockContent, i)
        if (!objRange) break

        const [objStart, objEnd] = objRange
        const objText = blockContent.substring(objStart, objEnd + 1)

        // 检查这个对象是不是interaction（有type=like/comment/reply）
        // 但只有在对象内且不在嵌套对象内的type才是判断依据
        const topLevelType = getTopLevelStringField(objText, 'type')
        if (topLevelType === 'like' || topLevelType === 'comment' || topLevelType === 'reply') {
            // 这是一个互动对象，跳过，不当作moment
            i = objEnd + 1
            continue
        }

        // 提取moment的关键字段
        const authorId = getTopLevelStringField(objText, 'authorId')
        let content = getTopLevelStringField(objText, 'content')
        const location = getTopLevelStringField(objText, 'location') || ''

        // 提取imagePrompts（在顶级，不在interactions内）
        const imagePrompts = getTopLevelStringArrayField(objText, 'imagePrompts')

        // 提取interactions数组（如果存在，正确解析它）
        const interactions = extractInteractionsFromObject(objText)

        if (authorId && content && content.length >= 5) {
            content = content.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500)
            if (content.length >= 5) {
                momentsOut.push({
                    authorId,
                    content,
                    location,
                    images: [],
                    imagePrompts: imagePrompts || [],
                    mentions: getTopLevelStringArrayField(objText, 'mentions') || [],
                    interactions: interactions || []
                })
            }
        }

        i = objEnd + 1
    }
}

/**
 * 从对象文本中提取顶级字符串字段值（不进入嵌套对象/数组）
 * objText 应该以 { 开头
 */
function getTopLevelStringField(objText, fieldName) {
    let depth = 0, inStr = false, esc = false, strChar = ''
    let i = 0

    while (i < objText.length) {
        const ch = objText[i]
        if (esc) { esc = false; i++; continue }
        if (ch === '\\' && inStr) { esc = true; i++; continue }

        if ((ch === '"' || ch === "'") && !esc) {
            if (!inStr) { inStr = true; strChar = ch; i++; continue }
            else if (ch === strChar) { inStr = false; i++; continue }
        }

        if (inStr) { i++; continue }

        if (ch === '{' || ch === '[') depth++
        else if (ch === '}' || ch === ']') depth--
        else if (depth === 1) {
            // 在顶级对象内（depth=1因为刚进入外层{）
            const keyStr = `"${fieldName}"`
            if (objText.substring(i, i + keyStr.length) === keyStr) {
                // 找到key，解析: "value"
                let j = i + keyStr.length
                while (j < objText.length && /\s/.test(objText[j])) j++
                if (objText[j] === ':') {
                    j++
                    while (j < objText.length && /\s/.test(objText[j])) j++
                    if (objText[j] === '"') {
                        // 字符串值开始
                        const valueStart = j + 1
                        j++
                        let vEsc = false
                        while (j < objText.length) {
                            const vch = objText[j]
                            if (vEsc) { vEsc = false; j++; continue }
                            if (vch === '\\') { vEsc = true; j++; continue }
                            if (vch === '"') {
                                return objText.substring(valueStart, j)
                            }
                            j++
                        }
                    }
                }
            }
        }
        i++
    }
    return null
}

/**
 * 从对象文本中提取顶级字符串数组字段值（返回字符串数组）
 */
function getTopLevelStringArrayField(objText, fieldName) {
    let depth = 0, inStr = false, esc = false, strChar = ''
    let i = 0

    while (i < objText.length) {
        const ch = objText[i]
        if (esc) { esc = false; i++; continue }
        if (ch === '\\' && inStr) { esc = true; i++; continue }

        if ((ch === '"' || ch === "'") && !esc) {
            if (!inStr) { inStr = true; strChar = ch; i++; continue }
            else if (ch === strChar) { inStr = false; i++; continue }
        }

        if (inStr) { i++; continue }

        if (ch === '{' || ch === '[') depth++
        else if (ch === '}' || ch === ']') depth--
        else if (depth === 1) {
            const keyStr = `"${fieldName}"`
            if (objText.substring(i, i + keyStr.length) === keyStr) {
                let j = i + keyStr.length
                while (j < objText.length && /\s/.test(objText[j])) j++
                if (objText[j] === ':') {
                    j++
                    while (j < objText.length && /\s/.test(objText[j])) j++
                    if (objText[j] === '[') {
                        // 找到数组开始
                        const arrRange = findMatchingBracket(objText, j)
                        if (arrRange) {
                            const arrContent = objText.substring(arrRange[0] + 1, arrRange[1])
                            const results = []
                            // 简单提取所有字符串字面量
                            let ai = 0, aInStr = false, aEsc = false, aStrChar = ''
                            let strStart = -1
                            while (ai < arrContent.length) {
                                const ach = arrContent[ai]
                                if (aEsc) { aEsc = false; ai++; continue }
                                if (ach === '\\' && aInStr) { aEsc = true; ai++; continue }
                                if ((ach === '"' || ach === "'") && !aEsc) {
                                    if (!aInStr) { aInStr = true; aStrChar = ach; strStart = ai + 1; ai++; continue }
                                    else if (ach === aStrChar) {
                                        results.push(arrContent.substring(strStart, ai))
                                        aInStr = false; ai++; continue
                                    }
                                }
                                ai++
                            }
                            return results
                        }
                    }
                }
            }
        }
        i++
    }
    return null
}

/**
 * 从moment对象文本中提取interactions数组
 */
function extractInteractionsFromObject(objText) {
    let depth = 0, inStr = false, esc = false, strChar = ''
    let i = 0

    while (i < objText.length) {
        const ch = objText[i]
        if (esc) { esc = false; i++; continue }
        if (ch === '\\' && inStr) { esc = true; i++; continue }

        if ((ch === '"' || ch === "'") && !esc) {
            if (!inStr) { inStr = true; strChar = ch; i++; continue }
            else if (ch === strChar) { inStr = false; i++; continue }
        }

        if (inStr) { i++; continue }

        if (ch === '{' || ch === '[') depth++
        else if (ch === '}' || ch === ']') depth--
        else if (depth === 1) {
            const keyStr = `"interactions"`
            if (objText.substring(i, i + keyStr.length) === keyStr) {
                let j = i + keyStr.length
                while (j < objText.length && /\s/.test(objText[j])) j++
                if (objText[j] === ':') {
                    j++
                    while (j < objText.length && /\s/.test(objText[j])) j++
                    if (objText[j] === '[') {
                        const arrRange = findMatchingBracket(objText, j)
                        if (arrRange) {
                            return parseInteractionsArray(objText.substring(arrRange[0] + 1, arrRange[1]))
                        }
                    }
                }
            }
        }
        i++
    }
    return []
}

/**
 * 解析interactions数组内容（不含外层[]）
 */
function parseInteractionsArray(arrContent) {
    const interactions = []
    let j = 0
    while (j < arrContent.length) {
        while (j < arrContent.length && arrContent[j] !== '{') j++
        if (j >= arrContent.length) break
        const itemRange = findMatchingBracket(arrContent, j)
        if (!itemRange) break
        const itemText = arrContent.substring(itemRange[0], itemRange[1] + 1)

        const type = getTopLevelStringField(itemText, 'type')
        if (type === 'like' || type === 'comment' || type === 'reply') {
            const interaction = {
                type: type,
                authorId: getTopLevelStringField(itemText, 'authorId') || '',
                authorName: getTopLevelStringField(itemText, 'authorName') || '',
                isVirtual: getTopLevelStringField(itemText, 'isVirtual') === 'true'
            }
            if (type === 'comment' || type === 'reply') {
                interaction.content = getTopLevelStringField(itemText, 'content') || ''
                const replyTo = getTopLevelStringField(itemText, 'replyTo')
                if (replyTo) interaction.replyTo = replyTo
            }
            if (interaction.authorId) {
                interactions.push(interaction)
            }
        }
        j = itemRange[1] + 1
    }
    return interactions
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
