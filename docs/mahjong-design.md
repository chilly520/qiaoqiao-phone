# 🀄 麻将游戏设计文档

## 一、游戏概述

### 游戏类型
大众麻将（可吃碰杠）

### 核心玩法
- 4人对战
- 支持吃、碰、杠、胡
- 欢乐豆系统
- 积分排行
- 边聊边打
- 偷看功能（作弊模式）

---

## 二、经济系统

### 欢乐豆
- **初始欢乐豆**: 10,000豆
- **每局底注**: 100豆/局
- **胡牌奖励**: 根据番数计算
  - 平胡: 100豆
  - 碰碰胡: 200豆
  - 清一色: 500豆
  - 杠上开花: 800豆
  - 自摸: 番数×3倍

### 充值系统
- **充值来源**: 微信钱包余额
- **充值比例**: 1元 = 1000欢乐豆
- **充值档位**:
  - 6元 = 6000豆
  - 30元 = 30000豆 + 3000赠送
  - 68元 = 68000豆 + 10000赠送
  - 128元 = 128000豆 + 20000赠送

### AI玩家欢乐豆
- **随机范围**: 5,000 - 50,000豆
- **AI不会破产**: 低于1000豆自动补充到5000豆

---

## 三、积分系统

### 积分规则
- **胜利**: +10分
- **平局**: +0分
- **失败**: -5分
- **连胜加成**: 每连胜1局额外+2分
- **段位晋升**: 
  - 青铜: 0-100分
  - 白银: 100-300分
  - 黄金: 300-600分
  - 铂金: 600-1000分
  - 钻石: 1000+分

### 排行榜
- **日榜**: 每日0点重置
- **周榜**: 每周一0点重置
- **总榜**: 永久记录

---

## 四、游戏流程

### 1. 进入游戏
```
桌面第二页 → 点击"小游戏" → 麻将大厅
```

### 2. 游戏大厅
- **快速开始**: 自动匹配3个AI
- **创建房间**: 
  - 邀请通讯录角色
  - 设置底注（100/500/1000豆）
  - 设置局数（4/8/16局）
- **房间列表**: 显示可加入的房间

### 3. 房间等待
- 显示4个座位（东南西北）
- 玩家准备状态
- 房主可以开始游戏

### 4. 游戏进行
```
发牌 → 庄家出牌 → 其他玩家依次摸牌打牌 → 
判断吃碰杠胡 → 继续游戏 → 有人胡牌或流局 → 结算
```

### 5. 结算
- 显示本局得分
- 显示累计欢乐豆
- 显示积分变化
- 继续下一局或返回大厅

---

## 五、界面布局

### 游戏主界面
```
┌─────────────────────────────────────┐
│ 顶部信息栏                            │
│ [局数: 1/8] [底注: 100] [牌堆: 72]   │
├─────────────────────────────────────┤
│              对家（上）                │
│        [头像] 张三 [10000豆]          │
│        [🀫🀫🀫🀫🀫🀫🀫🀫🀫🀫🀫🀫🀫]      │
│        打出: [🀇][🀈][🀉]              │
├──────────┬─────────────┬─────────────┤
│  左家     │   牌池中央   │    右家      │
│  [头像]   │  [🀀][🀁]   │   [头像]     │
│  李四     │  [🀂][🀃]   │   王五       │
│  8500豆   │  [🀄][🀅]   │   12000豆    │
│  [🀫]     │  [🀆][🀇]   │   [🀫]       │
│  [🀫]     │             │   [🀫]       │
│  [🀫]     │             │   [🀫]       │
├──────────┴─────────────┴─────────────┤
│              我（下）                  │
│  [头像] 我 [10000豆] [积分: 50]       │
│  [🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓]          │
│  [吃] [碰] [杠] [胡] [过] [打牌]      │
├─────────────────────────────────────┤
│ 聊天窗口 (右侧浮动)                    │
│ 张三: 这把牌不错                       │
│ 我: 加油！                            │
└─────────────────────────────────────┘
```

### 聊天窗口
- 位置: 右侧浮动
- 可折叠/展开
- 快捷语按钮
- 表情包
- AI自动发言

### 偷看面板
- 长按自己头像3秒激活
- 半透明遮罩
- 显示其他玩家手牌
- 显示剩余牌堆
- 提示最优打法

---

## 六、技术实现

### 文件结构
```
src/
├── views/
│   └── Games/
│       ├── MahjongLobby.vue      # 游戏大厅
│       ├── MahjongRoom.vue       # 房间等待
│       └── MahjongGame.vue       # 游戏主界面
├── components/
│   └── Mahjong/
│       ├── MahjongTile.vue       # 麻将牌组件
│       ├── MahjongHand.vue       # 手牌区
│       ├── MahjongPool.vue       # 牌池
│       ├── MahjongChat.vue       # 聊天窗口
│       ├── MahjongActions.vue    # 操作按钮
│       ├── MahjongCheat.vue      # 作弊面板
│       └── MahjongRecharge.vue   # 充值面板
├── stores/
│   └── mahjongStore.js           # 麻将状态管理
└── utils/
    └── mahjong/
        ├── MahjongEngine.js      # 麻将引擎
        ├── MahjongAI.js          # AI决策
        ├── MahjongRules.js       # 规则判断
        └── MahjongScorer.js      # 计分系统
```

### 数据结构

#### 玩家数据
```javascript
{
  id: 'user',
  name: '我',
  avatar: '/avatar.jpg',
  position: 'south', // east/south/west/north
  beans: 10000, // 欢乐豆
  score: 50, // 积分
  rank: '白银', // 段位
  hand: [], // 手牌 (13/14张)
  discarded: [], // 打出的牌
  exposed: [], // 明牌（吃碰杠的牌）
  isReady: false,
  isAI: false
}
```

#### 游戏状态
```javascript
{
  roomId: 'room_123',
  mode: 'quick', // quick/custom
  baseStake: 100, // 底注
  totalRounds: 8, // 总局数
  currentRound: 1, // 当前局数
  players: [], // 4个玩家
  deck: [], // 牌堆 (剩余牌)
  pool: [], // 牌池 (所有打出的牌)
  currentPlayer: 0, // 当前出牌玩家索引
  currentTile: null, // 当前打出的牌
  dealer: 0, // 庄家索引
  wind: 'east', // 场风
  status: 'waiting' // waiting/playing/settling
}
```

### 核心算法

#### 1. 胡牌判断
```javascript
// 基本胡牌型: 3n+2 (n组顺子/刻子 + 1对将)
function canWin(hand) {
  // 1. 检查是否14张牌
  if (hand.length !== 14) return false
  
  // 2. 尝试每张牌作为将牌
  for (let tile of uniqueTiles(hand)) {
    if (count(hand, tile) >= 2) {
      let remaining = remove(hand, tile, 2)
      if (isAllMelds(remaining)) {
        return true
      }
    }
  }
  return false
}

// 检查是否全是顺子/刻子
function isAllMelds(tiles) {
  if (tiles.length === 0) return true
  if (tiles.length % 3 !== 0) return false
  
  // 尝试刻子
  let tile = tiles[0]
  if (count(tiles, tile) >= 3) {
    let remaining = remove(tiles, tile, 3)
    if (isAllMelds(remaining)) return true
  }
  
  // 尝试顺子
  if (hasSequence(tiles, tile)) {
    let remaining = removeSequence(tiles, tile)
    if (isAllMelds(remaining)) return true
  }
  
  return false
}
```

#### 2. AI出牌策略
```javascript
class MahjongAI {
  decideTile(hand, pool) {
    // 1. 计算每张牌的"危险度"
    let scores = hand.map(tile => ({
      tile,
      danger: this.calculateDanger(tile, pool),
      value: this.calculateValue(tile, hand)
    }))
    
    // 2. 优先打出危险度低、价值低的牌
    scores.sort((a, b) => {
      return (a.danger + a.value) - (b.danger + b.value)
    })
    
    return scores[0].tile
  }
  
  calculateDanger(tile, pool) {
    // 已经打出很多的牌，危险度低
    let count = pool.filter(t => t === tile).length
    return 10 - count * 2
  }
  
  calculateValue(tile, hand) {
    // 孤张价值低，搭子价值高
    let neighbors = this.getNeighbors(tile, hand)
    return 10 - neighbors.length * 3
  }
}
```

---

## 七、开发计划

### Phase 1: 基础框架 (Day 1-2) ✅
- [x] 创建文件结构
- [x] 实现麻将Store
- [x] 创建游戏大厅UI
- [x] 实现房间创建/加入
- [x] 创建房间等待界面
- [x] 实现庄家选择和摇骰子

### Phase 2: 游戏引擎 (Day 3-4) ✅
- [x] 实现发牌、洗牌
- [x] 实现打牌逻辑
- [x] 实现吃碰杠判断
- [x] 实现胡牌判断
- [x] 实现番数计算

### Phase 3: AI系统 (Day 5) ✅
- [x] AI出牌决策
- [x] AI吃碰杠决策
- [x] 生成随机NPC

### Phase 4: 经济系统 (Day 6) ✅
- [x] 欢乐豆系统
- [x] 充值功能
- [x] 积分系统
- [ ] 排行榜

### Phase 5: 聊天功能 (Day 7) 🚧
- [ ] 聊天窗口
- [x] AI自动发言（已集成）
- [ ] 快捷语/表情

### Phase 6: 特殊功能 (Day 8) 🚧
- [x] 偷看功能
- [ ] 音效
- [ ] 动画优化

### Phase 7: 测试优化 (Day 9-10) 🚧
- [ ] 完整流程测试
- [ ] Bug修复
- [ ] 性能优化

---

## 八、特殊功能

### 偷看功能（作弊模式）
- **激活方式**: 长按自己头像3秒
- **功能**:
  1. 查看其他3家手牌
  2. 查看剩余牌堆
  3. AI提示最优打法
- **UI**: 半透明遮罩，点击空白处关闭

### AI聊天
- **触发时机**:
  - 摸到好牌: "这把牌不错"
  - 听牌: "就差一张了"
  - 胡牌: "胡了！不好意思"
  - 点炮: "哎呀，失误了"
  - 被胡: "运气真好"
- **聊天频率**: 每3-5回合随机发言一次

---

## 九、番数计算

### 基础番型
- **平胡**: 1番 (100豆)
- **碰碰胡**: 2番 (200豆)
- **混一色**: 3番 (300豆)
- **清一色**: 5番 (500豆)
- **七对**: 4番 (400豆)

### 特殊番型
- **杠上开花**: +2番
- **海底捞月**: +2番
- **自摸**: 番数×2
- **天胡**: 10番 (1000豆)

---

## 十、注意事项

1. **防作弊**: 偷看功能仅限单机，不影响AI决策
2. **破产保护**: 欢乐豆低于100时提示充值
3. **网络优化**: 本地游戏，无需联网
4. **存档**: 自动保存欢乐豆、积分、段位
5. **AI平衡**: AI难度适中，不会太强或太弱

---

## 十一、后续扩展

- [ ] 多种麻将规则（四川、广东、国标）
- [ ] 联机对战
- [ ] 语音聊天
- [ ] 录像回放
- [ ] 成就系统
- [ ] 皮肤商城

---

**文档版本**: v1.0  
**创建日期**: 2026-02-07  
**最后更新**: 2026-02-07
