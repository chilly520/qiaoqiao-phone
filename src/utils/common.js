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
 * 一轮 = AI 一次完整回复
 * v1.10.102: 口径从「user 消息数」改为「AI 回复数」(同时认 'ai' 和 'assistant' 两种角色名)
 */

/**
 * 判断一条消息是否是 AI 回复
 * 存储里 'ai' 是主名,少数地方用 'assistant',要都认
 */
export function isAIResponse(m) {
    return !!(m && (m.role === 'ai' || m.role === 'assistant'))
}

/**
 * 计算消息数组中的总轮次数（AI 回复数）
 * @param {Array} msgs - 消息数组
 * @returns {number} 轮次数
 */
export function countTurns(msgs) {
    if (!msgs || !msgs.length) return 0
    return msgs.filter(isAIResponse).length
}

/**
 * 获取最后 N 轮对应的消息切片
 * 从末尾向前数 N 条 AI 回复，返回从该位置开始的所有消息
 * @param {Array} msgs - 消息数组
 * @param {number} turnCount - 轮次数
 * @returns {Array} 最后 N 轮的消息
 */
export function getLastNTurns(msgs, turnCount) {
    if (!msgs || !msgs.length || turnCount <= 0) return []
    let aiCount = 0
    for (let i = msgs.length - 1; i >= 0; i--) {
        if (isAIResponse(msgs[i])) {
            aiCount++
            if (aiCount >= turnCount) {
                return msgs.slice(i)
            }
        }
    }
    return [...msgs]
}

/**
 * 计算两个索引之间的轮次数（AI 回复数）
 * @param {Array} msgs - 消息数组
 * @param {number} startIndex - 起始索引
 * @param {number} endIndex - 结束索引（不含）
 * @returns {number} 轮次数
 */
export function countTurnsBetween(msgs, startIndex, endIndex) {
    if (!msgs || startIndex >= endIndex) return 0
    let count = 0
    for (let i = Math.max(0, startIndex); i < Math.min(endIndex, msgs.length); i++) {
        if (isAIResponse(msgs[i])) count++
    }
    return count
}
