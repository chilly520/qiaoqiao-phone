<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'

const router = useRouter()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const goBack = () => {
    router.back()
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
    maxTokens: 4096,
    // ST Defaults
    top_p: 1.0,
    top_k: 0,
    frequency_penalty: 0,
    presence_penalty: 0,
    repetition_penalty: 1.0,
    min_p: 0
})

// API Key 显示/隐藏控制
const showApiKey = ref(false)

// 模型列表和显示控制
const availableModels = ref([])
const showModelSelect = ref(false)



// 加载当前配置到表单
const loadConfig = () => {
    if (currentConfig.value) {
        formData.value = { ...currentConfig.value }
        // [FIX] Auto-clamp legacy high values (e.g. 300w -> 65536)
        if (formData.value.maxTokens > 65536) {
             formData.value.maxTokens = 65536
        }
    }
}

// 初始加载
loadConfig()

// 保存配置
const saveConfig = () => {
    settingsStore.updateConfig(currentConfigIndex.value, formData.value)
    chatStore.triggerToast('配置已保存', 'success')
}

// 新建配置
const newConfig = () => {
        const newIndex = settingsStore.createConfig({
        name: '新配置',
        baseUrl: 'http://127.0.0.1:7861/v1',
        apiKey: 'pwd',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.7,
        maxTokens: 4096,
        // Advanced ST Params
        top_p: 1.0,
        top_k: 0,
        frequency_penalty: 0,
        presence_penalty: 0,
        repetition_penalty: 1.0,
        min_p: 0
    })
    currentConfigIndex.value = newIndex
    loadConfig()
    chatStore.triggerToast('新配置已创建', 'success')
}

// 删除配置
const deleteConfig = () => {
    if (confirm('确定要删除当前配置吗？')) {
        const result = settingsStore.deleteConfig(currentConfigIndex.value)
        if (result === true) {
            loadConfig()
            chatStore.triggerToast('配置已删除', 'success')
        } else if (typeof result === 'string') {
            chatStore.triggerToast(result, 'warning')
        }
    }
}

// 拉取模型列表
const fetchModels = async () => {
    if (!formData.value.apiKey || !formData.value.baseUrl) {
        chatStore.triggerToast('请先填写 Base URL 和 API Key', 'warning')
        return
    }
    
    try {
        let url = ''
        let options = {}

        if (formData.value.provider === 'gemini') {
            // Google Gemini Native Provider
            let base = formData.value.baseUrl.trim()
            // Clean up trailing slash
            base = base.replace(/\/+$/, '')
            
            // Auto-append v1beta if no version is specified
            if (!base.includes('/v1')) {
                base += '/v1beta'
            }
            
            url = `${base}/models?key=${formData.value.apiKey}`
            options = { method: 'GET' }
        } else {
            // OpenAI Compatible Provider
            url = `${formData.value.baseUrl}/models`
            options = {
                headers: {
                    'Authorization': `Bearer ${formData.value.apiKey}`
                }
            }
        }
        
        const response = await fetch(url, options)
        
        if (response.ok) {
            const data = await response.json()
            // OpenAI 格式: data.data; Gemini 格式: data.models
            const rawModels = data.data || data.models || []
            
            // 处理模型 ID
            availableModels.value = rawModels.map(m => {
                if (typeof m === 'string') return m
                
                let id = m.id || m.name || ''
                // Gemini 模型通常带有 "models/" 前缀，为了 UI 简洁这里去掉
                if (formData.value.provider === 'gemini' && id.startsWith('models/')) {
                    id = id.replace('models/', '')
                }
                return id
            }).filter(id => {
                // 过滤掉不相关的模型 (可选)
                if (formData.value.provider === 'gemini') {
                    return id.toLowerCase().includes('gemini')
                }
                return true
            })

            showModelSelect.value = true
            chatStore.triggerToast(`已获取 ${availableModels.value.length} 个模型`, 'success')
        } else {
            const errorData = await response.json().catch(() => ({}))
            const errorMsg = errorData.error?.message || response.statusText
            chatStore.triggerToast('拉取失败: ' + errorMsg, 'error')
        }
    } catch (e) {
        chatStore.triggerToast('拉取失败: ' + e.message, 'error')
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

// 自动填入官方地址
const stopWatchProvider = ref(null)

watch(() => formData.value.provider, (newProvider) => {
    if (newProvider === 'gemini') {
        const currentUrl = formData.value.baseUrl.trim()
        // 如果当前地址为空，或者还是默认的本地地址，则自动切换成谷歌官方地址
        if (!currentUrl || currentUrl.includes('127.0.0.1') || currentUrl.includes('localhost')) {
            formData.value.baseUrl = 'https://generativelanguage.googleapis.com'
            chatStore.triggerToast('已自动切换为 Gemini 官方接口地址', 'info')
        }
    }
})
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
                    max="65536" 
                    step="512"
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                >
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>256</span>
                    <span>65,536 (64k)</span>
                </div>
            </div>

            <!-- 分割线 -->
            <div class="border-t border-gray-100 my-4"></div>
            <h3 class="text-lg font-bold text-gray-900 mb-4">高级生成参数 (SillyTavern)</h3>

            <!-- Top P -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                    <span>Top P (核采样)</span>
                    <span class="text-gray-500">{{ formData.top_p ?? 1.0 }}</span>
                </label>
                <input v-model.number="formData.top_p" type="range" min="0" max="1" step="0.01" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
            </div>

            <!-- Top K -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                    <span>Top K (候选数)</span>
                    <span class="text-gray-500">{{ formData.top_k ?? 0 }}</span>
                </label>
                <input v-model.number="formData.top_k" type="range" min="0" max="100" step="1" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                <div class="text-xs text-gray-400 mt-1">0 表示不限制</div>
            </div>

            <!-- Frequency Penalty -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                    <span>Frequency Penalty (频率惩罚)</span>
                    <span class="text-gray-500">{{ formData.frequency_penalty ?? 0 }}</span>
                </label>
                <input v-model.number="formData.frequency_penalty" type="range" min="-2" max="2" step="0.1" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
            </div>

            <!-- Presence Penalty -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                    <span>Presence Penalty (存在惩罚)</span>
                    <span class="text-gray-500">{{ formData.presence_penalty ?? 0 }}</span>
                </label>
                <input v-model.number="formData.presence_penalty" type="range" min="-2" max="2" step="0.1" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
            </div>

            <!-- Repetition Penalty -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                    <span>Repetition Penalty (重复惩罚)</span>
                    <span class="text-gray-500">{{ formData.repetition_penalty ?? 1.0 }}</span>
                </label>
                <input v-model.number="formData.repetition_penalty" type="range" min="1" max="2" step="0.01" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                <div class="text-xs text-gray-400 mt-1">1.0 表示无惩罚</div>
            </div>
            
             <!-- Min P -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                    <span>Min P (最小概率)</span>
                    <span class="text-gray-500">{{ formData.min_p ?? 0 }}</span>
                </label>
                <input v-model.number="formData.min_p" type="range" min="0" max="1" step="0.01" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
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
