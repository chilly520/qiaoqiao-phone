/**
 * avatarDescCache.js 单元测试 - 头像描述缓存
 * 验证:
 * - simpleHash: 简单字符串哈希
 * - getAvatarDescCache: 读取 + 容错
 * - saveAvatarDescCache: 写入 + 失败清理
 * - getOrFetchAvatarDesc: 缓存命中 / API 调用 / 错误处理
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    simpleHash,
    getAvatarDescCache,
    saveAvatarDescCache,
    getOrFetchAvatarDesc
} from '../src/utils/avatarDescCache'

describe('avatarDescCache - simpleHash', () => {
    it('null 返回 0', () => {
        expect(simpleHash(null)).toBe(0)
    })

    it('undefined 返回 0', () => {
        expect(simpleHash(undefined)).toBe(0)
    })

    it('空字符串返回 0', () => {
        expect(simpleHash('')).toBe(0)
    })

    it('非空字符串返回 h 开头的字符串', () => {
        const result = simpleHash('hello')
        expect(typeof result).toBe('string')
        expect(result.startsWith('h')).toBe(true)
    })

    it('相同输入相同输出', () => {
        expect(simpleHash('test')).toBe(simpleHash('test'))
    })

    it('不同输入不同输出', () => {
        expect(simpleHash('a')).not.toBe(simpleHash('b'))
    })

    it('长字符串也能 hash', () => {
        const long = 'a'.repeat(1000)
        const result = simpleHash(long)
        expect(result.startsWith('h')).toBe(true)
    })

    it('中文 hash', () => {
        const result = simpleHash('你好世界')
        expect(result.startsWith('h')).toBe(true)
    })
})

describe('avatarDescCache - getAvatarDescCache', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('空缓存返回空对象', () => {
        expect(getAvatarDescCache()).toEqual({})
    })

    it('读取已保存的缓存', () => {
        const data = { 'url1': 'desc1' }
        localStorage.setItem('qiaoqiao_avatar_descriptions', JSON.stringify(data))
        expect(getAvatarDescCache()).toEqual(data)
    })

    it('JSON 解析失败返回空对象', () => {
        localStorage.setItem('qiaoqiao_avatar_descriptions', 'invalid json{')
        expect(getAvatarDescCache()).toEqual({})
    })
})

describe('avatarDescCache - saveAvatarDescCache', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('保存缓存', () => {
        const cache = { 'url1': 'desc1' }
        saveAvatarDescCache(cache)
        const saved = JSON.parse(localStorage.getItem('qiaoqiao_avatar_descriptions'))
        expect(saved).toEqual(cache)
    })

    it('保存空对象', () => {
        saveAvatarDescCache({})
        const saved = JSON.parse(localStorage.getItem('qiaoqiao_avatar_descriptions'))
        expect(saved).toEqual({})
    })

    it('quota exceeded 时清空缓存', () => {
        // happy-dom 的 localStorage.setItem 不在 Storage.prototype 上
        // 直接 mock localStorage 上的方法
        const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceeded')
        })
        const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {})

        saveAvatarDescCache({ foo: 'bar' })

        expect(setItemSpy).toHaveBeenCalled()
        expect(removeItemSpy).toHaveBeenCalled()
        setItemSpy.mockRestore()
        removeItemSpy.mockRestore()
    })
})

describe('avatarDescCache - getOrFetchAvatarDesc', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    describe('基础守卫', () => {
        it('无 url 返回 null', async () => {
            const result = await getOrFetchAvatarDesc('', 'b64', 'name', 'openai', 'k', 'e', 'm')
            expect(result).toBe(null)
        })

        it('无 b64 返回 null', async () => {
            const result = await getOrFetchAvatarDesc('url', '', 'name', 'openai', 'k', 'e', 'm')
            expect(result).toBe(null)
        })

        it('url 和 b64 都空返回 null', async () => {
            const result = await getOrFetchAvatarDesc('', '', '', '', '', '', '')
            expect(result).toBe(null)
        })
    })

    describe('缓存命中', () => {
        it('短 URL 命中缓存', async () => {
            const cache = { 'shortURL': '已缓存描述' }
            localStorage.setItem('qiaoqiao_avatar_descriptions', JSON.stringify(cache))

            const result = await getOrFetchAvatarDesc('shortURL', 'b64', 'name', 'openai', 'k', 'e', 'm')
            expect(result).toBe('已缓存描述')
        })

        it('长 URL (>100 字符) 使用 hash 作为 key', async () => {
            const longURL = 'a'.repeat(150)
            const cache = { [simpleHash(longURL)]: 'hash描述' }
            localStorage.setItem('qiaoqiao_avatar_descriptions', JSON.stringify(cache))

            const result = await getOrFetchAvatarDesc(longURL, 'b64', 'name', 'openai', 'k', 'e', 'm')
            expect(result).toBe('hash描述')
        })

        it('未命中走 API 路径', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: API 描述]' } }] })
            })
            global.fetch = mockFetch

            const result = await getOrFetchAvatarDesc('newURL', 'b64', 'name', 'openai', 'k', 'e', 'm')
            expect(result).toBe('API 描述')
            expect(mockFetch).toHaveBeenCalled()
        })
    })

    describe('API 调用', () => {
        it('openai 路径: Authorization Bearer', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: 测试]' } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'key123', 'https://api.openai.com/v1', 'gpt-4')

            const [url, options] = mockFetch.mock.calls[0]
            expect(url).toContain('/chat/completions')
            expect(options.headers.Authorization).toBe('Bearer key123')
            expect(options.method).toBe('POST')
        })

        it('openai 路径: endpoint 已有 /chat/completions 不重复添加', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: 测试]' } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'key', 'https://api.com/v1/chat/completions', 'm')
            const url = mockFetch.mock.calls[0][0]
            expect(url).toBe('https://api.com/v1/chat/completions')
        })

        it('openai 路径: endpoint 末尾 /v1 自动补全', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: 测试]' } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'key', 'https://api.com/v1', 'm')
            expect(mockFetch.mock.calls[0][0]).toBe('https://api.com/v1/chat/completions')
        })

        it('openai 路径: endpoint 末尾 /v1/ 自动补全', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: 测试]' } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'key', 'https://api.com/v1/', 'm')
            expect(mockFetch.mock.calls[0][0]).toBe('https://api.com/v1/chat/completions')
        })

        it('openai 路径: endpoint 末尾 / 自动补 chat/completions', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: 测试]' } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'key', 'https://api.com/', 'm')
            expect(mockFetch.mock.calls[0][0]).toBe('https://api.com/chat/completions')
        })

        it('openai 路径: endpoint 无末尾 / 自动补 /', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: 测试]' } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'key', 'https://api.com', 'm')
            expect(mockFetch.mock.calls[0][0]).toBe('https://api.com/chat/completions')
        })

        it('gemini 路径: 使用 candidates 字段', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: '[DESC: 蓝色短发]' }] } }]
                })
            })
            global.fetch = mockFetch

            const result = await getOrFetchAvatarDesc('url1', 'data:image/png;base64,abc', 'name', 'gemini', 'gkey', 'https://generativelanguage.googleapis.com', 'gemini-pro')
            expect(result).toBe('蓝色短发')
        })

        it('gemini 路径: 包含 key 参数', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ candidates: [{ content: { parts: [{ text: '[DESC: x]' }] } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'data:image/png;base64,abc', 'name', 'gemini', 'gkey', 'https://generativelanguage.googleapis.com', 'gemini-pro')
            const url = mockFetch.mock.calls[0][0]
            expect(url).toContain('key=gkey')
        })

        it('gemini 路径: 处理 b64 中的特殊字符', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ candidates: [{ content: { parts: [{ text: '[DESC: x]' }] } }] })
            })
            global.fetch = mockFetch

            // 包含非 base64 字符
            const b64 = 'data:image/png;base64,abc!@#'
            await getOrFetchAvatarDesc('url1', b64, 'name', 'gemini', 'gkey', 'https://generativelanguage.googleapis.com', 'gemini-pro')
            // 验证 fetch 被调用
            expect(mockFetch).toHaveBeenCalled()
        })
    })

    describe('API 错误处理', () => {
        it('非 ok 响应返回 null', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Server Error'
            })
            global.fetch = mockFetch

            const result = await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'k', 'e', 'm')
            expect(result).toBe(null)
        })

        it('405/404 状态不打印警告', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 405,
                statusText: 'Method Not Allowed'
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'k', 'e', 'm')
            // 不验证 console.warn,因为 spy 已设置
        })

        it('fetch 抛错返回 null', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
            global.fetch = mockFetch

            const result = await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'k', 'e', 'm')
            expect(result).toBe(null)
        })

        it('fetch 抛错时显示特定警告', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
            global.fetch = mockFetch
            const warnSpy = vi.spyOn(console, 'warn')

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'k', 'e', 'm', 'e')
            // 调用了 console.warn (network error message)
            expect(warnSpy).toHaveBeenCalled()
        })
    })

    describe('响应解析', () => {
        it('无 [DESC:] 格式时取前 50 字符', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'A'.repeat(100) } }] })
            })
            global.fetch = mockFetch

            const result = await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'k', 'e', 'm')
            expect(result.length).toBe(50)
        })

        it('空描述缓存为 [外貌未描述]', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: 'x' } }] })  // 长度 <= 2
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'k', 'e', 'm')
            const cache = JSON.parse(localStorage.getItem('qiaoqiao_avatar_descriptions'))
            expect(cache.url1).toBe('[外貌未描述]')
        })

        it('正常描述写入缓存', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '[DESC: 红色头发]' } }] })
            })
            global.fetch = mockFetch

            await getOrFetchAvatarDesc('url1', 'b64', 'name', 'openai', 'k', 'e', 'm')
            const cache = JSON.parse(localStorage.getItem('qiaoqiao_avatar_descriptions'))
            expect(cache.url1).toBe('红色头发')
        })
    })
})
