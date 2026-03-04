<template>
    <div class="min-h-screen bg-gray-50 p-4 animate-fade-in">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            购物车
            <span class="text-sm font-normal text-gray-500">({{ cart.length }}件商品)</span>
        </h2>

        <div v-if="cart.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <div class="text-6xl mb-4">🛒</div>
            <p>购物车是空的</p>
            <button @click="$emit('switch-view', 'home')"
                class="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full text-sm">
                去逛逛
            </button>
        </div>

        <div v-else class="space-y-3 pb-32">
            <div v-for="item in cart" :key="item.cartId" class="bg-white rounded-xl p-4 shadow-sm flex gap-3">
                <img :src="item.image" class="w-20 h-20 rounded-lg object-cover bg-gray-100">

                <div class="flex-1">
                    <h3 class="text-sm font-medium line-clamp-1">{{ item.title }}</h3>
                    <p class="text-xs text-gray-400 mt-1">{{ item.shop }}</p>

                    <div class="flex items-center justify-between mt-3">
                        <span class="text-red-600 font-bold">¥{{ item.price }}</span>

                        <div class="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                            <button @click="$emit('update', item.cartId, item.quantity - 1)"
                                class="w-6 h-6 flex items-center justify-center text-gray-600 active:bg-gray-200 rounded">-</button>
                            <span class="text-sm w-8 text-center">{{ item.quantity }}</span>
                            <button @click="$emit('update', item.cartId, item.quantity + 1)"
                                class="w-6 h-6 flex items-center justify-center text-gray-600 active:bg-gray-200 rounded">+</button>
                        </div>
                    </div>
                </div>

                <button @click="$emit('remove', item.cartId)" class="text-gray-300 hover:text-red-500 self-start">
                    ✕
                </button>
            </div>
        </div>

        <!-- 底部结算栏 -->
        <div v-if="cart.length > 0"
            class="fixed bottom-[80px] left-0 right-0 bg-white border-t px-4 py-3 flex items-center justify-between safe-area-bottom">
            <div>
                <span class="text-sm text-gray-600">合计:</span>
                <span class="text-xl font-bold text-red-600 ml-1">¥{{ total.toFixed(2) }}</span>
            </div>
            <button @click="$emit('checkout')"
                class="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full font-medium shadow-lg shadow-orange-500/30 active:scale-95 transition-transform">
                结算
            </button>
        </div>
    </div>
</template>

<script setup>
defineProps({
    cart: Array,
    total: Number
})

defineEmits(['update', 'remove', 'checkout', 'switch-view'])
</script>
