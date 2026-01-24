import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFavoritesStore = defineStore('favorites', () => {
    const favorites = ref([])

    function loadFavorites() {
        const saved = localStorage.getItem('wechat_favorites')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                favorites.value = Array.isArray(parsed) ? parsed : []
            } catch (e) {
                console.error(e)
                favorites.value = []
            }
        }
    }

    function saveFavorites() {
        localStorage.setItem('wechat_favorites', JSON.stringify(favorites.value))
    }

    function addFavorite(msg, chatName, avatarUrl) {
        const item = {
            id: Date.now(),
            type: 'single',
            source: chatName,
            savedAt: Date.now(),
            // Data
            msgId: msg.id,
            msgType: msg.type || 'text',
            content: msg.content,
            image: msg.image || null,
            sticker: msg.sticker || null,
            html: msg.html || null,
            forceCard: msg.forceCard || false,
            author: msg.role === 'ai' ? chatName : '我',
            avatar: avatarUrl || ''
        }
        favorites.value.unshift(item)
        saveFavorites()
        return true
    }

    function addBatchFavorite(msgs, chatName, avatarUrl) {
        if (!msgs || msgs.length === 0) return false

        const item = {
            id: Date.now(),
            type: 'chat_record',
            source: chatName,
            savedAt: Date.now(),
            avatar: avatarUrl || '',
            author: chatName || '聊天记录', // Ensure author exists for list view
            messages: msgs.map(m => ({
                id: m.id,
                role: m.role,
                type: m.type || 'text',
                content: m.content,
                image: m.image || null,
                sticker: m.sticker || null,
                html: m.html || null,
                forceCard: m.forceCard || false,
                timestamp: m.timestamp,
                author: m.role === 'ai' ? chatName : '我'
            }))
        }

        favorites.value.unshift(item)
        saveFavorites()
        return true
    }

    function removeFavorite(id) {
        const idx = favorites.value.findIndex(f => f.id == id)
        if (idx !== -1) {
            favorites.value.splice(idx, 1)
            saveFavorites()
            return true
        }
        return false
    }

    // Init
    loadFavorites()

    return {
        favorites,
        addFavorite,
        addBatchFavorite,
        removeFavorite
    }
})
