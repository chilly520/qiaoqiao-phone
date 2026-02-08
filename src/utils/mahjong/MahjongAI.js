/**
 * 麻将AI决策系统
 * 负责AI玩家的出牌、吃碰杠等决策
 */

import mahjongEngine from './MahjongEngine.js'

export class MahjongAI {
    /**
     * AI决定打哪张牌
     * @param {Array} hand - 手牌
     * @param {Array} pool - 牌池（已打出的牌）
     * @param {Array} deck - 剩余牌堆
     * @returns {String} - 要打的牌
     */
    decideTile(hand, pool = [], deck = []) {
        // 1. 检查是否听牌
        const tingTiles = mahjongEngine.getTingPai(hand.slice(0, 13))
        if (tingTiles.length > 0) {
            // 已听牌，打出不影响听牌的牌
            return this.selectSafeTile(hand, tingTiles, pool)
        }

        // 2. 计算每张牌的价值
        const scores = hand.map(tile => ({
            tile,
            danger: this.calculateDanger(tile, pool),
            value: this.calculateValue(tile, hand),
            usefulness: this.calculateUsefulness(tile, hand, deck)
        }))

        // 3. 综合评分，选择最差的牌打出
        scores.sort((a, b) => {
            const scoreA = a.danger * 0.3 + a.value * 0.4 + a.usefulness * 0.3
            const scoreB = b.danger * 0.3 + b.value * 0.4 + b.usefulness * 0.3
            return scoreA - scoreB
        })

        return scores[0].tile
    }

    /**
     * 选择安全的牌（听牌后）
     */
    selectSafeTile(hand, tingTiles, pool) {
        // 打出不影响听牌的牌
        for (const tile of hand) {
            const testHand = hand.filter(t => t !== tile)
            const newTing = mahjongEngine.getTingPai(testHand)

            // 如果打出这张牌后仍然听牌，且听的牌没有减少
            if (newTing.length >= tingTiles.length) {
                return tile
            }
        }

        // 如果没有安全的牌，打出危险度最低的
        const scores = hand.map(tile => ({
            tile,
            danger: this.calculateDanger(tile, pool)
        }))

        scores.sort((a, b) => a.danger - b.danger)
        return scores[0].tile
    }

    /**
     * 计算牌的危险度（被别人胡的可能性）
     */
    calculateDanger(tile, pool) {
        // 已经打出很多的牌，危险度低
        const count = pool.filter(t => t === tile).length
        let danger = 10 - count * 2

        // 字牌危险度较低
        if (mahjongEngine.isHonor(tile)) {
            danger -= 2
        }

        // 1、9牌危险度较低
        if (!mahjongEngine.isHonor(tile)) {
            const num = parseInt(tile[1])
            if (num === 1 || num === 9) {
                danger -= 1
            }
            // 中张牌（4、5、6）危险度高
            if (num >= 4 && num <= 6) {
                danger += 2
            }
        }

        return Math.max(0, danger)
    }

    /**
     * 计算牌的价值（对自己的用处）
     */
    calculateValue(tile, hand) {
        let value = 0

        // 检查是否有对子
        const count = hand.filter(t => t === tile).length
        if (count >= 2) {
            value += 5 // 对子很有价值
        }

        // 检查是否有搭子（顺子的一部分）
        if (!mahjongEngine.isHonor(tile)) {
            const neighbors = this.getNeighbors(tile, hand)
            value += neighbors.length * 3
        }

        return value
    }

    /**
     * 计算牌的有用性（能组成顺子/刻子的可能性）
     */
    calculateUsefulness(tile, hand, deck) {
        let usefulness = 0

        // 检查剩余牌堆中还有多少相同的牌
        const remaining = deck.filter(t => t === tile).length
        usefulness += remaining * 2

        // 检查能组成顺子的可能性
        if (!mahjongEngine.isHonor(tile)) {
            const type = tile[0]
            const num = parseInt(tile[1])

            // 检查前后牌
            for (let i = -2; i <= 2; i++) {
                if (i === 0) continue
                const n = num + i
                if (n >= 1 && n <= 9) {
                    const neighborTile = `${type}${n}`
                    if (hand.includes(neighborTile)) {
                        usefulness += 2
                    }
                }
            }
        }

        return usefulness
    }

    /**
     * 获取相邻的牌
     */
    getNeighbors(tile, hand) {
        if (mahjongEngine.isHonor(tile)) return []

        const type = tile[0]
        const num = parseInt(tile[1])
        const neighbors = []

        // 检查前后两张牌
        for (let i = -2; i <= 2; i++) {
            if (i === 0) continue
            const n = num + i
            if (n >= 1 && n <= 9) {
                const neighborTile = `${type}${n}`
                if (hand.includes(neighborTile)) {
                    neighbors.push(neighborTile)
                }
            }
        }

        return neighbors
    }

    /**
     * AI决定是否吃碰杠胡
     * @param {Array} hand - 手牌
     * @param {String} tile - 当前牌
     * @param {Array} actions - 可执行的操作 ['chi', 'peng', 'gang', 'hu']
     * @returns {String} - 选择的操作 'chi'/'peng'/'gang'/'hu'/'pass'
     */
    decideAction(hand, tile, actions) {
        // 1. 优先胡牌
        if (actions.includes('hu')) {
            return 'hu'
        }

        // 2. 检查是否听牌
        const tingTiles = mahjongEngine.getTingPai(hand)
        const isTing = tingTiles.length > 0

        // 3. 如果已听牌，不吃不碰（除非能胡）
        if (isTing) {
            // 杠牌可能改变听牌，谨慎考虑
            if (actions.includes('gang')) {
                return Math.random() > 0.8 ? 'gang' : 'pass'
            }
            return 'pass'
        }

        // 4. 杠牌（80% 概率）
        if (actions.includes('gang')) {
            return Math.random() > 0.2 ? 'gang' : 'pass'
        }

        // 5. 碰牌（90% 概率）
        if (actions.includes('peng')) {
            // 检查碰牌后是否更接近胡牌
            const testHand = [...hand, tile]
            const newTing = mahjongEngine.getTingPai(testHand)

            if (newTing.length > 0) {
                return 'peng' // 碰牌后能听牌，100% 碰
            }

            return Math.random() > 0.1 ? 'peng' : 'pass'
        }

        // 6. 吃牌（70% 概率）
        if (actions.includes('chi')) {
            // 检查吃牌后是否更接近胡牌
            const combinations = mahjongEngine.canChi(hand, tile, 'previous')
            if (combinations.length > 0) {
                const testHand = [...hand, tile]
                const newTing = mahjongEngine.getTingPai(testHand)

                if (newTing.length > 0) {
                    return 'chi' // 吃牌后能听牌，100% 吃
                }
            }

            return Math.random() > 0.3 ? 'chi' : 'pass'
        }


        return 'pass'
    }

    /**
     * AI生成聊天消息
     * @param {String} situation - 情况 'win'/'peng'/'gang'/'discard'/'ting'
     * @param {Object} context - 上下文信息
     * @returns {String} - 聊天消息
     */
    generateChat(situation, context = {}) {
        const messages = {
            win: [
                '胡了！',
                '不好意思啊',
                '运气不错',
                '哈哈，赢了',
                '这把牌还行'
            ],
            peng: [
                '碰！',
                '谢谢',
                '正好需要',
                '碰了'
            ],
            gang: [
                '杠！',
                '杠上开花',
                '来一个杠'
            ],
            chi: [
                '吃了',
                '谢谢'
            ],
            discard: [
                '',
                '',
                '',
                '这张不要了',
                '出一张'
            ],
            ting: [
                '听牌了',
                '就差一张',
                '快胡了'
            ],
            lose: [
                '运气不好',
                '下次一定',
                '可惜了',
                '差一点'
            ],
            start: [
                '开始吧',
                '来玩一局',
                '加油',
                ''
            ]
        }

        const options = messages[situation] || ['']
        const message = options[Math.floor(Math.random() * options.length)]

        // 有30%的概率不发言
        return Math.random() > 0.3 ? message : ''
    }

    /**
     * 生成随机AI玩家信息
     */
    /**
     * 生成随机AI玩家信息
     */
    generateAIPlayer(index) {
        const bots = [
            { name: '绝代双椒', gender: '女', signature: '性格火爆，输了会骂人，赢了会嘲讽的辣妹子。' },
            { name: '乔大狸子', gender: '男', signature: '深思熟虑，每一步都算计很久的老油条。' },
            { name: '麻将桌上吴彦祖', gender: '男', signature: '自恋狂，觉得自己打牌最帅，输赢无所谓。' },
            { name: '吃饱了再战', gender: '男', signature: '吃货，打牌时总是在聊吃的，性格随和。' },
            { name: '胡牌救不了打工人', gender: '女', signature: '社畜，充满怨气，总是抱怨加班和生活。' },
            { name: '杠精本精', gender: '男', signature: '特别喜欢杠，不管是牌还是说话，专门抬杠。' },
            { name: '碰瓷专业户', gender: '女', signature: '激进派，也就是喜欢碰牌，不按套路出牌。' },
            { name: '听牌也要优雅', gender: '女', signature: '贵妇人设，打牌很讲究，讨厌别人催促。' },
            { name: '这把稳了', gender: '男', signature: '迷之自信，每次都说自己要胡了，结果经常点炮。' },
            { name: '欢乐豆收割机', gender: '女', signature: '高冷高手，话少，专注于赢豆子。' },
            { name: '资深潜水员', gender: '男', signature: '社恐，几乎不怎么说话，默默打牌。' },
            { name: '不胡不睡', gender: '男', signature: '执着狂，输了不服气，非要赢一把才行。' },
            { name: '摸鱼冠军', gender: '女', signature: '正在上班摸鱼，打牌心不在焉，偶尔会挂机。' },
            { name: '退堂鼓选手', gender: '男', signature: '胆小慎重，稍微有点危险就弃牌防守。' },
            { name: '全村的希望', gender: '男', signature: '朴实的老乡，说话带点土味，很看重输赢。' }
        ]

        // Use index to pick a specific bot to avoid duplicates if called sequentially
        // or random if index is large
        const bot = bots[index % bots.length] || bots[Math.floor(Math.random() * bots.length)]

        // Randomize avatar seed
        const seed = bot.name + Math.random().toString(36).substring(7)
        const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`

        const beans = Math.floor(Math.random() * 45000) + 5000 // 5000-50000

        return {
            id: `ai_bot_${index}_${Date.now()}`,
            name: bot.name,
            gender: bot.gender,
            signature: bot.signature,
            avatar: avatar,
            beans,
            personality: Math.random() > 0.5 ? 'aggressive' : 'conservative'
        }
    }
}

export default new MahjongAI()
