import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { compressImage } from '../utils/imageUtils'
import { useChatStore } from './chatStore'
import { defaultStickers } from './defaultStickers'

export const useStickerStore = defineStore('sticker', () => {
    const stickers = ref([])
    const STORAGE_KEY = 'wechat_global_emojis'
    const chatStore = useChatStore()

    // [BUG FIX] 按 scope 串行化角色表情的 read-modify-write 操作.
    // 原代码 deleteSticker / deleteBatchStickers / clearAllStickers 都是:
    //   1. 读 chat.emojis
    //   2. filter 出 newEmojis
    //   3. await chatStore.updateCharacter(scope, { emojis: newEmojis })
    //
    // 如果用户连续点删除 url1 + url2 (间隔 < 100ms), 两次调用都读到同一份 chat.emojis,
    // 第一次 await 完成后写入 [b, c] (删了 a), 第二次 await 完成后写入 [a, c] (删了 b),
    // 但第二次写入的 [a, c] 是基于"原始 [a,b,c] 删 b"的结果, a 又回来了! 删了 a 等于没删.
    // 用 per-scope promise 链串行化, 保证第二次读时第一次的写入已完成.
    const _scopeLocks = new Map()
    async function _withScopeLock(scope, fn) {
        const prev = _scopeLocks.get(scope) || Promise.resolve()
        let release
        const next = new Promise(r => { release = r })
        // 链尾 promise: 等 prev 完成后再等 next (即等本次 release)
        const tail = prev.then(() => next)
        _scopeLocks.set(scope, tail)
        await prev
        try {
            return await fn()
        } finally {
            release()
            // 如果没人排队, tail 已 settle, 可清理; 若有人在排, _scopeLocks 仍是新 tail
            if (_scopeLocks.get(scope) === tail) {
                _scopeLocks.delete(scope)
            }
        }
    }

    // Load Global Stickers
    function loadStickers() {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed)) {
                    stickers.value = parsed
                } else {
                    stickers.value = []
                }
            } catch (e) {
                console.error('Failed to load global emojis', e)
                stickers.value = []
            }
        }
    }

    // Save Global Stickers
    function saveStickers() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers.value))
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('[StickerStore] localStorage 配额已满，无法保存表情数据（表情数量过多）')
                // 尝试只保存最近 200 个表情
                try {
                    const trimmed = stickers.value.slice(-200)
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
                    console.warn('[StickerStore] 已裁剪至最近 200 个表情保存')
                } catch (e2) {
                    console.error('[StickerStore] 即使裁剪后仍无法保存', e2)
                }
            } else {
                console.error('[StickerStore] saveStickers failed', e)
            }
        }
    }

    // Get specific list based on scope ('global' or a stickers list)
    function getStickers(scope, charStickers = []) {
        if (!scope || scope === 'global') {
            return stickers.value
        }
        // Character Specific
        return charStickers
    }

    // Add a new sticker
    function addSticker(url, name, scope = 'global', category = null) {
        const targetList = getStickers(scope, scope !== 'global' ? (chatStore.chats[scope]?.emojis || []) : [])
        const finalName = name?.trim() || `Sticker_${Date.now()}`

        // Check for duplicates (By URL Only, as requested)
        if (targetList && targetList.some(s => s.url === url)) {
            console.warn('[StickerStore] Duplicate detected for URL. Skipping.')
            return false
        }

        const newSticker = {
            name: finalName,
            url: url
        }

        // Add category if provided
        if (category && category.trim()) {
            newSticker.category = category.trim()
        }

        if (scope === 'global') {
            stickers.value.push(newSticker)
            saveStickers()
            return true
        } else {
            // Character Scope: Return the sticker object
            return newSticker
        }
    }

    // Process file upload
    function uploadSticker(file, scope = 'global') {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject('No file')
                return
            }
            if (file.size > 5 * 1024 * 1024) {
                chatStore.triggerToast('原图太大 (建议<5MB)', 'warning')
                reject('Too large')
                return
            }

            compressImage(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 })
                .then(async base64 => {
                    const name = file.name.split('.')[0] || `Custom_${Date.now()}`
                    const result = addSticker(base64, name, scope)

                    if (scope !== 'global' && result && typeof result === 'object') {
                        const chat = chatStore.chats[scope]
                        if (chat) {
                            const newEmojis = [...(chat.emojis || []), result]
                            // [BUG FIX] 缺少 await, resolve(base64) 立即返回后
                            // 角色表情列表的 IndexedDB 持久化仍在进行中,
                            // 此时若页面刷新或快速切换会导致表情丢失.
                            await chatStore.updateCharacter(scope, { emojis: newEmojis })
                        }
                    }

                    resolve(base64)
                })
                .catch(err => {
                    console.error('Compression failed', err)
                    reject(err)
                })
        })
    }

    async function deleteSticker(strUrl, scope = 'global') {
        if (scope === 'global') {
            stickers.value = stickers.value.filter(s => s.url !== strUrl)
            saveStickers()
        } else {
            // [BUG FIX] 用 _withScopeLock 串行化, 防止并发删除时 read-modify-write 丢更新
            await _withScopeLock(scope, async () => {
                const chat = chatStore.chats[scope]
                if (chat && chat.emojis) {
                    const newEmojis = chat.emojis.filter(s => s.url !== strUrl)
                    await chatStore.updateCharacter(scope, { emojis: newEmojis })
                }
            })
        }
    }

    async function deleteBatchStickers(urls, scope = 'global') {
        if (!urls || urls.length === 0) return

        if (scope === 'global') {
            stickers.value = stickers.value.filter(s => !urls.includes(s.url))
            saveStickers()
        } else {
            // [BUG FIX] 同 deleteSticker, 串行化
            await _withScopeLock(scope, async () => {
                const chat = chatStore.chats[scope]
                if (chat && chat.emojis) {
                    const newEmojis = chat.emojis.filter(s => !urls.includes(s.url))
                    await chatStore.updateCharacter(scope, { emojis: newEmojis })
                }
            })
        }
    }

    async function clearAllStickers(scope = 'global') {
        if (scope === 'global') {
            stickers.value = []
            saveStickers()
        } else {
            // [BUG FIX] 同 deleteSticker, 串行化
            await _withScopeLock(scope, async () => {
                if (chatStore.chats[scope]) {
                    await chatStore.updateCharacter(scope, { emojis: [] })
                }
            })
        }
    }

    // Import from text content
    function importStickersFromText(content, scope = 'global', category = null) {
        // [BUG FIX] content 可能是 null/undefined/非字符串 (例如上传文件解析失败返回 null,
        // 或者用户复制粘贴空内容). 原代码 `content.split` 会 TypeError 直接抛错,
        // 调用方 catch 后 UI 显示"导入失败"但实际原因不明. 显式 guard + 返回空结果.
        if (!content || typeof content !== 'string') {
            return { success: 0, duplicate: 0, failed: 0, newStickers: [] }
        }
        const lines = content.split(/\r?\n/)
        let successCount = 0
        let dupCount = 0
        let failCount = 0

        const newStickers = []
        lines.forEach(line => {
            line = line.trim()
            if (!line) return

            let name = ''
            let url = ''

            let sepIndex = line.indexOf('：')
            if (sepIndex === -1) {
                const engIndex = line.indexOf(':')
                if (engIndex > -1) {
                    const isUrlStart = line.substring(engIndex, engIndex + 3) === '://'
                    if (!isUrlStart) sepIndex = engIndex
                }
            }

            if (sepIndex > -1) {
                name = line.substring(0, sepIndex).trim()
                url = line.substring(sepIndex + 1).trim()
            } else if (line.startsWith('http')) {
                url = line
                name = `Sticker_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            }

            if (url && (url.startsWith('http') || url.startsWith('data:'))) {
                const result = addSticker(url, name, scope, category)
                if (result === true) {
                    successCount++
                } else if (result === false) {
                    dupCount++
                } else if (typeof result === 'object') {
                    successCount++
                    newStickers.push(result)
                } else {
                    failCount++
                }
            } else {
                failCount++
            }
        })

        return { success: successCount, duplicate: dupCount, failed: failCount, newStickers }
    }

    // Initialize
    loadStickers()
    initializeDefaults()

    function initializeDefaults() {
        if (!defaultStickers || defaultStickers.length === 0) return

        const existingUrls = new Set(stickers.value.map(s => s.url))
        let addedCount = 0

        defaultStickers.forEach(def => {
            if (!existingUrls.has(def.url)) {
                stickers.value.push(def)
                existingUrls.add(def.url)
                addedCount++
            }
        })

        if (addedCount > 0) {
            saveStickers()
            console.log(`[StickerStore] Added ${addedCount} new default stickers.`)
        }
    }

    return {
        stickers,
        getStickers,
        addSticker,
        uploadSticker,
        deleteSticker,
        deleteBatchStickers,
        importStickersFromText,
        clearAllStickers
    }
})
