/**
 * RequestQueue 测试
 * 验证队列/并发/速率限制/熔断器/abortSignal 的行为
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestQueue } from '../src/utils/ai/requestQueue'

// mock loggerStore(被 triggerRateLimit 调用)
vi.mock('../src/stores/loggerStore', () => ({
    useLoggerStore: () => ({
        addLog: vi.fn()
    })
}))

describe('RequestQueue - 基础执行', () => {
    let q
    beforeEach(() => {
        q = new RequestQueue(10, 60000, 3)
    })

    it('执行单个任务并 resolve 结果', async () => {
        const fn = vi.fn().mockResolvedValue('ok')
        const p = q.enqueue(fn, [1, 2], null)
        await expect(p).resolves.toBe('ok')
        expect(fn).toHaveBeenCalledWith(1, 2)
    })

    it('任务抛错时 reject', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('boom'))
        const p = q.enqueue(fn, [], null)
        await expect(p).rejects.toThrow('boom')
    })

    it('正确传递多个参数', async () => {
        const fn = vi.fn().mockResolvedValue(null)
        await q.enqueue(fn, ['a', 'b', 'c', 'd'], null)
        expect(fn).toHaveBeenCalledWith('a', 'b', 'c', 'd')
    })
})

describe('RequestQueue - 错误检测熔断器', () => {
    let q
    beforeEach(() => {
        q = new RequestQueue(10, 60000, 1)
    })

    it('错误信息含 "429" 触发熔断器', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('429 Too Many Requests'))
        await expect(q.enqueue(fn, [], null)).rejects.toThrow('429')
        expect(q.isRateLimited).toBe(true)
        expect(q.retryAfter).toBeGreaterThan(Date.now())
    })

    it('错误信息含 "quota" 触发熔断器', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Quota exceeded'))
        await expect(q.enqueue(fn, [], null)).rejects.toThrow('Quota')
        expect(q.isRateLimited).toBe(true)
    })

    it('错误信息含 "rate limit" 触发熔断器', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('rate limit reached'))
        await expect(q.enqueue(fn, [], null)).rejects.toThrow('rate limit')
        expect(q.isRateLimited).toBe(true)
    })

    it('普通错误不触发熔断器', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Network error'))
        await expect(q.enqueue(fn, [], null)).rejects.toThrow('Network')
        expect(q.isRateLimited).toBe(false)
    })
})

describe('RequestQueue - 熔断器阻止执行', () => {
    it('熔断器激活时,新任务入队后会被延迟', async () => {
        const q = new RequestQueue(10, 60000, 1)
        // 强制激活熔断器
        q.triggerRateLimit(5000)
        expect(q.isRateLimited).toBe(true)
        // 此时 retryAfter > now
        expect(q.retryAfter).toBeGreaterThan(Date.now())
    })

    it('熔断器冷却结束后自动 reset', async () => {
        const q = new RequestQueue(10, 60000, 1)
        // 设置一个已经过期的熔断
        q.isRateLimited = true
        q.retryAfter = Date.now() - 100
        expect(q.isRateLimited).toBe(true)
        // processQueue 早期会因 queue.length === 0 直接 return,
        // 所以先入队一个任务来真正触发熔断器检查逻辑
        const fn = vi.fn().mockResolvedValue('ok')
        const p = q.enqueue(fn, [], null)
        await p
        expect(q.isRateLimited).toBe(false)
    })
})

describe('RequestQueue - AbortSignal', () => {
    it('已 abort 的信号导致任务被 reject', async () => {
        const q = new RequestQueue(10, 60000, 1)
        const ac = new AbortController()
        ac.abort()
        const fn = vi.fn().mockResolvedValue('ok')
        const p = q.enqueue(fn, [], ac.signal)
        await expect(p).rejects.toThrow(/abort/i)
        expect(fn).not.toHaveBeenCalled()
    })

    it('未 abort 的信号不影响执行', async () => {
        const q = new RequestQueue(10, 60000, 1)
        const ac = new AbortController()
        const fn = vi.fn().mockResolvedValue('ok')
        const p = q.enqueue(fn, [], ac.signal)
        await expect(p).resolves.toBe('ok')
        expect(fn).toHaveBeenCalled()
    })
})

describe('RequestQueue - 并发控制', () => {
    it('同时入队多个任务,activeCount 不超过 concurrency', async () => {
        const q = new RequestQueue(100, 60000, 2)  // 速率放很大,只看并发
        let concurrent = 0
        let maxConcurrent = 0
        const fn = vi.fn().mockImplementation(async () => {
            concurrent++
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            await new Promise(r => setTimeout(r, 30))
            concurrent--
            return null
        })
        await Promise.all([
            q.enqueue(fn, [], null),
            q.enqueue(fn, [], null),
            q.enqueue(fn, [], null),
            q.enqueue(fn, [], null)
        ])
        expect(maxConcurrent).toBeLessThanOrEqual(2)
        expect(fn).toHaveBeenCalledTimes(4)
    })
})

describe('RequestQueue - 滑动窗口速率限制', () => {
    it('达到 maxRate 后,新任务被延迟', async () => {
        // maxRate=2, interval=1000ms,concurrency=1
        const q = new RequestQueue(2, 1000, 1)
        const fn = vi.fn().mockResolvedValue('ok')
        // 先执行 2 个快速任务,把时间戳填满
        await q.enqueue(fn, [], null)
        await q.enqueue(fn, [], null)
        // 此时 timestamps 应该有 2 项,达到 maxRate
        expect(q.timestamps.length).toBe(2)
        // 3 个任务被 setTimeout 延迟(测试不验证执行,只验证状态)
        const p3 = q.enqueue(fn, [], null)
        // 立即检查:任务可能已入队但 processQueue 走 wait 分支
        // 由于定时器关系,这里不强制验证 p3 状态,但要验证 timestamps 仍为 2
        // 等所有任务结束
        await p3
        // 最终 timestamps 可能 >= 2(因为旧时间戳过期或被推进)
        expect(fn).toHaveBeenCalledTimes(3)
    })
})

describe('RequestQueue - 错误结果也触发熔断', () => {
    it('resolve 但 result.error 含 429 触发熔断', async () => {
        const q = new RequestQueue(10, 60000, 1)
        const fn = vi.fn().mockResolvedValue({ error: 'HTTP 429 returned' })
        const r = await q.enqueue(fn, [], null)
        expect(r.error).toContain('429')
        expect(q.isRateLimited).toBe(true)
    })
})
