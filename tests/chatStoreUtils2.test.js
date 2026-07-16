/**
 * chatStore 工具方法 2 - 续
 * 验证:
 * - createChat
 * - createGroupChat
 * - clearAllChats
 * - acceptPendingRequest (friend / group_invite 两种类型)
 * - rejectPendingRequest
 * - triggerPatEffect
 * - playSound (音效映射)
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

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

// =====================================
// createChat
// =====================================
describe('chatStore - createChat', () => {
    it('创建新 chat 并放入 chats', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice')
        expect(store.chats[chat.id]).toBeDefined()
        expect(store.chats[chat.id].name).toBe('Alice')
    })

    it('返回创建的 chat 对象', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice')
        expect(chat.name).toBe('Alice')
        expect(chat.msgs).toEqual([])
    })

    it('生成 id 包含 "c-" 前缀', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice')
        expect(chat.id).toMatch(/^c-/)
    })

    it('options.avatar 自定义头像', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice', { avatar: '/custom.jpg' })
        expect(chat.avatar).toBe('/custom.jpg')
    })

    it('options.prompt 自定义 prompt', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice', { prompt: '你是 Alice' })
        expect(chat.prompt).toBe('你是 Alice')
    })

    it('默认 isPinned=false / unreadCount=0 / inChatList=true', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice')
        expect(chat.isPinned).toBe(false)
        expect(chat.unreadCount).toBe(0)
        expect(chat.inChatList).toBe(true)
    })

    it('默认 isGroup=false / showInnerVoice=true', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice')
        expect(chat.isGroup).toBe(false)
        expect(chat.showInnerVoice).toBe(true)
    })

    it('默认 bio 结构', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice')
        expect(chat.bio.gender).toBe('未知')
        expect(chat.bio.routine.awake).toBe('未知')
    })

    it('options.id 自定义 id 生效', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice', { id: 'myid' })
        expect(chat.id).toBe('myid')
    })

    it('同 id 已存在则不创建,返回已有的', () => {
        const store = useChatStore()
        const c1 = store.createChat('Alice', { id: 'same' })
        const c2 = store.createChat('Bob', { id: 'same' })
        // Pinia 用 reactive proxy,引用不一定相等,内容一致即可
        expect(c2.id).toBe(c1.id)
        expect(store.chats['same'].name).toBe('Alice')
    })

    it('options.tags 传递', () => {
        const store = useChatStore()
        const chat = store.createChat('Alice', { tags: ['a', 'b'] })
        expect(chat.tags).toEqual(['a', 'b'])
    })

    it('options.isGroup=true 标记为群组', () => {
        const store = useChatStore()
        const chat = store.createChat('Group', { isGroup: true })
        expect(chat.isGroup).toBe(true)
    })
})

// =====================================
// createGroupChat
// =====================================
describe('chatStore - createGroupChat', () => {
    it('创建新群聊', () => {
        const store = useChatStore()
        const chat = store.createGroupChat({ name: 'TeamA' })
        expect(store.chats[chat.id]).toBeDefined()
        expect(chat.isGroup).toBe(true)
        expect(chat.name).toBe('TeamA')
    })

    it('默认名"新建群聊"', () => {
        const store = useChatStore()
        const chat = store.createGroupChat()
        expect(chat.name).toBe('新建群聊')
    })

    it('id 以 "g-" 开头', () => {
        const store = useChatStore()
        const chat = store.createGroupChat()
        expect(chat.id).toMatch(/^g-/)
    })

    it('groupProfile 自动生成', () => {
        const store = useChatStore()
        const chat = store.createGroupChat()
        expect(chat.groupProfile).toBeDefined()
        expect(chat.groupProfile.groupNo).toMatch(/^G\d{6}$/)
    })

    it('自定义 groupProfile', () => {
        const store = useChatStore()
        const chat = store.createGroupChat({
            groupProfile: { groupNo: 'G999999', name: 'X' }
        })
        expect(chat.groupProfile.groupNo).toBe('G999999')
    })

    it('participants 默认 []', () => {
        const store = useChatStore()
        const chat = store.createGroupChat()
        expect(chat.participants).toEqual([])
    })

    it('lastSummaryIndex 默认为 0', () => {
        const store = useChatStore()
        const chat = store.createGroupChat()
        expect(chat.lastSummaryIndex).toBe(0)
    })

    it('options.id 自定义', () => {
        const store = useChatStore()
        const chat = store.createGroupChat({ id: 'g-custom' })
        expect(chat.id).toBe('g-custom')
    })
})

// =====================================
// clearAllChats
// =====================================
describe('chatStore - clearAllChats', () => {
    it('清空所有 chat 的 msgs', () => {
        const store = useChatStore()
        store.chats.c1 = { id: 'c1', msgs: [{ id: 'm1' }] }
        store.chats.c2 = { id: 'c2', msgs: [{ id: 'm2' }] }
        store.clearAllChats()
        expect(store.chats.c1.msgs).toEqual([])
        expect(store.chats.c2.msgs).toEqual([])
    })

    it('保留 chat 本身,只清空消息', () => {
        const store = useChatStore()
        store.chats.c1 = { id: 'c1', name: 'X', msgs: [{ id: 'm1' }] }
        store.clearAllChats()
        expect(store.chats.c1).toBeDefined()
        expect(store.chats.c1.name).toBe('X')
    })

    it('空 chats 不报错', () => {
        const store = useChatStore()
        expect(() => store.clearAllChats()).not.toThrow()
    })
})

// =====================================
// acceptPendingRequest
// =====================================
describe('chatStore - acceptPendingRequest', () => {
    it('不存在的 requestId 直接 return', () => {
        const store = useChatStore()
        store.pendingRequests = [{ id: 'r1' }]
        store.acceptPendingRequest('nonexistent')
        // pendingRequests 不变
        expect(store.pendingRequests.length).toBe(1)
    })

    it('好友请求:updateCharacter + 删除请求', async () => {
        const store = useChatStore()
        store.chats.c1 = { id: 'c1', name: 'Bob', inChatList: false }
        store.pendingRequests = [{
            id: 'r1', type: 'friend', fromId: 'c1', fromName: 'Bob', targetId: 'c1', targetName: 'Bob'
        }]
        await store.acceptPendingRequest('r1')
        expect(store.chats.c1.inChatList).toBe(true)
        expect(store.pendingRequests.length).toBe(0)
    })

    it('好友请求:triggerToast "已添加好友: <name>"', async () => {
        const store = useChatStore()
        store.chats.c1 = { id: 'c1', name: 'Bob', inChatList: false }
        store.pendingRequests = [{
            id: 'r1', type: 'friend', fromId: 'c1', fromName: '小明', targetId: 'c1', targetName: '小明'
        }]
        await store.acceptPendingRequest('r1')
        expect(store.toastEvent.message).toBe('已添加好友: 小明')
        expect(store.toastEvent.type).toBe('success')
    })

    it('群组邀请:updateCharacter + 设置 inChatList + isExited=false', async () => {
        const store = useChatStore()
        store.chats.g1 = { id: 'g1', name: 'TeamA', inChatList: false, isExited: true }
        store.pendingRequests = [{
            id: 'r2', type: 'group_invite', fromId: 'u1', fromName: 'U1', targetId: 'g1', targetName: 'TeamA'
        }]
        await store.acceptPendingRequest('r2')
        expect(store.chats.g1.inChatList).toBe(true)
        expect(store.chats.g1.isExited).toBe(false)
        expect(store.pendingRequests.length).toBe(0)
    })

    it('群组邀请:triggerToast "已加入群聊: <name>"', async () => {
        const store = useChatStore()
        store.chats.g1 = { id: 'g1', name: 'TeamA', inChatList: false, isExited: true }
        store.pendingRequests = [{
            id: 'r2', type: 'group_invite', fromId: 'u1', fromName: 'U1', targetId: 'g1', targetName: 'TeamA'
        }]
        await store.acceptPendingRequest('r2')
        expect(store.toastEvent.message).toBe('已加入群聊: TeamA')
        expect(store.toastEvent.type).toBe('success')
    })

    it('从 pendingRequests 中只删除匹配的 id', async () => {
        const store = useChatStore()
        store.chats.c1 = { id: 'c1', inChatList: false }
        store.chats.c2 = { id: 'c2', inChatList: false }
        store.pendingRequests = [
            { id: 'r1', type: 'friend', fromId: 'c1', fromName: 'A' },
            { id: 'r2', type: 'friend', fromId: 'c2', fromName: 'B' },
            { id: 'r3', type: 'friend', fromId: 'c3', fromName: 'C' }
        ]
        await store.acceptPendingRequest('r2')
        expect(store.pendingRequests.map(r => r.id)).toEqual(['r1', 'r3'])
    })
})

// =====================================
// rejectPendingRequest
// =====================================
describe('chatStore - rejectPendingRequest', () => {
    it('从 pendingRequests 中删除指定项', () => {
        const store = useChatStore()
        store.pendingRequests = [
            { id: 'r1' }, { id: 'r2' }, { id: 'r3' }
        ]
        store.rejectPendingRequest('r2')
        expect(store.pendingRequests.map(r => r.id)).toEqual(['r1', 'r3'])
    })

    it('triggerToast "已拒绝申请"', () => {
        const store = useChatStore()
        store.pendingRequests = [{ id: 'r1' }]
        store.rejectPendingRequest('r1')
        expect(store.toastEvent.message).toBe('已拒绝申请')
        expect(store.toastEvent.type).toBe('info')
    })

    it('不存在的 id 仍触发 toast', () => {
        const store = useChatStore()
        store.pendingRequests = [{ id: 'r1' }]
        store.rejectPendingRequest('nonexistent')
        // pendingRequests 不变,toast 仍触发
        expect(store.pendingRequests.length).toBe(1)
        expect(store.toastEvent.message).toBe('已拒绝申请')
    })
})

// =====================================
// triggerPatEffect
// =====================================
describe('chatStore - triggerPatEffect', () => {
    it('设置 patEvent', () => {
        const store = useChatStore()
        store.triggerPatEffect('c1', { x: 100, y: 200 })
        expect(store.patEvent.chatId).toBe('c1')
        expect(store.patEvent.target).toEqual({ x: 100, y: 200 })
    })

    it('patEvent.id 是数字', () => {
        const store = useChatStore()
        store.triggerPatEffect('c1', { x: 0, y: 0 })
        expect(typeof store.patEvent.id).toBe('number')
    })

    it('每次调用 id 变化(以便触发响应)', async () => {
        const store = useChatStore()
        store.triggerPatEffect('c1', { x: 0, y: 0 })
        const id1 = store.patEvent.id
        // 等 5ms 让 id 变
        await new Promise(r => setTimeout(r, 5))
        store.triggerPatEffect('c1', { x: 0, y: 0 })
        const id2 = store.patEvent.id
        expect(id2).not.toBe(id1)
    })

    it('支持字符串 target', () => {
        const store = useChatStore()
        store.triggerPatEffect('c1', 'ai')
        expect(store.patEvent.target).toBe('ai')
    })
})

// =====================================
// updateGroupProfile
// =====================================
describe('chatStore - updateGroupProfile', () => {
    it('存在的群组:更新字段并返回 true', () => {
        const store = useChatStore()
        store.chats.g1 = { id: 'g1', name: 'Old', groupProfile: { name: 'Old' } }
        const r = store.updateGroupProfile('g1', { name: 'New' })
        expect(r).toBe(true)
        expect(store.chats.g1.name).toBe('New')
        expect(store.chats.g1.groupProfile.name).toBe('New')
    })

    it('不存在的 chatId 返回 false', () => {
        const store = useChatStore()
        const r = store.updateGroupProfile('nonexistent', { name: 'X' })
        expect(r).toBe(false)
    })

    it('合并 groupProfile 而非覆盖', () => {
        const store = useChatStore()
        store.chats.g1 = { id: 'g1', groupProfile: { name: 'A', announcement: 'B' } }
        store.updateGroupProfile('g1', { name: 'A2' })
        expect(store.chats.g1.groupProfile.name).toBe('A2')
        expect(store.chats.g1.groupProfile.announcement).toBe('B')
    })

    it('无 groupProfile 时初始化为空对象', () => {
        const store = useChatStore()
        store.chats.g1 = { id: 'g1' }
        store.updateGroupProfile('g1', { name: 'X' })
        expect(store.chats.g1.groupProfile.name).toBe('X')
    })
})

// =====================================
// updateGroupParticipants
// =====================================
describe('chatStore - updateGroupParticipants', () => {
    it('存在的群组:更新参与者', () => {
        const store = useChatStore()
        store.chats.g1 = { id: 'g1', participants: [{ id: 'a' }] }
        const r = store.updateGroupParticipants('g1', [{ id: 'b' }, { id: 'c' }])
        expect(r).toBe(true)
        expect(store.chats.g1.participants.length).toBe(2)
    })

    it('不存在的 chatId 返回 false', () => {
        const store = useChatStore()
        const r = store.updateGroupParticipants('nonexistent', [])
        expect(r).toBe(false)
    })

    it('空数组清空参与者', () => {
        const store = useChatStore()
        store.chats.g1 = { id: 'g1', participants: [{ id: 'a' }, { id: 'b' }] }
        store.updateGroupParticipants('g1', [])
        expect(store.chats.g1.participants).toEqual([])
    })
})

// =====================================
// resetCharacter
// =====================================
describe('chatStore - resetCharacter', () => {
    it('不存在的 chatId 静默 return', () => {
        const store = useChatStore()
        expect(() => store.resetCharacter('nonexistent')).not.toThrow()
    })

    it('保留核心身份字段(id / name / avatar / prompt)', () => {
        const store = useChatStore()
        store.chats.c1 = {
            id: 'c1', name: 'Alice', avatar: '/a.jpg', prompt: '我是 Alice', msgs: []
        }
        store.resetCharacter('c1')
        expect(store.chats.c1.id).toBe('c1')
        expect(store.chats.c1.name).toBe('Alice')
        expect(store.chats.c1.avatar).toBe('/a.jpg')
        expect(store.chats.c1.prompt).toBe('我是 Alice')
    })

    it('保留 msgs 消息(不丢失聊天历史)', () => {
        const store = useChatStore()
        const msgs = [{ id: 'm1', content: 'hi' }, { id: 'm2', content: 'hello' }]
        store.chats.c1 = { id: 'c1', name: 'A', msgs }
        store.resetCharacter('c1')
        expect(store.chats.c1.msgs).toEqual(msgs)
    })

    it('保留 memory 和 summary', () => {
        const store = useChatStore()
        store.chats.c1 = {
            id: 'c1', name: 'A', msgs: [],
            memory: ['mem1'], summary: 'sum'
        }
        store.resetCharacter('c1')
        expect(store.chats.c1.memory).toEqual(['mem1'])
        expect(store.chats.c1.summary).toBe('sum')
    })

    it('保留 lastSummaryIndex / lastSummaryCount / lastSummaryTime', () => {
        const store = useChatStore()
        store.chats.c1 = {
            id: 'c1', name: 'A', msgs: [],
            lastSummaryIndex: 100, lastSummaryCount: 50, lastSummaryTime: 12345
        }
        store.resetCharacter('c1')
        expect(store.chats.c1.lastSummaryIndex).toBe(100)
        expect(store.chats.c1.lastSummaryCount).toBe(50)
        expect(store.chats.c1.lastSummaryTime).toBe(12345)
    })

    it('lastSummaryIndex 缺失时默认为 0', () => {
        const store = useChatStore()
        store.chats.c1 = { id: 'c1', name: 'A', msgs: [] }
        store.resetCharacter('c1')
        expect(store.chats.c1.lastSummaryIndex).toBe(0)
        expect(store.chats.c1.lastSummaryCount).toBe(0)
    })

    it('重置 bgUrl / bgBlur / bgOpacity / bgTheme 为默认值', () => {
        const store = useChatStore()
        store.chats.c1 = {
            id: 'c1', name: 'A', msgs: [],
            bgUrl: '/bg.jpg', bgBlur: 10, bgOpacity: 0.9, bgTheme: 'dark'
        }
        store.resetCharacter('c1')
        expect(store.chats.c1.bgUrl).toBe('')
        expect(store.chats.c1.bgBlur).toBe(0)
        expect(store.chats.c1.bgOpacity).toBe(0.5)
        expect(store.chats.c1.bgTheme).toBe('light')
    })

    it('保留 inChatList / isPinned 状态', () => {
        const store = useChatStore()
        store.chats.c1 = {
            id: 'c1', name: 'A', msgs: [],
            inChatList: false, isPinned: true
        }
        store.resetCharacter('c1')
        expect(store.chats.c1.inChatList).toBe(false)
        expect(store.chats.c1.isPinned).toBe(true)
    })
})
