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

const isLoadingVoices = ref(false)

const initForm = () => {
    minimaxForm.value = { ...voice.value.minimax }
    doubaoForm.value = { 
        speaker: voice.value.doubao?.speaker || 'zh_female_sichuan'
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

const filteredVoices = computed(() => {
    const list = doubaoVoices.value || []
    if (!voiceSearchQuery.value) return list
    const q = voiceSearchQuery.value.toLowerCase()
    return list.filter(v =>
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.id && v.id.toLowerCase().includes(q))
    )
})

const selectVoice = (id) => {
    doubaoForm.value.speaker = id
    showVoicePicker.value = false
    voiceSearchQuery.value = ''
}

const currentVoiceName = computed(() => {
    const v = doubaoVoices.value.find(v => v.id === doubaoForm.value.speaker)
    return v ? v.name : (doubaoForm.value.speaker || '未选择')
})

const saveMiniMax = () => {
    store.updateMinimaxConfig(minimaxForm.value)
    showToastMsg('MiniMax 设置已保存')
}

const saveDoubao = () => {
    store.updateDoubaoConfig(doubaoForm.value)
    showToastMsg('豆包设置已保存')
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

const testTTS = async () => {
    const text = "你好，我是 Chilly。"
    const engine = voice.value.engine;

    if (engine === 'browser') {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'zh-CN'
        utterance.rate = voice.value.speed || 1.0
        window.speechSynthesis.speak(utterance)
        showToastMsg('正在测试本地语音...')
    } else if (engine === 'doubao') {
        let speaker = doubaoForm.value.speaker || 'zh_female_sichuan';

        // Setup Audio Player
        const playAudio = (blobOrBase64) => {
            let url;
            if (blobOrBase64 instanceof Blob) {
                url = URL.createObjectURL(blobOrBase64);
            } else {
                url = `data:audio/mp3;base64,${blobOrBase64}`;
            }
            const audio = new Audio(url);
            audio.play().catch(e => {
                console.error('播放失败:', e);
                showToastMsg('播放失败，请点击页面重试');
            });
        };

        // HTTP Strategy (Volcengine)
        const requestVolc = async (spk) => {
            try {
                const response = await fetch('/volc/crx/tts/v1/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, speaker: spk })
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                // 尝试解析JSON响应
                try {
                    const res = await response.json();
                    // 检查响应格式是否符合火山引擎的标准
                    if (res.base_resp?.status_code === 0 && res.audio?.data) {
                        return res.audio.data;
                    } else if (res.audio?.data) {
                        // 兼容其他格式的响应
                        return res.audio.data;
                    } else {
                        throw new Error(res.base_resp?.status_message || res.message || 'No audio data');
                    }
                } catch (jsonError) {
                    // 如果返回的是HTML而不是JSON，说明需要登录豆包
                    console.debug('火山语音返回非JSON响应:', jsonError);
                    // 直接回退到本地TTS，而不是抛出错误
                    return null;
                }
            } catch (error) {
                console.debug('火山语音请求失败:', error);
                // 失败时返回null，触发本地TTS兜底
                return null;
            }
        };

        // Execution Logic
        try {
            showToastMsg('正在请求火山语音...');
            const data = await requestVolc(speaker);
            
            if (data) {
                // 火山语音请求成功
                playAudio(data);
                showToastMsg('火山语音播放中');
            } else {
                // 火山语音请求失败，回退到本地TTS
                console.warn('火山语音请求失败，使用本地语音...');
                showToastMsg('火山语音请求失败，尝试使用本地语音...');
                
                // 回退到本地TTS
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'zh-CN';
                utterance.rate = voice.value.speed || 1.0;
                window.speechSynthesis.speak(utterance);
                showToastMsg('本地语音播放中');
            }
        } catch (fatalError) {
            showToastMsg('语音演示失败：需要登录豆包才能使用火山引擎语音功能');
            console.error('All attempts failed', fatalError);
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
                    <div v-for="eng in ['browser', 'minimax', 'doubao']" :key="eng" @click="setEngine(eng)"
                        class="flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 cursor-pointer"
                        :class="voice.engine === eng ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 hover:border-gray-300'">
                        <div class="flex items-center gap-3">
                            <i :class="{
                                'fa-solid fa-laptop-code': eng === 'browser',
                                'fa-solid fa-cloud': eng === 'minimax',
                                'fa-solid fa-robot': eng === 'doubao'
                            }"></i>
                            <span class="font-medium">{{
                                eng === 'browser' ? '本地 Browser TTS' :
                                    eng === 'minimax' ? 'MiniMax 云端语音' : '豆包 Doubao'
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
                            <h2 class="text-xl font-black text-gray-900">选择音色 (Doubao)</h2>
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
