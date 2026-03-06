<template>
    <div class="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 active:scale-95 border border-slate-100"
        @click="$emit('click')">
        <div class="relative aspect-square overflow-hidden bg-slate-100">
            <img :src="product.image" :alt="product.title" class="w-full h-full object-cover" loading="lazy">
            <div class="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                <span v-for="tag in product.tags.slice(0, 2)" :key="tag"
                    class="px-2.5 py-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] rounded-full font-bold shadow-sm">
                    {{ tag }}
                </span>
            </div>
            <!-- 删除按钮 -->
            <button @click.stop="$emit('delete')"
                class="absolute top-2.5 right-2.5 w-7 h-7 bg-white/90 backdrop-blur text-slate-600 flex items-center justify-center rounded-full text-sm hover:bg-red-500 hover:text-white transition-all shadow-sm">
                ✕
            </button>
        </div>

        <div class="p-3.5">
            <h3 class="text-sm font-semibold text-slate-800 line-clamp-2 leading-relaxed mb-2">
                {{ product.title }}
            </h3>

            <div class="flex items-center gap-1.5 mb-2.5">
                <span class="text-xs text-slate-500 font-medium">{{ product.shop }}</span>
                <span class="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-lg font-bold">天猫</span>
            </div>

            <div class="flex items-end justify-between">
                <div>
                    <div class="flex items-baseline gap-1">
                        <span class="text-xs text-orange-600 font-bold">¥</span>
                        <span class="text-xl font-black text-orange-600">{{ product.price }}</span>
                    </div>
                    <div class="text-[10px] text-slate-400 line-through font-medium">
                        ¥{{ product.originalPrice }}
                    </div>
                </div>

                <button @click.stop="$emit('add')"
                    class="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-90 hover:shadow-xl hover:scale-105 transition-all text-lg font-bold">
                    +
                </button>
            </div>

            <div class="flex items-center gap-2 mt-2.5 text-[10px] text-slate-400 font-medium">
                <span class="flex items-center gap-1">
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
