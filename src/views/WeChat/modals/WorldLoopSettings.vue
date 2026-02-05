<template>
    <div class="absolute inset-0 z-[9999] flex flex-col pt-[28px] animate-slide-in-right bg-[#0a0a0c] text-white">
        <!-- RPG Background Layer -->
        <div class="absolute inset-0 bg-gradient-to-b from-purple-950/50 via-[#0a0a0c] to-[#0a0a0c] -z-10"></div>
        <div class="absolute inset-0 opacity-10 pointer-events-none -z-10" 
            style="background-image: url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.2\'/%3E%3C/svg%3E')"></div>

        <!-- Header -->
        <div class="h-[60px] bg-white/5 border-b border-purple-500/20 sticky top-0 flex items-center justify-between px-4 z-10 backdrop-blur-md">
            <button class="w-10 h-10 text-purple-300 flex items-center justify-center rounded-full hover:bg-white/10 transition-all" @click="$emit('close')">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div class="flex flex-col items-center">
                <span class="font-bold text-purple-100 italic tracking-wider">世界设定 · {{ loop?.name }}</span>
                <span class="text-[9px] text-purple-400/70 uppercase tracking-[0.2em]">World Loop Configuration</span>
            </div>
            <button @click="saveSettings"
                class="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-1.5 rounded-full shadow-lg shadow-purple-900/40 transition-all">保存</button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-5 space-y-8 pb-32">
            
            <!-- 1. World Status Card -->
            <div class="relative group">
                <div class="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div class="relative bg-[#16161e] border border-white/5 rounded-2xl p-6 shadow-2xl overflow-hidden">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                                <i class="fa-solid fa-earth-asia text-2xl"></i>
                            </div>
                            <div>
                                <h4 class="text-sm font-bold text-purple-100">核心世界观</h4>
                                <div class="text-[10px] text-purple-400 flex items-center gap-1.5 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    {{ loop?.currentMode === 'online' ? '线上聊天模式' : '线下剧本模式' }}
                                </div>
                            </div>
                        </div>
                        <button @click="toggleMode" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-purple-300 border border-purple-500/20 transition-all">
                            <i class="fa-solid fa-repeat mr-1"></i> 模式切换
                        </button>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="text-[11px] text-purple-400 font-bold uppercase tracking-wider mb-2 block">剧情背景设定</label>
                            <textarea v-model="localData.description" 
                                class="w-full bg-black/40 border border-purple-500/10 rounded-xl p-4 text-xs text-purple-100 leading-relaxed focus:border-purple-500/30 outline-none transition-all h-32 resize-none"
                                placeholder="描述这个世界的宏大背景..."></textarea>
                        </div>
                        <div class="flex gap-2">
                            <button @click="handleRedrawScene" class="flex-1 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-[11px] text-purple-200 transition-all flex items-center justify-center gap-2">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> AI 重写背景
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Plot Progress (Script Summary) -->
            <div class="space-y-4">
                <div class="flex justify-between items-center px-1">
                    <h4 class="text-sm font-bold text-purple-200 flex items-center gap-2">
                        <i class="fa-solid fa-book-open"></i> 剧本进度与摘要
                    </h4>
                    <button @click="handleManualSummary" class="text-[11px] text-purple-400 hover:text-purple-300 transition-colors">
                        <i class="fa-solid fa-clock-rotate-left mr-1"></i> 生成最新摘要
                    </button>
                </div>
                
                <div v-if="!loop?.summaryHistory || loop.summaryHistory.length === 0" class="bg-white/5 border border-white/5 rounded-2xl p-8 text-center">
                    <i class="fa-solid fa-feather-pointed text-3xl text-purple-500/30 mb-3"></i>
                    <p class="text-xs text-purple-400/60">尚未生成剧情摘要</p>
                </div>
                <div v-else class="space-y-3">
                    <div v-for="(summary, index) in [...loop.summaryHistory].reverse()" :key="index"
                        class="bg-white/5 border border-white/5 rounded-xl p-4 hover:bg-white/10 transition-all">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[10px] text-purple-400 font-mono italic">Checkpoint #{{ loop.summaryHistory.length - index }}</span>
                            <span class="text-[9px] text-gray-500">{{ new Date().toLocaleDateString() }}</span>
                        </div>
                        <p class="text-xs text-purple-100/80 leading-relaxed">{{ cleanSummary(summary.content || summary) }}</p>
                    </div>
                </div>
            </div>

            <!-- 3. NPC Management -->
            <div class="space-y-4">
                <div class="flex justify-between items-center px-1">
                    <h4 class="text-sm font-bold text-purple-200 flex items-center gap-2">
                        <i class="fa-solid fa-users"></i> 剧本角色 (NPC)
                    </h4>
                    <button @click="handleAddNPC" class="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-[10px] text-purple-300 transition-all">
                        <i class="fa-solid fa-plus"></i> 召唤新成员
                    </button>
                </div>
                
                <div class="grid grid-cols-1 gap-3">
                    <div v-for="char in participants" :key="char.id" 
                        class="flex items-center gap-4 bg-[#16161e] border border-white/5 p-4 rounded-2xl hover:border-purple-500/20 transition-all group relative">
                        <div class="relative">
                            <img :src="char.avatar" class="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/10 group-hover:scale-105 transition-transform">
                            <div v-if="char.isOnline" class="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#16161e] rounded-full"></div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-bold text-purple-100">{{ char.name }}</span>
                                <span class="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20">NPC</span>
                            </div>
                            <p class="text-[10px] text-purple-400/70 truncate mt-1">{{ char.prompt || '暂无人设描述...' }}</p>
                        </div>
                        <div class="flex gap-2">
                            <button @click="handleEditNPC(char.id)" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-purple-400 hover:bg-purple-500/20 transition-all">
                                <i class="fa-solid fa-pen-to-square text-[11px]"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. Global Configuration -->
            <div class="space-y-4">
                <h4 class="text-sm font-bold text-purple-200 px-1">剧情演化逻辑 (Evolution Bias)</h4>
                <div class="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-5">
                    <!-- AI Style Select -->
                    <div class="space-y-3">
                        <label class="text-[10px] text-purple-400 font-bold uppercase tracking-wider">AI 叙事风格</label>
                        <div class="grid grid-cols-3 gap-2">
                            <button v-for="style in ['文学写实', '轻小说', '硬核剧本']" :key="style"
                                @click="localData.aiStyle = style"
                                :class="localData.aiStyle === style ? 'bg-purple-600 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-purple-300'"
                                class="py-2 rounded-lg text-[10px] border transition-all">
                                {{ style }}
                            </button>
                        </div>
                    </div>

                    <div class="h-px bg-white/5"></div>

                    <!-- Evolution Sliders -->
                    <div class="space-y-4">
                        <div class="space-y-2">
                            <div class="flex justify-between text-[10px] text-purple-400">
                                <span>角色冲突频率 (Conflict)</span>
                                <span>{{ Math.round(localData.conflictLevel * 100) }}%</span>
                            </div>
                            <input v-model="localData.conflictLevel" type="range" min="0" max="1" step="0.1" class="w-full accent-purple-500 h-1 bg-white/10 rounded-lg">
                        </div>
                        <div class="space-y-2">
                            <div class="flex justify-between text-[10px] text-purple-400">
                                <span>情感羁绊深度 (Bonds)</span>
                                <span>{{ Math.round(localData.bondStrength * 100) }}%</span>
                            </div>
                            <input v-model="localData.bondStrength" type="range" min="0" max="1" step="0.1" class="w-full accent-purple-500 h-1 bg-white/10 rounded-lg">
                        </div>
                    </div>
                </div>
            </div>

            <!-- 5. Global Technical Config -->
            <div class="space-y-4">
                <h4 class="text-sm font-bold text-purple-200 px-1">世界规则与参数</h4>
                <div class="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-5">
                    <!-- Identity -->
                    <div class="space-y-2">
                        <label class="text-[10px] text-purple-400 font-bold uppercase tracking-wider">我的身份设定 (My Persona)</label>
                        <textarea v-model="localData.userRole" 
                            class="w-full bg-black/40 border border-purple-500/10 rounded-xl p-3 text-xs text-purple-100 leading-relaxed focus:border-purple-500/30 outline-none transition-all h-20 resize-none"
                            placeholder="你在这个世界里的定位..."></textarea>
                    </div>

                    <div class="h-px bg-white/5"></div>

                    <!-- AI Memory -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                            <label class="text-[10px] text-purple-400">上下文记忆</label>
                            <div class="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2 border border-purple-500/10">
                                <input v-model.number="localData.contextLimit" type="number" class="bg-transparent outline-none text-xs w-full text-purple-100">
                                <span class="text-[9px] text-gray-500 italic">条</span>
                            </div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] text-purple-400">自动总结间隔</label>
                            <div class="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2 border border-purple-500/10">
                                <input v-model.number="localData.autoSummaryInterval" type="number" class="bg-transparent outline-none text-xs w-full text-purple-100">
                                <span class="text-[9px] text-gray-500 italic">条</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 6. Appearance Settings (Themed) -->
            <div class="space-y-4">
                <h4 class="text-sm font-bold text-purple-200 px-1">场景表现与氛围</h4>
                <div class="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4">
                    <div class="space-y-2">
                        <label class="text-[10px] text-purple-400">主视觉氛围 (Atmosphere)</label>
                        <div class="grid grid-cols-4 gap-2">
                            <button v-for="env in ['明亮', '阴郁', '赛博', '古风']" :key="env"
                                @click="localData.atmosphere = env"
                                :class="localData.atmosphere === env ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10'"
                                class="py-1.5 rounded-lg text-[9px] border transition-all text-white">
                                {{ env }}
                            </button>
                        </div>
                    </div>
                    
                    <div class="h-px bg-white/5"></div>

                    <div class="space-y-2">
                        <label class="text-[10px] text-purple-400">全局场景图 URL</label>
                        <div class="flex gap-2">
                            <input v-model="localData.bgUrl" type="text" 
                                class="flex-1 bg-black/40 border border-purple-500/10 rounded-xl px-4 py-2 text-xs text-purple-100 focus:border-purple-500/30 outline-none transition-all">
                            <button @click="triggerBgUpload" class="px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-xl text-[10px] text-purple-300">本地</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="flex justify-between text-[10px] text-purple-400 mb-2"><span>模糊强度</span><span>{{ localData.bgBlur }}px</span></div>
                            <input v-model="localData.bgBlur" type="range" min="0" max="20" class="w-full accent-purple-500 h-1 bg-white/10 rounded-lg">
                        </div>
                        <div>
                            <div class="flex justify-between text-[10px] text-purple-400 mb-2"><span>背景亮度</span><span>{{ Math.round(localData.bgOpacity * 100) }}%</span></div>
                            <input v-model="localData.bgOpacity" type="range" min="0" max="1" step="0.1" class="w-full accent-purple-500 h-1 bg-white/10 rounded-lg">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Danger Zone -->
            <div class="pt-10">
                <button @click="handleDeleteLoop" 
                    class="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all">
                    毁灭此世界 (删除记录)
                </button>
            </div>

        </div>
        
        <!-- Hidden Inputs -->
        <input type="file" ref="bgUploadInput" class="hidden" accept="image/*" @change="handleBgUpload">
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useWorldLoopStore } from '../../../stores/worldLoopStore'
import { useChatStore } from '../../../stores/chatStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const props = defineProps({
    chatData: Object
})

const emit = defineEmits(['close', 'show-profile'])

const worldLoopStore = useWorldLoopStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const loop = computed(() => {
    if (!props.chatData?.loopId) return null
    return worldLoopStore.loops[props.chatData.loopId]
})

const localData = reactive({
    name: '',
    description: '',
    userRole: '',
    contextLimit: 20,
    autoSummaryInterval: 50,
    bgUrl: '',
    bgBlur: 0,
    bgOpacity: 0.8,
    aiStyle: '文学写实',
    conflictLevel: 0.5,
    bondStrength: 0.5,
    atmosphere: '明亮'
})

onMounted(() => {
    if (loop.value) {
        localData.name = loop.value.name || ''
        localData.description = loop.value.description || ''
        localData.userRole = loop.value.userRole || ''
        localData.contextLimit = loop.value.config?.contextLimit || 20
        localData.autoSummaryInterval = loop.value.config?.autoSummaryInterval || 50
        
        // V2 Extended Settings
        localData.aiStyle = loop.value.config?.aiStyle || '文学写实'
        localData.conflictLevel = loop.value.config?.conflictLevel ?? 0.5
        localData.bondStrength = loop.value.config?.bondStrength ?? 0.5
        localData.atmosphere = loop.value.config?.atmosphere || '明亮'
    }
    
    // Also pull visual settings from the generic chat object (synchronized)
    localData.bgUrl = props.chatData?.bgUrl || ''
    localData.bgBlur = props.chatData?.bgBlur || 0
    localData.bgOpacity = props.chatData?.bgOpacity !== undefined ? props.chatData.bgOpacity : 0.8
})

const participants = computed(() => {
    if (!loop.value) return []
    return loop.value.participants.map(id => {
        const char = chatStore.chats[id]
        return {
            id,
            name: char?.name || '未知NPC',
            avatar: char?.avatar || '',
            prompt: char?.prompt || '',
            isOnline: char?.isOnline
        }
    })
})

function toggleMode() {
    worldLoopStore.toggleMode(props.chatData.loopId)
}

function saveSettings() {
    if (!props.chatData?.loopId) return
    
    // 1. Update World Store
    worldLoopStore.updateLoop(props.chatData.loopId, {
        description: localData.description,
        userRole: localData.userRole,
        config: {
            contextLimit: localData.contextLimit,
            autoSummaryInterval: localData.autoSummaryInterval,
            aiStyle: localData.aiStyle,
            conflictLevel: localData.conflictLevel,
            bondStrength: localData.bondStrength,
            atmosphere: localData.atmosphere
        }
    })
    
    // 2. Update Visuals in Chat Store (so UI reflects immediately)
    chatStore.updateCharacter(props.chatData.id, {
        bgUrl: localData.bgUrl,
        bgBlur: localData.bgBlur,
        bgOpacity: localData.bgOpacity
    })
    
    emit('close')
}

// Actions from Panel logic
function handleRedrawScene() {
    const theme = localData.description || '当前场景'
    chatStore.addMessage(props.chatData.id, {
        role: 'system',
        content: `[DRAW: ${theme} 的电影级写实背景]`,
        isDrawing: true
    })
    emit('close')
}

function handleManualSummary() {
    chatStore.addMessage(props.chatData.id, {
        role: 'system',
        content: '[System: 请根据目前的对话，总结当前的剧情节点。]'
    })
    chatStore.sendMessageToAI(props.chatData.id)
    emit('close')
}

function handleAddNPC() {
    chatStore.triggerToast('功能升级中...', 'info')
}

function handleEditNPC(id) {
    emit('show-profile', id)
}

function handleDeleteLoop() {
    chatStore.triggerConfirm('毁灭世界', '确定要删除这个世界吗？所有聊天记录和设定都将毁灭。', () => {
        chatStore.deleteCharacter(props.chatData.id)
        emit('close')
    })
}

// Visual Uploads
const bgUploadInput = ref(null)
function triggerBgUpload() {
    bgUploadInput.value?.click()
}

function cleanSummary(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        .replace(/\[\s*CARD\s*\][\s\S]*?(?:\[\/\s*CARD\s*\]|$)/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim() || '[Summary Archive]';
}

function handleBgUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
        localData.bgUrl = event.target.result
    }
    reader.readAsDataURL(file)
}

</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');

.animate-slide-in-right {
    animation: slide-in-right 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes slide-in-right {
    0% { transform: translateX(100%); }
    100% { transform: translateY(0); }
}

.flow-border {
    position: relative;
    overflow: hidden;
}

.flow-border::after {
    content: '';
    position: absolute;
    inset: -1px;
    background: conic-gradient(from 0deg, transparent, #a855f7, transparent, #6366f1, transparent);
    animation: rotate 4s linear infinite;
    z-index: -1;
    border-radius: inherit;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: xor;
    -webkit-mask-composite: xor;
    padding: 1px;
    opacity: 0.5;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.glass-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.05);
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
</style>
