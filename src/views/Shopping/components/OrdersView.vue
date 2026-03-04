<template>
    <div class="flex-1 flex flex-col bg-gray-50 animate-fade-in overflow-hidden">
        <!-- 订单状态标签 -->
        <div class="sticky top-0 bg-white z-40 border-b flex-none">
            <div class="flex overflow-x-auto px-2 py-3 gap-2 scrollbar-hide">
                <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="[
                    'px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors',
                    activeTab === tab.id ? 'bg-orange-100 text-orange-600 font-medium' : 'text-gray-600'
                ]">
                    {{ tab.label }}
                </button>
            </div>
        </div>

        <!-- 订单列表区 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
            <div v-if="filteredOrders.length === 0" class="flex flex-col items-center justify-center py-20 opacity-30">
                <p class="text-6xl mb-4">📝</p>
                <p class="text-xs font-black uppercase tracking-widest">暂无相关订单</p>
            </div>

            <div v-for="order in filteredOrders" :key="order.id" class="bg-white rounded-xl p-4 shadow-sm">
                <div class="flex justify-between items-center mb-3">
                    <div class="flex flex-col">
                        <span class="text-[10px] text-gray-400 font-mono">{{ order.id }}</span>
                        <span class="text-[8px] text-gray-300">{{ formatDate(order.createdAt) }}</span>
                    </div>
                    <span :class="['text-xs font-black uppercase tracking-wider', getStatusColor(order.status)]">
                        {{ getStatusText(order.status) }}
                    </span>
                </div>

                <div class="space-y-2 mb-3">
                    <div v-for="item in order.items.slice(0, 2)" :key="item.cartId" class="flex gap-3">
                        <img :src="item.image" class="w-16 h-16 rounded-lg object-cover bg-gray-100">
                        <div class="flex-1">
                            <h4 class="text-sm line-clamp-1">{{ item.title }}</h4>
                            <p class="text-xs text-gray-400 mt-1">x{{ item.quantity }}</p>
                        </div>
                        <span class="text-sm text-gray-600">¥{{ item.price }}</span>
                    </div>
                </div>

                <div class="flex justify-between items-center pt-3 border-t">
                    <span class="text-sm text-gray-600">共{{ order.items.length }}件 实付:
                        <span class="text-lg font-bold text-gray-900">¥{{ order.total }}</span>
                    </span>

                    <div class="flex gap-2">
                        <button v-if="order.status === 'pending'" @click="$emit('pay', order.id)"
                            class="px-4 py-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                            立即支付
                        </button>
                        <button v-if="['shipped', 'shipping', 'delivering'].includes(order.status)"
                            @click="store.confirmReceipt(order.id)"
                            class="px-4 py-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-orange-500/20">
                            确认收货
                        </button>
                        <button v-if="['paid', 'shipped', 'shipping', 'delivering'].includes(order.status)"
                            @click="$emit('track', order.id)"
                            class="px-4 py-1.5 border border-gray-200 text-gray-500 text-[10px] font-bold rounded-full">
                            查看物流
                        </button>
                        <button v-if="order.status === 'completed'" @click="store.deleteOrder(order.id)"
                            class="px-4 py-1.5 border border-gray-100 text-gray-300 text-[10px] font-bold rounded-full">
                            删除订单
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useShoppingStore } from '@/stores/shoppingStore'

const store = useShoppingStore()

const props = defineProps({
    orders: Array,
    logistics: Array
})

defineEmits(['pay', 'confirm', 'track'])

const activeTab = ref('all')

const tabs = [
    { id: 'all', label: '全部' },
    { id: 'pending', label: '待付款' },
    { id: 'paid', label: '待发货' },
    { id: 'shipped', label: '待收货' },
    { id: 'completed', label: '已完成' }
]

const filteredOrders = computed(() => {
    if (activeTab.value === 'all') return props.orders
    return props.orders.filter(o => o.status === activeTab.value)
})

const getStatusText = (status) => {
    const map = {
        pending: '待付款',
        paid: '待发货',
        shipped: '运输中',
        shipping: '极速配送',
        delivering: '派送中',
        completed: '已完成',
        cancelled: '已取消'
    }
    return map[status] || status
}

const getStatusColor = (status) => {
    const map = {
        pending: 'text-orange-500',
        paid: 'text-blue-500',
        shipped: 'text-purple-500',
        shipping: 'text-red-500 font-bold',
        delivering: 'text-green-500',
        completed: 'text-gray-500'
    }
    return map[status] || 'text-gray-500'
}

const formatDate = (date) => {
    return new Date(date).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}
</script>
