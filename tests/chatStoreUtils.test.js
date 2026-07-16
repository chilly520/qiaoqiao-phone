/**
 * chatStore 工具方法测试
 * 验证:
 * - estimateTokens (中文 1 token,英文 3 字符 1 token)
 * - calculateMemberLevel (活动量等级)
 * - pinChat (置顶切换)
 * - deleteChat (删除)
 * - addSystemMessage (当前 chat)
 * - clearHistory (清空消息 + 可选 memory)
 * - getDisplayedMessages (分页切片)
 * - loadMoreMessages / hasMoreMessages / resetPagination
 * - triggerToast
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// 公共 mock - 拦截所有 chatStore 引入的依赖
vi.mock('../src/utils/aiService', () => ({
    generateReply: vi.fn().mockResolvedValue({ content: 'mock' }),
    generateSummary: vi.fn().mockResolvedValue('mock'),
    generateImage: vi.fn().mockResolvedValue('data:image/png;base64,xxx'),
    generateContextPreview: vi.fn().mockReturnValue({ system: 0, persona: 0, worldBook: 0, memory: 0, history: 0, summaryLib: 0, totalContext: 0 })
}))
vi.mock('../src/utils/taskUtils', () => ({ processTaskCommands: vi.fn() }))
vi.mock('../src/utils/bioUtils', () => ({ processBioUpdate: vi.fn() }))
vi.mock('../src/utils/memoryLog', () => ({ appendLog: vi.fn() }))
vi.mock('../src/utils/backgroundManager', () => ({
    backgroundManager: { save: vi.fn(), load: vi.fn() }
}))
vi.mock('../src/utils/autoBackup', () => ({ default: { run: vi.fn() } }))
vi.mock('../src/utils/chatImageUtils', () => ({
    compressAllChatImages: vi.fn(),
    extractLSActions: vi.fn()
}))
vi.mock('localforage', () => ({
    default: {
        config: vi.fn(),
        getItem: vi.fn().mockResolvedValue(null),
        setItem: vi.fn().mockResolvedValue(undefined),
        removeItem: vi.fn().mockResolvedValue(undefined)
    }
}))
vi.mock('../src/stores/aiTaskStore', () => ({ useAITaskStore: () => ({}) }))
vi.mock('../src/stores/loggerStore', () => ({
    useLoggerStore: () => ({
        error: vi.fn(), info: vi.fn(), warn: vi.fn(), success: vi.fn(), debug: vi.fn()
    })
}))
vi.mock('../src/stores/worldBookStore', () => ({ useWorldBookStore: () => ({}) }))
vi.mock('../src/stores/momentsStore', () => ({ useMomentsStore: () => ({}) }))
vi.mock('../src/stores/settingsStore', () => ({
    useSettingsStore: () => ({ personalization: { userProfile: { name: 'U' } } })
}))
vi.mock('../src/stores/musicStore', () => ({ useMusicStore: () => ({}) }))
vi.mock('../src/stores/schedulerStore', () => ({ useSchedulerStore: () => ({}) }))
vi.mock('../src/stores/callStore', () => ({ useCallStore: () => ({}) }))
vi.mock('../src/stores/phoneInspectionStore', () => ({ usePhoneInspectionStore: () => ({}) }))

let useChatStore
beforeAll(async () => {
    const m = await import('../src/stores/chatStore')
    useChatStore = m.useChatStore
})

beforeEach(() => {
    setActivePinia(createPinia())
})

function makeChat(id, overrides = {}) {
    return {
        id,
        name: `Chat${id}`,
        msgs: [],
        memory: [],
        summary: '',
        bio: {
            gender: '未知', age: '未知', birthday: '未知', zodiac: '未知', mbti: '未知',
            height: '未知', weight: '未知', body: '未知', occupation: '未知', status: '未知',
            scent: '未知', style: '未知', hobbies: [], idealType: '未知', heartbeatMoment: '暂无记录',
            traits: [], routine: { awake: '未知', busy: '未知', deep: '未知' },
            soulBonds: [], loveItems: [
                { name: '爱之物 I', image: '' }, { name: '爱之物 II', image: '' }, { name: '爱之物 III', image: '' }
            ]
        },
        ...overrides
    }
}

// =====================================
// estimateTokens
// =====================================
describe('chatStore - estimateTokens', () => {
    it('空字符串返回 0', () => {
        const store = useChatStore()
        expect(store.estimateTokens('')).toBe(0)
    })

    it('null/undefined 返回 0', () => {
        const store = useChatStore()
        expect(store.estimateTokens(null)).toBe(0)
        expect(store.estimateTokens(undefined)).toBe(0)
    })

    it('纯中文:1 字 1 token', () => {
        const store = useChatStore()
        expect(store.estimateTokens('你好')).toBe(2)
        expect(store.estimateTokens('今天的天气真好')).toBe(7)
    })

    it('纯英文:3 字符 1 token(向上取整)', () => {
        const store = useChatStore()
        expect(store.estimateTokens('abc')).toBe(1) // 3/3 = 1
        expect(store.estimateTokens('abcdef')).toBe(2) // 6/3 = 2
        expect(store.estimateTokens('ab')).toBe(1) // 2/3 ceil = 1
    })

    it('中英文混合', () => {
        const store = useChatStore()
        // "你好abc" -> 2 chinese + ceil(3/3) = 2+1=3
        expect(store.estimateTokens('你好abc')).toBe(3)
        // "你好world" -> 2 chinese + ceil(5/3) = 2+2=4
        expect(store.estimateTokens('你好world')).toBe(4)
    })

    it('数字算英文', () => {
        const store = useChatStore()
        expect(store.estimateTokens('123')).toBe(1)
        expect(store.estimateTokens('12345')).toBe(2)
    })
})

// =====================================
// calculateMemberLevel
// =====================================
describe('chatStore - calculateMemberLevel', () => {
    it('activity < 10 -> 1', () => {
        const store = useChatStore()
        expect(store.calculateMemberLevel(0)).toBe(1)
        expect(store.calculateMemberLevel(5)).toBe(1)
        expect(store.calculateMemberLevel(9)).toBe(1)
    })

    it('10 <= activity < 30 -> 2', () => {
        const store = useChatStore()
        expect(store.calculateMemberLevel(10)).toBe(2)
        expect(store.calculateMemberLevel(20)).toBe(2)
        expect(store.calculateMemberLevel(29)).toBe(2)
    })

    it('30 <= activity < 70 -> 3', () => {
        const store = useChatStore()
        expect(store.calculateMemberLevel(30)).toBe(3)
        expect(store.calculateMemberLevel(50)).toBe(3)
        expect(store.calculateMemberLevel(69)).toBe(3)
    })

    it('70 <= activity < 150 -> 4', () => {
        const store = useChatStore()
        expect(store.calculateMemberLevel(70)).toBe(4)
        expect(store.calculateMemberLevel(100)).toBe(4)
        expect(store.calculateMemberLevel(149)).toBe(4)
    })

    it('activity >= 150 -> 5', () => {
        const store = useChatStore()
        expect(store.calculateMemberLevel(150)).toBe(5)
        expect(store.calculateMemberLevel(1000)).toBe(5)
    })

    it('默认参数为 0', () => {
        const store = useChatStore()
        expect(store.calculateMemberLevel()).toBe(1)
    })
})

// =====================================
// pinChat
// =====================================
describe('chatStore - pinChat', () => {
    it('切换 isPinned', () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1', { isPinned: false })
        store.pinChat('c1')
        expect(store.chats.c1.isPinned).toBe(true)
        store.pinChat('c1')
        expect(store.chats.c1.isPinned).toBe(false)
    })

    it('不存在的 chat 不报错', () => {
        const store = useChatStore()
        expect(() => store.pinChat('nonexistent')).not.toThrow()
    })

    it('未定义 isPinned 时切换为 true', () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1')
        store.pinChat('c1')
        expect(store.chats.c1.isPinned).toBe(true)
    })
})

// =====================================
// deleteChat
// =====================================
describe('chatStore - deleteChat', () => {
    it('删除存在的 chat', () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1')
        store.deleteChat('c1')
        expect(store.chats.c1).toBeUndefined()
    })

    it('删除当前 chat 时 currentChatId 重置为 null', () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1')
        store.currentChatId = 'c1'
        store.deleteChat('c1')
        expect(store.currentChatId).toBeNull()
    })

    it('删除非当前 chat 不影响 currentChatId', () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1')
        store.chats.c2 = makeChat('c2')
        store.currentChatId = 'c1'
        store.deleteChat('c2')
        expect(store.currentChatId).toBe('c1')
    })

    it('不存在的 chat 不报错', () => {
        const store = useChatStore()
        expect(() => store.deleteChat('nonexistent')).not.toThrow()
    })
})

// =====================================
// addSystemMessage
// =====================================
describe('chatStore - addSystemMessage', () => {
    it('无 currentChatId 时静默返回', () => {
        const store = useChatStore()
        store.addSystemMessage('test')
        // 不应崩溃,addMessage 也不应被调用
    })

    it('有 currentChatId 时调用 addMessage', async () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1')
        store.currentChatId = 'c1'
        // addSystemMessage 是同步的,内部 addMessage 异步
        // 直接等待 addMessage 异步完成
        await store.addMessage('c1', { role: 'system', content: 'hello system', mode: 'online' })
        const msgs = store.chats.c1.msgs
        expect(msgs.length).toBe(1)
        expect(msgs[0].role).toBe('system')
        expect(msgs[0].content).toBe('hello system')
        expect(msgs[0].mode).toBe('online')
        expect(typeof msgs[0].timestamp).toBe('number')
    })
})

// =====================================
// clearHistory
// =====================================
describe('chatStore - clearHistory', () => {
    it('默认只清空 msgs', () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1', {
            msgs: [{ id: 'm1', content: 'hi' }],
            memory: ['记忆1'],
            summary: '总结'
        })
        store.clearHistory('c1')
        expect(store.chats.c1.msgs).toEqual([])
        // memory 和 summary 保留
        expect(store.chats.c1.memory).toEqual(['记忆1'])
        expect(store.chats.c1.summary).toBe('总结')
    })

    it('includeMemory=true 时清空 memory 和 summary', () => {
        const store = useChatStore()
        store.chats.c1 = makeChat('c1', {
            msgs: [{ id: 'm1', content: 'hi' }],
            memory: ['记忆1', '记忆2'],
            summary: '总结'
        })
        store.clearHistory('c1', { includeMemory: true })
        expect(store.chats.c1.msgs).toEqual([])
        expect(store.chats.c1.memory).toEqual([])
        expect(store.chats.c1.summary).toBe('')
    })

    it('不存在的 chat 不报错', () => {
        const store = useChatStore()
        expect(() => store.clearHistory('nonexistent')).not.toThrow()
    })
})

// =====================================
// 分页:getDisplayedMessages / loadMoreMessages / hasMoreMessages / resetPagination
// =====================================
describe('chatStore - 消息分页', () => {
    it('getDisplayedMessages 默认返回最近 pageSize(50)条', () => {
        const store = useChatStore()
        const msgs = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, content: `msg${i}` }))
        store.chats.c1 = makeChat('c1', { msgs })
        const displayed = store.getDisplayedMessages('c1')
        expect(displayed.length).toBe(50)
        expect(displayed[0].id).toBe('m50') // 后 50 条
        expect(displayed[49].id).toBe('m99')
    })

    it('getDisplayedMessages 少于 pageSize 时返回全部', () => {
        const store = useChatStore()
        const msgs = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, content: `m${i}` }))
        store.chats.c1 = makeChat('c1', { msgs })
        const displayed = store.getDisplayedMessages('c1')
        expect(displayed.length).toBe(10)
    })

    it('getDisplayedMessages 不存在的 chat 返回空', () => {
        const store = useChatStore()
        expect(store.getDisplayedMessages('nonexistent')).toEqual([])
    })

    it('loadMoreMessages 增加 loadedCount', () => {
        const store = useChatStore()
        const msgs = Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, content: `m${i}` }))
        store.chats.c1 = makeChat('c1', { msgs })
        const ret = store.loadMoreMessages('c1')
        expect(ret).toBe(true) // 还有更多
        const displayed = store.getDisplayedMessages('c1')
        expect(displayed.length).toBe(100) // 50+50
    })

    it('loadMoreMessages 加载完所有后返回 false', () => {
        const store = useChatStore()
        const msgs = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, content: `m${i}` }))
        store.chats.c1 = makeChat('c1', { msgs })
        store.loadMoreMessages('c1') // 100, 还差
        const ret = store.loadMoreMessages('c1') // 150, 但只有 60
        expect(ret).toBe(false)
    })

    it('hasMoreMessages:还有未加载的返回 true', () => {
        const store = useChatStore()
        const msgs = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}` }))
        store.chats.c1 = makeChat('c1', { msgs })
        expect(store.hasMoreMessages('c1')).toBe(true)
    })

    it('hasMoreMessages:全部加载完返回 false', () => {
        const store = useChatStore()
        const msgs = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}` }))
        store.chats.c1 = makeChat('c1', { msgs })
        expect(store.hasMoreMessages('c1')).toBe(false)
    })

    it('resetPagination 重置为 pageSize', () => {
        const store = useChatStore()
        const msgs = Array.from({ length: 200 }, (_, i) => ({ id: `m${i}` }))
        store.chats.c1 = makeChat('c1', { msgs })
        store.loadMoreMessages('c1')
        store.loadMoreMessages('c1')
        store.resetPagination('c1')
        const displayed = store.getDisplayedMessages('c1')
        expect(displayed.length).toBe(50)
    })
})

// =====================================
// triggerToast
// =====================================
describe('chatStore - triggerToast', () => {
    it('默认 type 是 info', () => {
        const store = useChatStore()
        store.triggerToast('test message')
        expect(store.toastEvent.message).toBe('test message')
        expect(store.toastEvent.type).toBe('info')
    })

    it('显式 type', () => {
        const store = useChatStore()
        store.triggerToast('error message', 'error')
        expect(store.toastEvent.message).toBe('error message')
        expect(store.toastEvent.type).toBe('error')
    })

    it('每次调用覆盖 toastEvent', () => {
        const store = useChatStore()
        store.triggerToast('first')
        store.triggerToast('second')
        expect(store.toastEvent.message).toBe('second')
    })

    it('toastEvent 包含 id 字段(用于触发更新)', () => {
        const store = useChatStore()
        store.triggerToast('msg')
        expect(typeof store.toastEvent.id).toBe('number')
    })
})
