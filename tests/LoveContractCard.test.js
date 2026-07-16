/**
 * LoveContractCard.vue 组件测试
 * 验证:
 * - 渲染所有 props
 * - 默认值
 * - loveDays 显示
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoveContractCard from '../src/components/LoveSpace/LoveContractCard.vue'

describe('LoveContractCard.vue', () => {
    it('显示契约标题', () => {
        const w = mount(LoveContractCard)
        expect(w.text()).toContain('契约达成')
        expect(w.text()).toContain('情侣空间开通证书')
    })

    it('默认 userName="我"', () => {
        const w = mount(LoveContractCard)
        expect(w.text()).toContain('我')
    })

    it('默认 partnerName="TA"', () => {
        const w = mount(LoveContractCard)
        expect(w.text()).toContain('TA')
    })

    it('自定义 userName / partnerName', () => {
        const w = mount(LoveContractCard, { props: { userName: '小明', partnerName: '小红' } })
        expect(w.text()).toContain('小明')
        expect(w.text()).toContain('小红')
    })

    it('loveDays 显示数字', () => {
        const w = mount(LoveContractCard, { props: { loveDays: 365 } })
        expect(w.text()).toContain('365 天')
    })

    it('loveDays=0 也显示', () => {
        const w = mount(LoveContractCard, { props: { loveDays: 0 } })
        expect(w.text()).toContain('0 天')
    })

    it('startDate 字段', () => {
        const w = mount(LoveContractCard, { props: { startDate: '2026-07-16' } })
        expect(w.text()).toContain('2026-07-16')
    })

    it('contractId 字段', () => {
        const w = mount(LoveContractCard, { props: { contractId: 'C-001' } })
        expect(w.text()).toContain('C-001')
    })

    it('userAvatar / partnerAvatar 渲染到 img', () => {
        const w = mount(LoveContractCard, {
            props: { userAvatar: '/u.jpg', partnerAvatar: '/p.jpg' }
        })
        const imgs = w.findAll('img')
        expect(imgs[0].attributes('src')).toBe('/u.jpg')
        expect(imgs[1].attributes('src')).toBe('/p.jpg')
    })

    it('永久有效印章', () => {
        const w = mount(LoveContractCard)
        expect(w.text()).toContain('永久有效')
    })
})

/**
 * HelloWorld.vue 组件测试
 * 验证:
 * - 渲染 msg prop
 * - 计数器交互
 */
import HelloWorld from '../src/components/HelloWorld.vue'

describe('HelloWorld.vue', () => {
    it('渲染 msg prop', () => {
        const w = mount(HelloWorld, { props: { msg: 'Hello 测试' } })
        expect(w.text()).toContain('Hello 测试')
    })

    it('默认 msg 为 undefined(不报错)', () => {
        const w = mount(HelloWorld, { props: {} })
        // 不抛错
        expect(w.find('h1').exists()).toBe(true)
    })

    it('初始 count 为 0', () => {
        const w = mount(HelloWorld, { props: { msg: 'hi' } })
        expect(w.text()).toContain('count is 0')
    })

    it('点击按钮 count +1', async () => {
        const w = mount(HelloWorld, { props: { msg: 'hi' } })
        await w.find('button').trigger('click')
        expect(w.text()).toContain('count is 1')
    })

    it('多次点击累加', async () => {
        const w = mount(HelloWorld, { props: { msg: 'hi' } })
        const btn = w.find('button')
        await btn.trigger('click')
        await btn.trigger('click')
        await btn.trigger('click')
        expect(w.text()).toContain('count is 3')
    })
})
