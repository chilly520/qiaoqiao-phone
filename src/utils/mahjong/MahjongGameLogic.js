/**
 * 麻将游戏逻辑
 * 处理打牌、吃碰杠胡等游戏流程
 */

import mahjongEngine from './MahjongEngine.js'
import mahjongAI from './MahjongAI.js'

export class MahjongGameLogic {
    constructor(store) {
        this.store = store
    }

    /**
     * 玩家打牌
     */
    playTile(tileIndex) {
        const { currentRoom, gameState } = this.store
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

        // AI可能发言
        const chatMsg = mahjongAI.generateChat('discard')
        if (chatMsg) {
            this.store.sendMessage(currentPlayer.id, chatMsg)
        }

        // 检查其他玩家是否可以吃碰杠胡
        this.checkActions(tile)
    }

    /**
     * 检查其他玩家可以执行的操作
     */
    checkActions(tile) {
        const { currentRoom, gameState } = this.store
        const currentPlayerIndex = gameState.currentPlayer

        // 检查每个玩家
        for (let i = 0; i < 4; i++) {
            if (i === currentPlayerIndex) continue

            const player = currentRoom.players[i]
            const actions = []

            // 检查胡牌
            if (mahjongEngine.canHu(player.hand, tile)) {
                actions.push('hu')
            }

            // 检查杠牌
            if (mahjongEngine.canGang(player.hand, tile)) {
                actions.push('gang')
            }

            // 检查碰牌
            if (mahjongEngine.canPeng(player.hand, tile)) {
                actions.push('peng')
            }

            // 检查吃牌（只有下家可以吃）
            const nextPlayer = (currentPlayerIndex + 1) % 4
            if (i === nextPlayer) {
                const chiCombinations = mahjongEngine.canChi(player.hand, tile, 'previous')
                if (chiCombinations.length > 0) {
                    actions.push('chi')
                }
            }

            // AI决策
            if (player.isAI && actions.length > 0) {
                setTimeout(() => {
                    this.aiDecideAction(player, tile, actions)
                }, 1000 + Math.random() * 1000) // 1-2秒延迟
            }
        }

        // 如果没有人操作，下一个玩家摸牌
        setTimeout(() => {
            if (gameState.currentTile === tile) {
                this.nextTurn()
            }
        }, 3000)
    }

    /**
     * AI决定操作
     */
    aiDecideAction(player, tile, actions) {
        const action = mahjongAI.decideAction(player.hand, tile, actions)

        if (action === 'hu') {
            this.performHu(player, tile)
        } else if (action === 'gang') {
            this.performGang(player, tile)
        } else if (action === 'peng') {
            this.performPeng(player, tile)
        } else if (action === 'chi') {
            this.performChi(player, tile)
        }
        // 否则pass，不做任何操作
    }

    /**
     * 执行胡牌
     */
    performHu(player, tile) {
        const { currentRoom, gameState } = this.store

        // 添加牌到手牌
        player.hand.push(tile)

        // 计算番数
        const fan = mahjongEngine.calculateFan(player.hand, {
            zimo: false
        })

        // 计算奖励
        const baseStake = currentRoom.baseStake
        const reward = baseStake * fan

        // AI发言
        const chatMsg = mahjongAI.generateChat('win')
        if (chatMsg) {
            this.store.sendMessage(player.id, chatMsg)
        }

        // 结算
        this.settle(player, reward, fan)
    }

    /**
     * 执行杠牌
     */
    performGang(player, tile) {
        const { gameState } = this.store

        // 移除手牌中的3张
        for (let i = 0; i < 3; i++) {
            const idx = player.hand.indexOf(tile)
            player.hand.splice(idx, 1)
        }

        // 添加到明牌
        player.exposed.push({
            type: 'gang',
            tiles: [tile, tile, tile, tile]
        })

        // 从牌池移除
        gameState.pool.pop()
        gameState.currentTile = null

        // AI发言
        const chatMsg = mahjongAI.generateChat('gang')
        if (chatMsg) {
            this.store.sendMessage(player.id, chatMsg)
        }

        // 杠牌后摸一张
        if (gameState.deck.length > 0) {
            player.hand.push(gameState.deck.pop())
        }
    }

    /**
     * 执行碰牌
     */
    performPeng(player, tile) {
        const { gameState } = this.store

        // 移除手牌中的2张
        for (let i = 0; i < 2; i++) {
            const idx = player.hand.indexOf(tile)
            player.hand.splice(idx, 1)
        }

        // 添加到明牌
        player.exposed.push({
            type: 'peng',
            tiles: [tile, tile, tile]
        })

        // 从牌池移除
        gameState.pool.pop()
        gameState.currentTile = null

        // AI发言
        const chatMsg = mahjongAI.generateChat('peng')
        if (chatMsg) {
            this.store.sendMessage(player.id, chatMsg)
        }

        // 碰牌后需要打一张
        if (player.isAI) {
            setTimeout(() => {
                this.aiPlayTile(player)
            }, 1000)
        }
    }

    /**
     * 执行吃牌
     */
    performChi(player, tile) {
        const { gameState } = this.store

        // 获取吃牌组合
        const combinations = mahjongEngine.canChi(player.hand, tile, 'previous')
        if (combinations.length === 0) return

        // 选择第一个组合
        const [tile1, tile2] = combinations[0]

        // 移除手牌
        const idx1 = player.hand.indexOf(tile1)
        player.hand.splice(idx1, 1)
        const idx2 = player.hand.indexOf(tile2)
        player.hand.splice(idx2, 1)

        // 添加到明牌
        player.exposed.push({
            type: 'chi',
            tiles: [tile1, tile2, tile].sort()
        })

        // 从牌池移除
        gameState.pool.pop()
        gameState.currentTile = null

        // AI发言
        const chatMsg = mahjongAI.generateChat('chi')
        if (chatMsg) {
            this.store.sendMessage(player.id, chatMsg)
        }

        // 吃牌后需要打一张
        if (player.isAI) {
            setTimeout(() => {
                this.aiPlayTile(player)
            }, 1000)
        }
    }

    /**
     * AI打牌
     */
    aiPlayTile(player) {
        const { gameState } = this.store

        // AI决定打哪张牌
        const tile = mahjongAI.decideTile(player.hand, gameState.pool, gameState.deck)

        // 移除手牌
        const idx = player.hand.indexOf(tile)
        player.hand.splice(idx, 1)

        // 添加到打出的牌
        player.discarded.push(tile)
        gameState.pool.push(tile)
        gameState.currentTile = tile

        // AI可能发言
        const chatMsg = mahjongAI.generateChat('discard')
        if (chatMsg) {
            this.store.sendMessage(player.id, chatMsg)
        }

        // 检查其他玩家是否可以吃碰杠胡
        this.checkActions(tile)
    }

    /**
     * 下一回合
     */
    nextTurn() {
        const { currentRoom, gameState } = this.store

        // 清除当前牌
        gameState.currentTile = null

        // 下一个玩家
        gameState.currentPlayer = (gameState.currentPlayer + 1) % 4
        const currentPlayer = currentRoom.players[gameState.currentPlayer]

        // 摸牌
        if (gameState.deck.length > 0) {
            const tile = gameState.deck.pop()
            currentPlayer.hand.push(tile)

            // 检查自摸
            if (mahjongEngine.canHu(currentPlayer.hand)) {
                if (currentPlayer.isAI) {
                    // AI决定是否自摸
                    if (Math.random() > 0.3) {
                        this.performZimo(currentPlayer)
                        return
                    }
                }
            }

            // AI自动打牌
            if (currentPlayer.isAI) {
                setTimeout(() => {
                    this.aiPlayTile(currentPlayer)
                }, 1000 + Math.random() * 1000)
            }
        } else {
            // 流局
            this.handleLiuJu()
        }
    }

    /**
     * 执行自摸
     */
    performZimo(player) {
        const { currentRoom } = this.store

        // 计算番数
        const fan = mahjongEngine.calculateFan(player.hand, {
            zimo: true
        })

        // 计算奖励（自摸翻倍）
        const baseStake = currentRoom.baseStake
        const reward = baseStake * fan * 2

        // AI发言
        const chatMsg = mahjongAI.generateChat('win')
        if (chatMsg) {
            this.store.sendMessage(player.id, chatMsg)
        }

        // 结算
        this.settle(player, reward, fan)
    }

    /**
     * 流局
     */
    handleLiuJu() {
        // 没有人胡牌，进入下一局
        this.nextRound()
    }

    /**
     * 结算
     */
    settle(winner, reward, fan) {
        const { currentRoom } = this.store

        // 显示结算界面
        currentRoom.status = 'settling'
        currentRoom.lastResult = {
            winner: winner.id,
            winnerName: winner.name,
            reward,
            fan,
            hand: winner.hand
        }

        // 更新欢乐豆
        if (winner.id === 'user') {
            this.store.addBeans(reward)
            this.store.updateScore(10 + fan) // 基础10分 + 番数
        } else {
            this.store.deductBeans(reward / 3) // 输家平分
            this.store.updateScore(-5)
        }

        // 3秒后进入下一局
        setTimeout(() => {
            this.nextRound()
        }, 3000)
    }

    /**
     * 下一局
     */
    nextRound() {
        const { currentRoom } = this.store

        currentRoom.currentRound++

        // 检查是否结束
        if (currentRoom.currentRound > currentRoom.totalRounds) {
            currentRoom.status = 'finished'
            return
        }

        // 重置游戏状态
        currentRoom.status = 'playing'
        currentRoom.players.forEach(p => {
            p.hand = []
            p.discarded = []
            p.exposed = []
        })

        // 重新发牌
        this.store.startGame()
    }
}

export default MahjongGameLogic
