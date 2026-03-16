<template>
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex flex-col animate-fade-in pointer-events-auto">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>

        <!-- Modal Content -->
        <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] h-[75vh] bg-[#f7f7f7] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <i class="fa-solid fa-box-archive text-orange-500 text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-black text-gray-800 leading-tight">我的背包</h3>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Backpack Inventory</p>
                    </div>
                </div>
                <button @click="close"
                    class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                    <i class="fa-solid fa-times text-lg"></i>
                </button>
            </div>

            <!-- Categories Tabs -->
            <div
                class="bg-white px-4 py-3 flex gap-2 overflow-x-auto border-b border-gray-100 shrink-0 custom-scrollbar-h">
                <button v-for="cat in store.categories" :key="cat.id" @click="activeCategory = cat.id"
                    class="flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap transition-all duration-300 border"
                    :class="activeCategory === cat.id ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'">
                    <span class="text-xs">{{ cat.icon }}</span>
                    <span class="text-xs font-bold">{{ cat.name }}</span>
                </button>
            </div>

            <!-- Items Grid -->
            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div v-if="filteredItems.length === 0"
                    class="flex flex-col items-center justify-center h-full py-20 opacity-30">
                    <div class="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                        <i class="fa-solid fa-box-open text-4xl text-gray-400"></i>
                    </div>
                    <p class="text-base font-black text-gray-400 uppercase tracking-widest">背包空空如也</p>
                    <p class="text-xs text-gray-400 mt-1">去商城扫货或者等 AI 送礼吧</p>
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div v-for="item in filteredItems" :key="item.id" @click="selectItem(item)"
                        class="group relative bg-white rounded-2xl p-3 border border-gray-100 flex flex-col items-center justify-between transition-all duration-300 hover:shadow-lg active:scale-95 cursor-pointer overflow-hidden">
                        <!-- Badge: Quantity -->
                        <div
                            class="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-800 text-white text-[9px] font-black rounded-md z-10 shadow-sm">
                            x{{ item.quantity }}
                        </div>

                        <!-- Image -->
                        <div
                            class="w-16 h-16 mb-2 flex items-center justify-center p-1 bg-gray-50 rounded-xl group-hover:scale-110 transition-transform">
                            <img :src="item.image" class="max-w-full max-h-full object-contain filter drop-shadow-md">
                        </div>

                        <!-- Info -->
                        <div class="text-center w-full">
                            <h4 class="text-[11px] font-black text-gray-800 line-clamp-1 mb-0.5">{{ item.title }}</h4>
                            <p class="text-[9px] text-gray-400 truncate">{{ item.source }}</p>
                        </div>

                        <!-- Hover Backdrop decoration -->
                        <div
                            class="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Item Detail (Bottom Sheet Overlay) -->
            <div v-if="selectedItem" class="absolute inset-0 z-[100] animate-fade-in flex flex-col pointer-events-none">
                <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
                    @click="selectedItem = null"></div>
                <div
                    class="mt-auto bg-white rounded-t-[32px] p-6 shadow-[0_-12px_40px_rgba(0,0,0,0.15)] border-t border-gray-100 animate-slide-up-fast relative z-10 pointer-events-auto">
                    <div class="flex gap-4 mb-6">
                        <div class="w-24 h-24 bg-gray-50 rounded-2xl flex items-center justify-center p-3 shadow-inner">
                            <img :src="selectedItem.image" class="max-w-full max-h-full object-contain drop-shadow-lg">
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span
                                    class="px-2 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-black rounded uppercase tracking-tighter">
                                    {{store.categories.find(c => c.id === selectedItem.category)?.name || '物品'}}
                                </span>
                                <span class="text-[10px] text-gray-300 font-bold font-mono">ID: {{
                                    selectedItem.id.slice(-6) }}</span>
                            </div>
                            <h3 class="text-lg font-black text-gray-800 mb-1">{{ selectedItem.title }}</h3>
                            <p class="text-xs text-gray-500 leading-relaxed">{{ selectedItem.description ||
                                '一件珍贵的物品，可以用来使用或赠送给他人。' }}</p>
                            <div class="mt-2 text-[10px] text-gray-400">来源: {{ selectedItem.source }} | 存量: {{
                                selectedItem.quantity }}</div>
                        </div>
                    </div>

                    <div class="mb-6">
                        <label
                            class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block ml-1">留言内容</label>
                        <div class="relative group">
                            <input v-model="giftNote" type="text" placeholder="对方收到礼物后会看到这段话..."
                                class="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-orange-400 focus:bg-white transition-all group-hover:border-orange-100">
                            <div
                                class="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity">
                                <i class="fa-solid fa-pen-nib text-xs text-orange-500"></i>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <button @click="handleUse"
                            class="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-white border-2 border-orange-500 text-orange-500 rounded-2xl font-black text-sm active:scale-95 transition-all hover:bg-orange-50">
                            <i class="fa-solid fa-bolt-lightning text-lg"></i>
                            <span>立即使用</span>
                        </button>
                        <button @click="handleGift"
                            class="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-orange-500 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg shadow-orange-500/30 hover:bg-orange-600">
                            <i class="fa-solid fa-gift text-lg"></i>
                            <span>赠送给 TA</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useBackpackStore } from '../../../stores/backpackStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const store = useBackpackStore()
const settingsStore = useSettingsStore()

const isOpen = ref(false)
const activeCategory = ref('all')
const selectedItem = ref(null)
const giftNote = ref('这是送给你的礼物，希望你会喜欢。')

const emit = defineEmits(['close', 'send-card'])

const filteredItems = computed(() => store.getItemsByCategory(activeCategory.value))

const open = () => {
    store.initStore()
    isOpen.value = true
    selectedItem.value = null
}

onMounted(() => {
    open()
})

const close = () => {
    isOpen.value = false
    selectedItem.value = null
    emit('close')
}

const selectItem = (item) => {
    selectedItem.value = item
}

const handleUse = () => {
    if (!selectedItem.value) return
    const item = selectedItem.value
    const userName = settingsStore.personalization.userProfile.name || '我'

    const cardHtml = `[CARD]
<div class="p-4 bg-white rounded-2xl shadow-sm border border-orange-100/50">
    <div class="flex items-center gap-3 mb-3">
        <div class="w-12 h-12 rounded-xl bg-orange-50 p-2 overflow-hidden shadow-inner">
            <img src="${item.image}" class="w-full h-full object-contain">
        </div>
        <div class="flex-1">
            <div class="text-[10px] text-orange-400 font-bold uppercase tracking-widest">使用物品</div>
            <div class="text-sm font-black text-gray-800">${item.title}</div>
        </div>
    </div>
    <div class="text-xs text-gray-500 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100">
        <span class="font-bold text-orange-500">${userName}</span> 使用了 <span class="font-bold text-gray-700">${item.title}</span>。${item.description || '触发了神秘的效果...'}
    </div>
</div>`

    emit('send-card', {
        content: cardHtml,
        itemId: item.id
    })

    // Backpak removal logic handled by parent to ensure message is sent first
    close()
}

const handleGift = () => {
    if (!selectedItem.value) return
    const item = selectedItem.value
    const giftId = 'GIFT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)

    emit('send-card', {
        type: 'gift',
        giftId: giftId,
        itemId: item.id,
        giftName: item.title,
        giftDescription: item.description || '一件珍贵的礼物',
        giftImage: item.image,
        giftNote: giftNote.value,
        giftQuantity: 1,
        status: 'pending'
    })

    close()
}

defineExpose({ open, close })
</script>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleUp {
    from {
        transform: translate(-50%, -50%) scale(0.9);
        opacity: 0;
    }

    to {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
    }
}

.animate-slide-up-fast {
    animation: slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
}

.custom-scrollbar-h::-webkit-scrollbar {
    height: 3px;
}

.custom-scrollbar-h::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar-h::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
}
</style>
