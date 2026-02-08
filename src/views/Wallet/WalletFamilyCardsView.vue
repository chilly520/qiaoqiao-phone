<template>
    <div class="h-full flex flex-col transition-colors duration-300 font-sans"
        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
        <!-- Top Bar -->
        <div class="h-[60px] flex items-center px-4 relative shrink-0 transition-colors"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
            <div @click="$router.back()"
                class="absolute left-4 w-10 h-10 flex items-center justify-center -ml-2 cursor-pointer hover:bg-black/5 rounded-full transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-800'">
                <i class="fa-solid fa-chevron-left text-lg"></i>
            </div>
            <div class="flex-1 text-center font-bold text-lg"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">亲属卡</div>
            <div class="absolute right-4 w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-black/5 rounded-full transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-800'"
                @click="showApplyModal = true">
                <i class="fa-solid fa-plus text-lg"></i>
            </div>
        </div>

        <!-- Family Card List -->
        <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            <div v-if="walletStore.familyCards.length === 0"
                class="flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-people-roof text-5xl mb-4 opacity-10"></i>
                <p class="text-sm font-medium opacity-50">暂无亲属卡，快去向Ta申请吧~</p>
            </div>

            <div v-for="card in walletStore.familyCards" :key="card.id"
                class="relative w-full aspect-[1.58] rounded-[24px] p-8 text-[#e6dcc0] shadow-2xl overflow-hidden transition-all active:scale-[0.98] cursor-pointer border border-[#d4af37]/30 hover:shadow-gold/20"
                :class="getThemeClass(card.theme)" @click="viewCardDetail(card)">

                <!-- Decor -->
                <div class="absolute -right-8 -top-8 w-40 h-40 bg-[#d4af37]/10 rounded-full blur-3xl"></div>
                <div class="absolute -left-12 -bottom-12 w-32 h-32 bg-black/40 rounded-full blur-2xl"></div>

                <div class="relative z-10 flex flex-col h-full justify-between">
                    <!-- Header -->
                    <div class="flex items-center gap-4">
                        <div
                            class="w-12 h-12 rounded-2xl border-2 border-[#d4af37]/30 overflow-hidden bg-gray-900 shadow-xl p-0.5">
                            <img :src="getCharAvatar(card.ownerId, card)"
                                class="w-full h-full object-cover rounded-[10px]">
                        </div>
                        <div>
                            <div class="font-bold text-[18px] leading-tight mb-1 tracking-tight text-shadow-gold">{{
                                card.remark || '亲属卡' }}</div>
                            <div class="text-[11px] opacity-70 mb-1 flex items-center gap-1">
                                <i class="fa-solid fa-gift text-[9px]"></i>
                                <span>赠送方: {{ card.ownerName }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="absolute top-0 right-0 text-[#d4af37]/30">
                        <i class="fa-solid fa-crown text-xl"></i>
                    </div>

                    <!-- Balance -->
                    <div class="flex justify-between items-end border-t border-[#d4af37]/10 pt-4">
                        <div>
                            <div class="text-[10px] opacity-60 tracking-wider mb-1 uppercase font-bold">Limit</div>
                            <div class="text-3xl font-bold font-mono tracking-tighter text-shadow-gold">¥ {{
                                (card.amount - card.usedAmount).toFixed(2) }}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-[9px] font-mono tracking-widest opacity-30 mb-1 rotate-0 origin-right">
                                MEMBER ID: {{ card.id.substring(0, 6) }}</div>
                            <i class="fa-brands fa-weixin text-2xl opacity-20"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Apply Modal Step 1: Select Character -->
        <div v-if="showApplyModal"
            class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center animate-fade-in"
            @click.self="showApplyModal = false">
            <div class="w-full sm:w-[380px] h-[75vh] sm:h-[550px] rounded-t-[32px] sm:rounded-[32px] flex flex-col animate-slide-up shadow-2xl transition-colors duration-300"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border border-white/10' : 'bg-white'">
                <div class="p-6 border-b transition-colors flex items-center justify-between"
                    :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5' : 'border-gray-50'">
                    <h3 class="font-bold text-xl tracking-tight"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">选择赠送方
                    </h3>
                    <button @click="showApplyModal = false"
                        class="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:bg-white/10' : 'text-gray-300 hover:bg-black/5'">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto p-4 space-y-2">
                    <div v-for="char in availableCharacters" :key="char.id"
                        class="flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer group group active:scale-[0.98]"
                        :class="settingsStore.personalization.theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'"
                        @click="startApplyStep2(char)">
                        <div class="w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden shrink-0 shadow-lg border-2 transition-transform group-hover:scale-105"
                            :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-white'">
                            <img :src="char.avatar" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-base truncate"
                                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-100' : 'text-gray-900'">
                                {{ char.remark || char.name }}</div>
                            <div class="text-[11px] mt-1 line-clamp-1 opacity-60"
                                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">
                                {{ char.statusText || 'Ta很神秘，什么都没写' }}</div>
                        </div>
                        <div class="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-[#d4af37] bg-[#d4af37]/10' : 'text-blue-500 bg-blue-50'">
                            <i class="fa-solid fa-chevron-right text-xs"></i>
                        </div>
                    </div>
                    <div v-if="availableCharacters.length === 0" class="text-center py-20 text-gray-400 opacity-50">
                        暂无可申请的对象</div>
                </div>
            </div>
        </div>

        <!-- Apply Modal Step 2: Input Remark & Amount -->
        <div v-if="showRemarkModal"
            class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"
            @click.self="showRemarkModal = false">
            <div
                class="w-full max-w-[340px] rounded-[32px] overflow-hidden shadow-gold/20 shadow-2xl animate-scale-up border border-[#d4af37]/30 bg-[#1c1c1e]">
                <div
                    class="bg-gradient-to-br from-[#2c2c2e] to-[#141414] p-8 text-center border-b border-[#d4af37]/20 relative overflow-hidden">
                    <div class="absolute -right-10 -top-10 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-3xl"></div>
                    <div
                        class="w-20 h-20 bg-gradient-to-br from-[#d4af37] via-[#f9e59d] to-[#b8860b] rounded-[24px] mx-auto mb-4 flex items-center justify-center text-gray-900 shadow-[0_10px_30px_rgba(212,175,55,0.4)] transform -rotate-[10deg]">
                        <i class="fa-solid fa-crown text-3xl"></i>
                    </div>
                    <div class="text-[#e6dcc0] font-bold text-xl tracking-tight mb-1">亲属卡申请</div>
                    <div class="text-[#d4af37]/50 text-[10px] tracking-[0.3em] uppercase font-bold">Family Card</div>
                </div>

                <div class="p-8 space-y-6">
                    <div class="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                        <img :src="applyingTarget?.avatar"
                            class="w-12 h-12 rounded-xl object-cover border border-[#d4af37]/20 shadow-lg">
                        <div class="flex-1">
                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">APPLICANT
                                TARGET</div>
                            <div class="text-[#e6dcc0] font-bold text-base">{{ applyingTarget?.remark ||
                                applyingTarget?.name }}</div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[11px] text-[#d4af37]/60 font-bold uppercase tracking-widest ml-1">申请留言 /
                            REMARK</label>
                        <textarea v-model="applyRemark"
                            class="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-[#e6dcc0] outline-none focus:border-[#d4af37]/40 transition-all resize-none placeholder-gray-600 font-medium"
                            placeholder="想对Ta说点什么..."></textarea>
                    </div>

                    <div class="flex gap-4 pt-2">
                        <button
                            class="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 font-bold text-sm active:scale-95 transition-all border border-white/5"
                            @click="showRemarkModal = false">
                            取消
                        </button>
                        <button
                            class="flex-[1.5] py-4 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#1c1c1e] font-bold text-sm shadow-xl shadow-[#d4af37]/20 active:scale-95 transition-all border border-white/20"
                            @click="confirmApply">
                            发送请求
                        </button>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'

const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const showApplyModal = ref(false)

const availableCharacters = computed(() => {
    return Object.values(chatStore.chats).filter(c => c.id !== 'user' && c.id !== 'system' && c.id !== 'my_id')
})

const getCharAvatar = (id, card) => {
    // 1. Direct ID lookup
    if (chatStore.chats[id]) return chatStore.chats[id].avatar

    // 2. Name Lookup (Fallback)
    // If card is passed directly (updated template case)
    if (card && card.ownerName) {
        const chat = Object.values(chatStore.chats).find(c => c.name === card.ownerName)
        if (chat) return chat.avatar
    }

    // 3. Try finding name from ID if ID is actually a name string
    const chatByName = Object.values(chatStore.chats).find(c => c.name === id)
    if (chatByName) return chatByName.avatar

    return '/avatars/default.jpg'
}

const getThemeClass = (theme) => {
    switch (theme) {
        case 'pink': return 'bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e]'
        case 'blue': return 'bg-gradient-to-br from-blue-600 to-indigo-700 !text-white border-blue-400/30'
        default: return 'bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e]'
    }
}

const showRemarkModal = ref(false)
const applyingTarget = ref(null)
const applyRemark = ref('送我一张亲属卡好不好？以后你来管家~')

const startApplyStep2 = (char) => {
    applyingTarget.value = char
    showApplyModal.value = false
    showRemarkModal.value = true
}

const confirmApply = () => {
    const char = applyingTarget.value
    if (!char) return

    showRemarkModal.value = false

    chatStore.currentChatId = char.id
    router.push('/wechat')

    const cardTag = `[FAMILY_CARD_APPLY:${applyRemark.value}]`

    chatStore.addMessage(char.id, {
        role: 'user',
        content: cardTag
    })

    chatStore.triggerToast('✨ 申请已成功送达', 'success')
}

const viewCardDetail = (card) => {
    router.push(`/wallet/family-cards/${card.id}`)
}
</script>

<style scoped>
.text-shadow-gold {
    text-shadow: 0 2px 8px rgba(212, 175, 55, 0.4);
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

.animate-slide-up {
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.animate-scale-up {
    animation: scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes scaleUp {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.shadow-gold\/20 {
    box-shadow: 0 20px 50px -12px rgba(212, 175, 55, 0.25);
}
</style>
