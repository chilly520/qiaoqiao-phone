/**
 * 麻将游戏引擎
 * 负责游戏规则判断、牌型识别等核心逻辑
 */

export class MahjongEngine {
    /**
     * 判断是否可以吃牌
     * @param {Array} hand - 手牌
     * @param {String} tile - 要吃的牌
     * @param {String} position - 玩家位置（判断是否是上家打的牌）
     * @returns {Array} - 可吃的组合 [[tile1, tile2], ...]
     */
    canChi(hand, tile, position) {
        // 只能吃上家的牌
        if (position !== 'previous') return []

        // 字牌不能吃
        if (this.isHonor(tile)) return []

        const combinations = []
        const type = tile[0] // w/t/b
        const num = parseInt(tile[1])

        // 检查 [tile-2, tile-1, tile]
        if (num >= 3) {
            const t1 = `${type}${num - 2}`
            const t2 = `${type}${num - 1}`
            if (hand.includes(t1) && hand.includes(t2)) {
                combinations.push([t1, t2])
            }
        }

        // 检查 [tile-1, tile, tile+1]
        if (num >= 2 && num <= 8) {
            const t1 = `${type}${num - 1}`
            const t2 = `${type}${num + 1}`
            if (hand.includes(t1) && hand.includes(t2)) {
                combinations.push([t1, t2])
            }
        }

        // 检查 [tile, tile+1, tile+2]
        if (num <= 7) {
            const t1 = `${type}${num + 1}`
            const t2 = `${type}${num + 2}`
            if (hand.includes(t1) && hand.includes(t2)) {
                combinations.push([t1, t2])
            }
        }

        return combinations
    }

    /**
     * 获取胡牌牌型
     */
    getWinType(hand, exposed = [], newTile = null) {
        const allTilesInHand = newTile ? [...hand, newTile] : [...hand]
        const allTiles = [...allTilesInHand]
        exposed.forEach(e => allTiles.push(...e.tiles))

        const patterns = []
        let fan = 1

        // 1. 清一色
        const suits = new Set()
        let hasHonor = false
        allTiles.forEach(t => {
            if (this.isHonor(t)) hasHonor = true
            else suits.add(t[0])
        })
        if (suits.size === 1 && !hasHonor) {
            patterns.push('清一色')
            fan += 4
        } else if (suits.size === 1 && hasHonor) {
            patterns.push('混一色')
            fan += 2
        }

        // 2. 七对 (只能在全手牌且无吃碰杠时成立)
        if (allTilesInHand.length === 14 && this.isSevenPairs(allTilesInHand) && exposed.length === 0) {
            patterns.push('七对')
            fan += 3
        }

        // 3. 碰碰胡
        if (this.isPengPengHu(allTiles)) {
            patterns.push('碰碰胡')
            fan += 2
        }

        if (patterns.length === 0) {
            patterns.push('平胡')
        }

        return {
            name: patterns.join(' · '),
            fan: fan
        }
    }

    /**
     * 判断是否可以碰牌
     * @param {Array} hand - 手牌
     * @param {String} tile - 要碰的牌
     * @returns {Boolean}
     */
    canPeng(hand, tile) {
        return hand.filter(t => t === tile).length >= 2
    }

    /**
     * 判断是否可以明杠
     * @param {Array} hand - 手牌
     * @param {String} tile - 要杠的牌
     * @returns {Boolean}
     */
    canGang(hand, tile) {
        return hand.filter(t => t === tile).length >= 3
    }

    /**
     * 判断是否可以暗杠
     * @param {Array} hand - 手牌
     * @returns {Array} - 可暗杠的牌
     */
    canAnGang(hand) {
        const counts = {}
        hand.forEach(tile => {
            counts[tile] = (counts[tile] || 0) + 1
        })

        return Object.keys(counts).filter(tile => counts[tile] === 4)
    }

    /**
     * 判断是否可以胡牌
     * @param {Array} hand - 手牌（14张）
     * @param {String} newTile - 新摸的牌（可选）
     * @returns {Boolean}
     */
    canHu(hand, newTile = null) {
        const tiles = newTile ? [...hand, newTile] : [...hand]

        // 只要总张数是 14, 11, 8, 5, 2 (考虑吃碰杠后的剩余手牌)
        if (![2, 5, 8, 11, 14].includes(tiles.length)) return false

        // 检查七对
        if (this.isSevenPairs(tiles)) return true

        // 检查标准胡牌型（3n+2）
        return this.isStandardWin(tiles)
    }

    /**
     * 检查是否是七对
     */
    isSevenPairs(tiles) {
        // 七对只能在全手牌（14张）时成立
        if (tiles.length !== 14) return false

        const counts = {}
        tiles.forEach(tile => {
            counts[tile] = (counts[tile] || 0) + 1
        })

        const values = Object.values(counts)
        return values.length === 7 && values.every(v => v === 2)
    }

    /**
     * 检查是否是标准胡牌型（3n+2）
     */
    isStandardWin(tiles) {
        // 标准胡牌手牌长度必须是 3n+2
        if (![2, 5, 8, 11, 14].includes(tiles.length)) return false

        // 尝试每种牌作为将牌（对子）
        const uniqueTiles = [...new Set(tiles)]

        for (const pairTile of uniqueTiles) {
            const count = tiles.filter(t => t === pairTile).length
            if (count >= 2) {
                // 移除将牌
                const remaining = [...tiles]
                const idx1 = remaining.indexOf(pairTile)
                remaining.splice(idx1, 1)
                const idx2 = remaining.indexOf(pairTile)
                remaining.splice(idx2, 1)

                // 检查剩余牌是否都是顺子或刻子
                if (this.isAllMelds(remaining)) {
                    return true
                }
            }
        }

        return false
    }

    /**
     * 检查是否全是顺子/刻子
     */
    isAllMelds(tiles) {
        if (tiles.length === 0) return true
        if (tiles.length % 3 !== 0) return false

        const sorted = [...tiles].sort()

        // 尝试移除刻子
        const firstTile = sorted[0]
        const count = sorted.filter(t => t === firstTile).length

        if (count >= 3) {
            const remaining = [...sorted]
            for (let i = 0; i < 3; i++) {
                const idx = remaining.indexOf(firstTile)
                remaining.splice(idx, 1)
            }
            if (this.isAllMelds(remaining)) return true
        }

        // 尝试移除顺子
        if (!this.isHonor(firstTile)) {
            const type = firstTile[0]
            const num = parseInt(firstTile[1])
            const tile2 = `${type}${num + 1}`
            const tile3 = `${type}${num + 2}`

            if (sorted.includes(tile2) && sorted.includes(tile3)) {
                const remaining = [...sorted]
                remaining.splice(remaining.indexOf(firstTile), 1)
                remaining.splice(remaining.indexOf(tile2), 1)
                remaining.splice(remaining.indexOf(tile3), 1)
                if (this.isAllMelds(remaining)) return true
            }
        }

        return false
    }

    /**
     * 判断是否是字牌
     */
    isHonor(tile) {
        return ['east', 'south', 'west', 'north', 'red', 'green', 'white'].includes(tile)
    }

    /**
     * 计算番数
     * @param {Array} hand - 手牌
     * @param {Object} winInfo - 胡牌信息
     * @returns {Number}
     */
    calculateFan(hand, winInfo = {}) {
        let fan = 1 // 基础番

        // 七对
        if (this.isSevenPairs(hand)) {
            fan += 3
        }

        // 碰碰胡（全是刻子）
        if (this.isPengPengHu(hand)) {
            fan += 1
        }

        // 清一色
        if (this.isQingYiSe(hand)) {
            fan += 4
        }

        // 混一色
        if (this.isHunYiSe(hand)) {
            fan += 2
        }

        // 自摸
        if (winInfo.zimo) {
            fan += 1
        }

        // 杠上开花
        if (winInfo.gangShangKaiHua) {
            fan += 1
        }

        // 海底捞月
        if (winInfo.haiDiLaoYue) {
            fan += 1
        }

        return fan
    }

    /**
     * 判断是否碰碰胡 (包含手牌和副露)
     */
    isPengPengHu(tiles) {
        // 先检查是否胡牌
        if (!this.canHuSimple(tiles)) return false

        // 碰碰胡要求除了将牌外全是刻子
        const counts = {}
        tiles.forEach(t => counts[t] = (counts[t] || 0) + 1)

        let hasPair = false
        for (const t in counts) {
            const c = counts[t]
            if (c === 2) {
                if (hasPair) return false // 只能有一个将
                hasPair = true
            } else if (c !== 3 && c !== 4) {
                // 如果不是将，又不是刻子/杠，那就是顺子的一部分，不满足碰碰胡
                return false
            }
        }
        return hasPair
    }

    /**
     * 辅助判定胡牌（不考虑复杂规则）
     */
    canHuSimple(tiles) {
        const counts = {}
        tiles.forEach(t => counts[t] = (counts[t] || 0) + 1)
        const unique = Object.keys(counts)

        for (const pair of unique) {
            if (counts[pair] >= 2) {
                const remaining = [...tiles]
                remaining.splice(remaining.indexOf(pair), 1)
                remaining.splice(remaining.indexOf(pair), 1)
                if (this.isAllMelds(remaining)) return true
            }
        }
        return false
    }

    /**
     * 判断是否清一色
     */
    isQingYiSe(tiles) {
        const types = new Set(tiles.map(t => this.isHonor(t) ? 'honor' : t[0]))
        return types.size === 1 && !types.has('honor')
    }

    /**
     * 判断是否混一色
     */
    isHunYiSe(tiles) {
        const types = new Set(tiles.map(t => this.isHonor(t) ? 'honor' : t[0]))
        return types.size === 2 && types.has('honor')
    }

    /**
     * 获取听牌信息
     * @param {Array} hand - 手牌（13张）
     * @returns {Array} - 听的牌
     */
    getTingPai(hand) {
        // 13, 10, 7, 4, 1 张牌时都可能进入听牌状态
        if (![1, 4, 7, 10, 13].includes(hand.length)) return []

        const allTiles = this.getAllTiles()
        const tingTiles = []

        for (const tile of allTiles) {
            if (this.canHu(hand, tile)) {
                tingTiles.push(tile)
            }
        }

        return [...new Set(tingTiles)]
    }

    /**
     * 获取所有牌
     */
    getAllTiles() {
        const tiles = []

        // 万条筒
        for (let i = 1; i <= 9; i++) {
            tiles.push(`w${i}`, `t${i}`, `b${i}`)
        }

        // 字牌
        tiles.push('east', 'south', 'west', 'north', 'red', 'green', 'white')

        return tiles
    }

    /**
     * 获取可选的NPC列表
     */
    getNPCs() {
        const npcList = [
            { name: '清弦', gender: '女', signature: '古风少女，说话文绉绉的，喜欢把打牌比作弹琴。' },
            { name: '墨染', gender: '男', signature: '书生气质，打牌很儒雅，赢了会作诗，输了会叹气。' },
            { name: '寒江雪', gender: '男', signature: '高冷隐士，独来独往，牌风诡异，不爱说话。' },
            { name: '落花独立', gender: '女', signature: '多愁善感，容易悲春伤秋，打牌也像在这演戏。' },
            { name: '微雨双飞', gender: '女', signature: '活泼可爱，喜欢凑热闹，打牌时话特别多。' },
            { name: '南桥', gender: '男', signature: '豪爽侠客，出牌快，不喜欢磨磨蹭蹭。' },
            { name: '北巷', gender: '男', signature: '市井小民，喜欢讲八卦，打牌时嘴碎。' },
            { name: '独酌', gender: '男', signature: '借酒消愁，醉醺醺的，有时候会出昏招，但运气很好。' },
            { name: '醉梦', gender: '女', signature: '迷迷糊糊，经常不知道轮到谁了，但是手气惊人。' },
            { name: '浮生若梦', gender: '男', signature: '看破红尘，输赢对他来说都是浮云，心态极好。' },
            { name: '千寻', gender: '女', signature: '寻找失散多年的...并不是，只是喜欢打牌的邻家姐姐。' },
            { name: '半夏', gender: '女', signature: '温柔大方，不仅牌打得好，还会安慰输了的人。' },
            { name: '白露', gender: '男', signature: '节气拟人...不对，是个很准时的上班族，打牌很守时。' },
            { name: '青黛', gender: '女', signature: '古典美人，举手投足都很优雅，哪怕点炮也是美的。' },
            { name: '朱砂', gender: '女', signature: '热烈奔放，喜欢做大牌，即使输得很惨也要做清一色。' }
        ]

        // 尝试获取用户设置中的名字，避免重名
        let userName = '我'
        try {
            const saved = localStorage.getItem('personalization_settings')
            if (saved) {
                const settings = JSON.parse(saved)
                userName = settings.userProfile?.name || '我'
            }
        } catch (e) { }

        return npcList
            .filter(npc => npc.name !== userName)
            .map((npc, i) => ({
                id: `npc_${i}`,
                name: npc.name,
                gender: npc.gender,
                avatar: `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${encodeURIComponent(npc.name)}`,
                beans: Math.floor(Math.random() * 45000) + 5000,
                signature: npc.signature
            }))
    }

    /**
     * 排序手牌
     */
    sortHand(hand) {
        if (!Array.isArray(hand)) return hand

        const typeOrder = { 'w': 100, 't': 200, 'b': 300 }
        const honorOrder = {
            'east': 401, 'south': 402, 'west': 403, 'north': 404,
            'red': 405, 'green': 406, 'white': 407
        }

        return [...hand].sort((a, b) => {
            const getVal = (tile) => {
                if (this.isHonor(tile)) return honorOrder[tile] || 999
                const type = tile[0]
                const num = parseInt(tile[1])
                return (typeOrder[type] || 0) + num
            }
            return getVal(a) - getVal(b)
        })
    }
}

export default new MahjongEngine()
