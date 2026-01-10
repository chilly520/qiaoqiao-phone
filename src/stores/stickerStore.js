import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChatStore } from './chatStore'
import { compressImage } from '../utils/imageUtils'

export const useStickerStore = defineStore('sticker', () => {
    const customStickers = ref([])
    const STORAGE_KEY = 'wechat_global_emojis'
    const chatStore = useChatStore()

    // Load Global Stickers
    function loadStickers() {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed)) {
                    customStickers.value = parsed
                } else {
                    customStickers.value = []
                }
            } catch (e) {
                console.error('Failed to load global emojis', e)
                customStickers.value = []
            }
        }
    }

    // Save Global Stickers
    function saveStickers() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customStickers.value))
    }

    // Get specific list based on scope ('global' or chatId)
    function getStickers(scope) {
        if (!scope || scope === 'global') {
            return customStickers.value
        }
        // Character Specific
        const chat = chatStore.chats[scope]
        return chat && chat.emojis ? chat.emojis : []
    }

    // Add a new sticker
    function addSticker(url, name, scope = 'global') {
        const targetList = getStickers(scope)
        const finalName = name?.trim() || `Sticker_${Date.now()}`

        // Check for duplicates (By URL Only, as requested)
        if (targetList.some(s => s.url === url)) {
            console.warn(`[StickerStore] Duplicate detected for URL. Skipping.`)
            return false
        }

        const newSticker = {
            name: finalName,
            url: url
        }

        if (scope === 'global') {
            customStickers.value.push(newSticker)
            saveStickers()
        } else {
            // Character Scope: Update via ChatStore
            const chat = chatStore.chats[scope]
            if (chat) {
                const newEmojis = [...(chat.emojis || []), newSticker]
                chatStore.updateCharacter(scope, { emojis: newEmojis })
            }
        }
        return true
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
            customStickers.value = customStickers.value.filter(s => s.url !== strUrl)
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
            customStickers.value = []
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
                name = `Sticker_${Date.now()}_${Math.floor(Math.random()*1000)}`
            }
            
            if (url && (url.startsWith('http') || url.startsWith('data:'))) {
                const targetList = getStickers(scope)
                const isDup = targetList.some(s => s.url === url)
                
                if (isDup) {
                    dupCount++
                } else {
                    const success = addSticker(url, name, scope)
                    if (success) successCount++
                    else failCount++
                }
            } else {
                failCount++
            }
        })
        
        return { success: successCount, duplicate: dupCount, failed: failCount }
    }

    // Initialize
    loadStickers()

    return {
        customStickers,
        getStickers,
        addSticker,
        uploadSticker,

        deleteSticker,
        importStickersFromText,
        clearAllStickers
    }
})
