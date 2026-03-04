import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useBackpackStore = defineStore('backpack', () => {
    const items = ref([]) // { id, title, description, image, category, quantity, type, source }
    const categories = ref([
        { id: 'all', name: '全部', icon: '🎒' },
        { id: 'food', name: '美食', icon: '🍔' },
        { id: 'daily', name: '日常', icon: '🏠' },
        { id: 'toy', name: '好玩', icon: '🎮' },
        { id: 'gift', name: '礼物', icon: '🎁' },
        { id: 'other', name: '其他', icon: '✨' }
    ])

    const initStore = () => {
        const saved = localStorage.getItem('qiaoqiao_backpack')
        if (saved) {
            try {
                items.value = JSON.parse(saved)
            } catch (e) {
                console.error('Failed to load backpack', e)
            }
        } else {
            // Pre-seed some items for initial curiosity
            items.value = [
                { id: 'item_initial_1', title: '心动小花', description: '一朵蕴含着真挚情感的小红花，非常适合作为赠礼。', image: 'https://cdn-icons-png.flaticon.com/128/2926/2926715.png', category: 'gift', quantity: 3, source: '系统赠送' },
                { id: 'item_initial_2', title: '夏日冰饮', description: '一口下去就能驱散冬日的寒意或夏日的炎暑！', image: 'https://cdn-icons-png.flaticon.com/128/3121/3121784.png', category: 'food', quantity: 2, source: '新手礼包' },
                { id: 'item_initial_3', title: '神奇魔方', description: '一个充满未知的魔方，也许转动它能带来好运。', image: 'https://cdn-icons-png.flaticon.com/128/3719/3719630.png', category: 'toy', quantity: 1, source: '游戏奖励' }
            ]
            saveStore()
        }
    }

    const saveStore = () => {
        localStorage.setItem('qiaoqiao_backpack', JSON.stringify(items.value))
    }

    const addItem = (item) => {
        const existing = items.value.find(i =>
            i.title === item.title &&
            i.category === item.category &&
            i.image === item.image
        )
        if (existing) {
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1)
        } else {
            items.value.push({
                id: item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                title: item.title,
                description: item.description || '',
                image: item.image,
                category: item.category || 'other',
                quantity: item.quantity || 1,
                type: item.type || 'normal',
                source: item.source || 'unknown'
            })
        }
        saveStore()
    }

    const removeItem = (itemId, quantity = 1) => {
        const index = items.value.findIndex(i => i.id === itemId)
        if (index !== -1) {
            if (items.value[index].quantity > quantity) {
                items.value[index].quantity -= quantity
            } else {
                items.value.splice(index, 1)
            }
            saveStore()
            return true
        }
        return false
    }

    const getItemsByCategory = (categoryId) => {
        if (categoryId === 'all') return items.value
        return items.value.filter(i => i.category === categoryId)
    }

    return {
        items,
        categories,
        initStore,
        saveStore,
        addItem,
        removeItem,
        getItemsByCategory
    }
})
