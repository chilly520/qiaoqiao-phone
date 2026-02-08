<template>
    <div class="games-center w-full h-full flex flex-col bg-gradient-to-br from-purple-50 to-pink-50">
        <!-- 顶部导航 -->
        <div
            class="h-[50px] bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/')" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🎮</span>
                <span>游戏中心</span>
            </h1>
            <button @click="showSettings = true" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-gear text-xl"></i>
            </button>
        </div>

        <!-- 轮播图 -->
        <div
            class="m-4 h-[150px] bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl shadow-lg overflow-hidden relative">
            <div class="absolute inset-0 flex items-center justify-center">
                <div class="text-center text-white">
                    <div class="text-5xl mb-2">🎲</div>
                    <div class="text-2xl font-bold">欢迎来到游戏中心</div>
                    <div class="text-sm opacity-90 mt-1">精彩游戏，等你来玩</div>
                </div>
            </div>
        </div>

        <!-- 游戏分类 -->
        <div class="px-4 mb-3">
            <div class="flex gap-2 overflow-x-auto pb-2">
                <button v-for="category in categories" :key="category.id" @click="selectedCategory = category.id"
                    class="px-4 py-2 rounded-full whitespace-nowrap transition-all" :class="selectedCategory === category.id
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                        : 'bg-white text-gray-700 shadow'">
                    {{ category.name }}
                </button>
            </div>
        </div>

        <!-- 游戏列表 -->
        <div class="flex-1 overflow-y-auto px-4 pb-4">
            <div class="grid grid-cols-2 gap-3">
                <!-- 麻将游戏 -->
                <div @click="openGame('mahjong')"
                    class="game-card bg-white rounded-2xl shadow-lg overflow-hidden active:scale-95 transition-transform">
                    <div
                        class="h-[120px] bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center relative overflow-hidden">
                        <!-- 装饰性背景 -->
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-6xl">🀄</div>
                            <div class="absolute bottom-2 right-2 text-4xl">🎴</div>
                        </div>
                        <div class="text-6xl relative z-10">🀄</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">麻将</h3>
                        <p class="text-xs text-gray-500 mb-2">大众麻将，支持吃碰杠</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-orange-600 font-bold">🔥 热门</span>
                            <span class="text-xs text-gray-400">4人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 斗地主（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">🃏</div>
                            <div class="absolute bottom-2 right-2 text-3xl">👑</div>
                        </div>
                        <div class="text-6xl relative z-10">🃏</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">斗地主</h3>
                        <p class="text-xs text-gray-500 mb-2">经典扑克游戏</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">3人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 象棋（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">♟️</div>
                            <div class="absolute bottom-2 right-2 text-3xl">🏰</div>
                        </div>
                        <div class="text-6xl relative z-10">♟️</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">象棋</h3>
                        <p class="text-xs text-gray-500 mb-2">中国象棋对弈</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">2人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 五子棋（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">⚫</div>
                            <div class="absolute bottom-2 right-2 text-3xl">⚪</div>
                        </div>
                        <div class="text-6xl relative z-10">⚫⚪</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">五子棋</h3>
                        <p class="text-xs text-gray-500 mb-2">简单易上手</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">2人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 德州扑克（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-5xl">🎰</div>
                            <div class="absolute bottom-2 right-2 text-3xl">💰</div>
                        </div>
                        <div class="text-6xl relative z-10">🎰</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">德州扑克</h3>
                        <p class="text-xs text-gray-500 mb-2">刺激的博弈游戏</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">多人对战</span>
                        </div>
                    </div>
                </div>

                <!-- 猜拳游戏（即将推出） -->
                <div class="game-card bg-white rounded-2xl shadow-lg overflow-hidden opacity-60">
                    <div
                        class="h-[120px] bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-2 left-2 text-4xl">✊</div>
                            <div class="absolute bottom-2 right-2 text-3xl">✌️</div>
                        </div>
                        <div class="text-6xl relative z-10">✊✋✌️</div>
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-lg mb-1">猜拳</h3>
                        <p class="text-xs text-gray-500 mb-2">石头剪刀布</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-400">即将推出</span>
                            <span class="text-xs text-gray-400">休闲娱乐</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 更多游戏提示 -->
            <div class="mt-6 text-center text-gray-400 text-sm">
                <p>更多精彩游戏，敬请期待...</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showSettings = ref(false)
const selectedCategory = ref('all')

const categories = [
    { id: 'all', name: '全部' },
    { id: 'card', name: '棋牌' },
    { id: 'casual', name: '休闲' },
    { id: 'strategy', name: '策略' }
]

const openGame = (gameId) => {
    if (gameId === 'mahjong') {
        router.push('/games/mahjong-lobby')
    } else {
        alert('该游戏即将推出，敬请期待！')
    }
}
</script>

<style scoped>
.game-card {
    cursor: pointer;
}

.game-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}
</style>
