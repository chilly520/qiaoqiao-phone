<template>
  <div class="backup-settings w-full h-full bg-gray-50 flex flex-col">

    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
      <div class="flex items-center gap-3 cursor-pointer" @click="handleGoBack">
        <i class="fa-solid fa-chevron-left text-lg"></i>
        <span class="font-bold text-xl">数据备份与迁移</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

      <!-- 云端同步 (GitHub) -->
      <div class="glass-panel p-5 rounded-[20px]">
        <div class="flex items-center gap-2 mb-4">
          <div
            class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <i class="fab fa-github text-white text-lg"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg text-gray-800">GitHub 云端同步</h2>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Encrypted & Permanent</p>
          </div>
        </div>

        <div class="space-y-3">
          <div class="relative">
            <input v-model="githubConfig.token" :type="showToken ? 'text' : 'password'"
              placeholder="GitHub Personal Access Token"
              class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition w-full pr-12 text-sm">
            <button @click="showToken = !showToken"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i :class="showToken ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <input v-model="githubConfig.owner" placeholder="GitHub 用户名"
              class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition w-full text-sm">
            <input v-model="githubConfig.repo" placeholder="仓库名称"
              class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition w-full text-sm">
          </div>

          <input v-model="githubConfig.fileName" placeholder="备份文件名（默认 backup.json）"
            class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition w-full text-sm">
        </div>

        <div class="mt-5 flex items-center justify-between bg-gray-50 rounded-2xl p-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <i class="fa-solid fa-arrows-rotate text-purple-600 text-xs"></i>
            </div>
            <div>
              <div class="text-sm font-bold text-gray-700">全量自动同步</div>
              <div class="text-[10px] text-gray-400">设置同步间隔 (分钟)</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input v-if="autoSync" v-model.number="syncInterval" type="number" min="5" max="600"
              class="w-14 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-center font-bold">
            <label class="relative inline-flex items-center cursor-pointer scale-90">
              <input type="checkbox" v-model="autoSync" class="sr-only peer">
              <div
                class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-purple-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600">
              </div>
            </label>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3">
          <button @click="handlePushToCloud" :disabled="isPushing"
            class="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-all shadow-lg shadow-purple-100 disabled:opacity-50">
            <i class="fa-solid fa-cloud-arrow-up mr-2"></i>
            {{ isPushing ? '上传中...' : '备份至云端' }}
          </button>

          <button @click="handlePullFromCloud" :disabled="isPulling"
            class="px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-all hover:bg-gray-50 disabled:opacity-50">
            <i class="fa-solid fa-cloud-arrow-down mr-2 text-blue-500"></i>
            {{ isPulling ? '下载中...' : '从云端恢复' }}
          </button>
        </div>

        <div v-if="uploadProgress > 0" class="mt-4">
          <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div class="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 transition-all duration-500"
              :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <p class="text-[9px] text-center text-gray-400 mt-1 uppercase font-bold tracking-widest">Processing Data
            Assets...</p>
        </div>
      </div>

      <!-- 本地物理备份 -->
      <div class="glass-panel p-5 rounded-[20px]">
        <div class="flex items-center gap-2 mb-4">
          <div
            class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <i class="fa-solid fa-file-invoice text-white text-lg"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg text-gray-800">离线数据包</h2>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Standard 2.0 JSON</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <button @click="handleOpenExportModal"
            class="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-black text-base active:scale-[0.98] transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3">
            <i class="fa-solid fa-file-export"></i>
            <span>生成全系统迁移包</span>
          </button>

          <div class="flex gap-2">
            <button @click="handleImportTrigger"
              class="flex-1 py-3 bg-white border-2 border-dashed border-gray-200 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2">
              <i class="fa-solid fa-folder-open"></i>
              选择备份文件
            </button>
            <button @click="handleFileImport" :disabled="!selectedImportFile"
              class="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-emerald-50 disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-2">
              <i class="fa-solid fa-file-import"></i>
              立刻还原
            </button>
          </div>
          <div v-if="selectedImportFile" class="text-center">
            <p class="text-[10px] text-gray-400 truncate px-4 font-medium">已选择: {{ selectedImportFile.name }} ({{
              (selectedImportFile.size / 1024).toFixed(1) }} KB)</p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-3 gap-2">
          <div class="bg-blue-50/50 rounded-2xl p-3 border border-blue-100/20 text-center">
            <div class="text-[9px] text-blue-500 font-black uppercase tracking-tighter">Contacts</div>
            <div class="text-sm font-black text-blue-900">{{ chatCount }}</div>
          </div>
          <div class="bg-indigo-50/50 rounded-2xl p-3 border border-indigo-100/20 text-center">
            <div class="text-[9px] text-indigo-500 font-black uppercase tracking-tighter">Messages</div>
            <div class="text-sm font-black text-indigo-900">{{ messageCount }}</div>
          </div>
          <div class="bg-gray-50 rounded-2xl p-3 border border-gray-100 text-center">
            <div class="text-[9px] text-gray-400 font-black uppercase tracking-tighter">Payload</div>
            <div class="text-sm font-black text-gray-800">{{ formattedDataSize }}</div>
          </div>
        </div>
      </div>

      <!-- 存储容量优化 -->
      <div class="glass-panel p-5 rounded-[20px]">
        <div class="flex items-center gap-2 mb-4">
          <div
            class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <i class="fa-solid fa-broom-ball text-white text-lg"></i>
          </div>
          <h2 class="font-bold text-lg text-gray-800">存储空间优化</h2>
        </div>

        <div class="flex items-center justify-between bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
          <div class="space-y-0.5">
            <div class="text-sm font-bold text-amber-900">历史消息限额 (1000条)</div>
            <div class="text-[10px] text-amber-600/70">超过此限制的消息将被自动归档</div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="autoArchiveEnabled" class="sr-only peer">
            <div
              class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-amber-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500">
            </div>
          </label>
        </div>

        <button @click="handleManualClean"
          class="mt-3 w-full px-4 py-3 bg-white border border-amber-200 text-amber-600 rounded-xl font-bold text-sm active:bg-amber-50 active:scale-95 transition-all flex items-center justify-center gap-2">
          <i class="fa-solid fa-trash-arrow-up"></i>
          释放存储空间
        </button>
      </div>

    </div>

    <!-- Hidden Inputs -->
    <input ref="fileInputEl" type="file" accept=".json" class="hidden" @change="onFileSelected">

    <!-- Export Configuration Modal -->
    <Transition name="slide-up">
      <div v-if="showExportModal"
        class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
        @click.self="showExportModal = false">
        <div
          class="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <div class="p-8 border-b border-gray-50 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-2xl font-black text-gray-900 leading-tight">资产导出定义</h3>
              <p class="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">Asset Category Selection</p>
            </div>
            <button @click="showExportModal = false"
              class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <i class="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar bg-gray-50/20">
            <div class="flex gap-2">
              <button @click="setExportAll(true)"
                class="flex-1 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all active:scale-95">全选系统</button>
              <button @click="setExportAll(false)"
                class="flex-1 py-3 bg-white text-gray-400 border border-gray-100 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all active:scale-95">清空</button>
            </div>

            <div class="grid gap-3">
              <div v-for="opt in exportOptionList" :key="opt.id"
                class="flex items-center gap-5 p-5 rounded-3xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden group"
                :class="opt.enabled ? 'bg-white border-blue-500 shadow-xl shadow-blue-500/5' : 'bg-white/50 border-gray-100 opacity-60'"
                @click="toggleExportOption(opt.id)">

                <div v-if="opt.enabled"
                  class="absolute -right-4 -bottom-4 text-blue-500/5 rotate-12 transition-transform group-hover:scale-125">
                  <i :class="opt.icon" class="text-7xl"></i>
                </div>

                <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm z-10 shrink-0"
                  :class="opt.color">
                  <i :class="opt.icon"></i>
                </div>
                <div class="flex-1 z-10">
                  <div class="font-black text-gray-800 text-lg leading-tight">{{ opt.name }}</div>
                  <div class="text-[10px] text-gray-400 font-bold mt-0.5 tracking-tight">{{ opt.desc }}</div>
                </div>
                <div
                  class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10 shrink-0 shadow-sm"
                  :class="opt.enabled ? 'bg-blue-600 border-blue-600' : 'border-gray-200 bg-white'">
                  <i v-if="opt.enabled" class="fa-solid fa-check text-white text-[10px]"></i>
                </div>
              </div>
            </div>
          </div>

          <div class="p-8 bg-white border-t border-gray-50 flex gap-3 shrink-0">
            <button @click="handleConfirmExport"
              class="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-3xl font-black text-lg shadow-2xl shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-3">
              <i class="fa-solid fa-cloud-arrow-down"></i>
              <span>生成并下载数据包</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { useMomentsStore } from '@/stores/momentsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStickerStore } from '@/stores/stickerStore'
import { useWorldBookStore } from '@/stores/worldBookStore'
import GitHubBackup from '@/utils/githubBackup'

const router = useRouter()
const chatStore = useChatStore()
const momentsStore = useMomentsStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()
const worldBookStore = useWorldBookStore()

const handleGoBack = () => router.back()

// --- State ---
const githubConfig = ref({
  token: '',
  owner: '',
  repo: '',
  fileName: 'backup.json'
})
const showToken = ref(false)
const autoSync = ref(false)
const syncInterval = ref(30)
let syncTimer = null

const isPushing = ref(false)
const isPulling = ref(false)
const uploadProgress = ref(0)
const autoArchiveEnabled = ref(false)

const showExportModal = ref(false)
const selectionState = ref({
  chats: true,
  moments: true,
  settings: true,
  decoration: true,
  worldbook: true,
  stickers: true
})

// --- Computed ---
const exportOptionList = computed(() => [
  { id: 'chats', name: '角色与聊天', desc: `${Object.keys(chatStore.chats || {}).length} 个联系人及其历史`, icon: 'fa-solid fa-comments', color: 'bg-emerald-100 text-emerald-600', enabled: selectionState.value.chats },
  { id: 'moments', name: '朋友圈动态', desc: `${(momentsStore.moments || []).length} 条朋友圈及评论`, icon: 'fa-solid fa-camera-retro', color: 'bg-orange-100 text-orange-600', enabled: selectionState.value.moments },
  { id: 'settings', name: '系统核心配置', desc: 'API设置、音量及天气参数', icon: 'fa-solid fa-screwdriver-wrench', color: 'bg-blue-100 text-blue-600', enabled: selectionState.value.settings },
  { id: 'decoration', name: '美化与自定义', desc: '壁纸、图标映及全局CSS', icon: 'fa-solid fa-wand-magic-sparkles', color: 'bg-purple-100 text-purple-600', enabled: selectionState.value.decoration },
  { id: 'worldbook', name: '世界书设定', desc: `${worldBookStore.books?.length || 0} 个完整词库项目`, icon: 'fa-solid fa-book-sparkles', color: 'bg-indigo-100 text-indigo-600', enabled: selectionState.value.worldbook },
  { id: 'stickers', name: '表情包图库', desc: `${stickerStore.stickers?.length || 0} 个收藏表情资源`, icon: 'fa-solid fa-face-laugh-squint', color: 'bg-amber-100 text-amber-600', enabled: selectionState.value.stickers }
])

const chatCount = computed(() => Object.keys(chatStore.chats || {}).length)
const messageCount = computed(() => {
  let total = 0
  Object.values(chatStore.chats || {}).forEach(c => {
    if (c.msgs && Array.isArray(c.msgs)) total += c.msgs.length
  })
  return total
})
const formattedDataSize = computed(() => {
  try {
    const str = JSON.stringify(chatStore.chats || {})
    const bytes = new window.Blob([str]).size
    return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1024 / 1024).toFixed(1) + ' MB'
  } catch (e) { return '0 KB' }
})

// --- Methods ---
function toggleExportOption(id) {
  selectionState.value[id] = !selectionState.value[id]
}
function setExportAll(val) {
  Object.keys(selectionState.value).forEach(k => selectionState.value[k] = val)
}

function handleOpenExportModal() { showExportModal.value = true }

function handleConfirmExport() {
  const backupData = {
    version: '2.0',
    timestamp: Date.now(),
    type: 'qiaoqiao_full_migration',
    data: {}
  }
  const s = selectionState.value

  if (s.chats) backupData.data.chats = chatStore.chats
  if (s.moments) backupData.data.moments = momentsStore.moments
  if (s.settings) {
    backupData.data.apiConfigs = settingsStore.apiConfigs
    backupData.data.currentConfigIndex = settingsStore.currentConfigIndex
    backupData.data.personalization = { ...settingsStore.personalization }
    backupData.data.voice = settingsStore.voice
    backupData.data.weather = settingsStore.weather
    backupData.data.drawing = settingsStore.drawing
  }
  if (s.decoration) {
    backupData.data.customCss = settingsStore.personalization.customCss
    backupData.data.theme = settingsStore.personalization.theme
    backupData.data.wallpaper = settingsStore.personalization.wallpaper
  }
  if (s.worldbook) backupData.data.worldbook = worldBookStore.books
  if (s.stickers) backupData.data.stickers = stickerStore.stickers

  try {
    const backupBlob = new window.Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
    const downloadUrl = window.URL.createObjectURL(backupBlob)
    const anchor = window.document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = `QiaoQiao_Migration_${new Date().toISOString().split('T')[0]}.json`
    window.document.body.appendChild(anchor)
    anchor.click()
    window.document.body.removeChild(anchor)
    window.URL.revokeObjectURL(downloadUrl)

    showExportModal.value = false
    chatStore.triggerToast('✅ 迁移数据包生成完成', 'success')
  } catch (err) {
    chatStore.triggerToast('导出失败: ' + err.message, 'error')
  }
}

// --- Lifecycle & Persistence ---
onMounted(async () => {
  // Ensure data is loaded
  await worldBookStore.loadEntries()
  settingsStore.loadFromStorage()

  const savedConfig = window.localStorage.getItem('github_backup_config')
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig)
      if (parsed && typeof parsed === 'object') {
        githubConfig.value = { ...githubConfig.value, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to parse saved github config', e)
    }
  }
  if (window.localStorage.getItem('auto_sync_enabled') === 'true') {
    autoSync.value = true
    runAutoSync()
  }
  if (window.localStorage.getItem('auto_archive_enabled') === 'true') {
    autoArchiveEnabled.value = true
  }
})

watch(githubConfig, (newCfg) => {
  window.localStorage.setItem('github_backup_config', JSON.stringify(newCfg))
}, { deep: true })

watch(autoSync, (isEnabled) => {
  window.localStorage.setItem('auto_sync_enabled', isEnabled.toString())
  isEnabled ? runAutoSync() : stopAutoSync()
})

watch(autoArchiveEnabled, (isEnabled) => {
  window.localStorage.setItem('auto_archive_enabled', isEnabled.toString())
})

// --- Cloud Sync Actions ---
async function handlePushToCloud() {
  const validation = GitHubBackup.validateConfig(githubConfig.value)
  if (!validation.valid) return chatStore.triggerToast(validation.error, 'error')

  isPushing.value = true
  uploadProgress.value = 0
  try {
    uploadProgress.value = 35
    const backupService = new GitHubBackup(githubConfig.value)
    await backupService.uploadFull(chatStore.chats)
    uploadProgress.value = 100
    chatStore.triggerToast('✅ 数据已加密并同步至云端', 'success')
    setTimeout(() => { uploadProgress.value = 0 }, 1500)
  } catch (err) {
    chatStore.triggerToast('同步失败: ' + err.message, 'error')
  } finally { isPushing.value = false }
}

async function handlePullFromCloud() {
  const validation = GitHubBackup.validateConfig(githubConfig.value)
  if (!validation.valid) return chatStore.triggerToast(validation.error, 'error')

  isPulling.value = true
  try {
    const backupService = new GitHubBackup(githubConfig.value)
    const remoteData = await backupService.downloadFull()
    if (remoteData) {
      // Compatibility: check for nested data property
      const payload = remoteData.data || remoteData
      if (payload && typeof payload === 'object') {
        if (payload.chats) {
          chatStore.chats = payload.chats
          await chatStore.saveChats()
        }
        // Also try to restore other parts if present in cloud backup
        if (payload.moments) momentsStore.moments = payload.moments
        if (payload.apiConfigs) settingsStore.apiConfigs = payload.apiConfigs
        if (payload.personalization) settingsStore.personalization = payload.personalization

        chatStore.triggerToast('✅ 云端数据恢复成功', 'success')
        setTimeout(() => window.location.reload(), 1000)
      } else {
        throw new Error('云端文件格式非法')
      }
    }
  } catch (err) {
    chatStore.triggerToast('加载失败: ' + err.message, 'error')
  } finally { isPulling.value = false }
}

// --- Local File Import ---
const fileInputEl = ref(null)
const selectedImportFile = ref(null)
const selectedImportData = ref(null)

const handleImportTrigger = () => {
  if (fileInputEl.value) fileInputEl.value.click()
}

function onFileSelected(event) {
  const file = event.target.files[0]
  if (!file) return
  selectedImportFile.value = file

  const reader = new window.FileReader()
  reader.onload = (e) => {
    const result = e.target.result
    if (!result || result.trim() === '') {
      chatStore.triggerToast('文件内容为空', 'error')
      selectedImportFile.value = null
      return
    }
    try {
      selectedImportData.value = JSON.parse(result)
      chatStore.triggerToast('文件加载成功，点击“立刻还原”', 'success')
    } catch (err) {
      chatStore.triggerToast('JSON解析失败: ' + err.message, 'error')
      selectedImportFile.value = null
    }
  }
  reader.readAsText(file)
}

function handleFileImport() {
  if (!selectedImportData.value) return

  try {
    const raw = selectedImportData.value
    // Smart Detection: backup might be wrapped in .data or just raw
    let payload = raw.data || raw

    // Support for truly legacy array format (pre-v2)
    if (Array.isArray(payload)) {
      payload = { chats: payload.reduce((acc, c) => { if (c.id) acc[c.id] = c; return acc; }, {}) }
    }

    let restoredCount = 0
    if (payload.chats && typeof payload.chats === 'object') {
      chatStore.chats = payload.chats
      chatStore.saveChats()
      restoredCount++
    }

    if (payload.moments) { momentsStore.moments = payload.moments; restoredCount++; }
    if (payload.apiConfigs) { settingsStore.apiConfigs = payload.apiConfigs; restoredCount++; }
    if (payload.personalization) { settingsStore.personalization = payload.personalization; restoredCount++; }
    if (payload.worldbook) { worldBookStore.books = payload.worldbook; restoredCount++; }
    if (payload.stickers) { stickerStore.stickers = payload.stickers; restoredCount++; }

    if (restoredCount > 0) {
      if (settingsStore.saveToStorage) settingsStore.saveToStorage()
      chatStore.triggerToast('🚀 系统还原完成，正在热重启...', 'success')
      selectedImportFile.value = null
      setTimeout(() => { window.location.reload() }, 1500)
    } else {
      chatStore.triggerToast('未在文件中找到有效数据', 'error')
    }
  } catch (err) {
    chatStore.triggerToast('还原失败: ' + err.message, 'error')
  }
}

function handleManualClean() {
  let cleanedCount = 0
  Object.values(chatStore.chats || {}).forEach(chat => {
    if (chat.msgs && chat.msgs.length > 1000) {
      cleanedCount += (chat.msgs.length - 1000)
      chat.msgs = chat.msgs.slice(-1000)
    }
  })
  chatStore.saveChats()
  chatStore.triggerToast(`🧹 已清理 ${cleanedCount} 条冗余消息`, 'success')
}

function runAutoSync() {
  if (syncTimer) return
  syncTimer = setInterval(() => handlePushToCloud(), Math.max(5, syncInterval.value) * 60000)
}
function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

onUnmounted(() => stopAutoSync())
</script>

<style scoped>
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
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

.custom-scrollbar::-webkit-scrollbar {
  width: 0;
}
</style>
