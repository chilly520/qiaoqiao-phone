<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'

const router = useRouter()
const store = useSettingsStore()

const goBack = () => {
    router.back()
}

// --- Modals State ---
const showExportModal = ref(false)
const showResetAppModal = ref(false)
const showResetGlobalModal = ref(false)

// --- Export Logic ---
const exportSelection = ref({
    settings: true,
    wechat: true,
    selectedChats: [], // IDs of selected chats
    wallet: true,
    moments: true,
    npcs: true,
    profile: true
})

const chatList = ref([])

const openExportModal = () => {
    // Load chats for selection
    const chats = store.getChatListForExport ? store.getChatListForExport() : []
    chatList.value = chats
    // Default select all chats
    exportSelection.value.selectedChats = chats.map(c => c.id)
    showExportModal.value = true
}

const toggleAllChats = (e) => {
    if (e.target.checked) {
        exportSelection.value.selectedChats = chatList.value.map(c => c.id)
    } else {
        exportSelection.value.selectedChats = []
    }
}

const handleExport = () => {
    // Close modal
    showExportModal.value = false
    
    // Call store export with options
    const jsonStr = store.exportData({
        settings: exportSelection.value.settings,
        wechat: exportSelection.value.wechat,
        selectedChats: exportSelection.value.wechat ? exportSelection.value.selectedChats : [],
        wallet: exportSelection.value.wallet
        // Add others as implemented
    })
    
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qiaoqiao_backup_${new Date().toISOString().slice(0,19).replace(/T|:/g,'-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    triggerToast('数据已导出')
}

// --- Import ---
const triggerFileInput = () => {
    fileInput.value.click()
}

const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
        selectedFile.value = file
        triggerToast(`已选择文件: ${file.name}`)
    }
}

const handleImport = async () => {
    if (!selectedFile.value) {
        alert('请先选择备份文件')
        return
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
        const content = e.target.result
        const success = await store.importData(content)
        if (success) {
            alert('数据导入成功！即将刷新页面...')
            window.location.reload()
        } else {
            alert('数据导入失败，请检查文件格式。')
        }
    }
    reader.readAsText(selectedFile.value)
}

// --- Reset Logic ---
const resetSelection = ref({
    settings: false,
    wechat: true,
    wallet: false
})

const handleResetApp = () => {
    // Show Modal
    showResetAppModal.value = true
}

const confirmResetApp = () => {
    showResetAppModal.value = false
    store.resetAppData({
        settings: resetSelection.value.settings,
        wechat: resetSelection.value.wechat,
        wallet: resetSelection.value.wallet
    })
    triggerToast('应用数据已重置')
}

const handleResetGlobal = () => {
    // Show Modal
    showResetGlobalModal.value = true
}

const confirmResetGlobal = () => {
    showResetGlobalModal.value = false
    store.resetGlobalData() // Will reload page
}

// Toast
const showToast = ref(false)
const toastMessage = ref('')
const triggerToast = (msg) => {
    toastMessage.value = msg
    showToast.value = true
    setTimeout(() => { showToast.value = false }, 2000)
}
</script>

<template>
  <div class="data-settings w-full h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
       <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">数据管理</span>
       </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
        
        <!-- Export -->
        <div class="glass-panel p-5 rounded-[20px] bg-white shadow-sm">
             <h4 class="text-lg font-bold text-gray-900 mb-3">导出数据</h4>
             <button @click="openExportModal" class="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition">
                 <i class="fa-solid fa-download"></i> 导出全局数据
             </button>
        </div>

        <!-- Import -->
        <div class="glass-panel p-5 rounded-[20px] bg-white shadow-sm">
             <h4 class="text-lg font-bold text-gray-900 mb-3">导入数据</h4>
             <div class="flex gap-3">
                 <button @click="triggerFileInput" class="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition">
                     <i class="fa-solid fa-upload"></i> {{ selectedFile ? '更换文件' : '选择文件' }}
                 </button>
                 <button @click="handleImport" class="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-green-50 text-green-600 font-medium hover:bg-green-100 transition">
                     <i class="fa-solid fa-check"></i> 开始导入
                 </button>
             </div>
             <div v-if="selectedFile" class="mt-2 text-xs text-center text-gray-500 truncate">
                 已选: {{ selectedFile.name }}
             </div>
             <input type="file" ref="fileInput" accept=".json" class="hidden" @change="handleFileSelect">
        </div>

        <!-- Reset -->
        <div class="glass-panel p-5 rounded-[20px] bg-white shadow-sm">
             <h4 class="text-lg font-bold text-gray-900 mb-3">重置数据</h4>
             <div class="flex gap-3">
                 <button @click="handleResetApp" class="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-orange-50 text-orange-600 font-medium hover:bg-orange-100 transition">
                     <i class="fa-solid fa-rotate-left"></i> 重置应用数据
                 </button>
                 <button @click="handleResetGlobal" class="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition">
                     <i class="fa-solid fa-database"></i> 重置全局数据
                 </button>
             </div>
        </div>

    </div>

    <!-- Toast -->
    <div v-if="showToast" class="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-2 rounded-full text-sm shadow-lg z-50">
        {{ toastMessage }}
    </div>

    <!-- Export Modal -->
    <div v-if="showExportModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-blue-900/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 w-[90vw] max-w-md shadow-2xl">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-white">导出数据</h3>
                <button @click="showExportModal = false" class="text-white/80 hover:text-white text-xl">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            
            <div class="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <h4 class="text-lg font-semibold text-blue-200">选择要导出的应用数据</h4>
                
                <!-- WeChat -->
                <div class="bg-white/10 p-3 rounded-xl border border-white/5">
                    <div class="flex items-center gap-3 mb-2">
                        <input type="checkbox" id="exp-wechat" v-model="exportSelection.wechat" class="w-5 h-5 rounded accent-blue-400">
                        <label for="exp-wechat" class="text-white font-semibold">微信 (聊天记录)</label>
                    </div>
                    <div v-if="exportSelection.wechat && chatList.length > 0" class="pl-8 space-y-2">
                        <div class="flex items-center gap-3">
                             <input type="checkbox" @change="toggleAllChats" :checked="exportSelection.selectedChats.length === chatList.length" class="w-4 h-4 rounded accent-blue-400">
                             <span class="text-white/80 text-sm italic">全选 / 只有选中的角色会被导出</span>
                        </div>
                        <div v-for="chat in chatList" :key="chat.id" class="flex items-center gap-3">
                            <input type="checkbox" :value="chat.id" v-model="exportSelection.selectedChats" class="w-4 h-4 rounded accent-blue-400">
                            <label class="text-white/80 text-sm">{{ chat.name || chat.nickname || '未命名' }} ({{ chat.msgs ? chat.msgs.length : 0 }}条)</label>
                        </div>
                    </div>
                </div>

                <!-- Wallet -->
                <div class="bg-white/10 p-3 rounded-xl border border-white/5">
                     <div class="flex items-center gap-3">
                        <input type="checkbox" id="exp-wallet" v-model="exportSelection.wallet" class="w-5 h-5 rounded accent-blue-400">
                        <label for="exp-wallet" class="text-white font-semibold">钱包与交易记录</label>
                    </div>
                </div>

                <!-- Settings -->
                <div class="bg-white/10 p-3 rounded-xl border border-white/5">
                     <div class="flex items-center gap-3">
                        <input type="checkbox" id="exp-settings" v-model="exportSelection.settings" class="w-5 h-5 rounded accent-blue-400">
                        <label for="exp-settings" class="text-white font-semibold">系统设置</label>
                    </div>
                </div>
            </div>

            <div class="flex gap-3 mt-6">
                <button @click="showExportModal = false" class="flex-1 p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition">取消</button>
                <button @click="handleExport" class="flex-1 p-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition">确认导出</button>
            </div>
        </div>
    </div>

    <!-- Reset App Modal -->
    <div v-if="showResetAppModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-blue-900/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 w-[90vw] max-w-md shadow-2xl">
             <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-white">重置应用数据</h3>
                <button @click="showResetAppModal = false" class="text-white/80 hover:text-white text-xl">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            
            <div class="space-y-4">
                <div class="text-red-300 font-medium text-center p-3 bg-red-900/20 rounded-xl border border-red-500/20">
                    <i class="fa-solid fa-triangle-exclamation mr-2"></i> 数据一旦重置将无法恢复！
                </div>
                
                <div class="space-y-3">
                     <div class="bg-white/10 p-3 rounded-xl flex items-center gap-3">
                        <input type="checkbox" id="rst-wechat" v-model="resetSelection.wechat" class="w-5 h-5 rounded accent-red-400">
                        <label for="rst-wechat" class="text-white font-semibold">微信 (清空聊天记录)</label>
                    </div>
                     <div class="bg-white/10 p-3 rounded-xl flex items-center gap-3">
                        <input type="checkbox" id="rst-settings" v-model="resetSelection.settings" class="w-5 h-5 rounded accent-red-400">
                        <label for="rst-settings" class="text-white font-semibold">系统设置 (恢复默认)</label>
                    </div>
                     <div class="bg-white/10 p-3 rounded-xl flex items-center gap-3">
                        <input type="checkbox" id="rst-wallet" v-model="resetSelection.wallet" class="w-5 h-5 rounded accent-red-400">
                        <label for="rst-wallet" class="text-white font-semibold">钱包数据</label>
                    </div>
                </div>
            </div>

            <div class="flex gap-3 mt-6">
                 <button @click="showResetAppModal = false" class="flex-1 p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition">取消</button>
                 <button @click="confirmResetApp" class="flex-1 p-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-500/30 transition">确认重置</button>
            </div>
        </div>
    </div>

    <!-- Reset Global Modal -->
    <div v-if="showResetGlobalModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-blue-900/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 w-[90vw] max-w-md shadow-2xl">
             <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-white">重置全局数据</h3>
                <button @click="showResetGlobalModal = false" class="text-white/80 hover:text-white text-xl">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            
            <div class="space-y-6 text-center">
                <div class="text-red-400 font-bold text-xl p-4 bg-red-900/20 rounded-xl border border-red-500/30 animate-pulse">
                    <i class="fa-solid fa-radiation mr-2"></i> 极度危险
                </div>
                
                <p class="text-white/80 leading-relaxed">
                    此操作将清除浏览器中保存的<span class="text-red-400 font-bold">所有数据</span>，包括所有聊天记录、设置、API Key、钱包数据和所有已安装应用的全部状态。
                    <br><br>
                    操作立即生效且无法撤销！
                </p>
                
                <div class="flex gap-3 mt-6">
                     <button @click="showResetGlobalModal = false" class="flex-1 p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition">我再想想</button>
                     <button @click="confirmResetGlobal" class="flex-1 p-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-600/30 transition">
                         <i class="fa-solid fa-trash-can mr-2"></i> 确认重置
                     </button>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
