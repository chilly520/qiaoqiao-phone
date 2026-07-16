/**
 * backgroundManager.js 单元测试 - 后台管理与保活
 * 验证:
 * - init / setupVisibilityHandler
 * - requestWakeLock
 * - enable (基础保活)
 * - enableRealKeepAlive / tryAutoResumeKeepAlive / disableRealKeepAlive
 * - isKeepAliveActive
 * - resumeKeepAliveAudio
 * - yieldToOtherAudio / resumeFromYield
 * - 静态方法 yieldAudio / resumeAudio
 * - destroy
 * - 弃用 no-op 方法
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock loggerStore
vi.mock('../src/stores/loggerStore', () => ({
    useLoggerStore: vi.fn(() => ({
        sys: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }))
}))

// Mock musicStore
vi.mock('../src/stores/musicStore', () => ({
    useMusicStore: vi.fn(() => ({
        isPlaying: false
    }))
}))

// Mock chatStore
vi.mock('../src/stores/chatStore.js', () => ({
    useChatStore: vi.fn(() => ({
        chats: {},
        checkProactive: vi.fn()
    }))
}))

const { default: backgroundManager } = await import('../src/utils/backgroundManager')

describe('backgroundManager - 基础属性', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
        backgroundManager.wakeLock = null
        backgroundManager.initialized = false
        backgroundManager.keepAliveActive = false
        backgroundManager.keepAliveAudio = null
        backgroundManager.keepAliveMonitorTimer = null
        backgroundManager.keepAliveVisibilityHandler = null
    })

    it('是单例对象', () => {
        expect(backgroundManager).toBeTruthy()
        expect(typeof backgroundManager).toBe('object')
    })

    it('有所有核心方法', () => {
        expect(typeof backgroundManager.init).toBe('function')
        expect(typeof backgroundManager.requestWakeLock).toBe('function')
        expect(typeof backgroundManager.enable).toBe('function')
        expect(typeof backgroundManager.enableRealKeepAlive).toBe('function')
        expect(typeof backgroundManager.tryAutoResumeKeepAlive).toBe('function')
        expect(typeof backgroundManager.disableRealKeepAlive).toBe('function')
        expect(typeof backgroundManager.isKeepAliveActive).toBe('function')
        expect(typeof backgroundManager.resumeKeepAliveAudio).toBe('function')
        expect(typeof backgroundManager.yieldToOtherAudio).toBe('function')
        expect(typeof backgroundManager.resumeFromYield).toBe('function')
        expect(typeof backgroundManager.destroy).toBe('function')
        expect(typeof backgroundManager.scheduleNativeNotification).toBe('function')
        expect(typeof backgroundManager.computeAndScheduleNextNotification).toBe('function')
    })

    it('有静态方法', () => {
        expect(typeof backgroundManager.constructor.yieldAudio).toBe('function')
        expect(typeof backgroundManager.constructor.resumeAudio).toBe('function')
    })
})

describe('backgroundManager - init', () => {
    beforeEach(() => {
        backgroundManager.initialized = false
    })

    it('初次调用初始化', () => {
        backgroundManager.init()
        expect(backgroundManager.initialized).toBe(true)
    })

    it('重复调用只初始化一次', () => {
        backgroundManager.init()
        const first = backgroundManager.initialized
        backgroundManager.init()
        // 不重新设置
        expect(backgroundManager.initialized).toBe(first)
    })

    it('无 logger 时容错', () => {
        backgroundManager.logger = null
        expect(() => backgroundManager.init()).not.toThrow()
    })
})

describe('backgroundManager - log', () => {
    beforeEach(() => {
        backgroundManager.logger = {
            sys: vi.fn(),
            error: vi.fn(),
            info: vi.fn()
        }
    })

    it('sys 级别调用 logger.sys', () => {
        backgroundManager.log('test', 'sys')
        expect(backgroundManager.logger.sys).toHaveBeenCalledWith('test')
    })

    it('info 级别调用 logger.sys', () => {
        backgroundManager.log('test', 'info')
        expect(backgroundManager.logger.sys).toHaveBeenCalledWith('test')
    })

    it('error 级别调用 logger.error', () => {
        backgroundManager.log('test', 'error')
        expect(backgroundManager.logger.error).toHaveBeenCalledWith('test')
    })

    it('debug 级别不调用 logger', () => {
        backgroundManager.log('test', 'debug')
        expect(backgroundManager.logger.sys).not.toHaveBeenCalled()
        expect(backgroundManager.logger.error).not.toHaveBeenCalled()
    })

    it('无 logger 时不报错', () => {
        backgroundManager.logger = null
        expect(() => backgroundManager.log('test', 'info')).not.toThrow()
    })
})

describe('backgroundManager - requestWakeLock', () => {
    let originalWakeLock
    let originalVisibility

    beforeEach(() => {
        originalWakeLock = global.navigator.wakeLock
        originalVisibility = document.visibilityState
    })

    afterEach(() => {
        if (originalWakeLock !== undefined) {
            global.navigator.wakeLock = originalWakeLock
        } else {
            delete global.navigator.wakeLock
        }
        Object.defineProperty(document, 'visibilityState', {
            value: originalVisibility,
            configurable: true
        })
    })

    it('navigator 无 wakeLock 时直接返回', async () => {
        delete global.navigator.wakeLock
        await backgroundManager.requestWakeLock()
        expect(backgroundManager.wakeLock).toBe(null)
    })

    it('已有 wakeLock 时不重新申请', async () => {
        global.navigator.wakeLock = { request: vi.fn() }
        backgroundManager.wakeLock = { existing: true }
        await backgroundManager.requestWakeLock()
        expect(global.navigator.wakeLock.request).not.toHaveBeenCalled()
    })

    it('document 不可见时不申请', async () => {
        const request = vi.fn()
        global.navigator.wakeLock = { request }
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        await backgroundManager.requestWakeLock()
        expect(request).not.toHaveBeenCalled()
    })

    it('申请成功时保存 wakeLock', async () => {
        const mockWakeLock = { addEventListener: vi.fn() }
        const request = vi.fn().mockResolvedValue(mockWakeLock)
        global.navigator.wakeLock = { request }
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        backgroundManager.wakeLock = null
        await backgroundManager.requestWakeLock()
        expect(backgroundManager.wakeLock).toBe(mockWakeLock)
    })

    it('申请失败时静默', async () => {
        const request = vi.fn().mockRejectedValue(new Error('fail'))
        global.navigator.wakeLock = { request }
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        backgroundManager.wakeLock = null
        await expect(backgroundManager.requestWakeLock()).resolves.toBeUndefined()
    })
})

describe('backgroundManager - enable (基础保活)', () => {
    it('调用 init 和 requestWakeLock', () => {
        const initSpy = vi.spyOn(backgroundManager, 'init')
        const wakeLockSpy = vi.spyOn(backgroundManager, 'requestWakeLock').mockResolvedValue(undefined)
        backgroundManager.enable()
        expect(initSpy).toHaveBeenCalled()
        expect(wakeLockSpy).toHaveBeenCalled()
    })
})

describe('backgroundManager - enableRealKeepAlive', () => {
    beforeEach(() => {
        backgroundManager.keepAliveActive = false
        backgroundManager.keepAliveAudio = null
        localStorage.clear()
    })

    it('已激活时返回 already_active', async () => {
        backgroundManager.keepAliveActive = true
        const result = await backgroundManager.enableRealKeepAlive()
        expect(result).toEqual({ ok: true, reason: 'already_active' })
    })

    it('成功启动后写入 localStorage', async () => {
        // Mock _startKeepAliveAudio
        backgroundManager._startKeepAliveAudio = vi.fn().mockResolvedValue({ ok: true })
        const result = await backgroundManager.enableRealKeepAlive({ title: 'test' })
        expect(result.ok).toBe(true)
        expect(localStorage.getItem('chilly-keepalive-enabled')).toBe('true')
        expect(localStorage.getItem('chilly-keepalive-meta')).toContain('test')
    })

    it('启动失败时不写 localStorage', async () => {
        backgroundManager._startKeepAliveAudio = vi.fn().mockResolvedValue({ ok: false, reason: 'fail' })
        const result = await backgroundManager.enableRealKeepAlive()
        expect(result.ok).toBe(false)
        expect(localStorage.getItem('chilly-keepalive-enabled')).toBe(null)
    })

    it('合并 meta: 传入覆盖 localStorage 中已保存的', async () => {
        localStorage.setItem('chilly-keepalive-meta', JSON.stringify({ title: 'saved', artist: 'old' }))
        let captured
        backgroundManager._startKeepAliveAudio = vi.fn(async (meta) => {
            captured = meta
            return { ok: true }
        })
        await backgroundManager.enableRealKeepAlive({ title: 'new' })
        expect(captured.title).toBe('new')
        expect(captured.artist).toBe('old')
    })
})

describe('backgroundManager - tryAutoResumeKeepAlive', () => {
    beforeEach(() => {
        backgroundManager.keepAliveActive = false
        localStorage.clear()
    })

    it('已激活时返回 already_active', async () => {
        backgroundManager.keepAliveActive = true
        const result = await backgroundManager.tryAutoResumeKeepAlive()
        expect(result.reason).toBe('already_active')
    })

    it('未启用过返回 never_enabled', async () => {
        const result = await backgroundManager.tryAutoResumeKeepAlive()
        expect(result).toEqual({ ok: false, reason: 'never_enabled' })
    })

    it('启用过则尝试恢复', async () => {
        localStorage.setItem('chilly-keepalive-enabled', 'true')
        localStorage.setItem('chilly-keepalive-meta', JSON.stringify({ title: 'x' }))
        const spy = vi.spyOn(backgroundManager, '_startKeepAliveAudio').mockResolvedValue({ ok: true })
        await backgroundManager.tryAutoResumeKeepAlive()
        expect(spy).toHaveBeenCalled()
    })
})

describe('backgroundManager - disableRealKeepAlive', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('未激活时只清持久化标记', () => {
        backgroundManager.keepAliveActive = false
        localStorage.setItem('chilly-keepalive-enabled', 'true')
        backgroundManager.disableRealKeepAlive()
        expect(localStorage.getItem('chilly-keepalive-enabled')).toBe(null)
    })

    it('激活时清所有状态', () => {
        const audio = {
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn(),
            parentNode: null
        }
        backgroundManager.keepAliveActive = true
        backgroundManager.keepAliveAudio = audio
        backgroundManager.keepAliveMonitorTimer = 123
        backgroundManager.keepAliveVisibilityHandler = () => {}
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

        backgroundManager.disableRealKeepAlive()

        expect(backgroundManager.keepAliveActive).toBe(false)
        expect(backgroundManager.keepAliveAudio).toBe(null)
        expect(backgroundManager.keepAliveMonitorTimer).toBe(null)
        expect(backgroundManager.keepAliveVisibilityHandler).toBe(null)
        expect(audio.pause).toHaveBeenCalled()
        expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
        removeEventListenerSpy.mockRestore()
    })

    it('有 parentNode 时移除 audio 元素', () => {
        const parent = { removeChild: vi.fn() }
        const audio = {
            pause: vi.fn(),
            removeAttribute: vi.fn(),
            load: vi.fn(),
            parentNode: parent
        }
        backgroundManager.keepAliveActive = true
        backgroundManager.keepAliveAudio = audio
        backgroundManager.disableRealKeepAlive()
        expect(parent.removeChild).toHaveBeenCalledWith(audio)
    })
})

describe('backgroundManager - isKeepAliveActive', () => {
    it('默认 false', () => {
        backgroundManager.keepAliveActive = false
        expect(backgroundManager.isKeepAliveActive()).toBe(false)
    })

    it('激活后 true', () => {
        backgroundManager.keepAliveActive = true
        expect(backgroundManager.isKeepAliveActive()).toBe(true)
    })
})

describe('backgroundManager - resumeKeepAliveAudio', () => {
    it('未激活时不动作', () => {
        backgroundManager.keepAliveActive = false
        backgroundManager.keepAliveAudio = { paused: true, play: vi.fn() }
        backgroundManager.resumeKeepAliveAudio()
        expect(backgroundManager.keepAliveAudio.play).not.toHaveBeenCalled()
    })

    it('无 audio 时不动作', () => {
        backgroundManager.keepAliveActive = true
        backgroundManager.keepAliveAudio = null
        expect(() => backgroundManager.resumeKeepAliveAudio()).not.toThrow()
    })

    it('激活且 audio 暂停时调用 play', () => {
        const play = vi.fn().mockResolvedValue()
        backgroundManager.keepAliveActive = true
        backgroundManager.keepAliveAudio = { paused: true, play }
        backgroundManager.resumeKeepAliveAudio()
        expect(play).toHaveBeenCalled()
    })

    it('audio 未暂停时不调用 play', () => {
        const play = vi.fn().mockResolvedValue()
        backgroundManager.keepAliveActive = true
        backgroundManager.keepAliveAudio = { paused: false, play }
        backgroundManager.resumeKeepAliveAudio()
        expect(play).not.toHaveBeenCalled()
    })
})

describe('backgroundManager - yieldToOtherAudio / resumeFromYield', () => {
    let originalMediaSession

    beforeEach(() => {
        originalMediaSession = global.navigator.mediaSession
        backgroundManager.keepAliveActive = true
        backgroundManager.keepAliveYielded = false
        backgroundManager.keepAliveAudio = { paused: false, pause: vi.fn() }
    })

    afterEach(() => {
        if (originalMediaSession !== undefined) {
            global.navigator.mediaSession = originalMediaSession
        }
    })

    it('yieldToOtherAudio 暂停 audio 并设置 yielded', () => {
        backgroundManager.yieldToOtherAudio()
        expect(backgroundManager.keepAliveAudio.pause).toHaveBeenCalled()
        expect(backgroundManager.keepAliveYielded).toBe(true)
    })

    it('已 yielded 时不重复 yield', () => {
        backgroundManager.keepAliveYielded = true
        backgroundManager.yieldToOtherAudio()
        expect(backgroundManager.keepAliveAudio.pause).not.toHaveBeenCalled()
    })

    it('未激活时不 yield', () => {
        backgroundManager.keepAliveActive = false
        backgroundManager.yieldToOtherAudio()
        expect(backgroundManager.keepAliveYielded).toBe(false)
    })

    it('无 audio 时不 yield', () => {
        backgroundManager.keepAliveAudio = null
        expect(() => backgroundManager.yieldToOtherAudio()).not.toThrow()
    })

    it('resumeFromYield 重置 yielded', () => {
        backgroundManager.keepAliveYielded = true
        backgroundManager.resumeFromYield()
        expect(backgroundManager.keepAliveYielded).toBe(false)
    })

    it('未激活时不 resume', () => {
        backgroundManager.keepAliveActive = false
        backgroundManager.keepAliveYielded = true
        backgroundManager.resumeFromYield()
        // 仍为 true
        expect(backgroundManager.keepAliveYielded).toBe(true)
    })
})

describe('backgroundManager - 静态方法', () => {
    beforeEach(() => {
        vi.spyOn(backgroundManager, 'yieldToOtherAudio')
        vi.spyOn(backgroundManager, 'resumeFromYield')
    })

    it('yieldAudio 调用实例方法', () => {
        backgroundManager.constructor.yieldAudio()
        expect(backgroundManager.yieldToOtherAudio).toHaveBeenCalled()
    })

    it('resumeAudio 调用实例方法', () => {
        backgroundManager.constructor.resumeAudio()
        expect(backgroundManager.resumeFromYield).toHaveBeenCalled()
    })
})

describe('backgroundManager - destroy', () => {
    it('调用 disableRealKeepAlive 和清状态', () => {
        const disableSpy = vi.spyOn(backgroundManager, 'disableRealKeepAlive')
        backgroundManager.wakeLock = { release: vi.fn() }
        backgroundManager.initialized = true
        backgroundManager._visibilityHandlerInstalled = true

        backgroundManager.destroy()

        expect(disableSpy).toHaveBeenCalled()
        expect(backgroundManager.wakeLock).toBe(null)
        expect(backgroundManager.initialized).toBe(false)
        expect(backgroundManager._visibilityHandlerInstalled).toBe(false)
    })
})

describe('backgroundManager - 弃用方法', () => {
    it('scheduleNativeNotification 返回 false', async () => {
        const result = await backgroundManager.scheduleNativeNotification()
        expect(result).toBe(false)
    })

    it('computeAndScheduleNextNotification 返回 false', async () => {
        const result = await backgroundManager.computeAndScheduleNextNotification()
        expect(result).toBe(false)
    })
})
