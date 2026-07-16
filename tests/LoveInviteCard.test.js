/**
 * LoveInviteCard.vue 组件测试
 * 验证:
 * - 渲染 props 字段
 * - accept 按钮触发 emit('accept')
 * - decline 按钮在 showDecline=true 时显示 + 触发 emit('decline')
 * - decline 按钮在 showDecline=false 时不显示
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoveInviteCard from '../src/components/LoveSpace/LoveInviteCard.vue'

describe('LoveInviteCard.vue', () => {
    it('渲染默认 message', () => {
        const w = mount(LoveInviteCard)
        expect(w.text()).toContain('我想和你开通专属情侣空间')
    })

    it('渲染自定义 message', () => {
        const w = mount(LoveInviteCard, { props: { message: '一起开通吧~' } })
        expect(w.text()).toContain('一起开通吧~')
    })

    it('渲染 userAvatar 和 partnerAvatar', () => {
        const w = mount(LoveInviteCard, {
            props: { userAvatar: '/a.jpg', partnerAvatar: '/b.jpg' }
        })
        const imgs = w.findAll('img')
        expect(imgs[0].attributes('src')).toBe('/a.jpg')
        expect(imgs[1].attributes('src')).toBe('/b.jpg')
    })

    it('渲染 startDate', () => {
        const w = mount(LoveInviteCard, { props: { startDate: '2026-07-16' } })
        expect(w.text()).toContain('2026-07-16')
    })

    it('点击同意按钮触发 accept 事件', async () => {
        const w = mount(LoveInviteCard)
        await w.find('.btn-accept').trigger('click')
        expect(w.emitted('accept')).toBeTruthy()
        expect(w.emitted('accept').length).toBe(1)
    })

    it('showDecline=false 时不显示再想想按钮', () => {
        const w = mount(LoveInviteCard, { props: { showDecline: false } })
        expect(w.find('.btn-decline').exists()).toBe(false)
    })

    it('showDecline=true 时显示再想想按钮', () => {
        const w = mount(LoveInviteCard, { props: { showDecline: true } })
        expect(w.find('.btn-decline').exists()).toBe(true)
    })

    it('点击再想想按钮触发 decline 事件', async () => {
        const w = mount(LoveInviteCard, { props: { showDecline: true } })
        await w.find('.btn-decline').trigger('click')
        expect(w.emitted('decline')).toBeTruthy()
        expect(w.emitted('decline').length).toBe(1)
    })

    it('显示永久有效提示', () => {
        const w = mount(LoveInviteCard)
        expect(w.text()).toContain('永久有效')
    })

    it('显示情侣空间邀请标题', () => {
        const w = mount(LoveInviteCard)
        expect(w.text()).toContain('情侣空间邀请')
    })
})
