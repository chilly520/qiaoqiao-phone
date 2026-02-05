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
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">账单统计</div>
        </div>

        <!-- Month Filter and Main Stats -->
        <div class="px-6 py-4 transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
            <div class="flex items-center gap-2 mb-6 cursor-pointer relative w-fit group">
                <span class="text-lg font-bold transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">{{ currentMonthStr }}</span>
                <i class="fa-solid fa-caret-down text-sm text-gray-500 transition-transform group-hover:translate-y-0.5"></i>
                <input type="month" :value="monthInputValue" @change="handleMonthChange"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            </div>

            <div class="flex items-end justify-between mb-2">
                <div>
                    <div class="text-sm text-gray-500 mb-1">共支出</div>
                    <div class="text-3xl font-bold font-mono transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">{{ formatCurrency(totalOutcome) }}</div>
                </div>
            </div>
            <div class="text-sm text-gray-500">
                共收入 <span class="font-mono font-medium transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-900'">{{ formatCurrency(totalIncome) }}</span>
            </div>
        </div>

        <!-- Charts / Lists -->
        <div class="flex-1 rounded-t-3xl shadow-sm overflow-hidden flex flex-col transition-colors border-t"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5' : 'bg-white border-transparent'">
            <!-- Tabs -->
            <div class="flex items-center border-b transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5' : 'border-gray-100'">
                <div v-for="tab in ['outcome', 'income']" :key="tab" @click="activeTab = tab"
                    class="flex-1 text-center py-4 text-sm font-bold cursor-pointer relative transition-all"
                    :class="activeTab === tab ? 'text-[#07c160]' : 'text-gray-500'">
                    {{ tab === 'outcome' ? '支出构成' : '收入构成' }}
                    <div v-if="activeTab === tab"
                        class="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#07c160] rounded-full shadow-[0_0_8px_rgba(7,193,96,0.3)]"></div>
                </div>
            </div>

            <!-- List -->
            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div v-if="sortedList.length === 0"
                    class="flex flex-col items-center justify-center py-20 text-gray-400">
                    <i class="fa-solid fa-chart-pie text-5xl mb-4 opacity-10"></i>
                    <p class="text-sm font-medium opacity-50">本月暂无{{ activeTab === 'outcome' ? '支出' : '收入' }}数据</p>
                </div>

                <div v-for="(item, idx) in sortedList" :key="idx" class="mb-5 animate-fade-in" :style="{ animationDelay: (idx * 50) + 'ms' }">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shadow-sm"
                                :class="getIconBg(item.label)">
                                <i :class="getIconClass(item.label)"></i>
                            </div>
                            <span class="font-bold transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-200' : 'text-gray-800'">{{ item.label }}</span>
                            <span class="text-xs text-gray-500 opacity-60">{{ item.percentage }}%</span>
                        </div>
                        <span class="font-mono font-bold transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">{{ formatCurrency(item.value) }}</span>
                    </div>
                    <!-- Progress Bar -->
                    <div class="h-2 w-full rounded-full overflow-hidden transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'">
                        <div class="h-full rounded-full transition-all duration-700 ease-out shadow-inner"
                            :class="activeTab === 'outcome' ? 'bg-[#07c160]' : 'bg-[#fa9d3b]'"
                            :style="{ width: item.percentage + '%' }"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWalletStore } from '../../stores/walletStore'
import { useSettingsStore } from '../../stores/settingsStore'

const walletStore = useWalletStore()
const settingsStore = useSettingsStore()
const activeTab = ref('outcome')
const currentMonth = ref(new Date())

// --- Helpers ---
const formatCurrency = (val) => {
    return '¥' + parseFloat(val).toFixed(2)
}

const getIconBg = (label) => {
    const t = (label || '').toLowerCase()
    if (t.includes('红包')) return 'bg-[#fa9d3b]'
    if (t.includes('转账')) return 'bg-[#fa9d3b]'
    if (t.includes('充值')) return 'bg-[#07c160]'
    if (t.includes('消费')) return 'bg-blue-500'
    return 'bg-gray-400'
}

const getIconClass = (label) => {
    const t = (label || '').toLowerCase()
    if (t.includes('红包')) return 'fa-solid fa-envelope'
    if (t.includes('转账')) return 'fa-solid fa-arrow-right-arrow-left'
    if (t.includes('充值')) return 'fa-solid fa-wallet'
    if (t.includes('消费')) return 'fa-solid fa-shop'
    return 'fa-brands fa-weixin'
}

// --- Date Logic ---
const currentMonthStr = computed(() => {
    const y = currentMonth.value.getFullYear()
    const m = currentMonth.value.getMonth() + 1
    return `${y}年${m}月`
})

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

// --- Stats Logic ---
const currentMonthTransactions = computed(() => {
    const selectedY = currentMonth.value.getFullYear()
    const selectedM = currentMonth.value.getMonth()
    return walletStore.transactions.filter(tx => {
        const d = new Date(tx.time)
        return d.getFullYear() === selectedY && d.getMonth() === selectedM
    })
})

const totalIncome = computed(() => {
    return currentMonthTransactions.value
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0)
})

const totalOutcome = computed(() => {
    return currentMonthTransactions.value
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0)
})

const sortedList = computed(() => {
    const targetType = activeTab.value === 'outcome' ? 'expense' : 'income'
    const txs = currentMonthTransactions.value.filter(tx => tx.type === targetType)
    const total = targetType === 'expense' ? totalOutcome.value : totalIncome.value

    if (total === 0) return []

    // Group by Title
    const groups = {}
    txs.forEach(tx => {
        const key = tx.title // Group by title e.g. "微信红包"
        if (!groups[key]) groups[key] = 0
        groups[key] += parseFloat(tx.amount || 0)
    })

    return Object.keys(groups)
        .map(key => ({
            label: key,
            value: groups[key],
            percentage: ((groups[key] / total) * 100).toFixed(1)
        }))
        .sort((a, b) => b.value - a.value)
})
</script>
