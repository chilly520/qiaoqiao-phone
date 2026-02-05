<template>
    <div class="h-full flex flex-col transition-colors duration-300"
        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
        <!-- Top Bar -->
        <div class="h-[60px] flex items-center px-4 relative shrink-0 transition-colors"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] text-white' : 'bg-[#1a1a1a] text-white'">
            <div @click="$router.back()"
                class="absolute left-4 w-10 h-10 flex items-center justify-center -ml-2 cursor-pointer hover:bg-white/10 rounded-full transition-colors">
                <i class="fa-solid fa-chevron-left text-lg"></i>
            </div>
            <div class="flex-1 text-center font-bold text-lg">银行卡详情</div>
            <div class="absolute right-4 w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-white/10 rounded-full transition-colors">
                <i class="fa-solid fa-ellipsis text-lg"></i>
            </div>
        </div>

        <div v-if="card" class="flex-1 overflow-y-auto">
            <!-- Card Header -->
            <div class="p-6 rounded-b-[24px] shadow-md mb-4 flex flex-col items-center pb-10 transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] text-white' : 'bg-[#1a1a1a] text-white'">
                <div class="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 text-2xl backdrop-blur-sm shadow-inner transition-colors">
                    <i class="fa-solid fa-building-columns"></i>
                </div>
                <div class="text-xl font-bold mb-1">{{ card.bankName }}</div>
                <div class="font-mono mb-6 text-sm" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">**** {{ card.number.slice(-4) }}</div>

                <div class="text-gray-400 text-xs mb-1 uppercase tracking-wider">当前余额</div>
                <div class="text-4xl font-bold font-mono text-shadow">¥ {{ parseFloat(card.balance).toFixed(2) }}</div>
            </div>

            <!-- Transactions -->
            <div class="px-4 pb-4">
                <div class="rounded-xl shadow-sm overflow-hidden border transition-colors"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-transparent'">
                    <div class="px-4 py-3 border-b flex items-center justify-between transition-colors"
                        :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5' : 'border-gray-100'">
                        <span class="font-bold" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-200' : 'text-gray-800'">交易记录</span>
                        <span class="text-xs text-gray-400">Recent Transactions</span>
                    </div>

                    <div v-if="!card.transactions || card.transactions.length === 0"
                        class="py-12 text-center text-gray-500">
                        <i class="fa-solid fa-receipt text-3xl mb-3 opacity-20"></i>
                        <p class="text-sm">暂无交易记录</p>
                    </div>

                    <div v-else>
                        <div v-for="tx in reversedTransactions" :key="tx.id"
                            class="flex items-center justify-between p-4 border-b last:border-none transition-colors"
                            :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-gray-50 hover:bg-gray-50'">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm"
                                    :class="tx.amount > 0 && tx.type === 'income' ? 'bg-[#07c160]' : 'bg-[#fa9d3b]'">
                                    <i :class="tx.amount > 0 && tx.type === 'income' ? 'fa-solid fa-arrow-down' : 'fa-solid fa-shop'"></i>
                                </div>
                                <div>
                                    <div class="text-sm font-bold" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-100' : 'text-gray-900'">{{ tx.title || '交易' }}</div>
                                    <div class="text-xs text-gray-400 mt-0.5">{{ formatTime(tx.time) }}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="font-bold font-mono transition-colors"
                                    :class="tx.type === 'expense' ? (settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-black') : 'text-[#fa9d3b]'">
                                    {{ tx.type === 'expense' ? '-' : '+' }}{{ parseFloat(tx.amount).toFixed(2) }}
                                </div>
                                <div class="text-xs text-gray-400 mt-0.5">支付成功</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Unbind Button -->
                <div class="mt-8 px-4">
                    <button class="w-full py-3 rounded-xl border font-bold transition-all active:scale-95"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-red-400 hover:bg-white/10' : 'bg-white border-gray-300 text-red-500 hover:bg-gray-50'"
                        @click="unbindCard">
                        解除绑定
                    </button>
                </div>
            </div>
        </div>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-400">
            <i class="fa-solid fa-circle-exclamation text-4xl mb-2"></i>
            <span>未找到该银行卡信息</span>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'

const route = useRoute()
const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()

const cardId = route.params.id
const card = computed(() => walletStore.bankCards.find(c => c.id === cardId))

const reversedTransactions = computed(() => {
    if (!card.value || !card.value.transactions) return []
    return [...card.value.transactions].reverse()
})

const formatTime = (ts) => {
    return new Date(ts).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
}

const unbindCard = () => {
    if (confirm('确定要解除绑定该银行卡吗？')) {
        const idx = walletStore.bankCards.findIndex(c => c.id === cardId)
        if (idx !== -1) {
            walletStore.bankCards.splice(idx, 1)
            walletStore.save()
            chatStore.triggerToast('解绑成功', 'success')
            router.back()
        }
    }
}
</script>

<style scoped>
.text-shadow {
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
</style>
