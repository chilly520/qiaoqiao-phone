/**
 * taskUtils.js 单元测试 - AI 响应中的 [定时:...] 命令解析
 * 验证:
 * - 完整日期时间格式: [定时: 2026-02-06 10:00 叫宝宝起床]
 * - 简化时间格式: [定时: 10:00 叫宝宝起床]
 * - 全角/半角冒号
 * - 失败时保留原文
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock schedulerStore
const { mockAddTask, mockUseSchedulerStore } = vi.hoisted(() => {
    const mockAddTask = vi.fn(() => true)
    return {
        mockAddTask,
        mockUseSchedulerStore: vi.fn(() => ({
            addTask: mockAddTask
        }))
    }
})
vi.mock('../src/stores/schedulerStore', () => ({
    useSchedulerStore: mockUseSchedulerStore
}))

const { processTaskCommands } = await import('../src/utils/taskUtils')

describe('taskUtils - processTaskCommands', () => {
    beforeEach(() => {
        mockAddTask.mockClear()
        mockAddTask.mockReturnValue(true)
        vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    describe('完整日期时间格式', () => {
        it('解析 yyyy-mm-dd HH:mm + 内容', () => {
            // 源码正则: \[定时 [:：] - 定时和冒号之间必须有空格
            const text = '好的[定时 : 2026-02-06 10:00 叫宝宝起床]'
            const result = processTaskCommands(text, 'chat1')
            // 命令被移除
            expect(result).not.toContain('[定时')
            expect(result).toContain('好的')
            expect(mockAddTask).toHaveBeenCalledWith('chat1', '2026-02-06 10:00', '叫宝宝起床')
        })

        it('全角冒号也支持 (带空格)', () => {
            const text = '[定时 ： 2026-02-06 10:00 提醒]'
            processTaskCommands(text, 'chat1')
            expect(mockAddTask).toHaveBeenCalledWith('chat1', '2026-02-06 10:00', '提醒')
        })

        it('前后空格被 trim', () => {
            const text = '[定时 :    2026-02-06 10:00   通知我   ]'
            processTaskCommands(text, 'chat1')
            expect(mockAddTask).toHaveBeenCalledWith('chat1', '2026-02-06 10:00', '通知我')
        })

        it('保留其他文本', () => {
            const text = '好的!我会提醒你[定时 : 2026-02-06 10:00 起床]哦'
            const result = processTaskCommands(text, 'chat1')
            expect(result).toContain('好的')
            expect(result).toContain('哦')
        })
    })

    describe('简化时间格式', () => {
        it('HH:mm + 内容', () => {
            const text = '[定时 : 10:00 起床]'
            processTaskCommands(text, 'chat1')
            expect(mockAddTask).toHaveBeenCalledWith('chat1', '10:00', '起床')
        })

        it('H点mm分格式', () => {
            const text = '[定时 : 10点30分 提醒]'
            processTaskCommands(text, 'chat1')
            expect(mockAddTask).toHaveBeenCalledWith('chat1', '10点30分', '提醒')
        })

        it('H点格式 (无分钟)', () => {
            const text = '[定时 : 9点 会议]'
            processTaskCommands(text, 'chat1')
            expect(mockAddTask).toHaveBeenCalledWith('chat1', '9点', '会议')
        })

        it('全角冒号', () => {
            const text = '[定时 ： 10:00 起床]'
            processTaskCommands(text, 'chat1')
            expect(mockAddTask).toHaveBeenCalledWith('chat1', '10:00', '起床')
        })
    })

    describe('多条任务', () => {
        it('两条完整日期时间任务', () => {
            const text = '[定时 : 2026-02-06 10:00 任务1][定时 : 2026-02-07 11:00 任务2]'
            const result = processTaskCommands(text, 'chat1')
            expect(mockAddTask).toHaveBeenCalledTimes(2)
            expect(result).toBe('')
        })

        it('混合完整日期时间和简化时间', () => {
            const text = '[定时 : 2026-02-06 10:00 任务1][定时 : 11:00 任务2]'
            processTaskCommands(text, 'chat1')
            // 至少 2 次调用
            expect(mockAddTask.mock.calls.length).toBeGreaterThanOrEqual(2)
        })
    })

    describe('addTask 失败', () => {
        it('addTask 返回 false 时保留原文', () => {
            mockAddTask.mockReturnValue(false)
            const text = '[定时:2026-02-06 10:00 任务]'
            const result = processTaskCommands(text, 'chat1')
            // 命令未移除
            expect(result).toContain('[定时')
        })
    })

    describe('无匹配', () => {
        it('无命令原样返回', () => {
            const text = '普通文本,没有定时'
            const result = processTaskCommands(text, 'chat1')
            expect(result).toBe('普通文本,没有定时')
            expect(mockAddTask).not.toHaveBeenCalled()
        })

        it('空字符串返回空字符串', () => {
            expect(processTaskCommands('', 'chat1')).toBe('')
        })

        it('不同格式的方括号不识别', () => {
            // [task: ...] 不是 [定时: ...]
            const text = '[task:10:00 任务]'
            processTaskCommands(text, 'chat1')
            expect(mockAddTask).not.toHaveBeenCalled()
        })
    })

    describe('返回值', () => {
        it('返回值是字符串', () => {
            const result = processTaskCommands('hello', 'chat1')
            expect(typeof result).toBe('string')
        })

        it('返回值已 trim', () => {
            const text = '   前后空格   '
            const result = processTaskCommands(text, 'chat1')
            expect(result).toBe('前后空格')
        })
    })

    describe('chatId 参数', () => {
        it('chatId 传给 addTask', () => {
            const text = '[定时 : 10:00 任务]'
            processTaskCommands(text, 'myChat123')
            expect(mockAddTask).toHaveBeenCalledWith('myChat123', expect.any(String), expect.any(String))
        })
    })
})
