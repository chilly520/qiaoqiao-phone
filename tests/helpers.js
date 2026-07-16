/**
 * 生成模拟的聊天消息数组,用于测试日期/轮次范围总结。
 * @param {Array<{day: string, role: 'user'|'assistant', hour?: number, minute?: number}>} items
 * @returns {Array} 消息数组,每条带 timestamp / role / content
 */
export function makeMsgs(items) {
    return items.map((it, i) => {
        const [y, m, d] = it.day.split('-').map(Number)
        const h = it.hour ?? 12
        const min = it.minute ?? 0
        const ts = new Date(y, m - 1, d, h, min, 0).getTime()
        return {
            id: `m_${i}`,
            role: it.role,
            timestamp: ts,
            content: it.role === 'user' ? `Q${i}` : `A${i}`
        }
    })
}
