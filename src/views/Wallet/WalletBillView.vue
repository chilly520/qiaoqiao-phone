<template>
  <div class="h-full flex flex-col bg-[#ededed] font-sans">
    <!-- Top Bar -->
    <div class="h-[60px] bg-[#ededed] flex items-center px-4 relative shrink-0">
      <div @click="$router.back()" class="absolute left-4 w-10 h-10 flex items-center justify-center text-gray-800 -ml-2 cursor-pointer active:bg-black/5 rounded-full">
        <i class="fa-solid fa-chevron-left text-lg"></i>
      </div>
      <div class="flex-1 text-center font-bold text-lg">账单</div>
      <div class="absolute right-4 text-sm font-medium cursor-pointer py-1 px-2 rounded hover:bg-black/5">
        统计
      </div>
    </div>

    <!-- Month Filter -->
    <div class="px-4 py-2 flex items-center justify-between bg-[#ededed] sticky top-0 z-10 shrink-0">
        <div class="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
            <span>{{ currentMonthStr }}</span>
            <i class="fa-solid fa-caret-down text-xs text-gray-500"></i>
        </div>
    </div>

    <!-- Transaction List -->
    <div class="flex-1 overflow-y-auto">
        <div v-if="filteredGroups.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
             <i class="fa-solid fa-file-invoice text-5xl mb-4 opacity-20"></i>
             <p>本月暂无账单记录</p>
        </div>

        <div v-for="group in filteredGroups" :key="group.month" class="mb-2">
             <div class="bg-white">
                 <div v-for="tx in group.items" :key="tx.id" 
                      class="flex items-center justify-between px-4 py-4 active:bg-gray-50 border-b border-gray-100 last:border-none cursor-pointer">
                      
                      <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm"
                               :class="getIconBg(tx)">
                               <i :class="getIconClass(tx)"></i>
                          </div>
                          <div>
                              <div class="text-base font-medium text-gray-900 mb-0.5 line-clamp-1 break-all">{{ tx.title }}</div>
                              <div class="text-xs text-gray-400 flex items-center gap-1">
                                  <span>{{ formatTime(tx.time) }}</span>
                                  <span v-if="tx.methodDetail" class="border-l border-gray-200 pl-1 ml-1 text-gray-400">{{ tx.methodDetail }}</span>
                              </div>
                          </div>
                      </div>

                      <div class="text-right shrink-0 ml-2">
                          <div class="font-bold text-base font-mono" :class="tx.type === 'income' ? 'text-[#fa9d3b]' : 'text-black'">
                              {{ tx.type === 'income' ? '+' : '-' }}{{ parseFloat(tx.amount).toFixed(2) }}
                          </div>
                          <div class="text-xs text-gray-400 font-medium mt-0.5">
                              {{ getStatusText(tx) }}
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
import { useWalletStore } from '../../stores/walletStore'

const walletStore = useWalletStore()

const currentMonth = ref(new Date())

const currentMonthStr = computed(() => {
    const y = currentMonth.value.getFullYear()
    const m = currentMonth.value.getMonth() + 1
    return `${y}年${m}月`
})

const filteredGroups = computed(() => {
    // 1. Get all
    const all = walletStore.transactions
    
    // 2. Filter by current month (if we want strictly current selected month)
    // For now, let's just show everything grouped, assuming user wants to see "Recent" which includes prior months properly grouped.
    // If user clicked "This Month", we filter. 
    // currentMonthStr logic implies we are looking at specific month. But typically WeChat bill shows list.
    // Let's just group everything and label it.
    
    const sorted = [...all].sort((a, b) => b.time - a.time)
    
    const groups = {}
    sorted.forEach(tx => {
        const d = new Date(tx.time)
        const key = `${d.getFullYear()}年${d.getMonth()+1}月`
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
</script>
