import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWalletStore } from './walletStore'
import mahjongEngine from '../utils/mahjong/MahjongEngine.js'
import mahjongAI from '../utils/mahjong/MahjongAI.js'

export const useMahjongStore = defineStore('mahjong', () => {
    // ===== 状态 =====
    const beans = ref(10000) // 欢乐豆
    const score = ref(0) // 积分
    const rank = ref('青铜') // 段位
    const wins = ref(0) // 胜场
    const losses = ref(0) // 败场
    const winStreak = ref(0) // 连胜

    // 当前房间
    const currentRoom = ref(null)

    // 游戏状态
    const gameState = ref(null)

    // 聊天记录
    const chatMessages = ref([])

    // 作弊模式
    const cheatMode = ref(false)

    // ===== 计算属性 =====
    const winRate = computed(() => {
        const total = wins.value + losses.value
        return total > 0 ? ((wins.value / total) * 100).toFixed(1) : 0
    })

    const rankInfo = computed(() => {
        const ranks = [
            { name: '青铜', min: 0, max: 100, color: '#CD7F32' },
            { name: '白银', min: 100, max: 300, color: '#C0C0C0' },
            { name: '黄金', min: 300, max: 600, color: '#FFD700' },
            { name: '铂金', min: 600, max: 1000, color: '#E5E4E2' },
            { name: '钻石', min: 1000, max: Infinity, color: '#B9F2FF' }
        ]

        return ranks.find(r => score.value >= r.min && score.value < r.max) || ranks[0]
    })

    // ===== 方法 =====

    /**
     * 充值欢乐豆
     */
    const rechargeBeans = (amount) => {
        const walletStore = useWalletStore()
        const cost = amount / 1000 // 1元 = 1000豆

        if (walletStore.balance < cost) {
            return { success: false, message: '余额不足' }
        }

        walletStore.deduct(cost)
        beans.value += amount
        saveBeans()

        return { success: true, message: `充值成功！获得${amount}欢乐豆` }
    }

    /**
     * 扣除欢乐豆
     */
    const deductBeans = (amount) => {
        if (beans.value < amount) {
            return false
        }
        beans.value -= amount
        saveBeans()
        return true
    }

    /**
     * 增加欢乐豆
     */
    const addBeans = (amount) => {
        beans.value += amount
        saveBeans()
    }

    /**
     * 更新积分
     */
    const updateScore = (change) => {
        score.value += change

        // 更新段位
        rank.value = rankInfo.value.name

        // 更新胜负记录
        if (change > 0) {
            wins.value++
            winStreak.value++
        } else if (change < 0) {
            losses.value++
            winStreak.value = 0
        }

        saveScore()
    }

    /**
     * 创建房间
     */
    const createRoom = (config) => {
        const roomId = `room_${Date.now()}`

        currentRoom.value = {
            id: roomId,
            mode: config.mode || 'quick',
            baseStake: config.baseStake || 100,
            totalRounds: config.totalRounds || 8,
            currentRound: 0,
            players: [
                {
                    id: 'user',
                    name: '我',
                    avatar: '/avatars/user.png',
                    position: 'south',
                    beans: beans.value,
                    score: score.value,
                    rank: rank.value,
                    hand: [],
                    discarded: [],
                    exposed: [],
                    isReady: true,
                    isAI: false
                }
            ],
            status: 'waiting'
        }

        return currentRoom.value
    }

    /**
     * 加入AI玩家
     */
    const addAIPlayers = () => {
        if (!currentRoom.value) return

        const aiNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八']
        const positions = ['east', 'north', 'west']

        for (let i = 0; i < 3; i++) {
            const aiName = aiNames[Math.floor(Math.random() * aiNames.length)]
            const aiBeans = Math.floor(Math.random() * 45000) + 5000 // 5000-50000

            currentRoom.value.players.push({
                id: `ai_${i}`,
                name: aiName,
                avatar: `/avatars/ai_${i + 1}.png`,
                position: positions[i],
                beans: aiBeans,
                score: 0,
                rank: '青铜',
                hand: [],
                discarded: [],
                exposed: [],
                isReady: true,
                isAI: true
            })
        }
    }

    /**
     * 开始游戏
     */
    const startGame = () => {
        if (!currentRoom.value) return

        currentRoom.value.status = 'playing'
        if (!currentRoom.value.currentRound) {
            currentRoom.value.currentRound = 1
        }

        // 初始化游戏状态（保留已设置的庄家）
        if (!gameState.value) {
            gameState.value = {
                deck: [],
                pool: [],
                currentPlayer: 0,
                currentTile: null,
                dealer: 0,
                wind: 'east'
            }
        } else {
            gameState.value.deck = []
            gameState.value.pool = []
            gameState.value.currentTile = null
        }

        // 当前玩家设置为庄家
        gameState.value.currentPlayer = gameState.value.dealer

        // 发牌
        dealCards()
    }

    /**
     * 发牌
     */
    const dealCards = () => {
        // 创建牌堆（136张）
        const tiles = createDeck()
        gameState.value.deck = shuffle(tiles)

        // 每人发13张
        currentRoom.value.players.forEach(player => {
            player.hand = []
            player.discarded = []
            player.exposed = []
            for (let i = 0; i < 13; i++) {
                player.hand.push(gameState.value.deck.pop())
            }
            // 排序手牌
            player.hand = mahjongEngine.sortHand(player.hand)
        })

        // 庄家摸第14张
        const dealer = currentRoom.value.players[gameState.value.dealer]
        dealer.hand.push(gameState.value.deck.pop())
        dealer.hand = mahjongEngine.sortHand(dealer.hand)
    }

    /**
     * 创建牌堆
     */
    const createDeck = () => {
        const tiles = []

        // 万子 1-9
        for (let i = 1; i <= 9; i++) {
            for (let j = 0; j < 4; j++) {
                tiles.push(`w${i}`)
            }
        }

        // 条子 1-9
        for (let i = 1; i <= 9; i++) {
            for (let j = 0; j < 4; j++) {
                tiles.push(`t${i}`)
            }
        }

        // 筒子 1-9
        for (let i = 1; i <= 9; i++) {
            for (let j = 0; j < 4; j++) {
                tiles.push(`b${i}`)
            }
        }

        // 字牌：东南西北中发白
        const honors = ['east', 'south', 'west', 'north', 'red', 'green', 'white']
        honors.forEach(h => {
            for (let j = 0; j < 4; j++) {
                tiles.push(h)
            }
        })

        return tiles
    }

    /**
     * 洗牌
     */
    const shuffle = (array) => {
        const arr = [...array]
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
        }
        return arr
    }

    /**
     * 发送聊天消息
     */
    const sendMessage = (playerId, message) => {
        chatMessages.value.push({
            id: Date.now(),
            playerId,
            playerName: currentRoom.value.players.find(p => p.id === playerId)?.name || '未知',
            message,
            timestamp: Date.now()
        })

        // 保持最多50条消息
        if (chatMessages.value.length > 50) {
            chatMessages.value.shift()
        }
    }

    /**
     * 切换作弊模式
     */
    const toggleCheat = () => {
        cheatMode.value = !cheatMode.value
    }

    /**
     * 保存欢乐豆
     */
    const saveBeans = () => {
        localStorage.setItem('mahjong_beans', beans.value.toString())
    }

    /**
     * 保存积分
     */
    const saveScore = () => {
        const data = {
            score: score.value,
            rank: rank.value,
            wins: wins.value,
            losses: losses.value,
            winStreak: winStreak.value
        }
        localStorage.setItem('mahjong_score', JSON.stringify(data))
    }

    /**
     * 加载数据
     */
    const loadData = () => {
        // 加载欢乐豆
        const savedBeans = localStorage.getItem('mahjong_beans')
        if (savedBeans) {
            beans.value = parseInt(savedBeans)
        }

        // 加载积分
        const savedScore = localStorage.getItem('mahjong_score')
        if (savedScore) {
            const data = JSON.parse(savedScore)
            score.value = data.score || 0
            rank.value = data.rank || '青铜'
            wins.value = data.wins || 0
            losses.value = data.losses || 0
            winStreak.value = data.winStreak || 0
        }
    }

    // 初始化时加载数据
    loadData()

    /**
     * 玩家打牌
     */
    const playTile = (tileIndex) => {
        const { currentRoom, gameState } = { currentRoom: currentRoom.value, gameState: gameState.value }
        if (!currentRoom || !gameState) return

        const currentPlayer = currentRoom.players[gameState.currentPlayer]

        // 只有玩家自己才能打牌
        if (currentPlayer.id !== 'user') return

        // 移除手牌
        const tile = currentPlayer.hand.splice(tileIndex, 1)[0]

        // 添加到打出的牌
        currentPlayer.discarded.push(tile)
        gameState.pool.push(tile)
        gameState.currentTile = tile

        // 下一回合
        setTimeout(() => {
            nextTurn()
        }, 1000)
    }

    /**
     * 下一回合
     */
    const nextTurn = () => {
        const room = currentRoom.value
        const state = gameState.value

        if (!room || !state) return

        // 清除当前牌
        state.currentTile = null

        // 下一个玩家
        state.currentPlayer = (state.currentPlayer + 1) % 4
        const currentPlayer = room.players[state.currentPlayer]

        // 摸牌
        if (state.deck.length > 0) {
            const tile = state.deck.pop()
            currentPlayer.hand.push(tile)

            // AI自动打牌
            if (currentPlayer.isAI) {
                setTimeout(() => {
                    aiPlayTile(currentPlayer)
                }, 1000 + Math.random() * 1000)
            }
        } else {
            // 流局
            handleLiuJu()
        }
    }

    /**
     * AI打牌
     */
    const aiPlayTile = (player) => {
        const state = gameState.value

        // AI决定打哪张牌
        const tile = mahjongAI.decideTile(player.hand, state.pool, state.deck)

        // 移除手牌
        const idx = player.hand.indexOf(tile)
        player.hand.splice(idx, 1)

        // 添加到打出的牌
        player.discarded.push(tile)
        state.pool.push(tile)
        state.currentTile = tile

        // AI可能发言
        const chatMsg = mahjongAI.generateChat('discard')
        if (chatMsg) {
            sendMessage(player.id, chatMsg)
        }

        // 下一回合
        setTimeout(() => {
            nextTurn()
        }, 1000)
    }

    /**
     * 流局
     */
    const handleLiuJu = () => {
        // 没有人胡牌，进入下一局
        nextRound()
    }

    /**
     * 下一局
     */
    const nextRound = () => {
        const room = currentRoom.value

        room.currentRound++

        // 检查是否结束
        if (room.currentRound > room.totalRounds) {
            room.status = 'finished'
            return
        }

        // 重置游戏状态
        room.status = 'playing'
        room.players.forEach(p => {
            p.hand = []
            p.discarded = []
            p.exposed = []
        })

        // 重新发牌
        startGame()
    }

    return {
        // 状态
        beans,
        score,
        rank,
        wins,
        losses,
        winStreak,
        currentRoom,
        gameState,
        chatMessages,
        cheatMode,

        // 计算属性
        winRate,
        rankInfo,

        // 方法
        rechargeBeans,
        deductBeans,
        addBeans,
        updateScore,
        createRoom,
        addAIPlayers,
        startGame,
        sendMessage,
        toggleCheat,
        loadData,
        playTile,
        nextTurn
    }
})
