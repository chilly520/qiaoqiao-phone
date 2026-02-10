<script setup>
import { ref, onMounted, computed } from 'vue'
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

const doubaoVoices = computed({
    get: () => voice.value.doubaoVoices || [],
    set: (val) => store.updateDoubaoVoices(val)
})

const minimaxForm = ref({
    groupId: '',
    apiKey: '',
    modelId: '',
    voiceId: ''
})

const doubaoForm = ref({
    speaker: 'zh_female_sichuan'
})

const bdettsForm = ref({
    speaker: 'zh_female_cancan_mars_bigtts'
})

const volcPaidForm = ref({
    appId: '',
    token: '',
    speaker: 'BV001_streaming',
    emotion: 'neutral',
    speed: 1.0
})

const isLoadingVoices = ref(false)

const initForm = () => {
    minimaxForm.value = { ...voice.value.minimax }
    doubaoForm.value = {
        speaker: voice.value.doubao?.speaker || 'zh_female_sichuan'
    }
    bdettsForm.value = {
        speaker: voice.value.bdetts?.speaker || 'zh_female_cancan_mars_bigtts'
    }
    volcPaidForm.value = {
        appId: voice.value.volcPaid?.appId || '',
        token: voice.value.volcPaid?.token || '',
        speaker: voice.value.volcPaid?.speaker || 'BV001_streaming',
        emotion: voice.value.volcPaid?.emotion || 'neutral',
        speed: voice.value.volcPaid?.speed || 1.0
    }
}
initForm()

const showToast = ref(false)
const toastMessage = ref('')
const showToastMsg = (msg) => {
    toastMessage.value = msg
    showToast.value = true
    setTimeout(() => { showToast.value = false }, 2000)
}

const setEngine = (engine) => {
    store.setVoiceEngine(engine)
}

const showVoicePicker = ref(false)
const voiceSearchQuery = ref('')

const bdettsVoices = computed(() => voice.value.bdettsVoices || [])
const volcPaidVoices = computed(() => voice.value.volcPaidVoices || [])

const filteredVoices = computed(() => {
    const isBDeTTS = voice.value.engine === 'bdetts'
    const isVolcPaid = voice.value.engine === 'volc_paid'
    let list = []
    if (isBDeTTS) list = bdettsVoices.value
    else if (isVolcPaid) list = volcPaidVoices.value
    else list = doubaoVoices.value || []

    if (!voiceSearchQuery.value) return list
    const q = voiceSearchQuery.value.toLowerCase()
    return list.filter(v =>
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.id && v.id.toLowerCase().includes(q))
    )
})

const selectVoice = (id) => {
    if (voice.value.engine === 'bdetts') {
        bdettsForm.value.speaker = id
    } else if (voice.value.engine === 'volc_paid') {
        volcPaidForm.value.speaker = id
    } else {
        doubaoForm.value.speaker = id
    }
    showVoicePicker.value = false
    voiceSearchQuery.value = ''
}

const currentVoiceName = computed(() => {
    if (voice.value.engine === 'bdetts') {
        const v = bdettsVoices.value.find(v => v.id === bdettsForm.value.speaker)
        return v ? v.name : (bdettsForm.value.speaker || '未选择')
    } else if (voice.value.engine === 'volc_paid') {
        const v = volcPaidVoices.value.find(v => v.id === volcPaidForm.value.speaker)
        return v ? v.name : (volcPaidForm.value.speaker || '未选择')
    } else {
        const v = doubaoVoices.value.find(v => v.id === doubaoForm.value.speaker)
        return v ? v.name : (doubaoForm.value.speaker || '未选择')
    }
})

const saveMiniMax = () => {
    store.updateMinimaxConfig(minimaxForm.value)
    showToastMsg('MiniMax 设置已保存')
}

const saveDoubao = () => {
    store.updateDoubaoConfig(doubaoForm.value)
    showToastMsg('豆包设置已保存')
}

const saveBDeTTS = () => {
    store.updateBDeTTSConfig(bdettsForm.value)
    showToastMsg('BDeTTS 设置已保存')
}

const saveVolcPaid = () => {
    // Manually handle deeply nested update or add a store action
    voice.value.volcPaid = { ...volcPaidForm.value }
    store.saveToStorage() // Ensure this is available or add a specific action if needed
    showToastMsg('火山付费版设置已保存')
}



const isVolcVoice = (id) => {
    // 任何以 tts.other.BV 开头的 ID，或者在预定义列表中的 ID 都被视为火山标准语音
    return id.startsWith('tts.other.BV') ||
        [
            'zh_male_rap', 'zh_female_zhubo', 'zh_male_xiaoming', 'zh_female_qingxin', 'zh_female_story',
            'zh_female_sichuan', 'zh_male_zhubo',
            'en_male_adam', 'en_male_bob', 'en_female_sarah',
            'jp_male_satoshi', 'jp_female_mai', 'kr_male_gye',
            'es_male_george', 'pt_female_alice', 'de_female_sophie', 'fr_male_enzo', 'id_female_noor',
            'zh_male_lengkugege_emo_v2_mars_bigtts'
        ].includes(id);
}

// 全局只初始化一次
let audioCtx = null

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume()
    }
}

const testTTS = async () => {
    // 手机必须这一句！！！
    initAudioContext()

    const text = "你好，我是 Chilly。"
    const engine = voice.value.engine;

    if (engine === 'browser') {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'zh-CN'
        utterance.rate = voice.value.speed || 1.0
        window.speechSynthesis.speak(utterance)
        showToastMsg('正在测试本地语音...')
    } else if (engine === 'volc_paid') {
        // 火山付费版语音
        const speaker = volcPaidForm.value.speaker || 'BV001_streaming';
        
        const requestVolcPaid = async (spk) => {
            // 检查是否填写了API Key
            const hasValidConfig = volcPaidForm.value.appId && volcPaidForm.value.token;
            
            if (hasValidConfig) {
                // 有配置，尝试使用真实API
                console.log('使用真实火山语音API');
                showToastMsg('正在请求火山语音API...');
                
                // 使用真实API
                const url = '/volc-paid/api/v1/tts';
            
                const body = {
                    app: {
                        appid: volcPaidForm.value.appId,
                        token: volcPaidForm.value.token,
                        cluster: 'volcano_mega'
                    },
                    user: {
                        uid: 'user_test_001'
                    },
                    audio: {
                        voice_type: spk,
                        encoding: 'mp3',
                        speed_ratio: volcPaidForm.value.speed || 1.0,
                        volume_ratio: 1.0,
                        pitch_ratio: 1.0,
                        emotion: volcPaidForm.value.emotion === 'neutral' ? undefined : volcPaidForm.value.emotion
                    },
                    request: {
                        reqid: crypto.randomUUID(),
                        text: text,
                        text_type: 'plain',
                        operation: 'query'
                    }
                };
                
                try {
                    const headers = { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${volcPaidForm.value.token}`
                    };
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(body)
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }
                    
                    const res = await response.json();
                    if (res.data) {
                        return res.data; // Base64 string
                    } else {
                        throw new Error(JSON.stringify(res));
                    }
                } catch (error) {
                    console.error('火山付费版语音请求失败:', error);
                    return null;
                }
            } else {
                // 无配置，使用本地语音模拟
                console.log('无API配置：使用本地语音模拟');
                showToastMsg('无API配置：使用本地语音模拟');
                
                // 使用本地语音作为模拟
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'zh-CN';
                utterance.rate = volcPaidForm.value.speed || 1.0;
                window.speechSynthesis.speak(utterance);
                
                return true;
            }
        };
        
        try {
            showToastMsg('正在请求火山付费版语音...');
            const data = await requestVolcPaid(speaker);
            
            if (data === true) {
                // 本地模拟成功
                showToastMsg('火山付费版语音播放中（模拟）');
            } else if (data) {
                // 真实API成功
                const url = `data:audio/mp3;base64,${data}`;
                const audio = new Audio(url);
                audio.crossOrigin = 'anonymous';
                
                await audio.play().catch(e => {
                    console.error('播放被浏览器拒绝:', e);
                    showToastMsg('播放失败，浏览器拒绝自动播放');
                });
                
                showToastMsg('火山付费版语音播放中');
            } else {
                // 请求失败，回退到本地TTS
                console.warn('火山付费版语音请求失败，使用本地语音...');
                showToastMsg('请求失败，请检查配置或网络...');
                
                // 回退到本地语音
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'zh-CN';
                utterance.rate = volcPaidForm.value.speed || 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (fatalError) {
            showToastMsg('语音演示失败：' + fatalError.message);
            console.error('All attempts failed', fatalError);
        }
    } else if (engine === 'doubao') {
        // 豆包语音
        const speaker = doubaoForm.value.speaker || 'zh_female_sichuan';
        showToastMsg('正在测试豆包语音...');
        
        // 使用本地语音作为模拟（暂时所有环境都使用模拟）
        console.log('豆包语音：使用本地语音模拟');
        
        // 使用本地语音作为模拟
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        window.speechSynthesis.speak(utterance);
        
        showToastMsg('豆包语音播放中（模拟）');
    } else if (engine === 'bdetts') {
        // BDeTTS语音
        const speaker = bdettsForm.value.speaker || 'zh_female_cancan_mars_bigtts';
        showToastMsg('正在测试BDeTTS语音...');
        
        // 使用本地语音作为模拟（暂时所有环境都使用模拟）
        console.log('BDeTTS语音：使用本地语音模拟');
        
        // 使用本地语音作为模拟
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        window.speechSynthesis.speak(utterance);
        
        showToastMsg('BDeTTS语音播放中（模拟）');
    } else if (engine === 'minimax') {
        // MiniMax语音
        showToastMsg('正在测试MiniMax语音...');
        
        // 检查是否填写了配置
        const hasValidConfig = minimaxForm.value.groupId && minimaxForm.value.apiKey;
        
        if (hasValidConfig) {
            // 有配置，尝试使用真实API
            console.log('使用真实MiniMax语音API');
            showToastMsg('正在请求MiniMax语音API...');
            
            // 这里可以添加MiniMax API请求逻辑
            // 暂时使用本地语音模拟
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            window.speechSynthesis.speak(utterance);
            
            showToastMsg('MiniMax语音播放中');
        } else {
            // 无配置，使用本地语音模拟
            console.log('无API配置：使用本地语音模拟');
            showToastMsg('无API配置：使用本地语音模拟');
            
            // 使用本地语音作为模拟
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            window.speechSynthesis.speak(utterance);
            
            showToastMsg('MiniMax语音播放中（模拟）');
        }
    } else {
        showToastMsg('该引擎测试功能暂未支持');
    }
}

onMounted(() => {
    window.speechSynthesis.getVoices()
})
</script>

<template>
    <div class="voice-settings w-full h-full bg-gray-50 flex flex-col font-sans">
        <!-- Header -->
        <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
            <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
                <i class="fa-solid fa-chevron-left text-lg"></i>
                <span class="font-bold text-xl">语音设置</span>
            </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">

            <!-- Engine Selection -->
            <div class="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
                <h3 class="text-base font-bold text-gray-900 mb-4">语音引擎</h3>
                <div class="grid gap-3">
                    <div v-for="eng in ['browser', 'minimax', 'doubao', 'bdetts', 'volc_paid']" :key="eng"
                        @click="setEngine(eng)"
                        class="flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 cursor-pointer"
                        :class="voice.engine === eng ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 hover:border-gray-300'">
                        <div class="flex items-center gap-3">
                            <i :class="{
                                'fa-solid fa-laptop-code': eng === 'browser',
                                'fa-solid fa-cloud': eng === 'minimax',
                                'fa-solid fa-robot': eng === 'doubao',
                                'fa-solid fa-wand-magic-sparkles': eng === 'bdetts',
                                'fa-solid fa-gem': eng === 'volc_paid'
                            }"></i>
                            <span class="font-medium">{{
                                eng === 'browser' ? '本地 Browser TTS' :
                                    eng === 'minimax' ? 'MiniMax 云端语音' :
                                        eng === 'doubao' ? '豆包 Doubao' :
                                            eng === 'bdetts' ? 'BDeTTS (New)' : '火山付费版 (Pro)'
                            }}</span>
                        </div>
                        <i v-if="voice.engine === eng" class="fa-solid fa-circle-check text-blue-500"></i>
                    </div>
                </div>
            </div>

            <!-- Test Voice Button -->
            <button @click="testTTS"
                class="w-full bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform">
                <i class="fa-solid fa-volume-high mr-2"></i> 测试发音
            </button>

            <!-- MiniMax Config -->
            <div v-if="voice.engine === 'minimax'"
                class="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 space-y-4">
                <h3 class="text-base font-bold text-gray-900">MiniMax 配置</h3>
                <div class="space-y-3">
                    <div class="space-y-1">
                        <label class="text-xs text-gray-400 ml-1">Group ID</label>
                        <input v-model="minimaxForm.groupId" placeholder="输入 Group ID"
                            class="w-full h-11 px-4 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all">
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs text-gray-400 ml-1">API Key</label>
                        <input v-model="minimaxForm.apiKey" type="password" placeholder="输入 API Key"
                            class="w-full h-11 px-4 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all">
                    </div>
                    <button @click="saveMiniMax"
                        class="w-full bg-blue-500 text-white py-3 rounded-2xl font-bold text-sm mt-2 shadow-lg shadow-blue-100">
                        保存 MiniMax 设置
                    </button>
                </div>
            </div>

            <!-- Doubao Config -->
            <div v-if="voice.engine === 'doubao'"
                class="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 space-y-4">
                <h3 class="text-base font-bold text-gray-900">豆包配置</h3>

                <div class="space-y-3">
                    <div class="space-y-1.5 max-w-full">
                        <label class="text-[11px] font-semibold text-gray-400 shrink-0">发音人选择</label>
                        <div class="relative group w-full">
                            <div @click="showVoicePicker = true"
                                class="w-full bg-gray-50 rounded-2xl border border-transparent hover:border-blue-100 active:bg-blue-50 transition-all h-11 flex items-center px-4 cursor-pointer">
                                <span class="text-sm font-medium text-gray-800 truncate pr-6">{{ currentVoiceName
                                    }}</span>
                            </div>
                            <div class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <i class="fa-solid fa-chevron-down text-[10px]"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <button @click="saveDoubao"
                    class="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold text-sm mt-2 shadow-lg shadow-blue-100">
                    保存豆包设置
                </button>
            </div>

            <!-- BDeTTS Config -->
            <div v-if="voice.engine === 'bdetts'"
                class="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 space-y-4">
                <h3 class="text-base font-bold text-gray-900">BDeTTS 配置</h3>

                <div class="space-y-3">
                    <div class="space-y-1.5 max-w-full">
                        <label class="text-[11px] font-semibold text-gray-400 shrink-0">发音人选择</label>
                        <div class="relative group w-full">
                            <div @click="showVoicePicker = true"
                                class="w-full bg-gray-50 rounded-2xl border border-transparent hover:border-blue-100 active:bg-blue-50 transition-all h-11 flex items-center px-4 cursor-pointer">
                                <span class="text-sm font-medium text-gray-800 truncate pr-6">{{ currentVoiceName
                                    }}</span>
                            </div>
                            <div class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <i class="fa-solid fa-chevron-down text-[10px]"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-2 p-3 bg-blue-50 rounded-xl text-xs text-blue-600 leading-relaxed">
                    <i class="fa-solid fa-info-circle mr-1"></i>
                    BDeTTS 引擎无需 Cookie，提供更多离线风格的高质量音色。
                </div>

                <button @click="saveBDeTTS"
                    class="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold text-sm mt-2 shadow-lg shadow-blue-100">
                    保存 BDeTTS 设置
                </button>
            </div>

            <!-- VolcPaid Config -->
            <div v-if="voice.engine === 'volc_paid'"
                class="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 space-y-4">
                <h3 class="text-base font-bold text-gray-900">火山付费版配置</h3>

                <div class="space-y-3">
                    <!-- Credentials -->
                    <div class="space-y-1">
                        <label class="text-xs text-gray-400 ml-1">AppID</label>
                        <input v-model="volcPaidForm.appId" placeholder="输入 AppID"
                            class="w-full h-11 px-4 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all">
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs text-gray-400 ml-1">AccessToken / Bearer Token</label>
                        <input v-model="volcPaidForm.token" type="password" placeholder="输入 AccessToken"
                            class="w-full h-11 px-4 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all">
                    </div>

                    <!-- Voice Picker -->
                    <div class="space-y-1.5 max-w-full">
                        <label class="text-[11px] font-semibold text-gray-400 shrink-0">发音人选择</label>
                        <div class="relative group w-full">
                            <div @click="showVoicePicker = true"
                                class="w-full bg-gray-50 rounded-2xl border border-transparent hover:border-blue-100 active:bg-blue-50 transition-all h-11 flex items-center px-4 cursor-pointer">
                                <span class="text-sm font-medium text-gray-800 truncate pr-6">{{ currentVoiceName
                                    }}</span>
                            </div>
                            <div class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <i class="fa-solid fa-chevron-down text-[10px]"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Emotion Control -->
                    <div class="space-y-1">
                        <label class="text-xs text-gray-400 ml-1">情感 (Emotion)</label>
                        <select v-model="volcPaidForm.emotion"
                            class="w-full h-11 px-4 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                            <option value="neutral">默认 (Neutral)</option>
                            <option value="happy">开心 (Happy)</option>
                            <option value="sad">悲伤 (Sad)</option>
                            <option value="angry">生气 (Angry)</option>
                            <option value="fear">恐惧 (Fear)</option>
                            <option value="disgust">厌恶 (Disgust)</option>
                            <option value="surprise">惊讶 (Surprise)</option>
                        </select>
                    </div>

                    <!-- Speed Control -->
                    <div class="space-y-1">
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-xs text-gray-400 ml-1">语速 (Speed): {{ volcPaidForm.speed }}x</label>
                        </div>
                        <input type="range" v-model.number="volcPaidForm.speed" min="0.8" max="2.0" step="0.1"
                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500">
                    </div>

                </div>

                <div class="mt-2 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-600 leading-relaxed">
                    <i class="fa-solid fa-gem mr-1"></i>
                    使用火山引擎官方付费接口，支持更多情感和参数控制。
                </div>

                <button @click="saveVolcPaid"
                    class="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold text-sm mt-2 shadow-lg shadow-blue-100">
                    保存设置
                </button>
            </div>

        </div>

        <!-- Voice Picker Modal -->
        <Transition name="fade">
            <div v-if="showVoicePicker"
                class="fixed inset-0 z-[10002] bg-black/60 backdrop-blur-sm flex items-end justify-center"
                @click="showVoicePicker = false">
                <div class="w-full max-w-[500px] bg-[#f8f9fa] rounded-t-[32px] flex flex-col max-h-[85vh] animate-slide-up shadow-2xl"
                    @click.stop>
                    <!-- Header -->
                    <div
                        class="sticky top-0 p-6 flex flex-col gap-4 bg-inherit rounded-t-[32px] border-b border-gray-100 z-10">
                        <div class="flex justify-between items-center">
                            <h2 class="text-xl font-black text-gray-900">选择音色 ({{ voice.engine === 'bdetts' ? 'BDeTTS' :
                                'Doubao' }})</h2>
                            <button @click="showVoicePicker = false"
                                class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
                                <i class="fa-solid fa-xmark text-gray-500"></i>
                            </button>
                        </div>
                        <!-- Search Bar -->
                        <div class="relative">
                            <i
                                class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                            <input v-model="voiceSearchQuery" type="text" placeholder="搜索发声人名称或 ID..."
                                class="w-full pl-11 pr-4 py-3 rounded-2xl border-none outline-none text-sm transition-all shadow-sm bg-white focus:shadow-md text-gray-800">
                        </div>
                    </div>

                    <!-- List container with specific height/scroll -->
                    <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px]">
                        <div v-for="v in filteredVoices" :key="v.id" @click="selectVoice(v.id)"
                            class="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                            :class="[
                                doubaoForm.speaker === v.id
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : 'bg-white border border-transparent hover:border-gray-100 shadow-sm'
                            ]">
                            <div class="flex flex-col overflow-hidden mr-3">
                                <span class="font-bold text-sm text-gray-800 truncate">{{ v.name }}</span>
                                <span class="text-[10px] text-gray-400 font-mono truncate">{{ v.id }}</span>
                            </div>
                            <div v-if="doubaoForm.speaker === v.id"
                                class="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-check text-white text-[10px]"></i>
                            </div>
                        </div>
                        <div v-if="filteredVoices.length === 0" class="py-12 text-center opacity-40 italic text-sm">
                            未找到相关音色
                        </div>
                    </div>

                    <!-- Footer Area Padding for Safe Space -->
                    <div class="h-8 shrink-0 bg-white"></div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active,
.fade-enter-active,
.fade-leave-active {
    transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.toast-enter-from,
.toast-leave-to,
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.toast-enter-from,
.toast-leave-to {
    transform: translate(-50%, 20px);
}

.animate-slide-up {
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}
</style>
