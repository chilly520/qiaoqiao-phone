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
              <div class="text-[10px] text-gray-400">上次备份: {{ lastSyncSuccess }}</div>
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

      <!-- 危险操作区 (从数据管理移动至此) -->
      <div class="glass-panel p-5 rounded-[20px] bg-red-50/10 border-red-100/30">
        <div class="flex items-center gap-2 mb-4">
          <div
            class="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-100">
            <i class="fa-solid fa-skull-crossbones text-lg"></i>
          </div>
          <div>
            <h2 class="font-bold text-lg text-gray-800">危险操作区</h2>
            <p class="text-[9px] text-red-400 font-bold uppercase tracking-widest">Permanent Destruction</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <button @click="initResetApp"
            class="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-white border border-red-100 text-rose-500 font-bold active:bg-red-50 active:scale-95 transition-all shadow-sm">
            <i class="fa-solid fa-rotate-left text-lg"></i>
            <span class="text-[10px]">重置应用</span>
          </button>
          <button @click="initPurgeAll"
            class="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-rose-600 text-white font-bold active:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-50">
            <i class="fa-solid fa-dumpster-fire text-lg"></i>
            <span class="text-[10px]">彻底清空</span>
          </button>
        </div>
        <p class="mt-4 text-[9px] text-gray-400 text-center leading-relaxed">
          <b>提示：</b>重置应用将保留设置但删除数据；彻底清空将销毁所有记录与配置。执行前请务必完成云端同步。
        </p>
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

    <!-- Safety Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showConfirmModal"
        class="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8"
        @click.self="showConfirmModal = false">
        <div class="bg-white w-full max-w-sm rounded-[48px] p-10 shadow-2xl text-center">
          <div
            class="w-24 h-24 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center text-4xl mx-auto mb-8 shadow-xl shadow-rose-100">
            <i class="fa-solid fa-triangle-exclamation animate-pulse"></i>
          </div>
          <h3 class="text-2xl font-black text-gray-900 mb-3">确定执行核心重置？</h3>
          <p class="text-xs text-gray-400 mb-10 px-4 leading-relaxed font-bold uppercase tracking-tighter">
            对应数据将<span class="text-rose-500">永久销毁</span>，这是不可撤销的操作。
          </p>

          <div class="flex flex-col gap-4">
            <button @click="processAtomicReset"
              class="w-full py-5 bg-rose-500 text-white rounded-[24px] font-black shadow-xl shadow-rose-200 active:scale-95 transition-all text-sm">
              是的，确认永久删除
            </button>
            <button @click="showConfirmModal = false"
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
const lastSyncSuccess = ref(window.localStorage.getItem('github_last_sync_time') || '从未')
const autoArchiveEnabled = ref(false)

const showExportModal = ref(false)
const showConfirmModal = ref(false)
const resetType = ref('') // 'app' or 'global'
const selectionState = ref({
  chats: true,
  moments: true,
  settings: true,
  decoration: true,
  worldbook: true,
  stickers: true,
  favorites: true,
  wallet: true,
  weibo: true,
  music: true,
  forum: true,
  shopping: true,
  lovespace: true,
  phoneinspection: true,
  calendar: true,
  backpack: true,
  avatarframe: false,
  mahjong: false,
  worldloop: false
})

// --- Computed ---
const exportOptionList = computed(() => [
  { id: 'chats', name: '角色与聊天', desc: `${Object.keys(chatStore.chats || {}).length} 个联系人及其历史`, icon: 'fa-solid fa-comments', color: 'bg-emerald-100 text-emerald-600', enabled: selectionState.value.chats },
  { id: 'moments', name: '朋友圈动态', desc: `${(momentsStore.moments || []).length} 条朋友圈及评论`, icon: 'fa-solid fa-camera-retro', color: 'bg-orange-100 text-orange-600', enabled: selectionState.value.moments },
  { id: 'settings', name: '系统核心配置', desc: 'API设置、音量、天气、绘图及字体参数', icon: 'fa-solid fa-screwdriver-wrench', color: 'bg-blue-100 text-blue-600', enabled: selectionState.value.settings },
  { id: 'decoration', name: '美化与自定义', desc: '壁纸、图标、全局CSS与主题', icon: 'fa-solid fa-wand-magic-sparkles', color: 'bg-purple-100 text-purple-600', enabled: selectionState.value.decoration },
  { id: 'worldbook', name: '世界书设定', desc: `${worldBookStore.books?.length || 0} 个词库词条`, icon: 'fa-solid fa-book-sparkles', color: 'bg-indigo-100 text-indigo-600', enabled: selectionState.value.worldbook },
  { id: 'stickers', name: '表情包图库', desc: `${stickerStore.stickers?.length || 0} 个收藏表情资源`, icon: 'fa-solid fa-face-laugh-squint', color: 'bg-amber-100 text-amber-600', enabled: selectionState.value.stickers },
  { id: 'favorites', name: '我的收藏', desc: `${(chatStore.favorites || []).length} 条收藏内容`, icon: 'fa-solid fa-star', color: 'bg-yellow-100 text-yellow-600', enabled: selectionState.value.favorites },
  { id: 'wallet', name: '钱包资产', desc: '零钱余额、银行卡与亲情卡记录', icon: 'fa-solid fa-wallet', color: 'bg-red-100 text-red-600', enabled: selectionState.value.wallet },
  { id: 'weibo', name: '微博数据', desc: '微博账号、博文与私信记录', icon: 'fa-solid fa-share-nodes', color: 'bg-rose-100 text-rose-600', enabled: selectionState.value.weibo },
  { id: 'music', name: '音乐记录', desc: '播放列表与听歌状态', icon: 'fa-solid fa-music', color: 'bg-cyan-100 text-cyan-600', enabled: selectionState.value.music },
  { id: 'forum', name: '论坛数据', desc: '社区帖子、评论与点赞', icon: 'fa-solid fa-comments-dollar', color: 'bg-teal-100 text-teal-600', enabled: selectionState.value.forum },
  { id: 'shopping', name: '购物数据', desc: '订单、购物车、地址与优惠券', icon: 'fa-solid fa-cart-shopping', color: 'bg-lime-100 text-lime-600', enabled: selectionState.value.shopping },
  { id: 'lovespace', name: '情侣空间', desc: '日记、情书、相册与纪念日', icon: 'fa-solid fa-heart', color: 'bg-pink-100 text-pink-600', enabled: selectionState.value.lovespace },
  { id: 'phoneinspection', name: '查手机数据', desc: '壁纸库与相框数据', icon: 'fa-solid fa-mobile-screen-button', color: 'bg-violet-100 text-violet-600', enabled: selectionState.value.phoneinspection },
  { id: 'calendar', name: '日历日程', desc: '日程安排与事件记录', icon: 'fa-solid fa-calendar-days', color: 'bg-sky-100 text-sky-600', enabled: selectionState.value.calendar },
  { id: 'backpack', name: '背包物品', desc: '收集的道具与物品', icon: 'fa-solid fa-backpack', color: 'bg-orange-100 text-orange-700', enabled: selectionState.value.backpack },
  { id: 'avatarframe', name: '头像框', desc: '自定义头像框配置', icon: 'fa-solid fa-border-all', color: 'bg-fuchsia-100 text-fuchsia-600', enabled: selectionState.value.avatarframe },
  { id: 'mahjong', name: '麻将战绩', desc: '豆子、积分与胜负记录', icon: 'fa-solid fa-dice', color: 'bg-stone-100 text-stone-600', enabled: selectionState.value.mahjong },
  { id: 'worldloop', name: '世界循环', desc: '世界循环存档数据', icon: 'fa-solid fa-rotate', color: 'bg-zinc-100 text-zinc-600', enabled: selectionState.value.worldloop }
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

async function handleConfirmExport() {
  isPushing.value = true
  chatStore.triggerToast('🚀 正在打包全系统资产...', 'info')

  try {
    // ============================================================
    // NUCLEAR OPTION: Aggressively clean ALL data before serialization
    // This prevents "Invalid string length" at all costs
    // ============================================================

    const cleanLargeBase64 = (str, label = '') => {
        if (!str || typeof str !== 'string') return str
        // Remove any base64 image data longer than 5KB
        return str.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{5000,}/g, '[image cleaned for export]')
    }

    const cleanObject = (obj, path = '') => {
        if (!obj || typeof obj !== 'object') return obj

        if (Array.isArray(obj)) {
            return obj.map((item, idx) => cleanObject(item, path + '[' + idx + ']'))
        }

        const cleaned = {}
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
            const value = obj[key]
            const currentPath = path + '.' + key

            if (typeof value === 'string') {
                // Clean large strings (>10KB) that look like base64
                if (value.length > 10000 && (value.includes('data:image') || value.startsWith('data:'))) {
                    console.log('[Backup] Cleaning large string at', currentPath, ':', Math.round(value.length / 1024), 'KB')
                    cleaned[key] = cleanLargeBase64(value, currentPath)
                } else if (value.length > 50000) {
                    // For very long strings that might contain embedded images
                    cleaned[key] = cleanLargeBase64(value, currentPath)
                } else {
                    cleaned[key] = value
                }
            } else if (typeof value === 'object' && value !== null) {
                cleaned[key] = cleanObject(value, currentPath)
            } else {
                cleaned[key] = value
            }
        }

        return cleaned
    }

    // Collect and DEEP CLEAN all data
    let chatsData = JSON.parse(JSON.stringify(chatStore.chats || {}))
    chatsData = cleanObject(chatsData, 'chats')

    // ============================================================
    // EXTRA: Aggressively compress chat messages for export
    // This reduces message content size to prevent "Invalid string length"
    // ============================================================
    const MAX_MSG_LENGTH = 3000  // Max characters per message
    const MAX_MSGS_PER_CHAT = 1000  // Max messages per chat (keep recent)

    let totalMsgsBefore = 0
    let totalMsgsAfter = 0
    let truncatedCount = 0

    for (const chatId in chatsData) {
        const chat = chatsData[chatId]
        if (!chat || !chat.msgs || !Array.isArray(chat.msgs)) continue

        totalMsgsBefore += chat.msgs.length

        // 1. Limit number of messages (keep most recent)
        if (chat.msgs.length > MAX_MSGS_PER_CHAT) {
            const removed = chat.msgs.length - MAX_MSGS_PER_CHAT
            console.log('[Backup] Truncating chat', chatId, ': removing', removed, 'old messages')
            chat.msgs = chat.msgs.slice(-MAX_MSGS_PER_CHAT)
        }

        // 2. Truncate long message contents
        chat.msgs.forEach((msg, idx) => {
            if (msg.content && typeof msg.content === 'string' && msg.content.length > MAX_MSG_LENGTH) {
                const originalLength = msg.content.length
                msg.content = msg.content.substring(0, MAX_MSG_LENGTH) + '\n...[内容已截断以减小文件大小]'
                truncatedCount++
                if (truncatedCount <= 5) {  // Only log first 5
                    console.log('[Backup] Truncated msg', idx, ':', Math.round(originalLength / 1024), 'KB →', Math.round(msg.content.length / 1024), 'KB')
                }
            }

            // Remove raw HTML/CSS from card content (can be very large)
            if (msg.rawHtml && typeof msg.rawHtml === 'string') {
                delete msg.rawHtml
            }
            if (msg.rawContent && typeof msg.rawContent === 'string' && msg.rawContent.length > 5000) {
                delete msg.rawContent
            }
        })

        totalMsgsAfter += chat.msgs.length
    }

    if (truncatedCount > 0 || totalMsgsBefore !== totalMsgsAfter) {
        console.log('[Backup] Message compression:', totalMsgsBefore, '→', totalMsgsAfter, 'msgs,', truncatedCount, 'truncated')
        chatStore.triggerToast('⚠️ 已压缩聊天记录 (' + totalMsgsAfter + '条消息)', 'info')
    }

    let momentsData = JSON.parse(JSON.stringify(momentsStore.moments || []))
    momentsData = cleanObject(momentsData, 'moments')

    let momentsTopData = JSON.parse(JSON.stringify(momentsStore.topMoments || []))
    momentsTopData = cleanObject(momentsTopData, 'momentsTop')

    let momentsNotifData = JSON.parse(JSON.stringify(momentsStore.notifications || []))
    momentsNotifData = cleanObject(momentsNotifData, 'momentsNotifications')

    let worldbookData = JSON.parse(JSON.stringify(worldBookStore.books || []))
    worldbookData = cleanObject(worldbookData, 'worldbook')

    let stickersData = JSON.parse(JSON.stringify(stickerStore.stickers || []))
    stickersData = cleanObject(stickersData, 'stickers')

    let favoritesData = JSON.parse(JSON.stringify(chatStore.favorites || []))
    favoritesData = cleanObject(favoritesData, 'favorites')

    const injectedData = {
        chats: chatsData,
        moments: momentsData,
        momentsTop: momentsTopData,
        momentsNotifications: momentsNotifData,
        worldbook: worldbookData,
        stickers: stickersData,
        favorites: favoritesData
    }

    // Pass injectedData to exportFullData
    const backupData = await settingsStore.exportFullData(selectionState.value, injectedData)

    // Use compact JSON (no indentation) to reduce string length by ~50%
    let jsonString
    try {
        jsonString = JSON.stringify(backupData)
    } catch (stringifyErr) {
        console.error('[Backup] JSON.stringify failed:', stringifyErr)

        // LAST RESORT: Try to serialize without problematic fields
        try {
            // Remove all avatar/image fields entirely
            const safeBackup = JSON.parse(JSON.stringify(backupData))
            const removeImages = (obj) => {
                if (!obj || typeof obj !== 'object') return obj
                if (Array.isArray(obj)) return obj.map(removeImages)
                for (const key in obj) {
                    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
                    const val = obj[key]
                    if (typeof val === 'string' && (val.includes('data:image') || val.length > 50000)) {
                        delete obj[key]
                    } else if (typeof val === 'object' && val !== null) {
                        removeImages(val)
                    }
                }
                return obj
            }
            removeImages(safeBackup)
            jsonString = JSON.stringify(safeBackup)
            chatStore.triggerToast('⚠️ 已移除所有大文件以完成导出', 'info')
        } catch (finalErr) {
            throw new Error('数据量过大，无法导出。请先在"存储空间"中压缩图片或减少聊天记录')
        }
    }

    // Safety check: verify string length is reasonable (< 50MB)
    if (jsonString.length > 50 * 1024 * 1024) {
      throw new Error('数据包过大 (' + Math.round(jsonString.length / 1024 / 1024) + 'MB)，请减少选择的数据项')
    }

    const backupBlob = new window.Blob([jsonString], { type: 'application/json' })
    const downloadUrl = window.URL.createObjectURL(backupBlob)
    const anchor = window.document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = `Chilly_Full_Migration_${new Date().toISOString().split('T')[0]}.json`
    window.document.body.appendChild(anchor)
    anchor.click()
    window.document.body.removeChild(anchor)
    window.URL.revokeObjectURL(downloadUrl)

    showExportModal.value = false
    chatStore.triggerToast('✅ 迁移数据包生成完成 (' + Math.round(jsonString.length / 1024 / 1024) + ' MB)', 'success')
  } catch (err) {
    chatStore.triggerToast('导出失败: ' + err.message, 'error')
    console.error('[Backup] Export failed:', err)
  } finally {
    isPushing.value = false
  }
}

// --- Lifecycle & Persistence ---
onMounted(async () => {
  // Ensure data is loaded
  await worldBookStore.loadEntries()
  settingsStore.loadFromStorage()
  
  // DEBUG: Check if store methods are exposed
  console.log('[BackupSettings] Checking settingsStore exports:', Object.keys(settingsStore))
  if (typeof settingsStore.exportFullData !== 'function') {
    console.error('[BackupSettings] CRITICAL: exportFullData is MISSING from store!')
  } else {
    console.log('[BackupSettings] Verified: exportFullData is available.')
  }

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
  const savedInterval = window.localStorage.getItem('auto_sync_interval')
  if (savedInterval) syncInterval.value = parseInt(savedInterval) || 30

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

watch(syncInterval, (newVal) => {
  window.localStorage.setItem('auto_sync_interval', newVal.toString())
  if (autoSync.value) {
    stopAutoSync()
    runAutoSync()
  }
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
    uploadProgress.value = 20
    chatStore.triggerToast('正在聚合系统数据...', 'info')

    const allSelected = {}
    Object.keys(selectionState.value).forEach(k => { allSelected[k] = true })

    // CRITICAL: Clean oversized base64 avatars before JSON serialization
    // This prevents "Invalid string length" error during cloud backup
    let chatsData = JSON.parse(JSON.stringify(chatStore.chats || {}))

    if (chatsData && typeof chatsData === 'object') {
        let cleanedCount = 0

        for (const chatId in chatsData) {
            const chat = chatsData[chatId]
            if (!chat) continue

            // Clean character avatar (base64 image > 10KB)
            if (chat.avatar && typeof chat.avatar === 'string' && chat.avatar.length > 10000) {
                if (chat.avatar.startsWith('data:image')) {
                    console.log('[CloudBackup] Removing large avatar for chat', chatId, ':', Math.round(chat.avatar.length / 1024), 'KB')
                    chat.avatar = ''
                    cleanedCount++
                }
            }

            // Clean userAvatar in metadata (> 10KB)
            if (chat.userAvatar && typeof chat.userAvatar === 'string' && chat.userAvatar.length > 10000) {
                if (chat.userAvatar.startsWith('data:image')) {
                    console.log('[CloudBackup] Removing large userAvatar for chat', chatId)
                    chat.userAvatar = ''
                    cleanedCount++
                }
            }
        }

        if (cleanedCount > 0) {
            console.log('[CloudBackup] Cleaned', cleanedCount, 'large avatars for cloud backup')
        }
    }

    const injectedData = {
        chats: chatsData,
        moments: JSON.parse(JSON.stringify(momentsStore.moments || [])),
        momentsTop: JSON.parse(JSON.stringify(momentsStore.topMoments || [])),
        momentsNotifications: JSON.parse(JSON.stringify(momentsStore.notifications || [])),
        worldbook: JSON.parse(JSON.stringify(worldBookStore.books || [])),
        stickers: JSON.parse(JSON.stringify(stickerStore.stickers || [])),
        favorites: JSON.parse(JSON.stringify(chatStore.favorites || []))
    }

    const backupData = await settingsStore.exportFullData(allSelected, injectedData)

    // Safety check: verify data size before upload
    const dataStr = JSON.stringify(backupData)
    if (dataStr.length > 50 * 1024 * 1024) {  // > 50MB warning
        console.warn('[CloudBackup] Large backup size:', Math.round(dataStr.length / 1024 / 1024), 'MB')
        chatStore.triggerToast('⚠️ 数据包较大 (' + Math.round(dataStr.length / 1024 / 1024) + 'MB)，上传可能较慢', 'info')
    }

    uploadProgress.value = 50
    const backupService = new GitHubBackup(githubConfig.value)

    await backupService.uploadFull(backupData)
    
    uploadProgress.value = 100
    const timeStr = new Date().toLocaleString()
    lastSyncSuccess.value = timeStr
    window.localStorage.setItem('github_last_sync_time', timeStr)
    
    chatStore.triggerToast('✅ 全量同步成功', 'success')
    setTimeout(() => { uploadProgress.value = 0 }, 1500)
  } catch (err) {
    chatStore.triggerToast('云端备份失败: ' + err.message, 'error')
  } finally { isPushing.value = false }
}

async function handlePullFromCloud() {
  const validation = GitHubBackup.validateConfig(githubConfig.value)
  if (!validation.valid) return chatStore.triggerToast(validation.error, 'error')

  isPulling.value = true
  try {
    chatStore.triggerToast('正在自云端拉取全量包...', 'info')
    const backupService = new GitHubBackup(githubConfig.value)
    const remoteData = await backupService.downloadFull()
    
    if (remoteData) {
      const success = await settingsStore.importFullData(remoteData)
      if (success) {
        chatStore.triggerToast('✅ 数据恢复成功，正在重启', 'success')
      } else {
        throw new Error('导入引擎处理失败')
      }
    }
  } catch (err) {
    chatStore.triggerToast('云端恢复失败: ' + err.message, 'error')
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
      chatStore.triggerToast('数据包加载成功', 'success')
    } catch (err) {
      chatStore.triggerToast('解析失败: ' + err.message, 'error')
      selectedImportFile.value = null
    }
  }
  reader.readAsText(file)
}

async function handleFileImport() {
  if (!selectedImportData.value) return
  try {
    const success = await settingsStore.importFullData(selectedImportData.value)
    if (success) {
      chatStore.triggerToast('🚀 系统还原完成，热重启中...', 'success')
    } else {
      chatStore.triggerToast('还原失败：未找到有效数据负载', 'error')
    }
  } catch (err) {
    chatStore.triggerToast('致命错误: ' + err.message, 'error')
  }
}

// --- Atomic Reset Logic ---
const initResetApp = () => {
  resetType.value = 'app'
  showConfirmModal.value = true
}

const initPurgeAll = () => {
  resetType.value = 'global'
  showConfirmModal.value = true
}

const processAtomicReset = () => {
  showConfirmModal.value = false
  if (resetType.value === 'app') {
    settingsStore.resetAppData({
      settings: false,
      wechat: true,
      wallet: true
    })
    chatStore.triggerToast('应用数据已重置完成', 'success')
  } else {
    settingsStore.resetGlobalData()
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
