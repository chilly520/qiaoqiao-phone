import { describe, it, expect } from 'vitest'
import { dateRangeToMsgIndices } from '../src/utils/common'
import { makeMsgs } from './helpers'

describe('dateRangeToMsgIndices', () => {
    it('单日范围:能正确切片', () => {
        const msgs = makeMsgs([
            { day: '2026-05-07', role: 'user' },
            { day: '2026-05-07', role: 'assistant' },
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' },
            { day: '2026-05-09', role: 'user' }
        ])
        const result = dateRangeToMsgIndices(msgs, '2026-05-08', '2026-05-08')
        expect(result).toEqual({ startIndex: 2, endIndex: 4 })
    })

    it('多日范围:能跨多日', () => {
        const msgs = makeMsgs([
            { day: '2026-05-07', role: 'user' },
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' },
            { day: '2026-05-09', role: 'user' },
            { day: '2026-05-09', role: 'assistant' },
            { day: '2026-05-10', role: 'user' }
        ])
        const result = dateRangeToMsgIndices(msgs, '2026-05-08', '2026-05-09')
        expect(result).toEqual({ startIndex: 1, endIndex: 5 })
    })

    it('范围内无消息:返回 null', () => {
        const msgs = makeMsgs([
            { day: '2026-05-07', role: 'user' },
            { day: '2026-05-10', role: 'user' }
        ])
        const result = dateRangeToMsgIndices(msgs, '2026-05-08', '2026-05-09')
        expect(result).toBeNull()
    })

    it('空消息数组:返回 null', () => {
        expect(dateRangeToMsgIndices([], '2026-05-08', '2026-05-08')).toBeNull()
    })

    it('无效日期字符串:返回 null', () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        expect(dateRangeToMsgIndices(msgs, 'not-a-date', '2026-05-08')).toBeNull()
    })

    it('开始日期晚于结束日期:返回 null', () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        expect(dateRangeToMsgIndices(msgs, '2026-05-09', '2026-05-08')).toBeNull()
    })

    it('缺 startDate 或 endDate:返回 null', () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        expect(dateRangeToMsgIndices(msgs, null, '2026-05-08')).toBeNull()
        expect(dateRangeToMsgIndices(msgs, '2026-05-08', null)).toBeNull()
        expect(dateRangeToMsgIndices(msgs, '', '2026-05-08')).toBeNull()
    })

    it('同一天多条消息:全部包含', () => {
        const msgs = makeMsgs([
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' },
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' }
        ])
        const result = dateRangeToMsgIndices(msgs, '2026-05-08', '2026-05-08')
        expect(result).toEqual({ startIndex: 0, endIndex: 4 })
    })

    it('跨月/跨年范围:正确处理', () => {
        const msgs = makeMsgs([
            { day: '2025-12-30', role: 'user' },
            { day: '2025-12-31', role: 'user' },
            { day: '2026-01-01', role: 'user' },
            { day: '2026-01-02', role: 'user' }
        ])
        const result = dateRangeToMsgIndices(msgs, '2025-12-31', '2026-01-01')
        expect(result).toEqual({ startIndex: 1, endIndex: 3 })
    })

    it('消息缺少 timestamp 字段:跳过该消息', () => {
        const msgs = [
            { id: 'a', role: 'user', content: 'A' },
            { id: 'b', role: 'user', timestamp: new Date('2026-05-08T10:00:00').getTime(), content: 'B' },
            { id: 'c', role: 'user', content: 'C' }  // 无 timestamp
        ]
        const result = dateRangeToMsgIndices(msgs, '2026-05-08', '2026-05-08')
        expect(result).toEqual({ startIndex: 1, endIndex: 2 })
    })
})
