# 时间感知功能修复

## 问题描述

用户反馈时间感知功能失效：
- 每次发消息时没有把当前时间和距离上次互动多少分钟发送给 AI
- 查看上下文时发现缺少时间感知信息
- 怀疑被删除了

## 根本原因

原代码有两个问题：

### 1. 计算对象错误
**原代码**：只计算距离"用户上次发消息"的时间
```javascript
const userMessages = (chat.msgs || []).filter(m => m.role === 'user')
const lastUserMsg = userMessages.slice(-1)[0]
const diffMinutes = Math.floor((now - lastUserTime) / 1000 / 60)
```

**问题**：AI 回复后，如果用户立即回复，时间间隔仍然是从用户上次消息开始算，而不是从双方最后一次互动开始算。

### 2. 显示条件过于严格
**原代码**：只有间隔 >= 1 分钟才显示时间提示
```javascript
else if (diffMinutes >= 1) {
    // 显示时间提示
}
```

**问题**：连续聊天时（间隔几秒到几十秒），完全看不到时间感知信息。

## 解决方案

### 1. 修正计算逻辑
改为计算距离"双方最后一次成功互动"的时间（排除系统错误消息）：

```javascript
// 查找双方最后一条成功发送的消息（排除系统错误消息），计算时隔多久互动
// 注意：只计算 user 和 ai 角色，不计算 system 类型的错误提示
const validMessages = (chat.msgs || []).filter(m => m.role === 'user' || m.role === 'ai')
const lastInteractionMsg = validMessages.slice(-1)[0]
const lastInteractionTime = lastInteractionMsg ? lastInteractionMsg.timestamp : now
const diffMinutes = Math.floor((now - lastInteractionTime) / 1000 / 60)
```

**关键改进**：
- ✅ **过滤系统错误消息**：当 AI 回复失败时，会添加 `role: 'system'` 的错误提示，这些不会被计入互动时间
- ✅ **只计算有效消息**：只统计 `user` 和 `ai` 角色的消息，确保时间间隔准确
- ✅ **后台报错不影响计算**：即使 AI 调用失败，也不会影响下次互动的时间计算

### 2. 始终显示时间提示
改为**始终显示**时间感知信息（即使只有几秒钟）：

```javascript
// 时间感知提示：始终显示时间和互动间隔（即使只有几秒）
if (isTimeAware && !options.hiddenHint) {
    const last = mergedContext[mergedContext.length - 1];
    let timeStr = '';
    if (diffMinutes <= 0) {
        // 不到 1 分钟，显示秒数
        const diffSeconds = Math.floor((now - lastInteractionTime) / 1000);
        timeStr = diffSeconds <= 5 ? '刚刚' : `${diffSeconds}秒`;
    } else {
        // 超过 1 分钟，显示分钟或小时
        timeStr = diffMinutes >= 60 ? `${Math.floor(diffMinutes / 60)}小时${diffMinutes % 60}分` : `${diffMinutes}分`;
    }
    
    const timeHint = ` \n\n【系统提示：当前时间为 ${currentVirtualTime}，距离双方上一次互动时间为 ${timeStr}。请根据时长和当前时间段，在回复中表现出合理的反应。记得心声格式标签 [INNER_VOICE]】`;
    
    if (last && last.role === 'user') {
        last.content += timeHint;
    } else {
        mergedContext.push({ role: 'user', content: timeHint });
    }
}
```

## 修改效果

### 修复前
- ❌ 只计算用户消息，忽略 AI 回复
- ❌ 只有间隔 >= 1 分钟才显示时间
- ❌ 连续聊天时看不到时间感知信息
- ❌ 时间提示文案不够准确
- ❌ **系统错误消息会影响时间计算**

### 修复后
- ✅ 计算双方最后一次成功互动（排除系统错误）
- ✅ **始终显示**时间感知信息（即使只有几秒）
- ✅ 支持多种时间单位：刚刚（<=5 秒）、秒、分、小时
- ✅ 更准确的提示文案：“距离双方上一次互动时间”
- ✅ **AI 调用失败不影响下次互动的时间计算**

## 时间显示策略

| 间隔时长 | 显示效果 | 示例 |
|---------|---------|------|
| <= 5 秒 | 刚刚 | `刚刚` |
| < 1 分钟 | 显示秒数 | `30 秒` |
| 1-59 分钟 | 显示分钟 | `15 分` |
| >= 1 小时 | 显示小时 + 分钟 | `2 小时 30 分` |

## 完整示例

### 场景 1：连续聊天（间隔几秒）
```
【系统提示：当前时间为 2026 年 03 月 11 日 14:30:45 星期三，距离双方上一次互动时间为 3 秒。请根据时长和当前时间段，在回复中表现出合理的反应。记得心声格式标签 [INNER_VOICE]】
```

### 场景 2：间隔几分钟
```
【系统提示：当前时间为 2026 年 03 月 11 日 14:35:20 星期三，距离双方上一次互动时间为 5 分。请根据时长和当前时间段，在回复中表现出合理的反应。记得心声格式标签 [INNER_VOICE]】
```

### 场景 3：间隔很久
```
【系统提示：当前时间为 2026 年 03 月 11 日 16:20:15 星期三，距离双方上一次互动时间为 1 小时 45 分。请根据时长和当前时间段，在回复中表现出合理的反应。记得心声格式标签 [INNER_VOICE]】
```

### 场景 4:AI 调用失败（新增）
**场景描述**：
1. 用户发送消息 A（14:30:00）
2. AI 回复时网络错误，显示 `[系统错误] 请求失败...`（14:30:05）
3. 用户重新发送消息 B（14:30:10）

**修复前**：
- ❌ 时间计算会从系统错误消息开始算（14:30:05），导致间隔只有 5 秒

**修复后**：
- ✅ 时间计算从用户消息 A 开始算（14:30:00），间隔 10 秒，显示"10 秒"
- ✅ 系统错误消息不会被计入互动时间

## 修改文件

- `src/stores/chatStore.js` - 修复时间感知计算逻辑和显示策略

## 技术细节

### 变量重命名
避免与已有变量冲突：
- `lastMsg` → `lastInteractionMsg`
- `lastMsgTime` → `lastInteractionTime`

### 逻辑优先级
1. 通话模式提示（最高优先级）
2. hiddenHint（系统强制要求）
3. **时间感知提示（默认始终显示）**

### 向下兼容
- 保留 `timeAware` 开关（默认为 true）
- 保留 `timeSyncMode` 模式选择（system/manual）
- 保留虚拟时间格式（YYYY 年 MM 月 DD 日 HH:mm:ss 星期 X）

## 测试建议

1. **快速连续聊天测试**：
   - 发送一条消息
   - 立即回复（间隔<5 秒）
   - 查看 AI 回复的上下文，应该显示"刚刚"

2. **间隔几分钟测试**：
   - 发送一条消息
   - 等待 2-5 分钟
   - 再发送一条消息
   - 查看 AI 回复的上下文，应该显示"X 分"

3. **间隔很久测试**：
   - 发送一条消息
   - 等待 1 小时以上
   - 再发送一条消息
   - 查看 AI 回复的上下文，应该显示"X 小时 Y 分"

## 版本

- **修复日期**：2026-03-11
- **适用版本**：v1.3.70+
- **修复类型**：Bug 修复 + 功能增强
