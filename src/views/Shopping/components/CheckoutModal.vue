<template>
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="$emit('close')">
        <div
            class="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div class="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 class="font-bold">确认订单</h3>
                <button @click="$emit('close')" class="text-gray-400">✕</button>
            </div>

            <!-- 地址选择 -->
            <div class="p-4 border-b">
                <h4 class="text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">收货地址</h4>
                <div v-for="addr in store.addresses" :key="addr.id" @click="selectedAddressId = addr.id"
                    :class="['p-4 rounded-2xl border-2 transition-all cursor-pointer mb-2',
                        selectedAddressId === addr.id ? 'border-orange-500 bg-orange-50' : 'border-gray-50 bg-gray-50']">
                    <div class="flex items-start gap-3">
                        <span class="text-xl">📍</span>
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-bold">{{ addr.name }}</span>
                                <span class="text-sm text-gray-500">{{ addr.phone }}</span>
                                <span v-if="addr.isDefault"
                                    class="text-[10px] px-1 bg-orange-500 text-white rounded">默认</span>
                            </div>
                            <p class="text-xs text-gray-600 leading-snug">{{ addr.region }} {{ addr.detail }}</p>
                        </div>
                        <div v-if="selectedAddressId === addr.id" class="text-orange-500 font-bold">✓</div>
                    </div>
                </div>
                <button @click="showAddAddress = true"
                    class="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-orange-200 hover:text-orange-300 transition-colors mt-2">
                    + 添加新地址
                </button>
            </div>

            <!-- 商品列表 -->
            <div class="p-4 border-b">
                <h4 class="text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">订单商品</h4>
                <div v-for="item in cart" :key="item.cartId" class="flex gap-4 mb-4 last:mb-0">
                    <div class="relative">
                        <img :src="item.image" class="w-20 h-20 rounded-xl object-cover bg-gray-100 shadow-sm">
                    </div>
                    <div class="flex-1 flex flex-col justify-between py-1">
                        <div>
                            <h4 class="text-sm font-bold line-clamp-1 text-gray-800">{{ item.title }}</h4>
                            <p class="text-[10px] text-gray-400 mt-1 inline-block bg-gray-100 px-1.5 py-0.5 rounded"
                                v-if="item.specs.version">
                                {{ item.specs.version }}
                            </p>
                        </div>
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-bold text-orange-600 font-mono">¥{{ item.price }}</p>
                            <p class="text-xs text-gray-400">x{{ item.quantity }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 配送与备注 -->
            <div class="p-4 space-y-4">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500">配送方式</span>
                    <span class="font-medium text-gray-800">普通配送 (免运费)</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-500">运费险</span>
                    <span class="text-orange-500 font-medium">商家赠送</span>
                </div>
                <div class="pt-2">
                    <textarea v-model="remark" placeholder="如果你对订单有特殊要求，请在这里留言..."
                        class="w-full text-xs p-4 bg-gray-50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300"
                        rows="2"></textarea>
                </div>
            </div>

            <!-- 优惠券选择 -->
            <div class="p-4 border-b">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-xs text-gray-400 uppercase tracking-wider font-bold">优惠券</h4>
                    <span class="text-[10px] text-orange-500 font-bold" v-if="applicableCoupons.length">{{
                        applicableCoupons.length }}张可用</span>
                </div>
                <div v-if="applicableCoupons.length" class="space-y-2">
                    <div v-for="cp in applicableCoupons" :key="cp.id"
                        @click="selectedCouponId = (selectedCouponId === cp.id ? null : cp.id)"
                        :class="['p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer',
                            selectedCouponId === cp.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-white']">
                        <div class="flex items-center gap-3">
                            <span class="text-lg font-black text-orange-500">¥{{ cp.amount }}</span>
                            <div class="text-[10px]">
                                <p class="font-bold">{{ cp.title }}</p>
                                <p class="text-gray-400">满{{ cp.minAmount }}使用</p>
                            </div>
                        </div>
                        <div v-if="selectedCouponId === cp.id"
                            class="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[10px] text-white">
                            ✓</div>
                    </div>
                </div>
                <div v-else class="text-[10px] text-gray-300 italic">暂无可用优惠券</div>
            </div>

            <!-- 支付方式 -->
            <div class="p-4 border-b">
                <h4 class="text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">支付方式</h4>
                <div class="grid grid-cols-1 gap-2">
                    <div v-for="method in paymentMethods" :key="method.id" @click="selectedPaymentMethod = method.id"
                        :class="['p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer',
                            selectedPaymentMethod === method.id ? 'border-blue-500 bg-blue-50' : 'border-gray-50 bg-gray-50']">
                        <span class="text-xl">{{ method.icon }}</span>
                        <div class="flex-1">
                            <p class="text-[10px] font-bold">{{ method.name }}</p>
                            <p class="text-[8px] text-gray-500">{{ method.desc }}</p>
                        </div>
                        <div v-if="selectedPaymentMethod === method.id" class="text-blue-500 text-xs">●</div>
                    </div>
                </div>
            </div>

            <!-- 底部支付栏 -->
            <div class="p-6 pt-2 sticky bottom-0 bg-white border-t">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">应付金额</p>
                            <span v-if="discountAmount > 0" class="text-[8px] bg-red-100 text-red-500 px-1 rounded">已减 ¥{{
                                discountAmount }}</span>
                        </div>
                        <p class="text-2xl font-black text-red-600">¥{{ finalTotal.toFixed(2) }}</p>
                    </div>
                </div>
                <!-- 按钮组：代付 + 立即支付 -->
                <div class="flex items-center gap-3">
                    <button @click="requestPaymentHelp"
                        class="flex-1 py-4 rounded-full font-bold text-sm border-2 border-indigo-300 text-indigo-500 bg-white active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm hover:bg-indigo-50">
                        💳 找人代付
                    </button>
                    <button @click="submitOrder" :disabled="!canPay" :class="['flex-[2] py-4 rounded-full font-black text-sm shadow-xl transition-all active:scale-95',
                        !canPay
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-orange-500/30']">
                        {{ canPay ? '立即支付' : '无法支付' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 添加地址小弹窗 (简单模拟) -->
        <div v-if="showAddAddress"
            class="absolute inset-x-4 top-1/4 bg-white rounded-3xl p-6 shadow-2xl animate-fade-in border z-[60]">
            <h4 class="font-black mb-4">新增收货地址</h4>
            <input v-model="newAddr.name" placeholder="收货人姓名" class="w-full bg-gray-50 p-3 rounded-xl mb-2 text-sm">
            <input v-model="newAddr.phone" placeholder="手机号码" class="w-full bg-gray-50 p-3 rounded-xl mb-2 text-sm">
            <input v-model="newAddr.detail" placeholder="详细地址" class="w-full bg-gray-50 p-3 rounded-xl mb-4 text-sm">
            <div class="flex gap-2">
                <button @click="showAddAddress = false"
                    class="flex-1 py-3 bg-gray-100 rounded-xl text-sm font-bold">取消</button>
                <button @click="saveAddress"
                    class="flex-1 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold">保存地址</button>
            </div>
        </div>

        <!-- 代付好友选择器 -->
        <div v-if="showPaymentSelector"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click="showPaymentSelector = false">
            <div class="bg-white w-full max-w-sm mx-4 rounded-3xl max-h-[80vh] overflow-hidden animate-scale-in"
                @click.stop>
                <!-- 头部 -->
                <div class="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white text-center">
                    <h3 class="text-base font-bold mb-1">选择代付好友</h3>
                    <p class="text-xs opacity-80">{{ props.cart[0]?.title }} · ¥{{ finalTotal.toFixed(2) }}</p>
                </div>

                <!-- 好友列表 -->
                <div class="p-4 overflow-y-auto max-h-[60vh]">
                    <!-- 搜索框 -->
                    <div class="relative mb-4">
                        <input v-model="searchPaymentFriend" type="text" placeholder="搜索好友..."
                            class="w-full bg-slate-100 rounded-2xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    </div>

                    <div class="space-y-2">
                        <div v-for="friend in filteredPaymentFriends" :key="friend.id"
                            @click="sendPaymentRequestToFriend(friend)"
                            class="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors">
                            <img :src="friend.avatar" class="w-12 h-12 rounded-2xl object-cover bg-gray-100">
                            <div class="flex-1 min-w-0">
                                <h4 class="text-sm font-bold text-slate-800 truncate">{{ friend.remark || friend.name }}</h4>
                                <p class="text-xs text-slate-400 mt-0.5">点击发送代付请求</p>
                            </div>
                            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm shrink-0">
                                →
                            </div>
                        </div>
                    </div>

                    <div v-if="filteredPaymentFriends.length === 0" class="text-center py-12 text-slate-400">
                        <p class="text-4xl mb-2">😕</p>
                        <p class="text-xs">没有找到好友</p>
                    </div>
                </div>

                <!-- 取消按钮 -->
                <div class="p-4 border-t">
                    <button @click="showPaymentSelector = false"
                        class="w-full py-3 bg-gray-100 rounded-2xl text-sm font-bold text-gray-600 active:bg-gray-200 transition-colors">
                        取消
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useShoppingStore } from '@/stores/shoppingStore'
import { useWalletStore } from '@/stores/walletStore'
import { useChatStore } from '@/stores/chatStore'

const props = defineProps({
    cart: Array,
    total: Number
})

const emit = defineEmits(['close', 'submit'])
const store = useShoppingStore()
const walletStore = useWalletStore()
const chatStore = useChatStore()

const remark = ref('')
const selectedAddressId = ref(store.addresses[0]?.id || '')
const showAddAddress = ref(false)
const selectedCouponId = ref(null)
const selectedPaymentMethod = ref('balance')

// 代付相关
const showPaymentSelector = ref(false)
const searchPaymentFriend = ref('')

const newAddr = ref({ name: '', phone: '', detail: '', region: '广东省 深圳市' })

const applicableCoupons = computed(() => {
    return store.coupons.filter(c => c.status === 'active' && props.total >= c.minAmount)
})

const discountAmount = computed(() => {
    if (!selectedCouponId.value) return 0
    const coupon = store.coupons.find(c => c.id === selectedCouponId.value)
    return coupon ? coupon.amount : 0
})

const finalTotal = computed(() => Math.max(0, props.total - discountAmount.value))

const paymentMethods = computed(() => {
    const list = [
        { id: 'balance', name: '零钱支付', icon: '💰', desc: `余额: ¥${walletStore.balance.toFixed(2)}` }
    ]
    walletStore.bankCards.forEach(card => {
        list.push({ id: 'bank', name: `${card.bankName}(${card.number.slice(-4)})`, icon: '💳', desc: `可用余额: ¥${card.balance}` })
    })
    walletStore.familyCards.forEach(card => {
        list.push({ id: 'family', name: card.remark, icon: '💝', desc: `剩余额度: ¥${(card.amount - card.usedAmount).toFixed(2)}` })
    })
    return list
})

const canPay = computed(() => {
    const method = paymentMethods.value.find(m => m.id === selectedPaymentMethod.value)
    if (!method) return false
    // 简化检查：根据 ID 类型检查对应额度
    if (selectedPaymentMethod.value === 'balance') return walletStore.balance >= finalTotal.value
    // 为了体验这里的 bank/family 暂不锁定，如果选了且不足 createOrder 会拦住
    return true
})

const saveAddress = () => {
    if (!newAddr.value.name || !newAddr.value.phone) return
    const id = 'addr_' + Date.now()
    store.addresses.push({ id, ...newAddr.value, isDefault: false })
    selectedAddressId.value = id
    showAddAddress.value = false
    store.saveStore()
}

const submitOrder = () => {
    const address = store.addresses.find(a => a.id === selectedAddressId.value)
    if (!address) return alert('请选择收货地址')

    emit('submit', {
        address,
        remark: remark.value,
        couponId: selectedCouponId.value,
        paymentMethod: selectedPaymentMethod.value
    })
}

// ============ 代付功能（确认订单页）============

const allFriends = computed(() => {
    return chatStore.contactList?.filter(c => !c.isGroup) || []
})

const filteredPaymentFriends = computed(() => {
    const list = allFriends.value.filter(f => f.id !== chatStore.currentChatId)
    if (!searchPaymentFriend.value) return list
    return list.filter(f =>
        (f.name && f.name.toLowerCase().includes(searchPaymentFriend.value.toLowerCase())) ||
        (f.remark && f.remark.toLowerCase().includes(searchPaymentFriend.value.toLowerCase()))
    )
})

const requestPaymentHelp = () => {
    showPaymentSelector.value = true
}

const sendPaymentRequestToFriend = async (friend) => {
    // 构建临时订单数据（还没创建订单，用购物车数据）
    const tempOrderData = {
        items: props.cart.map(i => ({ title: i.title, price: i.price, quantity: i.quantity, image: i.image })),
        total: finalTotal.value,
        id: 'pending_' + Date.now()
    }

    // 创建代付卡片消息
    const paymentCard = {
        role: 'user',
        type: 'payment_request',
        content: `[代付请求] ${props.cart[0]?.title || '商品'} ¥${finalTotal.value.toFixed(2)}`,
        orderId: null, // 订单尚未创建，支付后由对方确认
        amount: finalTotal.value,
        items: tempOrderData.items,
        timestamp: Date.now(),
        status: null,          // null = 等待对方处理
        isPrePay: true,        // 标记为预支付请求
        paymentRequestId: tempOrderData.id  // 关联 paymentRequest 记录
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
        toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-4 rounded-2xl text-sm font-bold z-[200] shadow-xl'
        toast.textContent = `💳 已向 ${friend.name || friend.remark} 发送代付请求`
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 2000)

        showPaymentSelector.value = false
        emit('close') // 关闭弹窗，回到购物车
    } catch(e) {
        console.error('[CheckoutModal] sendPaymentRequest failed:', e)
        const toast = document.createElement('div')
        toast.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white px-6 py-4 rounded-2xl text-sm font-bold z-[200]'
        toast.textContent = '❌ 发送失败，请重试'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 2000)
    }
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
    animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fade-in {
    from {
        opacity: 0;
        transform: scale(0.9);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

.animate-fade-in {
    animation: fade-in 0.2s ease-out;
}

@keyframes scale-in {
    from {
        opacity: 0;
        transform: scale(0.9);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.animate-scale-in {
    animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
