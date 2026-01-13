import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { compressImage } from '../utils/imageUtils'

export const useStickerStore = defineStore('sticker', () => {
    const stickers = ref([])
    const STORAGE_KEY = 'wechat_global_emojis'

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
        const targetList = getStickers(scope)
        const finalName = name?.trim() || `Sticker_${Date.now()}`

        // Check for duplicates (By URL Only, as requested)
        if (targetList && targetList.some(s => s.url === url)) {
            console.warn(`[StickerStore] Duplicate detected for URL. Skipping.`)
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
            if (file.size > 5 * 1024 * 1024) { // Increased limit before compression (5MB)
                alert('原图太大 (建议<5MB)')
                reject('Too large')
                return
            }

            // Compress first
            compressImage(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 }) // Stickers can be small
                .then(base64 => {
                    const name = file.name.split('.')[0] || `Custom_${Date.now()}`
                    addSticker(base64, name, scope)
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

    function clearAllStickers(scope = 'global') {
        if (scope === 'global') {
            stickers.value = []
            saveStickers()
        } else {
            const chat = chatStore.chats[scope]
            if (chat) {
                chatStore.updateCharacter(scope, { emojis: [] })
            }
        }
    }

    // Import from text content
    function importStickersFromText(content, scope = 'global') {
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

            // Smart Separator Detection
            // 1. Priority: Chinese colon (avoid http: interference)
            let sepIndex = line.indexOf('：')

            // 2. If no Chinese colon, try English colon ONLY if it's a separator (not part of ://)
            if (sepIndex === -1) {
                const engIndex = line.indexOf(':')
                if (engIndex > -1) {
                    // Check if this : is followed by // (making it part of a URL)
                    const isUrlStart = line.substring(engIndex, engIndex + 3) === '://'
                    if (isUrlStart) {
                        // If it's a URL but there's ANOTHER colon before it, the first one was the name
                        // But indexOf gives us the first one. So if the FIRST colon is ://, we assume no name separator
                    } else {
                        sepIndex = engIndex
                    }
                }
            }

            if (sepIndex > -1) {
                name = line.substring(0, sepIndex).trim()
                url = line.substring(sepIndex + 1).trim()
            } else if (line.startsWith('http')) {
                // Standalone URL
                url = line
                name = `Sticker_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            }

            if (url && (url.startsWith('http') || url.startsWith('data:'))) {
                const result = addSticker(url, name, scope)
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

    return {
        stickers,
        getStickers,
        addSticker,
        uploadSticker,

        deleteSticker,
        importStickersFromText,
        clearAllStickers
    }
})
