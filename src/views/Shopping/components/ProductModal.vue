<template>
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm"
        @click.self="$emit('close')">
        <div
            class="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[95vh] overflow-y-auto animate-slide-up pb-safe border border-slate-100">
            <!-- 图片区 -->
            <div class="relative group">
                <img :src="product.image" class="w-full h-80 object-cover">
                <div class="absolute top-4 inset-x-4 flex justify-between">
                    <button @click="$emit('close')"
                        class="w-8 h-8 bg-black/20 backdrop-blur rounded-full text-white flex items-center justify-center">
                        ✕
                    </button>
                    <button @click="toggleFavorite"
                        :class="['w-8 h-8 rounded-full flex items-center justify-center backdrop-blur', isFavorite ? 'bg-red-500 text-white' : 'bg-black/20 text-white']">
                        {{ isFavorite ? '❤️' : '🤍' }}
                    </button>
                </div>
            </div>

            <div class="p-4">
                <!-- 价格标题 -->
                <div class="flex items-end justify-between mb-4">
                    <div class="flex-1">
                        <div class="flex items-baseline gap-2">
                            <span class="text-3xl font-bold text-red-600">¥{{ currentPrice }}</span>
                            <span class="text-sm text-gray-400 line-through">¥{{ product.originalPrice }}</span>
                        </div>
                        <h2 class="text-lg font-bold mt-2 leading-tight">{{ product.title }}</h2>
                    </div>
                </div>

                <!-- 店铺栏 -->
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-xl">🏬
                        </div>
                        <div>
                            <p class="text-sm font-bold">{{ product.shop }}</p>
                            <p class="text-[10px] text-gray-400">官方认证商家 • 综合体验4.9</p>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button @click="toggleFollow" :class="[
                            'text-[10px] px-3 py-1 rounded-full font-bold transition-all',
                            isFollowed ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white shadow-sm'
                        ]">
                            {{ isFollowed ? '已关注' : '+ 关注' }}
                        </button>
                        <button @click="chatWithShop"
                            class="text-[10px] px-3 py-1 border border-orange-500 text-orange-500 rounded-full active:bg-orange-50">
                            联系客服
                        </button>
                    </div>
                </div>

                <p class="text-sm text-gray-600 mb-6 px-1">{{ product.description }}</p>

                <!-- 规格选择 -->
                <div class="mb-6">
                    <h4 class="text-sm font-bold mb-3 flex items-center gap-2">
                        <span>🏷️</span> 选择规格
                    </h4>
                    <div class="flex flex-wrap gap-2">
                        <button v-for="spec in availableSpecs" :key="spec" @click="selectedSpec = spec" :class="[
                            'px-4 py-2 rounded-xl text-sm border transition-all',
                            selectedSpec === spec
                                ? 'border-orange-500 text-orange-500 bg-orange-50 font-bold outline outline-2 outline-orange-500/20'
                                : 'border-gray-100 text-gray-600 bg-gray-50'
                        ]">
                            {{ spec }}
                        </button>
                    </div>
                </div>

                <!-- 评价系统 -->
                <div ref="reviewSection" class="mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <h4 class="text-sm font-bold flex items-center gap-2">
                                <span>⭐</span> 商品评价 ({{ productReviews.length }})
                            </h4>
                            <button @click="store.generateReviewsAI(product, true)"
                                class="text-[10px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-bold active:scale-90 transition-transform">
                                点击生成新评价
                            </button>
                        </div>
                        <button @click="scrollToReviews"
                            class="text-xs text-orange-500 cursor-pointer hover:underline">
                            好评率 {{ goodRatingPercent }}% >
                        </button>
                    </div>

                    <div v-if="productReviews.length > 0" class="space-y-4" ref="reviewsContainer">
                        <div v-for="(review, idx) in productReviews" :key="idx" class="bg-gray-50 rounded-2xl p-4">
                            <div class="flex items-center gap-2 mb-2">
                                <img :src="`https://api.dicebear.com/7.x/pixel-art/svg?seed=${review.user}`"
                                    class="w-6 h-6 rounded-full bg-white">
                                <span class="text-xs font-medium">{{ review.user }}</span>
                                <div class="flex ml-auto text-[10px]">
                                    <span v-for="i in 5" :key="i" :class="i <= review.rating ? 'text-orange-400' : 'text-gray-300'">★</span>
                                </div>
                            </div>
                            <p class="text-xs text-gray-700 leading-relaxed">
                                {{ review.content || review.text || '暂无评价内容' }}
                            </p>
                            <div v-if="review.images && review.images.length > 0" class="flex gap-2 mt-2">
                                <img v-for="(img, i) in review.images.slice(0, 3)" :key="i" :src="img"
                                    class="w-20 h-20 rounded-lg object-cover bg-white">
                            </div>
                            <p class="text-[10px] text-gray-400 mt-2">{{ review.time }}</p>
                        </div>
                    </div>
                    <div v-else class="text-center py-6 text-gray-400 text-xs italic">
                        正在加载千万真实买家秀...
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex gap-3 sticky bottom-0 bg-white/90 backdrop-blur pt-2 pb-2">
                    <button @click="handleAddToCart" :disabled="isAdded" :class="[
                        'flex-1 py-3.5 rounded-full font-bold active:scale-95 transition-all',
                        isAdded ? 'bg-green-500 text-white' : 'bg-orange-50 text-orange-600'
                    ]">
                        {{ isAdded ? '✅ 已加入' : '加入购物车' }}
                    </button>
                    <button @click="buyNow"
                        class="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full font-bold shadow-lg shadow-orange-500/30 active:scale-95 transition-transform">
                        立即购买
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useShoppingStore } from '@/stores/shoppingStore'

const props = defineProps({
    product: Object
})

const emit = defineEmits(['close', 'add'])
const store = useShoppingStore()

const quantity = ref(1)
const isAdded = ref(false)
const reviewsContainer = ref(null)

const availableSpecs = computed(() => {
    if (props.product.specs && props.product.specs.length > 0) {
        return props.product.specs.map(s => s.name)
    }
    return ['标准版', '高配版', '尊享版']
})

const selectedSpec = ref(availableSpecs.value[0])

const currentPrice = computed(() => {
    if (props.product.specs && props.product.specs.length > 0) {
        const found = props.product.specs.find(s => s.name === selectedSpec.value)
        return found ? found.price : props.product.price
    }
    return props.product.price
})

const isFavorite = computed(() => store.favorites.includes(props.product.id))
const isFollowed = computed(() => store.subscribedShops.some(s => s.name === props.product.shop))
const productReviews = computed(() => {
    const reviews = store.reviews[props.product.id] || []
    console.log('商品评价数据:', reviews)
    return reviews
})

// 计算好评率
const goodRatingPercent = computed(() => {
    const reviews = productReviews.value
    if (reviews.length === 0) return 100
    const goodReviews = reviews.filter(r => r.rating >= 4).length
    return Math.round((goodReviews / reviews.length) * 100)
})

// 滚动到评论区
const scrollToReviews = () => {
    const modal = document.querySelector('.max-h-\\[95vh\\]')
    if (modal && reviewsContainer.value) {
        const containerRect = reviewsContainer.value.getBoundingClientRect()
        const modalRect = modal.getBoundingClientRect()
        const scrollTop = modal.scrollTop + containerRect.top - modalRect.top - 20
        modal.scrollTo({ top: scrollTop, behavior: 'smooth' })
    }
}

onMounted(() => {
    store.addFootprint(props.product.id)
    // 确保评价存在
    if (!productReviews.value || productReviews.value.length === 0) {
        setTimeout(() => {
            store.generateReviewsAI(props.product)
        }, 100)
    }
})

const toggleFavorite = () => {
    if (isFavorite.value) store.removeFavorite(props.product.id)
    else store.addToFavorites(props.product.id)
}

const toggleFollow = () => {
    if (isFollowed.value) {
        store.unfollowShop(props.product.shop)
    } else {
        store.followShop({
            name: props.product.shop,
            icon: '🏬'
        })
    }
}

const chatWithShop = () => {
    store.activeShopId = props.product.shop
    store.switchView('chat')
    emit('close')
    // 触发 ChatView 进入聊天模式
    setTimeout(() => {
        const event = new CustomEvent('enter-chat', { detail: props.product.shop })
        window.dispatchEvent(event)
    }, 100)
}

const handleAddToCart = () => {
    if (isAdded.value) return
    store.addToCart({ ...props.product, price: currentPrice.value }, quantity.value, { spec: selectedSpec.value })
    isAdded.value = true
    setTimeout(() => {
        isAdded.value = false
    }, 1500)
}

const buyNow = () => {
    store.addToCart({ ...props.product, price: currentPrice.value }, quantity.value, { spec: selectedSpec.value })
    store.switchView('cart')
    emit('close')
}
</script>

<style scoped>
@keyframes slide-up {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}

.animate-slide-up {
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
}
</style>
