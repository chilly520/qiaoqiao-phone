import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from './settingsStore.js'
import mahjongEngine from '../utils/mahjong/MahjongEngine.js'
import mahjongAI from '../utils/mahjong/MahjongAI.js'
import { generateReply } from '../utils/aiService.js'

export const useMahjongStore = defineStore('mahjong', () => {
    // 状态
    const beans = ref(10000)
    const score = ref(0)
    const rank = ref('青铜')
    const wins = ref(0)
    const losses = ref(0)
    const winStreak = ref(0)

    const currentRoom = ref(null)
    const gameState = ref(null)
    const chatMessages = ref([])
    const gameChatMessages = ref([]) // 局内聊天记录
    const activeReplies = ref({}) // 实时气泡 { playerIndex: text }
    const aiInfluences = ref({}) // AI 耍赖干预 { playerIndex: { targetTile, type } }
    const unreadChatCount = ref(0)

    const cheatMode = ref(false)
    const soundEnabled = ref(true)
    const bgmEnabled = ref(true)
    const sfxVolume = ref(0.8)
    const bgmVolume = ref(0.5)
    const lastAction = ref(null)

    // 计算属性
    const winRate = computed(() => {
        const total = wins.value + losses.value
        return total === 0 ? 0 : Math.round((wins.value / total) * 100)
    })

    const rankInfo = computed(() => {
        const s = score.value
        if (s < 100) return { name: '青铜', color: '#cd7f32', icon: '🥉' }
        if (s < 300) return { name: '白银', color: '#c0c0c0', icon: '🥈' }
        if (s < 600) return { name: '黄金', color: '#ffd700', icon: '🥇' }
        if (s < 1000) return { name: '铂金', color: '#e5e4e2', icon: '💎' }
        return { name: '钻石', color: '#b9f2ff', icon: '👑' }
    })

    // --- 新增：个性化与排行榜状态 ---
    const playerStats = ref([]) // 所有打过牌的玩家数据 [{ name, avatar, score, rank, wins, losses }]
    const tablecloth = ref('') // 自定义桌布 URL 或 Base64
    const tileBacks = ref([
        { id: 'default', type: 'color', value: '#10b981', active: true, name: '经典绿' }
    ]) // 牌背预设列表
    const customTileBackImage = ref('') // 自定义牌背图片

    // 获取当前生效的牌背颜色/图片 (支持随机)
    const currentTileBack = computed(() => {
        const actives = tileBacks.value.filter(b => b.active)
        if (actives.length === 0) return { type: 'color', value: '#10b981' } // 如果都不勾选，用默认绿
        // 随机选一个
        return actives[Math.floor(Math.random() * actives.length)]
    })

    // 更新排行榜数据
    const recordPlayerStats = (player) => {
        if (!player || player.id === 'user') return
        const existing = playerStats.value.find(s => s.name === player.name)
        if (existing) {
            existing.score = (existing.score || 0) + (player.score || 0)
            existing.wins = (existing.wins || 0) + (player.wins || 0)
            existing.losses = (existing.losses || 0) + (player.losses || 0)
            // 根据分数重新计算段位（简单逻辑）
            existing.rank = calculateRankName(existing.score)
        } else {
            playerStats.value.push({
                name: player.name,
                avatar: player.avatar,
                score: player.score || 0,
                rank: calculateRankName(player.score || 0),
                wins: player.wins || 0,
                losses: player.losses || 0
            })
        }
        saveData()
    }

    const calculateRankName = (s) => {
        if (s < 100) return '青铜'
        if (s < 300) return '白银'
        if (s < 600) return '黄金'
        if (s < 1000) return '铂金'
        return '钻石'
    }

    // 排行榜：包含自己和遇到的所有 AI，按积分降序
    const leaderboard = computed(() => {
        const user = {
            name: useSettingsStore().personalization?.userProfile?.name || '我',
            avatar: useSettingsStore().personalization?.userProfile?.avatar || '👤',
            score: score.value,
            rank: rankInfo.value.name,
            isUser: true
        }
        const list = [user, ...playerStats.value]
        return list.sort((a, b) => b.score - a.score)
    })


    // 核心逻辑
    const rechargeBeans = (amount) => {
        beans.value += amount
        saveData()
        return { success: true, message: '充值成功' }
    }

    const deductBeans = (amount) => {
        if (beans.value >= amount) {
            beans.value -= amount
            saveData()
            return true
        }
        return false
    }

    const addBeans = (amount) => {
        beans.value += amount
        saveData()
    }

    const updateScore = (delta) => {
        score.value += delta
        if (delta > 0) { wins.value++; winStreak.value++ }
        else { losses.value++; winStreak.value = 0 }
        rank.value = rankInfo.value.name
        saveData()
    }

    const createRoom = async (config) => {
        const settingsStore = useSettingsStore()
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()

        currentRoom.value = {
            id: roomId,
            mode: config.mode || 'quick',
            baseStake: config.baseStake || 100,
            totalRounds: config.totalRounds || 4,
            currentRound: 1,
            players: [],
            status: 'waiting'
        }

        currentRoom.value.players.push({
            id: 'user',
            name: settingsStore.personalization?.userProfile?.name || '我',
            avatar: settingsStore.personalization?.userProfile?.avatar || '👤',
            position: 'south',
            beans: beans.value,
            score: 0,
            hand: [],
            discarded: [],
            exposed: [],
            isReady: true,
            isAI: false
        })

        if (config.mode === 'quick') await addAIPlayers(3)
        return roomId
    }

    const addAIPlayers = async (count) => {
        const positions = ['east', 'north', 'west']
        const existingCount = currentRoom.value.players.length - 1
        const takenNames = new Set(currentRoom.value.players.map(p => p.name))

        let attempts = 0
        for (let i = 0; i < count; i++) {
            if (existingCount + i >= 3) break

            let ai = null
            // Try to find a unique bot
            let offset = 0
            while (attempts < 50) {
                const candidate = mahjongAI.generateAIPlayer(existingCount + i + 1 + offset + Math.floor(Math.random() * 10))
                if (!takenNames.has(candidate.name)) {
                    ai = candidate
                    takenNames.add(ai.name)
                    break
                }
                offset++
                attempts++
            }

            // Fallback if we somehow fail (unlikely with small loops)
            if (!ai) ai = mahjongAI.generateAIPlayer(existingCount + i + 1)

            // Load character specific voice settings if it's a real character
            let chatChar = null
            try {
                // Bots usually don't have chat icons unless explicitly mapped
                // We'll skip the chatStore check for pure bots to avoid overhead or errors
                if (!ai.id.startsWith('ai_bot_')) {
                    const { useChatStore } = await import('./chatStore.js')
                    const chatStore = useChatStore()
                    chatChar = chatStore.chats ? chatStore.chats[ai.id] : null
                }
            } catch (e) {
                console.warn('[MahjongStore] Failed to load chatStore in addAIPlayers', e)
            }

            const doubaoSpeaker = chatChar?.doubaoSpeaker || ai.doubaoSpeaker
            const voiceId = chatChar?.voiceId || ai.voiceId

            currentRoom.value.players.push({
                ...ai,
                doubaoSpeaker,
                voiceId,
                position: positions[existingCount + i],
                score: 0,
                hand: [],
                discarded: [],
                exposed: [],
                isReady: true,
                isAI: true
            })
        }
    }

    const createDeck = () => {
        const tiles = []
        for (let i = 1; i <= 9; i++) {
            for (let j = 0; j < 4; j++) { tiles.push(`w${i}`); tiles.push(`t${i}`); tiles.push(`b${i}`) }
        }
        ['east', 'south', 'west', 'north', 'red', 'green', 'white'].forEach(h => {
            for (let j = 0; j < 4; j++) tiles.push(h)
        })
        return tiles
    }

    const shuffle = (deck) => {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]]
        }
        return deck
    }

    const startGame = () => {
        if (!currentRoom.value) return
        currentRoom.value.status = 'playing'
        const tiles = shuffle(createDeck())
        gameState.value = {
            deck: tiles,
            pool: [],
            currentPlayer: gameState.value?.dealer || 0,
            currentTile: null,
            drawnTile: null,
            dealer: gameState.value?.dealer || 0,
            lastPlayer: -1
        }
        currentRoom.value.players.forEach(p => {
            p.hand = []
            p.discarded = []
            p.exposed = []
            for (let i = 0; i < 13; i++) p.hand.push(gameState.value.deck.pop())
            p.hand = mahjongEngine.sortHand(p.hand)
        })
        const dealer = currentRoom.value.players[gameState.value.dealer]
        dealer.hand.push(gameState.value.deck.pop())
        dealer.hand = mahjongEngine.sortHand(dealer.hand)
    }

    const drawTile = (playerIndex) => {
        if (gameState.value?.roundResult || !currentRoom.value) return
        const player = currentRoom.value.players[playerIndex]
        if (gameState.value.deck.length === 0) { endRound(null); return }
        const tile = gameState.value.deck.pop()
        player.hand.push(tile)

        if (playerIndex === 0) gameState.value.drawnTile = tile
        else player.hand = mahjongEngine.sortHand(player.hand)

        if (mahjongEngine.canHu(player.hand)) {
            if (player.isAI && Math.random() > 0.2) {
                lastAction.value = { type: 'hu', playerIndex, time: Date.now() }
                endRound(player)
                return
            }
        }
        if (player.isAI) setTimeout(() => aiPlayTile(player), 1000 + Math.random() * 1000)
    }

    const playTile = (tileIndex) => {
        if (!gameState.value) return
        const player = currentRoom.value.players[gameState.value.currentPlayer]
        const tile = player.hand[tileIndex]
        player.hand.splice(tileIndex, 1)
        player.hand = mahjongEngine.sortHand(player.hand)
        gameState.value.drawnTile = null
        executeDiscard(player, tile)
    }

    const aiPlayTile = (player) => {
        if (gameState.value?.roundResult || !gameState.value) return
        const idx = currentRoom.value.players.indexOf(player)
        if (gameState.value.currentPlayer !== idx) return

        let tile = null
        const influence = aiInfluences.value[idx]
        if (influence && influence.type === 'favor' && player.hand.includes(influence.targetTile)) {
            tile = influence.targetTile
            delete aiInfluences.value[idx]
            console.log(`[AI] ${player.name} 耍赖打出了 ${tile}`)
        }

        if (!tile) {
            try {
                tile = mahjongAI.decideTile(player.hand, gameState.value.pool, gameState.value.deck)
            } catch (e) { tile = player.hand[0] }
        }

        const handIdx = player.hand.indexOf(tile)
        if (handIdx !== -1) player.hand.splice(handIdx, 1)
        else player.hand.shift()

        player.hand = mahjongEngine.sortHand(player.hand)
        executeDiscard(player, tile)
    }

    const executeDiscard = (player, tile) => {
        if (!gameState.value) return
        const playerIdx = currentRoom.value.players.indexOf(player)
        gameState.value.currentTile = tile
        gameState.value.lastPlayer = playerIdx
        gameState.value.pool.push(tile)
        player.discarded.push(tile)

        const handled = checkOtherPlayers(tile)
        if (!handled) setTimeout(nextTurn, 800)
    }

    const checkOtherPlayers = (tile) => {
        const players = currentRoom.value.players
        const currIdx = gameState.value.currentPlayer
        // 胡
        for (let i = 1; i <= 3; i++) {
            const idx = (currIdx + i) % 4
            const p = players[idx]
            if (mahjongEngine.canHu(p.hand, tile)) {
                if (p.isAI) {
                    if (Math.random() > 0.1) { setTimeout(() => handleAction('hu', idx), 1000); return true }
                } else return true
            }
        }
        // 碰杠
        for (let i = 1; i <= 3; i++) {
            const idx = (currIdx + i) % 4
            const p = players[idx]
            if (mahjongEngine.canGang(p.hand, tile) || mahjongEngine.canPeng(p.hand, tile)) {
                if (p.isAI) {
                    const decision = mahjongAI.decideAction(p.hand, tile, ['peng', 'gang'])
                    if (decision !== 'pass') { setTimeout(() => handleAction(decision, idx), 800); return true }
                } else return true
            }
        }
        // 吃
        const nextIdx = (currIdx + 1) % 4
        const nextP = players[nextIdx]
        if (mahjongEngine.canChi(nextP.hand, tile, 'previous').length > 0) {
            if (nextP.isAI) {
                const decision = mahjongAI.decideAction(nextP.hand, tile, ['chi'])
                if (decision === 'chi') { setTimeout(() => handleAction('chi', nextIdx), 800); return true }
            } else return true
        }
        return false
    }

    const nextTurn = () => {
        if (!currentRoom.value || !gameState.value || gameState.value?.roundResult) return
        gameState.value.currentPlayer = (gameState.value.currentPlayer + 1) % 4
        gameState.value.currentTile = null
        drawTile(gameState.value.currentPlayer)
    }

    const handleAction = (action, playerIndex = 0, chiCombo = null) => {
        if (!gameState.value) return
        lastAction.value = { type: action, playerIndex, time: Date.now() }
        const player = currentRoom.value.players[playerIndex]
        const tile = gameState.value.currentTile

        if (action === 'hu') { endRound(player); return }
        if (action === 'pass') { nextTurn(); return }

        // 只要是鸣牌且非过，就得从牌池拿走（如果是明杠/碰/吃）
        if (tile && (action === 'peng' || action === 'gang' || action === 'chi')) {
            gameState.value.pool.pop()
        }

        if (action === 'peng' || action === 'gang' || action === 'chi') gameState.value.currentPlayer = playerIndex

        if (action === 'peng') {
            let c = 0; player.hand = player.hand.filter(t => (t === tile && c < 2) ? (c++, false) : true)
            player.exposed.push({ type: 'peng', tiles: [tile, tile, tile] })
        } else if (action === 'gang') {
            if (gameState.value.currentPlayer === playerIndex && !tile) {
                // 暗杠
                const gangTiles = mahjongEngine.canAnGang(player.hand)
                const t = gangTiles[0]
                if (t) {
                    player.hand = player.hand.filter(x => x !== t)
                    player.exposed.push({ type: 'gang', tiles: [t, t, t, t], isAnGang: true })
                }
            } else {
                // 明杠
                let c = 0; player.hand = player.hand.filter(t => (t === tile && c < 3) ? (c++, false) : true)
                player.exposed.push({ type: 'gang', tiles: [tile, tile, tile, tile], isAnGang: false })
            }
            gameState.value.currentTile = null
            drawTile(playerIndex)
            return
        } else if (action === 'chi') {
            const comb = chiCombo || mahjongEngine.canChi(player.hand, tile, 'previous')[0]
            comb.forEach(t => {
                if (t !== tile) {
                    const idx = player.hand.indexOf(t)
                    if (idx !== -1) player.hand.splice(idx, 1)
                }
            })
            player.exposed.push({ type: 'chi', tiles: mahjongEngine.sortHand([...comb, tile]), from: gameState.value.lastPlayer })
        }
        player.hand = mahjongEngine.sortHand(player.hand)
        gameState.value.currentTile = null
        if (player.isAI) setTimeout(() => aiPlayTile(player), 1000)
    }

    const endRound = (winner) => {
        if (!gameState.value || !currentRoom.value) return

        const players = currentRoom.value.players

        // 流局处理
        if (!winner) {
            gameState.value.roundResult = {
                winner: null,
                type: '流局',
                fan: 0,
                isZiMo: false,
                changes: players.map((p, i) => ({
                    name: p.name,
                    amount: 0,
                    isWinner: false,
                    isPao: false,
                    idx: i
                }))
            }
            return
        }

        const winTile = gameState.value.currentTile || gameState.value.drawnTile

        // Context for detailed fan calculation
        const calcIsZiMo = !gameState.value.currentTile
        const seatMap = { 'east': 27, 'south': 28, 'west': 29, 'north': 30 } // Using engine int values directly: East=27
        // Actually engine expects seat index 0-3 for isMenFengKe(c, seat) where seat is 0..3?
        // Let's check MahjongEngine.js: isMenFengKe(c, seat) => const t = 27 + seat. So seat should be 0..3.
        const windIntMap = { 'east': 0, 'south': 1, 'west': 2, 'north': 3 }

        const context = {
            isZiMo: calcIsZiMo,
            seatWind: windIntMap[winner.position] || 0,
            roundWind: 0, // Default East round
            isLastTile: gameState.value.deck.length === 0,
            gangType: gameState.value.gangType // If we tracked it
            // We haven't implemented robust GangType tracking yet, can add later
        }

        // 重新计算番数
        const winInfo = mahjongEngine.getWinType(winner.hand, winner.exposed, winTile, context)
        const fan = winInfo.fan

        // 底分 calculation: baseStake * 2^(fan)
        const baseScore = currentRoom.value.baseStake || 100
        const totalScore = baseScore * Math.pow(2, fan)

        const isZiMo = (typeof gameState.value.leftTileCount !== 'undefined') ? (gameState.value.currentPlayer === players.indexOf(winner)) : false
        // 简单的自摸判断：如果当前操作玩家是赢家，且不是点炮胡（currentTile存在说明是点炮）
        const realIsZiMo = !gameState.value.currentTile

        const winnerIdx = players.indexOf(winner)
        const loserIdx = gameState.value.lastPlayer // 点炮的人

        const changes = []

        // 计算分数变动
        players.forEach((p, i) => {
            let amount = 0
            let isPao = false

            if (i === winnerIdx) {
                // 赢家
                if (realIsZiMo) {
                    // 自摸：三家通赔
                    amount = totalScore * 3
                } else {
                    // 点炮：一家赔
                    amount = totalScore
                }
            } else {
                // 输家
                if (realIsZiMo) {
                    // 自摸：每人赔一份
                    amount = -totalScore
                } else {
                    // 点炮：只有点炮者赔
                    if (i === loserIdx) {
                        amount = -totalScore
                        isPao = true
                    } else {
                        amount = 0
                    }
                }
            }

            // 更新玩家豆子
            p.beans += amount

            // 如果是用户(索引0)，更新全局状态
            if (i === 0) {
                if (amount > 0) {
                    addBeans(amount)
                    updateScore(fan * 10) // 赢了加分
                } else if (amount < 0) {
                    deductBeans(Math.abs(amount))
                    updateScore(-10) // 输了扣分
                }
            }

            changes.push({
                name: p.name,
                amount: amount,
                isWinner: i === winnerIdx,
                isPao: isPao,
                idx: i
            })
        })

        gameState.value.roundResult = {
            winner: winner,
            winnerHand: [...winner.hand],
            winnerExposed: JSON.parse(JSON.stringify(winner.exposed)),
            winningTile: winTile,
            fan: fan,
            isZiMo: realIsZiMo,
            type: winInfo.name,
            changes: changes
        }

        // --- 排行榜记录 ---
        players.forEach((p, i) => {
            if (p.isAI) {
                const change = changes[i]
                recordPlayerStats({
                    name: p.name,
                    avatar: p.avatar,
                    score: change.amount / 10, // 将欢乐豆变动转化为积分 (100豆=10分)
                    wins: p === winner ? 1 : 0,
                    losses: p !== winner ? 1 : 0
                })
            }
        })

        // 下局庄家：胡牌者坐庄
        gameState.value.dealer = winnerIdx
    }

    const sendGameChat = async (text) => {
        if (!text.trim() || !currentRoom.value) return

        const settingsStore = useSettingsStore()
        const userName = settingsStore.personalization?.userProfile?.name || '我'

        // 1. 发送用户消息
        gameChatMessages.value.push({ role: 'user', content: text, sender: userName, time: Date.now() })

        // 2. 识别所有在场 AI 玩家
        const allAIs = currentRoom.value.players.filter(p => p.isAI)
        if (allAIs.length === 0) return

        // 3. 准备上下文
        const { useChatStore } = await import('./chatStore.js')
        const chatStore = useChatStore()
        // settingsStore/userName moved to top

        const userPersona = settingsStore.personalization?.userProfile?.persona || '无特殊设定'

        // 聚合所有 AI 角色的人设和状态
        const charContexts = allAIs.map(ai => {
            const aiId = String(ai.id || '')
            let chatChar = null

            // 尝试通过ID查找角色
            if (chatStore && chatStore.chats) {
                // 先尝试直接通过ID查找
                chatChar = chatStore.chats[aiId]

                // 如果没找到，尝试通过名称查找
                if (!chatChar) {
                    const aiName = ai.name || ''
                    if (aiName) {
                        chatChar = Object.values(chatStore.chats).find(c =>
                            c.name === aiName || c.remark === aiName
                        )
                    }
                }
            }

            const isNpc = aiId.startsWith('npc_') || aiId.startsWith('ai_bot_')

            return {
                name: ai.name,
                position: ai.position,
                hand: (ai.hand || []).join(', '),
                isMainChar: !isNpc, // 所有非NPC都是主要角色
                persona: chatChar ? chatChar.prompt : (ai.signature || '一个爱打麻将的好友'),
                scoreStatus: `当前积分${ai.score}，排名${ai.rank}`
            }
        })

        // 过滤并识别当前在场的主要 AI 角色
        const relevantChars = charContexts.filter(c => c.isMainChar)
        console.log("[Chat] 在场主要角色:", relevantChars.map(c => c.name))
        console.log("[Chat] 在场全部 AI:", charContexts.map(c => c.name))

        if (relevantChars.length === 0) {
            console.warn("[Chat] 警告：当前房间没有主要 AI 角色，AI 回复可能会受限")
        }

        const poolStr = gameState.value.pool.slice(-15).join(', ')
        const otherPlayersText = currentRoom.value.players.map(p =>
            `${p.name}(${p.position === 'south' ? '自家/用户' : p.position})`
        ).join('，')

        const batchPrompt = `
# 局内对话调度系统
你现在正在同步协调麻将桌上的 AI 角色互动。请阅读下方的局势和角色设定，决定哪些角色会对用户【${userName}】的发言产生反应。

## 当前发言
- 发言人：${userName} (用户)
- 内容：“${text}”

## 角色设定与关系
请根据以下每个角色的设定，以及**该角色与用户的具体关系**来决定回复内容和语气。
用户人设：${userPersona}

${charContexts.map((c, i) => `### 角色 ${i + 1}: 【${c.name}】(${c.position})
   - 类型：${c.isMainChar ? '主要角色' : '普通NPC'}
   - **核心人设**：${c.persona}
   - **手牌状态**：[${c.hand}]
   - **当前局势**：${c.scoreStatus}
   - **行动指南**：请结合你的核心人设，判断你与用户【${userName}】的关系（是亲密、敌对、还是陌生人？），并基于此关系和用户人设进行互动。`).join('\n\n')}

## 牌局局势
- 桌面牌池(最近打出的)：[${poolStr}]
- 牌局进度：第${currentRoom.value.currentRound}局，牌堆剩余${gameState.value.deck.length}张
- 座次：${otherPlayersText}

## 输出要求 (必须严格遵守 JSON 格式)
请返回一个 JSON 数组。你可以根据用户的话，让一个或多个主要角色回答。NPC 除非被点名，否则尽量不说话。
返回格式示例：
[
  { "name": "角色名", "content": "回复内容(30字内)", "favor": "牌代码(可选)" }
]

## 注意事项：
1. **关系深刻化**：必须体现角色与用户的关系。如果用户是你的恋人/亲人，语气要亲昵；如果是对手，可以挑衅。
2. **人设还原**：回复必须完全符合该角色的性格、口癖和身份。
3. **局势互动**：回复应该参考当前的麻将局势（比如听牌了没、运气好不好）。
4. **耍赖/配合**：如果用户是在求牌或讨好，且该角色确实有该牌并愿意配合，请在 "favor" 字段填入牌代码（如 "w5"）。
5. **不要返回多余文字**：仅返回 JSON 数组，不要加解释。
`.trim()

        const msgs = [
            { role: 'system', content: batchPrompt },
            ...gameChatMessages.value.slice(-6).map(m => ({
                role: m.role,
                content: m.role === 'user' ? `${userName}: ${m.content}` : `${m.sender}: ${m.content}`
            }))
        ]

        try {
            const res = await generateReply(msgs, { name: 'MahjongManager' })
            if (res && res.content) {
                let jsonArr = []
                // 强大的 JSON 提取逻辑
                console.log("[Chat] 尝试提取 JSON, 原始回复长度:", res.content.length)

                // 1. 简单清理 Markdown
                let cleanText = res.content.replace(/```json/gi, '').replace(/```/g, '').trim()

                // 2. 定位最外层 []
                const start = cleanText.indexOf('[')
                const end = cleanText.lastIndexOf(']')

                let jsonText = ""
                if (start !== -1 && end !== -1 && end > start) {
                    jsonText = cleanText.substring(start, end + 1)
                }

                if (jsonText) {
                    try {
                        // 预处理：修复一些常见的 AI 输出错误
                        const sanitizedJson = jsonText
                            .replace(/\\n/g, '\n') // 处理转义换行
                            .trim()

                        jsonArr = JSON.parse(sanitizedJson)
                        console.log("[Chat] JSON 解析成功, 数组长度:", jsonArr.length)
                    } catch (e) {
                        console.error("[Chat] JSON 解析失败, 原始片段:", jsonText.substring(0, 100), "错误:", e)
                        // 尝试宽松解析 (例如末尾逗号)
                        try {
                            // 极简修复: 移除 trailing comma
                            const fixedJson = sanitizedJson.replace(/,(\s*\])/, '$1')
                            jsonArr = JSON.parse(fixedJson)
                        } catch (e2) {
                            console.error("[Chat] 宽松解析也失败")
                        }
                    }
                }

                // 如果解析失败但有内容，尝试简单的保底处理
                if ((!jsonArr || jsonArr.length === 0) && res.content.length > 5) {
                    console.log("[Chat] 进入保底处理模式, 寻找备选文字...")
                    // 尝试匹配 "内容" 字段后的文字，或者直接取前 50 个字
                    const backupContent = res.content.replace(/\[|\]|\{|\}|"name":|"content":/g, '').trim().split('\n')[0]
                    const firstChar = relevantChars[0] || charContexts[0]
                    if (firstChar) {
                        jsonArr = [{ name: firstChar.name, content: backupContent.substring(0, 50) }]
                    }
                }

                // 处理所有的回复
                console.log("[Chat] 开始遍历处理回复, 数组内容:", JSON.stringify(jsonArr))
                for (const item of jsonArr) {
                    const cleanName = String(item.name || '').trim().replace(/^["']|["']$/g, '')
                    console.log("[Chat] 正在处理回复项, 原名:", item.name, "处理后名称:", cleanName)

                    const ai = currentRoom.value.players.find(p => {
                        const pName = String(p.name || '').trim()
                        return pName === cleanName || pName.includes(cleanName) || cleanName.includes(pName)
                    })

                    if (!ai) {
                        console.warn(`[Chat] 找不到名为 ${cleanName} 的玩家, 放弃该回复. 房内玩家有:`, currentRoom.value.players.map(p => p.name))
                        continue
                    }

                    const idx = currentRoom.value.players.indexOf(ai)
                    let replyText = item.content || ""
                    if (!replyText) continue

                    // 处理 favor
                    if (item.favor) {
                        aiInfluences.value[idx] = { type: 'favor', targetTile: String(item.favor).toLowerCase() }
                    }

                    // 添加到聊天记录
                    gameChatMessages.value.push({
                        role: 'ai',
                        content: replyText,
                        sender: ai.name,
                        playerIdx: idx,
                        time: Date.now()
                    })

                    // 显示气泡
                    activeReplies.value[idx] = replyText
                    setTimeout(() => {
                        if (activeReplies.value[idx] === replyText) delete activeReplies.value[idx]
                    }, 6000)

                    // 语音合成
                    if (ai.enableTTS || settingsStore.enableTTS) {
                        const u = new SpeechSynthesisUtterance(replyText)
                        u.rate = 1.1
                        window.speechSynthesis.speak(u)
                    }
                }
            }
        } catch (err) {
            console.error("麻将群聊 AI 调用异常:", err)
        }
    }

    const saveData = () => {
        localStorage.setItem('mahjong_stats', JSON.stringify({
            beans: beans.value,
            score: score.value,
            wins: wins.value,
            losses: losses.value,
            winStreak: winStreak.value,
            rank: rank.value,
            playerStats: playerStats.value,
            tablecloth: tablecloth.value,
            tileBacks: tileBacks.value
        }))
    }

    const loadData = () => {
        const s = localStorage.getItem('mahjong_stats')
        if (!s) return

        try {
            const d = JSON.parse(s)
            if (d.beans !== undefined) beans.value = d.beans
            if (d.score !== undefined) score.value = d.score
            if (d.wins !== undefined) wins.value = d.wins
            if (d.losses !== undefined) losses.value = d.losses
            if (d.winStreak !== undefined) winStreak.value = d.winStreak
            if (d.rank !== undefined) rank.value = d.rank
            if (d.playerStats !== undefined) playerStats.value = d.playerStats
            if (d.tablecloth !== undefined) tablecloth.value = d.tablecloth
            if (d.tileBacks !== undefined) tileBacks.value = d.tileBacks
        } catch (e) {
            console.error('Failed to load mahjong stats:', e)
        }
    }

    const exitRoom = () => {
        currentRoom.value = null
        gameState.value = null
        gameChatMessages.value = []
        activeReplies.value = {}
    }

    loadData()

    return {
        beans, score, rank, wins, losses, winStreak, currentRoom, gameState, chatMessages, gameChatMessages, activeReplies,
        cheatMode, soundEnabled, bgmEnabled, sfxVolume, bgmVolume, lastAction, winRate, rankInfo, unreadChatCount,
        playerStats, tablecloth, tileBacks, currentTileBack, leaderboard,
        rechargeBeans, deductBeans, addBeans, updateScore, createRoom, addAIPlayers, startGame, playTile, nextTurn, handleAction, aiPlayTile,
        exitRoom, endRound, startNextRound: () => { if (gameState.value) gameState.value.roundResult = null; if (currentRoom.value) currentRoom.value.currentRound++ },
        sendGameChat, recordPlayerStats, saveData
    }
})
