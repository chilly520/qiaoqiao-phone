<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        @click.self="$emit('close')">
        <div class="bg-white w-full max-w-md rounded-2xl max-h-[80vh] overflow-y-auto animate-fade-in">
            <div class="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                <h3 class="font-bold">物流详情</h3>
                <button @click="$emit('close')" class="text-gray-400">✕</button>
            </div>

            <div class="p-4">
                <!-- 物流信息卡片 (找回丢失的运单号和预计时间) -->
                <div
                    class="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-4 mb-4 shadow-lg shadow-blue-500/20">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold opacity-80 uppercase tracking-widest">{{ logistics.company
                            }}</span>
                        <span class="text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">{{
                            getStatusText(logistics.status) }}</span>
                    </div>
                    <div class="text-xl font-black tracking-wider mb-2 font-mono">{{ logistics.trackingNumber }}</div>
                    <div class="flex items-center gap-2 py-2 border-t border-white/10 mt-1">
                        <span class="text-lg">🕒</span>
                        <p class="text-[10px] font-bold">预计送达: {{ formatDate(logistics.estimatedDelivery) }}</p>
                    </div>
                </div>

                <!-- 虚拟地图 -->
                <div class="relative w-full h-44 bg-gray-50 rounded-2xl mb-4 overflow-hidden border border-gray-100">
                    <svg v-if="logistics.path" class="w-full h-full" viewBox="0 0 100 100">
                        <!-- 绘制背景网格 -->
                        <defs>
                            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,0,0,0.03)" stroke-width="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        <!-- 绘制物流路径 -->
                        <polyline :points="logistics.path?.map(p => `${p.x},${p.y}`).join(' ')" fill="none"
                            stroke="#3b82f6" stroke-width="2" stroke-dasharray="4" />

                        <!-- 绘制节点 -->
                        <g v-for="node in (logistics.path || [])" :key="node.label">
                            <circle :cx="node.x" :cy="node.y" r="2" fill="#fff" stroke="#3b82f6" stroke-width="1.5" />
                            <text :x="node.x" :y="node.y + 8" font-size="5" text-anchor="middle" fill="#64748b"
                                font-weight="bold">{{ node.label }}</text>
                        </g>

                        <!-- 绘制当前坐标 (包裹位置) -->
                        <circle :cx="currentPos.x" :cy="currentPos.y" r="4" fill="#3b82f6"
                            class="animate-pulse shadow-lg">
                            <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <text :x="currentPos.x" :y="currentPos.y - 8" font-size="6" text-anchor="middle" fill="#3b82f6"
                            font-weight="black">📦</text>
                    </svg>
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-300 text-xs italic">
                        地图轨迹生成中...
                    </div>

                    <div v-if="logistics.path"
                        class="absolute bottom-2 left-2 bg-white/80 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-bold text-gray-500 border border-white/50 shadow-sm">
                        实时位置：系统卫星定位中...
                    </div>
                </div>

                <!-- 配送员信息 -->
                <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-xl mb-4">
                    <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=courier_${logistics.trackingNumber}`"
                        class="w-10 h-10 rounded-full bg-white border border-blue-100">
                    <div class="flex-1">
                        <p class="text-xs font-black text-blue-900">顺丰小哥：王大壮</p>
                        <p class="text-[10px] text-blue-700/60 font-medium">竭诚为您服务：138****9988</p>
                    </div>
                    <button @click="hasten" :disabled="logistics.hastened"
                        class="text-[10px] px-3 py-1.5 rounded-full font-black transition-all active:scale-90"
                        :class="logistics.hastened ? 'bg-gray-200 text-gray-400' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'">
                        {{ logistics.hastened ? '已催促' : '🚀 催促' }}
                    </button>
                </div>

                <!-- 时间线 -->
                <div class="relative pl-8">
                    <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-100"></div>

                    <div v-for="(item, index) in logistics.timeline" :key="index" class="relative pb-6 last:pb-0">
                        <div class="absolute left-[-22px] w-4 h-4 rounded-full border-4 border-white shadow-sm transition-colors"
                            :class="index === 0 ? 'bg-blue-500 scale-110' : 'bg-gray-300'"></div>

                        <div :class="index === 0 ? 'text-blue-600' : 'text-gray-400'">
                            <p class="font-black text-xs">{{ item.status }}</p>
                            <p class="text-[10px] mt-0.5 font-medium">{{ item.desc }}</p>
                            <p class="text-[8px] mt-0.5 opacity-60 font-mono">{{ formatDateTime(item.time) }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useShoppingStore } from '@/stores/shoppingStore'

const props = defineProps({
    logistics: Object
})

const emit = defineEmits(['close'])
const store = useShoppingStore()

const currentPos = computed(() => {
    // 根据 currentStep 简单计算映射坐标
    if (!props.logistics.path) return { x: 50, y: 50 }
    return props.logistics.path[props.logistics.currentStep] || props.logistics.path[0]
})

const getStatusText = (status) => {
    const map = { picked: '已揽收', shipping: '运输中', delivered: '已签收' }
    return map[status] || status
}

const hasten = () => {
    store.hastenLogistics(props.logistics.orderId)
}

const formatDate = (date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric'
    })
}

const formatDateTime = (date) => {
    return new Date(date).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}
</script>
