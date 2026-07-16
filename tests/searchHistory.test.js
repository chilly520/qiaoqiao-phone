/**
 * searchHistory 单元测试
 * 验证:
 * - 关键词搜索
 * - 日期搜索
 * - 关键词 + 日期组合
 * - 上下文窗口 (前 2 条 + 后 2 条)
 * - 系统消息排除
 * - 重叠块去重
 * - 返回上限 5 个
 * - 边界:空聊天 / 无 chat / 无 query / 全无结果
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setupHistoryLogic } from '../src/stores/chatModules/chatHistory'

// 公共 mock(同 summarizeHistory.integration.test.js)
const mockGenerateReply = vi.fn()
vi.mock('../src/utils/aiService', () => ({
    generateReply: (...args) => mockGenerateReply(...args)
}))
vi.mock('../src/stores/settingsStore', () => ({
    useSettingsStore: () => ({})
}))
vi.mock('../src/stores/loggerStore', () => ({
    useLoggerStore: () => ({
        error: vi.fn(), info: vi.fn(), warn: vi.fn(), success: vi.fn(), debug: vi.fn()
    })
}))
vi.mock('../src/utils/memoryLog', () => ({
    appendLog: vi.fn()
}))

// 本地 helper - 尊重 content(不像 makeMsgs 会覆盖)
function mkMsgs(items) {
    return items.map((it, i) => {
        const [y, m, d] = it.day.split('-').map(Number)
        const ts = new Date(y, m - 1, d, it.hour ?? 12, it.minute ?? i, 0).getTime()
        return {
            id: `m${i}`,
            role: it.role,
            type: it.type || 'text',
            content: it.content,
            timestamp: ts
        }
    })
}

function makeChatsStore(msgs, overrides = {}) {
    const chat = {
        id: 'chat1',
        name: 'Alice',
        isGroup: false,
        msgs: [...msgs],
        ...overrides
    }
    return { c1: chat }
}

function setup(msgList, overrides = {}) {
    const chats = ref(makeChatsStore(msgList, overrides))
    const typingStatus = ref({})
    const isProfileProcessing = ref({})
    const addMessage = vi.fn()
    const triggerToast = vi.fn()
    const saveChats = vi.fn()
    const logic = setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats)
    return { ...logic, chats, triggerToast, saveChats }
}

beforeEach(() => {
    mockGenerateReply.mockReset()
})

// =====================================
// 关键词搜索
// =====================================
describe('searchHistory - 关键词搜索', () => {
    it('找到包含关键词的消息,返回 1 个上下文块', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-16', hour: 10, minute: 0, content: '今天天气真好' },
            { role: 'ai', day: '2026-07-16', hour: 10, minute: 5, content: '是的适合出门' },
            { role: 'user', day: '2026-07-16', hour: 11, minute: 0, content: '我们去爬山吧' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '爬山' })
        expect(r.length).toBe(1)
        expect(r[0]).toContain('爬山')
    })

    it('匹配多个分散的消息', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-16', content: '今天聊爬山' },
            { role: 'ai', day: '2026-07-16', content: '好的' },
            { role: 'user', day: '2026-07-16', content: '明天聊爬山' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '爬山' })
        // 两条消息相邻很近,会合并到 1 个块(去重)
        expect(r.length).toBe(1)
        // 块里包含两条
        const count = (r[0].match(/爬山/g) || []).length
        expect(count).toBeGreaterThanOrEqual(2)
    })

    it('匹配的消息互不相邻,返回多个块', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-16', hour: 10, content: '聊爬山' },
            { role: 'ai', day: '2026-07-16', hour: 11, content: '不相关的内容A' },
            { role: 'user', day: '2026-07-16', hour: 12, content: '不相关的内容B' },
            { role: 'ai', day: '2026-07-16', hour: 13, content: '不相关的内容C' },
            { role: 'user', day: '2026-07-16', hour: 14, content: '又聊爬山' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '爬山' })
        expect(r.length).toBe(2)
    })

    it('返回上下文窗口:前 2 + 后 2 条', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-16', hour: 9, content: '消息A' },
            { role: 'ai', day: '2026-07-16', hour: 9, content: '消息B' },
            { role: 'user', day: '2026-07-16', hour: 10, content: '消息C' },
            { role: 'ai', day: '2026-07-16', hour: 10, content: '命中关键词 这里' },
            { role: 'user', day: '2026-07-16', hour: 11, content: '消息D' },
            { role: 'ai', day: '2026-07-16', hour: 11, content: '消息E' },
            { role: 'user', day: '2026-07-16', hour: 12, content: '消息F' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '关键词' })
        expect(r.length).toBe(1)
        // 匹配在 i=3,前 2 是 m1,m2,后 2 是 m4,m5
        // 总共 5 条
        const lines = r[0].split('\n')
        expect(lines.length).toBe(5)
        expect(r[0]).toContain('消息B')
        expect(r[0]).toContain('消息C')
        expect(r[0]).toContain('关键词')
        expect(r[0]).toContain('消息D')
        expect(r[0]).toContain('消息E')
        // 不应包含 A(前向超出) 和 F(后向超出)
        expect(r[0]).not.toContain('消息A')
        expect(r[0]).not.toContain('消息F')
    })

    it('匹配首条消息,前向窗口 clamp 到 0', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-16', hour: 10, content: '命中内容' },
            { role: 'ai', day: '2026-07-16', hour: 10, content: '消息B' },
            { role: 'user', day: '2026-07-16', hour: 11, content: '消息C' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '命中' })
        expect(r[0]).toContain('命中')
        expect(r[0]).toContain('消息B')
        expect(r[0]).toContain('消息C')
    })

    it('匹配末条消息,后向窗口 clamp 到末尾', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-16', hour: 10, content: '消息A' },
            { role: 'ai', day: '2026-07-16', hour: 10, content: '消息B' },
            { role: 'user', day: '2026-07-16', hour: 11, content: '命中' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '命中' })
        expect(r[0]).toContain('消息A')
        expect(r[0]).toContain('消息B')
        expect(r[0]).toContain('命中')
    })
})

// =====================================
// 日期搜索
// =====================================
describe('searchHistory - 日期搜索', () => {
    it('按日期匹配', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-15', content: '昨天的消息' },
            { role: 'user', day: '2026-07-16', content: '今天的消息' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { date: '2026-07-16' })
        expect(r.length).toBe(1)
        expect(r[0]).toContain('今天的消息')
    })

    it('无匹配日期返回空', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-15', content: '消息' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { date: '2026-07-16' })
        expect(r).toEqual([])
    })

    it('部分日期匹配(包含关系)', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-15', content: '消息' }
        ])
        const { searchHistory } = setup(msgs)
        // 传入 "2026-07" 应能匹配
        const r = searchHistory('c1', { date: '2026-07' })
        expect(r.length).toBe(1)
    })
})

// =====================================
// 组合搜索
// =====================================
describe('searchHistory - 关键词 + 日期组合', () => {
    it('日期搜索 + 关键词搜索同时提供时,返回任一匹配的消息(OR 逻辑)', () => {
        // 索引 0: 7-15 不匹配日期,内容不匹配关键词 -> 排除
        // 索引 1: 7-16 匹配日期 -> 命中
        // 索引 2: 填充,不属于命中(在 #1 上下文内)
        // 索引 3: 填充
        // 索引 4: 7-15 包含"爬山" -> 命中(关键词,与 #1 距离 > 2,独立)
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-15', hour: 9, content: '无关内容' },
            { role: 'user', day: '2026-07-16', hour: 10, content: '无关内容' },
            { role: 'user', day: '2026-07-15', hour: 11, content: '填充1' },
            { role: 'user', day: '2026-07-15', hour: 12, content: '填充2' },
            { role: 'user', day: '2026-07-15', hour: 18, content: '聊爬山' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '爬山', date: '2026-07-16' })
        expect(r.length).toBe(2)
        const allText = r.join('\n')
        expect(allText).toContain('2026/07/15')
        expect(allText).toContain('2026/07/16')
    })
})

// =====================================
// 系统消息排除
// =====================================
describe('searchHistory - 系统消息', () => {
    it('系统消息不计入上下文', () => {
        const msgs = [
            { id: 'm0', role: 'user', day: '2026-07-16', hour: 9, content: '消息A' },
            { id: 'sys1', role: 'system', day: '2026-07-16', hour: 10, content: '系统提示' },
            { id: 'm1', role: 'user', day: '2026-07-16', hour: 11, content: '命中关键词' },
            { id: 'sys2', role: 'system', day: '2026-07-16', hour: 12, content: '另一个系统提示' },
            { id: 'm2', role: 'ai', day: '2026-07-16', hour: 13, content: '消息C' }
        ].map((m, i) => ({
            ...m,
            timestamp: new Date(m.day.split('-').map(Number).concat([12, i]).slice(0, 6)).getTime(),
            type: m.role === 'system' ? 'system' : 'text'
        }))
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '关键词' })
        expect(r[0]).not.toContain('系统提示')
        expect(r[0]).not.toContain('sys')
    })

    it('纯系统消息搜索返回空', () => {
        const msgs = [
            { id: 's1', role: 'system', day: '2026-07-16', content: '系统提示', type: 'system', timestamp: Date.now() }
        ]
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '系统' })
        // 系统消息不计入,但 m.type !== 'system' 检查在上下文窗口里执行
        // 主消息 m.type === 'system' 时被 isMatch && m.type !== 'system' 过滤掉
        expect(r).toEqual([])
    })
})

// =====================================
// 重叠去重
// =====================================
describe('searchHistory - 重叠块去重', () => {
    it('相邻命中合并为 1 个块', () => {
        const msgs = mkMsgs([
            { role: 'user', day: '2026-07-16', hour: 10, content: '消息A' },
            { role: 'ai', day: '2026-07-16', hour: 10, content: '命中1' },
            { role: 'user', day: '2026-07-16', hour: 11, content: '命中2' },
            { role: 'ai', day: '2026-07-16', hour: 11, content: '消息D' }
        ])
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '命中' })
        // 两条命中在上下文窗口内重叠,合并
        expect(r.length).toBe(1)
        expect(r[0]).toContain('命中1')
        expect(r[0]).toContain('命中2')
    })
})

// =====================================
// 返回上限 5
// =====================================
describe('searchHistory - 上限', () => {
    it('命中块超过 5 时只返回前 5 个', () => {
        // search 逻辑:命中 i 后, i = endIdx, 再 i++ -> 跳过 3 个索引
        // 所以命中点至少间隔 3 才能被独立识别
        // 6 个不相交命中(命中点 0,3,6,9,12,15)应被截到 5
        const msgs = []
        const hitIndices = [0, 3, 6, 9, 12, 15]
        for (let i = 0; i < 16; i++) {
            const isHit = hitIndices.includes(i)
            msgs.push({
                id: `m${i}`,
                role: isHit ? 'user' : 'ai',
                content: isHit ? `命中 ${i}` : `noise ${i}`,
                type: 'text',
                timestamp: new Date(2026, 6, 16, 10, i, 0).getTime()
            })
        }
        const { searchHistory } = setup(msgs)
        const r = searchHistory('c1', { keyword: '命中' })
        expect(r.length).toBe(5)
    })
})

// =====================================
// 边界
// =====================================
describe('searchHistory - 边界', () => {
    it('不存在的 chatId 返回空', () => {
        const { searchHistory } = setup([])
        const r = searchHistory('nonexistent', { keyword: 'xx' })
        expect(r).toEqual([])
    })

    it('无 query 参数返回空', () => {
        const msgs = mkMsgs([{ role: 'user', day: '2026-07-16', content: '消息' }])
        const { searchHistory } = setup(msgs)
        expect(searchHistory('c1', null)).toEqual([])
        expect(searchHistory('c1', undefined)).toEqual([])
    })

    it('空对象 query 返回空', () => {
        const msgs = mkMsgs([{ role: 'user', day: '2026-07-16', content: '消息' }])
        const { searchHistory } = setup(msgs)
        expect(searchHistory('c1', {})).toEqual([])
    })

    it('keyword 和 date 都为空返回空', () => {
        const msgs = mkMsgs([{ role: 'user', day: '2026-07-16', content: '消息' }])
        const { searchHistory } = setup(msgs)
        expect(searchHistory('c1', { keyword: '', date: '' })).toEqual([])
    })

    it('空聊天数组(无消息)返回空', () => {
        const { searchHistory } = setup([])
        const r = searchHistory('c1', { keyword: 'any' })
        expect(r).toEqual([])
    })
})
