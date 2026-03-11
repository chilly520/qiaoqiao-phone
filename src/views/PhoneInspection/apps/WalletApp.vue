<template>
    <div class="wallet-app h-full bg-[#FAFAFA] flex flex-col overflow-hidden text-[#333]">
        <!-- Header -->
        <div
            class="wallet-header pt-16 pb-4 px-6 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-50">
            <div class="flex items-center justify-between">
                <button @click="$emit('back')"
                    class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-[#FD70A1] active:scale-90 transition-transform">
                    <i class="fa-solid fa-chevron-left text-lg"></i>
                </button>
                <h1 class="text-[17px] font-black tracking-tight text-gray-800">数字钱包</h1>
                <div class="w-10 flex justify-end">
                    <i class="fa-solid fa-shield-halved text-green-400"></i>
                </div>
            </div>
        </div>

        <!-- Content -->
        <div class="wallet-content flex-1 overflow-y-auto px-6 pb-20">
            <!-- Balance Card -->
            <div
                class="balance-card mt-6 p-8 rounded-[40px] bg-gradient-to-br from-[#2D2D2D] via-[#1A1A1A] to-[#000000] text-white shadow-2xl relative overflow-hidden group">
                <div class="relative z-10">
                    <div class="flex justify-between items-start mb-2">
                        <p class="text-[11px] opacity-50 font-black uppercase tracking-[2px]">Portfolio Balance</p>
                        <i class="fa-solid fa-eye-slash opacity-30"></i>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <span class="text-3xl font-light opacity-80">¥</span>
                        <span class="text-5xl font-black tracking-tighter">{{ balance.toLocaleString('zh-CN',
                            { minimumFractionDigits: 2 }) }}</span>
                    </div>

                    <div class="mt-10 flex items-center gap-6">
                        <div class="flex-1">
                            <p class="text-[10px] opacity-40 font-bold mb-1">今日收益</p>
                            <div class="flex items-center gap-1 text-green-400">
                                <i class="fa-solid fa-caret-up text-[10px]"></i>
                                <span class="text-sm font-black">+12.45</span>
                            </div>
                        </div>
                        <div class="w-px h-8 bg-white/10"></div>
                        <div class="flex-1">
                            <p class="text-[10px] opacity-40 font-bold mb-1">月度支出</p>
                            <div class="flex items-center gap-1 text-pink-400">
                                <i class="fa-solid fa-caret-down text-[10px]"></i>
                                <span class="text-sm font-black">-{{ totalExpense.toFixed(1) }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Animated Background Elements -->
                <div
                    class="absolute -top-20 -right-20 w-64 h-64 bg-pink-500/10 rounded-full blur-[80px] group-hover:bg-pink-500/20 transition-colors">
                </div>
                <div class="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]"></div>
                <div
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]">
                </div>
            </div>

            <!-- Main Actions -->
            <div class="grid grid-cols-4 gap-4 mt-10 px-2">
                <div v-for="(act, idx) in mainActions" :key="idx"
                    class="flex flex-col items-center gap-3 active:scale-95 transition-transform cursor-pointer">
                    <div
                        :class="['w-14 h-14 rounded-[22px] flex items-center justify-center text-xl shadow-lg shadow-gray-100', act.bg, act.color]">
                        <i :class="act.icon"></i>
                    </div>
                    <span class="text-[12px] font-black text-gray-700">{{ act.label }}</span>
                </div>
            </div>

            <!-- Family Cards (Relatives Card) -->
            <div class="mt-12">
                <div class="flex justify-between items-center mb-6">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-heart text-pink-400"></i>
                        <h2 class="text-lg font-black text-gray-800">亲属卡</h2>
                    </div>
                    <button class="text-xs font-black text-pink-500 bg-pink-50 px-3 py-1 rounded-full">管理</button>
                </div>

                <div class="space-y-4">
                    <div v-for="fCard in familyCards" :key="fCard.id"
                        class="p-5 rounded-3xl border-2 border-dashed border-pink-100 bg-pink-50/20 flex items-center gap-4 relative overflow-hidden">
                        <div
                            class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-pink-400 text-xl border border-pink-50">
                            <i class="fa-solid fa-user-heart"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-sm font-black text-gray-800">{{ fCard.name }}</p>
                            <p class="text-[11px] text-gray-400 font-bold">支付上限: ¥{{ fCard.limit }}/月</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs font-black text-pink-500">已用 ¥{{ (fCard.limit * 0.15).toFixed(0) }}</p>
                        </div>
                        <div class="absolute -right-2 -bottom-2 opacity-5 text-pink-500 rotate-12">
                            <i class="fa-solid fa-heart text-5xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bank Cards -->
            <div class="mt-12">
                <div class="flex justify-between items-center mb-6">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-credit-card text-blue-400"></i>
                        <h2 class="text-lg font-black text-gray-800">我的卡包</h2>
                    </div>
                    <i class="fa-solid fa-plus text-gray-300"></i>
                </div>
                <div class="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory">
                    <div v-for="card in bankCards" :key="card.number"
                        class="min-w-[280px] h-[170px] rounded-[36px] p-6 text-white flex flex-col justify-between shadow-xl snap-center relative overflow-hidden group transition-all active:scale-95"
                        :style="{ background: card.gradient || card.color || '#333' }">
                        <div class="relative z-10">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="text-md font-black tracking-tight">{{ card.bank }}</p>
                                    <p class="text-[10px] opacity-60 font-medium uppercase tracking-widest">{{ card.type
                                        || 'Debit Card' }}</p>
                                </div>
                                <div
                                    class="w-10 h-8 bg-white/10 rounded-md backdrop-blur-md flex items-center justify-center">
                                    <i class="fa-brands fa-cc-mastercard text-2xl"></i>
                                </div>
                            </div>
                        </div>
                        <div class="relative z-10">
                            <div class="text-xl tracking-[5px] font-mono leading-none mb-1">{{ card.number }}</div>
                            <div class="flex justify-between items-end">
                                <span class="text-[10px] opacity-50 uppercase font-black">Valid Thru: 09/28</span>
                                <span class="text-sm font-bold">{{ charName }}</span>
                            </div>
                        </div>
                        <!-- Background Pattern -->
                        <div
                            class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="mt-10">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-lg font-black text-gray-800">账单明细</h2>
                    <i class="fa-solid fa-sliders text-gray-300"></i>
                </div>
                <div class="space-y-4">
                    <div v-for="tx in transactions" :key="tx.id"
                        class="flex items-center gap-4 bg-white p-4 rounded-3xl border border-gray-50 shadow-sm active:bg-gray-50 transition-all cursor-pointer">
                        <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner-sm"
                            :style="{ background: tx.iconBg || '#eee', color: tx.iconColor || '#666' }">
                            <i :class="tx.icon || 'fa-solid fa-receipt'"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[15px] font-black text-gray-800 truncate mb-0.5">{{ tx.merchant }}</p>
                            <p class="text-[11px] text-gray-400 font-bold flex items-center gap-2">
                                <span>{{ tx.time }}</span>
                                <span class="w-1 h-1 bg-gray-200 rounded-full"></span>
                                <span>{{ tx.category }}</span>
                            </p>
                        </div>
                        <div
                            :class="['text-[16px] font-black', tx.type === 'expense' ? 'text-gray-900' : 'text-green-500']">
                            {{ tx.type === 'expense' ? '-' : '+' }}¥{{ tx.amount.toFixed(2) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    walletData: Object,
    charName: String
})

const emit = defineEmits(['back'])

const balance = computed(() => {
    return props.walletData?.balance ?? 1314.52
})

const mainActions = [
    { label: '收付款', icon: 'fa-solid fa-qrcode', bg: 'bg-orange-50', color: 'text-orange-500' },
    { label: '转账', icon: 'fa-solid fa-money-bill-transfer', bg: 'bg-blue-50', color: 'text-blue-500' },
    { label: '充值', icon: 'fa-solid fa-wallet', bg: 'bg-green-50', color: 'text-green-500' },
    { label: '卡包', icon: 'fa-solid fa-box-archive', bg: 'bg-indigo-50', color: 'text-indigo-500' }
]

const familyCards = computed(() => {
    return props.walletData?.familyCards || []
})

const bankCards = computed(() => {
    return props.walletData?.bankCards || []
})

const transactions = computed(() => {
    const data = props.walletData?.transactions || []

    return data.map(tx => {
        const categoryMap = {
            '餐饮': { icon: 'fa-solid fa-utensils', bg: '#FFF7E6', color: '#FFA940' },
            '娱乐': { icon: 'fa-solid fa-gamepad', bg: '#F9F0FF', color: '#B37FEB' },
            '购物': { icon: 'fa-solid fa-bag-shopping', bg: '#FFF1F0', color: '#FF7875' },
            '红包': { icon: 'fa-solid fa-envelope', bg: '#FFF2F0', color: '#FF4D4F' },
            '转账': { icon: 'fa-solid fa-exchange', bg: '#E6F7FF', color: '#1890FF' },
            '生活': { icon: 'fa-solid fa-house', bg: '#F6FFED', color: '#73D13D' }
        }
        const meta = categoryMap[tx.category] || { icon: 'fa-solid fa-receipt', bg: '#F0F2F5', color: '#8C8C8C' }
        return {
            ...tx,
            icon: meta.icon,
            iconBg: meta.bg,
            iconColor: meta.color,
            time: tx.time || '最近'
        }
    })
})

const totalExpense = computed(() => {
    return transactions.value
        .filter(tx => tx.type === 'expense')
        .reduce((acc, tx) => acc + tx.amount, 0)
})
</script>

<style scoped>
.wallet-app {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.hide-scrollbar::-webkit-scrollbar {
    display: none;
}

.hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.shadow-inner-sm {
    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
}

.shadow-up {
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.02);
}
</style>
