/**
 * common.js 单元测试 - 公共数据处理工具
 * 验证:
 * - ensureString: 各种类型转字符串
 * - DEFAULT_AVATARS / getRandomAvatar
 * - 轮次相关: isAIResponse / countTurns / getLastNTurns / countTurnsBetween
 *   / getTurnBoundaries / turnRangeToMsgIndices / getDailyTurnCounts / dateRangeToMsgIndices
 */
import { describe, it, expect } from 'vitest'
import {
    ensureString,
    DEFAULT_AVATARS,
    getRandomAvatar,
    isAIResponse,
    countTurns,
    getLastNTurns,
    countTurnsBetween,
    getTurnBoundaries,
    turnRangeToMsgIndices,
    getDailyTurnCounts,
    dateRangeToMsgIndices
} from '../src/utils/common'

describe('common - ensureString', () => {
    it('null 返回空字符串', () => {
        expect(ensureString(null)).toBe('')
    })

    it('undefined 返回空字符串', () => {
        expect(ensureString(undefined)).toBe('')
    })

    it('字符串原样返回', () => {
        expect(ensureString('hello')).toBe('hello')
    })

    it('空字符串返回空字符串', () => {
        expect(ensureString('')).toBe('')
    })

    it('数字转字符串', () => {
        expect(ensureString(123)).toBe('123')
    })

    it('布尔转字符串', () => {
        expect(ensureString(true)).toBe('true')
    })

    it('0 转字符串', () => {
        expect(ensureString(0)).toBe('0')
    })

    it('字符串数组 join', () => {
        expect(ensureString(['a', 'b', 'c'])).toBe('abc')
    })

    it('对象数组(带 text)', () => {
        expect(ensureString([{ text: 'hello' }, { text: 'world' }])).toBe('helloworld')
    })

    it('对象数组(带 content)', () => {
        expect(ensureString([{ content: 'foo' }, { content: 'bar' }])).toBe('foobar')
    })

    it('混合字符串和对象', () => {
        expect(ensureString(['hi', { text: 'there' }])).toBe('hithere')
    })

    it('数组含 null/数字被转为空字符串', () => {
        expect(ensureString([null, 123, 'text'])).toBe('text')
    })

    it('对象带 text 字段', () => {
        expect(ensureString({ text: 'msg' })).toBe('msg')
    })

    it('对象带 content 字段', () => {
        expect(ensureString({ content: 'msg' })).toBe('msg')
    })

    it('text 优先于 content', () => {
        expect(ensureString({ text: 'a', content: 'b' })).toBe('a')
    })

    it('无 text/content 对象 JSON.stringify', () => {
        const obj = { foo: 'bar' }
        const result = ensureString(obj)
        expect(result).toContain('foo')
        expect(result).toContain('bar')
    })

    it('带循环引用的对象返回 [Object]', () => {
        const obj = {}
        obj.self = obj
        // 应该 catch 错误并返回 [Object]
        expect(ensureString(obj)).toBe('[Object]')
    })
})

describe('common - 头像', () => {
    it('DEFAULT_AVATARS 是非空数组', () => {
        expect(Array.isArray(DEFAULT_AVATARS)).toBe(true)
        expect(DEFAULT_AVATARS.length).toBeGreaterThan(0)
    })

    it('头像都是字符串路径', () => {
        DEFAULT_AVATARS.forEach(a => {
            expect(typeof a).toBe('string')
            expect(a).toMatch(/^\/avatars\//)
        })
    })

    it('getRandomAvatar 返回数组中的元素', () => {
        for (let i = 0; i < 50; i++) {
            const avatar = getRandomAvatar()
            expect(DEFAULT_AVATARS).toContain(avatar)
        }
    })
})

describe('common - 轮次计数', () => {
    describe('isAIResponse', () => {
        it('role=ai 是 AI', () => {
            expect(isAIResponse({ role: 'ai' })).toBe(true)
        })

        it('role=assistant 是 AI', () => {
            expect(isAIResponse({ role: 'assistant' })).toBe(true)
        })

        it('role=user 不是 AI', () => {
            expect(isAIResponse({ role: 'user' })).toBe(false)
        })

        it('null/false 返回 false', () => {
            expect(isAIResponse(null)).toBe(false)
            expect(isAIResponse(false)).toBe(false)
            expect(isAIResponse(undefined)).toBe(false)
        })

        it('空对象返回 false', () => {
            expect(isAIResponse({})).toBe(false)
        })
    })

    describe('countTurns', () => {
        it('空数组返回 0', () => {
            expect(countTurns([])).toBe(0)
        })

        it('null 返回 0', () => {
            expect(countTurns(null)).toBe(0)
        })

        it('undefined 返回 0', () => {
            expect(countTurns(undefined)).toBe(0)
        })

        it('1 轮 = 1 user + 1 ai', () => {
            expect(countTurns([
                { role: 'user' },
                { role: 'ai' }
            ])).toBe(1)
        })

        it('2 轮 = 2 (user, ai) 对', () => {
            expect(countTurns([
                { role: 'user' },
                { role: 'ai' },
                { role: 'user' },
                { role: 'ai' }
            ])).toBe(2)
        })

        it('待回 user 不算轮', () => {
            expect(countTurns([
                { role: 'user' },
                { role: 'ai' },
                { role: 'user' }  // pending
            ])).toBe(1)
        })

        it('只有 user 没 AI 返回 0', () => {
            expect(countTurns([
                { role: 'user' },
                { role: 'user' }
            ])).toBe(0)
        })

        it('多 AI 消息(一轮)只算 1', () => {
            expect(countTurns([
                { role: 'user' },
                { role: 'ai' },
                { role: 'ai' },
                { role: 'ai' }
            ])).toBe(1)
        })

        it('assistant 角色也算 AI', () => {
            expect(countTurns([
                { role: 'user' },
                { role: 'assistant' }
            ])).toBe(1)
        })
    })

    describe('getLastNTurns', () => {
        it('空数组返回空', () => {
            expect(getLastNTurns([], 3)).toEqual([])
        })

        it('turnCount <= 0 返回空', () => {
            expect(getLastNTurns([{ role: 'user' }], 0)).toEqual([])
            expect(getLastNTurns([{ role: 'user' }], -1)).toEqual([])
        })

        it('取最后 1 轮', () => {
            const msgs = [
                { role: 'user', content: 'q1' },
                { role: 'ai', content: 'a1' },
                { role: 'user', content: 'q2' },
                { role: 'ai', content: 'a2' }
            ]
            const result = getLastNTurns(msgs, 1)
            expect(result.length).toBe(2)
            expect(result[0].content).toBe('q2')
        })

        it('取全部轮', () => {
            const msgs = [
                { role: 'user', content: 'q1' },
                { role: 'ai', content: 'a1' }
            ]
            const result = getLastNTurns(msgs, 5)
            expect(result.length).toBe(2)
        })

        it('包含多 AI 的轮', () => {
            const msgs = [
                { role: 'user' },
                { role: 'ai' },
                { role: 'ai' },
                { role: 'user' },
                { role: 'ai' }
            ]
            const result = getLastNTurns(msgs, 1)
            expect(result.length).toBe(2)
        })
    })

    describe('countTurnsBetween', () => {
        it('startIndex >= endIndex 返回 0', () => {
            expect(countTurnsBetween([], 5, 5)).toBe(0)
            expect(countTurnsBetween([], 5, 3)).toBe(0)
        })

        it('范围 1 轮', () => {
            const msgs = [
                { role: 'user' },
                { role: 'ai' }
            ]
            expect(countTurnsBetween(msgs, 0, 2)).toBe(1)
        })

        it('范围 2 轮', () => {
            const msgs = [
                { role: 'user' },
                { role: 'ai' },
                { role: 'user' },
                { role: 'ai' }
            ]
            expect(countTurnsBetween(msgs, 0, 4)).toBe(2)
        })

        it('空范围', () => {
            const msgs = [{ role: 'user' }, { role: 'ai' }]
            expect(countTurnsBetween(msgs, 0, 0)).toBe(0)
        })
    })

    describe('getTurnBoundaries', () => {
        it('空数组返回空数组', () => {
            expect(getTurnBoundaries([])).toEqual([])
        })

        it('1 轮的边界', () => {
            const result = getTurnBoundaries([
                { role: 'user' },
                { role: 'ai' }
            ])
            expect(result).toEqual([{ start: 0, end: 2 }])
        })

        it('2 轮的边界', () => {
            const result = getTurnBoundaries([
                { role: 'user' },
                { role: 'ai' },
                { role: 'user' },
                { role: 'ai' }
            ])
            expect(result).toEqual([
                { start: 0, end: 2 },
                { start: 2, end: 4 }
            ])
        })

        it('包含多 AI 的轮,end 包含全部 AI', () => {
            const result = getTurnBoundaries([
                { role: 'user' },
                { role: 'ai' },
                { role: 'ai' },
                { role: 'ai' }
            ])
            expect(result).toEqual([{ start: 0, end: 4 }])
        })

        it('pending user(无 AI)不形成轮', () => {
            const result = getTurnBoundaries([
                { role: 'user' },
                { role: 'ai' },
                { role: 'user' }  // pending
            ])
            expect(result).toEqual([{ start: 0, end: 2 }])
        })

        it('只有 user 无 AI 返回空', () => {
            expect(getTurnBoundaries([{ role: 'user' }])).toEqual([])
        })
    })

    describe('turnRangeToMsgIndices', () => {
        const msgs = [
            { role: 'user', content: 'q1' },
            { role: 'ai', content: 'a1' },
            { role: 'user', content: 'q2' },
            { role: 'ai', content: 'a2' },
            { role: 'user', content: 'q3' },
            { role: 'ai', content: 'a3' }
        ]

        it('空消息返回 null', () => {
            expect(turnRangeToMsgIndices([], 1, 2)).toBe(null)
        })

        it('取第 1 轮', () => {
            const result = turnRangeToMsgIndices(msgs, 1, 1)
            expect(result).toEqual({ startIndex: 0, endIndex: 2 })
        })

        it('取第 2 轮', () => {
            const result = turnRangeToMsgIndices(msgs, 2, 2)
            expect(result).toEqual({ startIndex: 2, endIndex: 4 })
        })

        it('取第 1-2 轮', () => {
            const result = turnRangeToMsgIndices(msgs, 1, 2)
            expect(result).toEqual({ startIndex: 0, endIndex: 4 })
        })

        it('startTurn > endTurn 返回 null', () => {
            expect(turnRangeToMsgIndices(msgs, 2, 1)).toBe(null)
        })

        it('超出范围的轮次被截断', () => {
            const result = turnRangeToMsgIndices(msgs, 2, 10)
            expect(result.endIndex).toBe(6)
        })
    })

    describe('getDailyTurnCounts', () => {
        it('空数组返回空对象', () => {
            expect(getDailyTurnCounts([])).toEqual({})
        })

        it('按日期统计轮次', () => {
            const msgs = [
                { role: 'user', timestamp: new Date(2024, 0, 1, 10).getTime() },
                { role: 'ai', timestamp: new Date(2024, 0, 1, 10, 1).getTime() },
                { role: 'user', timestamp: new Date(2024, 0, 1, 14).getTime() },
                { role: 'ai', timestamp: new Date(2024, 0, 1, 14, 1).getTime() },
                { role: 'user', timestamp: new Date(2024, 0, 2, 10).getTime() },
                { role: 'ai', timestamp: new Date(2024, 0, 2, 10, 1).getTime() }
            ]
            const result = getDailyTurnCounts(msgs)
            expect(result['2024-01-01']).toBe(2)
            expect(result['2024-01-02']).toBe(1)
        })

        it('无 timestamp 的消息跳过', () => {
            const msgs = [
                { role: 'user' },
                { role: 'ai' }
            ]
            expect(getDailyTurnCounts(msgs)).toEqual({})
        })

        it('未完成轮不计入', () => {
            const msgs = [
                { role: 'user', timestamp: new Date(2024, 0, 1).getTime() },
                { role: 'user', timestamp: new Date(2024, 0, 1).getTime() }
            ]
            expect(getDailyTurnCounts(msgs)).toEqual({})
        })
    })

    describe('dateRangeToMsgIndices', () => {
        const msgs = [
            { timestamp: new Date(2024, 0, 1, 10).getTime(), role: 'user' },
            { timestamp: new Date(2024, 0, 2, 10).getTime(), role: 'user' },
            { timestamp: new Date(2024, 0, 3, 10).getTime(), role: 'user' },
            { timestamp: new Date(2024, 0, 4, 10).getTime(), role: 'user' }
        ]

        it('空数组返回 null', () => {
            expect(dateRangeToMsgIndices([], '2024-01-01', '2024-01-31')).toBe(null)
        })

        it('空 startDate 返回 null', () => {
            expect(dateRangeToMsgIndices(msgs, '', '2024-01-31')).toBe(null)
        })

        it('空 endDate 返回 null', () => {
            expect(dateRangeToMsgIndices(msgs, '2024-01-01', '')).toBe(null)
        })

        it('startDate > endDate 返回 null', () => {
            expect(dateRangeToMsgIndices(msgs, '2024-01-31', '2024-01-01')).toBe(null)
        })

        it('范围内消息', () => {
            const result = dateRangeToMsgIndices(msgs, '2024-01-02', '2024-01-03')
            expect(result).toEqual({ startIndex: 1, endIndex: 3 })
        })

        it('范围外返回 null', () => {
            expect(dateRangeToMsgIndices(msgs, '2025-01-01', '2025-01-31')).toBe(null)
        })

        it('单日范围', () => {
            const result = dateRangeToMsgIndices(msgs, '2024-01-02', '2024-01-02')
            expect(result).toEqual({ startIndex: 1, endIndex: 2 })
        })

        it('endDate 包含当天', () => {
            // endDate 23:59:59.999 应包含
            const result = dateRangeToMsgIndices(msgs, '2024-01-01', '2024-01-01')
            expect(result).toEqual({ startIndex: 0, endIndex: 1 })
        })
    })
})
