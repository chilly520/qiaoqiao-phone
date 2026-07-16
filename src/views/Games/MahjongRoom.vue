<template>
    <div class="mahjong-room w-full h-full flex flex-col bg-emerald-50">
        <!-- 顶部导航 -->
        <div
            class="h-[50px] bg-gradient-to-r from-emerald-600 to-green-600 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/games/mahjong-lobby')"
                class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-lg font-bold text-white">房间等待</h1>
            <div class="w-10"></div>
        </div>

        <div class="m-4 bg-white rounded-2xl shadow-lg p-4">
            <div class="flex items-center gap-2">
                <div
                    class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-emerald-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">房间号</span>
                    <span class="text-gray-900 text-sm">{{ mahjongStore.currentRoom?.id?.slice(-6).toUpperCase()
                        }}</span>
                </div>
                <div
                    class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-emerald-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">底注</span>
                    <span class="text-emerald-700 text-sm">{{ mahjongStore.currentRoom?.baseStake }}豆</span>
                </div>
                <div
                    class="flex-1 flex flex-col items-center justify-center text-gray-600 px-2 py-2 bg-gray-50 rounded-xl border border-emerald-100 font-bold whitespace-nowrap">
                    <span class="text-[10px] opacity-70">局数</span>
                    <span class="text-blue-600 text-sm">{{ mahjongStore.currentRoom?.totalRounds }}局</span>
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
                        <!-- 头像显示 -->
                        <div v-if="isImageAvatar(getPlayer('east').avatar)"
                            class="w-16 h-16 rounded-full overflow-hidden mb-2">
                            <img :src="getPlayer('east').avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="text-4xl mb-2">{{ getPlayer('east').avatar || '👤' }}</div>

                        <div class="text-gray-800 text-[11px] text-center mb-1 flex flex-col items-center">
                            <div class="font-bold w-[72px] whitespace-normal break-all leading-tight">{{
                                getPlayer('east')?.name }}</div>
                            <div class="text-gray-500 font-medium text-[10px]">{{ getPlayer('east')?.beans }}豆</div>
                        </div>
                        <div v-if="getPlayer('east').isReady" class="ready-badge">已准备</div>
                    </div>
                    <div v-else class="empty-seat" @click="invitePlayer('east')">
                        <i class="fa-solid fa-plus text-5xl text-gray-300"></i>
                        <div class="text-sm text-gray-400 mt-2">邀请玩家</div>
                    </div>
                </div>

                <!-- 南位（玩家） -->
                <div class="seat-card ready shadow-emerald-100">
                    <div class="seat-label">南</div>
                    <div class="player-info w-full flex flex-col items-center">
                        <!-- 头像显示 -->
                        <div v-if="isImageAvatar(getPlayer('south')?.avatar)"
                            class="w-16 h-16 rounded-full overflow-hidden mb-2 border-2 border-emerald-200">
                            <img :src="getPlayer('south').avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="text-4xl mb-2">{{ getPlayer('south')?.avatar || '👤' }}</div>

                        <div class="text-gray-800 text-[11px] text-center mb-1 flex flex-col items-center">
                            <div class="font-bold w-[72px] whitespace-normal break-all leading-tight">{{
                                getPlayer('south')?.name }}</div>
                            <div class="text-gray-500 font-medium text-[10px]">{{ getPlayer('south')?.beans }}豆</div>
                        </div>
                        <div class="ready-badge">已准备</div>
                    </div>
                </div>

                <!-- 西位 -->
                <div class="seat-card" :class="{ 'ready': getPlayer('west')?.isReady }">
                    <div class="seat-label">西</div>
                    <div v-if="getPlayer('west')" class="player-info">
                        <!-- 头像显示 -->
                        <div v-if="isImageAvatar(getPlayer('west').avatar)"
                            class="w-16 h-16 rounded-full overflow-hidden mb-2">
                            <img :src="getPlayer('west').avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="text-4xl mb-2">{{ getPlayer('west').avatar || '👤' }}</div>

                        <div class="text-gray-800 text-[11px] text-center mb-1 flex flex-col items-center">
                            <div class="font-bold w-[72px] whitespace-normal break-all leading-tight">{{
                                getPlayer('west')?.name }}</div>
                            <div class="text-gray-500 font-medium text-[10px]">{{ getPlayer('west')?.beans }}豆</div>
                        </div>
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
                    <div v-if="getPlayer('north')" class="player-info w-full flex flex-col items-center">
                        <!-- 头像显示 -->
                        <div v-if="isImageAvatar(getPlayer('north').avatar)"
                            class="w-16 h-16 rounded-full overflow-hidden mb-2 border-2 border-emerald-200">
                            <img :src="getPlayer('north').avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="text-4xl mb-2">{{ getPlayer('north').avatar || '👤' }}</div>

                        <div class="text-gray-800 text-[11px] text-center mb-1 flex flex-col items-center">
                            <div class="font-bold w-[72px] whitespace-normal break-all leading-tight">{{
                                getPlayer('north').name }}</div>
                            <div class="text-gray-500 font-medium text-[10px]">{{ getPlayer('north').beans }}豆</div>
                        </div>
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
                class="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-xl rounded-2xl shadow-xl active:scale-95 transition-transform">
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
                            :class="inviteTab === 'npc' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'">
                            NPC
                        </button>
                        <button @click="inviteTab = 'contacts'" class="flex-1 py-2 rounded-lg font-bold transition-all"
                            :class="inviteTab === 'contacts' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'">
                            通讯录
                        </button>
                    </div>

                    <!-- NPC列表 -->
                    <div v-if="inviteTab === 'npc'" class="space-y-2">
                        <div v-for="npc in availableNPCs" :key="npc.id" @click="addNPC(npc)"
                            class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <div v-if="isImageAvatar(npc.avatar)"
                                class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                <img :src="npc.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="text-3xl">{{ npc.avatar }}</div>
                            <div class="flex-1">
                                <div class="font-bold">{{ npc.name }}</div>
                                <div class="text-sm text-gray-500">{{ npc.beans }}豆</div>
                            </div>
                            <i class="fa-solid fa-plus text-emerald-500"></i>
                        </div>
                    </div>

                    <!-- 通讯录列表 -->
                    <div v-if="inviteTab === 'contacts'" class="space-y-2">
                        <div v-for="contact in availableContacts" :key="contact.id" @click="addContact(contact)"
                            class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg active:bg-gray-100 cursor-pointer">
                            <!-- 头像显示 -->
                            <div v-if="isImageAvatar(contact.avatar)"
                                class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                                <img :src="contact.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="text-3xl">{{ contact.avatar || '👤' }}</div>

                            <div class="flex-1">
                                <div class="font-bold">{{ contact.name }}</div>
                                <div class="text-sm text-gray-500">{{ contact.signature || '在忙' }}</div>
                            </div>
                            <i class="fa-solid fa-plus text-emerald-500"></i>
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

        <!-- 自定义确认弹窗 -->
        <div v-if="showConfirmModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                <h3 class="text-lg font-bold text-center mb-4 text-gray-800">{{ confirmModal.title }}</h3>
                <p class="text-center text-gray-600 mb-6">{{ confirmModal.message }}</p>
                <div class="flex gap-3">
                    <button @click="confirmModal.onCancel()" class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95 transition-all">
                        {{ confirmModal.cancelText || '取消' }}
                    </button>
                    <button @click="confirmModal.onConfirm()" class="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
                        {{ confirmModal.confirmText || '确认' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMahjongStore } from '../../stores/mahjongStore.js'
import { useChatStore } from '../../stores/chatStore.js'
import mahjongEngine from '../../utils/mahjong/MahjongEngine.js'



const router = useRouter()
const mahjongStore = useMahjongStore()
const chatStore = useChatStore()
const showDice = ref(false)
const dealerName = ref('')
const showInvite = ref(false)
const inviteTab = ref('npc')
const invitePosition = ref('')

// 自定义确认弹窗
const showConfirmModal = ref(false)
const confirmModal = ref({
    title: '',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
    onConfirm: () => {},
    onCancel: () => {}
})

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
    const inRoomIds = mahjongStore.currentRoom?.players?.map(p => p.id) || []
    return mahjongEngine.getNPCs().filter(npc => !inRoomIds.includes(npc.id))
})

// 可选的联系人
const availableContacts = computed(() => {
    const inRoomIds = mahjongStore.currentRoom?.players?.map(p => p.id) || []
    const rawChats = chatStore.chats || {}

    // 如果是对象则转数组，如果是数组则直接用
    const chatsArray = Array.isArray(rawChats) ? rawChats : Object.values(rawChats)

    return chatsArray
        .filter(chat => !chat.isGroup && !inRoomIds.includes(chat.id))
        .map(chat => ({
            id: chat.id,
            name: chat.name,
            avatar: chat.avatar
        }))
})

// 判断是否为图片头像
const isImageAvatar = (avatar) => {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}


const getPlayer = (position) => {
    return mahjongStore.currentRoom?.players?.find(p => p.position === position)
}

const handleBack = () => {
    confirmModal.value = {
        title: '退出房间',
        message: '确定要退出房间吗？',
        confirmText: '确认',
        cancelText: '取消',
        onConfirm: () => {
            mahjongStore.currentRoom = null
            router.push('/games/mahjong-lobby')
            showConfirmModal.value = false
        },
        onCancel: () => {
            showConfirmModal.value = false
        }
    }
    showConfirmModal.value = true
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

const addContact = async (contact) => {
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
    
    // 发送系统提示：{角色设置里的用户名}正在与你一起打麻将
    const currentUserName = mahjongStore.currentRoom?.players?.find(p => p.id === 'user')?.name || '玩家'
    const timestamp = Date.now()
    const formattedTime = new Date(timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
    // [BUG FIX] addMessage 是异步函数, 需 await 确保系统消息落库 (与 MahjongLobby.vue 一致)
    await chatStore.addMessage(contact.id, {
        role: 'system',
        content: `${currentUserName}正在与你一起打麻将 [TIMESTAMP:${formattedTime}]`,
        timestamp: timestamp
    })
    
    showInvite.value = false
}

const startGame = () => {
    // 随机选择庄家
    const players = mahjongStore.currentRoom.players
    const dealerIndex = Math.floor(Math.random() * 4)

    // 初始化gameState（只设置庄家，不发牌，由MahjongGame动画触发发牌）
    mahjongStore.gameState = {
        dealer: dealerIndex,
        currentPlayer: dealerIndex,
        deck: [], // 保持为空，触发开局动画
        pool: [],
        currentTile: null,
        wind: 'east'
    }

    // 直接跳转到游戏界面
    router.push('/games/mahjong')
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
    background: linear-gradient(135deg, #fbbf24, #10b981);
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
