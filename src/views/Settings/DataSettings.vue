<template>
    <div class="data-settings w-full h-full bg-gray-50 flex flex-col">
        <!-- Header -->
        <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
            <div class="flex items-center gap-3 cursor-pointer" @click="handleGoBack">
                <i class="fa-solid fa-chevron-left text-lg text-gray-700"></i>
                <span
                    class="font-black text-xl bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">资产数据管理</span>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24">

            <!-- Assets Migration Card -->
            <div class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
                <div
                    class="absolute -right-4 -top-4 text-blue-500/5 rotate-12 transition-transform group-hover:scale-110">
                    <i class="fa-solid fa-cloud-arrow-up text-9xl"></i>
                </div>

                <div class="flex items-center gap-4 mb-6 relative z-10">
                    <div
                        class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-200">
                        <i class="fa-solid fa-database text-lg"></i>
                    </div>
                    <div>
                        <h4 class="text-lg font-black text-gray-900">备份与导出</h4>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">System Assets Export
                        </p>
                    </div>
                </div>

                <div class="space-y-3 relative z-10">
                    <button @click="handleOpenExport"
                        class="w-full flex items-center justify-center gap-3 py-4.5 rounded-2xl bg-gray-900 text-white font-black text-sm hover:shadow-2xl hover:bg-black transition-all active:scale-[0.98]">
                        <i class="fa-solid fa-file-export"></i> 导出全系统资产包
                    </button>
                    <p class="text-center text-[10px] text-gray-400 font-medium">生成包含聊天、朋友圈、设置在内的加密备份</p>
                </div>
            </div>

            <!-- Import Card -->
            <div class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 group relative">
                <div class="flex items-center gap-4 mb-6">
                    <div
                        class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-200">
                        <i class="fa-solid fa-file-shield text-lg"></i>
                    </div>
                    <div>
                        <h4 class="text-lg font-black text-gray-900">数据还原</h4>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Restore Memory Package
                        </p>
                    </div>
                </div>

                <div class="flex flex-col gap-3">
                    <button @click="handleTriggerFile"
                        class="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all">
                        <i class="fa-solid fa-paperclip"></i> {{ importFile ? '更换备份文件' : '选取 JSON 备份' }}
                    </button>

                    <div v-if="importFile"
                        class="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between mb-1">
                        <span class="text-[11px] text-emerald-700 truncate max-w-[70%] font-bold">{{ importFile.name
                            }}</span>
                        <span
                            class="text-[10px] text-emerald-500 px-2 py-0.5 bg-white rounded-full border border-emerald-100 font-black">
                            {{ (importFile.size / 1024).toFixed(1) }} KB
                        </span>
                    </div>

                    <button :disabled="!importFile" @click="processImport"
                        class="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 text-white font-black hover:bg-emerald-600 transition-all active:scale-[0.98] disabled:opacity-20 disabled:grayscale shadow-lg shadow-emerald-100">
                        <i class="fa-solid fa-circle-check"></i> 确认并覆盖还原
                    </button>
                </div>
                <input type="file" ref="fileInputEl" accept=".json" class="hidden" @change="onFileChanged">
            </div>

            <!-- Danger Zone -->
            <div class="bg-red-50/30 rounded-[32px] p-6 shadow-sm border border-red-100/50">
                <div class="flex items-center gap-4 mb-6">
                    <div
                        class="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-xl shadow-red-200">
                        <i class="fa-solid fa-skull-crossbones text-lg"></i>
                    </div>
                    <div>
                        <h4 class="text-lg font-black text-gray-900">危险操作区</h4>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Irreversible
                            Destruction</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <button @click="initResetApp"
                        class="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-white border border-red-100 text-rose-600 font-black hover:bg-red-50 transition-all active:scale-95 shadow-sm">
                        <i class="fa-solid fa-rotate-left text-xl"></i>
                        <span class="text-[11px]">重置应用</span>
                    </button>
                    <button @click="initPurgeAll"
                        class="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-rose-600 text-white font-black hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-100">
                        <i class="fa-solid fa-dumpster-fire text-xl"></i>
                        <span class="text-[11px]">彻底清空</span>
                    </button>
                </div>
            </div>

        </div>

        <!-- Export Selection Modal -->
        <Transition name="slide-up">
            <div v-if="modalStates.export"
                class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
                @click.self="modalStates.export = false">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                <div
                    class="bg-white w-full max-w-lg rounded-t-[44px] sm:rounded-[44px] overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
                    <div class="p-8 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
                        <div>
                            <h3 class="text-2xl font-black text-gray-900 leading-tight">全系统资产导出</h3>
                            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Multi-Asset Export
                                Hub</p>
                        </div>
                        <button @click="modalStates.export = false"
                            class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 active:scale-90 transition-all">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar bg-gray-50/30">
                        <!-- Bulk Actions -->
                        <div class="flex gap-2">
                            <button @click="updateAllExport(true)"
                                class="flex-1 py-3.5 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:bg-indigo-100">全选资源</button>
                            <button @click="updateAllExport(false)"
                                class="flex-1 py-3.5 bg-white text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-gray-100 transition-all active:bg-gray-50">清空选择</button>
                        </div>

                        <!-- Asset Grid -->
                        <div class="grid grid-cols-1 gap-4">
                            <div v-for="asset in assetOptions" :key="asset.id"
                                class="group relative flex items-center gap-5 p-5 rounded-[32px] border-2 transition-all cursor-pointer overflow-hidden"
                                :class="enabledAssets.has(asset.id) ? 'bg-white border-blue-500 shadow-xl shadow-blue-500/5' : 'bg-white/50 border-gray-100 opacity-60'"
                                @click="enabledAssets.has(asset.id) ? enabledAssets.delete(asset.id) : enabledAssets.add(asset.id)">

                                <div v-if="enabledAssets.has(asset.id)"
                                    class="absolute -right-4 -bottom-4 text-blue-500/5 rotate-12 transition-transform group-hover:scale-125">
                                    <i :class="asset.icon" class="text-7xl"></i>
                                </div>

                                <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all relative z-10"
                                    :class="asset.color">
                                    <i :class="asset.icon"></i>
                                </div>

                                <div class="flex-1 relative z-10">
                                    <div class="font-black text-gray-800 text-lg leading-tight">{{ asset.name }}</div>
                                    <div class="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tight">{{
                                        asset.desc }}</div>
                                </div>

                                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0 z-10"
                                    :class="enabledAssets.has(asset.id) ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-200' : 'border-gray-200 bg-white'">
                                    <i v-if="enabledAssets.has(asset.id)"
                                        class="fa-solid fa-check text-white text-[10px] font-black"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="p-8 bg-white border-t border-gray-50 flex gap-4 shrink-0">
                        <button @click="executeExport"
                            class="w-full py-5 bg-black text-white rounded-[28px] font-black text-lg shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                            <i class="fa-solid fa-download"></i>
                            生成全量导出包
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Safety Confirmation Modal -->
        <Transition name="fade">
            <div v-if="modalStates.confirm"
                class="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8">
                <div class="bg-white w-full max-w-sm rounded-[48px] p-10 shadow-2xl text-center">
                    <div
                        class="w-24 h-24 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center text-4xl mx-auto mb-8 shadow-xl shadow-rose-100">
                        <i class="fa-solid fa-triangle-exclamation animate-pulse"></i>
                    </div>
                    <h3 class="text-2xl font-black text-gray-900 mb-3">确定执行核心重置？</h3>
                    <p class="text-xs text-gray-400 mb-10 px-4 leading-relaxed font-bold uppercase tracking-tighter">
                        对应数据将<span class="text-rose-500">永久销毁</span>，这是不可撤销的原子级物理操作。
                    </p>

                    <div class="flex flex-col gap-4">
                        <button @click="processAtomicReset"
                            class="w-full py-5 bg-rose-500 text-white rounded-[24px] font-black shadow-xl shadow-rose-200 active:scale-95 transition-all text-sm">
                            是的，确认永久删除
                        </button>
                        <button @click="modalStates.confirm = false"
                            class="w-full py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600">
                            取消操作
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { useMomentsStore } from '@/stores/momentsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStickerStore } from '@/stores/stickerStore'
import { useWorldBookStore } from '@/stores/worldBookStore'

const router = useRouter()
const chatStore = useChatStore()
const momentsStore = useMomentsStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()
const worldBookStore = useWorldBookStore()

onMounted(async () => {
    // Force reload critical stores to ensure export data is fresh
    await worldBookStore.loadEntries()
    settingsStore.loadFromStorage()
})

const handleGoBack = () => router.back()

// --- UI State ---
const modalStates = reactive({
    export: false,
    confirm: false,
    resetType: '' // 'app' or 'global'
})

// --- Export Configuration ---
const assetOptions = computed(() => [
    { id: 'chats', name: '角色与聊天', desc: `${Object.keys(chatStore.chats || {}).length} 个生命体记忆`, icon: 'fa-solid fa-robot', color: 'bg-emerald-100 text-emerald-600', enabled: true },
    { id: 'moments', name: '朋友圈动态', desc: `${(momentsStore.moments || []).length} 条社交时空片段`, icon: 'fa-solid fa-camera-retro', color: 'bg-orange-100 text-orange-600', enabled: true },
    { id: 'settings', name: '系统核心参数', desc: 'API配置与自动化逻辑', icon: 'fa-solid fa-sliders', color: 'bg-blue-100 text-blue-600', enabled: true },
    { id: 'decoration', name: '环境美化配置', desc: '壁纸及全局视觉样式', icon: 'fa-solid fa-palette', color: 'bg-purple-100 text-purple-600', enabled: true },
    { id: 'worldbook', name: '世界书设定', desc: `${worldBookStore.books?.length || 0} 个逻辑定义单元`, icon: 'fa-solid fa-book-sparkles', color: 'bg-indigo-100 text-indigo-600', enabled: true },
    { id: 'stickers', name: '私有表情仓库', desc: `${stickerStore.stickers?.length || 0} 个静态/动态资源`, icon: 'fa-solid fa-icons', color: 'bg-amber-100 text-amber-600', enabled: true }
])
// Maintain separate state for enabled status since computed is read-only for structure
const enabledAssets = ref(new Set(['chats', 'moments', 'settings', 'decoration', 'worldbook', 'stickers']))

const updateAllExport = (val) => {
    if (val) {
        ['chats', 'moments', 'settings', 'decoration', 'worldbook', 'stickers'].forEach(id => enabledAssets.value.add(id))
    } else {
        enabledAssets.value.clear()
    }
}

const handleOpenExport = () => {
    modalStates.export = true
}

const executeExport = () => {
    const backup = {
        version: '2.0',
        timestamp: Date.now(),
        type: 'qiaoqiao_full_migration',
        data: {}
    }

    const activeIds = Array.from(enabledAssets.value)

    if (activeIds.includes('chats')) backup.data.chats = chatStore.chats
    if (activeIds.includes('moments')) backup.data.moments = momentsStore.moments
    if (activeIds.includes('settings')) {
        backup.data.apiConfigs = settingsStore.apiConfigs
        backup.data.currentConfigIndex = settingsStore.currentConfigIndex
        backup.data.personalization = { ...settingsStore.personalization }
        backup.data.voice = settingsStore.voice
        backup.data.weather = settingsStore.weather
        backup.data.drawing = settingsStore.drawing
    }
    if (activeIds.includes('decoration')) {
        backup.data.customCss = settingsStore.personalization.customCss
        backup.data.theme = settingsStore.personalization.theme
        backup.data.wallpaper = settingsStore.personalization.wallpaper
    }
    if (activeIds.includes('worldbook')) backup.data.worldbook = worldBookStore.books
    if (activeIds.includes('stickers')) backup.data.stickers = stickerStore.stickers

    try {
        const jsonStr = JSON.stringify(backup, null, 2)
        const blob = new window.Blob([jsonStr], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const anchor = window.document.createElement('a')
        anchor.href = url
        anchor.download = `QiaoQiao_FullAsset_${new Date().toISOString().split('T')[0]}.json`
        window.document.body.appendChild(anchor)
        anchor.click()
        window.document.body.removeChild(anchor)
        window.URL.revokeObjectURL(url)

        modalStates.export = false
        chatStore.triggerToast('✅ 数据导出成功', 'success')
    } catch (e) {
        chatStore.triggerToast('导出失败: ' + e.message, 'error')
    }
}

// --- Import Logic ---
const fileInputEl = ref(null)
const importFile = ref(null)
const importPayload = ref(null)

const handleTriggerFile = () => {
    if (fileInputEl.value) fileInputEl.value.click()
}

const onFileChanged = (event) => {
    const file = event.target.files[0]
    if (!file) return
    importFile.value = file

    const reader = new window.FileReader()
    reader.onload = (e) => {
        try {
            importPayload.value = JSON.parse(e.target.result)
            chatStore.triggerToast('文件校验通过', 'success')
        } catch (err) {
            chatStore.triggerToast('无效的备份文件', 'error')
            importFile.value = null
        }
    }
    reader.readAsText(file)
}

const processImport = async () => {
    if (!importPayload.value) return

    const backup = importPayload.value
    const data = backup.data || backup // Fallback v1

    try {
        if (data.chats) {
            chatStore.chats = data.chats
            chatStore.saveChats()
        }
        if (data.moments) momentsStore.moments = data.moments
        if (data.apiConfigs) settingsStore.apiConfigs = data.apiConfigs
        if (data.personalization) settingsStore.personalization = data.personalization
        if (data.worldbook) worldBookStore.books = data.worldbook
        if (data.stickers) stickerStore.stickers = data.stickers

        if (settingsStore.saveToStorage) settingsStore.saveToStorage()

        chatStore.triggerToast('🚀 物理还原完成，正在重载核心...', 'success')

        window.setTimeout(() => {
            window.location.reload()
        }, 1500)
    } catch (e) {
        chatStore.triggerToast('导入过程发生异常', 'error')
    }
}

// --- Atomic Reset Logic ---
const resetConfig = reactive({
    settings: false,
    wechat: true,
    wallet: false
})

const initResetApp = () => {
    modalStates.resetType = 'app'
    modalStates.confirm = true
}

const initPurgeAll = () => {
    modalStates.resetType = 'global'
    modalStates.confirm = true
}

const processAtomicReset = () => {
    modalStates.confirm = false
    if (modalStates.resetType === 'app') {
        settingsStore.resetAppData({
            settings: resetConfig.settings,
            wechat: resetConfig.wechat,
            wallet: resetConfig.wallet
        })
        chatStore.triggerToast('应用数据已重置完成', 'success')
    } else {
        settingsStore.resetGlobalData()
        // resetGlobalData handles its own toast or reload
    }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 0px;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(100%);
    opacity: 0;
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
}
</style>
