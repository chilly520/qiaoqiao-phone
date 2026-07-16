/**
 * 这个测试套件验证 summarizeHistory 中"选取总结范围"的关键分支逻辑。
 * 不直接调用 summarizeHistory（它需要完整的 Pinia store 和 AI service），
 * 而是把分支逻辑单独抽出来测试，确保不会因为参数错误走进错误分支。
 *
 * 复现的 bug 场景：
 * 1. v1.10.130 之前: 选日期点总结,startDate/endDate 被忽略,走进自动增量分支
 * 2. v1.10.128 之前: 按轮次范围点总结,startTurn/endTurn 被忽略
 */
import { describe, it, expect } from 'vitest'
import {
    dateRangeToMsgIndices,
    turnRangeToMsgIndices,
    countTurnsBetween,
    getTurnBoundaries
} from '../src/utils/common'
import { makeMsgs } from './helpers'

// 模拟 summarizeHistory 的范围选择逻辑（与 chatHistory.js 中的代码路径一致）
function selectRange(msgs, options = {}) {
    if (options.startDate && options.endDate) {
        const idxRange = dateRangeToMsgIndices(msgs, options.startDate, options.endDate)
        if (!idxRange) return { error: 'DATE_RANGE_EMPTY' }
        const targetMsgs = msgs.slice(idxRange.startIndex, idxRange.endIndex)
        const turnCount = countTurnsBetween(msgs, idxRange.startIndex, idxRange.endIndex)
        return {
            mode: 'date',
            targetMsgs,
            rangeDesc: `日期 ${options.startDate}~${options.endDate} (${turnCount}轮, 消息 ${idxRange.startIndex + 1}-${idxRange.endIndex})`
        }
    }

    if (options.startTurn !== undefined && options.endTurn !== undefined) {
        const idxRange = turnRangeToMsgIndices(msgs, options.startTurn, options.endTurn)
        if (!idxRange) return { error: 'TURN_RANGE_OUT_OF_RANGE' }
        const targetMsgs = msgs.slice(idxRange.startIndex, idxRange.endIndex)
        return {
            mode: 'turn',
            targetMsgs,
            rangeDesc: `轮次 ${options.startTurn}-${options.endTurn} (消息 ${idxRange.startIndex + 1}-${idxRange.endIndex})`
        }
    }

    if (options.startIndex !== undefined && options.endIndex !== undefined) {
        const start = Math.max(0, options.startIndex)
        const end = Math.min(msgs.length, options.endIndex)
        const targetMsgs = msgs.slice(start, end)
        return {
            mode: 'index',
            targetMsgs,
            rangeDesc: `消息 ${start + 1}-${end}`
        }
    }

    // Auto mode
    return {
        mode: 'auto',
        targetMsgs: msgs,
        rangeDesc: '自动增量'
    }
}

describe('summarizeHistory 范围选择', () => {
    // 模拟真实场景: 5 月有 30 天, 用户选 5/8 总结
    const realWorldMsgs = (() => {
        const items = []
        for (let d = 1; d <= 31; d++) {
            const day = `2026-05-${String(d).padStart(2, '0')}`
            // 每天 5 轮对话
            for (let r = 0; r < 5; r++) {
                items.push({ day, role: 'user', hour: 9 + r })
                items.push({ day, role: 'assistant', hour: 9 + r, minute: 5 })
            }
        }
        return makeMsgs(items)
    })()

    it('【关键场景】选 5/8 总结:必须只包含 5/8 的消息(防止走进自动增量)', () => {
        const r = selectRange(realWorldMsgs, { startDate: '2026-05-08', endDate: '2026-05-08' })
        expect(r.mode).toBe('date')
        // 5/8 是第 8 天,前面 7 天每天 10 条 = 70 条, 5/8 本身 10 条
        expect(r.targetMsgs).toHaveLength(10)
        // 每条都应该是 5/8
        for (const m of r.targetMsgs) {
            const d = new Date(m.timestamp)
            expect(d.getDate()).toBe(8)
            expect(d.getMonth() + 1).toBe(5)
        }
    })

    it('【关键场景】选 5/7~5/9 总结:跨 3 天', () => {
        const r = selectRange(realWorldMsgs, { startDate: '2026-05-07', endDate: '2026-05-09' })
        expect(r.mode).toBe('date')
        expect(r.targetMsgs).toHaveLength(30)  // 3 天 * 10 条
    })

    it('【回归】选 5/8 + 5/8 应该等于单日,不是从开头取', () => {
        const r = selectRange(realWorldMsgs, { startDate: '2026-05-08', endDate: '2026-05-08' })
        // 不能返回整个数组
        expect(r.targetMsgs.length).toBeLessThan(realWorldMsgs.length)
    })

    it('范围描述必须明确包含"日期"字样(便于用户辨别)', () => {
        const r = selectRange(realWorldMsgs, { startDate: '2026-05-08', endDate: '2026-05-08' })
        expect(r.rangeDesc).toContain('日期')
        expect(r.rangeDesc).toContain('2026-05-08')
    })

    it('【回归】不传任何参数:走自动模式(向后兼容)', () => {
        const r = selectRange(realWorldMsgs, {})
        expect(r.mode).toBe('auto')
    })

    it('传 startIndex/endIndex 单独使用:走索引模式', () => {
        const r = selectRange(realWorldMsgs, { startIndex: 0, endIndex: 10 })
        expect(r.mode).toBe('index')
        expect(r.targetMsgs).toHaveLength(10)
    })

    it('【回归】startDate 优先于 startIndex(如果都传)', () => {
        const r = selectRange(realWorldMsgs, {
            startDate: '2026-05-08', endDate: '2026-05-08',
            startIndex: 0, endIndex: 999
        })
        expect(r.mode).toBe('date')
        expect(r.targetMsgs.length).toBeLessThan(999)
    })

    it('范围内无消息:返回 error,不应崩溃', () => {
        const r = selectRange(realWorldMsgs, { startDate: '2026-06-01', endDate: '2026-06-30' })
        expect(r.error).toBe('DATE_RANGE_EMPTY')
    })

    it('【关键场景】startTurn/endTurn:按轮次范围取', () => {
        const r = selectRange(realWorldMsgs, { startTurn: 1, endTurn: 2 })
        expect(r.mode).toBe('turn')
        expect(r.targetMsgs.length).toBeGreaterThan(0)
    })

    it('【关键场景】startTurn 超出范围:返回 error', () => {
        const r = selectRange(realWorldMsgs, { startTurn: 1000, endTurn: 1001 })
        expect(r.error).toBe('TURN_RANGE_OUT_OF_RANGE')
    })
})
