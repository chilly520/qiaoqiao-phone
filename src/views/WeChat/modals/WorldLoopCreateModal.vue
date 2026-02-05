<template>
    <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" @click.self="$emit('close')">
        <div class="w-full max-w-[400px] rounded-[32px] shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] transition-colors duration-300"
             :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border border-white/10' : 'bg-white'">
            <!-- Header -->
            <div class="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 p-8 text-white relative shrink-0 overflow-hidden">
                <div class="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <h3 class="text-2xl font-bold tracking-tight">创建世界圈</h3>
                <p class="text-white/70 text-xs mt-1.5 font-medium uppercase tracking-wider">Start a new AI script adventure</p>
                <div class="absolute top-6 right-8 opacity-20 text-5xl">
                    <i class="fa-solid fa-earth-asia"></i>
                </div>
            </div>

            <!-- Body -->
            <div class="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div class="space-y-2">
                    <label class="block text-[11px] font-bold uppercase tracking-widest ml-1"
                           :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">世界名称 / WORLD NAME</label>
                    <div class="transition-all rounded-2xl border"
                         :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 focus-within:border-purple-500' : 'bg-gray-50 border-gray-100 focus-within:border-purple-500 focus-within:bg-white'">
                        <input v-model="form.name" type="text" 
                               class="w-full bg-transparent px-4 py-3.5 outline-none text-base font-bold" 
                               :class="settingsStore.personalization.theme === 'dark' ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-300'"
                               placeholder="给你的世界起个名字...">
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between ml-1 mb-1">
                        <label class="text-[11px] font-bold uppercase tracking-widest"
                               :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">背景设定 / LOGLINE</label>
                        <button @click="generateWorldview" 
                                :disabled="isGenerating || selectedContacts.length === 0"
                                class="text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex items-center gap-1.5"
                                :class="settingsStore.personalization.theme === 'dark' ? 'text-purple-400 hover:bg-purple-400/10' : 'text-purple-600 hover:bg-purple-50'">
                            <i class="fa-solid" :class="isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
                            {{ isGenerating ? 'AI 生成中...' : 'AI 联想' }}
                        </button>
                    </div>
                    <div class="transition-all rounded-2xl border"
                         :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 focus-within:border-purple-500' : 'bg-gray-50 border-gray-100 focus-within:border-purple-500 focus-within:bg-white'">
                        <textarea v-model="form.description" rows="5"
                               class="w-full bg-transparent px-4 py-4 outline-none text-sm resize-none leading-relaxed" 
                               :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-200 placeholder-gray-600' : 'text-gray-700 placeholder-gray-300'"
                               placeholder="简单描述一下这个世界观 (例如: 赛博朋克、仙侠世界或办公室日常)..."></textarea>
                    </div>
                </div>

                <div class="space-y-3">
                    <label class="block text-[11px] font-bold uppercase tracking-widest ml-1"
                           :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">
                        参与角色 / CAST ({{ selectedContacts.length }})
                    </label>
                    <div class="grid grid-cols-4 gap-4">
                        <div v-for="contact in contacts" :key="contact.id" 
                             @click="toggleContact(contact.id)"
                             class="flex flex-col items-center gap-2 cursor-pointer group transition-all relative">
                            <div class="relative w-14 h-14">
                                <img :src="contact.avatar" class="w-full h-full object-cover rounded-2xl shadow-md border-2 transition-all duration-300"
                                     :class="[
                                         selectedContacts.includes(contact.id) 
                                         ? 'border-purple-500 scale-105 shadow-purple-500/20' 
                                         : (settingsStore.personalization.theme === 'dark' ? 'border-transparent grayscale-[0.8] opacity-40' : 'border-transparent grayscale-[0.5] opacity-60')
                                     ]">
                                <div v-if="selectedContacts.includes(contact.id)" 
                                     class="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg border-2 border-white animate-scale-in">
                                    <i class="fa-solid fa-check"></i>
                                </div>
                            </div>
                            <span class="text-[10px] font-bold truncate w-full text-center transition-colors" 
                                  :class="selectedContacts.includes(contact.id) ? 'text-purple-500' : 'text-gray-400'">
                                {{ contact.name }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-4 p-4 rounded-2xl border transition-colors"
                     :class="settingsStore.personalization.theme === 'dark' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-100'">
                    <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shrink-0 shadow-sm border border-purple-200">
                        <i class="fa-solid fa-lightbulb"></i>
                    </div>
                    <div class="flex-1">
                        <div class="text-[11px] font-bold uppercase tracking-wider" :class="settingsStore.personalization.theme === 'dark' ? 'text-purple-300' : 'text-purple-700'">小贴士 / TIPS</div>
                        <div class="text-[10px] leading-normal mt-0.5" :class="settingsStore.personalization.theme === 'dark' ? 'text-purple-400/80' : 'text-purple-500'">AI 会根据所选 NPC 的原本人设进行世界观的深度融合创作。</div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-8 flex gap-4 shrink-0 transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'">
                <button @click="$emit('close')" 
                        class="flex-1 py-4 px-4 rounded-2xl font-bold transition-all active:scale-95"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-white text-gray-400 hover:bg-gray-100'">
                    取消
                </button>
                <button @click="handleConfirm" 
                        class="flex-[1.5] py-4 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-xl shadow-purple-500/20 transition-all active:scale-95 disabled:grayscale disabled:opacity-30"
                        :disabled="!form.name.trim()">
                    立即发布
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { generateReply } from '../../../utils/aiService'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useChatStore } from '../../../stores/chatStore'

const props = defineProps({
    visible: Boolean,
    contacts: Array
})

const emit = defineEmits(['close', 'confirm'])

const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const form = ref({
    name: '',
    description: ''
})

const selectedContacts = ref([])
const isGenerating = ref(false)

const toggleContact = (id) => {
    const index = selectedContacts.value.indexOf(id)
    if (index === -1) {
        selectedContacts.value.push(id)
    } else {
        selectedContacts.value.splice(index, 1)
    }
}

const generateWorldview = async () => {
    if (selectedContacts.value.length === 0) return
    isGenerating.value = true
    
    try {
        const userProfile = settingsStore.personalization?.userProfile || {}
        const selectedChars = props.contacts.filter(c => selectedContacts.value.includes(c.id))
        
        const charsInfo = selectedChars.map(c => `- ${c.name}: ${c.prompt || '暂无详细设定'}`).join('\n')
        const userInfo = `- 用户名称: ${userProfile.name || '用户'}\n- 用户设定: ${userProfile.signature || '暂无设定'}`
        
        const prompt = `你是一个充满创意的世界观架构师。请为以下成员设计一各有趣、独特的剧本杀/RPG世界观背景设定。
你需要根据这些人的身份、性格进行融合，创造一个和谐且富有冲突感的舞台。

【参与成员】
${charsInfo}

【当前用户】
${userInfo}

【已有想法】
${form.value.description || '（用户未提供初始想法，请自由发挥，创造一个如赛博朋克、异世界魔法、都市异能或古代宫斗等风格的世界）'}

请直接输出一段简明扼要的世界背景描述（200字以内），不要包含任何前导词或解释词，直接开始你的创作：`

        const response = await generateReply([
            { role: 'system', content: '你是一位顶级的剧本作家。' },
            { role: 'user', content: prompt }
        ], { name: 'World Architect' })

        if (response && response.content) {
            form.value.description = response.content.replace(/\[.*?\]/g, '').trim()
        }
    } catch (e) {
        console.error('Failed to generate worldview', e)
        if (e.message?.includes('Failed to fetch') || e.code === 'ERR_CONNECTION_RESET') {
            chatStore.triggerToast('网络连接失败。请检查你的本地 AI 服务 (LM Studio/Ollama) 是否已开启并处于运行状态。', 'error')
        } else {
            chatStore.triggerToast('生成失败：' + (e.message || '未知错误'), 'error')
        }
    } finally {
        isGenerating.value = false
    }
}

const handleConfirm = () => {
    if (!form.value.name.trim()) return chatStore.triggerToast('请输入世界名称', 'warning')
    emit('confirm', { 
        ...form.value,
        participants: selectedContacts.value
    })
    // Reset form
    form.value = { name: '', description: '' }
    selectedContacts.value = []
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(155, 155, 155, 0.2);
    border-radius: 10px;
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}
.animate-scale-up {
    animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes scaleUp {
    from { opacity: 0; transform: scale(0.95) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes scaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>
