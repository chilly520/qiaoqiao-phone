/**
 * MomentShareCard.vue 组件测试
 * 验证:
 * - 接收 object data
 * - 接收 string data (JSON 解析)
 * - 解析失败时显示空状态
 * - 显示 text 字段
 * - 显示 image 字段
 * - image 不存在时显示占位符
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MomentShareCard from '../src/components/MomentShareCard.vue'

describe('MomentShareCard.vue', () => {
    it('空 data 不报错', () => {
        const w = mount(MomentShareCard, { props: { data: {} } })
        expect(w.find('.moment-share-card').exists()).toBe(true)
    })

    it('未传 data 不报错', () => {
        const w = mount(MomentShareCard, { props: {} })
        expect(w.find('.moment-share-card').exists()).toBe(true)
    })

    it('object data:显示 text', () => {
        const w = mount(MomentShareCard, { props: { data: { text: '今天去爬山' } } })
        expect(w.text()).toContain('今天去爬山')
    })

    it('object data:显示 originalText', () => {
        const w = mount(MomentShareCard, { props: { data: { originalText: '原始文字' } } })
        expect(w.text()).toContain('原始文字')
    })

    it('object data:显示 image', () => {
        const w = mount(MomentShareCard, { props: { data: { image: '/pic.jpg' } } })
        const img = w.find('img')
        expect(img.exists()).toBe(true)
        expect(img.attributes('src')).toBe('/pic.jpg')
    })

    it('image 不存在时显示占位图标', () => {
        const w = mount(MomentShareCard, { props: { data: { text: '无图' } } })
        // 找 .fa-image 占位符
        expect(w.find('.fa-image').exists()).toBe(true)
    })

    it('string JSON data:正确解析', () => {
        const w = mount(MomentShareCard, {
            props: { data: JSON.stringify({ text: '解析文本', image: '/x.jpg' }) }
        })
        expect(w.text()).toContain('解析文本')
        expect(w.find('img').attributes('src')).toBe('/x.jpg')
    })

    it('无效 JSON 字符串:不崩溃,显示空状态', () => {
        const w = mount(MomentShareCard, { props: { data: 'not valid json' } })
        // 不崩溃
        expect(w.find('.moment-share-card').exists()).toBe(true)
        // 文本不显示
        expect(w.text()).not.toContain('not valid json')
    })

    it('text 不存在时显示"分享了一条动态"', () => {
        const w = mount(MomentShareCard, { props: { data: { image: '/a.jpg' } } })
        expect(w.text()).toContain('分享了一条动态')
    })

    it('显示"朋友圈"标签', () => {
        const w = mount(MomentShareCard, { props: { data: { text: 'hi' } } })
        expect(w.text()).toContain('朋友圈')
    })
})
