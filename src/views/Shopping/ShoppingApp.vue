<template>
    <div class="shopping-app bg-slate-50 h-screen flex flex-col font-sans overflow-hidden">
        <!-- 统一 Header -->
        <header class="flex-none bg-white/90 backdrop-blur-xl border-b border-slate-200/50 px-4 py-3 z-50 flex items-center gap-3 shadow-sm">
            <!-- 回到桌面按钮 -->
            <button @click="handleReturnHome"
                class="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-lg active:scale-90 transition-all flex-none">
                🏠
            </button>
            <div v-if="currentView === 'home'" class="flex-1 relative flex items-center gap-2 overflow-hidden">
                <div class="flex-1 relative">
                    <input v-model="searchQuery" @keyup.enter="handleSearchAI" type="text" placeholder="搜索并 AI 发现商品..."
                        class="w-full bg-slate-100 rounded-2xl px-4 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                </div>
                <button @click="clearProducts"
                    class="text-xs text-slate-400 hover:text-red-500 flex-none px-2 py-1 rounded-xl hover:bg-red-50 transition-all">
                    清空
                </button>
            </div>
            <div v-else class="flex-1 overflow-hidden">
                <h1 class="text-base font-bold text-slate-800 truncate">
                    {{navigation.find(n => n.id === currentView)?.label}}
                </h1>
            </div>
        </header>

        <!-- 主内容区 -->
        <main class="flex-1 overflow-hidden relative">
            <!-- 首页 -->
            <div v-if="currentView === 'home'" class="h-full flex flex-col animate-fade-in">
                <!-- 分类标签 -->
                <div class="flex-none bg-white/90 backdrop-blur-lg border-b border-slate-100 flex items-center">
                    <div class="flex overflow-x-auto px-3 py-2.5 gap-2 scrollbar-hide flex-1">
                        <button v-for="cat in categories" :key="cat.id" @click="setCategory(cat.id)" :class="[
                            'flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap transition-all',
                            currentCategory === cat.id
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 scale-105'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        ]">
                            <span class="text-base">{{ cat.icon }}</span>
                            <span>{{ cat.name }}</span>
                        </button>
                    </div>
                    <!-- 生成按钮 -->
                    <button @click="generateCategoryAI"
                        class="mx-2 w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center text-base shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all">
                        ✨
                    </button>
                </div>

                <!-- 滚动列表区 -->
                <div class="flex-1 overflow-y-auto px-4 pb-4">
                    <!-- 加载状态 -->
                    <div v-if="loading" class="p-8 text-center text-slate-400 flex flex-col items-center gap-3">
                        <div class="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin">
                        </div>
                        <p class="text-xs font-medium animate-pulse">AI 正在根据分类挖掘好物...</p>
                    </div>

                    <!-- 商品网格 -->
                    <div v-if="filteredProducts.length > 0" class="mt-4 pb-10">
                        <div class="grid grid-cols-2 gap-3">
                            <ProductCard v-for="product in filteredProducts" :key="product.id" :product="product"
                                @add="addToCart(product)" @click="showProductDetail(product)"
                                @delete="deleteProduct(product.id)" />
                        </div>
                    </div>
                    <div v-else-if="!loading" class="h-full flex flex-col items-center justify-center text-slate-300">
                        <p class="text-5xl mb-4">📭</p>
                        <p class="text-sm font-medium">暂无商品，点击上方 ✨ 按钮生成吧</p>
                    </div>
                </div>
            </div>

            <!-- 购物车 -->
            <CartView v-else-if="currentView === 'cart'" class="h-full overflow-y-auto" :cart="cart" :total="cartTotal"
                @update="updateCartQuantity" @remove="removeFromCart" @checkout="showCheckout" />

            <!-- 订单 -->
            <OrdersView v-else-if="currentView === 'orders'" class="h-full overflow-y-auto" :orders="orders"
                :logistics="logistics" @pay="payOrder" @confirm="confirmReceipt" @track="showLogistics" />

            <!-- 客服对话 -->
            <ChatView v-else-if="currentView === 'chat'" class="h-full" @toggle-dock="isDockVisible = $event"
                @show-product="showProductDetail" />

            <!-- 我的 -->
            <ProfileView v-else-if="currentView === 'profile'" class="h-full overflow-y-auto" :user="currentUser"
                :orders="orders" />
        </main>

        <!-- 底部导航 -->
        <nav v-if="isDockVisible" class="flex-none bg-white/90 backdrop-blur-xl border-t border-slate-200/50 px-6 py-3 pb-safe shadow-lg">
            <div class="flex justify-around items-center">
                <NavButton v-for="nav in navigation" :key="nav.id" :icon="nav.icon" :label="nav.label"
                    :active="currentView === nav.id" :badge="nav.badge" @click="switchView(nav.id)" />
            </div>
        </nav>

        <!-- 弹窗组件 -->
        <ProductModal v-if="selectedProduct" :product="selectedProduct" @close="selectedProduct = null"
            @add="handleAddToCart" />
        <CheckoutModal v-if="showCheckoutModal" :cart="cart" :total="cartTotal" @close="showCheckoutModal = false"
            @submit="handleCheckout" />
        <LogisticsModal v-if="selectedLogistics" :logistics="selectedLogistics" @close="selectedLogistics = null" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useShoppingStore } from '@/stores/shoppingStore'
import ProductCard from './components/ProductCard.vue'
import CartView from './components/CartView.vue'
import OrdersView from './components/OrdersView.vue'
import ChatView from './components/ChatView.vue'
import ProfileView from './components/ProfileView.vue'
import NavButton from './components/NavButton.vue'
import ProductModal from './components/ProductModal.vue'
import CheckoutModal from './components/CheckoutModal.vue'
import LogisticsModal from './components/LogisticsModal.vue'

const store = useShoppingStore()
const {
    products, cart, orders, logistics, chatMessages,
    currentUser, currentCategory, searchQuery, currentView,
    categories, filteredProducts, cartCount, cartTotal, loading
} = storeToRefs(store)

// 本地状态
const selectedProduct = ref(null)
const showCheckoutModal = ref(false)
const selectedLogistics = ref(null)
const isDockVisible = ref(true)
const router = useRouter()

const handleReturnHome = () => {
    router.push('/')
}

// 导航配置
const navigation = computed(() => [
    { id: 'home', icon: '🏠', label: '首页', badge: 0 },
    { id: 'cart', icon: '🛒', label: '购物车', badge: cartCount.value },
    { id: 'orders', icon: '📦', label: '订单', badge: store.pendingOrders.length },
    { id: 'chat', icon: '💬', label: '客服', badge: 0 },
    { id: 'profile', icon: '👤', label: '我的', badge: 0 }
])

// 初始化
onMounted(() => {
    store.initStore()
})

// 方法
const setCategory = store.setCategory
const switchView = store.switchView
const addToCart = store.addToCart
const updateCartQuantity = store.updateCartQuantity
const removeFromCart = store.removeFromCart
const confirmReceipt = store.confirmReceipt
const deleteProduct = store.deleteProduct
const clearProducts = store.clearProducts

const handleSearchAI = () => {
    if (!searchQuery.value.trim()) return
    store.generateProductsAI(searchQuery.value)
}

const generateCategoryAI = () => {
    store.generateProductsAI('', currentCategory.value)
}

const handleSearch = (e) => {
    store.setSearchQuery(e.target.value)
}

const showProductDetail = (product) => {
    selectedProduct.value = product
}

const handleAddToCart = (data) => {
    store.addToCart(data.product, data.quantity, data.specs)
    selectedProduct.value = null
}

const showCheckout = () => {
    if (cart.value.length === 0) return
    showCheckoutModal.value = true
}

const handleCheckout = (data) => {
    const order = store.createOrder(cart.value, data.address, data.remark, data.couponId, data.paymentMethod)
    if (order) {
        showCheckoutModal.value = false
        setTimeout(() => {
            switchView('orders')
        }, 300)
    }
}

const showLogistics = (orderId) => {
    selectedLogistics.value = logistics.value.find(l => l.orderId === orderId)
}

const handleSendMessage = (content) => {
    store.getAIShopReply(store.activeShopId, content)
}
</script>

<style scoped>
.shopping-app {
    -webkit-tap-highlight-color: transparent;
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
}

.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom, 20px);
}

@keyframes fade-in {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-fade-in {
    animation: fade-in 0.3s ease-out;
}

/* Loading overlay */
.loading-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: .5;
    }
}
</style>
