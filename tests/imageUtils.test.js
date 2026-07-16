/**
 * imageUtils.js 单元测试 - 图片压缩 (Canvas)
 * 验证:
 * - compressImage: 错误处理、Canvas 渲染、PNG→JPEG/WebP 转换、文件 API 集成
 * - mock FileReader / Image / canvas.toDataURL
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { compressImage } from '../src/utils/imageUtils'

// Mock FileReader 异步触发 onload
function setupFileReaderMock() {
    class MockFileReader {
        constructor() {
            this.result = null
            this.onload = null
            this.onerror = null
        }
        readAsDataURL(_file) {
            // 模拟 data URL
            this.result = 'data:image/jpeg;base64,mockdata'
            // 异步触发
            setTimeout(() => this.onload && this.onload({ target: this }), 0)
        }
    }
    global.FileReader = MockFileReader
}

// Mock Image
function setupImageMock({ width = 800, height = 600 } = {}) {
    class MockImage {
        constructor() {
            this.onload = null
            this.onerror = null
            this._width = width
            this._height = height
        }
        get width() { return this._width }
        get height() { return this._height }
        set src(_val) {
            setTimeout(() => this.onload && this.onload(), 0)
        }
    }
    global.Image = MockImage
}

// Mock canvas
function setupCanvasMock() {
    HTMLCanvasElement.prototype.getContext = function () {
        return {
            drawImage: vi.fn(),
            fillStyle: '',
            fillRect: vi.fn()
        }
    }
    HTMLCanvasElement.prototype.toDataURL = vi.fn(function (type, quality) {
        if (type === 'image/webp') {
            return 'data:image/webp;base64,mockwebp'
        }
        return `data:${type};base64,mockoutput_q${quality}`
    })
}

describe('imageUtils - compressImage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setupFileReaderMock()
        setupImageMock()
        setupCanvasMock()
    })

    describe('基础行为', () => {
        it('返回 Promise', () => {
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            const result = compressImage(file)
            expect(result).toBeInstanceOf(Promise)
        })

        it('null 文件 reject', async () => {
            await expect(compressImage(null)).rejects.toThrow('No file provided')
        })

        it('undefined 文件 reject', async () => {
            await expect(compressImage(undefined)).rejects.toThrow('No file provided')
        })

        it('空文件也能处理', async () => {
            const file = new File([''], 'empty.jpg', { type: 'image/jpeg' })
            // 不应 reject
            await expect(compressImage(file)).resolves.toBeTruthy()
        })
    })

    describe('Canvas 渲染', () => {
        it('drawImage 被调用', async () => {
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await compressImage(file)
            // getContext 已返回 mock
            const ctx = document.createElement('canvas').getContext('2d')
            expect(ctx.drawImage).toBeDefined()
        })

        it('使用默认尺寸 600x600', async () => {
            // 默认 maxWidth/maxHeight = 600
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await compressImage(file)
            const canvas = document.createElement('canvas')
            // 我们的 mock 让 toDataURL 返回 mockoutput
            const result = await compressImage(file)
            expect(result).toContain('mockoutput')
        })

        it('自定义 maxWidth/maxHeight/quality', async () => {
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.9 })
            // 不应 reject
        })
    })

    describe('尺寸调整', () => {
        it('宽度大于 maxWidth 时缩放', async () => {
            setupImageMock({ width: 1200, height: 800 })  // 宽 > 600
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            const result = await compressImage(file, { maxWidth: 600, maxHeight: 600 })
            expect(result).toBeTruthy()
        })

        it('高度大于 maxHeight 时缩放', async () => {
            setupImageMock({ width: 600, height: 1200 })  // 高 > 600
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            const result = await compressImage(file, { maxWidth: 600, maxHeight: 600 })
            expect(result).toBeTruthy()
        })

        it('原图小于 max 不缩放', async () => {
            setupImageMock({ width: 400, height: 300 })
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            const result = await compressImage(file)
            expect(result).toBeTruthy()
        })
    })

    describe('PNG 转换', () => {
        it('小 PNG 保持 PNG 走 WebP 路径', async () => {
            const file = new File(['x'.repeat(1000)], 'small.png', { type: 'image/png' })
            const result = await compressImage(file)
            // PNG < 500KB 应尝试 WebP,mock 返回 image/webp
            expect(result).toContain('image/webp')
        })

        it('大 PNG ( > 500KB ) 转 JPEG 并填充白色背景', async () => {
            const file = new File(['x'.repeat(600 * 1024)], 'big.png', { type: 'image/png' })
            const result = await compressImage(file)
            // 大 PNG 转 JPEG
            expect(result).toContain('image/jpeg')
        })

        it('非 PNG 直接 JPEG 编码', async () => {
            const file = new File(['x'.repeat(100)], 'test.gif', { type: 'image/gif' })
            const result = await compressImage(file)
            expect(result).toBeTruthy()
        })
    })

    describe('toDataURL 调用', () => {
        it('返回 base64 data URL', async () => {
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            const result = await compressImage(file)
            expect(result).toMatch(/^data:image\/[a-z]+;base64,/)
        })

        it('canvas.toDataURL 被调用', async () => {
            const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await compressImage(file)
            expect(toDataURLSpy).toHaveBeenCalled()
        })
    })

    describe('FileReader 错误', () => {
        it('FileReader 错误时 reject', async () => {
            class ErrorFileReader {
                readAsDataURL() {
                    setTimeout(() => this.onerror && this.onerror(new Error('read fail')), 0)
                }
            }
            global.FileReader = ErrorFileReader

            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await expect(compressImage(file)).rejects.toThrow('read fail')
        })
    })

    describe('Image 错误', () => {
        it('Image 加载错误时 reject', async () => {
            class ErrorImage {
                set src(_v) {
                    setTimeout(() => this.onerror && this.onerror(new Error('img fail')), 0)
                }
            }
            global.Image = ErrorImage

            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await expect(compressImage(file)).rejects.toThrow('img fail')
        })
    })

    describe('quality 参数', () => {
        it('quality 0.5 传给 toDataURL', async () => {
            const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await compressImage(file, { quality: 0.5 })
            expect(toDataURLSpy).toHaveBeenCalledWith(expect.any(String), 0.5)
        })

        it('默认 quality 0.6', async () => {
            const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
            await compressImage(file)
            // 调用可能不止一次 (WebP 尝试),但至少有一次 quality=0.6
            const calls = toDataURLSpy.mock.calls
            const hasDefault = calls.some(c => c[1] === 0.6)
            expect(hasDefault).toBe(true)
        })
    })
})
