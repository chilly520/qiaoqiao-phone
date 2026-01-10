<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const store = useSettingsStore()
const { voice } = storeToRefs(store)

const goBack = () => {
    router.push('/settings')
}

// Local form data to prevent immediate store updates for fields like API key
// but we will bind directly for simplicity in this MVP iteratively, or use local state + save button
// The original HTML had a "Save Settings" button for MiniMax.
// Let's us local state for MiniMax config inputs.

const minimaxForm = ref({
    groupId: '',
    apiKey: '',
    modelId: '',
    voiceId: ''
})

// Initialize form from store
const initForm = () => {
    minimaxForm.value = { ...voice.value.minimax }
}
initForm()

// Toast
const showToast = ref(false)
const toastMessage = ref('')
const showToastMsg = (msg) => {
    toastMessage.value = msg
    showToast.value = true
    setTimeout(() => { showToast.value = false }, 2000)
}

// Engine Selection
const setEngine = (engine) => {
    store.setVoiceEngine(engine)
}

// MiniMax Actions
const saveMiniMax = () => {
    store.updateMinimaxConfig(minimaxForm.value)
    showToastMsg('MiniMax 设置已保存')
}

// Fetch Models
const availableModels = ref([])
const showModelSelect = ref(false)
const isLoadingModels = ref(false)

const defaultTTSModels = [
    "speech-01-turbo",
    "speech-01-hd",
    "speech-02-turbo",
    "speech-02-hd",
    "speech-2.6-turbo",
    "speech-2.6-hd"
]

const fetchModels = async () => {
    // If no API key, use defaults
    if(!minimaxForm.value.apiKey || !minimaxForm.value.groupId) {
        showToastMsg('未填写 API Key 或 Group ID，使用默认列表')
        availableModels.value = defaultTTSModels
        showModelSelect.value = true
        // Set default if empty
        if(!minimaxForm.value.modelId) minimaxForm.value.modelId = defaultTTSModels[0]
        return
    }

    isLoadingModels.value = true
    try {
        const res = await fetch('https://api.minimax.chat/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + minimaxForm.value.apiKey,
                'Content-Type': 'application/json',
                'GroupId': minimaxForm.value.groupId
            },
            mode: 'cors'
        })

        if (res.ok) {
            const data = await res.json()
            const models = data.models || []
            // Filter TTS models
            const ttsModels = models
                .filter(m => m.model.startsWith('speech-'))
                .map(m => m.model)
            
            if (ttsModels.length > 0) {
                availableModels.value = ttsModels
                showToastMsg(`成功获取 ${ttsModels.length} 个模型`)
            } else {
                 showToastMsg('未找到 TTS 模型，使用默认列表')
                 availableModels.value = defaultTTSModels
            }
        } else {
             // Try to parse error
             try {
                const errData = await res.json()
                console.error('MiniMax API Error:', errData)
                showToastMsg('拉取失败: ' + (errData.base_resp?.status_msg || res.statusText))
             } catch(e) {
                showToastMsg('拉取失败: ' + res.status)
             }
             availableModels.value = defaultTTSModels
        }
    } catch (e) {
        console.error('Fetch error:', e)
        showToastMsg('网络错误: ' + e.message)
        availableModels.value = defaultTTSModels
    } finally {
        isLoadingModels.value = false
        showModelSelect.value = true
        // Auto select first if empty
        if(!minimaxForm.value.modelId && availableModels.value.length > 0) {
             minimaxForm.value.modelId = availableModels.value[0]
        }
    }
}

const selectModel = (model) => {
    minimaxForm.value.modelId = model
    showModelSelect.value = false
}

// Test TTS
const testTTS = () => {
    const text = "你好，我是乔乔。"
    if (voice.value.engine === 'browser') {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'zh-CN'
        window.speechSynthesis.speak(utterance)
        showToastMsg('正在播放本地语音...')
    } else {
        showToastMsg('MiniMax 语音测试暂未连接 API')
    }
}

</script>

<template>
  <div class="voice-settings w-full h-full bg-gray-50 flex flex-col">
    
    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100">
       <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">语音服务</span>
       </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        
        <!-- Engine Selection -->
        <div class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">语音引擎</h3>
            <div class="space-y-2">
                <div 
                    @click="setEngine('browser')"
                    class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition"
                    :class="voice.engine === 'browser' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200'"
                >
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-laptop-code"></i>
                        <span class="text-sm font-medium">本地 Browser TTS</span>
                    </div>
                    <i v-if="voice.engine === 'browser'" class="fa-solid fa-check text-blue-500"></i>
                </div>

                <div 
                    @click="setEngine('minimax')"
                    class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition"
                    :class="voice.engine === 'minimax' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200'"
                >
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-cloud"></i>
                        <span class="text-sm font-medium">MiniMax 云端语音</span>
                    </div>
                    <i v-if="voice.engine === 'minimax'" class="fa-solid fa-check text-blue-500"></i>
                </div>
            </div>

            <button @click="testTTS" class="w-full mt-3 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-200 transition">
                <i class="fa-solid fa-volume-high mr-1"></i> 测试发音
            </button>
        </div>

        <!-- MiniMax Settings -->
        <div v-if="voice.engine === 'minimax'" class="glass-panel p-4 rounded-[20px]">
             <h3 class="text-base font-bold text-gray-900 mb-3">MiniMax 参数配置</h3>
             <div class="space-y-3">
                 <div>
                     <label class="block text-xs text-gray-500 mb-1">Group ID</label>
                     <input v-model="minimaxForm.groupId" type="text" placeholder="输入 Group ID" class="setting-input w-full">
                 </div>
                 <div>
                     <label class="block text-xs text-gray-500 mb-1">API Key</label>
                     <input v-model="minimaxForm.apiKey" type="password" placeholder="输入 API Key" class="setting-input w-full">
                 </div>
                 
                 <div class="border-t border-gray-100 my-2 pt-2"></div>

                 <div>
                     <label class="block text-xs text-gray-500 mb-1">Model ID</label>
                     <div class="flex gap-2 relative">
                         <input v-model="minimaxForm.modelId" type="text" placeholder="speech-01-turbo" class="setting-input flex-1">
                         <button @click="fetchModels" class="setting-btn secondary w-12 flex items-center justify-center p-0" :disabled="isLoadingModels">
                             <i v-if="isLoadingModels" class="fa-solid fa-spinner fa-spin"></i>
                             <i v-else class="fa-solid fa-cloud-arrow-down"></i>
                         </button>
                         
                         <!-- Model Dropdown -->
                         <div v-if="showModelSelect" class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-[200px] overflow-y-auto">
                             <div class="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                 <span class="text-xs font-bold text-gray-500">选择模型</span>
                                 <i @click="showModelSelect = false" class="fa-solid fa-xmark text-gray-400 cursor-pointer"></i>
                             </div>
                             <div 
                                 v-for="model in availableModels" 
                                 :key="model" 
                                 @click="selectModel(model)"
                                 class="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer hover:text-blue-600 transition"
                             >
                                 {{ model }}
                             </div>
                         </div>
                     </div>
                 </div>
                 <div>
                     <label class="block text-xs text-gray-500 mb-1">Voice ID (音色)</label>
                     <input v-model="minimaxForm.voiceId" type="text" placeholder="例如: male-qn-qingse" class="setting-input w-full">
                 </div>

                 <button @click="saveMiniMax" class="w-full bg-blue-500 text-white py-2 rounded-xl text-sm mt-2 shadow-sm hover:shadow-md transition">
                    保存设置
                 </button>
             </div>
        </div>

    </div>

    <!-- Toast -->
    <div 
        v-if="showToast"
        class="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg z-50"
    >
        {{ toastMessage }}
    </div>

  </div>
</template>
