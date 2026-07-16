/**
 * emojiParser.js 单元测试 - 微信方括号表情映射
 * 验证:
 * - WECHAT_EMOJI_MAP 静态映射表
 * - parseWeChatEmojis 解析与替换
 * - 边界: 大小写、空值、嵌套、未知表情
 */
import { describe, it, expect } from 'vitest'
import { WECHAT_EMOJI_MAP, parseWeChatEmojis } from '../src/utils/emojiParser'

describe('emojiParser - WECHAT_EMOJI_MAP', () => {
    it('导出为对象', () => {
        expect(typeof WECHAT_EMOJI_MAP).toBe('object')
        expect(WECHAT_EMOJI_MAP).not.toBe(null)
    })

    it('包含至少 50 个表情', () => {
        expect(Object.keys(WECHAT_EMOJI_MAP).length).toBeGreaterThanOrEqual(50)
    })

    it('值是字符串(emoji)', () => {
        Object.values(WECHAT_EMOJI_MAP).forEach(emoji => {
            expect(typeof emoji).toBe('string')
            expect(emoji.length).toBeGreaterThan(0)
        })
    })

    it('常见映射存在', () => {
        expect(WECHAT_EMOJI_MAP['微笑']).toBe('🙂')
        expect(WECHAT_EMOJI_MAP['亲亲']).toBe('😘')
        expect(WECHAT_EMOJI_MAP['爱心']).toBe('❤️')
    })

    it('一个键对应一个非空 emoji', () => {
        Object.entries(WECHAT_EMOJI_MAP).forEach(([key, val]) => {
            expect(key).toBeTruthy()
            expect(val).toBeTruthy()
        })
    })
})

describe('emojiParser - parseWeChatEmojis', () => {
    describe('基础行为', () => {
        it('无参数返回 undefined(因为 typeof check)', () => {
            // 源码: if (!text || typeof text !== 'string') return text
            expect(parseWeChatEmojis(undefined)).toBe(undefined)
        })

        it('null 返回 null', () => {
            expect(parseWeChatEmojis(null)).toBe(null)
        })

        it('数字返回数字', () => {
            expect(parseWeChatEmojis(123)).toBe(123)
        })

        it('无方括号文本原样返回', () => {
            expect(parseWeChatEmojis('hello world')).toBe('hello world')
        })

        it('空字符串返回空字符串', () => {
            expect(parseWeChatEmojis('')).toBe('')
        })
    })

    describe('单个表情替换', () => {
        it('替换一个已知表情', () => {
            expect(parseWeChatEmojis('[微笑]')).toBe('🙂')
        })

        it('替换包含在文本中的表情', () => {
            expect(parseWeChatEmojis('你好[微笑]世界')).toBe('你好🙂世界')
        })

        it('多个相同表情都替换', () => {
            expect(parseWeChatEmojis('[微笑][微笑]')).toBe('🙂🙂')
        })

        it('不同表情混合', () => {
            expect(parseWeChatEmojis('[微笑][亲亲][爱心]')).toBe('🙂😘❤️')
        })
    })

    describe('未知表情', () => {
        it('未映射的表情原样保留', () => {
            expect(parseWeChatEmojis('[未知表情]')).toBe('[未知表情]')
        })

        it('已知与未知混合', () => {
            expect(parseWeChatEmojis('[微笑][不存在]')).toBe('🙂[不存在]')
        })

        it('空方括号不匹配任何 key', () => {
            expect(parseWeChatEmojis('[]')).toBe('[]')
        })
    })

    describe('多个方括号', () => {
        it('文本中其他方括号不替换', () => {
            // [foo] 不在 map 中,原样保留
            expect(parseWeChatEmojis('代码 [foo] 片段')).toBe('代码 [foo] 片段')
        })

        it('特殊字符 [] 不破坏', () => {
            expect(parseWeChatEmojis('数组[微笑]')).toBe('数组🙂')
        })

        it('括号内有空格不匹配', () => {
            // 严格匹配 key,带空格的不同 key 不在 map 中
            expect(parseWeChatEmojis('[ 微笑 ]')).toBe('[ 微笑 ]')
        })
    })

    describe('大小写敏感', () => {
        it('小写英文不匹配(中文 key)', () => {
            expect(parseWeChatEmojis('[smile]')).toBe('[smile]')
        })

        it('OK 大写匹配', () => {
            // 'OK' 是 map 中的键
            expect(parseWeChatEmojis('[OK]')).toBe('👌')
        })

        it('ok 小写不匹配', () => {
            expect(parseWeChatEmojis('[ok]')).toBe('[ok]')
        })
    })

    describe('特殊映射', () => {
        it('心 = 爱心 (同义键)', () => {
            // WECHAT_EMOJI_MAP 同时有 '爱心' 和 '心'
            expect(WECHAT_EMOJI_MAP['心']).toBe('❤️')
            expect(WECHAT_EMOJI_MAP['爱心']).toBe('❤️')
            expect(parseWeChatEmojis('[心]')).toBe('❤️')
            expect(parseWeChatEmojis('[爱心]')).toBe('❤️')
        })

        it('菜刀 = 刀 (同义键)', () => {
            expect(WECHAT_EMOJI_MAP['菜刀']).toBe('🔪')
            expect(WECHAT_EMOJI_MAP['刀']).toBe('🔪')
        })
    })

    describe('中文标点', () => {
        it('中文文本中的表情', () => {
            expect(parseWeChatEmojis('今天心情好[愉快]')).toBe('今天心情好😊')
        })

        it('长文本', () => {
            const text = '我在想你[亲亲],你今天过得怎么样[疑问]'
            const expected = '我在想你😘,你今天过得怎么样❓'
            expect(parseWeChatEmojis(text)).toBe(expected)
        })
    })

    describe('边界', () => {
        it('单独左括号不替换', () => {
            expect(parseWeChatEmojis('[')).toBe('[')
        })

        it('单独右括号不替换', () => {
            expect(parseWeChatEmojis(']')).toBe(']')
        })

        it('左右括号相邻无内容', () => {
            expect(parseWeChatEmojis('[]')).toBe('[]')
        })

        it('方括号嵌套保留外层', () => {
            // 正则 [^\]]+ 遇到第一个 ] 停止,所以 "微笑[爱心" 作为一个 key
            // 因为不在 map 中,原样保留
            expect(parseWeChatEmojis('[微笑[爱心]]')).toBe('[微笑[爱心]]')
        })
    })
})
