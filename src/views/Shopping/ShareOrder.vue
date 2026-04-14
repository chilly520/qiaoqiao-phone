<template>
    <div class="share-order-page bg-slate-50 min-h-screen pb-safe overflow-y-auto">
        <!-- 关闭按钮 -->
        <button @click="$router.back()" 
            class="fixed top-4 left-4 z-50 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-slate-600 active:scale-90 transition-transform">
            <span class="text-xl">←</span>
        </button>

        <!-- 头部 -->
        <div class="bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 pt-12 pb-20 px-6 text-white relative overflow-hidden">
            <!-- 装饰图案 -->
            <div class="absolute top-0 left-0 w-full h-full opacity-10">
                <div class="absolute top-4 left-4 w-12 h-12 border-2 border-white rounded-full"></div>
                <div class="absolute bottom-4 right-4 w-16 h-16 border-2 border-white rounded-full"></div>
            </div>

            <div class="relative z-10 text-center">
                <div class="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl">
                    📦
                </div>
                <h1 class="text-xl font-bold mb-2">订单详情</h1>
                <p class="text-xs opacity-80">好友分享的订单</p>
            </div>
        </div>

        <!-- 内容区 -->
        <div class="px-4 -mt-12 relative z-20 space-y-4">
            <!-- 订单状态卡片 -->
            <div class="bg-white rounded-3xl p-5 shadow-xl shadow-slate-900/5 border border-slate-100">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-2xl">
                            ✅
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-slate-800">订单已完成</h2>
                            <p class="text-xs text-slate-400 mt-0.5">好友已签收</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                        运输完成
                    </span>
                </div>

                <!-- 进度条 -->
                <div class="relative pt-6 pb-2">
                    <div class="flex items-center justify-between">
                        <div class="flex flex-col items-center">
                            <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">✓</div>
                            <span class="text-[10px] text-slate-500 mt-1">已付款</span>
                        </div>
                        <div class="flex-1 h-1 bg-green-200 mx-2 relative">
                            <div class="absolute inset-0 bg-green-500"></div>
                        </div>
                        <div class="flex flex-col items-center">
                            <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">✓</div>
                            <span class="text-[10px] text-slate-500 mt-1">已发货</span>
                        </div>
                        <div class="flex-1 h-1 bg-green-200 mx-2 relative">
                            <div class="absolute inset-0 bg-green-500"></div>
                        </div>
                        <div class="flex flex-col items-center">
                            <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">✓</div>
                            <span class="text-[10px] text-slate-500 mt-1">已签收</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 商品信息 -->
            <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <h3 class="text-sm font-bold text-slate-700 mb-4">商品信息</h3>
                <div v-if="order" class="space-y-3">
                    <div v-for="(item, idx) in order.items" :key="idx" class="flex gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                        <img :src="item.image" class="w-20 h-20 rounded-2xl object-cover bg-slate-100">
                        <div class="flex-1">
                            <h4 class="text-sm font-medium text-slate-800 line-clamp-2">{{ item.title }}</h4>
                            <p class="text-xs text-slate-400 mt-1">x{{ item.quantity }}</p>
                            <p class="text-sm font-bold text-orange-600 mt-2">¥{{ item.price }}</p>
                        </div>
                    </div>
                </div>
                <div v-else class="text-center py-8 text-slate-400">
                    <p class="text-4xl mb-2">📭</p>
                    <p class="text-xs">暂无商品信息</p>
                </div>

                <div v-if="order" class="flex justify-between items-center pt-4 mt-2 border-t border-slate-100">
                    <span class="text-sm text-slate-600">共{{ order.items.length }}件商品</span>
                    <div class="text-right">
                        <span class="text-xs text-slate-500">实付</span>
                        <span class="text-2xl font-black text-orange-600 ml-2">¥{{ order.total }}</span>
                    </div>
                </div>
            </div>

            <!-- 物流信息 -->
            <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl p-5 border border-orange-100">
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-2xl">🚚</span>
                    <h3 class="text-sm font-bold text-slate-700">物流跟踪</h3>
                    <span class="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full ml-auto">
                        实时更新
                    </span>
                </div>

                <div v-if="logisticsInfo" class="space-y-4">
                    <!-- 最新状态 -->
                    <div class="bg-white rounded-2xl p-4 border border-orange-100">
                        <div class="flex items-start gap-3">
                            <div class="w-3 h-3 rounded-full bg-green-500 mt-1 flex-none shadow-lg shadow-green-500/30"></div>
                            <div class="flex-1">
                                <p class="text-sm font-bold text-slate-800">{{ getLogisticsStatusText(logisticsInfo.status) }}</p>
                                <p class="text-xs text-slate-500 mt-1">{{ logisticsInfo.location || '物流信息更新中' }}</p>
                                <p class="text-[10px] text-slate-400 mt-1">{{ logisticsInfo.updateTime }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- 物流历史 -->
                    <div class="space-y-3 pl-1.5">
                        <div v-for="(track, idx) in logisticsInfo.history" :key="idx" class="flex gap-3 relative">
                            <!-- 连接线 -->
                            <div class="absolute left-1.5 top-5 bottom-0 w-px bg-slate-200"></div>
                            <div class="w-3 h-3 rounded-full bg-slate-300 mt-1 flex-none relative z-10"></div>
                            <div class="flex-1 pb-3">
                                <p class="text-xs text-slate-600">{{ track.content }}</p>
                                <p class="text-[10px] text-slate-400 mt-1">{{ track.time }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else class="text-center py-8 text-slate-400">
                    <p class="text-4xl mb-2">📦</p>
                    <p class="text-xs">暂无物流信息</p>
                </div>

                <p class="text-[10px] text-slate-400 mt-4 text-center">
                    🔄 物流信息实时同步，好友可随时查看
                </p>
            </div>

            <!-- 收货地址 -->
            <div v-if="order?.address" class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <h3 class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span>📍</span> 收货地址
                </h3>
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl flex-none">
                        🏠
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-slate-800 font-medium">
                            {{ order.address.name }} {{ order.address.phone }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">
                            {{ order.address.region }} {{ order.address.detail }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- 底部提示 -->
            <div class="text-center py-6">
                <p class="text-xs text-slate-400">
                    👆 物流信息将实时同步给分享者
                </p>
                <p class="text-[10px] text-slate-300 mt-2">
                    此页面由好友分享，订单归属原购买者
                </p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useShoppingStore } from '@/stores/shoppingStore'

const route = useRoute()
const store = useShoppingStore()

const order = ref(null)
const logisticsInfo = ref(null)
let refreshInterval = null

onMounted(() => {
    // 从 URL 获取订单 ID
    const orderId = route.params.orderId
    if (orderId) {
        loadOrderData(orderId)
        
        // 每 5 秒刷新一次物流信息，实现实时同步
        refreshInterval = setInterval(() => {
            loadOrderData(orderId)
        }, 5000)
    }
})

const loadOrderData = (orderId) => {
    // 查找订单
    order.value = store.orders.find(o => o.id === orderId)
    
    // 查找物流信息
    const logistics = store.logistics.find(l => l.orderId === orderId)
    if (logistics) {
        logisticsInfo.value = {
            status: logistics.status,
            location: logistics.location,
            updateTime: logistics.updateTime,
            history: logistics.history || []
        }
    }
}

// 获取物流状态文本
const getLogisticsStatusText = (status) => {
    const statusMap = {
        'picked': '已揽收',
        'pending': '待发货',
        'paid': '已付款',
        'shipped': '运输中',
        'shipping': '运输中',
        'delivering': '派送中',
        'delivered': '待签收',
        'completed': '已签收',
        'cancelled': '已取消'
    }
    return statusMap[status] || status
}

// 组件卸载时清除定时器
import { onUnmounted } from 'vue'
onUnmounted(() => {
    if (refreshInterval) {
        clearInterval(refreshInterval)
    }
})
</script>

<style scoped>
@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
