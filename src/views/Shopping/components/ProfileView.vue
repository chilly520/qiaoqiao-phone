<template>
    <div class="profile-view bg-slate-50 min-h-screen pb-40">
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
                <button @click="showSettings = true"
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
                class="bg-white rounded-3xl p-5 shadow-xl shadow-orange-900/5 flex items-center justify-between border border-slate-100">
                <div class="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform"
                    @click="activeSubView = 'coupons'">
                    <div class="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center text-xl">🧧</div>
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">红包/优惠券</p>
                        <p class="text-sm font-black text-orange-600">￥/{{ store.coupons.length }}张可用</p>
                    </div>
                </div>
                <div class="w-px h-8 bg-gray-100 mx-2"></div>
                <div class="flex-1 flex items-center gap-3 pl-2 cursor-pointer active:scale-95 transition-transform"
                    @click="activeSubView = 'balance'">
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

            <div class="p-4 overflow-y-auto h-[calc(100vh-100px)] pb-28">
                <!-- 收藏夹/足迹渲染 -->
                <div v-if="activeSubView === 'favorites' || activeSubView === 'footprints'"
                    class="grid grid-cols-2 gap-3">
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
                    <div v-for="(addr, idx) in store.addresses" :key="addr.id"
                        class="bg-white border rounded-3xl p-4 relative">
                        <div class="flex gap-3">
                            <div class="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center shrink-0">📍</div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <p class="text-sm font-bold">{{ addr.name }}</p>
                                    <span class="text-gray-400 text-xs">{{ addr.phone }}</span>
                                    <span v-if="addr.isDefault" class="text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded">默认</span>
                                </div>
                                <p class="text-[10px] text-gray-500 mt-1">{{ addr.region }} {{ addr.detail }}</p>
                            </div>
                        </div>
                        <div class="flex justify-end gap-3 mt-3 pt-3 border-t border-gray-100">
                            <button @click="setDefaultAddress(addr.id)" 
                                :class="['text-[10px] font-bold', addr.isDefault ? 'text-gray-300' : 'text-gray-500']"
                                :disabled="addr.isDefault">
                                {{ addr.isDefault ? '已默认' : '设为默认' }}
                            </button>
                            <button @click="editAddress(addr)" class="text-[10px] font-bold text-orange-500">编辑</button>
                            <button @click="deleteAddress(addr.id)" class="text-[10px] font-bold text-red-400">删除</button>
                        </div>
                    </div>
                    <button @click="showAddressForm = true"
                        class="w-full py-4 bg-orange-500 text-white rounded-3xl font-black mt-4 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
                        + 添加新地址
                    </button>
                </div>

                <!-- 余额/零钱 -->
                <div v-else-if="activeSubView === 'balance'" class="flex flex-col items-center">
                    <div class="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">
                        💰</div>
                    <p class="text-3xl font-black text-gray-800">￥{{ user.balance.toFixed(2) }}</p>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">微信零钱</p>

                    <div class="w-full mt-8 grid grid-cols-2 gap-3">
                        <button class="py-3 bg-green-500 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">
                            充值
                        </button>
                        <button class="py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">
                            提现
                        </button>
                    </div>

                    <div class="w-full mt-8">
                        <h4 class="font-black text-sm text-gray-800 mb-3">交易记录</h4>
                        <div class="space-y-2">
                            <div v-for="record in balanceRecords" :key="record.id"
                                class="bg-gray-50 p-3 rounded-xl flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-bold">{{ record.title }}</p>
                                    <p class="text-[10px] text-gray-400">{{ record.time }}</p>
                                </div>
                                <span :class="['font-black', record.amount > 0 ? 'text-green-500' : 'text-red-500']">
                                    {{ record.amount > 0 ? '+' : '' }}{{ record.amount.toFixed(2) }}
                                </span>
                            </div>
                        </div>
                    </div>
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

                    <!-- 周报入口 -->
                    <button @click="showWeeklyReport = true"
                        class="mt-4 w-full py-3 rounded-2xl font-bold text-orange-500 bg-orange-50 border border-orange-200 transition-all active:scale-95">
                        📊 查看我的周报
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
                            <button @click="handleExchange(reward)"
                                :disabled="store.points < reward.cost"
                                :class="[
                                    'text-xs font-bold px-4 py-2 rounded-full transition-all',
                                    store.points >= reward.cost 
                                        ? 'bg-orange-500 text-white active:scale-95' 
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                ]">
                                {{ store.points >= reward.cost ? '兑换' : '积分不足' }}
                            </button>
                        </div>
                    </div>

                    <!-- 兑换记录 -->
                    <div v-if="store.exchangeHistory?.length" class="w-full mt-8">
                        <h4 class="font-black text-sm text-gray-800 mb-3">兑换记录</h4>
                        <div class="space-y-2">
                            <div v-for="record in store.exchangeHistory.slice(0, 5)" :key="record.id"
                                class="bg-gray-50 p-3 rounded-xl flex items-center justify-between text-xs">
                                <div class="flex items-center gap-2">
                                    <span class="text-orange-400">🎁</span>
                                    <span class="font-medium">{{ record.reward }}</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="text-gray-400">-{{ record.cost }}积分</span>
                                    <span class="text-gray-300">{{ new Date(record.time).toLocaleDateString() }}</span>
                                </div>
                            </div>
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
                <div v-else-if="activeSubView === 'service'" class="space-y-6">
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

                <!-- 客服中心 -->
                <div v-else-if="activeSubView === 'customerService'" class="space-y-4">
                    <div class="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-2xl mb-4">
                        <p class="text-sm font-bold text-gray-700">选择需要咨询的客服类型</p>
                        <p class="text-[10px] text-gray-500 mt-1">工作时间：09:00 - 22:00</p>
                    </div>
                    
                    <div v-for="cs in customerServiceList" :key="cs.id"
                        @click="enterChat(cs)"
                        class="bg-white border rounded-2xl p-4 flex items-center gap-4 cursor-pointer active:scale-98 transition-transform hover:border-orange-200">
                        <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                            :class="cs.bgColor">
                            {{ cs.icon }}
                        </div>
                        <div class="flex-1">
                            <p class="text-sm font-bold">{{ cs.name }}</p>
                            <p class="text-[10px] text-gray-400">{{ cs.desc }}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span v-if="cs.online" class="text-[8px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full">在线</span>
                            <span class="text-gray-300">›</span>
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

        <!-- 兑换成功弹窗 -->
        <div v-if="showExchangeSuccess" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            @click="showExchangeSuccess = false">
            <div class="bg-white rounded-3xl p-8 mx-6 max-w-sm w-full text-center animate-scale-in"
                @click.stop>
                <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                    ✅
                </div>
                <h3 class="text-xl font-black text-gray-800 mb-2">兑换成功</h3>
                <p class="text-gray-500 text-sm mb-6">
                    {{ exchangedReward?.title }} 已发放到您的账户
                </p>
                <button @click="showExchangeSuccess = false"
                    class="w-full py-3 bg-orange-500 text-white rounded-2xl font-bold active:scale-95 transition-transform">
                    太棒了
                </button>
            </div>
        </div>

        <!-- 周报弹窗 -->
        <div v-if="showWeeklyReport" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            @click="showWeeklyReport = false">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full max-h-[80vh] overflow-hidden animate-slide-up"
                @click.stop>
                <!-- 周报头部 -->
                <div class="bg-gradient-to-br from-orange-400 to-red-500 p-6 text-white text-center">
                    <p class="text-xs opacity-80 mb-1">本周购物报告</p>
                    <h3 class="text-2xl font-black">🎉 精彩一周</h3>
                </div>

                <!-- 周报内容 -->
                <div class="p-5 space-y-5 overflow-y-auto max-h-[50vh]">
                    <!-- 核心数据 -->
                    <div class="grid grid-cols-3 gap-3 text-center">
                        <div class="bg-orange-50 rounded-2xl p-3">
                            <p class="text-2xl font-black text-orange-600">{{ weeklyReportData?.orderCount || 0 }}</p>
                            <p class="text-[10px] text-gray-500">订单数</p>
                        </div>
                        <div class="bg-red-50 rounded-2xl p-3">
                            <p class="text-2xl font-black text-red-600">¥{{ (weeklyReportData?.totalSpent || 0).toFixed(0) }}</p>
                            <p class="text-[10px] text-gray-500">消费额</p>
                        </div>
                        <div class="bg-green-50 rounded-2xl p-3">
                            <p class="text-2xl font-black text-green-600">¥{{ (weeklyReportData?.totalSaved || 0).toFixed(0) }}</p>
                            <p class="text-[10px] text-gray-500">已省下</p>
                        </div>
                    </div>

                    <!-- 购物偏好 -->
                    <div class="bg-gray-50 rounded-2xl p-4">
                        <h4 class="font-bold text-sm text-gray-700 mb-3">📊 购物偏好</h4>
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-500">最爱品类</span>
                                <span class="font-bold">{{ weeklyReportData?.favoriteCategory || '暂无' }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-500">常逛店铺</span>
                                <span class="font-bold truncate max-w-[150px]">{{ weeklyReportData?.topShop || '暂无' }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-500">获得积分</span>
                                <span class="font-bold text-orange-500">+{{ weeklyReportData?.pointsEarned || 0 }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 成就 -->
                    <div v-if="weeklyReportData?.achievements?.length">
                        <h4 class="font-bold text-sm text-gray-700 mb-3">🏆 本周成就</h4>
                        <div class="flex flex-wrap gap-2">
                            <div v-for="ach in weeklyReportData.achievements" :key="ach.title"
                                class="bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1.5 flex items-center gap-1.5">
                                <span>{{ ach.icon }}</span>
                                <span class="text-xs font-bold text-yellow-700">{{ ach.title }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 鼓励语 -->
                    <div class="text-center py-3">
                        <p class="text-gray-400 text-xs">继续加油，下周更精彩！💪</p>
                    </div>
                </div>

                <!-- 关闭按钮 -->
                <div class="p-4 border-t">
                    <button @click="showWeeklyReport = false"
                        class="w-full py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold active:scale-95 transition-transform">
                        关闭
                    </button>
                </div>
            </div>
        </div>

        <!-- 地址表单弹窗 -->
        <div v-if="showAddressForm" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            @click="showAddressForm = false">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full animate-scale-in" @click.stop>
                <div class="p-5 border-b">
                    <h3 class="text-lg font-black">{{ editingAddress ? '编辑地址' : '新增地址' }}</h3>
                </div>
                <div class="p-5 space-y-4">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">收货人</label>
                        <input v-model="addressForm.name" type="text" placeholder="请输入收货人姓名"
                            class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">手机号</label>
                        <input v-model="addressForm.phone" type="tel" placeholder="请输入手机号"
                            class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">所在地区</label>
                        <input v-model="addressForm.region" type="text" placeholder="省 市 区"
                            class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">详细地址</label>
                        <textarea v-model="addressForm.detail" placeholder="街道、楼牌号等"
                            class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none h-20"></textarea>
                    </div>
                    <div class="flex items-center gap-2">
                        <input v-model="addressForm.isDefault" type="checkbox" id="defaultAddr" class="w-4 h-4 accent-orange-500">
                        <label for="defaultAddr" class="text-xs text-gray-600">设为默认地址</label>
                    </div>
                </div>
                <div class="p-5 flex gap-3">
                    <button @click="showAddressForm = false"
                        class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold">
                        取消
                    </button>
                    <button @click="saveAddress"
                        class="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-bold">
                        保存
                    </button>
                </div>
            </div>
        </div>

        <!-- 设置弹窗 -->
        <div v-if="showSettings" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            @click="showSettings = false">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full max-h-[80vh] overflow-hidden animate-scale-in" @click.stop>
                <div class="p-5 border-b">
                    <h3 class="text-lg font-black">设置</h3>
                </div>
                <div class="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
                    <div>
                        <h4 class="text-xs font-bold text-gray-500 mb-3">物流设置</h4>
                        <div class="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                            <div class="flex-1">
                                <p class="text-sm font-bold text-gray-700">使用虚拟城市</p>
                                <p class="text-[10px] text-gray-400 mt-1">
                                    {{ store.useFantasyCities ? '当前使用虚拟城市（如：云梦泽、青鸾城）' : '当前使用真实城市（如：北京、上海）' }}
                                </p>
                            </div>
                            <button @click="toggleCityType"
                                class="w-14 h-8 rounded-full transition-colors relative"
                                :class="store.useFantasyCities ? 'bg-purple-500' : 'bg-gray-300'">
                                <div class="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform"
                                    :class="store.useFantasyCities ? 'left-7' : 'left-1'">
                                </div>
                            </button>
                        </div>
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-gray-500 mb-3">数据清理</h4>
                        <div class="space-y-2">
                            <button @click="showCategoryClearDialog = true"
                                class="w-full py-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-sm active:scale-95 transition-transform text-left px-4">
                                🗑️ 按分类清除商品
                            </button>
                            <button @click="showClearAllProductsConfirm = true"
                                class="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm active:scale-95 transition-transform text-left px-4">
                                🗑️ 清除所有商品
                            </button>
                            <button @click="showClearChatConfirm = true"
                                class="w-full py-3 bg-orange-50 text-orange-600 rounded-xl font-bold text-sm active:scale-95 transition-transform text-left px-4">
                                💬 清除客服聊天记录
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-5 border-t">
                    <button @click="showSettings = false"
                        class="w-full py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold active:scale-95 transition-transform">
                        关闭
                    </button>
                </div>
            </div>
        </div>

        <!-- 分类清除弹窗 -->
        <div v-if="showCategoryClearDialog" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            @click="showCategoryClearDialog = false">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full animate-scale-in" @click.stop>
                <div class="p-5 border-b">
                    <h3 class="text-lg font-black">按分类清除</h3>
                </div>
                <div class="p-5">
                    <p class="text-sm text-gray-600 mb-4">请选择要清除的商品分类：</p>
                    <select v-model="clearCategoryInput"
                        class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 border border-gray-200">
                        <option value="" disabled>请选择分类</option>
                        <option v-for="cat in availableCategories" :key="cat" :value="cat">
                            {{ cat }}
                        </option>
                    </select>
                    <div class="text-xs text-gray-400 mt-3">
                        共有 {{ availableCategories.length }} 个分类
                    </div>
                </div>
                <div class="p-5 flex gap-3">
                    <button @click="showCategoryClearDialog = false"
                        class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold active:scale-95 transition-transform">
                        取消
                    </button>
                    <button @click="clearProductsByCategory"
                        class="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold active:scale-95 transition-transform">
                        清除
                    </button>
                </div>
            </div>
        </div>

        <!-- 清除所有商品确认弹窗 -->
        <div v-if="showClearAllProductsConfirm" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            @click="showClearAllProductsConfirm = false">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full animate-scale-in" @click.stop>
                <div class="p-6 text-center">
                    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                        🗑️
                    </div>
                    <h3 class="text-lg font-black text-gray-800 mb-2">清除所有商品</h3>
                    <p class="text-sm text-gray-500 mb-6">
                        确定要清除所有商品吗？<br>此操作不可恢复！
                    </p>
                    <div class="flex gap-3">
                        <button @click="showClearAllProductsConfirm = false"
                            class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold active:scale-95 transition-transform">
                            取消
                        </button>
                        <button @click="clearAllProducts"
                            class="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold active:scale-95 transition-transform">
                            清除
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 清除聊天记录确认弹窗 -->
        <div v-if="showClearChatConfirm" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            @click="showClearChatConfirm = false">
            <div class="bg-white rounded-3xl mx-4 max-w-sm w-full animate-scale-in" @click.stop>
                <div class="p-6 text-center">
                    <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                        💬
                    </div>
                    <h3 class="text-lg font-black text-gray-800 mb-2">清除聊天记录</h3>
                    <p class="text-sm text-gray-500 mb-6">
                        确定要清除所有客服聊天记录吗？
                    </p>
                    <div class="flex gap-3">
                        <button @click="showClearChatConfirm = false"
                            class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold active:scale-95 transition-transform">
                            取消
                        </button>
                        <button @click="clearChatHistory"
                            class="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-bold active:scale-95 transition-transform">
                            清除
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Toast 提示 -->
        <div v-if="showToast" class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[200]">
            <div class="bg-black/80 backdrop-blur-md text-white px-6 py-4 rounded-2xl text-sm font-bold animate-scale-in">
                {{ toastMessage }}
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
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
        activeSubView.value = 'customerService'
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
    if (activeSubView.value === 'customerService') return '客服中心'
    if (activeSubView.value === 'balance') return '我的零钱'
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
    { icon: '🎫', title: '5元无门槛券', cost: 500, type: 'coupon', amount: 5, minAmount: 0 },
    { icon: '💰', title: '2元现金红包', cost: 200, type: 'balance', amount: 2 },
    { icon: '🎫', title: '10元满减券', cost: 800, type: 'coupon', amount: 10, minAmount: 50 },
    { icon: '🎁', title: '定制周边挂件', cost: 2000, type: 'coupon', amount: 0 },
    { icon: '⚡', title: '优先发货特权', cost: 1000, type: 'coupon', amount: 0 }
]

const handleSignIn = () => {
    store.points += 10
    hasSignedIn.value = true
    store.saveStore()
}

// 兑换功能
const showExchangeSuccess = ref(false)
const exchangedReward = ref(null)
const exchangeError = ref('')

const handleExchange = (reward) => {
    const result = store.exchangeReward(reward)
    if (result.success) {
        exchangedReward.value = reward
        showExchangeSuccess.value = true
        exchangeError.value = ''
    } else {
        exchangeError.value = result.message
        setTimeout(() => { exchangeError.value = '' }, 2000)
    }
}

// 周报功能
const showWeeklyReport = ref(false)
const weeklyReportData = computed(() => store.weeklyReport)

const openWeeklyReport = () => {
    store.generateWeeklyReport()
    showWeeklyReport.value = true
}

// 地址管理功能
const showAddressForm = ref(false)
const editingAddress = ref(null)
const addressForm = ref({
    name: '',
    phone: '',
    region: '',
    detail: '',
    isDefault: false
})

const editAddress = (addr) => {
    editingAddress.value = addr
    addressForm.value = { ...addr }
    showAddressForm.value = true
}

const saveAddress = () => {
    if (!addressForm.value.name || !addressForm.value.phone || !addressForm.value.detail) {
        return
    }

    const addrData = {
        ...addressForm.value,
        id: editingAddress.value?.id || 'addr_' + Date.now()
    }

    if (editingAddress.value) {
        const idx = store.addresses.findIndex(a => a.id === editingAddress.value.id)
        if (idx !== -1) {
            store.addresses[idx] = addrData
        }
    } else {
        store.addresses.push(addrData)
    }

    if (addrData.isDefault) {
        store.addresses.forEach(a => {
            if (a.id !== addrData.id) a.isDefault = false
        })
    }

    showAddressForm.value = false
    editingAddress.value = null
    addressForm.value = { name: '', phone: '', region: '', detail: '', isDefault: false }
    store.saveStore()
}

const deleteAddress = (id) => {
    store.addresses = store.addresses.filter(a => a.id !== id)
    store.saveStore()
}

const setDefaultAddress = (id) => {
    store.addresses.forEach(a => {
        a.isDefault = a.id === id
    })
    store.saveStore()
}

// 余额记录
const balanceRecords = computed(() => {
    const txs = walletStore.transactions || []
    return txs.slice(0, 10).map(t => ({
        id: t.id,
        title: t.title,
        time: t.time || new Date().toLocaleString(),
        amount: t.type === 'income' ? t.amount : -t.amount
    }))
})

// 设置相关
const showSettings = ref(false)
const showCategoryClearDialog = ref(false)
const showClearAllProductsConfirm = ref(false)
const showClearChatConfirm = ref(false)
const clearCategoryInput = ref('')
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref('success') // 'success' | 'error'

// 显示提示
const showMessage = (message, type = 'success') => {
    toastMessage.value = message
    toastType.value = type
    showToast.value = true
    setTimeout(() => {
        showToast.value = false
    }, 2000)
}

// 应用中的分类映射（中文显示名 <-> 实际 category 值）
const categoryMap = {
    '全部': 'all',
    '数码': 'digital',
    '服饰': 'clothing',
    '美食': 'food',
    '家居': 'home',
    '美妆': 'beauty',
    '运动': 'sports',
    '图书': 'books',
    '母婴': 'baby',
    '箱包': 'luggage',
    '钟表': 'watch',
    '珠宝': 'jewelry',
    '家电': 'appliance',
    '汽车': 'auto',
    '医疗': 'medical',
    '虚拟': 'virtual'
}

const reverseCategoryMap = Object.fromEntries(
    Object.entries(categoryMap).map(([cn, en]) => [en, cn])
)

const availableCategories = computed(() => {
    // 获取所有商品的分类，然后映射为中文名称
    const categories = [...new Set(store.products.map(p => p.category))]
    // 反向查找中文名称
    return categories
        .map(cat => reverseCategoryMap[cat] || cat)
        .filter(name => name !== '全部') // 排除"全部"
})

const clearProductsByCategory = () => {
    const chineseName = clearCategoryInput.value
    if (!chineseName) {
        showMessage('请选择分类', 'error')
        return
    }
    const categoryValue = categoryMap[chineseName] || chineseName
    store.products = store.products.filter(p => p.category !== categoryValue)
    store.saveStore()
    showCategoryClearDialog.value = false
    clearCategoryInput.value = ''
    showMessage(`已清除分类 "${chineseName}" 的所有商品`)
}

const clearAllProducts = () => {
    store.products = []
    store.saveStore()
    showClearAllProductsConfirm.value = false
    showMessage('已清除所有商品')
}

const clearChatHistory = () => {
    store.chatMessages = {}
    store.saveStore()
    showClearChatConfirm.value = false
    showMessage('已清除所有客服聊天记录')
}

const toggleCityType = () => {
    const isFantasy = store.toggleFantasyCities()
    showMessage(isFantasy ? '已切换为虚拟城市' : '已切换为真实城市')
}

// 监听周报弹窗
watch(showWeeklyReport, (val) => {
    if (val) {
        store.generateWeeklyReport()
    }
})

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

// 客服列表
const customerServiceList = [
    { id: 'platform', name: '官方客服小蜜', desc: '订单、退款、投诉等问题', icon: '🤖', bgColor: 'bg-blue-100', online: true },
    { id: 'tech', name: '技术支持', desc: 'APP使用、功能问题咨询', icon: '🔧', bgColor: 'bg-purple-100', online: true },
    { id: 'complaint', name: '投诉建议', desc: '服务投诉、意见反馈', icon: '📝', bgColor: 'bg-red-100', online: true },
    { id: 'vip', name: 'VIP专属客服', desc: '会员专属服务通道', icon: '👑', bgColor: 'bg-yellow-100', online: false }
]

// 进入客服聊天
const enterChat = (cs) => {
    // 切换到客服视图，并设置当前客服 ID
    store.activeShopId = cs.id
    store.switchView('chat')
    // 注意：这里不直接进入聊天详情，而是在 ChatView 中显示列表
}

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

@keyframes scale-in {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes slide-up {
    from {
        transform: translateY(20px);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.animate-slide-in-right {
    animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-scale-in {
    animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-slide-up {
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
