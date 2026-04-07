<template>
    <div class="settings-app flex flex-col h-full bg-[#FAFAFA]">
        <!-- Header -->
        <div
            class="app-header px-4 pt-16 pb-3 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm">
            <button @click="$emit('back')" class="text-xl text-[#8F5E6E]">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="font-bold text-[18px] text-[#8F5E6E]">系统设置</span>
            <div class="w-8"></div>
        </div>

        <!-- Settings Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
            <!-- Section: Wallpaper -->
            <section class="settings-section">
                <h3 class="flex items-center text-[#8F5E6E] font-bold mb-3 px-2">
                    <i class="fa-solid fa-image mr-2"></i> 个性化壁纸
                </h3>
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex flex-col gap-4">
                    <div class="flex items-center gap-4">
                        <div
                            class="w-24 h-36 rounded-lg bg-pink-50 overflow-hidden border-2 border-pink-100 shadow-inner">
                            <img :src="currentWallpaper.url" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1 flex flex-col gap-2">
                            <button class="setting-btn bg-pink-100 text-[#8F5E6E]" @click="triggerUpload">
                                <i class="fa-solid fa-upload mr-2"></i> 本地上传
                            </button>
                            <button class="setting-btn bg-pink-100 text-[#8F5E6E]" @click="showUrlInput = true">
                                <i class="fa-solid fa-link mr-2"></i> 网络 URL
                            </button>
                        </div>
                    </div>

                    <!-- URL Input Overlay -->
                    <div v-if="showUrlInput" class="animate-fade-in flex flex-col gap-2">
                        <input v-model="urlInput" placeholder="输入壁纸 URL..."
                            class="w-full px-4 py-3 bg-gray-50 rounded-xl border-none outline-none text-sm text-gray-600">
                        <div class="flex gap-2">
                            <button class="flex-1 py-3 bg-gray-200 text-gray-500 rounded-xl font-bold"
                                @click="showUrlInput = false">取消</button>
                            <button class="flex-1 py-3 bg-[#FC6C9C] text-white rounded-xl font-bold"
                                @click="saveWallpaperFromUrl">确定</button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section: Data Management (New!) -->
            <section class="settings-section">
                <h3 class="flex items-center text-[#8F5E6E] font-bold mb-3 px-2">
                    <i class="fa-solid fa-trash-can mr-2"></i> 隐私与数据
                </h3>
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                    <div class="flex flex-col gap-4">
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-black text-gray-700">清除应用数据</span>
                            <button class="text-[11px] font-bold text-pink-400 bg-pink-50 px-3 py-1.5 rounded-full"
                                @click="handleClearAll">全部重置</button>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-2">
                            <div v-for="app in selectableApps" :key="app.id"
                                class="flex items-center gap-2 p-2 rounded-xl border border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                                @click="toggleAppSelection(app.id)">
                                <div class="w-4 h-4 rounded border-2 border-pink-200 flex items-center justify-center"
                                    :class="{ 'bg-[#FC6C9C] border-none': selectedApps.includes(app.id) }">
                                    <i v-if="selectedApps.includes(app.id)"
                                        class="fa-solid fa-check text-[10px] text-white"></i>
                                </div>
                                <span class="text-xs font-bold text-[#8F5E6E]">{{ app.name }}</span>
                            </div>
                        </div>
                        <button
                            class="w-full mt-4 py-3 bg-[#FC6C9C] text-white rounded-xl font-black shadow-lg shadow-pink-100 disabled:opacity-50 active:scale-95 transition-transform"
                            :disabled="selectedApps.length === 0" @click="clearSelectedData">
                            确认删除 {{ selectedApps.length > 0 ? `(${selectedApps.length})` : '' }}
                        </button>
                    </div>
                </div>
            </section>

            <!-- Section: Password (New!) -->
            <section class="settings-section">
                <h3 class="flex items-center text-[#8F5E6E] font-bold mb-3 px-2">
                    <i class="fa-solid fa-lock mr-2"></i> 手机访问码
                </h3>
                <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-black text-gray-700">启用访问码</span>
                        <div class="w-12 h-6 rounded-full bg-pink-100 relative cursor-pointer" @click="togglePassword">
                            <div class="absolute w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm"
                                :class="passwordEnabled ? 'translate-x-6' : 'translate-x-0'" style="top: 2px; left: 2px;"></div>
                        </div>
                    </div>
                    <div v-if="passwordEnabled" class="flex flex-col gap-1 pt-2 animate-fade-in">
                        <label class="text-[10px] font-black text-gray-300 uppercase tracking-widest">设置 4 位访问码 (当前: {{ currentCharCode }})</label>
                        <div class="flex gap-2">
                             <input v-model="newPassword" placeholder="输入 4 位数字..." maxlength="4"
                                class="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-black text-[#8F5E6E] outline-none border border-transparent focus:border-pink-100">
                             <button @click="updatePassword" class="px-4 py-2 bg-pink-400 text-white rounded-xl font-bold active:scale-95 transition-transform text-xs shadow-md shadow-pink-100">修改</button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section: Desktop Frames -->
            <section class="settings-section">
                <h3 class="flex items-center text-[#8F5E6E] font-bold mb-3 px-2">
                    <i class="fa-solid fa-heart mr-2"></i> 桌面相框
                </h3>
                <div class="flex flex-col gap-3">
                    <div v-for="frame in desktopFrames" :key="frame.id"
                        class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                        <div class="flex items-center gap-4">
                            <div
                                class="w-16 h-16 rounded-lg bg-gray-50 overflow-hidden border border-gray-100 flex items-center justify-center">
                                <img v-if="frame.url" :src="frame.url" class="w-full h-full object-cover">
                                <i v-else class="fa-solid fa-plus text-gray-200"></i>
                            </div>
                            <div class="flex-1 flex flex-col gap-1">
                                <span class="text-sm font-black text-gray-700">{{ frame.id === 'f1' ? '左侧相框' : '右侧相框'
                                    }}</span>
                                <span class="text-xs text-gray-400">点击上传新回忆喵~</span>
                            </div>
                            <button class="p-2 bg-pink-50 text-pink-400 rounded-lg active:scale-95"
                                @click="triggerFrameUpload(frame.id)">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section: Anniversary -->
            <section class="settings-section pb-10">
                <h3 class="flex items-center text-[#8F5E6E] font-bold mb-3 px-2">
                    <i class="fa-solid fa-calendar-heart mr-2"></i> 纪念日设置
                </h3>
                <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-black text-gray-300 uppercase tracking-widest">纪念日标题</label>
                        <input v-model="anniversaryTitle"
                            class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-black text-[#8F5E6E] outline-none border border-transparent focus:border-pink-100">
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-black text-gray-300 uppercase tracking-widest">起始日期</label>
                        <input type="date" v-model="anniversaryDate"
                            class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-black text-[#8F5E6E] outline-none">
                    </div>
                    <div class="flex flex-col gap-2 pt-2">
                        <button @click="generateAIAnniversary"
                            class="w-full py-3 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-xl font-black shadow-lg shadow-pink-100 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                            AI 智能匹配纪念描述
                        </button>
                        <button @click="saveAnniversary"
                            class="w-full py-3 bg-white text-pink-400 border border-pink-100 rounded-xl font-black active:bg-pink-50 transition-colors">
                            保存纪念日
                        </button>
                    </div>
                </div>
            </section>

            <!-- Hidden File Inputs -->
            <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload" accept="image/*">
            <input type="file" ref="frameInput" class="hidden" @change="handleFrameFileUpload" accept="image/*">
        </div>

        <!-- Custom Confirm Dialog -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showConfirmDialog"
                    class="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
                    @click.self="cancelClear">
                    <div class="bg-white rounded-2xl w-full max-w-[280px] p-6 shadow-2xl animate-pop-in text-center">
                        <div class="w-12 h-12 mx-auto mb-3 bg-pink-50 rounded-full flex items-center justify-center">
                            <i class="fa-solid fa-triangle-exclamation text-lg text-pink-400"></i>
                        </div>
                        <p class="text-sm font-bold text-gray-700 mb-1">确认清除数据</p>
                        <p class="text-xs text-gray-400 mb-5 leading-relaxed">
                            确定要清除这 {{ selectedApps.length }} 个应用的数据吗？<br>此操作不可撤销
                        </p>
                        <div class="flex gap-3">
                            <button @click="cancelClear"
                                class="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl font-black text-sm active:scale-95 transition-transform">
                                取消
                            </button>
                            <button @click="confirmClear"
                                class="flex-1 py-2.5 bg-[#FC6C9C] text-white rounded-xl font-black text-sm shadow-md shadow-pink-100 active:scale-95 transition-transform">
                                确认清除
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'

const props = defineProps({
    settingsData: Object
})

const emit = defineEmits(['back'])

const phoneStore = usePhoneInspectionStore()
const currentWallpaper = computed(() => phoneStore.currentWallpaper)
const desktopFrames = computed(() => {
    const frames = phoneStore.phoneData?.desktopFrames
    if (!frames || frames.length === 0) {
        return [
            { id: 'f1', url: null, note: '左侧相框' },
            { id: 'f2', url: null, note: '右侧相框' }
        ]
    }
    return frames
})
const anniversaryData = computed(() => phoneStore.phoneData?.anniversary || { title: '相识第', date: '2026-01-01' })

const anniversaryTitle = ref(anniversaryData.value.title)
const anniversaryDate = ref(anniversaryData.value.date)

const fileInput = ref(null)
const frameInput = ref(null)
const urlInput = ref('')
const activeFrameId = ref(null)

const newPassword = ref('')
const passwordEnabled = computed(() => phoneStore.phoneData?.password?.enabled)
const currentCharCode = computed(() => phoneStore.phoneData?.password?.code || '1234')

function togglePassword() {
    phoneStore.phoneData.password.enabled = !phoneStore.phoneData.password.enabled
    phoneStore.triggerToast(phoneStore.phoneData.password.enabled ? '访问码已启用' : '访问码已关闭')
}

function updatePassword() {
    if (newPassword.value.length !== 4 || isNaN(newPassword.value)) {
        phoneStore.triggerAlert('错误', '访问码必须为 4 位数字喵~')
        return
    }
    phoneStore.phoneData.password.code = newPassword.value
    newPassword.value = ''
    phoneStore.triggerAlert('成功', '手机访问码已更新 🔒')
}

const selectedApps = ref([])
const showConfirmDialog = ref(false)
const selectableApps = [
    { id: 'wechat', name: '微信' },
    { id: 'calls', name: '通话' },
    { id: 'messages', name: '短信' },
    { id: 'wallet', name: '钱包' },
    { id: 'shopping', name: '市集' },
    { id: 'footprints', name: '足迹' },
    { id: 'backpack', name: '背包' },
    { id: 'notes', name: '碎片' },
    { id: 'reminders', name: '备忘录' },
    { id: 'browser', name: '探索' },
    { id: 'photos', name: '画廊' },
    { id: 'music', name: '音符' },
    { id: 'calendar', name: '时光' },
    { id: 'meituan', name: '便当' },
    { id: 'forum', name: '树洞' },
    { id: 'recorder', name: '留声' },
    { id: 'email', name: '邮件' },
    { id: 'files', name: '宝库' }
]

function toggleAppSelection(id) {
    const idx = selectedApps.value.indexOf(id)
    if (idx > -1) selectedApps.value.splice(idx, 1)
    else selectedApps.value.push(id)
}

function handleClearAll() {
    selectedApps.value = selectableApps.map(a => a.id)
}

function clearSelectedData() {
    if (selectedApps.value.length === 0) return
    showConfirmDialog.value = true
}

function confirmClear() {
    phoneStore.clearAppData(selectedApps.value)
    selectedApps.value = []
    showConfirmDialog.value = false
}

function cancelClear() {
    showConfirmDialog.value = false
}

function triggerUpload() { fileInput.value.click() }
function triggerFrameUpload(id) {
    activeFrameId.value = id
    frameInput.value.click()
}

async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    await phoneStore.uploadLocalImage(file)
}

async function handleFrameFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const base64 = await readFileAsBase64(file)
    await phoneStore.setFrameImage(activeFrameId.value, base64)
}

function saveWallpaperFromUrl() {
    if (!urlInput.value) return
    phoneStore.setWallpaperFromUrl(urlInput.value)
    showUrlInput.value = false
    urlInput.value = ''
}

function saveAnniversary() {
    phoneStore.updateAnniversary({
        title: anniversaryTitle.value,
        date: anniversaryDate.value
    })
    phoneStore.triggerAlert('成功', '纪念日已永久封存喵~ 💖')
}

function generateAIAnniversary() {
    // This is a UI trigger, real logic would involve AI calling the tool
    phoneStore.triggerAlert('魔法预警', '✨ AI 正在努力分析你们的回忆... 请稍候再试 (或对我说：帮我规划纪念日)')
}

function readFileAsBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(file)
    })
}
</script>

<style scoped>
.setting-btn {
    width: 100%;
    padding: 10px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.animate-fade-in {
    animation: fade-in 0.3s ease-out;
}

@keyframes fade-in {
    from {
        opacity: 0;
        transform: translateY(-5px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.animate-pop-in { animation: pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes pop-in {
    from { opacity: 0; transform: scale(0.9) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
