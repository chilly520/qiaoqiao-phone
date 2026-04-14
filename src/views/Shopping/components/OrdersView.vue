<template>
    <div class="flex-1 flex flex-col bg-gray-50 animate-fade-in overflow-hidden">
        <!-- 商品详情弹窗 -->
        <div v-if="selectedProduct"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            @click="selectedProduct = null">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full max-h-[80vh] overflow-hidden animate-scale-in"
                @click.stop>
                <!-- 商品图片 -->
                <div class="relative">
                    <img :src="selectedProduct.image" class="w-full aspect-square object-cover bg-slate-100">
                    <button @click="selectedProduct = null"
                        class="absolute top-4 right-4 w-8 h-8 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white text-xl">
                        ✕
                    </button>
                </div>

                <!-- 商品信息 -->
                <div class="p-5 space-y-4">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 mb-2">{{ selectedProduct.title }}</h3>
                        <p class="text-sm text-slate-500 leading-relaxed">{{ selectedProduct.description }}</p>
                    </div>

                    <div class="flex items-center justify-between">
                        <span class="text-2xl font-black text-orange-600">¥{{ selectedProduct.price }}</span>
                        <span v-if="selectedProduct.originalPrice" class="text-sm text-slate-400 line-through">
                            ¥{{ selectedProduct.originalPrice }}
                        </span>
                    </div>

                    <div class="flex items-center gap-2 pt-3 border-t">
                        <span class="text-xs text-slate-400">店铺:</span>
                        <span class="text-xs font-bold text-slate-600">{{ selectedProduct.shop || '官方旗舰店' }}</span>
                    </div>
                </div>

                <!-- 底部按钮 -->
                <div class="p-4 pt-0 flex gap-3">
                    <button @click="addToCartFromOrder(selectedProduct)"
                        class="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
                        加入购物车
                    </button>
                    <button @click="buyNow(selectedProduct)"
                        class="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-transform">
                        立即购买
                    </button>
                </div>
            </div>
        </div>
        <!-- 订单状态标签 -->
        <div class="sticky top-0 bg-white z-40 border-b flex-none">
            <div class="flex overflow-x-auto px-2 py-3 gap-2 scrollbar-hide">
                <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="[
                    'px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors',
                    activeTab === tab.id ? 'bg-orange-100 text-orange-600 font-medium' : 'text-gray-600'
                ]">
                    {{ tab.label }}
                </button>
            </div>
        </div>

        <!-- 订单列表区 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
            <div v-if="filteredOrders.length === 0" class="flex flex-col items-center justify-center py-20 opacity-30">
                <p class="text-6xl mb-4">📝</p>
                <p class="text-xs font-black uppercase tracking-widest">暂无相关订单</p>
            </div>

            <div v-for="order in filteredOrders" :key="order.id"
                class="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
                <div class="flex justify-between items-center mb-3">
                    <div class="flex flex-col">
                        <span class="text-[10px] text-slate-400 font-mono">{{ order.id }}</span>
                        <span class="text-[8px] text-slate-300">{{ formatDate(order.createdAt) }}</span>
                    </div>
                    <span :class="['text-xs font-black uppercase tracking-wider', getStatusColor(order.status)]">
                        {{ getStatusText(order.status) }}
                    </span>
                </div>

                <div class="space-y-2 mb-3">
                    <div v-for="item in order.items.slice(0, 2)" :key="item.cartId" @click="showProductDetail(item)"
                        class="flex gap-3 cursor-pointer active:scale-95 transition-transform">
                        <img :src="item.image" class="w-16 h-16 rounded-2xl object-cover bg-slate-100">
                        <div class="flex-1">
                            <h4 class="text-sm line-clamp-1">{{ item.title }}</h4>
                            <p class="text-xs text-slate-400 mt-1">x{{ item.quantity }}</p>
                        </div>
                        <span class="text-sm text-slate-600">¥{{ item.price }}</span>
                    </div>
                </div>

                <div class="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span class="text-sm text-slate-600">共{{ order.items.length }}件 实付:
                        <span class="text-lg font-bold text-slate-900">¥{{ order.total }}</span>
                    </span>

                    <div class="flex gap-2">
                        <button
                            v-if="['paid', 'shipped', 'shipping', 'delivering', 'delivered', 'completed'].includes(order.status)"
                            @click="$emit('track', order.id)"
                            class="px-4 py-1.5 border border-slate-200 text-slate-500 text-[10px] font-bold rounded-full hover:bg-slate-50">
                            查看物流
                        </button>
                        <button v-if="['paid', 'shipped', 'shipping', 'delivering'].includes(order.status)"
                            @click="shareOrder(order)"
                            class="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-green-500/20 flex items-center gap-1">
                            📤 分享
                        </button>
                        <button v-if="order.status === 'pending'" @click="$emit('pay', order.id)"
                            class="px-4 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold rounded-full shadow-lg">
                            立即支付
                        </button>
                        <button v-if="['shipped', 'shipping', 'delivering', 'delivered'].includes(order.status)"
                            @click="store.confirmReceipt(order.id)"
                            class="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-orange-500/20">
                            {{ order.status === 'delivered' ? '确认签收' : '确认收货' }}
                        </button>
                        <button v-if="order.status === 'completed'" @click="store.deleteOrder(order.id)"
                            class="px-4 py-1.5 border border-slate-100 text-slate-300 text-[10px] font-bold rounded-full hover:bg-slate-50">
                            删除订单
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 分享卡片弹窗 -->
        <div v-if="showShareCard"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            @click="showShareCard = false">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full overflow-hidden animate-scale-in shadow-2xl"
                @click.stop>
                <!-- 卡片头部渐变背景 -->
                <div
                    class="bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 p-6 text-white text-center relative overflow-hidden">
                    <!-- 装饰图案 -->
                    <div class="absolute top-0 left-0 w-full h-full opacity-10">
                        <div class="absolute top-2 left-2 w-8 h-8 border-2 border-white rounded-full"></div>
                        <div class="absolute bottom-2 right-2 w-12 h-12 border-2 border-white rounded-full"></div>
                        <div class="absolute top-1/2 left-1/4 w-6 h-6 border-2 border-white rounded-full"></div>
                    </div>

                    <div class="relative z-10">
                        <div
                            class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg">
                            📦
                        </div>
                        <h3 class="text-lg font-bold mb-1">订单分享</h3>
                        <p class="text-xs opacity-80">好友可以看到订单和物流信息</p>
                    </div>
                </div>

                <!-- 卡片内容 -->
                <div class="p-5 space-y-4">
                    <!-- 订单信息 -->
                    <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 rounded-xl overflow-hidden bg-slate-200">
                                <img :src="sharingOrder?.items[0]?.image" class="w-full h-full object-cover">
                            </div>
                            <div class="flex-1">
                                <h4 class="text-sm font-bold text-slate-800 line-clamp-1">
                                    {{ sharingOrder?.items[0]?.title }}
                                </h4>
                                <p class="text-xs text-slate-400">订单号：{{ sharingOrder?.id }}</p>
                            </div>
                        </div>
                        <div class="flex items-center justify-between pt-3 border-t border-slate-200">
                            <span class="text-xs text-slate-500">实付金额</span>
                            <span class="text-lg font-black text-orange-600">¥{{ sharingOrder?.total }}</span>
                        </div>
                    </div>

                    <!-- 物流信息 -->
                    <div v-if="sharingOrder?.status !== 'pending' && sharingOrder?.status !== 'paid'"
                        class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="text-lg">🚚</span>
                            <span class="text-sm font-bold text-slate-700">物流信息</span>
                            <span :class="['text-xs font-bold ml-auto px-2 py-0.5 rounded-full',
                                sharingOrder?.status === 'completed' ? 'bg-green-100 text-green-600' :
                                    'bg-orange-100 text-orange-600']">
                                {{ getStatusText(sharingOrder?.status) }}
                            </span>
                        </div>
                        <div class="space-y-2">
                            <div class="flex items-start gap-2">
                                <div class="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-none"></div>
                                <div class="flex-1">
                                    <p class="text-xs text-slate-600">
                                        {{logistics.find(l => l.orderId === sharingOrder?.id)?.status || '已发货'}}
                                    </p>
                                    <p class="text-[10px] text-slate-400 mt-0.5">
                                        {{logistics.find(l => l.orderId === sharingOrder?.id)?.updateTime || '刚刚'}}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-3 text-center">
                            🔄 物流信息将实时同步给好友
                        </p>
                    </div>

                    <!-- 分享说明 -->
                    <div class="text-center">
                        <p class="text-xs text-slate-500">
                            🔒 分享后好友可查看订单详情和物流状态
                        </p>
                    </div>
                </div>

                <!-- 分享按钮 -->
                <div class="p-5 pt-0">
                    <button @click="showFriendSelector = true"
                        class="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2">
                        💬 分享给好友
                    </button>
                </div>
            </div>
        </div>

        <!-- 好友选择器弹窗 -->
        <div v-if="showFriendSelector"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click="showFriendSelector = false">
            <div class="bg-white w-full max-w-sm mx-4 rounded-3xl max-h-[80vh] overflow-hidden animate-scale-in"
                @click.stop>
                <!-- 头部 -->
                <div class="bg-gradient-to-br from-green-500 to-emerald-500 p-5 text-white text-center">
                    <h3 class="text-base font-bold mb-1">选择好友</h3>
                    <p class="text-xs opacity-80">分享订单：{{ sharingOrder?.items[0]?.title }}</p>
                </div>

                <!-- 好友列表 -->
                <div class="p-4 overflow-y-auto max-h-[60vh]">
                    <!-- 搜索框 -->
                    <div class="relative mb-4">
                        <input v-model="searchFriend" type="text" placeholder="搜索好友..."
                            class="w-full bg-slate-100 rounded-2xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20">
                        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    </div>

                    <!-- 好友列表 -->
                    <div class="space-y-2">
                        <div v-for="friend in filteredFriends" :key="friend.id" @click="selectFriend(friend)"
                            class="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors">
                            <img :src="friend.avatar" class="w-12 h-12 rounded-2xl object-cover">
                            <div class="flex-1">
                                <h4 class="text-sm font-bold text-slate-800">{{ friend.name }}</h4>
                                <p class="text-xs text-slate-400 mt-0.5">{{ friend.nickname || '点击分享订单' }}</p>
                            </div>
                            <div
                                class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm">
                                →
                            </div>
                        </div>
                    </div>

                    <div v-if="filteredFriends.length === 0" class="text-center py-12 text-slate-400">
                        <p class="text-4xl mb-2">😕</p>
                        <p class="text-xs">没有找到好友</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 代付好友选择器弹窗 -->
        <div v-if="showPaymentSelector"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click="showPaymentSelector = false">
            <div class="bg-white w-full max-w-sm mx-4 rounded-3xl max-h-[80vh] overflow-hidden animate-scale-in"
                @click.stop>
                <!-- 头部 -->
                <div class="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white text-center">
                    <h3 class="text-base font-bold mb-1">选择代付人</h3>
                    <p class="text-xs opacity-80">请好友帮忙支付 ¥{{ payingOrder?.total }}</p>
                    <p class="text-[10px] mt-1 opacity-60">{{ payingOrder?.items?.[0]?.title }}</p>
                </div>

                <!-- 好友列表 -->
                <div class="p-4 overflow-y-auto max-h-[55vh]">
                    <input v-model="searchPaymentFriend" type="text" placeholder="搜索好友..."
                        class="w-full bg-slate-100 rounded-2xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-4">
                    <span class="absolute left-3.5 top-[calc(50%+80px)] text-slate-400 text-sm">🔍</span>

                    <div class="space-y-2">
                        <div v-for="friend in filteredPaymentFriends" :key="friend.id" @click="sendPaymentRequest(friend)"
                            class="flex items-center gap-3 p-3 rounded-2xl hover:bg-blue-50 active:bg-blue-100 cursor-pointer transition-colors">
                            <img :src="friend.avatar" class="w-12 h-12 rounded-2xl object-cover">
                            <div class="flex-1 min-w-0">
                                <h4 class="text-sm font-bold text-slate-800">{{ friend.name }}</h4>
                                <p class="text-xs text-blue-500 mt-0.5">请求代付 ¥{{ payingOrder?.total }}</p>
                            </div>
                            <span class="text-blue-500 text-lg">💳</span>
                        </div>
                    </div>

                    <div v-if="filteredPaymentFriends.length === 0" class="text-center py-12 text-slate-400">
                        <p class="text-4xl mb-2">🤷</p>
                        <p class="text-xs">没有找到好友</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useShoppingStore } from '@/stores/shoppingStore'
import { useChatStore } from '@/stores/chatStore'

const store = useShoppingStore()
const chatStore = useChatStore()

const props = defineProps({
    orders: Array,
    logistics: Array
})

defineEmits(['pay', 'confirm', 'track'])

const activeTab = ref('all')

// 商品详情相关
const selectedProduct = ref(null)

// 分享相关
const showShareCard = ref(false)
const showFriendSelector = ref(false)
const sharingOrder = ref(null)
const searchFriend = ref('')

// 代付相关
const showPaymentSelector = ref(false)
const payingOrder = ref(null)
const searchPaymentFriend = ref('')

// 从微信 store 获取好友列表
const allFriends = computed(() => {
    // 获取所有好友（从微信通讯录，排除群聊）
    return chatStore.contactList?.filter(c => !c.isGroup) || []
})

const filteredFriends = computed(() => {
    if (!searchFriend.value) return allFriends.value
    return allFriends.value.filter(f =>
        f.name.toLowerCase().includes(searchFriend.value.toLowerCase()) ||
        (f.remark && f.remark.toLowerCase().includes(searchFriend.value.toLowerCase()))
    )
})

// 代付好友列表（排除自己）
const filteredPaymentFriends = computed(() => {
    const list = allFriends.value.filter(f => f.id !== chatStore.currentChatId)
    if (!searchPaymentFriend.value) return list
    return list.filter(f =>
        f.name.toLowerCase().includes(searchPaymentFriend.value.toLowerCase()) ||
        (f.remark && f.remark.toLowerCase().includes(searchPaymentFriend.value.toLowerCase()))
    )
})

const shareOrder = (order) => {
    sharingOrder.value = order
    showShareCard.value = true
}

const selectFriend = async (friend) => {
    // 创建订单卡片消息（用户视角发送）
    const orderCard = {
        role: 'user',
        type: 'order_share',
        content: `[订单分享] ${sharingOrder.value.items[0]?.title || '商品'} ¥${sharingOrder.value.total}`,
        orderId: sharingOrder.value.id,
        orderData: JSON.parse(JSON.stringify(sharingOrder.value)),
        timestamp: Date.now()
    }

    try {
        const result = await chatStore.addMessage(friend.id, orderCard)
        if (result === false) {
            // fallback：尝试通过 name 查找
            const targetChat = Object.values(chatStore.chats).find(
                c => c.name === friend.name || c.remark === friend.name || c.displayName === friend.name
            )
            if (targetChat) {
                await chatStore.addMessage(targetChat.id, orderCard)
            }
        }

        // 显示成功提示
        const toast = document.createElement('div')
        toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-600 text-white px-6 py-4 rounded-2xl text-sm font-bold z-[200] shadow-xl'
        toast.textContent = `✅ 已分享给 ${friend.name}`
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 2000)
    } catch (error) {
        console.error('[OrdersView] 分享订单失败:', error)
        const toast = document.createElement('div')
        toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white px-6 py-4 rounded-2xl text-sm font-bold z-[200]'
        toast.textContent = '❌ 分享失败，请重试'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 2000)
    }

    showFriendSelector.value = false
    showShareCard.value = false
}

// 代付：打开选择器
const requestPayment = (order) => {
    payingOrder.value = order
    showPaymentSelector.value = true
}

// 代付：发送请求给好友
const sendPaymentRequest = async (friend) => {
    if (!payingOrder.value || !friend.id) return

    // 创建代付记录
    const paymentReq = store.requestPaymentForOrder(payingOrder.value.id, friend.id)
    if (!paymentReq) {
        alert('创建代付请求失败')
        return
    }

    // 创建代付卡片消息发送给好友
    const paymentCard = {
        role: 'user',
        type: 'payment_request',
        content: `[代付请求] ${payingOrder.value.items[0]?.title} ¥${payingOrder.value.total}`,
        paymentRequestId: paymentReq.id,
        orderId: payingOrder.value.id,
        amount: payingOrder.value.total,
        items: payingOrder.value.items.map(i => ({ title: i.title, price: i.price, quantity: i.quantity, image: i.image })),
        timestamp: Date.now(),
        status: null  // null = 等待对方处理 | true = 已接受 | false = 已拒绝
    }

    try {
        const result = await chatStore.addMessage(friend.id, paymentCard)
        if (result === false) {
            const targetChat = Object.values(chatStore.chats).find(
                c => c.name === friend.name || c.remark === friend.name
            )
            if (targetChat) await chatStore.addMessage(targetChat.id, paymentCard)
        }

        const toast = document.createElement('div')
        toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-4 rounded-2xl text-sm font-bold z-[200]'
        toast.textContent = `💳 已向 ${friend.name} 发送代付请求`
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 2000)
    } catch(e) {
        console.error('[OrdersView] sendPaymentRequest failed:', e)
    }

    showPaymentSelector.value = false
    payingOrder.value = null
}

// 显示商品详情
const showProductDetail = (item) => {
    // 尝试从 products 中找到完整商品信息
    const product = store.products.find(p => p.id === item.id) || item
    selectedProduct.value = product
}

// 从订单加入购物车
const addToCartFromOrder = (product) => {
    store.addToCart(product, 1)
    showMessage('已加入购物车')
    selectedProduct.value = null
}

// 立即购买
const buyNow = (product) => {
    store.addToCart(product, 1)
    selectedProduct.value = null
    setTimeout(() => {
        // 切换到购物车视图（通过父组件）
        // 这里需要父组件配合，暂时只加入购物车
        showMessage('已加入购物车，可前往结算')
    }, 300)
}

// 显示提示消息
const showMessage = (msg) => {
    // 简单的 toast 实现
    const toast = document.createElement('div')
    toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-4 rounded-2xl text-sm font-bold z-[200] animate-scale-in'
    toast.textContent = msg
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
}

const tabs = [
    { id: 'all', label: '全部' },
    { id: 'pending', label: '待付款' },
    { id: 'paid', label: '待发货' },
    { id: 'shipped', label: '待收货' },
    { id: 'completed', label: '已完成' }
]

const filteredOrders = computed(() => {
    if (activeTab.value === 'all') return props.orders
    if (activeTab.value === 'shipped') {
        return props.orders.filter(o => ['shipped', 'shipping', 'delivering', 'delivered'].includes(o.status))
    }
    return props.orders.filter(o => o.status === activeTab.value)
})

const getStatusText = (status) => {
    const map = {
        pending: '待付款',
        paid: '待发货',
        shipped: '运输中',
        shipping: '极速配送',
        delivering: '派送中',
        delivered: '待签收',
        completed: '已完成',
        cancelled: '已取消'
    }
    return map[status] || status
}

const getStatusColor = (status) => {
    const map = {
        pending: 'text-orange-500',
        paid: 'text-blue-500',
        shipped: 'text-purple-500',
        shipping: 'text-red-500 font-bold',
        delivering: 'text-green-500',
        delivered: 'text-orange-500 font-bold',
        completed: 'text-gray-500'
    }
    return map[status] || 'text-gray-500'
}

const formatDate = (date) => {
    return new Date(date).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}
</script>
