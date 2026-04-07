<template>
    <div class="wallet-app h-full bg-[#F5F5F7] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="wallet-header pt-14 pb-3 px-5 bg-[#1A1A2E] sticky top-0 z-30">
            <div class="flex items-center justify-between">
                <button @click="$emit('back')"
                    class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/70 active:bg-white/20 transition-colors">
                    <i class="fa-solid fa-chevron-left text-sm"></i>
                </button>
                <span class="text-white/90 font-semibold tracking-wide">钱包</span>
                <div class="w-9"></div>
            </div>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-bar bg-[#1A1A2E] px-6 pb-4 flex gap-8 sticky top-[58px] z-20">
            <span v-for="t in tabs" :key="t.key"
                class="pb-2 text-sm font-medium cursor-pointer transition-all relative"
                :class="activeTab === t.key ? 'text-white font-semibold' : 'text-white/35'"
                @click="activeTab = t.key">{{ t.label }}</span>
        </div>
        <div class="h-px bg-white/5 absolute left-0 right-0" style="top: calc(58px + 44px)"></div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto">

            <!-- ===== TAB: 余额 ===== -->
            <div v-if="activeTab === 'balance'" class="balance-tab">
                <div class="mx-5 mt-6 p-7 rounded-2xl relative overflow-hidden"
                    style="background: linear-gradient(160deg, #0a0a0a 0%, #111118 50%, #0d0d12 100%); border: 1px solid rgba(255,255,255,0.04);">
                    <div class="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"></div>

                    <div class="flex justify-between items-center mb-4">
                        <p class="text-[10px] text-white/25 font-medium uppercase tracking-[0.25em]">Total Assets</p>
                        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-white/5">
                            <div class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
                            <span class="text-[9px] text-white/30 font-medium">Active</span>
                        </div>
                    </div>

                    <div class="flex items-baseline gap-1 mb-8">
                        <span class="text-xl text-white/20 font-light">CNY</span>
                        <span class="text-[44px] font-extralight text-white/95 tracking-tight leading-none">{{ balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-4 pt-5 border-t border-white/[0.04]">
                        <div>
                            <p class="text-[9px] text-white/20 font-medium uppercase tracking-widest mb-1">Outflow</p>
                            <p class="text-base font-light text-white/50 tabular-nums">¥{{ totalExpense.toFixed(2) }}</p>
                        </div>
                        <div>
                            <p class="text-[9px] text-white/20 font-medium uppercase tracking-widest mb-1">Inflow</p>
                            <p class="text-base font-light text-emerald-400/60 tabular-nums">¥{{ totalIncome.toFixed(2) }}</p>
                        </div>
                    </div>
                </div>

                <div class="mx-5 mt-5 grid grid-cols-3 gap-3">
                    <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                        <p class="text-lg font-bold text-gray-800">{{ familyCards.length }}<span class="text-xs font-normal text-gray-400 ml-0.5">张</span></p>
                        <p class="text-[10px] text-gray-400 mt-0.5 font-medium">亲属卡</p>
                    </div>
                    <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                        <p class="text-lg font-bold text-gray-800">{{ bankCards.length }}<span class="text-xs font-normal text-gray-400 ml-0.5">张</span></p>
                        <p class="text-[10px] text-gray-400 mt-0.5 font-medium">银行卡</p>
                    </div>
                    <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                        <p class="text-lg font-bold text-gray-800">{{ transactions.length }}<span class="text-xs font-normal text-gray-400 ml-0.5">笔</span></p>
                        <p class="text-[10px] text-gray-400 mt-0.5 font-medium">近期交易</p>
                    </div>
                </div>

                <div class="mx-5 mt-6">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-sm font-semibold text-gray-700">最近交易</span>
                        <span class="text-xs text-gray-400 cursor-pointer" @click="activeTab = 'bills'">查看全部 ></span>
                    </div>
                    <div class="space-y-2">
                        <div v-for="tx in transactions.slice(0, 5)" :key="tx.id"
                            class="bg-white rounded-xl p-3.5 flex items-center gap-3 shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
                            @click="activeTab = 'bills'">
                            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                                :style="{ background: tx.iconBg || '#f0f0f0', color: tx.iconColor || '#888' }">
                                <i :class="tx.icon || 'fa-solid fa-receipt'"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[13px] font-medium text-gray-800 truncate">{{ tx.merchant }}</p>
                                <p class="text-[10px] text-gray-400">{{ tx.time }}</p>
                            </div>
                            <span class="text-[13px] font-semibold flex-shrink-0 tabular-nums"
                                :class="tx.type === 'income' ? 'text-emerald-500' : 'text-gray-800'">
                                {{ tx.type === 'income' ? '+' : '-' }}¥{{ Number(tx.amount || 0).toFixed(2) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== TAB: 卡包 ===== -->
            <div v-if="activeTab === 'cards'" class="cards-tab">
                <div class="carousel-wrapper px-5 pt-5 pb-2">
                    <div class="flex items-center gap-2 mb-4">
                        <i class="fa-solid fa-wallet text-sm text-gray-500"></i>
                        <span class="text-sm font-semibold text-gray-700">我的卡片</span>
                        <span class="text-[10px] text-gray-400 font-medium ml-auto">{{ allCards.length }} 张</span>
                    </div>

                    <div ref="carouselRef" class="carousel-track flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar scroll-smooth"
                        @scroll="onCarouselScroll">
                        <div v-for="(card, cIdx) in allCards" :key="card.id"
                            class="card-slide flex-shrink-0 w-[260px] rounded-2xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 snap-center relative"
                            :class="selectedCardIndex === cIdx ? 'scale-[1.02] ring-2 ring-gray-300/50' : 'scale-[0.96] opacity-80 hover:opacity-100'"
                            :style="{ background: card._gradient }"
                            @click="selectedCardIndex = cIdx">

                            <!-- 银行卡 -->
                            <div v-if="card.cardType === 'bank'"
                                class="bank-card-face p-5 h-[165px] flex flex-col justify-between text-white relative"
                                :style="{ background: card._gradient }">

                                <div class="absolute inset-0 opacity-[0.03]"
                                    style="background-image: repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.15) 1px, rgba(255,255,255,.15) 2px);"></div>

                                <div class="relative z-10 flex justify-between items-start">
                                    <div>
                                        <p class="text-xs font-bold tracking-[0.15em] uppercase opacity-90">{{ card.bank }}</p>
                                        <p class="text-[8px] tracking-widest uppercase mt-0.5 opacity-30">{{ card.cardLevel || 'Platinum' }}</p>
                                    </div>
                                    <div class="flex flex-col items-end gap-1">
                                        <span class="text-[9px] font-black tracking-tight" style="color: #e21836;">UnionPay</span>
                                        <div class="flex gap-[2px]">
                                            <div class="w-4 h-[3px] rounded-sm" style="background: #e21836;"></div>
                                            <div class="w-4 h-[3px] rounded-sm" style="background: #0046ad;"></div>
                                            <div class="w-4 h-[3px] rounded-sm" style="background: #00a651;"></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="relative z-10 my-2">
                                    <div class="inline-flex items-center gap-[2px] p-1 rounded-md bg-gradient-to-br from-amber-700/80 via-yellow-600/70 to-amber-800/80 shadow-inner">
                                        <div class="grid grid-rows-4 gap-[2px] w-7 h-8">
                                            <div v-for="n in 20" :key="'chip-'+n" class="w-1.5 h-[2px]" :class="n % 2 === 0 ? 'bg-amber-900/50' : 'bg-amber-500/30'"></div>
                                        </div>
                                        <div class="flex flex-col gap-[1.5px] ml-0.5">
                                            <div class="w-3 h-[1.5px] bg-amber-900/40 rounded-full"></div>
                                            <div class="w-2 h-[1.5px] bg-amber-900/25 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="relative z-10">
                                    <p class="text-base tracking-[0.22em] font-mono font-medium mb-1.5 opacity-95">{{ card.number || '**** **** **** ****' }}</p>
                                    <div class="flex justify-between items-end">
                                        <div>
                                            <p class="text-[7px] uppercase tracking-widest opacity-25">Card Holder</p>
                                            <p class="text-[10px] font-semibold tracking-wide mt-px">{{ charName }}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-[7px] uppercase tracking-widest opacity-25">Valid Thru</p>
                                            <p class="text-[10px] font-mono font-semibold">{{ card.validThru || '09/28' }}</p>
                                        </div>
                                    </div>
                                </div>

                                <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"></div>
                            </div>

                            <!-- 亲属卡 -->
                            <div v-else
                                class="family-card-face p-5 h-[165px] flex flex-col justify-between text-white relative"
                                :style="{ background: card._gradient }">

                                <div class="absolute inset-0 opacity-[0.04]"
                                    style="background-image: repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(255,255,255,.08) 2px, rgba(255,255,255,.08) 4px);"></div>

                                <div class="relative z-10 flex justify-between items-start">
                                    <div>
                                        <p class="text-[9px] tracking-widest uppercase opacity-30 font-medium">Family Card</p>
                                        <p class="text-sm font-bold mt-0.5 opacity-90 truncate max-w-[140px]">{{ card.name }}</p>
                                    </div>
                                    <span class="text-[8px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm"
                                        :class="card.type === 'given' ? 'border-orange-400/30 bg-orange-500/15 text-orange-200' : 'border-blue-400/30 bg-blue-500/15 text-blue-200'">
                                        {{ card.type === 'given' ? '已赠出' : '已接收' }}
                                    </span>
                                </div>

                                <div class="relative z-10 flex justify-center my-1">
                                    <i class="fa-solid fa-heart text-2xl opacity-20"></i>
                                </div>

                                <div class="relative z-10">
                                    <div class="flex justify-between items-end">
                                        <div>
                                            <p class="text-[7px] uppercase tracking-widest opacity-25">Monthly Limit</p>
                                            <p class="text-base font-bold mt-px">{{ (card.limit || 0).toLocaleString() }}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-[7px] uppercase tracking-widest opacity-25">Used</p>
                                            <p class="text-[11px] font-semibold text-white/60">{{ ((card.used || 0)).toFixed(0) }}</p>
                                        </div>
                                    </div>
                                    <div class="mt-2 h-[2px] bg-white/10 rounded-full overflow-hidden">
                                        <div class="h-full rounded-full transition-all"
                                            :style="{ width: Math.min(100, ((card.used||0)/(card.limit||1))*100) + '%', background: 'linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.6))' }"></div>
                                    </div>
                                </div>

                                <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"></div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-center gap-1.5 mt-1">
                        <div v-for="(c, i) in allCards" :key="'dot-'+i"
                            class="w-1.5 h-1.5 rounded-full transition-all duration-300"
                            :class="selectedCardIndex === i ? 'bg-gray-400 w-4' : 'bg-gray-200'"></div>
                    </div>
                </div>

                <!-- 选中卡片详情 & 账单 -->
                <div v-if="currentCard" class="px-5 pb-6">
                    <div class="bg-white rounded-xl p-4 shadow-sm mb-4">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                :style="{ background: currentCard._accent }">
                                <i :class="currentCard.cardType === 'bank' ? 'fa-solid fa-credit-card' : 'fa-solid fa-heart'"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[14px] font-semibold text-gray-800 truncate">{{ currentCard.cardType === 'bank' ? ((currentCard.bank || '银行卡') + ' ' + (currentCard.cardLevel || '')) : (currentCard.name || '亲属卡') }}</p>
                                <p class="text-[11px] text-gray-400">{{ currentCard.cardType === 'bank' ? (currentCard.number || '**** **** **** ****').replace(/\d(?=\d{4})/g,'*') : ('月限额 ¥' + (currentCard.limit||0).toLocaleString()) }}</p>
                            </div>
                            <div class="text-right flex-shrink-0">
                                <template v-if="currentCard.cardType === 'bank'">
                                    <p v-if="currentCard.creditLimit" class="text-[10px] text-gray-400">信用额度</p>
                                    <p v-if="currentCard.creditLimit" class="text-sm font-bold text-gray-800 tabular-nums">{{ Number(currentCard.creditLimit).toLocaleString() }}</p>
                                </template>
                                <template v-else>
                                    <p class="text-[10px] text-gray-400">已用 / 总额</p>
                                    <p class="text-sm font-bold text-gray-800 tabular-nums">{{ (currentCard.used||0).toFixed(0) }} / {{ (currentCard.limit||0).toLocaleString() }}</p>
                                </template>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between mb-3">
                        <span class="text-sm font-semibold text-gray-700">账单明细</span>
                        <span class="text-[10px] text-gray-400">{{ currentCardTransactions.length }} 笔记录</span>
                    </div>

                    <div class="space-y-2">
                        <div v-for="tx in currentCardTransactions" :key="tx.id"
                            class="bg-white rounded-xl p-3.5 flex items-center gap-3 shadow-sm active:bg-gray-50 transition-colors">
                            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                                :style="{ background: tx.iconBg || '#f0f0f0', color: tx.iconColor || '#888' }">
                                <i :class="tx.icon || 'fa-solid fa-receipt'"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[13px] font-medium text-gray-800 truncate">{{ tx.merchant }}</p>
                                <p class="text-[10px] text-gray-400">{{ tx.time }} · {{ tx.category }}
                                    <span v-if="tx.detail" class="text-gray-300 ml-0.5">· {{ tx.detail }}</span>
                                </p>
                            </div>
                            <span class="text-[13px] font-semibold flex-shrink-0 tabular-nums"
                                :class="tx.type === 'income' ? 'text-emerald-500' : 'text-gray-800'">
                                {{ tx.type === 'income' ? '+' : '-' }}¥{{ Number(tx.amount || 0).toFixed(2) }}
                            </span>
                        </div>
                    </div>

                    <div v-if="currentCardTransactions.length === 0" class="py-12 text-center">
                        <div class="w-14 h-14 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
                            <i class="fa-solid fa-receipt text-lg text-gray-300"></i>
                        </div>
                        <p class="text-xs text-gray-400 font-medium">该卡暂无交易记录</p>
                    </div>
                </div>
            </div>

            <!-- ===== TAB: 账单 ===== -->
            <div v-if="activeTab === 'bills'" class="bills-tab px-5 py-5">
                <div class="bg-white rounded-xl p-4 shadow-sm mb-4 flex items-center gap-4">
                    <div class="flex-1">
                        <p class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">本月支出</p>
                        <p class="text-xl font-bold text-gray-800">¥{{ totalExpense.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</p>
                    </div>
                    <div class="w-px h-10 bg-gray-100"></div>
                    <div class="flex-1">
                        <p class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">本月收入</p>
                        <p class="text-xl font-bold text-emerald-500">¥{{ totalIncome.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</p>
                    </div>
                </div>

                <div class="space-y-2">
                    <div v-for="tx in transactions" :key="tx.id"
                        class="bg-white rounded-xl p-4 flex items-center gap-3.5 shadow-sm active:bg-gray-50 transition-colors cursor-pointer"
                        :class="{ 'border-l-2 border-l-pink-400': tx.isUserRelated }">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            :style="{ background: tx.iconBg || '#f5f5f5', color: tx.iconColor || '#999' }">
                            <i :class="tx.icon || 'fa-solid fa-receipt'"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5">
                                <p class="text-[14px] font-medium text-gray-800 truncate">{{ tx.merchant }}</p>
                                <span v-if="tx.isUserRelated" class="text-[9px] px-1.5 py-0.5 bg-pink-50 text-pink-500 rounded font-medium whitespace-nowrap">{{ userName }}</span>
                            </div>
                            <p class="text-[11px] text-gray-400 mt-0.5">
                                {{ tx.time }} · {{ tx.category }}
                                <span v-if="tx.note" class="text-gray-300 ml-1">· {{ tx.note }}</span>
                            </p>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <p class="text-[15px] font-semibold tabular-nums"
                                :class="tx.type === 'income' ? 'text-emerald-500' : 'text-gray-900'">
                                {{ tx.type === 'income' ? '+' : '-' }}¥{{ Number(Math.abs(tx.amount || 0)).toFixed(2) }}
                            </p>
                            <p v-if="tx.detail" class="text-[10px] text-gray-300 mt-0.5 max-w-[100px] truncate">{{ tx.detail }}</p>
                        </div>
                    </div>
                </div>

                <div v-if="transactions.length === 0" class="py-20 text-center">
                    <div class="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <i class="fa-solid fa-receipt text-xl text-gray-300"></i>
                    </div>
                    <p class="text-sm text-gray-400 font-medium">暂无账单记录</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

const props = defineProps({
    walletData: Object,
    charName: String,
    charId: String
})

defineEmits(['back'])

const settingsStore = useSettingsStore()
const userName = computed(() => settingsStore.personalization?.userProfile?.name || '你')

const activeTab = ref('balance')
const tabs = [
    { key: 'balance', label: '余额' },
    { key: 'cards', label: '卡包' },
    { key: 'bills', label: '账单' }
]

const balance = computed(() => {
    const val = props.walletData?.balance;
    // 如果余额看起来像是一个占位符或为0，我们可以尝试根据交易记录计算一个偏大的模拟值
    if (!val || val === 88888888.88) {
        return 12560.80 + totalIncome.value - totalExpense.value;
    }
    return Number(val);
})

const cardColorPalettes = [
    { gradient: 'linear-gradient(160deg, #0a0a0a 0%, #111118 50%, #0d0d12 100%)', accent: '#374151' },
    { gradient: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', accent: '#3b82f6' },
    { gradient: 'linear-gradient(160deg, #1a0a2e 0%, #160d3e 50%, #200f60 100%)', accent: '#8b5cf6' },
    { gradient: 'linear-gradient(160deg, #0a1a1a 0%, #0d2222 50%, #064444 100%)', accent: '#14b8a6' },
    { gradient: 'linear-gradient(160deg, #1a120a 0%, #22180d 50%, #442c06 100%)', accent: '#f59e0b' },
    { gradient: 'linear-gradient(160deg, #1a0a0a 0%, #2e1010 50%, #600a0a 100%)', accent: '#ef4444' },
    { gradient: 'linear-gradient(160deg, #0a1a0a 0%, #102e10 50%, #0a600f 100%)', accent: '#22c55e' },
    { gradient: 'linear-gradient(160deg, #1a1a0a 0%, #2e2e0d 50%, #60600a 100%)', accent: '#eab308' }
]

function assignCardColors(cards) {
    return cards.map((card, i) => {
        const palette = cardColorPalettes[i % cardColorPalettes.length]
        return { ...card, _gradient: palette.gradient, _accent: palette.accent }
    })
}

const selectedCardIndex = ref(0)
const carouselRef = ref(null)

function onCarouselScroll(e) {
    const el = e.target
    const scrollLeft = el.scrollLeft
    const cardWidth = 276
    const newIndex = Math.round(scrollLeft / cardWidth)
    if (newIndex !== selectedCardIndex.value && newIndex >= 0 && newIndex < allCards.value.length) {
        selectedCardIndex.value = newIndex
    }
}

const rawBankCards = computed(() => props.walletData?.bankCards || [])
const bankCards = computed(() => assignCardColors((rawBankCards.value.length > 0 ? rawBankCards.value : []).map(c => ({ ...c, cardType: 'bank' }))))

const familyCards = computed(() => {
    const baseCards = props.walletData?.familyCards || []
    const userRelatedCards = [
        {
            id: 'user-given',
            name: '亲属卡-给' + userName.value,
            limit: 2000,
            used: Math.floor(Math.random() * 500) + 100,
            type: 'given',
            avatar: props.charAvatar || '',
            relation: '恋人',
            monthlyUsed: [
                { id: 'fc-tx-1', merchant: '星巴克（万达店）', amount: -52.0, type: 'expense', category: '餐饮', time: '03-05 10:20', detail: '冰美咖啡 x2', icon: 'fa-solid fa-mug-hot' },
                { id: 'fc-tx-2', merchant: '万达影城', amount: -128.0, type: 'expense', category: '娱乐', time: '03-02 19:30', detail: '电影票 x2《哪吒》', icon: 'fa-solid fa-film' },
                { id: 'fc-tx-3', merchant: '丝芙兰', amount: -299.0, type: 'expense', category: '购物', time: '02-28 15:10', detail: 'YSL小金条口红', icon: 'fa-solid fa-bag-shopping' }
            ]
        },
        {
            id: 'user-received',
            name: '亲属卡-' + userName.value + '给的',
            limit: 5000,
            used: Math.floor(Math.random() * 1000) + 500,
            type: 'received',
            avatar: settingsStore.personalization?.userProfile?.avatar || '',
            relation: '恋人',
            monthlyUsed: [
                { id: 'fc-tx-4', merchant: 'Apple Store', amount: -888.0, type: 'expense', category: '购物', time: '03-04 14:00', detail: 'AirPods Pro 2', icon: 'fa-brands fa-apple' },
                { id: 'fc-tx-5', merchant: userName.value, amount: -520.0, type: 'expense', category: '转账', time: '03-01 00:00', detail: '520红包', icon: 'fa-solid fa-heart' }
            ]
        }
    ]
    return assignCardColors([...baseCards, ...userRelatedCards].map(c => ({ ...c, cardType: 'family' })))
})

const allCards = computed(() => [...bankCards.value, ...familyCards.value])
const currentCard = computed(() => allCards.value[selectedCardIndex.value] || null)

const currentCardTransactions = computed(() => {
    if (!currentCard.value) return []
    const card = currentCard.value

    if (card.cardType === 'family') {
        const txs = (card.monthlyUsed || []).map(tx => ({
            ...tx,
            iconBg: getCategoryMeta(tx.category).bg,
            iconColor: getCategoryMeta(tx.category).color,
            icon: tx.icon || getCategoryMeta(tx.category).icon
        }))
        return txs
    }

    const allTx = props.walletData?.transactions || []
    const cardTx = (card.transactions || []).length > 0
        ? card.transactions
        : allTx.filter(t => t.cardId === card.id || t.cardNumber === card.number)
    return formatTransactions(cardTx)
})

function getCategoryMeta(category) {
    const map = {
        '餐饮': { icon: 'fa-solid fa-utensils', bg: '#FFF7E6', color: '#FFA940' },
        '娱乐': { icon: 'fa-solid fa-gamepad', bg: '#F9F0FF', color: '#B37FEB' },
        '购物': { icon: 'fa-solid fa-bag-shopping', bg: '#FFF1F0', color: '#FF7875' },
        '红包': { icon: 'fa-solid fa-envelope-open-text', bg: '#FFF2F0', color: '#FF4D4F' },
        '转账': { icon: 'fa-solid fa-heart', bg: '#FFE6E6', color: '#FF4D4F' },
        '亲属卡': { icon: 'fa-solid fa-id-card-clip', bg: '#E6F7FF', color: '#1890FF' },
        '生活': { icon: 'fa-solid fa-house', bg: '#F6FFED', color: '#73D13D' },
        '交通': { icon: 'fa-solid fa-car', bg: '#E6F7FF', color: '#1890FF' },
        '充值': { icon: 'fa-solid fa-wallet', bg: '#F6FFED', color: '#52C41A' }
    }
    return map[category] || { icon: 'fa-solid fa-receipt', bg: '#F0F2F5', color: '#8C8C8C' }
}

const transactions = computed(() => {
    const data = props.walletData?.transactions || []
    const userTransactions = [
        { id: 'tx-user-1', merchant: '转账给' + userName.value, amount: 520.0, type: 'expense', category: '转账', time: '今天 14:20', icon: 'fa-solid fa-heart', isUserRelated: true, note: '520快乐！' },
        { id: 'tx-user-2', merchant: '收到' + userName.value + '的红包', amount: 66.66, type: 'income', category: '红包', time: '今天 08:00', icon: 'fa-solid fa-envelope-open-text', isUserRelated: true, note: '早安红包' },
        { id: 'tx-user-3', merchant: userName.value + '的亲属卡消费', amount: 128.0, type: 'expense', category: '亲属卡', time: '昨天 19:30', icon: 'fa-solid fa-ticket', isUserRelated: true, note: '电影票' }
    ]

    return formatTransactions([...data, ...userTransactions])
})

function formatTransactions(rawList) {
    return rawList.sort((a, b) => new Date(b.time) - new Date(a.time)).map(tx => {
        const meta = getCategoryMeta(tx.category)
        const amount = Number(tx.amount || 0)
        
        // 自动纠正类型：如果是负数且非income，必定是expense
        // 如果包含特定关键词，纠正类型
        let type = tx.type || 'expense'
        if (tx.merchant?.includes('分红') || tx.merchant?.includes('收入') || tx.merchant?.includes('收到') || amount > 10000) {
            if (!tx.merchant?.includes('支出') && !tx.merchant?.includes('给')) {
                type = 'income'
            }
        }
        
        return {
            ...tx,
            type,
            amount: Math.abs(amount),
            icon: meta.icon,
            iconBg: meta.bg,
            iconColor: meta.color,
            time: tx.time || '最近'
        }
    })
}

const totalExpense = computed(() =>
    transactions.value
        .filter(t => t.type === 'expense' || t.type === '支出')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0)
)

const totalIncome = computed(() =>
    transactions.value
        .filter(t => t.type === 'income' || t.type === '收入' || t.type === 'bonus')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0)
)
</script>

<style scoped>
.wallet-app {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
