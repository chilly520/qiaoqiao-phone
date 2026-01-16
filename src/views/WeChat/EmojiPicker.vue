<template>
    <div class="emoji-picker h-[280px] bg-[#f5f5f5] border-t border-[#dcdcdc] flex flex-col animate-slide-up"
        @click.stop>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">

            <!-- Tab 1: System Emoji -->
            <div v-if="activeTab === 'emoji'" class="grid grid-cols-8 gap-2">
                <div v-for="emoji in simpleEmojiList" :key="emoji"
                    class="text-2xl cursor-pointer hover:bg-gray-200 rounded p-1 flex items-center justify-center transition-colors select-none"
                    @click="$emit('select-emoji', emoji)">
                    {{ emoji }}
                </div>
            </div>

            <!-- Tab 2: Custom Stickers -->
            <div v-else-if="activeTab === 'sticker'">
                <!-- Scope Selector -->
                <div class="flex gap-2 mb-3 bg-white p-1 rounded-lg border border-gray-200">
                    <div class="flex-1 text-center text-xs py-1.5 rounded cursor-pointer transition-colors"
                        :class="activeScope === 'global' ? 'bg-gray-100 font-bold text-black' : 'text-gray-500 hover:bg-gray-50'"
                        @click="activeScope = 'global'">全局通用</div>
                    <div class="flex-1 text-center text-xs py-1.5 rounded cursor-pointer transition-colors"
                        :class="activeScope !== 'global' ? 'bg-orange-50 font-bold text-[#ea5f39]' : 'text-gray-500 hover:bg-gray-50'"
                        @click="activeScope = chatStore.currentChatId">{{ chatStore.chats[chatStore.currentChatId]?.name
                            || '当前角色' }}专属</div>
                </div>

                <!-- Search Bar -->
                <div class="mb-3 relative">
                    <input v-model="searchQuery" type="text" placeholder="搜索表情包..."
                        class="w-full px-3 py-2 pl-9 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all">
                    <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <button v-if="searchQuery" @click="searchQuery = ''"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <!-- Category Filter -->
                <div class="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button @click="selectedCategory = null"
                        class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0"
                        :class="selectedCategory === null ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'">
                        全部
                    </button>
                    <button v-for="cat in availableCategories" :key="cat" @click="selectedCategory = cat"
                        class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0"
                        :class="selectedCategory === cat ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'">
                        {{ cat }}
                    </button>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <!-- Add Button -->
                    <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="triggerUpload">
                        <i class="fa-solid fa-plus text-gray-400 text-2xl"></i>
                        <span class="text-xs text-gray-400 mt-1">添加</span>
                    </div>

                    <!-- Batch Add Button -->
                    <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="showBatchModal = true">
                        <i class="fa-solid fa-file-import text-gray-400 text-2xl"></i>
                        <span class="text-xs text-gray-400 mt-1">批量</span>
                    </div>

                    <!-- Settings Button -->
                    <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="toggleDeleteMode">
                        <i class="fa-solid fa-gear text-gray-400 text-2xl"></i>
                        <span class="text-xs text-gray-400 mt-1">{{ isDeleteMode ? '取消' : '设置' }}</span>
                    </div>

                    <!-- Clear Category Button -->
                    <div v-if="isDeleteMode && selectedCategory" class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="clearCategory">
                        <i class="fa-solid fa-trash-can text-red-400 text-2xl"></i>
                        <span class="text-xs text-red-400 mt-1">清空分类</span>
                    </div>
                    <div v-else-if="isDeleteMode" class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="clearAllStickers">
                        <i class="fa-solid fa-trash-can text-red-400 text-2xl"></i>
                        <span class="text-xs text-red-400 mt-1">清空全部</span>
                    </div>

                    <!-- Sticker List (Filtered) -->
                    <div v-for="sticker in filteredStickers" :key="sticker.url"
                        class="relative group flex flex-col items-center gap-1">
                        <div class="aspect-square w-full bg-white rounded-lg border border-gray-200 cursor-pointer overflow-hidden p-2 relative"
                            @click="isDeleteMode ? toggleStickerSelection(sticker) : $emit('select-sticker', sticker)">
                            <img :src="sticker.url" class="w-full h-full object-contain">

                            <!-- Selection Checkbox -->
                            <div v-if="isDeleteMode" class="absolute top-1 left-1 w-5 h-5 bg-white/80 flex items-center justify-center rounded-full cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    :checked="selectedStickers.includes(sticker.url)"
                                    @change="toggleStickerSelection(sticker)"
                                    class="w-4 h-4 rounded-full appearance-none bg-white border-2 border-gray-300 checked:bg-blue-500 checked:border-blue-500 relative"
                                >
                                <div v-if="selectedStickers.includes(sticker.url)" class="absolute inset-0 flex items-center justify-center text-white text-xs">
                                    <i class="fa-solid fa-check"></i>
                                </div>
                            </div>
                        </div>
                        <!-- Sticker Name with Category Badge -->
                        <div class="w-full flex flex-col items-center gap-0.5">
                            <span class="text-[10px] text-gray-500 truncate w-full text-center">{{ getDisplayName(sticker.name) }}</span>
                            <span v-if="sticker.category"
                                class="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{{
                                    sticker.category }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toast Notification -->
            <div v-if="toastMessage"
                class="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs transition-opacity animate-fade-in z-50">
                {{ toastMessage }}
            </div>
            
            <!-- Delete Mode Actions -->
            <div v-if="isDeleteMode && selectedStickers.length > 0" class="absolute bottom-16 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 animate-fade-in">
                <button @click="deleteSelectedStickers" class="w-full bg-red-500 text-white py-2 rounded font-medium text-sm">
                    删除选中 ({{ selectedStickers.length }})
                </button>
            </div>
            
            <!-- Confirm Modal -->
            <div v-if="showConfirmModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
                <div class="bg-white w-[80%] max-w-[280px] rounded-lg shadow-xl">
                    <div class="p-4 text-center">
                        <div class="text-base text-gray-800 mb-4">{{ confirmMessage }}</div>
                        <div class="flex gap-2 justify-center">
                            <button 
                                @click="showConfirmModal = false; confirmCallback = null" 
                                class="px-4 py-2 bg-gray-100 text-gray-600 rounded font-medium text-sm"
                            >
                                取消
                            </button>
                            <button 
                                @click="handleConfirmAction" 
                                class="px-4 py-2 bg-red-500 text-white rounded font-medium text-sm"
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- Bottom Tab Bar -->
        <div class="h-[40px] border-t border-[#e5e5e5] bg-white flex items-center">
            <!-- Emoji Tab -->
            <div class="flex-1 h-full flex items-center justify-center cursor-pointer transition-colors"
                :class="activeTab === 'emoji' ? 'bg-[#f0f0f0]' : 'hover:bg-[#f9f9f9]'" @click="activeTab = 'emoji'">
                <i class="fa-regular fa-face-smile text-xl"
                    :class="activeTab === 'emoji' ? 'text-[#07c160]' : 'text-gray-500'"></i>
            </div>

            <!-- Sticker Tab -->
            <div class="flex-1 h-full flex items-center justify-center cursor-pointer transition-colors"
                :class="activeTab === 'sticker' ? 'bg-[#f0f0f0]' : 'hover:bg-[#f9f9f9]'" @click="activeTab = 'sticker'">
                <i class="fa-regular fa-heart text-xl"
                    :class="activeTab === 'sticker' ? 'text-[#ea5f39]' : 'text-gray-500'"></i>
            </div>

        </div>

        <!-- Hidden Input -->
        <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileChange">

        <!-- Batch Import Modal -->
        <div v-if="showBatchModal" class="absolute inset-0 bg-white z-50 flex flex-col p-4 animate-fade-in">
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-gray-700">批量导入表情包</span>
                <button @click="showBatchModal = false" class="text-gray-400 hover:text-gray-600"><i
                        class="fa-solid fa-xmark text-xl"></i></button>
            </div>

            <!-- Category Input -->
            <div class="mb-3">
                <label class="text-xs text-gray-600 mb-1 block">分类标签 (可选)</label>
                <div class="relative">
                    <button 
                        @click="showCategoryMenu = !showCategoryMenu"
                        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                    >
                        <span>{{ batchCategory || '选择或新建分类标签' }}</span>
                        <i class="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                    </button>
                    <div v-if="showCategoryMenu" class="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                        <div class="p-2">
                            <div class="text-xs text-gray-500 mb-1 px-2">现有标签</div>
                            <button 
                                v-for="cat in availableCategories" 
                                :key="cat"
                                @click="batchCategory = cat; showCategoryMenu = false"
                                class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded mb-1"
                            >
                                {{ cat }}
                            </button>
                            <div class="text-xs text-gray-500 mb-1 px-2 mt-2">新建标签</div>
                            <div class="flex gap-1">
                                <input 
                                    v-model="newCategoryName" 
                                    type="text" 
                                    placeholder="输入新标签名称"
                                    class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                                >
                                <button 
                                    @click="addNewCategory" 
                                    class="px-3 py-1.5 text-sm bg-orange-500 text-white rounded"
                                >
                                    <i class="fa-solid fa-plus text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="text-xs text-gray-500 mb-2">格式：名称：URL (每行一个)</div>
            <textarea v-model="batchInput"
                class="flex-1 border border-gray-200 rounded p-2 text-xs resize-none outline-none focus:border-green-500 mb-3"
                placeholder="示例：&#10;开心：https://example.com/1.png&#10;难过：https://example.com/2.png"></textarea>
            <div class="flex gap-2">
                <button @click="handleBatchImport"
                    class="flex-1 bg-[#07c160] text-white py-2 rounded font-medium active:bg-[#06ad56]">导入</button>
                <button @click="triggerTxtImport"
                    class="flex-1 bg-blue-500 text-white py-2 rounded font-medium active:bg-blue-600">导入 TXT</button>
            </div>
            <input type="file" ref="txtInput" class="hidden" accept=".txt" @change="handleTxtFileChange">
        </div>

    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStickerStore } from '../../stores/stickerStore'
import { useChatStore } from '../../stores/chatStore'

defineEmits(['select-emoji', 'select-sticker'])

const stickerStore = useStickerStore()
const chatStore = useChatStore()

const activeTab = ref('emoji')
const activeScope = ref('global') // 'global' or chatId
const searchQuery = ref('')
const selectedCategory = ref(null)

const fileInput = ref(null)
const txtInput = ref(null)
const showBatchModal = ref(false)
const batchInput = ref('')
const batchCategory = ref('')
const showCategoryMenu = ref(false)
const newCategoryName = ref('')
const isDeleteMode = ref(false)
const selectedStickers = ref([])
const showConfirmModal = ref(false)
const confirmMessage = ref('')
const confirmCallback = ref(null)

const displayedStickers = computed(() => {
    const char = chatStore.currentChat
    return stickerStore.getStickers(activeScope.value, char?.emojis || [])
})

// Available categories from current stickers
const availableCategories = computed(() => {
    const categories = new Set()
    displayedStickers.value.forEach(s => {
        if (s.category) categories.add(s.category)
    })
    return Array.from(categories).sort()
})

// Filtered stickers based on search and category
const filteredStickers = computed(() => {
    let result = displayedStickers.value

    // Filter by category
    if (selectedCategory.value) {
        result = result.filter(s => s.category === selectedCategory.value)
    }

    // Filter by search query
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(s =>
            s.name?.toLowerCase().includes(query) ||
            s.category?.toLowerCase().includes(query)
        )
    }

    return result
})

const getDisplayName = (name) => {
    if (!name) return ''
    // Strip trailing emojis for a cleaner UI look
    return name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() || name
}

// Standard Emoji List (Subset)
const simpleEmojiList = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '​​​​​​😨', '😩', '🤯', '😬', '​​​​​​😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🤠', '🤡', '🥳', '🥴', '🥺', '🤥', '🤫', '🤭', '🧐', '🤓'
];

const triggerUpload = () => {
    fileInput.value.click()
}

const deletingUrl = ref(null)
const toastMessage = ref('')
const toastTimer = ref(null)

const showToast = (msg) => {
    toastMessage.value = msg
    clearTimeout(toastTimer.value)
    toastTimer.value = setTimeout(() => {
        toastMessage.value = ''
    }, 2000)
}

const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (file) {
        try {
            await stickerStore.uploadSticker(file, activeScope.value)
            showToast('添加成功')
        } catch (e) {
            console.error(e)
            showToast('添加失败')
        }
        event.target.value = ''
    }
}

const triggerTxtImport = () => {
    txtInput.value.click()
}

// 新建分类标签
const addNewCategory = () => {
    if (newCategoryName.value.trim()) {
        batchCategory.value = newCategoryName.value.trim()
        newCategoryName.value = ''
        showCategoryMenu.value = false
    }
}

const handleTxtFileChange = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
        const content = e.target.result
        const res = stickerStore.importStickersFromText(content, activeScope.value, batchCategory.value)

        if (activeScope.value !== 'global' && res.newStickers?.length > 0) {
            const char = chatStore.currentChat
            if (char) {
                const newEmojis = [...(char.emojis || []), ...res.newStickers]
                chatStore.updateCharacter(char.id, { emojis: newEmojis })
            }
        }

        showToast(`成功:${res.success}, 重复:${res.duplicate}, 失败:${res.failed}`)
        showBatchModal.value = false
        event.target.value = ''
    }
    reader.onerror = () => showToast('读取文件失败')
    reader.readAsText(file)
}

// 切换删除模式
const toggleDeleteMode = () => {
    isDeleteMode.value = !isDeleteMode.value
    selectedStickers.value = []
}

// 切换表情包选择
const toggleStickerSelection = (sticker) => {
    const url = sticker.url
    const index = selectedStickers.value.indexOf(url)
    if (index > -1) {
        selectedStickers.value.splice(index, 1)
    } else {
        selectedStickers.value.push(url)
    }
}

// 处理确认操作
const handleConfirmAction = () => {
    if (confirmCallback.value) {
        confirmCallback.value()
        showConfirmModal.value = false
        confirmCallback.value = null
    }
}

// 清空全部
const clearAllStickers = () => {
    confirmMessage.value = '确定要清空所有表情包吗？'
    confirmCallback.value = () => {
        stickerStore.clearAllStickers(activeScope.value)
        showToast('已清空所有表情包')
        isDeleteMode.value = false
    }
    showConfirmModal.value = true
}

// 清空分类
const clearCategory = () => {
    if (!selectedCategory.value) return
    
    const categoryStickers = displayedStickers.value.filter(s => s.category === selectedCategory.value)
    confirmMessage.value = `确定要清空"${selectedCategory.value}"分类的所有表情包吗？`
    confirmCallback.value = () => {
        categoryStickers.forEach(sticker => {
            stickerStore.deleteSticker(sticker.url, activeScope.value)
        })
        
        showToast(`已清空 ${categoryStickers.length} 个表情包`)
        isDeleteMode.value = false
    }
    showConfirmModal.value = true
}

// 批量删除选中表情包
const deleteSelectedStickers = () => {
    if (selectedStickers.value.length === 0) return
    
    confirmMessage.value = `确定要删除选中的 ${selectedStickers.value.length} 个表情包吗？`
    confirmCallback.value = () => {
        selectedStickers.value.forEach(url => {
            stickerStore.deleteSticker(url, activeScope.value)
        })
        
        showToast(`已删除 ${selectedStickers.value.length} 个表情包`)
        selectedStickers.value = []
        isDeleteMode.value = false
    }
    showConfirmModal.value = true
}

const deleteSticker = (url) => {
    if (deletingUrl.value === url) {
        stickerStore.deleteSticker(url, activeScope.value)
        deletingUrl.value = null
        showToast('删除成功')
    } else {
        deletingUrl.value = url
        // Auto reset confirmation after 3s
        setTimeout(() => {
            if (deletingUrl.value === url) deletingUrl.value = null
        }, 3000)
    }
}

const handleBatchImport = () => {
    if (!batchInput.value.trim()) return
    const res = stickerStore.importStickersFromText(batchInput.value, activeScope.value, batchCategory.value)

    if (activeScope.value !== 'global' && res.newStickers?.length > 0) {
        const char = chatStore.currentChat
        if (char) {
            const newEmojis = [...(char.emojis || []), ...res.newStickers]
            chatStore.updateCharacter(char.id, { emojis: newEmojis })
        }
    }

    showToast(`导入完成: 成功${res.success}, 重复${res.duplicate}, 失败${res.failed}`)
    batchInput.value = ''
    batchCategory.value = ''
    showBatchModal.value = false
}
</script>

<style scoped>
.emoji-picker {
    user-select: none;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #d1d1d1;
    border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.animate-slide-up {
    animation: slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}
</style>
