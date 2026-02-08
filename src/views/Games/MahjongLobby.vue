<template>
    <div class="mahjong-lobby w-full h-full flex flex-col bg-emerald-50">
        <!-- 顶部导航 -->
        <div
            class="h-[50px] bg-gradient-to-r from-emerald-600 to-green-600 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/games')" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🀄</span>
                <span>麻将大厅</span>
            </h1>
            <button @click="showRank = true" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-gear text-xl"></i>
            </button>
        </div>

        <!-- 个人信息卡片 -->
        <div class="m-4 p-4 bg-white rounded-2xl shadow-md border border-emerald-100">
            <div class="flex items-center gap-4">
                <!-- 头像显示 -->
                <div class="w-16 h-16 rounded-2xl overflow-hidden shadow-inner border-2 border-emerald-50">
                    <img :src="userAvatar" class="w-full h-full object-cover" />
                </div>

                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-lg font-black text-gray-800">{{ userName }}</span>
                        <span class="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] rounded-full font-bold">
                            {{ mahjongStore.rank }}
                        </span>
                    </div>
                    <div class="text-xs text-gray-400 mt-1 flex gap-3">
                        <span>积分:{{ mahjongStore.score }}</span>
                        <span>胜率:{{ winRate }}%</span>
                        <span>连胜:{{ mahjongStore.winStreak }}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-black text-orange-500">{{ formattedBeans }}</div>
                    <div class="text-[10px] text-gray-400">欢乐豆</div>
                </div>
            </div>

            <!-- 充值按钮 -->
            <button @click="showRecharge = true"
                class="w-full mt-3 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white font-bold rounded-lg shadow-md active:scale-95 transition-transform">
                <i class="fa-solid fa-coins mr-2"></i>
                充值欢乐豆
            </button>
        </div>

        <!-- 快速开始 -->
        <div class="px-4 mb-4">
            <button @click="quickStart"
                class="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-xl rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                <i class="fa-solid fa-bolt text-2xl"></i>
                <span>快速开始</span>
            </button>
        </div>

        <!-- 功能按钮 -->
        <div class="px-4 grid grid-cols-2 gap-3 mb-4">
            <button @click="showCreateRoom = true"
                class="py-3 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-2">
                <i class="fa-solid fa-plus-circle text-3xl text-blue-500"></i>
                <span class="text-sm font-bold text-gray-700">创建房间</span>
            </button>

            <button @click="showRanking = true"
                class="py-3 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-2">
                <i class="fa-solid fa-trophy text-3xl text-yellow-500"></i>
                <span class="text-sm font-bold text-gray-700">排行榜</span>
            </button>
        </div>

        <!-- 游戏规则说明 -->
        <div class="px-4 mb-4">
            <div class="bg-white rounded-xl shadow-md p-4">
                <h3 class="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <i class="fa-solid fa-plus text-emerald-500"></i>
                    <span>游戏规则</span>
                </h3>
                <ul class="text-sm text-gray-600 space-y-1">
                    <li>• 大众麻将，支持吃、碰、杠、胡</li>
                    <li>• 每局底注100欢乐豆</li>
                    <li>• 胡牌根据番数获得奖励</li>
                    <li>• 积分影响段位，段位越高奖励越多</li>
                </ul>
            </div>
        </div>

        <!-- 充值弹窗 -->
        <Transition name="fade">
            <div v-if="showRecharge" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="showRecharge = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full relative" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">充值欢乐豆</h2>

                    <!-- 成功提示 Toast -->
                    <Transition name="fade">
                        <div v-if="toastMsg"
                            class="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white text-sm rounded-full z-[60] whitespace-nowrap">
                            {{ toastMsg }}
                        </div>
                    </Transition>

                    <div class="space-y-3 mb-6">
                        <button v-for="pkg in rechargePackages" :key="pkg.amount" @click="recharge(pkg)"
                            class="w-full p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl active:scale-95 transition-transform">
                            <div class="flex items-center justify-between">
                                <div class="text-left">
                                    <div class="text-2xl font-bold text-orange-600">{{ pkg.amount }}</div>
                                    <div class="text-xs text-gray-500">欢乐豆</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xl font-bold text-red-600">¥{{ pkg.price }}</div>
                                    <div v-if="pkg.bonus" class="text-xs text-green-600">送{{ pkg.bonus }}豆</div>
                                </div>
                            </div>
                        </button>
                    </div>

                    <button @click="showRecharge = false"
                        class="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">
                        取消
                    </button>
                </div>
            </div>
        </Transition>

        <!-- 创建房间弹窗 -->
        <Transition name="fade">
            <div v-if="showCreateRoom" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="showCreateRoom = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">创建房间</h2>

                    <div class="space-y-4 mb-6">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-2">底注</label>
                            <select v-model="roomConfig.baseStake"
                                class="w-full p-3 border-2 border-gray-200 rounded-lg">
                                <option :value="100">100欢乐豆</option>
                                <option :value="500">500欢乐豆</option>
                                <option :value="1000">1000欢乐豆</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-2">局数</label>
                            <select v-model="roomConfig.totalRounds"
                                class="w-full p-3 border-2 border-gray-200 rounded-lg">
                                <option :value="4">4局</option>
                                <option :value="8">8局</option>
                                <option :value="16">16局</option>
                            </select>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <button @click="showCreateRoom = false"
                            class="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">
                            取消
                        </button>
                        <button @click="createRoom"
                            class="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg">
                            创建
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMahjongStore } from '../../stores/mahjongStore.js'
import { useWalletStore } from '../../stores/walletStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import mahjongEngine from '../../utils/mahjong/MahjongEngine.js'



const router = useRouter()
const mahjongStore = useMahjongStore()
const walletStore = useWalletStore()
const settingsStore = useSettingsStore()

// 用户信息
const userName = computed(() => settingsStore.personalization.userProfile.name || '我')
const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '🎭')

// 判断是否为图片头像
const isImageAvatar = (avatar) => {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}

const showRecharge = ref(false)
const showCreateRoom = ref(false)
const showRanking = ref(false)
const showSettings = ref(false)
const toastMsg = ref('')

const showToast = (msg) => {
    toastMsg.value = msg
    setTimeout(() => {
        toastMsg.value = ''
    }, 2000)
}

const roomConfig = ref({
    baseStake: 100,
    totalRounds: 8
})

const rechargePackages = [
    { amount: 6000, price: 6, bonus: 0 },
    { amount: 30000, price: 30, bonus: 3000 },
    { amount: 68000, price: 68, bonus: 10000 },
    { amount: 128000, price: 128, bonus: 20000 }
]

// 快速开始
const quickStart = () => {
    // 检查欢乐豆
    if (mahjongStore.beans < 100) {
        showToast('欢乐豆不足，请先充值！')
        showRecharge.value = true
        return
    }

    // 创建房间
    mahjongStore.createRoom({ mode: 'quick', baseStake: 100, totalRounds: 8 })

    // 跳转到房间等待页面
    router.push('/games/mahjong-room')
}

// 创建房间
const createRoom = () => {
    // 检查欢乐豆
    if (mahjongStore.beans < roomConfig.value.baseStake) {
        showToast('欢乐豆不足，请先充值！')
        showCreateRoom.value = false
        showRecharge.value = true
        return
    }

    // 创建房间
    mahjongStore.createRoom({
        mode: 'custom',
        baseStake: roomConfig.value.baseStake,
        totalRounds: roomConfig.value.totalRounds
    })

    // 关闭弹窗
    showCreateRoom.value = false

    // 跳转到房间等待页面
    router.push('/games/mahjong-room')
}

// 充值
const recharge = (pkg) => {
    const amount = pkg.amount
    const price = pkg.price

    // 调用钱包扣款 (decreaseBalance 会处理亲属卡/零钱/银行卡优先级)
    const success = walletStore.decreaseBalance(price, `麻将欢乐豆充值(${amount}豆)`)

    if (!success) {
        showToast('支付失败，请检查余额')
        return
    }

    const result = mahjongStore.rechargeBeans(amount + (pkg.bonus || 0))

    if (result.success) {
        showToast('充值成功！')
        setTimeout(() => {
            showRecharge.value = false
        }, 1000)
    } else {
        showToast(result.message)
    }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
