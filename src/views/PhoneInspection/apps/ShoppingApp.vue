<template>
    <div class="shopping-app flex flex-col h-full bg-[#F5F5F5] relative">
        <!-- Header -->
        <div
            class="pt-16 pb-4 px-4 bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 flex items-center justify-between">
            <button @click="$emit('back')" class="text-gray-400">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div class="flex-1 px-4">
                <div class="bg-gray-100 rounded-full h-8 flex items-center px-4 text-gray-400 text-sm">
                    <i class="fa-solid fa-magnifying-glass mr-2"></i> 搜索我的订单
                </div>
            </div>
            <button class="text-gray-400">
                <i class="fa-solid fa-ellipsis"></i>
            </button>
        </div>

        <!-- Tabs -->
        <div
            class="flex justify-around items-center bg-white border-b border-gray-100 py-3 text-sm text-gray-500 font-bold mb-2">
            <div class="text-orange-500 border-b-2 border-orange-500 pb-1 px-2">全部</div>
            <div class="px-2">待支付</div>
            <div class="px-2">待发货</div>
            <div class="px-2">待收货</div>
            <div class="px-2">待评价</div>
        </div>

        <!-- Orders List -->
        <div class="flex-1 overflow-y-auto px-3 space-y-3 pb-20">
            <div v-for="order in orders" :key="order.id" class="p-4 bg-white rounded-xl shadow-sm space-y-3">
                <div class="flex justify-between items-center text-xs font-bold mb-2">
                    <span class="flex items-center gap-1">
                        <i class="fa-solid fa-store text-gray-400"></i> 神秘杂货铺
                    </span>
                    <span class="text-orange-500">{{ order.status }}</span>
                </div>
                <div class="flex gap-4">
                    <div
                        class="w-24 h-24 bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center text-2xl text-pink-300 border border-gray-100 relative group shadow-sm">
                        <img v-if="order.image" :src="order.image" class="w-full h-full object-cover">
                        <i v-else class="fa-solid fa-bag-shopping"></i>
                        <div v-if="order.generated"
                            class="absolute top-1 right-1 bg-black/60 backdrop-blur-sm text-[8px] text-white px-1.5 py-0.5 rounded-full font-black flex items-center gap-1">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                            DRAW
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-black text-[15px] truncate mb-1 text-gray-800">{{ order.item }}</div>
                        <div class="text-[11px] text-gray-400 font-bold">规格: 默认 · 数量: 1</div>
                        <div v-if="order.generated" class="mt-2 p-2 bg-pink-50 rounded-lg border border-pink-100">
                            <p class="text-[9px] text-pink-400 font-black leading-tight">
                                <i class="fa-solid fa-paintbrush mr-1"></i> AI 实时渲染精美样图
                            </p>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-[16px] font-black text-gray-900">¥{{ order.price.toFixed(2) }}</div>
                        <div class="text-[10px] text-gray-400 mt-1 font-bold">{{ order.time }}</div>
                    </div>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t border-gray-50">
                    <button
                        class="px-5 py-2 rounded-full border border-gray-100 text-[11px] font-black text-gray-400 active:scale-95 transition-transform">查看物流</button>
                    <button v-if="order.status === '待收货'" @click="receiveOrder(order)"
                        class="px-5 py-2 rounded-full bg-orange-500 text-white text-[11px] font-black shadow-lg shadow-orange-100 active:scale-95 transition-transform">
                        确认收货
                    </button>
                    <button v-else
                        class="px-5 py-2 rounded-full border border-gray-100 text-[11px] font-black text-gray-400 active:scale-95 transition-transform">再次购买</button>
                </div>
            </div>

            <div v-if="orders.length === 0" class="py-20 text-center text-gray-400">
                <i class="fa-solid fa-box-open text-6xl opacity-10 mb-4 text-orange-300"></i>
                <p>暂无相关订单记录</p>
            </div>
        </div>

        <!-- Footer -->
        <div
            class="flex justify-around items-center py-4 border-t border-gray-100 bg-white shadow-2xl safe-bottom absolute bottom-0 left-0 right-0 z-20 px-4">
            <div class="flex flex-col items-center text-gray-400">
                <i class="fa-solid fa-home text-xl"></i>
                <span class="text-[10px] mt-1">首页</span>
            </div>
            <div class="flex flex-col items-center text-gray-400">
                <i class="fa-regular fa-compass text-xl"></i>
                <span class="text-[10px] mt-1">逛逛</span>
            </div>
            <div class="flex flex-col items-center text-orange-500">
                <i class="fa-solid fa-book text-xl"></i>
                <span class="text-[10px] mt-1">清单</span>
            </div>
            <div class="flex flex-col items-center text-gray-400">
                <i class="fa-regular fa-user text-xl"></i>
                <span class="text-[10px] mt-1">我的</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useBackpackStore } from '@/stores/backpackStore'

const props = defineProps({
    shoppingData: Object
})

const emit = defineEmits(['back', 'update-order'])
const backpack = useBackpackStore()

const orders = computed(() => {
    return props.shoppingData?.orders || []
})

function receiveOrder(order) {
    // 1. Update order status
    order.status = '已完成'

    // 2. Add to Backpack
    backpack.addItem({
        title: order.item,
        image: 'https://cdn-icons-png.flaticon.com/128/3081/3081986.png', // Generic parcel icon
        category: 'daily',
        description: `从手机里“查”出来的宝贝：${order.item}`,
        source: '查手机'
    })

    // 3. Notify
    emit('update-order', order)
    alert('✨ 成功！物品已存入你的微信背包喵~')
}
</script>

<style scoped>
.shopping-app {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.safe-bottom {
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
</style>
