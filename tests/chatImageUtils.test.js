/**
 * chatImageUtils.js 单元测试 - 批量图片压缩与 LS_JSON 提取
 * 验证:
 * - extractLSActions: 从 JSON payload 提取操作描述
 * - compressAllChatImages: 压缩聊天 + 朋友圈图片(mock compressImage / momentsStore)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock imageUtils 的 compressImage
const { mockCompressImage } = vi.hoisted(() => ({
    mockCompressImage: vi.fn(async () => 'data:image/jpeg;base64,COMPRESSED_SMALL')
}))
vi.mock('../src/utils/imageUtils', () => ({
    compressImage: mockCompressImage
}))

// Mock momentsStore
const { mockMomentsStore, mockUseMomentsStore } = vi.hoisted(() => {
    const mockMomentsStore = {
        moments: [],
        saveMoments: vi.fn(async () => {})
    }
    return {
        mockMomentsStore,
        mockUseMomentsStore: vi.fn(() => mockMomentsStore)
    }
})
vi.mock('../src/stores/momentsStore', () => ({
    useMomentsStore: mockUseMomentsStore
}))

const { compressAllChatImages, extractLSActions } = await import('../src/utils/chatImageUtils')

// 创建大的 base64 (超过 100KB)
const bigBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(150 * 1024)
const smallBase64 = 'data:image/jpeg;base64,SMALL'

describe('chatImageUtils - extractLSActions', () => {
    describe('基础行为', () => {
        it('null 返回空数组', () => {
            expect(extractLSActions(null)).toEqual([])
        })

        it('undefined 返回空数组', () => {
            expect(extractLSActions(undefined)).toEqual([])
        })

        it('空字符串返回空数组', () => {
            expect(extractLSActions('')).toEqual([])
        })

        it('非字符串返回空数组', () => {
            expect(extractLSActions(123)).toEqual([])
            expect(extractLSActions({})).toEqual([])
            expect(extractLSActions([])).toEqual([])
        })

        it('非 JSON 返回空数组', () => {
            expect(extractLSActions('not json')).toEqual([])
            expect(extractLSActions('{invalid}')).toEqual([])
        })
    })

    describe('单条操作', () => {
        it('diary 转中文', () => {
            const payload = JSON.stringify({ type: 'diary' })
            expect(extractLSActions(payload)).toEqual(['写了一篇日记'])
        })

        it('footprint 转中文', () => {
            const payload = JSON.stringify({ type: 'footprint' })
            expect(extractLSActions(payload)).toEqual(['更新了足迹'])
        })

        it('message 转中文', () => {
            const payload = JSON.stringify({ type: 'message' })
            expect(extractLSActions(payload)).toEqual(['留了一条言'])
        })

        it('gacha 转中文', () => {
            const payload = JSON.stringify({ type: 'gacha' })
            expect(extractLSActions(payload)).toEqual(['抽了一个扭蛋'])
        })

        it('letter 转中文', () => {
            const payload = JSON.stringify({ type: 'letter' })
            expect(extractLSActions(payload)).toEqual(['写了一封信'])
        })

        it('question/answer 转中文', () => {
            expect(extractLSActions(JSON.stringify({ type: 'question' }))).toEqual(['发了一个问题'])
            expect(extractLSActions(JSON.stringify({ type: 'answer' }))).toEqual(['回答了一个问题'])
        })

        it('anniversary 转中文', () => {
            const payload = JSON.stringify({ type: 'anniversary' })
            expect(extractLSActions(payload)).toEqual(['记录了一个纪念日'])
        })

        it('album 转中文', () => {
            const payload = JSON.stringify({ type: 'album' })
            expect(extractLSActions(payload)).toEqual(['上传了一张照片'])
        })

        it('schedule 转中文', () => {
            const payload = JSON.stringify({ type: 'schedule' })
            expect(extractLSActions(payload)).toEqual(['添加了一个日程'])
        })

        it('bind 转中文', () => {
            const payload = JSON.stringify({ type: 'bind' })
            expect(extractLSActions(payload)).toEqual(['开通了情侣空间'])
        })
    })

    describe('多种操作', () => {
        it('多条操作(数组)', () => {
            const payload = JSON.stringify([
                { type: 'diary' },
                { type: 'letter' },
                { type: 'gacha' }
            ])
            expect(extractLSActions(payload)).toEqual([
                '写了一篇日记',
                '写了一封信',
                '抽了一个扭蛋'
            ])
        })

        it('单条也支持对象包装', () => {
            const payload = JSON.stringify({ type: 'diary' })
            const result = extractLSActions(payload)
            expect(result.length).toBe(1)
        })
    })

    describe('未知类型', () => {
        it('未知 type 返回原 type 字符串', () => {
            const payload = JSON.stringify({ type: 'unknown_action' })
            expect(extractLSActions(payload)).toEqual(['unknown_action'])
        })

        it('空 type 返回空字符串', () => {
            const payload = JSON.stringify({ type: '' })
            // 空字符串 falsy,不会被 push
            expect(extractLSActions(payload)).toEqual([])
        })

        it('无 type 字段跳过', () => {
            const payload = JSON.stringify({ foo: 'bar' })
            expect(extractLSActions(payload)).toEqual([])
        })
    })

    describe('无效 item', () => {
        it('数组中含 null 跳过', () => {
            const payload = JSON.stringify([null, { type: 'diary' }, null])
            expect(extractLSActions(payload)).toEqual(['写了一篇日记'])
        })

        it('数组中含非对象跳过', () => {
            const payload = JSON.stringify(['string', 123, { type: 'diary' }])
            expect(extractLSActions(payload)).toEqual(['写了一篇日记'])
        })
    })
})

describe('chatImageUtils - compressAllChatImages', () => {
    beforeEach(() => {
        mockCompressImage.mockClear()
        mockMomentsStore.moments = []
        mockMomentsStore.saveMoments.mockClear()
        mockUseMomentsStore.mockClear()
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('返回 Promise<number>', async () => {
        const result = await compressAllChatImages({})
        expect(typeof result).toBe('number')
    })

    it('空 chats 不压缩', async () => {
        const result = await compressAllChatImages({})
        expect(result).toBe(0)
        expect(mockCompressImage).not.toHaveBeenCalled()
    })

    it('处理非 ref 形式 (chats 直接是对象)', async () => {
        const chats = {
            c1: {
                id: 'c1',
                msgs: [
                    { id: 'm1', type: 'image', content: bigBase64 }
                ]
            }
        }
        const result = await compressAllChatImages(chats)
        expect(result).toBe(1)
        expect(mockCompressImage).toHaveBeenCalled()
    })

    it('处理 ref.value 形式', async () => {
        const chats = { value: {} }
        const result = await compressAllChatImages(chats)
        expect(result).toBe(0)
    })

    it('小图片 (< 100KB) 跳过', async () => {
        const chats = {
            c1: {
                id: 'c1',
                msgs: [
                    { id: 'm1', type: 'image', content: smallBase64 }  // 远小于 100KB
                ]
            }
        }
        const result = await compressAllChatImages(chats)
        expect(result).toBe(0)
        expect(mockCompressImage).not.toHaveBeenCalled()
    })

    it('非 image 消息跳过', async () => {
        const chats = {
            c1: {
                id: 'c1',
                msgs: [
                    { id: 'm1', type: 'text', content: bigBase64 }
                ]
            }
        }
        const result = await compressAllChatImages(chats)
        expect(result).toBe(0)
    })

    it('非 data:image 跳过', async () => {
        const chats = {
            c1: {
                id: 'c1',
                msgs: [
                    { id: 'm1', type: 'image', content: 'https://example.com/img.jpg' }
                ]
            }
        }
        const result = await compressAllChatImages(chats)
        expect(result).toBe(0)
    })

    it('压缩后替换原 content', async () => {
        const chats = {
            c1: {
                id: 'c1',
                msgs: [
                    { id: 'm1', type: 'image', content: bigBase64 }
                ]
            }
        }
        await compressAllChatImages(chats)
        // mockCompressImage 返回 'data:image/jpeg;base64,COMPRESSED_SMALL' (28 字符) < bigBase64
        expect(chats.c1.msgs[0].content).toBe('data:image/jpeg;base64,COMPRESSED_SMALL')
    })

    it('无 msgs 的 chat 跳过', async () => {
        const chats = {
            c1: { id: 'c1' /* no msgs */ }
        }
        const result = await compressAllChatImages(chats)
        expect(result).toBe(0)
    })

    it('调用 saveChats(true) 如果提供', async () => {
        const saveChats = vi.fn(async () => {})
        await compressAllChatImages({}, saveChats)
        expect(saveChats).toHaveBeenCalledWith(true)
    })

    it('saveChats 非函数不报错', async () => {
        await expect(compressAllChatImages({}, 'not a function')).resolves.toBe(0)
    })

    it('朋友圈有 data:image 走压缩路径', async () => {
        mockMomentsStore.moments = [
            {
                id: 'm1',
                images: [bigBase64]
            }
        ]
        const result = await compressAllChatImages({})
        // 朋友圈至少压缩 1 个
        expect(result).toBeGreaterThanOrEqual(1)
    })

    it('朋友圈图片小则跳过', async () => {
        mockMomentsStore.moments = [
            {
                id: 'm1',
                images: [smallBase64]
            }
        ]
        const result = await compressAllChatImages({})
        expect(result).toBe(0)
    })

    it('朋友圈无 images 字段跳过', async () => {
        mockMomentsStore.moments = [
            { id: 'm1' /* no images */ }
        ]
        await expect(compressAllChatImages({})).resolves.toBe(0)
    })

    it('朋友圈压缩后调用 saveMoments', async () => {
        mockMomentsStore.moments = [
            {
                id: 'm1',
                images: [bigBase64]
            }
        ]
        await compressAllChatImages({})
        expect(mockMomentsStore.saveMoments).toHaveBeenCalled()
    })

    it('朋友圈 saveMoments 不存在也不报错', async () => {
        mockMomentsStore.moments = [{ id: 'm1', images: [bigBase64] }]
        // saveMoments 改为 undefined
        const original = mockMomentsStore.saveMoments
        mockMomentsStore.saveMoments = undefined
        await expect(compressAllChatImages({})).resolves.not.toThrow()
        mockMomentsStore.saveMoments = original
    })

    it('朋友圈 images 不是数组跳过', async () => {
        mockMomentsStore.moments = [
            { id: 'm1', images: 'not array' }
        ]
        await expect(compressAllChatImages({})).resolves.toBe(0)
    })
})
