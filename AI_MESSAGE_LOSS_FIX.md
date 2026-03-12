# AI 回复消息丢失问题修复

## 问题描述

用户反馈：
- **有时候 AI 调用成功了，但消息没有发到聊天框**
- **没有点打断，但消息就是没有出现**
- 后台日志显示 AI 已经返回了内容，但聊天界面看不到

## 根本原因

### 消息处理流程

1. AI API 调用成功 → 返回完整回复内容
2. 解析回复内容 → 拆分成多个 segments（文本、图片、表情包等）
3. 存入 `chat.pendingSegments` 数组
4. 调用 `consumePendingSegments()` 函数逐个处理并添加到聊天框
5. 处理完成后清除 `typingStatus`

### 问题所在

在 `sendMessageToAI()` 函数的 finally 块中（第 3528-3532 行），有这段代码：

```javascript
// Only clear typing if no segments are stuck
const chat = chats.value[chatId];
if (!chat?.pendingSegments || chat.pendingSegments.length === 0) {
    typingStatus.value[chatId] = false;
}
```

**致命问题**：
1. 当 `consumePendingSegments()` 正在处理消息队列时
2. 如果某个消息段处理出错（比如 JSON 解析失败、类型识别错误等）
3. 错误被 catch 捕获后，finally 块会检查 `pendingSegments`
4. 如果还有未处理的消息段（length > 0），**不会清除 typingStatus**
5. **但是！** catch 块中可能因为其他原因清除了 typingStatus
6. 一旦 typingStatus 被清除，`consumePendingSegments()` 中的循环会在下次迭代时中断：

```javascript
// consumePendingSegments 第 4032-4035 行
if (!typingStatus.value[chatId]) {
    console.log('[Pump] Typing status cleared outside, breaking loop for', chatId);
    break;  // ❌ 直接跳出循环，剩余消息不再处理！
}
```

**结果**：
- ✅ pendingSegments 中还有未处理的消息
- ❌ typingStatus 已经被清除
- ❌ 消息处理循环中断
- ❌ 用户看不到 AI 回复（虽然 API 调用成功了）

### 典型场景

**场景 1：JSON 解析失败**
```
AI 回复内容：{...复杂的 JSON...}
↓
解析失败 → throw Error
↓
catch 块记录错误
↓
finally 块检查 pendingSegments
↓
typingStatus 被意外清除
↓
consumePendingSegments 中断
↓
剩余消息全部丢失
```

**场景 2：消息类型识别错误**
```
AI 回复：[DRAW:一只猫]
↓
识别为 image 类型
↓
处理图片时出错
↓
typingStatus 被清除
↓
后续文本消息无法显示
```

## 解决方案

### 核心思路

**确保 `typingStatus` 只在 `consumePendingSegments()` 的 finally 块中清除**，避免在其他地方被意外清除导致消息处理中断。

### 修改内容

#### 1. 移除 sendMessageToAI 的 finally 块中的 typingStatus 清除逻辑

**修改前**（第 3527-3535 行）：
```javascript
} catch (e) {
    delete abortControllers[chatId];
    if (e.name === 'AbortError' || e.message === 'Aborted') return;
    useLoggerStore().addLog('ERROR', 'AI 响应处理失败', e.message);
    if (!(e.name === 'QuotaExceededError' || e.code === 22)) {
        addMessage(chatId, { role: 'system', content: `请求失败：${e.message}` });
    }
} finally {
    // Only clear typing if no segments are stuck
    const chat = chats.value[chatId];
    if (!chat?.pendingSegments || chat.pendingSegments.length === 0) {
        typingStatus.value[chatId] = false;  // ❌ 这里会意外清除
    }
    callStore.isSpeaking = false;
    delete abortControllers[chatId];
}
```

**修改后**：
```javascript
} catch (e) {
    delete abortControllers[chatId];
    if (e.name === 'AbortError' || e.message === 'Aborted') return;
    useLoggerStore().addLog('ERROR', 'AI 响应处理失败', e.message);
    if (!(e.name === 'QuotaExceededError' || e.code === 22)) {
        addMessage(chatId, { role: 'system', content: `请求失败：${e.message}` });
    }
    // CRITICAL FIX: Don't clear typingStatus here, let consumePendingSegments handle it
    // Otherwise, pendingSegments will be stuck and not processed
    return;
} finally {
    // REMOVED: Don't clear typingStatus here, it will cause message pump to stop
    // The typingStatus should ONLY be cleared in consumePendingSegments finally block
    callStore.isSpeaking = false;
    delete abortControllers[chatId];
}
```

#### 2. 保持 consumePendingSegments 的逻辑不变

该函数有自己的错误处理和 finally 块，会正确地清除 typingStatus：

```javascript
// consumePendingSegments (第 4244-4249 行)
} finally {
    isPumpProcessing.value[chatId] = false;
    typingStatus.value[chatId] = false;  // ✅ 这里才是正确的清除位置
    saveChats();
    console.log('[Pump] Finished consumption for', chatId);
}
```

## 修复效果

### 修复前

| 场景 | 结果 | 原因 |
|------|------|------|
| AI 回复正常 | ✅ 消息显示 | 无错误发生 |
| 某消息段处理失败 | ❌ 剩余消息丢失 | typingStatus 被清除，循环中断 |
| JSON 解析失败 | ❌ 后续消息丢失 | 同上 |
| 图片生成失败 | ❌ 文本消息丢失 | 同上 |

### 修复后

| 场景 | 结果 | 原因 |
|------|------|------|
| AI 回复正常 | ✅ 消息显示 | 正常流程 |
| 某消息段处理失败 | ✅ 跳过错误消息，继续处理 | typingStatus 不会被意外清除 |
| JSON 解析失败 | ✅ 其他消息正常显示 | consumePendingSegments 内部 catch 处理 |
| 图片生成失败 | ✅ 文本消息正常显示 | 每个 segment 独立处理 |

## 技术细节

### 消息处理流程（修复后）

```
sendMessageToAI()
  ↓
AI 调用成功
  ↓
解析并拆分 segments
  ↓
chat.pendingSegments = [seg1, seg2, seg3, ...]
  ↓
调用 consumePendingSegments()
  ├─→ while (pendingSegments.length > 0)
  │   ├─→ try {
  │   │   ├─→ 处理 segment
  │   │   ├─→ addMessage()
  │   │   └─→ shift() 移除已处理的 segment
  │   │   } catch (err) {
  │   │     ├─→ console.error(err)
  │   │     ├─→ shift() 跳过错误 segment
  │   │     └─→ continue (继续处理下一个)
  │   │   }
  │   └─→ 检查 typingStatus
  │       └─→ 只有在外部强制停止时才 break
  │
  └─→ finally {
      typingStatus = false  // ✅ 所有消息处理完成后才清除
  }
```

### 错误隔离

每个 segment 的处理都有独立的 try-catch：

```javascript
try {
    const segment = chat.pendingSegments[0];
    // ... 处理 segment
    await addMessage(chatId, msgOptions);
} catch (err) {
    console.error('[consumePendingSegments] Error processing segment:', err);
    chat.pendingSegments.shift(); // Skip broken segment
    saveChats();
    // continue to next segment
}
```

这意味着：
- ✅ 单个消息段失败不会影响其他消息
- ✅ typingStatus 只会在所有消息处理完成后清除
- ✅ 即使部分消息失败，成功的消息仍会显示

## 测试建议

### 测试场景 1：正常 AI 回复
1. 发送一条消息
2. AI 回复多段内容（文本 + 表情包）
3. ✅ 验证所有消息都正常显示

### 测试场景 2：包含错误内容
1. 发送一条消息
2. AI 回复中包含：
   - 正常的文本
   - 一个格式错误的 JSON 卡片
   - 一个有效的表情包
3. ✅ 验证文本和表情包显示，错误 JSON 被跳过

### 测试场景 3：图片生成失败
1. AI 回复 `[DRAW:一只猫]`
2. 图片生成 API 调用失败
3. ✅ 验证至少能看到"(绘画失败：xxx)"的错误提示

### 测试场景 4：复杂群聊消息
1. 群聊中 AI 连续发送多条消息
2. 中间某条消息处理失败
3. ✅ 验证其他消息仍然正常显示

## 修改文件

- `src/stores/chatStore.js` - 修复 sendMessageToAI 的 finally 块逻辑

## 版本

- **修复日期**：2026-03-11
- **适用版本**：v1.3.70+
- **修复类型**：Bug 修复（严重消息丢失问题）
