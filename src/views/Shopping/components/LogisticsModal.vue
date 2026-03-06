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
                <div class="relative w-full h-56 bg-gradient-to-br from-slate-100 to-blue-50 rounded-2xl mb-4 overflow-hidden border border-blue-100 shadow-inner">
                    <svg v-if="logistics.path" class="w-full h-full" viewBox="0 0 100 100">
                        <defs>
                            <!-- 地图背景图案 -->
                            <pattern id="mapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(59, 130, 246, 0.08)" stroke-width="0.5" />
                            </pattern>
                            
                            <!-- 地形装饰 -->
                            <radialGradient id="terrainGrad">
                                <stop offset="0%" stop-color="rgba(59, 130, 246, 0.05)" />
                                <stop offset="100%" stop-color="rgba(59, 130, 246, 0.02)" />
                            </radialGradient>
                            
                            <!-- 节点光晕 -->
                            <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                                <feComposite in="SourceGraphic" operator="over" />
                            </filter>
                        </defs>
                        
                        <!-- 背景层 -->
                        <rect width="100%" height="100%" fill="url(#mapGrid)" />
                        <rect width="100%" height="100%" fill="url(#terrainGrad)" />
                        
                        <!-- 装饰性地形元素 -->
                        <circle cx="15" cy="25" r="8" fill="rgba(59, 130, 246, 0.03)" />
                        <circle cx="85" cy="75" r="12" fill="rgba(59, 130, 246, 0.03)" />
                        <circle cx="30" cy="80" r="6" fill="rgba(59, 130, 246, 0.02)" />
                        <circle cx="70" cy="20" r="10" fill="rgba(59, 130, 246, 0.02)" />

                        <!-- 绘制物流路径（带阴影） -->
                        <polyline :points="logistics.path?.map(p => `${p.x},${p.y}`).join(' ')" fill="none"
                            stroke="rgba(59, 130, 246, 0.2)" stroke-width="4" stroke-dasharray="4" stroke-linecap="round" />
                        <polyline :points="logistics.path?.map(p => `${p.x},${p.y}`).join(' ')" fill="none"
                            stroke="#3b82f6" stroke-width="2" stroke-dasharray="4" stroke-linecap="round" />

                        <!-- 绘制节点标注（先画连接线） -->
                        <g v-for="(node, idx) in (logistics.path || [])" :key="'line-' + idx">
                            <line v-if="idx < logistics.path.length - 1"
                                :x1="node.x" :y1="node.y"
                                :x2="logistics.path[idx + 1].x" :y2="logistics.path[idx + 1].y"
                                stroke="rgba(59, 130, 246, 0.15)" stroke-width="0.5" stroke-dasharray="2" />
                        </g>

                        <!-- 绘制节点（缩小版） -->
                        <g v-for="(node, idx) in (logistics.path || [])" :key="'node-' + idx">
                            <!-- 节点光晕（缩小） -->
                            <circle :cx="node.x" :cy="node.y" r="3" fill="rgba(59, 130, 246, 0.08)" />
                            
                            <!-- 节点外圈（终点用橙色，其他用蓝色，都缩小） -->
                            <circle v-if="node.type === 'dest'" 
                                :cx="node.x" :cy="node.y" r="2" fill="#f59e0b" stroke="#d97706" stroke-width="1.5" />
                            <circle v-else
                                :cx="node.x" :cy="node.y" r="2" fill="white" stroke="#3b82f6" stroke-width="1.5" />
                            
                            <!-- 节点标注框（智能防遮挡，缩小版） -->
                            <g>
                                <!-- 计算标注位置：根据节点水平位置动态调整 -->
                                <!-- 左边区域 (x < 20): 标注框右对齐，文字在节点右侧 -->
                                <!-- 右边区域 (x > 80): 标注框左对齐，文字在节点左侧 -->
                                <!-- 中间区域：居中显示 -->
                                <g v-if="node.x < 20">
                                    <!-- 左侧节点：标注在右边 -->
                                    <rect v-if="node.type === 'dest'" 
                                        :x="node.x + 2.5" :y="node.y - 7" width="24" height="5" rx="0.8" fill="#fef3c7" stroke="#f59e0b" stroke-width="0.6" opacity="0.95" />
                                    <rect v-else
                                        :x="node.x + 2.5" :y="node.y - 7" width="18" height="5" rx="0.8" fill="white" stroke="#3b82f6" stroke-width="0.4" opacity="0.9" />
                                    <text v-if="node.type === 'dest'" 
                                        :x="node.x + 14.5" :y="node.y - 3.5" font-size="2.8" text-anchor="middle" fill="#92400e"
                                        font-weight="bold" style="font-family: 'Microsoft YaHei', sans-serif">📍 {{ node.label }}</text>
                                    <text v-else
                                        :x="node.x + 11.5" :y="node.y - 3.5" font-size="2.6" text-anchor="middle" fill="#1e40af"
                                        font-weight="bold" style="font-family: 'Microsoft YaHei', sans-serif">{{ node.label }}</text>
                                </g>
                                <g v-else-if="node.x > 80">
                                    <!-- 右侧节点：标注在左边 -->
                                    <rect v-if="node.type === 'dest'" 
                                        :x="node.x - 24.5" :y="node.y - 7" width="24" height="5" rx="0.8" fill="#fef3c7" stroke="#f59e0b" stroke-width="0.6" opacity="0.95" />
                                    <rect v-else
                                        :x="node.x - 19.5" :y="node.y - 7" width="18" height="5" rx="0.8" fill="white" stroke="#3b82f6" stroke-width="0.4" opacity="0.9" />
                                    <text v-if="node.type === 'dest'" 
                                        :x="node.x - 12.5" :y="node.y - 3.5" font-size="2.8" text-anchor="middle" fill="#92400e"
                                        font-weight="bold" style="font-family: 'Microsoft YaHei', sans-serif">📍 {{ node.label }}</text>
                                    <text v-else
                                        :x="node.x - 10.5" :y="node.y - 3.5" font-size="2.6" text-anchor="middle" fill="#1e40af"
                                        font-weight="bold" style="font-family: 'Microsoft YaHei', sans-serif">{{ node.label }}</text>
                                </g>
                                <g v-else>
                                    <!-- 中间节点：标注在上方居中 -->
                                    <rect v-if="node.type === 'dest'" 
                                        :x="node.x - 13" :y="node.y - 9" width="26" height="5" rx="0.8" fill="#fef3c7" stroke="#f59e0b" stroke-width="0.6" opacity="0.95" />
                                    <rect v-else
                                        :x="node.x - 10" :y="node.y - 9" width="20" height="5" rx="0.8" fill="white" stroke="#3b82f6" stroke-width="0.4" opacity="0.9" />
                                    <text v-if="node.type === 'dest'" 
                                        :x="node.x" :y="node.y - 5.5" font-size="2.8" text-anchor="middle" fill="#92400e"
                                        font-weight="bold" style="font-family: 'Microsoft YaHei', sans-serif">📍 {{ node.label }}</text>
                                    <text v-else
                                        :x="node.x" :y="node.y - 5.5" font-size="2.6" text-anchor="middle" fill="#1e40af"
                                        font-weight="bold" style="font-family: 'Microsoft YaHei', sans-serif">{{ node.label }}</text>
                                </g>
                            </g>
                        </g>

                        <!-- 绘制当前坐标 (包裹位置) -->
                        <g :transform="`translate(${currentPos.x}, ${currentPos.y})`">
                            <!-- 外圈脉冲 -->
                            <circle r="8" fill="rgba(59, 130, 246, 0.2)">
                                <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <!-- 包裹图标背景 -->
                            <circle r="4" fill="#3b82f6" stroke="white" stroke-width="1.5" filter="url(#nodeGlow)" />
                            <!-- 包裹 emoji -->
                            <text y="1.5" font-size="5" text-anchor="middle">📦</text>
                        </g>
                    </svg>
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-300 text-xs italic">
                        地图轨迹生成中...
                    </div>

                    <div v-if="logistics.path"
                        class="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[9px] font-bold text-blue-600 border border-blue-200 shadow-sm flex items-center gap-1.5">
                        <span>🛰️</span>
                        <span>实时卫星定位中</span>
                    </div>
                </div>

                <!-- 配送员信息 -->
                <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-xl mb-4">
                    <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=courier_${logistics.trackingNumber}`"
                        class="w-10 h-10 rounded-full bg-white border border-blue-100">
                    <div class="flex-1">
                        <p class="text-xs font-black text-blue-900">顺丰小哥：{{ courierName }}</p>
                        <p class="text-[10px] text-blue-700/60 font-medium">竭诚为您服务：{{ courierPhone }}</p>
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
    const map = { picked: '已揽收', shipping: '运输中', delivering: '派送中', delivered: '待签收' }
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

// 随机生成快递小哥信息
const courierNames = ['王大壮', '李强', '张伟', '刘洋', '陈杰', '杨帆', '赵磊', '黄勇', '周斌', '吴涛']
const courierPhones = ['138****9988', '139****7766', '137****5544', '136****3322', '135****1100']

const courierName = computed(() => {
    const seed = parseInt(props.logistics.trackingNumber?.slice(-3) || '0')
    return courierNames[seed % courierNames.length]
})

const courierPhone = computed(() => {
    const seed = parseInt(props.logistics.trackingNumber?.slice(-2) || '0')
    return courierPhones[seed % courierPhones.length]
})
</script>
