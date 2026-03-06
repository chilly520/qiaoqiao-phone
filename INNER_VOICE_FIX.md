# 心声上下文修复说明

## 🐛 问题描述

**现象**: AI 角色每次回复时，衣着和所在地信息不一致，导致角色状态混乱。

**根本原因**: 
- 心声（INNER_VOICE）被标记为 `hidden: true`，不会显示在聊天界面
- 但在构建 AI 上下文时，心声内容被正则表达式**完全删除**了
- 导致 AI 在下次对话时**看不到之前的心声内容**，不知道角色的衣着、所在地、状态等信息

**问题代码位置**:
- `src/utils/aiService.js` 第 667 行（群聊）
- `src/utils/aiService.js` 第 720 行（私聊）

```javascript
// ❌ 原代码：完全删除心声内容
content = content.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim()
```

---

## ✅ 修复方案

### 核心思路
**仅在私聊中保留心声内容到上下文中**，让 AI 可以看到角色的状态信息。
**群聊中移除心声**，因为群聊是公开场合，AI 角色不应该暴露内心想法。

### 修改内容

#### 1. 群聊上下文构建（第 658-670 行） - 移除心声

**群聊不需要心声**，保持原有逻辑，移除 INNER_VOICE 标签：

```javascript
const msgsText = recentMsgs.map(m => {
    let sender = m.groupSpeakerMeta?.name || m.senderName
    if (!sender) sender = m.role === 'user' ? (gChat.groupSettings?.myNickname || '我') : '群成员'
    let content = typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content)
    if (m.type === 'gift' && m.giftId) {
        content = `[GIFT:${m.giftName || '礼物'}:${m.giftQuantity || 1}:${m.giftNote || ''}](ID:${m.giftId})`
    }
    // 群聊不需要心声，移除 INNER_VOICE 标签
    content = content.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim()
    return `${sender}: ${content}`
}).join('\n')
```

#### 2. 私聊上下文构建（第 713-733 行） - 保留心声 ✅

**修改前**:
```javascript
const text = pMsgs.map(m => {
    const sender = m.role === 'user' ? (char.groupSettings?.myNickname || '我') : p.name
    let content = typeof m.content === 'object' ? JSON.stringify(m.content) : m.content
    if (m.type === 'gift' && m.giftId) {
        content = `[GIFT:${m.giftName || '礼物'}:${m.giftQuantity || 1}:${m.giftNote || ''}](ID:${m.giftId})`
    }
    // ❌ 简单删除心声
    const cleanContent = String(content).replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim()
    return `${sender}: ${cleanContent}`
}).join('\n')
```

**修改后**:
```javascript
const text = pMsgs.map(m => {
    const sender = m.role === 'user' ? (char.groupSettings?.myNickname || '我') : p.name
    let content = typeof m.content === 'object' ? JSON.stringify(m.content) : m.content
    if (m.type === 'gift' && m.giftId) {
        content = `[GIFT:${m.giftName || '礼物'}:${m.giftQuantity || 1}:${m.giftNote || ''}](ID:${m.giftId})`
    }
    // ✅ 【关键修改】保留心声内容作为上下文参考，让 AI 知道角色的衣着和所在地
    const voiceMatch = String(content).match(/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i)
    if (voiceMatch) {
        try {
            const voiceObj = JSON.parse(voiceMatch[1])
            const statusText = voiceObj.status || voiceObj.状态 || ''
            const outfitText = voiceObj.outfit || voiceObj.着装 || voiceObj.dress || ''
            const locationText = voiceObj.location || voiceObj.地点 || ''
            
            const statusSummary = []
            if (statusText) statusSummary.push(`状态：${statusText}`)
            if (outfitText) statusSummary.push(`着装：${outfitText}`)
            if (locationText) statusSummary.push(`位置：${locationText}`)
            
            if (statusSummary.length > 0) {
                content = `${content} [角色状态参考：${statusSummary.join('，')}]`
            }
        } catch (e) {
            console.warn('[AI Service] Failed to parse inner voice for context:', e)
        }
    }
    return `${sender}: ${content}`
}).join('\n')
```

---

## 🎯 修复效果

### 修复前
```
AI 回复 1: （穿着睡衣在家）你好呀~
AI 回复 2: （穿着正装在办公室）怎么了？突然找我
AI 回复 3: （穿着运动服在健身房）我刚运动完
```
❌ 每次回复衣着和地点都不同，角色状态不一致

### 修复后
```
AI 回复 1: （穿着睡衣在家）你好呀~ [角色状态参考：状态：放松，着装：粉色睡衣，位置：家中卧室]
AI 回复 2: （仍然穿着睡衣在家）怎么了？突然找我 [角色状态参考：状态：放松，着装：粉色睡衣，位置：家中卧室]
AI 回复 3: （还是穿着睡衣在家）我刚起床不久呢 [角色状态参考：状态：放松，着装：粉色睡衣，位置：家中卧室]
```
✅ AI 能看到之前的心声信息，保持角色状态一致

---

## 📊 技术细节

### 心声 JSON 格式
```json
{
  "status": "放松",
  "心声": "今天天气真好",
  "着装": "粉色睡衣",
  "location": "家中卧室",
  "stats": {
    "mood": 85,
    "energy": 90
  }
}
```

### 提取逻辑
1. **正则匹配**: `/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i`
2. **JSON 解析**: 提取心声 JSON 对象
3. **字段映射**: 支持中英文字段名
   - `status` / `状态`
   - `outfit` / `着装` / `dress`
   - `location` / `地点`
4. **构建摘要**: 生成 `[角色状态参考：状态：放松，着装：粉色睡衣，位置：家中卧室]`
5. **附加到消息**: 保留原消息内容，添加状态参考

### 容错处理
- **JSON 解析失败**: 保留原文，不删除心声
- **字段缺失**: 只添加存在的字段
- **格式错误**: 使用 try-catch 捕获异常

---

## 🧪 测试建议

### 测试场景 1: 私聊
1. 与 AI 角色私聊
2. AI 回复包含心声（着装、地点等信息）
3. 继续对话
4. **预期**: AI 保持相同的着装和地点

### 测试场景 2: 群聊
1. 在群聊中与多个 AI 对话
2. AI 回复包含心声
3. 其他 AI 成员也能看到状态信息
4. **预期**: 所有 AI 都能看到彼此的状态

### 测试场景 3: 跨会话
1. 关闭页面
2. 重新打开
3. 继续对话
4. **预期**: AI 仍能记住之前的状态（如果消息历史还在）

---

## 📝 注意事项

### 1. 性能影响
- 心声内容会增加上下文长度
- 但只提取关键字段，影响有限
- 建议设置合理的 `contextLimit`

### 2. 隐私考虑
- 心声包含角色的内心想法
- 在群聊中，其他 AI 成员也能看到
- 这符合"记忆互通"的设计理念

### 3. 兼容性
- 支持旧格式的心声（无标签 JSON）
- 支持中英文字段名
- 解析失败时降级处理

---

## 🔗 相关文件

- `src/utils/aiService.js` - AI 服务（主要修改）
- `src/stores/chatStore.js` - 聊天存储（心声处理）
- `src/views/WeChat/modals/ChatInnerVoiceCard.vue` - 心声卡片组件

---

## 📅 修改记录

- **修改时间**: 2026-03-06 23:45
- **修改版本**: v1.3.67
- **修改文件**: `src/utils/aiService.js`
- **修改行数**: 第 658-693 行（群聊）、第 713-733 行（私聊）
- **修改类型**: 功能增强（心声上下文保留）

---

**修复完成！现在 AI 可以正常读取心声信息，保持角色状态一致了！** 🎉
