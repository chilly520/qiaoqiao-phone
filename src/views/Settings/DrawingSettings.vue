<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { generateImage } from '../../utils/aiService'
import { compressImage } from '../../utils/imageUtils'

const router = useRouter()
const settingsStore = useSettingsStore()

const drawingConfig = ref({ ...settingsStore.drawing })
const showApiKey = ref(false)

const providers = [
    { id: 'pollinations', name: 'Pollinations.ai', desc: '支持匿名 (免费) 或积分制 (Flux)' },
    { id: 'siliconflow', name: 'SiliconFlow', desc: '国内极速大模型网关 推荐' },
    { id: 'flux-api', name: 'Flux-API', desc: '通用 Flux 接口' },
    { id: 'volcengine', name: '火山引擎 ARK', desc: '豆包 Seedream 文生图 / SeedEdit 图生图 (支持角色形象图参考)' }
]

// v1.10.97: 火山引擎模型预设
const volcengineModels = [
    { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0 (文生图)', type: 't2i' },
    { id: 'doubao-seededit-3-0-i2i-250315', name: 'SeedEdit 3.0 (图生图/编辑)', type: 'i2i' },
    { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0 (文生图 最新)', type: 't2i' }
]
const volcengineSizes = [
    '1024x1024', '864x1152', '1152x864', '1280x720', '720x1280', '2048x2048'
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

// v1.10.113: 火山引擎图生图测试
const testRefImage = ref('')        // base64 of ref image
const testRefPrompt = ref('a beautiful girl with star-shaped hair holding an umbrella, anime style') // i2i prompt
const isTestingI2I = ref(false)
const testRefFileInput = ref(null)

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
        showToast('测试失败：' + (e.message || ''))
    } finally {
        isTesting.value = false
    }
}

const triggerTestRefUpload = () => {
    if (testRefFileInput.value) testRefFileInput.value.click()
}

const handleTestRefChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件')
        e.target.value = ''
        return
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('图片不能超过 10MB')
        e.target.value = ''
        return
    }
    try {
        const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.85 })
        testRefImage.value = compressed
    } catch (err) {
        console.error('参考图压缩失败', err)
        showToast('参考图处理失败')
    } finally {
        e.target.value = ''
    }
}

const testI2IGenerate = async () => {
    if (isTestingI2I.value || isTesting.value) return
    if (!testRefImage.value) {
        showToast('请先上传参考图')
        return
    }
    if (!testRefPrompt.value.trim()) {
        showToast('请输入图生图提示词')
        return
    }
    if (drawingConfig.value.provider !== 'volcengine') {
        showToast('图生图测试仅支持火山引擎')
        return
    }

    isTestingI2I.value = true
    testResultUrl.value = ''
    try {
        settingsStore.setDrawingConfig({ ...drawingConfig.value })
        // v1.10.113: 强制走图生图:useAppearance: true 让 backend 走 i2i 模型
        // referenceImage 必传,直接用用户上传的图
        const url = await generateImage(testRefPrompt.value.trim(), {
            referenceImage: testRefImage.value,
            useAppearance: true
        })
        testResultUrl.value = url
        showToast('图生图测试成功')
    } catch (e) {
        console.error('图生图测试失败', e)
        showToast('图生图测试失败：' + (e.message || ''))
    } finally {
        isTestingI2I.value = false
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

                <div v-if="drawingConfig.provider !== 'volcengine'" class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 ml-1">模型名称 (Model)</label>
                    <input
                        v-model="drawingConfig.model"
                        type="text"
                        class="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="例如：flux, flux-schnell, dall-e-3"
                    >
                    <p v-if="drawingConfig.provider === 'siliconflow'" class="text-[10px] text-gray-400 ml-1 mt-1">
                        <i class="fa-solid fa-info-circle mr-0.5"></i>
                        推荐模型：<span class="font-mono text-blue-500">FLUX.1-schnell</span> (免费快)、<span class="font-mono text-purple-500">FLUX.1-dev</span> (高质量) 或 <span class="font-mono text-green-500">Kwai-Kolors/Kolors</span> (快手免费)
                    </p>
                </div>
            </div>
        </section>

        <!-- v1.10.97: 火山引擎专属配置 -->
        <section v-if="drawingConfig.provider === 'volcengine'" class="space-y-3">
            <h3 class="text-sm font-bold text-gray-400 px-1 uppercase tracking-wider">火山引擎豆包 / 形象图参考</h3>
            <div class="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
                <div class="bg-blue-50/60 border border-blue-100 rounded-xl p-3 space-y-1.5">
                    <div class="flex items-start gap-2">
                        <i class="fa-solid fa-circle-info text-blue-500 text-sm mt-0.5"></i>
                        <div class="text-[10px] text-blue-800 leading-relaxed">
                            <p class="font-bold mb-1">🌋 火山引擎 ARK 使用说明</p>
                            <ul class="list-disc list-inside space-y-0.5 text-blue-700">
                                <li>API Key 在 <span class="font-mono">火山引擎控制台 → 在线推理 → ARK</span> 创建(单个字符串,不是 AccessKey/SecretKey)</li>
                                <li>启用 <b>角色形象图参考</b> 后,生成人像时会自动以该角色上传的形象图为参考(图生图)</li>
                                <li>形象图由角色编辑页单独上传,与"头像"是两套图</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 ml-1">文生图模型</label>
                    <select v-model="drawingConfig.volcengine.text2imageModel"
                        class="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option v-for="m in volcengineModels.filter(x => x.type === 't2i')" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>

                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 ml-1">图生图模型 (使用形象图时调用)</label>
                    <select v-model="drawingConfig.volcengine.image2imageModel"
                        class="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option v-for="m in volcengineModels.filter(x => x.type === 'i2i')" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </div>

                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 ml-1">输出尺寸</label>
                    <select v-model="drawingConfig.volcengine.size"
                        class="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option v-for="s in volcengineSizes" :key="s" :value="s">{{ s }}</option>
                    </select>
                </div>

                <div class="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                    <div class="flex-1">
                        <div class="text-xs font-bold text-gray-800">🎨 智能使用角色形象图作参考</div>
                        <div class="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                            开启后,人像提示词(我/你/他/她/角色/人物…)自动以形象图为参考(图生图);风景/美食/动物/物品等场景直接文生图不参考
                        </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" v-model="drawingConfig.volcengine.useAppearanceImage" class="sr-only peer">
                        <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-pink-500 transition-colors"></div>
                        <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
                    </label>
                </div>

                <div v-if="drawingConfig.volcengine.useAppearanceImage" class="space-y-1.5">
                    <label class="text-xs font-bold text-gray-700 ml-1">
                        形象图参考强度 ({{ drawingConfig.volcengine.appearanceStrength }})
                    </label>
                    <input type="range" min="0" max="1" step="0.05" v-model.number="drawingConfig.volcengine.appearanceStrength"
                        class="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-pink-500">
                    <p class="text-[10px] text-gray-400 ml-1">0 = 几乎忽略参考图, 1 = 强参考(更接近原图)</p>
                </div>
            </div>
        </section>

        <!-- Test Generation -->
        <section class="space-y-3 pb-10">
            <h3 class="text-sm font-bold text-gray-400 px-1 uppercase tracking-wider">功能测试</h3>
            <div class="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
                <!-- SiliconFlow 额度提示 -->
                <div v-if="drawingConfig.provider === 'siliconflow'" class="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
                    <div class="flex items-start gap-2">
                        <i class="fa-solid fa-circle-info text-amber-500 text-sm mt-0.5"></i>
                        <div class="text-[10px] text-amber-800 leading-relaxed">
                            <p class="font-bold mb-1">💰 免费额度说明</p>
                            <ul class="list-disc list-inside space-y-0.5 text-amber-700">
                                <li><span class="font-bold">每日额度：</span>100 万 tokens（每日凌晨刷新）</li>
                                <li><span class="font-bold">生图消耗：</span>约 2-5 万 tokens/张</li>
                                <li><span class="font-bold">理论生成：</span>20-50 张/天</li>
                            </ul>
                            <p class="mt-2 font-bold text-amber-900">✨ 推荐模型：</p>
                            <ul class="list-disc list-inside space-y-0.5 text-amber-700">
                                <li><span class="font-mono text-blue-600">FLUX.1-schnell</span> - 速度快，适合日常使用</li>
                                <li><span class="font-mono text-purple-600">FLUX.1-dev</span> - 高质量，适合精美图片</li>
                                <li><span class="font-mono text-green-600">Kwai-Kolors/Kolors</span> - 快手开源，完全免费 ⭐</li>
                            </ul>
                            <div class="mt-2 bg-white/60 rounded-lg p-2 border border-amber-200">
                                <p class="text-[9px] text-amber-900 font-bold mb-1">🎨 Kwai-Kolors 特色：</p>
                                <ul class="list-disc list-inside space-y-0.5 text-[9px] text-amber-700">
                                    <li>完全免费，不消耗每日 tokens 额度</li>
                                    <li>中文理解能力强，适合国风/人像</li>
                                    <li>支持高分辨率输出</li>
                                    <li>响应速度较快（通常 20-40 秒）</li>
                                </ul>
                            </div>
                            <p class="mt-2 text-amber-700">
                                <i class="fa-solid fa-lightbulb mr-0.5"></i>
                                💡 提示：访问 SiliconFlow 官网 → 账户中心 → 用量明细 可查看详细使用记录
                            </p>
                        </div>
                    </div>
                </div>
                
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

                <!-- v1.10.113: 火山引擎专用的图生图测试入口 -->
                <div v-if="drawingConfig.provider === 'volcengine' && drawingConfig.apiKey"
                    class="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 rounded-xl p-3 space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <i class="fa-solid fa-image text-pink-500"></i> 图生图测试 (SeedEdit)
                        </div>
                        <span class="text-[10px] text-gray-400 font-mono">{{ drawingConfig.volcengine.image2imageModel }}</span>
                    </div>

                    <!-- 参考图上传 -->
                    <div v-if="!testRefImage" @click="triggerTestRefUpload"
                        class="w-full border-2 border-dashed border-pink-200 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-pink-400 hover:bg-pink-50/50 transition-colors min-h-[80px]">
                        <i class="fa-solid fa-cloud-arrow-up text-2xl text-pink-300 mb-1"></i>
                        <p class="text-xs text-gray-500">点击上传参考图</p>
                    </div>
                    <div v-else class="relative">
                        <img :src="testRefImage" class="w-full max-h-32 object-contain rounded-lg border border-pink-200">
                        <button @click="testRefImage = ''"
                            class="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-red-500 flex items-center justify-center shadow">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                    <input type="file" ref="testRefFileInput" class="hidden" accept="image/*"
                        @change="handleTestRefChange">

                    <div class="flex gap-2">
                        <input v-model="testRefPrompt" type="text"
                            class="flex-1 bg-white border border-pink-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-pink-400"
                            placeholder="图生图提示词,描述想要的风格/变化...">
                        <button @click="testI2IGenerate" :disabled="isTestingI2I || !testRefImage"
                            class="shrink-0 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold rounded-lg active:scale-95 transition-all disabled:opacity-50 shadow"
                            style="min-width: 70px;">
                            {{ isTestingI2I ? '...' : '测试 i2i' }}
                        </button>
                    </div>
                </div>

                <!-- Result Preview -->
                <div v-if="testResultUrl || isTesting" class="aspect-square w-full rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-dashed border-gray-200">
                    <div v-if="isTesting" class="flex flex-col items-center gap-3">
                         <i class="fa-solid fa-spinner fa-spin text-xl text-gray-300"></i>
                         <span class="text-[10px] text-gray-400">正在调用接口，请稍候...（免费模型可能需要 30-60 秒）</span>
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
