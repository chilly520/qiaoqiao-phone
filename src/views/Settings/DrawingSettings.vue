<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { generateImage } from '../../utils/aiService'

const router = useRouter()
const settingsStore = useSettingsStore()

const drawingConfig = ref({ ...settingsStore.drawing })
const showApiKey = ref(false)

const providers = [
    { id: 'pollinations', name: 'Pollinations.ai', desc: '支持匿名(免费)或积分制(Flux)' },
    { id: 'siliconflow', name: 'SiliconFlow', desc: '国内极速大模型网关 推荐' },
    { id: 'flux-api', name: 'Flux-API', desc: '通用 Flux 接口' }
]

// Toast State
const toastVisible = ref(false)
const toastMsg = ref('')
const showToast = (msg) => {
    toastMsg.value = msg
    toastVisible.value = true
    setTimeout(() => {
        toastVisible.value = false
    }, 2000)
}

const saveSettings = () => {
    console.log('Saving drawing settings:', drawingConfig.value)
    settingsStore.setDrawingConfig({ ...drawingConfig.value })
    showToast('配置已保存')
}

const goBack = () => {
    router.back()
}

// Test Generation State
const testPrompt = ref('A beautiful girl with star-shaped hair holding an umbrella')
const isTesting = ref(false)
const testResultUrl = ref('')

const testGenerate = async () => {
    if (isTesting.value) return
    if (!testPrompt.value.trim()) {
        showToast('请输入提示词')
        return
    }
    
    isTesting.value = true
    testResultUrl.value = ''
    try {
        console.log('Testing generation with provider:', drawingConfig.value.provider)
        // Ensure store and service use current UI values for the test
        settingsStore.setDrawingConfig({ ...drawingConfig.value })
        const url = await generateImage(testPrompt.value)
        testResultUrl.value = url
        console.log('Test generation success:', url)
    } catch (e) {
        console.error('Test generation error:', e)
        showToast('生成失败: ' + e.message)
    } finally {
        isTesting.value = false
    }
}
</script>

<template>
  <div class="drawing-settings w-full h-full bg-gray-50 flex flex-col">
    <!-- Header -->
    <div class="h-[60px] bg-white flex items-center justify-between px-4 border-b border-gray-100 shrink-0 sticky top-0 z-[200]">
       <div class="flex items-center gap-3 cursor-pointer py-2 px-1" @click="goBack" style="position: relative; z-index: 210;">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">生图配置</span>
       </div>
       <div class="flex items-center">
           <button 
             @click.stop="saveSettings" 
             class="px-5 py-2 bg-blue-500 text-white font-bold rounded-full shadow-sm active:scale-95 transition-all cursor-pointer select-none"
             style="position: relative; z-index: 220; min-width: 70px;"
           >
             保存
           </button>
       </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Provider Selection -->
        <section class="space-y-3">
            <h3 class="text-sm font-bold text-gray-400 px-1 uppercase tracking-wider">选择服务商</h3>
            <div class="space-y-2">
                <div 
                    v-for="p in providers" 
                    :key="p.id"
                    @click="drawingConfig.provider = p.id"
                    class="bg-white p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between"
                    :class="drawingConfig.provider === p.id ? 'border-blue-500 bg-blue-50/10 shadow-sm' : 'border-gray-100'"
                >
                    <div>
                        <div class="font-bold text-gray-900" :class="drawingConfig.provider === p.id ? 'text-blue-600' : ''">{{ p.name }}</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">{{ p.desc }}</div>
                    </div>
                    <i v-if="drawingConfig.provider === p.id" class="fa-solid fa-circle-check text-blue-500"></i>
                </div>
            </div>
        </section>

        <!-- API Key Configuration -->
        <section class="space-y-3">
            <h3 class="text-sm font-bold text-gray-400 px-1 uppercase tracking-wider">密钥与参数</h3>
            <div class="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 ml-1">API Key / Token</label>
                    <div class="relative flex items-center">
                        <input 
                            v-model="drawingConfig.apiKey" 
                            :type="showApiKey ? 'text' : 'password'" 
                            class="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 pr-10"
                            placeholder="输入密钥 (部分服务商免费版可留空)"
                        >
                        <i 
                            @click="showApiKey = !showApiKey"
                            class="fa-solid absolute right-4 cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
                            :class="showApiKey ? 'fa-eye-slash' : 'fa-eye'"
                        ></i>
                    </div>
                    <p v-if="drawingConfig.provider === 'pollinations'" class="text-[10px] text-gray-400 ml-1 italic">
                        提示: 请使用 <span class="text-red-500 font-bold">pk_</span> 开头的 Publishable Key。以 <span class="text-red-500 font-bold">sk_</span> 开头的密钥会被官方拦截(403)。
                    </p>
                </div>

                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 ml-1">模型名称 (Model)</label>
                    <input 
                        v-model="drawingConfig.model" 
                        type="text" 
                        class="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="例如: flux, flux-schnell, dall-e-3"
                    >
                </div>
            </div>
        </section>

        <!-- Test Generation -->
        <section class="space-y-3 pb-10">
            <h3 class="text-sm font-bold text-gray-400 px-1 uppercase tracking-wider">功能测试</h3>
            <div class="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
                <div class="flex gap-3 items-center">
                    <input 
                        v-model="testPrompt" 
                        type="text" 
                        class="flex-1 bg-gray-100 border-none rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="输入测试提示词..."
                    >
                    <button 
                         @click="testGenerate"
                        :disabled="isTesting"
                        class="shrink-0 px-6 py-3 font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 shadow-md"
                        style="background-color: #2563eb !important; color: white !important; min-width: 80px;"
                    >
                        {{ isTesting ? '...' : '测试' }}
                    </button>
                </div>

                <!-- Result Preview -->
                <div v-if="testResultUrl || isTesting" class="aspect-square w-full rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-dashed border-gray-200">
                    <div v-if="isTesting" class="flex flex-col items-center gap-3">
                         <i class="fa-solid fa-spinner fa-spin text-xl text-gray-300"></i>
                         <span class="text-[10px] text-gray-400">正在调用接口，请稍候...</span>
                    </div>
                    <img 
                        v-else 
                        :src="testResultUrl" 
                        class="w-full h-full object-cover"
                        @error="testResultUrl = ''"
                    >
                </div>
                <div v-if="testResultUrl" class="text-center">
                    <p class="text-[10px] text-gray-400">如果能看到图片，说明配置已生效！</p>
                </div>
            </div>
        </section>
    </div>

    <!-- Toast Notification -->
    <Transition name="toast">
        <div v-if="toastVisible" class="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-900/80 backdrop-blur-md text-white rounded-2xl text-sm font-bold z-[1000] shadow-xl border border-white/10">
            {{ toastMsg }}
        </div>
    </Transition>
  </div>
</template>

<style scoped>
.glass-panel {
    background: white;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

.toast-enter-active, .toast-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from, .toast-leave-to {
    opacity: 0;
    transform: translate(-50%, 20px);
}
</style>
