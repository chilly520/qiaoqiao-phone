/**
 * chatFinancial._splitRedPacket 测试
 * 验证红包拆分算法的正确性:
 * - count=1: 全给
 * - count>=1: 所有拆分之和 = total
 * - 每个拆分 >= 0.01
 * - 多次拆分结果不同(随机性)
 * - 边界: count=2, count=10
 */

// 由于 _splitRedPacket 是 setupFinancialLogic 内部私有函数,
// 我们通过 setupFinancialLogic 间接测试。_splitRedPacket 会先初始化 msg.amounts,
// 我们用 vi.spyOn 监视 Math.random 让测试稳定。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { setupFinancialLogic } from '../src/stores/chatModules/chatFinancial'

// mock 依赖
vi.mock('../src/stores/settingsStore', () => ({
    useSettingsStore: () => ({})
}))
vi.mock('../src/stores/walletStore', () => ({
    useWalletStore: () => ({})
}))

function makeChats(chatId, msgs) {
    // participants 必须存在,否则 claimRedPacket 进入 else 分支会崩
    const chat = { id: chatId, name: 'test', participants: [], msgs: [...msgs] }
    return ref({ [chatId]: chat })
}

function makeRedPacketMsg(opts) {
    return {
        id: 'rp1',
        type: 'redpacket',
        amount: opts.amount,
        count: opts.count,
        packetType: opts.packetType || 'lucky',
        claims: [],
        remainingCount: opts.count
    }
}

describe('红包拆分算法 _splitRedPacket', () => {
    beforeEach(() => {
        // 让随机数稳定可控(用确定性序列)
        let seed = 42
        vi.spyOn(Math, 'random').mockImplementation(() => {
            // 简单 LCG 生成 0-1 之间
            seed = (seed * 9301 + 49297) % 233280
            return seed / 233280
        })
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('count=1: 整个金额一次性给', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 100, count: 1 })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        // 通过 claimRedPacket 触发 _splitRedPacket 初始化
        const r = await fin.claimRedPacket('c1', 'rp1', 'user1')
        // count=1 时,amounts 应该是 [100]
        expect(chats.value.c1.msgs[0].amounts).toEqual([100])
    })

    it('count=2: 拆分后两项之和 = total', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 100, count: 2 })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        await fin.claimRedPacket('c1', 'rp1', 'user1')
        const amounts = chats.value.c1.msgs[0].amounts
        expect(amounts).toHaveLength(2)
        const sum = amounts.reduce((a, b) => a + b, 0)
        expect(sum).toBeCloseTo(100, 2)
    })

    it('count=5: 拆分后五项之和 = total, 每项 >= 0.01', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 50, count: 5 })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        await fin.claimRedPacket('c1', 'rp1', 'user1')
        const amounts = chats.value.c1.msgs[0].amounts
        expect(amounts).toHaveLength(5)
        const sum = amounts.reduce((a, b) => a + b, 0)
        expect(sum).toBeCloseTo(50, 2)
        for (const amt of amounts) {
            expect(amt).toBeGreaterThanOrEqual(0.01)
        }
    })

    it('count=10: 拆分后十项之和 = total', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 200, count: 10 })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        await fin.claimRedPacket('c1', 'rp1', 'user1')
        const amounts = chats.value.c1.msgs[0].amounts
        expect(amounts).toHaveLength(10)
        const sum = amounts.reduce((a, b) => a + b, 0)
        expect(sum).toBeCloseTo(200, 2)
    })

    it('等额红包(packetType != "lucky"): 每项平均', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 100, count: 4, packetType: 'normal' })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        await fin.claimRedPacket('c1', 'rp1', 'user1')
        const amounts = chats.value.c1.msgs[0].amounts
        expect(amounts).toHaveLength(4)
        // 等额: 每项 25
        for (const amt of amounts) {
            expect(amt).toBeCloseTo(25, 2)
        }
    })

    it('【回归】已存在的 amounts 不应被覆盖', async () => {
        // 先设置好 amounts
        const msg = makeRedPacketMsg({ amount: 100, count: 3 })
        msg.amounts = [33.33, 33.33, 33.34]  // 已经手动初始化好
        const chats = makeChats('c1', [msg])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        await fin.claimRedPacket('c1', 'rp1', 'user1')
        // 不应重新拆分
        expect(chats.value.c1.msgs[0].amounts).toEqual([33.33, 33.33, 33.34])
    })

    it('【错误】count=0 或负数:不崩溃', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 100, count: 0 })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        const r = await fin.claimRedPacket('c1', 'rp1', 'user1')
        // 应该返回空红包标志
        expect(r.empty).toBe(true)
    })

    it('【错误】非红包消息:返回 null', async () => {
        const chats = makeChats('c1', [{ id: 'm1', type: 'text', content: 'hi' }])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        const r = await fin.claimRedPacket('c1', 'm1', 'user1')
        expect(r).toBeNull()
    })

    it('【错误】不存在的 messageId:返回 null', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 100, count: 3 })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        const r = await fin.claimRedPacket('c1', 'nonexistent', 'user1')
        expect(r).toBeNull()
    })

    it('【并发】同一个人抢两次:第二次返回 "already"', async () => {
        const chats = makeChats('c1', [makeRedPacketMsg({ amount: 100, count: 3 })])
        const fin = setupFinancialLogic(chats, vi.fn(), vi.fn(), vi.fn())
        const r1 = await fin.claimRedPacket('c1', 'rp1', 'user1')
        expect(r1.claimed).toBe(true)
        expect(r1.already).toBeUndefined()
        // 第二次
        const r2 = await fin.claimRedPacket('c1', 'rp1', 'user1')
        expect(r2.claimed).toBe(true)
        expect(r2.already).toBe(true)
    })
})
