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
        if (score.value < 1000) return { name: '青铜', color: '#cd7f32' }
        if (score.value < 5000) return { name: '白银', color: '#c0c0c0' }
        if (score.value < 10000) return { name: '黄金', color: '#ffd700' }
        if (score.value < 20000) return { name: '铂金', color: '#e5e4e2' }
        return { name: '王者', color: '#ff4500' }
    })

    // 核心逻辑
    const rechargeBeans = (amount) => {
        beans.value += amount
        saveData()
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

    const createRoom = (config) => {
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

        if (config.mode === 'quick') addAIPlayers(3)
        return roomId
    }

    const addAIPlayers = (count) => {
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

            currentRoom.value.players.push({
                ...ai,
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
                    player.exposed.push({ type: 'gang', tiles: [t, t, t, t] })
                }
            } else {
                // 明杠
                let c = 0; player.hand = player.hand.filter(t => (t === tile && c < 3) ? (c++, false) : true)
                player.exposed.push({ type: 'gang', tiles: [tile, tile, tile, tile] })
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
        if (!winner) {
            gameState.value.roundResult = { winner: { name: '无人' }, type: '流局', fan: 0, changes: players.map(p => ({ name: p.name, amount: 0 })) }
            return
        }
        const winTile = gameState.value.currentTile || gameState.value.drawnTile
        const winInfo = mahjongEngine.getWinType(winner.hand, winner.exposed, winTile)
        const fan = winInfo.fan
        const winUnit = (currentRoom.value.baseStake || 100) * Math.pow(2, fan - 1)
        const isZiMo = winTile === gameState.value.drawnTile
        const winnerIdx = players.indexOf(winner)
        const changes = players.map((p, i) => {
            let amt = (i === winnerIdx) ? (isZiMo ? winUnit * 3 : winUnit) : ((isZiMo || i === gameState.value.lastPlayer) ? -winUnit : 0)
            p.beans += amt
            if (i === 0) { if (amt > 0) addBeans(amt); else { deductBeans(-amt) }; updateScore(amt > 0 ? fan * 10 : -10) }
            return { name: p.name, amount: amt, isWinner: i === winnerIdx }
        })
        gameState.value.roundResult = { winner, winnerHand: [...winner.hand], winnerExposed: JSON.parse(JSON.stringify(winner.exposed)), winningTile: winTile, fan, isZiMo, type: winInfo.name, changes }
        gameState.value.dealer = winnerIdx
    }

    const sendGameChat = async (text) => {
        if (!text.trim() || !currentRoom.value) return

        // 1. Add User Message
        gameChatMessages.value.push({ role: 'user', content: text, sender: 'me', time: Date.now() })

        // 2. Identify AI Players
        const charAIs = currentRoom.value.players.filter(p => p.isAI && p.id && !p.id.startsWith('npc_'))
        if (charAIs.length === 0) return

        // 3. Prepare Stores
        const { useChatStore } = await import('./chatStore.js')
        const chatStore = useChatStore()
        const settingsStore = useSettingsStore()

        // User Info
        const userName = settingsStore.personalization?.userProfile?.name || '我'
        const userPersona = settingsStore.personalization?.userProfile?.persona || '无特殊设定'

        // 4. Generate Replies for each AI (Parallel or Sequential?)
        // To avoid them talking all at once every time, maybe add a chance? 
        // For now, let's let them all respond if it's a direct conversation, or filter?
        // User requested "Distinguish between different AI characters", so we treat them individually.

        for (const ai of charAIs) {
            const idx = currentRoom.value.players.indexOf(ai)
            const chatChar = chatStore.chats[ai.id]

            // Context Construction
            const charName = ai.name
            const charPersona = chatChar ? chatChar.prompt : (ai.signature || '一个爱打麻将的路人')

            // Game State Context
            const handStr = ai.hand.join(', ')
            const poolStr = gameState.value.pool.slice(-15).join(', ')
            const scoreStatus = `当前积分${ai.score}，排名${ai.rank}`

            // Other Players Context
            const otherPlayers = currentRoom.value.players.map(p =>
                `${p.name}(${p.position === 'south' ? '自家/用户' : p.position})`
            ).join('，')

            const prompt = `
# 角色设定
你是【${charName}】，正在和用户【${userName}】以及其他人打麻将。
你的性格/人设：${charPersona}
用户的人设：${userPersona}

# 当前局势
- 你的位置：${ai.position}
- 你的手牌：[${handStr}]
- 桌面牌池(最近)：[${poolStr}]
- 你的状态：${scoreStatus}
- 牌局进度：第${currentRoom.value.currentRound}局，牌堆剩余${gameState.value.deck.length}张
- 在座玩家：${otherPlayers}

# 交互指令
用户刚才说：“${text}”
请以【${charName}】的口吻回复一句话。
要求：
1. 必须符合你的人设（语气、口癖）。
2. 结合麻将局势（比如抱怨手气、嘲讽对手、或是开心听牌）。
3. 简短自然（30字以内）。
4. 如果用户在“求牌”或“耍赖”，而你手里恰好有他想要的牌，且你性格愿意配合（或被讨好），你可以在回复末尾加上 [FAVOR: 牌的代码]（例如 [FAVOR: w5]）。如果不愿意或没有，不要加。
`.trim()

            // Construct Messages Array
            // We include a simplified history to keep flow
            const recentHistory = gameChatMessages.value.slice(-6).map(m => ({
                role: m.role,
                content: m.role === 'user' ? `${userName}: ${m.content}` : `${m.sender}: ${m.content}`
            }))

            const msgs = [
                { role: 'system', content: prompt },
                ...recentHistory
            ]

            // Call AI Service
            // We use 'generateReply' but we override system prompt directly via msgs[0]
            const res = await generateReply(msgs, { name: ai.name })

            if (res && res.reply) {
                let reply = res.reply

                // Parse Favor Command
                const m = reply.match(/\[FAVOR[:：]\s*([a-z0-9]+)\]/i)
                if (m) {
                    aiInfluences.value[idx] = { type: 'favor', targetTile: m[1].toLowerCase() }
                    reply = reply.replace(/\[FAVOR.*?\]/gi, '').trim()
                }

                // Remove any "Name:" prefix if AI added it
                reply = reply.replace(new RegExp(`^${ai.name}[:：]`), '').trim()

                // Display
                gameChatMessages.value.push({ role: 'ai', content: reply, sender: ai.name, playerIdx: idx, time: Date.now() })
                activeReplies.value[idx] = reply

                // Clear bubble after 6s
                setTimeout(() => {
                    if (activeReplies.value[idx] === reply) delete activeReplies.value[idx]
                }, 6000)

                // TTS
                if (ai.enableTTS || settingsStore.enableTTS) {
                    const u = new SpeechSynthesisUtterance(reply)
                    u.rate = 1.1
                    // Try to match voice if possible (browser dependent)
                    window.speechSynthesis.speak(u)
                }
            }
        }
    }

    const saveData = () => {
        localStorage.setItem('mahjong_stats', JSON.stringify({ beans: beans.value, score: score.value, wins: wins.value, losses: losses.value, winStreak: winStreak.value, rank: rank.value }))
    }

    const loadData = () => {
        const s = localStorage.getItem('mahjong_stats'); if (!s) return
        const d = JSON.parse(s); beans.value = d.beans; score.value = d.score; wins.value = d.wins; losses.value = d.losses; winStreak.value = d.winStreak; rank.value = d.rank
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
        rechargeBeans, deductBeans, addBeans, updateScore, createRoom, addAIPlayers, startGame, playTile, nextTurn, handleAction, aiPlayTile,
        exitRoom, endRound, startNextRound: () => { if (gameState.value) gameState.value.roundResult = null; if (currentRoom.value) currentRoom.value.currentRound++ },
        sendGameChat
    }
})
