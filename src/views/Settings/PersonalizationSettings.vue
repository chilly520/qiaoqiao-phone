<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { storeToRefs } from 'pinia'
import ManualIconCropper from '../../components/ManualIconCropper.vue'

const router = useRouter()
const store = useSettingsStore()
const { personalization } = storeToRefs(store)

// Cropper State
const showCropper = ref(false)
const cropperImage = ref('')

const goBack = () => {
    router.push('/settings')
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
const showToast = ref(false)
const toastMessage = ref('')
const showToastMsg = (msg) => {
    toastMessage.value = msg
    showToast.value = true
    setTimeout(() => { showToast.value = false }, 2000)
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
    if(!wallpaperInput.value) return
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
// Compute current icon preview based on selected app
const currentIconUrl = computed(() => {
    return personalization.value.icons.map[selectedApp.value] || ''
})

const applyIcon = () => {
    if(!iconInput.value) return
    store.setIcon(selectedApp.value, iconInput.value)
    showToastMsg('图标已应用')
}

// Modify: Upload -> Open Cropper
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
    if(!val) return
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
    if(!val) return
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
    if(!globalBgInput.value) return
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
// color/shadow bind directly to store via v-model in template
// url needs manual apply
const applyFontUrl = () => {
    if(!fontUrlInput.value) return
    store.setGlobalFont({ url: fontUrlInput.value })
    showToastMsg('字体URL已应用')
}
const resetFont = () => {
    store.setGlobalFont({
        color: '#166534',
        shadow: '0 2px 4px rgba(0,0,0,0.3)',
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
    store.setCustomCss('') // Update store
    personalization.value.customCss = '' // Update ref if needed (though store ref handles it)
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
    if(!selectedPreset.value) return
    const success = store.loadPreset(selectedPreset.value)
    if(success) showToastMsg('预设已加载')
}
const deletePreset = () => {
    if(!selectedPreset.value) return
    if(confirm('确定删除该预设吗?')) {
        const success = store.deletePreset(selectedPreset.value)
        if(success) {
            selectedPreset.value = ''
            showToastMsg('预设已删除')
        }
    }
}
const resetAll = () => {
    if(confirm('确定重置所有个性化设置吗? (预设不会被删除)')) {
        store.resetAllPersonalization()
        showToastMsg('已重置所有设置')
    }
}
// --- Actions : Stickers ---
const stickerCount = computed(() => stickerStore.customStickers.length)

const onStickerImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (ev) => {
        const content = ev.target.result
        const { success, duplicate } = stickerStore.importStickersFromText(content)
        if (duplicate > 0) {
            showToastMsg(`成功导入 ${success} 个，跳过 ${duplicate} 个重复项`)
        } else {
            showToastMsg(`成功导入 ${success} 个表情包`)
        }
        e.target.value = '' // reset
    }
    reader.readAsText(file)
}

const clearStickers = () => {
    if (confirm('确定清空所有自定义表情包吗？(无法撤销)')) {
        stickerStore.clearAllStickers()
        showToastMsg('已清空所有表情包')
    }
}

</script>

<template>
  <div class="personalization-settings w-full h-full bg-gray-50 flex flex-col">
    
    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100">
       <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">个性化</span>
       </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        
        <!-- Wallpaper -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">壁纸</h3>
            <div class="w-full h-32 bg-gray-200 rounded-xl mb-3 overflow-hidden border border-gray-200">
                <div v-if="!personalization.wallpaper" class="w-full h-full flex items-center justify-center text-gray-400 text-xs">预览</div>
                <img v-else :src="personalization.wallpaper" class="w-full h-full object-cover">
            </div>
            <div class="flex gap-2 mb-2">
                <input v-model="wallpaperInput" type="text" placeholder="输入壁纸URL..." class="setting-input flex-1">
                <button @click="applyWallpaper" class="setting-btn secondary w-12"><i class="fa-solid fa-check"></i></button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                 <button class="setting-btn secondary relative">
                    <i class="fa-solid fa-upload mr-1 text-gray-500"></i>本地上传
                    <input type="file" @change="onWallpaperUpload" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                </button>
                <button @click="clearWallpaper" class="setting-btn secondary bg-red-50 text-red-500">
                    <i class="fa-solid fa-trash mr-1"></i>清除
                </button>
            </div>
        </div>

        <!-- Icons -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">图标</h3>
            <div class="flex gap-4 mb-3">
                <div class="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                     <img v-if="currentIconUrl" :src="currentIconUrl" class="w-full h-full object-cover">
                     <i v-else class="fa-solid fa-image text-gray-400 text-xl"></i>
                </div>
                <select v-model="selectedApp" class="setting-input flex-1 h-12 bg-white">
                    <option value="wechat">微信</option>
                    <option value="worldbook">世界书</option>
                    <option value="search">查手机</option>
                    <option value="weibo">微博</option>
                    <option value="settings">设置</option>
                    <option value="couple">情侣空间</option>
                    <option value="games">小游戏</option>
                </select>
            </div>
            <div class="flex gap-2 mb-2">
                <input v-model="iconInput" type="text" placeholder="输入图标URL..." class="setting-input flex-1">
                <button @click="applyIcon" class="setting-btn secondary w-12"><i class="fa-solid fa-check"></i></button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <button class="setting-btn secondary relative">
                    <i class="fa-solid fa-upload mr-1 text-gray-500"></i>本地上传
                    <input type="file" @change="onIconUpload" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                </button>
                <button @click="clearIcon" class="setting-btn secondary bg-red-50 text-red-500">
                    <i class="fa-solid fa-rotate-left mr-1"></i>恢复默认
                </button>
            </div>
        </div>

        <!-- Widgets -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">桌面组件</h3>
            <div class="grid grid-cols-2 gap-4">
                <!-- Widget 1 -->
                <div class="space-y-2">
                    <div class="text-xs text-center text-gray-500">组件 1</div>
                    <div class="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
                        <img v-if="personalization.widgets.card1" :src="personalization.widgets.card1" class="w-full h-full object-cover">
                    </div>
                    <input v-model="widget1Input" type="text" placeholder="URL..." class="setting-input text-xs px-2 py-2">
                    <div class="grid grid-cols-3 gap-1">
                        <button @click="applyWidget('card1', widget1Input)" class="setting-btn secondary text-xs px-0"><i class="fa-solid fa-check"></i></button>
                        <button class="setting-btn secondary text-xs px-0 relative">
                            <i class="fa-solid fa-upload text-gray-500"></i>
                             <input type="file" @change="(e)=>onWidgetUpload(e, 'card1')" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                        </button>
                        <button @click="clearWidget('card1')" class="setting-btn secondary text-xs px-0 text-red-500"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                 <!-- Widget 2 -->
                <div class="space-y-2">
                    <div class="text-xs text-center text-gray-500">组件 2</div>
                    <div class="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
                        <img v-if="personalization.widgets.card2" :src="personalization.widgets.card2" class="w-full h-full object-cover">
                    </div>
                    <input v-model="widget2Input" type="text" placeholder="URL..." class="setting-input text-xs px-2 py-2">
                    <div class="grid grid-cols-3 gap-1">
                         <button @click="applyWidget('card2', widget2Input)" class="setting-btn secondary text-xs px-0"><i class="fa-solid fa-check"></i></button>
                        <button class="setting-btn secondary text-xs px-0 relative">
                            <i class="fa-solid fa-upload text-gray-500"></i>
                             <input type="file" @change="(e)=>onWidgetUpload(e, 'card2')" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                        </button>
                        <button @click="clearWidget('card2')" class="setting-btn secondary text-xs px-0 text-red-500"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Card Backgrounds -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">小组件背景</h3>
            <div class="grid grid-cols-3 gap-2">
                <!-- Time -->
                <div class="space-y-2">
                    <div class="text-xs text-center text-gray-500">时间</div>
                    <div class="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden border border-gray-200 relative">
                        <img v-if="personalization.cardBgs.time" :src="personalization.cardBgs.time" class="w-full h-full object-cover">
                    </div>
                    <div class="flex justify-between gap-1">
                         <button class="setting-btn secondary text-xs w-full py-1 relative">
                            上传
                            <input type="file" @change="(e)=>onCardBgUpload(e, 'time')" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                        </button>
                    </div>
                     <button @click="clearCardBg('time')" class="setting-btn secondary text-xs w-full py-1 text-red-500">清除</button>
                </div>
                <!-- Location -->
                 <div class="space-y-2">
                    <div class="text-xs text-center text-gray-500">定位</div>
                    <div class="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden border border-gray-200 relative">
                        <img v-if="personalization.cardBgs.location" :src="personalization.cardBgs.location" class="w-full h-full object-cover">
                    </div>
                     <div class="flex justify-between gap-1">
                         <button class="setting-btn secondary text-xs w-full py-1 relative">
                            上传
                            <input type="file" @change="(e)=>onCardBgUpload(e, 'location')" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                        </button>
                    </div>
                    <button @click="clearCardBg('location')" class="setting-btn secondary text-xs w-full py-1 text-red-500">清除</button>
                </div>
                <!-- Weather -->
                 <div class="space-y-2">
                    <div class="text-xs text-center text-gray-500">天气</div>
                    <div class="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden border border-gray-200 relative">
                        <img v-if="personalization.cardBgs.weather" :src="personalization.cardBgs.weather" class="w-full h-full object-cover">
                    </div>
                     <div class="flex justify-between gap-1">
                         <button class="setting-btn secondary text-xs w-full py-1 relative">
                            上传
                            <input type="file" @change="(e)=>onCardBgUpload(e, 'weather')" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                        </button>
                    </div>
                    <button @click="clearCardBg('weather')" class="setting-btn secondary text-xs w-full py-1 text-red-500">清除</button>
                </div>
            </div>
        </div>

        <!-- Global Font -->
        <div class="glass-panel p-4 rounded-[20px]">
             <h3 class="text-base font-bold text-gray-900 mb-3">全局字体设置</h3>
             <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <label class="text-sm text-gray-700">字体颜色</label>
                    <input v-model="personalization.globalFont.color" @change="store.saveToStorage()" type="color" class="w-10 h-10 rounded-lg overflow-hidden border-0 p-0 cursor-pointer">
                </div>
                 <div>
                    <label class="block text-sm text-gray-700 mb-1">字体阴影</label>
                    <input v-model="personalization.globalFont.shadow" @change="store.saveToStorage()" type="text" placeholder="0 2px 4px rgba(0,0,0,0.3)" class="setting-input">
                </div>
                <div class="flex gap-2">
                    <input v-model="fontUrlInput" type="text" placeholder="字体URL..." class="setting-input flex-1">
                    <button @click="applyFontUrl" class="setting-btn secondary w-12"><i class="fa-solid fa-check"></i></button>
                </div>
                 <button @click="resetFont" class="setting-btn secondary w-full text-red-500">重置字体设置</button>
             </div>
        </div>

        <!-- Global Bg -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">全局背景美化</h3>
            <div class="w-full h-24 bg-gray-200 rounded-xl mb-3 overflow-hidden border border-gray-200">
                <div v-if="!personalization.globalBg" class="w-full h-full flex items-center justify-center text-gray-400 text-xs">预览</div>
                <img v-else :src="personalization.globalBg" class="w-full h-full object-cover">
            </div>
             <div class="flex gap-2 mb-2">
                <input v-model="globalBgInput" type="text" placeholder="输入背景URL..." class="setting-input flex-1">
                <button @click="applyGlobalBg" class="setting-btn secondary w-12"><i class="fa-solid fa-check"></i></button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                 <button class="setting-btn secondary relative">
                    <i class="fa-solid fa-upload mr-1 text-gray-500"></i>本地上传
                    <input type="file" @change="onGlobalBgUpload" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                </button>
                <button @click="clearGlobalBg" class="setting-btn secondary bg-red-50 text-red-500">
                    <i class="fa-solid fa-trash mr-1"></i>清除
                </button>
            </div>
        </div>

        <!-- Presets -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">美化预设管理</h3>
            <div class="flex gap-2 mb-3">
                <input v-model="presetName" type="text" placeholder="预设名称" class="setting-input flex-1">
                <button @click="savePreset" class="setting-btn bg-green-500 text-white w-20 text-xs">保存</button>
            </div>
            <div class="mb-3">
                 <select v-model="selectedPreset" class="setting-input w-full bg-white">
                    <option value="">选择预设...</option>
                    <option v-for="p in personalization.presets" :key="p.name" :value="p.name">{{ p.name }}</option>
                </select>
            </div>
             <div class="grid grid-cols-2 gap-2">
                <button @click="loadPreset" class="setting-btn secondary">加载预设</button>
                <button @click="deletePreset" class="setting-btn secondary text-red-500">删除预设</button>
            </div>
             <button @click="resetAll" class="setting-btn secondary w-full mt-2 text-red-600 font-bold border-red-100 bg-red-50">重置所有美化</button>
        </div>

        <!-- Sticker Management -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">表情包管理</h3>
            <div class="text-xs text-gray-500 mb-2 leading-relaxed">
                支持导入 .txt 文件，格式为：<br>
                <code class="bg-gray-100 px-1 rounded">表情名称：图片URL</code><br>
                （支持中文“：”和英文“:”）<br>
                Word 文档请复制内容到 txt 文件后导入。
            </div>
            
            <div class="grid grid-cols-2 gap-2">
                 <button class="setting-btn secondary relative">
                    <i class="fa-solid fa-file-import mr-1 text-gray-500"></i>导入表情包
                    <input type="file" @change="onStickerImport" accept=".txt" class="absolute inset-0 opacity-0 cursor-pointer">
                </button>
                <button @click="clearStickers" class="setting-btn secondary bg-red-50 text-red-500">
                    <i class="fa-solid fa-trash mr-1"></i>清空表情包
                </button>
            </div>
             <div class="mt-2 text-xs text-center text-gray-400">
                当前已收录 {{ stickerCount }} 个表情包
            </div>
        </div>

        <!-- Custom CSS -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">自定义 CSS</h3>
            <textarea v-model="personalization.customCss" placeholder="/* Custom CSS */" class="setting-input h-24 font-mono text-xs resize-none mb-2"></textarea>
            <div class="grid grid-cols-2 gap-2">
                <button @click="saveCss" class="setting-btn bg-blue-500 text-white">保存 CSS</button>
                <button @click="clearCss" class="setting-btn secondary text-red-500">重置 CSS</button>
            </div>
        </div>

    </div>

    <!-- Cropper -->
    <ManualIconCropper 
        :is-open="showCropper"
        :image-url="cropperImage"
        @close="showCropper = false"
        @confirm="onCropperConfirm"
    />

    <!-- Toast -->
    <div 
        v-if="showToast"
        class="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg z-50"
    >
        {{ toastMessage }}
    </div>

  </div>
</template>
