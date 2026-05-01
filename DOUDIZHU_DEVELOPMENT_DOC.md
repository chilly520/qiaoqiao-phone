# 斗地主游戏开发文档

## 一、项目概述

### 1.1 项目背景
基于现有麻将游戏大厅的成功实现，开发斗地主（Dou Di Zhu）纸牌游戏，复用麻将的游戏框架、AI系统、聊天互动和积分体系。

### 1.2 核心特性
- ✅ **3人对战**：1个玩家 + 2个AI/NPC角色
- ✅ **双模式**：快速模式（随机NPC）+ 房间模式（与聊天角色玩）
- ✅ **完整规则**：叫地主、抢地主、出牌、炸弹、火箭、春天等
- ✅ **算分系统**：底分 × 倍数（炸弹、火箭、春天翻倍）
- ✅ **AI智能**：基于麻将AI架构，适配斗地主策略
- ✅ **局内聊天**：复用麻将群聊系统，支持角色互动
- ✅ **积分段位**：共享麻将积分体系（青铜→钻石）
- ✅ **欢乐豆系统**：充值、输赢结算

---

## 二、技术架构（参考麻将）

### 2.1 文件结构
```
src/
├── stores/
│   └── douDiZhuStore.js          # 状态管理（参考mahjongStore.js）
├── utils/doudizhu/
│   ├── DoudizhuEngine.js         # 游戏引擎（牌型判断、算分）
│   ├── DoudizhuAI.js             # AI决策系统
│   └── DoudizhuGameLogic.js      # 游戏流程控制
├── views/Games/
│   ├── DoudizhuLobby.vue         # 大厅界面
│   ├── DoudizhuRoom.vue          # 房间等待界面
│   └── DoudizhuGame.vue          # 游戏主界面
└── router/
    └── index.js                  # 添加路由
```

### 2.2 数据流
```
用户操作 → DoudizhuGame.vue (UI)
                ↓
        douDiZhuStore (状态管理)
                ↓
        DoudizhuEngine (规则引擎) ← → DoudizhuAI (AI决策)
                ↓
        DoudizhuGameLogic (流程控制)
                ↓
        更新状态 → UI响应式更新
```

---

## 三、游戏规则详细设计

### 3.1 牌组定义
```javascript
// 54张牌（一副牌 + 大小王）
const CARD_TYPES = {
    // 数字牌: 3,4,5,6,7,8,9,10,J,Q,K,A,2 (每个花色各一张 = 13×4=52张)
    // 花色: ♠(spade), ♥(heart), ♣(club), ♦(diamond)
    
    // 牌面值映射（用于比较大小）
    '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, 
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15,
    
    // 大小王
    'SMALL_JOKER': 16,  // 小王
    'BIG_JOKER': 17     // 大王（最大）
}

// 牌的表示方式
// 示例: { rank: 'A', suit: '♠', value: 14 }
// 或者简化字符串: 'SA' (Spade Ace), 'H3' (Heart 3), 'SJ' (Small Joker), 'BJ' (Big Joker)
```

### 3.2 发牌规则
- **总牌数**: 54张（含大小王）
- **每人发牌**: 17张 × 3人 = 51张
- **底牌（地主牌）**: 3张（留给地主）
- **发牌顺序**: 随机洗牌后依次发牌

### 3.3 叫地主/抢地主流程
```
1. 发牌完成后，每人查看自己的17张牌
2. 随机确定一个"首叫"玩家（可以轮换或随机）
3. 叫地主顺序: 首叫 → 下家 → 上家（循环）
4. 叫分选项:
   - 不叫 (0分)
   - 1分
   - 2分
   - 3分（最高，直接成为地主）
5. 抢地主规则:
   - 如果有人叫了1分或2分，其他人可以选择"抢"或不抢
   - 抢的人分数+1
   - 最终得分最高者成为地主
   - 如果无人叫分，重新发牌
6. 地主获得: 自己的17张 + 底牌3张 = 20张
7. 农民: 各17张
```

### 3.4 出牌规则（核心）

#### 3.4.1 基本牌型
| 牌型 | 名称 | 示例 | 张数 | 说明 |
|------|------|------|------|------|
| 单牌 | Single | 3 | 1 | 任意单张 |
| 对子 | Pair | 33 | 2 | 两张相同点数 |
| 三条 | Triple | 333 | 3 | 三张相同点数 |
| 三带一 | Triple+Single | 333+4 | 4 | 三条+1单牌 |
| 三带二 | Triple+Pair | 333+44 | 5 | 三条+1对子 |
| 顺子 | Straight | 34567 | 5+ | ≥5张连续单牌（不含2和王） |
| 连对 | Consecutive Pairs | 334455 | 6+ | ≥3组连续对子 |
| 飞机不带 | Airplane | 333444 | 6+ | ≥2组连续三条 |
| 飞机带单 | Airplane+Singles | 333444+56 | 8+ | 飞机+同数量单牌 |
| 飞机带对 | Airplane+Pairs | 333444+5566 | 10+ | 飞机+同数量对子 |
| 炸弹 | Bomb | 3333 | 4 | 四张相同点数 |
| 火箭 | Rocket | 小大王 | 2 | 大小王组合 |

#### 3.4.2 牌型比较规则
1. **基本规则**: 牌型相同才能比较，点数大的赢
2. **特殊规则**:
   - 火箭 > 炸弹 > 其他任何牌型
   - 炸弹 > 相同张数的非炸弹牌型
   - 炸弹之间比点数（如 8888 > 7777）
3. **顺子/连对/飞机**: 必须长度相同且起始点数大才更大
4. **最小牌**: 3 < 4 < ... < K < A < 2 < 小王 < 大王

#### 3.4.3 出牌流程
```
1. 地主先出第一手牌
2. 逆时针顺序轮流（地主→下家农民→上家农民→地主...）
3. 每次必须:
   - 过（Pass）：如果打不过上家的牌
   - 出牌：打出能管住上家的牌（类型相同且更大，或用炸弹/火箭）
4. 自由轮（上家都过/没人能管）:
   - 当前玩家可以出任意合法牌型
5. 先出完牌的一方获胜（地主 vs 农民团队）
```

### 3.5 算分系统

#### 3.5.1 基础倍数
```javascript
let multiplier = 1;  // 初始倍数

// 地主叫分（1/2/3分）
multiplier *= landlordBidScore;  // 1, 2, 或 3

// 每出一个炸弹，倍数×2
multiplier *= Math.pow(2, bombCount);

// 如果出了火箭，额外×2
if (hasRocket) multiplier *= 2;
```

#### 3.5.2 春天（特殊翻倍）
- **地主春天**: 地主一次出完所有牌，农民都没出过牌 → 倍数×2
- **农民春天**: 某个农民一次出完牌，地主只出过一手 → 倍数×2

#### 3.5.3 最终得分计算
```javascript
const baseScore = roomConfig.baseStake || 100;  // 底注（默认100豆）

// 地主赢了
if (landlordWon) {
    const lossPerFarmer = baseScore * multiplier;
    landlordGain = lossPerFarmer * 2;  // 地主赢得两份
    eachFarmerLoss = lossPerFarmer;     // 每个农民输一份
}

// 农民赢了（任一农民先出完）
else {
    const lossForLandlord = baseScore * multiplier * 2;
    eachFarmerGain = baseScore * multiplier;  // 每个农民赢一份
    landlordLoss = lossForLandlord;           // 地主输两份
}
```

#### 3.5.4 积分转换（参考麻将）
```javascript
// 豆子变动 → 积分（用于段位计算）
const scoreDelta = beansChange / 10;  // 100豆 = 10分

// 段位规则（与麻将共享）
// 青铜: <100分
// 白银: 100-299分
// 黄金: 300-599分
// 铂金: 600-999分
// 钻石: ≥1000分
```

---

## 四、核心模块设计

### 4.1 DoudizhuEngine.js（游戏引擎）

#### 主要功能：
```javascript
class DoudizhuEngine {
    // 1. 牌组管理
    createDeck()              // 创建54张牌
    shuffle(deck)             // 洗牌
    dealCards(deck)           // 发牌（返回{ player1, player2, player3, landlordCards }）
    
    // 2. 牌型识别
    getCardType(cards)        // 识别牌型（返回类型+权重）
    
    // 3. 牌型验证
    isValidPlay(cards)        // 是否是合法牌型
    canBeat(newCards, lastCards)  // 能否打过上一手
    
    // 4. 辅助函数
    sortByRank(cards)         // 按点数排序
    countByRank(cards)        // 统计每种点数的数量
    findAllValidPlays(hand, lastPlay)  // 找出所有可出的牌
}
```

#### 牌型识别算法（伪代码）：
```javascript
getCardType(cards) {
    const n = cards.length;
    const counts = this.countByRank(cards);  // {'3':2, '5':3, ...}
    const uniqueRanks = Object.keys(counts);
    
    // 火 rocket
    if (n === 2 && this.isRocket(cards)) return { type: 'rocket', weight: Infinity };
    
    // 炸弹 bomb
    if (n === 4 && this.isBomb(cards)) return { type: 'bomb', weight: getRankValue(cards[0]) };
    
    // 单牌 single
    if (n === 1) return { type: 'single', weight: getRankValue(cards[0]) };
    
    // 对子 pair
    if (n === 2 && counts[uniqueRanks[0]] === 2) return { type: 'pair', weight: getRankValue(cards[0]) };
    
    // 三条 triple
    if (n === 3 && counts[uniqueRanks[0]] === 3) return { type: 'triple', weight: getRankValue(cards[0]) };
    
    // 三带一/三带二
    if (n === 4 && this.hasTriple(counts)) return { type: 'triple_one', weight: tripleRank };
    if (n === 5 && this.hasTripleAndPair(counts)) return { type: 'triple_pair', weight: tripleRank };
    
    // 顺子 straight (≥5张连续单牌，不含2和王)
    if (n >= 5 && this.isStraight(cards)) return { type: 'straight', weight: startRank, length: n };
    
    // 连对 consecutive_pairs (≥3组连续对子)
    if (n >= 6 && n % 2 === 0 && this.isConsecutivePairs(cards)) return { type: 'consecutive_pairs', weight: startRank, length: n/2 };
    
    // 飞机 airplane (≥2组连续三条)
    if (this.isAirplane(cards)) return { type: 'airplane', weight: startRank, length: tripleCount };
    
    return null;  // 无效牌型
}
```

### 4.2 DoudizhuAI.js（AI决策）

#### AI策略层次（参考麻将AI）：
```javascript
class DoudizhuAI {
    // 1. 叫地主决策
    shouldBid(hand, currentMaxBid) {
        // 评估手牌强度
        const strength = this.evaluateHandStrength(hand);
        
        // 强牌策略（有炸弹、火箭、多条）
        if (strength > 0.7) return Math.min(currentMaxBid + 1, 3);
        
        // 中等牌策略
        if (strength > 0.4 && currentMaxBid < 2) return currentMaxBid + 1;
        
        // 弱牌策略
        return 0;  // 不叫
    }
    
    // 2. 出牌决策
    decidePlay(hand, lastPlay, history) {
        // 如果是自由轮（lastPlay为空）
        if (!lastPlay) {
            return this.decideFreePlay(hand);
        }
        
        // 如果需要跟牌
        const validPlays = engine.findAllValidPlays(hand, lastPlay);
        
        if (validPlays.length === 0) return null;  // 过
        
        // 选择最优出牌（考虑手牌管理和战略）
        return this.selectBestPlay(validPlays, hand, history);
    }
    
    // 3. 手牌强度评估
    evaluateHandStrength(hand) {
        let score = 0;
        
        // 火箭 (+30%)
        if (this.hasRocket(hand)) score += 0.3;
        
        // 炸弹数量 (每个+15%)
        const bombCount = this.countBombs(hand);
        score += bombCount * 0.15;
        
        // 大牌（2、王）数量
        const bigCards = hand.filter(c => ['2', 'SJ', 'BJ'].includes(c.rank)).length;
        score += bigCards * 0.05;
        
        // 控制牌（A、K）数量
        const controlCards = hand.filter(c => ['A', 'K'].includes(c.rank)).length;
        score += controlCards * 0.03;
        
        // 顺子和连对的潜力
        if (this.hasStraightPotential(hand)) score += 0.1;
        
        return Math.min(score, 1.0);  // 最大1.0
    }
    
    // 4. NPC生成（复用麻将逻辑）
    generateAIPlayer(index) {
        // 复用麻将的NPC列表和语音配置
        // 但调整signature为斗地主风格
    }
    
    // 5. 聊天消息生成（复用麻将）
    generateChat(situation) {
        // 情况: 'bid', 'play_bomb', 'win', 'lose', 'pass'
        // 返回符合角色的对话内容
    }
}
```

### 4.3 douDiZhuStore.js（状态管理）

#### 核心状态结构（参考mahjongStore）：
```javascript
export const useDouDiZhuStore = defineStore('doudizhu', () => {
    // ===== 用户数据（与麻将共享或独立）=====
    const beans = ref(10000);           // 欢乐豆
    const score = ref(0);               // 积分
    const wins = ref(0);                // 胜场
    const losses = ref(0);              // 败场
    const winStreak = ref(0);           // 连胜
    
    // ===== 房间状态 =====
    const currentRoom = ref(null);      // 当前房间信息
    const gameState = ref(null);        // 游戏进行状态
    
    // ===== 游戏阶段 =====
    // 'waiting' -> 'bidding' -> 'playing' -> 'settling' -> 'finished'
    
    // ===== 玩家数据 =====
    // players: [
    //   { id, name, avatar, position, isAI, cards: [], isLandlord: false },
    //   ...
    // ]
    
    // ===== 出牌历史 =====
    const playHistory = ref([]);        // [{ playerIndex, cards, type }]
    const currentPlay = ref(null);      // 当前桌面的牌
    const passCount = ref(0);           // 连续过牌次数
    
    // ===== 叫地主状态 =====
    const bidHistory = ref([]);         // 叫分记录
    const currentBidder = ref(0);       // 当前叫地主的人
    const landlordIndex = ref(-1);      // 地主索引
    
    // ===== 局内聊天（复用麻将）=====
    const gameChatMessages = ref([]);
    const activeReplies = ref({});
    
    // ===== 核心方法 =====
    function createRoom(config) { ... }
    function addAIPlayers(count) { ... }
    function startBidding() { ... }       // 开始叫地主
    function placeBid(playerIndex, bid) { ... }  // 叫分
    function startPlaying() { ... }       // 发完底牌开始游戏
    function playCards(playerIndex, cards) { ... }  // 出牌
    function pass(playerIndex) { ... }    // 过牌
    function endRound(winner) { ... }     // 结算
    function sendGameChat(text) { ... }   // 局内聊天（复用麻将逻辑）
});
```

### 4.4 DoudizhuGameLogic.js（流程控制）

#### 游戏主流程：
```javascript
class DoudizhuGameLogic {
    constructor(store) {
        this.store = store;
        this.engine = new DoudizhuEngine();
        this.ai = new DoudizhuAI();
    }
    
    // 1. 初始化游戏
    async initGame() {
        // 创建房间
        await this.store.createRoom({ mode: 'quick', baseStake: 100 });
        
        // 添加AI玩家
        await this.store.addAIPlayers(2);
        
        // 洗牌发牌
        const deck = this.engine.createDeck();
        this.engine.shuffle(deck);
        const dealt = this.engine.dealCards(deck);
        
        // 分配手牌
        this.store.currentRoom.players.forEach((p, i) => {
            p.cards = dealt[`player${i + 1}`];
            p.cards = this.engine.sortByRank(p.cards);
        });
        
        // 保存底牌
        this.store.gameState.landlordCards = dealt.landlordCards;
        
        // 进入叫地主阶段
        this.startBiddingPhase();
    }
    
    // 2. 叫地主阶段
    startBiddingPhase() {
        this.store.currentRoom.status = 'bidding';
        
        // 随机选择首叫者
        const firstBidder = Math.floor(Math.random() * 3);
        this.store.currentBidder = firstBidder;
        
        // 触发第一个玩家叫分
        this.promptBid(firstBidder);
    }
    
    promptBid(playerIndex) {
        const player = this.store.currentRoom.players[playerIndex];
        
        if (player.isAI) {
            setTimeout(() => {
                const bid = this.ai.shouldBid(
                    player.cards,
                    this.getMaxBidSoFar()
                );
                this.handleBid(playerIndex, bid);
            }, 1000 + Math.random() * 1000);
        }
        // 用户由UI触发 handleBid()
    }
    
    handleBid(playerIndex, bid) {
        // 记录叫分
        this.store.bidHistory.push({ playerIndex, bid });
        
        if (bid === 3) {
            // 直接成为地主
            this.setLandlord(playerIndex);
            return;
        }
        
        // 下一个人叫
        const nextPlayer = (playerIndex + 1) % 3;
        
        // 检查是否所有人都叫过一轮
        if (this.allPlayersHaveBid()) {
            this.resolveBidding();
        } else {
            this.store.currentBidder = nextPlayer;
            this.promptBid(nextPlayer);
        }
    }
    
    resolveBidding() {
        // 找最高分者成为地主
        const maxBid = Math.max(...this.store.bidHistory.map(b => b.bid));
        
        if (maxBid === 0) {
            // 没人叫，重新发牌
            this.initGame();
            return;
        }
        
        const winner = this.store.bidHistory.find(b => b.bid === maxBid);
        this.setLandlord(winner.playerIndex);
    }
    
    setLandlord(playerIndex) {
        this.store.landlordIndex = playerIndex;
        const landlord = this.store.currentRoom.players[playerIndex];
        landlord.isLandlord = true;
        
        // 地主获得底牌
        landlord.cards.push(...this.store.gameState.landlordCards);
        landlord.cards = this.engine.sortByRank(landlord.cards);
        
        // 进入出牌阶段
        this.startPlayingPhase();
    }
    
    // 3. 出牌阶段
    startPlayingPhase() {
        this.store.currentRoom.status = 'playing';
        this.store.gameState.currentPlayer = this.store.landlordIndex;
        
        // 地主先出
        this.promptPlay(this.store.landlordIndex);
    }
    
    promptPlay(playerIndex) {
        const player = this.store.currentRoom.players[playerIndex];
        
        if (player.isAI) {
            setTimeout(() => {
                const play = this.ai.decidePlay(
                    player.cards,
                    this.store.currentPlay,  // null表示自由轮
                    this.store.playHistory
                );
                
                if (play) {
                    this.handlePlay(playerIndex, play);
                } else {
                    this.handlePass(playerIndex);
                }
            }, 1000 + Math.random() * 1500);
        }
    }
    
    handlePlay(playerIndex, cards) {
        const player = this.store.currentRoom.players[playerIndex];
        
        // 从手牌移除
        cards.forEach(card => {
            const idx = player.cards.findIndex(c => 
                c.rank === card.rank && c.suit === card.suit
            );
            if (idx !== -1) player.cards.splice(idx, 1);
        });
        
        // 记录出牌
        const cardType = this.engine.getCardType(cards);
        this.store.playHistory.push({
            playerIndex,
            cards,
            type: cardType.type
        });
        this.store.currentPlay = { playerIndex, cards, type: cardType.type };
        this.store.passCount = 0;
        
        // 检查是否出完
        if (player.cards.length === 0) {
            this.endRound(player);
            return;
        }
        
        // 下一个玩家
        const nextPlayer = (playerIndex + 1) % 3;
        this.store.gameState.currentPlayer = nextPlayer;
        this.promptPlay(nextPlayer);
    }
    
    handlePass(playerIndex) {
        this.store.passCount++;
        
        // 如果连续两人过牌，下一个人自由出牌
        if (this.store.passCount >= 2) {
            this.store.currentPlay = null;
            this.store.passCount = 0;
        }
        
        const nextPlayer = (playerIndex + 1) % 3;
        this.store.gameState.currentPlayer = nextPlayer;
        this.promptPlay(nextPlayer);
    }
    
    // 4. 结算
    endRound(winner) {
        const players = this.store.currentRoom.players;
        const isLandlordWin = winner.isLandlord;
        
        // 计算倍数
        let multiplier = this.store.currentRoom.baseStake / 100;  // 归一化
        
        // 叫分倍数
        const maxBid = Math.max(...this.store.bidHistory.map(b => b.bid));
        multiplier *= maxBid || 1;
        
        // 炸弹/火箭倍数
        const bombs = this.store.playHistory.filter(p => 
            p.type === 'bomb' || p.type === 'rocket'
        ).length;
        multiplier *= Math.pow(2, bombs);
        
        // 春天检测
        const isSpring = this.checkSpring(winner);
        if (isSpring) multiplier *= 2;
        
        // 计算最终得分
        const baseScore = this.store.currentRoom.baseStake;
        const finalScore = baseScore * multiplier;
        
        // 分配豆子
        players.forEach((p, i) => {
            let amount = 0;
            
            if (isLandlordWin) {
                if (p.isLandlord) {
                    amount = finalScore * 2;  // 地主赢两份
                    p.wins++;
                } else {
                    amount = -finalScore;     // 农民各输一份
                    p.losses++;
                }
            } else {
                if (p.isLandlord) {
                    amount = -finalScore * 2;  // 地主输两份
                    p.losses++;
                } else {
                    amount = finalScore;       // 农民各赢一份
                    p.wins++;
                }
            }
            
            p.beans += amount;
            p.score += amount / 10;
            
            // 更新全局统计（如果是用户）
            if (i === 0) {
                if (amount > 0) {
                    this.store.addBeans(amount);
                    this.store.updateScore(amount / 10);
                } else {
                    this.store.deductBeans(Math.abs(amount));
                    this.store.updateScore(-Math.abs(amount) / 10);
                }
            }
        });
        
        // 保存结果
        this.store.gameState.roundResult = {
            winner,
            isLandlordWin,
            multiplier,
            changes: players.map(p => ({
                name: p.name,
                amount: p.beans - p.initialBeans,
                isWinner: p === winner
            }))
        };
        
        this.store.currentRoom.status = 'settling';
    }
}
```

---

## 五、UI组件设计

### 5.1 DoudizhuLobby.vue（大厅）
**布局参考MahjongLobby.vue**：
- 顶部导航栏（返回 + 标题"🃏斗地主" + 设置）
- 个人信息卡片（头像、昵称、段位、胜率、欢乐豆）
- 快速开始按钮
- 创建房间按钮
- 排行榜入口
- 游戏规则说明

**规则展示**：
```
• 经典三人斗地主
• 每局底注100欢乐豆
• 支持叫地主/抢地主
• 完整牌型：单/对/三带/顺子/连对/飞机/炸弹/火箭
• 炸弹和火箭翻倍计分
• 春天特殊奖励
```

### 5.2 DoudizhuRoom.vue（房间等待）
- 显示已加入玩家（最多3人）
- 等待房主开始游戏
- 聊天功能（房间模式）

### 5.3 DoudizhuGame.vue（游戏主界面）

**布局设计**：
```
┌─────────────────────────────────────┐
│  [退出] [最小化]  局:X/Y  底:100  堍:Z │  ← 顶部栏
├─────────────────────────────────────┤
│                                     │
│     ┌──────────────────┐           │
│     │  对家（上）       │           │
│     │  [头像] 名字      │           │
│     │  剩余: X 张      │           │
│     └──────────────────┘           │
│                                     │
│  ┌──────┐              ┌──────┐    │
│  │左家  │   牌池区域    │右家  │    │
│  │[头像] │  [当前出的牌] │[头像] │    │
│  │剩余:X │              │剩余:X │    │
│  └──────┘              └──────┘    │
│                                     │
│  ═════════════════════════════════  │
│  │  [我的手牌区域]                 │  ← 可点击选择
│  │  [3][3][4][5][6][K][K][A]...   │
│  ═════════════════════════════════  │
│  ┌──────────────────────────────┐  │
│  │  [出牌]  [提示]  [不出]       │  │  ← 操作栏
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**关键交互**：
1. **选牌**: 点击手牌选中/取消（高亮显示）
2. **出牌**: 点击"出牌"按钮验证并出牌
3. **提示**: 自动选择可出的牌
4. **不出/过**: 跳过本轮
5. **叫地主**: 弹窗选择叫分（0/1/2/3）
6. **底牌展示**: 叫地主结束后展示3张底牌

---

## 六、AI策略详解

### 6.1 叫地主策略
```javascript
shouldBid(hand, currentMaxBid) {
    const strength = this.evaluateHandStrength(hand);
    
    // 手牌评分维度：
    // 1. 王的数量 (0-2张): 0-30%
    // 2. 炸弹数量 (0-N个): 每个15%
    // 3. 2的数量 (0-4张): 每个5%
    // 4. A/K/Q的大牌控制力: 每个3%
    // 5. 顺子潜力: 10%
    
    // 决策矩阵：
    // strength > 0.7: 必叫，尝试叫3分
    // strength 0.5-0.7: 叫1-2分
    // strength 0.3-0.5: 只叫1分或不叫
    // strength < 0.3: 不叫
}
```

### 6.2 出牌策略
```javascript
decidePlay(hand, lastPlay, history) {
    // 策略优先级：
    
    // 1. 如果是小牌且对手可能要完了 → 保留大牌压制
    // 2. 如果自己牌少（<6张）→ 尽快出完
    // 3. 如果是自由轮 → 从最小的牌开始出
    // 4. 如果需要跟牌 → 用最小的能管住的牌
    // 5. 特殊情况：
    //    - 对手只剩单牌 → 不要拆顺子
    //    - 自己有炸弹但对手牌多 → 保留炸弹到最后
    //    - 农民配合 → 一个农民尽量出小牌，给另一个农民机会
}
```

### 6.3 NPC角色设定（参考麻将）
```javascript
const doudizhuNPCs = [
    { name: '牌神附体', signature: '自信爆棚，总觉得自己能把把春天。' },
    { name: '算牌大师', signature: '每出一张牌都要算半天，很谨慎。' },
    { name: '炸弹狂魔', signature: '手里有炸弹就忍不住想扔，管它是不是时候。' },
    { name: '佛系玩家', signature: '输赢随缘，出牌全凭感觉，经常乱出一气。' },
    { name: '心理战专家', signature: '喜欢在关键时刻装犹豫，其实早就想好了。' },
    { name: '记牌鬼才', signature: '能记住所有出过的牌，但经常忘记该自己出牌。' },
    { name: '运气王', signature: '手气好到离谱，总能摸到想要的牌。' },
    { name: '保守派', signature: '从不叫地主，当农民也只求不输就行。' },
    { name: '激进派', signature: '逢叫必抢，拿到地主就猛攻，经常崩盘。' },
    { name: '配合帝', signature: '完美队友，知道什么时候该出什么牌配合你。' },
    // ... 更多角色
];
```

---

## 七、聊天互动系统（复用麻将）

### 7.1 局内聊天
完全复用麻将的 `sendGameChat` 方法，修改prompt模板：

```javascript
const batchPrompt = `
# 斗地主局内对话调度系统
你现在正在协调斗地主牌局上的AI角色互动。

## 当前局势
- 地主: ${landlordName} (${landlordPosition})
- 你的身份: ${currentPlayerRole} (地主/农民)
- 手牌数量: ${handCount}
- 剩余牌堆: ${remainingCards}

## 最近动作
${lastActionDescription}

## 输出要求
返回JSON数组，格式同麻将...
`;
```

### 7.2 聊天触发时机
- **叫地主时**: "我来！这把稳了！" / "你们来吧，我当农民"
- **出炸弹时**: "炸死你！" / "不好意思啦~"
- **春天时**: "春天啦！哈哈哈！" / "啊...被春天了"
- **赢了/输了**: 各种情绪表达
- **被催促时**: "在想呢..." / "别急别急"

---

## 八、路由配置

```javascript
// router/index.js 添加
{
    path: '/games/doudizhu',
    name: 'DoudizhuGame',
    component: () => import('../views/Games/DoudizhuGame.vue')
},
{
    path: '/games/doudizhu-lobby',
    name: 'DoudizhuLobby',
    component: () => import('../views/Games/DoudizhuLobby.vue')
},
{
    path: '/games/doudizhu-room',
    name: 'DoudizhuRoom',
    component: () => import('../views/Games/DoudizhuRoom.vue')
}
```

---

## 九、开发计划（实施步骤）

### Phase 1: 核心引擎（预计工作量最大）
1. ✅ 创建 `DoudizhuEngine.js` - 实现所有牌型识别算法
2. ✅ 测试牌型识别的正确性（单元测试）
3. ✅ 实现 `findAllValidPlays` 方法（找出所有合法出牌）

### Phase 2: AI系统
4. ✅ 创建 `DoudizhuAI.js` - 实现基础AI策略
5. ✅ 实现叫地主决策算法
6. ✅ 实现出牌决策算法
7. ✅ 生成NPC角色列表

### Phase 3: 状态管理与流程
8. ✅ 创建 `douDiZhuStore.js` - Pinia store
9. ✅ 创建 `DoudizhuGameLogic.js` - 流程控制
10. ✅ 实现完整的游戏生命周期（创建→叫地主→出牌→结算）

### Phase 4: UI界面
11. ✅ 创建 `DoudizhuLobby.vue` - 大厅界面
12. ✅ 创建 `DoudizhuRoom.vue` - 房间等待
13. ✅ 创建 `DoudizhuGame.vue` - 游戏主界面
14. ✅ 实现牌的渲染和交互（选牌、出牌动画）

### Phase 5: 聊天与社交
15. ✅ 复用麻将聊天系统到斗地主
16. ✅ 实现结算卡片分享功能
17. ✅ 排行榜集成（可与麻将合并或独立）

### Phase 6: 优化与测试
18. ✅ 性能优化（牌的渲染、AI响应速度）
19. ✅ 边界情况处理（断线重连、异常状态恢复）
20. ✅ 用户体验优化（音效、动画、提示）

---

## 十、关键技术难点

### 10.1 牌型识别复杂度
- **挑战**: 斗地主的牌型比麻将更灵活多变
- **解决方案**: 使用递归回溯算法处理飞机、连对等复合牌型
- **参考**: 可以借鉴开源JavaScript斗地主库的算法

### 10.2 AI策略平衡性
- **挑战**: AI不能太强也不能太弱，要有娱乐性
- **解决方案**: 
  - 引入难度等级（简单/普通/困难）
  - 加入随机性和"失误"
  - 不同NPC有不同的风格（激进/保守/配合）

### 10.3 出牌提示功能
- **挑战**: 给用户提示最优出牌方案
- **解决方案**: 
  - 使用AI的 `decidePlay` 方法
  - 高亮推荐的手牌
  - 提供多种备选方案

### 10.4 性能优化
- **挑战**: 牌的频繁排序和查找
- **解决方案**:
  - 使用Map/Set优化查找
  - 缓存牌型识别结果
  - 使用Web Worker处理复杂计算（可选）

---

## 十一、测试要点

### 11.1 单元测试
- 所有牌型的正确识别
- 牌型比较逻辑
- 算分准确性
- AI决策边界条件

### 11.2 集成测试
- 完整游戏流程（从开始到结束）
- 异常情况处理（无人叫分、同时春天等）
- 聊天系统集成

### 11.3 UI测试
- 选牌交互
- 动画流畅度
- 响应式布局（不同屏幕尺寸）

---

## 十二、后续扩展方向

### 12.1 多人对战
- 支持3个真实玩家在线对战（需要服务器）
- 观战模式

### 12.2 比赛模式
- 锦标赛系统
- 排位匹配（类似王者荣耀）

### 12.3 特殊玩法
- 不洗牌模式（经典开心斗地主）
- 明牌模式（地主明牌）
- 双倍模式（每局自动加倍）

### 12.4 社交增强
- 好友约战
- 战绩分享到朋友圈
- 表情包互动

---

## 附录：参考资料

### A. 斗地主规则标准版
- 采用大众流行的经典规则
- 参考：JJ斗地主、欢乐斗地主等主流App

### B. 开源项目参考
- [dou-di-zhu-js](https://github.com/) - JavaScript斗地主引擎
- [poker](https://github.com/) - 扑克牌通用库

### C. 麻将代码参考
- 本项目的 `src/utils/mahjong/` 目录
- `src/stores/mahjongStore.js`
- `src/views/Games/Mahjong*.vue`

---

**文档版本**: v1.0  
**创建日期**: 2026-04-29  
**作者**: AI Assistant  
**状态**: 待实施
