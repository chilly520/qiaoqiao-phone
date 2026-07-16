/**
 * notificationService.js 单元测试 - 通知服务
 * 验证:
 * - 基础能力: isSupported, hasPermission, isServiceWorkerSupported
 * - requestPermission
 * - sendNotification (SW + fallback)
 * - scheduleNotification
 * - registerServiceWorker
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 设置 Notification mock
class MockNotification {
    static permission = 'default'
    static requestPermission = vi.fn(async () => 'granted')
    constructor(title, options) {
        this.title = title
        this.options = options
        MockNotification._lastInstance = this
    }
    close() {
        this._closed = true
    }
}
// 全局 Notification
global.Notification = MockNotification

// Mock navigator.serviceWorker
const mockSWController = { postMessage: vi.fn() }
const mockSWRegistration = {
    scope: '/',
    waiting: null,
    installing: null,
    showNotification: vi.fn(async () => {}),
    addEventListener: vi.fn()
}
const mockServiceWorker = {
    ready: Promise.resolve(mockSWRegistration),
    register: vi.fn(async () => mockSWRegistration),
    controller: mockSWController
}

describe('notificationService - 基础能力', () => {
    beforeEach(() => {
        vi.resetModules()
        MockNotification.permission = 'default'
        MockNotification._lastInstance = null
        MockNotification.requestPermission = vi.fn(async () => 'granted')
        mockSWRegistration.showNotification.mockClear()
        mockServiceWorker.register.mockClear()
        mockSWController.postMessage.mockClear()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Notification 支持检测', () => {
        it('isSupported 是布尔值', async () => {
            global.window = { Notification: MockNotification }
            const { notificationService } = await import('../src/utils/notificationService')
            expect(typeof notificationService.isSupported).toBe('boolean')
        })
    })

    describe('hasPermission', () => {
        it('不支持时返回 false', async () => {
            global.window = {}
            const { notificationService } = await import('../src/utils/notificationService')
            expect(notificationService.hasPermission()).toBe(false)
        })

        it('granted 返回 true', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            const { notificationService } = await import('../src/utils/notificationService')
            expect(notificationService.hasPermission()).toBe(true)
        })

        it('denied 返回 false', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'denied'
            const { notificationService } = await import('../src/utils/notificationService')
            expect(notificationService.hasPermission()).toBe(false)
        })

        it('default 返回 false', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'default'
            const { notificationService } = await import('../src/utils/notificationService')
            expect(notificationService.hasPermission()).toBe(false)
        })
    })

    describe('isServiceWorkerSupported', () => {
        it('navigator 有 serviceWorker 时 true', async () => {
            global.navigator = { serviceWorker: mockServiceWorker }
            global.window = { Notification: MockNotification }
            const { notificationService } = await import('../src/utils/notificationService')
            expect(notificationService.isServiceWorkerSupported()).toBe(true)
        })

        it('navigator 无 serviceWorker 时 false', async () => {
            global.navigator = {}
            global.window = { Notification: MockNotification }
            const { notificationService } = await import('../src/utils/notificationService')
            expect(notificationService.isServiceWorkerSupported()).toBe(false)
        })
    })

    describe('requestPermission', () => {
        it('不支持时返回 false', async () => {
            global.window = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.requestPermission()
            expect(result).toBe(false)
        })

        it('granted 返回 true', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.requestPermission = vi.fn(async () => 'granted')
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.requestPermission()
            expect(result).toBe(true)
        })

        it('denied 返回 false', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.requestPermission = vi.fn(async () => 'denied')
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.requestPermission()
            expect(result).toBe(false)
        })

        it('default 返回 false', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.requestPermission = vi.fn(async () => 'default')
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.requestPermission()
            expect(result).toBe(false)
        })

        it('保存 permission 状态', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.requestPermission = vi.fn(async () => 'granted')
            const { notificationService } = await import('../src/utils/notificationService')
            await notificationService.requestPermission()
            expect(notificationService.permission).toBe('granted')
        })
    })

    describe('sendNotification', () => {
        it('无权限返回 null', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'denied'
            global.navigator = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.sendNotification('hi')
            expect(result).toBe(null)
        })

        it('SW 路径 - 使用 showNotification', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            global.navigator = { serviceWorker: mockServiceWorker }
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.sendNotification('Test Title', { body: 'test' })
            expect(mockSWRegistration.showNotification).toHaveBeenCalledWith('Test Title', expect.any(Object))
            expect(result).toBe(true)
        })

        it('SW 路径透传 options', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            global.navigator = { serviceWorker: mockServiceWorker }
            const { notificationService } = await import('../src/utils/notificationService')
            await notificationService.sendNotification('Title', { body: 'Body', tag: 'custom' })
            const call = mockSWRegistration.showNotification.mock.calls[0]
            expect(call[0]).toBe('Title')
            expect(call[1].body).toBe('Body')
            expect(call[1].tag).toBe('custom')
        })

        it('SW 默认 icon/badge', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            global.navigator = { serviceWorker: mockServiceWorker }
            const { notificationService } = await import('../src/utils/notificationService')
            await notificationService.sendNotification('Title')
            const options = mockSWRegistration.showNotification.mock.calls[0][1]
            expect(options.icon).toBe('/pwa-192x192.png')
            expect(options.badge).toBe('/pwa-192x192.png')
            expect(options.tag).toBe('chat-notification')
        })

        it('SW 失败时 fallback 到 Notification API', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            // SW showNotification 抛错
            mockSWRegistration.showNotification = vi.fn().mockRejectedValue(new Error('sw fail'))
            global.navigator = { serviceWorker: mockServiceWorker }
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.sendNotification('Title')
            // fallback 创建了 MockNotification
            expect(MockNotification._lastInstance).toBeTruthy()
        })

        it('无 SW 时直接 fallback', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            global.navigator = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.sendNotification('Title')
            // 创建了 MockNotification 实例
            expect(MockNotification._lastInstance).toBeTruthy()
        })

        it('fallback 抛错返回 null', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            // 让构造函数抛错 (使用全局 Notification)
            const OrigNotification = global.Notification
            global.Notification = function () {
                throw new Error('notif fail')
            }
            global.navigator = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.sendNotification('Title')
            expect(result).toBe(null)
            global.Notification = OrigNotification
        })
    })

    describe('scheduleNotification', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('无权限返回 null', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'denied'
            global.navigator = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const result = notificationService.scheduleNotification('Title')
            expect(result).toBe(null)
        })

        it('返回 timer handle (setTimeout id)', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            global.navigator = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const result = notificationService.scheduleNotification('Title', { delay: 1000 })
            expect(result).toBeDefined()
            // 在 happy-dom 中 setTimeout 可能返回 number 或 Timeout 对象
            expect(result).toBeTruthy()
        })

        it('delay 后调用 sendNotification', async () => {
            global.window = { Notification: MockNotification }
            MockNotification.permission = 'granted'
            global.navigator = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const spy = vi.spyOn(notificationService, 'sendNotification').mockResolvedValue(true)
            notificationService.scheduleNotification('Title', { delay: 500 })
            vi.advanceTimersByTime(500)
            expect(spy).toHaveBeenCalled()
        })
    })

    describe('registerServiceWorker', () => {
        it('不支持 SW 时返回 null', async () => {
            global.window = { Notification: MockNotification }
            global.navigator = {}
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.registerServiceWorker()
            expect(result).toBe(null)
        })

        it('调用 navigator.serviceWorker.register', async () => {
            global.window = { Notification: MockNotification }
            global.navigator = { serviceWorker: mockServiceWorker }
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.registerServiceWorker()
            expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js?v=23', { scope: '/' })
            expect(result).toBe(mockSWRegistration)
        })

        it('有 waiting 时发送 SKIP_WAITING', async () => {
            global.window = { Notification: MockNotification }
            const waitingWorker = { postMessage: vi.fn() }
            mockSWRegistration.waiting = waitingWorker
            global.navigator = { serviceWorker: mockServiceWorker }
            const { notificationService } = await import('../src/utils/notificationService')
            await notificationService.registerServiceWorker()
            expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
        })

        it('addEventListener(updatefound) 注册', async () => {
            global.window = { Notification: MockNotification }
            global.navigator = { serviceWorker: mockServiceWorker }
            const { notificationService } = await import('../src/utils/notificationService')
            await notificationService.registerServiceWorker()
            expect(mockSWRegistration.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function))
        })

        it('register 失败时返回 null', async () => {
            global.window = { Notification: MockNotification }
            global.navigator = {
                serviceWorker: {
                    register: vi.fn().mockRejectedValue(new Error('reg fail')),
                    ready: Promise.resolve({})
                }
            }
            const { notificationService } = await import('../src/utils/notificationService')
            const result = await notificationService.registerServiceWorker()
            expect(result).toBe(null)
        })
    })

    describe('单例导出', () => {
        it('导出 notificationService 实例', async () => {
            global.window = { Notification: MockNotification }
            const mod = await import('../src/utils/notificationService')
            expect(mod.notificationService).toBeTruthy()
            expect(typeof mod.notificationService.sendNotification).toBe('function')
            expect(typeof mod.notificationService.requestPermission).toBe('function')
            expect(typeof mod.notificationService.hasPermission).toBe('function')
            expect(typeof mod.notificationService.scheduleNotification).toBe('function')
            expect(typeof mod.notificationService.registerServiceWorker).toBe('function')
            expect(typeof mod.notificationService.isServiceWorkerSupported).toBe('function')
        })
    })
})
