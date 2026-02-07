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

        if (tiles.length !== 14) return false

        // 检查七对
        if (this.isSevenPairs(tiles)) return true

        // 检查标准胡牌型（3n+2）
        return this.isStandardWin(tiles)
    }

    /**
     * 检查是否是七对
     */
    isSevenPairs(tiles) {
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
        if (tiles.length !== 14) return false

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
     * 判断是否碰碰胡
     */
    isPengPengHu(tiles) {
        // 移除将牌后，检查是否全是刻子
        const uniqueTiles = [...new Set(tiles)]

        for (const pairTile of uniqueTiles) {
            const count = tiles.filter(t => t === pairTile).length
            if (count >= 2) {
                const remaining = [...tiles]
                const idx1 = remaining.indexOf(pairTile)
                remaining.splice(idx1, 1)
                const idx2 = remaining.indexOf(pairTile)
                remaining.splice(idx2, 1)

                // 检查是否全是刻子
                const counts = {}
                remaining.forEach(tile => {
                    counts[tile] = (counts[tile] || 0) + 1
                })

                const allPeng = Object.values(counts).every(c => c === 3)
                if (allPeng) return true
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
        if (hand.length !== 13) return []

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
     * 排序手牌
     */
    sortHand(hand) {
        const order = {
            'w': 1, 't': 2, 'b': 3,
            'east': 40, 'south': 41, 'west': 42, 'north': 43,
            'red': 44, 'green': 45, 'white': 46
        }

        return [...hand].sort((a, b) => {
            const aType = this.isHonor(a) ? order[a] : order[a[0]] * 10 + parseInt(a[1])
            const bType = this.isHonor(b) ? order[b] : order[b[0]] * 10 + parseInt(b[1])
            return aType - bType
        })
    }
}

export default new MahjongEngine()
