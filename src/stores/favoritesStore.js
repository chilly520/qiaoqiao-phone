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

    function addFavorite(msg, chatName) {
        // Prevent duplicates? logic can be added.
        const item = {
            id: Date.now(),
            msgId: msg.id,
            type: msg.type,
            content: msg.content,
            msgTimestamp: msg.timestamp,
            savedAt: Date.now(),
            author: msg.role === 'ai' ? chatName : '我',
            avatar: '' // Could store avatar URL if needed
        }
        favorites.value.unshift(item)
        saveFavorites()
        return true
    }

    function removeFavorite(id) {
        favorites.value = favorites.value.filter(f => f.id !== id)
        saveFavorites()
    }

    // Init
    loadFavorites()

    return {
        favorites,
        addFavorite,
        removeFavorite
    }
})
