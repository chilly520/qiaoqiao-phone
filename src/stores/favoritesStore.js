import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFavoritesStore = defineStore('favorites', () => {
    const favorites = ref([])

    function loadFavorites() {
        const saved = localStorage.getItem('wechat_favorites')
        if (saved) {
            try {
                favorites.value = JSON.parse(saved)
            } catch (e) {
                console.error(e)
            }
        }
    }

    function saveFavorites() {
        localStorage.setItem('wechat_favorites', JSON.stringify(favorites.value))
    }

    function addFavorite(msg, chatName, avatarUrl) {
        // Prevent duplicates? logic can be added.
        const item = {
            id: Date.now(),
            msgId: msg.id,
            type: msg.type,
            content: msg.content,
            msgTimestamp: msg.timestamp,
            savedAt: Date.now(),
            author: msg.role === 'ai' ? chatName : '我',
            avatar: avatarUrl || '' 
        }
        favorites.value.unshift(item)
        saveFavorites()
        return true
    }

    function removeFavorite(id) {
        // Use splice for absolute certainty
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
        removeFavorite
    }
})
