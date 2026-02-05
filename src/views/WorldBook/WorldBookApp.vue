<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorldBookStore } from '../../stores/worldBookStore'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'

const router = useRouter()
const store = useWorldBookStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

// State
const currentBook = ref(null)
const currentBookData = ref({ name: '', description: '' })
const currentEntry = ref({ name: '', keys: '', content: '' })
const isEditing = ref(false)
const showBookModal = ref(false)
const showEditModal = ref(false)
const importInput = ref(null)

const goBack = () => {
    if (currentBook.value) {
        currentBook.value = null
        currentBookData.value = { name: '', description: '' }
    } else {
        router.back()
    }
}

const enterBook = (book) => {
    currentBook.value = book
    currentBookData.value = { ...book }
}

const openBookModal = (book = null) => {
    if (book) {
        isEditing.value = true
        currentBookData.value = { ...book }
    } else {
        isEditing.value = false
        currentBookData.value = { name: '', description: '' }
    }
    showBookModal.value = true
}

const saveBook = () => {
    if (!currentBookData.value.name) {
        chatStore.triggerToast('世界书名称不能为空', 'error')
        return
    }

    if (isEditing.value) {
        store.updateBook(currentBookData.value)
    } else {
        store.addBook(currentBookData.value)
    }
    showBookModal.value = false
    currentBookData.value = { name: '', description: '' }
    isEditing.value = false
}

const confirmDeleteBook = (id) => {
    chatStore.triggerConfirm('删除确认', '确定要删除此世界书及其所有条目吗?', () => {
        store.deleteBook(id)
        if (currentBook.value?.id === id) {
            currentBook.value = null
            currentBookData.value = { name: '', description: '' }
        }
    })
}

const openEntryModal = (entry = null) => {
    if (entry) {
        isEditing.value = true
        currentEntry.value = { ...entry }
    } else {
        isEditing.value = false
        currentEntry.value = { name: '', keys: '', content: '' }
    }
    showEditModal.value = true
}

const saveEntry = () => {
    if (!currentEntry.value.name) {
        chatStore.triggerToast('条目名称不能为空', 'error')
        return
    }

    if (isEditing.value) {
        store.updateEntry(currentBook.value.id, currentEntry.value)
    } else {
        store.addEntry(currentBook.value.id, currentEntry.value)
    }
    showEditModal.value = false
    currentEntry.value = { name: '', keys: '', content: '' }
    isEditing.value = false
    
    // Refresh current book to show new entry
    const updatedBook = store.books.find(b => b.id === currentBook.value.id)
    if (updatedBook) currentBook.value = updatedBook
}

const confirmDeleteEntry = (id) => {
    chatStore.triggerConfirm('删除确认', '确定要删除此条目吗?', () => {
        store.deleteEntry(currentBook.value.id, id)
        // Refresh current book
        const updatedBook = store.books.find(b => b.id === currentBook.value.id)
        if (updatedBook) currentBook.value = updatedBook
    })
}

const triggerImport = () => {
    importInput.value.click()
}

const handleImportFile = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result)
            await store.importBook(importedData)
            chatStore.triggerToast('世界书导入成功', 'success')
        } catch (error) {
            console.error('Error importing world book:', error)
            chatStore.triggerToast('导入失败，请检查文件格式', 'error')
        }
    }
    reader.readAsText(file)
    event.target.value = '' // Reset input
}

const exportCurrentBook = () => {
    if (!currentBook.value) return
    const book = store.books.find(b => b.id === currentBook.value.id)
    if (!book) return

    const exportData = {
        ...book,
        entries: book.entries || []
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.name}_worldbook.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="w-full h-full flex flex-col transition-colors duration-300"
    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#f2f2f7]'">
    <!-- Header -->
    <div class="h-[44px] flex items-center justify-between px-3 border-b shrink-0 sticky top-0 z-10 transition-colors"
        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-[#ededed] border-[#dcdcdc]'">
        <div class="flex items-center gap-1 cursor-pointer" @click="goBack">
            <i class="fa-solid fa-chevron-left text-lg" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-black'"></i>
        </div>
        <div class="font-medium text-base truncate max-w-[150px]"
            :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-black'">
            {{ currentBook ? currentBook.name : '世界书库' }}
        </div>
        <div class="flex justify-end items-center gap-3 w-20" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-black'">
            <!-- Import Button (Only on Book List view) -->
            <i v-if="!currentBook" class="fa-solid fa-file-import text-lg cursor-pointer hover:opacity-70 transition-opacity" @click="triggerImport" title="导入世界书"></i>
            <!-- Export Button (Only on Entry List view) -->
            <i v-if="currentBook" class="fa-solid fa-file-export text-lg cursor-pointer hover:opacity-70 transition-opacity" @click="exportCurrentBook" title="导出世界书"></i>
            <!-- Add Button -->
            <i class="fa-solid fa-plus text-lg cursor-pointer hover:opacity-70 transition-opacity" @click="currentBook ? openEntryModal() : openBookModal()"></i>
        </div>
    </div>
    
    <!-- Hidden Import Input -->
    <input type="file" ref="importInput" class="hidden" accept=".json" @change="handleImportFile">

    <!-- VIEW 1: Book List -->
    <div v-if="!currentBook" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="store.books.length === 0" class="text-center mt-20 text-sm flex flex-col items-center"
            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">
            <i class="fa-solid fa-book text-4xl mb-3 opacity-50"></i>
            <span>暂无世界书，点击右上角创建</span>
        </div>

        <div v-for="book in store.books" :key="book.id" 
             class="rounded-lg p-4 shadow-sm transition-all cursor-pointer relative group flex justify-between items-center border"
             :class="settingsStore.personalization.theme === 'dark' 
                ? 'bg-[#1e293b] border-white/5 active:bg-[#334155]' 
                : 'bg-white border-transparent active:bg-gray-50'"
             @click="enterBook(book)">
            
            <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded flex items-center justify-center"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-500'">
                    <i class="fa-solid fa-book"></i>
                 </div>
                 <div>
                     <div class="font-bold text-base"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">{{ book.name }}</div>
                     <div class="text-xs" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">{{ book.entries?.length || 0 }} 个条目</div>
                 </div>
            </div>

            <div class="flex items-center gap-3">
                <button class="w-8 h-8 flex items-center justify-center transition-colors" 
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500 hover:text-blue-400' : 'text-gray-400 hover:text-blue-500'"
                    @click.stop="openBookModal(book)">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="w-8 h-8 flex items-center justify-center transition-colors"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'"
                    @click.stop="confirmDeleteBook(book.id)">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- VIEW 2: Entry List -->
    <div v-else class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="!currentBook.entries || currentBook.entries.length === 0" class="text-center mt-20 text-sm"
            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">
            本页暂无条目，点击右上角添加
        </div>

        <div v-for="entry in currentBook.entries" :key="entry.id" 
             class="rounded-lg p-4 shadow-sm transition-all cursor-pointer relative group border"
             :class="settingsStore.personalization.theme === 'dark' 
                ? 'bg-[#1e293b] border-white/5 active:bg-[#334155]' 
                : 'bg-white border-transparent active:bg-gray-50'"
             @click="openEntryModal(entry)">
            
            <div class="flex justify-between items-start mb-2">
                <div class="font-bold text-base"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">{{ entry.name }}</div>
                <div class="text-xs px-2 py-1 rounded" 
                    v-if="entry.keys && entry.keys.length"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-blue-400 bg-blue-500/10' : 'text-blue-500 bg-blue-50'">
                    {{ Array.isArray(entry.keys) ? entry.keys.length : entry.keys.split(' ').filter(k=>k).length }} 关键词
                </div>
                <div class="text-xs px-2 py-1 rounded" v-else
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-orange-400 bg-orange-500/10' : 'text-orange-500 bg-orange-50'">
                    常驻生效
                </div>
            </div>

            <div class="text-xs mb-2 truncate"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-500'">
                关键词: {{ entry.keys && (Array.isArray(entry.keys) ? entry.keys.length : entry.keys.length > 0) ? (Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.keys) : '无 (默认生效)' }}
            </div>

            <div class="text-sm line-clamp-2 p-2 rounded border font-mono transition-colors"
                :class="settingsStore.personalization.theme === 'dark' 
                    ? 'bg-black/20 border-white/5 text-gray-300' 
                    : 'bg-gray-50 border-gray-100 text-gray-700'">
                {{ entry.content || '(无内容)' }}
            </div>

            <button class="absolute top-4 right-2 w-8 h-8 flex items-center justify-center transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500'"
                @click.stop="confirmDeleteEntry(entry.id)">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        </div>
    </div>

    <!-- MODAL 1: Create/Edit Book -->
    <div v-if="showBookModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" @click.self="showBookModal=false">
        <div class="rounded-xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-scale-up"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b]' : 'bg-white'">
            <div class="px-4 py-3 border-b flex justify-between items-center transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#334155] border-white/10' : 'bg-gray-50 border-gray-100'">
                <span class="font-medium" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">{{ isEditing ? '编辑世界书' : '新建世界书' }}</span>
                <button @click="showBookModal=false" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            <div class="p-4 space-y-4">
                <div>
                    <label class="block text-xs font-medium mb-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">书名</label>
                    <input v-model="currentBookData.name" type="text" 
                        class="w-full border rounded p-2 text-sm focus:outline-none focus:border-blue-500 transition-all" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'"
                        placeholder="例如: 赛博朋克设定集">
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">简介 (可选)</label>
                    <textarea v-model="currentBookData.description" rows="3" 
                        class="w-full border rounded p-2 text-sm focus:outline-none focus:border-blue-500 resize-none transition-all" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'"></textarea>
                </div>
            </div>
             <div class="p-4 pt-0">
                <button @click="saveBook" class="w-full py-2.5 rounded-lg bg-[#07c160] text-white text-sm font-medium hover:bg-[#06ad56] transition-all shadow-lg active:scale-95">保存</button>
            </div>
        </div>
    </div>

    <!-- MODAL 2: Create/Edit Entry -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" @click.self="showEditModal=false">
        <div class="rounded-xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-scale-up"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b]' : 'bg-white'">
            <div class="px-4 py-3 border-b flex justify-between items-center transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#334155] border-white/10' : 'bg-gray-50 border-gray-100'">
                <span class="font-medium" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">{{ isEditing ? '编辑条目' : '新建条目' }}</span>
                <button @click="showEditModal=false" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            
            <div class="p-4 space-y-4">
                <div>
                    <label class="block text-xs font-medium mb-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">名称</label>
                    <input v-model="currentEntry.name" type="text" 
                        class="w-full border rounded p-2 text-sm focus:outline-none focus:border-blue-500 transition-all" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'"
                        placeholder="例如: 魔法系统">
                </div>

                <div>
                    <label class="block text-xs font-medium mb-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">触发关键词 (空格分隔)</label>
                    <input v-model="currentEntry.keys" type="text" 
                        class="w-full border rounded p-2 text-sm focus:outline-none focus:border-blue-500 transition-all" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'"
                        placeholder="留空则设为常驻生效">
                </div>

                <div>
                    <label class="block text-xs font-medium mb-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">设定内容</label>
                    <textarea v-model="currentEntry.content" rows="6" 
                        class="w-full border rounded p-2 text-sm focus:outline-none focus:border-blue-500 resize-none transition-all" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'"
                        placeholder="输入具体的设定描述..."></textarea>
                </div>
            </div>

            <div class="p-4 pt-0 flex gap-3">
                <button v-if="isEditing" @click="confirmDeleteEntry(currentEntry.id)" 
                    class="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                    :class="settingsStore.personalization.theme === 'dark' ? 'border-red-900/50 text-red-400 hover:bg-red-900/20' : 'border-red-200 text-red-500 hover:bg-red-50'">删除</button>
                <button @click="saveEntry" class="flex-[2] py-2.5 rounded-lg bg-[#07c160] text-white text-sm font-medium hover:bg-[#06ad56] transition-all shadow-lg active:scale-95">保存</button>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes scaleUp {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
</style>
