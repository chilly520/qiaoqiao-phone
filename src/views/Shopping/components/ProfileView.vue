<template>
    <div class="profile-view bg-gray-50 min-h-screen pb-20">
        <!-- 头部导航 -->
        <div class="bg-gradient-to-b from-orange-500 to-orange-400 p-6 pt-12 text-white">
            <div class="flex items-center gap-4 mb-6">
                <div class="relative">
                    <img :src="user.avatar"
                        class="w-20 h-20 rounded-full border-4 border-white/20 shadow-xl object-cover">
                    <div
                        class="absolute -bottom-1 -right-1 bg-yellow-400 w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 border-white">
                        💎</div>
                </div>
                <div class="flex-1">
                    <h2 class="text-2xl font-black tracking-tight">{{ user.name }}</h2>
                    <div class="flex gap-2 mt-2">
                        <span class="text-[10px] px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full font-bold">VIP
                            8</span>
                        <span
                            class="text-[10px] px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full font-bold">实名认证</span>
                    </div>
                </div>
                <button
                    class="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-lg">⚙️</button>
            </div>

            <!-- 数据概览 -->
            <div class="grid grid-cols-4 gap-2 text-center py-2">
                <div @click="activeSubView = 'favorites'" class="cursor-pointer active:scale-95 transition-transform">
                    <p class="text-lg font-black">{{ store.favorites.length }}</p>
                    <p class="text-[10px] opacity-80">收藏夹</p>
                </div>
                <div @click="activeSubView = 'shops'" class="cursor-pointer active:scale-95 transition-transform">
                    <p class="text-lg font-black">12</p>
                    <p class="text-[10px] opacity-80">订阅店铺</p>
                </div>
                <div @click="activeSubView = 'footprints'" class="cursor-pointer active:scale-95 transition-transform">
                    <p class="text-lg font-black">{{ store.footprints.length }}</p>
                    <p class="text-[10px] opacity-80">足迹</p>
                </div>
                <div @click="activeSubView = 'points'" class="cursor-pointer active:scale-95 transition-transform">
                    <p class="text-lg font-black">{{ store.points }}</p>
                    <p class="text-[10px] opacity-80">积分</p>
                </div>
            </div>
        </div>

        <!-- 悬浮资产卡片 -->
        <div class="px-4 -mt-6 relative z-10">
            <div
                class="bg-white rounded-3xl p-5 shadow-xl shadow-orange-900/5 flex items-center justify-between border border-orange-50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center text-xl">🧧</div>
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">红包/优惠券</p>
                        <p class="text-sm font-black text-orange-600">￥/{{ store.coupons.length }}张可用</p>
                    </div>
                </div>
                <div class="w-px h-8 bg-gray-100 mx-2"></div>
                <div class="flex-1 flex items-center gap-3 pl-2">
                    <div class="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-xl">💳</div>
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">微信零钱</p>
                        <p class="text-sm font-black text-red-600">￥{{ user.balance.toFixed(2) }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 订单状态 -->
        <div class="p-4 mt-2">
            <div class="bg-white rounded-3xl p-5 shadow-sm">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="font-black text-sm text-gray-800">我的订单</h3>
                    <span @click="store.switchView('orders')"
                        class="text-[10px] text-gray-400 font-medium cursor-pointer">查看全部订单 ›</span>
                </div>
                <div class="flex justify-between items-center px-2">
                    <div v-for="status in orderStatuses" :key="status.label" @click="store.switchView('orders')"
                        class="text-center cursor-pointer active:scale-90 transition-transform">
                        <div class="text-2xl mb-1 relative">
                            {{ status.icon }}
                            <span v-if="status.count > 0"
                                class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center border-2 border-white">
                                {{ status.count }}
                            </span>
                        </div>
                        <p class="text-[10px] font-bold text-gray-600">{{ status.label }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 功能列表 -->
        <div class="px-4 space-y-3">
            <div class="bg-white rounded-3xl p-5 shadow-sm space-y-6">
                <div v-for="item in menuItems" :key="item.label" @click="handleMenuClick(item)"
                    class="flex items-center gap-4 cursor-pointer active:scale-95 transition-all">
                    <span class="text-xl w-8">{{ item.icon }}</span>
                    <span class="text-sm font-bold flex-1 text-gray-700">{{ item.label }}</span>
                    <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-300 font-mono">{{ item.note }}</span>
                        <span class="text-gray-200">›</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 动态面板 (全屏详情) -->
        <div v-if="activeSubView" class="fixed inset-0 z-[60] bg-white animate-slide-in-right">
            <div class="p-6 border-b flex items-center gap-4 pt-12">
                <button @click="activeSubView = null"
                    class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-2xl text-gray-400">‹</button>
                <h3 class="font-black text-xl">{{ subViewTitle }}</h3>
            </div>

            <div class="p-4 overflow-y-auto h-[calc(100vh-100px)]">
                <!-- 收藏夹/足迹渲染 -->
                <div v-if="activeSubView === 'favorites' || activeSubView === 'footprints'"
                    class="grid grid-cols-2 gap-3 pb-20">
                    <div v-for="prodId in subViewList" :key="prodId" class="bg-gray-50 rounded-3xl p-3 relative group">
                        <img :src="getProduct(prodId)?.image"
                            class="w-full aspect-square rounded-2xl object-cover mb-2">
                        <p class="text-[10px] font-black line-clamp-2 leading-tight h-8">{{ getProduct(prodId)?.title }}
                        </p>
                        <p class="text-sm text-red-500 font-black mt-1">¥{{ getProduct(prodId)?.price }}</p>
                        <button v-if="activeSubView === 'favorites'" @click.stop="store.removeFavorite(prodId)"
                            class="absolute top-4 right-4 bg-white/80 backdrop-blur w-6 h-6 rounded-full shadow-sm flex items-center justify-center text-[10px]">✕</button>
                    </div>
                </div>

                <!-- 优惠券渲染 -->
                <div v-else-if="activeSubView === 'coupons'" class="space-y-3">
                    <div v-for="coupon in store.coupons" :key="coupon.id"
                        class="bg-orange-50 border border-orange-100 p-4 rounded-3xl flex items-center gap-4">
                        <div class="text-orange-500 font-black text-xl">¥{{ coupon.amount }}</div>
                        <div class="flex-1">
                            <p class="text-xs font-bold">满{{ coupon.minAmount }}使用</p>
                            <p class="text-[8px] text-orange-300">有效期至 2026-12-31</p>
                        </div>
                        <button
                            class="text-[10px] bg-orange-500 text-white px-3 py-1.5 rounded-full font-bold">立即去用</button>
                    </div>
                </div>

                <!-- 地址管理 -->
                <div v-else-if="activeSubView === 'address'" class="space-y-3">
                    <div v-for="(addr, idx) in store.addresses" :key="idx"
                        class="bg-white border rounded-3xl p-4 flex gap-3">
                        <div class="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">📍</div>
                        <div class="flex-1">
                            <p class="text-sm font-bold">{{ addr.name }} <span class="text-gray-400 font-normal ml-2">{{
                                addr.phone }}</span></p>
                            <p class="text-[10px] text-gray-500 mt-1">{{ addr.detail }}</p>
                        </div>
                        <button class="text-[10px] text-orange-500">编辑</button>
                    </div>
                    <button
                        class="w-full py-4 bg-orange-500 text-white rounded-3xl font-black mt-4 shadow-lg shadow-orange-500/20">添加新地址</button>
                </div>

                <!-- 积分中心 -->
                <div v-else-if="activeSubView === 'points'" class="flex flex-col items-center">
                    <div
                        class="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">
                        🪙</div>
                    <p class="text-3xl font-black text-gray-800">{{ store.points }}</p>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">当前可用积分</p>

                    <button @click="handleSignIn" :disabled="hasSignedIn"
                        class="mt-8 w-full py-4 rounded-3xl font-black text-white shadow-lg transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
                        :class="hasSignedIn ? 'bg-gray-300' : 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-yellow-500/20'">
                        {{ hasSignedIn ? '今日已签到' : '立即签到 +10 积分' }}
                    </button>

                    <div class="w-full mt-10 space-y-4">
                        <h4 class="font-black text-sm text-gray-800">积分兑换</h4>
                        <div v-for="reward in rewards" :key="reward.title"
                            class="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-transparent hover:border-yellow-200 transition-all">
                            <div class="flex items-center gap-3">
                                <span class="text-2xl">{{ reward.icon }}</span>
                                <div>
                                    <p class="text-sm font-bold">{{ reward.title }}</p>
                                    <p class="text-[10px] text-gray-400">{{ reward.cost }} 积分</p>
                                </div>
                            </div>
                            <button
                                class="text-xs font-bold text-orange-500 px-3 py-1 border border-orange-200 rounded-full">兑换</button>
                        </div>
                    </div>
                </div>

                <!-- 天天领红包 -->
                <div v-else-if="activeSubView === 'hongbao'" class="flex flex-col items-center">
                    <div
                        class="relative w-full aspect-[4/5] bg-gradient-to-b from-red-500 to-rose-600 rounded-[40px] p-8 flex flex-col items-center justify-between shadow-2xl overflow-hidden">
                        <div class="absolute top-0 left-0 w-full h-32 bg-red-600 rounded-b-[100%] scale-x-150"></div>
                        <div class="z-10 text-center">
                            <div
                                class="w-16 h-16 bg-yellow-400 rounded-full border-4 border-red-400/30 flex items-center justify-center text-2xl mx-auto mb-4">
                                🧧</div>
                            <h3 class="text-2xl font-black text-yellow-200">天天领红包</h3>
                            <p class="text-white/80 text-xs mt-2 font-bold uppercase">最高可领 88.88 元</p>
                        </div>

                        <div v-if="!openedHongbao" @click="openHongbao"
                            class="z-10 w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center text-4xl shadow-xl border-4 border-yellow-200 animate-bounce cursor-pointer active:scale-90 transition-transform">
                            開
                        </div>
                        <div v-else class="z-10 text-center animate-scale-in">
                            <p class="text-white/60 text-xs font-bold">恭喜获得</p>
                            <p class="text-5xl font-black text-yellow-300 my-2">¥{{ hbAmount }}</p>
                            <p class="text-white/60 text-[10px]">已存入账户余额</p>
                        </div>

                        <p class="z-10 text-white/40 text-[10px] uppercase font-mono tracking-widest">Lucky Money System
                            v2.0</p>
                    </div>
                </div>

                <!-- 账户与安全 -->
                <div v-else-if="activeSubView === 'security'" class="space-y-4">
                    <div class="bg-blue-50 p-4 rounded-3xl flex items-center gap-4 mb-6">
                        <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                            🔒</div>
                        <div class="flex-1">
                            <h4 class="text-sm font-black text-blue-900">安全等级：极高</h4>
                            <p class="text-[10px] text-blue-700/60 font-medium">您的账户受到全方位保护</p>
                        </div>
                    </div>
                    <div v-for="sec in securitySettings" :key="sec.label"
                        class="bg-white border-b border-gray-50 py-4 flex items-center justify-between">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-gray-800">{{ sec.label }}</span>
                            <span class="text-[10px] text-gray-400">{{ sec.desc }}</span>
                        </div>
                        <div class="w-10 h-5 bg-green-500 rounded-full relative">
                            <div class="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                    </div>
                </div>

                <!-- 服务说明 -->
                <div v-else-if="activeSubView === 'service'" class="space-y-6 pb-20">
                    <div v-for="doc in serviceDocs" :key="doc.title">
                        <h4 class="font-black text-orange-500 text-xs uppercase tracking-widest mb-3">{{ doc.title }}
                        </h4>
                        <div class="bg-gray-50 rounded-3xl p-5 space-y-4">
                            <div v-for="(p, i) in doc.content" :key="i" class="flex gap-3">
                                <span class="text-orange-200 font-mono text-xs">{{ (i + 1).toString().padStart(2, '0')
                                    }}</span>
                                <p class="text-[11px] text-gray-600 leading-relaxed font-medium">{{ p }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 订阅店铺 -->
                <div v-else-if="activeSubView === 'shops'" class="space-y-3">
                    <div v-for="shop in subscribedShops" :key="shop.name"
                        class="bg-white border rounded-3xl p-4 flex items-center gap-4 active:scale-98 transition-transform">
                        <div class="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl">{{
                            shop.icon }}</div>
                        <div class="flex-1">
                            <p class="text-sm font-black">{{ shop.name }}</p>
                            <p class="text-[10px] text-gray-400">{{ shop.fans }} 粉丝 · {{ shop.products }} 件商品</p>
                        </div>
                        <button @click.stop="store.unfollowShop(shop.name)"
                            class="px-4 py-1.5 bg-gray-50 text-[10px] font-bold rounded-full text-gray-400 active:bg-red-50 active:text-red-500 transition-colors">取消关注</button>
                    </div>
                </div>

                <div v-else class="text-center py-20">
                    <p class="text-4xl mb-4">⛏️</p>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">功能迭代中...</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useShoppingStore } from '@/stores/shoppingStore'
import { useWalletStore } from '@/stores/walletStore'

const walletStore = useWalletStore()

const props = defineProps({
    user: Object,
    orders: Array
})

const store = useShoppingStore()
const activeSubView = ref(null)

const orderStatuses = computed(() => [
    { icon: '💳', label: '待付款', count: props.orders.filter(o => o.status === 'pending').length },
    { icon: '📦', label: '待收货', count: props.orders.filter(o => o.status === 'shipping').length },
    { icon: '💬', label: '待评价', count: 0 },
    { icon: '🔁', label: '退换/售后', count: 0 }
])

const menuItems = computed(() => [
    { id: 'address', icon: '🏠', label: '收货地址管理', note: `${store.addresses.length}个常用地址` },
    { id: 'hongbao', icon: '🎁', label: '天天领红包', note: '做任务赢现金' },
    { id: 'security', icon: '🛡️', label: '账户与安全', note: '二级密码已开启' },
    { id: 'chat', icon: '🎧', label: '官方客服小蜜', note: '24小时在线' },
    { id: 'service', icon: '📝', label: '服务说明', note: '' }
])

const handleMenuClick = (item) => {
    if (item.id === 'chat') {
        store.activeShopId = 'platform'
        store.switchView('chat')
    } else if (item.id === 'address') {
        activeSubView.value = 'address'
    } else {
        activeSubView.value = item.id
    }
}

const subViewTitle = computed(() => {
    if (activeSubView.value === 'favorites') return '我的收藏'
    if (activeSubView.value === 'footprints') return '我的足迹'
    if (activeSubView.value === 'points') return '积分中心'
    if (activeSubView.value === 'address') return '地址管理'
    if (activeSubView.value === 'coupons') return '我的优惠券'
    if (activeSubView.value === 'shops') return '关注的店铺'
    return '功能详情'
})

const subViewList = computed(() => {
    if (activeSubView.value === 'favorites') return store.favorites
    if (activeSubView.value === 'footprints') return store.footprints
    return []
})

const getProduct = (id) => store.products.find(p => p.id === id)

// --- 功能实现细节 ---
const hasSignedIn = ref(false)
const rewards = [
    { icon: '🎫', title: '5元无门槛券', cost: 500 },
    { icon: '🎁', title: '定制周边挂件', cost: 2000 },
    { icon: '⚡', title: '优先发货特权', cost: 1000 }
]
const handleSignIn = () => {
    store.points += 10
    hasSignedIn.value = true
    store.saveStore()
}

const openedHongbao = ref(false)
const hbAmount = ref('0.00')
const openHongbao = () => {
    const amount = (Math.random() * 5 + 1).toFixed(2)
    hbAmount.value = amount
    openedHongbao.value = true
    walletStore.increaseBalance(Number(amount), '天天领红包')
}

const securitySettings = [
    { label: '登录密码', desc: '已设置，安全性高' },
    { label: '支付密码', desc: '已开启指纹/面容支付' },
    { label: '账号保护', desc: '当前处于安全环境中' },
    { label: '安全邮箱', desc: 'qiaqiao@example.com' }
]

const serviceDocs = [
    { title: '正品保障', content: ['全场商品均为官方直供', '支持 15 天无理由退换货', '每件商品均投保正品险'] },
    { title: '极速物流', content: ['顺丰全国联运，核心城市次日达', '包裹全程 GPS 实时定位', '私密包装，安全稳妥'] },
    { title: '争议处理', content: ['提供 24 小时极速仲裁服务', '退款处理时间不超过 4 小时', '人工客服 0 秒接入'] }
]

const subscribedShops = computed(() => store.subscribedShops)
</script>

<style scoped>
@keyframes slide-in-right {
    from {
        transform: translateX(100%);
    }

    to {
        transform: translateX(0);
    }
}

.animate-slide-in-right {
    animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
