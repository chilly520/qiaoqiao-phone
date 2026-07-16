/**
 * summarizeHistory 集成测试
 * mock 掉 aiService.generateReply,验证:
 * - 日期范围总结能正确选取消息并保存
 * - 自动增量模式能推进 lastSummaryIndex
 * - 手动总结(日期/轮次)不会污染自动总结状态
 * - API 返回空响应时正确报错
 * - 锁机制: 同时多次调用只允许一个执行
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setupHistoryLogic } from '../src/stores/chatModules/chatHistory'
import { makeMsgs } from './helpers'

// mock aiService.generateReply,默认返回正常结果
const mockGenerateReply = vi.fn()
vi.mock('../src/utils/aiService', () => ({
    generateReply: (...args) => mockGenerateReply(...args)
}))

// mock settingsStore / loggerStore / memoryLog
vi.mock('../src/stores/settingsStore', () => ({
    useSettingsStore: () => ({})
}))
vi.mock('../src/stores/loggerStore', () => ({
    useLoggerStore: () => ({
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        debug: vi.fn()
    })
}))
vi.mock('../src/utils/memoryLog', () => ({
    appendLog: vi.fn()
}))

function makeChatsStore(initialMsgs, overrides = {}) {
    const chat = {
        id: 'chat1',
        name: 'Test Chat',
        isGroup: false,
        msgs: [...initialMsgs],
        lastSummaryIndex: 0,
        lastSummaryCount: 0,
        lastSummaryTime: 0,
        summary: '',
        isSummarizing: false,
        summaryLimit: 50,
        ...overrides
    }
    const chats = ref({ chat1: chat })
    return { chats, chat }
}

describe('summarizeHistory - 集成测试', () => {
    beforeEach(() => {
        mockGenerateReply.mockReset()
    })

    it('【核心】按日期总结:AI 只看到选中日期的消息,summary 被保存', async () => {
        const msgs = makeMsgs([
            { day: '2026-05-07', role: 'user' },
            { day: '2026-05-07', role: 'assistant' },
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' },
            { day: '2026-05-09', role: 'user' }
        ])
        const { chats, chat } = makeChatsStore(msgs)
        const typingStatus = ref({})
        const isProfileProcessing = ref(false)
        const triggerToast = vi.fn()
        const addMessage = vi.fn()
        const saveChats = vi.fn()

        // 让 AI 返回一个固定总结
        let capturedContext = null
        mockGenerateReply.mockImplementation(async (context) => {
            capturedContext = context
            return { content: '5/8 总结:你俩在聊天' }
        })

        const history = setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, saveChats)
        // 注入 triggerToast(setupHistoryLogic 的参数顺序里 triggerToast 在 saveChats 后面)
        // 注意:setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats)
        const history2 = setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats)

        const r = await history2.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })
        if (!r.success) console.error('DEBUG r:', r)
        expect(r.success).toBe(true)
        expect(chat.summary).toBe('5/8 总结:你俩在聊天')
        // 验证 AI 看到的 transcript 只包含 5/8 的 2 条
        const userContent = capturedContext[1].content
        expect(userContent).toContain('2026/5/8')
        expect(userContent).not.toContain('2026/5/7')
        expect(userContent).not.toContain('2026/5/9')
    })

    it('【回归】按日期总结:不应该推进 lastSummaryIndex(防止污染自动状态)', async () => {
        const msgs = makeMsgs([
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' }
        ])
        const { chats, chat } = makeChatsStore(msgs, { lastSummaryIndex: 0, lastSummaryTime: 12345 })
        mockGenerateReply.mockResolvedValue({ content: 'summary' })

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        await history.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })

        expect(chat.lastSummaryIndex).toBe(0)  // 没变
        expect(chat.lastSummaryTime).toBe(12345)  // 没变
    })

    it('【核心】自动增量模式:成功后会推进 lastSummaryIndex', async () => {
        const msgs = makeMsgs([
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' },
            { day: '2026-05-09', role: 'user' },
            { day: '2026-05-09', role: 'assistant' }
        ])
        const { chats, chat } = makeChatsStore(msgs, { lastSummaryIndex: 0 })
        mockGenerateReply.mockResolvedValue({ content: 'auto summary' })

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        const r = await history.summarizeHistory('chat1', {})

        expect(r.success).toBe(true)
        expect(chat.lastSummaryIndex).toBe(4)  // 推进到末尾
        expect(chat.lastSummaryCount).toBe(4)
        expect(chat.lastSummaryTime).toBeGreaterThan(0)
    })

    it('【错误处理】AI 返回空响应:报错 "AI returned empty response"', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        const { chats } = makeChatsStore(msgs)
        mockGenerateReply.mockResolvedValue({ content: '' })  // 空内容

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        const r = await history.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })

        expect(r.success).toBe(false)
        expect(r.error).toContain('AI returned empty response')
    })

    it('【错误处理】AI 返回 null:同样报错', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        const { chats } = makeChatsStore(msgs)
        mockGenerateReply.mockResolvedValue(null)

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        const r = await history.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })

        expect(r.success).toBe(false)
        expect(r.error).toContain('empty response')
    })

    it('【错误处理】日期范围内无消息:报错含 "范围内没有消息"', async () => {
        const msgs = makeMsgs([{ day: '2026-05-07', role: 'user' }])
        const { chats } = makeChatsStore(msgs)
        mockGenerateReply.mockResolvedValue({ content: 'summary' })

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        const r = await history.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })

        expect(r.success).toBe(false)
        expect(r.error).toContain('范围内没有消息')
    })

    it('【锁机制】同时调用:第二次返回 "already in progress"', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }, { day: '2026-05-08', role: 'assistant' }])
        const { chats, chat } = makeChatsStore(msgs)
        // 让 AI 调用延迟 100ms
        mockGenerateReply.mockImplementation(() => new Promise(r => setTimeout(() => r({ content: 's' }), 100)))

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        const p1 = history.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })
        const p2 = history.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })

        const [r1, r2] = await Promise.all([p1, p2])
        expect(r1.success).toBe(true)
        expect(r2.success).toBe(false)
        expect(r2.error).toBe('Summarization already in progress')
    })

    it('【边界】自动模式:目标消息为 0 条时返回 "No new messages"', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }, { day: '2026-05-08', role: 'assistant' }])
        const { chats } = makeChatsStore(msgs, { lastSummaryIndex: 2 })  // 已经全部总结过
        mockGenerateReply.mockResolvedValue({ content: 's' })

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        const r = await history.summarizeHistory('chat1', {})

        expect(r.success).toBe(false)
        expect(r.error).toContain('No new messages')
    })

    it('【边界】不存在的 chatId:返回 "Chat not found"', async () => {
        const { chats } = makeChatsStore([])
        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        const r = await history.summarizeHistory('nonexistent', {})

        expect(r.success).toBe(false)
        expect(r.error).toBe('Chat not found')
    })

    it('【AbortSignal】日期范围总结:传给 generateReply 的第 3 个参数是 null(不是函数)', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        const { chats } = makeChatsStore(msgs)
        mockGenerateReply.mockResolvedValue({ content: 's' })

        const history = setupHistoryLogic(chats, ref({}), ref(false), vi.fn(), vi.fn(), vi.fn())
        await history.summarizeHistory('chat1', { startDate: '2026-05-08', endDate: '2026-05-08' })

        // 验证 generateReply 调用参数: (context, chat, abortSignal, options)
        expect(mockGenerateReply).toHaveBeenCalledTimes(1)
        const args = mockGenerateReply.mock.calls[0]
        expect(args[2]).toBeNull()  // 关键:abortSignal 不能是函数
        expect(typeof args[2]).not.toBe('function')
        // options.skipContext / disableTools 应为 true
        expect(args[3].skipContext).toBe(true)
        expect(args[3].disableTools).toBe(true)
        expect(typeof args[3].onChunk).toBe('function')  // chunk 回调放在 options 里
    })
})
