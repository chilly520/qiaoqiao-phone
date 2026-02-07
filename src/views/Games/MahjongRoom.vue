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
                        <div class="text-4xl mb-2">{{ getPlayer('east').avatar }}</div>
                        <div class="font-bold">{{ getPlayer('east').name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('east').beans }}豆</div>
                        <div v-if="getPlayer('east').isReady" class="ready-badge">已准备</div>
                    </div>
                    <div v-else class="empty-seat" @click="invitePlayer('east')">
                        <i class="fa-solid fa-plus text-5xl text-gray-300"></i>
                        <div class="text-sm text-gray-400 mt-2">邀请玩家</div>
                    </div>
                </div>

                <!-- 南位（玩家） -->
                <div class="seat-card ready">
                    <div class="seat-label">南</div>
                    <div class="player-info">
                        <div class="text-4xl mb-2">{{ getPlayer('south')?.avatar }}</div>
                        <div class="font-bold">{{ getPlayer('south')?.name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('south')?.beans }}豆</div>
                        <div class="ready-badge">已准备</div>
                    </div>
                </div>

                <!-- 西位 -->
                <div class="seat-card" :class="{ 'ready': getPlayer('west')?.isReady }">
                    <div class="seat-label">西</div>
                    <div v-if="getPlayer('west')" class="player-info">
                        <div class="text-4xl mb-2">{{ getPlayer('west').avatar }}</div>
                        <div class="font-bold">{{ getPlayer('west').name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('west').beans }}豆</div>
                        <div v-if="getPlayer('west').isReady" class="ready-badge">已准备</div>
                    </div>
                    <div v-else class="empty-seat" @click="invitePlayer('west')">
                        <i class="fa-solid fa-plus text-5xl text-gray-300"></i>
                        <div class="text-sm text-gray-400 mt-2">邀请玩家</div>
                    </div>
                </div>

                <!-- 北位 -->
                <div class="seat-card" :class="{ 'ready': getPlayer('north')?.isReady }">
                    <div class="seat-label">北</div>
                    <div v-if="getPlayer('north')" class="player-info">
                        <div class="text-4xl mb-2">{{ getPlayer('north').avatar }}</div>
                        <div class="font-bold">{{ getPlayer('north').name }}</div>
                        <div class="text-sm text-gray-500">{{ getPlayer('north').beans }}豆</div>
                        <div v-if="getPlayer('north').isReady" class="ready-badge">已准备</div>
                    </div>
                    <div v-else class="empty-seat" @click="invitePlayer('north')">
                        <i class="fa-solid fa-plus text-5xl text-gray-300"></i>
                        <div class="text-sm text-gray-400 mt-2">邀请玩家</div>
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
                等待玩家加入 ({{ playerCount }}/4)
            </div>
        </div>

        <!-- 邀请玩家弹窗 -->
        <Transition name="fade">
            <div v-if="showInvite" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="showInvite = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full max-h-[80vh] overflow-y-auto" @click.stop>
                    <h2 class="text-xl font-bold mb-4">邀请玩家</h2>

                    <!-- 标签页 -->
                    <div class="flex gap-2 mb-4">
                        <button @click="inviteTab = 'npc'" class="flex-1 py-2 rounded-lg font-bold transition-all"
                            :class="inviteTab === 'npc' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'">
                            NPC
                        </button>
                        <button @click="inviteTab = 'contacts'" class="flex-1 py-2 rounded-lg font-bold transition-all"
                            :class="inviteTab === 'contacts' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'">
                            通讯录
                        </button>
                    </div>

                    <!-- NPC列表 -->
                    <div v-if="inviteTab === 'npc'" class="space-y-2">
                        <div v-for="npc in availableNPCs" :key="npc.id" @click="addNPC(npc)"
                            class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <div class="text-3xl">{{ npc.avatar }}</div>
                            <div class="flex-1">
                                <div class="font-bold">{{ npc.name }}</div>
                                <div class="text-sm text-gray-500">{{ npc.beans }}豆</div>
                            </div>
                            <i class="fa-solid fa-plus text-red-500"></i>
                        </div>
                    </div>

                    <!-- 通讯录列表 -->
                    <div v-if="inviteTab === 'contacts'" class="space-y-2">
                        <div v-for="contact in availableContacts" :key="contact.id" @click="addContact(contact)"
                            class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <div class="text-3xl">{{ contact.avatar }}</div>
                            <div class="flex-1">
                                <div class="font-bold">{{ contact.name }}</div>
                                <div class="text-sm text-gray-500">{{ contact.signature || '在忙' }}</div>
                            </div>
                            <i class="fa-solid fa-plus text-red-500"></i>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

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
import { useChatStore } from '../../stores/chatStore'

const router = useRouter()
const mahjongStore = useMahjongStore()
const chatStore = useChatStore()
const showDice = ref(false)
const dealerName = ref('')
const showInvite = ref(false)
const inviteTab = ref('npc')
const invitePosition = ref('')

const roomId = computed(() => {
    return mahjongStore.currentRoom?.id?.slice(-6).toUpperCase() || '------'
})

const playerCount = computed(() => {
    return mahjongStore.currentRoom?.players?.length || 0
})

const allReady = computed(() => {
    const players = mahjongStore.currentRoom?.players || []
    return players.length === 4 && players.every(p => p.isReady)
})

// 可用的NPC列表
const availableNPCs = computed(() => {
    const modernNames = [
        '清风徐来', '星河滚烫', '温柔成风', '岁月静好', '浅笑嫣然',
        '北城以北', '南风过境', '时光荏苒', '梦里花落', '云淡风轻',
        '素年锦时', '陌上花开', '烟雨江南', '醉卧花间', '月下独酌',
        '风过无痕', '雨落倾城', '雪舞轻扬', '霜降寒秋', '春暖花开'
    ]

    const avatars = [
        '😊', '😎', '🤗', '😇', '🥰', '😏', '🤓', '😌',
        '🌸', '🌟', '🎨', '🎭', '🎪', '🎯', '🎲', '🎰',
        '🦄', '🐱', '🐶', '🐼', '🦊', '🐯', '🦁', '🐨'
    ]

    return Array.from({ length: 10 }, (_, i) => ({
        id: `npc_${i}`,
        name: modernNames[i % modernNames.length],
        avatar: avatars[i % avatars.length],
        beans: Math.floor(Math.random() * 45000) + 5000
    }))
})

// 可用的通讯录好友
const availableContacts = computed(() => {
    const currentPlayerIds = mahjongStore.currentRoom?.players?.map(p => p.id) || []
    const chats = chatStore.chats || {}

    return Object.keys(chats)
        .filter(chatId => chatId !== 'user' && !currentPlayerIds.includes(chatId))
        .map(chatId => ({
            id: chatId,
            name: chats[chatId].name || '未知',
            avatar: chats[chatId].avatar || '👤',
            signature: chats[chatId].signature || '在忙'
        }))
})

const getPlayer = (position) => {
    return mahjongStore.currentRoom?.players?.find(p => p.position === position)
}

const handleBack = () => {
    if (confirm('确定要退出房间吗？')) {
        router.back()
    }
}

const invitePlayer = (position) => {
    invitePosition.value = position
    showInvite.value = true
}

const addNPC = (npc) => {
    const players = mahjongStore.currentRoom.players
    players.push({
        id: npc.id,
        name: npc.name,
        avatar: npc.avatar,
        position: invitePosition.value,
        beans: npc.beans,
        score: 0,
        rank: '青铜',
        hand: [],
        discarded: [],
        exposed: [],
        isReady: true,
        isAI: true
    })
    showInvite.value = false
}

const addContact = (contact) => {
    const players = mahjongStore.currentRoom.players
    players.push({
        id: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        position: invitePosition.value,
        beans: Math.floor(Math.random() * 45000) + 5000,
        score: 0,
        rank: '青铜',
        hand: [],
        discarded: [],
        exposed: [],
        isReady: true,
        isAI: true
    })
    showInvite.value = false
}

const startGame = () => {
    // 随机选择庄家
    const players = mahjongStore.currentRoom.players
    const dealerIndex = Math.floor(Math.random() * 4)

    // 初始化gameState
    if (!mahjongStore.gameState) {
        mahjongStore.gameState = {
            dealer: dealerIndex,
            currentPlayer: dealerIndex,
            deck: [],
            pool: [],
            currentTile: null,
            wind: 'east'
        }
    } else {
        mahjongStore.gameState.dealer = dealerIndex
        mahjongStore.gameState.currentPlayer = dealerIndex
    }

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
    cursor: pointer;
    transition: all 0.3s;
}

.empty-seat:active {
    transform: scale(0.95);
    opacity: 0.8;
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
