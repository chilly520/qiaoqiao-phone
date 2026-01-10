import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChatStore } from './chatStore'

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

        // Check for duplicates (By URL OR By Name)
        if (targetList.some(s => s.url === url || s.name === finalName)) {
            console.warn(`[StickerStore] Duplicate detected for name: "${finalName}" or URL. Skipping.`)
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
            if (file.size > 2 * 1024 * 1024) {
                alert('表情包太大 (限制2MB)')
                reject('Too large')
                return
            }

            const reader = new FileReader()
            reader.onload = (e) => {
                const name = file.name.split('.')[0] || `Custom_${Date.now()}`
                addSticker(e.target.result, name, scope)
                resolve(e.target.result)
            }
            reader.onerror = (e) => reject(e)
            reader.readAsDataURL(file)
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

    // Initialize
    loadStickers()

    return {
        customStickers,
        getStickers,
        addSticker,
        uploadSticker,
        deleteSticker
    }
})
