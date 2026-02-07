<template>
    <div class="mahjong-room w-full h-full flex flex-col bg-gradient-to-br from-red-50 to-orange-50">
        <!-- 顶部导航 -->
        <div
            class="h-[50px] bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-between px-4 shadow-lg">
            <button @click="handleBack" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-lg font-bold text-white">房间等待</h1>
            <div class="w-10"></div>
        </div>

        <!-- 房间信息 -->
        <div class="m-4 bg-white rounded-2xl shadow-lg p-4">
            <div class="flex items-center justify-between mb-3">
                <div>
                    <div class="text-sm text-gray-500">房间号</div>
                    <div class="text-lg font-bold">{{ roomId }}</div>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-500">底注</div>
                    <div class="text-lg font-bold text-orange-600">{{ mahjongStore.currentRoom?.baseStake }}豆/局</div>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-500">局数</div>
                    <div class="text-lg font-bold text-blue-600">{{ mahjongStore.currentRoom?.totalRounds }}局</div>
                </div>
            </div>
        </div>

        <!-- 座位布局 -->
        <div class="flex-1 p-4">
            <div class="grid grid-cols-2 gap-4 h-full">
                <!-- 东位 -->
                <div class="seat-card" :class="{ 'ready': getPlayer('east')?.isReady }">
                    <div class="seat-label">东</div>
                    <div v-if="getPlayer('east')" class="player-info">
                        <div class="text-4xl mb-2">{{ getPlayer('east').avatar || '🎭' }}</div>
                        <div class="font-bold">{{ getPlayer('east').name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('east').beans }}豆</div>
                        <div v-if="getPlayer('east').isReady" class="ready-badge">已准备</div>
                    </div>
                    <div v-else class="empty-seat">
                        <i class="fa-solid fa-user-plus text-4xl text-gray-300"></i>
                        <div class="text-sm text-gray-400 mt-2">等待玩家</div>
                    </div>
                </div>

                <!-- 南位（玩家） -->
                <div class="seat-card ready">
                    <div class="seat-label">南</div>
                    <div class="player-info">
                        <div class="text-4xl mb-2">👤</div>
                        <div class="font-bold">{{ getPlayer('south')?.name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('south')?.beans }}豆</div>
                        <div class="ready-badge">已准备</div>
                    </div>
                </div>

                <!-- 西位 -->
                <div class="seat-card" :class="{ 'ready': getPlayer('west')?.isReady }">
                    <div class="seat-label">西</div>
                    <div v-if="getPlayer('west')" class="player-info">
                        <div class="text-4xl mb-2">{{ getPlayer('west').avatar || '🎭' }}</div>
                        <div class="font-bold">{{ getPlayer('west').name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('west').beans }}豆</div>
                        <div v-if="getPlayer('west').isReady" class="ready-badge">已准备</div>
                    </div>
                    <div v-else class="empty-seat">
                        <i class="fa-solid fa-user-plus text-4xl text-gray-300"></i>
                        <div class="text-sm text-gray-400 mt-2">等待玩家</div>
                    </div>
                </div>

                <!-- 北位 -->
                <div class="seat-card" :class="{ 'ready': getPlayer('north')?.isReady }">
                    <div class="seat-label">北</div>
                    <div v-if="getPlayer('north')" class="player-info">
                        <div class="text-4xl mb-2">{{ getPlayer('north').avatar || '🎭' }}</div>
                        <div class="font-bold">{{ getPlayer('north').name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('north').beans }}豆</div>
                        <div v-if="getPlayer('north').isReady" class="ready-badge">已准备</div>
                    </div>
                    <div v-else class="empty-seat">
                        <i class="fa-solid fa-user-plus text-4xl text-gray-300"></i>
                        <div class="text-sm text-gray-400 mt-2">等待玩家</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-4">
            <button v-if="allReady" @click="startGame"
                class="w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-xl rounded-2xl shadow-xl active:scale-95 transition-transform">
                <i class="fa-solid fa-play mr-2"></i>
                开始游戏
            </button>
            <div v-else class="w-full py-4 bg-gray-300 text-gray-500 font-bold text-xl rounded-2xl text-center">
                等待玩家准备...
            </div>
        </div>

        <!-- 摇骰子动画 -->
        <Transition name="fade">
            <div v-if="showDice" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div class="text-center">
                    <div class="text-white text-2xl font-bold mb-4">{{ dealerName }} 是庄家</div>
                    <div class="text-8xl animate-bounce mb-4">🎲</div>
                    <div class="text-white text-xl">摇骰子中...</div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMahjongStore } from '../../stores/mahjongStore'

const router = useRouter()
const mahjongStore = useMahjongStore()
const showDice = ref(false)
const dealerName = ref('')

const roomId = computed(() => {
    return mahjongStore.currentRoom?.id?.slice(-6).toUpperCase() || '------'
})

const allReady = computed(() => {
    const players = mahjongStore.currentRoom?.players || []
    return players.length === 4 && players.every(p => p.isReady)
})

const getPlayer = (position) => {
    return mahjongStore.currentRoom?.players?.find(p => p.position === position)
}

const handleBack = () => {
    if (confirm('确定要退出房间吗？')) {
        router.back()
    }
}

const startGame = () => {
    // 随机选择庄家
    const players = mahjongStore.currentRoom.players
    const dealerIndex = Math.floor(Math.random() * 4)
    mahjongStore.gameState.dealer = dealerIndex
    dealerName.value = players[dealerIndex].name

    // 显示摇骰子动画
    showDice.value = true

    // 2秒后开始发牌
    setTimeout(() => {
        showDice.value = false
        mahjongStore.startGame()
        router.push('/games/mahjong')
    }, 2000)
}

// 自动添加AI玩家
onMounted(() => {
    if (mahjongStore.currentRoom?.players?.length === 1) {
        mahjongStore.addAIPlayers()
    }
})
</script>

<style scoped>
.seat-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    border: 3px solid transparent;
    transition: all 0.3s;
}

.seat-card.ready {
    border-color: #22c55e;
    background: linear-gradient(145deg, #f0fdf4, #dcfce7);
}

.seat-label {
    position: absolute;
    top: 8px;
    left: 8px;
    background: linear-gradient(135deg, #f59e0b, #ef4444);
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
}

.player-info {
    text-align: center;
}

.empty-seat {
    text-align: center;
    opacity: 0.5;
}

.ready-badge {
    margin-top: 8px;
    padding: 4px 12px;
    background: #22c55e;
    color: white;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
