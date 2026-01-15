<template>
  <div class="h-full flex flex-col bg-[#ededed] font-sans">
    <!-- Top Bar -->
    <div class="h-[60px] bg-[#ededed] flex items-center px-4 relative z-10 shrink-0">
      <div @click="$router.back()" class="absolute left-4 w-10 h-10 flex items-center justify-center text-gray-800 -ml-2 cursor-pointer active:bg-black/5 rounded-full">
        <i class="fa-solid fa-chevron-left text-lg"></i>
      </div>
      <div class="flex-1 text-center font-bold text-lg">{{ cardDetail?.remark || '亲属卡' }}</div>
    </div>

    <!-- Card Info Section -->
    <div class="bg-white p-6 mb-4">
      <div class="relative w-full aspect-[1.58] rounded-xl p-6 text-white shadow-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
        <!-- Decor -->
        <div class="absolute -right-6 -top-6 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
        
        <div class="relative z-10 flex flex-col h-full justify-between">
            <!-- Header -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden bg-gray-300">
                    <img :src="getCharAvatar(cardDetail.ownerId)" class="w-full h-full object-cover">
                </div>
                <div>
                    <div class="font-bold text-lg leading-tight mb-0.5">{{ cardDetail?.remark || '亲属卡' }}</div>
                    <div class="text-xs opacity-80 mb-1">赠送方: {{ cardDetail?.ownerName }}</div>
                    <div class="text-[10px] opacity-60 font-mono tracking-wider">{{ cardDetail?.number ? cardDetail.number.replace(/(\d{4})(?=\d)/g, "$1 ") : '**** **** **** ****' }}</div>
                </div>
            </div>
            
            <!-- Balance -->
            <div class="flex justify-between items-end">
                <div>
                    <div class="text-xs opacity-70 mb-1">可用额度</div>
                    <div class="text-3xl font-bold font-mono tracking-tight text-shadow">¥ {{ availableAmount }}</div>
                    <div class="text-[10px] opacity-60 mt-1">总额度: ¥{{ cardDetail?.amount.toFixed(2) }}</div>
                </div>
                <i class="fa-brands fa-weixin text-3xl opacity-50"></i>
            </div>
        </div>
      </div>
    </div>

    <!-- Transaction List -->
    <div class="flex-1 overflow-y-auto">
      <div class="bg-white">
        <div class="px-4 py-3 border-b border-gray-100">
          <h3 class="font-bold text-gray-800">消费明细</h3>
        </div>
        
        <div v-if="cardDetail?.transactions?.length === 0" class="p-8 text-center text-gray-400">
          <i class="fa-solid fa-file-invoice-dollar text-5xl mb-3 opacity-30"></i>
          <p>暂无消费记录</p>
        </div>
        
        <div v-else class="divide-y divide-gray-100">
          <div v-for="tx in cardDetail?.transactions" :key="tx.id" class="px-4 py-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <i class="fa-solid fa-shopping-bag text-gray-600"></i>
              </div>
              <div>
                <div class="font-medium text-gray-800">{{ tx.title || '消费' }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ formatTime(tx.time) }}</div>
              </div>
            </div>
            <div class="text-red-500 font-bold">-¥{{ tx.amount.toFixed(2) }}</div>
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

const route = useRoute()
const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()

const cardDetail = ref(null)

const availableAmount = computed(() => {
  if (!cardDetail.value) return '0.00'
  return (cardDetail.value.amount - cardDetail.value.usedAmount).toFixed(2)
})

const getCharAvatar = (id) => {
  return chatStore.chats[id]?.avatar || '/avatars/default.jpg'
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
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
.text-shadow { text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
</style>