import { describe, it, expect } from 'vitest'
import { turnRangeToMsgIndices, countTurnsBetween, getLastNTurns, getTurnBoundaries } from '../src/utils/common'
import { makeMsgs } from './helpers'

describe('getTurnBoundaries', () => {
    it('3 轮对话:返回 3 个边界', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' },
            { day: '2026-05-02', role: 'assistant' },
            { day: '2026-05-03', role: 'user' },
            { day: '2026-05-03', role: 'assistant' }
        ])
        const b = getTurnBoundaries(msgs)
        expect(b).toHaveLength(3)
        expect(b[0]).toEqual({ start: 0, end: 2 })
        expect(b[1]).toEqual({ start: 2, end: 4 })
        expect(b[2]).toEqual({ start: 4, end: 6 })
    })

    it('未完成轮(无 AI 回复):不计入', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' }  // 没有 AI 回复
        ])
        const b = getTurnBoundaries(msgs)
        expect(b).toHaveLength(1)
        expect(b[0]).toEqual({ start: 0, end: 2 })
    })

    it('一轮包含多条 AI 回复(分段消息):边界仍正确', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-01', role: 'assistant' },  // 同轮 AI 第二段
            { day: '2026-05-01', role: 'assistant' }
        ])
        const b = getTurnBoundaries(msgs)
        expect(b).toHaveLength(1)
        expect(b[0]).toEqual({ start: 0, end: 4 })
    })
})

describe('countTurnsBetween', () => {
    it('2 轮对话:返回 2', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' },
            { day: '2026-05-02', role: 'assistant' }
        ])
        expect(countTurnsBetween(msgs, 0, 4)).toBe(2)
    })

    it('部分范围:只统计范围内', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' },
            { day: '2026-05-02', role: 'assistant' },
            { day: '2026-05-03', role: 'user' },
            { day: '2026-05-03', role: 'assistant' }
        ])
        // 只取中间 1 轮
        expect(countTurnsBetween(msgs, 2, 4)).toBe(1)
    })

    it('未完成轮(无 AI 回复):不计入', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-02', role: 'user' }
        ])
        expect(countTurnsBetween(msgs, 0, 2)).toBe(0)
    })
})

describe('turnRangeToMsgIndices', () => {
    it('取第 1-2 轮:返回正确索引', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' },
            { day: '2026-05-02', role: 'assistant' },
            { day: '2026-05-03', role: 'user' },
            { day: '2026-05-03', role: 'assistant' }
        ])
        const r = turnRangeToMsgIndices(msgs, 1, 2)
        expect(r).toEqual({ startIndex: 0, endIndex: 4 })
    })

    it('取第 2-3 轮:跳过第 1 轮', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' },
            { day: '2026-05-02', role: 'assistant' },
            { day: '2026-05-03', role: 'user' },
            { day: '2026-05-03', role: 'assistant' }
        ])
        const r = turnRangeToMsgIndices(msgs, 2, 3)
        expect(r).toEqual({ startIndex: 2, endIndex: 6 })
    })

    it('超出范围(startTurn 过大):返回 null', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' }
        ])
        const r = turnRangeToMsgIndices(msgs, 5, 10)
        expect(r).toBeNull()
    })

    it('endTurn 超出实际轮数:截到最大', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' },
            { day: '2026-05-02', role: 'assistant' }
        ])
        const r = turnRangeToMsgIndices(msgs, 1, 100)
        expect(r).toEqual({ startIndex: 0, endIndex: 4 })
    })

    it('空消息数组:返回 null', () => {
        expect(turnRangeToMsgIndices([], 1, 1)).toBeNull()
    })
})

describe('getLastNTurns', () => {
    it('取最后 1 轮', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-02', role: 'user' },
            { day: '2026-05-02', role: 'assistant' }
        ])
        const last = getLastNTurns(msgs, 1)
        expect(last).toHaveLength(2)
        expect(last[0].role).toBe('user')
    })

    it('取轮数超过实际:返回全部', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' }
        ])
        const last = getLastNTurns(msgs, 10)
        expect(last).toHaveLength(2)
    })

    it('turnCount 为 0:返回空', () => {
        const msgs = makeMsgs([{ day: '2026-05-01', role: 'user' }])
        expect(getLastNTurns(msgs, 0)).toEqual([])
    })
})
