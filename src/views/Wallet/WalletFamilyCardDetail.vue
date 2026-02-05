<template>
  <div class="h-full flex flex-col transition-colors duration-300 font-sans"
    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
    <!-- Top Bar -->
    <div class="h-[60px] flex items-center px-4 relative z-10 shrink-0 transition-colors"
         :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
      <div @click="$router.back()" class="absolute left-4 w-10 h-10 flex items-center justify-center -ml-2 cursor-pointer hover:bg-black/5 rounded-full transition-colors"
           :class="settingsStore.personalization.theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-800'">
        <i class="fa-solid fa-chevron-left text-lg"></i>
      </div>
      <div class="flex-1 text-center font-bold text-lg"
           :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
        {{ cardDetail?.remark || '亲属卡' }}
      </div>
    </div>

    <!-- Card Info Section -->
    <div class="p-6 transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'">
      <div class="relative w-full aspect-[1.58] rounded-[24px] p-8 text-[#e6dcc0] shadow-2xl overflow-hidden border border-[#d4af37]/30 group"
           :class="getThemeClass(cardDetail?.theme)">
        <!-- Decor -->
        <div class="absolute -right-8 -top-8 w-48 h-48 bg-[#d4af37]/10 rounded-full blur-3xl group-hover:bg-[#d4af37]/20 transition-all duration-700"></div>
        <div class="absolute -left-12 -bottom-12 w-40 h-40 bg-black/40 rounded-full blur-2xl"></div>
        
        <div class="relative z-10 flex flex-col h-full justify-between">
            <!-- Header -->
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl border-2 border-[#d4af37]/30 overflow-hidden bg-gray-900 shadow-xl p-0.5">
                    <img :src="getCharAvatar(cardDetail?.ownerId)" class="w-full h-full object-cover rounded-[14px]">
                </div>
                <div>
                    <div class="font-bold text-[20px] leading-tight mb-1 tracking-tight text-shadow-gold">{{ cardDetail?.remark || '亲属卡' }}</div>
                    <div class="text-[11px] opacity-70 mb-1 flex items-center gap-1">
                        <i class="fa-solid fa-gift text-[9px]"></i>
                        <span>赠送方: {{ cardDetail?.ownerName }}</span>
                    </div>
                </div>
            </div>
            
            <div class="absolute top-8 right-8 text-[#d4af37]/40">
                <i class="fa-solid fa-crown text-2xl"></i>
            </div>
            
            <!-- Balance -->
            <div class="flex justify-between items-end border-t border-[#d4af37]/10 pt-6">
                <div>
                    <div class="text-[10px] opacity-60 tracking-[0.2em] mb-1.5 uppercase font-bold">Available Quota</div>
                    <div class="text-4xl font-bold font-mono tracking-tighter text-shadow-gold">¥ {{ availableAmount }}</div>
                    <div class="text-[10px] opacity-40 mt-2 font-medium">总额度: ¥{{ cardDetail?.amount.toFixed(2) }}</div>
                </div>
                <div class="text-right">
                    <div class="text-[11px] font-mono tracking-[0.15em] opacity-40 mb-1">FAMILY PASS</div>
                    <i class="fa-brands fa-weixin text-3xl opacity-20"></i>
                </div>
            </div>
        </div>
      </div>
    </div>

    <!-- Transaction List -->
    <div class="flex-1 rounded-t-[32px] overflow-hidden flex flex-col shadow-inner transition-colors border-t"
         :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-transparent'">
      <div class="px-6 py-5 border-b transition-colors"
           :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5' : 'border-gray-50'">
        <h3 class="font-bold text-base tracking-tight" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-200' : 'text-gray-800'">消费明细</h3>
      </div>
      
      <div class="flex-1 overflow-y-auto">
        <div v-if="cardDetail?.transactions?.length === 0" class="p-20 text-center text-gray-400">
          <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"
               :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5' : ''">
            <i class="fa-solid fa-file-invoice-dollar text-3xl opacity-10"></i>
          </div>
          <p class="text-sm font-medium opacity-50">暂无消费记录</p>
        </div>
        
        <div v-else class="divide-y transition-colors"
             :class="settingsStore.personalization.theme === 'dark' ? 'divide-white/5' : 'divide-gray-50'">
          <div v-for="tx in cardDetail?.transactions" :key="tx.id" class="px-6 py-5 flex items-center justify-between hover:bg-black/[0.02] transition-colors">
            <div class="flex items-center gap-4">
              <div class="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                   :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400' : 'bg-gray-50 text-gray-600'">
                <i class="fa-solid fa-shopping-bag text-lg"></i>
              </div>
              <div>
                <div class="font-bold text-[15px] mb-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-100' : 'text-gray-800'">
                    {{ tx.title || '消费' }}
                </div>
                <div class="text-xs text-gray-500 opacity-60">{{ formatTime(tx.time) }}</div>
              </div>
            </div>
            <div class="text-red-500 font-bold font-mono text-lg">-¥{{ tx.amount.toFixed(2) }}</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'

const route = useRoute()
const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const cardDetail = ref(null)

const availableAmount = computed(() => {
  if (!cardDetail.value) return '0.00'
  return (cardDetail.value.amount - cardDetail.value.usedAmount).toFixed(2)
})

const getCharAvatar = (id) => {
  return chatStore.chats[id]?.avatar || '/avatars/default.jpg'
}

const getThemeClass = (theme) => {
    switch(theme) {
        case 'pink': return 'bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e]'
        case 'blue': return 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white border-blue-400/30'
        default: return 'bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e]'
    }
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadCardDetail = () => {
  const cardId = route.params.id
  const card = walletStore.familyCards.find(c => c.id === cardId)
  if (card) {
    cardDetail.value = card
  } else {
    router.push('/wallet/family-cards')
  }
}

onMounted(() => {
  loadCardDetail()
})
</script>

<style scoped>
.text-shadow-gold { 
    text-shadow: 0 2px 8px rgba(212, 175, 55, 0.4); 
}
</style>