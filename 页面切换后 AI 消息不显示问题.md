# 页面切换后 AI 消息不显示问题

## 问题描述

**核心症状**：
- AI 生成回复后，如果用户切换路由/刷新页面/返回，新生成的消息不会显示在聊天窗口中
- "对方正在输入..."动画会消失，但消息内容不弹出
- 即使消息已经被添加到 `msgs` 数组中，页面也不会显示

**复现步骤**：
1. 打开聊天窗口，点击"生成"按钮
2. AI 开始生成回复（流式逐字显示）
3. 在生成过程中或生成完成后，点击返回按钮或刷新页面
4. 再次进入聊天窗口
5. **预期结果**：消息应该显示在聊天窗口底部
6. **实际结果**：消息不显示，即使控制台日志显示消息已添加

**最新修复**（版本 1.3.86）：
- ✅ 添加 loadedMessageCounts 更新逻辑
- ✅ 使用 keep-alive 保持 ChatWindow 组件状态
- ✅ 增强 onMounted 恢复逻辑

## 技术背景

### 技术栈
- Vue 3 + Vite + Pinia
- 流式 API（Streaming）：使用 `fetch` + `ReadableStream` + `getReader()` 逐字显示
- AbortController：用于控制 HTTP 请求的中止
- 组件生命周期：onMounted, onUnmounted
- localStorage/IndexedDB：聊天记录持久化

### 关键组件和文件

#### 1. `src/stores/chatStore.js`
**核心函数**：
- `sendMessageToAI(chatId, options)`: 发送消息给 AI 并处理流式响应
- `consumePendingSegments(chatId)`: 消息泵，负责将 pendingSegments 转换为实际消息
- `addMessage(chatId, msg)`: 添加消息到聊天数组
- `getDisplayedMessages(chatId)`: 获取待显示的消息（支持分页）
- `saveChats()`: 保存聊天记录到 localStorage/IndexedDB

**关键状态**：
- `chats.value`: 所有聊天对象
- `currentChatId`: 当前聊天 ID（**未持久化**）
- `typingStatus.value`: 每个聊天的输入中状态
- `pendingSegments`: 待消费的消息片段（已持久化）

#### 2. `src/views/WeChat/ChatWindow.vue`
**核心逻辑**：
- `onMounted()`: 组件挂载时恢复状态
- `visibilitychange`: 页面可见性变化时恢复状态
- `displayedMsgs`: computed 属性，过滤待显示的消息
- `scrollToBottom()`: 滚动到聊天底部

**消息过滤**：
```javascript
const displayedMsgs = computed(() => {
    return chatStore.getDisplayedMessages(chatStore.currentChatId).filter(m => !m.hidden)
})

const filteredDisplayMsgs = computed(() => {
    return (displayedMsgs.value || []).filter(msg => isMsgVisible(msg))
})
```

#### 3. `src/utils/aiService.js`
**流式请求处理**：
```javascript
if (reqBody.stream && response.ok) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    
    try {
        while (!done) {
            const { value, done: readerDone } = await reader.read();
            // 处理数据块
            if (options.onChunk) options.onChunk(delta, fullContent);
        }
    } catch (streamError) {
        console.warn('[Stream Error] Connection interrupted, using partial content:', fullContent);
    }
}
```

## 已尝试的修复方案

### 修复 1：保留 AbortController（版本 1.3.83）
**问题**：页面切换时组件销毁触发 cleanup，abortController 被删除，流式请求真正被中止

**修复**：
```javascript
// 移除 finally 块中的 delete abortControllers[chatId]
} finally {
    typingStatus.value[chatId] = false;
    callStore.isSpeaking = false;
    // REMOVED: delete abortControllers[chatId];
}
```

### 修复 2：强制恢复 typingStatus（版本 1.3.82）
**问题**：consumePendingSegments 依赖 typingStatus，为 false 就跳出循环

**修复**：
```javascript
// ChatWindow.vue onMounted
if (hasPendingSegments || aiJustFinished) {
    chatStore.typingStatus[chat.id] = true;
    chatStore.consumePendingSegments(chat.id);
}
```

### 修复 3：添加流式错误处理（版本 1.3.85）
**问题**：流式读取时页面切换导致连接中断，reader.read() 抛出错误但没有被捕获

**修复**：
```javascript
// aiService.js
try {
    while (!done) {
        const { value, done: readerDone } = await reader.read();
        // 处理数据
    }
} catch (streamError) {
    console.warn('[Stream Error] Connection interrupted, using partial content:', fullContent);
}
```

### 修复 4：智能恢复 currentChatId（最新版本）
**问题**：页面刷新后 currentChatId 重置为 null，导致恢复逻辑不执行

**修复**：
```javascript
// ChatWindow.vue onMounted
let targetChatId = chatStore.currentChatId;

if (!targetChatId) {
    // 查找有 pendingSegments 的聊天
    for (const chatId in chats) {
        if (chat.pendingSegments && chat.pendingSegments.length > 0) {
            targetChatId = chatId;
            break;
        }
    }
    
    // 查找最近有 AI 消息的聊天
    if (!targetChatId) {
        let mostRecentTime = 0;
        for (const chatId in chats) {
            const lastMsg = chat.msgs?.[chat.msgs.length - 1];
            if (lastMsg && lastMsg.role === 'ai' && lastMsg.timestamp > mostRecentTime) {
                mostRecentTime = lastMsg.timestamp;
                targetChatId = chatId;
            }
        }
    }
}

if (targetChatId) {
    chatStore.currentChatId = targetChatId;
    chatStore.resetPagination(targetChatId); // 重置分页
}
```

### 修复 5：强制响应式更新
**问题**：消息添加到数组后，Vue 响应式更新未触发

**修复**：
```javascript
// 在 consumePendingSegments 和 ChatWindow 中
chatStore.chats[chat.id] = { ...chat }; // 强制触发响应式更新
```

### 修复 6：强制滚动到底部
**问题**：即使消息已添加，页面可能没有滚动到底部

**修复**：
```javascript
// ChatWindow.vue onMounted
setTimeout(() => {
    scrollToBottom(true);
}, 100);
```

## 当前状态和日志分析

### 控制台日志显示：
```
[AI Response] Saved pendingSegments: 8 segments
[AI Response] currentChatId: 1768994836175
[AI Response] typingStatus before consume: true
[Pump] consumePendingSegments called for 1768994836175
[Pump] Chat object: exists
[Pump] pendingSegments: 0
[Pump] No pending segments, returning
[AI Response] consumePendingSegments completed
```

### 页面切换后的日志：
```
[ChatWindow] App became visible, checking pump status...
[ChatWindow] Chat exists: true
[ChatWindow] pendingSegments: 0
[ChatWindow] Last msg: Proxy{Object} {role: 'user', ...}
[ChatWindow] Last msg role: user
[ChatWindow] Last msg timestamp: 1773406873443
[ChatWindow] Time diff: 722521
[ChatWindow] Condition NOT met: {
    hasChat: true,
    hasPendingSegments: false,
    hasRecentAI: false,
    aiRecent: false
}
```

### 问题分析：
1. **pendingSegments 已经是 0**：说明消息已经被消费完了
2. **最后一条消息是 user 角色**：不是 AI 消息
3. **时间差是 722521ms（约 12 分钟）**：远超 30 秒的判断阈值
4. **消息已添加到 msgs 数组**：但页面没有显示

## 待验证的假设

### 假设 1：消息被 hidden 标记过滤
**验证方法**：
```javascript
// 在控制台执行
const chat = chatStore.chats[chatStore.currentChatId];
console.log('Last 5 messages:', chat.msgs.slice(-5).map(m => ({
    id: m.id,
    role: m.role,
    content: m.content?.substring(0, 50),
    hidden: m.hidden,
    type: m.type
})));
```

### 假设 2：分页导致消息不在显示范围内
**验证方法**：
```javascript
// 在控制台执行
console.log('Total msgs:', chat.msgs.length);
console.log('Loaded count:', chatStore.loadedMessageCounts[chat.id]);
console.log('Displayed count:', chatStore.getDisplayedMessages(chat.id).length);
```

### 假设 3：Vue 响应式更新未触发
**验证方法**：
```javascript
// 在控制台执行
console.log('chats reactive:', chatStore.chats);
console.log('currentChat reactive:', chatStore.currentChatId);
// 手动触发响应式更新
chatStore.chats[chat.id] = { ...chat };
```

### 假设 4：消息在内存中但 IndexedDB 中是旧数据
**验证方法**：
```javascript
// 在控制台执行
localforage.getItem('qiaoqiao_chats_v2').then(saved => {
    const savedChat = saved[chatStore.currentChatId];
    console.log('内存 msgs 长度:', chat.msgs.length);
    console.log('IndexedDB msgs 长度:', savedChat?.msgs?.length);
    console.log('差异:', chat.msgs.length - (savedChat?.msgs?.length || 0));
    if (chat.msgs.length > (savedChat?.msgs?.length || 0)) {
        console.log('⚠️ 警告：内存中的数据比 IndexedDB 新！说明保存可能失败了！');
    }
});
```

**调试脚本**：`debug_chat_messages.js` - 在浏览器控制台执行此脚本进行全面诊断

## 待尝试的解决方案

### 方案 1：强制刷新消息列表
```javascript
// 在 ChatWindow.vue onMounted 中
if (targetChatId) {
    // 强制刷新整个 chats 对象
    chatStore.chats = { ...chatStore.chats };
    
    nextTick(() => {
        scrollToBottom(true);
    });
}
```

### 方案 2：使用 key 强制重新渲染组件
```vue
<!-- ChatWindow.vue 模板 -->
<ChatMessageItem 
    v-for="(msg, index) in filteredDisplayMsgs" 
    :key="msg.id + '-' + Date.now()" 
    ...
/>
```

### 方案 3：使用 forceUpdate 或手动触发更新
```javascript
// ChatWindow.vue
import { getCurrentInstance } from 'vue'

const instance = getCurrentInstance()
const forceUpdate = () => {
    instance?.proxy?.$forceUpdate()
}

// 在 onMounted 中调用
forceUpdate()
```

### 方案 4：持久化 currentChatId
```javascript
// chatStore.js loadChats 函数中
async function loadChats() {
    const saved = await localforage.getItem('qiaoqiao_chats_v2');
    const savedCurrentChatId = await localforage.getItem('qiaoqiao_current_chat_id');
    
    if (saved) {
        chats.value = saved;
        if (savedCurrentChatId) {
            currentChatId.value = savedCurrentChatId;
        }
    }
}

// _saveChatsCore 中
await localforage.setItem('qiaoqiao_current_chat_id', currentChatId.value);
```

### 方案 5：使用 watch 监听 msgs 变化
```javascript
// ChatWindow.vue
watch(() => chatStore.chats[chatStore.currentChatId]?.msgs, (newMsgs, oldMsgs) => {
    if (newMsgs && newMsgs.length > (oldMsgs?.length || 0)) {
        console.log('[ChatWindow] New messages detected, scrolling to bottom');
        nextTick(() => {
            scrollToBottom(true);
        });
    }
}, { deep: true });
```

## 测试场景

### 场景 1：生成过程中切换页面
1. 点击"生成"
2. AI 正在流式输出（对方正在输入...）
3. 点击返回或刷新页面
4. 再次进入聊天窗口
5. **期望**：消息继续显示并完成

### 场景 2：生成完成后切换页面
1. 点击"生成"
2. AI 完成输出（所有消息已添加）
3. 点击返回或刷新页面
4. 再次进入聊天窗口
5. **期望**：所有消息都显示在聊天窗口中

### 场景 3：后台运行时完成生成
1. 点击"生成"
2. 切换到其他应用（页面在后台）
3. AI 完成输出
4. 返回应用
5. **期望**：新消息显示出来

## 相关文件清单

### 核心文件
- `src/stores/chatStore.js` (4348 行)
  - `sendMessageToAI` (第 3466-3582 行)
  - `consumePendingSegments` (第 4058-4310 行)
  - `addMessage` (第 1726-1838 行)
  - `getDisplayedMessages` (第 3983-3989 行)
  - `resetPagination` (第 3999 行)

- `src/views/WeChat/ChatWindow.vue` (4790 行)
  - `onMounted` (第 774-879 行)
  - `displayedMsgs` (第 245-249 行)
  - `filteredDisplayMsgs` (第 269-271 行)
  - `isMsgVisible` (第 210-243 行)
  - `scrollToBottom` (需要查找)

- `src/utils/aiService.js` (3025 行)
  - 流式请求处理 (第 1331-1367 行)

### 辅助文件
- `src/stores/settingsStore.js` - 用户设置
- `src/stores/callStore.js` - 通话状态
- `src/stores/worldLoopStore.js` - 世界循环

## 版本历史

- **1.3.79**: 恢复流式请求，在 ChatWindow 中恢复 typingStatus
- **1.3.80**: 优化 onMounted 恢复逻辑，使用 nextTick
- **1.3.81**: 添加三种情况的智能判断逻辑
- **1.3.82**: 强制恢复 typingStatus，时间窗口延长到 30 秒
- **1.3.83**: 移除 finally 块中的 delete abortControllers[chatId]
- **1.3.84**: 添加详细调试日志
- **1.3.85**: 添加流式读取错误处理
- **1.3.86**: ⭐ 重大更新
  - 添加 loadedMessageCounts 更新逻辑（consumePendingSegments 中）
  - 使用 keep-alive 保持 ChatWindow 组件状态
  - 增强 onMounted 恢复逻辑（智能查找活跃聊天）
  - 强制响应式更新和滚动到底部

## 联系信息

如需更多信息，请查看：
- 控制台日志（F12 -> Console）
- Network 面板中的 AI API 请求
- Application 面板中的 localStorage/IndexedDB 数据

---

**最后更新时间**：2026-03-13 21:30
**问题状态**：未解决
**影响范围**：所有使用 AI 生成回复的场景
