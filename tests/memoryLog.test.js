/**
 * memoryLog 测试
 * 验证:
 * - 触发词识别 (RECALL_TRIGGERS)
 * - 时间范围解析 (parseTimeRange)
 * - 关键词提取 (extractKeywords)
 * - 排除系统消息/卡片
 * - 限制返回最近 5 条
 * - 角色标签 (你/TA/系统)
 * - recallOriginalMessages 完整流程
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ mockChats: {} }))

// mock chatStore - 因为现在 memoryLog 用静态 import,vitest 可以拦截
vi.mock('../src/stores/chatStore', () => ({
    useChatStore: () => ({
        get chats() { return mocks.mockChats }
    })
}))

// 动态 import memoryLog 以便每个测试可以重置模块缓存
let recallOriginalMessages, parseTimeRange, extractKeywords
const memPromise = import('../src/utils/memoryLog').then(m => {
    recallOriginalMessages = m.recallOriginalMessages
    parseTimeRange = m.parseTimeRange
    extractKeywords = m.extractKeywords
})
await memPromise

async function reloadMemoryLog() {
    // 重置模块 + 重新 import,清掉 _chatStore 缓存
    vi.resetModules()
    const m = await import('../src/utils/memoryLog')
    recallOriginalMessages = m.recallOriginalMessages
    parseTimeRange = m.parseTimeRange
    extractKeywords = m.extractKeywords
}

function makeMsg(opts) {
    let y, m, d
    if (opts.day === 'today') {
        const t = new Date()
        y = t.getFullYear(); m = t.getMonth() + 1; d = t.getDate()
    } else if (opts.day === 'yesterday') {
        const t = new Date(Date.now() - 86400000)
        y = t.getFullYear(); m = t.getMonth() + 1; d = t.getDate()
    } else {
        [y, m, d] = opts.day.split('-').map(Number)
    }
    const ts = new Date(y, m - 1, d, 12, 0, 0).getTime()
    return {
        id: opts.id,
        role: opts.role,  // 'user' | 'ai' | 'system'
        type: opts.type || 'text',
        content: opts.content,
        timestamp: ts
    }
}

function makeChat(msgs, name = 'TestChar') {
    return { id: 'c1', name, userName: '我', msgs }
}

beforeEach(async () => {
    mocks.mockChats = {}
    // 重新加载 memoryLog 模块以重置 _chatStore 缓存
    await reloadMemoryLog()
})

// =====================================
// parseTimeRange
// =====================================
describe('parseTimeRange', () => {
    it('"今天" 返回 0 天前', () => {
        const r = parseTimeRange('今天说过什么')
        expect(r).toBeTruthy()
        const days = (Date.now() - r.from) / 86400000
        expect(days).toBeCloseTo(0, 0)
    })

    it('"昨天" 返回 1 天前', () => {
        const r = parseTimeRange('昨天聊了')
        const days = (Date.now() - r.from) / 86400000
        expect(days).toBeCloseTo(1, 0)
    })

    it('"前天" 返回 2 天前', () => {
        const r = parseTimeRange('前天发生')
        const days = (Date.now() - r.from) / 86400000
        expect(days).toBeCloseTo(2, 0)
    })

    it('"3天前" 解析数字', () => {
        const r = parseTimeRange('3天前说了什么')
        const days = (Date.now() - r.from) / 86400000
        expect(days).toBeCloseTo(3, 0)
    })

    it('"很久" 返回 90 天前', () => {
        const r = parseTimeRange('很久以前的事')
        const days = (Date.now() - r.from) / 86400000
        expect(days).toBeCloseTo(90, 0)
    })

    it('无时间关键词返回 null', () => {
        expect(parseTimeRange('你好')).toBeNull()
    })

    it('"今天天气" 也能识别 "今天"', () => {
        const r = parseTimeRange('今天天气真好')
        expect(r).toBeTruthy()
    })
})

// =====================================
// extractKeywords
// =====================================
describe('extractKeywords', () => {
    it('移除触发词后提取关键词', () => {
        const kw = extractKeywords('你具体说了什么')
        // "具体说了" 被移除
        expect(kw).not.toContain('具体说了')
        // "你什么" 3 字保留 (3 个中文字符)
        expect(kw).toContain('你什么')
    })

    it('过滤标点', () => {
        const kw = extractKeywords('你说过哪些呢？')
        // 问号被替换为空格
        expect(kw).not.toContain('？')
    })

    it('最多 5 个关键词', () => {
        const kw = extractKeywords('一二三四五六七八九十')
        expect(kw.length).toBeLessThanOrEqual(5)
    })

    it('过滤单字', () => {
        const kw = extractKeywords('a b c d 你好')
        // "a","b","c","d" 单字被过滤
        expect(kw).not.toContain('a')
        expect(kw).toContain('你好')
    })

    it('清除后的纯触发词无关键词', () => {
        const kw = extractKeywords('具体说了')
        // "具体说了" 被移除,剩 "" → []
        expect(kw).toEqual([])
    })
})

// =====================================
// recallOriginalMessages
//
// 注意:用户消息经过 extractKeywords 后,会移除触发词和短词(< 2字)。
// 剩余关键词需与消息内容匹配,否则会被过滤掉。
// 为简化测试,我们用消息内容匹配用户消息中保留的关键词。
// =====================================
describe('recallOriginalMessages - 触发词识别', () => {
    it('"具体说了" 触发:消息含匹配关键词', async () => {
        // 用户 "你具体说了什么来着?" → extractKeywords 提取 ["你什么来着"]
        // 消息内容必须包含 "你什么来着" 才能匹配
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'm1', role: 'ai', day: '2026-05-10', content: '我回答说你什么来着不重要' })
        ])
        const r = await recallOriginalMessages('c1', '你具体说了什么来着?')
        expect(r).toBeTruthy()
        expect(r).toContain('系统检索到相关记忆')
    })

    it('"哪句话" 触发:用户消息中无剩余关键词,所有候选通过', async () => {
        // 用户 "是哪句话" → extractKeywords 移除 "哪句话" + "是"(1字) → []
        // keywords = [] → 不过滤,所有候选通过
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'm1', role: 'ai', day: '2026-05-10', content: '经典台词' })
        ])
        const r = await recallOriginalMessages('c1', '是哪句话')
        expect(r).toBeTruthy()
        expect(r).toContain('经典台词')
    })

    it('"几天前" 触发:消息在时间窗口内,无关键词过滤', async () => {
        // 用户 "几天前的" → "几天前" 被移除 + "的" 1字 → []
        // timeRange = 3天前 → 过滤消息
        // 用今天的日期确保在窗口内
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'm1', role: 'ai', day: 'today', content: '过去的事' })
        ])
        const r = await recallOriginalMessages('c1', '几天前的')
        expect(r).toBeTruthy()
        expect(r).toContain('过去的事')
    })

    it('"上次" 触发:用户消息中无剩余关键词,所有候选通过', async () => {
        // 用户 "上次说的" → "上次" 被移除 + "说" 1字 + "的" 1字 → []
        // 实际 "说的" 是 2 字符,会保留。所以要用 "上次提" 之类 → 提 1字被过滤
        // 安全起见:用纯 "上次" (没有其他字符) → "上次" 被移除,剩 "" → []
        // 但 "上次" 2字符,会被保留。改用 "上次的" → 3字符,仍保留。
        // 干脆:用 "上次说过什么" → "上次" + "说过什么" 都被移除 → 剩 "" → []
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'm1', role: 'ai', day: 'today', content: '上次提到一些内容' })
        ])
        const r = await recallOriginalMessages('c1', '上次说过什么')
        expect(r).toBeTruthy()
        expect(r).toContain('上次提到一些内容')
    })

    it('普通问题不触发,返回 null', async () => {
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'm1', role: 'ai', day: '2026-05-10', content: '今天天气真好' })
        ])
        const r = await recallOriginalMessages('c1', '你好')
        expect(r).toBeNull()
    })

    it('空聊天不触发,返回 null', async () => {
        mocks.mockChats.c1 = makeChat([])
        const r = await recallOriginalMessages('c1', '具体说了什么')
        expect(r).toBeNull()
    })
})

describe('recallOriginalMessages - 关键词过滤', () => {
    it('提取关键词并只返回包含关键词的消息', async () => {
        // 用户 "具体说了爬山" → 提取 ["爬山"] (具体说了移除)
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'm1', role: 'ai', day: 'today', content: '我们去爬山吧' }),
            makeMsg({ id: 'm2', role: 'ai', day: 'today', content: '今天吃火锅' }),
            makeMsg({ id: 'm3', role: 'ai', day: 'today', content: '爬山时遇到小松鼠' })
        ])
        const r = await recallOriginalMessages('c1', '具体说了爬山')
        expect(r).toContain('爬山')
        expect(r).not.toContain('火锅')
    })

    it('过滤后无匹配返回 null', async () => {
        // 用户 "具体说了登山" → 提取 ["登山"]
        // 消息内容 "吃火锅" 不含 "登山"
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'm1', role: 'ai', day: 'today', content: '吃火锅' })
        ])
        const r = await recallOriginalMessages('c1', '具体说了登山')
        expect(r).toBeNull()
    })
})

describe('recallOriginalMessages - 排除系统消息和卡片', () => {
    it('系统消息不进入候选', async () => {
        // 用户用纯触发词,无剩余关键词,所有候选都通过(除了被过滤的)
        // 注意:代码过滤的是 m.type !== 'system',不是 m.role !== 'system'
        mocks.mockChats.c1 = makeChat([
            { id: 'sys', role: 'system', type: 'system', day: '2026-05-10', content: '系统提示包含关键词', timestamp: Date.now() },
            makeMsg({ id: 'ai', role: 'ai', day: '2026-05-10', content: '普通回复内容' })
        ])
        const r = await recallOriginalMessages('c1', '是哪句话')
        // system 消息不进候选
        expect(r).toBeTruthy()
        expect(r).not.toContain('系统提示')
        expect(r).toContain('普通回复内容')
    })

    it('favorite_card 不进入候选', async () => {
        mocks.mockChats.c1 = makeChat([
            { id: 'card', role: 'ai', type: 'favorite_card', day: '2026-05-10', content: '卡片包含关键词', timestamp: Date.now() },
            makeMsg({ id: 'normal', role: 'ai', day: '2026-05-10', content: '普通消息内容' })
        ])
        const r = await recallOriginalMessages('c1', '是哪句话')
        expect(r).toBeTruthy()
        expect(r).not.toContain('卡片包含')
        expect(r).toContain('普通消息内容')
    })
})

describe('recallOriginalMessages - 限制返回最近 5 条', () => {
    it('候选超过 5 条时只返回最后 5 条', async () => {
        // 用纯触发词 → 无关键词 → 所有候选通过
        const msgs = []
        for (let i = 0; i < 8; i++) {
            msgs.push(makeMsg({ id: `m${i}`, role: 'ai', day: '2026-05-10', content: `消息内容 ${i}` }))
        }
        mocks.mockChats.c1 = makeChat(msgs)
        const r = await recallOriginalMessages('c1', '是哪句话')
        // 注意:第一行是 "[🔍 系统检索到相关记忆]" 标题,要排除
        const lines = r.split('\n').filter(l => l.trim().startsWith('[') && l.includes('消息内容'))
        expect(lines.length).toBeLessThanOrEqual(5)
        // 应该包含后 5 条 (m3~m7),不应该包含 m0~m2
        expect(r).toContain('消息内容 7')
        expect(r).toContain('消息内容 3')
        expect(r).not.toContain('消息内容 0')
    })
})

describe('recallOriginalMessages - 角色标签', () => {
    it('user 角色标为 "我"', async () => {
        // 用纯触发词,无关键词过滤
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'u1', role: 'user', day: '2026-05-10', content: '我问你' })
        ])
        const r = await recallOriginalMessages('c1', '是哪句话')
        expect(r).toContain('我:')
    })

    it('ai 角色标为角色名', async () => {
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'a1', role: 'ai', day: '2026-05-10', content: '我的回复' })
        ], '小红')
        const r = await recallOriginalMessages('c1', '是哪句话')
        expect(r).toContain('小红:')
    })
})

describe('recallOriginalMessages - 边界', () => {
    it('不存在的 chatId 返回 null', async () => {
        const r = await recallOriginalMessages('nonexistent', '具体说了什么')
        expect(r).toBeNull()
    })

    it('消息被截断:超过 150 字加 ...', async () => {
        const longContent = '这是一个非常长的消息内容'.repeat(20)  // > 150 字
        mocks.mockChats.c1 = makeChat([
            makeMsg({ id: 'long', role: 'ai', day: '2026-05-10', content: longContent })
        ])
        const r = await recallOriginalMessages('c1', '是哪句话')
        expect(r).toContain('...')
    })
})
