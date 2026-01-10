<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'

const router = useRouter()
const settingsStore = useSettingsStore()

const goBack = () => {
    router.push('/')
}

// 当前选中的配置索引
const currentConfigIndex = computed({
    get: () => settingsStore.currentConfigIndex,
    set: (val) => settingsStore.currentConfigIndex = val
})

// 当前配置
const currentConfig = computed(() => settingsStore.currentConfig)

// 本地表单数据
const formData = ref({
    name: '',
    provider: 'openai', // New field: openai | gemini
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 4096
})

// API Key 显示/隐藏控制
const showApiKey = ref(false)

// 模型列表和显示控制
const availableModels = ref([])
const showModelSelect = ref(false)

// Toast提示
const toastMessage = ref('')
const showToast = ref(false)

const showToastMsg = (msg) => {
    toastMessage.value = msg
    showToast.value = true
    setTimeout(() => {
        showToast.value = false
    }, 2000)
}

// 加载当前配置到表单
const loadConfig = () => {
    if (currentConfig.value) {
        formData.value = { ...currentConfig.value }
    }
}

// 初始加载
loadConfig()

// 保存配置
const saveConfig = () => {
    settingsStore.updateConfig(currentConfigIndex.value, formData.value)
    showToastMsg('配置已保存')
}

// 新建配置
const newConfig = () => {
    const newIndex = settingsStore.createConfig({
        name: '新配置',
        baseUrl: 'http://127.0.0.1:7861/v1',
        apiKey: 'pwd',
        model: 'gemini-2.5-pro-nothinking',
        temperature: 0.7,
        maxTokens: 4096
    })
    currentConfigIndex.value = newIndex
    loadConfig()
    showToastMsg('新配置已创建')
}

// 删除配置
const deleteConfig = () => {
    if (confirm('确定要删除当前配置吗？')) {
        const result = settingsStore.deleteConfig(currentConfigIndex.value)
        if (result === true) {
            loadConfig()
            showToastMsg('配置已删除')
        } else if (typeof result === 'string') {
            showToastMsg(result)
        }
    }
}

// 拉取模型列表
const fetchModels = async () => {
    if (!formData.value.apiKey || !formData.value.baseUrl) {
        showToastMsg('请先填写 Base URL 和 API Key')
        return
    }
    
    try {
        const response = await fetch(`${formData.value.baseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${formData.value.apiKey}`
            }
        })
        
        if (response.ok) {
            const data = await response.json()
            // 支持两种格式: data.data 或 data.models
            const models = data.data || data.models || []
            availableModels.value = models.map(m => typeof m === 'string' ? m : m.id)
            showModelSelect.value = true
            showToastMsg(`已获取 ${availableModels.value.length} 个模型`)
        } else {
            showToastMsg('拉取失败: ' + response.statusText)
        }
    } catch (e) {
        showToastMsg('拉取失败: ' + e.message)
    }
}

// 选择模型
const selectModel = (modelId) => {
    formData.value.model = modelId
    // 选择后隐藏下拉框
    showModelSelect.value = false
}

// 当切换配置时重新加载
const onConfigChange = () => {
    loadConfig()
}
</script>

<template>
  <div class="api-settings w-full h-full bg-gray-50 flex flex-col">
    
    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100">
       <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">API 连接</span>
       </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        
        <!-- 配置选择器 -->
        <div class="glass-panel p-4 rounded-[20px]">
            <label class="block text-sm font-medium text-gray-700 mb-2">选择配置</label>
            <select 
                v-model="currentConfigIndex" 
                @change="onConfigChange"
                class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-full"
            >
                <option 
                    v-for="(config, index) in settingsStore.apiConfigs" 
                    :key="index" 
                    :value="index"
                >
                    {{ config.name }}
                </option>
            </select>
        </div>

        <!-- 聊天专用配置 -->
        <div class="glass-panel p-5 rounded-[20px] space-y-4">
            <h3 class="text-lg font-bold text-gray-900 mb-4">聊天专用</h3>
            
            <!-- 配置名称 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">配置名称</label>
                <input 
                    v-model="formData.name" 
                    type="text" 
                    placeholder="例如: GPT-4"
                    class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-full"
                >
            </div>

            <!-- API Provider Type -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">接口协议类型</label>
                <select 
                    v-model="formData.provider" 
                    class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-full"
                >
                    <option value="openai">OpenAI (默认 / 兼容)</option>
                    <option value="gemini">Google Gemini (原生)</option>
                </select>
            </div>

            <!-- Base URL -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Base URL</label>
                <input 
                    v-model="formData.baseUrl" 
                    type="text" 
                    placeholder="https://api.openai.com/v1"
                    class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-full"
                >
            </div>

            <!-- API Key -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <div class="relative">
                    <input 
                        v-model="formData.apiKey" 
                        :type="showApiKey ? 'text' : 'password'" 
                        placeholder="pwd"
                        class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-full pr-12"
                    >
                    <button 
                        @click="showApiKey = !showApiKey"
                        type="button"
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                        <i :class="showApiKey ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                    </button>
                </div>
            </div>

            <!-- 模型管理 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">模型管理</label>
                <div class="flex gap-2">
                    <input 
                        v-model="formData.model" 
                        type="text" 
                        placeholder="gpt-3.5-turbo"
                        class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition flex-1"
                    >
                    <button 
                        @click="fetchModels"
                        class="bg-blue-500 text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
                    >
                        拉取
                    </button>
                </div>
                
                <!-- 模型选择下拉框 - 拉取后显示 -->
                <select 
                    v-if="showModelSelect && availableModels.length > 0"
                    @change="selectModel($event.target.value)"
                    size="8"
                    class="px-4 py-2.5 bg-blue-900/40 border border-blue-400/50 text-blue-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition w-full mt-2 max-h-[200px] overflow-y-auto"
                >
                    <option value="" disabled selected>选择模型</option>
                    <option 
                        v-for="model in availableModels" 
                        :key="model" 
                        :value="model"
                        class="py-2"
                    >
                        {{ model }}
                    </option>
                </select>
            </div>

            <!-- 思维活跃度 (Temperature) -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    思维活跃度: {{ formData.temperature }}
                </label>
                <input 
                    v-model.number="formData.temperature" 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1"
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                >
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>2</span>
                </div>
            </div>

            <!-- 最大输出 TOKEN -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                    最大输出 TOKEN: {{ formData.maxTokens.toLocaleString() }}
                </label>
                <input 
                    v-model.number="formData.maxTokens" 
                    type="range" 
                    min="256" 
                    max="3000000" 
                    step="1000"
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                >
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>256</span>
                    <span>3,000,000</span>
                </div>
            </div>
        </div>

        <!-- 操作按钮 -->
        <div class="space-y-3">
            <!-- 保存 -->
            <button 
                @click="saveConfig"
                class="w-full bg-blue-500 text-white py-3 rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md"
            >
                保存配置
            </button>

            <!-- 新建和删除 -->
            <div class="grid grid-cols-2 gap-3">
                <button 
                    @click="newConfig"
                    class="bg-green-500 text-white py-3 rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md"
                >
                    新建配置
                </button>
                <button 
                    @click="deleteConfig"
                    class="bg-red-500 text-white py-3 rounded-xl font-medium active:scale-[0.98] transition shadow-sm hover:shadow-md"
                >
                    删除配置
                </button>
            </div>
        </div>

    </div>

    <!-- Toast通知 -->
    <div 
        v-if="showToast"
        class="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg z-50 transition-all"
    >
        {{ toastMessage }}
    </div>

  </div>
</template>

<style scoped>
/* Range滑块样式 */
input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    border: none;
}
</style>
