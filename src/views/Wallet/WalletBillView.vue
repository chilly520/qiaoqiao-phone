<template>
    <div class="h-full flex flex-col bg-[#ededed] font-sans">
        <!-- Top Bar -->
        <div class="h-[60px] bg-[#ededed] flex items-center px-4 relative shrink-0">
            <div @click="$router.back()"
                class="absolute left-4 w-10 h-10 flex items-center justify-center text-gray-800 -ml-2 cursor-pointer active:bg-black/5 rounded-full">
                <i class="fa-solid fa-chevron-left text-lg"></i>
            </div>
            <div class="flex-1 text-center font-bold text-lg">账单</div>
            <!-- Removed redundant stats button -->
        </div>

        <!-- Month Filter -->
        <div class="px-4 py-2 flex items-center justify-between bg-[#ededed] sticky top-0 z-10 shrink-0">
            <div
                class="relative flex items-center gap-1 bg-white px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors shadow-sm overflow-hidden">
                <span>{{ currentMonthStr }}</span>
                <i class="fa-solid fa-caret-down text-xs text-gray-500"></i>
                <!-- Hidden Month Input for interaction -->
                <input type="month" :value="monthInputValue" @change="handleMonthChange"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" />
            </div>
            <div @click="showStatistics"
                class="text-sm font-medium text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-transform select-none">
                统计 <i class="fa-solid fa-chart-pie text-xs ml-1"></i>
            </div>
        </div>

        <!-- Transaction List -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden pb-10" @click="closeSwipe">
            <div v-if="filteredGroups.length === 0"
                class="flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-file-invoice text-5xl mb-4 opacity-20"></i>
                <p>本月暂无账单记录</p>
            </div>

            <div v-for="group in filteredGroups" :key="group.month" class="mb-2">
                <div class="bg-white">
                    <div v-for="tx in group.items" :key="tx.id"
                        class="relative overflow-hidden border-b border-gray-100 last:border-none">

                        <!-- Delete Button Layer (Behind) -->
                        <div class="absolute inset-y-0 right-0 w-[70px] bg-red-500 flex items-center justify-center text-white font-medium text-sm cursor-pointer z-0"
                            @click.stop="handleDelete(tx)">
                            删除
                        </div>

                        <!-- Content Layer (Sliding) -->
                        <div class="relative z-10 bg-white flex items-start justify-between px-4 py-4 cursor-pointer transition-transform duration-200 ease-out"
                            :style="{ transform: `translateX(${swipeState[tx.id] || 0}px)` }"
                            @touchstart="handleTouchStart($event, tx)" @touchmove="handleTouchMove($event, tx)"
                            @touchend="handleTouchEnd($event, tx)" @click="handleItemClick(tx)">

                            <div class="flex items-start gap-3 overflow-hidden flex-1">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm mt-1"
                                    :class="getIconBg(tx)">
                                    <i :class="getIconClass(tx)"></i>
                                </div>
                                <div class="flex-1 min-w-0 pr-2">
                                    <div class="text-base font-medium text-gray-900 mb-0.5 line-clamp-1 break-all">
                                        {{ tx.title }}</div>
                                    <div class="text-xs text-gray-400 mt-1 flex flex-wrap items-start">
                                        <span class="shrink-0 mr-2 font-mono tracking-tight pt-0.5">{{
                                            formatTime(tx.time) }}</span>
                                        <span
                                            class="border-l border-gray-300 pl-2 whitespace-pre-wrap break-words leading-relaxed">{{
                                                getTransactionDesc(tx) }}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="text-right shrink-0 ml-1 pt-1">
                                <div class="font-bold text-base font-mono"
                                    :class="tx.type === 'income' ? 'text-[#fa9d3b]' : 'text-black'">
                                    {{ tx.type === 'income' ? '+' : '-' }}{{ parseFloat(tx.amount).toFixed(2) }}
                                </div>
                                <div class="text-xs text-gray-400 font-medium mt-1">
                                    {{ getStatusText(tx) }}
                                </div>
                            </div>
                        </div>
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

const currentMonth = ref(new Date())
// ... (rest is same until showStatistics)

// --- Interaction Logic ---
const showStatistics = () => {
    // Navigate to statistics page
    router.push('/wallet/bill/statistics')
}


const currentMonthStr = computed(() => {
    const y = currentMonth.value.getFullYear()
    const m = currentMonth.value.getMonth() + 1
    return `${y}年${m}月`
})

const filteredGroups = computed(() => {
    // 1. Get all
    const all = walletStore.transactions

    // 2. Filter by current month
    // Only show transactions from the selected month
    const selectedY = currentMonth.value.getFullYear()
    const selectedM = currentMonth.value.getMonth()

    // Filter logic
    const filtered = all.filter(tx => {
        const d = new Date(tx.time)
        return d.getFullYear() === selectedY && d.getMonth() === selectedM
    })

    const sorted = [...filtered].sort((a, b) => b.time - a.time)

    const groups = {}
    sorted.forEach(tx => {
        const d = new Date(tx.time)
        const key = `${d.getFullYear()}年${d.getMonth() + 1}月`
        if (!groups[key]) groups[key] = []
        groups[key].push(tx)
    })

    return Object.keys(groups).map(key => ({
        month: key,
        items: groups[key]
    }))
})

const getIconBg = (tx) => {
    const t = (tx.title || '').toLowerCase()
    if (t.includes('红包')) return 'bg-[#fa9d3b]'
    if (t.includes('转账')) return 'bg-[#fa9d3b]'
    if (t.includes('充值')) return 'bg-[#07c160]'
    if (t.includes('亲属卡')) return 'bg-[#ff9a9e]'
    if (t.includes('消费') || t.includes('扫二维码')) return 'bg-blue-500'
    return 'bg-gray-400'
}

const getIconClass = (tx) => {
    const t = (tx.title || '').toLowerCase()
    if (t.includes('红包')) return 'fa-solid fa-envelope'
    if (t.includes('转账')) return 'fa-solid fa-arrow-right-arrow-left'
    if (t.includes('充值')) return 'fa-solid fa-wallet'
    if (t.includes('亲属卡')) return 'fa-solid fa-gift'
    if (t.includes('消费')) return 'fa-solid fa-shop'
    return 'fa-brands fa-weixin'
}

const formatTime = (ts) => {
    const d = new Date(ts)
    const M = d.getMonth() + 1
    const D = d.getDate()
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${M}月${D}日 ${h}:${m}`
}

const getStatusText = (tx) => {
    return '支付成功'
}

const getTransactionDesc = (tx) => {
    // 1. Prefer explicit description
    if (tx.desc) return tx.desc

    // 2. Construct from counterparty for Transfers/Red Packets
    const type = (tx.title || '').toLowerCase()

    if (tx.counterparty) {
        if (type.includes('转账')) {
            return tx.type === 'income' ? `收到 ${tx.counterparty} 的转账` : `向 ${tx.counterparty} 转账`
        }
        if (type.includes('红包')) {
            return tx.type === 'income' ? `领取 ${tx.counterparty} 的红包` : `发出红包给 ${tx.counterparty}`
        }
    }

    // 3. Fallback to method or note
    if (tx.note) return tx.note
    if (tx.methodDetail) return tx.methodDetail

    // 4. Final fallback
    return tx.type === 'income' ? '收入' : '支出'
}

// --- Date Picker Logic ---
const monthInputValue = computed(() => {
    const y = currentMonth.value.getFullYear()
    const m = String(currentMonth.value.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
})

const handleMonthChange = (e) => {
    if (e.target.value) {
        const [y, m] = e.target.value.split('-')
        currentMonth.value = new Date(parseInt(y), parseInt(m) - 1, 1)
    }
}

// --- Interaction Logic ---
// showStatistics is defined at top with imports
// const showStatistics = () => ... REMOVED


const handleItemClick = (tx) => {
    console.log('Click Item', tx)
}

// --- Swipe Logic ---
const swipeState = ref({}) // { id: translateX }
let touchStartX = 0
let activeSwipeId = null

const handleTouchStart = (e, tx) => {
    touchStartX = e.touches[0].clientX
    // Close others
    if (activeSwipeId && activeSwipeId !== tx.id) {
        swipeState.value[activeSwipeId] = 0
        activeSwipeId = null
    }
}

const handleTouchMove = (e, tx) => {
    const deltaX = e.touches[0].clientX - touchStartX
    if (deltaX < 0 && deltaX > -80) { // Limit drag
        swipeState.value[tx.id] = deltaX
    }
}

const handleTouchEnd = (e, tx) => {
    const currentX = swipeState.value[tx.id] || 0
    if (currentX < -30) {
        // Snap open
        swipeState.value[tx.id] = -70
        activeSwipeId = tx.id
    } else {
        // Snap close
        swipeState.value[tx.id] = 0
        if (activeSwipeId === tx.id) activeSwipeId = null
    }
}

const closeSwipe = () => {
    if (activeSwipeId) {
        swipeState.value[activeSwipeId] = 0
        activeSwipeId = null
    }
}

const handleDelete = (tx) => {
    if (confirm('确定删除这条记录吗？')) {
        const idx = walletStore.transactions.findIndex(t => t.id === tx.id)
        if (idx !== -1) {
            walletStore.transactions.splice(idx, 1)
        }
        // Cleanup swipe state
        delete swipeState.value[tx.id]
        activeSwipeId = null
    }
}
</script>
