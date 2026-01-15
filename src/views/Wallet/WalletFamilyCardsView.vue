<template>
  <div class="h-full flex flex-col bg-[#ededed] font-sans">
    <!-- Top Bar -->
    <div class="h-[60px] bg-[#ededed] flex items-center px-4 relative shrink-0">
      <div @click="$router.back()" class="absolute left-4 w-10 h-10 flex items-center justify-center text-gray-800 -ml-2 cursor-pointer active:bg-black/5 rounded-full">
        <i class="fa-solid fa-chevron-left text-lg"></i>
      </div>
      <div class="flex-1 text-center font-bold text-lg">亲属卡</div>
      <div class="absolute right-4 w-10 h-10 flex items-center justify-center cursor-pointer active:bg-black/5 rounded-full" @click="showApplyModal = true">
        <i class="fa-solid fa-plus text-lg"></i>
      </div>
    </div>

    <!-- Family Card List -->
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div v-if="walletStore.familyCards.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <i class="fa-solid fa-people-roof text-5xl mb-4 opacity-50"></i>
            <p>暂无亲属卡，快去向Ta申请吧~</p>
        </div>

        <div v-for="card in walletStore.familyCards" :key="card.id" 
             class="relative w-full aspect-[1.58] rounded-xl p-6 text-white shadow-lg overflow-hidden transition-transform active:scale-[0.98] cursor-pointer bg-gradient-to-br from-gray-800 to-gray-900"
             @click="viewCardDetail(card)">
             
             <!-- Decor -->
             <div class="absolute -right-6 -top-6 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
             
             <div class="relative z-10 flex flex-col h-full justify-between">
                 <!-- Header -->
                 <div class="flex items-center gap-3">
                     <div class="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden bg-gray-300">
                         <img :src="getCharAvatar(card.ownerId)" class="w-full h-full object-cover">
                     </div>
                     <div>
                         <div class="font-bold text-lg leading-tight mb-0.5">{{ card.remark || '亲属卡' }}</div>
                         <div class="text-xs opacity-80 mb-1">赠送方: {{ card.ownerName }}</div>
                         <div class="text-[10px] opacity-60 font-mono tracking-wider">{{ card.number ? card.number.replace(/(\d{4})(?=\d)/g, "$1 ") : '**** **** **** ****' }}</div>
                     </div>
                 </div>
                 
                 <!-- Balance -->
                 <div class="flex justify-between items-end">
                     <div>
                         <div class="text-xs opacity-70 mb-1">可用额度</div>
                         <div class="text-3xl font-bold font-mono tracking-tight text-shadow">¥ {{ (card.amount - card.usedAmount).toFixed(2) }}</div>
                         <div class="text-[10px] opacity-60 mt-1">总额度: ¥{{ card.amount.toFixed(2) }}</div>
                     </div>
                     <i class="fa-brands fa-weixin text-3xl opacity-50"></i>
                 </div>
             </div>
        </div>
    </div>

    <!-- Apply Modal Step 1: Select Character -->
    <div v-if="showApplyModal" class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center sm:justify-center animate-fade-in" @click.self="showApplyModal = false">
        <div class="bg-white w-full sm:w-[320px] h-[70vh] sm:h-[500px] rounded-t-2xl sm:rounded-2xl flex flex-col animate-slide-up shadow-2xl">
            <div class="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 class="font-bold text-lg text-gray-800">选择申请对象</h3>
                <i class="fa-solid fa-xmark text-gray-400 p-2 cursor-pointer text-lg" @click="showApplyModal = false"></i>
            </div>
            
            <div class="flex-1 overflow-y-auto p-2">
                <div v-for="char in availableCharacters" :key="char.id"
                     class="flex items-center gap-4 p-3 rounded-xl active:bg-gray-50 transition-colors cursor-pointer group"
                     @click="startApplyStep2(char)">
                     <div class="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 shadow-sm">
                         <img :src="char.avatar" class="w-full h-full object-cover">
                     </div>
                     <div class="flex-1 min-w-0">
                         <div class="font-bold text-gray-900 text-base truncate">{{ char.remark || char.name }}</div>
                         <div class="text-[10px] text-gray-400 mt-0.5 line-clamp-1 truncate opacity-70">{{ char.statusText || 'Ta很神秘，什么都没写' }}</div>
                     </div>
                     <button class="bg-[#2c2c2e] text-[#e6dcc0] px-4 py-1.5 rounded-lg text-xs font-bold shrink-0 shadow-md transform active:scale-95 transition-all">
                         选择
                     </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Apply Modal Step 2: Input Remark & Amount -->
    <div v-if="showRemarkModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 animate-fade-in" @click.self="showRemarkModal = false">
        <div class="bg-white w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up border border-gray-100">
            <div class="bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e] p-6 text-center border-b border-[#d4af37]/20">
                <div class="w-16 h-16 bg-gradient-to-br from-[#d4af37] to-[#b8860b] rounded-full mx-auto mb-3 flex items-center justify-center text-gray-900 shadow-lg shadow-[#d4af37]/20">
                    <i class="fa-solid fa-crown text-2xl"></i>
                </div>
                <div class="text-[#e6dcc0] font-bold text-lg font-serif">亲属卡申请</div>
                <div class="text-[#e6dcc0]/60 text-[10px] mt-1 tracking-widest uppercase">Family Card Application</div>
            </div>
            
            <div class="p-6 space-y-5">
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">申请对象</label>
                    <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                        <img :src="applyingTarget?.avatar" class="w-5 h-5 rounded-md">
                        <span class="text-sm font-bold text-gray-700">{{ applyingTarget?.remark || applyingTarget?.name }}</span>
                    </div>
                </div>

                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">申请留言 (备注)</label>
                    <textarea v-model="applyRemark" 
                        class="w-full h-24 bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-[#d4af37]/40 transition-colors resize-none placeholder-gray-300"
                        placeholder="例如：送我一张亲属卡好不好？以后你来管家~"></textarea>
                </div>

                <div class="flex gap-3 pt-2">
                    <button class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-bold text-sm active:scale-95 transition-all"
                        @click="showRemarkModal = false">
                        取消
                    </button>
                    <button class="flex-2 py-3 px-8 rounded-xl bg-[#2c2c2e] text-[#e6dcc0] font-bold text-sm shadow-xl shadow-black/10 active:scale-95 transition-all border border-[#d4af37]/30"
                        @click="confirmApply">
                        发送申请
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

const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()

const showApplyModal = ref(false)

const availableCharacters = computed(() => {
    // Exclude 'user' or system accounts
    return Object.values(chatStore.chats).filter(c => c.id !== 'user' && c.id !== 'system' && c.id !== 'my_id')
})

const getCharName = (id) => chatStore.chats[id]?.name || '未知用户'
const getCharAvatar = (id) => chatStore.chats[id]?.avatar || '/avatars/default.jpg'

const getThemeClass = (theme) => {
    switch(theme) {
        case 'pink': return 'bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e] !text-[#e6dcc0] border border-[#d4af37]/30'
        case 'blue': return 'bg-gradient-to-br from-blue-400 to-cyan-300'
        default: return 'bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e] !text-[#e6dcc0]'
    }
}

const showRemarkModal = ref(false)
const applyingTarget = ref(null)
const applyRemark = ref('送我一张亲属卡好不好？以后你来管家~')
const applyAmount = ref(5200)

const startApplyStep2 = (char) => {
    applyingTarget.value = char
    showApplyModal.value = false
    showRemarkModal.value = true
}

const confirmApply = () => {
    const char = applyingTarget.value
    if (!char) return
    
    showRemarkModal.value = false
    
    // Switch Chat
    chatStore.currentChatId = char.id
    router.push('/wechat')
    
    // Send application tag - no amount here, let AI decide in response
    const cardTag = `[FAMILY_CARD_APPLY:${applyRemark.value}]`
    
    chatStore.addMessage(char.id, { 
        role: 'user', 
        content: cardTag
    })
    
    chatStore.triggerToast('申请已发送', 'success')
}

const viewCardDetail = (card) => {
    // Navigate to card detail page showing transactions
    router.push(`/wallet/family-cards/${card.id}`)
}
</script>

<style scoped>
.text-shadow { text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
.animate-slide-up { animation: slideUp 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>
