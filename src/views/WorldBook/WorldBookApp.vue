<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorldBookStore } from '../../stores/worldBookStore'

const router = useRouter()
const store = useWorldBookStore()

// State
const currentBook = ref(null) // If null, show Book List. If set, show Entries.
const showEditModal = ref(false)
const showBookModal = ref(false) // New modal for creating/editing books
const isEditing = ref(false)
const importInput = ref(null)

// Data Models
const currentEntry = ref({ name: '', keys: '', content: '' })
const currentBookData = ref({ name: '', description: '' })

onMounted(() => {
    store.loadEntries()
})

const goBack = () => {
    if (currentBook.value) {
        currentBook.value = null // Go back to Book List
    } else {
        router.back() // Go back to previous app or desktop
    }
}

// --- Book Management ---
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
    if (!currentBookData.value.name) return alert('请输入书名')
    
    if (isEditing.value && currentBookData.value.id) {
        store.updateBook(currentBookData.value.id, currentBookData.value)
    } else {
        store.createBook(currentBookData.value.name, currentBookData.value.description)
    }
    showBookModal.value = false
}

const enterBook = (book) => {
    currentBook.value = book
}

const confirmDeleteBook = (id) => {
    if (confirm('确定要删除整本设定书吗？里面的所有条目都会丢失。')) {
        store.deleteBook(id)
    }
}

// --- Entry Management ---
const openEntryModal = (entry = null) => {
    if (entry) {
        isEditing.value = true
        // Copy data, join keys as string for input
        currentEntry.value = { 
            ...entry, 
            keys: entry.keys ? entry.keys.join(' ') : '' 
        }
    } else {
        isEditing.value = false
        currentEntry.value = { name: '', keys: '', content: '' }
    }
    showEditModal.value = true
}

const saveEntry = () => {
    if (!currentEntry.value.name) return alert('请输入名称')
    
    // Process keys: split by space/comma
    const keysArray = currentEntry.value.keys
        .split(/[\s,，]+/)
        .filter(k => k.trim())

    const payload = {
        name: currentEntry.value.name,
        content: currentEntry.value.content,
        keys: keysArray
    }

    if (isEditing.value) {
        store.updateEntry(currentBook.value.id, currentEntry.value.id, payload)
    } else {
        store.addEntry(currentBook.value.id, payload)
    }

    showEditModal.value = false
}

const confirmDeleteEntry = (entryId) => {
    if (confirm('确定要删除这条设定吗？')) {
        store.deleteEntry(currentBook.value.id, entryId)
    }
}

// --- Import Logic ---
const triggerImport = () => importInput.value.click()

const handleImportFile = (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    // Use filename as Book Name (remove extension)
    const bookName = file.name.replace(/\.[^/.]+$/, "")
    
    const reader = new FileReader()
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result)
            
            // Create Book first
            const newBook = store.createBook(bookName, 'Imported from ' + file.name)
            
            // Parse Entries
            // Format: { entries: { "0": {...}, "1": {...} } } or Array?
            // The user provided file has "entries" object with keys "0", "1"...
            
            let entriesData = []
            if (json.entries && !Array.isArray(json.entries)) {
                entriesData = Object.values(json.entries)
            } else if (Array.isArray(json)) {
                entriesData = json
            } else if (json.entries && Array.isArray(json.entries)) {
                entriesData = json.entries
            }
            
            let count = 0
            entriesData.forEach(item => {
                // Map fields
                // item.comment -> name
                // item.content -> content
                // item.key -> keys (array)
                
                const name = item.comment || item.name || ('Entry ' + count)
                const content = item.content || ''
                const keys = item.key || item.keys || []
                
                if (content) { // Only add if content exists
                     store.addEntry(newBook.id, {
                        name,
                        content,
                        keys: Array.isArray(keys) ? keys : [keys]
                     })
                     count++
                }
            })
            
            alert(`成功导入书籍《${bookName}》，共包含 ${count} 个条目！`)
            event.target.value = '' // Reset input
            
        } catch (err) {
            console.error(err)
            alert('导入失败: 格式错误')
        }
    }
    reader.readAsText(file)
}

// --- Export Logic ---
const exportCurrentBook = () => {
    if (!currentBook.value) return
    
    // Construct Standard JSON format (SillyTavern style)
    const exportData = {
        entries: {}
    }
    
    // Map entries
    if (currentBook.value.entries) {
        currentBook.value.entries.forEach((entry, index) => {
            exportData.entries[index] = {
                uid: index,
                key: entry.keys || [],
                comment: entry.name,
                content: entry.content,
                constant: (!entry.keys || entry.keys.length === 0),
                disable: false
            }
        })
    }
    
    // Create Blob and Download
    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentBook.value.name}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="w-full h-full bg-[#f2f2f7] flex flex-col">
    <!-- Header -->
    <div class="h-[44px] bg-[#ededed] flex items-center justify-between px-3 border-b border-[#dcdcdc] shrink-0 sticky top-0 z-10">
        <div class="flex items-center gap-1 cursor-pointer" @click="goBack">
            <i class="fa-solid fa-chevron-left text-black text-lg"></i>
        </div>
        <div class="font-medium text-base text-black truncate max-w-[150px]">
            {{ currentBook ? currentBook.name : '世界书库' }}
        </div>
        <div class="flex justify-end items-center gap-3 w-20">
            <!-- Import Button (Only on Book List view) -->
            <i v-if="!currentBook" class="fa-solid fa-file-import text-black text-lg cursor-pointer" @click="triggerImport" title="导入世界书"></i>
            <!-- Export Button (Only on Entry List view) -->
            <i v-if="currentBook" class="fa-solid fa-file-export text-black text-lg cursor-pointer" @click="exportCurrentBook" title="导出世界书"></i>
            <!-- Add Button -->
            <i class="fa-solid fa-plus text-black text-lg cursor-pointer" @click="currentBook ? openEntryModal() : openBookModal()"></i>
        </div>
    </div>
    
    <!-- Hidden Import Input -->
    <input type="file" ref="importInput" class="hidden" accept=".json" @change="handleImportFile">

    <!-- VIEW 1: Book List -->
    <div v-if="!currentBook" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="store.books.length === 0" class="text-center text-gray-400 mt-20 text-sm flex flex-col items-center">
            <i class="fa-solid fa-book text-4xl mb-3 opacity-50"></i>
            <span>暂无世界书，点击右上角创建</span>
        </div>

        <div v-for="book in store.books" :key="book.id" 
             class="bg-white rounded-lg p-4 shadow-sm active:bg-gray-50 transition-colors cursor-pointer relative group flex justify-between items-center"
             @click="enterBook(book)">
            
            <div class="flex items-center gap-3">
                 <div class="w-10 h-10 bg-blue-100 rounded flex items-center justify-center text-blue-500">
                    <i class="fa-solid fa-book"></i>
                 </div>
                 <div>
                     <div class="font-bold text-gray-900 text-base">{{ book.name }}</div>
                     <div class="text-xs text-gray-500">{{ book.entries?.length || 0 }} 个条目</div>
                 </div>
            </div>

            <div class="flex items-center gap-3">
                <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-500" @click.stop="openBookModal(book)">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500" @click.stop="confirmDeleteBook(book.id)">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- VIEW 2: Entry List (Existing UI) -->
    <div v-else class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="!currentBook.entries || currentBook.entries.length === 0" class="text-center text-gray-400 mt-20 text-sm">
            本页暂无条目，点击右上角添加
        </div>

        <div v-for="entry in currentBook.entries" :key="entry.id" 
             class="bg-white rounded-lg p-4 shadow-sm active:bg-gray-50 transition-colors cursor-pointer relative group"
             @click="openEntryModal(entry)">
            
            <div class="flex justify-between items-start mb-2">
                <div class="font-bold text-gray-900 text-base">{{ entry.name }}</div>
                <div class="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded" v-if="entry.keys && entry.keys.length">
                    {{ entry.keys.length }} 关键词
                </div>
                <div class="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded" v-else>
                    常驻生效
                </div>
            </div>

            <div class="text-gray-500 text-xs mb-2 truncate">
                关键词: {{ entry.keys && entry.keys.length ? entry.keys.join(', ') : '无 (默认生效)' }}
            </div>

            <div class="text-gray-700 text-sm line-clamp-2 bg-gray-50 p-2 rounded border border-gray-100 font-mono">
                {{ entry.content || '(无内容)' }}
            </div>

            <button class="absolute top-4 right-2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500" @click.stop="confirmDeleteEntry(entry.id)">
                <i class="fa-regular fa-trash-can"></i>
            </button>
        </div>
    </div>

    <!-- MODAL 1: Create/Edit Book -->
    <div v-if="showBookModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showBookModal=false">
        <div class="bg-white rounded-xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-scale-in">
            <div class="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <span class="font-medium text-gray-900">{{ isEditing ? '编辑世界书' : '新建世界书' }}</span>
                <button @click="showBookModal=false" class="text-gray-400 hover:text-gray-600">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            <div class="p-4 space-y-4">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">书名</label>
                    <input v-model="currentBookData.name" type="text" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-blue-500" placeholder="例如: 赛博朋克设定集">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">简介 (可选)</label>
                    <textarea v-model="currentBookData.description" rows="3" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-blue-500 resize-none"></textarea>
                </div>
            </div>
             <div class="p-4 pt-0">
                <button @click="saveBook" class="w-full py-2.5 rounded-lg bg-[#07c160] text-white text-sm font-medium hover:bg-[#06ad56] transition-colors shadow-sm">保存</button>
            </div>
        </div>
    </div>

    <!-- MODAL 2: Create/Edit Entry -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showEditModal=false">
        <div class="bg-white rounded-xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-scale-in">
            <div class="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <span class="font-medium text-gray-900">{{ isEditing ? '编辑条目' : '新建条目' }}</span>
                <button @click="showEditModal=false" class="text-gray-400 hover:text-gray-600">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            
            <div class="p-4 space-y-4">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">名称</label>
                    <input v-model="currentEntry.name" type="text" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" placeholder="例如: 魔法系统">
                </div>

                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">触发关键词 (空格分隔)</label>
                    <input v-model="currentEntry.keys" type="text" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-blue-500 transition-colors" placeholder="留空则设为常驻生效">
                </div>

                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">设定内容</label>
                    <textarea v-model="currentEntry.content" rows="6" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none" placeholder="输入具体的设定描述..."></textarea>
                </div>
            </div>

            <div class="p-4 pt-0 flex gap-3">
                <button v-if="isEditing" @click="confirmDeleteEntry(currentEntry.id)" class="flex-1 py-2.5 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors">删除</button>
                <button @click="saveEntry" class="flex-[2] py-2.5 rounded-lg bg-[#07c160] text-white text-sm font-medium hover:bg-[#06ad56] transition-colors shadow-sm">保存</button>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.animate-scale-in {
    animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>
