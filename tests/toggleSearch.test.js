/**
 * toggleSearch 单元测试
 * 验证:
 * - 不存在 chat 时直接 return
 * - 默认 searchEnabled=undefined -> 开启后变 true
 * - 开启后再调用 -> 关闭,变 false
 * - 每次都触发 saveChats 和 triggerToast
 * - toast 文案与状态对应
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setupHistoryLogic } from '../src/stores/chatModules/chatHistory'

// 公共 mock
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
})

describe('toggleSearch', () => {
    it('不存在的 chatId 直接 return,不调用 saveChats/triggerToast', () => {
        const { toggleSearch, saveChats, triggerToast } = setup()
        toggleSearch('nonexistent')
        expect(saveChats).not.toHaveBeenCalled()
        expect(triggerToast).not.toHaveBeenCalled()
    })

    it('默认未开启时调用,searchEnabled 变为 true', () => {
        const { toggleSearch, chat, saveChats, triggerToast } = setup()
        // 初始未定义
        expect(chat.searchEnabled).toBeUndefined()
        toggleSearch('c1')
        expect(chat.searchEnabled).toBe(true)
        expect(saveChats).toHaveBeenCalledTimes(1)
        expect(triggerToast).toHaveBeenCalledTimes(1)
    })

    it('开启后再调用,searchEnabled 变为 false', () => {
        const { toggleSearch, chat, saveChats, triggerToast } = setup({ searchEnabled: true })
        toggleSearch('c1')
        expect(chat.searchEnabled).toBe(false)
        expect(saveChats).toHaveBeenCalledTimes(1)
        expect(triggerToast).toHaveBeenCalledTimes(1)
    })

    it('开启时 toast 文案为"已开启联网模式"', () => {
        const { toggleSearch, triggerToast } = setup()
        toggleSearch('c1')
        expect(triggerToast).toHaveBeenCalledWith('🌐 已开启联网模式', 'info')
    })

    it('关闭时 toast 文案为"已关闭联网模式"', () => {
        const { toggleSearch, triggerToast } = setup({ searchEnabled: true })
        toggleSearch('c1')
        expect(triggerToast).toHaveBeenCalledWith('📴 已关闭联网模式', 'info')
    })

    it('反复切换保持反相', () => {
        const { toggleSearch, chat } = setup()
        toggleSearch('c1') // false -> true
        expect(chat.searchEnabled).toBe(true)
        toggleSearch('c1') // true -> false
        expect(chat.searchEnabled).toBe(false)
        toggleSearch('c1') // false -> true
        expect(chat.searchEnabled).toBe(true)
    })

    it('每次调用都触发一次 saveChats', () => {
        const { toggleSearch, saveChats } = setup()
        toggleSearch('c1')
        toggleSearch('c1')
        toggleSearch('c1')
        expect(saveChats).toHaveBeenCalledTimes(3)
    })

    it('不影响其他 chat 的 searchEnabled', () => {
        const chats = ref({
            c1: { id: 'c1', name: 'Alice', msgs: [] },
            c2: { id: 'c2', name: 'Bob', msgs: [], searchEnabled: true }
        })
        const typingStatus = ref({})
        const isProfileProcessing = ref({})
        const triggerToast = vi.fn()
        const saveChats = vi.fn()
        const { toggleSearch } = setupHistoryLogic(chats, typingStatus, isProfileProcessing, vi.fn(), triggerToast, saveChats)
        toggleSearch('c1')
        expect(chats.value.c1.searchEnabled).toBe(true)
        expect(chats.value.c2.searchEnabled).toBe(true) // 不变
    })
})
