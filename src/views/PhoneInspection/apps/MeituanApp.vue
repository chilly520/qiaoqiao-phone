<template>
    <div class="takeout-app h-full bg-[#F5F5F7] flex flex-col overflow-hidden text-[#333]">
        <!-- Header -->
        <div class="takeout-header pt-16 pb-4 px-6 bg-[#FFD000] sticky top-0 z-30 shadow-sm">
            <div class="flex items-center gap-4">
                <button @click="$emit('back')"
                    class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 active:scale-90 transition-transform">
                    <i class="fa-solid fa-chevron-left text-black"></i>
                </button>
                <div class="flex-1 bg-white/60 rounded-full h-9 flex items-center px-4 gap-2">
                    <i class="fa-solid fa-search text-black/40 text-sm"></i>
                    <span class="text-black/40 text-sm font-bold">想吃点什么喵？</span>
                </div>
            </div>
        </div>

        <!-- Content -->
        <div class="takeout-content flex-1 overflow-y-auto px-4 pb-20">
            <!-- Tabs -->
            <div class="flex gap-4 mt-4 mb-6 px-2">
                <span v-for="t in ['全部', '进行中', '待评价', '退款']" :key="t"
                    class="text-sm font-black text-gray-500 first:text-gray-900 first:border-b-2 first:border-[#FFD000] pb-1">
                    {{ t }}
                </span>
            </div>

            <!-- Orders List -->
            <div class="space-y-4">
                <div v-for="order in orders" :key="order.id"
                    class="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 active:bg-gray-50 transition-all cursor-pointer">
                    <div class="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-store text-xs text-gray-400"></i>
                            <span class="text-sm font-black text-gray-800">{{ order.merchant }}</span>
                            <i class="fa-solid fa-chevron-right text-[10px] text-gray-300"></i>
                        </div>
                        <span class="text-xs font-bold text-gray-400">{{ order.status }}</span>
                    </div>

                    <div class="flex gap-4">
                        <!-- Product Image -->
                        <div class="w-20 h-20 rounded-2xl bg-gray-50 overflow-hidden relative border border-gray-100">
                            <img :src="order.image" class="w-full h-full object-cover">
                            <!-- AI Generated Badge -->
                            <div v-if="order.generated"
                                class="absolute top-1 right-1 bg-black/60 backdrop-blur-sm text-[8px] text-white px-1.5 py-0.5 rounded-full font-black flex items-center gap-1">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                                DRAW
                            </div>
                        </div>

                        <div class="flex-1 min-w-0">
                            <h3 class="text-[15px] font-black text-gray-800 truncate">{{ order.item }}</h3>
                            <p class="text-[11px] text-gray-400 mt-1 line-clamp-1 font-bold">{{ order.description ||
                                '精心烹饪的美味喵~' }}</p>
                            <div class="flex justify-between items-end mt-2">
                                <p class="text-[11px] text-gray-400 font-bold">{{ order.time }}</p>
                                <div class="text-right">
                                    <span class="text-[10px] text-gray-400 mr-1">合计</span>
                                    <span class="text-lg font-black text-gray-900">¥{{ order.price.toFixed(1) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- AI Generation Info Box (if generated) -->
                    <div v-if="order.generated" class="mt-4 p-3 bg-yellow-50 rounded-2xl border border-yellow-100">
                        <div class="flex items-center gap-2 mb-1">
                            <i class="fa-solid fa-sparkles text-[#FFD000]"></i>
                            <span class="text-[10px] font-black text-yellow-600">AI 绘制说明</span>
                        </div>
                        <p class="text-[10px] text-yellow-600/70 font-bold leading-relaxed">
                            该美食图片由系统通过 [draw] 指令根据商品描述实时渲染生成，尽力呈现最真实的味道喵~
                        </p>
                    </div>

                    <div class="mt-4 flex justify-end gap-3 pt-4 border-t border-gray-50">
                        <button
                            class="px-4 py-2 rounded-full border border-gray-200 text-xs font-black text-gray-600">再来一单</button>
                        <button
                            class="px-4 py-2 rounded-full bg-[#FFD000] text-xs font-black text-gray-900 shadow-sm shadow-yellow-100">评价</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    takeoutData: Object
})

const emit = defineEmits(['back'])

const orders = computed(() => {
    return props.takeoutData?.orders || []
})
</script>

<style scoped>
.takeout-app {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
</style>
