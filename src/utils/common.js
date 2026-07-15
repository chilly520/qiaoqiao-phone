/**
 * 公共数据处理工具
 * 统一项目中重复定义的小工具函数
 */

/**
 * 将任意类型的值安全转换为字符串
 * 处理字符串、字符串数组、对象（含 text/content 字段）等情况
 *
 * @param {*} val - 输入值
 * @returns {string} 转换后的字符串
 */
export function ensureString(val) {
    if (val == null) return ''
    if (typeof val === 'string') return val
    if (Array.isArray(val)) {
        return val.map(part => {
            if (typeof part === 'string') return part
            if (part && typeof part === 'object') {
                return part.text || part.content || ''
            }
            return ''
        }).join('')
    }
    if (val && typeof val === 'object') {
        if (val.text) return String(val.text)
        if (val.content) return String(val.content)
        try {
            return JSON.stringify(val)
        } catch (e) {
            return '[Object]'
        }
    }
    return String(val)
}

/**
 * 头像列表默认值
 */
export const DEFAULT_AVATARS = [
    '/avatars/小猫举爪.jpg',
    '/avatars/小猫吃芒果.jpg',
    '/avatars/小猫吃草莓.jpg',
    '/avatars/小猫喝茶.jpg',
    '/avatars/小猫坏笑.jpg',
    '/avatars/小猫开心.jpg',
    '/avatars/小猫挥手.jpg',
    '/avatars/小猫星星眼.jpg',
    '/avatars/小猫犯困.jpg'
]

/**
 * 随机获取一个默认头像
 */
export function getRandomAvatar() {
    return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]
}

/**
 * 轮次计数工具
 * v1.10.103: 1 轮 = 1 次完整的「用户消息 → AI 回复」交换
 * - 不管 AI 那次返回了几条消息(文本+卡片+语音),都只算 1 轮
 * - AI 还没回的用户消息(pending)也不算 1 轮
 * - 数据里 AI 角色名同时认 'ai' 和 'assistant'
 */

/**
 * 判断一条消息是否是 AI 回复
 * 存储里 'ai' 是主名,少数地方用 'assistant',要都认
 */
export function isAIResponse(m) {
    return !!(m && (m.role === 'ai' || m.role === 'assistant'))
}

/**
 * 计算消息数组中「已完成的轮次数」
 * 扫一遍,遇到 user 标记「待回」,遇到第一条 AI 关闭+1
 * @param {Array} msgs - 消息数组
 * @returns {number} 已完成轮次数
 */
export function countTurns(msgs) {
    if (!msgs || !msgs.length) return 0
    let count = 0
    let awaitingAi = false
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i]
        if (!m) continue
        if (m.role === 'user') {
            awaitingAi = true
        } else if (isAIResponse(m) && awaitingAi) {
            count++
            awaitingAi = false
        }
    }
    return count
}

/**
 * 获取最后 N 轮对应的消息切片
 * 一轮 = 1 个 user 消息 + 后面直到下一个 user 之前的所有 AI 消息
 * @param {Array} msgs - 消息数组
 * @param {number} turnCount - 轮次数
 * @returns {Array} 最后 N 轮的消息
 */
export function getLastNTurns(msgs, turnCount) {
    if (!msgs || !msgs.length || turnCount <= 0) return []
    // 找出所有「已完成的轮」的起始 user 索引
    const roundStartIndices = []
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i]
        if (!m || m.role !== 'user') continue
        // 往后找,看本轮是否有 AI 回复
        for (let j = i + 1; j < msgs.length; j++) {
            const mm = msgs[j]
            if (!mm) continue
            if (mm.role === 'user') break  // 下一轮,本轮无 AI
            if (isAIResponse(mm)) {
                roundStartIndices.push(i)
                break
            }
        }
    }
    if (roundStartIndices.length === 0) return []
    const startIdx = roundStartIndices[Math.max(0, roundStartIndices.length - turnCount)]
    return msgs.slice(startIdx)
}

/**
 * 计算两个索引之间「已完成的轮次数」
 * @param {Array} msgs - 消息数组
 * @param {number} startIndex - 起始索引
 * @param {number} endIndex - 结束索引（不含）
 * @returns {number} 已完成轮次数
 */
export function countTurnsBetween(msgs, startIndex, endIndex) {
    if (!msgs || startIndex >= endIndex) return 0
    let count = 0
    let awaitingAi = false
    for (let i = Math.max(0, startIndex); i < Math.min(endIndex, msgs.length); i++) {
        const m = msgs[i]
        if (!m) continue
        if (m.role === 'user') {
            awaitingAi = true
        } else if (isAIResponse(m) && awaitingAi) {
            count++
            awaitingAi = false
        }
    }
    return count
}

/**
 * v1.10.128: 获取所有已完成轮次的边界索引
 * 一轮 = 1 个 user 消息 + 后续(直到下一个 user 之前)的 AI 回复
 * @param {Array} msgs - 消息数组
 * @returns {Array<{start: number, end: number}>} 每轮的 [起始索引, 结束索引(不含)]
 */
export function getTurnBoundaries(msgs) {
    if (!msgs || !msgs.length) return []
    const boundaries = []
    let turnStart = -1
    let awaitingAi = false
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i]
        if (!m) continue
        if (m.role === 'user') {
            // 如果上一轮还在等 AI 回复,说明上一轮没完成,直接覆盖
            if (turnStart !== -1 && awaitingAi) {
                // 上一轮未完成,不记录
            }
            turnStart = i
            awaitingAi = true
        } else if (isAIResponse(m) && awaitingAi) {
            // 找到 AI 回复,这一轮完成
            // 继续往后找,把连续的 AI 消息都纳入这一轮
            let end = i + 1
            while (end < msgs.length) {
                const next = msgs[end]
                if (!next) break
                if (next.role === 'user') break
                end++
            }
            boundaries.push({ start: turnStart, end })
            turnStart = -1
            awaitingAi = false
            i = end - 1 // 跳到 end-1,for 循环会 +1
        }
    }
    return boundaries
}

/**
 * v1.10.128: 将轮次范围(1-based)转换为消息数组索引范围(0-based)
 * @param {Array} msgs - 消息数组
 * @param {number} startTurn - 起始轮次(1-based)
 * @param {number} endTurn - 结束轮次(1-based,包含)
 * @returns {{startIndex: number, endIndex: number}|null} 消息数组索引范围,失败返回 null
 */
export function turnRangeToMsgIndices(msgs, startTurn, endTurn) {
    const boundaries = getTurnBoundaries(msgs)
    if (boundaries.length === 0) return null
    const s = Math.max(1, startTurn)
    const e = Math.min(boundaries.length, endTurn)
    if (s > e) return null
    return {
        startIndex: boundaries[s - 1].start,
        endIndex: boundaries[e - 1].end
    }
}
