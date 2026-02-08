<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const store = useSettingsStore()
const { voice } = storeToRefs(store)

const goBack = () => {
    if (window.history.state && window.history.state.back) {
        router.back()
    } else {
        router.push('/settings')
    }
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

const doubaoForm = ref({
    cookie: '',
    speaker: 'tts.other.BV008_streaming'
})

// Initialize form from store
const initForm = () => {
    minimaxForm.value = { ...voice.value.minimax }
    doubaoForm.value = { ...voice.value.doubao }
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

const saveDoubao = () => {
    store.updateDoubaoConfig(doubaoForm.value)
    showToastMsg('豆包设置已保存')
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
    if (!minimaxForm.value.apiKey || !minimaxForm.value.groupId) {
        showToastMsg('未填写 API Key 或 Group ID，使用默认列表')
        availableModels.value = defaultTTSModels
        showModelSelect.value = true
        // Set default if empty
        if (!minimaxForm.value.modelId) minimaxForm.value.modelId = defaultTTSModels[0]
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
            } catch (e) {
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
        if (!minimaxForm.value.modelId && availableModels.value.length > 0) {
            minimaxForm.value.modelId = availableModels.value[0]
        }
    }
}

const selectModel = (model) => {
    minimaxForm.value.modelId = model
    showModelSelect.value = false
}

const doubaoVoices = [
    { name: "霸道总裁 (推荐)", id: "tts.other.BV008_streaming" },
    { name: "冷酷哥哥", id: "zh_male_rap" },
    { name: "温柔姐姐", id: "zh_female_zhubo" },
    { name: "阳光青年", id: "zh_male_xiaoming" },
    { name: "温柔小妹", id: "zh_female_qingxin" },
    { name: "故事姐姐", id: "zh_female_story" },
    { name: "广西老表", id: "tts.other.BV029_streaming" },
    { name: "奶气萌娃", id: "tts.other.BV056_streaming" }
]

// Test TTS
const testTTS = async () => {
    const text = "你好，我是 Chilly。"
    const engine = voice.value.engine;

    if (engine === 'browser') {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'zh-CN'
        utterance.rate = voice.value.speed || 1.0
        const voices = window.speechSynthesis.getVoices()
        const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('CN'))
        if (zhVoice) utterance.voice = zhVoice
        window.speechSynthesis.speak(utterance)
        showToastMsg(`正在播放本地语音 (倍速: ${utterance.rate})...`)
    } else if (engine === 'doubao') {
        showToastMsg('正在请求豆包语音...')
        try {
            const speaker = doubaoForm.value.speaker || 'tts.other.BV008_streaming';
            const response = await fetch('/volc/crx/tts/v1/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, speaker })
            });
            const res = await response.json();
            if (res.audio?.data) {
                const audio = new Audio(`data:audio/mp3;base64,${res.audio.data}`);
                audio.play();
                showToastMsg('豆包语音播放中');
            } else {
                showToastMsg('豆包接口返回错误: ' + (res.base_resp?.status_message || '未知错误'));
            }
        } catch (e) {
            showToastMsg('请求失败，请检查网络或代理设置');
            console.error(e);
        }
    } else {
        showToastMsg('该引擎测试功能暂未支持');
    }
}

onMounted(() => {
    // Force load voices
    window.speechSynthesis.getVoices()
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices()
        }
    }
})

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
                    <div @click="setEngine('browser')"
                        class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition"
                        :class="voice.engine === 'browser' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200'">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-laptop-code"></i>
                            <span class="text-sm font-medium">本地 Browser TTS</span>
                        </div>
                        <i v-if="voice.engine === 'browser'" class="fa-solid fa-check text-blue-500"></i>
                    </div>

                    <div @click="setEngine('minimax')"
                        class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition"
                        :class="voice.engine === 'minimax' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200'">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-cloud"></i>
                            <span class="text-sm font-medium">MiniMax 云端语音</span>
                        </div>
                        <i v-if="voice.engine === 'minimax'" class="fa-solid fa-check text-blue-500"></i>
                    </div>

                    <div @click="setEngine('doubao')"
                        class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition"
                        :class="voice.engine === 'doubao' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200'">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-robot"></i>
                            <span class="text-sm font-medium">豆包 Doubao (Cookie)</span>
                        </div>
                        <i v-if="voice.engine === 'doubao'" class="fa-solid fa-check text-blue-500"></i>
                    </div>
                </div>
            </div>


            <button @click="testTTS"
                class="w-full mt-3 bg-gray-100 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-200 transition">
                <i class="fa-solid fa-volume-high mr-1"></i> 测试发音
            </button>

            <!-- TTS Speed Slider -->
            <div class="mt-4 pt-3 border-t border-gray-100">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-sm font-medium text-gray-700">全局默认语速</label>
                    <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{{ voice.speed
                        }}x</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] text-gray-400">0.5</span>
                    <input type="range" v-model.number="voice.speed" min="0.5" max="2.0" step="0.1"
                        class="flex-1 accent-blue-500 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                        @change="store.saveToStorage()">
                    <span class="text-[10px] text-gray-400">2.0</span>
                </div>
                <p class="text-[10px] text-gray-400 mt-2">注：角色单独设置的语速将优先于全局设置。</p>
            </div>
        </div>

        <!-- MiniMax Settings -->
        <div v-if="voice.engine === 'minimax'" class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">MiniMax 参数配置</h3>
            <div class="space-y-3">
                <div>
                    <label class="block text-xs text-gray-500 mb-1">Group ID</label>
                    <input v-model="minimaxForm.groupId" type="text" placeholder="输入 Group ID"
                        class="setting-input w-full">
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">API Key</label>
                    <input v-model="minimaxForm.apiKey" type="password" placeholder="输入 API Key"
                        class="setting-input w-full">
                </div>

                <div class="border-t border-gray-100 my-2 pt-2"></div>

                <div>
                    <label class="block text-xs text-gray-500 mb-1">Model ID</label>
                    <div class="flex gap-2 relative">
                        <input v-model="minimaxForm.modelId" type="text" placeholder="speech-01-turbo"
                            class="setting-input flex-1">
                        <button @click="fetchModels"
                            class="setting-btn secondary w-12 flex items-center justify-center p-0"
                            :disabled="isLoadingModels">
                            <i v-if="isLoadingModels" class="fa-solid fa-spinner fa-spin"></i>
                            <i v-else class="fa-solid fa-cloud-arrow-down"></i>
                        </button>

                        <!-- Model Dropdown -->
                        <div v-if="showModelSelect"
                            class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-[200px] overflow-y-auto">
                            <div class="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <span class="text-xs font-bold text-gray-500">选择模型</span>
                                <i @click="showModelSelect = false"
                                    class="fa-solid fa-xmark text-gray-400 cursor-pointer"></i>
                            </div>
                            <div v-for="model in availableModels" :key="model" @click="selectModel(model)"
                                class="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer hover:text-blue-600 transition">
                                {{ model }}
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">Voice ID (音色)</label>
                    <input v-model="minimaxForm.voiceId" type="text" placeholder="例如: male-qn-qingse"
                        class="setting-input w-full">
                </div>

                <button @click="saveMiniMax"
                    class="w-full bg-blue-500 text-white py-2 rounded-xl text-sm mt-2 shadow-sm hover:shadow-md transition">
                    保存 MiniMax 设置
                </button>
            </div>
        </div>

        <!-- Doubao Settings -->
        <div v-if="voice.engine === 'doubao'" class="glass-panel p-4 rounded-[20px]">
            <h3 class="text-base font-bold text-gray-900 mb-3">豆包 Doubao 配置</h3>
            <div class="space-y-3">
                <div class="bg-blue-50 p-3 rounded-xl mb-2">
                    <p class="text-[10px] text-blue-600 leading-relaxed">
                        <i class="fa-solid fa-circle-info mr-1"></i>
                        请从 <a href="https://www.doubao.com" target="_blank" class="underline font-bold">doubao.com</a>
                        获取 Cookie。
                    </p>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">豆包 Cookie</label>
                    <textarea v-model="doubaoForm.cookie" rows="3" placeholder="输入完整 Cookie 字符串"
                        class="setting-input w-full py-2 resize-none"></textarea>
                </div>

                <div>
                    <label class="block text-xs text-gray-500 mb-1">发音人 (Speaker)</label>
                    <select v-model="doubaoForm.speaker" class="setting-input w-full bg-white px-2">
                        <option v-for="v in doubaoVoices" :key="v.id" :value="v.id">{{ v.name }}</option>
                    </select>
                </div>

                <button @click="saveDoubao"
                    class="w-full bg-blue-600 text-white py-2 rounded-xl text-sm mt-2 shadow-sm hover:shadow-md transition font-bold">
                    保存豆包设置
                </button>
            </div>
        </div>

    </div>

    <!-- Toast -->
    <div v-if="showToast"
        class="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg z-50">
        {{ toastMessage }}
    </div>

    </div>
</template>
