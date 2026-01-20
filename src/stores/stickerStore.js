import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { compressImage } from '../utils/imageUtils'
import { useChatStore } from './chatStore'
import { defaultStickers } from './defaultStickers'

export const useStickerStore = defineStore('sticker', () => {
    const stickers = ref([])
    const STORAGE_KEY = 'wechat_global_emojis'
    const chatStore = useChatStore()

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers.value))
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
                alert('原图太大 (建议<5MB)')
                reject('Too large')
                return
            }

            compressImage(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 })
                .then(base64 => {
                    const name = file.name.split('.')[0] || `Custom_${Date.now()}`
                    const result = addSticker(base64, name, scope)

                    if (scope !== 'global' && result && typeof result === 'object') {
                        const chat = chatStore.chats[scope]
                        if (chat) {
                            const newEmojis = [...(chat.emojis || []), result]
                            chatStore.updateCharacter(scope, { emojis: newEmojis })
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

    function deleteSticker(strUrl, scope = 'global') {
        if (scope === 'global') {
            stickers.value = stickers.value.filter(s => s.url !== strUrl)
            saveStickers()
        } else {
            const chat = chatStore.chats[scope]
            if (chat && chat.emojis) {
                const newEmojis = chat.emojis.filter(s => s.url !== strUrl)
                chatStore.updateCharacter(scope, { emojis: newEmojis })
            }
        }
    }

    function deleteBatchStickers(urls, scope = 'global') {
        if (!urls || urls.length === 0) return

        if (scope === 'global') {
            stickers.value = stickers.value.filter(s => !urls.includes(s.url))
            saveStickers()
        } else {
            const chat = chatStore.chats[scope]
            if (chat && chat.emojis) {
                const newEmojis = chat.emojis.filter(s => !urls.includes(s.url))
                chatStore.updateCharacter(scope, { emojis: newEmojis })
            }
        }
    }

    function clearAllStickers(scope = 'global') {
        if (scope === 'global') {
            stickers.value = []
            saveStickers()
        } else {
            if (chatStore.chats[scope]) {
                chatStore.updateCharacter(scope, { emojis: [] })
            }
        }
    }

    // Import from text content
    function importStickersFromText(content, scope = 'global', category = null) {
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
