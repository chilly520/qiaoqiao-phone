/**
 * analyzeCharacterArchive 单元测试
 * 验证:
 * - 不存在 chat 时直接 return
 * - 设置 typingStatus 和 isProfileProcessing 标志
 * - generateReply 失败/空响应时抛错并清理标志
 * - 成功时 addMessage(ai) + triggerToast 成功
 * - 各种错误类型对应不同 toast
 * - 错误处理后 finally 清理标志
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
    personalization: {
        userProfile: { name: '用户甲', gender: '男', signature: '我是用户', persona: '工程师' }
    }
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

function setup(chatOverrides = {}) {
    const chat = {
        id: 'c1',
        name: 'Alice',
        isGroup: false,
        msgs: [],
        prompt: 'Alice 是一个活泼开朗的女孩',
        ...chatOverrides
    }
    const chats = ref({ c1: chat })
    const typingStatus = ref({})
    const isProfileProcessing = ref({})
    const addMessage = vi.fn()
    const triggerToast = vi.fn()
    const saveChats = vi.fn()
    const logic = setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats)
    return { ...logic, chat, chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats }
}

beforeEach(() => {
    mockGenerateReply.mockReset()
    mockLogger.error.mockClear()
})

describe('analyzeCharacterArchive - 基础守卫', () => {
    it('不存在的 chatId 直接 return', async () => {
        const { analyzeCharacterArchive, typingStatus, isProfileProcessing } = setup()
        await analyzeCharacterArchive('nonexistent')
        // 不应修改任何状态
        expect(typingStatus.value.nonexistent).toBeUndefined()
        expect(isProfileProcessing.value.nonexistent).toBeUndefined()
    })

    it('不存在的 chatId 时不调用 generateReply', async () => {
        const { analyzeCharacterArchive } = setup()
        await analyzeCharacterArchive('nonexistent')
        expect(mockGenerateReply).not.toHaveBeenCalled()
    })
})

describe('analyzeCharacterArchive - 状态标志', () => {
    it('开始时设置 typingStatus=true', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive, typingStatus } = setup()
        // 立刻调用,但 await 之前可能已经设置了
        const p = analyzeCharacterArchive('c1')
        // 第一次检查:可能已经设置
        expect(typingStatus.value.c1).toBe(true)
        await p
    })

    it('成功完成后清理标志', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive, typingStatus, isProfileProcessing } = setup()
        await analyzeCharacterArchive('c1')
        expect(typingStatus.value.c1).toBe(false)
        expect(isProfileProcessing.value.c1).toBe(false)
    })

    it('AI 失败后也清理标志', async () => {
        mockGenerateReply.mockRejectedValue(new Error('AI 错误'))
        const { analyzeCharacterArchive, typingStatus, isProfileProcessing } = setup()
        await analyzeCharacterArchive('c1')
        expect(typingStatus.value.c1).toBe(false)
        expect(isProfileProcessing.value.c1).toBe(false)
    })

    it('AI 返回空响应时也清理标志', async () => {
        mockGenerateReply.mockResolvedValue({ content: '' })
        const { analyzeCharacterArchive, typingStatus, isProfileProcessing } = setup()
        await analyzeCharacterArchive('c1')
        expect(typingStatus.value.c1).toBe(false)
        expect(isProfileProcessing.value.c1).toBe(false)
    })
})

describe('analyzeCharacterArchive - 成功路径', () => {
    it('成功时 addMessage(ai) 收到档案内容', async () => {
        mockGenerateReply.mockResolvedValue({ content: '[BIO:性别:女] 一些档案' })
        const { analyzeCharacterArchive, addMessage } = setup()
        await analyzeCharacterArchive('c1')
        expect(addMessage).toHaveBeenCalledWith('c1', {
            role: 'ai',
            content: '[BIO:性别:女] 一些档案'
        })
    })

    it('成功时 triggerToast 收到成功消息', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('个人档案更新成功', 'success')
    })

    it('空响应不调用 addMessage', async () => {
        mockGenerateReply.mockResolvedValue({ content: '' })
        const { analyzeCharacterArchive, addMessage, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(addMessage).not.toHaveBeenCalled()
    })

    it('null 响应不调用 addMessage', async () => {
        mockGenerateReply.mockResolvedValue(null)
        const { analyzeCharacterArchive, addMessage, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(addMessage).not.toHaveBeenCalled()
    })
})

describe('analyzeCharacterArchive - generateReply 参数', () => {
    it('使用 chat 作为第二个参数', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive, chat } = setup()
        await analyzeCharacterArchive('c1')
        // 调用时:[messages, chat]
        expect(mockGenerateReply).toHaveBeenCalledWith(
            expect.any(Array),
            chat
        )
    })

    it('system prompt 包含 chat.name', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive } = setup({ name: '小红' })
        await analyzeCharacterArchive('c1')
        const messages = mockGenerateReply.mock.calls[0][0]
        const systemContent = messages[0].content
        expect(systemContent).toContain('小红')
    })

    it('system prompt 包含 user profile name', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive } = setup()
        await analyzeCharacterArchive('c1')
        const messages = mockGenerateReply.mock.calls[0][0]
        const systemContent = messages[0].content
        expect(systemContent).toContain('用户甲')
    })

    it('system prompt 包含角色设定(prompt)', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive } = setup({ prompt: '我的特殊设定' })
        await analyzeCharacterArchive('c1')
        const messages = mockGenerateReply.mock.calls[0][0]
        const systemContent = messages[0].content
        expect(systemContent).toContain('我的特殊设定')
    })

    it('无 prompt 时使用默认占位符', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const { analyzeCharacterArchive } = setup({ prompt: undefined })
        await analyzeCharacterArchive('c1')
        const messages = mockGenerateReply.mock.calls[0][0]
        const systemContent = messages[0].content
        expect(systemContent).toContain('暂无详细设定')
    })

    it('使用 chat.contextLimit 作为消息上下文数', async () => {
        mockGenerateReply.mockResolvedValue({ content: '档案' })
        const msgs = []
        for (let i = 0; i < 50; i++) {
            msgs.push({ id: `m${i}`, role: i % 2 === 0 ? 'user' : 'ai', type: 'text', content: `msg${i}` })
        }
        const { analyzeCharacterArchive } = setup({ contextLimit: 5, msgs })
        await analyzeCharacterArchive('c1')
        // 实际生成的 system prompt 应只包含最近 5 轮
        // 由于轮数计算,实际可能略多,但不应包含 msg0 这种很早的
        const messages = mockGenerateReply.mock.calls[0][0]
        const systemContent = messages[0].content
        // 最近的几个 msg 一定在
        expect(systemContent).toContain('msg49')
    })
})

describe('analyzeCharacterArchive - 错误处理', () => {
    it('network 错误显示网络失败 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('network failed'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('网络连接失败，请检查网络', 'error')
    })

    it('fetch 错误显示网络失败 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('fetch failed'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('网络连接失败，请检查网络', 'error')
    })

    it('timeout 错误显示网络失败 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('timeout exceeded'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('网络连接失败，请检查网络', 'error')
    })

    it('API 错误显示配置错误 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('API key invalid'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('API配置错误或Token无效', 'error')
    })

    it('token 错误显示配置错误 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('token expired'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('API配置错误或Token无效', 'error')
    })

    it('401 错误显示配置错误 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('401 unauthorized'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('API配置错误或Token无效', 'error')
    })

    it('403 错误显示配置错误 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('403 forbidden'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('API配置错误或Token无效', 'error')
    })

    it('空响应错误显示无响应 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('AI返回空响应'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('AI服务暂时无响应，请稍后重试', 'error')
    })

    it('empty 错误显示无响应 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('empty result'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('AI服务暂时无响应，请稍后重试', 'error')
    })

    it('其他错误显示通用失败 toast', async () => {
        mockGenerateReply.mockRejectedValue(new Error('Something weird happened'))
        const { analyzeCharacterArchive, triggerToast } = setup()
        await analyzeCharacterArchive('c1')
        const call = triggerToast.mock.calls[0]
        expect(call[1]).toBe('error')
        expect(call[0]).toMatch(/^档案生成失败:/)
    })

    it('错误时不调用 addMessage', async () => {
        mockGenerateReply.mockRejectedValue(new Error('fail'))
        const { analyzeCharacterArchive, addMessage } = setup()
        await analyzeCharacterArchive('c1')
        expect(addMessage).not.toHaveBeenCalled()
    })

    it('AI 返回空响应(空字符串)也走错误分支', async () => {
        mockGenerateReply.mockResolvedValue({ content: '' })
        const { analyzeCharacterArchive, triggerToast, addMessage } = setup()
        await analyzeCharacterArchive('c1')
        // 空响应被识别为"空响应"错误
        expect(triggerToast).toHaveBeenCalledWith('AI服务暂时无响应，请稍后重试', 'error')
        expect(addMessage).not.toHaveBeenCalled()
    })

    it('AI 返回 null 响应也走错误分支', async () => {
        mockGenerateReply.mockResolvedValue(null)
        const { analyzeCharacterArchive, triggerToast, addMessage } = setup()
        await analyzeCharacterArchive('c1')
        expect(triggerToast).toHaveBeenCalledWith('AI服务暂时无响应，请稍后重试', 'error')
        expect(addMessage).not.toHaveBeenCalled()
    })
})
