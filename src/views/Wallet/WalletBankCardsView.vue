<template>
    <div class="h-full flex flex-col bg-[#ededed]">
        <!-- Top Bar -->
        <div class="h-[60px] bg-[#ededed] flex items-center px-4 relative shrink-0">
            <div @click="$router.back()"
                class="absolute left-4 w-10 h-10 flex items-center justify-center text-gray-800 -ml-2 cursor-pointer active:bg-black/5 rounded-full">
                <i class="fa-solid fa-chevron-left text-lg"></i>
            </div>
            <div class="flex-1 text-center font-bold text-lg">银行卡</div>
            <div class="absolute right-4 w-10 h-10 flex items-center justify-center cursor-pointer active:bg-black/5 rounded-full"
                @click="showAddCard = true">
                <i class="fa-solid fa-plus text-lg"></i>
            </div>
        </div>

        <!-- Card List -->
        <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div v-if="walletStore.bankCards.length === 0"
                class="flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-credit-card text-5xl mb-4 opacity-50"></i>
                <p>暂无银行卡，请点击右上角添加</p>
            </div>

            <div v-for="card in walletStore.bankCards" :key="card.id"
                class="relative w-full aspect-[1.58] rounded-xl p-6 text-white shadow-lg overflow-hidden transition-transform active:scale-[0.98] cursor-pointer"
                :class="getCardThemeClass(card.theme)" @click="viewCardDetail(card)">

                <!-- Card Background Pattern (Decoration) -->
                <div class="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div class="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-xl -ml-10 -mb-10"></div>

                <!-- Card Content -->
                <div class="relative z-10 flex flex-col h-full justify-between">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <i class="fa-solid fa-building-columns text-lg"></i>
                            </div>
                            <div>
                                <div class="font-bold text-lg tracking-wide">{{ card.bankName }}</div>
                                <div class="text-xs opacity-80">储蓄卡</div>
                            </div>
                        </div>
                        <div class="text-xs opacity-70 italic">Universal Card</div>
                    </div>

                    <div class="space-y-1">
                        <div class="text-2xl font-mono tracking-widest text-shadow">{{ formatCardNumber(card.number) }}
                        </div>
                        <div class="flex justify-between items-end">
                            <div class="opacity-80 text-xs">BALANCE</div>
                            <div class="text-xl font-bold">¥ {{ Number(card.balance).toFixed(2) }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add Card Modal -->
        <div v-if="showAddCard"
            class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center sm:justify-center p-4 animate-fade-in"
            @click.self="showAddCard = false">
            <div class="bg-white w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl animate-scale-up">
                <div class="p-6">
                    <h3 class="font-bold text-xl mb-6 text-center text-gray-800">添加银行卡</h3>

                    <div class="space-y-4">
                        <!-- Bank Name -->
                        <div
                            class="bg-gray-50 p-3 rounded-xl border border-gray-100 focus-within:border-blue-500 focus-within:bg-white transition-colors">
                            <label class="text-xs text-gray-400 font-bold ml-1 block mb-1">银行名称</label>
                            <input v-model="newCard.bankName" type="text" placeholder="例如：中国工商银行"
                                class="w-full bg-transparent outline-none text-gray-800 font-medium">
                        </div>

                        <!-- Balance -->
                        <div
                            class="bg-gray-50 p-3 rounded-xl border border-gray-100 focus-within:border-blue-500 focus-within:bg-white transition-colors">
                            <label class="text-xs text-gray-400 font-bold ml-1 block mb-1">初始余额</label>
                            <input v-model="newCard.balance" type="number" placeholder="0.00"
                                class="w-full bg-transparent outline-none text-gray-800 font-medium">
                        </div>

                        <!-- Card Number -->
                        <div
                            class="bg-gray-50 p-3 rounded-xl border border-gray-100 focus-within:border-blue-500 focus-within:bg-white transition-colors">
                            <label class="text-xs text-gray-400 font-bold ml-1 block mb-1">卡号 (选填，留空自动生成)</label>
                            <input v-model="newCard.number" type="text" placeholder="xxxx xxxx xxxx xxxx"
                                class="w-full bg-transparent outline-none text-gray-800 font-bold font-mono">
                        </div>

                        <!-- Theme Selection -->
                        <div>
                            <label class="text-xs text-gray-400 font-bold ml-1 block mb-3">选择卡面</label>
                            <div class="flex justify-between gap-2">
                                <div v-for="theme in themes" :key="theme.value" @click="newCard.theme = theme.value"
                                    class="w-10 h-10 rounded-full cursor-pointer ring-2 ring-offset-2 transition-all flex items-center justify-center text-white"
                                    :class="[theme.class, newCard.theme === theme.value ? 'ring-blue-500 scale-110' : 'ring-transparent opacity-70 hover:opacity-100']">
                                    <i v-if="newCard.theme === theme.value" class="fa-solid fa-check text-xs"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button @click="handleAddCard"
                        class="w-full mt-8 bg-[#07c160] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-green-500/30 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="!newCard.bankName">
                        立即绑定
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore'

const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()

const showAddCard = ref(false)

const themes = [
    { value: 'red', class: 'bg-gradient-to-br from-red-500 to-pink-600' },
    { value: 'blue', class: 'bg-gradient-to-br from-blue-500 to-cyan-500' },
    { value: 'gold', class: 'bg-gradient-to-br from-yellow-500 via-orange-400 to-yellow-600' },
    { value: 'black', class: 'bg-gradient-to-br from-gray-700 to-black' },
    { value: 'purple', class: 'bg-gradient-to-br from-purple-500 to-indigo-600' }
]

const newCard = reactive({
    bankName: '',
    balance: '',
    number: '',
    theme: 'blue'
})

const getCardThemeClass = (theme) => {
    const t = themes.find(t => t.value === theme)
    return t ? t.class : themes[0].class
}

const formatCardNumber = (num) => {
    return num.replace(/(\d{4})(?=\d)/g, "$1 ")
}

const generateCardNumber = () => {
    let num = '62' // UnionPay start
    for (let i = 0; i < 14; i++) {
        num += Math.floor(Math.random() * 10)
    }
    return num
}

const handleAddCard = () => {
    if (!newCard.bankName) return

    const finalNumber = newCard.number || generateCardNumber()

    walletStore.addBankCard({
        bankName: newCard.bankName,
        number: finalNumber,
        balance: parseFloat(newCard.balance) || 0,
        theme: newCard.theme
    })

    chatStore.triggerToast('添加银行卡成功', 'success')
    showAddCard.value = false

    // Reset form
    newCard.bankName = ''
    newCard.balance = ''
    newCard.number = ''
    newCard.theme = 'blue'
}

const viewCardDetail = (card) => {
    router.push({ name: 'wallet-bank-card-detail', params: { id: card.id } })
}
</script>

<style scoped>
.text-shadow {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}

.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
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
</style>
