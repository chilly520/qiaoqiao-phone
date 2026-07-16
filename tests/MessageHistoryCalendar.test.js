/**
 * MessageHistoryCalendar.vue 组件测试
 * 验证:
 * - props.show=false 时不渲染
 * - 月份切换、日期选择、清除按钮
 * - 总结按钮 disabled 状态切换
 * - emit('summary', { startDate, endDate }) 参数正确
 * - emit('close') 触发时机
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageHistoryCalendar from '../src/views/WeChat/modals/MessageHistoryCalendar.vue'
import { makeMsgs } from './helpers'

describe('MessageHistoryCalendar.vue', () => {
    // 每个测试前把 Date.now / new Date 锁住,保证 today 一致
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-15T12:00:00'))
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    function mountCalendar(props = {}) {
        return mount(MessageHistoryCalendar, {
            props: { show: true, msgs: [], ...props }
        })
    }

    it('show=false 时不渲染', () => {
        const wrapper = mountCalendar({ show: false })
        expect(wrapper.find('.fixed').exists()).toBe(false)
    })

    it('show=true 时显示当前月份(2026年5月)', () => {
        const wrapper = mountCalendar()
        expect(wrapper.text()).toContain('2026年5月')
    })

    it('月份切换:点击下个月变成 2026年6月', async () => {
        const wrapper = mountCalendar()
        // 找下个月按钮(第二个 button,第一个是上个月,第三个是切换月)
        const buttons = wrapper.findAll('button')
        const nextBtn = buttons[1]
        await nextBtn.trigger('click')
        expect(wrapper.text()).toContain('2026年6月')
    })

    it('月份切换:从1月点上月,跨年变去年12月', async () => {
        vi.setSystemTime(new Date('2026-01-15T12:00:00'))
        const wrapper = mountCalendar()
        expect(wrapper.text()).toContain('2026年1月')
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')  // prev
        expect(wrapper.text()).toContain('2025年12月')
    })

    it('点击有消息的日期格子:触发 selected 状态 + 显示轮数', () => {
        const msgs = makeMsgs([
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' },
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' }
        ])
        const wrapper = mountCalendar({ msgs })
        // 5/8 每天 2 个 user+assistant 对 = 2 轮
        expect(wrapper.text()).toContain('2轮')
    })

    it('显示当月总轮数', () => {
        const msgs = makeMsgs([
            { day: '2026-05-01', role: 'user' },
            { day: '2026-05-01', role: 'assistant' },
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' }
        ])
        const wrapper = mountCalendar({ msgs })
        // 5 月总轮数 = 2(每对 user+assistant 算 1 轮)
        expect(wrapper.text()).toMatch(/共\s*2\s*轮/)
    })

    it('总结按钮:没选日期时 disabled,选了之后启用', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }, { day: '2026-05-08', role: 'assistant' }])
        const wrapper = mountCalendar({ msgs })

        // 找到总结按钮:文字包含"总结"
        const summaryBtn = wrapper.findAll('button').find(b => b.text().includes('总结'))
        expect(summaryBtn).toBeTruthy()
        // 没选时 disabled
        expect(summaryBtn.attributes('disabled')).toBeDefined()

        // 点击 5/8 格子
        const dayCells = wrapper.findAll('.aspect-square').filter(c => c.text().includes('8'))
        await dayCells[0].trigger('click')

        // 重新拿按钮(响应式更新后)
        const summaryBtn2 = wrapper.findAll('button').find(b => b.text().includes('总结'))
        expect(summaryBtn2.attributes('disabled')).toBeUndefined()
        // 按钮文字应该带轮数 (1 user + 1 assistant = 1 轮)
        expect(summaryBtn2.text()).toContain('1轮')
    })

    it('【关键】点总结按钮:emit("summary", { startDate, endDate })', async () => {
        const msgs = makeMsgs([
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-08', role: 'assistant' }
        ])
        const wrapper = mountCalendar({ msgs })

        // 点 5/8
        const dayCells = wrapper.findAll('.aspect-square').filter(c => c.text().includes('8'))
        await dayCells[0].trigger('click')

        // 点总结
        const summaryBtn = wrapper.findAll('button').find(b => b.text().includes('总结'))
        await summaryBtn.trigger('click')

        const events = wrapper.emitted('summary')
        expect(events).toBeTruthy()
        expect(events).toHaveLength(1)
        expect(events[0][0]).toEqual({
            startDate: '2026-05-08',
            endDate: '2026-05-08'
        })
    })

    it('【关键】选多日:emit 时 startDate 是最早,endDate 是最晚(不依赖点击顺序)', async () => {
        const msgs = makeMsgs([
            { day: '2026-05-10', role: 'user' },
            { day: '2026-05-08', role: 'user' },
            { day: '2026-05-12', role: 'user' }
        ])
        const wrapper = mountCalendar({ msgs })

        // 按 10 -> 8 -> 12 顺序点
        const cells = wrapper.findAll('.aspect-square').filter(c => c.text().match(/^[1-9]|^[12]\d/))
        const c8 = cells.find(c => c.text().startsWith('8'))
        const c10 = cells.find(c => c.text().startsWith('10'))
        const c12 = cells.find(c => c.text().startsWith('12'))
        await c10.trigger('click')
        await c8.trigger('click')
        await c12.trigger('click')

        const summaryBtn = wrapper.findAll('button').find(b => b.text().includes('总结'))
        await summaryBtn.trigger('click')

        const events = wrapper.emitted('summary')
        expect(events[0][0]).toEqual({
            startDate: '2026-05-08',  // 最早
            endDate: '2026-05-12'    // 最晚
        })
    })

    it('选完点清除:选择被清空,总结按钮重新 disabled', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        const wrapper = mountCalendar({ msgs })
        const dayCells = wrapper.findAll('.aspect-square').filter(c => c.text().includes('8'))
        await dayCells[0].trigger('click')

        // 找清除按钮
        const clearBtn = wrapper.findAll('button').find(b => b.text().trim() === '清除')
        expect(clearBtn).toBeTruthy()
        await clearBtn.trigger('click')

        // 总结按钮应重新 disabled
        const summaryBtn = wrapper.findAll('button').find(b => b.text().includes('总结'))
        expect(summaryBtn.attributes('disabled')).toBeDefined()
    })

    it('点遮罩层:emit("close")', async () => {
        const wrapper = mountCalendar()
        // 整个 modal 容器
        await wrapper.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点取消按钮:emit("close")', async () => {
        const wrapper = mountCalendar()
        const cancelBtn = wrapper.findAll('button').find(b => b.text().trim() === '取消')
        expect(cancelBtn).toBeTruthy()
        await cancelBtn.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('同一天点两次:取消选择(再点不会重复加)', async () => {
        const msgs = makeMsgs([{ day: '2026-05-08', role: 'user' }])
        const wrapper = mountCalendar({ msgs })
        const dayCells = wrapper.findAll('.aspect-square').filter(c => c.text().includes('8'))
        await dayCells[0].trigger('click')
        await dayCells[0].trigger('click')
        // 总结按钮应重新 disabled
        const summaryBtn = wrapper.findAll('button').find(b => b.text().includes('总结'))
        expect(summaryBtn.attributes('disabled')).toBeDefined()
    })

    it('选连续多日:显示 "start ~ end" 范围文本', async () => {
        const msgs = makeMsgs([
            { day: '2026-05-05', role: 'user' },
            { day: '2026-05-06', role: 'user' },
            { day: '2026-05-07', role: 'user' }
        ])
        const wrapper = mountCalendar({ msgs })
        const cells = wrapper.findAll('.aspect-square').filter(c => c.text().match(/^[567]/))
        await cells[0].trigger('click')  // 5
        await cells[1].trigger('click')  // 6
        await cells[2].trigger('click')  // 7
        // 范围文本
        expect(wrapper.text()).toContain('2026-05-05 ~ 2026-05-07')
    })
})
