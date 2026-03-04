<template>
    <div class="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 active:scale-95"
        @click="$emit('click')">
        <div class="relative aspect-square overflow-hidden bg-gray-100">
            <img :src="product.image" :alt="product.title" class="w-full h-full object-cover" loading="lazy">
            <div class="absolute top-2 left-2 flex flex-wrap gap-1">
                <span v-for="tag in product.tags.slice(0, 2)" :key="tag"
                    class="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-medium">
                    {{ tag }}
                </span>
            </div>
            <!-- 删除按钮 -->
            <button @click.stop="$emit('delete')"
                class="absolute top-2 right-2 w-6 h-6 bg-black/30 backdrop-blur text-white flex items-center justify-center rounded-full text-xs hover:bg-red-500 transition-colors">
                ✕
            </button>
        </div>

        <div class="p-3">
            <h3 class="text-sm font-medium text-gray-900 line-clamp-2 leading-snug mb-1">
                {{ product.title }}
            </h3>

            <div class="flex items-center gap-1 mb-2">
                <span class="text-xs text-gray-500">{{ product.shop }}</span>
                <span class="text-[10px] px-1 bg-gray-100 text-gray-500 rounded">天猫</span>
            </div>

            <div class="flex items-end justify-between">
                <div>
                    <div class="flex items-baseline gap-1">
                        <span class="text-xs text-red-600 font-bold">¥</span>
                        <span class="text-lg font-bold text-red-600">{{ product.price }}</span>
                    </div>
                    <div class="text-[10px] text-gray-400 line-through">
                        ¥{{ product.originalPrice }}
                    </div>
                </div>

                <button @click.stop="$emit('add')"
                    class="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-90 transition-transform">
                    +
                </button>
            </div>

            <div class="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                <span class="flex items-center gap-0.5">
                    ⭐ {{ product.rating }}
                </span>
                <span>已售 {{ formatSales(product.sales) }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    product: Object
})

defineEmits(['add', 'click', 'delete'])

const formatSales = (num) => {
    if (num > 10000) return (num / 10000).toFixed(1) + '万'
    return num
}
</script>
