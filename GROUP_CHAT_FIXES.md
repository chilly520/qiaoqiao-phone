# 群聊问题修复方案

## 🐛 问题清单

### 问题 1: 拍一拍显示群名而不是被拍者的群昵称
**现象**: "我拍了拍'测试'的头" 应该显示 "我拍了拍'元气少女梦梦'的头"

**原因**: 第 2667 行使用 `chat.name`（群名），应该根据被拍者 ID 查找对应的群昵称

**修复位置**: `src/stores/chatStore.js` 第 2640-2670 行

---

### 问题 2: AI 只生成 1-2 人回复，报数时没有所有人出来
**现象**: 说"所有人出来报数"，但只有 1-2 人回复

**可能原因**:
1. AI 提示词没有强调多人回复
2. 群成员参与逻辑不够强制
3. AI 为了节省 token 自动减少回复

**修复方案**: 
- 在 System Prompt 中强调群聊需要多人参与
- 添加报数/点名时的特殊处理逻辑

---

### 问题 3: 表情包消息没有被识别，直接消失
**现象**: AI 发送 `[STICKER:xxx]` 格式的表情包，但消息不显示

**可能原因**:
1. 消息类型判断错误
2. 表情包格式解析失败
3. 消息被过滤掉

**修复位置**: `src/utils/aiService.js` 表情包解析部分

---

### 问题 4: 新修改的群成员资料点击后是空白
**现象**: 点击新添加的 AI NPC 群成员，资料页面空白

**原因**: 新 NPC 数据没有正确传递到资料页面

**修复位置**: `src/views/WeChat/GroupSettings.vue` 和 `CharacterProfileView.vue`

---

## ✅ 修复计划

### 修复 1: 拍一拍显示正确昵称
```javascript
// 修改前 (第 2667 行)
content: `"${chat.name || '对方'}" ${action} ${suffix}`,

// 修改后
// 根据 target 找到对应的群成员昵称
let patTargetName = '我';
if (target === 'ai') {
  patTargetName = '自己';
} else if (target === 'user') {
  patTargetName = '我';
} else {
  // 查找群成员
  const member = (chat.participants || []).find(p => p.id === target);
  patTargetName = member ? (member.remark || member.name || '群成员') : '我';
}
content: `"${chat.groupSettings?.myNickname || '我'}" ${action} ${patTargetName}${suffix.startsWith('的') ? suffix : '的' + suffix}`,
```

### 修复 2: 强制多人回复
在 System Prompt 中添加群聊特殊说明:
```javascript
// 在群聊 System Prompt 中添加
if (char.isGroup) {
  systemPrompt += '\n\n【群聊规则】\n' +
    '1. 这是一个活跃的群聊，需要多个成员积极参与\n' +
    '2. 当用户说"所有人"、"报数"、"点名"等词时，必须让所有在线成员都回复\n' +
    '3. 每个成员的回复应该有不同的性格和语气\n' +
    '4. 不要只让 1-2 个人说话，要模拟真实的群聊氛围\n';
}
```

### 修复 3: 表情包消息显示
检查消息类型判断逻辑，确保 `[STICKER:xxx]` 格式被正确识别和显示。

### 修复 4: NPC 资料页面数据传递
确保 NPC 的完整信息（包括 bio）被传递到资料页面。

---

**修复优先级**: 1 > 3 > 2 > 4
