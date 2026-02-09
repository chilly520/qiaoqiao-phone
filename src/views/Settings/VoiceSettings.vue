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
    cookie: '',
    speaker: 'zh_female_sichuan'
})

const isLoadingVoices = ref(false)

const initForm = () => {
    minimaxForm.value = { ...voice.value.minimax }
    doubaoForm.value = { ...voice.value.doubao }
}
initForm()

const generateId = () => {
    const num1 = Math.floor(1e8 + 9e8 * Math.random())
    const num2 = Math.floor(1e8 + 9e8 * Math.random())
    return String(num1) + String(num2)
}

const fetchDoubaoVoices = async () => {
    if (!doubaoForm.value.cookie) {
        showToastMsg('请先输入豆包 Cookie')
        return
    }

    isLoadingVoices.value = true
    try {
        const currentId = generateId()

        // 使用代理转发请求
        const response = await fetch('/doubao/alice/user_voice/recommend?language=zh&browser_language=zh-CN&mode=0&language=zh&browser_language=zh-CN&device_platform=web&aid=586861&real_aid=586861&pkg_type=release_version&device_id=' + currentId + '&tea_uuid=' + currentId + '&web_id=' + currentId + '&is_new_user=0&region=CN&sys_region=CN&use-olympus-account=1&samantha_web=1&version=1.20.1&version_code=20800&pc_version=1.20.1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Doubao-Cookie': doubaoForm.value.cookie
            },
            body: JSON.stringify({
                page_index: 1,
                page_size: 200,
                recommend_type: 1,
                tab_key: ""
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.code === 0 && data.data && data.data.ugc_voice_list) {
            // 合并现有列表和新获取的列表，保留已有项（避免覆盖手动添加的）
            const newVoices = data.data.ugc_voice_list.map(v => ({
                name: v.name,
                id: v.style_id
            }));

            // 使用 Map 去重，优先保留新获取的（以此更新状态），还是保留本地的？
            // 这里选择：先保留本地的离线列表，再追加 fetch 到的新发音人
            const voiceMap = new Map();
            doubaoVoices.value.forEach(v => voiceMap.set(v.id, v));
            newVoices.forEach(v => {
                if (!voiceMap.has(v.id)) {
                    voiceMap.set(v.id, v);
                }
            });

            doubaoVoices.value = Array.from(voiceMap.values());
            showToastMsg('发声人列表更新成功');
        } else {
            throw new Error('API 返回格式错误');
        }
    } catch (e) {
        console.error('Fetch voices error:', e);
        showToastMsg('获取失败，保持离线列表');
    } finally {
        isLoadingVoices.value = false;
    }
}

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

const autoGetCookie = () => {
    showLoginGuide.value = true
}

const closeLoginGuide = () => {
    showLoginGuide.value = false
}

const showImportModal = ref(false)
const importJsonText = ref('')

const openImportModal = () => {
    showImportModal.value = true
    importJsonText.value = ''
}

const closeImportModal = () => {
    showImportModal.value = false
}

const importVoices = () => {
    try {
        const json = JSON.parse(importJsonText.value)
        const list = Array.isArray(json) ? json : [json]
        let count = 0

        const newVoices = []

        list.forEach(item => {
            // Support the format from the screenshot (TTS Server export)
            if (item.config && item.config.source && item.config.source.voice) {
                newVoices.push({
                    name: item.displayName || item.name || '未命名',
                    id: item.config.source.voice
                })
                count++
            }
            // Support simple format {name: "", id: ""}
            else if (item.name && item.id) {
                newVoices.push(item)
                count++
            }
        })

        if (count > 0) {
            // Merge with existing voices or replace?
            // Let's prepend them to be visible
            const existingIds = new Set(doubaoVoices.value.map(v => v.id))
            const uniqueNewVoices = newVoices.filter(v => !existingIds.has(v.id))

            doubaoVoices.value = [...uniqueNewVoices, ...doubaoVoices.value]

            // Auto-select the first imported voice
            if (uniqueNewVoices.length > 0) {
                doubaoForm.value.speaker = uniqueNewVoices[0].id
            }

            showToastMsg(`成功导入 ${count} 个发声人`)
            closeImportModal()
        } else {
            showToastMsg('未找到有效的发声人配置')
        }
    } catch (e) {
        showToastMsg('JSON 格式错误')
        console.error(e)
    }
}

const openDoubaoLogin = () => {
    window.open('https://www.doubao.com/chat', '_blank')
    closeLoginGuide()
    showToastMsg('请在新打开的页面登录豆包')
}

const copyCookieCode = () => {
    const code = "javascript:alert(document.cookie)"
    navigator.clipboard.writeText(code).then(() => {
        showToastMsg('获取代码已复制到剪贴板')
    }).catch(() => {
        showToastMsg('复制失败，请手动复制')
    })
}

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
        let speaker = doubaoForm.value.speaker || 'tts.other.BV008_streaming';

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
            const response = await fetch('/volc/crx/tts/v1/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, speaker: spk })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const res = await response.json();
            if (res.audio?.data) return res.audio.data;
            throw new Error(res.message || 'No audio data');
        };

        // WebSocket Strategy (Doubao Custom/ICL)
        const requestDoubaoWS = (spk) => {
            return new Promise((resolve, reject) => {
                const currentId = generateId()
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsBase = `${wsProtocol}//${window.location.host}/ws-doubao/samantha/audio/tts`;
                const params = new URLSearchParams({
                    format: 'aac',
                    speaker: spk,
                    speech_rate: '0',
                    pitch: '0',
                    mode: '0',
                    language: 'zh',
                    browser_language: 'zh-CN',
                    device_platform: 'web',
                    aid: '586861',
                    real_aid: '586861',
                    pkg_type: 'release_version',
                    device_id: currentId,
                    tea_uuid: currentId,
                    web_id: currentId,
                    is_new_user: '0',
                    region: 'CN',
                    sys_region: 'CN',
                    use_olympus_account: '1',
                    samantha_web: '1',
                    version: '1.20.1',
                    version_code: '20800',
                    pc_version: '1.20.1',
                    doubao_cookie: doubaoForm.value.cookie
                })

                const ws = new WebSocket(`${wsBase}?${params.toString()}`);
                const audioChunks = [];

                ws.onopen = () => {
                    ws.send(JSON.stringify({
                        event: 'text',
                        podcast_extra: { role: '' },
                        text: text
                    }));
                    ws.send(JSON.stringify({ event: 'finish' }));
                };

                ws.onmessage = (event) => {
                    if (event.data instanceof Blob) audioChunks.push(event.data);
                };

                ws.onerror = (e) => reject(e);

                ws.onclose = () => {
                    if (audioChunks.length > 0) {
                        resolve(new Blob(audioChunks, { type: 'audio/aac' }));
                    } else {
                        reject(new Error('WS Closed without audio'));
                    }
                };

                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                        ws.close();
                        reject(new Error('Timeout'));
                    }
                }, 10000);
            });
        };

        // Execution Logic
        try {
            // Determine Strategy
            const useWS = !isVolcVoice(speaker);

            if (useWS) {
                if (!doubaoForm.value.cookie) {
                    showToastMsg('自定义发音人需要 Cookie，尝试使用兜底语音...');
                    const fallbackData = await requestVolc('tts.other.BV008_streaming');
                    playAudio(fallbackData);
                    return;
                }

                showToastMsg('正在请求豆包语音(WebSocket)...');
                try {
                    const blob = await requestDoubaoWS(speaker);
                    playAudio(blob);
                    showToastMsg('语音播放中');
                } catch (wsError) {
                    console.warn('WS Failed:', wsError);
                    showToastMsg('WebSocket 失败，尝试火山兜底...');
                    const fallbackData = await requestVolc('tts.other.BV008_streaming');
                    playAudio(fallbackData);
                }
            } else {
                showToastMsg('正在请求火山语音...');
                try {
                    const data = await requestVolc(speaker);
                    playAudio(data);
                    showToastMsg('语音播放中');
                } catch (httpError) {
                    console.warn('HTTP Failed:', httpError);
                    showToastMsg('该发音人请求失败，尝试标准语音...');
                    const fallbackData = await requestVolc('tts.other.BV008_streaming');
                    playAudio(fallbackData);
                }
            }
        } catch (fatalError) {
            showToastMsg(`语音演示失败: ${fatalError.message}`);
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
                    <div class="space-y-1">
                        <div class="flex justify-between items-center">
                            <label class="text-xs text-gray-400 ml-1">豆包 Cookie</label>
                            <button @click="autoGetCookie" class="text-xs text-blue-500 font-medium">
                                自动获取
                            </button>
                        </div>
                        <textarea v-model="doubaoForm.cookie" rows="3" placeholder="粘贴完整的 Cookie 字符串"
                            class="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all resize-none"></textarea>
                    </div>

                    <div class="space-y-1.5 max-w-full">
                        <div class="flex items-center justify-between gap-px px-1">
                            <label class="text-[11px] font-semibold text-gray-400 shrink-0">发音人选择</label>
                            <div class="flex items-center gap-1.5 overflow-hidden shrink-0">
                                <button @click="openImportModal"
                                    class="text-[10px] text-blue-500 font-medium hover:text-blue-700 whitespace-nowrap flex items-center gap-0.5">
                                    <i class="fa-solid fa-file-import"></i>导入
                                </button>
                                <span class="text-gray-200 text-[10px]">|</span>
                                <button @click="fetchDoubaoVoices" :disabled="isLoadingVoices"
                                    class="text-[10px] text-blue-500 font-medium hover:text-blue-700 disabled:opacity-30 whitespace-nowrap flex items-center gap-0.5">
                                    <i class="fa-solid fa-sync-alt" :class="{ 'fa-spin': isLoadingVoices }"></i>同步
                                </button>
                            </div>
                        </div>
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
