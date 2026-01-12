<template>
  <div class="backup-settings w-full h-full bg-gray-50 flex flex-col">
    
    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100">
       <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">数据备份</span>
       </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      
      <!-- 云端同步 -->
      <div class="glass-panel p-5 rounded-[20px]">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <i class="fab fa-github text-white text-lg"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg">GitHub 云端同步</h2>
            <p class="text-xs text-gray-500">无限容量，永久保存</p>
          </div>
        </div>

        <!-- 配置区域 -->
        <div class="space-y-3">
          <div class="relative">
            <input 
              v-model="githubConfig.token" 
              :type="showToken ? 'text' : 'password'"
              placeholder="Personal Access Token"
              class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition w-full pr-12"
            >
            <button 
              @click="showToken = !showToken"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i :class="showToken ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
            </button>
          </div>
          
          <input 
            v-model="githubConfig.owner" 
            placeholder="GitHub 用户名"
            class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition w-full"
          >
          
          <input 
            v-model="githubConfig.repo" 
            placeholder="仓库名称"
            class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition w-full"
          >
          
          <input 
            v-model="githubConfig.fileName" 
            placeholder="备份文件名（默认 backup.json）"
            class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition w-full"
          >
        </div>

        <!-- 自动同步开关 -->
        <div class="mt-5 flex items-center justify-between bg-gray-50 rounded-xl p-3">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-clock text-purple-500"></i>
            <span class="text-sm font-medium">自动同步</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="autoSync" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-4 peer-focus:ring-purple-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
          </label>
        </div>

        <!-- 同步间隔 -->
        <div v-if="autoSync" class="mt-3 flex items-center gap-3">
          <span class="text-sm text-gray-600">每</span>
          <input 
            v-model.number="syncInterval" 
            type="number" 
            min="5"
            max="60"
            class="w-16 px-3 py-2 border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-purple-500"
          >
          <span class="text-sm text-gray-600">分钟同步一次</span>
        </div>

        <!-- 操作按钮 -->
        <div class="mt-5 grid grid-cols-2 gap-2">
          <button 
            @click="pushToCloud" 
            :disabled="pushing"
            class="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i class="fa-solid fa-cloud-arrow-up mr-1"></i>
            {{ pushing ? '上传中...' : '上传到云端' }}
          </button>
          
          <button 
            @click="pullFromCloud" 
            :disabled="pulling"
            class="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i class="fa-solid fa-cloud-arrow-down mr-1"></i>
            {{ pulling ? '下载中...' : '从云端恢复' }}
          </button>
        </div>

        <!-- 进度条 -->
        <div v-if="uploadProgress > 0" class="mt-3">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>传输进度</span>
            <span>{{ uploadProgress }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              class="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all duration-300"
              :style="{ width: uploadProgress + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 本地备份 -->
      <div class="glass-panel p-5 rounded-[20px]">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <i class="fa-solid fa-hard-drive text-white text-lg"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg">本地备份</h2>
            <p class="text-xs text-gray-500">快速导出导入</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button 
            @click="exportToFile"
            class="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md"
          >
            <i class="fa-solid fa-download mr-1"></i>
            导出备份
          </button>
          
          <button 
            @click="importFromFile"
            class="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md"
          >
            <i class="fa-solid fa-upload mr-1"></i>
            导入备份
          </button>
        </div>

        <!-- 统计信息 -->
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="bg-gray-50 rounded-lg p-2">
            <div class="text-xs text-gray-500">聊天数</div>
            <div class="text-lg font-bold text-gray-800">{{ chatCount }}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2">
            <div class="text-xs text-gray-500">消息数</div>
            <div class="text-lg font-bold text-gray-800">{{ messageCount }}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2">
            <div class="text-xs text-gray-500">数据大小</div>
            <div class="text-lg font-bold text-gray-800">{{ dataSize }}</div>
          </div>
        </div>
      </div>

      <!-- 自动清理 -->
      <div class="glass-panel p-5 rounded-[20px]">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            <i class="fa-solid fa-broom text-white text-lg"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg">智能归档</h2>
            <p class="text-xs text-gray-500">自动管理历史数据</p>
          </div>
        </div>

        <div class="flex items-center justify-between bg-gray-50 rounded-xl p-3">
          <div>
            <div class="text-sm font-medium">启用自动归档</div>
            <div class="text-xs text-gray-500 mt-0.5">每个聊天保留最近 1000 条消息</div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="autoArchive" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-4 peer-focus:ring-yellow-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
          </label>
        </div>

        <button 
          @click="cleanNow"
          class="mt-3 w-full px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md"
        >
          <i class="fa-solid fa-trash-can mr-1"></i>
          立即清理旧数据
        </button>
      </div>

    </div>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleFileImport">
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import GitHubBackup from '@/utils/githubBackup'

const router = useRouter()
const chatStore = useChatStore()

const goBack = () => router.back()

// GitHub 配置
const githubConfig = ref({
  token: '',
  owner: '',
  repo: '',
  fileName: 'backup.json'
})

const showToken = ref(false)

// 自动同步
const autoSync = ref(false)
const syncInterval = ref(30)
let syncTimer = null

// 状态
const pushing = ref(false)
const pulling = ref(false)
const uploadProgress = ref(0)

// 自动归档
const autoArchive = ref(false)

// 文件输入
const fileInput = ref(null)

// 统计数据
const chatCount = computed(() => Object.keys(chatStore.chats || {}).length)

const messageCount = computed(() => {
  let total = 0
  Object.values(chatStore.chats || {}).forEach(chat => {
    total += (chat.msgs || []).length
  })
  return total
})

const dataSize = computed(() => {
  const str = JSON.stringify(chatStore.chats || {})
  const bytes = new Blob([str]).size
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
})

// 加载配置
onMounted(() => {
  const saved = localStorage.getItem('github_backup_config')
  if (saved) {
    try {
      githubConfig.value = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load config:', e)
    }
  }

  const autoSyncSaved = localStorage.getItem('auto_sync_enabled')
  if (autoSyncSaved === 'true') {
    autoSync.value = true
    startAutoSync()
  }

  const autoArchiveSaved = localStorage.getItem('auto_archive_enabled')
  if (autoArchiveSaved === 'true') {
    autoArchive.value = true
  }
})

// 保存配置
watch(githubConfig, (newConfig) => {
  localStorage.setItem('github_backup_config', JSON.stringify(newConfig))
}, { deep: true })

watch(autoSync, (enabled) => {
  localStorage.setItem('auto_sync_enabled', enabled.toString())
  if (enabled) {
    startAutoSync()
  } else {
    stopAutoSync()
  }
})

watch(autoArchive, (enabled) => {
  localStorage.setItem('auto_archive_enabled', enabled.toString())
})

// 上传到云端
async function pushToCloud() {
  const validation = GitHubBackup.validateConfig(githubConfig.value)
  if (!validation.valid) {
    chatStore.triggerToast(validation.error, 'error')
    return
  }

  pushing.value = true
  uploadProgress.value = 0

  try {
    const backup = new GitHubBackup(githubConfig.value)
    uploadProgress.value = 30
    
    await backup.uploadFull(chatStore.chats)
    uploadProgress.value = 100
    
    chatStore.triggerToast('✅ 上传成功', 'success')
    setTimeout(() => { uploadProgress.value = 0 }, 1000)
  } catch (error) {
    chatStore.triggerToast('上传失败: ' + error.message, 'error')
    uploadProgress.value = 0
  } finally {
    pushing.value = false
  }
}

// 从云端恢复
async function pullFromCloud() {
  const validation = GitHubBackup.validateConfig(githubConfig.value)
  if (!validation.valid) {
    chatStore.triggerToast(validation.error, 'error')
    return
  }

  pulling.value = true
  uploadProgress.value = 0

  try {
    const backup = new GitHubBackup(githubConfig.value)
    uploadProgress.value = 30
    
    const data = await backup.downloadFull()
    uploadProgress.value = 80
    
    chatStore.chats = data
    chatStore.saveChats()
    uploadProgress.value = 100
    
    chatStore.triggerToast('✅ 恢复成功', 'success')
    setTimeout(() => { uploadProgress.value = 0 }, 1000)
  } catch (error) {
    chatStore.triggerToast('恢复失败: ' + error.message, 'error')
    uploadProgress.value = 0
  } finally {
    pulling.value = false
  }
}

// 导出到文件
function exportToFile() {
  const data = JSON.stringify(chatStore.chats, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `qiaoqiao_backup_${Date.now()}.json`
  a.click()
  
  URL.revokeObjectURL(url)
  chatStore.triggerToast('✅ 导出成功', 'success')
}

// 从文件导入
function importFromFile() {
  fileInput.value.click()
}

function handleFileImport(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      chatStore.chats = data
      chatStore.saveChats()
      chatStore.triggerToast('✅ 导入成功', 'success')
    } catch (error) {
      chatStore.triggerToast('导入失败: 文件格式错误', 'error')
    }
  }
  reader.readAsText(file)
  event.target.value = '' // 重置以允许重复选择
}

// 立即清理
function cleanNow() {
  let cleaned = 0
  Object.keys(chatStore.chats).forEach(chatId => {
    const chat = chatStore.chats[chatId]
    if (chat.msgs && chat.msgs.length > 1000) {
      cleaned += chat.msgs.length - 1000
      chat.msgs = chat.msgs.slice(-1000)
    }
  })
  
  chatStore.saveChats()
  chatStore.triggerToast(`已清理 ${cleaned} 条旧消息`, 'success')
}

// 自动同步
function startAutoSync() {
  if (syncTimer) return
  
  syncTimer = setInterval(() => {
    pushToCloud()
  }, syncInterval.value * 60 * 1000)
  
  console.log(`✅ 自动同步已启动（${syncInterval.value} 分钟）`)
}

function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
    console.log('🛑 自动同步已停止')
  }
}

onUnmounted(() => {
  stopAutoSync()
})
</script>

<style scoped>
/* 复用你的 glass-panel 样式 */
</style>
