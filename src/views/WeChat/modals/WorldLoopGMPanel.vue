<template>
    <div class="fixed inset-0 z-[10000] flex items-end justify-center pointer-events-none p-4 pb-0 sm:pb-8">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" @click="$emit('close')"></div>
        <div class="w-full max-w-[500px] bg-[#0a0b14]/90 backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl pointer-events-auto animate-slide-up flex flex-col max-h-[90vh] border border-white/10 flow-border overflow-hidden">
            
            <!-- Header -->
            <div class="px-6 py-5 border-b border-purple-500/20 flex items-center justify-between shrink-0 bg-white/5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                        <i class="fa-solid fa-wand-magic-sparkles text-xl"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-black text-purple-100 italic tracking-widest uppercase">GM 控制台</h3>
                        <p class="text-[9px] text-purple-400/70 font-bold uppercase tracking-widest">Master of Reality · Control Interface</p>
                    </div>
                </div>
                <button @click="$emit('close')" class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-purple-300 transition-all">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto min-h-0 p-6 space-y-8 pb-12 custom-scrollbar">
                
                <!-- 1. Loop Status Card -->
                <div class="relative group">
                    <div class="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-20 transition duration-1000 group-hover:opacity-40"></div>
                    <div class="relative bg-gradient-to-br from-[#1a1b2e] to-[#0f111a] rounded-2xl p-6 text-white shadow-xl border border-white/5">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <div class="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1">Reality Descriptor</div>
                                <div class="text-lg font-black text-white italic">{{ loop?.name }}</div>
                            </div>
                            <div class="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] text-purple-300 font-bold backdrop-blur-md uppercase tracking-tighter">
                                {{ loop?.currentMode === 'online' ? '🟢 Online' : '🔵 Offline' }}
                            </div>
                        </div>
                        <div v-if="!isEditingIntro" @click="isEditingIntro = true" class="text-xs text-purple-200/70 leading-relaxed italic mb-6 px-3 border-l-2 border-purple-500/30 cursor-pointer hover:bg-white/5 transition-colors py-2 rounded break-words">
                            "{{ cleanDescription }}"
                        </div>
                        <div v-else class="mb-6 space-y-4">
                            <input v-model="editName" class="w-full bg-black/40 border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 outline-none" placeholder="世界圈名称">
                            <textarea v-model="editDescription" 
                                class="w-full bg-black/40 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-100 focus:border-purple-500/50 outline-none resize-none h-24 leading-relaxed"
                                placeholder="详细的世界观背景描述..."></textarea>
                            <div class="flex gap-2">
                                <button @click="saveWorldSettings(true)" class="flex-1 bg-purple-600 hover:bg-purple-500 py-2 rounded-lg text-[10px] font-bold transition-all">保存并通知 NPC</button>
                                <button @click="saveWorldSettings(false)" class="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-[10px] font-bold transition-all">仅保存</button>
                                <button @click="isEditingIntro = false" class="px-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 py-2 rounded-lg text-[10px] font-bold transition-all">取消</button>
                            </div>
                        </div>

                        <button @click="toggleMode" class="w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/5 active:scale-95 group/btn">
                            <i class="fa-solid fa-repeat group-hover/btn:rotate-180 transition-transform duration-500"></i> 
                            运行模式: {{ loop?.currentMode === 'online' ? '微信社交 (Online)' : '线下互动 (Offline)' }}
                        </button>
                    </div>
                </div>

                <!-- 2. User Role Configuration -->
                <div class="space-y-4">
                    <div class="flex items-center gap-2 px-1">
                        <div class="w-1 h-3 bg-purple-500 rounded-full"></div>
                        <h4 class="text-sm font-bold text-purple-200 uppercase tracking-widest">我的身份设定 (Avatar Legacy)</h4>
                    </div>
                    <div class="bg-white/5 border border-white/5 rounded-2xl p-4">
                        <textarea v-model="userRole" 
                            class="w-full bg-black/40 border border-purple-500/10 rounded-xl p-4 text-xs text-purple-100 focus:border-purple-500/30 outline-none transition-all resize-none h-24 leading-relaxed"
                            placeholder="描述你在这个世界里的身份（例如：被放逐的皇子、路过的旅人...）"></textarea>
                        <div class="mt-2 text-[9px] text-purple-400/50 italic px-1">
                            提示: 你的身份会直接影响 NPC 对你的态度和称呼
                        </div>
                    </div>
                </div>

                <!-- 3. Participant List (NPCs) -->
                <div class="space-y-4 text-white">
                    <div class="flex justify-between items-center px-1">
                        <div class="flex items-center gap-2">
                            <div class="w-1 h-3 bg-indigo-500 rounded-full"></div>
                            <h4 class="text-sm font-bold text-purple-200 uppercase tracking-widest">剧本角色 ({{ participants.length }})</h4>
                        </div>
                        <button @click="handleAddNPC" 
                            :disabled="isSummoning"
                            class="text-[10px] px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-300 font-black uppercase hover:bg-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                            <i class="fa-solid" :class="isSummoning ? 'fa-spinner fa-spin' : 'fa-plus'"></i>
                            {{ isSummoning ? 'Summoning...' : 'Summon' }}
                        </button>
                    </div>
                    <div class="grid grid-cols-1 gap-3">
                        <div v-for="char in participants" :key="char.id" 
                            class="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 hover:bg-white/10 transition-all group relative overflow-hidden">
                            <img :src="char.avatar" class="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/10">
                            <div class="flex-1 min-w-0">
                                <div class="text-[15px] font-black text-purple-50 italic">{{ char.name }}</div>
                                <div class="text-[10px] text-purple-400/70 truncate leading-tight">{{ char.prompt }}</div>
                            </div>
                            <div class="flex gap-2">
                                <button @click="handleEditNPC(char.id)" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-purple-300 hover:bg-purple-500 hover:text-white transition-all shadow-sm">
                                    <i class="fa-solid fa-pen-to-square text-xs"></i>
                                </button>
                                <button @click="handleRemoveNPC(char.id)" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
                            <!-- Background Decoration -->
                            <div class="absolute -right-2 -bottom-2 text-4xl text-white/5 rotate-12 opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="fa-solid fa-id-card"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. GM Direct Actions -->
                <div class="space-y-4 pb-4">
                    <div class="flex items-center gap-2 px-1">
                        <div class="w-1 h-3 bg-pink-500 rounded-full"></div>
                        <h4 class="text-sm font-bold text-purple-200 uppercase tracking-widest">上帝指令 (Divine Commands)</h4>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <button @click="handleRedrawScene" class="gm-action-btn border-teal-500/20 text-teal-300 hover:bg-teal-500/10 hover:border-teal-500/40">
                            <i class="fa-solid fa-image text-2xl mb-1"></i>
                            <span class="text-xs font-black uppercase tracking-widest">重绘背景</span>
                            <span class="text-[8px] opacity-40">AI Scene Render</span>
                        </button>
                        <button @click="handleSystemBroadcast" class="gm-action-btn border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/10 hover:border-yellow-500/40">
                            <i class="fa-solid fa-bullhorn text-2xl mb-1"></i>
                            <span class="text-xs font-black uppercase tracking-widest">系统广播</span>
                            <span class="text-[8px] opacity-40">World Message</span>
                        </button>
                        <button @click="handleManualSummary" class="gm-action-btn border-blue-500/20 text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/40">
                            <i class="fa-solid fa-clock-rotate-left text-2xl mb-1"></i>
                            <span class="text-xs font-black uppercase tracking-widest">剧情摘要</span>
                            <span class="text-[8px] opacity-40">Timeline Sync</span>
                        </button>
                        <button @click="handleManageNPCs" class="gm-action-btn border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/40">
                            <i class="fa-solid fa-users-gear text-2xl mb-1"></i>
                            <span class="text-xs font-black uppercase tracking-widest">角色管理</span>
                            <span class="text-[8px] opacity-40">Character HUB</span>
                        </button>
                    </div>
                </div>

                <!-- 5. System Activity Diagnostic -->
                <div class="mt-4 pt-4 border-t border-purple-500/10 flex items-center justify-between opacity-50">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"></div>
                        <div class="text-[9px] font-bold text-purple-300 uppercase tracking-widest truncate animate-pulse duration-[3000ms]">
                             GM Kernel: {{ gmActivity }}
                        </div>
                    </div>
                    <div class="text-[8px] font-black text-purple-500 uppercase tracking-tighter">
                        Latent-Sync v4.2
                    </div>
                </div>

            </div>
            <!-- Content -->
            <!-- ... (Existing content section) ... -->

            <!-- Sub-overlay for Commands/Inputs -->
            <div v-if="subModal.show" class="absolute inset-0 z-50 bg-[#0a0b14]/95 flex flex-col animate-fade-in p-6">
                <div class="flex items-center justify-between mb-6">
                    <h5 class="text-sm font-black text-purple-200 uppercase tracking-[0.2em]">{{ subModal.title }}</h5>
                    <button @click="closeSubModal" class="text-purple-400 hover:text-white transition-colors">
                        <i class="fa-solid fa-circle-xmark text-xl"></i>
                    </button>
                </div>

                <div v-if="subModal.type === 'input'" class="flex-1 flex flex-col gap-4">
                    <textarea v-model="subModal.value"
                        ref="subInput"
                        class="w-full bg-white/5 border border-purple-500/20 rounded-2xl p-4 text-sm text-purple-100 focus:border-purple-500/50 outline-none transition-all resize-none flex-1 leading-relaxed"
                        :placeholder="subModal.placeholder"></textarea>
                    
                    <div class="flex gap-3">
                        <button @click="closeSubModal" class="flex-1 py-4 rounded-xl bg-white/5 text-purple-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                        <button @click="confirmSubModal" class="flex-1 py-4 rounded-xl bg-purple-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-purple-500 shadow-lg shadow-purple-900/40 transition-all">Execute</button>
                    </div>
                </div>

                <div v-if="subModal.type === 'confirm'" class="flex-1 flex flex-col justify-center items-center text-center gap-6">
                    <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 mb-2">
                        <i class="fa-solid fa-triangle-exclamation text-2xl"></i>
                    </div>
                    <div class="text-sm text-purple-100 font-medium leading-relaxed">{{ subModal.placeholder }}</div>
                    <div class="flex gap-3 w-full mt-4">
                        <button @click="closeSubModal" class="flex-1 py-4 rounded-xl bg-white/5 text-purple-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                        <button @click="confirmSubModal" class="flex-1 py-4 rounded-xl bg-red-600/80 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-900/40 transition-all">Confirm</button>
                    </div>
                </div>

                <div v-if="subModal.type === 'alert'" class="flex-1 flex flex-col justify-center items-center text-center gap-6">
                    <div class="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 mb-2">
                        <i class="fa-solid fa-circle-info text-2xl"></i>
                    </div>
                    <div class="text-sm text-purple-100 font-medium leading-relaxed">{{ subModal.placeholder }}</div>
                    <button @click="closeSubModal" class="w-full py-4 rounded-xl bg-purple-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-purple-500 transition-all">Understood</button>
                </div>

                <!-- NPC Management Hub -->
                <div v-if="subModal.type === 'char_hub'" class="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                        <div v-for="char in participants" :key="char.id" class="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4">
                            <div class="flex items-center gap-4">
                                <div class="relative group/avatar cursor-pointer shrink-0" @click="handleEditAvatar(char.id)">
                                    <img :src="char.avatar" class="w-16 h-16 rounded-xl object-cover border border-white/10 group-hover/avatar:opacity-60 transition-opacity">
                                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/40 rounded-xl">
                                        <i class="fa-solid fa-camera text-white"></i>
                                    </div>
                                </div>
                                <div class="flex-1 space-y-2">
                                    <div class="flex items-center justify-between">
                                          <input :value="char.name" @change="e => updateNPC(char.id, { name: e.target.value })"
                                            class="bg-transparent border-none p-0 text-sm text-white font-bold focus:ring-0 outline-none w-full"
                                            placeholder="角色名称">
                                          <div class="text-[9px] text-purple-400/50 uppercase font-black tracking-widest italic flex items-center gap-1 opacity-60">
                                              UUID: {{ char.id.split('-').pop() }}
                                          </div>
                                    </div>
                                    <div class="h-px bg-gradient-to-r from-purple-500/30 to-transparent"></div>
                                </div>
                            </div>
                            <div class="space-y-2">
                                <div class="flex justify-between items-center text-[10px] font-bold tracking-tight">
                                    <span class="text-purple-300 uppercase opacity-60">AI Directives / Personality</span>
                                    <div class="flex gap-2">
                                        <button @click="handleRemoveNPC(char.id)" class="text-red-400/60 hover:text-red-400 transition-colors uppercase">Remove</button>
                                    </div>
                                </div>
                                <textarea :value="char.prompt" @change="e => updateNPC(char.id, { prompt: e.target.value })"
                                    class="w-full bg-black/40 border border-purple-500/10 rounded-xl p-3 text-xs text-purple-100 focus:border-purple-500/20 outline-none resize-none h-24 leading-relaxed custom-scrollbar shadow-inner"
                                    placeholder="描述该角色的性格、目标和对你的态度..."></textarea>
                            </div>
                        </div>
                    </div>
                    <button @click="closeSubModal" class="w-full py-4 rounded-xl bg-purple-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-purple-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40">
                        <i class="fa-solid fa-check-circle"></i> Save All Changes
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useWorldLoopStore } from '../../../stores/worldLoopStore'
import { useChatStore } from '../../../stores/chatStore'

const props = defineProps({
    loopId: String
})

const emit = defineEmits(['close', 'show-profile'])

const worldLoopStore = useWorldLoopStore()
const chatStore = useChatStore()

const isEditingIntro = ref(false)
const editName = ref(worldLoopStore.loops[props.loopId]?.name || '')
const editDescription = ref(worldLoopStore.loops[props.loopId]?.description || '')

const cleanDescription = computed(() => {
    const desc = loop.value?.description || '点击编辑世界背景描述...'
    if (!desc.includes('[CARD]') && !desc.includes('<div')) return desc
    // Simple cleaning for the GM panel view
    return desc.replace(/\[CARD\][\s\S]*?(?:\[\/CARD\]|$)/gi, '').replace(/<[^>]+>/g, '').trim() || '背景描述(已过滤代码块)'
})

const gmActivity = ref('READY')
const activities = [
    'Observing User Intent...',
    'Calculating NPC reactions...',
    'Synchronizing World Line...',
    'Synthesizing Persona context...',
    'GM Kernel: Stable',
    'Updating Chronological Vault...',
    'Neutralizing Paradoxes...',
    'Rerouting Narrative Flow...'
]

let activityTimer = null
onMounted(() => {
    activityTimer = setInterval(() => {
        gmActivity.value = activities[Math.floor(Math.random() * activities.length)]
    }, 5000)
})
onUnmounted(() => {
    if (activityTimer) clearInterval(activityTimer)
})

const subInput = ref(null)
const subModal = ref({
    show: false,
    title: '',
    placeholder: '',
    value: '',
    type: 'input', // 'input', 'confirm', 'alert'
    onConfirm: null
})

function openSubModal(options) {
    subModal.value = {
        show: true,
        title: options.title || 'Directive',
        placeholder: options.placeholder || '',
        value: options.defaultValue || '',
        type: options.type || 'input',
        onConfirm: options.onConfirm
    }
    if (options.type === 'input') {
        nextTick(() => {
            subInput.value?.focus()
        })
    }
}

function closeSubModal() {
    subModal.value.show = false
}

function confirmSubModal() {
    if (subModal.value.onConfirm) {
        subModal.value.onConfirm(subModal.value.value)
    }
    closeSubModal()
}

const loop = computed(() => worldLoopStore.loops[props.loopId])

const userRole = computed({
    get: () => loop.value?.userRole || '',
    set: (val) => worldLoopStore.updateLoop(props.loopId, { userRole: val })
})

const participants = computed(() => {
    if (!loop.value) return []
    return loop.value.participants.map(id => {
        const char = chatStore.chats[id]
        return {
            id,
            name: char?.name || '未知NPC',
            avatar: char?.avatar || '',
            prompt: char?.prompt || ''
        }
    })
})

function toggleMode() {
    worldLoopStore.toggleMode(props.loopId)
}

const isSummoning = ref(false)

function saveWorldSettings(notify = false) {
    worldLoopStore.updateLoop(props.loopId, {
        name: editName.value,
        description: editDescription.value
    })
    
    isEditingIntro.value = false
    chatStore.triggerToast('世界观设定已保存', 'success')
    
    if (notify) {
        chatStore.addMessage(chatStore.currentChatId, {
            role: 'system',
            content: `[System Broadcast: 世界观设定已更新。此后的剧情将基于以下新设定展开：${editDescription.value}]`
        })
        chatStore.sendMessageToAI(chatStore.currentChatId)
    }
}

async function handleAddNPC() {
    openSubModal({
        title: '召唤角色 (Summon)',
        placeholder: '请输入召唤角色主题 (例如: 一个高冷的剑客、或者是你的宿敌)',
        type: 'input',
        onConfirm: async (val) => {
            if (!val || !val.trim()) return
            isSummoning.value = true
            try {
                await worldLoopStore.summonMember(props.loopId, val.trim())
            } catch (e) {
                openSubModal({
                    title: '执行失败',
                    placeholder: '召唤失败: ' + e.message,
                    type: 'alert'
                })
            } finally {
                isSummoning.value = false
            }
        }
    })
}

function handleEditNPC(id) {
    emit('show-profile', id)
}

function handleRemoveNPC(id) {
    openSubModal({
        title: '移出角色',
        placeholder: '确定要将该角色移出世界圈吗？(该操作仅在当前环内生效)',
        type: 'confirm',
        onConfirm: () => {
            worldLoopStore.removeNPCFromLoop(props.loopId, id)
        }
    })
}

async function handleRedrawScene() {
    if (!loop.value) return
    const theme = loop.value.description || '当前场景'
    
    // 1. Add placeholder message
    const msgId = chatStore.addMessage(chatStore.currentChatId, {
        role: 'system',
        content: `[DRAW: ${theme} 的电影级写实背景]`,
        isDrawing: true
    })
    
    emit('close')

    try {
        const { generateImage } = await import('../../../utils/aiService')
        // 2. Generate the image
        const imageUrl = await generateImage(`${theme}, cinematic realism, background masterpiece, high quality, no characters`)
        
        // 3. Update the message to remove loading state and show the result
        chatStore.updateMessage(chatStore.currentChatId, msgId, {
            content: `[图片:${imageUrl}]`,
            isDrawing: false,
            image: imageUrl
        })
        
        // 4. Set as chat background
        chatStore.updateCharacter(chatStore.currentChatId, {
            bgUrl: imageUrl,
            bgOpacity: 0.8,
            bgBlur: 0
        })
        
        chatStore.triggerToast('场景重绘完成', 'success')
    } catch (e) {
        console.error('[WorldLoop] Redraw failed', e)
        chatStore.updateMessage(chatStore.currentChatId, msgId, {
            content: `(场景重绘失败: ${e.message})`,
            isDrawing: false
        })
    }
}

function handleSystemBroadcast() {
    openSubModal({
        title: '系统广播 (World Message)',
        placeholder: '请输入要广播的信息 (NPC 们能看见并回应)',
        type: 'input',
        onConfirm: (val) => {
            if (val && val.trim()) {
                chatStore.addMessage(chatStore.currentChatId, {
                    role: 'system',
                    content: `[System Broadcast: ${val.trim()}]`
                })
                chatStore.sendMessageToAI(chatStore.currentChatId)
                emit('close')
            }
        }
    })
}

async function handleManualSummary() {
    if (!props.loopId) return
    
    // 1. Add system reminder in chat
    chatStore.addMessage(chatStore.currentChatId, {
        role: 'system',
        content: '[System: 正在根据目前的对话，生成世界线总结及剧情档案...]'
    })
    
    emit('close')

    try {
        const summary = await worldLoopStore.generateWorldSummary(props.loopId)
        
        // 2. Alert the result (or store in loop state)
        openSubModal({
            title: '剧情档案已更新 (Vault Updated)',
            placeholder: summary,
            type: 'alert'
        })
    } catch (e) {
        chatStore.triggerToast('总结失败: ' + e.message, 'error')
    }
}

function handleManageNPCs() {
    openSubModal({
        title: '角色管理枢纽 (Character HUB)',
        type: 'char_hub'
    })
}

function updateNPC(id, data) {
    chatStore.updateCharacter(id, data)
    chatStore.triggerToast(`已更新角色: ${data.name || ''}`, 'success')
}

async function handleEditAvatar(id) {
    const char = chatStore.chats[id]
    chatStore.triggerPrompt('重绘头像', '描述新头像的风格 (留空则使用角色默认描述):', async (theme) => {
        if (theme === null) return

        const msgId = chatStore.addMessage(chatStore.currentChatId, {
            role: 'system',
            content: `[DRAW: 正在为 ${char.name} 重新绘制头像...]`,
            isDrawing: true
        })

        try {
            const { generateImage } = await import('../../../utils/aiService')
            const url = await generateImage(theme || `${char.name} anime style, masterpiece, profile picture`)
            chatStore.updateCharacter(id, { avatar: url })
            chatStore.updateMessage(chatStore.currentChatId, msgId, {
                content: `[图片:${url}]`,
                isDrawing: false,
                image: url
            })
            chatStore.triggerToast('头像更新成功', 'success')
        } catch (e) {
            chatStore.updateMessage(chatStore.currentChatId, msgId, {
                content: `(头像重绘失败: ${e.message})`,
                isDrawing: false
            })
        }
    }, char.name + ' anime style, high quality')
}
</script>

<style scoped>
.animate-slide-up {
    animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-up {
    from { transform: translateY(100%); filter: blur(10px); }
    to { transform: translateY(0); filter: blur(0); }
}

.gm-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem;
    border-radius: 1rem;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid transparent;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
    cursor: pointer;
}

.gm-action-btn:active {
    transform: scale(0.95);
}

.flow-border {
    position: relative;
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
    padding: 1.5px;
    opacity: 0.4;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(168, 85, 247, 0.2);
    border-radius: 10px;
}
</style>
