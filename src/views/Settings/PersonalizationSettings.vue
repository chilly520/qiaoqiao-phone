<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'
import { storeToRefs } from 'pinia'
import ManualIconCropper from '../../components/ManualIconCropper.vue'

const router = useRouter()
const store = useSettingsStore()
const chatStore = useChatStore()
const { personalization } = storeToRefs(store)

// Cropper State
const showCropper = ref(false)
const cropperImage = ref('')

const goBack = () => {
    router.back()
}

// --- Local State for Inputs (to support "Apply" pattern) ---
const wallpaperInput = ref('')
const iconInput = ref('')
const selectedApp = ref('wechat')
const widget1Input = ref('')
const widget2Input = ref('')
const timeBgInput = ref('')
const locBgInput = ref('')
const weatherBgInput = ref('')
const globalBgInput = ref('')
const fontUrlInput = ref('')
const presetName = ref('')
const selectedPreset = ref('')

// --- Toast ---
// Note: We use chatStore.triggerToast internally now, but keeping this for local feedback consistency
const showToast = ref(false)
const toastMessage = ref('')
const showToastMsg = (msg) => {
    chatStore.triggerToast(msg, 'info')
}

// --- Helpers ---
const handleFileUpload = (event, callback) => {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
        callback(e.target.result)
    }
    reader.readAsDataURL(file)
    // Reset input
    event.target.value = ''
}

// --- Actions : Wallpaper ---
const applyWallpaper = () => {
    if (!wallpaperInput.value) return
    store.setWallpaper(wallpaperInput.value)
    showToastMsg('壁纸已应用')
}
const onWallpaperUpload = (e) => handleFileUpload(e, (url) => {
    store.setWallpaper(url)
    showToastMsg('壁纸已上传')
})
const clearWallpaper = () => {
    store.setWallpaper('')
    showToastMsg('壁纸已清除')
}

// --- Actions : Icons ---
const currentIconUrl = computed(() => {
    return personalization.value.icons.map[selectedApp.value] || ''
})

const applyIcon = () => {
    if (!iconInput.value) return
    store.setIcon(selectedApp.value, iconInput.value)
    showToastMsg('图标已应用')
}

const onIconUpload = (e) => handleFileUpload(e, (url) => {
    cropperImage.value = url
    showCropper.value = true
})

const onCropperConfirm = (croppedDataUrl) => {
    store.setIcon(selectedApp.value, croppedDataUrl)
    showToastMsg('图标已裁剪并应用')
    showCropper.value = false
}

const clearIcon = () => {
    store.clearIcon(selectedApp.value)
    showToastMsg('图标已恢复默认')
}

// --- Actions : Widgets ---
const applyWidget = (id, val) => {
    if (!val) return
    store.setWidget(id, val)
    showToastMsg('组件图片已应用')
}
const onWidgetUpload = (e, id) => handleFileUpload(e, (url) => {
    store.setWidget(id, url)
    showToastMsg('组件图片已上传')
})
const clearWidget = (id) => {
    store.setWidget(id, '')
    showToastMsg('组件图片已清除')
}

// --- Actions : Card Backgrounds ---
const applyCardBg = (type, val) => {
    if (!val) return
    store.setCardBg(type, val)
    showToastMsg('卡片背景已应用')
}
const onCardBgUpload = (e, type) => handleFileUpload(e, (url) => {
    store.setCardBg(type, url)
    showToastMsg('卡片背景已上传')
})
const clearCardBg = (type) => {
    store.setCardBg(type, '')
    showToastMsg('卡片背景已清除')
}

// --- Actions : Global Bg ---
const applyGlobalBg = () => {
    if (!globalBgInput.value) return
    store.setGlobalBg(globalBgInput.value)
    showToastMsg('全局背景已应用')
}
const onGlobalBgUpload = (e) => handleFileUpload(e, (url) => {
    store.setGlobalBg(url)
    showToastMsg('全局背景已上传')
})
const clearGlobalBg = () => {
    store.setGlobalBg('')
    showToastMsg('全局背景已清除')
}

// --- Actions : Fonts ---
const applyFontUrl = () => {
    if (!fontUrlInput.value) return
    store.setGlobalFont({ url: fontUrlInput.value })
    showToastMsg('字体URL已应用')
}
const resetFont = () => {
    store.setGlobalFont({
        color: personalization.value.theme === 'dark' ? '#cbd5e1' : '#166534',
        shadow: personalization.value.theme === 'dark' ? '0 1px 2px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
        url: ''
    })
    showToastMsg('字体设置已重置')
}

// --- Actions : CSS ---
const saveCss = () => {
    store.setCustomCss(personalization.value.customCss)
    showToastMsg('自定义CSS已保存')
}
const clearCss = () => {
    store.setCustomCss('')
    personalization.value.customCss = ''
    showToastMsg('自定义CSS已清空')
}

// --- Actions : Presets ---
const savePreset = () => {
    if (!presetName.value) {
        showToastMsg('请输入预设名称')
        return
    }
    store.savePreset(presetName.value)
    showToastMsg('预设已保存')
}
const loadPreset = () => {
    if (!selectedPreset.value) return
    const success = store.loadPreset(selectedPreset.value)
    if (success) showToastMsg('预设已加载')
}
const deletePreset = () => {
    if (!selectedPreset.value) return
    chatStore.triggerConfirm('删除预设', '确定删除该预设吗?', () => {
        const success = store.deletePreset(selectedPreset.value)
        if (success) {
            selectedPreset.value = ''
            showToastMsg('预设已删除')
        }
    })
}
const resetAll = () => {
    chatStore.triggerConfirm('重置设置', '确定重置所有个性化设置吗? (预设不会被删除)', () => {
        store.resetAllPersonalization()
        showToastMsg('已重置所有设置')
    })
}

</script>

<template>
    <div class="personalization-settings w-full h-full flex flex-col transition-colors duration-300"
        :class="personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-50'">

        <!-- Header -->
        <div class="h-[56px] flex items-center justify-between px-4 border-b transition-colors"
            :class="personalization.theme === 'dark' ? 'bg-[#0f172a] border-white/5' : 'bg-white border-gray-100'">
            <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
                <i class="fa-solid fa-chevron-left text-lg"
                    :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'"></i>
                <span class="font-bold text-xl"
                    :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">个性化</span>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-6">

            <!-- 🎨 主题选择器 -->
            <div class="p-6 rounded-[24px] shadow-sm transition-colors border"
                :class="personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-gray-100'">
                <h3 class="text-base font-bold mb-3 flex items-center gap-2"
                    :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
                    <i class="fa-solid fa-palette text-purple-500"></i>
                    整体风格主题
                </h3>
                <p class="text-xs mb-4" :class="personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">
                    选择一个预设主题，一键切换整个应用的视觉风格</p>

                <div class="grid grid-cols-4 gap-3">
                    <!-- 默认主题 -->
                    <div @click="store.setTheme('default')"
                        class="relative p-3 rounded-2xl cursor-pointer transition-all border-2 flex flex-col items-center"
                        :class="personalization.theme === 'default' ? 'border-blue-500 bg-blue-50 shadow-md' : (personalization.theme === 'dark' ? 'border-white/10 hover:border-blue-500/50' : 'border-gray-100 bg-white hover:border-blue-300')">
                        <div
                            class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 mb-2 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-mobile-screen text-gray-600 text-xl"></i>
                        </div>
                        <div class="text-[11px] font-bold"
                            :class="personalization.theme === 'dark' ? 'text-gray-200' : 'text-gray-800'">默认</div>
                    </div>

                    <!-- 软萌主题 -->
                    <div @click="store.setTheme('kawaii')"
                        class="relative p-3 rounded-2xl cursor-pointer transition-all border-2 flex flex-col items-center"
                        :class="personalization.theme === 'kawaii' ? 'border-pink-400 bg-pink-50 shadow-md' : (personalization.theme === 'dark' ? 'border-white/10 hover:border-pink-500/50' : 'border-gray-100 bg-white hover:border-pink-300')">
                        <div
                            class="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 mb-2 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-heart text-pink-500 text-xl"></i>
                        </div>
                        <div class="text-[11px] font-bold"
                            :class="personalization.theme === 'dark' ? 'text-pink-100' : 'text-gray-800'">软萌</div>
                    </div>

                    <!-- 商务主题 -->
                    <div @click="store.setTheme('business')"
                        class="relative p-3 rounded-2xl cursor-pointer transition-all border-2 flex flex-col items-center"
                        :class="personalization.theme === 'business' ? 'border-slate-500 bg-slate-50 shadow-md' : (personalization.theme === 'dark' ? 'border-white/10 hover:border-blue-300/30' : 'border-gray-100 bg-white hover:border-slate-300')">
                        <div
                            class="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 mb-2 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-briefcase text-slate-600 text-xl"></i>
                        </div>
                        <div class="text-[11px] font-bold"
                            :class="personalization.theme === 'dark' ? 'text-slate-200' : 'text-gray-800'">商务</div>
                    </div>

                    <!-- 夜间模式 -->
                    <div @click="store.setTheme('dark')"
                        class="relative p-3 rounded-2xl cursor-pointer transition-all border-2 flex flex-col items-center"
                        :class="personalization.theme === 'dark' ? 'border-indigo-500 bg-indigo-950 shadow-md' : 'border-gray-100 bg-white hover:border-indigo-300'">
                        <div
                            class="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-indigo-900 mb-2 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-moon text-indigo-300 text-xl"></i>
                        </div>
                        <div class="text-[11px] font-bold"
                            :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">夜间</div>
                    </div>
                </div>
            </div>

            <!-- Wallpaper -->
            <div class="p-6 rounded-[24px] shadow-sm transition-colors border"
                :class="personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-gray-100'">
                <h3 class="text-base font-bold mb-3 flex items-center justify-between"
                    :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
                    <span>壁纸</span>
                    <button @click="clearWallpaper"
                        class="text-xs font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded-lg">清除</button>
                </h3>
                <div class="w-full h-40 bg-gray-100 rounded-2xl mb-4 overflow-hidden border transition-colors shadow-inner"
                    :class="personalization.theme === 'dark' ? 'bg-black/20 border-white/10' : 'border-gray-100'">
                    <div v-if="!personalization.wallpaper"
                        class="w-full h-full flex items-center justify-center text-gray-400 text-xs font-mono">NO
                        WALLPAPER</div>
                    <img v-else :src="personalization.wallpaper" class="w-full h-full object-cover">
                </div>

                <div class="space-y-3">
                    <div class="flex gap-2">
                        <input v-model="wallpaperInput" type="text" placeholder="输入壁纸 URL..."
                            class="flex-1 bg-transparent px-4 py-2 text-sm rounded-xl border outline-none focus:border-blue-500 transition-all font-mono"
                            :class="personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'">
                        <button @click="applyWallpaper"
                            class="bg-blue-500 text-white px-4 rounded-xl active:scale-95 transition-transform"><i
                                class="fa-solid fa-check"></i></button>
                    </div>

                    <div class="relative w-full">
                        <button
                            class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all">
                            <i class="fa-solid fa-upload mr-2"></i>上传本地壁纸
                        </button>
                        <input type="file" @change="onWallpaperUpload" accept="image/*"
                            class="absolute inset-0 opacity-0 cursor-pointer">
                    </div>

                    <!-- 夜间模式遮罩透明度 -->
                    <div class="pt-4 border-t transition-colors"
                        :class="personalization.theme === 'dark' ? 'border-white/5' : 'border-gray-50'">
                        <div class="flex items-center justify-between mb-2">
                            <label class="text-[11px] font-bold uppercase tracking-widest"
                                :class="personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">夜间模式暗化透明度</label>
                            <span class="text-xs font-mono font-bold"
                                :class="personalization.theme === 'dark' ? 'text-blue-400' : 'text-blue-600'">{{
                                    Math.round(personalization.wallpaperOverlayOpacity * 100) }}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.1"
                            v-model.number="personalization.wallpaperOverlayOpacity" @change="store.saveToStorage()"
                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            :class="personalization.theme === 'dark' ? 'bg-white/10' : ''">
                    </div>
                </div>
            </div>

            <!-- Icons -->
            <div class="p-6 rounded-[24px] shadow-sm transition-colors border"
                :class="personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-gray-100'">
                <h3 class="text-base font-bold mb-4 flex items-center justify-between"
                    :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
                    <span>图标定制</span>
                    <button @click="clearIcon"
                        class="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors">恢复默认</button>
                </h3>

                <div class="flex gap-4 items-center mb-6">
                    <div class="w-20 h-20 rounded-2xl shadow-xl border flex items-center justify-center shrink-0 overflow-hidden relative group transition-all"
                        :class="personalization.theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-white border-gray-100'">
                        <img v-if="currentIconUrl" :src="currentIconUrl" class="w-full h-full object-cover">
                        <i v-else class="fa-solid fa-image text-gray-300 text-2xl"></i>
                        <div
                            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <i class="fa-solid fa-camera text-white"></i>
                            <input type="file" @change="onIconUpload" accept="image/*"
                                class="absolute inset-0 opacity-0 cursor-pointer">
                        </div>
                    </div>

                    <div class="flex-1 space-y-3">
                        <div class="relative">
                            <select v-model="selectedApp"
                                class="w-full appearance-none px-4 py-2.5 rounded-xl border outline-none font-bold text-sm bg-transparent"
                                :class="personalization.theme === 'dark' ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'">
                                <option value="wechat">微信 (WeChat)</option>
                                <option value="worldbook">世界书 (World Book)</option>
                                <option value="search">查手机 (Mobile Check)</option>
                                <option value="weibo">微博 (Weibo)</option>
                                <option value="settings">设置 (Settings)</option>
                                <option value="couple">情侣空间 (Love Zone)</option>
                                <option value="games">小游戏 (Games)</option>
                            </select>
                            <i
                                class="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-xs opacity-30 pointer-events-none"></i>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2">
                    <input v-model="iconInput" type="text" placeholder="图标图片 URL..."
                        class="flex-1 bg-transparent px-4 py-2.5 text-xs rounded-xl border outline-none focus:border-indigo-500 transition-all font-mono"
                        :class="personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'">
                    <button @click="applyIcon"
                        class="bg-indigo-500 text-white px-5 rounded-xl active:scale-95 transition-transform font-bold text-xs">应用</button>
                </div>
            </div>

            <!-- Presets -->
            <div class="p-6 rounded-[24px] shadow-sm transition-colors border"
                :class="personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-gray-100'">
                <h3 class="text-base font-bold mb-4 flex items-center gap-2"
                    :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
                    <i class="fa-solid fa-floppy-disk text-blue-500"></i>
                    预设管理 / PERSISTENCE
                </h3>

                <div class="space-y-4">
                    <div class="flex gap-2">
                        <input v-model="presetName" type="text" placeholder="给你的搭配起个名字..."
                            class="flex-1 bg-transparent px-4 py-3 text-sm rounded-xl border outline-none focus:border-green-500 transition-all"
                            :class="personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200'">
                        <button @click="savePreset"
                            class="bg-green-500 text-white px-6 rounded-xl font-bold text-sm active:scale-95 transition-transform">保存</button>
                    </div>

                    <div class="flex gap-2">
                        <select v-model="selectedPreset"
                            class="flex-1 bg-transparent px-4 py-3 text-sm rounded-xl border outline-none font-bold"
                            :class="personalization.theme === 'dark' ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'">
                            <option value="">-- 选择已保存的预设 --</option>
                            <option v-for="p in personalization.presets" :key="p.name" :value="p.name">{{ p.name }}
                            </option>
                        </select>
                        <button @click="loadPreset"
                            class="bg-blue-600 text-white px-5 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
                            :disabled="!selectedPreset">应用</button>
                        <button @click="deletePreset"
                            class="bg-red-500/10 text-red-500 px-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                            :disabled="!selectedPreset">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>

                    <button @click="resetAll"
                        class="w-full py-3.5 border-2 border-dashed rounded-2xl font-bold text-sm transition-all active:scale-98"
                        :class="personalization.theme === 'dark' ? 'border-red-900/50 text-red-500 bg-red-950/20 hover:bg-red-950/40' : 'border-red-100 text-red-600 bg-red-50 hover:bg-red-100/50'">
                        <i class="fa-solid fa-triangle-exclamation mr-2"></i>重置所有个性化面板
                    </button>
                </div>
            </div>

            <!-- Custom CSS -->
            <div class="p-6 rounded-[24px] shadow-sm transition-colors border"
                :class="personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-gray-100'">
                <h3 class="text-base font-bold mb-4 flex items-center gap-2"
                    :class="personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
                    <i class="fa-solid fa-code text-blue-400"></i>
                    核心注入 / CUSTOM CSS
                </h3>
                <div class="relative group">
                    <textarea v-model="personalization.customCss" placeholder="/* 加入你的自定义样式... */"
                        class="w-full h-40 bg-transparent rounded-2xl border p-4 text-xs font-mono resize-none outline-none focus:ring-2 focus:ring-blue-500/20 transition-all custom-scrollbar"
                        :class="personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-blue-300 placeholder-gray-700' : 'bg-gray-50 border-gray-100 text-gray-700'"></textarea>
                    <div class="absolute right-3 bottom-3 flex gap-2">
                        <button @click="clearCss" class="p-2 transition-colors text-gray-500 hover:text-red-500">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                        <button @click="saveCss"
                            class="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-transform">
                            SAVE & INJECT
                        </button>
                    </div>
                </div>
            </div>

        </div>

        <!-- Cropper -->
        <ManualIconCropper :is-open="showCropper" :image-url="cropperImage" @close="showCropper = false"
            @confirm="onCropperConfirm" />

    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(155, 155, 155, 0.2);
    border-radius: 10px;
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border: 4px solid white;
}

.personalization-settings :deep(option) {
    background-color: white;
    color: black;
}

.personalization-settings.dark :deep(option) {
    background-color: #1e293b;
    color: white;
}
</style>
