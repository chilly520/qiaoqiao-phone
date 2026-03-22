<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="handleClose"></div>
    <div class="relative w-full max-w-lg bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-3xl shadow-2xl border border-white/10 overflow-hidden animate-fadeIn max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">自定义背景图</h2>
          <button @click="handleClose" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 夜间/日间模式切换 -->
        <div class="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
          <button 
            @click="themeMode = 'day'"
            :class="[
              'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
              themeMode === 'day' 
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-lg' 
                : 'text-gray-400 hover:text-white'
            ]"
          >
            <i class="fa-solid fa-sun"></i>日间模式
          </button>
          <button 
            @click="themeMode = 'night'"
            :class="[
              'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
              themeMode === 'night' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' 
                : 'text-gray-400 hover:text-white'
            ]"
          >
            <i class="fa-solid fa-moon"></i>夜间模式
          </button>
        </div>

        <div class="flex gap-2 mb-6">
          <button 
            @click="activeTab = 'url'"
            :class="[
              'flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all',
              activeTab === 'url' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            ]"
          >
            <i class="fa-solid fa-link mr-2"></i>URL链接
          </button>
          <button 
            @click="activeTab = 'upload'"
            :class="[
              'flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all',
              activeTab === 'upload' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            ]"
          >
            <i class="fa-solid fa-upload mr-2"></i>本地上传
          </button>
        </div>

        <div v-if="activeTab === 'url'" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-2">图片链接</label>
            <input 
              v-model="urlInput"
              type="text"
              placeholder="粘贴图片链接..."
              class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>
          <button 
            @click="previewUrl"
            :disabled="!urlInput"
            class="w-full py-3 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all"
          >
            <i class="fa-solid fa-eye mr-2"></i>预览
          </button>
        </div>

        <div v-else class="space-y-4">
          <div 
            @click="triggerUpload"
            class="relative border-2 border-dashed border-white/20 rounded-2xl p-8 text-center cursor-pointer hover:border-purple-500/50 hover:bg-white/5 transition-all group"
          >
            <input 
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileSelect"
            />
            <div class="flex flex-col items-center gap-3">
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <i class="fa-solid fa-cloud-arrow-up text-3xl text-purple-400"></i>
              </div>
              <div>
                <p class="text-white font-medium">点击或拖拽上传图片</p>
                <p class="text-gray-500 text-sm mt-1">支持 JPG、PNG、GIF 格式</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 实时预览区域 -->
        <div v-if="previewImage" class="mt-6 rounded-xl overflow-hidden border border-white/10 relative" :style="previewContainerStyle">
          <img :src="previewImage" class="w-full h-48 object-cover" :style="previewImageStyle" />
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span class="text-lg font-medium px-4 py-2 rounded-lg" :class="themeMode === 'night' ? 'bg-black/50 text-white' : 'bg-white/70 text-black'">
              {{ themeMode === 'night' ? '夜间模式预览' : '日间模式预览' }}
            </span>
          </div>
        </div>

        <!-- 调节选项 -->
        <div class="mt-6 space-y-5">
          <!-- 不透明度调节 -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm text-gray-400 flex items-center gap-2">
                <i class="fa-solid fa-circle-half-stroke"></i>背景不透明度
              </label>
              <span class="text-sm text-white font-medium">{{ Math.round(opacity * 100) }}%</span>
            </div>
            <input 
              v-model.number="opacity"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>透明</span>
              <span>不透明</span>
            </div>
          </div>

          <!-- 模糊度调节 -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm text-gray-400 flex items-center gap-2">
                <i class="fa-solid fa-droplet"></i>背景模糊度
              </label>
              <span class="text-sm text-white font-medium">{{ blur }}px</span>
            </div>
            <input 
              v-model.number="blur"
              type="range"
              min="0"
              max="20"
              step="1"
              class="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>清晰</span>
              <span>模糊</span>
            </div>
          </div>
        </div>

        <div class="flex gap-3 mt-6 pt-6 border-t border-white/10">
          <button 
            @click="handleReset"
            class="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white font-medium transition-all"
          >
            <i class="fa-solid fa-rotate-left mr-2"></i>重置默认
          </button>
          <button 
            @click="handleConfirm"
            :disabled="!canConfirm"
            class="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium shadow-lg shadow-purple-500/30 transition-all"
          >
            <i class="fa-solid fa-check mr-2"></i>确认使用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  initialSettings: {
    type: Object,
    default: () => ({
      themeMode: 'day',
      opacity: 1,
      blur: 0,
      customBackground: null
    })
  }
})

const emit = defineEmits(['close', 'confirm'])

const activeTab = ref('url')
const urlInput = ref('')
const urlPreview = ref('')
const localPreview = ref('')
const fileInput = ref(null)

// 新增：主题模式和调节参数
const themeMode = ref(props.initialSettings.themeMode || 'day')
const opacity = ref(props.initialSettings.opacity || 1)
const blur = ref(props.initialSettings.blur || 0)

// 监听 visible 变化，重置设置
watch(() => props.visible, (newVal) => {
  if (newVal) {
    themeMode.value = props.initialSettings.themeMode || 'day'
    opacity.value = props.initialSettings.opacity || 1
    blur.value = props.initialSettings.blur || 0
  }
})

const previewImage = computed(() => {
  return urlPreview.value || localPreview.value
})

// 是否有背景图（新上传的或已存在的）
const hasBackground = computed(() => {
  return previewImage.value !== '' || props.initialSettings.customBackground
})

const canConfirm = computed(() => {
  // 允许确认的情况：
  // 1. 有新上传的图片
  // 2. 有已存在的背景图（可以只修改参数）
  // 3. 点击了重置
  return previewImage.value !== '' || props.initialSettings.customBackground
})

// 预览容器样式
const previewContainerStyle = computed(() => {
  return {
    backgroundColor: themeMode.value === 'night' ? '#000000' : '#ffffff'
  }
})

// 预览图片样式
const previewImageStyle = computed(() => {
  return {
    opacity: opacity.value,
    filter: `blur(${blur.value}px)`
  }
})

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      localPreview.value = event.target.result
    }
    reader.readAsDataURL(file)
  }
}

const previewUrl = () => {
  if (urlInput.value) {
    urlPreview.value = urlInput.value
  }
}

const handleReset = () => {
  emit('confirm', { 
    type: 'reset',
    themeMode: 'day',
    opacity: 1,
    blur: 0
  })
  handleClose()
}

const handleConfirm = () => {
  const result = {
    type: 'update', // 标记为更新操作
    themeMode: themeMode.value,
    opacity: opacity.value,
    blur: blur.value
  }
  
  // 优先使用新上传的图片
  if (urlPreview.value) {
    result.type = 'url'
    result.url = urlPreview.value
    result.data = urlPreview.value
  } else if (localPreview.value) {
    result.type = 'local'
    result.data = localPreview.value
    result.url = localPreview.value
  } else if (props.initialSettings.customBackground) {
    // 没有新图片，使用已存在的背景图
    result.type = 'update'
    result.data = props.initialSettings.customBackground
    result.url = props.initialSettings.customBackground
  }
  
  emit('confirm', result)
  handleClose()
}

const handleClose = () => {
  activeTab.value = 'url'
  urlInput.value = ''
  urlPreview.value = ''
  localPreview.value = ''
  emit('close')
}
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 滑块样式 */
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #a855f7, #ec4899);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);
  transition: transform 0.2s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #a855f7, #ec4899);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);
}
</style>
