<template>
    <div class="h-full flex flex-col transition-colors duration-300"
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
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">银行卡</div>
            <div class="absolute right-4 w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-black/5 rounded-full transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-800'"
                @click="showAddCard = true">
                <i class="fa-solid fa-plus text-lg"></i>
            </div>
        </div>

        <!-- Card List -->
        <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div v-if="walletStore.bankCards.length === 0"
                class="flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-credit-card text-5xl mb-4 opacity-10"></i>
                <p class="text-sm font-medium opacity-50">暂无银行卡，请点击右上角添加</p>
            </div>

            <div v-for="card in walletStore.bankCards" :key="card.id"
                class="relative w-full aspect-[1.58] rounded-2xl p-6 text-white shadow-xl overflow-hidden transition-all active:scale-[0.98] cursor-pointer hover:shadow-2xl hover:-translate-y-1"
                :class="getCardThemeClass(card.theme)" @click="viewCardDetail(card)">

                <!-- Card Background Pattern (Decoration) -->
                <div class="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
                <div class="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-12 -mb-12"></div>

                <!-- Card Content -->
                <div class="relative z-10 flex flex-col h-full justify-between">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                                <i class="fa-solid fa-building-columns text-xl"></i>
                            </div>
                            <div>
                                <div class="font-bold text-[18px] tracking-wide text-shadow">{{ card.bankName }}</div>
                                <div class="text-[11px] opacity-70 tracking-tight">储蓄卡 / DEBIT CARD</div>
                            </div>
                        </div>
                        <div class="text-[10px] opacity-50 italic tracking-widest font-mono">GLOBAL PASS</div>
                    </div>

                    <div class="space-y-4">
                        <div class="text-[22px] font-mono tracking-[0.2em] text-shadow flex justify-between items-center opacity-90">
                           <span>{{ card.number ? card.number.substring(0,4) : '****' }}</span>
                           <span>****</span>
                           <span>****</span>
                           <span>{{ card.number ? card.number.substring(card.number.length - 4) : '****' }}</span>
                        </div>
                        <div class="flex justify-between items-end border-t border-white/10 pt-4">
                            <div>
                                <div class="text-[10px] opacity-60 tracking-wider mb-0.5">AVAIL BALANCE</div>
                                <div class="text-xl font-bold font-mono">¥ {{ Number(card.balance).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</div>
                            </div>
                            <div class="w-10 h-6 flex items-center justify-center opacity-80">
                                <i class="fa-brands fa-cc-visa text-2xl" v-if="card.theme === 'blue'"></i>
                                <i class="fa-brands fa-cc-mastercard text-2xl" v-else-if="card.theme === 'red'"></i>
                                <i class="fa-solid fa-shield-halved text-xl" v-else></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add Card Modal -->
        <div v-if="showAddCard"
            class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-4 animate-fade-in"
            @click.self="showAddCard = false">
            <div class="w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-scale-up transition-colors duration-300"
                 :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border border-white/10' : 'bg-white'">
                <div class="p-8">
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="font-bold text-[22px] tracking-tight" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">添加银行卡</h3>
                        <button @click="showAddCard = false" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5"
                                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:bg-white/10' : 'text-gray-400'">
                           <i class="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>

                    <div class="space-y-5">
                        <!-- Bank Name -->
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-bold uppercase tracking-wider ml-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">银行名称</label>
                            <div class="transition-all rounded-2xl border"
                                 :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 focus-within:border-blue-500 focus-within:bg-white/10' : 'bg-gray-50 border-gray-100 focus-within:border-blue-500 focus-within:bg-white'">
                                <input v-model="newCard.bankName" type="text" placeholder="例如：中国工商银行"
                                    class="w-full bg-transparent outline-none px-4 py-3.5 text-base font-medium"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white placeholder-gray-600' : 'text-gray-800 placeholder-gray-300'">
                            </div>
                        </div>

                        <!-- Balance -->
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-bold uppercase tracking-wider ml-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">初始余额</label>
                            <div class="transition-all rounded-2xl border flex items-center"
                                 :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 focus-within:border-blue-500 focus-within:bg-white/10' : 'bg-gray-50 border-gray-100 focus-within:border-blue-500 focus-within:bg-white'">
                                <span class="pl-4 font-bold opacity-40">¥</span>
                                <input v-model="newCard.balance" type="number" placeholder="0.00"
                                    class="w-full bg-transparent outline-none px-2 py-3.5 text-base font-mono font-bold"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white placeholder-gray-600' : 'text-gray-800 placeholder-gray-300'">
                            </div>
                        </div>

                        <!-- Card Number -->
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-bold uppercase tracking-wider ml-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">卡号 (选填)</label>
                            <div class="transition-all rounded-2xl border"
                                 :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 focus-within:border-blue-500 focus-within:bg-white/10' : 'bg-gray-50 border-gray-100 focus-within:border-blue-500 focus-within:bg-white'">
                                <input v-model="newCard.number" type="text" placeholder="留空自动生成"
                                    class="w-full bg-transparent outline-none px-4 py-3.5 text-base font-mono font-bold tracking-widest"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white placeholder-gray-600' : 'text-gray-800 placeholder-gray-300'">
                            </div>
                        </div>

                        <!-- Theme Selection -->
                        <div class="pt-2">
                            <label class="text-[11px] font-bold uppercase tracking-wider ml-1 mb-4 block" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">选择卡面设计</label>
                            <div class="flex justify-between gap-3">
                                <div v-for="theme in themes" :key="theme.value" @click="newCard.theme = theme.value"
                                    class="flex-1 aspect-square rounded-2xl cursor-pointer ring-offset-4 transition-all flex items-center justify-center text-white shadow-lg overflow-hidden relative group"
                                    :class="[theme.class, newCard.theme === theme.value ? 'ring-4 ring-blue-500 scale-105' : 'ring-transparent opacity-60 hover:opacity-100']"
                                    :style="settingsStore.personalization.theme === 'dark' ? { '--tw-ring-offset-color': '#1e293b' } : {}">
                                    <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <i v-if="newCard.theme === theme.value" class="fa-solid fa-check text-base drop-shadow-md animate-scale-in"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button @click="handleAddCard"
                        class="w-full mt-10 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-[18px] font-bold text-lg shadow-xl shadow-green-500/20 active:scale-[0.98] transition-all disabled:grayscale disabled:opacity-30 disabled:active:scale-100"
                        :disabled="!newCard.bankName">
                        确认绑定
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
import { useSettingsStore } from '../../stores/settingsStore'

const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const showAddCard = ref(false)

const themes = [
    { value: 'blue', class: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700' },
    { value: 'red', class: 'bg-gradient-to-br from-rose-500 via-red-600 to-pink-700' },
    { value: 'gold', class: 'bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-600' },
    { value: 'black', class: 'bg-gradient-to-br from-slate-700 via-slate-800 to-black' },
    { value: 'purple', class: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-800' }
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

    chatStore.triggerToast('✨ 银行卡绑定成功', 'success')
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
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

.animate-scale-up {
    animation: scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes scaleUp {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

@keyframes scaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
</style>
