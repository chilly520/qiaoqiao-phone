<template>
    <div class="mahjong-game w-full h-full flex flex-col bg-gradient-to-br from-green-900 to-green-700">
        <!-- 顶部信息栏 -->
        <div class="h-[50px] bg-black/30 flex items-center justify-between px-4">
            <button @click="handleBack" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>

            <div class="flex items-center gap-4 text-white text-sm">
                <span>局数: {{ mahjongStore.currentRoom?.currentRound }}/{{ mahjongStore.currentRoom?.totalRounds
                    }}</span>
                <span>底注: {{ mahjongStore.currentRoom?.baseStake }}</span>
                <span>牌堆: {{ mahjongStore.gameState?.deck?.length || 0 }}</span>
            </div>

            <button @click="mahjongStore.toggleCheat()" class="w-10 h-10 flex items-center justify-center text-white"
                @touchstart="handleLongPress" @touchend="cancelLongPress">
                <i class="fa-solid fa-ellipsis-vertical text-xl"></i>
            </button>
        </div>

        <!-- 游戏区域 -->
        <div class="flex-1 flex flex-col p-2">
            <!-- 对家（上） -->
            <div class="flex flex-col items-center mb-2">
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                        {{ getPlayer('north')?.avatar || '🎭' }}
                    </div>
                    <div class="text-white text-xs">
                        <div class="font-bold">{{ getPlayer('north')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('north')?.beans }}豆</div>
                    </div>
                </div>

                <!-- 手牌（背面） -->
                <div class="flex gap-0.5">
                    <div v-for="i in getPlayer('north')?.hand?.length || 13" :key="i" class="mahjong-tile-back"></div>
                </div>

                <!-- 打出的牌 -->
                <div class="mt-1 flex flex-wrap gap-0.5 justify-center max-w-[300px]">
                    <div v-for="(tile, i) in getPlayer('north')?.discarded" :key="i" class="mahjong-tile-small">
                        {{ getTileEmoji(tile) }}
                    </div>
                </div>
            </div>

            <!-- 中间区域 -->
            <div class="flex-1 flex items-center gap-2">
                <!-- 左家 -->
                <div class="flex flex-col items-center w-16">
                    <div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-lg mb-1">
                        {{ getPlayer('west')?.avatar || '🎭' }}
                    </div>
                    <div class="text-white text-[10px] text-center mb-1">
                        <div class="font-bold truncate w-16">{{ getPlayer('west')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('west')?.beans }}豆</div>
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <div v-for="i in getPlayer('west')?.hand?.length || 13" :key="i" class="mahjong-tile-vertical">
                        </div>
                    </div>
                </div>

                <!-- 牌池 -->
                <div class="flex-1 flex flex-col items-center justify-center">
                    <div v-if="!mahjongStore.gameState" class="text-white text-center">
                        <div class="text-6xl mb-4">🀄</div>
                        <div class="text-xl font-bold">准备中...</div>
                    </div>
                    <div v-else-if="mahjongStore.currentRoom?.status === 'settling'" class="text-white text-center">
                        <div class="text-5xl mb-3">🎉</div>
                        <div class="text-2xl font-bold mb-2">{{ mahjongStore.currentRoom.lastResult?.winnerName }} 胡了！
                        </div>
                        <div class="text-lg">{{ mahjongStore.currentRoom.lastResult?.fan }}番</div>
                        <div class="text-xl font-bold text-yellow-300 mt-2">+{{
                            mahjongStore.currentRoom.lastResult?.reward }}豆</div>
                    </div>
                    <div v-else class="flex flex-col items-center">
                        <!-- 牌堆显示 -->
                        <div class="mb-2 flex gap-1">
                            <div v-for="i in Math.min(17, deckCount)" :key="i"
                                class="w-3 h-5 bg-gradient-to-b from-green-400 to-green-600 border border-green-700 rounded-sm">
                            </div>
                        </div>
                        <div class="text-white text-xs mb-2">剩余 {{ deckCount }} 张</div>

                        <!-- 牌池（打出的牌） -->
                        <div class="flex flex-wrap gap-0.5 max-w-[200px] justify-center">
                            <div v-for="(tile, i) in mahjongStore.gameState?.pool?.slice(-20)" :key="i"
                                class="mahjong-tile-pool">
                                {{ getTileEmoji(tile) }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右家 -->
                <div class="flex flex-col items-center w-16">
                    <div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-lg mb-1">
                        {{ getPlayer('east')?.avatar || '🎭' }}
                    </div>
                    <div class="text-white text-[10px] text-center mb-1">
                        <div class="font-bold truncate w-16">{{ getPlayer('east')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('east')?.beans }}豆</div>
                    </div>
                    <div class="flex flex-col gap-0.5">
                        <div v-for="i in getPlayer('east')?.hand?.length || 13" :key="i" class="mahjong-tile-vertical">
                        </div>
                    </div>
                </div>
            </div>

            <!-- 我（下） -->
            <div class="flex flex-col items-center mt-2">
                <div class="flex items-center gap-2 mb-1">
                    <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-lg">
                        👤
                    </div>
                    <div class="text-white text-xs">
                        <div class="font-bold">{{ getPlayer('south')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('south')?.beans }}豆 | 积分: {{ mahjongStore.score }}</div>
                    </div>
                </div>

                <!-- 手牌 -->
                <div class="flex gap-0.5 mb-2 overflow-x-auto max-w-full px-2">
                    <div v-for="(tile, i) in getPlayer('south')?.hand" :key="i" class="mahjong-tile flex-shrink-0"
                        :class="{ 'selected': selectedTile === i, 'disabled': !isMyTurn }" @click="selectTile(i)">
                        {{ getTileEmoji(tile) }}
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex gap-2">
                    <button v-if="canChi" @click="performAction('chi')" class="action-btn bg-blue-500">吃</button>
                    <button v-if="canPeng" @click="performAction('peng')" class="action-btn bg-green-500">碰</button>
                    <button v-if="canGang" @click="performAction('gang')" class="action-btn bg-purple-500">杠</button>
                    <button v-if="canHu" @click="performAction('hu')"
                        class="action-btn bg-red-500 animate-pulse">胡</button>
                    <button v-if="selectedTile !== null && isMyTurn" @click="playSelectedTile"
                        class="action-btn bg-orange-500">打牌</button>
                    <button v-if="!isMyTurn && (canChi || canPeng || canGang || canHu)" @click="performAction('pass')"
                        class="action-btn bg-gray-500">过</button>
                </div>

                <!-- 当前回合提示 -->
                <div v-if="isMyTurn" class="mt-2 text-yellow-300 text-sm font-bold animate-pulse">
                    轮到你了！
                </div>
            </div>
        </div>

        <!-- 开局动画 -->
        <Transition name="fade">
            <div v-if="showGameStart" class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
                <!-- 摇骰子阶段 -->
                <div v-if="gameStartPhase === 'dice'" class="text-center">
                    <div class="text-white text-2xl font-bold mb-6">{{ dealerName }} 是庄家</div>
                    <div class="flex gap-4 justify-center mb-6">
                        <div class="text-8xl animate-bounce" style="animation-delay: 0s">🎲</div>
                        <div class="text-8xl animate-bounce" style="animation-delay: 0.1s">🎲</div>
                    </div>
                    <div v-if="diceResult > 0" class="text-white text-3xl font-bold mb-2">
                        {{ diceResult }} 点
                    </div>
                    <div v-if="diceResult > 0" class="text-white text-xl">
                        从 {{ dealPosition }} 开始发牌
                    </div>
                    <div v-else class="text-white text-xl">摇骰子中...</div>
                </div>

                <!-- 牌堆阶段 -->
                <div v-else-if="gameStartPhase === 'deck'" class="text-center">
                    <div class="text-white text-xl font-bold mb-6">牌堆准备中</div>
                    <div class="grid grid-cols-17 gap-1 mb-4">
                        <div v-for="i in 136" :key="i"
                            class="w-4 h-6 bg-gradient-to-b from-green-400 to-green-600 border border-green-700 rounded-sm animate-fadeIn"
                            :style="{ animationDelay: `${i * 5}ms` }">
                        </div>
                    </div>
                    <div class="text-white text-lg">136张牌</div>
                </div>

                <!-- 发牌阶段 -->
                <div v-else-if="gameStartPhase === 'deal'" class="text-center">
                    <div class="text-white text-2xl font-bold mb-6">发牌中...</div>
                    <div class="text-6xl mb-4">🀄</div>
                    <div class="text-white text-xl">{{ dealingProgress }}/52</div>
                    <div class="w-64 h-2 bg-gray-700 rounded-full mt-4 overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
                            :style="{ width: `${(dealingProgress / 52) * 100}%` }">
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 作弊模式遮罩 -->
        <Transition name="fade">
            <div v-if="mahjongStore.cheatMode" class="fixed inset-0 bg-black/80 z-50 overflow-y-auto"
                @click="mahjongStore.toggleCheat()">
                <div class="p-4">
                    <h2 class="text-white text-xl font-bold mb-4 text-center">👀 作弊模式</h2>

                    <!-- 其他玩家手牌 -->
                    <div v-for="player in otherPlayers" :key="player.id" class="mb-4">
                        <div class="text-white text-sm font-bold mb-2">{{ player.name }} 的手牌：</div>
                        <div class="flex flex-wrap gap-1">
                            <div v-for="(tile, i) in player.hand" :key="i" class="mahjong-tile-small bg-white">
                                {{ getTileEmoji(tile) }}
                            </div>
                        </div>
                    </div>

                    <!-- 剩余牌堆 -->
                    <div class="mt-4">
                        <div class="text-white text-sm font-bold mb-2">剩余牌堆 ({{ mahjongStore.gameState?.deck?.length ||
                            0 }}张)：</div>
                        <div class="flex flex-wrap gap-1">
                            <div v-for="(tile, i) in mahjongStore.gameState?.deck?.slice(-20)" :key="i"
                                class="mahjong-tile-small bg-white">
                                {{ getTileEmoji(tile) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMahjongStore } from '../../stores/mahjongStore'
import mahjongEngine from '../../utils/mahjong/MahjongEngine'

const router = useRouter()
const mahjongStore = useMahjongStore()
const selectedTile = ref(null)
const canChi = ref(false)
const canPeng = ref(false)
const canGang = ref(false)
const canHu = ref(false)

// 开局动画状态
const showGameStart = ref(false)
const gameStartPhase = ref('dice') // 'dice' | 'deck' | 'deal'
const dealerName = ref('')
const dealingProgress = ref(0)
const diceResult = ref(0)
const dealPosition = ref('')

let longPressTimer = null

// 获取玩家
const getPlayer = (position) => {
    return mahjongStore.currentRoom?.players?.find(p => p.position === position)
}

// 其他玩家
const otherPlayers = computed(() => {
    return mahjongStore.currentRoom?.players?.filter(p => p.id !== 'user') || []
})

// 是否轮到我
const isMyTurn = computed(() => {
    const currentPlayer = mahjongStore.currentRoom?.players?.[mahjongStore.gameState?.currentPlayer]
    return currentPlayer?.id === 'user'
})

// 剩余牌堆数量
const deckCount = computed(() => {
    return mahjongStore.gameState?.deck?.length || 0
})

// 选择牌
const selectTile = (index) => {
    if (!isMyTurn.value) return
    selectedTile.value = selectedTile.value === index ? null : index
}

// 打出选中的牌
const playSelectedTile = () => {
    if (selectedTile.value === null) return
    mahjongStore.playTile(selectedTile.value)
    selectedTile.value = null
}

// 执行操作
const performAction = (action) => {
    // TODO: 实现吃碰杠胡逻辑
    console.log('执行操作:', action)
}

// 返回
const handleBack = () => {
    if (confirm('确定要退出游戏吗？')) {
        router.back()
    }
}

// 长按激活作弊模式
const handleLongPress = () => {
    longPressTimer = setTimeout(() => {
        mahjongStore.toggleCheat()
    }, 3000)
}

const cancelLongPress = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

// 获取牌的emoji
const getTileEmoji = (tile) => {
    const emojiMap = {
        // 万子
        'w1': '🀇', 'w2': '🀈', 'w3': '🀉', 'w4': '🀊', 'w5': '🀋',
        'w6': '🀌', 'w7': '🀍', 'w8': '🀎', 'w9': '🀏',
        // 条子
        't1': '🀐', 't2': '🀑', 't3': '🀒', 't4': '🀓', 't5': '🀔',
        't6': '🀕', 't7': '🀖', 't8': '🀗', 't9': '🀘',
        // 筒子
        'b1': '🀙', 'b2': '🀚', 'b3': '🀛', 'b4': '🀜', 'b5': '🀝',
        'b6': '🀞', 'b7': '🀟', 'b8': '🀠', 'b9': '🀡',
        // 字牌
        'east': '🀀', 'south': '🀁', 'west': '🀂', 'north': '🀃',
        'red': '🀄', 'green': '🀅', 'white': '🀆'
    }
    return emojiMap[tile] || '🀫'
}

// 监听游戏状态变化
watch(() => mahjongStore.gameState?.currentTile, (newTile) => {
    if (!newTile || isMyTurn.value) return

    const myHand = getPlayer('south')?.hand || []

    // 检查可执行的操作
    canHu.value = mahjongEngine.canHu(myHand, newTile)
    canGang.value = mahjongEngine.canGang(myHand, newTile)
    canPeng.value = mahjongEngine.canPeng(myHand, newTile)
    canChi.value = mahjongEngine.canChi(myHand, newTile, 'previous').length > 0
})

// 播放开局动画
const playGameStartAnimation = async () => {
    showGameStart.value = true
    diceResult.value = 0

    // 获取庄家信息
    const dealerIndex = mahjongStore.gameState?.dealer || 0
    const dealer = mahjongStore.currentRoom?.players?.[dealerIndex]
    dealerName.value = dealer?.name || '玩家'

    // 阶段1: 摇骰子 (3秒)
    gameStartPhase.value = 'dice'

    // 1秒后显示骰子结果
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 摇骰子（两个骰子）
    const dice1 = Math.floor(Math.random() * 6) + 1
    const dice2 = Math.floor(Math.random() * 6) + 1
    diceResult.value = dice1 + dice2

    // 确定发牌位置
    const positions = ['东', '南', '西', '北']
    const positionIndex = (dealerIndex + (diceResult.value - 1) % 4) % 4
    dealPosition.value = positions[positionIndex]

    // 再等2秒显示结果
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 阶段2: 显示牌堆 (1.5秒)
    gameStartPhase.value = 'deck'
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 阶段3: 发牌动画 (2.6秒)
    gameStartPhase.value = 'deal'
    dealingProgress.value = 0

    // 模拟发牌进度 (4个玩家 * 13张牌 = 52张)
    const dealInterval = setInterval(() => {
        dealingProgress.value++
        if (dealingProgress.value >= 52) {
            clearInterval(dealInterval)
        }
    }, 50) // 每50ms发一张牌

    await new Promise(resolve => setTimeout(resolve, 2600))

    // 关闭动画
    showGameStart.value = false
}

// 自动开始第一局
onMounted(() => {
    if (!mahjongStore.gameState) {
        // 播放开局动画
        playGameStartAnimation().then(() => {
            mahjongStore.nextTurn()
        })
    }
})
</script>

<style scoped>
.mahjong-tile {
    width: 28px;
    height: 40px;
    background: linear-gradient(145deg, #ffffff, #e6e6e6);
    border: 2px solid #ccc;
    border-radius: 3px;
    box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;
    user-select: none;
}

.mahjong-tile:not(.disabled):hover {
    transform: translateY(-4px);
}

.mahjong-tile.selected {
    transform: translateY(-8px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border-color: #3b82f6;
}

.mahjong-tile.disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.mahjong-tile-back {
    width: 20px;
    height: 28px;
    background: linear-gradient(145deg, #4ade80, #22c55e);
    border: 2px solid #16a34a;
    border-radius: 2px;
    box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.mahjong-tile-vertical {
    width: 20px;
    height: 16px;
    background: linear-gradient(145deg, #4ade80, #22c55e);
    border: 2px solid #16a34a;
    border-radius: 2px;
    box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.mahjong-tile-small {
    width: 20px;
    height: 28px;
    background: linear-gradient(145deg, #ffffff, #e6e6e6);
    border: 1px solid #ccc;
    border-radius: 2px;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.mahjong-tile-pool {
    width: 18px;
    height: 24px;
    background: linear-gradient(145deg, #ffffff, #e6e6e6);
    border: 1px solid #ccc;
    border-radius: 2px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-btn {
    padding: 6px 12px;
    color: white;
    font-weight: bold;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s;
    cursor: pointer;
    font-size: 14px;
}

.action-btn:active {
    transform: scale(0.95);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: scale(0.8);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

.animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
}
</style>
