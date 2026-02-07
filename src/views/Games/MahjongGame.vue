<template>
    <div class="mahjong-game w-full h-full flex flex-col bg-gradient-to-br from-green-900 to-green-700">
        <!-- 顶部信息栏 -->
        <div class="h-[50px] bg-black/30 flex items-center justify-between px-4">
            <button @click="$router.back()" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>

            <div class="flex items-center gap-4 text-white text-sm">
                <span>局数: {{ mahjongStore.currentRoom?.currentRound }}/{{ mahjongStore.currentRoom?.totalRounds
                    }}</span>
                <span>底注: {{ mahjongStore.currentRoom?.baseStake }}</span>
                <span>牌堆: {{ mahjongStore.gameState?.deck?.length || 0 }}</span>
            </div>

            <button @click="showMenu = true" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-ellipsis-vertical text-xl"></i>
            </button>
        </div>

        <!-- 游戏区域 -->
        <div class="flex-1 flex flex-col p-4">
            <!-- 对家（上） -->
            <div class="flex flex-col items-center mb-4">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span class="text-xl">🎭</span>
                    </div>
                    <div class="text-white text-sm">
                        <div class="font-bold">{{ getPlayer('north')?.name }}</div>
                        <div class="text-xs opacity-80">{{ getPlayer('north')?.beans }}豆</div>
                    </div>
                </div>

                <!-- 手牌（背面） -->
                <div class="flex gap-1">
                    <div v-for="i in 13" :key="i" class="mahjong-tile-back"></div>
                </div>

                <!-- 打出的牌 -->
                <div class="mt-2 flex flex-wrap gap-1 justify-center max-w-[300px]">
                    <div v-for="(tile, i) in getPlayer('north')?.discarded" :key="i" class="mahjong-tile-small">
                        {{ getTileEmoji(tile) }}
                    </div>
                </div>
            </div>

            <!-- 中间区域 -->
            <div class="flex-1 flex items-center">
                <!-- 左家 -->
                <div class="flex flex-col items-center w-20">
                    <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mb-2">
                        <span class="text-xl">🎭</span>
                    </div>
                    <div class="text-white text-xs text-center mb-2">
                        <div class="font-bold">{{ getPlayer('west')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('west')?.beans }}豆</div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div v-for="i in 13" :key="i" class="mahjong-tile-vertical"></div>
                    </div>
                </div>

                <!-- 牌池 -->
                <div class="flex-1 flex items-center justify-center">
                    <div class="text-white text-center">
                        <div class="text-6xl mb-4">🀄</div>
                        <div class="text-xl font-bold">麻将游戏</div>
                        <div class="text-sm opacity-80 mt-2">游戏界面开发中...</div>
                        <div class="mt-4 text-xs opacity-60">
                            <div>当前玩家: {{ getCurrentPlayer()?.name }}</div>
                            <div class="mt-1">手牌数: {{ getCurrentPlayer()?.hand?.length || 0 }}</div>
                        </div>
                    </div>
                </div>

                <!-- 右家 -->
                <div class="flex flex-col items-center w-20">
                    <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mb-2">
                        <span class="text-xl">🎭</span>
                    </div>
                    <div class="text-white text-xs text-center mb-2">
                        <div class="font-bold">{{ getPlayer('east')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('east')?.beans }}豆</div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div v-for="i in 13" :key="i" class="mahjong-tile-vertical"></div>
                    </div>
                </div>
            </div>

            <!-- 我（下） -->
            <div class="flex flex-col items-center mt-4">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                        <span class="text-xl">👤</span>
                    </div>
                    <div class="text-white text-sm">
                        <div class="font-bold">{{ getPlayer('south')?.name }}</div>
                        <div class="text-xs opacity-80">{{ getPlayer('south')?.beans }}豆 | 积分: {{ mahjongStore.score }}
                        </div>
                    </div>
                </div>

                <!-- 手牌 -->
                <div class="flex gap-1 mb-3">
                    <div v-for="(tile, i) in getPlayer('south')?.hand" :key="i" class="mahjong-tile"
                        :class="{ 'selected': selectedTile === i }" @click="selectTile(i)">
                        {{ getTileEmoji(tile) }}
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex gap-2">
                    <button class="action-btn bg-blue-500" disabled>吃</button>
                    <button class="action-btn bg-green-500" disabled>碰</button>
                    <button class="action-btn bg-purple-500" disabled>杠</button>
                    <button class="action-btn bg-red-500" disabled>胡</button>
                    <button class="action-btn bg-gray-500" disabled>过</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMahjongStore } from '../../stores/mahjongStore'

const mahjongStore = useMahjongStore()
const showMenu = ref(false)
const selectedTile = ref(null)

// 获取玩家
const getPlayer = (position) => {
    return mahjongStore.currentRoom?.players?.find(p => p.position === position)
}

// 获取当前玩家
const getCurrentPlayer = () => {
    const index = mahjongStore.gameState?.currentPlayer || 0
    return mahjongStore.currentRoom?.players?.[index]
}

// 选择牌
const selectTile = (index) => {
    selectedTile.value = index
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
</script>

<style scoped>
.mahjong-tile {
    width: 32px;
    height: 44px;
    background: linear-gradient(145deg, #ffffff, #e6e6e6);
    border: 2px solid #ccc;
    border-radius: 4px;
    box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    font-size: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;
    user-select: none;
}

.mahjong-tile:hover {
    transform: translateY(-4px);
}

.mahjong-tile.selected {
    transform: translateY(-8px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border-color: #3b82f6;
}

.mahjong-tile-back {
    width: 24px;
    height: 32px;
    background: linear-gradient(145deg, #4ade80, #22c55e);
    border: 2px solid #16a34a;
    border-radius: 3px;
    box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
}

.mahjong-tile-vertical {
    width: 24px;
    height: 18px;
    background: linear-gradient(145deg, #4ade80, #22c55e);
    border: 2px solid #16a34a;
    border-radius: 3px;
    box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
}

.mahjong-tile-small {
    width: 24px;
    height: 32px;
    background: linear-gradient(145deg, #ffffff, #e6e6e6);
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-btn {
    padding: 8px 16px;
    color: white;
    font-weight: bold;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s;
    opacity: 0.5;
    cursor: not-allowed;
}

.action-btn:not(:disabled) {
    opacity: 1;
    cursor: pointer;
}

.action-btn:not(:disabled):active {
    transform: scale(0.95);
}
</style>
