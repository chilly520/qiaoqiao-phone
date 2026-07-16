/**
 * checkAutoSummary 单元测试
 * 验证:
 * - 不存在 chat 时直接 return
 * - 未开启 autoSummary(全局 + 群组)时直接 return
 * - isSummarizing 为 true 时跳过
 * - backlog 不足 summaryLimit 时不触发 summarizeHistory
 * - backlog >= summaryLimit 时触发 summarizeHistory({silent: true})
 * - lastIndex 越界时自动重置
 * - summaryLimit 优先级: chat.summaryLimit > 群组 memory.autoSummaryEvery > 群组 summaryLimit > personalization > 50
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setupHistoryLogic } from '../src/stores/chatModules/chatHistory'

// 公共 mock
const mockGenerateReply = vi.fn()
vi.mock('../src/utils/aiService', () => ({
    generateReply: (...args) => mockGenerateReply(...args)
}))
const mockSettingsStore = {
    personalization: {}
}
vi.mock('../src/stores/settingsStore', () => ({
    useSettingsStore: () => mockSettingsStore
}))
const mockLogger = {
    error: vi.fn(), info: vi.fn(), warn: vi.fn(), success: vi.fn(), debug: vi.fn()
}
vi.mock('../src/stores/loggerStore', () => ({
    useLoggerStore: () => mockLogger
}))
vi.mock('../src/utils/memoryLog', () => ({
    appendLog: vi.fn()
}))

function mkMsgs(n) {
    // 创建 n 条 user + n 条 ai 交替,共 2n 条 = n 轮
    const msgs = []
    for (let i = 0; i < n; i++) {
        msgs.push({ id: `u${i}`, role: 'user', type: 'text', content: `Q${i}`, timestamp: Date.now() + i * 1000 })
        msgs.push({ id: `a${i}`, role: 'ai', type: 'text', content: `A${i}`, timestamp: Date.now() + i * 1000 + 500 })
    }
    return msgs
}

function setup(chatOverrides = {}) {
    const chat = {
        id: 'c1',
        name: 'Alice',
        isGroup: false,
        msgs: [],
        ...chatOverrides
    }
    const chats = ref({ c1: chat })
    const typingStatus = ref({})
    const isProfileProcessing = ref({})
    const addMessage = vi.fn()
    const triggerToast = vi.fn()
    const saveChats = vi.fn()
    const logic = setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats)
    return { ...logic, chat, chats, triggerToast, saveChats }
}

beforeEach(() => {
    mockGenerateReply.mockReset()
    // 设置一个标准的 AI 响应,summarizeHistory 内部 await
    mockGenerateReply.mockResolvedValue({ content: 'mock summary' })
    mockLogger.info.mockClear()
    mockLogger.error.mockClear()
    mockLogger.success.mockClear()
    mockLogger.warn.mockClear()
    mockSettingsStore.personalization = {}
})

describe('checkAutoSummary - 基础守卫', () => {
    it('不存在的 chatId 直接 return', () => {
        const { checkAutoSummary } = setup({ autoSummary: true, msgs: mkMsgs(100) })
        // 不抛错即可
        expect(() => checkAutoSummary('nonexistent')).not.toThrow()
    })

    it('autoSummary 未开启时不触发', async () => {
        const { checkAutoSummary, triggerToast } = setup({ msgs: mkMsgs(100) })
        await checkAutoSummary('c1')
        // summarizeHistory 不被调用,也就不会有 triggerToast('正在分析上下文...')
        expect(triggerToast).not.toHaveBeenCalled()
    })

    it('autoSummary=false 时不触发', async () => {
        const { checkAutoSummary, triggerToast } = setup({ autoSummary: false, msgs: mkMsgs(100) })
        await checkAutoSummary('c1')
        expect(triggerToast).not.toHaveBeenCalled()
    })

    it('群组 chat 走 groupSettings.autoSummary', async () => {
        const { checkAutoSummary, triggerToast } = setup({
            isGroup: true,
            msgs: mkMsgs(100),
            groupSettings: { autoSummary: true }
        })
        await checkAutoSummary('c1')
        // silent 模式不弹 toast
        expect(triggerToast).not.toHaveBeenCalled()
        // 但有调用 generateReply
        expect(mockGenerateReply).toHaveBeenCalled()
    })

    it('isSummarizing 为 true 时跳过', async () => {
        const { checkAutoSummary } = setup({
            autoSummary: true,
            isSummarizing: true,
            msgs: mkMsgs(100)
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).not.toHaveBeenCalled()
    })
})

describe('checkAutoSummary - 触发条件', () => {
    it('backlog < summaryLimit 时不触发', async () => {
        // 10 轮 (20 条消息),summaryLimit 默认 50
        const { checkAutoSummary } = setup({
            autoSummary: true,
            msgs: mkMsgs(10),
            lastSummaryIndex: 0
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).not.toHaveBeenCalled()
    })

    it('backlog >= summaryLimit 时触发', async () => {
        // 60 轮 (120 条消息),summaryLimit 默认 50
        const { checkAutoSummary } = setup({
            autoSummary: true,
            msgs: mkMsgs(60),
            lastSummaryIndex: 0
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).toHaveBeenCalled()
    })

    it('已总结的 lastSummaryIndex 后的 backlog 才算数', async () => {
        // 100 轮消息,前 80 轮已总结
        // 剩余 20 轮 < 默认 50,不触发
        const { checkAutoSummary } = setup({
            autoSummary: true,
            msgs: mkMsgs(100),
            lastSummaryIndex: 160 // 80 * 2
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).not.toHaveBeenCalled()
    })

    it('lastSummaryIndex 未设置时按 0 算', async () => {
        const { checkAutoSummary } = setup({
            autoSummary: true,
            msgs: mkMsgs(60)
            // lastSummaryIndex 未设
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).toHaveBeenCalled()
    })

    it('chat.summaryLimit 优先生效', async () => {
        // 10 轮,自定义 limit=5
        // backlog=10 >= 5,触发
        const { checkAutoSummary } = setup({
            autoSummary: true,
            summaryLimit: 5,
            msgs: mkMsgs(10)
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).toHaveBeenCalled()
    })
})

describe('checkAutoSummary - summaryLimit 优先级', () => {
    it('默认 50(全部未配置时)', async () => {
        // 49 轮 -> backlog 49 < 50,不应触发
        const { checkAutoSummary } = setup({
            autoSummary: true,
            msgs: mkMsgs(49)
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).not.toHaveBeenCalled()
    })

    it('chat.summaryLimit 覆盖默认', async () => {
        // chat.summaryLimit=3, 5 轮 backlog=5 >= 3 -> 触发
        const { checkAutoSummary } = setup({
            autoSummary: true,
            summaryLimit: 3,
            msgs: mkMsgs(5)
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).toHaveBeenCalled()
    })

    it('群组 memory.autoSummaryEvery 生效(当 chat.summaryLimit 不存在时)', async () => {
        // 群组 + memory.autoSummaryEvery=3 + 5 轮
        // chat.summaryLimit 未设(NaN falsy),走 groupSettings.memory.autoSummaryEvery=3
        const { checkAutoSummary } = setup({
            isGroup: true,
            autoSummary: true,
            msgs: mkMsgs(5),
            groupSettings: {
                autoSummary: true,
                memory: { autoSummaryEvery: 3 }
            }
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).toHaveBeenCalled()
    })

    it('群组 summaryLimit 生效(当 chat.summaryLimit 和 memory.autoSummaryEvery 都不存在时)', async () => {
        const { checkAutoSummary } = setup({
            isGroup: true,
            autoSummary: true,
            msgs: mkMsgs(3),
            groupSettings: {
                autoSummary: true,
                summaryLimit: 2
            }
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).toHaveBeenCalled()
    })

    it('personalization.summaryLimit 兜底', async () => {
        mockSettingsStore.personalization = { summaryLimit: 2 }
        // 3 轮,personalization.summaryLimit=2
        const { checkAutoSummary } = setup({
            autoSummary: true,
            msgs: mkMsgs(3)
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).toHaveBeenCalled()
    })

    it('chat.summaryLimit 优先于 personalization', async () => {
        // personalization=2, chat.summaryLimit=100
        // 3 轮 backlog=3, < 100 -> 不触发
        mockSettingsStore.personalization = { summaryLimit: 2 }
        const { checkAutoSummary } = setup({
            autoSummary: true,
            summaryLimit: 100,
            msgs: mkMsgs(3)
        })
        await checkAutoSummary('c1')
        expect(mockGenerateReply).not.toHaveBeenCalled()
    })
})

describe('checkAutoSummary - lastIndex 越界处理', () => {
    it('lastSummaryIndex > msgs.length 时重置为 msgs.length', async () => {
        // 10 轮 = 20 条消息,但 lastIndex=100,被重置为 20
        // backlog=0,不触发
        const { checkAutoSummary, chat } = setup({
            autoSummary: true,
            msgs: mkMsgs(10),
            lastSummaryIndex: 100
        })
        await checkAutoSummary('c1')
        // 重置为 msgs.length = 20
        expect(chat.lastSummaryIndex).toBe(20)
        expect(mockGenerateReply).not.toHaveBeenCalled()
    })

    it('lastSummaryIndex 略大于 msgs.length 仍重置', async () => {
        const { checkAutoSummary, chat } = setup({
            autoSummary: true,
            msgs: mkMsgs(10),
            lastSummaryIndex: 21
        })
        await checkAutoSummary('c1')
        expect(chat.lastSummaryIndex).toBe(20)
    })
})

describe('checkAutoSummary - silent 模式', () => {
    it('触发时不弹"正在分析上下文..."toast', async () => {
        const { checkAutoSummary, triggerToast } = setup({
            autoSummary: true,
            msgs: mkMsgs(60)
        })
        await checkAutoSummary('c1')
        // silent 模式不弹任何 toast(最终 success 时也不弹)
        const messages = triggerToast.mock.calls.map(c => c[0])
        expect(messages).not.toContain('正在分析上下文...')
    })
})
